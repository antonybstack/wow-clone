"""Semantic Mixamo → Human v1 bone map for offline bake (M2e).

Source joints use `mixamorig:` prefixes. Destination uses Mixamo-style aliases
plus MakeHuman finger/helper names. Extra MH twist/spine segments stay at rest.
"""

# dest_name, src_name (Mixamo glTF node / Blender bone after import)
CORE_PAIRS = [
    ("Hips", "mixamorig:Hips"),
    ("Spine", "mixamorig:Spine"),
    ("spine04", "mixamorig:Spine1"),
    ("Spine2", "mixamorig:Spine2"),
    ("Neck", "mixamorig:Neck"),
    ("Head", "mixamorig:Head"),
    ("LeftShoulder", "mixamorig:LeftShoulder"),
    ("LeftArm", "mixamorig:LeftArm"),
    ("LeftForeArm", "mixamorig:LeftForeArm"),
    ("LeftHand", "mixamorig:LeftHand"),
    ("RightShoulder", "mixamorig:RightShoulder"),
    ("RightArm", "mixamorig:RightArm"),
    ("RightForeArm", "mixamorig:RightForeArm"),
    ("RightHand", "mixamorig:RightHand"),
    ("LeftUpLeg", "mixamorig:LeftUpLeg"),
    ("LeftLeg", "mixamorig:LeftLeg"),
    ("LeftFoot", "mixamorig:LeftFoot"),
    ("LeftToeBase", "mixamorig:LeftToeBase"),
    ("RightUpLeg", "mixamorig:RightUpLeg"),
    ("RightLeg", "mixamorig:RightLeg"),
    ("RightFoot", "mixamorig:RightFoot"),
    ("RightToeBase", "mixamorig:RightToeBase"),
]

FINGER_PAIRS = []
for side, src_side in (("L", "Left"), ("R", "Right")):
    for mh_idx, mix_name in (
        (1, "Thumb"),
        (2, "Index"),
        (3, "Middle"),
        (4, "Ring"),
        (5, "Pinky"),
    ):
        for seg in (1, 2, 3):
            FINGER_PAIRS.append(
                (f"finger{mh_idx}-{seg}.{side}", f"mixamorig:{src_side}Hand{mix_name}{seg}")
            )

BONE_PAIRS = CORE_PAIRS + FINGER_PAIRS

REQUIRED_DEST = [
    "Hips",
    "Spine",
    "Spine2",
    "Neck",
    "Head",
    "LeftShoulder",
    "LeftArm",
    "LeftForeArm",
    "LeftHand",
    "RightShoulder",
    "RightArm",
    "RightForeArm",
    "RightHand",
    "LeftUpLeg",
    "LeftLeg",
    "LeftFoot",
    "RightUpLeg",
    "RightLeg",
    "RightFoot",
]

CLIP_MAP = {
    "idle": "Idle_Loop",
    "walk": "Walk_Loop",
    "run": "Sprint_Loop",
    "jumpStart": "Jump_Start",
    "jumpLoop": "Jump_Loop",
    "jumpLand": "Jump_Land",
    "cast": "Spell_Simple_Shoot",
}

LOOP_CLIPS = {"idle", "walk", "run", "jumpLoop"}
