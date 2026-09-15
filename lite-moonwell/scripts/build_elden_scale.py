"""Elden-scale pass: cliff plateau, chasm, giant keep on the ridge.

Look plates: blender/ref/elden-cliff.jpg, elden-castle.jpg
Does not delete Ground / Dummy / WellGlow. Wipes EldenScale + rebuilds RuinFloor.
"""
import math
import os

import bpy
import bmesh
from mathutils import Vector

ROOT = "/Users/antbly/dev/wow-clone/lite-moonwell"
TEX_ROCK = os.path.join(ROOT, "public", "tex", "rock_wall_08")
COL = "EldenScale"
SIZE = 160.0
SUBS = 88
CX, CY = 40.0, 20.0  # castle plateau center (Blender XY)

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
    diff = os.path.join(folder, "diff.jpg")
    if os.path.exists(diff):
        img = nt.nodes.new("ShaderNodeTexImage")
        img.image = bpy.data.images.load(diff, check_existing=True)
        nt.links.new(mapping.outputs["Vector"], img.inputs["Vector"])
        mix = nt.nodes.new("ShaderNodeMix")
        mix.data_type = "RGBA"
        mix.blend_type = "MULTIPLY"
        mix.inputs["Factor"].default_value = 0.78
        mix.inputs["B"].default_value = (*tint, 1)
        nt.links.new(img.outputs["Color"], mix.inputs["A"])
        nt.links.new(mix.outputs["Result"], bsdf.inputs["Base Color"])
    nor = os.path.join(folder, "nor.jpg")
    if os.path.exists(nor) and "Normal" in bsdf.inputs:
        nimg = nt.nodes.new("ShaderNodeTexImage")
        nimg.image = bpy.data.images.load(nor, check_existing=True)
        nimg.image.colorspace_settings.name = "Non-Color"
        nt.links.new(mapping.outputs["Vector"], nimg.inputs["Vector"])
        nmap = nt.nodes.new("ShaderNodeNormalMap")
        nmap.inputs["Strength"].default_value = 0.8
        nt.links.new(nimg.outputs["Color"], nmap.inputs["Color"])
        nt.links.new(nmap.outputs["Normal"], bsdf.inputs["Normal"])
    if "Roughness" in bsdf.inputs:
        bsdf.inputs["Roughness"].default_value = 0.88
    if "Metallic" in bsdf.inputs:
        bsdf.inputs["Metallic"].default_value = 0.04
    return mat


def height(x, y):
    r = math.hypot(x, y)
    plaza = 0.0 if r < 8.0 else min(1.0, (r - 8.0) / 9.0)
    d = math.hypot(x - CX, y - CY)
    if d < 14.0:
        plateau = 17.0 + 2.2 * (1.0 - d / 14.0)
    else:
        plateau = 19.0 * math.exp(-((d - 14.0) / 11.0) ** 2)
    # ramp from well toward castle
    vx, vy = CX, CY
    mag = math.hypot(vx, vy)
    t = (x * vx + y * vy) / (mag * mag) if mag > 1 else 0
    t = max(0.0, min(1.0, t))
    side = abs(x * vy - y * vx) / mag if mag > 1 else 99
    ramp = 0.0
    if t > 0.12 and side < 7.0:
        ramp = 16.5 * (t ** 1.15)
    chasm = 0.0
    if x < -10.0:
        chasm = -9.0 * min(1.0, (-10.0 - x) / 12.0)
    n = 1.4 * math.sin(x * 0.07) * math.cos(y * 0.06) + 0.8 * math.sin((x - y) * 0.05)
    h = plaza * (max(plateau, ramp) + n * 0.9 + chasm)
    return h


def rebuild_floor(mat, col):
    old = bpy.data.objects.get("RuinFloor")
    old_col = None
    if old:
        for c in old.users_collection:
            old_col = c
            break
        bpy.data.objects.remove(old, do_unlink=True)
    bpy.ops.mesh.primitive_grid_add(x_subdivisions=SUBS, y_subdivisions=SUBS, size=SIZE, location=(0, 0, 0))
    floor = bpy.context.active_object
    floor.name = "RuinFloor"
    floor.data.name = "RuinFloorMesh"
    if mat and not floor.data.materials:
        floor.data.materials.append(mat)
    target = old_col or col
    link_col(floor, target)
    bm = bmesh.new()
    bm.from_mesh(floor.data)
    zmin, zmax = 1e9, -1e9
    for v in bm.verts:
        h = height(v.co.x, v.co.y)
        v.co.z = h
        zmin = min(zmin, h)
        zmax = max(zmax, h)
    bm.to_mesh(floor.data)
    bm.free()
    floor.data.update()
    return floor, zmin, zmax


def sample_floor(floor, x, y):
    best_z, best_d = 0.0, 1e18
    mw = floor.matrix_world
    for v in floor.data.vertices:
        co = mw @ v.co
        d = (co.x - x) ** 2 + (co.y - y) ** 2
        if d < best_d:
            best_d = d
            best_z = co.z
    return best_z


def proto(col, mat, name, kind):
    if kind == "cyl":
        bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=1.0, depth=1.0, location=(0, 0, -120))
    else:
        bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, -122))
    ob = bpy.context.active_object
    ob.name = name
    ob.data.name = name + "Mesh"
    if not ob.data.materials:
        ob.data.materials.append(mat)
    for p in ob.data.polygons:
        p.use_smooth = kind == "cyl"
    ob.hide_render = True
    ob.hide_viewport = True
    link_col(ob, col)
    return ob


def stamp(p, col, name, loc, scale, rot=(0, 0, 0)):
    ob = p.copy()
    ob.data = p.data
    ob.name = name
    ob.location = loc
    ob.scale = scale
    ob.rotation_euler = rot
    ob.hide_render = False
    ob.hide_viewport = False
    link_col(ob, col)
    return ob


def hide_plaza_posts():
    n = 0
    for ob in bpy.data.objects:
        if ob.name.startswith(("RuinPlaza", "RuinFieldCol", "RuinFieldWall", "RuinFieldRubble")):
            dx = ob.location.x - CX
            dy = ob.location.y - CY
            if ob.name.startswith("RuinPlaza") or (dx * dx + dy * dy) < 26 * 26:
                ob.hide_set(True)
                ob.hide_viewport = True
                ob.hide_render = True
                n += 1
    return n


object_mode()
bpy.ops.object.select_all(action="DESELECT")
hid = hide_plaza_posts()
col = wipe_collection(COL)
stone = pbr("EldenCastleStone", TEX_ROCK, (3.2, 3.2, 3.2), (0.22, 0.22, 0.26))
cliff = pbr("EldenCliffRock", TEX_ROCK, (1.6, 1.6, 1.6), (0.32, 0.30, 0.28))
floor_mat = bpy.data.materials.get("RuinStreetMud") or stone
floor, zmin, zmax = rebuild_floor(floor_mat, col)

tower = proto(col, stone, "EldenProtoTower", "cyl")
wall = proto(col, stone, "EldenProtoWall", "cube")
keep = proto(col, stone, "EldenProtoKeep", "cube")
merlon = proto(col, stone, "EldenProtoMerlon", "cube")

base = sample_floor(floor, CX, CY)

# Keep mass — 22 x 18 x 28 sitting on the plateau.
stamp(keep, col, "EldenKeep", (CX, CY, base + 14.0), (22.0, 18.0, 28.0), (0, 0, 0.35))

# Four crown towers
towers = [
    ("EldenTower_SW", CX - 12.0, CY - 10.0, 52.0, 5.2),
    ("EldenTower_SE", CX + 11.0, CY - 9.5, 46.0, 4.6),
    ("EldenTower_NW", CX - 11.5, CY + 10.5, 58.0, 5.6),
    ("EldenTower_NE", CX + 12.5, CY + 9.0, 50.0, 5.0),
]
for name, x, y, h, rad in towers:
    z0 = sample_floor(floor, x, y)
    stamp(tower, col, name, (x, y, z0 + h * 0.5), (rad, rad, h))
    # merlons
    for k in range(8):
        a = k / 8 * math.pi * 2
        mx = x + math.cos(a) * (rad * 0.85)
        my = y + math.sin(a) * (rad * 0.85)
        stamp(merlon, col, f"{name}_M{k}", (mx, my, z0 + h + 1.1), (1.3, 1.3, 2.4), (0, 0, a))

# Curtain walls between towers (facing the well)
walls = [
    ("EldenWall_S", CX, CY - 11.5, 26.0, 3.2, 16.0, 0.0),
    ("EldenWall_W", CX - 13.0, CY, 22.0, 3.4, 14.0, math.pi * 0.5),
    ("EldenWall_E", CX + 13.2, CY, 20.0, 3.0, 13.0, math.pi * 0.5),
    ("EldenWall_N", CX + 1.0, CY + 11.8, 24.0, 3.2, 15.0, 0.12),
]
for name, x, y, w, d, h, rot in walls:
    z0 = sample_floor(floor, x, y)
    stamp(wall, col, name, (x, y, z0 + h * 0.5), (w, d, h), (0, 0, rot))

# Gatehouse facing the well (toward origin)
gx, gy = CX - 16.0, CY - 14.0
gz = sample_floor(floor, gx, gy)
stamp(keep, col, "EldenGate", (gx, gy, gz + 9.0), (10.0, 8.0, 18.0), (0, 0, 0.7))
stamp(tower, col, "EldenGateL", (gx - 5.5, gy - 3.0, gz + 14.0), (3.6, 3.6, 28.0))
stamp(tower, col, "EldenGateR", (gx + 3.2, gy - 5.2, gz + 13.0), (3.4, 3.4, 26.0))

# Cliff faces on the chasm side (west) — stacked rock slabs
n_cliff = 0
for i in range(10):
    x = -22.0 - (i % 3) * 3.5
    y = -8.0 + i * 6.5
    h = 8.0 + (i % 4) * 3.0
    z0 = sample_floor(floor, x, y)
    stamp(wall, col, f"EldenCliff_{i}", (x, y, z0 + h * 0.35), (7.0, 4.5, h), (0.15, 0.05, 0.4 * (i % 2)))
    n_cliff += 1

print(
    "ELDEN_SCALE",
    "hid",
    hid,
    "floor",
    round(zmin, 2),
    round(zmax, 2),
    "base",
    round(base, 2),
    "cliffs",
    n_cliff,
    "objects",
    len(col.objects),
)
