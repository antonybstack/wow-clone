"""Render the refitted garments over the shape family for hem review.

  /Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup \
    --python scripts/character-assets/review_garment_fit.py

The fit measurement counts body vertices left outside their garment. It cannot see whether
the hem that now covers them still reads as cloth, which is the thing the hem pass can get
wrong: it stretches the last band of an existing hem rather than adding polygons, so the
failure mode is a smeared, over-long skirt rather than bare skin.
"""
import math
import os
import sys

import bpy

ASSETS = [
    ('.cache/character-mmo/m004/human-shape-family-v1.glb', 'body', (0.62, 0.55, 0.50, 1.0)),
    ('.cache/character-mmo/m005/wayfarerTunic.glb', 'tunic', (0.34, 0.27, 0.21, 1.0)),
    ('.cache/character-mmo/m005/wayfarerTrousers.glb', 'trousers', (0.26, 0.20, 0.16, 1.0)),
]
SHOTS = 've-capture/character-mmo/m005/garments'
SHAPES = {'neutral': {}, 'slender': {'slender': 1.0}, 'stout': {'stout': 1.0}}
RES = 900


def main():
    bpy.ops.wm.read_homefile(use_empty=True)
    meshes = []
    for filepath, label, colour in ASSETS:
        before = {o.name for o in bpy.data.objects}
        bpy.ops.import_scene.gltf(filepath=os.path.abspath(filepath))
        added = [o for o in bpy.data.objects if o.name not in before and o.type == 'MESH']
        shaped = [o for o in added if o.data.shape_keys is not None]
        for obj in added:
            if obj not in shaped:
                bpy.data.objects.remove(obj, do_unlink=True)
        if not shaped:
            print(f'FAIL: no shaped mesh in {filepath}', file=sys.stderr)
            sys.exit(1)
        for obj in shaped:
            obj.color = colour
            meshes.append(obj)
            print(f'{label}: {obj.name} {len(obj.data.vertices)} verts')

    scene = bpy.context.scene
    scene.render.engine = 'BLENDER_WORKBENCH'
    scene.render.resolution_x = RES
    scene.render.resolution_y = RES
    scene.display.shading.light = 'STUDIO'
    scene.display.shading.color_type = 'OBJECT'
    scene.world = bpy.data.worlds.new('review')
    scene.world.color = (0.07, 0.07, 0.08)

    cam_data = bpy.data.cameras.new('review')
    cam_data.type = 'ORTHO'
    cam_data.ortho_scale = 1.5
    cam = bpy.data.objects.new('review', cam_data)
    scene.collection.objects.link(cam)
    scene.camera = cam

    os.makedirs(SHOTS, exist_ok=True)
    for shape, weights in SHAPES.items():
        for obj in meshes:
            for block in obj.data.shape_keys.key_blocks:
                block.value = weights.get(block.name, 0.0)
        for view, yaw in (('front', 0.0), ('side', math.pi / 2), ('back', math.pi)):
            cam.location = (math.sin(yaw) * 4.0, -math.cos(yaw) * 4.0, 0.95)
            cam.rotation_euler = (math.pi / 2, 0.0, yaw)
            scene.render.filepath = os.path.abspath(os.path.join(SHOTS, f'{shape}-{view}.png'))
            bpy.ops.render.render(write_still=True)
    print(f'rendered into {SHOTS}')


main()
