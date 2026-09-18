"""Offline Mixamo → hm08 animation bake (Human / Orc / Undead).

Isolated Blender 5.2 background process. Never opens an interactive Blender scene or MCP 9876.
Does not write source body GLBs or Mixamo base.glb.

Prefer:

  /Applications/Blender.app/Contents/MacOS/Blender --background --python \\
    scripts/character-assets/retarget_profile.py -- --profile human|orc|undead

This module stays importable; `retarget_profile.py` is the CLI.
"""
from __future__ import annotations

import hashlib
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Matrix, Quaternion, Vector

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(Path(__file__).resolve().parent))
from retarget_bone_map import BONE_PAIRS, CLIP_MAP, LOOP_CLIPS, REQUIRED_DEST  # noqa: E402
from retarget_anatomy import (  # noqa: E402
    LIMB_DEST,
    anatomy_row,
    apply_aim_twist_bone,
    apply_delta_aim_twist_bone,
    apply_hips_character_delta,
    hips_C_dest_from_src,
    apply_twist_helper_bone,
    capture_all_basis,
    capture_anatomy,
    compare_aims,
    compare_relative_aims,
    compute_relative_twist,
    dest_to_src_map,
    distribute_helper_twist,
    find_twist_helpers,
    hierarchy_dest_order,
    unmapped_helpers,
    world_axes,
    world_head_tail,
)

SRC_MIXAMO = ROOT / "public/characters/base.glb"
SRC_HUMAN = ROOT / "public/characters/bodies/human-v1.glb"
OUT_BLEND = ROOT / "blender/characters/human-animated-v1.blend"
OUT_GLB = ROOT / "public/characters/bodies/human-animated-v1.glb"
EVID = ROOT / "ve-capture/m2e-human-animation"
REPORT = EVID / "bake-report.json"
PROFILE = None

PINNED_SHA256 = {
    "human-v1.glb": "ce441880c06a89ff1689a9482785e320f6b31f6e79a1c8d45e2a6e302479a75e",
    "orc-v1.glb": "ed8aebbeddd8302199ccb835eeaba9d2cc0516cd8205ef89f77313d35330c621",
    "undead-v1.glb": "f96d7c27c06505fe852a1d269a793073e3a2ca74c2a06e83a7722d4d81b854ad",
    "base.glb": "2f9e45d0f7d9faeae4c20e18585173d62953df1a8f0272f270bedb200927604c",
}

PROFILES = {
    "human": {
        "id": "human",
        "src_body": ROOT / "public/characters/bodies/human-v1.glb",
        "out_glb": ROOT / "public/characters/bodies/human-animated-v1.glb",
        "out_blend": ROOT / "blender/characters/human-animated-v1.blend",
        "evid": ROOT / "ve-capture/m2e-human-animation",
        "dest_name": "HumanV1",
        "collection": "DstHuman",
        "copyright": "Human animated v1 candidate: MakeHuman hm08 (CC0) + Mixamo clips retargeted offline",
        "lock_hips_world_xy": False,
        "delta_bones": (),
    },
    "orc": {
        "id": "orc",
        "src_body": ROOT / "public/characters/bodies/orc-v1.glb",
        "out_glb": ROOT / "public/characters/bodies/orc-animated-v1.glb",
        "out_blend": ROOT / "blender/characters/orc-animated-v1.blend",
        "evid": ROOT / "ve-capture/m2e-orc-animation",
        "dest_name": "OrcV1",
        "collection": "DstOrc",
        "copyright": "Orc animated v1 candidate: MakeHuman hm08 (CC0) + Mixamo clips retargeted offline",
        "lock_hips_world_xy": True,
        "delta_bones": (),
    },
    "undead": {
        "id": "undead",
        "src_body": ROOT / "public/characters/bodies/undead-v1.glb",
        "out_glb": ROOT / "public/characters/bodies/undead-animated-v1.glb",
        "out_blend": ROOT / "blender/characters/undead-animated-v1.blend",
        "evid": ROOT / "ve-capture/m2e-undead-animation",
        "dest_name": "UndeadV1",
        "collection": "DstUndead",
        "copyright": "Undead animated v1 candidate: MakeHuman hm08 (CC0) + Mixamo clips retargeted offline",
        "lock_hips_world_xy": False,
        "delta_bones": ("Spine2", "Neck", "Head"),
    },
}
FPS = 30
REST_TOL = 1e-3
LOOP_BLEND_FRAMES = 4
SOLE_SINK_LIMIT_M = -0.002
SOLE_CLEARANCE_LIMIT_M = 0.005
# Idle both-stance: each sole (not min of pair) must land in ±5 mm after hips plant-at-0.
IDLE_SOLE_SPREAD_M = 0.004
LIFT_MAX_STEP_M = 0.01
IDLE_LEG_BONES = (
    "LeftUpLeg",
    "LeftLeg",
    "LeftFoot",
    "LeftToeBase",
    "RightUpLeg",
    "RightLeg",
    "RightFoot",
    "RightToeBase",
)
IDLE_LEG_HELPER_PREFIXES = ("upperleg02.", "lowerleg02.")
# 0.060 m leftover / 0.01 needs ≥6 ease frames; run plant span 7.4 cm needs 8.
RAMP_FRAMES = 8
# Raise only lowerarm02 to 0.65 if the valid-ring after ratio is still < 0.80.
LOWERARM02_K = 0.65


def sha256_file(path):
    digest = hashlib.sha256()
    with open(path, "rb") as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def configure_profile(name):
    global PROFILE, SRC_HUMAN, OUT_BLEND, OUT_GLB, EVID, REPORT
    if name not in PROFILES:
        raise SystemExit(f"unknown profile {name!r}; want human|orc|undead")
    PROFILE = dict(PROFILES[name])
    SRC_HUMAN = PROFILE["src_body"]
    OUT_BLEND = PROFILE["out_blend"]
    OUT_GLB = PROFILE["out_glb"]
    EVID = PROFILE["evid"]
    REPORT = EVID / "bake-report.json"
    return PROFILE


def parse_profile_from_argv(default="human"):
    argv = sys.argv
    name = default
    for i, arg in enumerate(argv):
        if arg == "--profile" and i + 1 < len(argv):
            name = argv[i + 1]
        elif arg.startswith("--profile="):
            name = arg.split("=", 1)[1]
    return name


def pinned_source_paths():
    return {
        "human-v1.glb": ROOT / "public/characters/bodies/human-v1.glb",
        "orc-v1.glb": ROOT / "public/characters/bodies/orc-v1.glb",
        "undead-v1.glb": ROOT / "public/characters/bodies/undead-v1.glb",
        "base.glb": SRC_MIXAMO,
    }


def verify_pinned_hashes(stage):
    rows = {}
    mismatches = []
    for name, path in pinned_source_paths().items():
        got = sha256_file(path)
        want = PINNED_SHA256[name]
        rows[name] = {"path": str(path.relative_to(ROOT)), "sha256": got, "pinned": want}
        if got != want:
            mismatches.append(f"{name} {stage} {got} != {want}")
    if mismatches:
        raise RuntimeError("pinned source hash mismatch: " + "; ".join(mismatches))
    return rows


def reset_empty():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def find_armatures():
    arms = [o for o in bpy.data.objects if o.type == "ARMATURE"]
    dest = src = None
    for arm in arms:
        names = {b.name for b in arm.data.bones}
        if "Hips" in names and "finger1-1.L" in names:
            dest = arm
        elif any(n.endswith("Hips") or n == "mixamorig:Hips" for n in names):
            src = arm
    if dest is None or src is None:
        raise RuntimeError(f"armatures dest={dest} src={src} all={[a.name for a in arms]}")
    return dest, src


def bone_lookup(arm):
    table = {}
    for b in arm.data.bones:
        table[b.name] = b.name
        table[b.name.replace("mixamorig:", "")] = b.name
        table["mixamorig:" + b.name.replace("mixamorig:", "")] = b.name
    return table


def resolve_pairs(dest, src):
    dlu = bone_lookup(dest)
    slu = bone_lookup(src)
    pairs = []
    missing = []
    for dname, sname in BONE_PAIRS:
        dn = dlu.get(dname)
        sn = slu.get(sname) or slu.get(sname.replace("mixamorig:", ""))
        if not dn or not sn:
            missing.append((dname, sname, dn, sn))
        else:
            pairs.append((dn, sn))
    req_miss = [n for n in REQUIRED_DEST if n not in dlu]
    if req_miss or any(m[0] in REQUIRED_DEST for m in missing):
        raise RuntimeError(f"required bones missing dest={req_miss} pairs={missing}")
    if missing:
        raise RuntimeError(f"mapped bones missing: {missing}")
    return pairs


def world_bone(arm, bone_name):
    pb = arm.pose.bones[bone_name]
    return arm.matrix_world @ pb.matrix


def capture_rest(arm, names):
    bpy.context.view_layer.update()
    rest = {}
    for name in names:
        pb = arm.pose.bones[name]
        rest[name] = {
            "world": world_bone(arm, name).copy(),
            "basis": pb.matrix_basis.copy(),
            "loc": pb.location.copy(),
            "scale": pb.scale.copy(),
        }
    return rest


def clear_pose(arm):
    for pb in arm.pose.bones:
        pb.matrix_basis = Matrix.Identity(4)
        pb.location = Vector((0, 0, 0))
        pb.scale = Vector((1, 1, 1))
        pb.rotation_quaternion = (1, 0, 0, 0)
        pb.rotation_euler = (0, 0, 0)


def nla_strip(src, name):
    ad = src.animation_data
    for track in ad.nla_tracks:
        if track.name == name or (track.strips and track.strips[0].action and track.strips[0].action.name == name):
            return track, track.strips[0]
    raise RuntimeError(f"no NLA strip {name}")


def assign_source_action(src, action):
    ad = src.animation_data
    ad.action = None
    track, strip = nla_strip(src, action.name)
    for t in ad.nla_tracks:
        t.mute = t != track
        for s in t.strips:
            s.mute = t != track
    track.mute = False
    strip.mute = False
    bpy.context.view_layer.update()
    return strip


def play_dest_action(dest, action):
    """Evaluate ONLY the destination baked action; mute NLA and source."""
    ad = dest.animation_data
    if ad is None:
        ad = dest.animation_data_create()
    for t in ad.nla_tracks:
        t.mute = True
        for s in t.strips:
            s.mute = True
    ad.action = action
    slots = getattr(action, "slots", None)
    if slots is not None and len(slots) and hasattr(ad, "action_slot"):
        try:
            ad.action_slot = slots[0]
        except Exception as exc:
            print("slot assign", exc)
    bpy.context.view_layer.update()
    slot_name = None
    if getattr(ad, "action_slot", None):
        slot_name = ad.action_slot.name if hasattr(ad.action_slot, "name") else str(ad.action_slot)
    return {"action": action.name, "slot": slot_name, "nlaMuted": all(t.mute for t in ad.nla_tracks)}


def find_action(name):
    exact = [a for a in bpy.data.actions if a.name == name]
    if exact:
        return exact[0]
    for a in bpy.data.actions:
        if a.name.split(".")[0] == name:
            return a
    raise RuntimeError(f"missing source action {name}; have {[a.name for a in bpy.data.actions]}")


def retarget_frame(dest, src, pairs, dest_rest, src_rest, hips_name, strip_xz=True, ctx=None, twist_scale=1.0):
    """Aim+twist retarget. ctx holds anatomy rest + hierarchy (not world-rest deltas).

    twist_scale multiplies the in-series *02 helper twist contribution (1.0 in normal
    bakes; 0.0 is used only by measurement code to reproduce the pre-fix "pinned at
    rest" helper behaviour for before/after comparison).
    """
    bpy.context.view_layer.update()
    d2s = dest_to_src_map(pairs)
    order = ctx["order"] if ctx else [d for d, _ in pairs]
    helper_links = ctx.get("helper_links", {}) if ctx else {}
    dest_rest_anat = ctx["dest_rest_anat"]
    src_rest_anat = ctx["src_rest_anat"]
    dest_basis_all = ctx["dest_basis_all"]
    mapped = ctx["mapped"]
    twist_helper_names = ctx.get("twist_helper_names", set()) if ctx else set()
    src_names = [s for _, s in pairs]
    src_pose_anat = capture_anatomy(src, src_names)
    hips_world_before = world_bone(src, d2s[hips_name])
    src_hips_rest = src_rest[d2s[hips_name]]["world"]
    helper_measurements = {}
    for dname in order:
        if dname in helper_links:
            parent_dest, child_dest, k = helper_links[dname]
            sname_p = d2s[parent_dest]
            sname_c = d2s[child_dest]
            twist = compute_relative_twist(src_pose_anat, sname_p, sname_c)
            apply_twist_helper_bone(dest, dname, twist, k * twist_scale)
            helper_measurements[dname] = {
                "sourceTwistRad": twist,
                "appliedTwistRad": k * twist_scale * twist,
                "k": k,
            }
            bpy.context.view_layer.update()
            continue
        sname = d2s[dname]
        delta_bones = ctx.get("delta_bones", set()) if ctx else set()
        if dname == hips_name:
            C = ctx.get("hips_C") if ctx else None
            apply_hips_character_delta(
                dest,
                dname,
                dest_rest[dname]["world"],
                world_bone(src, sname),
                src_rest[sname]["world"],
                C,
            )
        elif dname in delta_bones:
            apply_delta_aim_twist_bone(dest, dname, dest_rest_anat, src_pose_anat, src_rest_anat, sname)
        else:
            apply_aim_twist_bone(dest, dname, dest_rest_anat, src_pose_anat, src_rest_anat, sname)
        pb = dest.pose.bones[dname]
        if dname != hips_name:
            pb.location = dest_rest[dname]["loc"]
            pb.scale = dest_rest[dname]["scale"]
        else:
            pb.scale = dest_rest[dname]["scale"]
            if strip_xz:
                rest_loc = dest_rest[dname]["loc"]
                pb.location.x = rest_loc.x
                pb.location.y = rest_loc.y
                src_dz = hips_world_before.translation.z - src_hips_rest.translation.z
                pb.location.z = rest_loc.z + src_dz
        bpy.context.view_layer.update()
    distribute_helper_twist(dest, mapped, dest_basis_all, skip_names=twist_helper_names)
    dest.location = Vector((0.0, 0.0, 0.0))
    bpy.context.view_layer.update()
    if ctx and ctx.get("lock_hips_world_xy"):
        pb = dest.pose.bones[hips_name]
        dest_w = (dest.matrix_world @ pb.matrix).copy()
        rest_t = dest_rest[hips_name]["world"].translation
        dest_w.translation.x = rest_t.x
        dest_w.translation.y = rest_t.y
        pb.matrix = dest.matrix_world.inverted() @ dest_w
        bpy.context.view_layer.update()
    dest_hips_w = world_bone(dest, hips_name).translation
    dest_rest_t = dest_rest[hips_name]["world"].translation
    src_delta = hips_world_before.translation - src_hips_rest.translation
    return {
        "srcHipsDelta": [src_delta.x, src_delta.y, src_delta.z],
        "dstHipsDelta": [
            dest_hips_w.x - dest_rest_t.x,
            dest_hips_w.y - dest_rest_t.y,
            dest_hips_w.z - dest_rest_t.z,
        ],
        "helperTwist": helper_measurements,
    }


def rest_identity_error(dest, src, pairs, dest_rest, src_rest, ctx=None):
    clear_pose(src)
    clear_pose(dest)
    bpy.context.view_layer.update()
    retarget_frame(dest, src, pairs, dest_rest, src_rest, "Hips", strip_xz=True, ctx=ctx)
    bpy.context.view_layer.update()
    max_err = 0.0
    worst = None
    for dname, _ in pairs:
        a = world_bone(dest, dname)
        b = dest_rest[dname]["world"]
        err = (a.translation - b.translation).length
        qerr = (a.to_quaternion().inverted() @ b.to_quaternion()).angle
        tot = err + qerr
        if tot > max_err:
            max_err = tot
            worst = (dname, err, qerr)
    return max_err, worst


def key_pose(dest, frame, names):
    for name in names:
        pb = dest.pose.bones[name]
        pb.rotation_mode = "QUATERNION"
        pb.keyframe_insert(data_path="location", frame=frame, group=name)
        pb.keyframe_insert(data_path="rotation_quaternion", frame=frame, group=name)
        pb.keyframe_insert(data_path="scale", frame=frame, group=name)


def new_action(dest, name):
    action = bpy.data.actions.new(name)
    if dest.animation_data is None:
        dest.animation_data_create()
    dest.animation_data.action = action
    slots = getattr(action, "slots", None)
    if slots is not None:
        try:
            slot = action.slots.new(id_type="OBJECT", name=dest.name)
            dest.animation_data.action_slot = slot
        except Exception as exc:
            print(f"action slot skipped: {exc}")
    return action


def sample_times(start, end, fps_src, fps_out=FPS):
    duration = max((end - start) / float(fps_src or 24), 1.0 / fps_out)
    n = max(2, int(round(duration * fps_out)) + 1)
    frames = [start + (end - start) * i / (n - 1) for i in range(n)]
    return frames, duration


def scene_setup_units():
    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1.0
    scene.render.fps = FPS
    scene.render.engine = "BLENDER_WORKBENCH"


def import_glb(path, coll_name):
    coll = bpy.data.collections.new(coll_name)
    bpy.context.scene.collection.children.link(coll)
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(path))
    added = [o for o in bpy.data.objects if o not in before]
    for o in added:
        for c in list(o.users_collection):
            c.objects.unlink(o)
        coll.objects.link(o)
    return added


def world_dims(arm):
    bpy.context.view_layer.update()
    xs, ys, zs = [], [], []
    for pb in arm.pose.bones:
        t = (arm.matrix_world @ pb.matrix).translation
        xs.append(t.x)
        ys.append(t.y)
        zs.append(t.z)
    return {
        "scale": list(arm.scale),
        "location": list(arm.location),
        "boneExtent": [max(xs) - min(xs), max(ys) - min(ys), max(zs) - min(zs)],
        "zRange": [min(zs), max(zs)],
    }


def mesh_inventory():
    rows = []
    for o in bpy.data.objects:
        if o.type != "MESH":
            continue
        bb = [o.matrix_world @ Vector(c) for c in o.bound_box]
        xs = [p.x for p in bb]
        ys = [p.y for p in bb]
        zs = [p.z for p in bb]
        diag = math.sqrt((max(xs) - min(xs)) ** 2 + (max(ys) - min(ys)) ** 2 + (max(zs) - min(zs)) ** 2)
        arm = o.find_armature()
        rows.append({
            "name": o.name,
            "verts": len(o.data.vertices),
            "diagM": diag,
            "zRange": [min(zs), max(zs)],
            "collections": [c.name for c in o.users_collection],
            "armature": arm.name if arm else None,
            "parent": o.parent.name if o.parent else None,
            "hide_render": bool(o.hide_render),
        })
    return rows


def custom_shape_objects(arm):
    found = set()
    for pb in arm.pose.bones:
        cs = getattr(pb, "custom_shape", None)
        if cs is not None:
            found.add(cs)
        # Blender 5 may store display type
    return found


def is_icosphere_like(obj):
    if obj.type != "MESH":
        return False
    n = len(obj.data.vertices)
    if n < 12:
        return False
    bb = [Vector(c) for c in obj.bound_box]
    xs = [p.x for p in bb]
    ys = [p.y for p in bb]
    zs = [p.z for p in bb]
    dx, dy, dz = max(xs) - min(xs), max(ys) - min(ys), max(zs) - min(zs)
    if min(dx, dy, dz) <= 1e-8:
        return False
    aspect = max(dx, dy, dz) / min(dx, dy, dz)
    name = obj.name.lower()
    named = any(k in name for k in ("icosphere", "icosphere", "custom", "bone_shape", "gltfcustom"))
    return named or (aspect < 1.15 and 20 <= n <= 320)


def strip_helper_meshes(dest, delete=True, keep_src=False):
    """Keep only destination skinned body / review-short meshes."""
    custom = custom_shape_objects(dest)
    kept = []
    removed = []
    for o in list(bpy.data.objects):
        if o.type != "MESH":
            continue
        arm = o.find_armature()
        is_src_mesh = arm is not dest and arm is not None
        helper = (
            o in custom
            or is_icosphere_like(o)
            or (is_src_mesh and not keep_src)
            or (o.name.startswith("Alpha_") and not keep_src)
            or ("mixamo" in o.name.lower() and not keep_src)
        )
        if helper:
            removed.append({"name": o.name, "verts": len(o.data.vertices), "reason": "helper/source/custom-shape"})
            if delete:
                bpy.data.objects.remove(o, do_unlink=True)
            else:
                o.hide_render = True
                o.hide_viewport = True
        else:
            o.hide_render = False
            o.hide_viewport = False
            kept.append(o.name)
    return kept, removed


def dest_body_meshes(dest):
    out = []
    for o in bpy.data.objects:
        if o.type == "MESH" and o.find_armature() == dest and not o.hide_render:
            out.append(o)
    return out


def loop_metrics(dest, names, nframes):
    bpy.context.scene.frame_set(1)
    bpy.context.view_layer.update()
    first = {n: world_bone(dest, n).copy() for n in names}
    first_q = {n: first[n].to_quaternion() for n in names}
    bpy.context.scene.frame_set(nframes)
    bpy.context.view_layer.update()
    max_d = 0.0
    max_a = 0.0
    worst_d = None
    worst_a = None
    for n in names:
        last = world_bone(dest, n)
        d = (last.translation - first[n].translation).length
        a = last.to_quaternion().rotation_difference(first_q[n]).angle
        if d > max_d:
            max_d = d
            worst_d = n
        if a > max_a:
            max_a = a
            worst_a = n
    ad = dest.animation_data
    return {
        "maxWorldJointEndpointDistanceM": max_d,
        "maxWorldJointEndpointBone": worst_d,
        "maxRotationRad": max_a,
        "maxRotationDeg": math.degrees(max_a),
        "maxRotationBone": worst_a,
        "evaluatedAction": ad.action.name if ad and ad.action else None,
        "evaluatedSlot": getattr(getattr(ad, "action_slot", None), "name", None) if ad else None,
        "firstFrame": 1,
        "lastFrame": nframes,
        "nlaAllMuted": all(t.mute for t in ad.nla_tracks) if ad else True,
        "note": "world-space joint origins, not matrix-element sums; not meters if misread historically",
    }


def _median(vals):
    s = sorted(vals)
    n = len(s)
    if n == 0:
        return 0.0
    m = n // 2
    if n % 2:
        return s[m]
    return 0.5 * (s[m - 1] + s[m])


def _sole_lift_floor(soles):
    """Most-negative hips ΔZ that still keeps every sole at/above -2 mm."""
    zs = [z for z in soles.values() if z is not None]
    if not zs:
        return 0.0
    return SOLE_SINK_LIMIT_M - min(zs)


def _shrink_lift_for_soles(lift, soles):
    """Shrink hips ΔZ so no sole goes below -2 mm. Never enlarge a lift."""
    floor = _sole_lift_floor(soles)
    if lift < floor:
        lift = floor
    return lift


def _stance_lift_ceiling(floor_m):
    """Hips ΔZ that puts the lowest sole at +5 mm (acceptance upper bound)."""
    return floor_m + (SOLE_CLEARANCE_LIMIT_M - SOLE_SINK_LIMIT_M)


def _worst_step(lifts):
    """Return (max |ΔL|, 1-based frame of the later sample, signed ΔL at that step)."""
    worst_abs = 0.0
    worst_frame = None
    worst_signed = 0.0
    for i in range(1, len(lifts)):
        signed = lifts[i] - lifts[i - 1]
        mag = abs(signed)
        if mag >= worst_abs:
            worst_abs = mag
            worst_frame = i + 1
            worst_signed = signed
    return worst_abs, worst_frame, worst_signed


def _limit_frame_delta(lifts, floors, max_step=LIFT_MAX_STEP_M, is_stance=None, loop=False, ceilings=None):
    """Cap |ΔL| at max_step by spreading excess onto airborne / non-binding frames.

    Never lowers a sample below its sole floor. Stance frames may rise only until
    the supporting sole would hit +5 mm (`ceilings`). If two consecutive binding
    floors differ by more than max_step, record that pair (hips-only is impossible).
    """
    out = [float(v) for v in lifts]
    n = len(out)
    if n < 2:
        return out, None
    if is_stance is None:
        is_stance = [False] * n
    else:
        is_stance = [bool(v) for v in is_stance]
    lo = [float(v) for v in floors]
    if ceilings is None:
        hi = [_stance_lift_ceiling(lo[i]) if is_stance[i] else 1e9 for i in range(n)]
    else:
        hi = [float(ceilings[i]) if is_stance[i] else 1e9 for i in range(n)]
    for i in range(n):
        if hi[i] < lo[i]:
            hi[i] = lo[i]

    conflict = None

    def consider_conflict(i0, i1):
        nonlocal conflict
        if hi[i0] < lo[i1] - max_step - 1e-12 or hi[i1] < lo[i0] - max_step - 1e-12:
            if conflict is None:
                conflict = {
                    "frameA": i0 + 1,
                    "frameB": i1 + 1,
                    "floorA": lo[i0],
                    "floorB": lo[i1],
                    "deltaM": abs(lo[i1] - lo[i0]),
                }

    for i in range(1, n):
        consider_conflict(i - 1, i)

    if loop:
        lo_e = max(lo[0], lo[-1])
        hi_e = min(hi[0], hi[-1])
        if lo_e > hi_e + 1e-12:
            consider_conflict(n - 1, 0)
        else:
            lo[0] = lo[-1] = lo_e
            hi[0] = hi[-1] = hi_e
            is_stance[0] = is_stance[-1] = is_stance[0] or is_stance[-1]

    for i in range(n):
        if out[i] < lo[i]:
            out[i] = lo[i]
    if loop:
        v = min(max(0.5 * (out[0] + out[-1]), lo[0]), hi[0])
        out[0] = out[-1] = v

    def move_to(j, target):
        nxt = max(lo[j], min(target, hi[j]))
        if abs(nxt - out[j]) > 1e-16:
            out[j] = nxt
            return True
        return False

    def pull_left_to_right(left, right):
        d = out[right] - out[left]
        if d > max_step + 1e-14:
            return move_to(left, out[right] - max_step)
        if d < -max_step - 1e-14:
            return move_to(left, out[right] + max_step)
        return False

    def pull_right_to_left(left, right):
        d = out[right] - out[left]
        if d > max_step + 1e-14:
            return move_to(right, out[left] + max_step)
        if d < -max_step - 1e-14:
            return move_to(right, out[left] - max_step)
        return False

    def fix_pair(left, right):
        d = out[right] - out[left]
        if abs(d) <= max_step + 1e-14:
            return False
        left_air = not is_stance[left]
        right_air = not is_stance[right]
        if left_air and pull_left_to_right(left, right):
            return True
        if right_air and pull_right_to_left(left, right):
            return True
        if pull_left_to_right(left, right):
            return True
        if pull_right_to_left(left, right):
            return True
        return False

    iters = n * n if n <= 96 else n * 24
    for _ in range(iters):
        changed = False
        for i in range(1, n):
            if fix_pair(i - 1, i):
                changed = True
        for i in range(n - 1, 0, -1):
            if fix_pair(i - 1, i):
                changed = True
        if loop:
            v = min(max(0.5 * (out[0] + out[-1]), lo[0]), hi[0])
            if abs(out[0] - v) > 1e-15 or abs(out[-1] - v) > 1e-15:
                out[0] = out[-1] = v
                changed = True
        if not changed:
            break

    for i in range(n):
        if out[i] < lo[i]:
            out[i] = lo[i]
    if loop:
        v = min(max(0.5 * (out[0] + out[-1]), lo[0]), hi[0])
        out[0] = out[-1] = v
        if out[0] < lo[0]:
            out[0] = out[-1] = lo[0]

    if conflict is None:
        for i in range(1, n):
            if abs(out[i] - out[i - 1]) > max_step + 1e-9:
                at_lo = abs(out[i - 1] - lo[i - 1]) <= 1e-12 and abs(out[i] - lo[i]) <= 1e-12
                if at_lo:
                    consider_conflict(i - 1, i)
    return out, conflict


def _close_loop_lifts(lifts, blend=LOOP_BLEND_FRAMES):
    n = len(lifts)
    if n < 2:
        return lifts
    out = lifts[:]
    target = out[0]
    b = min(blend, max(1, n - 1))
    for i in range(b):
        idx = n - b + i
        w = (i + 1) / float(b)
        out[idx] = (1.0 - w) * out[idx] + w * target
    out[-1] = target
    return out


def _ease_steps_needed(val, max_step):
    if max_step <= 1e-12 or abs(val) <= 1e-12:
        return 0
    return int(math.ceil(abs(val) / max_step))


def _bone_depth(dest, name):
    depth = 0
    pb = dest.pose.bones[name]
    while pb.parent is not None:
        depth += 1
        pb = pb.parent
    return depth


def _all_sole_zs(so):
    return [rec["minZ"] for rec in so.values() if rec.get("minZ") is not None]


def _sole_spread(so):
    zs = _all_sole_zs(so)
    if not zs:
        return 0.0
    return max(zs) - min(zs)


def _side_min_z(so, side):
    prefix = "left" if side == "left" else "right"
    vals = [rec["minZ"] for k, rec in so.items() if k.startswith(prefix) and rec.get("minZ") is not None]
    return min(vals) if vals else None


def _rotate_local(pb, axis, rad):
    pb.rotation_mode = "QUATERNION"
    pb.rotation_quaternion = (pb.rotation_quaternion @ Quaternion(axis, rad)).normalized()


def _fk_move_side_z(dest, sole, side, target_z, bones, want_lower):
    """1-DOF local hinge on side bones. Not IK: one axis at a time, no 2-bone solve."""
    so0 = sample_soles(dest, sole)
    z0 = _side_min_z(so0, side)
    if z0 is None:
        return z0
    if want_lower and z0 <= target_z + IDLE_SOLE_SPREAD_M:
        return z0
    if (not want_lower) and z0 >= target_z - IDLE_SOLE_SPREAD_M:
        return z0
    for bone_name in bones:
        pb = dest.pose.bones.get(bone_name)
        if pb is None:
            continue
        pb.rotation_mode = "QUATERNION"
        q0 = pb.rotation_quaternion.copy()
        z0 = _side_min_z(sample_soles(dest, sole), side)
        if z0 is None:
            continue
        best_q = q0.copy()
        best_z = z0
        for axis in (Vector((1.0, 0.0, 0.0)), Vector((0.0, 0.0, 1.0))):
            for sign in (1.0, -1.0):
                pb.rotation_quaternion = q0.copy()
                _rotate_local(pb, axis, sign * 0.1)
                bpy.context.view_layer.update()
                z_probe = _side_min_z(sample_soles(dest, sole), side)
                pb.rotation_quaternion = q0.copy()
                bpy.context.view_layer.update()
                if z_probe is None:
                    continue
                lowers = z_probe < z0 - 1e-5
                raises = z_probe > z0 + 1e-5
                if want_lower and not lowers:
                    continue
                if (not want_lower) and not raises:
                    continue
                lo, hi = 0.0, 0.65
                for _ in range(9):
                    mid = 0.5 * (lo + hi)
                    pb.rotation_quaternion = q0.copy()
                    _rotate_local(pb, axis, sign * mid)
                    bpy.context.view_layer.update()
                    z = _side_min_z(sample_soles(dest, sole), side)
                    if z is None:
                        hi = mid
                        continue
                    improved = (z < best_z - 1e-6) if want_lower else (z > best_z + 1e-6)
                    if improved:
                        best_z = z
                        best_q = pb.rotation_quaternion.copy()
                    hit = z <= target_z + IDLE_SOLE_SPREAD_M if want_lower else z >= target_z - IDLE_SOLE_SPREAD_M
                    if hit:
                        hi = mid
                    else:
                        lo = mid
        pb.rotation_quaternion = best_q
        bpy.context.view_layer.update()
        z0 = best_z
        if want_lower and z0 <= target_z + IDLE_SOLE_SPREAD_M:
            return z0
        if (not want_lower) and z0 >= target_z - IDLE_SOLE_SPREAD_M:
            return z0
    return z0


def _idle_double_plant_pose(dest, dest_rest, dest_names):
    """Idle Mixamo is a weight-shift: hips-only plant leaves one sole in the air.

    Keep Mixamo hips translation and upper-body world pose. Rest hips rotation +
    rest leg locals so both feet are stance. No IK / no 2-bone solve.
    """
    if not dest_rest:
        return {"applied": False, "reason": "no dest_rest"}
    saved = {}
    for name in dest_names:
        if name == "Hips" or name in IDLE_LEG_BONES:
            continue
        saved[name] = world_bone(dest, name).copy()
    hips = dest.pose.bones["Hips"]
    loc = hips.location.copy()
    scl = hips.scale.copy()
    hips.matrix_basis = dest_rest["Hips"]["basis"].copy()
    hips.location = loc
    hips.scale = scl
    bpy.context.view_layer.update()
    for name in IDLE_LEG_BONES:
        if name not in dest_rest or name not in dest.pose.bones:
            continue
        pb = dest.pose.bones[name]
        rest = dest_rest[name]
        pb.matrix_basis = rest["basis"].copy()
        pb.location = rest["loc"].copy()
        pb.scale = rest["scale"].copy()
    for pb in dest.pose.bones:
        if pb.name.startswith(IDLE_LEG_HELPER_PREFIXES):
            pb.matrix_basis = Matrix.Identity(4)
    bpy.context.view_layer.update()
    for name in sorted(saved, key=lambda n: _bone_depth(dest, n)):
        pb = dest.pose.bones[name]
        pb.matrix = dest.matrix_world.inverted() @ saved[name]
        bpy.context.view_layer.update()
    return {"applied": True, "spreadAfterRestM": None}


def _equalize_idle_soles(dest, sole, dest_rest, dest_names):
    info = _idle_double_plant_pose(dest, dest_rest, dest_names)
    so = sample_soles(dest, sole)
    spread = _sole_spread(so)
    info["spreadAfterRestM"] = spread
    if spread <= IDLE_SOLE_SPREAD_M:
        info["fallback"] = None
        return info
    left = _side_min_z(so, "left")
    right = _side_min_z(so, "right")
    if left is None or right is None:
        info["fallback"] = "missing-side"
        return info
    high = "left" if left > right else "right"
    high_bones = ["LeftLeg", "LeftUpLeg", "LeftFoot"] if high == "left" else ["RightLeg", "RightUpLeg", "RightFoot"]
    _fk_move_side_z(dest, sole, high, min(left, right), high_bones, want_lower=True)
    so = sample_soles(dest, sole)
    spread = _sole_spread(so)
    if spread > IDLE_SOLE_SPREAD_M:
        left = _side_min_z(so, "left")
        right = _side_min_z(so, "right")
        high = "left" if left > right else "right"
        low = "right" if high == "left" else "left"
        low_bones = ["LeftLeg", "LeftUpLeg", "LeftFoot"] if low == "left" else ["RightLeg", "RightUpLeg", "RightFoot"]
        _fk_move_side_z(dest, sole, low, max(left, right), low_bones, want_lower=False)
        so = sample_soles(dest, sole)
        spread = _sole_spread(so)
    info["spreadAfterFkM"] = spread
    info["fallback"] = "fk-hinge"
    return info


def _ramp_lifts(raw, ramp=RAMP_FRAMES, max_step=LIFT_MAX_STEP_M):
    """Leave every genuinely-active (nonzero) stance sample exact; ease into and
    out of each active run on inactive frames. Ease is slope-limited at max_step
    (a 6 cm plant needs ≥6 frames). Gaps too short to reach 0 at that slope are
    interpolated between the two edge plants instead of being forced through 0.
    Never writes another event's own exact active sample."""
    n = len(raw)
    out = raw[:]
    active = [abs(v) > 1e-12 for v in raw]
    i = 0
    while i < n:
        if active[i]:
            i += 1
            continue
        j = i
        while j < n and not active[j]:
            j += 1
        left_val = raw[i - 1] if i - 1 >= 0 else 0.0
        right_val = raw[j] if j < n else 0.0
        gap_len = j - i
        if left_val == 0.0 and right_val == 0.0:
            i = j
            continue
        need_l = max(ramp, _ease_steps_needed(left_val, max_step))
        need_r = max(ramp, _ease_steps_needed(right_val, max_step))
        # Same-sign plants cannot hit 0 and return within this gap at max_step.
        through_zero = (left_val * right_val) <= 0.0 or (need_l + need_r <= gap_len)
        if gap_len <= 2 * ramp or not through_zero:
            for k in range(gap_len):
                t = (k + 1) / (gap_len + 1)
                out[i + k] = left_val * (1.0 - t) + right_val * t
        else:
            n_left = min(need_l, gap_len)
            n_right = min(need_r, gap_len - n_left)
            for k in range(n_left):
                t = k + 1
                if left_val > 0.0:
                    out[i + k] = max(0.0, left_val - max_step * t)
                else:
                    out[i + k] = min(0.0, left_val + max_step * t)
            for k in range(n_right):
                t = k + 1
                idx = j - 1 - k
                if right_val > 0.0:
                    out[idx] = max(0.0, right_val - max_step * t)
                else:
                    out[idx] = min(0.0, right_val + max_step * t)
        i = j
    return out


def correct_foot_contact(
    dest, action, dest_names, nframes, sole, hips_name="Hips", mode="full", loop=False,
    both_stance=False, dest_rest=None,
):
    """Per-frame world-Z hips from supporting soles. No global lift. No air snap.

    mode:
      "full"        ground clips (idle/walk/run/cast) - plant every stance frame.
      "prelaunch"   jumpStart - plant only frames at/before the last supporting frame
                    (pre-launch stance); airborne tail frames keep lift=0.
      "postcontact" jumpLand - plant only frames at/after the first supporting frame
                    (post-landing stance); airborne head frames keep lift=0.
      "none"        jumpLoop - never plant; lift stays 0 for reporting only.

    Semantic gate (not a magnitude/clip-floor gate): a frame is "supporting" for sole
    key k if its z is within 0.025m of that key's own cycle minimum. The overall
    per-frame lift always comes from the lowest currently-supporting sole, never a
    global constant.

    both_stance (idle): every sole is stance every frame. Rest hips rotation + rest
    leg locals (keep Mixamo hips translation + upper-body world). No IK.
    """
    play_dest_action(dest, action)
    hips = dest.pose.bones[hips_name]
    series = []
    equalize = []
    for i in range(nframes):
        bpy.context.scene.frame_set(i + 1)
        bpy.context.view_layer.update()
        if both_stance:
            equalize.append(_equalize_idle_soles(dest, sole, dest_rest, dest_names))
            key_pose(dest, i + 1, dest_names)
        so = sample_soles(dest, sole)
        series.append({"frame": i + 1, "soles": {k: so[k]["minZ"] for k in so}})
    if not series:
        return {"applied": False}
    if both_stance and loop and nframes >= 2:
        bpy.context.scene.frame_set(1)
        bpy.context.view_layer.update()
        first = {}
        for name in dest_names:
            pb = dest.pose.bones[name]
            first[name] = (pb.location.copy(), pb.rotation_quaternion.copy(), pb.scale.copy())
        bpy.context.scene.frame_set(nframes)
        for name, (loc, rot, scl) in first.items():
            pb = dest.pose.bones[name]
            pb.location = loc
            pb.rotation_mode = "QUATERNION"
            pb.rotation_quaternion = rot
            pb.scale = scl
        key_pose(dest, nframes, dest_names)
        bpy.context.view_layer.update()
        so = sample_soles(dest, sole)
        series[-1]["soles"] = {k: so[k]["minZ"] for k in so}
    per_key_min = {}
    for k in sole:
        vals = [s["soles"][k] for s in series if s["soles"].get(k) is not None]
        per_key_min[k] = min(vals) if vals else 0.0
    clip_floor = min(per_key_min.values()) if per_key_min else 0.0
    n = len(series)
    stance_flag = {k: [False] * n for k in sole}
    for i, rec in enumerate(series):
        for k, z in rec["soles"].items():
            if z is None:
                continue
            if both_stance or z <= per_key_min[k] + 0.025:
                stance_flag[k][i] = True
    supporting_flags = [any(stance_flag[k][i] for k in sole) for i in range(n)]

    if mode == "prelaunch":
        idxs = [i for i, s in enumerate(supporting_flags) if s]
        last_support = idxs[-1] if idxs else -1
        eligible = [i <= last_support for i in range(n)]
    elif mode == "postcontact":
        idxs = [i for i, s in enumerate(supporting_flags) if s]
        first_support = idxs[0] if idxs else n
        eligible = [i >= first_support for i in range(n)]
    elif mode == "none":
        eligible = [False] * n
    else:
        eligible = [True] * n

    # Per frame, L plants the lowest supporting sole at z=0, then is raised to
    # the per-frame floor so no sole lands below -2 mm. Ramp, then spread illegal
    # |ΔL| onto airborne / non-binding frames. Loop clips force lifts[-1]=lifts[0]
    # after smoothing so the seam cannot reopen.
    raw_lifts = [0.0] * n
    floors = [_sole_lift_floor(rec["soles"]) for rec in series]
    support_min = [None] * n
    clamped_frames = 0
    for i, rec in enumerate(series):
        if not eligible[i]:
            continue
        supporting = [rec["soles"][k] for k in sole if stance_flag[k][i] and rec["soles"].get(k) is not None]
        if not supporting:
            continue
        lowest = min(supporting)
        support_min[i] = lowest
        L = -lowest if abs(lowest) > 0.002 else 0.0
        L2 = max(L, floors[i])
        if abs(L2 - L) > 1e-12:
            clamped_frames += 1
        raw_lifts[i] = L2
    planted = [bool(eligible[i] and supporting_flags[i]) for i in range(n)]
    ceilings = [1e9] * n
    for i in range(n):
        if planted[i] and support_min[i] is not None:
            ceilings[i] = SOLE_CLEARANCE_LIMIT_M - support_min[i]
    lifts = _ramp_lifts(raw_lifts, ramp=RAMP_FRAMES, max_step=LIFT_MAX_STEP_M)
    for i in range(n):
        if lifts[i] < floors[i]:
            lifts[i] = floors[i]
            clamped_frames += 1
    lifts, binding_conflict = _limit_frame_delta(
        lifts, floors, max_step=LIFT_MAX_STEP_M, is_stance=planted, loop=False,
        ceilings=ceilings,
    )
    if loop:
        lifts = _close_loop_lifts(lifts)
        for i in range(n):
            if lifts[i] < floors[i]:
                lifts[i] = floors[i]
                clamped_frames += 1
        lifts[-1] = lifts[0]
        lifts, conflict2 = _limit_frame_delta(
            lifts, floors, max_step=LIFT_MAX_STEP_M, is_stance=planted, loop=True,
            ceilings=ceilings,
        )
        lifts[-1] = lifts[0]
        if binding_conflict is None:
            binding_conflict = conflict2

    max_delta, worst_frame, worst_signed = _worst_step(lifts)

    play_dest_action(dest, action)
    after_series = []
    for rec, lift in zip(series, lifts):
        bpy.context.scene.frame_set(rec["frame"])
        bpy.context.view_layer.update()
        Mw = (dest.matrix_world @ hips.matrix).copy()
        Mw.translation.z += lift
        hips.matrix = dest.matrix_world.inverted() @ Mw
        key_pose(dest, rec["frame"], dest_names)
        bpy.context.view_layer.update()
        so = sample_soles(dest, sole)
        after_series.append({k: so[k]["minZ"] for k in so})
    after_vals = [
        after_series[i][k]
        for i in range(n)
        for k in sole
        if stance_flag[k][i] and after_series[i].get(k) is not None
    ]
    after_stance_min = min(after_vals) if after_vals else None
    after_stance_max = max(after_vals) if after_vals else None
    after_floor = min(
        (v for row in after_series for v in row.values() if v is not None), default=None
    )
    stance_frame_numbers = {k: [i + 1 for i in range(n) if stance_flag[k][i]] for k in sole}
    after_per_key = {}
    for k in sole:
        vals = [row[k] for row in after_series if row.get(k) is not None]
        after_per_key[k] = {
            "minZ": min(vals) if vals else None,
            "maxZ": max(vals) if vals else None,
        }
    idle_eq = None
    if equalize:
        rest_s = [e.get("spreadAfterRestM") for e in equalize if e.get("spreadAfterRestM") is not None]
        fk_s = [e.get("spreadAfterFkM") for e in equalize if e.get("spreadAfterFkM") is not None]
        idle_eq = {
            "frames": len(equalize),
            "maxSpreadAfterRestM": max(rest_s) if rest_s else None,
            "maxSpreadAfterFkM": max(fk_s) if fk_s else None,
            "fkFallbackCount": sum(1 for e in equalize if e.get("fallback") == "fk-hinge"),
        }
    return {
        "applied": mode != "none",
        "mode": mode,
        "bothStance": bool(both_stance),
        "loopLiftSeam": bool(loop),
        "maxLiftM": max(lifts) if lifts else 0.0,
        "minLiftM": min(lifts) if lifts else 0.0,
        "meanLiftM": sum(lifts) / len(lifts) if lifts else 0.0,
        "maxFrameDeltaM": max_delta,
        "worstStepFrame": worst_frame,
        "worstStepM": worst_signed,
        "bindingFloorConflict": binding_conflict,
        "clampedFrameCount": clamped_frames,
        "clipFloorM": clip_floor,
        "clipFloorAfterM": after_floor,
        "stanceSoleMinZAfterM": after_stance_min,
        "stanceSoleMaxZAfterM": after_stance_max,
        "stanceSolePerKeyAfterM": after_per_key,
        "idleEqualize": idle_eq,
        "stanceFrames": {k: [v[0], v[-1]] if v else None for k, v in stance_frame_numbers.items()},
        "stanceCount": {k: len(v) for k, v in stance_frame_numbers.items()},
        "liftsM": lifts,
        "floorsM": floors,
        "note": "world-Z hips; plant last after one close_loop; idle both-stance rest hips-rot+legs then plant; L clamped so no sole goes below -2mm; |ΔL|≤0.01 by spreading onto air/non-binding frames; loop lifts[-1]=lifts[0] after smoothing; semantic per-sole stance gate; slope-limited ramp; no IK",
    }


def close_loop(dest, action, names, nframes):
    """Offline crossfade last few keys toward frame-1 pose so loops meet."""
    play_dest_action(dest, action)
    bpy.context.scene.frame_set(1)
    bpy.context.view_layer.update()
    first_loc = {}
    first_rot = {}
    first_scl = {}
    for n in names:
        pb = dest.pose.bones[n]
        first_loc[n] = pb.location.copy()
        first_rot[n] = pb.rotation_quaternion.copy()
        first_scl[n] = pb.scale.copy()
    blend = min(LOOP_BLEND_FRAMES, max(1, nframes - 1))
    for i in range(blend):
        frame = nframes - blend + 1 + i
        w = (i + 1) / float(blend)
        bpy.context.scene.frame_set(frame)
        bpy.context.view_layer.update()
        for n in names:
            pb = dest.pose.bones[n]
            pb.location = pb.location.lerp(first_loc[n], w)
            pb.rotation_quaternion = pb.rotation_quaternion.slerp(first_rot[n], w)
            pb.scale = pb.scale.lerp(first_scl[n], w)
        key_pose(dest, frame, names)
    bpy.context.scene.frame_set(nframes)
    for n in names:
        pb = dest.pose.bones[n]
        pb.location = first_loc[n]
        pb.rotation_quaternion = first_rot[n]
        pb.scale = first_scl[n]
    key_pose(dest, nframes, names)


def bake_clip(dest, src, pairs, dest_rest, src_rest, semantic, src_name, fps_src, ctx=None):
    action_src = find_action(src_name)
    strip = assign_source_action(src, action_src)
    f0, f1 = int(round(strip.frame_start)), int(round(strip.frame_end))
    samples, duration = sample_times(f0, f1, fps_src)
    dest_names = [d for d, _ in pairs]
    act = new_action(dest, semantic)
    src_dx = []
    dst_dx = []
    moving = set()
    prev = None
    nonfinite = False
    for i, sf in enumerate(samples):
        bpy.context.scene.frame_set(int(round(sf)))
        bpy.context.view_layer.update()
        info = retarget_frame(dest, src, pairs, dest_rest, src_rest, "Hips", strip_xz=True, ctx=ctx)
        src_dx.append(info["srcHipsDelta"])
        dst_dx.append(info["dstHipsDelta"])
        frame = i + 1
        key_pose(dest, frame, dest_names)
        pose = {n: world_bone(dest, n).copy() for n in dest_names}
        for n in dest_names:
            t = pose[n].translation
            if not all(math.isfinite(v) for v in t):
                nonfinite = True
        if prev:
            for n in dest_names:
                if (pose[n].translation - prev[n].translation).length > 1e-5:
                    moving.add(n)
                else:
                    dq = pose[n].to_quaternion().rotation_difference(prev[n].to_quaternion()).angle
                    if dq > 1e-4:
                        moving.add(n)
        prev = pose
        if i in (0, len(samples) - 1):
            print("  sample", i, "srcHips", info["srcHipsDelta"], "dstHips", info["dstHipsDelta"])
    act.use_frame_range = True
    try:
        act.frame_start = 1
        act.frame_end = len(samples)
    except Exception:
        pass
    eval_info = play_dest_action(dest, act)
    loop = None
    if semantic in LOOP_CLIPS and len(samples) >= 2:
        loop = loop_metrics(dest, dest_names, len(samples))
        loop["evaluatedAction"] = eval_info["action"]
        loop["evaluatedSlot"] = eval_info["slot"]
        loop["sourceNlaMutedOnSrc"] = True
        loop["note"] = "pre-close_loop; final seam is loopSeamAfterFoot"
    return {
        "semantic": semantic,
        "sourceAction": action_src.name,
        "sourceFrameRange": [f0, f1],
        "bakedFrames": len(samples),
        "durationSec": duration,
        "movingBones": sorted(moving),
        "movingBoneCount": len(moving),
        "srcHipsDeltaRange": _range3(src_dx),
        "dstHipsDeltaRange": _range3(dst_dx),
        "loopSeam": loop,
        "loopSeamAfterFoot": None,
        "actionName": act.name,
        "nonfinite": nonfinite,
        "eval": eval_info,
    }


def _range3(rows):
    if not rows:
        return None
    mins = [min(r[i] for r in rows) for i in range(3)]
    maxs = [max(r[i] for r in rows) for i in range(3)]
    return {"min": mins, "max": maxs, "span": [maxs[i] - mins[i] for i in range(3)]}


def nla_pack(dest, clip_infos):
    ad = dest.animation_data
    ad.action = None
    keep = {c["actionName"] for c in clip_infos}
    for info in clip_infos:
        track = ad.nla_tracks.new()
        track.name = info["semantic"]
        act = bpy.data.actions[info["actionName"]]
        strip = track.strips.new(info["semantic"], 1, act)
        strip.action = act
        strip.frame_end = max(2, info["bakedFrames"])
        track.mute = True
        strip.mute = True
    return keep


def purge_foreign_actions(keep):
    for act in list(bpy.data.actions):
        if act.name not in keep:
            act.user_clear()
            bpy.data.actions.remove(act)


def delete_source():
    if "SrcMixamo" in bpy.data.collections:
        coll = bpy.data.collections["SrcMixamo"]
        for obj in list(coll.objects):
            bpy.data.objects.remove(obj, do_unlink=True)
        bpy.data.collections.remove(coll)
    for obj in list(bpy.data.objects):
        if "mixamo" in obj.name.lower() or obj.name.startswith("Alpha_"):
            bpy.data.objects.remove(obj, do_unlink=True)


def export_glb(dest):
    OUT_GLB.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.object.select_all(action="DESELECT")
    keep_meshes = {o.name for o in dest_body_meshes(dest)}
    keep = {dest.name} | keep_meshes
    leaked = []
    for obj in bpy.context.scene.objects:
        in_src = any(c.name == "SrcMixamo" for c in obj.users_collection)
        helper = is_icosphere_like(obj) if obj.type == "MESH" else False
        sel = obj.name in keep and not in_src and not helper
        if obj.type == "MESH" and sel is False and obj.hide_render is False:
            leaked.append(obj.name)
        obj.select_set(sel)
        obj.hide_render = not sel
    if leaked:
        print("WARN would-export extras (hidden):", leaked)
    bpy.ops.export_scene.gltf(
        filepath=str(OUT_GLB),
        export_format="GLB",
        use_selection=True,
        export_yup=True,
        export_apply=False,
        export_skins=True,
        export_all_influences=False,
        export_influence_nb=4,
        export_animations=True,
        export_nla_strips=True,
        export_force_sampling=True,
        export_frame_range=False,
        export_anim_single_armature=True,
        export_morph=False,
        export_cameras=False,
        export_lights=False,
        export_extras=False,
        export_rest_position_armature=True,
        export_texcoords=True,
        export_normals=True,
        export_materials="EXPORT",
        export_image_format="AUTO",
        export_copyright=(PROFILE or PROFILES["human"])["copyright"],
    )
    return leaked


def setup_preview_camera(dest):
    bpy.context.view_layer.update()
    meshes = dest_body_meshes(dest)
    coords = []
    for m in meshes:
        for v in m.bound_box:
            coords.append(m.matrix_world @ Vector(v))
    if coords:
        center = sum(coords, Vector()) / len(coords)
        zs = [c.z for c in coords]
        height = max(zs) - min(zs)
    else:
        center = world_bone(dest, "Hips").translation
        height = 1.8
        zs = [0.0, height]
    cam_data = bpy.data.cameras.new("PreviewCam")
    cam_data.lens = 50
    cam = bpy.data.objects.new("PreviewCam", cam_data)
    bpy.context.scene.collection.objects.link(cam)
    dist = max(2.6, height * 1.85)
    cam.location = (center.x + dist * 0.95, center.y - dist * 1.35, min(zs) + height * 0.48)
    direction = Vector((center.x, center.y, min(zs) + height * 0.45)) - cam.location
    cam.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    bpy.context.scene.camera = cam
    light_data = bpy.data.lights.new("PreviewKey", "SUN")
    light_data.energy = 3.0
    light = bpy.data.objects.new("PreviewKey", light_data)
    bpy.context.scene.collection.objects.link(light)
    light.rotation_euler = (math.radians(50), 0, math.radians(30))
    scene = bpy.context.scene
    scene.render.resolution_x = 640
    scene.render.resolution_y = 900
    scene.render.image_settings.file_format = "PNG"
    scene.render.film_transparent = False
    world = bpy.data.worlds.new("PreviewWorld")
    scene.world = world
    world.use_nodes = True
    bg = next(n for n in world.node_tree.nodes if n.type == "BACKGROUND")
    bg.inputs[0].default_value = (0.22, 0.23, 0.25, 1.0)
    try:
        scene.display.shading.light = "STUDIO"
        scene.display.shading.color_type = "TEXTURE"
        scene.display.shading.show_object_outline = False
    except Exception:
        pass
    # hide armature custom shapes / bones in render
    dest.hide_render = True
    dest.data.display_type = "STICK"
    dest.show_in_front = False
    return cam


def render_closeups(dest, info, prefix=""):
    act = bpy.data.actions[info["actionName"]]
    play_dest_action(dest, act)
    nframes = info["bakedFrames"]
    frame = 1 + int(round((nframes - 1) * 2 / 5))
    bpy.context.scene.frame_set(frame)
    bpy.context.view_layer.update()
    cam = bpy.context.scene.camera
    old_loc = cam.location.copy()
    old_rot = cam.rotation_euler.copy()
    old_lens = cam.data.lens
    paths = []
    hand = world_bone(dest, "LeftHand").translation
    cam.location = (hand.x + 0.55, hand.y - 0.7, hand.z + 0.15)
    cam.data.lens = 85
    direction = hand - cam.location
    cam.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    p = EVID / f"{prefix}{info['semantic']}_hand.png"
    bpy.context.scene.render.filepath = str(p)
    bpy.ops.render.render(write_still=True)
    paths.append(str(p.relative_to(ROOT)))
    sh = world_bone(dest, "LeftShoulder").translation
    cam.location = (sh.x + 0.7, sh.y - 0.9, sh.z + 0.05)
    cam.data.lens = 70
    direction = sh - cam.location
    cam.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    p = EVID / f"{prefix}{info['semantic']}_shoulder.png"
    bpy.context.scene.render.filepath = str(p)
    bpy.ops.render.render(write_still=True)
    paths.append(str(p.relative_to(ROOT)))
    if info["semantic"] == "cast":
        head_fa, tail_fa = world_head_tail(dest, "LeftForeArm")
        mid_fa = (head_fa + tail_fa) * 0.5
        cam.location = (mid_fa.x + 0.32, mid_fa.y - 0.42, mid_fa.z + 0.08)
        cam.data.lens = 100
        direction = mid_fa - cam.location
        cam.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
        p = EVID / f"{prefix}{info['semantic']}_forearm.png"
        bpy.context.scene.render.filepath = str(p)
        bpy.ops.render.render(write_still=True)
        paths.append(str(p.relative_to(ROOT)))
    cam.location = old_loc
    cam.rotation_euler = old_rot
    cam.data.lens = old_lens
    return paths


def offset_armature(arm, dx):
    arm.location.x += dx
    bpy.context.view_layer.update()


def render_alignment(dest, src, pairs, dest_rest, src_rest, ctx, src_action_name, tag):
    action_src = find_action(src_action_name)
    assign_source_action(src, action_src)
    bpy.context.scene.frame_set(int(round((action_src.frame_range[0] + action_src.frame_range[1]) * 0.4)))
    bpy.context.view_layer.update()
    retarget_frame(dest, src, pairs, dest_rest, src_rest, "Hips", True, ctx)
    bpy.context.view_layer.update()
    d2s = dest_to_src_map(pairs)
    src_anat = capture_anatomy(src, [s for _, s in pairs])
    dst_anat = capture_anatomy(dest, [d for d, _ in pairs])
    src_as_dest = {}
    for d, s in d2s.items():
        if s in src_anat:
            src_as_dest[d] = src_anat[s]
    src_rows = anatomy_row("src", src_as_dest, LIMB_DEST)
    dst_rows = anatomy_row("dst", dst_anat, LIMB_DEST)
    cmp = compare_aims(src_rows, dst_rows)
    mapped_names = [d for d, _ in pairs]
    src_rows_all = anatomy_row("src", src_as_dest, mapped_names)
    dst_rows_all = anatomy_row("dst", dst_anat, mapped_names)
    cmp_all = compare_aims(src_rows_all, dst_rows_all)
    delta_bones = list(ctx.get("delta_bones", ())) if ctx else []
    src_rest_as_dest = {}
    for d, s in d2s.items():
        if s in ctx["src_rest_anat"]:
            src_rest_as_dest[d] = ctx["src_rest_anat"][s]
    rel = (
        compare_relative_aims(
            src_rest_as_dest, src_as_dest, ctx["dest_rest_anat"], dst_anat, delta_bones
        )
        if delta_bones
        else []
    )
    offset_armature(src, -0.9)
    offset_armature(dest, 0.9)
    src.hide_render = True  # mesh already stripped; armature hidden
    # unhide source meshes if any remain
    for o in bpy.data.objects:
        if o.type == "MESH" and o.find_armature() == src:
            o.hide_render = False
    path = EVID / f"align_{tag}.png"
    bpy.context.scene.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)
    offset_armature(src, 0.9)
    offset_armature(dest, -0.9)
    return {
        "path": str(path.relative_to(ROOT)),
        "aims": cmp,
        "aimsMapped": cmp_all,
        "relativeAimsDeltaBones": rel,
        "maxLimbAimDeg": max((r["aimAngleDeg"] for r in cmp), default=None),
        "maxMappedWorldAimDeg": max((r["aimAngleDeg"] for r in cmp_all), default=None),
        "maxRelativeDeltaAimDeg": max((r["relativeAimAngleDeg"] for r in rel), default=None),
        "src": src_rows,
        "dst": dst_rows,
    }


def render_baked_sheet(dest, info, prefix=""):
    act = bpy.data.actions[info["actionName"]]
    eval_info = play_dest_action(dest, act)
    n = 6
    nframes = info["bakedFrames"]
    paths = []
    EVID.mkdir(parents=True, exist_ok=True)
    for i in range(n):
        frame = 1 + int(round((nframes - 1) * i / (n - 1)))
        bpy.context.scene.frame_set(frame)
        bpy.context.view_layer.update()
        name = f"{prefix}{info['semantic']}_{i:02d}.png"
        path = EVID / name
        bpy.context.scene.render.filepath = str(path)
        bpy.ops.render.render(write_still=True)
        paths.append({"path": str(path.relative_to(ROOT)), "frame": frame, "eval": eval_info})
    return paths


def pick_sole_verts(dest):
    """Stable rest-pose vertex identities near each foot bone, lowest local Z cluster."""
    meshes = dest_body_meshes(dest)
    bpy.context.view_layer.update()
    feet = {
        "LeftFoot": world_bone(dest, "LeftFoot").translation,
        "RightFoot": world_bone(dest, "RightFoot").translation,
        "LeftToeBase": world_bone(dest, "LeftToeBase").translation,
        "RightToeBase": world_bone(dest, "RightToeBase").translation,
    }
    picks = {k: [] for k in ("leftHeel", "rightHeel", "leftToe", "rightToe")}
    for mesh in meshes:
        mw = mesh.matrix_world
        for vi, v in enumerate(mesh.data.vertices):
            w = mw @ v.co
            if w.z > 0.18:
                continue
            dlf = (w - feet["LeftFoot"]).length
            drf = (w - feet["RightFoot"]).length
            dlt = (w - feet["LeftToeBase"]).length
            drt = (w - feet["RightToeBase"]).length
            nearest = min(dlf, drf, dlt, drt)
            if nearest > 0.18:
                continue
            if dlf <= drf and dlf <= dlt and dlf <= drt:
                key = "leftHeel"
            elif drf <= dlt and drf <= drt:
                key = "rightHeel"
            elif dlt <= drt:
                key = "leftToe"
            else:
                key = "rightToe"
            picks[key].append((w.z, mesh.name, vi))
    sole = {}
    for key, rows in picks.items():
        rows.sort(key=lambda r: r[0])
        sole[key] = [{"mesh": m, "index": i} for _, m, i in rows[:12]]
    return sole


def sample_soles(dest, sole):
    bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get()
    out = {}
    meshes = {o.name: o.evaluated_get(dg) for o in dest_body_meshes(dest)}
    for key, ids in sole.items():
        zs = []
        for item in ids:
            ev = meshes.get(item["mesh"])
            if ev is None:
                continue
            ev_mesh = ev.to_mesh()
            try:
                if item["index"] < len(ev_mesh.vertices):
                    w = ev.matrix_world @ ev_mesh.vertices[item["index"]].co
                    zs.append(w.z)
            finally:
                ev.to_mesh_clear()
        out[key] = {"minZ": min(zs) if zs else None, "meanZ": (sum(zs) / len(zs) if zs else None), "n": len(zs)}
    return out


def _ring_pick_stats(hits):
    if not hits:
        return {"n": 0, "minRadius": None, "maxRadius": None}
    radii = [r for r, _ in hits]
    return {"n": len(radii), "minRadius": min(radii), "maxRadius": max(radii)}


def pick_forearm_ring_verts(dest, bone_name, band=0.01):
    """Rest-pose verts in a ±1 cm axial band around the forearm midpoint, then
    keep only those whose radial distance to the bone axis is ≤ min(1.5× median
    band radius, 0.08 m). Returns (ids, pickStats)."""
    meshes = dest_body_meshes(dest)
    bpy.context.view_layer.update()
    head, tail = world_head_tail(dest, bone_name)
    mid = (head + tail) * 0.5
    axis_v = tail - head
    axis = axis_v.normalized() if axis_v.length > 1e-8 else Vector((0.0, 1.0, 0.0))
    band_hits = []
    for mesh in meshes:
        mw = mesh.matrix_world
        for vi, v in enumerate(mesh.data.vertices):
            w = mw @ v.co
            rel = w - mid
            axial = rel.dot(axis)
            if abs(axial) <= band:
                radial = (rel - axis * axial).length
                band_hits.append((radial, {"mesh": mesh.name, "index": vi}))
    before = _ring_pick_stats(band_hits)
    if not band_hits:
        return [], {"before": before, "after": before, "medianRadius": None, "radialCapM": None}
    coarse = [(r, ident) for r, ident in band_hits if r <= 0.08]
    pool = coarse if coarse else band_hits
    median = _median([r for r, _ in pool])
    cap = min(1.5 * median, 0.08)
    kept = [(r, ident) for r, ident in pool if r <= cap]
    ids = [ident for _, ident in kept]
    return ids, {
        "before": before,
        "after": _ring_pick_stats(kept),
        "medianRadius": median,
        "radialCapM": cap,
    }


def measure_ring(dest, ids, bone_name):
    """Cross-section ring metrics (perimeter, min/max radius) on the currently evaluated pose."""
    bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get()
    head, tail = world_head_tail(dest, bone_name)
    mid = (head + tail) * 0.5
    axis_v = tail - head
    axis = axis_v.normalized() if axis_v.length > 1e-8 else Vector((0.0, 1.0, 0.0))
    ref = Vector((1.0, 0.0, 0.0))
    u = ref - axis * ref.dot(axis)
    if u.length < 1e-6:
        ref = Vector((0.0, 1.0, 0.0))
        u = ref - axis * ref.dot(axis)
    u.normalize()
    v = axis.cross(u)
    meshes = {o.name: o.evaluated_get(dg) for o in dest_body_meshes(dest)}
    pts = []
    for item in ids:
        ev = meshes.get(item["mesh"])
        if ev is None:
            continue
        ev_mesh = ev.to_mesh()
        try:
            if item["index"] < len(ev_mesh.vertices):
                w = ev.matrix_world @ ev_mesh.vertices[item["index"]].co
                rel = w - mid
                radial = rel - axis * rel.dot(axis)
                pts.append(radial)
        finally:
            ev.to_mesh_clear()
    if not pts:
        return {"n": 0, "minRadius": None, "maxRadius": None, "ratio": None, "perimeterM": None}
    radii = [p.length for p in pts]
    order = sorted(range(len(pts)), key=lambda i: math.atan2(pts[i].dot(v), pts[i].dot(u)))
    ordered = [pts[i] for i in order]
    perim = 0.0
    for i in range(len(ordered)):
        a = ordered[i]
        b = ordered[(i + 1) % len(ordered)]
        perim += (a - b).length
    min_r, max_r = min(radii), max(radii)
    return {
        "n": len(radii),
        "minRadius": min_r,
        "maxRadius": max_r,
        "ratio": (min_r / max_r) if max_r > 1e-9 else None,
        "perimeterM": perim,
    }


def _find_max_twist_source_frame(src, action_name, sname_p_l, sname_c_l, sname_p_r, sname_c_r, fps_src=24):
    """Scan a source clip's sampled frames; return the integer source frame with the
    largest |wrist twist| on either side, plus each side's twist (rad) there."""
    action_src = find_action(action_name)
    assign_source_action(src, action_src)
    f0, f1 = int(round(action_src.frame_range[0])), int(round(action_src.frame_range[1]))
    samples, _ = sample_times(f0, f1, fps_src)
    best = {"frame": f0, "absTwist": -1.0, "twistL": 0.0, "twistR": 0.0}
    for sf in samples:
        frame = int(round(sf))
        bpy.context.scene.frame_set(frame)
        bpy.context.view_layer.update()
        anat = capture_anatomy(src, [sname_p_l, sname_c_l, sname_p_r, sname_c_r])
        tl = compute_relative_twist(anat, sname_p_l, sname_c_l)
        tr = compute_relative_twist(anat, sname_p_r, sname_c_r)
        m = max(abs(tl), abs(tr))
        if m > best["absTwist"]:
            best = {"frame": frame, "absTwist": m, "twistL": tl, "twistR": tr}
    return best


def measure_twist_distribution(dest, src, pairs, dest_rest, src_rest, ctx, forearm_ring, fps_src=24):
    """Before (helpers pinned at rest, k=0) vs after (k=0.5) forearm shear, at the cast
    frame with the largest |hand twist| and at walk baked frame 20. Writes bake-report
    `twistDistribution`. Does not touch the baked actions (uses live-pose retarget_frame
    calls at a chosen source frame, then restores cleared pose)."""
    d2s = dest_to_src_map(pairs)
    helper_links = ctx["helper_links"]
    lowerarm = {"L": "lowerarm02.L", "R": "lowerarm02.R"}

    def measure_at_source_frame(frame):
        bpy.context.scene.frame_set(frame)
        bpy.context.view_layer.update()
        row = {}
        for side in ("L", "R"):
            helper = lowerarm[side]
            parent_dest, child_dest, k = helper_links[helper]
            sname_p = d2s[parent_dest]
            sname_c = d2s[child_dest]
            forearm_bone = "LeftForeArm" if side == "L" else "RightForeArm"
            sides = {}
            for scale, tag in ((0.0, "before"), (1.0, "after")):
                retarget_frame(dest, src, pairs, dest_rest, src_rest, "Hips", True, ctx=ctx, twist_scale=scale)
                bpy.context.view_layer.update()
                src_anat = capture_anatomy(src, [sname_p, sname_c])
                twist = compute_relative_twist(src_anat, sname_p, sname_c)
                ring = measure_ring(dest, forearm_ring[side], forearm_bone)
                sides[tag] = {
                    "handTwistDeg": math.degrees(twist),
                    "helperTwistAppliedDeg": math.degrees(k * scale * twist),
                    "forearmRing": ring,
                }
            row[side] = sides
        return row

    out = {}
    cast_scan = _find_max_twist_source_frame(
        src, CLIP_MAP["cast"], d2s["LeftForeArm"], d2s["LeftHand"], d2s["RightForeArm"], d2s["RightHand"], fps_src
    )
    assign_source_action(src, find_action(CLIP_MAP["cast"]))
    out["castMaxTwistFrame"] = measure_at_source_frame(cast_scan["frame"])
    out["castMaxTwistFrameInfo"] = {
        "sourceFrame": cast_scan["frame"],
        "twistLDeg": math.degrees(cast_scan["twistL"]),
        "twistRDeg": math.degrees(cast_scan["twistR"]),
    }

    walk_action = find_action(CLIP_MAP["walk"])
    assign_source_action(src, walk_action)
    f0, f1 = int(round(walk_action.frame_range[0])), int(round(walk_action.frame_range[1]))
    samples, _ = sample_times(f0, f1, fps_src)
    walk_frame_20_src = int(round(samples[min(19, len(samples) - 1)]))
    out["walkFrame20"] = measure_at_source_frame(walk_frame_20_src)
    out["walkFrame20Info"] = {"sourceFrame": walk_frame_20_src, "bakedFrame": 20}

    clear_pose(src)
    clear_pose(dest)
    bpy.context.view_layer.update()
    return out


def measure_joint_heights(dest):
    bpy.context.view_layer.update()
    out = {}
    for name in ("LeftFoot", "RightFoot", "LeftToeBase", "RightToeBase", "Hips"):
        t = world_bone(dest, name).translation
        out[name] = {"jointOriginZ": t.z, "xyz": [t.x, t.y, t.z], "label": "joint origin, not sole"}
    return out


def measure_gait(dest, info, sole):
    act = bpy.data.actions[info["actionName"]]
    play_dest_action(dest, act)
    nframes = info["bakedFrames"]
    joint_min = {}
    sole_min = {k: 1e9 for k in sole}
    hips_xy = []
    for i in range(nframes):
        bpy.context.scene.frame_set(i + 1)
        bpy.context.view_layer.update()
        jh = measure_joint_heights(dest)
        for n, rec in jh.items():
            joint_min[n] = min(joint_min.get(n, 1e9), rec["jointOriginZ"])
        so = sample_soles(dest, sole)
        for k, rec in so.items():
            if rec["minZ"] is not None:
                sole_min[k] = min(sole_min[k], rec["minZ"])
        hips = world_bone(dest, "Hips").translation
        hips_xy.append((hips.x, hips.y))
    slide = 0.0
    if len(hips_xy) > 1:
        xs = [p[0] for p in hips_xy]
        ys = [p[1] for p in hips_xy]
        slide = math.hypot(max(xs) - min(xs), max(ys) - min(ys))
    return {
        "jointOriginMinZ": joint_min,
        "soleGeometryMinZ": sole_min,
        "groundPenetrationSoleM": min(sole_min.values()) if sole_min else None,
        "hipsHorizontalDriftM": slide,
        "note": "jointOriginMinZ is bone origins; soleGeometryMinZ is deformed heel/toe verts",
    }


def find_exported_armature():
    arms = [o for o in bpy.data.objects if o.type == "ARMATURE"]
    for arm in arms:
        names = {b.name for b in arm.data.bones}
        if "Hips" in names and "finger1-1.L" in names:
            return arm
    if not arms:
        raise RuntimeError("no armature in exported import")
    return arms[0]


def verify_exported_glb(clip_infos):
    """Fresh scene: import ONLY the exported GLB and render walk/run/cast from its actions."""
    reset_empty()
    scene_setup_units()
    import_glb(OUT_GLB, "Exported")
    dest = find_exported_armature()
    dest.name = f"{(PROFILE or PROFILES['human'])['dest_name']}Export"

    # Establish a controlled "no action, rest pose" baseline before measuring anything;
    # the glTF importer can otherwise leave an arbitrary action/frame active, which was
    # the root cause of the previous reimport-bounds mismatch (defect 3).
    ad = dest.animation_data
    if ad is not None:
        ad.action = None
        for t in ad.nla_tracks:
            t.mute = True
            for s in t.strips:
                s.mute = True
    clear_pose(dest)
    bpy.context.view_layer.update()
    reimport_rest_bounds = mesh_inventory()
    inv_before = reimport_rest_bounds

    kept, removed = strip_helper_meshes(dest, delete=True)
    setup_preview_camera(dest)

    idle_action = None
    for a in bpy.data.actions:
        if a.name == "idle" or a.name.startswith("idle"):
            idle_action = a
            break
    reimport_idle_frame1_bounds = None
    if idle_action is not None:
        play_dest_action(dest, idle_action)
        bpy.context.scene.frame_set(1)
        bpy.context.view_layer.update()
        reimport_idle_frame1_bounds = mesh_inventory()

    sheets = {}
    gait = {}
    export_clips = []
    sole = None
    clear_pose(dest)
    bpy.context.view_layer.update()
    sole = pick_sole_verts(dest)
    for info in clip_infos:
        semantic = info["semantic"]
        act = None
        for a in bpy.data.actions:
            if a.name == semantic or a.name.startswith(semantic):
                act = a
                break
        if act is None:
            export_clips.append({"semantic": semantic, "error": "missing action after reimport", "have": [a.name for a in bpy.data.actions]})
            continue
        nframes = info["bakedFrames"]
        try:
            nframes = int(act.frame_end) if getattr(act, "frame_end", None) else nframes
        except Exception:
            pass
        fake = {"semantic": semantic, "actionName": act.name, "bakedFrames": max(2, nframes)}
        if semantic in ("walk", "run", "cast", "idle", "jumpStart", "jumpLoop", "jumpLand"):
            sheets[semantic] = render_baked_sheet(dest, fake, prefix="exported_")
        if semantic in ("idle", "walk", "run", "cast"):
            sheets.setdefault("closeups", {})[semantic] = render_closeups(dest, fake, prefix="exported_")
        if semantic in ("idle", "walk", "run", "cast"):
            gait[semantic] = measure_gait(dest, fake, sole)
        eval_info = play_dest_action(dest, act)
        loop = loop_metrics(dest, [b.name for b in dest.pose.bones if b.name in {p[0] for p in BONE_PAIRS}], fake["bakedFrames"]) if semantic in LOOP_CLIPS else None
        export_clips.append({
            "semantic": semantic,
            "reimportedAction": act.name,
            "eval": eval_info,
            "loopSeam": loop,
        })
    return {
        "meshInventoryOnReimport": inv_before,
        "reimportRestBounds": reimport_rest_bounds,
        "reimportIdleFrame1Bounds": reimport_idle_frame1_bounds,
        "keptMeshes": kept,
        "removedHelpers": removed,
        "preview": sheets,
        "gaitFromExported": gait,
        "clips": export_clips,
        "soleVertexIds": sole,
    }


def measure_rest_preservation(dest, dest_rest, names):
    ad = dest.animation_data
    if ad is not None:
        ad.action = None
        for track in ad.nla_tracks:
            track.mute = True
            for strip in track.strips:
                strip.mute = True
    clear_pose(dest)
    dest.location = Vector((0.0, 0.0, 0.0))
    bpy.context.view_layer.update()
    rows = []
    max_t = 0.0
    max_a = 0.0
    for name in names:
        now = world_bone(dest, name)
        rest = dest_rest[name]["world"]
        dt = (now.translation - rest.translation).length
        da = (now.to_quaternion().inverted() @ rest.to_quaternion()).angle
        rows.append({"bone": name, "transM": dt, "rotDeg": math.degrees(da)})
        max_t = max(max_t, dt)
        max_a = max(max_a, da)
    by_name = {r["bone"]: r for r in rows}
    return {
        "maxTransM": max_t,
        "maxRotDeg": math.degrees(max_a),
        "spine2": by_name.get("Spine2"),
        "neck": by_name.get("Neck"),
        "head": by_name.get("Head"),
        "hips": by_name.get("Hips"),
    }


def _loop_endpoint_m(info):
    seam = info.get("loopSeamAfterFoot") or {}
    return seam.get("maxWorldJointEndpointDistanceM")


def main():
    if PROFILE is None:
        configure_profile(parse_profile_from_argv("human"))
    hashes_before = verify_pinned_hashes("before")
    reset_empty()
    scene_setup_units()
    EVID.mkdir(parents=True, exist_ok=True)
    import_glb(SRC_HUMAN, PROFILE["collection"])
    import_glb(SRC_MIXAMO, "SrcMixamo")
    dest, src = find_armatures()
    dest.name = PROFILE["dest_name"]
    src.name = "SrcMixamo"
    inv_all = mesh_inventory()
    print("MESH INVENTORY", json.dumps(inv_all, indent=2))
    kept, removed = strip_helper_meshes(dest, delete=True, keep_src=True)
    print("kept", kept, "removed", removed)
    # Mixamo armature+mesh remain until alignment stills; dest icospheres stripped
    dims_src = world_dims(src)
    dims_dst = world_dims(dest)
    print("src dims", dims_src)
    print("dst dims", dims_dst)
    src_h = dims_src["zRange"][1] - dims_src["zRange"][0]
    dst_h = dims_dst["zRange"][1] - dims_dst["zRange"][0]
    scale_note = "no ad-hoc scale"
    if src_h < 0.05:
        src.scale = src.scale * 100.0
        bpy.context.view_layer.update()
        dims_src = world_dims(src)
        src_h = dims_src["zRange"][1] - dims_src["zRange"][0]
        scale_note = "applied *100 after confirming ~cm import"
    pairs = resolve_pairs(dest, src)
    clear_pose(src)
    clear_pose(dest)
    bpy.context.view_layer.update()
    dest_rest = capture_rest(dest, [d for d, _ in pairs])
    src_rest = capture_rest(src, [s for _, s in pairs])
    dest_names = [d for d, _ in pairs]
    helper_links = find_twist_helpers(dest, dest_names)
    for hname in ("lowerarm02.L", "lowerarm02.R"):
        if hname in helper_links:
            parent, child, _k = helper_links[hname]
            helper_links[hname] = (parent, child, LOWERARM02_K)
    print("twist helpers", helper_links)
    dest_rest_anat = capture_anatomy(dest, dest_names)
    src_rest_anat = capture_anatomy(src, [s for _, s in pairs])
    ctx = {
        "order": hierarchy_dest_order(dest, dest_names, helper_links),
        "helper_links": helper_links,
        "twist_helper_names": set(helper_links.keys()),
        "dest_rest_anat": dest_rest_anat,
        "src_rest_anat": src_rest_anat,
        "dest_basis_all": capture_all_basis(dest),
        "mapped": set(dest_names),
        "delta_bones": set(PROFILE["delta_bones"]),
        "lock_hips_world_xy": bool(PROFILE["lock_hips_world_xy"]),
        "hips_C": hips_C_dest_from_src(src_rest_anat, dest_rest_anat),
    }
    helpers = unmapped_helpers(dest, dest_names)
    print("unmapped helpers", len(helpers))
    rest_err, rest_worst = rest_identity_error(dest, src, pairs, dest_rest, src_rest, ctx=ctx)
    print("rest identity (T-rest maps dest to source T aim, not dest A rest)", rest_err, rest_worst)
    setup_preview_camera(dest)
    align_idle = render_alignment(dest, src, pairs, dest_rest, src_rest, ctx, CLIP_MAP["idle"], "idle")
    align_walk = render_alignment(dest, src, pairs, dest_rest, src_rest, ctx, CLIP_MAP["walk"], "walk")
    print("align idle limb aim deg", align_idle.get("maxLimbAimDeg"), "rel", align_idle.get("maxRelativeDeltaAimDeg"))
    print("align walk limb aim deg", align_walk.get("maxLimbAimDeg"), "rel", align_walk.get("maxRelativeDeltaAimDeg"))
    fps_src = 24
    clip_infos = []
    for semantic, src_name in CLIP_MAP.items():
        print("bake", semantic, src_name)
        info = bake_clip(dest, src, pairs, dest_rest, src_rest, semantic, src_name, fps_src, ctx=ctx)
        clip_infos.append(info)
        print("  frames", info["bakedFrames"], "moving", info["movingBoneCount"], "dur", info["durationSec"])
    clear_pose(dest)
    bpy.context.view_layer.update()
    sole = pick_sole_verts(dest)
    forearm_ring = {}
    forearm_ring_pick = {}
    for side, bone in (("L", "LeftForeArm"), ("R", "RightForeArm")):
        ids, stats = pick_forearm_ring_verts(dest, bone)
        forearm_ring[side] = ids
        forearm_ring_pick[side] = stats
    twist_distribution = measure_twist_distribution(dest, src, pairs, dest_rest, src_rest, ctx, forearm_ring)
    dest_names = [d for d, _ in pairs]
    foot_fix_mode = {
        "idle": "full",
        "walk": "full",
        "run": "full",
        "cast": "full",
        "jumpStart": "prelaunch",
        "jumpLand": "postcontact",
    }
    foot_fix = {}
    for info in clip_infos:
        semantic = info["semantic"]
        act = bpy.data.actions[info["actionName"]]
        if semantic in LOOP_CLIPS and info["bakedFrames"] >= 2:
            close_loop(dest, act, dest_names, info["bakedFrames"])
        mode = foot_fix_mode.get(semantic)
        if mode is None:
            if semantic in LOOP_CLIPS and info["bakedFrames"] >= 2:
                info["loopSeamAfterFoot"] = loop_metrics(dest, dest_names, info["bakedFrames"])
            continue
        foot_fix[semantic] = correct_foot_contact(
            dest, act, dest_names, info["bakedFrames"], sole, mode=mode,
            loop=(semantic in LOOP_CLIPS and info["bakedFrames"] >= 2),
            both_stance=(semantic == "idle"),
            dest_rest=dest_rest,
        )
        fc = foot_fix[semantic]
        print(
            "  footContact", semantic,
            "maxFrameDeltaM", fc.get("maxFrameDeltaM"),
            "worstStepFrame", fc.get("worstStepFrame"),
            "worstStepM", fc.get("worstStepM"),
            "bindingFloorConflict", fc.get("bindingFloorConflict"),
            "stanceMin", fc.get("stanceSoleMinZAfterM"),
            "stanceMax", fc.get("stanceSoleMaxZAfterM"),
            "perKey", fc.get("stanceSolePerKeyAfterM"),
            "idleEq", fc.get("idleEqualize"),
        )
        if semantic in LOOP_CLIPS and info["bakedFrames"] >= 2:
            info["loopSeamAfterFoot"] = loop_metrics(dest, dest_names, info["bakedFrames"])
    keep = nla_pack(dest, clip_infos)
    kept2, removed2 = strip_helper_meshes(dest, delete=True, keep_src=False)
    sheets = {}
    gait_authoring = {}
    closeups = {}
    for info in clip_infos:
        sheets[info["semantic"]] = render_baked_sheet(dest, info, prefix="")
        if info["semantic"] in ("idle", "walk", "run", "cast"):
            closeups[info["semantic"]] = render_closeups(dest, info, prefix="")
        if info["semantic"] in ("idle", "walk", "run", "cast"):
            gait_authoring[info["semantic"]] = measure_gait(dest, info, sole)
    rest_preserved = measure_rest_preservation(dest, dest_rest, dest_names)
    delete_source()
    purge_foreign_actions(keep)
    leaked = export_glb(dest)
    OUT_BLEND.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT_BLEND))

    exported_verify = verify_exported_glb(clip_infos)

    fail = []
    for info in clip_infos:
        if info["movingBoneCount"] < 8:
            fail.append(f"no varying channels {info['semantic']}")
        if info.get("nonfinite"):
            fail.append(f"nonfinite {info['semantic']}")
    if leaked:
        fail.append(f"helper mesh leak {leaked}")
    if not kept and not kept2:
        fail.append("no dest body meshes kept")
    for tag, align in (("idle", align_idle), ("walk", align_walk)):
        limb = align.get("maxLimbAimDeg")
        if limb is not None and limb > 0.05:
            fail.append(f"{tag} limb aim {limb:.4f} deg")
        rel = align.get("maxRelativeDeltaAimDeg")
        if PROFILE["delta_bones"] and rel is not None and rel > 0.05:
            fail.append(f"{tag} delta-bone relative aim {rel:.4f} deg")
    gait_ex = exported_verify.get("gaitFromExported") or {}
    for semantic in ("idle", "walk", "run", "cast"):
        auth = gait_authoring.get(semantic) or {}
        exp = gait_ex.get(semantic) or {}
        for label, rec in (("authoring", auth), ("exported", exp)):
            z = rec.get("groundPenetrationSoleM")
            if z is None:
                fail.append(f"{semantic} {label} sole missing")
            elif z < -0.005 or z > 0.005:
                fail.append(f"{semantic} {label} sole {z:.6f} m")
        fc = foot_fix.get(semantic) or {}
        stance = fc.get("stanceSoleMinZAfterM")
        if stance is not None and (stance < -0.005 or stance > 0.005):
            fail.append(f"{semantic} stanceSole {stance:.6f} m")
        if semantic == "idle":
            per = fc.get("stanceSolePerKeyAfterM") or {}
            for label, rec in per.items():
                for mm in ("minZ", "maxZ"):
                    z = rec.get(mm)
                    if z is None or z < -0.005 or z > 0.005:
                        fail.append(f"idle {label} {mm} {z}")
            n_idle = len(fc.get("liftsM") or [])
            for k, count in (fc.get("stanceCount") or {}).items():
                if n_idle and count != n_idle:
                    fail.append(f"idle {k} stanceCount {count} != {n_idle}")
        if PROFILE["lock_hips_world_xy"]:
            drift = exp.get("hipsHorizontalDriftM")
            if drift is not None and drift > 0.01:
                fail.append(f"{semantic} orc hips XY {drift:.6f} m")
    for info in clip_infos:
        if info["semantic"] not in ("idle", "walk", "run"):
            continue
        loop_d = _loop_endpoint_m(info)
        if loop_d is None:
            fail.append(f"{info['semantic']} loopSeamAfterFoot missing")
        elif loop_d > 1e-6:
            fail.append(f"{info['semantic']} loop {loop_d:.6g} m")
    try:
        hashes_after = verify_pinned_hashes("after")
    except RuntimeError as exc:
        hashes_after = {"error": str(exc)}
        fail.append(str(exc))

    report = {
        "schemaVersion": 3,
        "profile": PROFILE["id"],
        "command": (
            "/Applications/Blender.app/Contents/MacOS/Blender --background --python "
            "scripts/character-assets/retarget_profile.py -- --profile " + PROFILE["id"]
        ),
        "sourceHashesBefore": hashes_before,
        "sourceHashesAfter": hashes_after,
        "deltaBones": list(PROFILE["delta_bones"]),
        "lockHipsWorldXy": bool(PROFILE["lock_hips_world_xy"]),
        "restPreserved": rest_preserved,
        "sourceMixamo": str(SRC_MIXAMO.relative_to(ROOT)),
        "sourceBody": str(SRC_HUMAN.relative_to(ROOT)),
        "sourceHuman": str(SRC_HUMAN.relative_to(ROOT)),
        "outBlend": str(OUT_BLEND.relative_to(ROOT)),
        "outGlb": str(OUT_GLB.relative_to(ROOT)),
        "fps": FPS,
        "scaleNote": scale_note,
        "srcDims": dims_src,
        "dstDims": dims_dst,
        "srcHeightM": src_h,
        "dstHeightM": dst_h,
        "bonePairs": pairs,
        "restIdentityMaxErr": rest_err,
        "restIdentityWorst": {
            "bone": rest_worst[0] if rest_worst else None,
            "transM": rest_worst[1] if rest_worst else None,
            "rotRad": rest_worst[2] if rest_worst else None,
        },
        "restTolerance": REST_TOL,
        "restPass": False,
        "restIdentityNote": "T-pose source rest does not equal dest A-pose; not an acceptance gate",
        "retargetMethod": "world-aim match + twist-around-aim; hierarchy update; dest rest translation/scale kept",
        "rootMotionPolicy": "strip-blender-XY-keep-Z-vertical-gait; runtime owns travel/jump translation",
        "spineDistribution": "Mixamo Spine/Spine1/Spine2 → Hips children Spine/spine04/Spine2; spine02/spine01 retain rest",
        "helperBones": "unmapped twist/breast/chest/shoulder01 keep rest local; in-series upperarm02/lowerarm02/upperleg02/lowerleg02 take k=0.5 of the distal segment's source twist about the proximal bone's aim (no double rotation on the mapped child)",
        "unmappedHelpers": helpers,
        "twistHelperLinks": {name: [p, c, k] for name, (p, c, k) in helper_links.items()},
        "lowerarm02K": LOWERARM02_K,
        "forearmRingPick": forearm_ring_pick,
        "twistDistribution": twist_distribution,
        "alignmentIdle": align_idle,
        "alignmentWalk": align_walk,
        "footContact": foot_fix,
        "closeupsAuthoring": closeups,
        "meshInventoryImport": inv_all,
        "helpersRemoved": removed + removed2,
        "keptPreviewMeshes": kept2 or kept,
        "clips": clip_infos,
        "semanticToClip": {c["semantic"]: c["actionName"] for c in clip_infos},
        "previewFramesAuthoringBaked": sheets,
        "gaitAuthoringBaked": gait_authoring,
        "exportedGlbVerification": exported_verify,
        "exportLeaks": leaked,
        "acceptanceFails": fail,
        "notes": [
            "Authoring stills evaluate destination baked actions with source NLA muted.",
            "exported_* stills are from a fresh import of the written GLB.",
            "loopSeam is pre-close; loopSeamAfterFoot is post one close_loop then plant.",
            "Source Mixamo and body GLBs are not overwritten.",
            "Limb bones use source pose world aim. Undead Spine2/Neck/Head use rest+delta.",
            "Orc locks hips world XY (no root translation). All profiles strip local hips XY.",
            "Plant last after one close_loop (M2e-c4). Forearm ring ≥0.80 is not a gate.",
        ],
    }
    REPORT.write_text(json.dumps(report, indent=2, default=str) + "\n")
    print("wrote", REPORT)
    print("glb", OUT_GLB)
    print("acceptanceFails", fail)
    if fail:
        raise SystemExit("acceptance failed: " + "; ".join(fail))


if __name__ == "__main__":
    configure_profile(parse_profile_from_argv("human"))
    main()
