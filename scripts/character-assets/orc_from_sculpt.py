"""Build a game-resolution Orc rest mesh from the print sculpt.

Industry path: high-poly FBX → face-preserving remesh (finer head voxel) →
QuadriFlow/Decimate → UV → bake tangent normals + AO from the HP cage →
cavity albedo → automatic weights on the existing 65-joint source armature.
Print eyelids stay on the body. Do not park dummy eye spheres on the brow.

Isolated background Blender. Does not touch MCP 9876.
Does not write public/ashen-reach/equipment-orc/ — bind-source-orc.mjs
assembles the candidate, and live review gates the pack.

    /Applications/Blender.app/Contents/MacOS/Blender --background \
        --python scripts/character-assets/orc_from_sculpt.py -- \
        [--target-faces 18000] [--voxel 0.007] [--from-retopo] [--recook] [--tpose] [--yaw DEGREES]

See docs/orc-sculpt-pipeline.md.
"""
from __future__ import annotations

import json
import math
import sys
from pathlib import Path

import bpy
import bmesh
from mathutils import Matrix, Quaternion, Vector

ROOT = Path(__file__).resolve().parents[2]
HP_FBX = ROOT / 'blender/characters/sources/orc-print/Orc_22.fbx'
SRC = ROOT / 'public/characters/candidates/orc-source-v1.glb'
JOINTS_IN = ROOT / '.cache/source-motion/orc-source-joints.json'
CACHE = ROOT / '.cache/source-motion/orc-sculpt'
CACHE.mkdir(parents=True, exist_ok=True)
RETOPO = CACHE / 'retopo.glb'
REST = ROOT / '.cache/source-motion/orc-source-rest.glb'
JOINTS_OUT = ROOT / '.cache/source-motion/orc-source-joints.json'

TARGET_HEIGHT = 2.10
# Linear-ish albedo written straight into the packed texture (same convention
# as the previous lime SKIN). Churchyard hemi [.57,.65,.50] and moon
# [.65,.72,.52] already add green, so the base stays ashen/peat and only
# slightly olive. G/R \u2248 0.97 \u2192 ~1.10 under that lighting, not highlighter.
SKIN = (0.238, 0.244, 0.162, 1.0)
SKIN_HIGH = (0.318, 0.288, 0.188, 1.0)
SKIN_DIRT = (0.062, 0.052, 0.036, 1.0)
SKIN_WARM = (0.268, 0.188, 0.122, 1.0)
SKIN_COOL = (0.132, 0.138, 0.118, 1.0)
MOUTH = (0.055, 0.028, 0.024, 1.0)
IVORY = (0.76, 0.68, 0.48, 1.0)
IVORY_ROOT = (0.26, 0.20, 0.12, 1.0)
LEATHER = (0.12, 0.082, 0.052, 1.0)
EYE_SCLERA = (0.24, 0.17, 0.11, 1.0)
EYE_IRIS = (0.78, 0.42, 0.08, 1.0)
EYE_PUPIL = (0.018, 0.012, 0.008, 1.0)
EYE_CATCH = (0.95, 0.84, 0.58, 1.0)
EYE_EMIT = (0.42, 0.20, 0.04, 1.0)

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []


def arg(flag, default):
    return argv[argv.index(flag) + 1] if flag in argv else default


FROM_RETOPO = '--from-retopo' in argv
RECOOK = '--recook' in argv
DO_TPOSE = '--no-tpose' not in argv
TARGET_FACES = int(arg('--target-faces', '16000'))
HEAD_FACES = int(arg('--head-faces', '12000'))
VOXEL = float(arg('--voxel', '0.008'))
VOXEL_HEAD = float(arg('--voxel-head', '0.0025'))
YAW = float(arg('--yaw', '0'))


def log(msg):
    print(msg, flush=True)


def clear_scene():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=True)
    for block in (bpy.data.meshes, bpy.data.armatures, bpy.data.materials, bpy.data.images, bpy.data.cameras, bpy.data.lights):
        for item in list(block):
            block.remove(item)


def object_mode():
    if bpy.context.view_layer.objects.active and bpy.context.object and bpy.context.object.mode != 'OBJECT':
        bpy.ops.object.mode_set(mode='OBJECT')


def select_only(ob):
    object_mode()
    bpy.ops.object.select_all(action='DESELECT')
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob


def world_bbox(objects):
    lo = Vector((1e9, 1e9, 1e9))
    hi = Vector((-1e9, -1e9, -1e9))
    found = False
    for o in objects:
        if o.type != 'MESH' or not o.data.vertices:
            continue
        found = True
        mw = o.matrix_world
        for corner in o.bound_box:
            p = mw @ Vector(corner)
            lo.x, lo.y, lo.z = min(lo.x, p.x), min(lo.y, p.y), min(lo.z, p.z)
            hi.x, hi.y, hi.z = max(hi.x, p.x), max(hi.y, p.y), max(hi.z, p.z)
    if not found:
        return None
    return lo, hi


def tris_of(ob):
    return sum(len(p.vertices) - 2 for p in ob.data.polygons)


def apply_visual(ob):
    select_only(ob)
    if ob.parent:
        bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM')
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)


def join_objects(obs, name):
    if not obs:
        return None
    if len(obs) == 1:
        obs[0].name = name
        if obs[0].data:
            obs[0].data.name = name
        return obs[0]
    bpy.ops.object.select_all(action='DESELECT')
    for o in obs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = obs[0]
    bpy.ops.object.join()
    obs[0].name = name
    obs[0].data.name = name
    return obs[0]


# Inspect of Orc_22.fbx (2026-09-19), confirmed by per-part stills:
#   orc_11_copy4     torso, arms, head
#   腳掌3            legs / feet
#   Orc_22           tattered loincloth (OrcV1Shorts)
#   PM3D_Sphere3D1   tusks
#   Orc_Low          teeth
#   orc_9_copy1      eyes (OrcV1Eyes)
#   Extract4         tiny hip fragments — skip
BODY_KEEP = ('腳掌3', 'orc_11_copy4')
TUSK_KEEP = ('PM3D_Sphere3D1', 'Orc_Low')
SHORTS_KEEP = ('Orc_22',)
EYE_KEEP = ('orc_9_copy1',)


def pick_named(names):
    found = []
    for name in names:
        ob = bpy.data.objects.get(name)
        if ob and ob.type == 'MESH':
            found.append(ob)
        else:
            log(f'missing part {name!r}')
    return found


def pick_body_meshes():
    meshes = [o for o in bpy.data.objects if o.type == 'MESH' and o.data.vertices]
    if not meshes:
        raise RuntimeError('FBX imported no meshes')
    named = pick_named(BODY_KEEP)
    if named:
        log(f'body source: {[o.name for o in named]}')
        return named
    log('named body parts missing; falling back to largest mesh')
    winner = max(meshes, key=tris_of)
    return [winner]


def scale_to_height(ob, height=TARGET_HEIGHT):
    bb = world_bbox([ob])
    if not bb:
        raise RuntimeError('no bbox to scale')
    lo, hi = bb
    h = hi.z - lo.z
    if h < 1e-6:
        raise RuntimeError('degenerate height')
    s = height / h
    ob.scale *= s
    bpy.context.view_layer.update()
    apply_visual(ob)
    bpy.context.view_layer.update()
    bb = world_bbox([ob])
    lo, hi = bb
    ob.location.x -= (lo.x + hi.x) * 0.5
    ob.location.y -= (lo.y + hi.y) * 0.5
    ob.location.z -= lo.z
    bpy.context.view_layer.update()
    apply_visual(ob)
    log(f'scaled ×{s:.4f} to {height:.2f}m, feet on z=0')


def scale_scene_to_height(height=TARGET_HEIGHT):
    meshes = [o for o in bpy.data.objects if o.type == 'MESH']
    for o in meshes:
        apply_visual(o)
    bb = world_bbox(meshes)
    if not bb:
        raise RuntimeError('no meshes to scale')
    lo, hi = bb
    h = hi.z - lo.z
    if h < 1e-6:
        raise RuntimeError('degenerate combined height')
    s = height / h
    for o in list(bpy.data.objects):
        if o.parent is None:
            o.scale *= s
    bpy.context.view_layer.update()
    for o in [x for x in bpy.data.objects if x.type == 'MESH']:
        apply_visual(o)
    bb = world_bbox([o for o in bpy.data.objects if o.type == 'MESH'])
    lo, hi = bb
    delta = Vector((-(lo.x + hi.x) * 0.5, -(lo.y + hi.y) * 0.5, -lo.z))
    for o in list(bpy.data.objects):
        if o.parent is None:
            o.location += delta
    bpy.context.view_layer.update()
    for o in [x for x in bpy.data.objects if x.type == 'MESH']:
        apply_visual(o)
    log(f'scene scaled ×{s:.4f} to {height:.2f}m, feet on z=0')


def yaw_object(ob, degrees):
    if abs(degrees) < 1e-6:
        return
    ob.rotation_euler[2] += math.radians(degrees)
    bpy.context.view_layer.update()
    apply_visual(ob)
    log(f'yaw {degrees}°')


def duplicate(ob, name):
    copy = ob.copy()
    copy.data = ob.data.copy()
    copy.name = name
    copy.data.name = name
    bpy.context.collection.objects.link(copy)
    return copy


def voxel_remesh(ob, size):
    select_only(ob)
    ob.data.remesh_voxel_size = size
    ob.data.remesh_voxel_adaptivity = 0.0
    try:
        ob.data.use_remesh_fix_poles = True
    except Exception:
        pass
    log(f'voxel remesh {size}m on {len(ob.data.vertices)} verts / {tris_of(ob)} tris')
    bpy.ops.object.voxel_remesh()
    log(f'  -> {len(ob.data.vertices)} verts / {tris_of(ob)} tris')


def reduce_faces(ob, target, preserve_sharp=False):
    select_only(ob)
    current = max(tris_of(ob), 1)
    if current <= target * 1.15:
        log(f'retopo already {current} tris, skip reduce')
        return
    log(f'QuadriFlow target_faces={target} from {current} sharp={preserve_sharp}')
    try:
        bpy.ops.object.quadriflow_remesh(
            mode='FACES',
            target_faces=target,
            use_mesh_symmetry=True,
            use_preserve_sharp=preserve_sharp,
            use_preserve_boundary=True,
            seed=7,
        )
        log(f'  QuadriFlow -> {len(ob.data.vertices)} verts / {tris_of(ob)} tris')
    except Exception as err:
        log(f'  QuadriFlow failed ({err}); Decimate fallback')
    current = max(tris_of(ob), 1)
    if current <= target * 1.15:
        return
    select_only(ob)
    mod = ob.modifiers.new('Decimate', 'DECIMATE')
    mod.ratio = min(1.0, target / current)
    bpy.ops.object.modifier_apply(modifier='Decimate')
    log(f'  Decimate -> {len(ob.data.vertices)} verts / {tris_of(ob)} tris')


def separate_by_height(ob, z_frac, name):
    """Split the upper fraction of a mesh into a new object (print head)."""
    apply_visual(ob)
    bpy.context.view_layer.update()
    mw = ob.matrix_world
    zs = [(mw @ v.co).z for v in ob.data.vertices]
    cut = min(zs) + (max(zs) - min(zs)) * z_frac
    select_only(ob)
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='DESELECT')
    bpy.ops.mesh.select_mode(type='VERT')
    bpy.ops.object.mode_set(mode='OBJECT')
    n = 0
    for v in ob.data.vertices:
        v.select = (mw @ v.co).z >= cut
        n += int(v.select)
    log(f'separate {name} z>={cut:.3f} selected={n}/{len(ob.data.vertices)}')
    if n < 32:
        raise RuntimeError(f'head split selected {n} verts')
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.separate(type='SELECTED')
    bpy.ops.object.mode_set(mode='OBJECT')
    head = next(o for o in bpy.context.selected_objects if o != ob and o.type == 'MESH')
    head.name = name
    head.data.name = name
    return head


def mark_sharp(ob, degrees=32):
    select_only(ob)
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='DESELECT')
    bpy.ops.mesh.select_mode(type='EDGE')
    bpy.ops.mesh.edges_select_sharp(sharpness=math.radians(degrees))
    try:
        bpy.ops.mesh.mark_sharp()
    except Exception as err:
        log(f'mark sharp skipped: {err}')
    bpy.ops.object.mode_set(mode='OBJECT')


def ensure_cycles():
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    try:
        scene.cycles.device = 'CPU'
    except Exception:
        pass
    scene.cycles.samples = 8
    scene.cycles.use_denoising = False


def attach_bake_image(ob, img):
    if not ob.data.materials:
        assign_material(ob, make_material(ob.name + 'Bake', SKIN))
    mat = ob.data.materials[0]
    mat.use_nodes = True
    nt = mat.node_tree
    tex = nt.nodes.new('ShaderNodeTexImage')
    tex.image = img
    for node in nt.nodes:
        node.select = False
    tex.select = True
    nt.nodes.active = tex
    return tex


def bake_hp_maps(low, high, size=1024):
    """Tangent normals + AO from the print cage onto the game mesh."""
    if not low.data.uv_layers:
        smart_uv(low)
    try:
        low.data.calc_tangents()
    except Exception:
        pass
    low.data.materials.clear()
    assign_material(low, make_material(low.name + 'Bake', SKIN))
    high.hide_set(False)
    high.hide_render = False
    ensure_cycles()
    scene = bpy.context.scene
    scene.render.bake.use_selected_to_active = True
    scene.render.bake.use_cage = False
    scene.render.bake.cage_extrusion = 0.028
    scene.render.bake.max_ray_distance = 0.12
    scene.render.bake.margin = 8
    nrm = bpy.data.images.new(f'{low.name}Normal', size, size, alpha=False)
    try:
        nrm.colorspace_settings.name = 'Non-Color'
    except Exception:
        pass
    ao = bpy.data.images.new(f'{low.name}AO', size, size, alpha=False)
    try:
        ao.colorspace_settings.name = 'Non-Color'
    except Exception:
        pass
    out_n, out_ao = None, None
    for img, btype in ((ao, 'AO'), (nrm, 'NORMAL')):
        attach_bake_image(low, img)
        bpy.ops.object.select_all(action='DESELECT')
        high.select_set(True)
        low.select_set(True)
        bpy.context.view_layer.objects.active = low
        try:
            if btype == 'NORMAL':
                scene.render.bake.normal_space = 'TANGENT'
            bpy.ops.object.bake(type=btype, use_clear=True)
            img.pack()
            log(f'baked {btype} {size}px from HP cage')
            if btype == 'NORMAL':
                out_n = img
            else:
                out_ao = img
        except Exception as err:
            log(f'bake {btype} failed: {err}')
    return out_n, out_ao


def stamp_chin_skin(ob, img, landmarks, radius=2):
    """Overwrite chin-pad UV pixels so tusk-island bleed cannot stay ivory."""
    uv_layer = ob.data.uv_layers.active
    if not img or not uv_layer:
        return
    mw = ob.matrix_world
    lo, hi = landmarks['lo'], landmarks['hi']
    h = max(hi.z - lo.z, 1e-6)
    cx = (lo.x + hi.x) * 0.5
    w, ht = img.size
    pix = list(img.pixels)
    n = 0
    for loop in ob.data.loops:
        p = mw @ ob.data.vertices[loop.vertex_index].co
        t = (p.z - lo.z) / h
        if not (0.76 <= t <= 0.845 and abs(p.x - cx) < 0.045):
            continue
        u, v = uv_layer.data[loop.index].uv
        px = int(round(u * (w - 1)))
        py = int(round(v * (ht - 1)))
        for dx in range(-radius, radius + 1):
            for dy in range(-radius, radius + 1):
                x, y = px + dx, py + dy
                if x < 0 or y < 0 or x >= w or y >= ht:
                    continue
                i = (y * w + x) * 4
                pix[i] = SKIN[0]
                pix[i + 1] = SKIN[1]
                pix[i + 2] = SKIN[2]
                pix[i + 3] = 1.0
                n += 1
    if n:
        img.pixels = pix
        img.pack()
        log(f'stamped chin pad {n} albedo texels to skin')


def multiply_ao(albedo, ao_img, strength=0.55):
    if not albedo or not ao_img:
        return
    a = list(albedo.pixels)
    o = list(ao_img.pixels)
    n = min(len(a), len(o))
    for i in range(0, n, 4):
        k = 1.0 - strength + strength * o[i]
        a[i] *= k
        a[i + 1] *= k
        a[i + 2] *= k
    albedo.pixels = a
    albedo.pack()
    log(f'multiplied AO into albedo strength={strength}')


def shrinkwrap(ob, target):
    select_only(ob)
    mod = ob.modifiers.new('Wrap', 'SHRINKWRAP')
    mod.target = target
    mod.wrap_method = 'NEAREST_SURFACEPOINT'
    bpy.ops.object.modifier_apply(modifier='Wrap')
    log('shrinkwrap to HP applied')


def shade_smooth(ob):
    select_only(ob)
    mesh = ob.data
    try:
        mesh.use_auto_smooth = True
        mesh.auto_smooth_angle = math.radians(60)
    except Exception:
        pass
    for p in mesh.polygons:
        p.use_smooth = True
    try:
        bpy.ops.object.shade_smooth()
    except Exception:
        pass


def smart_uv(ob):
    select_only(ob)
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.002)
    bpy.ops.object.mode_set(mode='OBJECT')
    log('smart UV projected')


def _lerp(a, b, t):
    t = max(0.0, min(1.0, t))
    return (a[0] * (1 - t) + b[0] * t, a[1] * (1 - t) + b[1] * t, a[2] * (1 - t) + b[2] * t, 1.0)


def _hash01(i):
    return ((i * 1103515245 + 12345) & 0x7FFFFFFF) / 0x7FFFFFFF


def _lum(c):
    return 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2]


def paint_cavity(ob, base=SKIN, dirt=SKIN_DIRT):
    mesh = ob.data
    for attr in list(mesh.color_attributes):
        mesh.color_attributes.remove(attr)
    attr = mesh.color_attributes.new(name='Col', type='FLOAT_COLOR', domain='POINT')
    bm = bmesh.new()
    bm.from_mesh(mesh)
    bm.normal_update()
    bm.verts.ensure_lookup_table()
    colors = [None] * len(bm.verts)
    for v in bm.verts:
        if v.link_edges:
            avg = sum((v.normal.dot(e.other_vert(v).normal) for e in v.link_edges), 0.0) / len(v.link_edges)
            crease = max(0.0, min(1.0, (1.0 - avg) * 2.2))
        else:
            crease = 0.0
        under = max(0.0, -v.normal.z) * 0.4
        k = max(0.0, min(1.0, crease + under))
        colors[v.index] = _lerp(base, dirt, k)
    bm.free()
    for i, col in enumerate(colors):
        attr.data[i].color = col
    log('cavity vertex colors painted')


def existing_tusk_verts(ob):
    """Tusk verts from muzzle geometry only. Albedo luminance re-paints chin/pec bleed."""
    geo = geometric_tusk_verts(ob)
    log(f'tusk verts geometric: {len(geo)}')
    return geo


def geometric_tusk_verts(ob):
    mw = ob.matrix_world
    pts = [(i, mw @ v.co) for i, v in enumerate(ob.data.vertices)]
    lo_z = min(p.z for _, p in pts)
    hi_z = max(p.z for _, p in pts)
    h = hi_z - lo_z
    cx = sum(p.x for _, p in pts) / len(pts)
    z0, z1 = lo_z + h * 0.805, lo_z + h * 0.875
    band = [(i, p) for i, p in pts if z0 <= p.z <= z1 and 0.032 < abs(p.x - cx) < 0.10]
    if len(band) < 20:
        return set()
    ys = sorted(p.y for _, p in band)
    y_cut = ys[max(0, int(len(ys) * 0.32))]
    front = [(i, p) for i, p in band if p.y <= y_cut]
    tusks = set()
    for sign in (-1, 1):
        side = [(i, p) for i, p in front if sign * (p.x - cx) > 0.014]
        if len(side) < 6:
            continue
        side.sort(key=lambda ip: ip[1].y)
        n = max(8, len(side) // 8)
        tusks.update(i for i, _ in side[:n])
    return tusks


def find_face_landmarks(ob, tusks=None):
    """Sockets sit under the brow, above the tusks. Mouth cavity is more recessed — do not use max-Y."""
    mw = ob.matrix_world
    rot = mw.to_3x3()
    pts = []
    for v in ob.data.vertices:
        p = mw @ v.co
        n = (rot @ v.normal).normalized()
        pts.append((v.index, p, n))
    lo = Vector((min(p.x for _, p, _ in pts), min(p.y for _, p, _ in pts), min(p.z for _, p, _ in pts)))
    hi = Vector((max(p.x for _, p, _ in pts), max(p.y for _, p, _ in pts), max(p.z for _, p, _ in pts)))
    h = hi.z - lo.z
    cx = (lo.x + hi.x) * 0.5
    tusk_z = lo.z + h * 0.84
    if tusks:
        tusk_pts = [p for i, p, _ in pts if i in tusks]
        if tusk_pts:
            zs = sorted(p.z for p in tusk_pts)
            tusk_z = zs[int(len(zs) * 0.72)]
    head = [p for _, p, _ in pts if p.z >= lo.z + h * 0.80]
    if len(head) < 30:
        head = [p for _, p, _ in pts]
    hlo = Vector((min(p.x for p in head), min(p.y for p in head), min(p.z for p in head)))
    hhi = Vector((max(p.x for p in head), max(p.y for p in head), max(p.z for p in head)))
    # Slits live above the tusks and below the crown. The oral cavity is below tusk_z.
    z0 = tusk_z + 0.028
    z1 = lo.z + h * 0.97

    def socket(sign):
        cluster = []
        for _, p, n in pts:
            if p.z < z0 or p.z > z1:
                continue
            if sign * (p.x - cx) < 0.018:
                continue
            if n.y > -0.12:
                continue
            cluster.append(p)
        if len(cluster) < 6:
            cluster = [p for _, p, n in pts if z0 <= p.z <= z1 and sign * (p.x - cx) > 0.014 and n.y < 0.05]
        if not cluster:
            return Vector((cx + sign * 0.038, hlo.y + (hhi.y - hlo.y) * 0.18, min(z1, tusk_z + 0.07)))
        cluster.sort(key=lambda p: p.y)
        take = cluster[: max(8, len(cluster) // 3)]
        c = sum(take, Vector((0, 0, 0))) / len(take)
        # Sit in the slit, not floating in front of the brow.
        c.y += 0.007
        return c

    marks = {
        'eye_l': socket(-1),
        'eye_r': socket(+1),
        'lo': lo,
        'hi': hi,
        'head_lo': hlo,
        'head_hi': hhi,
        'tusk_z': tusk_z,
    }
    log(
        'face landmarks '
        f"L={tuple(round(c, 3) for c in marks['eye_l'])} "
        f"R={tuple(round(c, 3) for c in marks['eye_r'])} "
        f'tusk_z={tusk_z:.3f} eye_z={marks["eye_l"].z:.3f}'
    )
    if marks['eye_l'].z <= tusk_z + 0.02:
        log('WARNING: eye landmark is not above the tusks')
    return marks


def paint_skin(ob, tusks=None, landmarks=None):
    """Ashen peat-olive skin with readable face: sockets, muzzle, mouth, ivory tusks."""
    mesh = ob.data
    mw = ob.matrix_world
    if tusks is None:
        tusks = existing_tusk_verts(ob)
    if landmarks is None:
        landmarks = find_face_landmarks(ob, tusks=tusks)
    lo, hi = landmarks['lo'], landmarks['hi']
    h = max(hi.z - lo.z, 1e-6)
    cx = (lo.x + hi.x) * 0.5
    eye_l, eye_r = landmarks['eye_l'], landmarks['eye_r']
    tusk_pts = [mw @ mesh.vertices[i].co for i in tusks] if tusks else []
    for attr in list(mesh.color_attributes):
        mesh.color_attributes.remove(attr)
    attr = mesh.color_attributes.new(name='Col', type='FLOAT_COLOR', domain='POINT')
    bm = bmesh.new()
    bm.from_mesh(mesh)
    bm.normal_update()
    bm.verts.ensure_lookup_table()
    colors = [None] * len(bm.verts)
    tusk_count = 0
    for v in bm.verts:
        p = mw @ v.co
        t = (p.z - lo.z) / h
        fy = (p.y - lo.y) / max(hi.y - lo.y, 1e-6)
        if v.link_edges:
            avg = sum((v.normal.dot(e.other_vert(v).normal) for e in v.link_edges), 0.0) / len(v.link_edges)
            crease = max(0.0, min(1.0, (1.0 - avg) * 2.35))
        else:
            crease = 0.0
        under = max(0.0, -v.normal.z)
        mottle = (_hash01(v.index) - 0.5) * 0.10
        on_chin = t < 0.845 and abs(p.x - cx) < 0.042
        if v.index in tusks and t > 0.80 and not on_chin:
            tusk_count += 1
            col = _lerp(IVORY, IVORY_ROOT, crease * 0.55 + under * 0.15)
        else:
            col = _lerp(SKIN, SKIN_HIGH, max(0.0, v.normal.z) * 0.55)
            col = _lerp(col, SKIN_DIRT, max(0.0, min(1.0, crease * 1.05 + under * 0.22)))
            col = _lerp(col, SKIN_COOL, under * 0.18)
            if t > 0.78:
                d_l = (p - eye_l).length
                d_r = (p - eye_r).length
                socket = max(0.0, 1.0 - min(d_l, d_r) / 0.042)
                col = _lerp(col, SKIN_COOL, socket * 0.9)
                col = _lerp(col, SKIN_DIRT, socket * max(crease, 0.35) * 0.7)
                if 0.78 <= t <= 0.88 and fy < 0.38:
                    mouth = max(0.0, (0.38 - fy) / 0.38) * (1.0 - abs(t - 0.835) / 0.055)
                    if crease > 0.18 and fy > 0.14:
                        col = _lerp(col, MOUTH, min(1.0, mouth * 1.25))
                    else:
                        col = _lerp(col, SKIN_WARM, mouth * 0.85)
                if 0.89 <= t <= 0.97 and v.normal.y < -0.18:
                    col = _lerp(col, SKIN_HIGH, 0.58)
                if tusk_pts and t < 0.92:
                    dmin = min((p - tp).length for tp in tusk_pts)
                    if dmin < 0.024:
                        col = _lerp(col, MOUTH, (1.0 - dmin / 0.024) * 0.85)
                if on_chin:
                    col = _lerp(col, SKIN, 0.82)
            col = (
                max(0.0, col[0] * (1.0 + mottle)),
                max(0.0, col[1] * (1.0 + mottle * 0.65)),
                max(0.0, col[2] * (1.0 + mottle * 0.45)),
                1.0,
            )
        colors[v.index] = col
    bm.free()
    for i, col in enumerate(colors):
        attr.data[i].color = col
    log(f'skin vertex colors painted tusks={tusk_count}/{len(tusks)} verts={len(colors)}')


def paint_eye_vcol(ob):
    mesh = ob.data
    for attr in list(mesh.color_attributes):
        mesh.color_attributes.remove(attr)
    attr = mesh.color_attributes.new(name='Col', type='FLOAT_COLOR', domain='POINT')
    bm = bmesh.new()
    bm.from_mesh(mesh)
    bm.normal_update()
    bm.verts.ensure_lookup_table()
    catch_dir = Vector((0.28, -0.82, 0.48)).normalized()
    for v in bm.verts:
        n = (ob.matrix_world.to_3x3() @ v.normal).normalized()
        facing = max(0.0, -n.y)
        if facing > 0.80:
            col = EYE_PUPIL
        elif facing > 0.16:
            col = _lerp(EYE_IRIS, EYE_PUPIL, max(0.0, (facing - 0.52) / 0.28))
        else:
            col = EYE_SCLERA
        hot = n.dot(catch_dir)
        if hot > 0.88:
            col = EYE_CATCH
        elif hot > 0.74:
            col = _lerp(col, EYE_CATCH, (hot - 0.74) / 0.14)
        attr.data[v.index].color = col
    bm.free()
    log(f'eye vertex colors painted on {ob.name}')


def decimate_to(ob, target):
    current = max(tris_of(ob), 1)
    if current <= target * 1.15:
        log(f'{ob.name} already {current} tris, skip decimate')
        return
    select_only(ob)
    mod = ob.modifiers.new('Decimate', 'DECIMATE')
    mod.ratio = min(1.0, target / current)
    bpy.ops.object.modifier_apply(modifier='Decimate')
    log(f'decimate {ob.name} {current} -> {tris_of(ob)} tris')


def bake_vcol_image(ob, size=1024, fallback=SKIN):
    """Rasterize POINT vertex colors into a packed albedo. Lite ignores COLOR_0."""
    mesh = ob.data
    uv_layer = mesh.uv_layers.active
    col_attr = mesh.color_attributes.get('Col')
    if not uv_layer:
        smart_uv(ob)
        uv_layer = mesh.uv_layers.active
    pixels = [fallback[0], fallback[1], fallback[2], 1.0] * (size * size)
    if not col_attr or not uv_layer:
        log(f'bake {ob.name}: no vcol/uv, solid fill')
    else:
        mesh.calc_loop_triangles()
        uvs = uv_layer.data

        def vert_col(idx):
            c = col_attr.data[idx].color
            return (c[0], c[1], c[2])

        def put(px, py, r, g, b):
            if px < 0 or py < 0 or px >= size or py >= size:
                return
            i = (py * size + px) * 4
            pixels[i] = r
            pixels[i + 1] = g
            pixels[i + 2] = b
            pixels[i + 3] = 1.0

        for tri in mesh.loop_triangles:
            pts = []
            cols = []
            for li in tri.loops:
                uv = uvs[li].uv
                pts.append((uv.x * (size - 1), uv.y * (size - 1)))
                cols.append(vert_col(mesh.loops[li].vertex_index))
            xs = [p[0] for p in pts]
            ys = [p[1] for p in pts]
            minx, maxx = int(min(xs)), int(max(xs)) + 1
            miny, maxy = int(min(ys)), int(max(ys)) + 1
            if maxx - minx > size // 2 or maxy - miny > size // 2:
                for (x, y), (r, g, b) in zip(pts, cols):
                    ix, iy = int(round(x)), int(round(y))
                    for dx in range(-1, 2):
                        for dy in range(-1, 2):
                            put(ix + dx, iy + dy, r, g, b)
                continue
            ax, ay = pts[0]
            bx, by = pts[1]
            cx, cy = pts[2]
            denom = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy)
            if abs(denom) < 1e-8:
                continue
            for y in range(max(0, miny), min(size, maxy + 1)):
                for x in range(max(0, minx), min(size, maxx + 1)):
                    w0 = ((by - cy) * (x - cx) + (cx - bx) * (y - cy)) / denom
                    w1 = ((cy - ay) * (x - cx) + (ax - cx) * (y - cy)) / denom
                    w2 = 1.0 - w0 - w1
                    if w0 < -0.01 or w1 < -0.01 or w2 < -0.01:
                        continue
                    r = w0 * cols[0][0] + w1 * cols[1][0] + w2 * cols[2][0]
                    g = w0 * cols[0][1] + w1 * cols[1][1] + w2 * cols[2][1]
                    b = w0 * cols[0][2] + w1 * cols[1][2] + w2 * cols[2][2]
                    put(x, y, r, g, b)
        log(f'baked {ob.name} albedo {size}px from vertex colors')
    img = bpy.data.images.new(f'{ob.name}Albedo', width=size, height=size, alpha=False)
    try:
        img.colorspace_settings.name = 'sRGB'
    except Exception:
        pass
    img.pixels = pixels
    img.pack()
    return img


def strip_materials(ob, keep_images=()):
    keep = {img for img in keep_images if img}
    for mat in list(ob.data.materials):
        if mat and mat.use_nodes:
            for node in mat.node_tree.nodes:
                if node.type == 'TEX_IMAGE' and node.image:
                    img = node.image
                    node.image = None
                    if img not in keep and img.users <= 1:
                        bpy.data.images.remove(img)
        ob.data.materials.pop(index=0)


def existing_normal_image(ob):
    mat = ob.data.materials[0] if ob.data.materials else None
    if not mat or not mat.use_nodes:
        return None
    nt = mat.node_tree
    for node in nt.nodes:
        if node.type != 'NORMAL_MAP':
            continue
        for link in nt.links:
            if link.to_node == node and getattr(link.from_node, 'image', None):
                return link.from_node.image
    for node in nt.nodes:
        if node.type == 'TEX_IMAGE' and node.image and 'normal' in (node.image.name or '').lower():
            return node.image
    return None


def recook_albedo(ob, fallback, size=1024, roughness=0.88, skin=True, ao_img=None, normal_img=None):
    """Always rebuild packed albedo. Existing textures used to skip recook."""
    tusks = existing_tusk_verts(ob) if skin and fallback == SKIN else set()
    landmarks = find_face_landmarks(ob, tusks=tusks) if skin and fallback == SKIN else None
    strip_materials(ob, keep_images=(ao_img, normal_img))
    if not ob.data.uv_layers:
        smart_uv(ob)
    if skin and fallback == SKIN:
        paint_skin(ob, tusks=tusks, landmarks=landmarks)
    else:
        dirt = (0.04, 0.02, 0.01, 1.0) if fallback == LEATHER else SKIN_DIRT
        paint_cavity(ob, base=fallback, dirt=dirt)
    albedo = bake_vcol_image(ob, size, fallback)
    if ao_img:
        multiply_ao(albedo, ao_img)
    if skin and fallback == SKIN and landmarks:
        stamp_chin_skin(ob, albedo, landmarks)
    assign_albedo(ob, albedo, fallback, roughness=roughness, normal=normal_img)
    log(f'recooked albedo {ob.name} {size}px roughness={roughness} normal={bool(normal_img)}')
    return landmarks


def assign_albedo(ob, img, fallback=SKIN, roughness=0.88, emission=None, emission_strength=0.0, normal=None):
    mat = make_material(
        ob.name + 'Mat', fallback, roughness=roughness,
        emission=emission, emission_strength=emission_strength,
    )
    nt = mat.node_tree
    bsdf = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    tex = nt.nodes.new('ShaderNodeTexImage')
    tex.image = img
    tex.location = (-400, 200)
    nt.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
    if normal:
        ntex = nt.nodes.new('ShaderNodeTexImage')
        ntex.image = normal
        try:
            ntex.image.colorspace_settings.name = 'Non-Color'
        except Exception:
            pass
        ntex.location = (-400, 0)
        nmap = nt.nodes.new('ShaderNodeNormalMap')
        nmap.location = (-180, 0)
        nt.links.new(ntex.outputs['Color'], nmap.inputs['Color'])
        nt.links.new(nmap.outputs['Normal'], bsdf.inputs['Normal'])
    assign_material(ob, mat)


def _set_emission(bsdf, color, strength):
    if not color or strength <= 0:
        return
    if 'Emission Color' in bsdf.inputs:
        bsdf.inputs['Emission Color'].default_value = color
        if 'Emission Strength' in bsdf.inputs:
            bsdf.inputs['Emission Strength'].default_value = strength
    elif 'Emission' in bsdf.inputs:
        bsdf.inputs['Emission'].default_value = color


def make_material(name, color, roughness=0.72, metallic=0.0, vertex_color=None, emission=None, emission_strength=0.0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    bsdf.inputs['Base Color'].default_value = color
    # Principled input identifiers differ across Blender versions.
    for key, value in (('Roughness', roughness), ('Metallic', metallic)):
        if key in bsdf.inputs:
            bsdf.inputs[key].default_value = value
    _set_emission(bsdf, emission, emission_strength)
    if vertex_color:
        vcol = nt.nodes.new('ShaderNodeVertexColor')
        vcol.layer_name = vertex_color
        nt.links.new(vcol.outputs['Color'], bsdf.inputs['Base Color'])
    return mat


def assign_material(ob, mat):
    ob.data.materials.clear()
    ob.data.materials.append(mat)


def export_glb(path, objects):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects:
        if o.type == 'MESH':
            o.data.name = o.name
        o.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    path.parent.mkdir(parents=True, exist_ok=True)
    kwargs = dict(
        filepath=str(path),
        use_selection=True,
        export_format='GLB',
        export_yup=True,
        export_animations=False,
        export_skins=True,
        export_all_influences=False,
        export_materials='EXPORT',
        export_cameras=False,
        export_lights=False,
        export_texcoords=True,
        export_normals=True,
    )
    try:
        bpy.ops.export_scene.gltf(**kwargs, export_tangents=True)
    except TypeError:
        bpy.ops.export_scene.gltf(**kwargs)
    log(f'exported {path} ({path.stat().st_size} bytes)')


def build_retopo():
    if not HP_FBX.exists():
        raise FileNotFoundError(HP_FBX)
    log(f'IMPORT FBX {HP_FBX}')
    bpy.ops.import_scene.fbx(filepath=str(HP_FBX))
    scale_scene_to_height()
    if YAW:
        for o in [x for x in bpy.data.objects if x.type == 'MESH']:
            yaw_object(o, YAW)
    shorts_src = pick_named(SHORTS_KEEP)
    tusk_src = pick_named(TUSK_KEEP)
    body = join_objects(pick_body_meshes(), 'OrcHP')
    tusks = join_objects(tusk_src, 'OrcTusks') if tusk_src else None
    shorts = join_objects(shorts_src, 'OrcV1Shorts') if shorts_src else None
    # Print eyeballs remesh into forehead blobs. Eyelids live on the body.
    hp_parts = [duplicate(body, 'OrcHPCageBody')]
    if tusks:
        hp_parts.append(duplicate(tusks, 'OrcHPCageTusks'))
    hp = join_objects(hp_parts, 'OrcHPCage') if len(hp_parts) > 1 else hp_parts[0]
    hp.hide_set(True)
    head = separate_by_height(body, 0.80, 'OrcHead')
    # Voxel remesh erases eyelid slits and, after a head split, shreds the open neck.
    # Collapse the print topology instead.
    select_only(head)
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.mesh.normals_make_consistent(inside=False)
    bpy.ops.object.mode_set(mode='OBJECT')
    decimate_to(head, HEAD_FACES)
    select_only(body)
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.mesh.normals_make_consistent(inside=False)
    bpy.ops.object.mode_set(mode='OBJECT')
    decimate_to(body, TARGET_FACES)
    body = join_objects([body, head], 'OrcV1Body')
    select_only(body)
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.mesh.remove_doubles(threshold=0.0012)
    bpy.ops.mesh.normals_make_consistent(inside=False)
    bpy.ops.object.mode_set(mode='OBJECT')
    if tusks:
        decimate_to(tusks, 2200)
        shade_smooth(tusks)
        body = join_objects([body, tusks], 'OrcV1Body')
    shrinkwrap(body, hp)
    shade_smooth(body)
    smart_uv(body)
    body.name = 'OrcV1Body'
    body.data.name = 'OrcV1Body'
    nrm, ao = bake_hp_maps(body, hp, 1024)
    recook_albedo(body, SKIN, 1024, roughness=0.88, skin=True, ao_img=ao, normal_img=nrm)
    bpy.data.objects.remove(hp, do_unlink=True)
    keep = {body}
    if shorts:
        if tris_of(shorts) > 4000:
            decimate_to(shorts, 2500)
        close_crotch_hole(shorts)
        shade_smooth(shorts)
        smart_uv(shorts)
        recook_albedo(shorts, LEATHER, 512, roughness=0.92, skin=False)
        shorts.name = 'OrcV1Shorts'
        keep.add(shorts)
    for o in list(bpy.data.objects):
        if o not in keep:
            bpy.data.objects.remove(o, do_unlink=True)
    export_glb(RETOPO, list(keep))
    log(f'RETOPO COMPLETE verts={len(body.data.vertices)} tris={tris_of(body)} shorts={bool(shorts)} eyes=placeholder')
    return body


def purge_meshes():
    for o in list(bpy.data.objects):
        if o.type == 'MESH':
            bpy.data.objects.remove(o, do_unlink=True)
    for m in list(bpy.data.meshes):
        bpy.data.meshes.remove(m)


def import_source_armature():
    log(f'IMPORT SOURCE ARMATURE {SRC}')
    bpy.ops.import_scene.gltf(filepath=str(SRC))
    arm = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
    arm.name = 'SourceArmature'
    if arm.animation_data:
        arm.animation_data_clear()
    arm.data.pose_position = 'REST'
    for p in arm.pose.bones:
        p.matrix_basis = Matrix.Identity(4)
    bpy.context.view_layer.update()
    hips = arm.pose.bones.get('mixamorig:Hips')
    if hips:
        hw = arm.matrix_world @ hips.head
        log(f'armature pre-apply scale={tuple(round(s, 5) for s in arm.scale)} parent={arm.parent} hips_world={tuple(round(c, 4) for c in hw)}')
    select_only(arm)
    if arm.parent:
        bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM')
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
    # Mixamo centimetre bones live under a 0.01 object scale. Apply that
    # onto edit bones ourselves — Object > Apply Scale leaves 32m tails.
    sx, sy, sz = arm.scale
    if abs(sx - 1.0) > 1e-6 or abs(sy - 1.0) > 1e-6 or abs(sz - 1.0) > 1e-6:
        bpy.ops.object.mode_set(mode='EDIT')
        for b in arm.data.edit_bones:
            b.head = Vector((b.head.x * sx, b.head.y * sy, b.head.z * sz))
            b.tail = Vector((b.tail.x * sx, b.tail.y * sy, b.tail.z * sz))
        for b in arm.data.edit_bones:
            if b.children:
                b.tail = b.children[0].head.copy()
            elif b.length < 1e-4 or b.length > 2.0:
                axis = (b.tail - b.head).normalized() if b.length > 1e-8 else Vector((0, 1, 0))
                b.tail = b.head + axis * 0.04
        bpy.ops.object.mode_set(mode='OBJECT')
        arm.scale = (1.0, 1.0, 1.0)
        bpy.context.view_layer.update()
        la = arm.pose.bones.get('mixamorig:LeftArm')
        log(f'armature edit-bones scaled by {(sx, sy, sz)} to 1.0; LeftArm len={la.length if la else None:.3f}')
    bpy.context.view_layer.update()
    if hips:
        hw = arm.matrix_world @ hips.head
        log(f'armature post-apply scale={tuple(round(s, 5) for s in arm.scale)} hips_world={tuple(round(c, 4) for c in hw)}')
    purge_meshes()
    bones = [b.name for b in arm.data.bones]
    mixa = [n for n in bones if n.startswith('mixamorig:')]
    log(f'armature bones={len(bones)} mixamorig={len(mixa)}')
    if len(mixa) != 65:
        raise RuntimeError(f'expected 65 mixamorig bones, have {len(mixa)}')
    return arm


def swing_arm(arm, name, tail):
    pb = arm.pose.bones[name]
    bpy.context.view_layer.update()
    head = Vector(pb.head)
    desired = Vector(tail)
    current = Vector(pb.tail)
    if (desired - head).length < 1e-5 or (current - head).length < 1e-5:
        return
    rot = (current - head).rotation_difference(desired - head)
    mat = rot.to_matrix().to_4x4() @ pb.matrix
    mat.translation = head
    pb.matrix = mat
    bpy.context.view_layer.update()


def _dist_to_seg(p, a, b):
    ab = b - a
    denom = ab.length_squared
    if denom < 1e-10:
        return (p - a).length
    t = max(0.0, min(1.0, (p - a).dot(ab) / denom))
    return (a + ab * t - p).length


def raise_mesh_to_tpose(ob, src_arm):
    """Deform the hanging-arm sculpt onto Mixamo T-pose with the real arm chain.

    Vertex floods tear armpits. Heat weights work after weld, so: copy the
    source rig, rest it to the hanging pose, auto-weight, swing back to T,
    apply. Caller then skins the T-posed mesh to the untouched Mixamo rest.
    """
    apply_visual(ob)
    bpy.context.view_layer.update()
    mw = ob.matrix_world
    pts = [mw @ v.co for v in ob.data.vertices]

    def hanging_hand(sign):
        band = [p for p in pts if 0.72 <= p.z <= 1.18 and sign * p.x > 0.22]
        if len(band) < 8:
            raise RuntimeError(f'tpose: no hanging hand on side {sign}')
        return max(band, key=lambda p: sign * p.x)

    l_hand = hanging_hand(+1)
    r_hand = hanging_hand(-1)
    log(f'tpose mixamo: L_hand={tuple(round(c, 3) for c in l_hand)} R_hand={tuple(round(c, 3) for c in r_hand)}')

    temp = src_arm.copy()
    temp.data = src_arm.data.copy()
    temp.name = 'TPoseTemp'
    temp.data.name = 'TPoseTempData'
    bpy.context.collection.objects.link(temp)
    temp.parent = None
    temp.matrix_world = src_arm.matrix_world.copy()
    if temp.animation_data:
        temp.animation_data_clear()
    temp.data.pose_position = 'POSE'
    for p in temp.pose.bones:
        p.matrix_basis = Matrix.Identity(4)
    bpy.context.view_layer.update()

    def aim_bone(pb, world_target):
        head_w = temp.matrix_world @ pb.head
        vec_w = world_target - head_w
        if vec_w.length < 1e-6:
            return
        vec = (temp.matrix_world.to_3x3().inverted() @ vec_w).normalized()
        current = (pb.tail - pb.head).normalized()
        q = current.rotation_difference(vec)
        loc, rot, scale = pb.matrix.decompose()
        pb.matrix = Matrix.LocRotScale(loc, q @ rot, scale)
        bpy.context.view_layer.update()

    select_only(temp)
    bpy.ops.object.mode_set(mode='POSE')

    def hang_chain(arm_name, forearm_name, hand_name, hand_w):
        inv = temp.matrix_world.inverted()
        hand_local = inv @ hand_w
        pb = temp.pose.bones[arm_name]
        head = Vector(pb.head)
        tail = head + (hand_local - head).normalized() * pb.length
        swing_arm(temp, arm_name, tail)
        fa = temp.pose.bones[forearm_name]
        fa_head = Vector(fa.head)
        fa_tail = fa_head + (hand_local - fa_head).normalized() * fa.length
        swing_arm(temp, forearm_name, fa_tail)
        hb = temp.pose.bones.get(hand_name)
        if hb:
            h_head = Vector(hb.head)
            h_tail = h_head + (hand_local - h_head).normalized() * max(hb.length, 0.08)
            swing_arm(temp, hand_name, h_tail)

    hang_chain('mixamorig:LeftArm', 'mixamorig:LeftForeArm', 'mixamorig:LeftHand', l_hand)
    hang_chain('mixamorig:RightArm', 'mixamorig:RightForeArm', 'mixamorig:RightHand', r_hand)
    bpy.context.view_layer.update()
    posed = {}
    for b in temp.pose.bones:
        posed[b.name] = (
            Vector(temp.matrix_world @ b.head),
            Vector(temp.matrix_world @ b.tail),
        )
    la = posed['mixamorig:LeftArm']
    log(f'tpose hanging LeftArm {tuple(round(c, 3) for c in la[0])} -> {tuple(round(c, 3) for c in la[1])}')
    bpy.ops.object.mode_set(mode='EDIT')
    inv = temp.matrix_world.inverted()
    for b in temp.data.edit_bones:
        h, t = posed[b.name]
        b.head = inv @ h
        b.tail = inv @ t
    bpy.ops.object.mode_set(mode='OBJECT')
    for p in temp.pose.bones:
        p.matrix_basis = Matrix.Identity(4)
    bpy.context.view_layer.update()
    la2 = temp.pose.bones['mixamorig:LeftArm']
    log(f'tpose rest LeftArm {tuple(round(c, 3) for c in (temp.matrix_world @ la2.head))} -> {tuple(round(c, 3) for c in (temp.matrix_world @ la2.tail))}')
    log('tpose: temp rest is hanging pose')
    skin(ob, temp)
    mw = ob.matrix_world
    arm_keys = ('Arm', 'ForeArm', 'Hand', 'Shoulder', 'Thumb', 'Index', 'Middle', 'Ring', 'Pinky')
    leg_keys = ('UpLeg', 'Leg', 'Foot', 'Toe')
    stripped = 0
    for v in ob.data.vertices:
        p = mw @ v.co
        drop = []
        if p.z < 1.12 and abs(p.x) < 0.40:
            drop = [k for k in arm_keys]
        elif abs(p.x) > 0.42 and 0.65 < p.z < 1.40:
            drop = [k for k in leg_keys]
        if not drop:
            continue
        for g in list(v.groups):
            name = ob.vertex_groups[g.group].name
            if any(k in name for k in drop):
                ob.vertex_groups[name].remove([v.index])
                stripped += 1
    select_only(ob)
    try:
        bpy.ops.object.vertex_group_normalize_all(lock_active=False)
    except Exception as err:
        log(f'tpose weight normalize skipped: {err}')
    log(f'tpose: stripped {stripped} hanging thigh/arm cross-weights')

    select_only(temp)
    bpy.ops.object.mode_set(mode='POSE')
    for name in ('mixamorig:LeftArm', 'mixamorig:LeftForeArm', 'mixamorig:RightArm', 'mixamorig:RightForeArm'):
        src = src_arm.pose.bones[name]
        pb = temp.pose.bones[name]
        src_head = Vector(src_arm.matrix_world @ src.head)
        src_tail = Vector(src_arm.matrix_world @ src.tail)
        pb_head = Vector(temp.matrix_world @ pb.head)
        aim_bone(pb, pb_head + (src_tail - src_head))
    bpy.ops.object.mode_set(mode='OBJECT')
    select_only(ob)
    for mod in list(ob.modifiers):
        if mod.type == 'ARMATURE':
            bpy.ops.object.modifier_apply(modifier=mod.name)
    ob.parent = None
    bpy.data.objects.remove(temp, do_unlink=True)
    adata = bpy.data.armatures.get('TPoseTempData')
    if adata:
        bpy.data.armatures.remove(adata, do_unlink=True)
    apply_visual(ob)
    bb = world_bbox([ob])
    width = bb[1].x - bb[0].x
    log(f'tpose mixamo applied width={width:.3f} bbox {tuple(round(c, 3) for c in bb[0])} .. {tuple(round(c, 3) for c in bb[1])}')
    if width < 1.55 or width > 2.55:
        raise RuntimeError(f'tpose mixamo bad width {width:.3f}')
    log('tpose: mesh raised on Mixamo arm chain')


def skin(ob, arm):
    object_mode()
    ob.parent = None
    for mod in list(ob.modifiers):
        ob.modifiers.remove(mod)
    ob.vertex_groups.clear()
    select_only(arm)
    ob.select_set(True)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.parent_set(type='ARMATURE_AUTO')
    mw = ob.matrix_world.copy()
    ob.parent = arm
    ob.parent_type = 'OBJECT'
    ob.matrix_world = mw
    if not any(m.type == 'ARMATURE' for m in ob.modifiers):
        mod = ob.modifiers.new('Armature', 'ARMATURE')
        mod.object = arm
        mod.use_vertex_groups = True
        log(f'skin: added fallback armature modifier on {ob.name}')
    for mod in ob.modifiers:
        if mod.type == 'ARMATURE':
            mod.object = arm
            mod.use_vertex_groups = True
            mod.show_viewport = True
            mod.show_render = True
    select_only(ob)
    try:
        bpy.ops.object.vertex_group_limit_total(limit=4)
        bpy.ops.object.vertex_group_normalize_all(lock_active=False)
    except Exception as err:
        log(f'weight cleanup skipped: {err}')
    groups = [g.name for g in ob.vertex_groups]
    mods = [m.type for m in ob.modifiers]
    weighted = sum(1 for v in ob.data.vertices if v.groups)
    if weighted < max(1, len(ob.data.vertices) // 2):
        log(f'skin: heat assigned {weighted}/{len(ob.data.vertices)} on {ob.name}; trying envelope')
        select_only(arm)
        ob.select_set(True)
        bpy.context.view_layer.objects.active = arm
        bpy.ops.object.parent_set(type='ARMATURE_ENVELOPE')
        mw = ob.matrix_world.copy()
        ob.parent = arm
        ob.parent_type = 'OBJECT'
        ob.matrix_world = mw
        weighted = sum(1 for v in ob.data.vertices if v.groups)
        groups = [g.name for g in ob.vertex_groups]
        mods = [m.type for m in ob.modifiers]
    log(f'skinned {ob.name} groups={len(groups)} weighted={weighted}/{len(ob.data.vertices)} parent={ob.parent.name if ob.parent else None} ptype={ob.parent_type} mods={mods}')
    if ob.name == 'OrcV1Body' and 'mixamorig:Hips' not in groups:
        raise RuntimeError(f'{ob.name} missing mixamorig:Hips after auto-weight')


def pelvis_only_weights(ob):
    """Loincloth must not inherit thigh weights or the drape becomes a hip tumor."""
    keep = {'mixamorig:Hips', 'mixamorig:Spine', 'mixamorig:Spine1'}
    select_only(ob)
    for vg in list(ob.vertex_groups):
        if vg.name not in keep:
            ob.vertex_groups.remove(vg)
    if 'mixamorig:Hips' not in ob.vertex_groups:
        ob.vertex_groups.new(name='mixamorig:Hips')
    hips = ob.vertex_groups['mixamorig:Hips']
    assigned = 0
    for v in ob.data.vertices:
        if not v.groups:
            hips.add([v.index], 1.0, 'REPLACE')
            assigned += 1
    try:
        bpy.ops.object.vertex_group_normalize_all(lock_active=False)
    except Exception:
        pass
    log(f'pelvis-only weights on {ob.name}; filled {assigned} unweighted verts')


def close_crotch_hole(ob):
    """Fill only the inner crotch boundary. Filling every non-manifold edge made a cone."""
    object_mode()
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    bm.verts.ensure_lookup_table()
    bm.edges.ensure_lookup_table()
    mw = ob.matrix_world
    visited = set()
    filled = 0
    for e0 in list(bm.edges):
        if not e0.is_boundary or e0.index in visited:
            continue
        loop = []
        cur = e0
        v = cur.verts[0]
        for _ in range(400):
            if cur.index in visited:
                break
            loop.append(cur)
            visited.add(cur.index)
            nxt = None
            for e2 in v.link_edges:
                if e2.is_boundary and e2.index not in visited:
                    nxt = e2
                    v = e2.other_vert(v)
                    break
            if nxt is None:
                break
            cur = nxt
        if len(loop) < 5 or len(loop) > 64:
            continue
        pts = [(mw @ ed.verts[0].co + mw @ ed.verts[1].co) * 0.5 for ed in loop]
        cx = sum(p.x for p in pts) / len(pts)
        cz = sum(p.z for p in pts) / len(pts)
        if abs(cx) > 0.10 or cz < 0.88 or cz > 1.30:
            continue
        try:
            res = bmesh.ops.edgeloop_fill(bm, edges=loop)
            nfaces = len(res.get('faces') or [])
            filled += nfaces
            log(f'crotch fill loop={len(loop)} center_x={cx:.3f} z={cz:.3f} faces={nfaces}')
        except Exception as err:
            log(f'crotch fill skipped loop={len(loop)}: {err}')
    bm.to_mesh(ob.data)
    ob.data.update()
    bm.free()
    if filled:
        smart_uv(ob)
        hips = ob.vertex_groups.get('mixamorig:Hips')
        if hips:
            for v in ob.data.vertices:
                if not v.groups:
                    hips.add([v.index], 1.0, 'REPLACE')
    log(f'crotch hole faces added={filled}')
    return filled


def primitive_mesh(name, loc, scale, mat, bone):
    object_mode()
    bpy.ops.mesh.primitive_uv_sphere_add(segments=12, ring_count=8, radius=1.0, location=loc)
    ob = bpy.context.view_layer.objects.active
    ob.name = name
    ob.data.name = name
    ob.scale = scale
    bpy.context.view_layer.update()
    apply_visual(ob)
    if mat:
        assign_material(ob, mat)
    return ob, bone


def attach_to_bone(ob, arm, bone_name):
    vg = ob.vertex_groups.new(name=bone_name)
    vg.add(list(range(len(ob.data.vertices))), 1.0, 'REPLACE')
    mw = ob.matrix_world.copy()
    ob.parent = arm
    ob.parent_type = 'OBJECT'
    ob.matrix_world = mw
    mod = ob.modifiers.new('Armature', 'ARMATURE')
    mod.object = arm
    mod.use_vertex_groups = True
    mod.show_viewport = True
    mod.show_render = True


def add_eyes(arm, body, landmarks=None):
    """Print eyelids live on OrcV1Body. Keep a tiny named mesh for the OrcV1Eyes contract."""
    marks = landmarks or find_face_landmarks(body)
    cx = (marks['eye_l'].x + marks['eye_r'].x) * 0.5
    # +Y is into the skull (front is -Y). A 3mm bead here never reads as a brow marble.
    cy = (marks['eye_l'].y + marks['eye_r'].y) * 0.5 + 0.05
    cz = (marks['eye_l'].z + marks['eye_r'].z) * 0.5
    mat = make_material('OrcV1Eyes', (0.02, 0.015, 0.01, 1.0), roughness=0.95)
    eyes, _ = primitive_mesh('OrcV1Eyes', (cx, cy, cz), (0.003, 0.003, 0.003), mat, 'mixamorig:Head')
    attach_to_bone(eyes, arm, 'mixamorig:Head')
    log(f'eye placeholder inside skull at ({cx:.3f}, {cy:.3f}, {cz:.3f})')
    return eyes


def add_contract_meshes(arm, body, have_shorts=False, have_eyes=False, landmarks=None):
    bb = world_bbox([body])
    lo, hi = bb
    height = hi.z - lo.z
    cx = (lo.x + hi.x) * 0.5
    cy = (lo.y + hi.y) * 0.5
    # Crown placeholders so the five OrcV1* names exist. Helmet hide needs Hair.
    hair_mat = make_material('OrcV1Hair', (0.04, 0.03, 0.03, 1.0), roughness=0.85)
    brow_mat = make_material('OrcV1Brows', (0.04, 0.03, 0.02, 1.0), roughness=0.8)
    shorts_mat = make_material('OrcV1Leather', LEATHER, roughness=0.9)

    hair, _ = primitive_mesh(
        'OrcV1Hair',
        (cx, cy, lo.z + height * 0.92),
        (0.008, 0.008, 0.008),
        hair_mat,
        'mixamorig:Head',
    )
    brows, _ = primitive_mesh(
        'OrcV1Brows',
        (cx, cy, lo.z + height * 0.90),
        (0.006, 0.006, 0.006),
        brow_mat,
        'mixamorig:Head',
    )
    out = []
    for ob, bone in ((hair, 'mixamorig:Head'), (brows, 'mixamorig:Head')):
        attach_to_bone(ob, arm, bone)
        out.append(ob)
    if not have_eyes:
        out.append(add_eyes(arm, body, landmarks))
    if not have_shorts:
        shorts, _ = primitive_mesh(
            'OrcV1Shorts',
            (cx, cy, lo.z + height * 0.52),
            (0.02, 0.02, 0.02),
            shorts_mat,
            'mixamorig:Hips',
        )
        attach_to_bone(shorts, arm, 'mixamorig:Hips')
        out.append(shorts)
    log('contract meshes: OrcV1Hair/Eyes/Brows' + ('' if have_shorts else '/Shorts'))
    return out


def write_joints(arm):
    points = {}
    for b in arm.data.bones:
        if not b.name.startswith('mixamorig:'):
            continue
        head = arm.matrix_world @ b.head_local
        points[b.name] = [head.x, head.z, -head.y]
    if len(points) != 65:
        raise RuntimeError(f'joints JSON would have {len(points)} mixamorig bones')
    JOINTS_OUT.write_text(json.dumps(points, indent=2) + '\n')
    log(f'wrote {JOINTS_OUT} ({len(points)} joints)')
    hips = points['mixamorig:Hips']
    head = points['mixamorig:Head']
    log(f'  hips yup={hips} head yup={head}')


def render_preview(meshes, tag):
    bb = world_bbox(meshes)
    if not bb:
        return
    lo, hi = bb
    centre = (lo + hi) * 0.5
    height = hi.z - lo.z
    scene = bpy.context.scene
    for engine in ('BLENDER_WORKBENCH', 'BLENDER_EEVEE_NEXT', 'BLENDER_EEVEE'):
        try:
            scene.render.engine = engine
            break
        except TypeError:
            continue
    scene.render.resolution_x = 720
    scene.render.resolution_y = 720
    scene.render.image_settings.file_format = 'PNG'
    scene.display.shading.light = 'STUDIO'
    try:
        scene.display.shading.color_type = 'TEXTURE'
    except Exception:
        scene.display.shading.color_type = 'MATERIAL'
    world = bpy.data.worlds.new('SculptPreview')
    scene.world = world
    world.use_nodes = True
    bg = next(n for n in world.node_tree.nodes if n.type == 'BACKGROUND')
    bg.inputs['Color'].default_value = (0.045, 0.048, 0.052, 1.0)
    bg.inputs['Strength'].default_value = 0.9
    cam_data = bpy.data.cameras.new(f'{tag}Cam')
    cam_data.lens = 70
    cam = bpy.data.objects.new(f'{tag}Cam', cam_data)
    bpy.context.collection.objects.link(cam)
    scene.camera = cam
    shots = (
        ('front', 0.0, centre, height * 1.12),
        ('side', 90.0, centre, height * 1.12),
        ('threequarter', 38.0, centre, height * 1.12),
        ('face', 12.0, Vector((centre.x, centre.y, lo.z + height * 0.90)), height * 0.30),
    )
    for name, azimuth, look, framed in shots:
        dist = framed / (2.0 * math.tan(cam_data.angle * 0.5)) * 1.05
        rad = math.radians(azimuth)
        cam.location = (look.x + math.sin(rad) * dist, look.y - math.cos(rad) * dist, look.z)
        direction = (look - cam.location).normalized()
        cam.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()
        path = CACHE / f'{tag}-{name}.png'
        scene.render.filepath = str(path)
        bpy.ops.render.render(write_still=True)
        log(f'wrote {path}')


def bind_retopo():
    clear_scene()
    arm = import_source_armature()
    log(f'IMPORT RETOPO {RETOPO}')
    bpy.ops.import_scene.gltf(filepath=str(RETOPO))
    def take(name):
        ob = next((o for o in bpy.data.objects if o.type == 'MESH' and o.name.startswith(name)), None)
        if not ob:
            return None
        ob.name = name
        ob.data.name = name
        apply_visual(ob)
        return ob

    body = take('OrcV1Body')
    if not body:
        raise RuntimeError('retopo GLB missing OrcV1Body')
    shorts = take('OrcV1Shorts')
    if shorts:
        close_crotch_hole(shorts)
    stale_eyes = take('OrcV1Eyes')
    if stale_eyes:
        bpy.data.objects.remove(stale_eyes, do_unlink=True)
    eyes = None

    if RECOOK:
        landmarks = recook_albedo(body, SKIN, 1024, roughness=0.88, skin=True)
        if shorts:
            recook_albedo(shorts, LEATHER, 512, roughness=0.92, skin=False)
    else:
        landmarks = find_face_landmarks(body)
        log('bind: keeping retopo albedo/normal maps')
    select_only(body)
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.mesh.remove_doubles(threshold=0.0005)
    bpy.ops.mesh.normals_make_consistent(inside=False)
    bpy.ops.object.mode_set(mode='OBJECT')
    if DO_TPOSE:
        raise_mesh_to_tpose(body, arm)
        select_only(body)
        bpy.ops.object.mode_set(mode='EDIT')
        bpy.ops.mesh.select_all(action='SELECT')
        bpy.ops.mesh.normals_make_consistent(inside=False)
        bpy.ops.object.mode_set(mode='OBJECT')
    else:
        log('tpose skipped (pass --tpose to raise arms onto Mixamo rest)')
    bb = world_bbox([body])
    if bb:
        log(f'body bbox {tuple(round(c, 3) for c in bb[0])} .. {tuple(round(c, 3) for c in bb[1])}')
    skin(body, arm)
    if shorts:
        skin(shorts, arm)
        pelvis_only_weights(shorts)
    if eyes:
        skin(eyes, arm)
    extras = add_contract_meshes(
        arm, body, have_shorts=bool(shorts), have_eyes=bool(eyes), landmarks=landmarks
    )
    write_joints(arm)
    extras_and = [arm, body, *extras]
    if shorts:
        extras_and.append(shorts)
    if eyes:
        extras_and.append(eyes)
    export_glb(REST, extras_and)
    render_preview([body] + ([shorts] if shorts else []) + ([eyes] if eyes else []), 'rest')
    summary = {
        'bodyVerts': len(body.data.vertices),
        'bodyTris': tris_of(body),
        'restBytes': REST.stat().st_size,
        'meshes': ['OrcV1Body', 'OrcV1Hair', 'OrcV1Eyes', 'OrcV1Brows', 'OrcV1Shorts'],
        'targetFaces': TARGET_FACES,
        'voxel': VOXEL,
        'yaw': YAW,
    }
    (CACHE / 'build.json').write_text(json.dumps(summary, indent=2) + '\n')
    log('BIND COMPLETE ' + json.dumps(summary))


def recook_rest():
    """Repaint albedo and rebuild eyes on the already T-posed, skinned rest GLB."""
    if not REST.exists():
        raise FileNotFoundError(REST)
    clear_scene()
    log(f'RECOOK REST {REST}')
    bpy.ops.import_scene.gltf(filepath=str(REST))
    arm = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
    arm.name = 'SourceArmature'
    arm.data.pose_position = 'REST'
    bpy.context.view_layer.update()
    for extra in [o for o in bpy.data.objects if o.type == 'MESH' and o.name.startswith('Icosphere')]:
        bpy.data.objects.remove(extra, do_unlink=True)
    log('imported ' + ', '.join(f'{o.name}:{o.type}' for o in bpy.data.objects))

    def mesh_named(prefix):
        return next((o for o in bpy.data.objects if o.type == 'MESH' and o.name.startswith(prefix)), None)

    body = mesh_named('OrcV1Body')
    if not body:
        raise RuntimeError('rest GLB missing OrcV1Body')
    shorts = mesh_named('OrcV1Shorts')
    hair = mesh_named('OrcV1Hair')
    brows = mesh_named('OrcV1Brows')
    for name in ('OrcV1Eyes', 'OrcV1EyeL', 'OrcV1EyeR'):
        stale = mesh_named(name)
        if stale:
            bpy.data.objects.remove(stale, do_unlink=True)
    nrm = existing_normal_image(body)
    landmarks = recook_albedo(body, SKIN, 1024, roughness=0.88, skin=True, normal_img=nrm)
    if shorts:
        close_crotch_hole(shorts)
        recook_albedo(shorts, LEATHER, 512, roughness=0.92, skin=False)
    eyes = add_eyes(arm, body, landmarks)
    if not hair or not brows:
        log(f'recook: missing placeholders hair={bool(hair)} brows={bool(brows)}')
    if not JOINTS_OUT.exists():
        write_joints(arm)
    else:
        log(f'keeping existing joints {JOINTS_OUT}')
    keep = [arm, body, eyes]
    if shorts:
        keep.append(shorts)
    if hair:
        keep.append(hair)
    if brows:
        keep.append(brows)
    export_glb(REST, keep)
    render_preview([body] + ([shorts] if shorts else []) + [eyes], 'rest')
    summary = {
        'bodyVerts': len(body.data.vertices),
        'bodyTris': tris_of(body),
        'restBytes': REST.stat().st_size,
        'meshes': [o.name for o in keep if o.type == 'MESH'],
        'recook': True,
    }
    (CACHE / 'build.json').write_text(json.dumps(summary, indent=2) + '\n')
    log('RECOOK COMPLETE ' + json.dumps(summary))


def main():
    log('ORC FROM SCULPT')
    log(
        f'  fbx={HP_FBX.exists()} from_retopo={FROM_RETOPO} recook={RECOOK} '
        f'tpose={DO_TPOSE} faces={TARGET_FACES} head_faces={HEAD_FACES} '
        f'voxel={VOXEL} voxel_head={VOXEL_HEAD} yaw={YAW}'
    )
    if RECOOK:
        recook_rest()
        log('ORC FROM SCULPT DONE')
        return
    if FROM_RETOPO and not RETOPO.exists():
        raise FileNotFoundError(RETOPO)
    if not FROM_RETOPO:
        clear_scene()
        build_retopo()
    bind_retopo()
    log('ORC FROM SCULPT DONE')


try:
    main()
except Exception:
    import traceback
    traceback.print_exc()
    raise
