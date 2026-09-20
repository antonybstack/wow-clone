"""Author Orc rest meshes for the print-sculpt body. Isolated Blender.

MHCLO cannot map this topology. Nearest-surface push and origin-scale of Human
clothes leave a 9 cm cuff on a print bicep and shred a hollow Viking last.
Do not restore those operators for gloves or boots.

- Gloves: inflated limb shell of the print hand/forearm/distal arm (Human
  Toigo gloves are too short to grade). Mixamo weights come with the body.
- Boots: translate each Human last onto the print foot centroid, uniform
  horizontal scale about that centroid, shaft-only height extend. Skip
  push-off — inner last verts nearest-snap to the foot and tear the mesh.
- Tunic/vestment sleeves: cylindrical radius grade about the print arm axis
  so skinny Human sleeves cannot trumpet-snap to the chest.

Does not write public/ — prepare-orc-equipment.mjs remaps the skin.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import bmesh
import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree

ROOT = Path(__file__).resolve().parents[2]
ORC_BODY = ROOT / 'public/characters/candidates/orc-source-v1.glb'
HUMAN_DIR = ROOT / 'public/ashen-reach/equipment'
OUT = ROOT / '.cache/armory-assets/orc-sculpt'
OUT.mkdir(parents=True, exist_ok=True)

ORC_HEIGHT = 2.10
HUMAN_HEIGHT = 1.80
WRAP_OFFSET = 0.016
ITEM_OFFSET = {
    'graveweaverHood': 0.022,
    'wayfarerBoots': 0.018,
    'graveweaverGloves': 0.016,
    'graveweaverTop': 0.018,
    'wayfarerTunic': 0.016,
    'pilgrimTunic': 0.016,
}

ITEMS = (
    ('wayfarerTunic', 'wayfarerTunic.glb', ('WayfarerTunic',)),
    ('pilgrimTunic', 'pilgrimTunic.glb', ('PilgrimTunic',)),
    ('wayfarerTrousers', 'wayfarerTrousers.glb', ('WayfarerTrousers', 'WayfarerTrousersCuffs')),
    ('wayfarerBoots', 'wayfarerBoots.glb', ('WayfarerBoots',)),
    ('graveweaverHood', 'graveweaverHood.glb', ('GraveweaverHood',)),
    ('graveweaverTop', 'graveweaverTop.glb', ('GraveweaverTop', 'GraveweaverPendant')),
    ('graveweaverSkirt', 'graveweaverSkirt.glb', ('GraveweaverSkirt', 'WayfarerTrousers', 'WayfarerTrousersCuffs')),
    ('graveweaverGloves', 'graveweaverGloves.glb', ('GraveweaverGloves',)),
)

HEIGHT_SPAN = {
    'wayfarerTunic': 0.50,
    'pilgrimTunic': 0.50,
    'wayfarerTrousers': 0.40,
    'graveweaverTop': 0.30,
    'graveweaverSkirt': 0.40,
    'graveweaverHood': 0.12,
    'wayfarerBoots': 0.45,
    'graveweaverGloves': 0.20,
}


def log(msg):
    print(msg, flush=True)


def object_mode():
    if bpy.context.object and bpy.context.object.mode != 'OBJECT':
        bpy.ops.object.mode_set(mode='OBJECT')


def select_only(ob):
    object_mode()
    bpy.ops.object.select_all(action='DESELECT')
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob


def apply_visual(ob):
    select_only(ob)
    if ob.parent:
        bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM')
    for mod in list(ob.modifiers):
        if mod.type == 'ARMATURE':
            ob.modifiers.remove(mod)
            continue
        try:
            bpy.ops.object.modifier_apply(modifier=mod.name)
        except Exception:
            ob.modifiers.remove(mod)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)


def world_bbox(meshes):
    pts = []
    for ob in meshes:
        mw = ob.matrix_world
        pts.extend(mw @ Vector(c) for c in ob.bound_box)
    if not pts:
        return None
    xs, ys, zs = [p.x for p in pts], [p.y for p in pts], [p.z for p in pts]
    return Vector((min(xs), min(ys), min(zs))), Vector((max(xs), max(ys), max(zs)))


def height_span(mn, mx):
    # glTF import is Z-up in Blender. Height is the axis with the largest range
    # that starts near the ground for full garments; use Z when it is longest.
    spans = ((mx.x - mn.x, 'x'), (mx.y - mn.y, 'y'), (mx.z - mn.z, 'z'))
    return max(spans, key=lambda s: s[0])


def purge_orphans():
    for coll in (bpy.data.meshes, bpy.data.materials, bpy.data.images, bpy.data.armatures, bpy.data.actions):
        for block in list(coll):
            if block.users == 0:
                coll.remove(block)


def import_named_meshes(path, keep):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(path))
    new = [o for o in bpy.data.objects if o not in before]
    mesh_objs = [o for o in new if o.type == 'MESH']
    for o in mesh_objs:
        if o.parent:
            select_only(o)
            bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM')
    for o in new:
        if o.type != 'MESH':
            bpy.data.objects.remove(o, do_unlink=True)
    remaining = list(keep)
    assigned = []
    for o in mesh_objs:
        if o.name in remaining:
            remaining.remove(o.name)
            assigned.append(o)
    for o in mesh_objs:
        if o in assigned:
            continue
        stem = o.name.split('.')[0]
        if stem in remaining:
            remaining.remove(stem)
            o.name = stem
            o.data.name = stem
            assigned.append(o)
    leftovers = [o for o in mesh_objs if o not in assigned]
    for o, name in zip(leftovers, list(remaining)):
        remaining.remove(name)
        o.name = name
        o.data.name = name
        assigned.append(o)
    missing = [n for n in keep if not any(m.name == n for m in assigned)]
    if missing:
        raise RuntimeError(
            f'{path.name} missing {missing}; got {[m.name for m in mesh_objs]}'
        )
    return assigned


def build_body_bvh(body):
    depsgraph = bpy.context.evaluated_depsgraph_get()
    return BVHTree.FromObject(body, depsgraph, epsilon=0.0)


def push_off_body(ob, body, bvh, offset, skip_fn=None):
    target_mw = body.matrix_world
    target_imw = target_mw.inverted()
    ob_mw = ob.matrix_world
    ob_imw = ob_mw.inverted()
    normal_m = target_mw.to_3x3()
    moved = 0
    skipped = 0
    for v in ob.data.vertices:
        world = ob_mw @ v.co
        if skip_fn and skip_fn(world):
            skipped += 1
            continue
        local = target_imw @ world
        hit = bvh.find_nearest(local)
        if hit[0] is None:
            continue
        loc, normal, _index, _dist = hit
        world_hit = target_mw @ loc
        world_n = (normal_m @ normal)
        if world_n.length_squared < 1e-12:
            continue
        world_n.normalize()
        signed = (world - world_hit).dot(world_n)
        if signed < offset:
            world = world_hit + world_n * offset
            v.co = ob_imw @ world
            moved += 1
    ob.data.update()
    log(f'push_off {ob.name} moved={moved}/{len(ob.data.vertices)} skip={skipped} offset={offset}')
    return moved


def bone_world(arm, name):
    bone = arm.pose.bones.get(name)
    if bone is None:
        raise RuntimeError('missing bone ' + name)
    return arm.matrix_world @ bone.head


def body_points(body, substrings, min_w=0.25, z_max=None):
    idxs = [g.index for g in body.vertex_groups if any(s in g.name for s in substrings)]
    mw = body.matrix_world
    pts = []
    for v in body.data.vertices:
        w = sum(g.weight for g in v.groups if g.group in idxs)
        world = mw @ v.co
        if w >= min_w or (z_max is not None and world.z <= z_max):
            if z_max is None or world.z <= z_max + 0.02:
                pts.append(world)
    return pts


def transfer_weights(ob, body):
    select_only(ob)
    for mod in list(ob.modifiers):
        if mod.type == 'ARMATURE':
            continue
        ob.modifiers.remove(mod)
    mod = ob.modifiers.new('OrcWeightXfer', 'DATA_TRANSFER')
    mod.object = body
    mod.use_vert_data = True
    try:
        mod.data_types_verts = {'VGROUP_WEIGHTS'}
    except TypeError:
        pass
    try:
        mod.vert_mapping = 'POLYINTERP_NEAREST'
    except TypeError:
        try:
            mod.vert_mapping = 'NEAREST_FACE_INTERPOLATED'
        except TypeError:
            log('weight transfer mapping unavailable')
            ob.modifiers.remove(mod)
            return
    mod.use_max_distance = True
    mod.max_distance = 0.25
    try:
        bpy.ops.object.datalayout_transfer(modifier=mod.name)
    except Exception as err:
        log(f'datalayout_transfer: {err}')
    try:
        bpy.ops.object.modifier_apply(modifier=mod.name)
        log(f'transferred Orc weights onto {ob.name}')
    except Exception as err:
        log(f'weight transfer apply skipped: {err}')
        if mod.name in ob.modifiers:
            ob.modifiers.remove(mod)


def vert_weight(ob, index, substrings):
    idxs = [g.index for g in ob.vertex_groups if any(s in g.name for s in substrings)]
    return sum(g.weight for g in ob.data.vertices[index].groups if g.group in idxs)


def keep_glove_vert(ob, index):
    """Print hand + forearm + distal/mid upper arm. Wider than BodyHands so leather
    overlaps the vestment instead of sharing a knife-cut with hidden skin."""
    w_hand = vert_weight(ob, index, ('Hand',))
    w_fore = vert_weight(ob, index, ('ForeArm',))
    w_arm = vert_weight(ob, index, (':LeftArm', ':RightArm'))
    w_sh = vert_weight(ob, index, ('Shoulder',))
    x = (ob.matrix_world @ ob.data.vertices[index].co).x
    return (
        w_hand > 0.20
        or w_fore > 0.20
        or (w_arm > 0.18 and abs(x) > 0.16)
        or (w_sh > 0.28 and abs(x) > 0.20)
    )


def limb_shell(body, keep_fn, inflate, name, materials):
    """Offset copy of a body region — guaranteed coverage, same Mixamo weights.

    Do not holes-fill both arms as one polygon and do not solidify: those two
    operators exploded the first gauntlet into 25 m spikes.
    """
    shell = body.copy()
    shell.data = body.data.copy()
    shell.name = name
    shell.data.name = name
    bpy.context.collection.objects.link(shell)
    apply_visual(shell)
    mn0, mx0 = world_bbox([shell])
    log(f'limb_shell {name} after apply {tuple(mn0)}..{tuple(mx0)} scale={tuple(shell.scale)}')
    bm = bmesh.new()
    bm.from_mesh(shell.data)
    bm.verts.ensure_lookup_table()
    dead = [v for v in bm.verts if not keep_fn(shell, v.index)]
    if len(dead) >= len(bm.verts):
        bm.free()
        raise RuntimeError(f'{name} limb shell kept no vertices')
    bmesh.ops.delete(bm, geom=dead, context='VERTS')
    # Cap each arm's proximal cuff only. Filling every boundary as one polygon
    # welded both arms and exploded the first gauntlet to 25 m.
    used = set()
    cuff_loops = []
    for edge in bm.edges:
        if not edge.is_boundary or edge.index in used:
            continue
        loop = []
        cur = edge
        vert = edge.verts[0]
        while cur and cur.index not in used:
            used.add(cur.index)
            loop.append(cur)
            vert = cur.other_vert(vert)
            nxt = next((e for e in vert.link_edges if e.is_boundary and e.index not in used), None)
            cur = nxt
        if 8 <= len(loop) <= 80:
            cuff_loops.append(loop)
    cuff_loops.sort(key=len, reverse=True)
    capped = 0
    for loop in cuff_loops[:2]:
        try:
            bmesh.ops.holes_fill(bm, edges=loop, sides=0)
            capped += 1
        except Exception as err:
            log(f'cuff fill skipped: {err}')
    log(f'limb_shell {name} capped {capped}/{len(cuff_loops)} cuff loops (longest two)')
    bmesh.ops.triangulate(bm, faces=bm.faces)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    for v in bm.verts:
        n = v.normal
        if n.length_squared < 1e-12:
            continue
        v.co = v.co + n.normalized() * inflate
    bm.to_mesh(shell.data)
    bm.free()
    shell.data.update()
    mn, mx = world_bbox([shell])
    log(f'limb_shell {name} verts={len(shell.data.vertices)} inflate={inflate} bbox={tuple(mn)}..{tuple(mx)}')
    if max(abs(v) for v in (*mn, *mx)) > 10:
        raise RuntimeError(f'{name} shell left metre bind space')
    shell.data.materials.clear()
    for mat in materials:
        if mat:
            shell.data.materials.append(mat)
    select_only(shell)
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    try:
        bpy.ops.uv.smart_project(angle_limit=1.15, island_margin=0.02)
    except TypeError:
        bpy.ops.uv.smart_project()
    bpy.ops.mesh.vertices_smooth(factor=0.12, repeat=1)
    bpy.ops.object.mode_set(mode='OBJECT')
    return shell


def replace_with_shell(meshes, body, keep_fn, inflate, name):
    materials = [mat.copy() if mat else None for mat in meshes[0].data.materials]
    stale_meshes = [ob.data for ob in meshes]
    for ob in meshes:
        bpy.data.objects.remove(ob, do_unlink=True)
    for mesh in stale_meshes:
        if mesh.users == 0:
            bpy.data.meshes.remove(mesh)
    shell = limb_shell(body, keep_fn, inflate, name, materials)
    shell.name = name
    shell.data.name = name
    return [shell]


def grade_boots_per_foot(ob, body):
    """Park each last on the print foot, uniform horizontal scale, shaft only in Z.

    Do not nearest-snap: inner last verts collapse onto the foot and tear the
    atlas. Do not origin-scale with separate sx/sy/sz: that shears the last.
    """
    mw = ob.matrix_world
    imw = mw.inverted()
    worlds = [mw @ v.co for v in ob.data.vertices]
    for sign, foot_keys, leg_keys in (
        (1, ('LeftFoot', 'LeftToe'), ('LeftLeg',)),
        (-1, ('RightFoot', 'RightToe'), ('RightLeg',)),
    ):
        foot_pts = [p for p in body_points(body, foot_keys, 0.18) if p.x * sign > 0]
        shin_pts = [p for p in body_points(body, leg_keys, 0.25) if p.x * sign > 0 and p.z < 0.58]
        side_idx = [i for i, w in enumerate(worlds) if w.x * sign > 0.02]
        if not foot_pts or not side_idx:
            continue
        # AABB centre, not vertex-mean: paddle toes otherwise bias the last off the heel.
        c = Vector((
            (min(p.x for p in foot_pts) + max(p.x for p in foot_pts)) * 0.5,
            (min(p.y for p in foot_pts) + max(p.y for p in foot_pts)) * 0.5,
            0,
        ))
        boot_c = Vector((
            (min(worlds[i].x for i in side_idx) + max(worlds[i].x for i in side_idx)) * 0.5,
            (min(worlds[i].y for i in side_idx) + max(worlds[i].y for i in side_idx)) * 0.5,
            0,
        ))
        dx, dy = c.x - boot_c.x, c.y - boot_c.y
        for i in side_idx:
            w = worlds[i]
            worlds[i] = Vector((w.x + dx, w.y + dy, w.z))
        need = max(Vector((p.x - c.x, p.y - c.y, 0)).length for p in foot_pts) + 0.036
        have = max(Vector((worlds[i].x - c.x, worlds[i].y - c.y, 0)).length for i in side_idx) or 1e-4
        s = max(need / have, 1.0)
        z_need = max((p.z for p in shin_pts), default=0.52) + 0.028
        z_hi = max((worlds[i].z for i in side_idx), default=0.36)
        z0 = 0.14
        for i in side_idx:
            w = worlds[i]
            xy = Vector((c.x + (w.x - c.x) * s, c.y + (w.y - c.y) * s, w.z))
            if w.z > z0:
                xy.z = z0 + (w.z - z0) * max(z_need - z0, 0.01) / max(z_hi - z0, 0.01)
            worlds[i] = xy
            ob.data.vertices[i].co = imw @ xy
        log(f'boot sign={sign} translate=({dx:.3f},{dy:.3f}) xy×{s:.3f} shaft->{z_need:.3f}')
    ob.data.update()
    mn, mx = world_bbox([ob])
    if mn.z < -0.008:
        lift = -mn.z
        for v in ob.data.vertices:
            world = ob.matrix_world @ v.co
            world.z += lift
            v.co = ob.matrix_world.inverted() @ world
        ob.data.update()
        log(f'boot lift {lift:.3f}')


def grade_sleeves(ob, body, margin=0.020):
    """Grow T-pose sleeves about the print arm axis. Nearest-surface hits the chest."""
    mw = ob.matrix_world
    imw = mw.inverted()
    for sign, keys in (
        (1, ('LeftShoulder', 'LeftArm', 'LeftForeArm', 'LeftHand')),
        (-1, ('RightShoulder', 'RightArm', 'RightForeArm', 'RightHand')),
    ):
        pts = [p for p in body_points(body, keys, 0.18) if p.x * sign > 0.12]
        if len(pts) < 12:
            continue
        shoulder = min(pts, key=lambda p: abs(p.x))
        hand = max(pts, key=lambda p: abs(p.x))
        axis = hand - shoulder
        if axis.length < 0.05:
            continue
        axis.normalize()
        samples = []
        for p in pts:
            t = (p - shoulder).dot(axis)
            r = ((p - shoulder) - axis * t).length
            samples.append((t, r))
        t_min = min(s[0] for s in samples)
        t_max = max(s[0] for s in samples)

        def body_r(t):
            rs = [s[1] for s in samples if abs(s[0] - t) < 0.08]
            return max(rs) if rs else 0.12

        moved = 0
        for v in ob.data.vertices:
            world = mw @ v.co
            if world.x * sign <= 0.28:
                continue
            if world.z < 1.32:
                continue
            t = (world - shoulder).dot(axis)
            if t < t_min - 0.04 or t > t_max + 0.08:
                continue
            radial = (world - shoulder) - axis * t
            r = radial.length
            if r < 1e-5:
                continue
            need = body_r(t) + margin
            if r < need:
                v.co = imw @ (shoulder + axis * t + radial.normalized() * need)
                moved += 1
        log(f'sleeves sign={sign} moved={moved} on {ob.name}')
    ob.data.update()


def is_sleeve_world(world):
    return abs(world.x) > 0.28 and world.z > 1.32


SHELL_ITEMS = {'graveweaverGloves'}
SKIP_PUSH = {'graveweaverGloves', 'wayfarerBoots'}
SLEEVE_ITEMS = {'wayfarerTunic', 'pilgrimTunic', 'graveweaverTop'}


def grade_item(item_id, meshes, body, arm):
    if item_id == 'wayfarerBoots':
        for ob in meshes:
            grade_boots_per_foot(ob, body)
        return meshes
    if item_id == 'graveweaverGloves':
        return replace_with_shell(meshes, body, keep_glove_vert, 0.020, 'GraveweaverGloves')
    if item_id in SLEEVE_ITEMS:
        for ob in meshes:
            if 'Pendant' in ob.name:
                continue
            ob.scale.x *= 1.10
            ob.scale.y *= 1.10
            bpy.context.view_layer.update()
            apply_visual(ob)
            grade_sleeves(ob, body)
        return meshes
    for ob in meshes:
        ob.scale.x *= 1.14
        ob.scale.y *= 1.14
        bpy.context.view_layer.update()
        apply_visual(ob)
    return meshes


def group_coverage(ob):
    weighted = sum(1 for v in ob.data.vertices if v.groups)
    mixamo = sum(1 for g in ob.vertex_groups if g.name.startswith('mixamorig:'))
    return weighted, len(ob.data.vertices), mixamo, len(ob.vertex_groups)


def bind_existing(ob, arm):
    for mod in list(ob.modifiers):
        ob.modifiers.remove(mod)
    mw = ob.matrix_world.copy()
    ob.parent = arm
    ob.parent_type = 'OBJECT'
    ob.matrix_world = mw
    mod = ob.modifiers.new('Armature', 'ARMATURE')
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
    weighted, total, mixamo, groups = group_coverage(ob)
    log(f'reused weights {ob.name} weighted={weighted}/{total} mixamo={mixamo}/{groups}')
    return weighted


def skin_heat(ob, arm):
    object_mode()
    ob.parent = None
    for mod in list(ob.modifiers):
        ob.modifiers.remove(mod)
    ob.vertex_groups.clear()
    select_only(arm)
    ob.select_set(True)
    bpy.context.view_layer.objects.active = arm
    arm.data.pose_position = 'REST'
    bpy.ops.object.parent_set(type='ARMATURE_AUTO')
    mw = ob.matrix_world.copy()
    ob.parent = arm
    ob.parent_type = 'OBJECT'
    ob.matrix_world = mw
    if not any(m.type == 'ARMATURE' for m in ob.modifiers):
        mod = ob.modifiers.new('Armature', 'ARMATURE')
        mod.object = arm
        mod.use_vertex_groups = True
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
    weighted = sum(1 for v in ob.data.vertices if v.groups)
    if weighted < max(1, len(ob.data.vertices) // 2):
        log(f'skin: heat {weighted}/{len(ob.data.vertices)} on {ob.name}; envelope')
        select_only(arm)
        ob.select_set(True)
        bpy.context.view_layer.objects.active = arm
        bpy.ops.object.parent_set(type='ARMATURE_ENVELOPE')
        mw = ob.matrix_world.copy()
        ob.parent = arm
        ob.parent_type = 'OBJECT'
        ob.matrix_world = mw
        weighted = sum(1 for v in ob.data.vertices if v.groups)
    log(f'skinned {ob.name} weighted={weighted}/{len(ob.data.vertices)} groups={len(ob.vertex_groups)}')
    if weighted < max(1, len(ob.data.vertices) // 3):
        raise RuntimeError(f'{ob.name} still underweighted after envelope')


def skin(ob, arm):
    weighted, total, mixamo, _groups = group_coverage(ob)
    if mixamo >= 20 and weighted > total // 2:
        bind_existing(ob, arm)
        return
    log(f'{ob.name} missing reusable weights (weighted={weighted}/{total} mixamo={mixamo}); heat')
    skin_heat(ob, arm)


def export_glb(path, objects):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    path.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(
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
    log(f'exported {path} ({path.stat().st_size} bytes)')


def main():
    if not ORC_BODY.exists():
        raise FileNotFoundError(ORC_BODY)
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=True)
    log(f'IMPORT ORC BODY {ORC_BODY}')
    bpy.ops.import_scene.gltf(filepath=str(ORC_BODY))
    arm = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
    arm.name = 'SourceArmature'
    arm.data.pose_position = 'REST'
    if arm.animation_data:
        arm.animation_data_clear()
    for action in list(bpy.data.actions):
        bpy.data.actions.remove(action)
    body = next(o for o in bpy.data.objects if o.type == 'MESH' and o.name.startswith('OrcV1Body'))
    bpy.context.view_layer.update()
    body_mn, body_mx = world_bbox([body])
    log(f'orc body world bbox {tuple(body_mn)} .. {tuple(body_mx)}')
    if max(abs(v) for v in (*body_mn, *body_mx)) > 10:
        raise RuntimeError('Orc body is not in metre bind space')
    bvh = build_body_bvh(body)
    scale = ORC_HEIGHT / HUMAN_HEIGHT
    log(f'orc body={body.name} scale×{scale:.4f} from human {HUMAN_HEIGHT}m')
    report = []
    wanted = {a.split('=')[1] for a in sys.argv if a.startswith('--item=')}
    for item_id, filename, names in ITEMS:
        if wanted and item_id not in wanted:
            continue
        src = HUMAN_DIR / filename
        if not src.exists():
            raise FileNotFoundError(src)
        log(f'FIT {item_id}')
        meshes = import_named_meshes(src, names)
        offset = ITEM_OFFSET.get(item_id, WRAP_OFFSET)
        for ob in meshes:
            apply_visual(ob)
            if item_id not in SHELL_ITEMS:
                ob.scale *= scale
                bpy.context.view_layer.update()
                apply_visual(ob)
        meshes = grade_item(item_id, meshes, body, arm)
        bvh = build_body_bvh(body)
        skip_sleeves = is_sleeve_world if item_id in SLEEVE_ITEMS else None
        for ob in meshes:
            if item_id not in SKIP_PUSH:
                push_off_body(ob, body, bvh, offset, skip_fn=skip_sleeves)
            transfer_weights(ob, body)
            skin(ob, arm)
        mn, mx = world_bbox(meshes)
        span, axis = height_span(mn, mx)
        need = HEIGHT_SPAN.get(item_id, 0.05)
        log(f'bbox {item_id} {tuple(mn)} .. {tuple(mx)} span={span:.3f}{axis}')
        if span < need:
            raise RuntimeError(f'{item_id} collapsed ({span:.3f}{axis} < {need})')
        if max(abs(v) for v in (*mn, *mx)) > 10:
            raise RuntimeError(f'{item_id} left metre bind space')
        if item_id == 'graveweaverGloves' and (mx.x - mn.x) < 2.15:
            raise RuntimeError(f'gloves do not span print hands {(mx.x - mn.x):.3f}')
        if item_id == 'wayfarerBoots':
            if mx.z < 0.50:
                raise RuntimeError(f'boot shaft too short z={mx.z:.3f}')
            if mx.x < 0.40:
                raise RuntimeError(f'boot last too narrow x={mx.x:.3f}')
            if mn.y > -0.26 or mx.y < 0.22:
                raise RuntimeError(f'boot last misses toe/heel y={mn.y:.3f}..{mx.y:.3f}')
        for ob in meshes:
            ob.data.name = ob.name
        out = OUT / f'{item_id}.glb'
        export_glb(out, [arm, *meshes])
        for ob in meshes:
            bpy.data.objects.remove(ob, do_unlink=True)
        purge_orphans()
        report.append({
            'id': item_id,
            'meshes': list(names),
            'bytes': out.stat().st_size,
            'bbox': {'min': list(mn), 'max': list(mx), 'span': span, 'axis': axis},
        })
    (OUT / 'fit.json').write_text(
        json.dumps({'scale': scale, 'offset': WRAP_OFFSET, 'items': report}, indent=2) + '\n'
    )
    log('ORC SCULPT CLOTHES FIT ' + json.dumps(report))


if __name__ == '__main__' or True:
    try:
        main()
    except Exception:
        import traceback
        traceback.print_exc()
        raise
