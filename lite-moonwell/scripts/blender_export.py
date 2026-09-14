"""Export the live Blender scene for the Babylon Lite moonwell demo.

The Node wrapper sets these names before exec():
  EXPORT_PATH, RUNTIME_PATH, BLEND_PATH, STRIP_TRANSMISSION
"""
import json
import os
from datetime import datetime, timezone

import bpy
from mathutils import Vector

export_path = EXPORT_PATH
runtime_path = RUNTIME_PATH
blend_path = BLEND_PATH
strip_transmission = bool(STRIP_TRANSMISSION)


def gltf_vec(v):
    return [round(float(v.x), 5), round(float(v.z), 5), round(float(-v.y), 5)]


if bpy.ops.object.mode_set.poll():
    bpy.ops.object.mode_set(mode="OBJECT")

bpy.ops.object.select_all(action="DESELECT")
for obj in bpy.context.scene.objects:
    obj.select_set(obj.type == "MESH")
meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
if meshes:
    for ob in meshes:
        if ob.data and ob.data.users > 1:
            ob.data = ob.data.copy()
    bpy.context.view_layer.objects.active = meshes[0]
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)

try:
    bpy.ops.file.pack_all()
except Exception as exc:
    print("pack_all skipped:", exc)

saved_transmission = []
if strip_transmission:
    for mat in bpy.data.materials:
        if not mat.node_tree:
            continue
        node = mat.node_tree.nodes.get("Principled BSDF")
        if not node:
            continue
        for key in ("Transmission Weight", "Transmission"):
            if key in node.inputs and node.inputs[key].default_value:
                saved_transmission.append((node.inputs[key], float(node.inputs[key].default_value)))
                node.inputs[key].default_value = 0.0

os.makedirs(os.path.dirname(export_path), exist_ok=True)
os.makedirs(os.path.dirname(runtime_path), exist_ok=True)

try:
    result = bpy.ops.export_scene.gltf(
        filepath=export_path,
        export_format="GLB",
        export_apply=True,
        export_yup=True,
        export_lights=False,
        export_cameras=False,
        export_extras=False,
        export_animations=False,
        export_skins=False,
        export_morph=False,
        use_selection=False,
        use_visible=True,
        export_materials="EXPORT",
        export_texcoords=True,
        export_normals=True,
        export_tangents=True,
        export_image_format="AUTO",
        export_keep_originals=False,
    )
finally:
    for socket, value in saved_transmission:
        socket.default_value = value

scene = bpy.context.scene
lights = []
for obj in scene.objects:
    if obj.type != "LIGHT":
        continue
    data = obj.data
    entry = {
        "name": obj.name,
        "type": data.type,
        "locationBlender": [round(float(c), 5) for c in obj.location],
        "locationGltf": gltf_vec(obj.location),
        "color": [round(float(c), 5) for c in data.color[:3]],
        "energy": float(data.energy),
    }
    if data.type == "SUN":
        direction = obj.matrix_world.to_3x3() @ Vector((0.0, 0.0, -1.0))
        entry["directionGltf"] = gltf_vec(direction)
    if data.type == "AREA":
        entry["liteType"] = "point"
        entry["note"] = "Area lights are approximated as points in Lite"
    lights.append(entry)

camera = None
if scene.camera:
    aim = scene.objects.get("Aim")
    target = aim.location if aim else Vector((0.0, 0.0, 0.5))
    camera = {
        "name": scene.camera.name,
        "locationGltf": gltf_vec(scene.camera.location),
        "targetGltf": gltf_vec(target),
        "lens": float(scene.camera.data.lens) if scene.camera.data else 45.0,
    }

runtime = {
    "exportedAt": datetime.now(timezone.utc).isoformat(),
    "objectCount": len(scene.objects),
    "meshCount": len(meshes),
    "stripTransmission": strip_transmission,
    "lights": lights,
    "camera": camera,
    "fireflyPrefix": "Firefly",
}
with open(runtime_path, "w", encoding="utf-8") as fh:
    json.dump(runtime, fh, indent=2)
    fh.write("\n")

if blend_path:
    os.makedirs(os.path.dirname(blend_path), exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=blend_path, copy=True)

bytes_out = os.path.getsize(export_path) if os.path.exists(export_path) else 0
print("EXPORT_RESULT:" + json.dumps({
    "export": str(result),
    "glb": export_path,
    "bytes": bytes_out,
    "runtime": runtime_path,
    "blend": blend_path or None,
    "objects": runtime["objectCount"],
    "meshes": runtime["meshCount"],
    "lights": len(lights),
    "areaLightsAsPoints": sum(1 for light in lights if light.get("type") == "AREA"),
    "stripTransmission": strip_transmission,
    "restoredTransmission": len(saved_transmission),
}))
