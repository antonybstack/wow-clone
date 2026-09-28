"""Offline M006 experiment: transfer a CC0 young→old face delta to the active Human.

The source and game head have different topology. Fit the licensed MakeHuman young
surface to the game's head frame, then interpolate the source *delta*, not a new
face, so the neutral game character and its eyes/identity remain the control.
This renders a diagnostic shape key only; it does not publish a creator age.

MakeHuman source assets: https://github.com/makehumancommunity/makehuman
Blender shape keys: https://docs.blender.org/manual/en/latest/animation/shape_keys/introduction.html
"""
from pathlib import Path
import math
import sys

import bpy
from mathutils import Vector
from mathutils.kdtree import KDTree

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(Path(__file__).resolve().parent))
import mh_io  # noqa: E402

SOURCE = ROOT / 'blender/characters/sources'
OUT = ROOT / 've-capture/character-mmo/m006/age-transfer'
OUT.mkdir(parents=True, exist_ok=True)

bpy.ops.wm.read_homefile(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(ROOT / 'public/ashen-reach/equipment/body.glb'))
body = bpy.data.objects['HumanV1Body']

base, _, faces = mh_io.load_obj(SOURCE / 'base.obj')
young = [v.copy() for v in base]
old = [v.copy() for v in base]
mh_io.apply_target(young, SOURCE / 'caucasian-male-young.target')
mh_io.apply_target(old, SOURCE / 'caucasian-male-old.target')
young_bl, ground = mh_io.mh_coords_to_blender(young)
old_bl, _ = mh_io.mh_coords_to_blender(old, zmin=ground)

# This is the same bounded head frame as review-old-bald-head.py, applied to both
# ages so only the age delta moves the game's existing vertices. It remains a
# diagnostic registration, not a reusable cross-race fit.
def fit(v):
    return Vector((v[0] * 110 + .3, v[1] * 105 + 6, (v[2] - 1.50) * 119 + 150))

surface = set()
for group, corners in faces:
    if group == 'body':
        surface.update(i for i, _ in corners)
source_ids = [i for i in surface if young_bl[i][2] > 1.47 and young_bl[i][1] < .055]
tree = KDTree(len(source_ids))
deltas = {}
for k, i in enumerate(source_ids):
    a, b = fit(young_bl[i]), fit(old_bl[i])
    tree.insert(a, k)
    deltas[k] = b - a
tree.balance()

body.shape_key_add(name='Basis')
age = body.shape_key_add(name='AdultOld')
stats = []
for vertex in body.data.vertices:
    p = vertex.co
    # Preserve the scalp, eyes and neck. The adult-face field eases out at the
    # hairline/back and the neck, so no disconnected source-head seam can appear.
    height = min(1.0, max(0.0, (p.z - 149) / 9))
    depth = min(1.0, max(0.0, (11 - p.y) / 8))
    weight = height * height * (3 - 2 * height) * depth * depth * (3 - 2 * depth)
    if weight <= 0:
        continue
    neighbours = tree.find_n(p, 6)
    if not neighbours:
        continue
    nearest = neighbours[0][2]
    # Cross-topology nearest matches become unsafe beyond this reach; retaining
    # the neutral face there is preferable to inventing an unrelated old face.
    reach = min(1.0, max(0.0, (9 - nearest) / 5))
    if reach <= 0:
        continue
    total = 0.0
    displacement = Vector((0, 0, 0))
    for _, index, distance in neighbours:
        w = 1 / (1 + distance * distance)
        displacement += deltas[index] * w
        total += w
    displacement *= weight * reach / total
    magnitude = displacement.length
    if magnitude > 1.5:
        displacement *= 1.5 / magnitude
    age.data[vertex.index].co = p + displacement
    stats.append((vertex.index, magnitude, nearest, weight))

age.value = 0
scene = bpy.context.scene
scene.render.engine = 'BLENDER_EEVEE'
scene.render.resolution_x = scene.render.resolution_y = 800
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.world = bpy.data.worlds.new('ReviewWorld')
scene.world.color = (.25, .25, .25)
camera_data = bpy.data.cameras.new('ReviewCamera')
camera_data.type = 'ORTHO'
camera_data.ortho_scale = .57
camera = bpy.data.objects.new('ReviewCamera', camera_data)
scene.collection.objects.link(camera)
scene.camera = camera
target = Vector((0, 0, 1.63))
for name, loc, energy in [('key', (-1.5, -2.0, 2.5), 350),
                          ('fill', (1.5, -1.2, 2.2), 140),
                          ('rim', (0, 2, 2.2), 200)]:
    data = bpy.data.lights.new(name, 'AREA')
    data.energy = energy
    data.shape = 'DISK'
    data.size = 2.0
    light = bpy.data.objects.new(name, data)
    scene.collection.objects.link(light)
    light.location = loc
    light.rotation_euler = (target - light.location).to_track_quat('-Z', 'Y').to_euler()
for label, amount, loc in [('neutral-front', 0, (0, -2, 1.63)),
                           ('old-front', 1, (0, -2, 1.63)),
                           ('old-side', 1, (2, 0, 1.63)),
                           ('old-back', 1, (0, 2, 1.63))]:
    age.value = amount
    camera.location = loc
    camera.rotation_euler = (target - camera.location).to_track_quat('-Z', 'Y').to_euler()
    scene.render.filepath = str(OUT / f'{label}.png')
    bpy.ops.render.render(write_still=True)

print('source vertices', len(source_ids), 'transferred', len(stats),
      'mean delta cm', sum(s[1] for s in stats) / len(stats),
      'max delta cm', max(s[1] for s in stats),
      'max nearest cm', max(s[2] for s in stats), 'review', OUT)
