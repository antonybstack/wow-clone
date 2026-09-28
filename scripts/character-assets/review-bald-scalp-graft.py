"""Offline M006 bald scalp graft experiment, preserving the shipped face and eyes.

This is deliberately a source-fit review, not a playable or accepted asset.
The licensed MakeHuman young scalp supplies actual skin geometry where the
current Tripo head has only sculpted hair. The active face/neck stay in place.
MakeHuman source: https://github.com/makehumancommunity/makehuman
Blender mesh editing: https://docs.blender.org/api/current/bmesh.ops.html
"""
from pathlib import Path
import sys
import math

import bpy
import bmesh
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(Path(__file__).resolve().parent))
import mh_io  # noqa: E402
import mh_studio  # noqa: E402

SOURCE = ROOT / 'blender/characters/sources'
OUT = ROOT / 've-capture/character-mmo/m006/bald-scalp-graft'
OUT.mkdir(parents=True, exist_ok=True)

def cut_height(y):
    # Blender +Y is the back of this head. A normal hairline rises over the
    # forehead and falls at the nape; one horizontal cut made the rejected
    # whole-head source swap visibly jagged across the face and neck.
    return 160 - 6 * math.tanh((y - 4) / 6)

bpy.ops.wm.read_homefile(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(ROOT / 'public/ashen-reach/equipment/body.glb'))
body = bpy.data.objects['HumanV1Body']
armature = body.parent
skin_material = body.data.materials[0]

bm = bmesh.new()
bm.from_mesh(body.data)
remove = [face for face in bm.faces if face.calc_center_median().z > cut_height(face.calc_center_median().y)]
bmesh.ops.delete(bm, geom=remove, context='FACES')
bm.to_mesh(body.data)
bm.free()

source, uvs, faces = mh_io.load_obj(SOURCE / 'base.obj')
mh_io.apply_target(source, SOURCE / 'caucasian-male-young.target')
source_blender, _ = mh_io.mh_coords_to_blender(source)
fit = [(v[0] * 110 + .3, v[1] * 105 + 6, (v[2] - 1.50) * 119 + 150)
       for v in source_blender]
loops = [corners for group, corners in faces if group == 'body'
         and sum(fit[i][2] - cut_height(fit[i][1]) for i, _ in corners) / len(corners) > 0]
cap = mh_studio.build_mesh('HairlessScalpDiagnostic', fit, uvs, loops)
cap.parent = armature
cap.matrix_parent_inverse = body.matrix_parent_inverse.copy()
cap.data.materials.append(skin_material)
# Sample a clean patch of the *same* skin texture rather than using the
# MakeHuman UV atlas on the game's unrelated body atlas. This is flat-color
# diagnostic shading; a final scalp needs continuous authored UV/texture.
for uvloop in cap.data.uv_layers.active.data:
    uvloop.uv = (.18, .91)
for face in cap.data.polygons:
    face.use_smooth = True

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
for name, loc in [('front', (0, -2, 1.63)), ('side', (2, 0, 1.63)),
                  ('back', (0, 2, 1.63))]:
    camera.location = loc
    camera.rotation_euler = (target - camera.location).to_track_quat('-Z', 'Y').to_euler()
    scene.render.filepath = str(OUT / f'{name}.png')
    bpy.ops.render.render(write_still=True)
print('removed faces', len(remove), 'cap faces', len(cap.data.polygons), 'review', OUT)
