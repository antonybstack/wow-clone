"""Street pass: stone avenue, darker rubble floor, broken torus arches.

Does not delete Ground / Dummy / WellGlow. Re-run wipes only RuinStreet.
Hides cube lintels from RuinCity so arches replace posts-with-beams.
"""
import math
import os

import bpy
from mathutils import Vector

ROOT = "/Users/antbly/dev/wow-clone/lite-moonwell"
TEX_ROCK = os.path.join(ROOT, "public", "tex", "rock_wall_08")
TEX_MUD = os.path.join(ROOT, "public", "tex", "brown_mud_leaves_01")
STREET = "RuinStreet"

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
    scene = bpy.context.scene.collection
    if ob.name not in col.objects:
        col.objects.link(ob)
    if ob.name in scene.objects:
        scene.objects.unlink(ob)


def pbr(name, folder, uv, tint):
    mat = bpy.data.materials.get(name)
    if mat:
        return mat
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    texc = nt.nodes.new("ShaderNodeTexCoord")
    mapping = nt.nodes.new("ShaderNodeMapping")
    mapping.inputs["Scale"].default_value = uv
    nt.links.new(texc.outputs["UV"], mapping.inputs["Vector"])
    diff_path = os.path.join(folder, "diff.jpg")
    if os.path.exists(diff_path):
        img = nt.nodes.new("ShaderNodeTexImage")
        img.image = bpy.data.images.load(diff_path, check_existing=True)
        nt.links.new(mapping.outputs["Vector"], img.inputs["Vector"])
        mix = nt.nodes.new("ShaderNodeMix")
        mix.data_type = "RGBA"
        mix.blend_type = "MULTIPLY"
        mix.inputs["Factor"].default_value = 0.82
        mix.inputs["B"].default_value = (*tint, 1)
        nt.links.new(img.outputs["Color"], mix.inputs["A"])
        nt.links.new(mix.outputs["Result"], bsdf.inputs["Base Color"])
    nor_path = os.path.join(folder, "nor.jpg")
    if os.path.exists(nor_path) and "Normal" in bsdf.inputs:
        nimg = nt.nodes.new("ShaderNodeTexImage")
        nimg.image = bpy.data.images.load(nor_path, check_existing=True)
        nimg.image.colorspace_settings.name = "Non-Color"
        nt.links.new(mapping.outputs["Vector"], nimg.inputs["Vector"])
        nmap = nt.nodes.new("ShaderNodeNormalMap")
        nmap.inputs["Strength"].default_value = 0.7
        nt.links.new(nimg.outputs["Color"], nmap.inputs["Color"])
        nt.links.new(nmap.outputs["Normal"], bsdf.inputs["Normal"])
    if "Roughness" in bsdf.inputs:
        bsdf.inputs["Roughness"].default_value = 0.9
    return mat


def assign(ob, mat):
    if ob.data.materials:
        ob.data.materials[0] = mat
    else:
        ob.data.materials.append(mat)


def hide_cube_lintels():
    n = 0
    for ob in bpy.data.objects:
        if "Lintel" in ob.name and ob.name.startswith("Ruin"):
            ob.hide_set(True)
            ob.hide_viewport = True
            ob.hide_render = True
            n += 1
    return n


def retint_floor(mud):
    floor = bpy.data.objects.get("RuinFloor")
    if floor:
        assign(floor, mud)
        return True
    return False


def make_arch_mesh(mat):
    """Two columns + upper torus half. One mesh for instancing."""
    bpy.ops.mesh.primitive_cylinder_add(vertices=10, radius=0.32, depth=3.5, location=(-1.7, 0.0, 1.75))
    left = bpy.context.active_object
    bpy.ops.mesh.primitive_cylinder_add(vertices=10, radius=0.32, depth=3.5, location=(1.7, 0.0, 1.75))
    right = bpy.context.active_object
    bpy.ops.mesh.primitive_torus_add(
        major_radius=1.7,
        minor_radius=0.22,
        major_segments=18,
        minor_segments=8,
        location=(0.0, 0.0, 3.5),
    )
    torus = bpy.context.active_object
    bpy.context.view_layer.objects.active = torus
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.bisect(plane_co=(0.0, 0.0, 3.5), plane_no=(0.0, 0.0, -1.0), clear_inner=True, clear_outer=False)
    bpy.ops.object.mode_set(mode="OBJECT")
    for ob in (left, right, torus):
        ob.select_set(True)
    bpy.context.view_layer.objects.active = left
    bpy.ops.object.join()
    arch = bpy.context.active_object
    arch.name = "RuinStreetProtoArch"
    arch.data.name = "RuinStreetProtoArchMesh"
    assign(arch, mat)
    for p in arch.data.polygons:
        p.use_smooth = True
    bpy.ops.object.origin_set(type="ORIGIN_GEOMETRY", center="MEDIAN")
    return arch


def stamp(proto, col, name, loc, scale=(1, 1, 1), rot=(0, 0, 0)):
    ob = proto.copy()
    ob.data = proto.data
    ob.name = name
    ob.location = loc
    ob.scale = scale
    ob.rotation_euler = rot
    ob.hide_render = False
    ob.hide_viewport = False
    link_col(ob, col)
    return ob


object_mode()
bpy.ops.object.select_all(action="DESELECT")
hid = hide_cube_lintels()
col = wipe_collection(STREET)
rock = pbr("RuinStreetStone", TEX_ROCK, (2.2, 2.2, 2.2), (0.5, 0.52, 0.56))
mud = pbr("RuinStreetMud", TEX_MUD, (22, 22, 22), (0.28, 0.26, 0.22))
retint_floor(mud)

# Stone avenue slabs south from the well.
n_slab = 0
for i in range(10):
    y = -4.0 - i * 5.6
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0.0, y, 0.05))
    slab = bpy.context.active_object
    slab.name = f"RuinStreetSlab_{i}"
    slab.scale = (2.35, 2.7, 0.08)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    assign(slab, rock)
    link_col(slab, col)
    n_slab += 1

arch = make_arch_mesh(rock)
arch.location = (0.0, 0.0, -80.0)
arch.hide_render = True
arch.hide_viewport = True
link_col(arch, col)

n_arch = 0
for i in range(6):
    y = -14.0 - i * 8.0
    s = 0.92 + (0.12 if i % 2 else 0.0)
    stamp(arch, col, f"RuinStreetArch_{i}", (0.0, y, 0.0), (s, 1.0, s), (0, 0, 0.04 * (i % 3 - 1)))
    n_arch += 1

# Broken / collapsed arch off-axis.
stamp(arch, col, "RuinStreetArchFallen", (6.2, -22.0, 1.1), (0.85, 0.85, 0.85), (1.15, 0.2, 0.4))

# Rubble along the avenue shoulders.
bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=0.5, location=(0, 0, -82))
pile = bpy.context.active_object
pile.name = "RuinStreetProtoRubble"
pile.data.name = "RuinStreetProtoRubbleMesh"
assign(pile, rock)
pile.hide_render = True
pile.hide_viewport = True
link_col(pile, col)

n_rub = 0
for i in range(16):
    side = -1 if i % 2 == 0 else 1
    y = -8.0 - i * 3.1
    x = side * (2.6 + (i % 5) * 0.35)
    s = 0.55 + (i % 4) * 0.18
    stamp(
        pile,
        col,
        f"RuinStreetRubble_{i}",
        (x, y, s * 0.22),
        (s * 1.5, s * 1.1, s * 0.4),
        (0.2, 0.1, i * 0.7),
    )
    n_rub += 1

print("RUIN_STREET", "hid_lintels", hid, "slabs", n_slab, "arches", n_arch, "rubble", n_rub, "floor", retint_floor(mud))
