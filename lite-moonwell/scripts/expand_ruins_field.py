"""Scale the starting zone past the gated hamlet fence.

- Hide Fence* / HamletKerb (export is use_visible).
- Add a large tiled RuinFloor.
- Seeded linked-duplicate ruin kits from 12m to 68m so fog eats the horizon
  before any wall. This is kit scatter, not a proc-gen world engine.

Does not delete Ground / Dummy / WellGlow. Re-run wipes only RuinField.
"""
import math
import os

import bpy

ROOT = "/Users/antbly/dev/wow-clone/lite-moonwell"
TEX_GROUND = os.path.join(ROOT, "public", "tex", "forrest_ground_01")
TEX_ROCK = os.path.join(ROOT, "public", "tex", "rock_wall_08")
FIELD = "RuinField"
FLOOR_SIZE = 160.0
RING_INNER = 12.0
RING_OUTER = 68.0
SEED = 7

SHRINE = ("Ground", "Dummy", "WellGlow")
if not all(n in bpy.data.objects for n in SHRINE):
    raise RuntimeError("Shrine not live. Open blender/moonwell.blend.")


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


def pbr(name, folder, uv=(8, 8, 8), tint=(1, 1, 1)):
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
        mix.inputs["Factor"].default_value = 0.75
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
        bsdf.inputs["Roughness"].default_value = 0.88
    return mat


def hide_gate():
    n = 0
    for ob in bpy.data.objects:
        name = ob.name
        if name.startswith(("FencePost", "FenceWall", "HamletKerb", "FenceGate")):
            ob.hide_set(True)
            ob.hide_viewport = True
            ob.hide_render = True
            n += 1
    return n


def make_proto(col, mat):
    bpy.ops.mesh.primitive_cylinder_add(vertices=10, radius=0.36, depth=1.0, location=(0, 0, -40))
    shaft = bpy.context.active_object
    shaft.name = "RuinProtoCol"
    shaft.data.name = "RuinProtoColMesh"
    shaft.data.materials.append(mat)
    for p in shaft.data.polygons:
        p.use_smooth = True
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, -42))
    wall = bpy.context.active_object
    wall.name = "RuinProtoWall"
    wall.data.name = "RuinProtoWallMesh"
    wall.data.materials.append(mat)
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=0.55, location=(0, 0, -44))
    pile = bpy.context.active_object
    pile.name = "RuinProtoRubble"
    pile.data.name = "RuinProtoRubbleMesh"
    pile.data.materials.append(mat)
    for ob in (shaft, wall, pile):
        ob.hide_render = True
        ob.hide_viewport = True
        link_col(ob, col)
    return shaft, wall, pile


def stamp(proto, col, name, loc, scale, rot_z=0.0, visible=True):
    ob = proto.copy()
    ob.data = proto.data
    ob.name = name
    ob.location = loc
    ob.scale = scale
    ob.rotation_euler = (0.0, 0.0, rot_z)
    ob.hide_render = not visible
    ob.hide_viewport = not visible
    link_col(ob, col)
    return ob


object_mode()
bpy.ops.object.select_all(action="DESELECT")
hidden = hide_gate()
col = wipe_collection(FIELD)
rock = pbr("RuinFieldStone", TEX_ROCK, uv=(2.2, 2.2, 2.2), tint=(0.55, 0.58, 0.62))
dirt = pbr("RuinFloorMat", TEX_GROUND, uv=(28, 28, 28), tint=(0.35, 0.38, 0.32))

bpy.ops.mesh.primitive_plane_add(size=FLOOR_SIZE, location=(0.0, 0.0, -0.09))
floor = bpy.context.active_object
floor.name = "RuinFloor"
floor.data.materials.append(dirt)
link_col(floor, col)

proto_col, proto_wall, proto_rubble = make_proto(col, rock)

n_col = 0
for i in range(72):
    t = hash01(i, 0)
    a = hash01(i, 1) * math.pi * 2
    r = RING_INNER + (RING_OUTER - RING_INNER) * math.sqrt(t)
    x = math.cos(a) * r
    y = math.sin(a) * r
    h = 2.6 + hash01(i, 2) * 5.5
    n_col += 1
    stamp(
        proto_col,
        col,
        f"RuinFieldCol_{i:02d}",
        (x, y, h * 0.5),
        (0.85 + hash01(i, 3) * 0.5, 0.85 + hash01(i, 4) * 0.4, h),
        rot_z=hash01(i, 5) * 0.4,
    )

n_wall = 0
for i in range(18):
    t = hash01(i, 10)
    a = hash01(i, 11) * math.pi * 2
    r = 18 + 42 * math.sqrt(t)
    x = math.cos(a) * r
    y = math.sin(a) * r
    w = 2.4 + hash01(i, 12) * 3.2
    d = 0.55
    h = 2.2 + hash01(i, 13) * 3.8
    n_wall += 1
    stamp(
        proto_wall,
        col,
        f"RuinFieldWall_{i:02d}",
        (x, y, h * 0.5),
        (w, d, h),
        rot_z=a + math.pi * 0.5 + (hash01(i, 14) - 0.5) * 0.6,
    )

n_rub = 0
for i in range(24):
    t = hash01(i, 20)
    a = hash01(i, 21) * math.pi * 2
    r = 14 + 50 * math.sqrt(t)
    x = math.cos(a) * r
    y = math.sin(a) * r
    s = 0.7 + hash01(i, 22) * 1.4
    n_rub += 1
    stamp(
        proto_rubble,
        col,
        f"RuinFieldRubble_{i:02d}",
        (x, y, s * 0.28),
        (s * 1.6, s * 1.2, s * 0.45),
        rot_z=hash01(i, 23) * 6.2,
    )

print(
    "RUIN_FIELD",
    "hidden_fence",
    hidden,
    "cols",
    n_col,
    "walls",
    n_wall,
    "rubble",
    n_rub,
    "floor",
    FLOOR_SIZE,
    "objects",
    len(col.objects),
)
