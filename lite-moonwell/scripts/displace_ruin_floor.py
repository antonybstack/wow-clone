"""Give RuinFloor walkable height: flat plaza + avenue, hills in the field.

Does not delete Ground / Dummy / WellGlow. Replaces RuinFloor mesh data only.
"""
import math

import bpy
import bmesh

SHRINE = ("Ground", "Dummy", "WellGlow")
if not all(n in bpy.data.objects for n in SHRINE):
    raise RuntimeError("Shrine not live. Open blender/moonwell.blend.")

SIZE = 160.0
SUBS = 72
PLAZA_R = 7.5
PATH_X = 2.6


def height(x, y):
    r = math.hypot(x, y)
    plaza = 0.0 if r < PLAZA_R else min(1.0, (r - PLAZA_R) / 14.0)
    path = 0.12 if (y < 3.0 and abs(x) < PATH_X) else 1.0
    n = (
        0.55 * math.sin(x * 0.09) * math.cos(y * 0.08)
        + 0.40 * math.sin((x + y) * 0.06)
        + 0.28 * math.cos(x * 0.15 - y * 0.05)
    )
    ridge = 0.35 * math.sin(r * 0.14)
    return plaza * path * (1.15 * n + ridge)


if bpy.ops.object.mode_set.poll():
    bpy.ops.object.mode_set(mode="OBJECT")

old = bpy.data.objects.get("RuinFloor")
mat = None
col = None
if old:
    mat = old.data.materials[0] if old.data.materials else None
    for c in old.users_collection:
        col = c
        break
    bpy.data.objects.remove(old, do_unlink=True)

bpy.ops.mesh.primitive_grid_add(
    x_subdivisions=SUBS,
    y_subdivisions=SUBS,
    size=SIZE,
    location=(0.0, 0.0, 0.0),
)
floor = bpy.context.active_object
floor.name = "RuinFloor"
floor.data.name = "RuinFloorMesh"
if mat:
    floor.data.materials.append(mat)
if col and floor.name not in col.objects:
    col.objects.link(floor)
    scene = bpy.context.scene.collection
    if floor.name in scene.objects:
        scene.objects.unlink(floor)

bm = bmesh.new()
bm.from_mesh(floor.data)
zmin = 1e9
zmax = -1e9
for v in bm.verts:
    h = height(v.co.x, v.co.y)
    v.co.z = h
    zmin = min(zmin, h)
    zmax = max(zmax, h)
bm.to_mesh(floor.data)
bm.free()
floor.data.update()

print("RUIN_FLOOR", "subs", SUBS, "z", round(zmin, 3), round(zmax, 3), "verts", len(floor.data.vertices))
