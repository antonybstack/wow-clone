"""Attempt the M006 long-hair asset on the Human rig. NOT ACCEPTED -- see the M006 gate report.

Status: this script runs, exports, and does not produce a usable asset. It is kept because
it records what was tried and what the next attempt should not repeat, not because its
output ships. `docs/plans/character-mmo/results/m006-gate.md` has the reviewed renders.

  /Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup \
    --python scripts/character-assets/build_long_hair.py

M001 found no verified long-hair source for this head: the one staged candidate, mhair02,
carries an AGPL3 header in its own file despite a community CC0 listing. So the asset is
authored from geometry this project already owns -- the Human's own occiput -- which makes
its provenance the body's.

Long hair is additive, which is why it is possible at all. `measure-hair-separability.mjs`
shows the shipped hair is fused into the skull surface and cannot be removed by a morph;
adding a separate mesh on the same 65-joint rig asks nothing of the head.

The mass is generated as a fresh grid around a measured head ellipsoid, not cut from the
body's own scalp. Cutting from the scalp was tried first and the sculpted locks fragmented
the region into nine pieces, which extruded as separate sheets with a gap down the back of
the head. A grid is one connected surface by construction and owes the body nothing but its
measurements.

That fixed the fragmentation and did not produce hair. The grid reads as a flared sleeve
standing off the skull: it does not sit on the crown, it does not part, and it does not
taper. Shaping it further means judging silhouette against the head from several angles and
adjusting, which is a viewport task. Driving it blind through parameters -- arc, flare,
drop, a cap falloff -- converged on a cone, not a hairstyle. The next attempt should sculpt
this in a Blender session against the actual head rather than script it.

Weighting is a three-bone blend down the length -- Head at the crown, Neck through the
nape, Spine2 at the ends -- so the mass follows the head where it is attached and the torso
where it hangs, without a simulation. That is the whole interaction policy: the strand
tracks the spine, so a turn of the head sweeps the top and barely moves the tips.

`--factory-startup` and an explicit empty homefile keep this out of any live session.
https://docs.blender.org/manual/en/latest/modeling/modifiers/generate/solidify.html
"""
import math
import os
import sys

import bpy
import bmesh
from mathutils import Vector

SOURCE = 'public/ashen-reach/equipment/body.glb'
OUT = '.cache/character-mmo/m006/long-hair-v1.glb'
BLEND = 'blender/characters/long-hair-v1.blend'
MESH_NAME = 'HumanLongHair'
BODY_HEIGHT_M = 1.76

STANDOFF_M = 0.010     # off the scalp
THICKNESS_M = 0.008
SEGMENTS = 7           # extrusions down the back
DROP_M = 0.055         # per segment
FLARE = 0.055          # outward sweep accumulated down the length


def fail(message):
    print(f'FAIL: {message}', file=sys.stderr)
    sys.exit(1)


def main():
    bpy.ops.wm.read_homefile(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=os.path.abspath(SOURCE))
    body = next((o for o in bpy.data.objects if o.type == 'MESH' and o.name.startswith('HumanV1Body')), None)
    armature = next((o for o in bpy.data.objects if o.type == 'ARMATURE'), None)
    if body is None or armature is None:
        fail('imported file has no body mesh or no armature')

    zs = [v.co.z for v in body.data.vertices]
    unit = (max(zs) - min(zs)) / BODY_HEIGHT_M
    if not 0.1 < unit < 1000:
        fail(f'implausible unit scale {unit}')
    print(f'local height {max(zs) - min(zs):.2f} -> {unit:.2f} units/m')

    # Measure the head the hair has to sit on: centre and radii of the skull above the brow.
    head_verts = [v.co for v in body.data.vertices if v.co.z > 1.615 * unit]
    if len(head_verts) < 50:
        fail(f'only {len(head_verts)} head vertices above the brow')
    cx = sum(v.x for v in head_verts) / len(head_verts)
    cy = sum(v.y for v in head_verts) / len(head_verts)
    cz = sum(v.z for v in head_verts) / len(head_verts)
    rx = max(abs(v.x - cx) for v in head_verts)
    ry = max(abs(v.y - cy) for v in head_verts)
    rz = max(abs(v.z - cz) for v in head_verts)
    print(f'head centre ({cx:.2f},{cy:.2f},{cz:.2f}) radii ({rx:.2f},{ry:.2f},{rz:.2f})')

    mesh_data = bpy.data.meshes.new(MESH_NAME)
    hair = bpy.data.objects.new(MESH_NAME, mesh_data)
    bpy.context.scene.collection.objects.link(hair)
    hair.matrix_world = body.matrix_world.copy()

    bm = bmesh.new()
    standoff = STANDOFF_M * unit
    # A grid in (angle around the head, distance down the strand). `arc` spans the back and
    # sides and stops short of the face, so the fringe and the brow stay visible.
    COLUMNS = 17
    ROWS = SEGMENTS + 4
    arc = math.radians(232.0)
    grid = []
    for row in range(ROWS):
        t = row / (ROWS - 1)
        ring = []
        for col in range(COLUMNS):
            a = -arc / 2 + arc * col / (COLUMNS - 1)
            # Around the skull at the top; falling straight and flaring below it.
            cap = math.cos(min(1.0, t * 1.35) * math.pi / 2)
            spread = 1.0 + FLARE * t
            x = cx + math.sin(a) * (rx + standoff) * spread * (0.55 + 0.45 * cap)
            # +Y is behind the head in this asset's local space: the first version used -Y
            # and hung the whole mass in front of the face.
            y = cy + math.cos(a) * (ry + standoff) * (0.55 + 0.45 * cap) + 0.010 * unit * t
            z = cz + (rz + standoff) * cap - (DROP_M * unit * SEGMENTS) * max(0.0, t - 0.32) / 0.68
            ring.append(bm.verts.new((x, y, z)))
        grid.append(ring)
    bm.verts.ensure_lookup_table()
    for row in range(ROWS - 1):
        for col in range(COLUMNS - 1):
            bm.faces.new((grid[row][col], grid[row][col + 1], grid[row + 1][col + 1], grid[row + 1][col]))
    bm.normal_update()
    bm.to_mesh(mesh_data)
    bm.free()

    solidify = hair.modifiers.new('shell', 'SOLIDIFY')
    solidify.thickness = THICKNESS_M * unit
    solidify.offset = 1.0
    smooth = hair.modifiers.new('smooth', 'SMOOTH')
    smooth.factor = 0.4
    smooth.iterations = 2
    bpy.context.view_layer.objects.active = hair
    for name in ('shell', 'smooth'):
        bpy.ops.object.modifier_apply(modifier=name)

    # Three-bone blend down the length: Head at the crown, Spine2 at the tips.
    hair.vertex_groups.clear()
    groups = {name: hair.vertex_groups.new(name=name)
              for name in ('mixamorig:Head', 'mixamorig:Neck', 'mixamorig:Spine2')}
    top = max(v.co.z for v in hair.data.vertices)
    bottom = min(v.co.z for v in hair.data.vertices)
    span = max(1e-6, top - bottom)
    for v in hair.data.vertices:
        t = 1.0 - (v.co.z - bottom) / span       # 0 at the crown, 1 at the tips
        head_w = max(0.0, 1.0 - 2.0 * t)
        tail_w = max(0.0, 2.0 * t - 1.0)
        neck_w = max(0.0, 1.0 - head_w - tail_w)
        total = head_w + neck_w + tail_w
        groups['mixamorig:Head'].add([v.index], head_w / total, 'REPLACE')
        groups['mixamorig:Neck'].add([v.index], neck_w / total, 'REPLACE')
        groups['mixamorig:Spine2'].add([v.index], tail_w / total, 'REPLACE')

    material = bpy.data.materials.new(MESH_NAME)
    material.use_nodes = True
    principled = next(n for n in material.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    principled.inputs['Base Color'].default_value = (0.09, 0.06, 0.05, 1.0)
    principled.inputs['Roughness'].default_value = 0.55
    principled.inputs['Metallic'].default_value = 0.0
    hair.data.materials.clear()
    hair.data.materials.append(material)

    bpy.data.objects.remove(body, do_unlink=True)
    bpy.ops.object.select_all(action='DESELECT')
    hair.select_set(True)
    armature.select_set(True)
    bpy.context.view_layer.objects.active = hair

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    os.makedirs(os.path.dirname(BLEND), exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(BLEND))
    bpy.ops.export_scene.gltf(filepath=os.path.abspath(OUT), export_format='GLB',
                              use_selection=True, export_animations=False,
                              export_skins=True, export_morph=False, export_apply=False)
    print(f'wrote {OUT} and {BLEND}: {len(hair.data.vertices)} vertices, {len(hair.data.polygons)} faces')


main()
