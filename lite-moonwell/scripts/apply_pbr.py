"""Apply Poly Haven PBR maps, UVs, bevels, and ground displacement in the live scene."""
import os

import bpy

TEX = "/Users/antbly/dev/wow-clone/lite-moonwell/public/tex"

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

    disp_img = load_image(tex_path(folder, "disp.jpg"), non_color=True)
    if disp_img:
        dnode = nt.nodes.new("ShaderNodeTexImage")
        dnode.location = (-280, -560)
        dnode.image = disp_img
        dnode.image.colorspace_settings.name = "Non-Color"
        link(nt, mapping.outputs["Vector"], dnode.inputs["Vector"])
        disp = nt.nodes.new("ShaderNodeDisplacement")
        disp.inputs["Scale"].default_value = 0.04
        disp.location = (420, -360)
        link(nt, dnode.outputs["Color"], disp.inputs["Height"])
        link(nt, disp.outputs["Displacement"], out.inputs["Displacement"])
        try:
            mat.displacement_method = "BUMP"
        except Exception:
            pass
    return mat


# --- materials ---
make_pbr(bpy.data.materials["Moss"], "forrest_ground_01", uv_scale=(3.5, 3.5, 1),
         tint=(0.42, 0.48, 0.36), normal_strength=1.35)
make_pbr(bpy.data.materials["Dirt"], "brown_mud_leaves_01", uv_scale=(2.8, 2.8, 1),
         tint=(0.55, 0.5, 0.4), normal_strength=1.2)
make_pbr(bpy.data.materials["Path"], "brown_mud_leaves_01", uv_scale=(2.2, 2.2, 1),
         tint=(0.62, 0.55, 0.42), roughness_boost=0.05)
make_pbr(bpy.data.materials["Stone"], "rock_wall_08", uv_scale=(1.8, 1.8, 1),
         tint=(0.55, 0.58, 0.62), normal_strength=1.5)
make_pbr(bpy.data.materials["StoneDark"], "rock_wall_08", uv_scale=(1.6, 1.6, 1),
         tint=(0.32, 0.34, 0.38), normal_strength=1.4)
make_pbr(bpy.data.materials["Bark"], "bark_brown_02", uv_scale=(1.2, 2.4, 1),
         tint=(0.5, 0.42, 0.32), normal_strength=1.6)
make_pbr(bpy.data.materials["Leaf"], "forest_leaves_03", uv_scale=(3.2, 3.2, 1),
         tint=(0.22, 0.38, 0.2), normal_strength=1.1)
make_pbr(bpy.data.materials["LeafGlow"], "forest_leaves_03", uv_scale=(3.2, 3.2, 1),
         tint=(0.18, 0.4, 0.28), emission=(0.12, 0.45, 0.28), emission_strength=0.55)
make_pbr(bpy.data.materials["LanternMetal"], "metal_plate", uv_scale=(2.0, 2.0, 1),
         metallic=1.0, tint=(0.7, 0.55, 0.28), normal_strength=1.2)
make_pbr(bpy.data.materials["MushroomCap"], "forest_leaves_03", uv_scale=(1.4, 1.4, 1),
         tint=(0.55, 0.18, 0.32), emission=(0.4, 0.08, 0.18), emission_strength=0.35)
make_pbr(bpy.data.materials["MushroomStem"], "bark_brown_02", uv_scale=(2.0, 2.0, 1),
         tint=(0.75, 0.68, 0.5))

# keep emissive heroes, but add rock normals on basin-adjacent crystal look
crystal = bpy.data.materials.get("Crystal")
if crystal:
    make_pbr(crystal, "rock_wall_08", uv_scale=(0.6, 0.6, 1), tint=(0.55, 0.85, 0.9),
             emission=(0.35, 0.85, 1.0), emission_strength=3.2, metallic=0.15, normal_strength=0.4)
pool = bpy.data.materials.get("Moonwell")
if pool:
    make_pbr(pool, "rock_wall_08", uv_scale=(1.2, 1.2, 1), tint=(0.08, 0.28, 0.26),
             emission=(0.12, 0.75, 0.62), emission_strength=3.4, roughness_boost=-0.3, normal_strength=0.25)

print("materials wired")


def ensure_uv(obj):
    if obj.type != "MESH":
        return
    mesh = obj.data
    if not mesh.uv_layers:
        mesh.uv_layers.new(name="UVMap")
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    try:
        bpy.ops.uv.smart_project(angle_limit=1.15192, island_margin=0.03)
    except TypeError:
        bpy.ops.uv.smart_project(island_margin=0.03)
    bpy.ops.object.mode_set(mode="OBJECT")


def add_bevel(obj, width=0.03, segments=3):
    if any(m.type == "BEVEL" for m in obj.modifiers):
        return
    mod = obj.modifiers.new("Bevel", "BEVEL")
    mod.width = width
    mod.segments = segments
    mod.limit_method = "ANGLE"
    mod.angle_limit = 0.7


def shade_auto(obj):
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    try:
        bpy.ops.object.shade_auto_smooth(angle=0.785)
    except TypeError:
        try:
            bpy.ops.object.shade_smooth()
        except Exception:
            pass


count = 0
for obj in list(bpy.context.scene.objects):
    if obj.type != "MESH":
        continue
    ensure_uv(obj)
    name = obj.name
    if name.startswith(("Menhir", "Kerb", "Henge", "Basin")):
        add_bevel(obj, width=0.045 if name.startswith("Menhir") else 0.02, segments=3)
    if name in {"Ground"}:
        if not any(m.type == "SUBSURF" for m in obj.modifiers):
            sub = obj.modifiers.new("Subdiv", "SUBSURF")
            sub.levels = 2
            sub.render_levels = 2
        if not any(m.type == "DISPLACE" for m in obj.modifiers):
            img = load_image(tex_path("forrest_ground_01", "disp.jpg"), non_color=True)
            if img:
                tex = bpy.data.textures.new("GroundDisp", "IMAGE")
                tex.image = img
                disp = obj.modifiers.new("Displace", "DISPLACE")
                disp.texture = tex
                disp.strength = 0.14
                disp.mid_level = 0.45
                disp.texture_coords = "UV"
    shade_auto(obj)
    count += 1

print(f"uv+mods on {count} meshes")
