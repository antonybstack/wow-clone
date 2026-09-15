"""Second world-build pass: hamlet becomes a ruin plaza in a larger dead city.

- Hide cozy lodges/huts (do not delete Ground / Dummy / WellGlow).
- Drop the floating path lintel.
- Seeded avenue of paired columns + connected arches down -Y into the fog.
- Fallen columns and wall runs as street fabric.

Re-run wipes only collection RuinCity.
"""
import math
import os

import bpy

ROOT = "/Users/antbly/dev/wow-clone/lite-moonwell"
TEX_ROCK = os.path.join(ROOT, "public", "tex", "rock_wall_08")
CITY = "RuinCity"
SEED = 11

SHRINE = ("Ground", "Dummy", "WellGlow")
if not all(n in bpy.data.objects for n in SHRINE):
    raise RuntimeError("Shrine not live. Open blender/moonwell.blend.")

HIDE = (
    "TrainerHut",
    "Storehouse",
    "LodgeEast",
    "LodgeNorth",
    "LodgeWest",
)


def object_mode():
    if bpy.ops.object.mode_set.poll():
        bpy.ops.object.mode_set(mode="OBJECT")


def hash01(i, k):
    s = math.sin((i + 1) * 127.1 + (k + 3) * 311.7 + SEED * 0.17) * 43758.5453
    return s - math.floor(s)


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


def hide_named(names):
    n = 0
    for name in names:
        ob = bpy.data.objects.get(name)
        if not ob:
            continue
        ob.hide_set(True)
        ob.hide_viewport = True
        ob.hide_render = True
        n += 1
    for ob in bpy.data.objects:
        if ob.name.startswith(("Lantern", "Shroom")) and ob.type == "MESH":
            ob.hide_set(True)
            ob.hide_viewport = True
            ob.hide_render = True
            n += 1
    lintel = bpy.data.objects.get("RuinArch_PathLintel")
    if lintel:
        lintel.location = (-0.4, -3.1, 0.22)
        lintel.rotation_euler = (0.15, 1.15, 0.4)
    return n


def rock_mat():
    mat = bpy.data.materials.get("RuinCityStone")
    if mat:
        return mat
    mat = bpy.data.materials.new("RuinCityStone")
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    texc = nt.nodes.new("ShaderNodeTexCoord")
    mapping = nt.nodes.new("ShaderNodeMapping")
    mapping.inputs["Scale"].default_value = (2.0, 2.0, 2.0)
    nt.links.new(texc.outputs["UV"], mapping.inputs["Vector"])
    diff_path = os.path.join(TEX_ROCK, "diff.jpg")
    if os.path.exists(diff_path):
        img = nt.nodes.new("ShaderNodeTexImage")
        img.image = bpy.data.images.load(diff_path, check_existing=True)
        nt.links.new(mapping.outputs["Vector"], img.inputs["Vector"])
        mix = nt.nodes.new("ShaderNodeMix")
        mix.data_type = "RGBA"
        mix.blend_type = "MULTIPLY"
        mix.inputs["Factor"].default_value = 0.8
        mix.inputs["B"].default_value = (0.48, 0.50, 0.55, 1)
        nt.links.new(img.outputs["Color"], mix.inputs["A"])
        nt.links.new(mix.outputs["Result"], bsdf.inputs["Base Color"])
    nor_path = os.path.join(TEX_ROCK, "nor.jpg")
    if os.path.exists(nor_path) and "Normal" in bsdf.inputs:
        nimg = nt.nodes.new("ShaderNodeTexImage")
        nimg.image = bpy.data.images.load(nor_path, check_existing=True)
        nimg.image.colorspace_settings.name = "Non-Color"
        nt.links.new(mapping.outputs["Vector"], nimg.inputs["Vector"])
        nmap = nt.nodes.new("ShaderNodeNormalMap")
        nmap.inputs["Strength"].default_value = 0.75
        nt.links.new(nimg.outputs["Color"], nmap.inputs["Color"])
        nt.links.new(nmap.outputs["Normal"], bsdf.inputs["Normal"])
    if "Roughness" in bsdf.inputs:
        bsdf.inputs["Roughness"].default_value = 0.9
    return mat


def proto(col, mat):
    bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=0.38, depth=1.0, location=(0, 0, -60))
    colm = bpy.context.active_object
    colm.name = "RuinCityProtoCol"
    colm.data.name = "RuinCityProtoColMesh"
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, -62))
    wall = bpy.context.active_object
    wall.name = "RuinCityProtoWall"
    wall.data.name = "RuinCityProtoWallMesh"
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, -64))
    lintel = bpy.context.active_object
    lintel.name = "RuinCityProtoLintel"
    lintel.data.name = "RuinCityProtoLintelMesh"
    bpy.ops.mesh.primitive_cylinder_add(vertices=10, radius=0.34, depth=1.0, location=(0, 0, -66))
    cap = bpy.context.active_object
    cap.name = "RuinCityProtoCap"
    cap.data.name = "RuinCityProtoCapMesh"
    for ob in (colm, wall, lintel, cap):
        if not ob.data.materials:
            ob.data.materials.append(mat)
        for p in ob.data.polygons:
            p.use_smooth = True
        ob.hide_render = True
        ob.hide_viewport = True
        link_col(ob, col)
    return colm, wall, lintel, cap


def stamp(proto_ob, col, name, loc, scale, rot=(0.0, 0.0, 0.0)):
    ob = proto_ob.copy()
    ob.data = proto_ob.data
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
hidden = hide_named(HIDE)
col = wipe_collection(CITY)
mat = rock_mat()
pcol, pwall, plintel, pcap = proto(col, mat)

# Plaza ring around the well (keep basin visible).
for i in range(6):
    a = i / 6 * math.pi * 2 + 0.22
    r = 4.4
    h = 3.2 + hash01(i, 1) * 1.8
    stamp(
        pcol,
        col,
        f"RuinPlazaCol_{i}",
        (math.cos(a) * r, math.sin(a) * r, h * 0.5),
        (1.0, 1.0, h),
        (0, 0, a),
    )
    stamp(
        pcap,
        col,
        f"RuinPlazaCap_{i}",
        (math.cos(a) * r, math.sin(a) * r, h + 0.08),
        (1.25, 1.25, 0.18),
        (0, 0, a),
    )

# Avenue south into the fog — paired columns + real lintels.
SPAN = 3.4
n_arch = 0
for i in range(9):
    y = -12.0 - i * 7.2
    h_l = 3.6 + hash01(i, 2) * 1.4
    h_r = 3.3 + hash01(i, 3) * 1.6
    stamp(pcol, col, f"RuinAveL_{i}", (-SPAN * 0.5, y, h_l * 0.5), (1.05, 1.05, h_l))
    stamp(pcap, col, f"RuinAveLCap_{i}", (-SPAN * 0.5, y, h_l + 0.08), (1.3, 1.3, 0.18))
    stamp(pcol, col, f"RuinAveR_{i}", (SPAN * 0.5, y, h_r * 0.5), (1.0, 1.0, h_r))
    stamp(pcap, col, f"RuinAveRCap_{i}", (SPAN * 0.5, y, h_r + 0.08), (1.28, 1.28, 0.18))
    if i % 2 == 0:
        lh = min(h_l, h_r) + 0.12
        stamp(
            plintel,
            col,
            f"RuinAveLintel_{i}",
            (0.0, y, lh),
            (SPAN + 0.35, 0.48, 0.32),
        )
        n_arch += 1
    else:
        # Fallen member beside the road.
        side = -1 if i % 4 == 1 else 1
        stamp(
            pcol,
            col,
            f"RuinAveFallen_{i}",
            (side * 4.6, y + 1.2, 0.34),
            (0.95, 0.95, 4.2),
            (0.0, math.pi * 0.5, 0.35 * side),
        )

# Cross-streets: wall runs with gaps so the player is not boxed in.
n_wall = 0
for i, y in enumerate((-18.0, -32.0, -46.0)):
    for side, x0 in ((-1, -14.0), (1, 6.5)):
        w = 7.5 + hash01(i, 20 + side) * 3.0
        h = 2.8 + hash01(i, 21 + side) * 2.2
        stamp(
            pwall,
            col,
            f"RuinStreet_{i}_{side}",
            (x0 + side * w * 0.25, y, h * 0.5),
            (w, 0.55, h),
            (0, 0, 0.05 * side),
        )
        n_wall += 1

# Broken facade silhouettes left/right of the avenue (reads as city, not posts).
n_facade = 0
for i in range(8):
    side = -1 if i % 2 == 0 else 1
    y = -16.0 - i * 5.5
    x = side * (9.5 + hash01(i, 30) * 4.0)
    w = 3.2 + hash01(i, 31) * 2.8
    h = 4.0 + hash01(i, 32) * 3.5
    stamp(
        pwall,
        col,
        f"RuinFacade_{i}",
        (x, y, h * 0.5),
        (w, 0.7, h),
        (0, 0, math.pi * 0.5 + 0.12 * side),
    )
    n_facade += 1

print(
    "RUIN_CITY",
    "hidden",
    hidden,
    "arches",
    n_arch,
    "walls",
    n_wall,
    "facades",
    n_facade,
    "objects",
    len(col.objects),
)
