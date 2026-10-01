"""Author rigid shoulder pauldrons on the supplied accepted source rig.

Run headless:
  /Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup \
    --python scripts/character-assets/build_warden_pauldrons.py

The default paths retain the M005 Human diagnostic. The M6 compiler supplies each
race's pinned accepted body and isolated output paths. The plate follows that body's deltoid surface, so it sits
where a pauldron sits without hand placement, then pushed out along its normals and
solidified into a shell.

The point of the prototype is its *weighting*. Every pauldron vertex is weighted 1.0 to a
single bone -- LeftArm or RightArm -- so the plate is carried rigidly by that bone. A
garment's smooth weights are what let cloth bend across a joint; a single full-weight bone
is what stops a plate doing the same. That is checked exactly, not by eye, in
`measure-plate-rigidity.mjs`.

`--factory-startup` plus an explicit empty homefile keeps this out of any live Blender
session. Blender Z-up to glTF Y-up conversion is left to the exporter.
https://docs.blender.org/manual/en/latest/modeling/modifiers/generate/solidify.html
"""
import os
import sys

import bpy
import bmesh
from mathutils import Vector

SOURCE = os.environ.get('ASHEN_PLATE_SOURCE', '.cache/character-mmo/m004/human-shape-family-v1.glb')
OUT = os.environ.get('ASHEN_PLATE_OUT', '.cache/character-mmo/m005/warden-pauldrons.glb')
BLEND = os.environ.get('ASHEN_PLATE_BLEND', 'blender/characters/warden-pauldrons-v1.blend')
BODY_MESH = os.environ.get('ASHEN_PLATE_BODY_MESH', 'HumanV1Body')
MESH_NAME = 'WardenPauldrons'
SIDES = (('Left', 'mixamorig:LeftArm'), ('Right', 'mixamorig:RightArm'))
STANDOFF_M = 0.032      # metres the shell floats off the skin
THICKNESS_M = 0.010     # metres of plate


def fail(message):
    print(f'FAIL: {message}', file=sys.stderr)
    sys.exit(1)


def main():
    bpy.ops.wm.read_homefile(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=os.path.abspath(SOURCE))

    body = next((o for o in bpy.data.objects if o.type == 'MESH' and o.name.startswith(BODY_MESH)), None)
    armature = next((o for o in bpy.data.objects if o.type == 'ARMATURE'), None)
    if body is None or armature is None:
        fail('imported file has no body mesh or no armature')

    bpy.context.view_layer.update()
    # Orc's accepted body is split for coverage. Join its actual skin regions in
    # this isolated source process before selecting the deltoid, never its eyes/hair.
    regions = [o for o in bpy.data.objects if o.type == 'MESH' and o.name in ('BodyExposed', 'BodyUnderTunic')] if BODY_MESH == 'BodyExposed' else [body]
    if len(regions) > 1:
        bpy.ops.object.select_all(action='DESELECT')
        for region in regions:
            region.select_set(True)
        bpy.context.view_layer.objects.active = body
        bpy.ops.object.join()
        bpy.context.view_layer.update()

    # Shape keys would ride along into the duplicate and confuse the export; the plate gets
    # its own targets later, from the same tracked field the garments use.
    if body.data.shape_keys:
        body.shape_key_clear()

    # The mesh transform is the ruler. Measuring a non-Human cap against Human
    # stature would change plate thickness/clearance with the race's silhouette.
    # https://docs.blender.org/api/current/bpy.types.Object.html#bpy.types.Object.matrix_world
    scale = body.matrix_world.to_scale()
    if min(scale) <= 0 or max(scale) / min(scale) > 1.001:
        fail(f'plate authoring requires a uniform positive mesh scale, got {scale}')
    unit = 1 / scale.x
    standoff = STANDOFF_M * unit
    thickness = THICKNESS_M * unit
    # Cap width follows this actual shoulder bone, not another race's body bounds.
    arm = armature.data.bones['mixamorig:LeftArm']
    forearm = armature.data.bones['mixamorig:LeftForeArm']
    # glTF has joints, not bone-tail lengths; Blender may invent a long tail.
    arm_length_m = (armature.matrix_world @ forearm.head_local - armature.matrix_world @ arm.head_local).length
    cap_radius = max(0.115, min(0.20, arm_length_m * 0.46)) * unit
    print(f'{BODY_MESH}: {unit:.2f} local units/m; cap radius {cap_radius / unit:.4f}m')

    pieces = []
    for side, bone_name in SIDES:
        bone = armature.data.bones.get(bone_name)
        if bone is None:
            fail(f'armature has no bone {bone_name}')
        # Bone head in the mesh's own space.
        origin = armature.matrix_world @ bone.head_local
        origin = body.matrix_world.inverted() @ origin

        piece = body.copy()
        piece.data = body.data.copy()
        piece.name = f'{MESH_NAME}_{side}'
        bpy.context.scene.collection.objects.link(piece)

        # Author in the verified rest surface. Applying modifiers below an
        # inherited Armature would otherwise bake its current imported action.
        for modifier in list(piece.modifiers):
            if modifier.type == 'ARMATURE':
                piece.modifiers.remove(modifier)
        bm = bmesh.new()
        bm.from_mesh(piece.data)
        bm.verts.ensure_lookup_table()
        # Keep the cap of the deltoid: near the shoulder joint and on the outboard, upper
        # side of it. Anything else is torso or upper arm, not where a pauldron sits.
        outward = 1.0 if side == 'Left' else -1.0
        doomed = []
        for vert in bm.verts:
            offset = vert.co - origin
            if offset.length > cap_radius:
                doomed.append(vert)
                continue
            if offset.z < -0.02 * unit:
                doomed.append(vert)
                continue
            if offset.x * outward < -0.03 * unit:
                doomed.append(vert)
        bmesh.ops.delete(bm, geom=doomed, context='VERTS')
        if len(bm.verts) < 40:
            fail(f'{side} cap selected only {len(bm.verts)} vertices')
        if BODY_MESH != 'HumanV1Body':
            # The sculpt skin's grooves are anatomy, not plate construction. Native
            # convex hull retains its outer deltoid envelope without copying bony
            # ridges or disconnected islands. Remove the inner closing planes.
            # https://docs.blender.org/api/current/bmesh.ops.html#bmesh.ops.convex_hull
            points = list(bm.verts)
            bmesh.ops.delete(bm, geom=list(bm.faces), context='FACES_ONLY')
            hull = bmesh.ops.convex_hull(bm, input=points, use_existing_faces=False)
            unused = set(hull['geom_unused']) | set(hull['geom_interior'])
            bmesh.ops.delete(bm, geom=[v for v in unused if isinstance(v, bmesh.types.BMVert)], context='VERTS')
            bm.normal_update()
            inward = [f for f in bm.faces if f.normal.dot(f.calc_center_median() - origin) <= 0]
            bmesh.ops.delete(bm, geom=inward, context='FACES_ONLY')
            if len(bm.faces) < 10:
                fail(f'{side} convex deltoid envelope has only {len(bm.faces)} outer faces')
        # Float the shell off the skin along the surface normal, then give it thickness.
        bm.normal_update()
        for vert in bm.verts:
            vert.co += vert.normal * standoff
        bm.to_mesh(piece.data)
        bm.free()

        solidify = piece.modifiers.new('plate', 'SOLIDIFY')
        solidify.thickness = thickness
        solidify.offset = 1.0
        smooth = piece.modifiers.new('smooth', 'SMOOTH')
        # Smoothing pulls the shell inward, and at an 18 mm standoff two passes pulled it
        # far enough that the shoulder showed through the plate in the review render. One
        # gentler pass over a 32 mm standoff keeps the clearance.
        smooth.factor = 0.3
        smooth.iterations = 1
        bpy.context.view_layer.objects.active = piece
        for modifier in ('plate', 'smooth'):
            bpy.ops.object.modifier_apply(modifier=modifier)

        for poly in piece.data.polygons:
            poly.use_smooth = True

        # Rigid weighting: clear every inherited group, then one bone at full weight.
        piece.vertex_groups.clear()
        group = piece.vertex_groups.new(name=bone_name)
        group.add([v.index for v in piece.data.vertices], 1.0, 'REPLACE')
        skin = piece.modifiers.new('accepted_skin', 'ARMATURE')
        skin.object = armature
        pieces.append(piece)
        print(f'{side}: {len(piece.data.vertices)} vertices rigid on {bone_name}')

    # Join into one mesh so the pack ships a single part, and keep the armature parent.
    bpy.ops.object.select_all(action='DESELECT')
    for piece in pieces:
        piece.select_set(True)
    bpy.context.view_layer.objects.active = pieces[0]
    bpy.ops.object.join()
    plate = bpy.context.view_layer.objects.active
    plate.name = MESH_NAME
    plate.data.name = MESH_NAME

    material = bpy.data.materials.new(MESH_NAME)
    material.use_nodes = True
    principled = next(n for n in material.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    principled.inputs['Base Color'].default_value = (0.32, 0.33, 0.36, 1.0)
    principled.inputs['Metallic'].default_value = 0.9
    principled.inputs['Roughness'].default_value = 0.38
    plate.data.materials.clear()
    plate.data.materials.append(material)

    # Export the plate with the armature only; the body stays behind.
    bpy.data.objects.remove(body, do_unlink=True)
    bpy.ops.object.select_all(action='DESELECT')
    plate.select_set(True)
    armature.select_set(True)
    bpy.context.view_layer.objects.active = plate

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    os.makedirs(os.path.dirname(BLEND), exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(BLEND))
    bpy.ops.export_scene.gltf(
        filepath=os.path.abspath(OUT),
        export_format='GLB',
        use_selection=True,
        export_animations=False,
        export_skins=True,
        export_morph=False,
        export_apply=False,
    )
    print(f'wrote {OUT} and {BLEND}: {len(plate.data.vertices)} vertices, '
          f'{len(plate.data.polygons)} faces')


main()
