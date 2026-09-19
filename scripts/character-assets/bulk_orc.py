"""Bulk the Orc toward Warcraft anatomy (Grommash reference) before binding.

Isolated background Blender. Mesh-only warp: the skeleton is untouched so fitted
joint centres stay valid. New tusks/topknot/beard are skinned to Head (collapsed
to mixamorig:Head in bind_source_orc.py). Keeps the five OrcV1* mesh names.
"""
import math
import bpy
import bmesh
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / '.cache/source-motion'
OUT.mkdir(parents=True, exist_ok=True)
for ob in list(bpy.data.objects):
    bpy.data.objects.remove(ob, do_unlink=True)
bpy.ops.import_scene.gltf(filepath=str(ROOT / 'public/characters/bodies/orc-animated-v1.glb'))
arm = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
arm.animation_data_clear()
for p in arm.pose.bones:
    p.matrix_basis.identity()
bpy.context.view_layer.update()


def head(name):
    return arm.matrix_world @ arm.pose.bones[name].head


def tail(name):
    return arm.matrix_world @ arm.pose.bones[name].tail


def closest_on_segment(p, a, b):
    ab = b - a
    t = max(0.0, min(1.0, (p - a).dot(ab) / max(1e-12, ab.length_squared)))
    return a + ab * t


def smooth(t):
    t = max(0.0, min(1.0, t))
    return t * t * (3.0 - 2.0 * t)


def falloff(dist, radius):
    if radius <= 1e-9 or dist >= radius:
        return 0.0
    return smooth(1.0 - dist / radius)


def ellip_w(p, c, rx, ry, rz):
    d = math.sqrt((p.x - c.x) ** 2 / (rx * rx) + (p.y - c.y) ** 2 / (ry * ry) + (p.z - c.z) ** 2 / (rz * rz))
    return falloff(d, 1.0)


# Radial girth around bone axes. Hands/feet/head excluded (handled separately).
RADIAL = {
    'LeftArm': 1.20, 'RightArm': 1.20,
    'LeftForeArm': 1.10, 'RightForeArm': 1.10,
    'Neck': 1.08,
    'LeftUpLeg': 1.28, 'RightUpLeg': 1.28,
    'LeftLeg': 1.14, 'RightLeg': 1.14,
}
# Width about the midline (X) and depth about the spine (Y). Not height (Z):
# Blender is Z-up after the glTF import.
WIDE = {
    'Spine': (1.24, 1.22), 'spine04': (1.24, 1.22),
    'Spine2': (1.30, 1.26), 'spine02': (1.30, 1.26),
    'spine01': (1.22, 1.14),
    'Hips': (1.26, 1.18),
    'LeftShoulder': (1.32, 1.12), 'RightShoulder': (1.32, 1.12),
}
STOP_BONES = {'LeftHand', 'RightHand', 'LeftFoot', 'RightFoot', 'Head'}
HAND_FOOT_KEYS = ('LeftHand', 'RightHand', 'finger', 'metacarpal', 'LeftFoot', 'RightFoot', 'LeftToe', 'RightToe', 'toe')
NECK_Z = 1.815
NECK_FADE_START = 1.74


def resolve_group(bone_name):
    b = arm.pose.bones.get(bone_name)
    seen = set()
    while b and b.name not in seen:
        seen.add(b.name)
        if b.name in STOP_BONES:
            return None
        if b.name in RADIAL:
            return (b.name, 'radial', RADIAL[b.name])
        if b.name in WIDE:
            return (b.name, 'wide', WIDE[b.name])
        b = b.parent
    return None


GROUP_WARP = {b.name: resolve_group(b.name) for b in arm.pose.bones}
GROUP_WARP = {k: v for k, v in GROUP_WARP.items() if v}
BULK_MESHES = {'OrcV1Body', 'OrcV1Shorts'}


def warp_object(ob):
    mw = ob.matrix_world
    inv = mw.inverted()
    mesh = ob.data
    axes = {g: (head(g), tail(g)) for g in RADIAL if g in arm.pose.bones}
    spine_y = {}
    for g in WIDE:
        if g in arm.pose.bones:
            spine_y[g] = 0.5 * (head(g).y + tail(g).y)
    weights = {}
    for v in mesh.vertices:
        row = {}
        for g in v.groups:
            name = ob.vertex_groups[g.group].name
            if name in GROUP_WARP:
                row[name] = row.get(name, 0.0) + g.weight
        if row:
            weights[v.index] = row
    # Dominant hand/foot verts must not pick up forearm/shoulder leak.
    skip = set()
    for v in mesh.vertices:
        best, bw = None, 0.0
        for g in v.groups:
            if g.weight > bw:
                bw = g.weight
                best = ob.vertex_groups[g.group].name
        if best and any(best == k or best.startswith(k) for k in HAND_FOOT_KEYS):
            skip.add(v.index)
    hand_pts = {'LeftForeArm': head('LeftHand'), 'RightForeArm': head('RightHand')}
    for v in mesh.vertices:
        if v.index in skip:
            continue
        row = weights.get(v.index)
        if not row:
            continue
        p = mw @ v.co
        # A-pose hands/forearms sit at |x| > 0.38; midline and radial warps
        # there stretch the wrist once the arm is reposed to source rest.
        if abs(p.x) > 0.38 and p.z < 1.55:
            continue
        neck_fade = 1.0
        if p.z > NECK_FADE_START:
            neck_fade = max(0.0, 1.0 - (p.z - NECK_FADE_START) / max(1e-6, NECK_Z - NECK_FADE_START))
        for name, w in row.items():
            if w <= 0.0:
                continue
            major, mode, factor = GROUP_WARP[name]
            if mode == 'radial':
                a, b = axes[major]
                c = closest_on_segment(p, a, b)
                off = p - c
                fade = 1.0
                if major in hand_pts:
                    fade = min(1.0, (p - hand_pts[major]).length / 0.14)
                p = c + off * (1.0 + (factor - 1.0) * w * fade)
            else:
                fx, fy = WIDE[major]
                ww = w * (neck_fade if major not in ('Hips',) else 1.0)
                p.x *= 1.0 + (fx - 1.0) * ww
                cy = spine_y[major]
                p.y = cy + (p.y - cy) * (1.0 + (fy - 1.0) * ww)
        v.co = inv @ p


def extra_mass(ob):
    """Deltoid outward push and pec forward volume on the body only."""
    mw = ob.matrix_world
    inv = mw.inverted()
    la = head('LeftArm')
    ra = head('RightArm')
    for v in ob.data.vertices:
        p = mw @ v.co
        # Deltoids: around the arm heads, keep below the neck.
        if 1.58 < p.z < 1.78 and abs(p.x) > 0.14:
            side = 1.0 if p.x > 0 else -1.0
            pivot = la if p.x > 0 else ra
            d = (p - pivot).length
            w = falloff(d, 0.16) * falloff(abs(p.z - 1.68), 0.14)
            p.x += side * 0.040 * w
            p.y -= 0.010 * w
        # Pecs: breast-weighted or chest-front verts.
        if 1.50 < p.z < 1.68 and abs(p.x) < 0.22 and p.y < -0.10:
            front = smooth(min(1.0, max(0.0, (-p.y - 0.10) / 0.10)))
            p.y -= 0.018 * front * falloff(abs(p.z - 1.57), 0.11)
        v.co = inv @ p


def orc_face_delta(p):
    """Heavy brow shelf, deep sockets, projecting muzzle, wide mandible.
    Forward is -Y after the glTF import."""
    if p.z < 1.72 or p.z > 2.16 or abs(p.x) > 0.16:
        return Vector((0, 0, 0))
    d = Vector((0, 0, 0))
    sx = 1.0 if p.x >= 0 else -1.0
    # Flatten the spherical cranium: back and down.
    w = ellip_w(p, Vector((0.0, -0.090, 2.055)), 0.100, 0.095, 0.085)
    d.y += 0.055 * w
    d.z -= 0.042 * w
    # Heavy brow SHELF: forward AND down, a real overhang.
    w = ellip_w(p, Vector((0.0, -0.195, 1.958)), 0.095, 0.048, 0.032)
    d.y -= 0.070 * w
    d.z -= 0.030 * w
    # Carve sockets inward so eyes sit under the shelf.
    w = ellip_w(p, Vector((0.0, -0.180, 1.918)), 0.078, 0.038, 0.022)
    d.y += 0.028 * w
    d.z -= 0.010 * w
    for cx in (0.038, -0.038):
        w = ellip_w(p, Vector((cx, -0.185, 1.926)), 0.032, 0.032, 0.026)
        d.y += 0.040 * w
        d.z -= 0.010 * w
    # Projecting broad muzzle (the snout step below the brow).
    w = ellip_w(p, Vector((0.0, -0.165, 1.855)), 0.090, 0.070, 0.062)
    d.y -= 0.068 * w
    d.x += p.x * 1.05 * w
    # Wide flat snout + flared alae.
    w = ellip_w(p, Vector((0.0, -0.210, 1.888)), 0.048, 0.045, 0.040)
    d.y -= 0.032 * w
    d.x += p.x * 2.80 * w
    d.z -= 0.026 * w
    # Broad heavy mandible, lowered, wrapping the tusk roots.
    w = ellip_w(p, Vector((0.0, -0.135, 1.795)), 0.120, 0.080, 0.060)
    d.x += p.x * 2.10 * w
    d.y -= 0.040 * w
    d.z -= 0.024 * w
    for cx in (0.078, -0.078):
        w = ellip_w(p, Vector((cx, -0.155, 1.805)), 0.052, 0.055, 0.048)
        d.x += (1.0 if cx > 0 else -1.0) * 0.046 * w
        d.y -= 0.022 * w
        d.z -= 0.008 * w
    # Cheekbone / jowl mass under the eyes.
    for cx in (0.062, -0.062):
        w = ellip_w(p, Vector((cx, -0.160, 1.868)), 0.042, 0.048, 0.045)
        d.x += (1.0 if cx > 0 else -1.0) * 0.030 * w
        d.y -= 0.018 * w
    # Wide lipped mouth.
    w = ellip_w(p, Vector((0.0, -0.195, 1.852)), 0.062, 0.036, 0.018)
    d.y -= 0.018 * w
    d.z += 0.006 * w
    w = ellip_w(p, Vector((0.0, -0.188, 1.825)), 0.058, 0.036, 0.018)
    d.y -= 0.016 * w
    d.z -= 0.010 * w
    for cx in (0.042, -0.042):
        w = ellip_w(p, Vector((cx, -0.190, 1.840)), 0.026, 0.026, 0.022)
        d.x += (1.0 if cx > 0 else -1.0) * 0.016 * w
    # Larger pointed ears, angled back.
    if abs(p.x) > 0.068 and p.y > -0.15 and 1.85 < p.z < 2.06:
        t = smooth(max(0.0, (p.z - 1.87) / 0.16))
        ear = falloff(abs(abs(p.x) - 0.098), 0.040) * falloff(abs(p.y + 0.07), 0.07)
        d.x += sx * (0.016 + 0.038 * t) * ear
        d.z += 0.048 * t * t * ear
        d.y += 0.022 * t * ear
    return d


def apply_delta(ob, extra=None):
    mw = ob.matrix_world
    inv = mw.inverted()
    for v in ob.data.vertices:
        p = mw @ v.co
        delta = orc_face_delta(p)
        if extra:
            delta = delta + extra(p)
        v.co = inv @ (p + delta)


def refresh_normals(ob):
    """Recalc per-face normals without flipping the whole island inside-out.
    object.normals_make_consistent after joining tusks/kits was flipping the body."""
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(ob.data)
    bm.free()
    ob.data.update()


def mat_opaque(name, color, rough):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    bsdf.inputs['Base Color'].default_value = (*color, 1.0)
    bsdf.inputs['Roughness'].default_value = rough
    spec = bsdf.inputs.get('Specular IOR Level') or bsdf.inputs.get('Specular')
    if spec:
        spec.default_value = 0.12
    metal = bsdf.inputs.get('Metallic')
    if metal:
        metal.default_value = 0.0
    mat.diffuse_color = (*color, 1.0)
    blend_prop = mat.bl_rna.properties.get('blend_method')
    if blend_prop:
        ids = [i.identifier for i in blend_prop.enum_items]
        if 'OPAQUE' in ids:
            mat.blend_method = 'OPAQUE'
    return mat


def tube_frame(tang):
    """Stable ring axes. World-up rings collapse when the tube runs up (tusks)."""
    tang = tang.normalized()
    ref = Vector((1.0, 0.0, 0.0))
    if abs(tang.dot(ref)) > 0.85:
        ref = Vector((0.0, 1.0, 0.0))
    nr = tang.cross(ref).normalized()
    bi = tang.cross(nr).normalized()
    return nr, bi


def add_tube(bm, points, radii, segs=8, cap_start=True, cap_end=True):
    rings = []
    n = len(points)
    for i, (p, r) in enumerate(zip(points, radii)):
        if i == 0:
            tang = (points[1] - points[0]).normalized()
        elif i == n - 1:
            tang = (points[-1] - points[-2]).normalized()
        else:
            tang = (points[i + 1] - points[i - 1]).normalized()
        nr, bi = tube_frame(tang)
        ring = []
        for k in range(segs):
            a = 2.0 * math.pi * k / segs
            ring.append(bm.verts.new(p + (nr * math.cos(a) + bi * math.sin(a)) * r))
        rings.append(ring)
    for i in range(n - 1):
        for k in range(segs):
            k2 = (k + 1) % segs
            bm.faces.new((rings[i][k], rings[i][k2], rings[i + 1][k2], rings[i + 1][k]))
    if cap_start:
        c = bm.verts.new(points[0])
        for k in range(segs):
            bm.faces.new((c, rings[0][(k + 1) % segs], rings[0][k]))
    if cap_end:
        c = bm.verts.new(points[-1])
        for k in range(segs):
            bm.faces.new((c, rings[-1][k], rings[-1][(k + 1) % segs]))
    return bm


def bezier(a, b, c, steps):
    pts = []
    for i in range(steps):
        t = i / (steps - 1)
        omt = 1.0 - t
        pts.append(a * (omt * omt) + b * (2.0 * omt * t) + c * (t * t))
    return pts


def add_blob(bm, center, radius, sx=1.0, sy=1.0, sz=1.0, segs=8):
    geo = bmesh.ops.create_uvsphere(bm, u_segments=segs, v_segments=max(5, segs // 2), radius=radius)
    for v in geo['verts']:
        v.co = center + Vector((v.co.x * sx, v.co.y * sy, v.co.z * sz))


def skin_head(ob):
    while ob.vertex_groups:
        ob.vertex_groups.remove(ob.vertex_groups[0])
    vg = ob.vertex_groups.new(name='Head')
    if ob.data.vertices:
        vg.add(list(range(len(ob.data.vertices))), 1.0, 'REPLACE')
    ob.parent = arm
    for m in list(ob.modifiers):
        ob.modifiers.remove(m)
    mod = ob.modifiers.new('Armature', 'ARMATURE')
    mod.object = arm


def bm_to_object(name, bm, mat):
    bm.normal_update()
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    mesh.update()
    ob = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(ob)
    mesh.materials.append(mat)
    return ob


def world_verts(ob):
    mw = ob.matrix_world
    return [mw @ v.co for v in ob.data.vertices]


def mouth_corners(body):
    """Actual mouth corners (not jaw pads) after the face warp."""
    pts = world_verts(body)
    corners = {}
    for sx, key in ((1.0, 'L'), (-1.0, 'R')):
        cand = [p for p in pts
                if 0.028 <= sx * p.x <= 0.050
                and 1.828 < p.z < 1.858
                and p.y < -0.15]
        if not cand:
            cand = [p for p in pts
                    if 0.022 <= sx * p.x <= 0.055
                    and 1.820 < p.z < 1.870
                    and p.y < -0.13]
        if cand:
            corners[key] = min(cand, key=lambda p: p.y)
        else:
            corners[key] = Vector((sx * 0.040, -0.215, 1.842))
    return corners


def build_face_kits(body, skin_mat):
    """Overhanging brow shelf, wide snout, lips, jaw corners — Head-skinned."""
    pts = world_verts(body)
    front = [p for p in pts if p.y < -0.10 and 1.76 < p.z < 2.04 and abs(p.x) < 0.13]
    brow_y = min((p.y for p in front if 1.93 < p.z < 1.98), default=-0.23)
    nose_y = min((p.y for p in front if 1.86 < p.z < 1.91 and abs(p.x) < 0.05), default=brow_y - 0.02)
    mouth_y = min((p.y for p in front if 1.82 < p.z < 1.86), default=nose_y + 0.01)
    bm = bmesh.new()
    # Thick overhanging brow ridge (overlapping volumes, not a visor tube).
    for x, fwd, zoff in (
        (-0.078, 0.006, -0.010), (-0.058, 0.016, -0.002), (-0.036, 0.026, 0.004),
        (-0.016, 0.032, 0.008), (0.000, 0.034, 0.010), (0.016, 0.032, 0.008),
        (0.036, 0.026, 0.004), (0.058, 0.016, -0.002), (0.078, 0.006, -0.010),
    ):
        add_blob(bm, Vector((x, brow_y - fwd, 1.950 + zoff)), 0.024, 0.90, 1.40, 0.58, 8)
    # Broad flat snout with flared alae.
    add_blob(bm, Vector((0.0, nose_y - 0.010, 1.872)), 0.028, 1.85, 1.15, 0.95, 9)
    add_blob(bm, Vector((0.022, nose_y - 0.002, 1.862)), 0.012, 1.15, 1.00, 0.80, 6)
    add_blob(bm, Vector((-0.022, nose_y - 0.002, 1.862)), 0.012, 1.15, 1.00, 0.80, 6)
    # Wide lips.
    lip_u = [
        Vector((-0.042, mouth_y + 0.002, 1.850)),
        Vector((0.000, mouth_y - 0.012, 1.854)),
        Vector((0.042, mouth_y + 0.002, 1.850)),
    ]
    lip_l = [
        Vector((-0.038, mouth_y + 0.004, 1.828)),
        Vector((0.000, mouth_y - 0.010, 1.822)),
        Vector((0.038, mouth_y + 0.004, 1.828)),
    ]
    add_tube(bm, lip_u, [0.010, 0.013, 0.010], segs=8)
    add_tube(bm, lip_l, [0.010, 0.013, 0.010], segs=8)
    # Jaw corners / masseter wrapping the tusk roots.
    for sx in (1.0, -1.0):
        add_blob(bm, Vector((sx * 0.086, -0.155, 1.792)), 0.028, 1.20, 1.10, 0.92, 8)
        add_blob(bm, Vector((sx * 0.062, -0.175, 1.818)), 0.022, 1.15, 1.05, 0.90, 7)
        add_blob(bm, Vector((sx * 0.048, -0.168, 1.838)), 0.016, 1.10, 1.00, 0.85, 6)
    ob = bm_to_object('OrcFaceKit', bm, skin_mat)
    skin_head(ob)
    return ob


def build_tusks(ivory, corners):
    """Solid bone cones: gum mass at the lower lip, sweeping up and out."""
    tusks = []
    fallback = {
        'L': Vector((0.044, -0.200, 1.835)),
        'R': Vector((-0.044, -0.200, 1.835)),
    }
    for sx, key in ((1.0, 'L'), (-1.0, 'R')):
        corner = corners.get(key) or fallback[key]
        # Root in the mouth corner, slightly behind the snout tip so the
        # front view shows two cones with a gap, not a white visor.
        root = Vector((sx * 0.052, -0.184, 1.820))
        mid = Vector((root.x + sx * 0.024, root.y - 0.024, root.z + 0.092))
        tip = Vector((root.x + sx * 0.034, root.y - 0.016, root.z + 0.178))
        pts = bezier(root, mid, tip, 12)
        radii = [0.044 * (1.0 - 0.70 * (i / 11) ** 0.80) for i in range(12)]
        bm = bmesh.new()
        add_tube(bm, pts, radii, segs=12)
        add_blob(bm, root, 0.030, 1.30, 1.15, 0.95, 9)
        name = 'OrcTuskL' if sx > 0 else 'OrcTuskR'
        ob = bm_to_object(name, bm, ivory)
        skin_head(ob)
        tusks.append(ob)
    return tusks


def build_hair_and_beard(hair_mat):
    """Wider bun + thicker tail so the topknot reads as a hair mass."""
    bm = bmesh.new()
    add_blob(bm, Vector((0.0, -0.065, 2.028)), 0.082, 1.55, 1.32, 0.82, 10)
    add_blob(bm, Vector((0.0, -0.026, 2.086)), 0.062, 1.40, 1.24, 0.88, 9)
    add_blob(bm, Vector((0.0, 0.024, 2.054)), 0.056, 1.42, 1.20, 0.85, 8)
    add_blob(bm, Vector((0.0, 0.050, 1.968)), 0.046, 1.32, 1.14, 0.90, 8)
    tail_pts = [
        Vector((0.000, -0.020, 2.060)),
        Vector((0.010, 0.020, 2.160)),
        Vector((0.014, 0.065, 2.125)),
        Vector((0.010, 0.090, 2.010)),
        Vector((0.000, 0.100, 1.880)),
        Vector((-0.006, 0.092, 1.770)),
    ]
    tail_r = [0.036, 0.032, 0.028, 0.024, 0.018, 0.012]
    add_tube(bm, tail_pts, tail_r, segs=10, cap_start=False, cap_end=True)
    for p, r in zip(tail_pts[1:], tail_r[1:]):
        add_blob(bm, p, r * 1.08, 1.20, 1.12, 1.10, 6)
    add_blob(bm, Vector((0.0, -0.185, 1.768)), 0.024, 1.55, 0.95, 0.85, 8)
    add_blob(bm, Vector((0.0, -0.188, 1.745)), 0.016, 1.30, 0.90, 0.80, 6)
    for sx in (1.0, -1.0):
        add_blob(bm, Vector((sx * 0.038, -0.165, 1.785)), 0.014, 1.20, 0.90, 0.80, 6)
        add_blob(bm, Vector((sx * 0.055, -0.148, 1.770)), 0.012, 1.10, 0.90, 0.80, 6)
    hair = bpy.data.objects['OrcV1Hair']
    old = hair.data
    mesh = bpy.data.meshes.new('OrcV1Hair')
    bm.normal_update()
    bm.to_mesh(mesh)
    bm.free()
    mesh.update()
    hair.data = mesh
    bpy.data.meshes.remove(old)
    mesh.name = 'OrcV1Hair'
    hair.name = 'OrcV1Hair'
    mesh.materials.clear()
    mesh.materials.append(hair_mat)
    skin_head(hair)
    return hair


def _tex_from_input(socket):
    if not socket or not socket.links:
        return None
    node = socket.links[0].from_node
    if node.type == 'TEX_IMAGE':
        return node.image
    if node.type == 'NORMAL_MAP' and node.inputs.get('Color') and node.inputs['Color'].links:
        src = node.inputs['Color'].links[0].from_node
        return src.image if src.type == 'TEX_IMAGE' else None
    return None


def _multiply_pixels(img, fn):
    n = len(img.pixels)
    px = [0.0] * n
    img.pixels.foreach_get(px)
    fn(px)
    img.pixels.foreach_set(px)
    img.update()


def _hash2(ix, iy):
    n = (ix * 374761393 + iy * 668265263) & 0xFFFFFFFF
    n = (n ^ (n >> 13)) * 1274126177 & 0xFFFFFFFF
    return (n ^ (n >> 16)) / 4294967295.0


def _fade(t):
    return t * t * (3.0 - 2.0 * t)


def _vnoise(x, y, period):
    x0 = int(math.floor(x)) % period
    y0 = int(math.floor(y)) % period
    x1 = (x0 + 1) % period
    y1 = (y0 + 1) % period
    fx = _fade(x - math.floor(x))
    fy = _fade(y - math.floor(y))
    a = _hash2(x0, y0)
    b = _hash2(x1, y0)
    c = _hash2(x0, y1)
    d = _hash2(x1, y1)
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy


def _fbm(x, y, period, octaves=4):
    v, amp, freq, norm = 0.0, 1.0, 1.0, 0.0
    for _ in range(octaves):
        v += amp * _vnoise(x * freq, y * freq, max(2, int(period * freq)))
        norm += amp
        amp *= 0.5
        freq *= 2.0
    return v / max(1e-6, norm)


def make_skin_detail(path, size=512):
    """Small tiling mottling map. Saved for evidence; also baked into albedo."""
    path.parent.mkdir(parents=True, exist_ok=True)
    img = bpy.data.images.new('OrcSkinDetail', width=size, height=size, alpha=False)
    px = [0.0] * (size * size * 4)
    period = 8
    for y in range(size):
        for x in range(size):
            n = _fbm(x / size * period, y / size * period, period, 4)
            g = 0.82 + 0.28 * n
            i = (y * size + x) * 4
            px[i] = g
            px[i + 1] = g
            px[i + 2] = g * 0.96
            px[i + 3] = 1.0
    img.pixels.foreach_set(px)
    img.filepath_raw = str(path)
    img.file_format = 'PNG'
    img.save()
    return img, px, size


def tint_skin():
    """Matte olive-tan with tiling mottling baked into the albedo."""
    mat = bpy.data.materials.get('OrcV1Skin')
    if not mat or not mat.use_nodes:
        return
    nt = mat.node_tree
    bsdf = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    albedo = _tex_from_input(bsdf.inputs.get('Base Color'))
    rough_img = _tex_from_input(bsdf.inputs.get('Roughness'))
    evidence = ROOT / 've-capture/orc-motion/grok-v5/skin-detail.png'
    detail_img, detail_px, ds = make_skin_detail(evidence)
    if albedo:
        aw, ah = albedo.size
        def earth(px):
            tiles = 6.0
            for y in range(ah):
                for x in range(aw):
                    i = (y * aw + x) * 4
                    r, g, b = px[i], px[i + 1], px[i + 2]
                    dx = int((x * tiles) % ds)
                    dy = int((y * tiles) % ds)
                    n = detail_px[(dy * ds + dx) * 4]
                    # Warmer, less green than v4, then low-contrast mottling.
                    r = min(1.0, r * 0.98 * n)
                    g = min(1.0, g * 0.42 * n)
                    b = min(1.0, b * 0.32 * n)
                    u, v = x / max(1, aw - 1), y / max(1, ah - 1)
                    # Face island sits on the right of the MH atlas: darken sockets.
                    if 0.62 < u < 0.98 and 0.38 < v < 0.72:
                        eye = min(
                            (u - 0.78) ** 2 / 0.012 + (v - 0.58) ** 2 / 0.010,
                            (u - 0.88) ** 2 / 0.012 + (v - 0.58) ** 2 / 0.010,
                        )
                        if eye < 1.0:
                            k = 0.72 + 0.28 * eye
                            r *= k
                            g *= k * 0.95
                            b *= k * 0.90
                    px[i], px[i + 1], px[i + 2] = r, g, b
        _multiply_pixels(albedo, earth)
    if rough_img and rough_img is not albedo:
        def rougher(px):
            for i in range(0, len(px), 4):
                px[i + 1] = 0.98
        _multiply_pixels(rough_img, rougher)
    bsdf.inputs['Roughness'].default_value = 1.0
    spec = bsdf.inputs.get('Specular IOR Level') or bsdf.inputs.get('Specular')
    if spec:
        spec.default_value = 0.0
    metal = bsdf.inputs.get('Metallic')
    if metal:
        metal.default_value = 0.0
    blend_prop = mat.bl_rna.properties.get('blend_method')
    if blend_prop:
        ids = [i.identifier for i in blend_prop.enum_items]
        if 'OPAQUE' in ids:
            mat.blend_method = 'OPAQUE'
    bpy.data.images.remove(detail_img)


def join_into(target, extras):
    bpy.ops.object.select_all(action='DESELECT')
    for o in extras:
        o.select_set(True)
    target.select_set(True)
    bpy.context.view_layer.objects.active = target
    bpy.ops.object.join()


# --- body bulk (unchanged from grok-v1) ---
body = bpy.data.objects['OrcV1Body']
shorts = bpy.data.objects['OrcV1Shorts']
for ob in (body, shorts):
    warp_object(ob)
extra_mass(body)

# --- face plane ---
apply_delta(body)
brows = bpy.data.objects['OrcV1Brows']
apply_delta(brows, extra=lambda p: Vector((0.0, -0.038, -0.020)))
mw, inv = brows.matrix_world, brows.matrix_world.inverted()
c = sum((mw @ v.co for v in brows.data.vertices), Vector()) / max(1, len(brows.data.vertices))
for v in brows.data.vertices:
    p = mw @ v.co
    v.co = inv @ (c + (p - c) * Vector((1.35, 1.15, 1.45)))
eyes = bpy.data.objects['OrcV1Eyes']
apply_delta(eyes, extra=lambda p: Vector((0.0, 0.042, -0.016)))
emw, einv = eyes.matrix_world, eyes.matrix_world.inverted()
ec = sum((emw @ v.co for v in eyes.data.vertices), Vector()) / max(1, len(eyes.data.vertices))
for v in eyes.data.vertices:
    p = emw @ v.co
    v.co = einv @ (ec + (p - ec) * 0.78)

skin_mat = bpy.data.materials.get('OrcV1Skin')
ivory = mat_opaque('OrcV1Ivory', (0.80, 0.72, 0.52), 0.74)
hair_mat = mat_opaque('OrcV1Topknot', (0.055, 0.035, 0.025), 0.88)
kit = build_face_kits(body, skin_mat)
corners = mouth_corners(body)
tusks = build_tusks(ivory, corners)
join_into(body, [kit] + tusks)
build_hair_and_beard(hair_mat)
tint_skin()

for name in ('OrcV1Body', 'OrcV1Brows', 'OrcV1Eyes', 'OrcV1Hair', 'OrcV1Shorts'):
    refresh_normals(bpy.data.objects[name])

for ob in list(bpy.data.objects):
    if ob.type == 'MESH' and not ob.name.startswith('OrcV1'):
        bpy.data.objects.remove(ob, do_unlink=True)

bpy.ops.object.select_all(action='DESELECT')
arm.select_set(True)
bpy.context.view_layer.objects.active = arm
bpy.ops.object.mode_set(mode='OBJECT')
bpy.ops.export_scene.gltf(
    filepath=str(OUT / 'orc-bulked.glb'),
    use_selection=False,
    export_format='GLB',
    export_yup=True,
    export_animations=False,
    export_skins=True,
    export_all_influences=False,
    export_materials='EXPORT',
    export_cameras=False,
    export_lights=False,
)
print('ORC BULK COMPLETE meshes', [o.name for o in bpy.data.objects if o.type == 'MESH'],
      'tusk_corners', {k: [round(c, 3) for c in v] for k, v in corners.items()})
