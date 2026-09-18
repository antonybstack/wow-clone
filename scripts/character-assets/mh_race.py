"""Race-profile helpers for M2d. Does not modify mh_io.py.

Uses hm08 topology, default.mhw bone names, and named mhskel joints.
"""
from __future__ import annotations

import itertools
import math
from collections import defaultdict
from pathlib import Path

import numpy as np

import mh_io

SHORTS_PELVIS_BONES = frozenset({"Hips", "pelvis.L", "pelvis.R"})
SHORTS_THIGH_BONES = frozenset({"LeftUpLeg", "RightUpLeg", "upperleg02.L", "upperleg02.R"})
# Waist/hem boundary parameter (bone-fraction along the pelvis/thigh axis), used only
# by the bisect planes below — the face *selection* below is deliberately generous
# (no t cutoff) so both the intended waist and both intended hems fall inside it.
SHORTS_WAIST_T = 0.55
SHORTS_HEM_T = 0.55

REGION_PREFIXES = (
    ("hand", ("LeftHand", "RightHand", "finger", "metacarpal", "wrist")),
    ("foot", ("LeftFoot", "RightFoot", "LeftToeBase", "RightToeBase", "toe")),
    ("arm", ("LeftArm", "RightArm", "LeftForeArm", "RightForeArm", "upperarm")),
    ("shoulder", ("LeftShoulder", "RightShoulder", "shoulder01", "clavicle")),
    ("thigh", ("LeftUpLeg", "RightUpLeg", "upperleg", "pelvis")),
    ("shin", ("LeftLeg", "RightLeg", "lowerleg")),
    ("head", ("Head", "jaw", "eye", "oris", "levator", "special", "tongue")),
    ("neck", ("Neck", "neck")),
    ("torso", ("Spine", "spine", "breast", "Hips")),
)

HUMAN_HEIGHT_M = 1.74813
# WP-2.1 Human v2 (pre-A-pose mh_race.metrics). Used for Orc/Undead ratio gates.
CURRENT_HUMAN_V2 = {
    "heightM": 1.740738,
    "shoulderWidthM": 0.49965000000000004,
    "handLengthM": 0.20461560767616796,
    "palmWidthM": 0.0729514411590854,
    "upperArmM": 0.2543935404146249,
    "foreArmM": 0.2624184892792904,
    "thighM": 0.4296318043540307,
    "shinM": 0.4372532998446095,
}

HUMAN_V2_TARGETS = (
    ("caucasian-male-young.target", 1.0),
    ("universal-male-young-maxmuscle-maxweight.target", 0.35),
    ("head-scale-vert-decr.target", 0.32),
    ("torso-vshape-incr.target", 1.0),
    ("torso-scale-horiz-incr.target", 0.30),
    ("measure-shoulder-dist-incr.target", 1.0),
    ("measure-waist-circ-decr.target", 1.0),
    ("torso-muscle-pectoral-incr.target", 0.55),
    ("torso-muscle-dorsi-incr.target", 0.50),
)


def dominant_bone(infl) -> str | None:
    if not infl:
        return None
    if isinstance(infl, dict):
        items = infl.items()
    else:
        items = infl
    return max(items, key=lambda kv: kv[1])[0]


def region_of_weights(infl) -> str:
    name = dominant_bone(infl)
    if not name:
        return "unknown"
    for region, keys in REGION_PREFIXES:
        for key in keys:
            if name == key or name.startswith(key):
                return region
    return "other"


def _vsub(a, b):
    return (a[0] - b[0], a[1] - b[1], a[2] - b[2])


def _vdot(a, b):
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]


def _vlen(v):
    return math.sqrt(_vdot(v, v))


def _unit(v):
    n = _vlen(v)
    return (v[0] / n, v[1] / n, v[2] / n) if n > 1e-12 else (0.0, 0.0, 1.0)


def _lerp(a, b, t):
    return (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t)


def _bone_up_axis(head, tail):
    """Perpendicular-to-bone vertical reference (Blender's default roll=0 z_axis),
    sign-corrected to point toward +Z. Used for the waist plane so it is
    pelvis-relative (rotates with the Hips bone) instead of a fixed world Z.
    """
    y = _unit(_vsub(tail, head))
    up = (0.0, 0.0, 1.0)
    dot = _vdot(up, y)
    proj = (up[0] - dot * y[0], up[1] - dot * y[1], up[2] - dot * y[2])
    if _vlen(proj) < 1e-9:
        return (1.0, 0.0, 0.0)
    n = _unit(proj)
    if n[2] < 0:
        n = (-n[0], -n[1], -n[2])
    return n


def shorts_vertex_mask(weights, verts, bones):
    """Generous hm08 shorts region: pelvis + full upper-leg-bone dominance.

    No Z/parameter cutoff here on purpose — the actual waist/hem boundaries are
    cut later by shorts_bisect_planes()/bisect, not by where this selection
    happens to end. This just needs to extend above the intended waist and
    below the intended hem on both legs (verified by the caller / tests).
    Callers should grow this by several rings (see shorts_face_indices'
    grow_rings) to bridge a thin Spine-dominant seam at the pelvis center that
    this bone set alone leaves as a hole.
    """
    mask = [False] * min(len(weights), mh_io.BODY_VERTS)
    for vi in range(len(mask)):
        d = dominant_bone(weights[vi])
        if d in SHORTS_PELVIS_BONES or d in SHORTS_THIGH_BONES:
            mask[vi] = True
    return mask


def grow_face_set(loops, keep, rings=1):
    keep = set(keep)
    edge_to_faces = defaultdict(list)
    for fi, loop in enumerate(loops):
        ids = [vi for vi, _ in loop]
        for a in range(len(ids)):
            e = tuple(sorted((ids[a], ids[(a + 1) % len(ids)])))
            edge_to_faces[e].append(fi)
    for _ in range(rings):
        extra = set()
        for fi in keep:
            ids = [vi for vi, _ in loops[fi]]
            for a in range(len(ids)):
                e = tuple(sorted((ids[a], ids[(a + 1) % len(ids)])))
                for fj in edge_to_faces[e]:
                    if fj not in keep:
                        extra.add(fj)
        keep |= extra
    return sorted(keep)


def shorts_face_indices(loops, weights, verts, bones, grow_rings=5):
    mask = shorts_vertex_mask(weights, verts, bones)
    keep = []
    for fi, loop in enumerate(loops):
        ids = [vi for vi, _ in loop]
        hits = sum(1 for vi in ids if vi < len(mask) and mask[vi])
        if hits >= (len(ids) + 1) // 2:
            keep.append(fi)
    if grow_rings:
        keep = grow_face_set(loops, keep, grow_rings)
    return keep


def shorts_boundary_loops(loops, keep_faces):
    from collections import Counter

    ecount = Counter()
    for fi in keep_faces:
        ids = [vi for vi, _ in loops[fi]]
        for a in range(len(ids)):
            u, v = ids[a], ids[(a + 1) % len(ids)]
            ecount[tuple(sorted((u, v)))] += 1
    boundary = [e for e, c in ecount.items() if c == 1]
    adj = defaultdict(list)
    for u, v in boundary:
        adj[u].append(v)
        adj[v].append(u)
    used = set()
    found = []
    for start in adj:
        for nb in adj[start]:
            e0 = tuple(sorted((start, nb)))
            if e0 in used:
                continue
            loop = [start]
            prev, cur = start, nb
            used.add(e0)
            while cur != start:
                loop.append(cur)
                nxts = [x for x in adj[cur] if x != prev]
                if not nxts:
                    break
                nxt = nxts[0]
                used.add(tuple(sorted((cur, nxt))))
                prev, cur = cur, nxt
            found.append(loop)
    return found


def shorts_bisect_planes(bones):
    """Three bisect planes for the review shorts: waist + one hem per leg.

    All are true bisect cuts (point + normal on a named rest joint / thigh
    axis), not face-selection edges:
      - waist: point at SHORTS_WAIST_T along the Hips bone (head→tail), normal
        = the pelvis-relative "up" axis (_bone_up_axis) so it tilts with
        pelvis rotation (e.g. the Undead rest hunch), not a fixed world Z. The
        literal Hips head→tail direction is a ~5-7 cm near-horizontal stub in
        this rig (root joint to Spine base), unusable as a "vertical" plane
        normal on its own — _bone_up_axis is the vertical reference
        orthogonal to it, i.e. still fully pelvis/Hips-bone-relative.
      - hemLeft/hemRight: point at SHORTS_HEM_T along the hip→knee axis
        (LeftUpLeg.head → LeftLeg.head, i.e. the *full* thigh — this hm08 rig
        splits the visual thigh into upperleg01 (renamed LeftUpLeg, a short
        ~5 cm hip stub) then upperleg02 (child, unrenamed) down to the knee;
        LeftUpLeg's own head→tail alone is only that stub and would place the
        hem a couple cm below the hip crease). Normal = that hip→knee axis,
        which is already close to vertical (down the leg) by construction.
    """
    by = {b["name"]: b for b in bones}
    hips = by.get("Hips")
    l_hip, l_knee = by.get("LeftUpLeg"), by.get("LeftLeg")
    r_hip, r_knee = by.get("RightUpLeg"), by.get("RightLeg")
    if not (hips and l_hip and l_knee and r_hip and r_knee):
        raise RuntimeError(
            "shorts bisect planes need Hips, Left/RightUpLeg, Left/RightLeg"
        )

    def hem_plane(hip, knee):
        point = _lerp(hip["head"], knee["head"], SHORTS_HEM_T)
        normal = _unit(_vsub(knee["head"], hip["head"]))
        return {"point": list(point), "normal": list(normal)}

    waist_point = _lerp(hips["head"], hips["tail"], SHORTS_WAIST_T)
    waist_normal = _bone_up_axis(hips["head"], hips["tail"])
    return {
        "waist": {"point": list(waist_point), "normal": list(waist_normal)},
        "hemLeft": hem_plane(l_hip, l_knee),
        "hemRight": hem_plane(r_hip, r_knee),
    }


def shorts_face_leg(loops, verts, keep_faces):
    """Per-face leg label (0 centerline/pelvis, 1 left/+X, 2 right/-X) by mean
    vertex X position. Deliberately geometric rather than bone-dominance: a
    bone-dominance majority vote put its own left/right seam right at the
    inner-thigh/crotch region, which is close enough to the hem planes (and
    to the pelvis-selection boundary) to occasionally create a non-manifold
    boundary vertex (touched by >2 boundary edges) after bisecting — an X=0
    split keeps the classification seam at the body midline, far from both
    hem planes (|x| ~ 0.1+ m). This only scopes which faces the per-leg hem
    bisect touches; the boundary itself still comes from the bisect plane.
    """
    out = {}
    for fi in keep_faces:
        ids = [vi for vi, _ in loops[fi]]
        xs = [verts[vi][0] for vi in ids if vi < len(verts)]
        if not xs:
            out[fi] = 0
            continue
        mean_x = sum(xs) / len(xs)
        if mean_x > 1e-6:
            out[fi] = 1
        elif mean_x < -1e-6:
            out[fi] = 2
        else:
            out[fi] = 0
    return out


def shorts_topology_stats(loops, keep_faces):
    """Connected vertex components and boundary-loop lengths of a face subset."""
    faces = [[vi for vi, _ in loops[i]] for i in keep_faces]
    edge = defaultdict(set)
    from collections import Counter

    ecount = Counter()
    for ids in faces:
        for a in range(len(ids)):
            u, v = ids[a], ids[(a + 1) % len(ids)]
            edge[u].add(v)
            edge[v].add(u)
            ecount[tuple(sorted((u, v)))] += 1
    seen = set()
    comps = []
    for start in list(edge):
        if start in seen:
            continue
        stack = [start]
        seen.add(start)
        size = 0
        while stack:
            u = stack.pop()
            size += 1
            for w in edge[u]:
                if w not in seen:
                    seen.add(w)
                    stack.append(w)
        comps.append(size)
    comps.sort(reverse=True)
    boundary = [e for e, c in ecount.items() if c == 1]
    adj = defaultdict(list)
    for u, v in boundary:
        adj[u].append(v)
        adj[v].append(u)
    used = set()
    loops_n = []
    for start in adj:
        for nb in adj[start]:
            e0 = tuple(sorted((start, nb)))
            if e0 in used:
                continue
            n = 1
            prev, cur = start, nb
            used.add(e0)
            while cur != start:
                n += 1
                nxts = [x for x in adj[cur] if x != prev]
                if not nxts:
                    break
                nxt = nxts[0]
                used.add(tuple(sorted((cur, nxt))))
                prev, cur = cur, nxt
            loops_n.append(n)
    loops_n.sort(reverse=True)
    return {
        "faceCount": len(keep_faces),
        "componentVertexCounts": comps,
        "boundaryLoopLengths": loops_n,
        "boundaryEdgeCount": len(boundary),
    }


def apply_hunch_from_joint(verts, bones, pivot_name="Spine2", max_deg=16.0):
    """Lean verts above a named rest joint. Rebuild bones after this."""
    by = {b["name"]: b for b in bones}
    if pivot_name not in by:
        raise RuntimeError(f"hunch pivot joint missing: {pivot_name}")
    pivot_z = by[pivot_name]["head"][2]
    head = by.get("Head")
    if head:
        zmax = head["tail"][2]
    else:
        body_n = min(len(verts), mh_io.BODY_VERTS)
        zmax = max(v[2] for v in verts[:body_n])
    span = max(zmax - pivot_z, 1e-6)
    rad = math.radians(max_deg)
    for v in verts:
        if v[2] <= pivot_z:
            continue
        t = (v[2] - pivot_z) / span
        ang = rad * (t * t)
        y, z = v[1], v[2] - pivot_z
        c, s = math.cos(ang), math.sin(ang)
        v[1] = y * c - z * s
        v[2] = y * s + z * c + pivot_z
    return {"pivot_name": pivot_name, "pivot_z": pivot_z, "max_deg": max_deg}


def apply_neck_forward(verts, bones, deg=10.0, pivot_name="Neck"):
    """Rotate verts at/above Neck.head about +X toward Blender −Y (front)."""
    by = {b["name"]: b for b in bones}
    if pivot_name not in by:
        raise RuntimeError(f"neck pivot joint missing: {pivot_name}")
    px, py, pz = by[pivot_name]["head"]
    rad = math.radians(deg)
    c, s = math.cos(rad), math.sin(rad)
    for v in verts:
        if v[2] < pz:
            continue
        y, z = v[1] - py, v[2] - pz
        v[1] = y * c - z * s + py
        v[2] = y * s + z * c + pz
    return {"pivot_name": pivot_name, "deg": deg, "pivot": [px, py, pz]}


def scale_vert_cloud(verts, scale):
    """Uniform scale about planted feet (z already 0-based)."""
    for v in verts:
        v[0] *= scale
        v[1] *= scale
        v[2] *= scale


def flare_lateral_x(verts, scale, z_frac=0.52, x_min=0.05):
    """Scale |X| of upper-body verts to widen biacromial span. Rebuild bones after."""
    zs = [v[2] for v in verts[: mh_io.BODY_VERTS]]
    cut = min(zs) + z_frac * (max(zs) - min(zs))
    for v in verts:
        if v[2] >= cut and abs(v[0]) >= x_min:
            v[0] *= scale
    return {"scale": scale, "zFrac": z_frac, "xMin": x_min}


def shaft_radius_m(bverts, head, tail, t0=0.35, t1=0.65, max_r_frac=0.45):
    """Median radial distance of same-side verts along the mid-shaft of head→tail."""
    if head is None or tail is None:
        return None
    axis = _unit(_vsub(tail, head))
    length = _vlen(_vsub(tail, head))
    if length < 1e-8:
        return None
    r_max = max_r_frac * length
    side = 1.0 if head[0] >= 0.0 else -1.0
    radii = []
    for v in bverts:
        if v[0] * side < 0.02:
            continue
        rel = _vsub(v, head)
        t = _vdot(rel, axis) / length
        if t < t0 or t > t1:
            continue
        closest = _lerp(head, tail, t)
        r = _dist(v, closest)
        if r > r_max:
            continue
        radii.append(r)
    if len(radii) < 12:
        return None
    radii.sort()
    return radii[len(radii) // 2]


def normalize_standing_height(verts, target_m):
    """Uniform scale about the feet so body AABB height == target_m. Scale bones via rebuild."""
    zmin = min(v[2] for v in verts[: mh_io.BODY_VERTS])
    zmax = max(v[2] for v in verts[: mh_io.BODY_VERTS])
    height = zmax - zmin
    if height < 1e-8:
        raise RuntimeError("zero body height")
    scale = target_m / height
    for v in verts:
        v[0] *= scale
        v[1] *= scale
        v[2] = (v[2] - zmin) * scale
    return {"preHeightM": height, "targetHeightM": target_m, "uniformScale": scale}


def _joint(by, name, end="head"):
    b = by.get(name)
    if not b:
        return None
    return list(b[end])


def _dist(a, b):
    if a is None or b is None:
        return None
    return math.dist(a, b)


def metrics(bverts, bones):
    xs = [v[0] for v in bverts]
    ys = [v[1] for v in bverts]
    zs = [v[2] for v in bverts]
    by = {b["name"]: b for b in bones}
    l_arm = _joint(by, "LeftArm", "head")
    r_arm = _joint(by, "RightArm", "head")
    wrist = _joint(by, "LeftHand", "head")
    mid_tip = _joint(by, "finger3-3.L", "tail")
    mcp_index = _joint(by, "finger2-1.L", "head")
    mcp_pinky = _joint(by, "finger5-1.L", "head")
    height = max(zs) - min(zs)
    out = {
        "heightM": height,
        "shoulderWidthM": _dist(l_arm, r_arm),
        "shoulderWidthDefinition": (
            "LeftArm.head to RightArm.head (upperarm01.L/R glenohumeral joints). "
            "Not clavicle roots (LeftShoulder/RightShoulder.head)."
        ),
        "shoulderWidthEndpoints": {"LeftArm.head": l_arm, "RightArm.head": r_arm},
        "handLengthM": _dist(wrist, mid_tip),
        "handLengthDefinition": (
            "LeftHand.head (wrist.L) to finger3-3.L.tail (left middle fingertip). One hand."
        ),
        "handLengthEndpoints": {"LeftHand.head": wrist, "finger3-3.L.tail": mid_tip},
        "palmWidthM": _dist(mcp_index, mcp_pinky),
        "palmWidthDefinition": (
            "finger2-1.L.head to finger5-1.L.head (left index MCP to pinky MCP). One hand."
        ),
        "palmWidthEndpoints": {"finger2-1.L.head": mcp_index, "finger5-1.L.head": mcp_pinky},
        "upperArmM": _dist(_joint(by, "LeftArm", "head"), _joint(by, "LeftForeArm", "head")),
        "upperArmDefinition": "LeftArm.head to LeftForeArm.head",
        "foreArmM": _dist(_joint(by, "LeftForeArm", "head"), _joint(by, "LeftHand", "head")),
        "foreArmDefinition": "LeftForeArm.head to LeftHand.head",
        "thighM": _dist(_joint(by, "LeftUpLeg", "head"), _joint(by, "LeftLeg", "head")),
        "thighDefinition": "LeftUpLeg.head to LeftLeg.head",
        "shinM": _dist(_joint(by, "LeftLeg", "head"), _joint(by, "LeftFoot", "head")),
        "shinDefinition": "LeftLeg.head to LeftFoot.head",
        "handProxyM": None,
        "handProxyNote": "Removed. Cross-body X-span is not a hand metric.",
        "upperArmRadiusM": shaft_radius_m(bverts, l_arm, _joint(by, "LeftForeArm", "head")),
        "thighRadiusM": shaft_radius_m(
            bverts, _joint(by, "LeftUpLeg", "head"), _joint(by, "LeftLeg", "head")
        ),
        "neckForwardDeg": None,
        "neckForwardDefinition": (
            "atan2(-dY, dZ) deg of Neck.head → Neck.tail in YZ; + is toward Blender −Y (front)."
        ),
        "boundsBlender": {"min": [min(xs), min(ys), min(zs)], "max": [max(xs), max(ys), max(zs)]},
    }
    arm_r, thigh_r = out["upperArmRadiusM"], out["thighRadiusM"]
    if arm_r is not None and thigh_r is not None:
        out["limbThicknessM"] = 0.5 * (arm_r + thigh_r)
        out["limbThicknessDefinition"] = (
            "Mean of median mid-shaft radii: LeftArm.head→LeftForeArm.head and "
            "LeftUpLeg.head→LeftLeg.head (t=0.35–0.65, same-side, r≤0.45×bone)."
        )
    else:
        out["limbThicknessM"] = None
        out["limbThicknessDefinition"] = "Mean of upperArmRadiusM and thighRadiusM"
    neck_h = _joint(by, "Neck", "head")
    neck_t = _joint(by, "Neck", "tail")
    if neck_h and neck_t:
        out["neckForwardDeg"] = math.degrees(
            math.atan2(-(neck_t[1] - neck_h[1]), neck_t[2] - neck_h[2])
        )
    return out


def ratios_vs_human(m, human_m):
    keys = (
        "heightM",
        "shoulderWidthM",
        "handLengthM",
        "palmWidthM",
        "upperArmM",
        "foreArmM",
        "thighM",
        "shinM",
        "upperArmRadiusM",
        "thighRadiusM",
        "limbThicknessM",
    )
    out = {}
    for k in keys:
        a, b = m.get(k), human_m.get(k)
        if a is None or b is None or b == 0:
            out[k] = None
        else:
            out[k] = a / b
    return out


def human_reference_metrics(src: Path):
    verts, uvs, faces = mh_io.load_obj(src / "base.obj")
    mh_io.apply_target(verts, src / "caucasian-male-young.target", 1.0)
    verts = mh_io.mh_to_blender_meters(verts)
    bverts, _, _ = mh_io.body_mesh(verts, uvs, faces)
    skel = mh_io.load_skel(src / "default.mhskel")
    bones = mh_io.bones_world(skel, verts)
    return metrics(bverts, bones)


def human_v2_reference_metrics(src: Path):
    """Live Human v2 macros (no A-pose). Falls back to CURRENT_HUMAN_V2 constants."""
    missing = [n for n, _ in HUMAN_V2_TARGETS if not (src / n).exists()]
    if missing:
        return dict(CURRENT_HUMAN_V2)
    built = deform_body(src, [(src / n, w) for n, w in HUMAN_V2_TARGETS])
    m = metrics(built["bverts"], built["bones"])
    for k, v in CURRENT_HUMAN_V2.items():
        m.setdefault(k, v)
    return m


def deform_mh(src: Path, targets):
    verts, uvs, faces = mh_io.load_obj(src / "base.obj")
    mh_io.apply_targets(verts, targets)
    return verts, uvs, faces


def deform_body(src: Path, targets, hunch=None, target_height=None, neck_forward_deg=None, lateral_x_scale=None):
    verts_mh, uvs, faces = deform_mh(src, targets)
    verts = mh_io.mh_to_blender_meters(verts_mh)
    skel = mh_io.load_skel(src / "default.mhskel")
    hunch_info = None
    height_info = None
    neck_info = None
    if hunch:
        bones = mh_io.bones_world(skel, verts)
        hunch_info = apply_hunch_from_joint(verts, bones, **hunch)
    if neck_forward_deg:
        bones = mh_io.bones_world(skel, verts)
        neck_info = apply_neck_forward(verts, bones, neck_forward_deg)
    if target_height:
        height_info = normalize_standing_height(verts, target_height)
    lateral_info = None
    if lateral_x_scale and abs(lateral_x_scale - 1.0) > 1e-9:
        lateral_info = flare_lateral_x(verts, lateral_x_scale)
    bverts, uvs, loops = mh_io.body_mesh(verts, uvs, faces)
    bones = mh_io.bones_world(skel, verts)
    return {
        "verts": verts,
        "verts_mh": verts_mh,
        "bverts": bverts,
        "uvs": uvs,
        "loops": loops,
        "bones": bones,
        "hunch": hunch_info,
        "neckForward": neck_info,
        "lateralX": lateral_info,
        "heightNormalize": height_info,
    }


# Local XYZ on the hm08 rest armature (Blender pose-bone axes, roll 0):
#   Hips  X = world +X (sagittal pitch / pelvis bend)
#   Hips  Y = stub aim ≈ world -Y (roll along the short pelvis bone)
#   Hips  Z ≈ world -Z (yaw about vertical)
#   Spine X = world +X (sagittal pitch / spine bend)
#   Spine Y = spine aim ≈ world +Z (axial twist)
#   spine04 X = world +X (further sagittal bend)
# Limb poses keep the historical X-bend / Neck-Z convention.
SKIN_POSES = (
    ("rest", {}),
    ("bent_elbow", {"LeftForeArm": ("x", -95)}),
    ("bent_knee", {"LeftLeg": ("x", 75)}),
    ("raised_arm", {"RightArm": ("x", -80)}),
    ("head_turn", {"Neck": ("z", 22), "Head": ("z", 40)}),
    (
        "stress_combo",
        {
            "LeftForeArm": ("x", -95),
            "RightArm": ("x", -80),
            "LeftLeg": ("x", 75),
            "RightUpLeg": ("x", -35),
        },
    ),
    ("torso_pelvis_bend", {"Hips": ("x", 22)}),
    ("torso_pelvis_twist", {"Hips": ("z", 28)}),
    ("torso_spine_bend", {"Spine": ("x", 18), "spine04": ("x", 12)}),
    ("torso_spine_twist", {"Spine": ("y", 25)}),
    (
        "torso_counter",
        {"Hips": ("x", 20), "Spine": ("x", -16), "spine04": ("x", -8)},
    ),
)

# Held-out combination used only by reducer tests (not a fitting sample):
# pelvis yaw + spine counter-bend + thigh — none of SKIN_POSES has this triple.
SKIN_POSES_HELDOUT = (
    "heldout_torso_leg",
    {"Hips": ("z", 18), "Spine": ("x", -14), "LeftUpLeg": ("x", -30)},
)

NONNEGLIGIBLE_WEIGHT = 0.01
# Raw influences at or above this must stay in every 4-subset (at most 3).
# Stops NNLS from discarding Spine≈0.67 when fitting poses leave Spine/pelvis
# columns identical and a small moving limb bone wins the max-error race.
KEEP_RAW_MIN = 0.3
# Weak pull toward the source weights on a subset. Dominates only when pose
# columns are geometrically tied (residual ~0 for every convex combination).
FIT_PRIOR_LAMBDA = 1e-2
# Subsets within this max-error (m) are tied; pick closer to source weights.
SUBSET_TIE_M = 1e-6
# Candidate pool size for reduce_weights_pose_aware's exhaustive subset search.
# The handoff suggests top-6; measured on real Orc data, top-6 leaves the
# actual best-moving bone (e.g. RightArm at raised_arm) just outside the pool
# for some torso/underarm vertices whose *raw weight* ranks it 7th, forcing a
# same-max-error-as-top-6 subset that misses the 0.008 m per-pose target by
# ~2mm (measured: vertex 1509, raised_arm, top-6 -> 0.0104 m, top-8 -> 0.0 m
# exactly, once the actually-moving bone is a selectable candidate). 8 keeps
# C(8,4)=70 combinations per solved vertex (~1699 of 13380), still <1s total.
POSE_AWARE_CANDIDATES = 8


def _deform_matrix(rest_mat, pose_mat):
    """M = pose_world @ rest_world^-1. rest_mat/pose_mat: 4x4 nested lists."""
    r = np.asarray(rest_mat, dtype=np.float64)
    p = np.asarray(pose_mat, dtype=np.float64)
    return p @ np.linalg.inv(r)


def _bone_positions(deform_by_pose, bone_names, pose_names, rest_xyz1):
    """(len(bone_names), len(pose_names), 3) posed positions of one rest vertex per bone."""
    out = np.empty((len(bone_names), len(pose_names), 3))
    for bi, b in enumerate(bone_names):
        for pi, pose in enumerate(pose_names):
            out[bi, pi] = (deform_by_pose[pose][b] @ rest_xyz1)[:3]
    return out


def _fit_weights(cols, target, prior=None, prior_lambda=0.0, locked=None):
    """cols: (k, P, 3) per-bone-per-pose positions. target: (P, 3).

    Solve for w (k,) minimizing sum_P ||sum_b w_b * cols[b, P] - target[P]||^2
    subject to sum(w) == 1 and w >= 0. numpy has no NNLS, so this uses a small
    greedy active-set method: solve the *direct* k-weight system (sum=1 added
    as one heavily-weighted soft-penalty row, not via reference-bone
    elimination) with plain numpy.linalg.lstsq, then repeatedly drop the most
    negative weight and re-solve over the remaining active bones until all
    weights are non-negative (classic Lawson-Hanson NNLS idea, simplified).

    Optional ``prior`` (k,) with ``prior_lambda``>0 adds weak ridge rows
    ``λ I w = λ prior``. Pose residuals dominate when columns differ; when
    every convex combination has ~0 pose error (tied Spine/pelvis columns)
    the prior recovers the normalized source mix instead of an arbitrary
    min-norm split.

    A first version eliminated one "reference" bone (w_ref = 1 - sum(others))
    and clamped negatives post-hoc; that is numerically unstable whenever the
    reduced system is near-singular (e.g. a candidate set where only one
    sample pose actually discriminates between bones, common for a
    single-joint pose set): the eliminated bone can absorb huge, wildly
    cancelling coefficients that clip-and-renormalize turns into a nonsensical
    near-single-bone result. This direct/no-elimination formulation avoids
    that failure mode (verified: it does not regress the head_turn/neck case
    below, where the reference-elimination version put 99.997% of the weight
    on a single low-raw-weight bone).
    """
    k = cols.shape[0]
    if k == 1:
        return np.array([1.0])
    p = cols.shape[1]
    a_full = cols.transpose(1, 2, 0).reshape(p * 3, k)
    b_full = target.reshape(-1)
    scale = float(np.linalg.norm(a_full)) + 1.0
    big = 1e4 * scale
    prior_v = None
    lam = 0.0
    if prior is not None and prior_lambda > 0:
        prior_v = np.asarray(prior, dtype=np.float64).reshape(k)
        s = float(prior_v.sum())
        if s > 1e-12:
            prior_v = np.maximum(prior_v, 0.0)
            ps = prior_v.sum()
            prior_v = prior_v / ps if ps > 1e-12 else np.full(k, 1.0 / k)
            lam = float(prior_lambda) * scale
        else:
            prior_v = None
    locked_set = {int(i) for i in (locked or ()) if 0 <= int(i) < k}
    active = list(range(k))
    sol = None
    while True:
        blocks_a = [a_full[:, active], big * np.ones((1, len(active)))]
        blocks_b = [b_full, np.array([big])]
        if prior_v is not None and lam > 0:
            blocks_a.append(lam * np.eye(len(active)))
            blocks_b.append(lam * prior_v[active])
        a_sub = np.concatenate(blocks_a, axis=0)
        b_sub = np.concatenate(blocks_b, axis=0)
        sol, *_ = np.linalg.lstsq(a_sub, b_sub, rcond=None)
        if len(active) == 1 or np.all(sol >= -1e-9):
            break
        dropable = [i for i, bidx in enumerate(active) if bidx not in locked_set]
        if not dropable:
            break
        i_drop = min(dropable, key=lambda i: sol[i])
        if sol[i_drop] >= -1e-9:
            break
        active.pop(i_drop)
    w = np.zeros(k)
    for i, bone_idx in enumerate(active):
        w[bone_idx] = max(float(sol[i]), 0.0)
    total = w.sum()
    if total <= 1e-12:
        return np.full(k, 1.0 / k)
    return w / total


def _pose_errors(cols, target, weights):
    pred = np.tensordot(weights, cols, axes=(0, 0))
    return np.linalg.norm(pred - target, axis=1)


def _protected_joint_names(items, max_protected, keep_raw_min):
    """Original joints with raw w >= keep_raw_min, strongest first, at most max_protected."""
    out = []
    for name, w in items:
        if w >= keep_raw_min:
            out.append(name)
        if len(out) >= max_protected:
            break
    return out


def reduce_weights_pose_aware(
    per_vert,
    parents,
    rest_mats,
    pose_mats_by_pose,
    rest_positions,
    max_influences=4,
    protect_min_weight=KEEP_RAW_MIN,
    prior_lambda=FIT_PRIOR_LAMBDA,
    tie_m=SUBSET_TIE_M,
):
    """Pose-aware 4-influence reduction (Human and race bodies).

    per_vert: list[dict[bone, weight]], full (unlimited) weights per vertex.
    parents: bone -> parent bone name or None.
    rest_mats: bone -> 4x4 nested-list rest matrix (armature-world space).
    pose_mats_by_pose: pose_name -> bone -> 4x4 nested-list posed matrix, same space.
    rest_positions: list[(x, y, z)] rest-space vertex coordinates, same length/order
        as per_vert.
    max_influences: target influence count (4 for glTF export).

    For vertices with <= max_influences non-negligible (> 0.01) raw influences,
    behaves like mh_io.reduce_weights: top-N kept, remainder folded onto a kept
    ancestor via mh_io.fold_to_kept, normalized.

    For vertices with more, builds a top-POSE_AWARE_CANDIDATES candidate set the
    same way (fold the remainder onto a kept ancestor). Joints with raw weight
    >= protect_min_weight (at most 3) are required in every 4-subset. Remaining
    slots are exhaustive. Top-4 source joints are always evaluated as a
    baseline. Each subset is fitted with _fit_weights (sum=1, w>=0, optional
    source-weight prior). The subset with the smallest max LBS error across
    sample poses wins; ties within tie_m pick the fit closer to the source
    mix on that subset. protect_min_weight=0 and prior_lambda=0 restore the
    pre-fix exhaustive search (used by the regression that reproduces the
    Spine/pelvis collapse).
    """
    pose_names = list(pose_mats_by_pose.keys())
    all_bones = set(rest_mats.keys())
    deform_by_pose = {
        pose: {b: _deform_matrix(rest_mats[b], pose_mats_by_pose[pose][b]) for b in all_bones}
        for pose in pose_names
    }

    limited = []
    discarded_raw = []
    affected = []
    solved_count = 0
    pose_err_samples = {p: [] for p in pose_names}

    for vi, infl in enumerate(per_vert):
        items = sorted(infl.items(), key=lambda kv: -kv[1])
        raw_total = sum(w for _, w in items)
        nonneg_count = sum(1 for _, w in items if w > NONNEGLIGIBLE_WEIGHT)

        if nonneg_count <= max_influences or len(items) <= max_influences:
            keep_items = items[:max_influences]
            rest = items[max_influences:]
            keep = {n: w for n, w in keep_items}
            for name, w in rest:
                mh_io.fold_to_kept(name, w, keep, parents)
            chosen = set(keep.keys())
            drop = sum(w for n, w in items if n not in chosen)
            discarded_raw.append(drop)
            if rest:
                affected.append(vi)
            total = sum(keep.values())
            if total <= 1e-12:
                limited.append([])
                continue
            limited.append(
                sorted(((n, w / total) for n, w in keep.items()), key=lambda kv: -kv[1])
            )
            continue

        # Candidate set: top-N by weight (see POSE_AWARE_CANDIDATES), folding
        # the remainder onto a kept ancestor.
        keep_items = items[:POSE_AWARE_CANDIDATES]
        rest_n = items[POSE_AWARE_CANDIDATES:]
        keep = {n: w for n, w in keep_items}
        for name, w in rest_n:
            mh_io.fold_to_kept(name, w, keep, parents)
        candidates = sorted(keep.items(), key=lambda kv: -kv[1])
        cand_names = [n for n, _ in candidates]
        raw_by_name = {n: w for n, w in items}

        rx, ry, rz = rest_positions[vi]
        rest_xyz1 = np.array([rx, ry, rz, 1.0])
        # Blender's Armature modifier normalizes each vertex's total group
        # weight to 1 at deform time regardless of the raw sum (a handful of
        # source .mhw vertices, mostly facial muscle-combination weights, sum
        # to ~0.95-1.06, not exactly 1) — normalize here too so this target
        # matches what compare_skin's *actual* Blender-evaluated body_full
        # mesh will show, not a raw un-normalized sum.
        raw_total = sum(infl.values())
        norm = raw_total if raw_total > 1e-12 else 1.0
        target = np.array(
            [
                sum(
                    (w / norm) * (deform_by_pose[pose][b] @ rest_xyz1)[:3]
                    for b, w in infl.items()
                    if b in deform_by_pose[pose]
                )
                for pose in pose_names
            ]
        )

        k = min(max_influences, max(len(cand_names), 1))
        max_protected = min(3, max(k - 1, 0), k)
        protected = _protected_joint_names(items, max_protected, protect_min_weight)
        for n in protected:
            if n not in cand_names:
                cand_names.append(n)
        cand_cols = _bone_positions(deform_by_pose, cand_names, pose_names, rest_xyz1)
        name_index = {n: i for i, n in enumerate(cand_names)}
        prot_idx = [name_index[n] for n in protected if n in name_index]
        prot_set = set(prot_idx)
        free_idx = [i for i in range(len(cand_names)) if i not in prot_set]
        slots = k - len(prot_idx)
        if slots < 0:
            prot_idx = prot_idx[:k]
            slots = 0
            free_idx = []

        subset_iters = []
        if slots == 0:
            subset_iters.append(tuple(prot_idx))
        else:
            for extra in itertools.combinations(free_idx, min(slots, len(free_idx))):
                subset_iters.append(tuple(prot_idx + list(extra)))
        top4 = [name_index[n] for n, _ in items[:k] if n in name_index]
        if len(top4) == k:
            subset_iters.append(tuple(top4))
        # Unique while preserving order.
        seen_sub = set()
        unique_subs = []
        for s in subset_iters:
            key = tuple(sorted(s))
            if key in seen_sub:
                continue
            seen_sub.add(key)
            unique_subs.append(s)

        if not unique_subs:
            limited.append([])
            discarded_raw.append(sum(w for _, w in items))
            affected.append(vi)
            continue

        best = None
        for subset_idx in unique_subs:
            idx = list(subset_idx)
            sub_cols = cand_cols[idx]
            prior = np.array([raw_by_name.get(cand_names[i], 0.0) for i in idx])
            locked = [j for j, ci in enumerate(idx) if cand_names[ci] in set(protected)]
            w = _fit_weights(
                sub_cols, target, prior=prior, prior_lambda=prior_lambda, locked=locked
            )
            err = _pose_errors(sub_cols, target, w)
            max_err = float(err.max())
            ps = float(prior.sum())
            prior_n = (prior / ps) if ps > 1e-12 else np.full(len(idx), 1.0 / len(idx))
            prior_dist = float(np.linalg.norm(w - prior_n))
            cand = (max_err, prior_dist, subset_idx, w, err)
            if best is None:
                best = cand
                continue
            if max_err < best[0] - tie_m:
                best = cand
            elif abs(max_err - best[0]) <= tie_m and prior_dist < best[1]:
                best = cand
        _, _, subset_idx, w, err = best
        sub_names = [cand_names[i] for i in subset_idx]
        chosen = {n for n, wi in zip(sub_names, w) if wi > 0}
        drop = sum(wt for n, wt in items if n not in chosen)
        discarded_raw.append(drop)
        affected.append(vi)
        solved_count += 1
        for p_idx, pose in enumerate(pose_names):
            pose_err_samples[pose].append(float(err[p_idx]))
        limited.append(
            sorted(
                ((n, float(wi)) for n, wi in zip(sub_names, w) if wi > 0),
                key=lambda kv: -kv[1],
            )
        )

    def _p99(vals):
        if not vals:
            return 0.0
        s = sorted(vals)
        return s[int(0.99 * (len(s) - 1))]

    discarded_norm_frac = [
        d / raw_total if raw_total > 1e-12 else 0.0
        for d, raw_total in zip(discarded_raw, (sum(infl.values()) for infl in per_vert))
    ]
    stats = {
        "maxDiscardedInfluence": max(discarded_raw) if discarded_raw else 0.0,
        "affectedVertexCount": len(affected),
        "normalizedDiscardedP95": sorted(discarded_norm_frac)[
            int(0.95 * (len(discarded_norm_frac) - 1))
        ]
        if discarded_norm_frac
        else 0.0,
        "normalizedDiscardedMax": max(discarded_norm_frac) if discarded_norm_frac else 0.0,
        "affectedVertexIds": affected,
        "vertsDropGt01": sum(1 for d in discarded_raw if d > 0.1),
        "vertsDropGt02": sum(1 for d in discarded_raw if d > 0.2),
        "reduction": (
            f"pose-aware: >4-nonnegligible-influence verts solved by exhaustive "
            f"4-of-top{POSE_AWARE_CANDIDATES} subset search (min max-error across sample poses "
            "via M=pose_world@rest_world^-1 LBS), joints with raw w>="
            f"{protect_min_weight} kept (max 3), source-weight prior λ={prior_lambda}, "
            f"ties within {tie_m} m prefer source mix; active-set NNLS-like weights "
            "(sum=1, w>=0); <=4-influence verts use fold-to-kept-ancestor + normalize "
            "(mh_io style)"
        ),
        "protectMinWeight": protect_min_weight,
        "fitPriorLambda": prior_lambda,
        "solvedVertexCount": solved_count,
        "poseMaxErrorM": {p: (max(v) if v else 0.0) for p, v in pose_err_samples.items()},
        "posePercentile99ErrorM": {p: _p99(v) for p, v in pose_err_samples.items()},
    }
    return limited, stats
