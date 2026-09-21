"""Import the Tripo Mixamo FBX, put it in T-pose, scale to game height, export rest.

Isolated Blender 5.2.1, not MCP 9876:

    /Applications/Blender.app/Contents/MacOS/Blender --background \\
        --python scripts/character-assets/undead_from_tripo.py

Reads blender/characters/sources/undead-tripo/undead-tripo.fbx
Writes .cache/source-motion/undead-source-rest.glb
       .cache/source-motion/undead-source-joints.json
"""
from __future__ import annotations

import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Matrix, Vector

ROOT = Path(__file__).resolve().parents[2]
FBX = ROOT / 'blender/characters/sources/undead-tripo/undead-tripo.fbx'
TEX = ROOT / 'blender/characters/sources/undead-tripo/textures'
CACHE = ROOT / '.cache/source-motion'
REST = CACHE / 'undead-source-rest.glb'
JOINTS_OUT = CACHE / 'undead-source-joints.json'
PREVIEW = ROOT / 'blender/characters/sources/undead-tripo/preview-rest.png'
TARGET_HEIGHT = 1.85
MESH_NAME = 'UndeadV1Body'


def log(msg):
    print(f'[undead-tripo] {msg}', flush=True)


def clear_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def import_fbx():
    if not FBX.exists():
        raise FileNotFoundError(FBX)
    bpy.ops.import_scene.fbx(
        filepath=str(FBX),
        automatic_bone_orientation=False,
        use_anim=False,
        ignore_leaf_bones=False,
        use_image_search=False,
    )
    arm = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
    mesh = next(o for o in bpy.data.objects if o.type == 'MESH')
    log(f'imported armature scale={list(arm.scale)} bones={len(arm.data.bones)}')
    log(f'imported mesh verts={len(mesh.data.vertices)} polys={len(mesh.data.polygons)}')
    return arm, mesh


def apply_object_scale(ob):
    bpy.ops.object.select_all(action='DESELECT')
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)


def bone_world_dir(arm, name):
    b = arm.data.bones[name]
    head = arm.matrix_world @ b.head_local
    tail = arm.matrix_world @ b.tail_local
    d = (tail - head)
    if d.length < 1e-8:
        return Vector((1, 0, 0))
    return d.normalized()


def tpose_arms(arm):
    """Mixamo clips assume T-pose rest. Tripo shipped A-pose (hands down)."""
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode='POSE')
    # Empirically: local X +60 / -60 lifts this A-pose onto Mixamo T-pose
    # without the long-way rotation_difference that turned one arm into a wing.
    for name, deg in (('mixamorig:LeftArm', 60), ('mixamorig:RightArm', -60)):
        pb = arm.pose.bones[name]
        pb.rotation_mode = 'XYZ'
        pb.rotation_euler = (math.radians(deg), 0, 0)
        log(f'  tpose {name} euler X={deg}')
    bpy.context.view_layer.update()
    bpy.ops.object.mode_set(mode='OBJECT')
    mesh = next(o for o in bpy.data.objects if o.type == 'MESH')
    deps = bpy.context.evaluated_depsgraph_get()
    ev = mesh.evaluated_get(deps)
    src = ev.to_mesh()
    inv = mesh.matrix_world.inverted()
    for i, v in enumerate(mesh.data.vertices):
        v.co = inv @ ev.matrix_world @ src.vertices[i].co
    ev.to_mesh_clear()
    mesh.data.update()
    for mod in list(mesh.modifiers):
        if mod.type == 'ARMATURE':
            mesh.modifiers.remove(mod)
    bpy.ops.object.select_all(action='DESELECT')
    arm.select_set(True)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode='POSE')
    bpy.ops.pose.select_all(action='SELECT')
    bpy.ops.pose.armature_apply(selected=False)
    bpy.ops.object.mode_set(mode='OBJECT')
    mod = mesh.modifiers.new('Armature', 'ARMATURE')
    mod.object = arm
    mesh.parent = arm
    left = bone_world_dir(arm, 'mixamorig:LeftArm')
    right = bone_world_dir(arm, 'mixamorig:RightArm')
    log(f'  after apply LeftArm={tuple(round(c, 3) for c in left)} RightArm={tuple(round(c, 3) for c in right)}')


def world_height(mesh):
    coords = [mesh.matrix_world @ v.co for v in mesh.data.vertices]
    zs = [c.z for c in coords]
    return max(zs) - min(zs)


def scale_to_height(arm, mesh, target):
    h = world_height(mesh)
    if h < 0.05:
        raise RuntimeError(f'mesh height {h} m looks like units are wrong')
    s = target / h
    log(f'scale {h:.3f} m -> {target:.3f} m  (x{s:.3f})')
    arm.scale *= s
    bpy.context.view_layer.update()
    apply_object_scale(arm)
    bpy.context.view_layer.update()
    log(f'  height now {world_height(mesh):.3f} m')


def assign_maps(mesh):
    mat = bpy.data.materials.new('UndeadV1Body')
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    bsdf.inputs['Metallic'].default_value = 0.05
    bsdf.inputs['Roughness'].default_value = 0.82

    def tex(path, noncolor=False):
        if not path.exists():
            return None
        img = bpy.data.images.load(str(path))
        n = nt.nodes.new('ShaderNodeTexImage')
        n.image = img
        if noncolor:
            img.colorspace_settings.name = 'Non-Color'
        return n

    # Pages caps a file at 25 MB; the raw 2k PNGs packed a 40 MB rest GLB.
    for img in bpy.data.images:
        pass
    col = tex(TEX / 'basecolor.png')
    if col and col.image:
        col.image.scale(1024, 1024)
    nrm = tex(TEX / 'normal.png', noncolor=True)
    if nrm and nrm.image:
        nrm.image.scale(1024, 1024)
    rough = tex(TEX / 'roughness.png', noncolor=True)
    if rough and rough.image:
        rough.image.scale(1024, 1024)
    metal = tex(TEX / 'metallic.png', noncolor=True)
    if metal and metal.image:
        metal.image.scale(1024, 1024)
    if col:
        nt.links.new(col.outputs['Color'], bsdf.inputs['Base Color'])
    if nrm:
        nmap = nt.nodes.new('ShaderNodeNormalMap')
        nt.links.new(nrm.outputs['Color'], nmap.inputs['Color'])
        nt.links.new(nmap.outputs['Normal'], bsdf.inputs['Normal'])
    if rough:
        nt.links.new(rough.outputs['Color'], bsdf.inputs['Roughness'])
    if metal:
        nt.links.new(metal.outputs['Color'], bsdf.inputs['Metallic'])
    mesh.data.materials.clear()
    mesh.data.materials.append(mat)
    mesh.name = MESH_NAME
    mesh.data.name = MESH_NAME
    log('assigned PBR maps')


def write_joints(arm):
    points = {}
    for b in arm.data.bones:
        if not b.name.startswith('mixamorig:'):
            continue
        h = arm.matrix_world @ b.head_local
        points[b.name] = [h.x, h.z, -h.y]
    if len(points) != 65:
        raise RuntimeError(f'joints JSON would have {len(points)} mixamorig bones: {sorted(points)}')
    CACHE.mkdir(parents=True, exist_ok=True)
    JOINTS_OUT.write_text(json.dumps(points, indent=2) + '\n')
    hips, head = points['mixamorig:Hips'], points['mixamorig:Head']
    log(f'wrote {JOINTS_OUT.name} hips={hips} head={head}')


def add_eyes(arm, mesh):
    """Small amber beads in the orbits, rigid to Head — the albedo sockets are dark pits."""
    import bmesh
    head = arm.matrix_world @ arm.data.bones['mixamorig:Head'].head_local
    coords = [mesh.matrix_world @ v.co for v in mesh.data.vertices]
    # Face cluster: near the head, in front of it (Blender -Y after Mixamo FBX).
    face = [c for c in coords if (c - head).length < 0.14 and c.y < head.y - 0.01]
    if len(face) < 20:
        face = [c for c in coords if (c - head).length < 0.18]
    left = [c for c in face if c.x > 0.01]
    right = [c for c in face if c.x < -0.01]
    def centroid(pts, fallback):
        if not pts:
            return fallback
        s = Vector((0, 0, 0))
        for p in pts:
            s += p
        return s / len(pts)
    centres = [
        centroid(left, head + Vector((0.032, -0.055, 0.038))),
        centroid(right, head + Vector((-0.032, -0.055, 0.038))),
    ]
    mat = bpy.data.materials.new('UndeadV1Eyes')
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    bsdf.inputs['Base Color'].default_value = (0.08, 0.025, 0.004, 1)
    bsdf.inputs['Roughness'].default_value = 0.28
    bsdf.inputs['Metallic'].default_value = 0
    for key in ('Emission Color', 'Emission'):
        if key in bsdf.inputs:
            bsdf.inputs[key].default_value = (1.0, 0.28, 0.04, 1)
            break
    if 'Emission Strength' in bsdf.inputs:
        bsdf.inputs['Emission Strength'].default_value = 2.4
    bm = bmesh.new()
    radius = 0.011
    for c in centres:
        sub = bmesh.new()
        bmesh.ops.create_uvsphere(sub, u_segments=10, v_segments=7, radius=radius)
        for v in sub.verts:
            v.co += c
        tmp = bpy.data.meshes.new('tmpEye')
        sub.to_mesh(tmp)
        sub.free()
        bm.from_mesh(tmp)
        bpy.data.meshes.remove(tmp)
    me = bpy.data.meshes.new('UndeadV1Eyes')
    bm.to_mesh(me)
    bm.free()
    eyes = bpy.data.objects.new('UndeadV1Eyes', me)
    bpy.context.collection.objects.link(eyes)
    eyes.data.materials.append(mat)
    vg = eyes.vertex_groups.new(name='mixamorig:Head')
    vg.add(list(range(len(me.vertices))), 1.0, 'REPLACE')
    mod = eyes.modifiers.new('Armature', 'ARMATURE')
    mod.object = arm
    eyes.parent = arm
    log(f'amber eyes at {[tuple(round(v, 3) for v in c) for c in centres]}')
    return eyes


def export_glb(arm, mesh, extras=()):
    bpy.ops.object.select_all(action='DESELECT')
    arm.select_set(True)
    mesh.select_set(True)
    for ob in extras:
        ob.select_set(True)
    bpy.context.view_layer.objects.active = arm
    CACHE.mkdir(parents=True, exist_ok=True)
    kwargs = dict(
        filepath=str(REST),
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
        export_apply=True,
    )
    try:
        bpy.ops.export_scene.gltf(**kwargs, export_tangents=True)
    except TypeError:
        kwargs.pop('export_apply', None)
        bpy.ops.export_scene.gltf(**kwargs)
    log(f'exported {REST} ({REST.stat().st_size} bytes)')


def preview(mesh):
    coords = [mesh.matrix_world @ v.co for v in mesh.data.vertices]
    lo = Vector((min(c.x for c in coords), min(c.y for c in coords), min(c.z for c in coords)))
    hi = Vector((max(c.x for c in coords), max(c.y for c in coords), max(c.z for c in coords)))
    centre = (lo + hi) * 0.5
    height = hi.z - lo.z
    scene = bpy.context.scene
    for engine in ('BLENDER_WORKBENCH', 'BLENDER_EEVEE', 'BLENDER_EEVEE_NEXT'):
        try:
            scene.render.engine = engine
            break
        except TypeError:
            continue
    scene.render.resolution_x = 720
    scene.render.resolution_y = 900
    scene.render.filepath = str(PREVIEW)
    scene.render.image_settings.file_format = 'PNG'
    try:
        scene.display.shading.color_type = 'TEXTURE'
        scene.display.shading.light = 'STUDIO'
    except Exception:
        pass
    camd = bpy.data.cameras.new('P')
    cam = bpy.data.objects.new('P', camd)
    bpy.context.collection.objects.link(cam)
    scene.camera = cam
    cam.location = (centre.x, centre.y - height * 2.4, centre.z + height * 0.05)
    cam.rotation_euler = (math.pi / 2, 0, 0)
    bpy.ops.render.render(write_still=True)
    log(f'preview {PREVIEW}')


def main():
    log(f'TARGET_HEIGHT={TARGET_HEIGHT}')
    clear_scene()
    arm, mesh = import_fbx()
    apply_object_scale(arm)
    bpy.context.view_layer.update()
    log(f'height after apply-scale {world_height(mesh):.3f} m')
    tpose_arms(arm)
    scale_to_height(arm, mesh, TARGET_HEIGHT)
    assign_maps(mesh)
    eyes = add_eyes(arm, mesh)
    write_joints(arm)
    preview(mesh)
    export_glb(arm, mesh, extras=(eyes,))
    summary = {
        'height': round(world_height(mesh), 4),
        'verts': len(mesh.data.vertices),
        'polys': len(mesh.data.polygons),
        'bones': len(arm.data.bones),
        'restBytes': REST.stat().st_size,
    }
    log('BUILD COMPLETE ' + json.dumps(summary))


if __name__ == '__main__':
    main()
