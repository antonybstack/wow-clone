"""Stage audit: raw Hips mapping vs idle-plant/loop vs exported GLB. No export."""
from __future__ import annotations

import hashlib
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(Path(__file__).resolve().parent))
import retarget_anatomy as ra  # noqa: E402
import retarget_human_v1 as rh  # noqa: E402
from retarget_bone_map import CLIP_MAP  # noqa: E402

EVID = ROOT / "ve-capture/m2-pelvis-retarget/stage-audit"
BLEND_REST = ROOT / "blender/characters/human-v1.blend"
BLEND_ANIM = ROOT / "blender/characters/human-animated-v1.blend"
GLB_ANIM = ROOT / "public/characters/bodies/human-animated-v1.glb"
GLB_SRC = ROOT / "public/characters/base.glb"
GLB_BODY = ROOT / "public/characters/bodies/human-v1.glb"

# dest_frame 1-based. src range/bakedFrames from bake-report.json of this animated hash.
CLIPS = (
    # semantic, dest_frame, dest_t, src_f0, src_f1, baked_n, loop_blend_affects
    ("idle", 1, 0.0, 1, 76, 95, False),
    ("walk", 10, 0.3, 1, 41, 51, False),  # blend is last 4 of 51
    ("run", 8, 7 / 30, 1, 21, 26, False),
    ("run", 10, 0.3, 1, 21, 26, False),
    ("cast", 10, 0.3, 1, 16, 20, False),
    ("cast", 16, 0.5, 1, 16, 20, False),
)


def sha(p: Path):
    h = hashlib.sha256()
    with p.open("rb") as f:
        for c in iter(lambda: f.read(1 << 20), b""):
            h.update(c)
    return h.hexdigest()


def qang(A, B):
    return math.degrees(A.to_quaternion().rotation_difference(B.to_quaternion()).angle)


def world_R(arm, name):
    return ra.nearest_rotation((arm.matrix_world @ arm.pose.bones[name].matrix).to_3x3())


def world_T(arm, name):
    return (arm.matrix_world @ arm.pose.bones[name].matrix).translation.copy()


def src_sample(f0, f1, n, dest_frame):
    i = dest_frame - 1
    if n <= 1:
        return float(f0)
    return f0 + (f1 - f0) * i / (n - 1)


def find_arm(prefer, extra=None):
    extra = extra or []
    for n in [prefer, *extra]:
        o = bpy.data.objects.get(n)
        if o and o.type == "ARMATURE":
            return o
    for o in bpy.data.objects:
        if o.type == "ARMATURE":
            return o
    return None


def play(arm, name, frame):
    act = bpy.data.actions.get(name)
    if act is None:
        for a in bpy.data.actions:
            if a.name == name or a.name.startswith(name + ".") or a.name.startswith(name):
                act = a
                break
    if act is None:
        return False
    rh.play_dest_action(arm, act)
    bpy.context.scene.frame_set(int(frame))
    bpy.context.view_layer.update()
    return True


def pose_src(src, action_name, src_frame):
    act = bpy.data.actions.get(action_name)
    if act is None:
        for a in bpy.data.actions:
            if a.name == action_name or action_name in a.name:
                act = a
                break
    if act is None:
        raise RuntimeError(f"no src action {action_name}")
    rh.assign_source_action(src, act)
    bpy.context.scene.frame_set(int(round(src_frame)))
    bpy.context.view_layer.update()


def main():
    EVID.mkdir(parents=True, exist_ok=True)
    hashes = {
        "human-v1.glb": sha(GLB_BODY),
        "human-animated-v1.glb": sha(GLB_ANIM),
        "human-v1.blend": sha(BLEND_REST),
        "human-animated-v1.blend": sha(BLEND_ANIM) if BLEND_ANIM.exists() else None,
        "base.glb": sha(GLB_SRC),
    }
    bpy.ops.wm.open_mainfile(filepath=str(BLEND_REST), load_ui=False)
    bpy.context.scene.render.fps = 30
    dest_raw = find_arm("HumanV1")
    body = bpy.data.objects.get("HumanBody")
    full = bpy.data.objects.get("HumanBodyFullW")
    rh.clear_pose(dest_raw)
    bpy.context.view_layer.update()

    added_glb, _ = None, None
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(GLB_ANIM))
    dest_glb = next(o for o in bpy.data.objects if o.type == "ARMATURE" and o not in before)
    dest_glb.name = "DestGlb"

    dest_blend = None
    if BLEND_ANIM.exists():
        existing = {o.name for o in bpy.data.objects}
        bpy.ops.wm.append(
            filepath=str(BLEND_ANIM) + "/Object/HumanV1",
            directory=str(BLEND_ANIM) + "/Object/",
            filename="HumanV1",
        )
        appended = [o for o in bpy.data.objects if o.name not in existing and o.type == "ARMATURE"]
        dest_blend = appended[0] if appended else None
        if dest_blend:
            dest_blend.name = "DestBlend"

    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(GLB_SRC))
    src = next(o for o in bpy.data.objects if o.type == "ARMATURE" and o not in before)
    if src.scale.x < 0.05:
        src.scale *= 100.0
        bpy.context.view_layer.update()
    rh.clear_pose(src)
    rh.clear_pose(dest_raw)
    bpy.context.view_layer.update()

    pairs = rh.resolve_pairs(dest_raw, src)
    dest_names = [d for d, _ in pairs]
    dest_rest = rh.capture_rest(dest_raw, dest_names)
    src_rest = rh.capture_rest(src, [s for _, s in pairs])
    dest_rest_anat = ra.capture_anatomy(dest_raw, dest_names)
    src_rest_anat = ra.capture_anatomy(src, [s for _, s in pairs])
    helper_links = ra.find_twist_helpers(dest_raw, dest_names)
    ctx = {
        "order": ra.hierarchy_dest_order(dest_raw, dest_names, helper_links),
        "helper_links": helper_links,
        "twist_helper_names": set(helper_links.keys()),
        "dest_rest_anat": dest_rest_anat,
        "src_rest_anat": src_rest_anat,
        "dest_basis_all": ra.capture_all_basis(dest_raw),
        "mapped": set(dest_names),
        "delta_bones": set(),
        "lock_hips_world_xy": False,
        "hips_C": ra.hips_C_dest_from_src(src_rest_anat, dest_rest_anat),
    }
    C = ctx["hips_C"]
    Rd_rest = world_R(dest_raw, "Hips")
    Rs_rest = world_R(src, "mixamorig:Hips")
    T_rest = world_T(dest_raw, "Hips")

    rows = []
    for semantic, dframe, tsec, f0, f1, n, _ in CLIPS:
        matched = src_sample(f0, f1, n, dframe)
        naive = float(dframe)
        loop_start = n - min(4, n - 1) + 1
        in_loop_blend = dframe >= loop_start
        src_act = CLIP_MAP[semantic]

        pose_src(src, src_act, matched)
        rh.clear_pose(dest_raw)
        bpy.context.view_layer.update()
        rh.retarget_frame(dest_raw, src, pairs, dest_rest, src_rest, "Hips", strip_xz=True, ctx=ctx)
        R_raw = world_R(dest_raw, "Hips")
        T_raw = world_T(dest_raw, "Hips")
        Rs_pose = world_R(src, "mixamorig:Hips")
        pred = ra.hips_dest_pose_rotation(Rs_pose, Rs_rest, Rd_rest, C)
        raw_vs_pred = qang(R_raw, pred)
        src_delta = ra.nearest_rotation(Rs_pose @ Rs_rest.inverted())
        dst_raw_delta = ra.nearest_rotation(R_raw @ Rd_rest.inverted())
        calibrated = qang(pred, R_raw)  # same as raw_vs_pred

        pose_src(src, src_act, naive)
        Rs_naive = world_R(src, "mixamorig:Hips")
        src_remap_deg = qang(Rs_pose, Rs_naive)

        glb_ok = play(dest_glb, semantic, dframe)
        R_glb = world_R(dest_glb, "Hips") if glb_ok else None
        T_glb = world_T(dest_glb, "Hips") if glb_ok else None
        post_vs_raw = qang(R_glb, R_raw) if R_glb is not None else None
        post_vs_pred = qang(R_glb, pred) if R_glb is not None else None
        pos_err = (T_glb - T_raw).length if T_glb is not None else None

        blend_vs_glb = None
        pos_blend_glb = None
        if dest_blend is not None:
            bok = play(dest_blend, semantic, dframe)
            if bok:
                R_b = world_R(dest_blend, "Hips")
                T_b = world_T(dest_blend, "Hips")
                blend_vs_glb = qang(R_b, R_glb) if R_glb is not None else None
                pos_blend_glb = (T_b - T_glb).length if T_glb is not None else None

        rows.append(
            {
                "clip": semantic,
                "destFrame": dframe,
                "destTimeSec": tsec,
                "srcMatchedFrame": matched,
                "srcNaiveFrame": naive,
                "inLoopBlendWindow": in_loop_blend,
                "loopBlendDestFrames": [loop_start, n],
                "idlePlantResetsHipsBasis": semantic == "idle",
                "unitsRotation": "degrees",
                "unitsPosition": "meters",
                "rawVsPredictedDeg": raw_vs_pred,
                "srcDeltaDeg": math.degrees(src_delta.to_quaternion().angle),
                "dstRawDeltaDeg": math.degrees(dst_raw_delta.to_quaternion().angle),
                "srcRemapNaiveVsMatchedDeg": src_remap_deg,
                "postGlbVsRawDeg": post_vs_raw,
                "postGlbVsPredictedDeg": post_vs_pred,
                "postGlbVsRawPosM": pos_err,
                "savedBlendVsExportedGlbDeg": blend_vs_glb,
                "savedBlendVsExportedGlbPosM": pos_blend_glb,
                "hipsWorldZ_raw": T_raw.z,
                "hipsWorldZ_glb": T_glb.z if T_glb is not None else None,
                "hipsWorldZ_deltaM": (T_glb.z - T_raw.z) if T_glb is not None else None,
            }
        )

    stretch = _stretch(body, full, dest_glb) if body and full else None

    out = {
        "schema": "m2-pelvis-stage-audit/v1",
        "hashes": hashes,
        "animatedBlendReference": "postprocess (close_loop + foot plant + idle double-plant); not raw retarget",
        "exportedGlbReference": "same postprocess, glTF reimport",
        "rawReference": "retarget_frame on human-v1.blend dest at bake-matched Mixamo sample time; no plant/loop",
        "Cdet": C.determinant(),
        "idlePlantFunction": "retarget_human_v1._idle_double_plant_pose L915: Hips.matrix_basis=dest_rest basis; keep loc/scale; restore upper-body world",
        "closeLoop": "retarget_human_v1.close_loop L1239: slerp last LOOP_BLEND_FRAMES=4 dest frames to frame 1",
        "footPlant": "correct_foot_contact adds world-Z to Hips translation after close_loop; both_stance idle only",
        "maxFrameDeltaM_definition": (
            "_worst_step(lifts): max |ΔL| of consecutive per-frame Hips world-Z plant lifts, "
            "not foot XY drift. Run bindingFloorConflict 58.3mm > LIFT_MAX_STEP 10mm so hips-only cannot cap."
        ),
        "m2DocumentedRunStepBoundM": 0.055,
        "m2eCorrection5RunMaxFrameDeltaM": 0.055,
        "currentRunMaxFrameDeltaM": 0.051323398232460016,
        "clips": rows,
        "stretch": stretch,
    }
    (EVID / "stage-audit.json").write_text(json.dumps(out, indent=2))
    print("WROTE", EVID / "stage-audit.json")
    for r in rows:
        print(
            r["clip"],
            "f",
            r["destFrame"],
            "src",
            round(r["srcMatchedFrame"], 3),
            "raw-pred",
            round(r["rawVsPredictedDeg"], 4),
            "post-raw",
            None if r["postGlbVsRawDeg"] is None else round(r["postGlbVsRawDeg"], 4),
            "remap",
            round(r["srcRemapNaiveVsMatchedDeg"], 4),
            "zΔ",
            r["hipsWorldZ_deltaM"],
        )
    if stretch:
        print("stretch", stretch.get("summary"))


def _stretch(body, full, dest_glb):
    import importlib.util

    p = Path(__file__).resolve().parent / "diagnose-deformation-lbs.py"
    spec = importlib.util.spec_from_file_location("diagnose_deformation_lbs", p)
    lbs = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(lbs)
    play(dest_glb, "walk", 10)
    # Copy walk pose local onto rest dest? deform table from dest_glb
    D, _ = lbs.deform_table(dest_glb)
    abdomen = []
    for v in body.data.vertices:
        co = v.co
        if 0.88 <= co.z <= 1.08 and abs(co.x) <= 0.07 and co.y <= -0.02:
            abdomen.append(v.index)
    pos_rest, pos_ful, pos_red = {}, {}, {}
    for vi in abdomen:
        P = lbs.rest_world(body, vi)
        pos_rest[vi] = P
        red, _ = lbs.vertex_weights(body, vi)
        ful, _ = lbs.vertex_weights(full, vi)
        pr, _, _ = lbs.lbs(P, red, D)
        pf, _, _ = lbs.lbs(P, ful, D)
        if pr is None or pf is None:
            continue
        pos_red[vi] = pr
        pos_ful[vi] = pf
    idset = set(pos_red) & set(pos_ful)
    excess = []
    full_ratio = []
    red_ratio = []
    for e in body.data.edges:
        a, b = e.vertices
        if a not in idset or b not in idset:
            continue
        rest = (pos_rest[a] - pos_rest[b]).length
        if rest < 1e-8:
            continue
        rf = (pos_ful[a] - pos_ful[b]).length / rest
        rr = (pos_red[a] - pos_red[b]).length / rest
        full_ratio.append(rf)
        red_ratio.append(rr)
        excess.append(rr - rf)
    if not excess:
        return None
    return {
        "abdomenEdges": len(excess),
        "fullStretchMax": max(full_ratio),
        "reducedStretchMax": max(red_ratio),
        "excessReducedMinusFullMax": max(excess),
        "excessReducedMinusFullMean": sum(excess) / len(excess),
        "gate1_3": 1.3,
        "reducedExceedsGate": max(red_ratio) > 1.3,
        "fullExceedsGate": max(full_ratio) > 1.3,
        "note": (
            "ratio=posed_edge/rest_edge. Excess is reduction damage on the same edges. "
            "Absolute max stretch is physiological gait if full≈reduced."
        ),
        "summary": {
            "fullMax": max(full_ratio),
            "redMax": max(red_ratio),
            "excessMax": max(excess),
        },
    }


if __name__ == "__main__":
    main()
