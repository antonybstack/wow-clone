"""Offline front/side/back inspection of the texture-derived scalp cut candidate.

The red faces are the connected dark-texture component from inspect-human-scalp.mjs.
No shipped asset is modified. Blender glTF import:
https://docs.blender.org/manual/en/latest/addons/import_export/scene_gltf2.html
"""
from pathlib import Path
import sys
import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
INPUT = ROOT / '.cache/character-mmo/m006/scalp-classifier-110.glb'
OUT = ROOT / 've-capture/character-mmo/m006/scalp-classifier-110'
OUT.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.read_homefile(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(INPUT))
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
print('review', OUT)
