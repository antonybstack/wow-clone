"""Measure Hips character-delta vs Mixamo at named clip times. Isolated Blender."""
from __future__ import annotations

import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Matrix, Vector

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(Path(__file__).resolve().parent))
import retarget_anatomy as ra  # noqa: E402

EVID = ROOT / "ve-capture/m2-pelvis-retarget"
OUT = EVID / "pelvis-delta.json"
GLB_ANIM = ROOT / "public/characters/bodies/human-animated-v1.glb"
GLB_SRC = ROOT / "public/characters/base.glb"
GLB_DEST_SRC = ROOT / "public/characters/bodies/human-v1.glb"
CLIPS = (("idle", 1, 0.0), ("walk", 10, 0.3), ("run", 8, 0.2333), ("cast", 10, 0.3))


def play(arm, name, frame):
    act = bpy.data.actions.get(name)
    if act is None:
        for a in bpy.data.actions:
            if a.name == name or a.name.startswith(name):
                act = a
                break
    if act is None:
        return False
    ad = arm.animation_data_create() if arm.animation_data is None else arm.animation_data
    for t in ad.nla_tracks:
        t.mute = True
        for s in t.strips:
            s.mute = True
    ad.action = act
    bpy.context.scene.frame_set(int(frame))
    bpy.context.view_layer.update()
    return True


def rot(arm, name):
    return ra.nearest_rotation((arm.matrix_world @ arm.pose.bones[name].matrix).to_3x3())


def aim(arm, name):
    pb = arm.pose.bones[name]
    mw = arm.matrix_world
    return (mw @ pb.tail - mw @ pb.head).normalized()


def ang(a, b):
    return math.degrees(a.rotation_difference(b).angle)


def main():
    EVID.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.read_homefile(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(GLB_DEST_SRC))
    dest_rest_arm = next(o for o in bpy.data.objects if o.type == "ARMATURE")
    dest_rest_arm.name = "DestRest"
    dest_hips_rest_R = rot(dest_rest_arm, "Hips")
    dest_hips_rest_aim = aim(dest_rest_arm, "Hips")
    dest_anat = ra.capture_anatomy(dest_rest_arm, ["Hips", "Head", "LeftUpLeg", "RightUpLeg", "Spine"])

    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(GLB_ANIM))
    dest = next(o for o in bpy.data.objects if o.type == "ARMATURE" and o not in before)
    dest.name = "DestAnim"

    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(GLB_SRC))
    src = next(o for o in bpy.data.objects if o.type == "ARMATURE" and o not in before)
    src.name = "SrcMixamo"
    if src.scale.x < 0.05:
        src.scale *= 100.0
        bpy.context.view_layer.update()

    for pb in src.pose.bones:
        pb.matrix_basis = Matrix.Identity(4)
    bpy.context.view_layer.update()
    src_anat = ra.capture_anatomy(
        src,
        ["mixamorig:Hips", "mixamorig:Head", "mixamorig:LeftUpLeg", "mixamorig:RightUpLeg", "mixamorig:Spine"],
    )
    C = ra.hips_C_dest_from_src(src_anat, dest_anat)
    src_rest_R = rot(src, "mixamorig:Hips")

    rows = []
    for clip, frame, t in CLIPS:
        play(src, clip if bpy.data.actions.get(clip) else "Walk_Loop", frame)
        # Mixamo actions keep original names
        src_act = None
        mapping = {"idle": "Idle_Loop", "walk": "Walk_Loop", "run": "Sprint_Loop", "cast": "Spell_Simple_Shoot"}
        play(src, mapping[clip], frame)
        play(dest, clip, frame)
        src_pose_R = rot(src, "mixamorig:Hips")
        dst_pose_R = rot(dest, "Hips")
        pred = ra.hips_dest_pose_rotation(src_pose_R, src_rest_R, dest_hips_rest_R, C)
        mismatch = ang(pred.to_quaternion(), dst_pose_R.to_quaternion())
        src_delta = ra.nearest_rotation(src_pose_R @ src_rest_R.inverted())
        dst_delta = ra.nearest_rotation(dst_pose_R @ dest_hips_rest_R.inverted())
        dest_aim = aim(dest, "Hips")
        aim_from_rest = math.degrees(dest_hips_rest_aim.angle(dest_aim))
        rows.append(
            {
                "clip": clip,
                "frame": frame,
                "timeSec": t,
                "calibratedDeltaMismatchDeg": mismatch,
                "srcDeltaDeg": math.degrees(src_delta.to_quaternion().angle),
                "dstDeltaDeg": math.degrees(dst_delta.to_quaternion().angle),
                "destHipsAimChangeFromRestDeg": aim_from_rest,
                "Cdet": C.determinant(),
            }
        )

    OUT.write_text(json.dumps({"Cdet": C.determinant(), "clips": rows}, indent=2))
    print("WROTE", OUT)
    for r in rows:
        print(r["clip"], "mismatch", r["calibratedDeltaMismatchDeg"], "aimChange", r["destHipsAimChangeFromRestDeg"], "srcD", r["srcDeltaDeg"], "dstD", r["dstDeltaDeg"])


if __name__ == "__main__":
    main()
