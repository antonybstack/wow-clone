"""W1/W4: gate opening, extra spires, stone ramp to the keep.

Does not wipe EldenScale or delete Ground / Dummy / WellGlow.
Re-run wipes only EldenW1.
"""
import math
import os

import bpy

ROOT = "/Users/antbly/dev/wow-clone/lite-moonwell"
TEX_ROCK = os.path.join(ROOT, "public", "tex", "rock_wall_08")
CX, CY = 40.0, 20.0
GX, GY = CX - 16.0, CY - 14.0
COL = "EldenW1"

SHRINE = ("Ground", "Dummy", "WellGlow")
if not all(n in bpy.data.objects for n in SHRINE):
    raise RuntimeError("Shrine not live.")


def object_mode():
    if bpy.ops.object.mode_set.poll():
        bpy.ops.object.mode_set(mode="OBJECT")


def height(x, y):
    r = math.hypot(x, y)
    plaza = 0.0 if r < 8.0 else min(1.0, (r - 8.0) / 9.0)
    d = math.hypot(x - CX, y - CY)
    if d < 14.0:
        plateau = 17.0 + 2.2 * (1.0 - d / 14.0)
    else:
        plateau = 19.0 * math.exp(-((d - 14.0) / 11.0) ** 2)
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
    return plaza * (max(plateau, ramp) + n * 0.9 + chasm)


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


def hide(name):
    ob = bpy.data.objects.get(name)
    if not ob:
        return
    ob.hide_set(True)
    ob.hide_viewport = True
    ob.hide_render = True


def stamp_from(src_name, col, name, loc, scale, rot=(0, 0, 0)):
    src = bpy.data.objects.get(src_name)
    if not src:
        bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, -140))
        src = bpy.context.active_object
        src.name = src_name
    ob = src.copy()
    ob.data = src.data
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
col = wipe_collection(COL)

# Solid gate cube blocked the approach — hide it, leave a hole between gate towers.
hide("EldenGate")

# Extra spires so towers read taller than the keep.
gz = height(GX, GY)
stamp_from("EldenProtoTower", col, "EldenSpire_L", (GX - 8.5, GY - 1.5, gz + 36), (2.4, 2.4, 72))
stamp_from("EldenProtoTower", col, "EldenSpire_R", (GX + 6.5, GY - 4.0, gz + 33), (2.2, 2.2, 66))

# Gate lintel (arch bar) above the hole.
stamp_from("EldenProtoWall", col, "EldenGateLintel", (GX - 1.0, GY - 4.2, gz + 16.5), (12.0, 3.2, 4.5), (0, 0, 0.7))

# Stone ramp from plaza toward the gate (W4).
n_ramp = 0
for i in range(14):
    t = (i + 1) / 15.0
    x = GX * t
    y = GY * t
    z = height(x, y) + 0.12
    stamp_from(
        "EldenProtoWall",
        col,
        f"EldenRamp_{i}",
        (x, y, z),
        (3.4, 4.2, 0.22),
        (0, 0, math.atan2(GY, GX)),
    )
    n_ramp += 1

# Thin a few inner posts so the keep is visible from the well.
n_hid = 0
for ob in bpy.data.objects:
    if ob.name.startswith(("RuinPlaza", "RuinCol_N", "RuinFieldCol_0", "RuinFieldCol_1")):
        hide(ob.name)
        n_hid += 1

print("ELDEN_W1", "ramp", n_ramp, "hid_posts", n_hid, "gate_open", True)
