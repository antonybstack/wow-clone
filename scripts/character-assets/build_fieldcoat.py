"""Fieldcoat: native tailoring of a pinned, accepted Lector garment master.

Blender owns UV/deform interpolation when cutting the shorter divided hem and
raising the front reinforcement seams. Keep the source collar, sleeves and
underarm lining. Reuse its trim material so the design adds no material batch.
https://docs.blender.org/api/current/bmesh.ops.html#bmesh.ops.bisect_plane
https://docs.blender.org/api/current/bmesh.ops.html#bmesh.ops.extrude_face_region
https://docs.blender.org/api/current/bpy.ops.object.html#bpy.ops.object.vertex_group_limit_total
https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#skinned-mesh-attributes
"""
import os
import json
from pathlib import Path
import bpy
import bmesh
from mathutils import Vector
from mathutils.bvhtree import BVHTree

d = json.loads(os.environ['ASHEN_FACTORY_DESCRIPTOR'])
race = os.environ['ASHEN_FACTORY_RACE']
fit = d['fits'][race]
design = d['design']
output = Path(os.environ['ASHEN_PLATE_OUT'])
if not output.resolve().is_relative_to(Path('.cache').resolve()):
    raise ValueError('Only isolated factory output is allowed')
bpy.ops.wm.read_homefile(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(Path(os.environ['ASHEN_GARMENT_SOURCE']).resolve()))
cloth = next(o for o in bpy.data.objects if o.type == 'MESH' and o.name == fit['garment']['mesh'])
arm = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
if cloth.data.shape_keys:
    raise ValueError('Fieldcoat requires a neutral garment master')
arm.animation_data_clear()
arm.data.pose_position = 'REST'
bpy.context.view_layer.update()
world, inverse = cloth.matrix_world.copy(), cloth.matrix_world.inverted()
scale = world.to_scale()
if min(scale) <= 0 or max(scale) / min(scale) > 1.001:
    raise ValueError('Tailoring requires uniform positive source scale')

def bone(name):
    return arm.matrix_world @ arm.data.bones['mixamorig:' + name].head_local

hips, neck = bone('Hips'), bone('Neck')
thigh, knee, foot = bone('LeftUpLeg'), bone('LeftLeg'), bone('LeftFoot')
unit = (neck.z - foot.z) / 1.33
hem = thigh.z + (knee.z - thigh.z) * design['hemThighFraction']
vent_height, vent_half_width = design['ventHeight'] * unit, design['ventHalfWidth'] * unit
before = len(cloth.data.polygons)
trim_index = next(i for i, m in enumerate(cloth.data.materials) if m.name == design['trimMaterial'])
cloth_index = next(i for i, m in enumerate(cloth.data.materials) if m.name == design['clothMaterial'])
bm = bmesh.new()
bm.from_mesh(cloth.data)

def bisect(origin, normal, clear_inner=False, predicate=None):
    faces = [f for f in bm.faces if predicate is None or predicate(f)]
    vertices = {v for f in faces for v in f.verts}
    edges = {e for f in faces for e in f.edges}
    # Preserve native iteration order; do not feed object-identity set order into
    # BMesh. Limit cuts to their authored region to leave arm/lining skin intact.
    geom = [v for v in bm.verts if v in vertices] + [e for e in bm.edges if e in edges] + faces
    bmesh.ops.bisect_plane(bm, geom=geom,
                          dist=1e-7, plane_co=inverse @ origin,
                          plane_no=world.to_3x3().transposed() @ normal,
                          clear_inner=clear_inner)

# Shorten against each actual skeleton, rather than hardcoding Human metres.
if hem <= min((world @ v.co).z for v in bm.verts):
    raise ValueError('Declared hem does not shorten this source garment')
bisect(Vector((0, 0, hem)), Vector((0, 0, 1)), True)
after_hem = len(bm.faces)
# Two diagonal cuts delineate a V vent on both front and back. Native BMesh
# interpolation retains the source UV and deform layers on the new boundaries.
top = hem + vent_height
def vent_region(f):
    # Cut every lining/trim layer that intersects the vent. Cutting only the
    # outer cloth then deleting other materials by their face centre can remove
    # an uncut polygon extending above the vent, leaving a ragged waist opening.
    # Bound the region in both axes so sleeves keep their original skin rows.
    points = [world @ v.co for v in f.verts]
    pad = .01 * unit
    return (min(p.z for p in points) < top + pad
            and max(p.z for p in points) >= hem - pad
            and min(p.x for p in points) <= hips.x + vent_half_width + pad
            and max(p.x for p in points) >= hips.x - vent_half_width - pad)
for side in [-1, 1]:
    bisect(Vector((hips.x + side * vent_half_width, 0, hem)),
           Vector((1, 0, side * vent_half_width / vent_height)), predicate=vent_region)
vents = []
vent_materials = {}
vent_epsilon = 5e-6 * unit
for f in bm.faces:
    p = world @ f.calc_center_median()
    width = vent_half_width * (1 - (p.z - hem) / vent_height)
    if hem - 1e-6 < p.z < top and abs(p.x - hips.x) < width - 1e-7:
        points = [world @ v.co for v in f.verts]
        if any(not (hem - vent_epsilon <= q.z <= top + vent_epsilon
                    and abs(q.x - hips.x) <= vent_half_width * (1 - (q.z - hem) / vent_height) + vent_epsilon)
               for q in points):
            raise ValueError('Vent face extends outside its cut boundaries')
        vents.append(f)
        material_name = cloth.data.materials[f.material_index].name
        vent_materials[material_name] = vent_materials.get(material_name, 0) + 1
if len(vents) < 4:
    raise ValueError('No continuous divided-hem vent was authored')
bmesh.ops.delete(bm, geom=vents, context='FACES')

# Real shallow ridges reinforce the front panels. Existing folded trim remains
# one draw batch; no detached overlay, new texture or runtime cloth fitter.
seam_x, seam_half_width = design['seamOffset'] * unit, design['seamHalfWidth'] * unit
seam_low, seam_high = hem + .02 * unit, bone('Spine2').z - .03 * unit
def seam_region(f):
    p = world @ f.calc_center_median()
    return (f.material_index == cloth_index and p.y < hips.y
            and min((world @ v.co).z for v in f.verts) < seam_high + .01 * unit
            and max((world @ v.co).z for v in f.verts) > seam_low - .01 * unit
            and abs(p.x - hips.x) < seam_x + .06 * unit)
for z in [seam_low, seam_high]:
    bisect(Vector((0, 0, z)), Vector((0, 0, 1)), predicate=seam_region)
for side in [-1, 1]:
    for edge in [-seam_half_width, seam_half_width]:
        bisect(Vector((hips.x + side * seam_x + edge, 0, 0)), Vector((1, 0, 0)), predicate=seam_region)
bm.verts.ensure_lookup_table()
bm.verts.index_update()
surface = BVHTree.FromPolygons([world @ v.co for v in bm.verts],
                              [[v.index for v in f.verts] for f in bm.faces])
seams = []
for f in bm.faces:
    p = world @ f.calc_center_median()
    if not (f.material_index == cloth_index and seam_low < p.z < seam_high
            and abs(abs(p.x - hips.x) - seam_x) < seam_half_width and p.y < hips.y):
        continue
    hit, _, _, _ = surface.ray_cast(Vector((p.x, -10, p.z)), Vector((0, 1, 0)))
    if hit is not None and abs(hit.y - p.y) < .002 * unit:
        seams.append(f)
if len(seams) < 8:
    raise ValueError('No reinforced front seam surfaces were authored')
raised = bmesh.ops.extrude_face_region(bm, geom=seams)
bm.normal_update()
for element in raised['geom']:
    if isinstance(element, bmesh.types.BMVert):
        element.co += element.normal * (design['seamRise'] * unit / scale.x)
    elif isinstance(element, bmesh.types.BMFace):
        element.material_index = trim_index
originals = [f for f in seams if f.is_valid]
if originals:
    bmesh.ops.delete(bm, geom=originals, context='FACES_ONLY')
bm.normal_update()
bm.to_mesh(cloth.data)
bm.free()
cloth.name = d['mesh']
cloth.data.name = d['mesh']
for polygon in cloth.data.polygons:
    polygon.use_smooth = True

# Quantify interpolation loss, then use Blender's existing influence limiter and
# normalization. The source rig stays ordered; the factory restores exact binds.
discarded = []
for v in cloth.data.vertices:
    weights = sorted((g.weight for g in v.groups if g.weight > 0), reverse=True)
    if not weights or sum(weights) <= 0:
        raise ValueError('Unweighted tailored garment vertex')
    discarded.append(sum(weights[4:]) / sum(weights))
if max(discarded) > .03:
    bad = sorted(range(len(discarded)), key=lambda i: -discarded[i])[:10]
    output.with_suffix('.weight-failure.json').write_text(json.dumps({
        'maxDiscardedWeightFraction': max(discarded), 'rows': [
            {'position': list(world @ cloth.data.vertices[i].co), 'discardedFraction': discarded[i],
             'weights': [[cloth.vertex_groups[g.group].name, g.weight] for g in cloth.data.vertices[i].groups if g.weight > 0]}
            for i in bad]}, indent=2) + '\n')
    raise ValueError(f'Native cutting discards {max(discarded):.6f} of a skin row; cap is 3%')
bpy.ops.object.select_all(action='DESELECT')
cloth.select_set(True)
bpy.context.view_layer.objects.active = cloth
bpy.ops.object.vertex_group_limit_total(group_select_mode='ALL', limit=4)
bpy.ops.object.vertex_group_normalize_all(group_select_mode='ALL', lock_active=False)
arm.select_set(True)
bpy.context.view_layer.objects.active = arm
output.parent.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=str(Path(os.environ['ASHEN_PLATE_BLEND']).resolve()))
bpy.ops.export_scene.gltf(filepath=str(output.resolve()), use_selection=True,
                         export_format='GLB', export_animations=False, export_skins=True,
                         export_all_influences=False, export_cameras=False, export_lights=False)
output.with_suffix('.tailoring.json').write_text(json.dumps({
    'item': d['id'], 'race': race, 'garmentMaster': fit['garment'],
    'sourceFaces': before, 'facesAfterHem': after_hem, 'removedVentFaces': len(vents),
    'ventMaterials': vent_materials, 'ventBoundaryViolations': 0,
    'reinforcedSeamFaces': len(seams), 'hemWorldZ': hem,
    'vertices': len(cloth.data.vertices), 'maxDiscardedWeightFraction': max(discarded),
    'blenderVersion': bpy.app.version_string, 'candidateOnly': True,
}, indent=2) + '\n')
