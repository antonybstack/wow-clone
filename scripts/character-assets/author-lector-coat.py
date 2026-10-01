"""Native structural tailoring on the accepted per-race fitted garment.

Isolated Blender only. Preserve the source rest rig and inherited sleeve/cape
weights; author a stand collar, folded lapels and flared sleeve cuffs.
https://docs.blender.org/api/current/bmesh.ops.html#bmesh.ops.bisect_plane
https://docs.blender.org/api/current/bmesh.ops.html#bmesh.ops.extrude_edge_only
https://docs.blender.org/manual/en/latest/modeling/modifiers/generate/solidify.html
"""
import bpy
import bmesh
import json
import sys
from pathlib import Path
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree

args = sys.argv[sys.argv.index('--') + 1:]
source, output, report_path, body_source = map(Path, args)
if not output.resolve().is_relative_to(Path('.cache').resolve()):
    raise ValueError('Only isolated candidate output is allowed')
bpy.ops.wm.read_homefile(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(source.resolve()))
cloth = next(o for o in bpy.data.objects if o.type == 'MESH' and o.name in ['PilgrimTunic','WayfarerTunic'])
arm = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
arm.animation_data_clear()
arm.data.pose_position = 'REST'
bpy.context.view_layer.update()
if cloth.data.shape_keys:
    raise ValueError('Tailor the neutral garment before compiling its shape family')
for modifier in list(cloth.modifiers):
    if modifier.type == 'ARMATURE':
        cloth.modifiers.remove(modifier)
world, inverse = cloth.matrix_world.copy(), cloth.matrix_world.inverted()
scale = world.to_scale()
if min(scale) <= 0 or max(scale) / min(scale) > 1.001:
    raise ValueError('Tailoring requires uniform positive source scale')

def bone(name):
    return arm.matrix_world @ arm.data.bones['mixamorig:' + name].head_local

hips, spine, neck = bone('Hips'), bone('Spine'), bone('Neck')
ankle = bone('LeftFoot')
height_unit = (neck.z - ankle.z) / 1.33
before = len(cloth.data.vertices)
print('TAILOR FRAME', tuple(world.to_scale()), tuple(hips), tuple(neck),
      'bounds', [min((world @ v.co)[i] for v in cloth.data.vertices) for i in range(3)],
      [max((world @ v.co)[i] for v in cloth.data.vertices) for i in range(3)], flush=True)
bm = bmesh.new()
bm.from_mesh(cloth.data)
bm.verts.ensure_lookup_table()
# Preserve the accepted source torso and waist exactly. Cutting/extruding a new
# Donitz hem or copying the body's torso both failed real moving fit review.
hem_z = min((world @ v.co).z for v in bm.verts)
edges = [e for e in bm.edges if e.is_boundary]
new_verts, tail_edges = [], []
# Widen the existing sleeve cuff in the plane perpendicular to its actual rest
# forearm. Preserve longitudinal length and smooth inherited skinning.
flared = 0
for side in ['Left', 'Right']:
    hand, forearm = bone(side + 'Hand'), bone(side + 'ForeArm')
    axis = (hand - forearm).normalized()
    for v in bm.verts:
        p = world @ v.co
        offset = p - hand
        along = offset.dot(axis)
        radial = offset - axis * along
        factor = max(0, 1 - abs(along) / (.065 * height_unit))
        if factor and radial.length < .10 * height_unit:
            p += radial * .24 * factor
            v.co = inverse @ p
            flared += 1
# Keep the accepted waist and trouser overlap; no new front cut or tail weights.
deleted = []
bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=1e-6)
bm.normal_update()
bm.to_mesh(cloth.data)
bm.free()
cloth.name = 'LectorCoat'
cloth.data.name = 'LectorCoat'
for polygon in cloth.data.polygons:
    polygon.use_smooth = True
# Discard the failed rear weight-transfer/shrinkwrap approach. A native cloth
# lining uses the actual body's skin, so skin cannot cross the lining when the
# inherited loose source coat moves at the armpit or shoulder blade.
rear_vertices = 0
for material in cloth.data.materials:
    bsdf = material.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Roughness'].default_value = .92
    # Tint only accompanies the structural garment, never counts as a new design.
    material.diffuse_color = (.37, .48, .64, 1)
    if not bsdf.inputs['Base Color'].is_linked:
        bsdf.inputs['Base Color'].default_value = (.37, .48, .64, 1)

trim = bpy.data.materials.new('Lector folded wool trim')
trim.use_nodes = True
bsdf = trim.node_tree.nodes.get('Principled BSDF')
bsdf.inputs['Base Color'].default_value = (.16, .115, .065, 1)
bsdf.inputs['Roughness'].default_value = .92
cloth.data.materials.append(trim)
# Fold the source cloth's own front strips. Detached overlay panels repeatedly
# crossed the mantle despite native projection, so discard that premise rather
# than keep sweeping offsets. Native extrusion preserves the real surface, UVs
# and interpolated weights at every point on the folded lapel.
fold = bmesh.new()
fold.from_mesh(cloth.data)
fold.verts.ensure_lookup_table()
# Insert clean diagonal boundaries for the folded strips before selecting faces.
# BMesh carries its native UV/deform layers onto the new edge vertices.
start_z, end_z = spine.z + .10 * height_unit, neck.z - .035 * height_unit
planes = [(Vector((0, 0, z)), Vector((0, 0, 1))) for z in [start_z, end_z]]
for side in [-1, 1]:
    for edge in [-.018, .018]:
        planes.append((Vector((hips.x + side * (.035 + edge) * height_unit, 0, start_z)),
                       Vector((1, 0, -side * .24))))
for origin, normal in planes:
    bmesh.ops.bisect_plane(fold, geom=list(fold.verts) + list(fold.edges) + list(fold.faces),
                          dist=1e-6, plane_co=inverse @ origin,
                          plane_no=world.to_3x3().transposed() @ normal)
fold.verts.ensure_lookup_table()
fold.verts.index_update()
fold.faces.ensure_lookup_table()
fold_surface = BVHTree.FromPolygons([world @ v.co for v in fold.verts],
                                  [[v.index for v in f.verts] for f in fold.faces])
lapel_faces = []
for f in fold.faces:
    p = world @ f.calc_center_median()
    line_x = .035 * height_unit + max(0, p.z - spine.z - .10 * height_unit) * .24
    if not (start_z < p.z < end_z
            and abs(abs(p.x - hips.x) - line_x) < .018 * height_unit
            and p.y < hips.y):
        continue
    hit, _, _, _ = fold_surface.ray_cast(Vector((p.x, -10, p.z)), Vector((0, 1, 0)))
    if hit is not None and abs(hit.y - p.y) < .002 * height_unit:
        lapel_faces.append(f)
if len(lapel_faces) < 8:
    raise ValueError(f'Only {len(lapel_faces)} visible lapel faces')
raised = bmesh.ops.extrude_face_region(fold, geom=lapel_faces)
fold.normal_update()
for v in raised['geom']:
    if isinstance(v, bmesh.types.BMVert):
        v.co += v.normal * (.009 * height_unit / scale.x)
    elif isinstance(v, bmesh.types.BMFace):
        v.material_index = len(cloth.data.materials) - 1
valid_original = [f for f in lapel_faces if f.is_valid]
if valid_original:
    bmesh.ops.delete(fold, geom=valid_original, context='FACES_ONLY')
fold.normal_update()
fold.to_mesh(cloth.data)
fold.free()
parts = [cloth]

def panel(name, points, faces, weights):
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(points, [], faces)
    mesh.materials.append(trim)
    mesh.update()
    ob = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(ob)
    for joint, value in weights.items():
        ob.vertex_groups.new(name='mixamorig:' + joint).add(list(range(len(points))), value, 'REPLACE')
    ob.parent = arm
    # Assigning a parent must not silently multiply metre geometry by its .01 frame.
    ob.matrix_world = Matrix.Identity(4)
    # New trim inherits the authored garment's local blend, rather than imposing
    # one guessed spine weight across both collar and lower lapel. Transfer only
    # these new panels; preserve the loose source cloth's original weights.
    # https://docs.blender.org/manual/en/latest/modeling/modifiers/modify/data_transfer.html
    existing = {g.name for g in ob.vertex_groups}
    for group in cloth.vertex_groups:
        if group.name not in existing:
            ob.vertex_groups.new(name=group.name)
    transfer = ob.modifiers.new('authored cloth skin', 'DATA_TRANSFER')
    transfer.object = cloth
    transfer.use_vert_data = True
    transfer.data_types_verts = {'VGROUP_WEIGHTS'}
    transfer.vert_mapping = 'POLYINTERP_NEAREST'
    transfer.layers_vgroup_select_src = 'ALL'
    transfer.layers_vgroup_select_dst = 'NAME'
    transfer.mix_mode = 'REPLACE'
    transfer.mix_factor = 1
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.modifier_apply(modifier=transfer.name)
    solid = ob.modifiers.new('fold thickness', 'SOLIDIFY')
    solid.thickness = .004 * height_unit
    solid.offset = 0
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.modifier_apply(modifier=solid.name)
    for poly in ob.data.polygons:
        poly.use_smooth = True
    parts.append(ob)
    return ob

# Stand collar follows the neck joint, with a deliberate open front and a folded
# lapel on each side. Its location is measured from the actual garment neckline.
neckline = []
for v in cloth.data.vertices:
    p = world @ v.co
    if abs(p.z - neck.z) < .12 * height_unit and abs(p.x - neck.x) < .11 * height_unit:
        neckline.append(p)
if not neckline:
    raise ValueError('No collar reference surface')
collar_z = max(neck.z - .042 * height_unit, min(p.z for p in neckline))
import math
points = []
for z in [collar_z, collar_z + .06 * height_unit]:
    for i in range(13):
        angle = math.pi * .17 + i * math.pi * 1.66 / 12
        points.append((neck.x + math.sin(angle) * .083 * height_unit,
                       neck.y - math.cos(angle) * .080 * height_unit, z))
panel('LectorCollar', points, [(i, i + 1, i + 14, i + 13) for i in range(12)], {'Neck': .4, 'Spine2': .6})

# Reuse the same proven actual-source underarm panels as the armor compiler.
# Do not replace the torso with a copied body surface: that failed garment review.
prior_objects = set(bpy.data.objects)
bpy.ops.import_scene.gltf(filepath=str(body_source.resolve()))
regions = [o for o in bpy.data.objects if o not in prior_objects and o.type == 'MESH'
           and (o.name.startswith('Body') or o.name.startswith('HumanV1Body')
                or o.name.startswith('UndeadV1Body'))]
sys.path.insert(0, str(Path(__file__).resolve().parent))
from native_cloth_panels import author_underarm_panels
panels = author_underarm_panels(arm, regions, height_unit, 'Lector underarm wool', (.02, .025, .035, 1))
parts.extend(panels)
underarm_vertices = sum(len(p.data.vertices) for p in panels)
for ob in list(bpy.data.objects):
    if ob not in prior_objects and ob not in panels:
        bpy.data.objects.remove(ob, do_unlink=True)
# All new structural pieces use the same exported skin, preserving shared palette.
for ob in parts:
    if not any(m.type == 'ARMATURE' for m in ob.modifiers):
        mod = ob.modifiers.new('accepted source skin', 'ARMATURE')
        mod.object = arm
    ob.select_set(True)
    if ob is cloth:
        ob.parent = arm
        ob.matrix_world = world
bpy.ops.object.select_all(action='DESELECT')
for ob in parts:
    ob.select_set(True)
bpy.context.view_layer.objects.active = cloth
bpy.ops.object.join()
cloth.name = 'LectorCoat'
cloth.data.name = 'LectorCoat'
# glTF/Lite use four skin influences. Normalize explicitly and retain the discarded
# interpolated mass; an exporter warning must never be our only evidence of loss.
discarded = []
for vertex in cloth.data.vertices:
    row = sorted([(g.group, g.weight) for g in vertex.groups if g.weight > 0], key=lambda x:-x[1])
    total = sum(w for _, w in row)
    if total <= 0:
        raise ValueError(f'Unweighted coat vertex {vertex.index}')
    kept = row[:4]
    discarded.append(sum(w for _, w in row[4:]) / total)
    for group, _ in row:
        cloth.vertex_groups[group].remove([vertex.index])
    total_kept = sum(w for _, w in kept)
    for group, weight in kept:
        cloth.vertex_groups[group].add([vertex.index], weight / total_kept, 'REPLACE')
bpy.ops.object.select_all(action='DESELECT')
cloth.select_set(True)
arm.select_set(True)
bpy.context.view_layer.objects.active = arm
output.parent.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=str(output.with_suffix('.blend').resolve()))
bpy.ops.export_scene.gltf(filepath=str(output.resolve()), use_selection=True,
                         export_format='GLB', export_animations=False, export_skins=True,
                         export_all_influences=False, export_cameras=False, export_lights=False)
report_path.write_text(json.dumps({'source':str(source),'verticesBefore':before,
    'verticesAfter':len(cloth.data.vertices),'hemEdges':len(edges),'removedFrontFaces':len(deleted),
    'extendedTailVertices':len(new_verts),'subdividedTailEdges':len(tail_edges),'flaredCuffVertices':flared,'foldedLapelFaces':len(lapel_faces),'rearHipVertices':rear_vertices,'underarmVertices':underarm_vertices,'hemWorldZ':hem_z,'heightUnit':height_unit,
    'skinReduction':{'vertices':len(discarded),'changed':sum(v > 0 for v in discarded),
                     'maxDiscardedFraction':max(discarded),'meanDiscardedFraction':sum(discarded)/len(discarded)},
    'blenderVersion':bpy.app.version_string,'candidateOnly':True}, indent=2) + '\n')
