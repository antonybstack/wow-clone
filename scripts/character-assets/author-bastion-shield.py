"""Original rigid shield, authored in an isolated pinned Blender process.

The grip center is the origin. Blender +Z is up and -Y faces outward; the native
exporter owns conversion to glTF +Y up/+Z front. No rig, animation or texture is
needed for an object carried by the game's evaluated hand sockets.
https://docs.blender.org/manual/en/latest/addons/import_export/scene_gltf2.html
https://docs.blender.org/api/current/bmesh.ops.html#bmesh.ops.recalc_face_normals
"""
import json
import os

import bpy
import bmesh
from mathutils import Vector


def main():
    descriptor = json.loads(os.environ['ASHEN_PROP_DESCRIPTOR'])
    out = os.environ['ASHEN_PROP_OUT']
    blend = os.environ['ASHEN_PROP_BLEND']
    bpy.ops.wm.read_homefile(use_empty=True)
    materials = {}
    for policy in descriptor['materials']:
        material = bpy.data.materials.new(policy['name'])
        material.use_nodes = True
        material.use_backface_culling = True
        node = material.node_tree.nodes.get('Principled BSDF')
        node.inputs['Base Color'].default_value = policy['baseColor']
        node.inputs['Metallic'].default_value = policy['metallic']
        node.inputs['Roughness'].default_value = policy['roughness']
        materials[policy['name']] = material
    paint, steel, leather = [materials[p['name']] for p in descriptor['materials']]
    pieces = []

    def mesh(name, points, faces, material, bevel=0):
        data = bpy.data.meshes.new(name)
        data.from_pydata(points, [], faces)
        data.update()
        bm = bmesh.new()
        bm.from_mesh(data)
        bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
        bm.to_mesh(data)
        bm.free()
        obj = bpy.data.objects.new(name, data)
        bpy.context.collection.objects.link(obj)
        obj.data.materials.append(material)
        bpy.context.view_layer.objects.active = obj
        obj.select_set(True)
        if bevel:
            modifier = obj.modifiers.new('Small authored edge', 'BEVEL')
            modifier.width = bevel
            modifier.segments = 1
            modifier.affect = 'EDGES'
            bpy.ops.object.modifier_apply(modifier=modifier.name)
        obj.select_set(False)
        pieces.append(obj)
        return obj

    # The perimeter is deliberately a heater, with a broad shallow crown and
    # tapered lower quarters. Front/back fan centers give the board real convexity.
    outline = [(-.26, .31), (-.245, .365), (0, .39), (.245, .365), (.26, .31),
               (.255, .045), (.18, -.19), (.085, -.32), (0, -.395),
               (-.085, -.32), (-.18, -.19), (-.255, .045)]
    count = len(outline)
    front = [(x, -.079, y) for x, y in outline]
    back = [(x, -.055, y) for x, y in outline]
    points = front + back + [(0, -.123, .04), (0, -.099, .04)]
    faces = []
    for i in range(count):
        j = (i + 1) % count
        faces.extend([(2*count, i, j), (2*count+1, count+j, count+i),
                      (i, count+i, count+j, j)])
    mesh('Convex painted board', points, faces, paint)

    # Four perimeter loops form a closed metal binding, including its visible
    # rear lip. It costs one material group alongside rivets and the crest.
    loops = []
    for scale, depth in [(1.015, .083), (.93, .087), (.93, .049), (1.015, .049)]:
        loops.extend((x*scale, -depth, y*scale) for x, y in outline)
    faces = []
    for ring in range(4):
        next_ring = (ring+1) % 4
        for i in range(count):
            j = (i+1) % count
            faces.append((ring*count+i, ring*count+j, next_ring*count+j, next_ring*count+i))
    mesh('Bound steel rim', loops, faces, steel, .002)

    def panel(name, polygon, front_depth, thickness, material, bevel=.001):
        n = len(polygon)
        points = [(x, -front_depth, y) for x, y in polygon]
        points += [(x, -(front_depth-thickness), y) for x, y in polygon]
        faces = [tuple(range(n)), tuple(reversed(range(n, 2*n)))]
        faces += [(i, (i+1)%n, (i+1)%n+n, i+n) for i in range(n)]
        return mesh(name, points, faces, material, bevel)

    # A raised split-arrow crest, original rather than a borrowed heraldic mark.
    panel('Bastion center crest', [(-.034, -.24), (-.034, .12), (-.075, .18),
          (0, .30), (.075, .18), (.034, .12), (.034, -.24), (0, -.29)], .133, .014, steel)
    for sign in [-1, 1]:
        polygon = [(sign*.065, .095), (sign*.15, .16), (sign*.19, .115),
                   (sign*.094, .015), (sign*.065, .015)]
        panel('Crest wing', polygon, .130, .015, steel)

    # Rivets remain closed native icospheres, not alpha decals or new textures.
    for x, y in outline:
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=.010,
            location=(x*.97, -.094, y*.97))
        obj = bpy.context.object
        obj.name = 'Binding rivet'
        obj.scale = (1, .55, 1)
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        obj.data.materials.append(steel)
        obj.select_set(False)
        pieces.append(obj)

    def bar(name, a, b, radius, material, vertices=8):
        a, b = Vector(a), Vector(b)
        bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius,
            depth=(b-a).length, location=(a+b)*.5)
        obj = bpy.context.object
        obj.name = name
        obj.rotation_mode = 'QUATERNION'
        obj.rotation_quaternion = (b-a).to_track_quat('Z', 'Y')
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
        obj.data.materials.append(material)
        obj.select_set(False)
        pieces.append(obj)

    # Horizontal grip center exactly at (0,0,0), with rear stand-offs. Its axis
    # matches the existing grimoire handle so the first fit can reuse that hold.
    for x in [-.095, .095]:
        bar('Grip stand-off', (x, 0, 0), (x, -.092, 0), .014, steel)
    bar('Leather carrying grip', (-.095, 0, 0), (.095, 0, 0), .018, leather)
    for x in [-.085, -.06, -.035, -.01, .015, .04, .065, .085]:
        bar('Grip wrap', (x-.003, 0, 0), (x+.003, 0, 0), .020, leather)
    for y in [-.21, .23]:
        panel('Rear leather brace', [(-.17, y-.018), (.17, y-.018),
              (.17, y+.018), (-.17, y+.018)], .036, .010, leather)

    # Bake/merge through native operators; one identity mesh, three materials.
    # This is an offline artifact. Gameplay does not rebuild these pieces.
    bpy.ops.object.select_all(action='DESELECT')
    for obj in pieces:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = pieces[0]
    bpy.ops.object.join()
    shield = bpy.context.object
    shield.name = descriptor['mesh']
    shield.data.name = descriptor['mesh']
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    bpy.context.scene.unit_settings.system = 'METRIC'
    os.makedirs(os.path.dirname(out), exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(blend))
    bpy.ops.export_scene.gltf(filepath=os.path.abspath(out), export_format='GLB',
        use_selection=True, export_animations=False, export_skins=False,
        export_morph=False, export_apply=False, export_yup=True,
        export_texcoords=False)


if __name__ == '__main__':
    main()
