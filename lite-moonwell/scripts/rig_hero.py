"""Rig the M1 hooded mage, author WoW locomotion/cast clips, export hero.glb.

Must run inside blender/hero.blend (refuses the shrine file).
Does not resculpt cloth. Staff is rigidly skinned to the Staff bone (child of Hand.R).
Clips are in-place. Root location is never keyed.
"""
import math
import os

import bpy
from mathutils import Euler, Matrix, Vector

ROOT = "/Users/antbly/dev/wow-clone/lite-moonwell"
EXPORT = os.path.join(ROOT, "public", "hero.glb")
BLEND = os.path.join(ROOT, "blender", "hero.blend")
FPS = 24

SHRINE_MARKERS = {"MoonSun", "Ground", "LanternA_L", "WellGlow", "Basin"}
STAFF_NAMES = (
    "HeroStaff",
    "HeroWrap",
    "HeroFlame",
    "HeroFlameCore",
    "HeroStaffTip",
    "HeroBand0",
    "HeroBand1",
    "HeroBand2",
    "HeroBand3",
    "HeroProng0",
    "HeroProng1",
    "HeroProng2",
)
CLIP_SPECS = (
    ("idle", 48, True),
    ("walk", 24, True),
    ("walkBack", 24, True),
    ("run", 16, True),
    ("strafeLeft", 24, True),
    ("strafeRight", 24, True),
    ("jumpStart", 10, False),
    ("jumpAir", 16, True),
    ("jumpLand", 12, False),
    ("castInstant", 20, False),
    ("castChannel", 32, True),
)


def ensure_object_mode():
    if bpy.ops.object.mode_set.poll():
        bpy.ops.object.mode_set(mode="OBJECT")


def unparent_keep(obj):
    mw = obj.matrix_world.copy()
    obj.parent = None
    obj.parent_type = "OBJECT"
    obj.parent_bone = ""
    obj.matrix_world = mw


def apply_mesh_transforms(obj):
    ensure_object_mode()
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    obj.select_set(False)


def dist_point_segment(p, a, b):
    ab = b - a
    denom = ab.length_squared
    if denom < 1e-12:
        return (p - a).length
    t = max(0.0, min(1.0, (p - a).dot(ab) / denom))
    return (p - (a + ab * t)).length


def add_edit_bone(arm, name, head, tail, parent=None, connect=False, deform=True, roll=0.0):
    bone = arm.data.edit_bones.new(name)
    bone.head = Vector(head)
    bone.tail = Vector(tail)
    bone.roll = roll
    bone.use_deform = deform
    if parent is not None:
        bone.parent = parent
        bone.use_connect = connect
    return bone


def build_armature():
    ensure_object_mode()
    bpy.ops.object.armature_add(enter_editmode=True, location=(0.0, 0.0, 0.0))
    arm_obj = bpy.context.active_object
    arm_obj.name = "HeroArmature"
    arm_obj.data.name = "HeroArmature"
    arm_obj.show_in_front = True
    eb = arm_obj.data.edit_bones
    for bone in list(eb):
        eb.remove(bone)

    root = add_edit_bone(arm_obj, "Root", (0, 0, 0), (0, 0, 0.08), deform=False)
    hips = add_edit_bone(arm_obj, "Hips", (0.0, 0.01, 0.90), (0.0, 0.015, 1.02), parent=root)
    spine = add_edit_bone(arm_obj, "Spine", hips.tail, (0.0, 0.01, 1.18), parent=hips, connect=True)
    chest = add_edit_bone(arm_obj, "Chest", spine.tail, (0.0, 0.02, 1.345), parent=spine, connect=True)
    neck = add_edit_bone(arm_obj, "Neck", chest.tail, (0.0, -0.01, 1.48), parent=chest, connect=True)
    add_edit_bone(arm_obj, "Head", neck.tail, (0.0, 0.03, 1.72), parent=neck, connect=True)

    sh_l = add_edit_bone(arm_obj, "Shoulder.L", (0.04, 0.02, 1.335), (-0.12, 0.02, 1.30), parent=chest)
    ua_l = add_edit_bone(arm_obj, "UpperArm.L", sh_l.tail, (-0.20, -0.005, 1.04), parent=sh_l, connect=True)
    fa_l = add_edit_bone(arm_obj, "ForeArm.L", ua_l.tail, (-0.185, -0.045, 0.78), parent=ua_l, connect=True)
    add_edit_bone(arm_obj, "Hand.L", fa_l.tail, (-0.18, -0.06, 0.695), parent=fa_l, connect=True)

    sh_r = add_edit_bone(arm_obj, "Shoulder.R", (-0.04, 0.02, 1.335), (0.14, 0.02, 1.305), parent=chest)
    # edit bone names can't share a head with the mirrored shoulder exactly; use chest-space offsets
    sh_r.head = Vector((0.04, 0.02, 1.335))
    sh_r.tail = Vector((0.145, 0.02, 1.305))
    ua_r = add_edit_bone(arm_obj, "UpperArm.R", sh_r.tail, (0.265, 0.01, 1.175), parent=sh_r, connect=True)
    fa_r = add_edit_bone(arm_obj, "ForeArm.R", ua_r.tail, (0.342, 0.002, 1.068), parent=ua_r, connect=True)
    hand_r = add_edit_bone(arm_obj, "Hand.R", fa_r.tail, (0.375, 0.002, 1.025), parent=fa_r, connect=True)
    add_edit_bone(
        arm_obj,
        "Staff",
        (0.355, 0.015, 1.055),
        (0.355, 0.015, 1.76),
        parent=hand_r,
        connect=False,
        deform=True,
    )

    th_l = add_edit_bone(arm_obj, "Thigh.L", (-0.075, 0.01, 0.90), (-0.078, 0.02, 0.50), parent=hips)
    sh_l_leg = add_edit_bone(arm_obj, "Shin.L", th_l.tail, (-0.075, 0.005, 0.075), parent=th_l, connect=True)
    ft_l = add_edit_bone(arm_obj, "Foot.L", sh_l_leg.tail, (-0.075, -0.095, 0.022), parent=sh_l_leg, connect=True)
    add_edit_bone(arm_obj, "Toe.L", ft_l.tail, (-0.075, -0.145, 0.018), parent=ft_l, connect=True)

    th_r = add_edit_bone(arm_obj, "Thigh.R", (0.075, 0.01, 0.90), (0.078, 0.02, 0.50), parent=hips)
    sh_r_leg = add_edit_bone(arm_obj, "Shin.R", th_r.tail, (0.075, 0.005, 0.075), parent=th_r, connect=True)
    ft_r = add_edit_bone(arm_obj, "Foot.R", sh_r_leg.tail, (0.075, -0.095, 0.022), parent=sh_r_leg, connect=True)
    add_edit_bone(arm_obj, "Toe.R", ft_r.tail, (0.075, -0.145, 0.018), parent=ft_r, connect=True)

    cl1 = add_edit_bone(arm_obj, "Cloak1", (0.0, 0.06, 1.30), (0.0, 0.16, 0.92), parent=chest)
    cl2 = add_edit_bone(arm_obj, "Cloak2", cl1.tail, (0.0, 0.22, 0.52), parent=cl1, connect=True)
    add_edit_bone(arm_obj, "Cloak3", cl2.tail, (0.0, 0.16, 0.08), parent=cl2, connect=True)
    add_edit_bone(arm_obj, "CloakL", (-0.16, 0.10, 1.24), (-0.30, 0.20, 0.42), parent=chest)
    add_edit_bone(arm_obj, "CloakR", (0.16, 0.10, 1.24), (0.30, 0.20, 0.42), parent=chest)

    bpy.ops.object.mode_set(mode="POSE")
    for pb in arm_obj.pose.bones:
        pb.rotation_mode = "QUATERNION"
    bpy.ops.object.mode_set(mode="OBJECT")
    return arm_obj


def rest_head_tail(arm, name):
    bone = arm.data.bones[name]
    mw = arm.matrix_world
    return mw @ bone.head_local.copy(), mw @ bone.tail_local.copy()


def bone_length(arm, name):
    return arm.data.bones[name].length


ALLOWED = {
    "cloak": ("Spine", "Chest", "Cloak1", "Cloak2", "Cloak3", "CloakL", "CloakR"),
    "cowl": ("Chest", "Neck", "Shoulder.L", "Shoulder.R", "Cloak1"),
    "hood": ("Head", "Neck", "Chest"),
    "robe": ("Hips", "Spine", "Chest", "Thigh.L", "Thigh.R", "Cloak1"),
    "sleeve_l": ("Shoulder.L", "UpperArm.L", "ForeArm.L", "Chest", "Hand.L"),
    "sleeve_r": ("Shoulder.R", "UpperArm.R", "ForeArm.R", "Chest", "Hand.R"),
    "glove_l": ("Hand.L", "ForeArm.L"),
    "glove_r": ("Hand.R", "ForeArm.R"),
    "boot_l": ("Foot.L", "Toe.L", "Shin.L", "Thigh.L"),
    "boot_r": ("Foot.R", "Toe.R", "Shin.R", "Thigh.R"),
    "staff": ("Staff",),
    "chest_prop": ("Chest", "Spine", "Neck"),
    "slump": ("Chest", "Cloak1", "Cloak2", "CloakL", "CloakR", "Shoulder.L", "Shoulder.R"),
    "rag": ("Cloak2", "Cloak3", "CloakL", "CloakR"),
}

RADII = {
    "Hips": 0.28,
    "Spine": 0.22,
    "Chest": 0.26,
    "Neck": 0.12,
    "Head": 0.20,
    "Shoulder.L": 0.12,
    "Shoulder.R": 0.12,
    "UpperArm.L": 0.11,
    "UpperArm.R": 0.11,
    "ForeArm.L": 0.09,
    "ForeArm.R": 0.08,
    "Hand.L": 0.08,
    "Hand.R": 0.08,
    "Staff": 0.22,
    "Thigh.L": 0.18,
    "Thigh.R": 0.18,
    "Shin.L": 0.12,
    "Shin.R": 0.12,
    "Foot.L": 0.11,
    "Foot.R": 0.11,
    "Toe.L": 0.08,
    "Toe.R": 0.08,
    "Cloak1": 0.42,
    "Cloak2": 0.52,
    "Cloak3": 0.60,
    "CloakL": 0.46,
    "CloakR": 0.46,
}


def mesh_kind(name):
    if name in STAFF_NAMES:
        return "staff"
    if name.startswith("HeroCloak"):
        return "cloak"
    if name.startswith("HeroCowl"):
        return "cowl"
    if name.startswith("HeroHood"):
        return "hood"
    if name.startswith("HeroRobe"):
        return "robe"
    if name == "HeroSleeveL":
        return "sleeve_l"
    if name == "HeroSleeveR":
        return "sleeve_r"
    if name == "HeroGloveL":
        return "glove_l"
    if name == "HeroGloveR":
        return "glove_r"
    if name == "HeroBootL":
        return "boot_l"
    if name == "HeroBootR":
        return "boot_r"
    if name.startswith("HeroSlump"):
        return "slump"
    if name.startswith("HeroRag"):
        return "rag"
    if name.startswith("HeroBrooch") or name.startswith("HeroBead") or name.startswith("HeroChain"):
        return "chest_prop"
    return "robe"


def bind_heat(mesh, arm):
    kind = mesh_kind(mesh.name)
    allowed = ALLOWED[kind]
    deform = [b.name for b in arm.data.bones if b.use_deform]
    for name in deform:
        if name not in mesh.vertex_groups:
            mesh.vertex_groups.new(name=name)
        else:
            mesh.vertex_groups[name].remove(range(len(mesh.data.vertices)))

    segs = []
    for name in allowed:
        if name not in arm.data.bones:
            continue
        h, t = rest_head_tail(arm, name)
        segs.append((name, h, t, RADII.get(name, 0.12)))

    mw = mesh.matrix_world
    nverts = len(mesh.data.vertices)
    assigns = {name: [] for name, *_ in segs}
    empty = 0
    for vi, vert in enumerate(mesh.data.vertices):
        p = mw @ vert.co
        weights = []
        total = 0.0
        for name, h, t, rad in segs:
            d = dist_point_segment(p, h, t)
            if kind == "cloak":
                if name == "Cloak3" and p.z < 0.45:
                    rad *= 1.35
                elif name == "Cloak1" and p.z > 1.05:
                    rad *= 1.2
            if d >= rad:
                continue
            w = (1.0 - d / rad) ** 2
            if w <= 1e-5:
                continue
            weights.append((name, w))
            total += w
        if total <= 1e-8:
            empty += 1
            ranked = sorted(segs, key=lambda s: dist_point_segment(p, s[1], s[2]))[:3]
            blend = []
            acc = 0.0
            for name, h, t, _rad in ranked:
                d = dist_point_segment(p, h, t)
                w = 1.0 / ((d + 0.05) ** 2)
                blend.append((name, w))
                acc += w
            inv = 1.0 / max(acc, 1e-8)
            for name, w in blend:
                assigns[name].append((vi, w * inv))
        else:
            inv = 1.0 / total
            for name, w in weights:
                assigns[name].append((vi, w * inv))

    for name, items in assigns.items():
        vg = mesh.vertex_groups[name]
        for vi, w in items:
            vg.add([vi], w, "REPLACE")

    for mod in list(mesh.modifiers):
        if mod.type == "ARMATURE":
            mesh.modifiers.remove(mod)
    mw = mesh.matrix_world.copy()
    mesh.parent = arm
    mesh.parent_type = "OBJECT"
    mesh.matrix_world = mw
    mod = mesh.modifiers.new("Armature", "ARMATURE")
    mod.object = arm
    mod.use_vertex_groups = True
    mod.use_bone_envelopes = False
    return {"verts": nverts, "empty": empty, "kind": kind}


def ik_2bone(p0, l1, l2, target, pole):
    to = target - p0
    dist = to.length
    max_d = l1 + l2 - 1e-4
    min_d = abs(l1 - l2) + 1e-4
    if dist < 1e-6:
        to = Vector((0.0, -1.0, 0.0))
        dist = min_d
    if dist > max_d:
        to = to.normalized() * max_d
        dist = max_d
        target = p0 + to
    elif dist < min_d:
        to = to.normalized() * min_d
        dist = min_d
        target = p0 + to
    direction = to.normalized()
    pole_v = pole - p0
    axis = direction.cross(pole_v)
    if axis.length < 1e-6:
        helper = Vector((1.0, 0.0, 0.0)) if abs(direction.x) < 0.9 else Vector((0.0, 1.0, 0.0))
        axis = direction.cross(helper)
    axis.normalize()
    plane = axis.cross(direction)
    plane.normalize()
    a = (l1 * l1 - l2 * l2 + dist * dist) / (2.0 * dist)
    h = math.sqrt(max(0.0, l1 * l1 - a * a))
    joint = p0 + direction * a + plane * h
    return joint, target


def make_basis(origin, y_axis, up):
    y = y_axis.normalized()
    x = up.cross(y)
    if x.length < 1e-6:
        up = Vector((1.0, 0.0, 0.0))
        x = up.cross(y)
    x.normalize()
    z = x.cross(y)
    z.normalize()
    x = y.cross(z)
    x.normalize()
    mat = Matrix((
        (x.x, y.x, z.x, origin.x),
        (x.y, y.y, z.y, origin.y),
        (x.z, y.z, z.z, origin.z),
        (0.0, 0.0, 0.0, 1.0),
    ))
    return mat


def set_bone_world(arm, name, world_head, world_tail, up=Vector((0.0, 1.0, 0.0))):
    pb = arm.pose.bones[name]
    mat = make_basis(world_head, world_tail - world_head, up)
    pb.matrix = arm.matrix_world.inverted() @ mat


def clear_pose(arm):
    for pb in arm.pose.bones:
        pb.matrix_basis.identity()
        pb.location = (0.0, 0.0, 0.0)
        pb.scale = (1.0, 1.0, 1.0)
        pb.rotation_quaternion = (1.0, 0.0, 0.0, 0.0)


def local_euler(pb, xyz):
    extra = Euler(xyz, "XYZ").to_quaternion()
    pb.rotation_quaternion = extra @ pb.rotation_quaternion


def key_pose(arm, frame):
    for pb in arm.pose.bones:
        if pb.name == "Root":
            continue
        pb.keyframe_insert(data_path="rotation_quaternion", frame=frame)
        if not pb.bone.use_connect:
            pb.keyframe_insert(data_path="location", frame=frame)
        pb.keyframe_insert(data_path="scale", frame=frame)


def ensure_action(arm, name):
    ad = arm.animation_data_create()
    action = bpy.data.actions.get(name)
    if action is None:
        action = bpy.data.actions.new(name)
    else:
        action.name = name
    ad.action = action
    slot = None
    for candidate in action.slots:
        if candidate.target_id_type == "OBJECT":
            slot = candidate
            break
    if slot is None:
        slot = action.slots.new(id_type="OBJECT", name=arm.name)
    ad.action_slot = slot
    return action


def push_nla(arm, action, name, length):
    ad = arm.animation_data
    track = ad.nla_tracks.new()
    track.name = name
    track.mute = name != "idle"
    strip = track.strips.new(name, 1, action)
    strip.frame_end = length + 1
    strip.extrapolation = "NOTHING"


def foot_cycle(phase, side_x, step, lift, plant=0.5):
    """phase 0-1. Facing -Y, forward foot has negative Y. Planted foot travels +Y."""
    if phase < plant:
        u = phase / plant
        y = -step + 2.0 * step * u
        z = 0.02 + 0.01 * math.sin(u * math.pi)
        y_toe = y - 0.05
    else:
        u = (phase - plant) / max(1e-4, 1.0 - plant)
        y = step - 2.0 * step * u
        z = 0.02 + lift * math.sin(u * math.pi)
        y_toe = y - 0.04 - 0.03 * math.sin(u * math.pi)
    return Vector((side_x, y, z)), Vector((side_x, y_toe, 0.012 if phase < plant else z * 0.35))


def apply_leg(arm, side, foot_target, toe_target, hip_off, lengths, rest):
    thigh = f"Thigh.{side}"
    shin = f"Shin.{side}"
    foot = f"Foot.{side}"
    toe = f"Toe.{side}"
    hip = rest[thigh][0] + hip_off
    pole = Vector((hip.x * 1.15, -0.45, 0.52))
    knee, ankle = ik_2bone(hip, lengths[thigh], lengths[shin], foot_target, pole)
    set_bone_world(arm, thigh, hip, knee, up=Vector((0.0, 0.0, 1.0)))
    bpy.context.view_layer.update()
    set_bone_world(arm, shin, knee, ankle, up=Vector((0.0, 0.0, 1.0)))
    bpy.context.view_layer.update()
    set_bone_world(arm, foot, ankle, Vector((toe_target.x, toe_target.y, max(0.012, ankle.z - 0.05))), up=Vector((0.0, 0.0, 1.0)))
    bpy.context.view_layer.update()
    foot_tail = arm.matrix_world @ Vector(arm.pose.bones[foot].tail)
    set_bone_world(
        arm,
        toe,
        foot_tail,
        Vector((toe_target.x, toe_target.y - 0.02, 0.016)),
        up=Vector((0.0, 0.0, 1.0)),
    )


def apply_arm_hang(arm, side, swing, twist, bend, raise_z=0.0):
    """FK offsets on rest. +swing is forward (-Y) for a downward arm; raised right arm uses smaller values."""
    if side == "L":
        local_euler(arm.pose.bones["Shoulder.L"], (0.05 * swing, 0.08 * twist, -0.04 * swing))
        local_euler(arm.pose.bones["UpperArm.L"], (0.65 * swing, 0.12 * twist, 0.15 * raise_z))
        local_euler(arm.pose.bones["ForeArm.L"], (-0.55 * bend, 0.0, 0.0))
        local_euler(arm.pose.bones["Hand.L"], (0.12 * swing, 0.0, 0.0))
    else:
        local_euler(arm.pose.bones["Shoulder.R"], (0.04 * swing, -0.06 * twist, 0.05 * swing))
        local_euler(arm.pose.bones["UpperArm.R"], (0.18 * swing, -0.08 * twist, 0.22 * raise_z))
        local_euler(arm.pose.bones["ForeArm.R"], (0.12 * bend, 0.0, 0.05 * swing))
        local_euler(arm.pose.bones["Hand.R"], (0.05 * swing, 0.0, 0.0))


def pose_upper_rest_plus(arm, *, spine=0.0, chest=0.0, lean=0.0, twist=0.0, head=0.0, cloak=0.0, hip_z=0.0, hip_sway=0.0):
    hips = arm.pose.bones["Hips"]
    hips.location = (hip_sway * 0.03, 0.0, hip_z)
    local_euler(hips, (lean * 0.15, 0.0, -hip_sway * 0.18))
    local_euler(arm.pose.bones["Spine"], (spine, 0.0, twist * 0.35))
    local_euler(arm.pose.bones["Chest"], (chest, 0.0, twist * 0.55))
    local_euler(arm.pose.bones["Neck"], (head * 0.4, 0.0, -twist * 0.2))
    local_euler(arm.pose.bones["Head"], (head, 0.0, 0.0))
    local_euler(arm.pose.bones["Cloak1"], (cloak * 0.6, 0.0, hip_sway * 0.2))
    local_euler(arm.pose.bones["Cloak2"], (cloak, 0.0, -hip_sway * 0.15))
    local_euler(arm.pose.bones["Cloak3"], (cloak * 1.2, 0.0, 0.0))
    if "CloakL" in arm.pose.bones:
        local_euler(arm.pose.bones["CloakL"], (cloak * 0.7, 0.08 * hip_sway, 0.12 * hip_sway))
    if "CloakR" in arm.pose.bones:
        local_euler(arm.pose.bones["CloakR"], (cloak * 0.7, -0.08 * hip_sway, -0.12 * hip_sway))


def author_clips(arm):
    lengths = {name: bone_length(arm, name) for name in (
        "Thigh.L", "Thigh.R", "Shin.L", "Shin.R", "UpperArm.L", "UpperArm.R", "ForeArm.L", "ForeArm.R"
    )}
    rest = {name: rest_head_tail(arm, name) for name in (
        "Thigh.L", "Thigh.R", "Shin.L", "Shin.R", "Foot.L", "Foot.R", "Hips", "Hand.R", "Staff"
    )}
    scene = bpy.context.scene
    scene.render.fps = FPS
    scene.render.fps_base = 1.0

    def loco_frame(frame, length, *, step, lift, plant, speed_lean, back=False, strafe=0.0, run=False):
        t = (frame - 1) / max(1, length)
        if back:
            t = (1.0 - t) % 1.0
        phase_l = t % 1.0
        phase_r = (t + 0.5) % 1.0
        clear_pose(arm)
        hip_z = (0.018 if run else 0.01) * abs(math.sin(t * math.pi * 2.0))
        hip_sway = math.sin(t * math.pi * 2.0)
        lean = speed_lean + (-0.35 if back else 0.0)
        sign = -1.0 if strafe < 0 else 1.0
        if strafe == 0.0:
            pose_upper_rest_plus(
                arm,
                spine=0.04 * math.sin(t * math.pi * 2.0) + (0.08 if run else 0.0),
                chest=(0.06 if run else 0.03) * math.sin(t * math.pi * 2.0 + 0.4),
                lean=lean,
                twist=0.12 * hip_sway,
                head=-lean * 0.25,
                cloak=(0.10 if run else 0.05) * math.sin(t * math.pi * 2.0 + 0.7),
                hip_z=hip_z,
                hip_sway=hip_sway,
            )
            hip_off = Vector((hip_sway * 0.02, 0.02 * speed_lean, hip_z))
            fl, tl = foot_cycle(phase_l, -0.075, step, lift, plant)
            fr, tr = foot_cycle(phase_r, 0.075, step, lift, plant)
            if back:
                fl.y *= 0.75
                fr.y *= 0.75
                tl.y *= 0.75
                tr.y *= 0.75
        else:
            pose_upper_rest_plus(
                arm,
                spine=0.03 * math.sin(t * math.pi * 2.0),
                chest=0.02 * math.sin(t * math.pi * 2.0 + 0.4),
                lean=0.05,
                twist=-0.18 * sign,
                head=0.0,
                cloak=0.08 * math.sin(t * math.pi * 2.0),
                hip_z=hip_z,
                hip_sway=-0.4 * sign,
            )
            hip_off = Vector((-0.01 * sign, 0.0, hip_z))

            def side_cycle(phase, x0):
                if phase < plant:
                    u = phase / plant
                    x = x0 - sign * step + 2.0 * sign * step * u
                    z = 0.02
                    y = 0.01 * math.sin(u * math.pi)
                else:
                    u = (phase - plant) / (1.0 - plant)
                    x = x0 + sign * step - 2.0 * sign * step * u
                    z = 0.02 + lift * math.sin(u * math.pi)
                    y = -0.02
                return Vector((x, y, z)), Vector((x, y - 0.06, 0.014 if phase < plant else z * 0.3))

            fl, tl = side_cycle(phase_l, -0.075)
            fr, tr = side_cycle(phase_r, 0.075)
        apply_leg(arm, "L", fl, tl, hip_off, lengths, rest)
        apply_leg(arm, "R", fr, tr, hip_off, lengths, rest)
        swing_l = math.sin(phase_l * math.pi * 2.0 + math.pi)
        swing_r = math.sin(phase_r * math.pi * 2.0 + math.pi)
        apply_arm_hang(arm, "L", swing_l * (0.55 if run else 0.4), swing_l * 0.2, 0.7 + 0.4 * max(0.0, -swing_l), 0.0)
        apply_arm_hang(arm, "R", swing_r * 0.12, swing_r * 0.08, 0.15, 0.0)
        bpy.context.view_layer.update()
        key_pose(arm, frame)

    def write_clip(name, length, fn):
        action = ensure_action(arm, name)
        scene.frame_start = 1
        scene.frame_end = length
        clear_pose(arm)
        for frame in range(1, length + 1):
            fn(frame)
        looping = name not in ("jumpStart", "jumpLand", "castInstant")
        if looping:
            fn(1)
            key_pose(arm, length + 1)
        action.use_frame_range = True
        action.frame_start = 1
        action.frame_end = length
        push_nla(arm, action, name, length)
        print("CLIP", name, "frames", length)

    # idle
    def idle_fn(frame):
        t = (frame - 1) / 48.0 * math.pi * 2.0
        clear_pose(arm)
        pose_upper_rest_plus(
            arm,
            spine=0.035 * math.sin(t),
            chest=0.04 * math.sin(t + 0.3),
            lean=0.02 * math.sin(t * 0.5),
            twist=0.03 * math.sin(t * 0.5 + 0.4),
            head=0.025 * math.sin(t + 0.6),
            cloak=0.06 * math.sin(t + 1.1),
            hip_z=0.006 * math.sin(t),
            hip_sway=0.25 * math.sin(t * 0.5),
        )
        apply_arm_hang(arm, "L", 0.08 * math.sin(t), 0.05 * math.sin(t + 0.5), 0.85 + 0.08 * math.sin(t), 0.0)
        apply_arm_hang(arm, "R", 0.04 * math.sin(t + 0.7), 0.03 * math.cos(t), 0.1, 0.04 * math.sin(t))
        bpy.context.view_layer.update()
        key_pose(arm, frame)

    write_clip("idle", 48, idle_fn)
    write_clip("walk", 24, lambda f: loco_frame(f, 24, step=0.22, lift=0.11, plant=0.52, speed_lean=0.08))
    write_clip("walkBack", 24, lambda f: loco_frame(f, 24, step=0.16, lift=0.08, plant=0.55, speed_lean=0.04, back=True))
    # 0.30 m half-stride is near IK reach on a 0.83 m leg. 7 m/s wants ~1.4 m
    # stance travel; do not push step far enough to cancel skate (splits knees).
    write_clip("run", 16, lambda f: loco_frame(f, 16, step=0.30, lift=0.16, plant=0.42, speed_lean=0.22, run=True))
    write_clip("strafeLeft", 24, lambda f: loco_frame(f, 24, step=0.16, lift=0.10, plant=0.5, speed_lean=0.04, strafe=-1.0))
    write_clip("strafeRight", 24, lambda f: loco_frame(f, 24, step=0.16, lift=0.10, plant=0.5, speed_lean=0.04, strafe=1.0))

    def jump_start_fn(frame):
        u = (frame - 1) / 9.0
        clear_pose(arm)
        crouch = math.sin(min(1.0, u * 1.2) * math.pi) if u < 0.55 else 0.0
        extend = max(0.0, (u - 0.45) / 0.55)
        hip_z = -0.10 * crouch + 0.06 * extend
        pose_upper_rest_plus(
            arm,
            spine=-0.15 * crouch + 0.12 * extend,
            chest=-0.1 * crouch + 0.08 * extend,
            lean=-0.2 * crouch + 0.15 * extend,
            cloak=0.2 * crouch,
            hip_z=hip_z,
        )
        dip = 0.10 * crouch
        fl = Vector((-0.08, 0.04, 0.02 + 0.02 * extend))
        fr = Vector((0.08, 0.02, 0.02 + 0.02 * extend))
        apply_leg(arm, "L", fl + Vector((0, 0.05 * crouch, dip)), fl + Vector((0, -0.05, 0)), Vector((0, 0, hip_z)), lengths, rest)
        apply_leg(arm, "R", fr + Vector((0, 0.03 * crouch, dip)), fr + Vector((0, -0.05, 0)), Vector((0, 0, hip_z)), lengths, rest)
        apply_arm_hang(arm, "L", -0.3 * crouch + 0.4 * extend, 0.0, 0.9, 0.3 * extend)
        apply_arm_hang(arm, "R", 0.1 * extend, 0.0, 0.1, 0.15 * extend)
        bpy.context.view_layer.update()
        key_pose(arm, frame)

    def jump_air_fn(frame):
        t = (frame - 1) / 16.0 * math.pi * 2.0
        clear_pose(arm)
        pose_upper_rest_plus(
            arm,
            spine=0.08 + 0.03 * math.sin(t),
            chest=0.05,
            lean=0.12,
            cloak=0.25 + 0.08 * math.sin(t),
            hip_z=0.04,
        )
        fl = Vector((-0.07, 0.06, 0.18 + 0.03 * math.sin(t)))
        fr = Vector((0.08, -0.04, 0.14 + 0.03 * math.cos(t)))
        apply_leg(arm, "L", fl, fl + Vector((0, -0.07, -0.08)), Vector((0, 0, 0.04)), lengths, rest)
        apply_leg(arm, "R", fr, fr + Vector((0, -0.07, -0.08)), Vector((0, 0, 0.04)), lengths, rest)
        apply_arm_hang(arm, "L", 0.35 + 0.1 * math.sin(t), 0.1, 0.5, 0.35)
        apply_arm_hang(arm, "R", 0.08, 0.05, 0.12, 0.12)
        bpy.context.view_layer.update()
        key_pose(arm, frame)

    def jump_land_fn(frame):
        u = (frame - 1) / 11.0
        clear_pose(arm)
        absorb = math.sin(min(1.0, u * 1.15) * math.pi) if u < 0.75 else 0.0
        recover = max(0.0, (u - 0.45) / 0.55)
        hip_z = -0.12 * absorb + 0.01 * recover
        pose_upper_rest_plus(
            arm,
            spine=-0.18 * absorb,
            chest=-0.12 * absorb,
            lean=-0.15 * absorb,
            cloak=0.3 * absorb,
            hip_z=hip_z,
        )
        fl = Vector((-0.09, 0.03, 0.02))
        fr = Vector((0.09, 0.01, 0.02))
        apply_leg(arm, "L", fl, fl + Vector((0, -0.06, 0)), Vector((0, 0, hip_z)), lengths, rest)
        apply_leg(arm, "R", fr, fr + Vector((0, -0.06, 0)), Vector((0, 0, hip_z)), lengths, rest)
        apply_arm_hang(arm, "L", -0.2 * absorb, 0.0, 1.0, 0.0)
        apply_arm_hang(arm, "R", 0.0, 0.0, 0.12, 0.0)
        bpy.context.view_layer.update()
        key_pose(arm, frame)

    write_clip("jumpStart", 10, jump_start_fn)
    write_clip("jumpAir", 16, jump_air_fn)
    write_clip("jumpLand", 12, jump_land_fn)

    def cast_instant_fn(frame):
        u = (frame - 1) / 19.0
        peak = math.sin(min(1.0, u * 1.05) * math.pi)
        clear_pose(arm)
        pose_upper_rest_plus(
            arm,
            spine=0.08 * peak,
            chest=0.12 * peak,
            lean=-0.08 * peak,
            twist=0.15 * peak,
            head=0.06 * peak,
            cloak=0.08 * peak,
            hip_z=0.01 * peak,
        )
        apply_arm_hang(arm, "L", 0.15, 0.2 * peak, 0.4, 0.95 * peak)
        local_euler(arm.pose.bones["UpperArm.L"], (-0.9 * peak, 0.2 * peak, 0.7 * peak))
        local_euler(arm.pose.bones["ForeArm.L"], (-0.4 * peak, 0.0, 0.3 * peak))
        apply_arm_hang(arm, "R", 0.05, 0.1 * peak, 0.1, 0.55 * peak)
        local_euler(arm.pose.bones["UpperArm.R"], (-0.35 * peak, -0.15 * peak, -0.25 * peak))
        local_euler(arm.pose.bones["ForeArm.R"], (0.15 * peak, 0.0, 0.1 * peak))
        local_euler(arm.pose.bones["Staff"], (0.05 * peak, 0.0, 0.08 * peak))
        bpy.context.view_layer.update()
        key_pose(arm, frame)

    def cast_channel_fn(frame):
        t = (frame - 1) / 32.0 * math.pi * 2.0
        pulse = 0.85 + 0.15 * math.sin(t)
        clear_pose(arm)
        pose_upper_rest_plus(
            arm,
            spine=0.06 + 0.02 * math.sin(t),
            chest=0.10 + 0.03 * math.sin(t + 0.4),
            lean=-0.06,
            twist=0.08,
            head=0.04,
            cloak=0.05 * math.sin(t + 1.0),
            hip_z=0.008 * math.sin(t),
        )
        apply_arm_hang(arm, "L", 0.1, 0.15, 0.35, 0.9 * pulse)
        local_euler(arm.pose.bones["UpperArm.L"], (-0.85, 0.18, 0.65))
        local_euler(arm.pose.bones["ForeArm.L"], (-0.35, 0.0, 0.28))
        apply_arm_hang(arm, "R", 0.04, 0.08, 0.1, 0.5 * pulse)
        local_euler(arm.pose.bones["UpperArm.R"], (-0.32, -0.12, -0.22))
        local_euler(arm.pose.bones["Staff"], (0.04 * math.sin(t), 0.0, 0.05))
        bpy.context.view_layer.update()
        key_pose(arm, frame)

    write_clip("castInstant", 20, cast_instant_fn)
    write_clip("castChannel", 32, cast_channel_fn)

    ensure_action(arm, "idle")
    scene.frame_start = 1
    scene.frame_end = 48
    scene.frame_set(1)
    clear_pose(arm)


def export_hero(arm):
    ensure_object_mode()
    try:
        bpy.ops.file.pack_all()
    except Exception as exc:
        print("pack_all skipped", exc)
    for obj in bpy.data.objects:
        obj.hide_set(False)
        obj.hide_render = False
        obj.hide_viewport = False
        obj.select_set(False)
    arm.select_set(True)
    bpy.context.view_layer.objects.active = arm
    for obj in bpy.data.objects:
        if obj.name.startswith("Hero") and obj.type in {"MESH", "EMPTY", "ARMATURE"}:
            obj.select_set(True)
    os.makedirs(os.path.dirname(EXPORT), exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=EXPORT,
        export_format="GLB",
        export_apply=False,
        export_yup=True,
        export_lights=False,
        export_cameras=False,
        export_extras=False,
        export_animations=True,
        export_animation_mode="ACTIONS",
        export_nla_strips=True,
        export_bake_animation=True,
        export_force_sampling=True,
        export_anim_single_armature=True,
        export_anim_slide_to_zero=True,
        export_merge_animation="ACTION",
        export_optimize_animation_size=True,
        export_rest_position_armature=True,
        export_def_bones=False,
        export_skins=True,
        export_morph=False,
        use_selection=True,
        use_visible=True,
        export_materials="EXPORT",
        export_texcoords=True,
        export_normals=True,
        export_tangents=True,
        export_image_format="AUTO",
    )
    print("HERO_EXPORT", EXPORT, "bytes", os.path.getsize(EXPORT))


def strip_previous_rig():
    ensure_object_mode()
    for obj in list(bpy.data.objects):
        if obj.type == "ARMATURE":
            bpy.data.objects.remove(obj, do_unlink=True)
    for arm in list(bpy.data.armatures):
        bpy.data.armatures.remove(arm)
    for action in list(bpy.data.actions):
        bpy.data.actions.remove(action)
    for obj in bpy.data.objects:
        if obj.type != "MESH":
            continue
        for mod in list(obj.modifiers):
            if mod.type == "ARMATURE":
                obj.modifiers.remove(mod)
        unparent_keep(obj)
        apply_mesh_transforms(obj)


def parent_root(arm):
    root = bpy.data.objects.get("HeroRoot")
    if root is None:
        return
    unparent_keep(root)
    arm.parent = None
    root.parent = arm
    root.matrix_parent_inverse = arm.matrix_world.inverted()


def build():
    names = {o.name for o in bpy.data.objects}
    if names & SHRINE_MARKERS:
        raise RuntimeError("Refusing to rig hero in shrine file: " + ", ".join(sorted(names & SHRINE_MARKERS)))
    strip_previous_rig()
    arm = build_armature()
    stats = []
    for obj in list(bpy.data.objects):
        if obj.type != "MESH" or not obj.name.startswith("Hero"):
            continue
        stats.append((obj.name, bind_heat(obj, arm)))
    parent_root(arm)
    author_clips(arm)
    export_hero(arm)
    bpy.ops.wm.save_as_mainfile(filepath=BLEND)
    print("HERO_RIG_SAVED", BLEND)
    print("BIND", stats)
    print("ACTIONS", [a.name for a in bpy.data.actions])
    return arm


build()
