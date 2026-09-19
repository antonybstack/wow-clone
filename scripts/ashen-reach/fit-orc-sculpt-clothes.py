"""Fit Human catalogue garments onto the print-sculpt Orc rest.

Isolated background Blender. MHCLO cannot map this topology. Vertices stay
Human-authored; we scale by stature, push anything inside the Orc surface back
out, and keep the original mixamorig vertex groups. Heat/envelope is only a
fallback. Does not write public/ — prepare-orc-equipment.mjs remaps the skin
onto the playable actor and copies reviewed GLBs.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree

ROOT = Path(__file__).resolve().parents[2]
ORC_BODY = ROOT / 'public/ashen-reach/equipment-orc/body.glb'
HUMAN_DIR = ROOT / 'public/ashen-reach/equipment'
OUT = ROOT / '.cache/armory-assets/orc-sculpt'
OUT.mkdir(parents=True, exist_ok=True)

ORC_HEIGHT = 2.10
HUMAN_HEIGHT = 1.80
WRAP_OFFSET = 0.012
ITEM_OFFSET = {
    'graveweaverHood': 0.018,
    'wayfarerBoots': 0.010,
    'graveweaverGloves': 0.008,
    'graveweaverTop': 0.014,
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
    'wayfarerBoots': 0.08,
    'graveweaverGloves': 0.08,
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
            push_off_body(ob, body, bvh, offset)
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
