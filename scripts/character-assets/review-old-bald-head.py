"""Offline M006 source-fit experiment, deliberately not a playable character asset.

It cuts the fused Tripo head at 1.50 m and fits the CC0 MakeHuman old Caucasian male
head/texture to the same bounding box. The three-angle render exposes the face/neck/eye
quality cost before anyone spends time retargeting or promoting a replacement head.
The authored Human reference must remain the visual authority.

  /Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup \
    --python scripts/character-assets/review-old-bald-head.py

MakeHuman system assets: https://static.makehumancommunity.org/assets/assetpacks/makehuman_system_assets.html
Blender glTF import: https://docs.blender.org/manual/en/latest/addons/import_export/scene_gltf2.html
"""
from pathlib import Path
import hashlib
import json
import sys

import bpy
import bmesh
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(Path(__file__).resolve().parent))
import mh_io  # noqa: E402
import mh_studio  # noqa: E402

SRC = ROOT / 'blender/characters/sources'
SKIN = ROOT / '.cache/character-mmo/m006/old_lightskinned_male_diffuse.png'
BLEND = ROOT / '.cache/character-mmo/m006/old-bald-fit.blend'
REVIEW = ROOT / 've-capture/character-mmo/m006/old-bald-fit'

record = json.loads((ROOT / 'blender/characters/candidates/hair/m006-provenance.json').read_text())['diagnosticOldHeadSkin']
if not SKIN.is_file() or hashlib.sha256(SKIN.read_bytes()).hexdigest() != record['sha256']:
    raise ValueError('Old skin source missing or unpinned; run fetch-makehuman.py')

bpy.ops.wm.read_homefile(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(ROOT / 'public/ashen-reach/equipment/body.glb'))
body = bpy.data.objects['HumanV1Body']
armature = body.parent

# The cut is intentionally crude. This is a source comparison, not a seam solution.
bm = bmesh.new()
bm.from_mesh(body.data)
remove = [face for face in bm.faces if face.calc_center_median().z > 150]
bmesh.ops.delete(bm, geom=remove, context='FACES')
bm.to_mesh(body.data)
bm.free()

source, uvs, faces = mh_io.load_obj(SRC / 'base.obj')
mh_io.apply_target(source, SRC / 'caucasian-male-old.target')
source_blender, _ = mh_io.mh_coords_to_blender(source)
# Match the old source top (1.718 m) and neck cut (1.50 m) to the Tripo 1.76 m top.
# +Y is behind the head in Blender; its 6 cm shift matches the active face depth.
fit = [(v[0] * 110 + 0.3, v[1] * 105 + 6.0, (v[2] - 1.50) * 119 + 150)
       for v in source_blender]
loops = [corners for group, corners in faces if group == 'body'
         and all(source_blender[i][2] > 1.50 for i, _ in corners)]
head = mh_studio.build_mesh('OldBaldHeadDiagnostic', fit, uvs, loops)
head.parent = armature
head.matrix_parent_inverse = body.matrix_parent_inverse.copy()
head.data.materials.append(mh_studio.mat_pbr('OldSkinDiagnostic', albedo_path=SKIN,
                                             rough=.7, specular=.2))
for face in head.data.polygons:
    face.use_smooth = True

BLEND.parent.mkdir(parents=True, exist_ok=True)
REVIEW.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=str(BLEND))
scene = bpy.context.scene
scene.render.engine = 'BLENDER_EEVEE'
scene.render.resolution_x = scene.render.resolution_y = 800
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.world = bpy.data.worlds.new('ReviewWorld')
scene.world.color = (.2, .2, .2)
camera_data = bpy.data.cameras.new('ReviewCamera')
camera = bpy.data.objects.new('ReviewCamera', camera_data)
scene.collection.objects.link(camera)
scene.camera = camera
camera_data.type = 'ORTHO'
camera_data.ortho_scale = 1.12
for name, loc, energy, size in [('key', (-2, -3, 3), 550, 3),
                               ('fill', (2, -1, 2), 220, 3),
                               ('rim', (0, 3, 3), 350, 2)]:
    data = bpy.data.lights.new(name, 'AREA')
    data.energy = energy
    data.shape = 'DISK'
    data.size = size
    light = bpy.data.objects.new(name, data)
    scene.collection.objects.link(light)
    light.location = loc
    light.rotation_euler = (Vector((0, 0, 1.48)) - light.location).to_track_quat('-Z', 'Y').to_euler()
for name, loc in [('front', (0, -3, 1.48)), ('side', (3, 0, 1.48)),
                  ('back', (0, 3, 1.48))]:
    camera.location = loc
    camera.rotation_euler = (Vector((0, 0, 1.47)) - camera.location).to_track_quat('-Z', 'Y').to_euler()
    scene.render.filepath = str(REVIEW / f'{name}.png')
    bpy.ops.render.render(write_still=True)
print('old bald source fit: original body faces', len(body.data.polygons),
      'replacement head faces', len(head.data.polygons), 'review', REVIEW)
