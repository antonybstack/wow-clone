"""Grow the moonwell disc into a small night-elf starter hamlet."""
import math
import os

import bpy
from mathutils import Vector

TEX = "/Users/antbly/dev/wow-clone/lite-moonwell/public/tex"

USER_PROMPT = (
    "I want a fully playable scene, so extend the current scene to look like a small town "
    "starting area, I would like it so it feels like the start of a game, and for now, "
    "perhaps there is a training dummy like in World of Warcraft I can cast spells against"
)

if bpy.ops.object.mode_set.poll():
    bpy.ops.object.mode_set(mode="OBJECT")


def load_image(path, non_color=False):
    if not path or not os.path.exists(path):
        return None
    img = bpy.data.images.load(path, check_existing=True)
    if non_color:
        img.colorspace_settings.name = "Non-Color"
    return img


def tex_path(folder, name):
    return os.path.join(TEX, folder, name)


def link(nt, a, b):
    nt.links.new(a, b)


def make_pbr(mat, folder, *, uv_scale=(2.0, 2.0, 1.0), metallic=0.0, tint=(1, 1, 1),
             emission=None, emission_strength=0.0, roughness_boost=0.0, normal_strength=1.0):
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    out.location = (720, 0)
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.location = (420, 0)
    link(nt, bsdf.outputs["BSDF"], out.inputs["Surface"])
    if "Metallic" in bsdf.inputs:
        bsdf.inputs["Metallic"].default_value = metallic

    texc = nt.nodes.new("ShaderNodeTexCoord")
    texc.location = (-760, 0)
    mapping = nt.nodes.new("ShaderNodeMapping")
    mapping.location = (-540, 0)
    mapping.inputs["Scale"].default_value = uv_scale
    link(nt, texc.outputs["UV"], mapping.inputs["Vector"])

    def img_node(filename, non_color, y):
        img = load_image(tex_path(folder, filename), non_color=non_color)
        if not img:
            return None
        node = nt.nodes.new("ShaderNodeTexImage")
        node.location = (-280, y)
        node.image = img
        if non_color:
            node.image.colorspace_settings.name = "Non-Color"
        link(nt, mapping.outputs["Vector"], node.inputs["Vector"])
        return node

    def mix_multiply(a_socket, b_value_or_socket, fac, y):
        mix = nt.nodes.new("ShaderNodeMix")
        mix.data_type = "RGBA"
        mix.blend_type = "MULTIPLY"
        mix.location = (80, y)
        mix.inputs["Factor"].default_value = fac
        link(nt, a_socket, mix.inputs["A"])
        if isinstance(b_value_or_socket, tuple):
            mix.inputs["B"].default_value = (*b_value_or_socket, 1)
        else:
            link(nt, b_value_or_socket, mix.inputs["B"])
        return mix.outputs["Result"]

    diff = img_node("diff.jpg", False, 280)
    if diff:
        color_out = mix_multiply(diff.outputs["Color"], tint, 1.0, 280)
        ao = img_node("ao.jpg", True, 80)
        if ao:
            color_out = mix_multiply(color_out, ao.outputs["Color"], 0.65, 140)
        link(nt, color_out, bsdf.inputs["Base Color"])

    rough = img_node("rough.jpg", True, -80)
    if rough:
        if roughness_boost:
            ramp = nt.nodes.new("ShaderNodeMath")
            ramp.operation = "ADD"
            ramp.inputs[1].default_value = roughness_boost
            ramp.location = (80, -80)
            link(nt, rough.outputs["Color"], ramp.inputs[0])
            link(nt, ramp.outputs["Value"], bsdf.inputs["Roughness"])
        else:
            link(nt, rough.outputs["Color"], bsdf.inputs["Roughness"])

    metal = img_node("metal.jpg", True, -240)
    if metal and "Metallic" in bsdf.inputs:
        link(nt, metal.outputs["Color"], bsdf.inputs["Metallic"])

    nor = img_node("nor.jpg", True, -400)
    if nor:
        nmap = nt.nodes.new("ShaderNodeNormalMap")
        nmap.inputs["Strength"].default_value = normal_strength
        nmap.location = (80, -400)
        link(nt, nor.outputs["Color"], nmap.inputs["Color"])
        link(nt, nmap.outputs["Normal"], bsdf.inputs["Normal"])

    if emission is not None:
        if "Emission Color" in bsdf.inputs:
            bsdf.inputs["Emission Color"].default_value = (*emission, 1)
            bsdf.inputs["Emission Strength"].default_value = emission_strength
        elif "Emission" in bsdf.inputs:
            bsdf.inputs["Emission"].default_value = (*emission, 1)
    return mat


def ensure_mat(name):
    mat = bpy.data.materials.get(name)
    if mat is None:
        mat = bpy.data.materials.new(name)
        mat.use_nodes = True
    return mat


def emit_mat(name, color, strength, roughness=0.35):
    mat = ensure_mat(name)
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    link(nt, bsdf.outputs["BSDF"], out.inputs["Surface"])
    bsdf.inputs["Base Color"].default_value = (*color, 1)
    if "Roughness" in bsdf.inputs:
        bsdf.inputs["Roughness"].default_value = roughness
    if "Emission Color" in bsdf.inputs:
        bsdf.inputs["Emission Color"].default_value = (*color, 1)
        bsdf.inputs["Emission Strength"].default_value = strength
    elif "Emission" in bsdf.inputs:
        bsdf.inputs["Emission"].default_value = (*color, 1)
    return mat


def select_only(ob):
    bpy.ops.object.select_all(action="DESELECT")
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob


def apply_sr(ob):
    select_only(ob)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)


def set_mat(ob, mat):
    if ob.data.materials:
        ob.data.materials[0] = mat
        while len(ob.data.materials) > 1:
            ob.data.materials.pop(index=1)
    else:
        ob.data.materials.append(mat)


def shade_auto(ob):
    select_only(ob)
    try:
        bpy.ops.object.shade_auto_smooth(angle=0.7)
    except TypeError:
        try:
            bpy.ops.object.shade_smooth()
        except Exception:
            pass


def ensure_uv(ob):
    mesh = ob.data
    if not mesh.uv_layers:
        mesh.uv_layers.new(name="UVMap")
    select_only(ob)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    try:
        bpy.ops.uv.smart_project(angle_limit=1.15192, island_margin=0.03)
    except TypeError:
        bpy.ops.uv.smart_project(island_margin=0.03)
    bpy.ops.object.mode_set(mode="OBJECT")


def add_bevel(ob, width=0.02, segments=2):
    if any(m.type == "BEVEL" for m in ob.modifiers):
        return
    mod = ob.modifiers.new("Bevel", "BEVEL")
    mod.width = width
    mod.segments = segments
    mod.limit_method = "ANGLE"
    mod.angle_limit = 0.7


def join_as(name, objects):
    objects = [o for o in objects if o is not None]
    if not objects:
        return None
    bpy.ops.object.select_all(action="DESELECT")
    for ob in objects:
        ob.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    if len(objects) > 1:
        bpy.ops.object.join()
    ob = bpy.context.object
    ob.name = name
    if ob.data:
        ob.data.name = name
    return ob


def nuke_names(names):
    for name in names:
        ob = bpy.data.objects.get(name)
        if ob:
            bpy.data.objects.remove(ob, do_unlink=True)


def nuke_prefixes(prefixes):
    for ob in list(bpy.context.scene.objects):
        if ob.name.startswith(prefixes):
            bpy.data.objects.remove(ob, do_unlink=True)


def primitive(op, name, mat, **kwargs):
    op(**kwargs)
    ob = bpy.context.object
    ob.name = name
    if ob.data:
        ob.data.name = name
    set_mat(ob, mat)
    return ob


def cube(name, loc, dims, mat):
    ob = primitive(bpy.ops.mesh.primitive_cube_add, name, mat, size=1.0, location=loc)
    ob.scale = (dims[0], dims[1], dims[2])
    apply_sr(ob)
    return ob


def cyl(name, loc, radius, depth, mat, verts=12):
    ob = primitive(
        bpy.ops.mesh.primitive_cylinder_add,
        name,
        mat,
        vertices=verts,
        radius=radius,
        depth=depth,
        location=loc,
    )
    apply_sr(ob)
    return ob


def cone(name, loc, r1, depth, mat, verts=8, r2=0.06):
    ob = primitive(
        bpy.ops.mesh.primitive_cone_add,
        name,
        mat,
        vertices=verts,
        radius1=r1,
        radius2=r2,
        depth=depth,
        location=loc,
    )
    apply_sr(ob)
    return ob


def sphere(name, loc, radius, mat, segments=12, rings=8):
    ob = primitive(
        bpy.ops.mesh.primitive_uv_sphere_add,
        name,
        mat,
        segments=segments,
        ring_count=rings,
        radius=radius,
        location=loc,
    )
    apply_sr(ob)
    return ob


def sweep_roof(ob, amount):
    mesh = ob.data
    zs = [v.co.z for v in mesh.vertices]
    zmin, zmax = min(zs), max(zs)
    span = (zmax - zmin) or 1.0
    for v in mesh.vertices:
        t = (v.co.z - zmin) / span
        v.co.y += amount * t * t
        v.co.x *= 1.0 + 0.08 * t
    mesh.update()


def face_well(ob, loc):
    ob.location = loc
    ob.rotation_euler[2] = math.atan2(loc[0], -loc[1])
    apply_sr(ob)
    ob.location = loc


def clone_obj(src, name, loc, share_data=True):
    ob = src.copy()
    if not share_data and ob.data:
        ob.data = src.data.copy()
    ob.name = name
    ob.location = loc
    bpy.context.scene.collection.objects.link(ob)
    return ob


# --- materials ---
wood = make_pbr(ensure_mat("WoodPlank"), "wood_planks_grey",
                uv_scale=(1.6, 1.6, 1), tint=(0.58, 0.44, 0.30), normal_strength=1.15)
wood_dark = make_pbr(ensure_mat("WoodDark"), "wood_planks_grey",
                    uv_scale=(1.4, 1.4, 1), tint=(0.32, 0.24, 0.16), normal_strength=1.1)
roof = make_pbr(ensure_mat("RoofShake"), "bark_brown_02",
                uv_scale=(1.4, 2.2, 1), tint=(0.48, 0.30, 0.36), normal_strength=1.35)
cloth = make_pbr(ensure_mat("ClothSack"), "fabric_pattern_07",
                 uv_scale=(1.8, 1.8, 1), tint=(0.72, 0.58, 0.32), roughness_boost=0.08)
cloak = make_pbr(ensure_mat("CloakWool"), "wool_grey",
                 uv_scale=(1.6, 1.6, 1), tint=(0.22, 0.30, 0.42), normal_strength=0.8)
hood = make_pbr(ensure_mat("HoodWool"), "wool_grey",
                uv_scale=(1.4, 1.4, 1), tint=(0.16, 0.22, 0.32), normal_strength=0.7)
skin = emit_mat("SkinElf", (0.38, 0.52, 0.46), 0.04, roughness=0.55)
window = emit_mat("WindowGlow", (1.0, 0.62, 0.22), 4.2, roughness=0.22)
stone = bpy.data.materials.get("Stone") or wood
stone_dark = bpy.data.materials.get("StoneDark") or stone
bark = bpy.data.materials.get("Bark") or wood
path_mat = bpy.data.materials.get("Path") or bpy.data.materials.get("Dirt")
dirt = bpy.data.materials.get("Dirt") or path_mat
flame = bpy.data.materials.get("Flame") or window
metal = bpy.data.materials.get("LanternMetal") or wood

created = []


def track(ob):
    if ob:
        created.append(ob)
    return ob


# --- remove a previous hamlet pass ---
nuke_prefixes((
    "Lodge", "TrainerHut", "Storehouse", "LanternC", "LanternD", "LanternE", "LanternF",
    "Hamlet", "Dummy", "NpcGreeter", "FencePost", "FenceRail", "FenceWall", "_HPart",
    "TreeF", "TreeG", "TreeH",
))
nuke_names(("Path", "DummyYard", "Dummy", "NpcGreeter", "HamletFence", "HamletKerb", "Torus"))


# --- expand ground + dirt so the island is a hamlet, not a cookie ---
ground = bpy.data.objects.get("Ground")
if ground:
    ground.dimensions = (24.2, 24.2, ground.dimensions[2])
    apply_sr(ground)
    for mod in ground.modifiers:
        if mod.type == "DISPLACE":
            mod.strength = 0.08
            mod.mid_level = 0.48
    ensure_uv(ground)
    shade_auto(ground)

dirt_ring = bpy.data.objects.get("DirtRing")
if dirt_ring:
    dirt_ring.dimensions = (8.4, 8.4, min(0.28, dirt_ring.dimensions[2]))
    apply_sr(dirt_ring)
    ensure_uv(dirt_ring)
    shade_auto(dirt_ring)


# --- path from the well (heart) south to the dummy yard ---
path = track(cube("Path", (0.0, -5.0, 0.028), (1.5, 8.4, 0.055), path_mat))
yard = track(cyl("DummyYard", (0.15, -9.15, 0.03), 2.35, 0.07, stone, verts=16))


def make_round_lodge(name, loc, scale=1.0):
    s = scale
    parts = []
    parts.append(cyl("_HPartF", (0, 0, 0.16 * s), 1.78 * s, 0.32 * s, stone_dark, 12))
    parts.append(cyl("_HPartW", (0, 0, 1.28 * s), 1.62 * s, 1.95 * s, wood, 12))
    for i in range(4):
        a = i * math.pi * 0.5 + 0.4
        px = math.cos(a) * 1.64 * s
        py = math.sin(a) * 1.64 * s
        log = cyl(f"_HPartLog{i}", (px, py, 1.15 * s), 0.13 * s, 2.2 * s, bark, 8)
        parts.append(log)
    door = cube("_HPartDoor", (0, 1.62 * s, 1.12 * s), (0.92 * s, 0.10 * s, 1.85 * s), wood_dark)
    parts.append(door)
    for sx in (-0.5, 0.5):
        parts.append(cyl("_HPartJamb", (sx * s, 1.68 * s, 1.15 * s), 0.07 * s, 2.05 * s, bark, 6))
    parts.append(cube("_HPartLint", (0, 1.68 * s, 2.12 * s), (1.15 * s, 0.16 * s, 0.12 * s), wood_dark))
    for wx, wz, wy in ((-1.22, 1.45, 0.55), (1.22, 1.45, -0.35)):
        parts.append(cube("_HPartFrame", (wx * s, wy * s, wz * s), (0.10 * s, 0.70 * s, 0.62 * s), wood_dark))
        parts.append(cube("_HPartWin", ((wx + (0.08 if wx > 0 else -0.08)) * s, wy * s, wz * s),
                         (0.06 * s, 0.52 * s, 0.46 * s), window))
    roof_ob = cone("_HPartRoof", (0, 0.15 * s, 2.72 * s), 2.15 * s, 1.85 * s, roof, verts=8, r2=0.08 * s)
    sweep_roof(roof_ob, 0.55 * s)
    parts.append(roof_ob)
    parts.append(cube("_HPartChim", (-0.55 * s, -0.85 * s, 3.15 * s), (0.38 * s, 0.38 * s, 0.95 * s), stone))
    parts.append(cube("_HPartDeck", (0, 2.15 * s, 0.34 * s), (1.55 * s, 1.15 * s, 0.12 * s), wood))
    for sx in (-0.55, 0.55):
        parts.append(cyl("_HPartPost", (sx * s, 2.55 * s, 1.15 * s), 0.07 * s, 1.55 * s, bark, 6))
    parts.append(cube("_HPartPorch", (0, 2.45 * s, 1.95 * s), (1.7 * s, 1.05 * s, 0.10 * s), wood_dark))
    for p in parts:
        apply_sr(p)
    ob = join_as(name, parts)
    face_well(ob, loc)
    add_bevel(ob, 0.018, 2)
    shade_auto(ob)
    ensure_uv(ob)
    return track(ob)


def make_trainer_hut(name, loc):
    parts = []
    parts.append(cube("_HPartF", (0, 0, 0.16), (4.35, 3.55, 0.32), stone_dark))
    parts.append(cube("_HPartW", (0, -0.15, 1.45), (4.05, 3.15, 2.35), wood))
    parts.append(cube("_HPartDoor", (0, 1.48, 1.2), (1.05, 0.12, 2.05), wood_dark))
    parts.append(cube("_HPartDeck", (0, 2.05, 0.34), (3.4, 1.35, 0.12), wood))
    for sx in (-1.4, 1.4):
        parts.append(cyl("_HPartPost", (sx, 2.55, 1.25), 0.09, 1.8, bark, 6))
    parts.append(cube("_HPartBeam", (0, 2.55, 2.18), (3.1, 0.16, 0.14), wood_dark))
    roof_ob = cone("_HPartRoof", (0, 0.2, 3.05), 2.85, 1.75, roof, verts=8, r2=0.08)
    roof_ob.scale = (1.05, 0.78, 1.0)
    apply_sr(roof_ob)
    sweep_roof(roof_ob, 0.5)
    parts.append(roof_ob)
    parts.append(cube("_HPartRidge", (0, 0.25, 3.82), (0.22, 2.4, 0.16), wood_dark))
    for wx in (-1.35, 1.35):
        parts.append(cube("_HPartWin", (wx, 1.62, 1.55), (0.7, 0.08, 0.55), window))
    # porch weapon rack (reads as trainer, not a dwelling box)
    parts.append(cyl("_HPartRack", (-1.15, 2.35, 0.95), 0.05, 1.55, bark, 6))
    parts.append(cyl("_HPartRack2", (-0.85, 2.35, 0.95), 0.05, 1.55, bark, 6))
    parts.append(cube("_HPartStaff", (-1.0, 2.38, 1.55), (0.06, 0.06, 1.7), wood_dark))
    for p in parts:
        apply_sr(p)
    ob = join_as(name, parts)
    face_well(ob, loc)
    add_bevel(ob, 0.02, 2)
    shade_auto(ob)
    ensure_uv(ob)
    return track(ob)


def make_storehouse(name, loc):
    parts = []
    parts.append(cube("_HPartF", (0, 0, 0.14), (2.55, 2.15, 0.28), stone_dark))
    parts.append(cube("_HPartW", (0, 0, 1.15), (2.35, 1.95, 1.85), wood))
    parts.append(cube("_HPartDoor", (0, 1.0, 0.95), (0.85, 0.1, 1.55), wood_dark))
    roof_ob = cube("_HPartR", (0, 0, 2.25), (2.75, 2.35, 0.16), roof)
    roof_ob.scale[2] = 1.0
    apply_sr(roof_ob)
    # peak
    peak = cone("_HPartPeak", (0, 0, 2.55), 1.55, 0.85, roof, verts=4, r2=0.05)
    parts.append(roof_ob)
    parts.append(peak)
    parts.append(cube("_HPartCrate", (1.45, 0.65, 0.38), (0.55, 0.45, 0.5), wood_dark))
    parts.append(cube("_HPartCrate2", (1.55, 0.15, 0.28), (0.4, 0.4, 0.35), wood))
    for p in parts:
        apply_sr(p)
    ob = join_as(name, parts)
    face_well(ob, loc)
    add_bevel(ob, 0.016, 2)
    shade_auto(ob)
    ensure_uv(ob)
    return track(ob)


make_round_lodge("LodgeWest", (-6.55, -0.55, 0.0), 1.0)
make_round_lodge("LodgeEast", (6.85, 1.35, 0.0), 0.92)
make_round_lodge("LodgeNorth", (-4.65, 6.35, 0.0), 0.88)
make_trainer_hut("TrainerHut", (5.95, -5.85, 0.0))
make_storehouse("Storehouse", (-5.85, -6.55, 0.0))


# --- training dummy (~1.8 m), wood post + straw sacks ---
dummy_parts = []
dummy_parts.append(cyl("_HPartBase", (0, 0, 0.06), 0.28, 0.12, stone, 10))
dummy_parts.append(cyl("_HPartPost", (0, 0, 0.9), 0.075, 1.68, wood, 8))
dummy_parts.append(cube("_HPartArm", (0, 0, 1.38), (1.05, 0.08, 0.08), wood_dark))
torso = sphere("_HPartSack", (0, 0.04, 1.05), 0.32, cloth, 10, 8)
torso.scale = (0.85, 0.72, 1.15)
apply_sr(torso)
dummy_parts.append(torso)
dummy_parts.append(sphere("_HPartHead", (0, 0.02, 1.55), 0.16, cloth, 10, 8))
dummy_parts.append(cyl("_HPartWrap", (0, 0, 1.22), 0.18, 0.08, wood_dark, 8))
dummy_parts.append(cyl("_HPartWrap2", (0, 0, 0.72), 0.14, 0.07, wood_dark, 8))
for p in dummy_parts:
    apply_sr(p)
dummy = join_as("Dummy", dummy_parts)
dummy.location = (0.15, -9.15, 0.0)
dummy.rotation_euler[2] = math.atan2(0.15, 9.15)
apply_sr(dummy)
dummy.location = (0.15, -9.15, 0.0)
dummy.name = "Dummy"
dummy.data.name = "Dummy"
add_bevel(dummy, 0.012, 2)
shade_auto(dummy)
ensure_uv(dummy)
track(dummy)


# --- static hooded greeter ---
npc_parts = []
npc_parts.append(cyl("_HPartBoots", (0, 0, 0.08), 0.16, 0.16, wood_dark, 8))
npc_parts.append(cyl("_HPartLegs", (0, 0, 0.42), 0.17, 0.55, cloak, 8))
npc_parts.append(cyl("_HPartTorso", (0, 0, 1.05), 0.22, 0.85, cloak, 10))
cloak_cone = cone("_HPartCloak", (0, 0.02, 0.95), 0.48, 1.45, cloak, verts=8, r2=0.18)
npc_parts.append(cloak_cone)
npc_parts.append(sphere("_HPartHead", (0, 0.02, 1.58), 0.13, skin, 10, 8))
hood_ob = cone("_HPartHood", (0, -0.02, 1.68), 0.24, 0.38, hood, verts=8, r2=0.04)
hood_ob.rotation_euler[0] = math.radians(-18)
apply_sr(hood_ob)
npc_parts.append(hood_ob)
npc_parts.append(sphere("_HPartHoodCowl", (0, 0.0, 1.62), 0.18, hood, 8, 6))
# ears — night-elf-ish
for sx in (-1, 1):
    ear = cone("_HPartEar", (sx * 0.12, 0.0, 1.66), 0.035, 0.12, skin, verts=5, r2=0.004)
    ear.rotation_euler[2] = math.radians(sx * 35)
    ear.rotation_euler[0] = math.radians(-25)
    apply_sr(ear)
    npc_parts.append(ear)
npc_parts.append(cyl("_HPartArmL", (-0.28, 0.05, 1.12), 0.055, 0.7, cloak, 6))
npc_parts.append(cyl("_HPartArmR", (0.28, 0.08, 1.12), 0.055, 0.7, cloak, 6))
for p in npc_parts:
    apply_sr(p)
npc = join_as("NpcGreeter", npc_parts)
npc_loc = (1.72, -2.58, 0.0)
face_well(npc, npc_loc)
npc.name = "NpcGreeter"
npc.data.name = "NpcGreeter"
shade_auto(npc)
ensure_uv(npc)
track(npc)


# --- fence + kerb as BOX segments (a joined ring AABB would fill the hamlet) ---
# Havok MESH on the character controller walks *on* triangles; vertical rings do not block.
fence_r = 10.55
kerb_r = 10.78
fence_n = 28
for i in range(fence_n):
    a = i / fence_n * math.pi * 2
    a2 = (i + 1) / fence_n * math.pi * 2
    x, y = math.cos(a) * fence_r, math.sin(a) * fence_r
    x2, y2 = math.cos(a2) * fence_r, math.sin(a2) * fence_r
    post = cyl(f"FencePost_{i:02d}", (x, y, 0.58), 0.055, 1.12, wood, 6)
    shade_auto(post)
    track(post)
    mx, my = (x + x2) * 0.5, (y + y2) * 0.5
    dx, dy = x2 - x, y2 - y
    length = math.hypot(dx, dy)
    yaw = math.atan2(dy, dx)
    wall = cube(f"FenceWall_{i:02d}", (mx, my, 0.58), (length * 1.08, 0.11, 0.95), wood_dark)
    wall.rotation_euler[2] = yaw
    apply_sr(wall)
    shade_auto(wall)
    ensure_uv(wall)
    track(wall)
    kx = math.cos(a + math.pi / fence_n) * kerb_r
    ky = math.sin(a + math.pi / fence_n) * kerb_r
    kerb = cube(f"HamletKerb_{i:02d}", (kx, ky, 0.28), (length * 1.1, 0.34, 0.56), stone)
    kerb.rotation_euler[2] = yaw
    apply_sr(kerb)
    shade_auto(kerb)
    ensure_uv(kerb)
    track(kerb)


# --- extra lanterns along the path ---
def clone_lantern(dst, xy):
    x, y = xy
    src_map = {
        "Post": "LanternA_Post",
        "Cage": "LanternA_Cage",
        "Flame": "LanternA_Flame",
        "L": "LanternA_L",
    }
    for suffix, src_name in src_map.items():
        src = bpy.data.objects.get(src_name)
        if src is None:
            continue
        loc = (x, y, src.location.z)
        ob = clone_obj(src, f"{dst}_{suffix}" if suffix != "L" else f"{dst}_L", loc, share_data=False)
        if suffix == "L":
            ob.data.energy = 42.0
        track(ob)


clone_lantern("LanternC", (-0.95, -4.05))
clone_lantern("LanternD", (1.08, -5.95))
clone_lantern("LanternE", (-1.02, -7.75))
clone_lantern("LanternF", (1.22, -9.45))


# --- move grove trees to the hamlet rim; duplicate two for a tree-line ---
tree_layout = {
    "TreeA": ((-9.15, 3.55, 0.02), 1.62),
    "TreeB": ((9.35, -2.65, 0.02), 1.68),
    "TreeC": ((8.45, 6.55, 0.02), 1.72),
    "TreeD": ((-7.55, 7.35, 0.02), 1.58),
    "TreeE": ((2.85, 9.25, 0.02), 1.82),
}
for name, (loc, sc) in tree_layout.items():
    ob = bpy.data.objects.get(name)
    if not ob:
        continue
    ob.location = loc
    ob.scale = (sc, sc, sc)

if bpy.data.objects.get("TreeA"):
    t = clone_obj(bpy.data.objects["TreeA"], "TreeF", (-9.05, -4.45, 0.02), share_data=False)
    t.scale = (1.55, 1.55, 1.55)
    track(t)
if bpy.data.objects.get("TreeB"):
    t = clone_obj(bpy.data.objects["TreeB"], "TreeG", (9.2, 2.15, 0.02), share_data=False)
    t.scale = (1.5, 1.5, 1.5)
    track(t)
if bpy.data.objects.get("TreeE"):
    t = clone_obj(bpy.data.objects["TreeE"], "TreeH", (4.65, -9.15, 0.02), share_data=False)
    t.scale = (1.7, 1.7, 1.7)
    track(t)


# leftover temp parts
nuke_prefixes(("_HPart",))

bpy.ops.wm.save_mainfile()

named = ["Dummy", "NpcGreeter", "LodgeWest", "LodgeEast", "LodgeNorth", "TrainerHut",
         "Storehouse", "Path", "DummyYard", "FenceWall_00", "HamletKerb_00", "FencePost_00"]
print("HAMLET_BUILT", len(bpy.context.scene.objects), "created", len(created))
for n in named:
    ob = bpy.data.objects.get(n)
    if ob:
        print(n, "loc", tuple(round(c, 3) for c in ob.location),
              "dim", tuple(round(c, 3) for c in ob.dimensions))
    else:
        print("MISSING", n)
print("GROUND", tuple(round(c, 3) for c in bpy.data.objects["Ground"].dimensions))
