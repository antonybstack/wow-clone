"""Isolated Human waist/shorts deformation diagnosis.

Never connects to the live shrine / MCP 9876. Background Blender only:

  /Applications/Blender.app/Contents/MacOS/Blender --background --python \\
    scripts/character-assets/diagnose-deformation.py

Reads existing human-v1.blend (full-weight body) and human-animated-v1.glb.
Writes ve-capture/m2-deformation-diagnosis/** only.
"""
from __future__ import annotations

import hashlib
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree

ROOT = Path(__file__).resolve().parents[2]
BLEND_REST = ROOT / "blender/characters/human-v1.blend"
GLB_REST = ROOT / "public/characters/bodies/human-v1.glb"
GLB_ANIM = ROOT / "public/characters/bodies/human-animated-v1.glb"
SRC_WEIGHTS = ROOT / "blender/characters/sources/default_weights.mhw"
EVID = ROOT / "ve-capture/m2-deformation-diagnosis"
REPORT = EVID / "diagnosis.json"

WALK_CLIP = "walk"
WALK_FRAME = 10  # 1-based; contact-sheet timeForFrame: (10-1)/30 = 0.3 s
WALK_TIME_S = 0.3
FPS = 30
UNITS = "meters"

# Front abdomen / waistband patch in Blender rest (Z-up, -Y forward).
ABDOMEN_Z = (0.88, 1.08)
ABDOMEN_X = 0.07
ABDOMEN_Y_MAX = -0.02
PEC_Z = (1.18, 1.42)
PEC_X = (0.04, 0.18)
WAISTBAND_TOP_FRAC = 0.08  # top fraction of shorts verts by Z


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def vlist(v):
    return [float(v.x), float(v.y), float(v.z)]


def blender_zup_to_gltf_yup(v):
    """Blender (X,Y,Z) Z-up → glTF/Lite (X,Y,Z) Y-up: (x, z, -y)."""
    if hasattr(v, "x"):
        return [float(v.x), float(v.z), float(-v.y)]
    return [float(v[0]), float(v[2]), float(-v[1])]


def vertex_weights(obj, vi, eps=1e-8):
    items = []
    for g in obj.vertex_groups:
        try:
            w = g.weight(vi)
        except RuntimeError:
            continue
        if w > eps:
            items.append({"joint": g.name, "weight": float(w)})
    items.sort(key=lambda r: -r["weight"])
    total = sum(r["weight"] for r in items)
    return items, float(total)


def eval_world_positions(obj):
    bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get()
    ev = obj.evaluated_get(dg)
    mat = ev.matrix_world.copy()
    mesh = ev.to_mesh()
    try:
        return [mat @ v.co.copy() for v in mesh.vertices], mat.copy()
    finally:
        ev.to_mesh_clear()


def eval_world_normals(obj):
    bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get()
    ev = obj.evaluated_get(dg)
    mat = ev.matrix_world.copy()
    mesh = ev.to_mesh()
    try:
        acc = [Vector((0, 0, 0)) for _ in mesh.vertices]
        rot = mat.to_3x3()
        for p in mesh.polygons:
            n = (rot @ p.normal)
            if n.length > 1e-8:
                n.normalize()
            for vi in p.vertices:
                acc[vi] += n
        out = []
        for n in acc:
            out.append(n.normalized() if n.length > 1e-8 else Vector((0, 0, 1)))
        return out
    finally:
        ev.to_mesh_clear()


def bvh_of(obj):
    bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get()
    ev = obj.evaluated_get(dg)
    return BVHTree.FromObject(ev, dg)


def signed_hits(src_pts, dst_obj, indices=None):
    """Nearest-face signed distance (m) from src world points onto dst mesh.

    Negative = src point is on the inward side of dst's face normal (penetration
    if dst normals are outward).
    """
    tree = bvh_of(dst_obj)
    nrm = eval_world_normals(dst_obj)
    hits = []
    if indices is None:
        indices = range(len(src_pts))
    for vi in indices:
        p = src_pts[vi]
        loc, _fn, idx, dist = tree.find_nearest(p)
        if loc is None:
            continue
        sign_n = nrm[idx] if 0 <= idx < len(nrm) else Vector((0, 0, 1))
        delta = p - loc
        signed = float(delta.dot(sign_n))
        # find_nearest dist is always >= 0; restore sign.
        if abs(signed) < 1e-12:
            signed = 0.0
        else:
            signed = math.copysign(float(dist), signed)
        hits.append(
            {
                "srcVertexId": int(vi),
                "dstFaceVertexId": int(idx),
                "signedDistanceM": signed,
                "absDistanceM": float(dist),
                "srcWorldBlenderZup": vlist(p),
                "srcWorldGltfYup": blender_zup_to_gltf_yup(p),
                "hitWorldBlenderZup": vlist(loc),
            }
        )
    return hits


def summarize_hits(hits, label):
    if not hits:
        return {"label": label, "count": 0}
    signed = [h["signedDistanceM"] for h in hits]
    inside = [h for h in hits if h["signedDistanceM"] < -1e-4]
    worst_in = min(hits, key=lambda h: h["signedDistanceM"])
    worst_out = max(hits, key=lambda h: h["signedDistanceM"])
    return {
        "label": label,
        "count": len(hits),
        "units": UNITS,
        "minSignedM": min(signed),
        "maxSignedM": max(signed),
        "meanSignedM": sum(signed) / len(signed),
        "penetratingCount": len(inside),
        "worstPenetrationM": worst_in["signedDistanceM"] if inside else 0.0,
        "worstPenetrationVertexId": worst_in["srcVertexId"] if inside else None,
        "worstOutsideM": worst_out["signedDistanceM"],
        "worstInside": worst_in if inside else None,
        "note": "signed<0 means source point is inside destination (outward normals)",
    }


def select_patch(obj, pts, predicate, limit=24):
    ids = [i for i, p in enumerate(pts) if predicate(p)]
    ids.sort(key=lambda i: (pts[i].x ** 2 + max(pts[i].y, 0.0) ** 2, -pts[i].z))
    return ids[:limit] if limit else ids


def rest_local(obj):
    return [v.co.copy() for v in obj.data.vertices]


def find_obj(name_substr, obj_type=None, collection=None):
    cands = []
    for o in bpy.data.objects:
        if obj_type and o.type != obj_type:
            continue
        if collection is not None and o.name not in {x.name for x in collection.objects}:
            # also accept children parented into the collection via armature
            in_coll = False
            for c in o.users_collection:
                if c == collection:
                    in_coll = True
                    break
            if not in_coll:
                continue
        if name_substr.lower() in o.name.lower():
            cands.append(o)
    cands.sort(key=lambda o: (len(o.name), o.name))
    return cands[0] if cands else None


def play_action(arm, action, frame):
    ad = arm.animation_data
    if ad is None:
        ad = arm.animation_data_create()
    for t in list(ad.nla_tracks):
        t.mute = True
        for s in t.strips:
            s.mute = True
    ad.action = action
    slots = getattr(action, "slots", None)
    if slots is not None and len(slots) and hasattr(ad, "action_slot"):
        try:
            ad.action_slot = slots[0]
        except Exception:
            pass
    bpy.context.scene.frame_set(int(frame))
    bpy.context.view_layer.update()


def find_action(name):
    exact = bpy.data.actions.get(name)
    if exact:
        return exact
    for a in bpy.data.actions:
        if a.name == name or a.name.startswith(name + "_") or a.name.startswith(name + "."):
            return a
    return None


def bone_world(arm, name):
    pb = arm.pose.bones.get(name)
    if pb is None:
        return None
    return arm.matrix_world @ pb.matrix


def helper_report(arm, names):
    rows = []
    bpy.context.view_layer.update()
    for name in names:
        pb = arm.pose.bones.get(name)
        if pb is None:
            rows.append({"name": name, "present": False})
            continue
        db = arm.data.bones.get(name)
        basis = pb.matrix_basis
        q = basis.to_quaternion()
        parent = pb.parent.name if pb.parent else None
        w = bone_world(arm, name)
        pw = bone_world(arm, parent) if parent else None
        rel_deg = None
        if w is not None and pw is not None:
            rel_deg = math.degrees(w.to_quaternion().rotation_difference(pw.to_quaternion()).angle)
        rows.append(
            {
                "name": name,
                "present": True,
                "parent": parent,
                "deform": bool(db.use_deform) if db else None,
                "matrixBasisAngleDeg": float(math.degrees(q.angle)),
                "locationBasisM": vlist(pb.location),
                "worldHeadBlenderZup": vlist(w.translation) if w else None,
                "worldHeadGltfYup": blender_zup_to_gltf_yup(w.translation) if w else None,
                "angleVsParentDeg": rel_deg,
                "keyed": None,
            }
        )
    return rows


def copy_pose_local(src_arm, dst_arm):
    for pb in dst_arm.pose.bones:
        sp = src_arm.pose.bones.get(pb.name)
        if sp is None:
            continue
        pb.rotation_mode = "QUATERNION"
        sp.rotation_mode = "QUATERNION"
        pb.matrix_basis = sp.matrix_basis.copy()
    bpy.context.view_layer.update()


def clear_pose(arm):
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode="POSE")
    for b in arm.pose.bones:
        b.matrix_basis.identity()
    bpy.ops.object.mode_set(mode="OBJECT")
    bpy.context.view_layer.update()


def influence_count_hist(obj, vert_ids):
    hist = {}
    over4 = 0
    for vi in vert_ids:
        items, total = vertex_weights(obj, vi)
        n = len(items)
        hist[n] = hist.get(n, 0) + 1
        if n > 4:
            over4 += 1
    return {"influenceCountHistogram": hist, "vertsWithMoreThan4Influences": over4}


def describe_vert(obj, vi, posed_pts, rest_pts, pose_label, time_s):
    items, total = vertex_weights(obj, vi)
    rp = rest_pts[vi] if vi < len(rest_pts) else None
    pp = posed_pts[vi] if vi < len(posed_pts) else None
    return {
        "mesh": obj.name,
        "vertexId": int(vi),
        "pose": pose_label,
        "timeSec": time_s,
        "units": UNITS,
        "jointNames": [r["joint"] for r in items],
        "influences": items[:8],
        "influenceCount": len(items),
        "weightSum": total,
        "restBlenderZup": vlist(rp) if rp is not None else None,
        "restGltfYup": blender_zup_to_gltf_yup(rp) if rp is not None else None,
        "posedBlenderZup": vlist(pp) if pp is not None else None,
        "posedGltfYup": blender_zup_to_gltf_yup(pp) if pp is not None else None,
    }


def weight_discontinuity(obj, vert_ids, mesh):
    """Count edges whose endpoints have different dominant joints."""
    switches = 0
    edges = 0
    examples = []
    idset = set(vert_ids)
    for e in mesh.edges:
        a, b = e.vertices
        if a not in idset or b not in idset:
            continue
        wa, _ = vertex_weights(obj, a)
        wb, _ = vertex_weights(obj, b)
        if not wa or not wb:
            continue
        edges += 1
        if wa[0]["joint"] != wb[0]["joint"]:
            switches += 1
            if len(examples) < 6:
                examples.append(
                    {
                        "a": a,
                        "b": b,
                        "jointA": wa[0]["joint"],
                        "jointB": wb[0]["joint"],
                        "wA": wa[0]["weight"],
                        "wB": wb[0]["weight"],
                    }
                )
    return {"edgesInPatch": edges, "dominantJointSwitches": switches, "examples": examples}


def setup_render(path, target, loc, res=720):
    scene = bpy.context.scene
    try:
        scene.render.engine = "BLENDER_WORKBENCH"
    except TypeError:
        try:
            scene.render.engine = "BLENDER_EEVEE_NEXT"
        except TypeError:
            scene.render.engine = "CYCLES"
    scene.render.resolution_x = res
    scene.render.resolution_y = res
    scene.render.resolution_percentage = 100
    scene.render.filepath = str(path)
    scene.render.image_settings.file_format = "PNG"
    cam = bpy.data.objects.get("DiagCam")
    if cam is None:
        data = bpy.data.cameras.new("DiagCam")
        cam = bpy.data.objects.new("DiagCam", data)
        bpy.context.scene.collection.objects.link(cam)
    cam.data.lens = 85
    cam.location = loc
    direction = target - Vector(loc)
    cam.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    scene.camera = cam
    bpy.ops.render.render(write_still=True)


def hide_all_except(keep):
    keep = {o.name for o in keep if o is not None}
    for o in bpy.data.objects:
        hide = o.name not in keep and o.type != "CAMERA" and o.type != "LIGHT"
        o.hide_render = hide
        o.hide_viewport = hide


def import_glb(path, coll_name):
    coll = bpy.data.collections.new(coll_name)
    bpy.context.scene.collection.children.link(coll)
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(path))
    added = [o for o in bpy.data.objects if o not in before]
    for o in added:
        for c in list(o.users_collection):
            try:
                c.objects.unlink(o)
            except RuntimeError:
                pass
        if o.name not in coll.objects:
            coll.objects.link(o)
    return added, coll


def main():
    EVID.mkdir(parents=True, exist_ok=True)
    hashes = {}
    for key, path in (
        ("human-v1.glb", GLB_REST),
        ("human-animated-v1.glb", GLB_ANIM),
        ("human-v1.blend", BLEND_REST),
        ("default_weights.mhw", SRC_WEIGHTS),
    ):
        hashes[key] = {
            "path": str(path.relative_to(ROOT)),
            "sha256": sha256(path) if path.exists() else None,
            "bytes": path.stat().st_size if path.exists() else None,
        }

    if not BLEND_REST.exists():
        raise SystemExit(f"missing {BLEND_REST}")
    bpy.ops.wm.open_mainfile(filepath=str(BLEND_REST), load_ui=False)
    bpy.context.scene.render.fps = FPS
    bpy.context.scene.unit_settings.system = "METRIC"
    bpy.context.scene.unit_settings.scale_length = 1.0

    body = find_obj("HumanBody", "MESH")
    # Prefer the reduced export body, not BodyFullW
    for o in bpy.data.objects:
        if o.type == "MESH" and o.name == "HumanBody":
            body = o
    body_full = None
    for o in bpy.data.objects:
        if o.type == "MESH" and "FullW" in o.name:
            body_full = o
    shorts = find_obj("HumanShorts", "MESH")
    arm_rest = None
    for o in bpy.data.objects:
        if o.type == "ARMATURE" and "Human" in o.name:
            arm_rest = o
            break
    if body is None or shorts is None or arm_rest is None:
        raise SystemExit(
            f"rest objects missing body={getattr(body,'name',None)} "
            f"shorts={getattr(shorts,'name',None)} arm={getattr(arm_rest,'name',None)}"
        )

    for o in (body, shorts, body_full):
        if o is None:
            continue
        o.hide_viewport = False
        o.hide_render = False

    clear_pose(arm_rest)
    rest_body_pts, body_mat_rest = eval_world_positions(body)
    rest_shorts_pts, shorts_mat_rest = eval_world_positions(shorts)
    rest_full_pts = eval_world_positions(body_full)[0] if body_full else None
    rest_body_local = rest_local(body)
    rest_shorts_local = rest_local(shorts)

    abdomen_ids = select_patch(
        body,
        rest_body_pts,
        lambda p: ABDOMEN_Z[0] <= p.z <= ABDOMEN_Z[1] and abs(p.x) <= ABDOMEN_X and p.y <= ABDOMEN_Y_MAX,
        limit=32,
    )
    pec_ids = select_patch(
        body,
        rest_body_pts,
        lambda p: PEC_Z[0] <= p.z <= PEC_Z[1] and PEC_X[0] <= abs(p.x) <= PEC_X[1] and p.y <= 0.02,
        limit=16,
    )
    shorts_z = [p.z for p in rest_shorts_pts]
    zcut = sorted(shorts_z)[int((1.0 - WAISTBAND_TOP_FRAC) * (len(shorts_z) - 1))] if shorts_z else 0
    waistband_ids = select_patch(
        shorts,
        rest_shorts_pts,
        lambda p: p.z >= zcut - 1e-4 and abs(p.x) <= 0.09 and p.y <= 0.02,
        limit=32,
    )

    rest_shorts_in_body = signed_hits(rest_shorts_pts, body, waistband_ids)
    rest_body_in_shorts = signed_hits(rest_body_pts, shorts, abdomen_ids)

    full_vs_reduced_rest = None
    if rest_full_pts is not None:
        dists = []
        for i in range(min(len(rest_body_pts), len(rest_full_pts))):
            d = (rest_body_pts[i] - rest_full_pts[i]).length
            dists.append((d, i))
        dists.sort(reverse=True)
        abd = [(rest_body_pts[i] - rest_full_pts[i]).length for i in abdomen_ids if i < len(rest_full_pts)]
        pec = [(rest_body_pts[i] - rest_full_pts[i]).length for i in pec_ids if i < len(rest_full_pts)]
        full_vs_reduced_rest = {
            "available": True,
            "meshFull": body_full.name,
            "meshReduced": body.name,
            "pose": "rest_identity",
            "timeSec": 0.0,
            "units": UNITS,
            "maxM": dists[0][0] if dists else 0.0,
            "maxVertexId": dists[0][1] if dists else None,
            "p95M": dists[int(0.05 * (len(dists) - 1))][0] if dists else 0.0,
            "abdomenMaxM": max(abd) if abd else None,
            "pecMaxM": max(pec) if pec else None,
            "note": "Identity pose on A-pose-baked meshes. Nonzero => rest geometries diverged at bake_pose_as_rest.",
        }

    abdomen_full_vs_4_weights = []
    if body_full is not None:
        for vi in abdomen_ids[:12]:
            red, rs = vertex_weights(body, vi)
            ful, fs = vertex_weights(body_full, vi)
            red_names = {r["joint"] for r in red}
            ful_names = {r["joint"] for r in ful}
            abdomen_full_vs_4_weights.append(
                {
                    "meshReduced": body.name,
                    "meshFull": body_full.name,
                    "vertexId": vi,
                    "pose": "rest_bind",
                    "timeSec": 0.0,
                    "units": UNITS,
                    "reduced": {"influences": red, "weightSum": rs, "influenceCount": len(red)},
                    "full": {"influences": ful[:12], "weightSum": fs, "influenceCount": len(ful)},
                    "droppedJoints": sorted(ful_names - red_names),
                    "addedJoints": sorted(red_names - ful_names),
                    "groupIndexChanged": any(
                        (i >= len(ful) or red[i]["joint"] != ful[i]["joint"]) for i in range(min(4, len(red)))
                    ),
                }
            )

    shorts_full_weights_available = False
    shorts_weight_source = (
        "HumanShorts is bpy.ops.object.duplicate of HumanBody AFTER mh_studio.assign_weights(limited). "
        "make_shorts then bisects; new verts get Blender-interpolated 4-influence groups. "
        "No full-weight shorts object exists. Do not invent one from reduced data."
    )

    # --- import animated GLB ---
    added, anim_coll = import_glb(GLB_ANIM, "AnimatedDiag")
    anim_arm = None
    anim_body = None
    anim_shorts = None
    for o in added:
        if o.type == "ARMATURE" and anim_arm is None:
            anim_arm = o
        if o.type == "MESH":
            n = o.name.lower()
            if "body" in n and "full" not in n and "short" not in n and "hair" not in n and "eye" not in n and "brow" not in n:
                anim_body = o
            if "short" in n:
                anim_shorts = o
    if anim_body is None:
        for o in added:
            if o.type == "MESH" and o.parent == anim_arm and "Body" in o.name:
                anim_body = o
    if anim_arm is None or anim_body is None or anim_shorts is None:
        names = [f"{o.name}:{o.type}" for o in added]
        raise SystemExit(f"animated import missing arm/body/shorts: {names[:40]}")

    walk = find_action(WALK_CLIP)
    if walk is None:
        raise SystemExit(f"no walk action; have {[a.name for a in bpy.data.actions]}")
    # Identity rest of the *imported animated* GLB (bind pose), before walk.
    ad = anim_arm.animation_data
    if ad is not None:
        ad.action = None
        for t in ad.nla_tracks:
            t.mute = True
            for s in t.strips:
                s.mute = True
    clear_pose(anim_arm)
    anim_rest_body_pts, _ = eval_world_positions(anim_body)
    anim_rest_shorts_pts, _ = eval_world_positions(anim_shorts)
    anim_rest_shorts_in_body = signed_hits(
        anim_rest_shorts_pts, anim_body, waistband_ids if len(anim_rest_shorts_pts) == len(rest_shorts_local) else None
    )
    anim_rest_body_in_shorts = signed_hits(
        anim_rest_body_pts, anim_shorts, abdomen_ids if len(anim_rest_body_pts) == len(rest_body_local) else None
    )

    play_action(anim_arm, walk, WALK_FRAME)
    anim_body_pts, anim_body_mat = eval_world_positions(anim_body)
    anim_shorts_pts, anim_shorts_mat = eval_world_positions(anim_shorts)

    # Vertex identity: animated GLB is a retarget of human-v1.glb, so bind-space
    # vertex counts/order should match. Verify by rest-local AABB, not assumed.
    anim_body_rest_local = rest_local(anim_body)
    anim_shorts_rest_local = rest_local(anim_shorts)
    body_count_match = len(anim_body_rest_local) == len(rest_body_local)
    shorts_count_match = len(anim_shorts_rest_local) == len(rest_shorts_local)

    walk_shorts_in_body = signed_hits(anim_shorts_pts, anim_body, waistband_ids if shorts_count_match else None)
    walk_body_in_shorts = signed_hits(anim_body_pts, anim_shorts, abdomen_ids if body_count_match else None)

    # Displacement of abdomen / waistband from rest (same vertex ids if counts match)
    def disp(rest_pts, posed_pts, ids):
        rows = []
        for vi in ids:
            if vi >= len(rest_pts) or vi >= len(posed_pts):
                continue
            d = posed_pts[vi] - rest_pts[vi]
            rows.append((d.length, vi, d))
        rows.sort(reverse=True)
        return rows

    abd_disp = disp(anim_rest_body_pts, anim_body_pts, abdomen_ids) if body_count_match else []
    wb_disp = disp(anim_rest_shorts_pts, anim_shorts_pts, waistband_ids) if shorts_count_match else []
    pec_disp = disp(anim_rest_body_pts, anim_body_pts, pec_ids) if body_count_match else []

    # Relative shorts-vs-body motion for nearest pairs at rest
    pair_rows = []
    if body_count_match and shorts_count_match:
        for si in waistband_ids[:16]:
            sp = anim_rest_shorts_pts[si]
            best = None
            for bi in abdomen_ids:
                d = (anim_rest_body_pts[bi] - sp).length
                if best is None or d < best[0]:
                    best = (d, bi)
            if best is None:
                continue
            bi = best[1]
            rest_sp = anim_rest_shorts_pts[si]
            rest_bp = anim_rest_body_pts[bi]
            rest_gap = rest_sp - rest_bp
            pose_gap = anim_shorts_pts[si] - anim_body_pts[bi]
            pair_rows.append(
                {
                    "shortsVertexId": si,
                    "bodyVertexId": bi,
                    "restSeparationM": rest_gap.length,
                    "posedSeparationM": pose_gap.length,
                    "deltaSeparationM": pose_gap.length - rest_gap.length,
                    "restGapBlenderZup": vlist(rest_gap),
                    "posedGapBlenderZup": vlist(pose_gap),
                    "posedGapGltfYup": blender_zup_to_gltf_yup(pose_gap),
                }
            )

    helpers = helper_report(
        anim_arm,
        [
            "Hips",
            "Spine",
            "spine04",
            "Spine2",
            "spine02",
            "spine01",
            "breast.L",
            "breast.R",
            "pelvis.L",
            "pelvis.R",
            "LeftUpLeg",
            "RightUpLeg",
            "upperleg02.L",
            "upperleg02.R",
            "LeftShoulder",
            "RightShoulder",
            "shoulder01.L",
            "shoulder01.R",
        ],
    )

    # Copy walk local pose onto rest armature to compare full vs reduced at same pose.
    full_vs_reduced_walk = None
    if body_full is not None:
        copy_pose_local(anim_arm, arm_rest)
        posed_red, _ = eval_world_positions(body)
        posed_full, _ = eval_world_positions(body_full)
        dists = []
        for i in range(min(len(posed_red), len(posed_full))):
            d = (posed_red[i] - posed_full[i]).length
            dists.append((d, i))
        dists.sort(reverse=True)
        abd = [(posed_red[i] - posed_full[i]).length for i in abdomen_ids if i < len(posed_full)]
        pec = [(posed_red[i] - posed_full[i]).length for i in pec_ids if i < len(posed_full)]
        worst_abd = []
        for vi in abdomen_ids[:12]:
            if vi >= len(posed_red) or vi >= len(posed_full):
                continue
            worst_abd.append(
                {
                    "vertexId": vi,
                    "deltaM": (posed_red[vi] - posed_full[vi]).length,
                    "reducedPosGltfYup": blender_zup_to_gltf_yup(posed_red[vi]),
                    "fullPosGltfYup": blender_zup_to_gltf_yup(posed_full[vi]),
                }
            )
        worst_abd.sort(key=lambda r: -r["deltaM"])
        full_vs_reduced_walk = {
            "available": True,
            "method": "copy anim_arm.matrix_basis onto rest HumanV1; evaluate HumanBody vs HumanBodyFullW",
            "pose": "walk",
            "timeSec": WALK_TIME_S,
            "frame": WALK_FRAME,
            "units": UNITS,
            "maxM": dists[0][0] if dists else 0.0,
            "maxVertexId": dists[0][1] if dists else None,
            "p95M": dists[int(0.05 * (len(dists) - 1))][0] if dists else 0.0,
            "abdomenMaxM": max(abd) if abd else None,
            "pecMaxM": max(pec) if pec else None,
            "abdomenSample": worst_abd[:8],
        }

    patch_verts = []
    for vi in abdomen_ids[:8]:
        patch_verts.append(describe_vert(anim_body if body_count_match else body, vi, anim_body_pts, anim_body_rest_local, "walk", WALK_TIME_S))
    shorts_patch = []
    src_shorts = anim_shorts if shorts_count_match else shorts
    for vi in waistband_ids[:8]:
        shorts_patch.append(describe_vert(src_shorts, vi, anim_shorts_pts, anim_shorts_rest_local, "walk", WALK_TIME_S))

    disc_body = weight_discontinuity(body, abdomen_ids, body.data)
    disc_shorts = weight_discontinuity(shorts, waistband_ids, shorts.data)

    # IBM / rest-bone compare for a few joints (armature rest, not pose)
    ibm_rows = []
    for name in ("Hips", "Spine", "spine04", "Spine2", "spine01", "LeftUpLeg"):
        a = arm_rest.data.bones.get(name)
        b = anim_arm.data.bones.get(name)
        if a is None or b is None:
            ibm_rows.append({"joint": name, "present": False})
            continue
        da = (arm_rest.matrix_world @ a.matrix_local).translation
        db = (anim_arm.matrix_world @ b.matrix_local).translation
        ibm_rows.append(
            {
                "joint": name,
                "restHeadDeltaM": (da - db).length,
                "restHeadRestBlenderZup": vlist(da),
                "restHeadAnimBlenderZup": vlist(db),
                "note": "edit-bone matrix_local translation; not a full IBM matrix compare",
            }
        )

    # Renders: rest waist (source) and walk waist (animated)
    hide_all_except([body, shorts, arm_rest])
    setup_render(
        EVID / "blender-rest-waist.png",
        Vector((0.0, -0.04, 0.98)),
        Vector((0.0, -0.85, 1.05)),
    )
    hide_all_except([anim_body, anim_shorts, anim_arm])
    setup_render(
        EVID / "blender-walk-0.3s-waist.png",
        Vector((0.0, -0.04, 0.98)),
        Vector((0.0, -0.85, 1.05)),
    )
    # Three-quarter walk for pecs
    setup_render(
        EVID / "blender-walk-0.3s-three-quarter.png",
        Vector((0.0, -0.02, 1.15)),
        Vector((0.55, -1.15, 1.35)),
    )

    bpy.ops.wm.save_as_mainfile(filepath=str(EVID / "throwaway-diagnosis.blend"))

    live_patch = {
        "clip": WALK_CLIP,
        "timeSec": WALK_TIME_S,
        "frame": WALK_FRAME,
        "fps": FPS,
        "coordinateConversion": "Blender Z-up (x,y,z) -> glTF/Lite Y-up (x,z,-y)",
        "abdomenVertexIds": abdomen_ids[:12],
        "waistbandVertexIds": waistband_ids[:12],
        "pecVertexIds": pec_ids[:8],
        "bodyMeshNameHints": [anim_body.name, body.name],
        "shortsMeshNameHints": [anim_shorts.name, shorts.name],
        "bodyVertexCountRest": len(rest_body_local),
        "bodyVertexCountAnim": len(anim_body_rest_local),
        "shortsVertexCountRest": len(rest_shorts_local),
        "shortsVertexCountAnim": len(anim_shorts_rest_local),
        "vertexIdIdentityBody": body_count_match,
        "vertexIdIdentityShorts": shorts_count_match,
    }

    report = {
        "schema": "m2-deformation-diagnosis/v1",
        "profile": "human",
        "clip": WALK_CLIP,
        "walkTimeSec": WALK_TIME_S,
        "walkFrame": WALK_FRAME,
        "walkTimeSource": (
            "ve-capture/m2-motion/capture-c2.json profiles.human.stills.walk.time = 0.3; "
            "ve-capture/m2-motion/report.json clips.walk.frames[0] frame=10 time=0.3; "
            "scripts/contact-sheet.mjs CLIP_FRAMES.walk=[10,20,30] timeForFrame=(frame-1)/30"
        ),
        "units": UNITS,
        "hashes": hashes,
        "pinnedAnimatedFromMotionReport": "38e80f30e13a5aa1fa318aef1c804cf58bd442b76b83bcf419e90bbf88c99c1c",
        "objects": {
            "restBody": body.name,
            "restBodyFull": body_full.name if body_full else None,
            "restShorts": shorts.name,
            "restArmature": arm_rest.name,
            "animBody": anim_body.name,
            "animShorts": anim_shorts.name,
            "animArmature": anim_arm.name,
            "walkAction": walk.name,
        },
        "pipelineFacts": {
            "fullWeightObject": body_full.name if body_full else None,
            "reducedWeightObject": body.name,
            "shortsInherit": shorts_weight_source,
            "shortsFullWeightsAvailable": shorts_full_weights_available,
            "restPoseBaked": "mh_studio.bake_pose_as_rest after apply_human_rest_pose; both body and shorts",
            "exportInfluences": "mh_studio.export_glb export_all_influences=False export_influence_nb=4; HumanBodyFullW not in keep set",
            "weightReduction": "mh_race.reduce_weights_pose_aware max_influences=4 (Human does call this despite comment 'not used for Human')",
            "keyPoseMappedOnly": "retarget_human_v1.key_pose keys BONE_PAIRS dest names only; spine01/spine02/breast/*02 helpers are not keyed",
        },
        "rest": {
            "shortsWaistbandVsBody": summarize_hits(rest_shorts_in_body, "source-blend rest shorts waistband vs body"),
            "bodyAbdomenVsShorts": summarize_hits(rest_body_in_shorts, "source-blend rest body abdomen vs shorts"),
            "animatedGlbBindPoseShortsVsBody": summarize_hits(anim_rest_shorts_in_body, "animated-glb identity rest shorts vs body"),
            "animatedGlbBindPoseBodyVsShorts": summarize_hits(anim_rest_body_in_shorts, "animated-glb identity rest body vs shorts"),
            "fullVsReduced": full_vs_reduced_rest,
            "bodyWorldMatrix": [list(r) for r in body_mat_rest],
            "shortsWorldMatrix": [list(r) for r in shorts_mat_rest],
        },
        "walk": {
            "timeSec": WALK_TIME_S,
            "frame": WALK_FRAME,
            "shortsWaistbandVsBody": summarize_hits(walk_shorts_in_body, "walk shorts waistband vs body"),
            "bodyAbdomenVsShorts": summarize_hits(walk_body_in_shorts, "walk body abdomen vs shorts"),
            "abdomenDisplacementMaxM": abd_disp[0][0] if abd_disp else None,
            "waistbandDisplacementMaxM": wb_disp[0][0] if wb_disp else None,
            "pecDisplacementMaxM": pec_disp[0][0] if pec_disp else None,
            "nearestPairSeparation": pair_rows,
            "fullVsReduced": full_vs_reduced_walk,
            "bodyWorldMatrix": [list(r) for r in anim_body_mat],
            "shortsWorldMatrix": [list(r) for r in anim_shorts_mat],
        },
        "weights": {
            "abdomenFullVsReduced": abdomen_full_vs_4_weights,
            "abdomenDiscontinuity": disc_body,
            "waistbandDiscontinuity": disc_shorts,
            "abdomenInfluenceHistReduced": influence_count_hist(body, abdomen_ids),
            "waistbandInfluenceHist": influence_count_hist(shorts, waistband_ids),
            "abdomenPatch": patch_verts,
            "waistbandPatch": shorts_patch,
        },
        "helpersAtWalk": helpers,
        "restBoneHeadDeltaAnimVsSource": ibm_rows,
        "livePatch": live_patch,
        "images": [
            "blender-rest-waist.png",
            "blender-walk-0.3s-waist.png",
            "blender-walk-0.3s-three-quarter.png",
        ],
        "hypotheses": {
            "restIntersection": "see rest.shortsWaistbandVsBody.penetratingCount",
            "weightLoss": "see walk.fullVsReduced.abdomenMaxM vs rest.fullVsReduced.abdomenMaxM",
            "helperOverrotation": "see helpersAtWalk matrixBasisAngleDeg for spine01/spine02/breast",
            "groupIndexChange": "see weights.abdomenFullVsReduced.droppedJoints",
            "inverseBindMismatch": "see restBoneHeadDeltaAnimVsSource",
            "liteOnly": "compare live LBS in diagnosis-live.json; Blender walk images already show the silhouette",
        },
    }
    REPORT.write_text(json.dumps(report, indent=2))
    print("WROTE", REPORT)
    print("REST_PENETRATION", report["rest"]["shortsWaistbandVsBody"])
    print("WALK_PENETRATION", report["walk"]["shortsWaistbandVsBody"])
    print("FULL_VS_4_REST", full_vs_reduced_rest)
    print("FULL_VS_4_WALK", full_vs_reduced_walk)
    print("HELPERS", json.dumps(helpers, indent=2)[:2000])


if __name__ == "__main__":
    main()
