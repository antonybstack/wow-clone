"""Import the Tripo Mixamo human FBX, put it in T-pose, scale to game height, export rest.

Isolated Blender 5.2.1, not MCP 9876:

    /Applications/Blender.app/Contents/MacOS/Blender --background \\
        --python scripts/character-assets/human_from_tripo.py

Reads blender/characters/sources/human-tripo/human-tripo.fbx
Writes .cache/source-motion/human-tripo-source-rest.glb
       .cache/source-motion/human-tripo-source-joints.json
"""
from __future__ import annotations

import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
FBX = ROOT / 'blender/characters/sources/human-tripo/human-tripo.fbx'
TEX = ROOT / 'blender/characters/sources/human-tripo/textures'
CACHE = ROOT / '.cache/source-motion'
REST = CACHE / 'human-tripo-source-rest.glb'
JOINTS_OUT = CACHE / 'human-tripo-source-joints.json'
TARGET_HEIGHT = 1.76
MESH_NAME = 'HumanV1Body'


def log(msg):
    print(f'[human-tripo] {msg}', flush=True)


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
    """Mixamo clips assume T-pose rest. This FBX ships A-pose, arms about 61 degrees down."""
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode='POSE')
    for name, deg in (('mixamorig:LeftArm', 61), ('mixamorig:RightArm', -61)):
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
    if left.x < 0.9 or right.x > -0.9 or abs(left.z) > 0.25 or abs(right.z) > 0.25:
        raise RuntimeError(f'T-pose arms are not out: left={tuple(left)} right={tuple(right)}')


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
    mat = bpy.data.materials.new(MESH_NAME)
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    bsdf.inputs['Metallic'].default_value = 0.0
    bsdf.inputs['Roughness'].default_value = 0.72
    path = TEX / 'basecolor.png'
    if not path.exists():
        raise FileNotFoundError(path)
    img = bpy.data.images.load(str(path))
    img.scale(1024, 1024)
    n = nt.nodes.new('ShaderNodeTexImage')
    n.image = img
    nt.links.new(n.outputs['Color'], bsdf.inputs['Base Color'])
    mesh.data.materials.clear()
    mesh.data.materials.append(mat)
    mesh.name = MESH_NAME
    mesh.data.name = MESH_NAME
    log('assigned albedo')


def write_joints(arm):
    points = {}
    for b in arm.data.bones:
        if not b.name.startswith('mixamorig:'):
            continue
        h = arm.matrix_world @ b.head_local
        points[b.name] = [h.x, h.z, -h.y]
    if len(points) != 65:
        raise RuntimeError(f'joints JSON would have {len(points)} mixamorig bones')
    CACHE.mkdir(parents=True, exist_ok=True)
    JOINTS_OUT.write_text(json.dumps(points, indent=2) + '\n')
    hips, head = points['mixamorig:Hips'], points['mixamorig:Head']
    log(f'wrote {JOINTS_OUT.name} hips={hips} head={head}')


def export_glb(arm, mesh):
    bpy.ops.object.select_all(action='DESELECT')
    arm.select_set(True)
    mesh.select_set(True)
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
    write_joints(arm)
    export_glb(arm, mesh)
    summary = {
        'height': round(world_height(mesh), 4),
        'verts': len(mesh.data.vertices),
        'polys': len(mesh.data.polygons),
        'bones': len(arm.data.bones),
        'restBytes': REST.stat().st_size,
    }
    log(json.dumps(summary))
    return 0


if __name__ == '__main__':
    sys.exit(main())
