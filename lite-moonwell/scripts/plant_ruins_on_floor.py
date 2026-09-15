"""Snap visible Ruin* kits onto RuinFloor height. Ground is z=0 authored.

Does not move Ground / Dummy / WellGlow / Basin / Path / floor / protos.
"""
import bpy
from mathutils import Vector

SHRINE = ("Ground", "Dummy", "WellGlow")
if not all(n in bpy.data.objects for n in SHRINE):
    raise RuntimeError("Shrine not live. Open blender/moonwell.blend.")

floor = bpy.data.objects.get("RuinFloor")
if not floor:
    raise RuntimeError("RuinFloor missing")

verts = [floor.matrix_world @ v.co for v in floor.data.vertices]


def sample(x, y):
    best_z = 0.0
    best_d = 1e18
    for co in verts:
        d = (co.x - x) ** 2 + (co.y - y) ** 2
        if d < best_d:
            best_d = d
            best_z = co.z
    return best_z


skip = {
    "RuinFloor",
    "RuinFloorMesh",
    "RuinsLookPlate",
}
n = 0
for ob in bpy.data.objects:
    if ob.hide_viewport or ob.type != "MESH":
        continue
    if not ob.name.startswith("Ruin"):
        continue
    if ob.name in skip or "Proto" in ob.name:
        continue
    z = sample(ob.location.x, ob.location.y)
    # Origins are mesh-centered. Sit the bottom on the floor.
    ob.location.z = z + max(ob.dimensions.z * 0.5, 0.05)
    n += 1

print("PLANTED", n, "onto RuinFloor")
