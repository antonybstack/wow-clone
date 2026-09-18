"""Isolated diagnostic: import the Ashen source rig in a background Blender and
report the arm-chain rest data. Never touches the interactive/live shrine scene.
Run: /Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python scripts/ashen-reach/blender-inspect-rig.py
"""
import bpy, json, os, sys

path = os.path.abspath("public/ashen-reach/wanderer.glb")
bpy.ops.wm.read_factory_settings(use_empty=True)
if not os.path.exists(path):
    print("MISSING", path); sys.exit(2)
bpy.ops.import_scene.gltf(filepath=path)

armatures = [o for o in bpy.data.objects if o.type == "ARMATURE"]
print("ARMATURES", [a.name for a in armatures])
if not armatures:
    print("NO ARMATURE"); sys.exit(3)
arm = armatures[0]
names = [b.name for b in arm.data.bones]
print("BONECOUNT", len(names))
print("BONES", json.dumps(names))

wanted = ["mixamorig:LeftShoulder", "mixamorig:LeftArm", "mixamorig:LeftForeArm", "mixamorig:LeftHand",
          "mixamorig:RightShoulder", "mixamorig:RightArm", "mixamorig:RightForeArm", "mixamorig:RightHand",
          "mixamorig:Spine", "mixamorig:Spine1", "mixamorig:Spine2", "mixamorig:Hips"]
out = {}
for n in wanted:
    b = arm.data.bones.get(n)
    if not b:
        out[n] = None
        continue
    out[n] = {
        "parent": b.parent.name if b.parent else None,
        "head": [round(v, 5) for v in b.head_local],
        "matrix_local": [[round(v, 5) for v in row] for row in b.matrix_local],
        "length": round(b.length, 5),
    }
print("ARM", json.dumps(out))
print("MESHES", json.dumps([o.name for o in bpy.data.objects if o.type == "MESH"]))
print("DONE")
