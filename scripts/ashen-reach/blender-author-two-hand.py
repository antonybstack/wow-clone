"""Author the two-handed greatstaff carry pose on the source rig in an isolated
background Blender, then export the arm-bone local rotations the runtime applies.

It places two IK targets (the two hand grips) on a target staff in front of the
chest, solves the arms, and writes src/character/runtime/two-hand-carry-pose.json
in the runtime format (absolute local translation + rotation per bone).

Never touches the interactive/live shrine scene. Run:
  /Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup \
    --python scripts/ashen-reach/blender-author-two-hand.py
"""
import bpy, json, os, math
from mathutils import Vector, Quaternion, Matrix

GLB = os.path.abspath("public/ashen-reach/wanderer.glb")
OUT = os.path.abspath("ve-capture/ashen-reach/two-handed-v5/blender-carry-pose.json")
GLB_OUT = os.path.abspath(".cache/two-hand/two-hand-carry.glb")

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=GLB)
arm = [o for o in bpy.data.objects if o.type == "ARMATURE"][0]
bpy.context.view_layer.objects.active = arm
bpy.ops.object.mode_set(mode="POSE")
for pb in arm.pose.bones:
    pb.rotation_mode = "QUATERNION"
    pb.rotation_quaternion = (1, 0, 0, 0)
    pb.location = (0, 0, 0)
    pb.scale = (1, 1, 1)

W = arm.matrix_world
def head(name):
    return W @ arm.pose.bones[name].head

# Character-local frame: up = +Z, forward from the toes.
up = Vector((0, 0, 1))
forward = (head("mixamorig:RightToeBase") - head("mixamorig:RightFoot"))
forward = forward - up * forward.dot(up)
forward.normalize()
right = forward.cross(up).normalized()
chest = head("mixamorig:Spine2")
print("FRAME", "forward", [round(v, 3) for v in forward], "right", [round(v, 3) for v in right], "chest", [round(v, 3) for v in chest])

# Two-handed grip targets (metres; head() returns arm.matrix_world, which applies
# the rig's 0.01 scale): right hand low-right, left hand high-left, pushed forward.
grip_r = chest + forward * 0.24 + right * 0.20 - up * 0.05
grip_l = chest + forward * 0.26 - right * 0.18 + up * 0.04
shaft_dir = (grip_l - grip_r).normalized()

def make_empty(name, loc, look=None):
    e = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(e)
    e.location = loc
    if look is not None:
        e.rotation_mode = "QUATERNION"
        e.rotation_quaternion = Vector((0, 1, 0)).rotation_difference(look)
    return e

emptyR = make_empty("gripR", grip_r, shaft_dir)
emptyL = make_empty("gripL", grip_l, shaft_dir)
emptyPoleR = make_empty("poleR", chest + forward * 0.06 + right * 0.55 - up * 0.45)
emptyPoleL = make_empty("poleL", chest + forward * 0.06 - right * 0.55 - up * 0.45)

for fore, hand, target, pole in [
    ("mixamorig:RightForeArm", "mixamorig:RightHand", emptyR, emptyPoleR),
    ("mixamorig:LeftForeArm", "mixamorig:LeftHand", emptyL, emptyPoleL),
]:
    ik = arm.pose.bones[fore].constraints.new("IK")
    ik.target = target
    ik.chain_count = 2
    ik.use_stretch = False

    ik.use_tail = True
    cr = arm.pose.bones[hand].constraints.new("COPY_ROTATION")
    cr.target = target
    cr.mix_mode = "REPLACE"

bpy.context.view_layer.update()
dg = bpy.context.evaluated_depsgraph_get()
arm_eval = arm.evaluated_get(dg)
for label, pbname, empty in [("R", "mixamorig:RightHand", emptyR), ("L", "mixamorig:LeftHand", emptyL)]:
    hand = arm_eval.matrix_world @ arm_eval.pose.bones[pbname].head
    tgt = empty.matrix_world.translation
    print("GAP", label, "hand", [round(v, 3) for v in hand], "target", [round(v, 3) for v in tgt], "gap", round((hand - tgt).length, 3))

# Bake the evaluated (constraint-applied) pose into the bones, then remove the
# constraints and apply the pose as rest. Blender operators that need a viewport
# (visual_transform_apply) do not run reliably in background mode, so copy the
# evaluated armature-space matrices directly.
for pb in arm.pose.bones:
    pb.matrix = arm_eval.pose.bones[pb.name].matrix
bpy.context.view_layer.update()
for pb in arm.pose.bones:
    for c in list(pb.constraints):
        pb.constraints.remove(c)
bpy.ops.pose.armature_apply(selected=False)

# Bake constraints into pose transforms, then apply as rest and export a GLB so
# Blender's exporter performs the bone-space -> glTF-node-space conversion.

handR = W @ arm.pose.bones["mixamorig:RightHand"].head
handL = W @ arm.pose.bones["mixamorig:LeftHand"].head
print("HANDS", "R", [round(v, 3) for v in (handR - chest)], "L", [round(v, 3) for v in (handL - chest)], "sep", round((handL - handR).length, 3))

os.makedirs(os.path.dirname(GLB_OUT), exist_ok=True)
bpy.ops.object.mode_set(mode="OBJECT")
bpy.ops.export_scene.gltf(filepath=GLB_OUT, export_format="GLB", export_animations=False, export_skins=True)
print("EXPORTED", GLB_OUT)
print("DONE")
