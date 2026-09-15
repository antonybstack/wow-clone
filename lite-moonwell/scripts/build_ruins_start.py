"""First ruins-start blockout in the live moonwell shrine.

Adds collection RuinsStart (columns, a broken arch, rubble, look plate).
Does not delete Ground / Dummy / WellGlow / hamlet. Re-run replaces only RuinsStart.
"""
import math
import os

import bpy
from mathutils import Vector

ROOT = "/Users/antbly/dev/wow-clone/lite-moonwell"
TEX = os.path.join(ROOT, "public", "tex", "rock_wall_08")
PLATE = os.path.join(ROOT, "blender", "ref", "ruins-start.jpg")
COL_NAME = "RuinsStart"

SHRINE = ("Ground", "Dummy", "WellGlow")
if not all(n in bpy.data.objects for n in SHRINE):
    raise RuntimeError("Shrine not live. Open blender/moonwell.blend.")


def object_mode():
    if bpy.ops.object.mode_set.poll():
        bpy.ops.object.mode_set(mode="OBJECT")


def wipe_collection(name):
    col = bpy.data.collections.get(name)
    if not col:
        col = bpy.data.collections.new(name)
        bpy.context.scene.collection.children.link(col)
        return col
    for ob in list(col.objects):
        bpy.data.objects.remove(ob, do_unlink=True)
    return col


def link_col(ob, col):
    scene_col = bpy.context.scene.collection
    if ob.name not in col.objects:
        col.objects.link(ob)
    if ob.name in scene_col.objects:
        scene_col.objects.unlink(ob)


def stone_mat():
    mat = bpy.data.materials.get("RuinStone")
    if mat:
        return mat
    mat = bpy.data.materials.new("RuinStone")
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    out.location = (520, 0)
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.location = (240, 0)
    nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    texc = nt.nodes.new("ShaderNodeTexCoord")
    texc.location = (-700, 0)
    mapping = nt.nodes.new("ShaderNodeMapping")
    mapping.location = (-480, 0)
    mapping.inputs["Scale"].default_value = (2.4, 2.4, 2.4)
    nt.links.new(texc.outputs["UV"], mapping.inputs["Vector"])

    def img(fname, non_color, y):
        path = os.path.join(TEX, fname)
        if not os.path.exists(path):
            return None
        node = nt.nodes.new("ShaderNodeTexImage")
        node.location = (-240, y)
        node.image = bpy.data.images.load(path, check_existing=True)
        if non_color:
            node.image.colorspace_settings.name = "Non-Color"
        nt.links.new(mapping.outputs["Vector"], node.inputs["Vector"])
        return node

    diff = img("diff.jpg", False, 220)
    if diff:
        mix = nt.nodes.new("ShaderNodeMix")
        mix.data_type = "RGBA"
        mix.blend_type = "MULTIPLY"
        mix.location = (40, 220)
        mix.inputs["Factor"].default_value = 0.85
        mix.inputs["B"].default_value = (0.55, 0.58, 0.62, 1)
        nt.links.new(diff.outputs["Color"], mix.inputs["A"])
        nt.links.new(mix.outputs["Result"], bsdf.inputs["Base Color"])
    else:
        bsdf.inputs["Base Color"].default_value = (0.28, 0.30, 0.32, 1)
    nor = img("nor.jpg", True, -40)
    if nor and "Normal" in bsdf.inputs:
        nmap = nt.nodes.new("ShaderNodeNormalMap")
        nmap.location = (40, -40)
        nmap.inputs["Strength"].default_value = 0.85
        nt.links.new(nor.outputs["Color"], nmap.inputs["Color"])
        nt.links.new(nmap.outputs["Normal"], bsdf.inputs["Normal"])
    rough = img("rough.jpg", True, -280)
    if rough and "Roughness" in bsdf.inputs:
        nt.links.new(rough.outputs["Color"], bsdf.inputs["Roughness"])
    elif "Roughness" in bsdf.inputs:
        bsdf.inputs["Roughness"].default_value = 0.86
    return mat


def assign(ob, mat):
    if ob.data.materials:
        ob.data.materials[0] = mat
    else:
        ob.data.materials.append(mat)
    for p in ob.data.polygons:
        p.use_smooth = True


def uv_smart(ob):
    bpy.context.view_layer.objects.active = ob
    ob.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(angle_limit=66, island_margin=0.02)
    bpy.ops.object.mode_set(mode="OBJECT")
    ob.select_set(False)


def column(col, name, x, y, h, r=0.32, broken=0.0):
    z = h * 0.5
    bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=r, depth=h, location=(x, y, z))
    shaft = bpy.context.active_object
    shaft.name = name
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=12, radius=r * 1.28, depth=0.18, location=(x, y, h + 0.05 - broken)
    )
    cap = bpy.context.active_object
    cap.name = name + "Cap"
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=12, radius=r * 1.22, depth=0.16, location=(x, y, 0.08)
    )
    base = bpy.context.active_object
    base.name = name + "Base"
    mat = stone_mat()
    out = []
    for ob, hh in ((shaft, h), (cap, 0.18), (base, 0.16)):
        assign(ob, mat)
        uv_smart(ob)
        link_col(ob, col)
        out.append(ob)
    if broken > 0.15:
        cap.location.z = h - broken * 0.5
        cap.rotation_euler.x = 0.35
        cap.rotation_euler.y = 0.2
        shaft.scale.z = max(0.35, 1.0 - broken / max(h, 0.1))
        bpy.context.view_layer.objects.active = shaft
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return out


def arch(col, name, x, y, span=3.1, h=3.6, r=0.3):
    column(col, name + "L", x - span * 0.5, y, h, r=r, broken=0.0)
    column(col, name + "R", x + span * 0.5, y, h * 0.72, r=r, broken=0.85)
    bpy.ops.mesh.primitive_cube_add(size=1, location=(x - 0.25, y, h + 0.12))
    lintel = bpy.context.active_object
    lintel.name = name + "Lintel"
    lintel.scale = (span * 0.42, 0.38, 0.28)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    lintel.rotation_euler.z = 0.08
    assign(lintel, stone_mat())
    uv_smart(lintel)
    link_col(lintel, col)
    return lintel


def rubble(col, name, x, y, s=0.7):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=s, location=(x, y, s * 0.35))
    ob = bpy.context.active_object
    ob.name = name
    ob.scale = (1.4, 1.1, 0.45)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    assign(ob, stone_mat())
    uv_smart(ob)
    link_col(ob, col)
    return ob


def slab_path(col, name, y0, y1, w=1.15):
    length = abs(y1 - y0)
    mid = (y0 + y1) * 0.5
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0.0, mid, 0.04))
    ob = bpy.context.active_object
    ob.name = name
    ob.scale = (w, length, 0.06)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    assign(ob, stone_mat())
    uv_smart(ob)
    link_col(ob, col)
    return ob


def look_plate(col):
    if not os.path.exists(PLATE):
        return None
    img = bpy.data.images.load(PLATE, check_existing=True)
    empty = bpy.data.objects.new("RuinsLookPlate", None)
    empty.empty_display_type = "IMAGE"
    empty.data = img
    empty.empty_display_size = 7.5
    empty.location = (0.0, 11.2, 3.6)
    empty.rotation_euler = (math.radians(90), 0.0, math.radians(180))
    empty.hide_render = True
    col.objects.link(empty)
    return empty


object_mode()
bpy.ops.object.select_all(action="DESELECT")
col = wipe_collection(COL_NAME)
mat = stone_mat()

slab_path(col, "RuinPath", -1.2, -8.6)
column(col, "RuinCol_W0", -2.35, -1.9, 4.1, r=0.34, broken=0.0)
column(col, "RuinCol_W1", -2.55, -4.4, 3.2, r=0.30, broken=1.1)
column(col, "RuinCol_W2", -2.2, -7.0, 4.6, r=0.36, broken=0.4)
column(col, "RuinCol_E0", 2.45, -2.4, 3.8, r=0.32, broken=0.7)
column(col, "RuinCol_E1", 2.65, -5.2, 4.4, r=0.35, broken=0.0)
column(col, "RuinCol_E2", 2.3, -7.6, 2.6, r=0.28, broken=1.4)
arch(col, "RuinArch_Path", 0.0, -3.35, span=3.2, h=3.5, r=0.29)
# Distant stubs toward the plate (north) — silhouette only.
column(col, "RuinCol_N0", -3.8, 6.4, 6.2, r=0.42, broken=0.3)
column(col, "RuinCol_N1", 3.6, 6.8, 5.4, r=0.38, broken=1.6)
column(col, "RuinCol_N2", 0.4, 8.1, 7.0, r=0.46, broken=0.8)
rubble(col, "RuinRubble_0", -1.6, -6.5, 0.55)
rubble(col, "RuinRubble_1", 1.8, -8.1, 0.7)
rubble(col, "RuinRubble_2", -3.1, -3.1, 0.48)
look_plate(col)

print("RUINS_START", COL_NAME, len(col.objects), "mat", mat.name)
