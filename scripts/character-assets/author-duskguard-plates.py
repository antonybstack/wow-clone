"""Author articulated plate on each accepted body's actual rest surface.

Use native BMesh convex envelopes and Solidify, as the accepted shoulder pilot
does. Each separated plate retains one bone at weight 1; cloth remains a separate
primitive when the offline compiler assembles its underlayers.
https://docs.blender.org/api/current/bmesh.ops.html#bmesh.ops.convex_hull
https://docs.blender.org/manual/en/latest/modeling/modifiers/generate/solidify.html
"""
import bpy
import bmesh
import json
import sys
from pathlib import Path
from mathutils import Vector, Matrix

args = sys.argv[sys.argv.index('--') + 1:]
source, body_name, directory = Path(args[0]), args[1], Path(args[2])
greave_boot = Path(args[3]) if len(args) > 3 else None
if not directory.resolve().is_relative_to(Path('.cache').resolve()):
    raise ValueError('Only isolated armor output is allowed')
directory.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.read_homefile(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(source.resolve()))
arm = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
arm.animation_data_clear()
arm.data.pose_position = 'REST'
body = next(o for o in bpy.data.objects if o.type == 'MESH' and o.name == body_name)
regions = [o for o in bpy.data.objects if o.type == 'MESH' and
           (o.name.startswith('Body') if body_name == 'BodyExposed' else o is body)]
points = [o.matrix_world @ v.co for o in regions for v in o.data.vertices]
boot_points = None
if greave_boot:
    # A fitted Orc calf sits behind its rest joint. A joint-centred front cutoff
    # selected only a thin sliver and did not account for the boot's thickness.
    # Reuse the authored leather surface for this rigid envelope, with native
    # world matrices; keep the accepted body's armature as the sole skin owner.
    # https://docs.blender.org/api/current/bpy.types.Object.html#bpy.types.Object.matrix_world
    existing = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(greave_boot.resolve()))
    imported = set(bpy.data.objects) - existing
    boots = [o for o in imported if o.type == 'MESH' and o.name.startswith('WayfarerBoots')]
    if len(boots) != 1:
        raise ValueError('Expected one authored boot underlayer')
    boot_points = [boots[0].matrix_world @ v.co for v in boots[0].data.vertices]
    for ob in imported:
        bpy.data.objects.remove(ob, do_unlink=True)

def bone(name):
    return arm.matrix_world @ arm.data.bones['mixamorig:' + name].head_local

hips, spine, spine1, spine2, neck = [bone(n) for n in ['Hips', 'Spine', 'Spine1', 'Spine2', 'Neck']]
unit = (neck.z - bone('LeftFoot').z) / 1.33
width = min(abs(bone(side + 'Arm').x - hips.x) for side in ['Left', 'Right']) * .87
metal = bpy.data.materials.new('Duskguard blackened steel')
metal.use_nodes = True
bsdf = metal.node_tree.nodes.get('Principled BSDF')
bsdf.inputs['Base Color'].default_value = (.19, .21, .245, 1)
bsdf.inputs['Metallic'].default_value = .90
bsdf.inputs['Roughness'].default_value = .42
trim = bpy.data.materials.new('Duskguard hammered brass rim')
trim.use_nodes = True
bsdf = trim.node_tree.nodes.get('Principled BSDF')
bsdf.inputs['Base Color'].default_value = (.36, .27, .105, 1)
bsdf.inputs['Metallic'].default_value = .8
bsdf.inputs['Roughness'].default_value = .42
rows = []
items = {'DuskguardCuirass': [], 'DuskguardTassets': [], 'DuskguardGreaves': [], 'DuskguardVambraces': []}

# The inherited loose tunic reveals skin at the stout rear armpit during a cast.
# Author actual underarm gussets from the same body surface/skin, with fabric
# clearance, instead of hiding the entire unified Human body or enlarging armor
# across the moving joint. These are soft panels, not rigid breastplate pieces.
sys.path.insert(0, str(Path(__file__).resolve().parent))
from native_cloth_panels import author_underarm_panels
gusset_parts = author_underarm_panels(arm, regions, unit, 'Duskguard underarm wool', (.07, .055, .04, 1))
bpy.ops.object.select_all(action='DESELECT')
for piece in gusset_parts:
    piece.select_set(True)
bpy.context.view_layer.objects.active = gusset_parts[0]
bpy.ops.object.join()
gussets = bpy.context.view_layer.objects.active
gussets.name = 'DuskguardGussets'
gussets.data.name = 'DuskguardGussets'
arm.select_set(True)
bpy.context.view_layer.objects.active = arm
bpy.ops.export_scene.gltf(filepath=str((directory / 'DuskguardGussets.glb').resolve()),
    use_selection=True, export_format='GLB', export_animations=False, export_skins=True,
    export_all_influences=False, export_cameras=False, export_lights=False)
rows.append({'name':'UnderarmGussets','itemMesh':'DuskguardGussets','deformation':'soft-skin',
             'vertices':len(gussets.data.vertices),'standoffM':.014 * unit})

def plate(name, group, joint, selected, remove_caps=None, standoff=.035, clips=()):
    if len(selected) < 12:
        raise ValueError(f'{name}: only {len(selected)} source points')
    bm = bmesh.new()
    verts = [bm.verts.new(p) for p in selected]
    hull = bmesh.ops.convex_hull(bm, input=verts, use_existing_faces=False)
    unused = set(hull['geom_unused']) | set(hull['geom_interior'])
    bmesh.ops.delete(bm, geom=[v for v in unused if isinstance(v, bmesh.types.BMVert)], context='VERTS')
    bm.normal_update()
    if remove_caps:
        bmesh.ops.delete(bm, geom=[f for f in bm.faces if remove_caps(f)], context='FACES_ONLY')
    # Cut clean joint boundaries through the actual envelope rather than leaving
    # whichever source vertices happen to end inside a height-selection band.
    for origin, normal, below in clips:
        bmesh.ops.bisect_plane(bm, geom=list(bm.verts) + list(bm.edges) + list(bm.faces),
                              dist=1e-6, plane_co=origin, plane_no=normal,
                              clear_inner=below, clear_outer=not below)
    if len(bm.faces) < 6:
        raise ValueError(f'{name}: envelope has only {len(bm.faces)} faces')
    bm.normal_update()
    for v in bm.verts:
        v.co += v.normal * standoff * unit
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    mesh.materials.append(metal)
    mesh.materials.append(trim)
    ob = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(ob)
    ob.parent = arm
    ob.matrix_world = Matrix.Identity(4)
    bpy.context.view_layer.objects.active = ob
    # Native Solidify produces a separate rim material without a handmade normal
    # or index extrusion implementation. Armor stays rigid through all source clips.
    solid = ob.modifiers.new('plate wall and rim', 'SOLIDIFY')
    solid.thickness = .009 * unit
    solid.offset = 1
    solid.material_offset = 0
    solid.material_offset_rim = 1
    bpy.ops.object.modifier_apply(modifier=solid.name)
    mesh = ob.data
    for f in mesh.polygons:
        f.use_smooth = True
    ob.vertex_groups.new(name='mixamorig:' + joint).add(list(range(len(mesh.vertices))), 1, 'REPLACE')
    modifier = ob.modifiers.new('accepted rigid skin', 'ARMATURE')
    modifier.object = arm
    items[group].append(ob)
    rows.append({'name':name,'itemMesh':group,'bone':joint,'sourcePoints':len(selected),
                 'vertices':len(mesh.vertices),'faces':len(mesh.polygons),'standoffM':standoff * unit})

# Four overlapping torso segments articulate with the actual spine. A single
# skin-stretching breastplate across the hip would violate the rigid contract.
bands = [('Breastplate', 'Spine2', spine2.z - .075 * unit, neck.z - .05 * unit),
         ('UpperFauld', 'Spine1', spine1.z - .07 * unit, spine2.z - .045 * unit),
         ('LowerFauld', 'Spine', spine.z - .035 * unit, spine1.z - .035 * unit),
         ('WaistPlate', 'Hips', hips.z - .055 * unit, spine.z - .005 * unit)]
for name, joint, lo, hi in bands:
    selected = [p for p in points if lo - .04 * unit <= p.z <= hi + .04 * unit and abs(p.x - hips.x) < width]
    plate(name, 'DuskguardCuirass', joint, selected,
          remove_caps=lambda f:abs(f.normal.z) > .75,
          clips=[(Vector((0, 0, lo)), Vector((0, 0, 1)), True),
                 (Vector((0, 0, hi)), Vector((0, 0, 1)), False)])

for side in ['Left', 'Right']:
    # Tassets use the outer/front upper thigh; the rear remains flexible cloth.
    top, knee, ankle = bone(side + 'UpLeg'), bone(side + 'Leg'), bone(side + 'Foot')
    thigh_axis = (knee - top).normalized()
    def limb_points(a, b, start, end, radius, front_only=False):
        axis = (b - a).normalized()
        length = (b - a).length
        output = []
        for p in points:
            offset = p - a
            t = offset.dot(axis) / length
            radial = offset - axis * offset.dot(axis)
            if start <= t <= end and radial.length < radius * unit and (not front_only or p.y < a.y + .025 * unit):
                output.append(p)
        return output, axis
    selected, axis = limb_points(top, knee, .18, .67, .14, True)
    plate(side + 'Tasset', 'DuskguardTassets', side + 'UpLeg', selected,
          remove_caps=lambda f:f.normal.y > .45 or abs(f.normal.dot(axis)) > .78, standoff=.032)
    if boot_points is None:
        selected, axis = limb_points(knee, ankle, .18, .84, .105, True)
        plate(side + 'Greave', 'DuskguardGreaves', side + 'Leg', selected,
              remove_caps=lambda f:f.normal.y > .45 or abs(f.normal.dot(axis)) > .78, standoff=.030)
    else:
        # Match the complete boot shaft instead of guessing a radius around a
        # differently placed joint. Front is Blender -Y / glTF +Z. Cross-section
        # centers follow the actual leather and cannot pick the opposite leg.
        sign = 1 if side == 'Left' else -1
        shaft = [p for p in boot_points if p.x * sign > 0 and .19 <= p.z <= .44]
        selected = []
        for p in shaft:
            ring = [q.y for q in shaft if abs(q.z - p.z) <= .025]
            center = (min(ring) + max(ring)) / 2
            if p.y <= center + .015:
                selected.append(p)
        plate(side + 'Greave', 'DuskguardGreaves', side + 'Leg', selected,
              remove_caps=lambda f:f.normal.y > .45 or abs(f.normal.z) > .78,
              standoff=.012,
              clips=[(Vector((0, 0, .195)), Vector((0, 0, 1)), True),
                     (Vector((0, 0, .435)), Vector((0, 0, 1)), False)])
    forearm, hand = bone(side + 'ForeArm'), bone(side + 'Hand')
    selected, axis = limb_points(forearm, hand, .20, .85, .105)
    plate(side + 'Vambrace', 'DuskguardVambraces', side + 'ForeArm', selected,
          remove_caps=lambda f:abs(f.normal.dot(axis)) > .78, standoff=.035)

for mesh_name, parts in items.items():
    bpy.ops.object.select_all(action='DESELECT')
    for part in parts:
        part.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    ob = bpy.context.view_layer.objects.active
    ob.name = mesh_name
    ob.data.name = mesh_name
    # Export all armature joints, not a plate-specific truncated palette.
    arm.select_set(True)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.export_scene.gltf(filepath=str((directory / (mesh_name + '.glb')).resolve()),
        use_selection=True, export_format='GLB', export_animations=False,
        export_skins=True, export_all_influences=False, export_cameras=False, export_lights=False)
bpy.ops.wm.save_as_mainfile(filepath=str((directory / 'duskguard-plates.blend').resolve()))
(directory / 'native-report.json').write_text(json.dumps({'source':str(source),'bodyMesh':body_name,
    'greaveBootEnvelope':str(greave_boot) if greave_boot else None,
    'heightUnit':unit,'halfTorsoWidth':width,'pieces':rows,'blenderVersion':bpy.app.version_string,
    'candidateOnly':True}, indent=2) + '\n')
