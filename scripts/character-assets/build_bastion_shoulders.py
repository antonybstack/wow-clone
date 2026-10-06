"""Author Bastion's raised curved crest and overlapping lames on the native shoulder cap.

The existing Warden BMesh/Solidify builder owns source selection, rest-space
clearance and each race's upper-arm fit. This isolated Blender wrapper adds
original structural geometry, using the same full-weight upper-arm groups.
It never opens or replaces an interactive Blender scene.
https://docs.blender.org/api/current/bmesh.html#customdata-access
https://docs.blender.org/api/current/bmesh.ops.html#bmesh.ops.recalc_face_normals
https://docs.blender.org/manual/en/latest/addons/import_export/scene_gltf2.html
"""
import json
import os
from pathlib import Path

import bpy
import bmesh
from mathutils import Vector
from mathutils.bvhtree import BVHTree

BASE_BUILDER = Path('scripts/character-assets/build_warden_pauldrons.py')
# Its native main exports a transient cap to the caller's isolated output path.
# Reusing that path avoids a second deltoid selector or skin/export implementation.
namespace = {'__name__': '__bastion_cap__', '__file__': str(BASE_BUILDER)}
exec(compile(BASE_BUILDER.read_text(), str(BASE_BUILDER), 'exec'), namespace)
plate = bpy.data.objects.get('WardenPauldrons')
armature = next((o for o in bpy.data.objects if o.type == 'ARMATURE'), None)
if plate is None or armature is None:
    raise RuntimeError('Native shoulder cap did not produce its owned plate/rig')
plate.name = plate.data.name = 'BastionShoulders'
material = plate.data.materials[0]
material.name = 'Bastion tempered steel'
shader = next(n for n in material.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
shader.inputs['Base Color'].default_value = (0.20, 0.225, 0.265, 1.0)
shader.inputs['Metallic'].default_value = 0.92
shader.inputs['Roughness'].default_value = 0.44
scale = plate.matrix_world.to_scale()
if min(scale) <= 0 or max(scale) / min(scale) > 1.001:
    raise RuntimeError('Bastion requires the native uniform positive cap scale')
unit = 1 / scale.x
bm = bmesh.new()
bm.from_mesh(plate.data)
deform = bm.verts.layers.deform.verify()
bm.verts.index_update()
bm.edges.index_update()
bm.faces.index_update()
source_vertices = list(bm.verts)
report = []


parts = [plate]


def layer(source_faces, origin, axis, offset_m, slide_m, group):
    """Copy a stable native cap patch and use Blender's existing Solidify modifier.

    The modifier's indexed Mesh input avoids BMesh solidify's address-dependent
    boundary accumulation. This is the same supported modifier path as Warden.
    https://docs.blender.org/api/current/bpy.types.Mesh.html#bpy.types.Mesh.from_pydata
    https://docs.blender.org/manual/en/latest/modeling/modifiers/generate/solidify.html
    """
    faces_in = sorted(source_faces, key=lambda face: face.index)
    vertices = sorted({v for face in faces_in for v in face.verts}, key=lambda v: v.index)
    vertex_index = {v: i for i, v in enumerate(vertices)}
    coordinates = [tuple(v.co + (v.co - origin).normalized() * offset_m * unit + axis * slide_m * unit)
                   for v in vertices]
    faces = [tuple(vertex_index[v] for v in face.verts) for face in faces_in]
    data = bpy.data.meshes.new(f'BastionLayer{len(parts)}')
    data.from_pydata(coordinates, [], faces)
    data.update()
    obj = bpy.data.objects.new(data.name, data)
    bpy.context.scene.collection.objects.link(obj)
    obj.matrix_world = plate.matrix_world.copy()
    obj.data.materials.append(material)
    bpy.context.view_layer.objects.active = obj
    solidify = obj.modifiers.new('native_layer_thickness', 'SOLIDIFY')
    solidify.thickness = 0.012 * unit
    solidify.offset = -1.0
    bpy.ops.object.modifier_apply(modifier=solidify.name)
    bone = plate.vertex_groups[group].name
    weights = obj.vertex_groups.new(name=bone)
    weights.add([v.index for v in obj.data.vertices], 1.0, 'REPLACE')
    skin = obj.modifiers.new('accepted_skin', 'ARMATURE')
    skin.object = armature
    parts.append(obj)
    return {'sourceFaces': len(faces_in), 'closedLayerVertices': len(obj.data.vertices)}


source_faces = list(bm.faces)
bm.normal_update()
for side, bone_name in namespace['SIDES']:
    group = plate.vertex_groups[bone_name].index
    vertices = [v for v in source_vertices if v[deform].get(group, 0) > 0.999]
    if not vertices:
        raise RuntimeError(f'Missing native rigid cap for {side}')
    origin = plate.matrix_world.inverted() @ (armature.matrix_world @ armature.data.bones[bone_name].head_local)
    elbow = plate.matrix_world.inverted() @ (armature.matrix_world @ armature.data.bones[f'mixamorig:{side}ForeArm'].head_local)
    axis = (elbow - origin).normalized()
    outward = 1 if side == 'Left' else -1
    outer = [f for f in source_faces if
             all(v[deform].get(group, 0) > 0.999 for v in f.verts)
             and f.normal.dot(f.calc_center_median() - origin) > 0
             and (f.calc_center_median().x - origin.x) * outward > 0.015 * unit]
    if len(outer) < 6:
        raise RuntimeError(f'{side} has insufficient native outer cap surface')
    projections = [(f, (f.calc_center_median() - origin).dot(axis)) for f in outer]
    low, high = min(t for f, t in projections), max(t for f, t in projections)
    span = high - low
    details = []
    for label, fraction, width, offset, slide in [
        ('raised curved crest', 0.22, 0.16, 0.021, 0),
        ('overlapping curved lame 1', 0.55, 0.14, 0.013, 0.012),
        ('overlapping curved lame 2', 0.78, 0.13, 0.018, 0.020),
    ]:
        patch = [f for f, t in projections if abs(t - (low + span * fraction)) <= span * width]
        if not patch:
            raise RuntimeError(f'{side}: no native surface for {label}')
        details.append({'part': label, **layer(patch, origin, axis, offset, slide, group)})
    report.append({'side': side, 'bone': bone_name, 'parts': details,
                   'nativeAxis': list(axis), 'projectedCapSpanM': span / unit})

# Native BVH signed nearest-surface diagnostics, before the pieces are joined.
# Negative distances indicate interior overlap; they are retained for art review.
# https://docs.blender.org/api/current/mathutils.bvhtree.html
clearances = []
for i, part in enumerate(parts[1:], 1):
    for other in parts[:i]:
        tree = BVHTree.FromPolygons([tuple(v.co) for v in other.data.vertices],
                                   [tuple(p.vertices) for p in other.data.polygons])
        distances = []
        for v in part.data.vertices:
            hit, normal, face, distance = tree.find_nearest(v.co)
            if hit is not None:
                distances.append((v.co - hit).dot(normal) / unit)
        intersections = 0
        for a, b in [(part, other), (other, part)]:
            obstacle = BVHTree.FromPolygons([tuple(v.co) for v in b.data.vertices],
                                           [tuple(p.vertices) for p in b.data.polygons])
            for edge in a.data.edges:
                start, end = (a.data.vertices[index].co for index in edge.vertices)
                direction = end - start
                length = direction.length
                if length <= 0.0001 * unit:
                    continue
                hit, normal, face, distance = obstacle.ray_cast(start, direction.normalized(), length)
                if hit is not None and 0.0001 * unit < distance < length - 0.0001 * unit:
                    intersections += 1
        clearances.append({'part': part.name, 'against': other.name,
                           'crossingEdges': intersections,
                           'minimumNearestNormalM': min(distances),
                           'belowNearestNormalVertices': sum(d < -0.0005 for d in distances)})

# Integrate the closed layers into the shell with Blender's exact native union.
# The measured intersections above are operand overlaps, not overlapping final
# render surfaces. This keeps the raised silhouette while removing buried faces.
# https://docs.blender.org/manual/en/latest/modeling/modifiers/generate/booleans.html
bm.free()
bpy.ops.object.select_all(action='DESELECT')
plate.select_set(True)
bpy.context.view_layer.objects.active = plate
for obj in parts:
    # Exported normal/UV seams duplicate vertices. Weld only coincident points
    # in this isolated armor before the volume operation, never the body source.
    welded = bmesh.new()
    welded.from_mesh(obj.data)
    bmesh.ops.remove_doubles(welded, verts=list(welded.verts), dist=0.00001 * unit)
    bmesh.ops.recalc_face_normals(welded, faces=list(welded.faces))
    welded.to_mesh(obj.data)
    welded.free()
    for modifier in list(obj.modifiers):
        if modifier.type == 'ARMATURE':
            obj.modifiers.remove(modifier)
for part in parts[1:]:
    union = plate.modifiers.new('integrated_steel_layer', 'BOOLEAN')
    union.operation = 'UNION'
    union.solver = 'EXACT'
    union.use_self = True
    union.object = part
    bpy.ops.object.modifier_apply(modifier=union.name)
    bpy.data.objects.remove(part, do_unlink=True)
# Boolean-created vertices need explicit rigid weights. Use the same native
# shoulder heads as the cap builder; each disconnected arm shell takes that arm.
heads = [(name, plate.matrix_world.inverted() @ (armature.matrix_world @ armature.data.bones[name].head_local))
         for side, name in namespace['SIDES']]
plate.vertex_groups.clear()
groups = {name: plate.vertex_groups.new(name=name) for name, head in heads}
for vertex in plate.data.vertices:
    bone = min(heads, key=lambda row: (vertex.co - row[1]).length_squared)[0]
    groups[bone].add([vertex.index], 1.0, 'REPLACE')
skin = plate.modifiers.new('accepted_skin', 'ARMATURE')
skin.object = armature
plate.data.name = plate.name = 'BastionShoulders'
plate.data.update()
bpy.ops.object.select_all(action='DESELECT')
plate.select_set(True)
armature.select_set(True)
bpy.context.view_layer.objects.active = plate
out, blend = namespace['OUT'], namespace['BLEND']
bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(blend))
bpy.ops.export_scene.gltf(filepath=os.path.abspath(out), export_format='GLB',
                         use_selection=True, export_animations=False,
                         export_skins=True, export_morph=False, export_apply=False)
Path(out).with_suffix('.structure.json').write_text(json.dumps({
    'schema': 1, 'item': 'bastionShoulders', 'mesh': 'BastionShoulders',
    'source': namespace['SOURCE'], 'structure': report, 'operandClearances': clearances,
    'assembly': 'Blender EXACT Boolean UNION; operand intersections removed from final render surfaces',
    'rights': 'Original project-authored crests/lames on the existing source-derived native cap. Existing body/rig source grants remain unchanged.',
}, indent=2) + '\n')
print(f'Bastion: {len(plate.data.vertices)} vertices; closed raised crests and two lames per shoulder')
