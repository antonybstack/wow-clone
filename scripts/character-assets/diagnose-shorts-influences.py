"""Rest-blend HumanShorts >4-influence audit. Read-only; never save the blend."""
from __future__ import annotations

import json
import math
import statistics
import sys
from pathlib import Path

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(Path(__file__).resolve().parent))
import mh_garment  # noqa: E402

BLEND = ROOT / "blender/characters/human-v1.blend"
OUT = ROOT / "ve-capture/m2-shorts-influence-audit"
EPS = 1e-8


def hist_mesh(obj):
    nvert = len(obj.data.vertices)
    counts = []
    sum_err = []
    gt4 = 0
    mx = 0
    for vi in range(nvert):
        n = 0
        s = 0.0
        for g in obj.vertex_groups:
            try:
                w = g.weight(vi)
            except RuntimeError:
                continue
            if w > EPS:
                n += 1
                s += w
        counts.append(n)
        sum_err.append(abs(s - 1.0) if n else 0.0)
        if n > 4:
            gt4 += 1
        if n > mx:
            mx = n
    hist = {}
    for c in counts:
        hist[str(c)] = hist.get(str(c), 0) + 1
    return {
        "name": obj.name,
        "vertexCount": nvert,
        "maxInfluences": mx,
        "countGt4": gt4,
        "histogram": dict(sorted(hist.items(), key=lambda kv: int(kv[0]))),
        "weightSumAbsErrorMax": max(sum_err) if sum_err else 0.0,
        "weightSumAbsErrorMean": sum(sum_err) / len(sum_err) if sum_err else 0.0,
    }


def weights_of(obj, vi):
    items = []
    for g in obj.vertex_groups:
        try:
            w = g.weight(vi)
        except RuntimeError:
            continue
        if w > EPS:
            items.append({"joint": g.name, "weight": float(w)})
    items.sort(key=lambda r: -r["weight"])
    s = sum(r["weight"] for r in items)
    if s > EPS:
        for r in items:
            r["normalized"] = r["weight"] / s
    else:
        for r in items:
            r["normalized"] = 0.0
    return items, s


def bone_head(arm, name):
    b = arm.data.bones.get(name)
    if b is None:
        return None
    p = arm.matrix_world @ b.head_local
    return [float(p.x), float(p.y), float(p.z)]


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.open_mainfile(filepath=str(BLEND), load_ui=False)
    body = bpy.data.objects.get("HumanBody")
    shorts = bpy.data.objects.get("HumanShorts")
    arm = bpy.data.objects.get("HumanV1")
    if body is None or shorts is None or arm is None:
        raise SystemExit("missing HumanBody/HumanShorts/HumanV1")
    bpy.context.view_layer.update()

    body_stats = hist_mesh(body)
    shorts_stats = hist_mesh(shorts)

    loops = mh_garment.mesh_boundary_loops(shorts.data)
    waist_z = None
    waist_ids = set()
    hem_ids = set()
    z_by_loop = []
    for loop in loops:
        if len(loop) < 6:
            continue
        zs = [shorts.data.vertices[i].co.z for i in loop]
        zmean = sum(zs) / len(zs)
        z_by_loop.append((zmean, loop))
    z_by_loop.sort(reverse=True)
    if z_by_loop:
        waist_ids = set(z_by_loop[0][1])
        waist_z = z_by_loop[0][0]
        for zmean, loop in z_by_loop[1:]:
            hem_ids.update(loop)

    hips = bone_head(arm, "Hips")
    spine = bone_head(arm, "Spine")
    lhip = bone_head(arm, "LeftUpLeg")
    rhip = bone_head(arm, "RightUpLeg")
    lknee = bone_head(arm, "LeftLeg")
    rknee = bone_head(arm, "RightLeg")
    waist_h = hips[2] if hips else 0.93
    hip_h = ((lhip[2] if lhip else 0.93) + (rhip[2] if rhip else 0.93)) * 0.5
    knee_h = ((lknee[2] if lknee else 0.5) + (rknee[2] if rknee else 0.5)) * 0.5

    affected = []
    for vi in range(len(shorts.data.vertices)):
        items, raw_sum = weights_of(shorts, vi)
        if len(items) <= 4:
            continue
        discarded = items[4:]
        lost = sum(r["normalized"] for r in discarded)
        largest_drop = discarded[0]["normalized"] if discarded else 0.0
        top4 = items[:4]
        t4 = sum(r["normalized"] for r in top4) or 1.0
        top4_renorm = [
            {"joint": r["joint"], "weight": r["normalized"] / t4} for r in top4
        ]
        p = shorts.matrix_world @ shorts.data.vertices[vi].co
        z = float(p.z)
        on_waist = vi in waist_ids
        on_hem = vi in hem_ids
        if on_waist:
            region = "waist"
        elif on_hem:
            region = "hem"
        elif z >= (waist_h + hip_h) * 0.5:
            region = "interiorNearWaist"
        elif z <= (hip_h + knee_h) * 0.5:
            region = "interiorNearHem"
        else:
            region = "interior"
        affected.append(
            {
                "vertexId": vi,
                "influenceCount": len(items),
                "rawWeightSum": raw_sum,
                "lostNormalizedMass": lost,
                "largestDroppedNormalized": largest_drop,
                "originalNormalized": [
                    {"joint": r["joint"], "weight": r["normalized"]} for r in items
                ],
                "top4Renormalized": top4_renorm,
                "worldRestBlenderZupM": [float(p.x), float(p.y), float(p.z)],
                "onWaistBoundary": on_waist,
                "onHemBoundary": on_hem,
                "region": region,
            }
        )
    affected.sort(key=lambda r: -r["lostNormalizedMass"])
    losts = [r["lostNormalizedMass"] for r in affected]

    def pct(vals, q):
        if not vals:
            return None
        s = sorted(vals)
        i = min(len(s) - 1, max(0, int(round(q * (len(s) - 1)))))
        return s[i]

    region_counts = {}
    for r in affected:
        region_counts[r["region"]] = region_counts.get(r["region"], 0) + 1
    boundary_n = sum(1 for r in affected if r["onWaistBoundary"] or r["onHemBoundary"])
    interior_n = len(affected) - boundary_n

    report = {
        "units": "meters",
        "blend": str(BLEND.relative_to(ROOT)),
        "exporter": {
            "export_all_influences": False,
            "export_influence_nb": 4,
            "note": "policy only; not a posed positional error measurement",
        },
        "body": body_stats,
        "shorts": shorts_stats,
        "landmarksWorldZupM": {
            "Hips.head": hips,
            "Spine.head": spine,
            "LeftUpLeg.head": lhip,
            "RightUpLeg.head": rhip,
            "LeftLeg.head": lknee,
            "RightLeg.head": rknee,
        },
        "boundaryLoops": {
            "count": len(loops),
            "waistVertexCount": len(waist_ids),
            "waistMeanZM": waist_z,
            "hemVertexCount": len(hem_ids),
        },
        "shortsGt4": {
            "count": len(affected),
            "boundaryCount": boundary_n,
            "interiorCount": interior_n,
            "regionCounts": region_counts,
            "lostNormalizedMassP50": pct(losts, 0.5),
            "lostNormalizedMassP95": pct(losts, 0.95),
            "lostNormalizedMassMax": max(losts) if losts else 0.0,
            "top10": affected[:10],
        },
        "consistencyWithBisect": (
            "affected verts on waist/hem loops are consistent with Blender bisect "
            "interpolating extra groups at cut-generated vertices; interior >4 "
            "would need another explanation (dissolve/smooth does not add groups)."
        ),
    }
    (OUT / "shorts-influences.json").write_text(json.dumps(report, indent=2))
    print("WROTE", OUT / "shorts-influences.json")
    print("body", body_stats)
    print("shorts", shorts_stats)
    print("gt4", len(affected), "boundary", boundary_n, "interior", interior_n)
    if losts:
        print("lost p50/p95/max", pct(losts, 0.5), pct(losts, 0.95), max(losts))


if __name__ == "__main__":
    main()
