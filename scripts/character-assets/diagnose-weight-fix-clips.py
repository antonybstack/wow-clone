"""Multi-clip CPU LBS on implicated abdomen verts. Isolated background Blender."""
from __future__ import annotations

import importlib.util
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(Path(__file__).resolve().parent))
_spec = importlib.util.spec_from_file_location(
    "diagnose_deformation_lbs", Path(__file__).resolve().parent / "diagnose-deformation-lbs.py"
)
_lbs = importlib.util.module_from_spec(_spec)
sys.modules["diagnose_deformation_lbs"] = _lbs
_spec.loader.exec_module(_lbs)

import bpy  # noqa: E402

OUT = ROOT / "ve-capture/m2-human-weight-fix/clip-lbs.json"
CLIPS = (("idle", 1, 0.0), ("walk", 10, 0.3), ("run", 8, 0.2333), ("cast", 10, 0.3))
IMPL = _lbs.IMPLICATED


def play(arm, name, frame):
    act = bpy.data.actions.get(name)
    if act is None:
        for a in bpy.data.actions:
            if a.name.startswith(name):
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
    slots = getattr(act, "slots", None)
    if slots is not None and len(slots) and hasattr(ad, "action_slot"):
        try:
            ad.action_slot = slots[0]
        except Exception:
            pass
    bpy.context.scene.frame_set(int(frame))
    bpy.context.view_layer.update()
    return True


def main():
    bpy.ops.wm.open_mainfile(filepath=str(_lbs.BLEND_REST), load_ui=False)
    bpy.context.scene.render.fps = 30
    _lbs.import_anim()
    body = _lbs.find_mesh("HumanBody")
    full = _lbs.find_mesh("HumanBodyFullW")
    src_arm = _lbs.find_arm("HumanV1")
    anim_arm = bpy.data.objects.get("HumanV1.001")
    if anim_arm is None:
        anim_arm = [o for o in bpy.data.objects if o.type == "ARMATURE" and o != src_arm][0]
    _lbs.clear_action(anim_arm)
    P = {vi: _lbs.rest_world(body, vi) for vi in IMPL}
    rows = []
    for clip, frame, t in CLIPS:
        ok = play(anim_arm, clip, frame)
        D, _ = _lbs.deform_table(anim_arm)
        rec = {"clip": clip, "frame": frame, "timeSec": t, "actionFound": ok, "verts": []}
        if ok:
            for vi in IMPL:
                red, _ = _lbs.vertex_weights(body, vi)
                ful, _ = _lbs.vertex_weights(full, vi)
                p_red, _, _ = _lbs.lbs(P[vi], red, D)
                p_ful, _, _ = _lbs.lbs(P[vi], ful, D)
                d = None if p_red is None or p_ful is None else (p_red - p_ful).length
                rec["verts"].append(
                    {
                        "vertexId": vi,
                        "deltaM": d,
                        "reducedDominant": red[0][0] if red else None,
                    }
                )
            rec["maxM"] = max(v["deltaM"] or 0 for v in rec["verts"])
        rows.append(rec)
    OUT.write_text(json.dumps({"clips": rows, "units": "meters"}, indent=2))
    print("WROTE", OUT)
    for r in rows:
        print(r["clip"], r.get("maxM"), [v["deltaM"] for v in r.get("verts", [])])


if __name__ == "__main__":
    main()
