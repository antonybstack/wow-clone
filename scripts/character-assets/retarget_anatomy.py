"""Anatomical Mixamo→MH retarget: world bone aim + transferred twist.

Does not copy source world *rest* offsets onto an A-pose destination.
Destination bone lengths / rest local translations are preserved.
"""
from __future__ import annotations

import math
from mathutils import Matrix, Quaternion, Vector


LIMB_DEST = [
    "LeftShoulder",
    "RightShoulder",
    "LeftArm",
    "RightArm",
    "LeftForeArm",
    "RightForeArm",
    "LeftHand",
    "RightHand",
    "LeftUpLeg",
    "RightUpLeg",
    "LeftLeg",
    "RightLeg",
    "LeftFoot",
    "RightFoot",
    "LeftToeBase",
    "RightToeBase",
]


def _safe_dir(v: Vector) -> Vector:
    if v.length < 1e-8:
        return Vector((0.0, 1.0, 0.0))
    return v.normalized()


def world_head_tail(arm, name):
    pb = arm.pose.bones[name]
    mw = arm.matrix_world
    return mw @ pb.head.copy(), mw @ pb.tail.copy()


def world_axes(arm, name):
    M = arm.matrix_world @ arm.pose.bones[name].matrix
    R = M.to_3x3()
    x = (R @ Vector((1.0, 0.0, 0.0))).normalized()
    y = (R @ Vector((0.0, 1.0, 0.0))).normalized()
    z = (R @ Vector((0.0, 0.0, 1.0))).normalized()
    return x, y, z, M.translation.copy()


def capture_anatomy(arm, names):
    out = {}
    for name in names:
        x, y, z, t = world_axes(arm, name)
        head, tail = world_head_tail(arm, name)
        out[name] = {
            "x": x,
            "aim": y,
            "z": z,
            "origin": t,
            "head": head,
            "tail": tail,
            "length": (tail - head).length,
        }
    return out


def rotation_between(a: Vector, b: Vector) -> Matrix:
    qa = _safe_dir(a)
    qb = _safe_dir(b)
    return qa.rotation_difference(qb).to_matrix()


def signed_angle(a: Vector, b: Vector, axis: Vector) -> float:
    axis = _safe_dir(axis)
    ap = a - axis * a.dot(axis)
    bp = b - axis * b.dot(axis)
    if ap.length < 1e-8 or bp.length < 1e-8:
        return 0.0
    ap.normalize()
    bp.normalize()
    return math.atan2(axis.dot(ap.cross(bp)), ap.dot(bp))


def rotation_from_aim_x(aim: Vector, x_hint: Vector) -> Matrix:
    y = _safe_dir(aim)
    x = x_hint - y * x_hint.dot(y)
    if x.length < 1e-5:
        fallback = Vector((1.0, 0.0, 0.0)) if abs(y.x) < 0.9 else Vector((0.0, 0.0, 1.0))
        x = fallback - y * fallback.dot(y)
    x = _safe_dir(x)
    z = _safe_dir(x.cross(y))
    x = _safe_dir(y.cross(z))
    return Matrix((x, y, z)).transposed()


TWIST_HELPER_PREFIXES = ("upperarm02.", "lowerarm02.", "upperleg02.", "lowerleg02.")
TWIST_HELPER_K = 0.5


def _first_mapped_descendant(pb, want):
    """Walk a single-child chain below a helper bone until a mapped bone is found."""
    node = pb
    seen = set()
    while True:
        candidates = [c for c in node.children if c.name in want]
        if candidates:
            return candidates[0].name
        if len(node.children) != 1:
            return None
        node = node.children[0]
        if node.name in seen:
            return None
        seen.add(node.name)


def find_twist_helpers(dest, mapped_names):
    """Detect in-series *02 twist-distribution helpers (upperarm02/lowerarm02/upperleg02/lowerleg02).

    Returns {helper_name: (parent_dest_name, child_dest_name, k)} for helpers whose
    parent bone is a mapped bone P and whose (single-chain) descendant is a mapped bone C,
    i.e. P -> helper -> C in the destination armature hierarchy.
    """
    want = set(mapped_names)
    links = {}
    for pb in dest.pose.bones:
        if pb.name in want:
            continue
        if not pb.name.startswith(TWIST_HELPER_PREFIXES):
            continue
        parent = pb.parent.name if pb.parent else None
        if parent not in want:
            continue
        child = _first_mapped_descendant(pb, want)
        if child is None:
            continue
        links[pb.name] = (parent, child, TWIST_HELPER_K)
    return links


def hierarchy_dest_order(dest, dest_names, twist_helpers=None):
    """Depth-first dest bone order, interleaving detected twist helpers as P -> helper -> C."""
    want = set(dest_names)
    helper_names = set(twist_helpers.keys()) if twist_helpers else set()
    order = []

    def visit(pb):
        if pb.name in want or pb.name in helper_names:
            order.append(pb.name)
        for ch in pb.children:
            visit(ch)

    for pb in dest.pose.bones:
        if pb.parent is None:
            visit(pb)
    for n in dest_names:
        if n not in order:
            order.append(n)
    return order


def dest_to_src_map(pairs):
    return {d: s for d, s in pairs}


def unmapped_helpers(dest, mapped):
    mapped = set(mapped)
    rows = []
    for pb in dest.pose.bones:
        if pb.name in mapped:
            continue
        parent = pb.parent.name if pb.parent else None
        rows.append(
            {
                "name": pb.name,
                "parent": parent,
                "parentMapped": parent in mapped if parent else False,
                "deform": bool(dest.data.bones[pb.name].use_deform),
            }
        )
    return rows


def nearest_rotation(R):
    """Nearest proper rotation (det +1). Strips uniform/nonuniform scale; rejects reflection."""
    if hasattr(R, "to_3x3"):
        R = R.to_3x3()
    det = R.determinant()
    if det < 0.0:
        R = R.copy()
        R[0] = -R[0]
    q = R.to_quaternion()
    out = q.to_matrix()
    if out.determinant() < 0.0:
        out[0] = -out[0]
        out = out.to_quaternion().to_matrix()
    return out


def character_frame(anat, hips="Hips", left="LeftUpLeg", right="RightUpLeg", head="Head"):
    """Standing character basis in world: columns = right, forward, up.

    Up is hips→head (not the Hips bone aim, which is a short MH stub). Right is
    RightUpLeg − LeftUpLeg projected off up. Forward = up × right (right-handed).
    """
    hips_h = Vector(anat[hips]["head"])
    if head in anat:
        up = _safe_dir(Vector(anat[head]["head"]) - hips_h)
    else:
        up = Vector((0.0, 0.0, 1.0))
    right = Vector(anat[right]["head"]) - Vector(anat[left]["head"])
    right = _safe_dir(right - up * right.dot(up))
    forward = _safe_dir(up.cross(right))
    right = _safe_dir(forward.cross(up))
    up = _safe_dir(right.cross(forward))
    return Matrix((right, forward, up)).transposed()


def _anat_name(anat, *candidates):
    for n in candidates:
        if n in anat:
            return n
    raise KeyError(candidates)


def hips_C_dest_from_src(src_anat, dest_anat):
    """C maps source-character coords → dest-character coords: F_d * F_s^{-1}.

    R_dst_delta = C * R_src_delta * C^{-1} then matches character-space yaw/pitch
    even when Hips rest bone aims differ. Identity when both stand with the same
    world up/right/forward.
    """
    Fs = character_frame(
        src_anat,
        hips=_anat_name(src_anat, "mixamorig:Hips", "Hips"),
        left=_anat_name(src_anat, "mixamorig:LeftUpLeg", "LeftUpLeg"),
        right=_anat_name(src_anat, "mixamorig:RightUpLeg", "RightUpLeg"),
        head=_anat_name(src_anat, "mixamorig:Head", "Head"),
    )
    Fd = character_frame(
        dest_anat,
        hips=_anat_name(dest_anat, "Hips"),
        left=_anat_name(dest_anat, "LeftUpLeg"),
        right=_anat_name(dest_anat, "RightUpLeg"),
        head=_anat_name(dest_anat, "Head"),
    )
    return nearest_rotation(Fd @ Fs.inverted())


def hips_dest_pose_rotation(src_pose_R, src_rest_R, dst_rest_R, C):
    """Dest Hips world rotation: character-space source rest→pose delta on dest rest.

    Rdelta = RsrcPose * RsrcRest^{-1}; RdstPose = C * Rdelta * C^{-1} * RdstRest.
    Inputs are 3x3; outputs a proper rotation.
    """
    Rs_pose = nearest_rotation(src_pose_R)
    Rs_rest = nearest_rotation(src_rest_R)
    Rd_rest = nearest_rotation(dst_rest_R)
    Cc = nearest_rotation(C) if C is not None else Matrix.Identity(3)
    Rdelta = nearest_rotation(Rs_pose @ Rs_rest.inverted())
    return nearest_rotation(Cc @ Rdelta @ Cc.inverted() @ Rd_rest)


def apply_hips_character_delta(dest, dname, dest_rest_world, src_pose_world, src_rest_world, C):
    """Set dest Hips world rotation from character-space source orientation delta.

    Translation is left unchanged (caller applies root-motion Z / strip XY).
    """
    Rd = hips_dest_pose_rotation(
        src_pose_world.to_3x3(),
        src_rest_world.to_3x3(),
        dest_rest_world.to_3x3(),
        C,
    )
    dest_w = Rd.to_4x4()
    dest_w.translation = (dest.matrix_world @ dest.pose.bones[dname].matrix).translation
    pb = dest.pose.bones[dname]
    pb.matrix = dest.matrix_world.inverted() @ dest_w


def apply_aim_twist_bone(dest, dname, dest_rest_anat, src_pose_anat, src_rest_anat, sname):
    """Set dest bone world rotation so its aim matches source pose aim; copy twist around aim."""
    s_pose = src_pose_anat[sname]
    s_rest = src_rest_anat[sname]
    d_rest = dest_rest_anat[dname]
    pose_aim = _safe_dir(s_pose["aim"])
    swing_s = rotation_between(s_rest["aim"], pose_aim)
    src_x_swung = swing_s @ s_rest["x"]
    twist = signed_angle(src_x_swung, s_pose["x"], pose_aim)
    swing_d = rotation_between(d_rest["aim"], pose_aim)
    dest_x = swing_d @ d_rest["x"]
    dest_x = Matrix.Rotation(twist, 3, pose_aim) @ dest_x
    R = rotation_from_aim_x(pose_aim, dest_x)
    dest_w = R.to_4x4()
    dest_w.translation = (dest.matrix_world @ dest.pose.bones[dname].matrix).translation
    arm_space = dest.matrix_world.inverted() @ dest_w
    pb = dest.pose.bones[dname]
    pb.matrix = arm_space


def apply_delta_aim_twist_bone(dest, dname, dest_rest_anat, src_pose_anat, src_rest_anat, sname):
    """Apply source rest→pose swing+twist onto dest rest aim.

    Source-at-rest leaves dest rest unchanged (Undead Spine2 hunch stays a rest offset).
    """
    s_pose = src_pose_anat[sname]
    s_rest = src_rest_anat[sname]
    d_rest = dest_rest_anat[dname]
    pose_aim_src = _safe_dir(s_pose["aim"])
    swing_s = rotation_between(s_rest["aim"], pose_aim_src)
    dest_pose_aim = _safe_dir(swing_s @ d_rest["aim"])
    src_x_swung = swing_s @ s_rest["x"]
    twist = signed_angle(src_x_swung, s_pose["x"], pose_aim_src)
    dest_x = swing_s @ d_rest["x"]
    dest_x = Matrix.Rotation(twist, 3, dest_pose_aim) @ dest_x
    R = rotation_from_aim_x(dest_pose_aim, dest_x)
    dest_w = R.to_4x4()
    dest_w.translation = (dest.matrix_world @ dest.pose.bones[dname].matrix).translation
    arm_space = dest.matrix_world.inverted() @ dest_w
    pb = dest.pose.bones[dname]
    pb.matrix = arm_space


def distribute_helper_twist(dest, mapped_set, dest_rest_basis, skip_names=None):
    """Keep unmapped twist/breast/chest/shoulder01 helpers at rest local.

    They inherit parent swing without a second world copy (no double rotation).
    `skip_names` (in-series *02 twist helpers already posed explicitly by the
    hierarchy pass in retarget_frame) are left untouched here.
    """
    skip_names = skip_names or set()
    for pb in dest.pose.bones:
        if pb.name in mapped_set or pb.name in skip_names:
            continue
        rest_b = dest_rest_basis.get(pb.name)
        if rest_b is None:
            continue
        n = pb.name.lower()
        if any(k in n for k in ("02", "twist", "breast", "chest", "shoulder01", "clav")):
            pb.matrix_basis = rest_b.copy()


def compute_relative_twist(src_pose_anat, sname_p, sname_c):
    """Twist of source bone C relative to source bone P, about C's pose aim.

    twist = signed_angle(x_P swung onto aim_C, x_C_pose, aim_C)
    Uses only the source rig's current pose (no rest reference) so it captures
    the roll that exists between two in-series segments (e.g. forearm->hand).
    """
    p = src_pose_anat[sname_p]
    c = src_pose_anat[sname_c]
    aim_c = _safe_dir(c["aim"])
    swing = rotation_between(p["aim"], aim_c)
    x_p_swung = swing @ p["x"]
    return signed_angle(x_p_swung, c["x"], aim_c)


def apply_twist_helper_bone(dest, helper_name, twist, k):
    """Pose an in-series *02 twist helper as a pure rotation about its local Y (bone axis)."""
    pb = dest.pose.bones[helper_name]
    pb.rotation_mode = "QUATERNION"
    pb.rotation_quaternion = Quaternion(Vector((0.0, 1.0, 0.0)), k * twist)
    pb.location = Vector((0.0, 0.0, 0.0))
    pb.scale = Vector((1.0, 1.0, 1.0))


def capture_all_basis(arm):
    return {pb.name: pb.matrix_basis.copy() for pb in arm.pose.bones}


def anatomy_row(label, anat, names):
    rows = []
    for n in names:
        if n not in anat:
            continue
        a = anat[n]
        aim = a["aim"]
        rows.append(
            {
                "bone": n,
                "rig": label,
                "aim": [aim.x, aim.y, aim.z],
                "forwardDot": aim.y,
                "sideDot": aim.x,
                "upDot": aim.z,
                "head": list(a["head"]),
                "tail": list(a["tail"]),
            }
        )
    return rows


def compare_aims(src_rows, dst_rows):
    sm = {r["bone"]: r for r in src_rows}
    out = []
    for d in dst_rows:
        s = sm.get(d["bone"])
        if not s:
            continue
        sa = Vector(s["aim"])
        da = Vector(d["aim"])
        ang = sa.rotation_difference(da).angle
        out.append(
            {
                "bone": d["bone"],
                "aimAngleDeg": math.degrees(ang),
                "srcForward": s["forwardDot"],
                "dstForward": d["forwardDot"],
                "srcSide": s["sideDot"],
                "dstSide": d["sideDot"],
                "srcUp": s["upDot"],
                "dstUp": d["upDot"],
            }
        )
    return out


def compare_relative_aims(src_rest_anat, src_pose_anat, dest_rest_anat, dest_pose_anat, names):
    """Angle between dest pose aim and dest rest aim swung by source rest→pose."""
    out = []
    for name in names:
        if name not in dest_rest_anat or name not in dest_pose_anat:
            continue
        if name not in src_rest_anat or name not in src_pose_anat:
            continue
        s_rest = src_rest_anat[name]
        s_pose = src_pose_anat[name]
        d_rest = dest_rest_anat[name]
        d_pose = dest_pose_anat[name]
        swing_s = rotation_between(s_rest["aim"], s_pose["aim"])
        expected = _safe_dir(swing_s @ d_rest["aim"])
        actual = _safe_dir(d_pose["aim"])
        ang = expected.rotation_difference(actual).angle
        out.append({"bone": name, "relativeAimAngleDeg": math.degrees(ang)})
    return out
