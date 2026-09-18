"""Numeric correction: named-joint CPU LBS + stable waist patch.

Does not copy matrix_basis between rigs. One isolated background run.
Never connects to MCP 9876.
"""
from __future__ import annotations

import hashlib
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(Path(__file__).resolve().parent))
import mh_garment  # noqa: E402

BLEND_REST = ROOT / "blender/characters/human-v1.blend"
GLB_ANIM = ROOT / "public/characters/bodies/human-animated-v1.glb"
THROW = ROOT / "ve-capture/m2-deformation-diagnosis/throwaway-diagnosis.blend"
EVID = ROOT / "ve-capture/m2-deformation-diagnosis"
OUT = EVID / "diagnosis-lbs-correction.json"
DIAG = EVID / "diagnosis.json"

WALK_FRAME = 10
WALK_TIME_S = 0.3
IMPLICATED = (4335, 4323, 4341)
UNITS = "meters"


def sha256(path: Path):
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def v4(v):
    return Vector((v.x, v.y, v.z, 1.0))


def v3(p):
    return [float(p.x), float(p.y), float(p.z)]


def gltf_yup(p):
    return [float(p.x), float(p.z), float(-p.y)]


def find_mesh(name):
    o = bpy.data.objects.get(name)
    if o and o.type == "MESH":
        return o
    for x in bpy.data.objects:
        if x.type == "MESH" and x.name == name:
            return x
    return None


def find_arm(prefer):
    o = bpy.data.objects.get(prefer)
    if o and o.type == "ARMATURE":
        return o
    for x in bpy.data.objects:
        if x.type == "ARMATURE" and prefer.split(".")[0] in x.name:
            return x
    return None


def vertex_weights(obj, vi, eps=1e-8):
    items = []
    for g in obj.vertex_groups:
        try:
            w = g.weight(vi)
        except RuntimeError:
            continue
        if w > eps:
            items.append((g.name, float(w)))
    items.sort(key=lambda t: -t[1])
    s = sum(w for _, w in items)
    return items, s


def play_walk(arm):
    act = bpy.data.actions.get("walk")
    if act is None:
        for a in bpy.data.actions:
            if a.name.startswith("walk"):
                act = a
                break
    if act is None:
        raise SystemExit("no walk action")
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
    bpy.context.scene.frame_set(WALK_FRAME)
    bpy.context.view_layer.update()


def clear_action(arm):
    ad = arm.animation_data
    if ad is None:
        return
    ad.action = None
    for t in ad.nla_tracks:
        t.mute = True
    bpy.ops.object.select_all(action="DESELECT")
    arm.select_set(True)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode="POSE")
    for b in arm.pose.bones:
        b.matrix_basis.identity()
    bpy.ops.object.mode_set(mode="OBJECT")
    bpy.context.view_layer.update()


def deform_table(arm):
    """D_j = pose_world @ rest_world^-1. Missing bones omitted (no identity fallback)."""
    bpy.context.view_layer.update()
    mw = arm.matrix_world
    out = {}
    missing_inv = []
    for pb in arm.pose.bones:
        db = arm.data.bones.get(pb.name)
        if db is None:
            continue
        pose_w = mw @ pb.matrix
        rest_w = mw @ db.matrix_local
        try:
            inv = rest_w.inverted()
        except ValueError:
            missing_inv.append(pb.name)
            continue
        out[pb.name] = pose_w @ inv
    return out, missing_inv


def lbs(p, weights, D, reject_missing=True):
    """p: Vector world rest. weights: [(name,w)]. D: name->Matrix."""
    missing = [n for n, w in weights if n not in D and w > 1e-8]
    if missing and reject_missing:
        return None, missing, 0.0
    acc = Vector((0.0, 0.0, 0.0))
    used = 0.0
    hp = v4(p)
    for n, w in weights:
        if n not in D:
            continue
        q = D[n] @ hp
        acc += Vector((q.x, q.y, q.z)) * w
        used += w
    if used <= 1e-12:
        return None, missing, used
    acc = acc / used
    return acc, missing, used


def rest_world(obj, vi):
    return obj.matrix_world @ obj.data.vertices[vi].co


def map_imported(src_obj, src_ids, dst_obj, max_d=0.002):
    """Map source rest verts to imported (triangulated) verts by rest world position."""
    dst_pts = [dst_obj.matrix_world @ v.co for v in dst_obj.data.vertices]
    mapped = []
    unmatched = []
    ambiguous = []
    for vi in src_ids:
        p = rest_world(src_obj, vi)
        best = []
        for j, q in enumerate(dst_pts):
            d = (p - q).length
            if d <= max_d:
                best.append((d, j))
        best.sort()
        if not best:
            unmatched.append(vi)
            continue
        if len(best) > 1 and abs(best[0][0] - best[1][0]) < 1e-6:
            ambiguous.append({"src": vi, "dst": [b[1] for b in best[:4]], "dM": best[0][0]})
        mapped.append({"srcVertexId": vi, "importedVertexId": best[0][1], "restDeltaM": best[0][0]})
    return mapped, unmatched, ambiguous


def waist_loop(shorts):
    loops = mh_garment.mesh_boundary_loops(shorts.data)
    best, best_z = None, None
    for loop in loops:
        if len(loop) < 8:
            continue
        z = sum(shorts.data.vertices[i].co.z for i in loop) / len(loop)
        if best_z is None or z > best_z:
            best, best_z = loop, z
    return best or []


def local_clearance(src_pts, dst_obj):
    """Closest-surface signed normal distance. Local clearance estimate, not solid inside/outside."""
    bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get()
    ev = dst_obj.evaluated_get(dg)
    tree = BVHTree.FromObject(ev, dg)
    mesh = ev.to_mesh()
    try:
        mw = ev.matrix_world
        rot = mw.to_3x3()
        acc = [Vector((0, 0, 0)) for _ in mesh.vertices]
        for p in mesh.polygons:
            n = rot @ p.normal
            if n.length > 1e-8:
                n.normalize()
            for vi in p.vertices:
                acc[vi] += n
        nrm = [n.normalized() if n.length > 1e-8 else Vector((0, 0, 1)) for n in acc]
    finally:
        ev.to_mesh_clear()
    rows = []
    for vi, p in src_pts:
        loc, _fn, idx, dist = tree.find_nearest(p)
        if loc is None:
            continue
        sign_n = nrm[idx] if 0 <= idx < len(nrm) else Vector((0, 0, 1))
        signed = float((p - loc).dot(sign_n))
        signed = math.copysign(float(dist), signed) if abs(signed) > 1e-12 else 0.0
        rows.append({"srcVertexId": int(vi), "clearanceEstimateM": signed, "absM": float(dist)})
    if not rows:
        return {"count": 0}
    s = [r["clearanceEstimateM"] for r in rows]
    return {
        "count": len(rows),
        "minM": min(s),
        "maxM": max(s),
        "meanM": sum(s) / len(s),
        "negativeCount": sum(1 for x in s if x < -1e-4),
        "worst": min(rows, key=lambda r: r["clearanceEstimateM"]),
        "kind": "closest-surface signed normal distance; not solid-volume penetration",
        "units": UNITS,
    }


def import_anim():
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(GLB_ANIM))
    return [o for o in bpy.data.objects if o not in before]


def main():
    EVID.mkdir(parents=True, exist_ok=True)
    hashes = {
        "human-v1.glb": sha256(ROOT / "public/characters/bodies/human-v1.glb"),
        "human-animated-v1.glb": sha256(GLB_ANIM),
        "human-v1.blend": sha256(BLEND_REST),
    }
    bpy.ops.wm.open_mainfile(filepath=str(BLEND_REST), load_ui=False)
    bpy.context.scene.render.fps = 30
    import_anim()

    body = find_mesh("HumanBody")
    full = find_mesh("HumanBodyFullW")
    shorts = find_mesh("HumanShorts")
    src_arm = find_arm("HumanV1")
    anim_body = bpy.data.objects.get("HumanBody.001") or find_mesh("HumanBody.001")
    anim_shorts = bpy.data.objects.get("HumanShorts.001")
    anim_arm = bpy.data.objects.get("HumanV1.001")
    if anim_arm is None:
        arms = [o for o in bpy.data.objects if o.type == "ARMATURE" and o != src_arm]
        anim_arm = arms[0] if arms else None
    if anim_body is None:
        for o in bpy.data.objects:
            if o.type == "MESH" and o.name.startswith("HumanBody") and o != body and o != full:
                anim_body = o
    if anim_shorts is None:
        for o in bpy.data.objects:
            if o.type == "MESH" and "Shorts" in o.name and o != shorts:
                anim_shorts = o
    if not all([body, full, shorts, src_arm, anim_arm, anim_body, anim_shorts]):
        raise SystemExit(
            f"missing objects body={body} full={full} shorts={shorts} src_arm={src_arm} "
            f"anim_arm={anim_arm} anim_body={anim_body} anim_shorts={anim_shorts}"
        )

    # Rest correspondence: source vs imported identity pose.
    clear_action(anim_arm)
    clear_action(src_arm)
    rest_joint = []
    max_head = 0.0
    for name in ("Hips", "Spine", "spine04", "Spine2", "spine01", "LeftUpLeg", "pelvis.L", "pelvis.R"):
        a = src_arm.data.bones.get(name)
        b = anim_arm.data.bones.get(name)
        if a is None or b is None:
            rest_joint.append({"joint": name, "present": False})
            continue
        ha = src_arm.matrix_world @ a.head_local
        hb = anim_arm.matrix_world @ b.head_local
        d = (ha - hb).length
        max_head = max(max_head, d)
        rest_joint.append({"joint": name, "restHeadDeltaM": d, "src": v3(ha), "imported": v3(hb)})

    src_p = {vi: rest_world(body, vi) for vi in IMPLICATED}
    full_p = {vi: rest_world(full, vi) for vi in IMPLICATED}
    bake_delta = {
        vi: {
            "reducedRestBlenderZup": v3(src_p[vi]),
            "fullRestBlenderZup": v3(full_p[vi]),
            "aPoseBakeDeltaM": (src_p[vi] - full_p[vi]).length,
        }
        for vi in IMPLICATED
    }

    # Imported rest vs source rest for implicated verts (triangulation map).
    mapped_body, un_body, amb_body = map_imported(body, IMPLICATED, anim_body)

    play_walk(anim_arm)
    D, missing_inv = deform_table(anim_arm)
    ident = {n: Matrix.Identity(4) for n in D}

    verts_out = []
    for vi in IMPLICATED:
        red, rs = vertex_weights(body, vi)
        ful, fs = vertex_weights(full, vi)
        P = src_p[vi]  # identical P for both weight sets
        p_red, miss_r, used_r = lbs(P, red, D)
        p_ful, miss_f, used_f = lbs(P, ful, D)
        p_red_i, _, _ = lbs(P, red, ident)
        p_ful_i, _, _ = lbs(P, ful, ident)
        delta = None if (p_red is None or p_ful is None) else (p_red - p_ful).length
        id_err_r = None if p_red_i is None else (p_red_i - P).length
        id_err_f = None if p_ful_i is None else (p_ful_i - P).length
        verts_out.append(
            {
                "meshReduced": body.name,
                "meshFull": full.name,
                "vertexId": vi,
                "pose": "walk",
                "timeSec": WALK_TIME_S,
                "frame": WALK_FRAME,
                "units": UNITS,
                "P_sourceReducedRestBlenderZup": v3(P),
                "P_sourceReducedRestGltfYup": gltf_yup(P),
                "reducedInfluences": [{"joint": n, "weight": w} for n, w in red],
                "fullInfluences": [{"joint": n, "weight": w} for n, w in ful[:12]],
                "reducedWeightSum": rs,
                "fullWeightSum": fs,
                "droppedJoints": sorted({n for n, _ in ful} - {n for n, _ in red}),
                "missingJointsInDeformTableReduced": miss_r,
                "missingJointsInDeformTableFull": miss_f,
                "lbsReducedBlenderZup": None if p_red is None else v3(p_red),
                "lbsFullBlenderZup": None if p_ful is None else v3(p_ful),
                "lbsReducedGltfYup": None if p_red is None else gltf_yup(p_red),
                "lbsFullGltfYup": None if p_ful is None else gltf_yup(p_ful),
                "deltaFullVsReducedM": delta,
                "identityD_reducedErrM": id_err_r,
                "identityD_fullErrM": id_err_f,
                "normalizedUsedWeightReduced": used_r,
                "normalizedUsedWeightFull": used_f,
            }
        )

    # Stable waist patch from source shorts boundary (highest-Z loop).
    loop = waist_loop(shorts)
    # Front-ish subset of waist loop
    waist_ids = [i for i in loop if shorts.data.vertices[i].co.y < 0.02]
    if len(waist_ids) < 8:
        waist_ids = list(loop)
    mapped_w, un_w, amb_w = map_imported(shorts, waist_ids, anim_shorts, max_d=0.003)

    # Body verts near source waist plane (same ids at rest and for D-table LBS).
    wz = [shorts.data.vertices[i].co.z for i in waist_ids] or [0.95]
    z0, z1 = min(wz) - 0.02, max(wz) + 0.04
    abdomen_ids = []
    for v in body.data.vertices:
        p = v.co
        if z0 <= p.z <= z1 and abs(p.x) <= 0.07 and p.y <= -0.02:
            abdomen_ids.append(v.index)
    abdomen_ids = abdomen_ids[:40]

    # Rest clearance on SOURCE (same patch).
    rest_wb_pts = [(i, rest_world(shorts, i)) for i in waist_ids]
    rest_ab_pts = [(i, rest_world(body, i)) for i in abdomen_ids]
    rest_clear_wb = local_clearance(rest_wb_pts, body)
    rest_clear_ab = local_clearance(rest_ab_pts, shorts)

    # Walk: transform source P with reduced weights + D (body) / shorts weights + D
    walk_wb = []
    for i in waist_ids:
        wts, _ = vertex_weights(shorts, i)
        p, miss, used = lbs(rest_world(shorts, i), wts, D)
        if p is None:
            continue
        walk_wb.append((i, p))
    walk_ab = []
    for i in abdomen_ids:
        wts, _ = vertex_weights(body, i)
        p, miss, used = lbs(rest_world(body, i), wts, D)
        if p is None:
            continue
        walk_ab.append((i, p))

    # For walk clearance, evaluate imported posed meshes (visual asset) on mapped patch only.
    play_walk(anim_arm)
    bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get()

    def eval_pts(obj, id_pairs, src_key, dst_key):
        ev = obj.evaluated_get(dg)
        mesh = ev.to_mesh()
        mat = ev.matrix_world
        out = []
        try:
            for row in id_pairs:
                j = row[dst_key]
                if j < len(mesh.vertices):
                    out.append((row[src_key], mat @ mesh.vertices[j].co))
        finally:
            ev.to_mesh_clear()
        return out

    walk_clear_wb = local_clearance(eval_pts(anim_shorts, mapped_w, "srcVertexId", "importedVertexId"), anim_body)
    walk_clear_ab = local_clearance(eval_pts(anim_body, map_imported(body, abdomen_ids, anim_body)[0], "srcVertexId", "importedVertexId"), anim_shorts)

    deltas = [v["deltaFullVsReducedM"] for v in verts_out if v["deltaFullVsReducedM"] is not None]
    id_ok = all(
        (v["identityD_reducedErrM"] is not None and v["identityD_reducedErrM"] < 1e-6)
        and (v["identityD_fullErrM"] is not None and v["identityD_fullErrM"] < 1e-6)
        for v in verts_out
    )

    correction = {
        "schema": "m2-deformation-diagnosis/lbs-correction-v1",
        "hashes": hashes,
        "clip": "walk",
        "timeSec": WALK_TIME_S,
        "frame": WALK_FRAME,
        "units": UNITS,
        "method": (
            "D_j = (anim.matrix_world @ pose.matrix) @ inverse(anim.matrix_world @ data.matrix_local); "
            "same source rest P (HumanBody vertex) skinned with full vs reduced weights; "
            "missing joints rejected; no matrix_basis copy"
        ),
        "supersedes": {
            "walk.fullVsReduced": "invalid: copied anim matrix_basis onto rest HumanV1",
            "walk.shortsWaistbandVsBody.count==624": "invalid: all imported shorts verts, not waist loop",
            "walk.bodyAbdomenVsShorts.count==14517": "invalid: full imported body, not abdomen patch",
        },
        "restJointCorrespondence": {
            "maxHeadDeltaM": max_head,
            "joints": rest_joint,
            "usable": max_head < 1e-3,
        },
        "aPoseBakeRestGeometryDelta": bake_delta,
        "implicatedVerticesCpuLbs": verts_out,
        "cpuLbsMaxDeltaM": max(deltas) if deltas else None,
        "identityD_sanityPass": id_ok,
        "deformTableBoneCount": len(D),
        "deformTableInvertFailed": missing_inv,
        "importedBodyMap": {"mapped": mapped_body, "unmatched": un_body, "ambiguous": amb_body},
        "waistPatch": {
            "sourceLoopVertexCount": len(loop),
            "sourceWaistIdsUsed": waist_ids,
            "importedMap": {"mapped": mapped_w, "unmatched": un_w, "ambiguous": amb_w},
            "restClearanceShortsLoopVsBody": rest_clear_wb,
            "restClearanceAbdomenVsShorts": rest_clear_ab,
            "walkClearanceMappedShortsVsImportedBody": walk_clear_wb,
            "walkClearanceMappedAbdomenVsImportedShorts": walk_clear_ab,
        },
        "liveLite": "incomplete: no LBS patch written this session; parent owns browser",
    }
    OUT.write_text(json.dumps(correction, indent=2))

    if DIAG.exists():
        diag = json.loads(DIAG.read_text())
        if "walk" in diag and "fullVsReduced" in diag["walk"]:
            diag["walk"]["fullVsReduced_SUPERSEDED_copiedMatrixBasis"] = diag["walk"].pop("fullVsReduced")
        if "walk" in diag:
            diag["walk"]["shortsWaistbandVsBody_SUPERSEDED_unmappedAllVerts"] = diag["walk"].pop(
                "shortsWaistbandVsBody", None
            )
            diag["walk"]["bodyAbdomenVsShorts_SUPERSEDED_unmappedAllVerts"] = diag["walk"].pop(
                "bodyAbdomenVsShorts", None
            )
        diag["lbsCorrectionFile"] = str(OUT.relative_to(ROOT))
        diag["lbsCorrection"] = {
            "cpuLbsMaxDeltaM": correction["cpuLbsMaxDeltaM"],
            "identityD_sanityPass": id_ok,
            "restJointMaxHeadDeltaM": max_head,
        }
        DIAG.write_text(json.dumps(diag, indent=2))
    print("WROTE", OUT)
    print("cpuLbsMaxDeltaM", correction["cpuLbsMaxDeltaM"])
    print("identityD", id_ok, "restHead", max_head)
    for v in verts_out:
        print("vert", v["vertexId"], "dM", v["deltaFullVsReducedM"], "dropped", v["droppedJoints"])


if __name__ == "__main__":
    main()
