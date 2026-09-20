"""Grade Human catalogue garments onto the print-sculpt Orc rest.

Isolated background Blender. MHCLO cannot map this topology. Uniform stature
scale is only a starting cage: boots and gloves are then stretched to enclose
the print foot/calf and hand/forearm. Other pieces get a bulk XZ grade plus
push-off. Does not write public/ — prepare-orc-equipment.mjs remaps the skin.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

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


def push_off_body(ob, body, bvh, offset):
    target_mw = body.matrix_world
    target_imw = target_mw.inverted()
    ob_mw = ob.matrix_world
    ob_imw = ob_mw.inverted()
    normal_m = target_mw.to_3x3()
    moved = 0
    for v in ob.data.vertices:
        world = ob_mw @ v.co
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
    log(f'push_off {ob.name} moved={moved}/{len(ob.data.vertices)} offset={offset}')
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


def enclose_origin(meshes, pts, margin=0.024):
    if not pts:
        raise RuntimeError('enclose_origin: no target points')
    mn, mx = world_bbox(meshes)
    tx = [p.x for p in pts]
    ty = [p.y for p in pts]
    tz = [p.z for p in pts]
    need_x = max(abs(min(tx)), abs(max(tx))) + margin
    need_y = max(abs(min(ty)), abs(max(ty))) + margin
    need_z = max(tz) + margin
    have_x = max(abs(mn.x), abs(mx.x), 1e-4)
    have_y = max(abs(mn.y), abs(mx.y), 1e-4)
    have_z = max(mx.z, 1e-4)
    sx, sy, sz = need_x / have_x, need_y / have_y, need_z / have_z
    log(f'enclose_origin scale=({sx:.3f},{sy:.3f},{sz:.3f}) target z<{need_z:.3f}')
    for ob in meshes:
        ob.scale = Vector((sx, sy, sz))
        bpy.context.view_layer.update()
        apply_visual(ob)
    mn, mx = world_bbox(meshes)
    dy = (max(ty) + margin) - mx.y
    if dy > 0.001:
        for ob in meshes:
            ob.location.y += dy
            apply_visual(ob)
        log(f'enclose_origin shift y+{dy:.3f}')


def enclose_capsule(ob, origin, axis_end, pts, radius_margin=0.03, axis_margin=0.05):
    if not pts:
        raise RuntimeError('enclose_capsule: no target points')
    axis = axis_end - origin
    if axis.length < 1e-5:
        raise RuntimeError('enclose_capsule: degenerate axis')
    axis.normalize()
    t_pts = [(p - origin).dot(axis) for p in pts]
    r_pts = [((p - origin) - axis * t).length for p, t in zip(pts, t_pts)]
    t_min = min(t_pts) - axis_margin
    t_max = max(t_pts) + axis_margin
    r_need = max(r_pts) + radius_margin
    mw = ob.matrix_world
    imw = mw.inverted()
    t_g, r_g = [], []
    worlds = []
    for v in ob.data.vertices:
        world = mw @ v.co
        worlds.append(world)
        t = (world - origin).dot(axis)
        rad = (world - origin) - axis * t
        t_g.append(t)
        r_g.append(rad.length)
    gmin, gmax = min(t_g), max(t_g)
    span = max(gmax - gmin, 1e-4)
    r_have = max(r_g + [1e-4])
    moved = 0
    for v, world, t, r in zip(ob.data.vertices, worlds, t_g, r_g):
        t_new = t_min + (t - gmin) / span * (t_max - t_min)
        rad = (world - origin) - axis * t
        if r > 1e-6:
            rad = rad.normalized() * r_need
        else:
            rad = Vector((0, 0, 0))
        world_new = origin + axis * t_new + rad
        v.co = imw @ world_new
        moved += 1
    ob.data.update()
    log(f'enclose_capsule {ob.name} along t={t_min:.3f}..{t_max:.3f} r={r_need:.3f} from r={r_have:.3f} verts={moved}')


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


def grade_item(item_id, meshes, body, arm):
    if item_id == 'wayfarerBoots':
        pts = body_points(body, ('Foot', 'Toe'), 0.25, z_max=0.52)
        enclose_origin(meshes, pts, margin=0.028)
        return
    if item_id == 'graveweaverGloves':
        left_hand_pts = [p for p in body_points(body, ('LeftHand',), 0.45) if p.x > 0]
        left_arm_pts = [p for p in body_points(body, ('LeftForeArm',), 0.45) if p.x > 0]
        right_hand_pts = [p for p in body_points(body, ('RightHand',), 0.45) if p.x < 0]
        right_arm_pts = [p for p in body_points(body, ('RightForeArm',), 0.45) if p.x < 0]
        def centroid(pts, fallback):
            if not pts:
                return fallback
            acc = Vector((0, 0, 0))
            for p in pts:
                acc += p
            return acc / len(pts)
        left_hand = centroid(left_hand_pts, bone_world(arm, 'mixamorig:LeftHand'))
        left_arm = centroid(left_arm_pts, bone_world(arm, 'mixamorig:LeftForeArm'))
        right_hand = centroid(right_hand_pts, bone_world(arm, 'mixamorig:RightHand'))
        right_arm = centroid(right_arm_pts, bone_world(arm, 'mixamorig:RightForeArm'))
        log(f'glove landmarks Lhand={tuple(left_hand)} Larm={tuple(left_arm)} Rhand={tuple(right_hand)}')
        for ob in meshes:
            grade_gloves_two_sided(
                ob,
                left_hand, left_arm, left_hand_pts + left_arm_pts or [left_hand],
                right_hand, right_arm, right_hand_pts + right_arm_pts or [right_hand],
            )
        return
    for ob in meshes:
        ob.scale.x *= 1.14
        ob.scale.y *= 1.14
        bpy.context.view_layer.update()
        apply_visual(ob)


def grade_gloves_two_sided(ob, left_hand, left_arm, left_pts, right_hand, right_arm, right_pts):
    mw = ob.matrix_world
    imw = mw.inverted()
    def fit_side(origin, axis_end, pts):
        axis = axis_end - origin
        if axis.length < 1e-5:
            return None
        axis.normalize()
        t_pts = [(p - origin).dot(axis) for p in pts] or [0]
        r_pts = [((p - origin) - axis * t).length for p, t in zip(pts, t_pts)] or [0.04]
        r_need = min(max(r_pts) + 0.012, 0.095)
        t_min = min(t_pts) - 0.02
        t_max = max(t_pts) + 0.03
        return origin, axis, t_min, t_max, r_need
    left = fit_side(left_hand, left_arm, left_pts)
    right = fit_side(right_hand, right_arm, right_pts)
    worlds = [mw @ v.co for v in ob.data.vertices]
    t_left = [(w - left[0]).dot(left[1]) for w in worlds] if left else []
    t_right = [(w - right[0]).dot(right[1]) for w in worlds] if right else []
    left_gmin = min((t for t, w in zip(t_left, worlds) if w.x >= 0), default=0)
    left_gmax = max((t for t, w in zip(t_left, worlds) if w.x >= 0), default=1)
    right_gmin = min((t for t, w in zip(t_right, worlds) if w.x < 0), default=0)
    right_gmax = max((t for t, w in zip(t_right, worlds) if w.x < 0), default=1)
    for v, world in zip(ob.data.vertices, worlds):
        side = left if world.x >= 0 else right
        if not side:
            continue
        origin, axis, t_min, t_max, r_need = side
        gmin, gmax = (left_gmin, left_gmax) if world.x >= 0 else (right_gmin, right_gmax)
        span = max(gmax - gmin, 1e-4)
        t = (world - origin).dot(axis)
        rad = (world - origin) - axis * t
        target_span = t_max - t_min
        # Stretch at most ~2.1× the authored cuff so a short glove becomes a
        # gauntlet, not a wing.
        used_span = min(target_span, span * 2.1)
        t_new = t_min + (t - gmin) / span * used_span
        if rad.length > 1e-6:
            rad = rad.normalized() * r_need
        v.co = imw @ (origin + axis * t_new + rad)
    ob.data.update()
    log(f'gloves two-sided {ob.name}')


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
            ob.scale *= scale
            bpy.context.view_layer.update()
            apply_visual(ob)
        grade_item(item_id, meshes, body, arm)
        bvh = build_body_bvh(body)
        for ob in meshes:
            push_off_body(ob, body, bvh, offset)
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
