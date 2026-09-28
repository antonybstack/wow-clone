"""Isolated-Blender review of the M004 Human shape family.

Run headless:
  /Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup \
    --python scripts/character-assets/review_human_shape_family.py

It imports the candidate GLB that ``build-human-shape-family.mjs`` writes, asserts
the two morph targets arrived as shape keys with the expected names and vertex
count, saves ``blender/characters/human-shape-family-v1.blend`` as the editable
source project for later hand-sculpt refinement, and renders orthographic
front/side/back stills of the neutral, slender and stout shapes into
``ve-capture/character-mmo/m004/`` for silhouette review.

``--factory-startup`` and an explicit ``wm.read_homefile`` keep this out of any
live Blender session: the file is built from scratch and never touches the user's
scene. Shape keys are Blender's representation of glTF morph targets; the glTF 2.0
importer maps ``mesh.primitives[].targets`` onto key blocks named from
``mesh.extras.targetNames``.
https://docs.blender.org/manual/en/latest/animation/shape_keys/introduction.html
"""
import json
import math
import os
import sys

import bpy

GLB = '.cache/character-mmo/m004/human-shape-family-v1.glb'
BLEND = 'blender/characters/human-shape-family-v1.blend'
SHOTS = 've-capture/character-mmo/m004'
EXPECTED = ['slender', 'stout']
EXPECTED_VERTS = 3274
RES = 900


def fail(message):
    print(f'FAIL: {message}', file=sys.stderr)
    sys.exit(1)


def find_body():
    for obj in bpy.data.objects:
        if obj.type == 'MESH' and obj.name.startswith('HumanV1Body'):
            return obj
    for obj in bpy.data.objects:
        if obj.type == 'MESH':
            return obj
    return None


def main():
    bpy.ops.wm.read_homefile(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=os.path.abspath(GLB))

    body = find_body()
    if body is None:
        fail('no mesh imported')
    if len(body.data.vertices) != EXPECTED_VERTS:
        fail(f'{body.name} has {len(body.data.vertices)} vertices, expected {EXPECTED_VERTS}')
    keys = body.data.shape_keys
    if keys is None:
        fail('no shape keys: the morph targets did not survive import')
    names = [k.name for k in keys.key_blocks]
    print('shape keys:', names)
    for want in EXPECTED:
        if want not in names:
            fail(f'missing shape key {want}; have {names}')
    for block in keys.key_blocks:
        block.value = 0.0

    # Deltas measured back out of Blender, independently of the builder's own report.
    basis = keys.key_blocks[0]
    measured = {}
    for want in EXPECTED:
        block = keys.key_blocks[want]
        worst = 0.0
        moved = 0
        for i in range(len(body.data.vertices)):
            d = (block.data[i].co - basis.data[i].co).length
            worst = max(worst, d)
            if d > 1e-6:
                moved += 1
        measured[want] = {'maxDisplacement': round(worst, 6), 'movedVertices': moved}
    print('measured in Blender:', json.dumps(measured))

    armature = next((o for o in bpy.data.objects if o.type == 'ARMATURE'), None)
    print('armature:', armature.name if armature else None,
          'bones:', len(armature.data.bones) if armature else 0,
          'actions:', len(bpy.data.actions))

    os.makedirs(os.path.dirname(BLEND), exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(BLEND))
    print('saved', BLEND)

    # Flat orthographic silhouette shots. Workbench keeps this a shape review rather
    # than a lighting review; the game is the authority on materials and light.
    os.makedirs(SHOTS, exist_ok=True)
    scene = bpy.context.scene
    scene.render.engine = 'BLENDER_WORKBENCH'
    scene.render.resolution_x = RES
    scene.render.resolution_y = RES
    scene.render.film_transparent = False
    scene.display.shading.light = 'STUDIO'
    scene.display.shading.color_type = 'SINGLE'
    scene.display.shading.single_color = (0.62, 0.6, 0.58)
    scene.world = bpy.data.worlds.new('review')
    scene.world.color = (0.08, 0.08, 0.09)

    cam_data = bpy.data.cameras.new('review')
    cam_data.type = 'ORTHO'
    cam_data.ortho_scale = 2.1
    cam = bpy.data.objects.new('review', cam_data)
    scene.collection.objects.link(cam)
    scene.camera = cam

    views = {
        'front': (0.0, 0.0),
        'side': (0.0, math.pi / 2),
        'back': (0.0, math.pi),
    }
    shapes = {'neutral': {}, 'slender': {'slender': 1.0}, 'stout': {'stout': 1.0}}
    written = []
    for shape, weights in shapes.items():
        for block in keys.key_blocks:
            block.value = 0.0
        for name, value in weights.items():
            keys.key_blocks[name].value = value
        for view, (_, yaw) in views.items():
            radius = 4.0
            cam.location = (math.sin(yaw) * radius, -math.cos(yaw) * radius, 0.88)
            cam.rotation_euler = (math.pi / 2, 0.0, yaw)
            out = os.path.join(SHOTS, f'{shape}-{view}.png')
            scene.render.filepath = os.path.abspath(out)
            bpy.ops.render.render(write_still=True)
            written.append(out)
    print('rendered:', len(written), 'stills into', SHOTS)


main()
