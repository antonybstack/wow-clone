"""Render the M005 rigid plate over the three body shapes for silhouette review.

  /Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup \
    --python scripts/character-assets/review_plate_rigidity.py

The measurement in `measure-plate-rigidity.mjs` is the proof that the plate does not deform;
this is the look. Body, refitted tunic and the plate are loaded together and rendered at
neutral, slender and stout, front and side, so the cloth can be seen following the body
while the plate keeps its shape and rides outward.
"""
import math
import os
import sys

import bpy

ASSETS = [
    ('.cache/character-mmo/m004/human-shape-family-v1.glb', 'body'),
    ('.cache/character-mmo/m005/wayfarerTunic.glb', 'tunic'),
    ('.cache/character-mmo/m005/warden-pauldrons-shaped.glb', 'plate'),
]
SHOTS = 've-capture/character-mmo/m005/plate'
SHAPES = {'neutral': {}, 'slender': {'slender': 1.0}, 'stout': {'stout': 1.0}}
RES = 900


def fail(message):
    print(f'FAIL: {message}', file=sys.stderr)
    sys.exit(1)


def main():
    bpy.ops.wm.read_homefile(use_empty=True)
    meshes = []
    for filepath, label in ASSETS:
        before = {o.name for o in bpy.data.objects}
        bpy.ops.import_scene.gltf(filepath=os.path.abspath(filepath))
        added = [o for o in bpy.data.objects if o.name not in before and o.type == 'MESH']
        if not added:
            fail(f'{label}: nothing imported from {filepath}')
        # The importer also materialises helper geometry for some glTF features; only the
        # shaped meshes are the subject here, and anything else is removed so it cannot
        # wander into frame.
        shaped = [o for o in added if o.data.shape_keys is not None]
        for obj in added:
            if obj in shaped:
                continue
            print(f'{label}: dropping helper object {obj.name}')
            bpy.data.objects.remove(obj, do_unlink=True)
        if not shaped:
            fail(f'{label}: no mesh with shape keys in {filepath}')
        for obj in shaped:
            meshes.append((label, obj))
            print(f'{label}: {obj.name} {len(obj.data.vertices)} verts, '
                  f'keys {[k.name for k in obj.data.shape_keys.key_blocks]}')

    scene = bpy.context.scene
    scene.render.engine = 'BLENDER_WORKBENCH'
    scene.render.resolution_x = RES
    scene.render.resolution_y = RES
    scene.display.shading.light = 'STUDIO'
    scene.display.shading.color_type = 'OBJECT'
    scene.world = bpy.data.worlds.new('review')
    scene.world.color = (0.07, 0.07, 0.08)
    for label, obj in meshes:
        obj.color = {'body': (0.62, 0.55, 0.50, 1.0),
                     'tunic': (0.35, 0.28, 0.22, 1.0),
                     'plate': (0.75, 0.78, 0.85, 1.0)}[label]

    cam_data = bpy.data.cameras.new('review')
    cam_data.type = 'ORTHO'
    cam_data.ortho_scale = 1.05
    cam = bpy.data.objects.new('review', cam_data)
    scene.collection.objects.link(cam)
    scene.camera = cam

    os.makedirs(SHOTS, exist_ok=True)
    written = 0
    for shape, weights in SHAPES.items():
        for _, obj in meshes:
            for block in obj.data.shape_keys.key_blocks:
                block.value = weights.get(block.name, 0.0)
        for view, yaw in (('front', 0.0), ('side', math.pi / 2)):
            radius = 4.0
            # Framed on the shoulders, which is where the plate is.
            cam.location = (math.sin(yaw) * radius, -math.cos(yaw) * radius, 1.40)
            cam.rotation_euler = (math.pi / 2, 0.0, yaw)
            scene.render.filepath = os.path.abspath(os.path.join(SHOTS, f'{shape}-{view}.png'))
            bpy.ops.render.render(write_still=True)
            written += 1
    print(f'rendered {written} stills into {SHOTS}')


main()
