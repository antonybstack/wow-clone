"""Body-compatible soft underarm panels shared by the offline garment factories.

Native BMesh keeps source UV/deform data. This creates real fabric and retains
source skin weights, rather than hiding an entire body or rigidly bridging a joint.
https://docs.blender.org/api/current/bmesh.ops.html#bmesh.ops.delete
https://docs.blender.org/api/current/bpy.types.VertexGroup.html
"""
import bpy
import bmesh


def author_underarm_panels(arm, regions, unit, material_name, base_color):
    shoulders = [arm.matrix_world @ arm.data.bones['mixamorig:' + side + 'Arm'].head_local
                 for side in ['Left', 'Right']]
    material = bpy.data.materials.new(material_name)
    material.use_nodes = True
    bsdf = material.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = base_color
    bsdf.inputs['Roughness'].default_value = .95
    parts = []
    for region in regions:
        piece = region.copy()
        piece.data = region.data.copy()
        bpy.context.collection.objects.link(piece)
        if piece.data.shape_keys:
            piece.shape_key_clear()
        for modifier in list(piece.modifiers):
            if modifier.type == 'ARMATURE':
                piece.modifiers.remove(modifier)
        frame = piece.matrix_world.copy()
        bm = bmesh.new()
        bm.from_mesh(piece.data)
        def underarm(v):
            p = frame @ v.co
            return any(abs(p.x - s.x) < .135 * unit and abs(p.y - s.y) < .15 * unit
                       and s.z - .16 * unit < p.z < s.z + .025 * unit for s in shoulders)
        bmesh.ops.delete(bm, geom=[v for v in bm.verts if not underarm(v)], context='VERTS')
        if not bm.faces:
            bm.free()
            bpy.data.objects.remove(piece, do_unlink=True)
            continue
        bm.normal_update()
        for v in bm.verts:
            v.co += v.normal * (.014 * unit / frame.to_scale().x)
        bm.to_mesh(piece.data)
        bm.free()
        piece.data.materials.clear()
        piece.data.materials.append(material)
        for face in piece.data.polygons:
            face.material_index = 0
            face.use_smooth = True
        piece.parent = arm
        piece.matrix_world = frame
        modifier = piece.modifiers.new('body-compatible fabric skin', 'ARMATURE')
        modifier.object = arm
        parts.append(piece)
    if not parts:
        raise ValueError('No source underarm surfaces')
    return parts
