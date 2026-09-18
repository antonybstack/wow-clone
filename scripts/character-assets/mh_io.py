"""Parse MakeHuman CC0 OBJ / target / mhskel / mhw. No GPL addon code."""
from __future__ import annotations

import json
import math
from pathlib import Path

BODY_VERTS = 13380
DM_TO_M = 0.1

# Mixamo aliases expected by src/character/runtime/rig.js MIXAMO_IMPORT_MAP
BONE_RENAME = {
    "root": "Hips",
    "spine05": "Spine",
    "spine03": "Spine2",
    "neck01": "Neck",
    "head": "Head",
    "clavicle.L": "LeftShoulder",
    "upperarm01.L": "LeftArm",
    "lowerarm01.L": "LeftForeArm",
    "wrist.L": "LeftHand",
    "clavicle.R": "RightShoulder",
    "upperarm01.R": "RightArm",
    "lowerarm01.R": "RightForeArm",
    "wrist.R": "RightHand",
    "upperleg01.L": "LeftUpLeg",
    "lowerleg01.L": "LeftLeg",
    "foot.L": "LeftFoot",
    "toe1-1.L": "LeftToeBase",
    "upperleg01.R": "RightUpLeg",
    "lowerleg01.R": "RightLeg",
    "foot.R": "RightFoot",
    "toe1-1.R": "RightToeBase",
}


def load_obj(path: Path):
    verts = []
    uvs = []
    faces = []  # (group, [(vi,ti), ...])
    group = "none"
    with path.open() as f:
        for line in f:
            if line.startswith("v "):
                x, y, z = map(float, line.split()[1:4])
                verts.append([x, y, z])
            elif line.startswith("vt "):
                parts = line.split()
                uvs.append([float(parts[1]), float(parts[2])])
            elif line.startswith("g "):
                group = line.split()[1]
            elif line.startswith("f "):
                corners = []
                for tok in line.split()[1:]:
                    bits = tok.split("/")
                    vi = int(bits[0]) - 1
                    ti = int(bits[1]) - 1 if len(bits) > 1 and bits[1] else -1
                    corners.append((vi, ti))
                faces.append((group, corners))
    return verts, uvs, faces


def apply_target(verts, path: Path, weight=1.0):
    with path.open() as f:
        for line in f:
            if not line.strip() or line.startswith("#"):
                continue
            p = line.split()
            if len(p) < 4:
                continue
            i = int(p[0])
            verts[i][0] += weight * float(p[1])
            verts[i][1] += weight * float(p[2])
            verts[i][2] += weight * float(p[3])


def apply_targets(verts, items):
    """items: iterable of (Path, weight)."""
    for path, weight in items:
        apply_target(verts, path, weight)


def target_vert_ids(path: Path):
    ids = set()
    with path.open() as f:
        for line in f:
            if not line.strip() or line.startswith("#"):
                continue
            p = line.split()
            if len(p) >= 4:
                ids.add(int(p[0]))
    return ids


def mh_coords_to_blender(verts, zmin=None, ground_from=None):
    """MH Y-up decimeters → Blender Z-up meters.

    MH +Z forward becomes Blender -Y (glTF +Z after Y-up export).
    If zmin is None, feet are planted using ground_from (or the first BODY_VERTS).
    Returns (verts_blender, zmin_used).
    """
    out = []
    for x, y, z in verts:
        out.append([x * DM_TO_M, -z * DM_TO_M, y * DM_TO_M])
    if zmin is None:
        src = ground_from if ground_from is not None else out[: min(BODY_VERTS, len(out))]
        zmin = min(v[2] for v in src)
    for v in out:
        v[2] -= zmin
    return out, zmin


def mh_to_blender_meters(verts):
    """MH Y-up decimeters → Blender Z-up meters, feet on z=0.

    MH +Z forward becomes Blender -Y (glTF +Z after Y-up export).
    """
    out, _ = mh_coords_to_blender(verts)
    return out


def body_mesh(verts, uvs, faces):
    loops = []
    used = set()
    for group, corners in faces:
        if group != "body":
            continue
        loops.append(corners)
        for vi, _ in corners:
            used.add(vi)
    assert max(used) < BODY_VERTS
    return verts[:BODY_VERTS], uvs, loops


def load_skel(path: Path):
    return json.loads(path.read_text())


def joint_pos(verts, indices):
    sx = sy = sz = 0.0
    n = len(indices)
    for i in indices:
        sx += verts[i][0]
        sy += verts[i][1]
        sz += verts[i][2]
    return [sx / n, sy / n, sz / n]


def bones_world(skel, verts):
    joints = skel["joints"]
    bones = []
    for name, spec in skel["bones"].items():
        head = joint_pos(verts, joints[spec["head"]])
        tail = joint_pos(verts, joints[spec["tail"]])
        bones.append(
            {
                "name": BONE_RENAME.get(name, name),
                "src": name,
                "parent": None
                if spec["parent"] is None
                else BONE_RENAME.get(spec["parent"], spec["parent"]),
                "head": head,
                "tail": tail,
            }
        )
    return bones


def load_weights_full(path: Path, bone_rename):
    """Body-only weights. Helper verts (vi >= BODY_VERTS) are omitted, not remapped."""
    raw = json.loads(path.read_text())["weights"]
    per_vert = [{} for _ in range(BODY_VERTS)]
    helper_entries = 0
    for bone, entries in raw.items():
        name = bone_rename.get(bone, bone)
        for vi, w in entries:
            if vi >= BODY_VERTS:
                helper_entries += 1
                continue
            per_vert[vi][name] = per_vert[vi].get(name, 0.0) + float(w)
    zero_ids = [i for i, d in enumerate(per_vert) if not d]
    return per_vert, helper_entries, zero_ids


def parent_map(bones):
    return {b["name"]: b["parent"] for b in bones}


def fold_to_kept(name, w, keep, parents):
    p = parents.get(name)
    seen = set()
    while p and p not in keep and p not in seen:
        seen.add(p)
        p = parents.get(p)
    target = p if p in keep else next(iter(keep))
    keep[target] += w


def reduce_weights(per_vert, parents, max_influences=4):
    limited = []
    discarded_raw = []
    discarded_norm_frac = []
    affected = []
    for vi, infl in enumerate(per_vert):
        items = sorted(infl.items(), key=lambda kv: -kv[1])
        raw_total = sum(w for _, w in items)
        keep_items = items[:max_influences]
        rest = items[max_influences:]
        drop = sum(w for _, w in rest)
        discarded_raw.append(drop)
        discarded_norm_frac.append(drop / raw_total if raw_total > 1e-12 else 0.0)
        if rest:
            affected.append(vi)
        keep = {n: w for n, w in keep_items}
        for name, w in rest:
            fold_to_kept(name, w, keep, parents)
        total = sum(keep.values())
        if total <= 1e-12:
            limited.append([])
            continue
        limited.append(sorted(((n, w / total) for n, w in keep.items()), key=lambda kv: -kv[1]))
    stats = {
        "maxDiscardedInfluence": max(discarded_raw) if discarded_raw else 0.0,
        "affectedVertexCount": len(affected),
        "normalizedDiscardedP95": sorted(discarded_norm_frac)[int(0.95 * (len(discarded_norm_frac) - 1))]
        if discarded_norm_frac
        else 0.0,
        "normalizedDiscardedMax": max(discarded_norm_frac) if discarded_norm_frac else 0.0,
        "affectedVertexIds": affected,
        "vertsDropGt01": sum(1 for d in discarded_raw if d > 0.1),
        "vertsDropGt02": sum(1 for d in discarded_raw if d > 0.2),
        "reduction": "fold dropped influences onto kept ancestor (else strongest kept), then normalize to 4",
    }
    return limited, stats, discarded_raw


def load_mhclo(path: Path):
    """Parse a MakeHuman .mhclo proxy (graphics asset). No addon code."""
    scales = {}
    mappings = []
    obj_file = None
    material = None
    in_verts = False
    with path.open() as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            if line.startswith("obj_file"):
                obj_file = line.split()[1]
            elif line.startswith("material "):
                material = line.split()[1]
            elif line.startswith("x_scale"):
                _, i, j, d = line.split()[:4]
                scales["x"] = (int(i), int(j), float(d))
            elif line.startswith("y_scale"):
                _, i, j, d = line.split()[:4]
                scales["y"] = (int(i), int(j), float(d))
            elif line.startswith("z_scale"):
                _, i, j, d = line.split()[:4]
                scales["z"] = (int(i), int(j), float(d))
            elif line.startswith("verts"):
                in_verts = True
            elif line.startswith("delete_verts"):
                in_verts = False
            elif in_verts:
                p = line.split()
                if not p:
                    continue
                if len(p) == 1:
                    mappings.append(("helper", int(p[0])))
                elif len(p) >= 9:
                    mappings.append(
                        (
                            "bary",
                            int(p[0]),
                            int(p[1]),
                            int(p[2]),
                            float(p[3]),
                            float(p[4]),
                            float(p[5]),
                            float(p[6]),
                            float(p[7]),
                            float(p[8]),
                        )
                    )
    return {"obj": obj_file, "material": material, "scales": scales, "mappings": mappings}


def _axis_scale(verts, spec, axis):
    i, j, rest = spec
    if rest <= 1e-12:
        return 1.0
    return abs(verts[i][axis] - verts[j][axis]) / rest


def fit_proxy(mh_verts, clo):
    """Fit proxy vertices to a deformed hm08 mesh in MakeHuman coordinates."""
    scales = clo["scales"]
    sx = _axis_scale(mh_verts, scales["x"], 0) if "x" in scales else 1.0
    sy = _axis_scale(mh_verts, scales["y"], 1) if "y" in scales else 1.0
    sz = _axis_scale(mh_verts, scales["z"], 2) if "z" in scales else 1.0
    out = []
    for m in clo["mappings"]:
        if m[0] == "helper":
            src = mh_verts[m[1]]
            out.append([src[0], src[1], src[2]])
            continue
        _, i0, i1, i2, w0, w1, w2, d0, d1, d2 = m
        p = [
            w0 * mh_verts[i0][0] + w1 * mh_verts[i1][0] + w2 * mh_verts[i2][0],
            w0 * mh_verts[i0][1] + w1 * mh_verts[i1][1] + w2 * mh_verts[i2][1],
            w0 * mh_verts[i0][2] + w1 * mh_verts[i1][2] + w2 * mh_verts[i2][2],
        ]
        p[0] += d0 * sx
        p[1] += d1 * sy
        p[2] += d2 * sz
        out.append(p)
    return out


def obj_loops(faces):
    return [corners for _, corners in faces]


def _bone_map(bones):
    return {b["name"]: b for b in bones}


def _dist(a, b):
    return math.dist(a, b)


def proportion_metrics(bverts, bones):
    """WP-2.1 proportion report. Head unit = crown − jaw.tail (chin)."""
    by = _bone_map(bones)
    zs = [v[2] for v in bverts]
    stature = max(zs) - min(zs)
    crown = max(zs)
    jaw = by["jaw"]
    head_h = crown - jaw["tail"][2]
    l_arm = by["LeftArm"]["head"]
    r_arm = by["RightArm"]["head"]
    biacrom = _dist(l_arm, r_arm)
    waist_z = min(zs) + 0.53 * stature
    half = max(biacrom * 0.62, 0.22)
    band = [
        v
        for v in bverts
        if abs(v[2] - waist_z) < 0.02 and abs(v[0]) < half and abs(v[1]) < 0.12
    ]
    if len(band) < 8:
        band = [v for v in bverts if abs(v[2] - waist_z) < 0.03 and abs(v[0]) < half]
    waist = max(v[0] for v in band) - min(v[0] for v in band)
    return {
        "heightM": stature,
        "headHeightM": head_h,
        "headStature": head_h / stature if stature else None,
        "heads": stature / head_h if head_h else None,
        "biacromialM": biacrom,
        "biacromialHeads": biacrom / head_h if head_h else None,
        "shoulderWidthDefinition": "LeftArm.head to RightArm.head; head unit = crown − jaw.tail",
        "waistWidthM": waist,
        "waistShoulder": waist / biacrom if biacrom else None,
        "gates": {
            "headStature": [0.120, 0.130],
            "biacromialHeads": 2.3,
            "waistShoulder": 0.72,
        },
    }


def rest_limb_metrics(bones):
    """Bone-aim rest pose vs WP-2.1 gates. Blender Z-up, feet on Z=0."""
    by = _bone_map(bones)

    def aim(name, other_head=None):
        b = by[name]
        if other_head is None:
            dx = b["tail"][0] - b["head"][0]
            dy = b["tail"][1] - b["head"][1]
            dz = b["tail"][2] - b["head"][2]
        else:
            o = by[other_head]["head"]
            dx = o[0] - b["head"][0]
            dy = o[1] - b["head"][1]
            dz = o[2] - b["head"][2]
        n = math.sqrt(dx * dx + dy * dy + dz * dz) or 1.0
        return (dx / n, dy / n, dz / n)

    def ang(a, b):
        d = max(-1.0, min(1.0, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]))
        return math.degrees(math.acos(d))

    down = (0.0, 0.0, -1.0)
    up = (0.0, 0.0, 1.0)
    la = aim("LeftArm", "LeftForeArm")
    lf = aim("LeftForeArm", "LeftHand")
    lh = aim("LeftHand")
    hd = aim("Head")
    abd = ang(la, down)
    elbow = ang(la, lf)
    wrist = ang(lf, lh)
    pitch = ang(hd, up)
    return {
        "abductionDeg": abd,
        "elbowFlexDeg": elbow,
        "wristAimDeg": wrist,
        "headPitchDeg": pitch,
        "leftUpperArmDir": list(la),
        "leftForeArmDir": list(lf),
        "leftHandDir": list(lh),
        "headDir": list(hd),
        "gates": {
            "abductionDeg": [42.0, 48.0],
            "elbowFlexDeg": [5.0, 10.0],
            "wristAimDeg": 8.0,
            "headPitchDeg": 2.0,
        },
    }
