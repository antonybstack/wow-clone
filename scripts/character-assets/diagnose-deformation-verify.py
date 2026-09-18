"""One-shot check: full-weight abdomen smoothness vs reduced at walk 0.3.

Same D_j CPU LBS as diagnose-deformation-lbs.py. Isolated background Blender.
"""
from __future__ import annotations

import json
import math
from pathlib import Path

import bpy
from mathutils import Vector

import importlib.util
import sys

ROOT = Path(__file__).resolve().parents[2]
_lbs_path = Path(__file__).resolve().parent / "diagnose-deformation-lbs.py"
_spec = importlib.util.spec_from_file_location("diagnose_deformation_lbs", _lbs_path)
_lbs = importlib.util.module_from_spec(_spec)
sys.modules["diagnose_deformation_lbs"] = _lbs
_spec.loader.exec_module(_lbs)

WALK_FRAME = _lbs.WALK_FRAME
WALK_TIME_S = _lbs.WALK_TIME_S
deform_table = _lbs.deform_table
find_arm = _lbs.find_arm
find_mesh = _lbs.find_mesh
gltf_yup = _lbs.gltf_yup
import_anim = _lbs.import_anim
lbs = _lbs.lbs
play_walk = _lbs.play_walk
rest_world = _lbs.rest_world
v3 = _lbs.v3
vertex_weights = _lbs.vertex_weights
clear_action = _lbs.clear_action
sha256 = _lbs.sha256
GLB_ANIM = _lbs.GLB_ANIM
BLEND_REST = _lbs.BLEND_REST
EVID = _lbs.EVID

OUT = EVID / "diagnosis-fullweight-smoothness.json"
ABDOMEN_Z = (0.88, 1.08)
ABDOMEN_X = 0.07
ABDOMEN_Y_MAX = -0.02


def bone_head_tail(arm, name):
    pb = arm.pose.bones.get(name)
    if pb is None:
        return None
    mw = arm.matrix_world
    head = mw @ pb.head
    tail = mw @ pb.tail
    aim = tail - head
    if aim.length < 1e-8:
        return {"name": name, "head": v3(head), "tail": v3(tail), "aim": None}
    aim.normalize()
    return {"name": name, "head": v3(head), "tail": v3(tail), "aim": v3(aim)}


def ang(a, b):
    if a is None or b is None:
        return None
    va, vb = Vector(a), Vector(b)
    if va.length < 1e-8 or vb.length < 1e-8:
        return None
    return math.degrees(va.angle(vb))


def main():
    bpy.ops.wm.open_mainfile(filepath=str(BLEND_REST), load_ui=False)
    bpy.context.scene.render.fps = 30
    import_anim()
    body = find_mesh("HumanBody")
    full = find_mesh("HumanBodyFullW")
    src_arm = find_arm("HumanV1")
    anim_arm = bpy.data.objects.get("HumanV1.001")
    if anim_arm is None:
        arms = [o for o in bpy.data.objects if o.type == "ARMATURE" and o != src_arm]
        anim_arm = arms[0]
    names = ("Hips", "Spine", "spine04", "Spine2", "pelvis.L", "pelvis.R")

    clear_action(anim_arm)
    rest_anat = {n: bone_head_tail(anim_arm, n) for n in names}
    play_walk(anim_arm)
    pose_anat = {n: bone_head_tail(anim_arm, n) for n in names}
    D, _ = deform_table(anim_arm)

    artic = []
    for n in names:
        r, p = rest_anat[n], pose_anat[n]
        head_d = None
        if r and p:
            head_d = (Vector(r["head"]) - Vector(p["head"])).length
        artic.append(
            {
                "joint": n,
                "headTravelM": head_d,
                "aimChangeDeg": ang(r["aim"], p["aim"]) if r and p else None,
                "restAim": r["aim"] if r else None,
                "poseAim": p["aim"] if p else None,
            }
        )
    hips_spine_rest = ang(rest_anat["Hips"]["aim"], rest_anat["Spine"]["aim"])
    hips_spine_pose = ang(pose_anat["Hips"]["aim"], pose_anat["Spine"]["aim"])

    abdomen = []
    for v in body.data.vertices:
        p = v.co
        if ABDOMEN_Z[0] <= p.z <= ABDOMEN_Z[1] and abs(p.x) <= ABDOMEN_X and p.y <= ABDOMEN_Y_MAX:
            abdomen.append(v.index)

    rows = []
    dropped_spine = 0
    for vi in abdomen:
        red, _ = vertex_weights(body, vi)
        ful, _ = vertex_weights(full, vi)
        P = rest_world(body, vi)
        p_red, miss_r, _ = lbs(P, red, D)
        p_ful, miss_f, _ = lbs(P, ful, D)
        if p_red is None or p_ful is None:
            continue
        d = (p_red - p_ful).length
        ful_dom = ful[0][0] if ful else None
        red_dom = red[0][0] if red else None
        if any(n == "Spine" for n, _ in ful) and not any(n == "Spine" for n, _ in red):
            dropped_spine += 1
        rows.append((d, vi, p_red, p_ful, red_dom, ful_dom))
    rows.sort(reverse=True)

    # Neighbor edge stretch: rest vs full-LBS vs reduced-LBS (source mesh topology).
    pos_rest = {vi: rest_world(body, vi) for vi in abdomen}
    pos_red = {t[1]: t[2] for t in rows}
    pos_ful = {t[1]: t[3] for t in rows}
    idset = set(pos_red) & set(pos_ful)
    rest_len, ful_len, red_len = [], [], []
    for e in body.data.edges:
        a, b = e.vertices
        if a not in idset or b not in idset:
            continue
        rest_len.append((pos_rest[a] - pos_rest[b]).length)
        ful_len.append((pos_ful[a] - pos_ful[b]).length)
        red_len.append((pos_red[a] - pos_red[b]).length)

    def stats(vals):
        if not vals:
            return None
        s = sorted(vals)
        return {"n": len(s), "minM": s[0], "maxM": s[-1], "medianM": s[len(s) // 2], "meanM": sum(s) / len(s)}

    stretch_ful = [(a / b if b > 1e-8 else 0.0) for a, b in zip(ful_len, rest_len)]
    stretch_red = [(a / b if b > 1e-8 else 0.0) for a, b in zip(red_len, rest_len)]

    out = {
        "hashes": {
            "human-animated-v1.glb": sha256(GLB_ANIM),
            "human-v1.blend": sha256(BLEND_REST),
        },
        "clip": "walk",
        "timeSec": WALK_TIME_S,
        "frame": WALK_FRAME,
        "units": "meters",
        "physicalArticulation": {
            "note": "world head-tail aims on imported armature; not matrix_basis roll",
            "joints": artic,
            "hipsSpineAimRestDeg": hips_spine_rest,
            "hipsSpineAimWalkDeg": hips_spine_pose,
            "hipsSpineRelativeChangeDeg": None
            if hips_spine_rest is None or hips_spine_pose is None
            else abs(hips_spine_pose - hips_spine_rest),
        },
        "abdomenPatch": {
            "vertexCount": len(abdomen),
            "evaluated": len(rows),
            "droppedSpineCount": dropped_spine,
            "fullVsReducedMaxM": rows[0][0] if rows else None,
            "fullVsReducedP95M": rows[int(0.05 * (len(rows) - 1))][0] if rows else None,
            "worst": [
                {
                    "vertexId": vi,
                    "deltaM": d,
                    "reducedDominant": rd,
                    "fullDominant": fd,
                    "lbsReducedGltfYup": gltf_yup(pr),
                    "lbsFullGltfYup": gltf_yup(pf),
                }
                for d, vi, pr, pf, rd, fd in rows[:8]
            ],
        },
        "edgeLengths": {
            "rest": stats(rest_len),
            "fullLbsWalk": stats(ful_len),
            "reducedLbsWalk": stats(red_len),
            "fullStretchRatio": stats(stretch_ful),
            "reducedStretchRatio": stats(stretch_red),
            "note": "ratio = posed_edge / rest_edge on the same source abdomen edges",
        },
    }
    OUT.write_text(json.dumps(out, indent=2))
    print("WROTE", OUT)
    print("maxDelta", out["abdomenPatch"]["fullVsReducedMaxM"], "droppedSpine", dropped_spine)
    print("hipsSpineRel", out["physicalArticulation"]["hipsSpineRelativeChangeDeg"])
    print("stretch full", out["edgeLengths"]["fullStretchRatio"])
    print("stretch red", out["edgeLengths"]["reducedStretchRatio"])


if __name__ == "__main__":
    main()
