"""Review a separate CC0 old/bald head with source eyes and a fitted neck rim.

This remains an offline source-fit diagnostic. The shipped Human stays intact.
MakeHuman source: https://github.com/makehumancommunity/makehuman
Blender glTF import: https://docs.blender.org/manual/en/latest/addons/import_export/scene_gltf2.html
"""
from pathlib import Path
import hashlib
import json
import math
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
REVIEW = ROOT / 've-capture/character-mmo/m006/old-bald-fit-v2'
REVIEW.mkdir(parents=True, exist_ok=True)

record = json.loads((ROOT / 'blender/characters/candidates/hair/m006-provenance.json').read_text())['diagnosticOldHeadSkin']
if hashlib.sha256(SKIN.read_bytes()).hexdigest() != record['sha256']:
    raise ValueError('Old skin source does not match its pinned hash')

bpy.ops.wm.read_homefile(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(ROOT / '.cache/character-mmo/m004/human-shape-family-v1.glb'))
body = bpy.data.objects['HumanV1Body']
armature = body.parent
print('shape keys before', [key.name for key in body.data.shape_keys.key_blocks] if body.data.shape_keys else [])

# Cut the old sculpted head at the lower neck. The source head's boundary is
# matched to this contour before export so the two surfaces have no open gap.
bm = bmesh.new()
bm.from_mesh(body.data)
bmesh.ops.bisect_plane(bm, geom=list(bm.verts) + list(bm.edges) + list(bm.faces),
                       dist=.0001, plane_co=(0, 0, 150), plane_no=(0, 0, 1),
                       clear_outer=True)
cut = [e for e in bm.edges if e.is_boundary and abs(e.verts[0].co.z - 150) < .001
       and abs(e.verts[1].co.z - 150) < .001]
body_rim = {v: tuple(v.co) for edge in cut for v in edge.verts}
bm.to_mesh(body.data)
bm.free()
print('shape keys after', [key.name for key in body.data.shape_keys.key_blocks] if body.data.shape_keys else [])

source, uvs, faces = mh_io.load_obj(SRC / 'base.obj')
mh_io.apply_target(source, SRC / 'caucasian-male-old.target')
blender_source, ground = mh_io.mh_coords_to_blender(source)

def fit(v):
    return (v[0] * 133 + .3, v[1] * 105 + 11, (v[2] - 1.50) * 119 + 150)

fitted = [fit(v) for v in blender_source]
loops = [corners for group, corners in faces if group == 'body'
         and all(fitted[i][2] > 142 for i, _ in corners)]
head = mh_studio.build_mesh('OldBaldHeadV2Diagnostic', fitted, uvs, loops)
bm = bmesh.new()
bm.from_mesh(head.data)
bmesh.ops.bisect_plane(bm, geom=list(bm.verts) + list(bm.edges) + list(bm.faces),
                       dist=.0001, plane_co=(0, 0, 151), plane_no=(0, 0, 1),
                       clear_inner=True)
source_rim = [e for e in bm.edges if e.is_boundary and abs(e.verts[0].co.z - 151) < .001
              and abs(e.verts[1].co.z - 151) < .001]
body_cx = sum(p[0] for p in body_rim.values()) / len(body_rim)
body_cy = sum(p[1] for p in body_rim.values()) / len(body_rim)
body_ordered = sorted(body_rim.values(),
                      key=lambda p: math.atan2(p[1] - body_cy, p[0] - body_cx))
body_angles = [math.atan2(p[1] - body_cy, p[0] - body_cx) for p in body_ordered]
for vert in {v for edge in source_rim for v in edge.verts}:
    angle = math.atan2(vert.co.y - body_cy, vert.co.x - body_cx)
    if angle < body_angles[0]:
        angle += 2 * math.pi
    for k in range(len(body_angles)):
        angle_a = body_angles[k]
        angle_b = body_angles[(k + 1) % len(body_angles)] + (2 * math.pi if k + 1 == len(body_angles) else 0)
        if angle_a <= angle <= angle_b:
            a, b = body_ordered[k], body_ordered[(k + 1) % len(body_ordered)]
            t = (angle - angle_a) / (angle_b - angle_a)
            vert.co = ((1 - t) * a[0] + t * b[0], (1 - t) * a[1] + t * b[1], 150)
            break
bm.to_mesh(head.data)
bm.free()
head.parent = armature
head.matrix_parent_inverse = body.matrix_parent_inverse.copy()
head.data.materials.append(mh_studio.mat_pbr('OldSkinDiagnostic', albedo_path=SKIN,
                                             rough=.7, specular=.2))
for face in head.data.polygons:
    face.use_smooth = True

# The MakeHuman source body intentionally excludes the eye proxies. Fit and
# shade its own CC0 low-poly globes rather than leaving red empty sockets.
proxy = mh_io.load_mhclo(SRC / 'low-poly.mhclo')
eye_src, eye_uvs, eye_faces = mh_io.load_obj(SRC / 'low-poly.obj')
eye_mh = mh_io.fit_proxy(source, proxy)
if len(eye_mh) != len(eye_src):
    raise ValueError('Eye proxy vertex count changed')
eye_bl, _ = mh_io.mh_coords_to_blender(eye_mh, zmin=ground)
eyes = mh_studio.build_mesh('OldBaldEyesDiagnostic', [fit(v) for v in eye_bl],
                            eye_uvs, mh_io.obj_loops(eye_faces))
eye_tex = ROOT / '.cache/character-mmo/m006/old-eye-albedo.png'
mh_studio.write_eye_albedo(SRC / 'brown_eye.png', eye_tex)
eyes.data.materials.append(mh_studio.mat_pbr('OldEyeDiagnostic', albedo_path=eye_tex,
                                             rough=.15, specular=.7, double_sided=True))
eyes.parent = armature
eyes.matrix_parent_inverse = body.matrix_parent_inverse.copy()
for face in eyes.data.polygons:
    face.use_smooth = True

# Bind the separate variant to the imported 65-joint rig. The lower head rim
# inherits the nearest neck weights from the actual body cut; over the next
# 10 cm it eases to Head. This preserves the shoulder/neck blend in motion.
head_bone = next(b.name for b in armature.data.bones if b.name.endswith(':Head'))
rim_vertices = [v for v in body.data.vertices if abs(v.co.z - 150) < .001]
if len(rim_vertices) < 20:
    raise ValueError('Body neck rim lost its skinned boundary')

def weights_at_body_vertex(vertex):
    return {body.vertex_groups[g.group].name: g.weight for g in vertex.groups}

head_weights = []
for vertex in head.data.vertices:
    if vertex.co.z >= 160:
        head_weights.append([(head_bone, 1.0)])
        continue
    closest = min(rim_vertices, key=lambda v: (v.co.x - vertex.co.x) ** 2
                  + (v.co.y - vertex.co.y) ** 2)
    blend = max(0.0, min(1.0, (vertex.co.z - 150) / 10))
    weights = {name: value * (1 - blend) for name, value in weights_at_body_vertex(closest).items()}
    weights[head_bone] = weights.get(head_bone, 0) + blend
    total = sum(weights.values())
    head_weights.append([(name, value / total) for name, value in weights.items() if value > 1e-5])
mh_studio.assign_weights(head, head_weights)
mh_studio.assign_weights(eyes, [[(head_bone, 1.0)] for _ in eyes.data.vertices])
for obj in (head, eyes):
    modifier = obj.modifiers.new('Armature', 'ARMATURE')
    modifier.object = armature
    modifier.use_vertex_groups = True

scene = bpy.context.scene
scene.render.engine = 'BLENDER_EEVEE'
scene.render.resolution_x = scene.render.resolution_y = 800
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.world = bpy.data.worlds.new('ReviewWorld')
scene.world.color = (.2, .2, .2)
camera_data = bpy.data.cameras.new('ReviewCamera')
camera_data.type = 'ORTHO'
camera_data.ortho_scale = .57
camera = bpy.data.objects.new('ReviewCamera', camera_data)
scene.collection.objects.link(camera)
scene.camera = camera
target = Vector((0, 0, 1.55))
for name, loc, energy in [('key', (-1.5, -2, 2.6), 350),
                          ('fill', (1.5, -1, 2.1), 140),
                          ('rim', (0, 2, 2.2), 200)]:
    light_data = bpy.data.lights.new(name, 'AREA')
    light_data.energy = energy
    light_data.shape = 'DISK'
    light_data.size = 2.0
    light = bpy.data.objects.new(name, light_data)
    scene.collection.objects.link(light)
    light.location = loc
    light.rotation_euler = (target - light.location).to_track_quat('-Z', 'Y').to_euler()
for name, loc in [('front', (0, -2, 1.55)), ('side', (2, 0, 1.55)),
                  ('back', (0, 2, 1.55))]:
    camera.location = loc
    camera.rotation_euler = (target - camera.location).to_track_quat('-Z', 'Y').to_euler()
    scene.render.filepath = str(REVIEW / f'{name}.png')
    bpy.ops.render.render(write_still=True)
print('old bald v2', 'body rim', len(cut), 'source rim', len(source_rim),
      'head faces', len(head.data.polygons), 'eye faces', len(eyes.data.polygons), REVIEW)

OUT = ROOT / '.cache/character-mmo/m006/human-old-bald-raw.glb'
bpy.ops.object.select_all(action='DESELECT')
for obj in (armature, body, head, eyes):
    obj.select_set(True)
bpy.context.view_layer.objects.active = armature
bpy.ops.export_scene.gltf(filepath=str(OUT), use_selection=True, export_format='GLB',
                          export_yup=True, export_animations=True,
                          export_animation_mode='ACTIONS', export_skins=True,
                          export_all_influences=False, export_materials='EXPORT',
                          export_cameras=False, export_lights=False,
                          export_texcoords=True, export_normals=True)
print('old bald candidate', OUT, OUT.stat().st_size)
