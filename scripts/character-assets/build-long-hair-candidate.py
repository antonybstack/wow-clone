"""Fit a verified CC0 MakeHuman long-hair proxy to the active Human head for M006 review.

This is an asset candidate, not a creator control or shipped body replacement. It preserves
the source's authored topology, UVs and alpha texture, and uses the existing 65-joint armature.
The MakeHuman `.mhclo` mapping fits the proxy to a male-young hm08 source before a bounded
head-bounds alignment brings it onto the current Tripo head. Review the resulting silhouette
and motion before treating that alignment as a production fit.

  ASHEN_HAIR_STYLE=ponytail01 /Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup \
    --python scripts/character-assets/build-long-hair-candidate.py

MakeHuman proxy format: https://github.com/makehumancommunity/mpfb2/blob/master/docs/entities/clothes/mhclo.md
MakeHuman CC0 listing: https://static.makehumancommunity.org/assets/assetpacks/makehuman_system_assets.html
Blender glTF skins: https://docs.blender.org/manual/en/latest/addons/import_export/scene_gltf2.html
"""
from pathlib import Path
import hashlib
import json
import os
import sys

import bpy

sys.path.insert(0, str(Path(__file__).resolve().parent))
import mh_io
import mh_studio
import mh_hair

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'public/ashen-reach/equipment/body.glb'
MH = ROOT / 'blender/characters/sources'
STYLE = os.environ.get('ASHEN_HAIR_STYLE', 'long01')
assert STYLE in ('long01', 'ponytail01'), STYLE
TAIL_ONLY = os.environ.get('ASHEN_TAIL_ONLY') == '1'
assert not TAIL_ONLY or STYLE == 'ponytail01'
HAIR = ROOT / 'blender/characters/candidates/hair' / STYLE
PROVENANCE = ROOT / 'blender/characters/candidates/hair/m006-provenance.json'
VARIANT = STYLE + ('-tail' if TAIL_ONLY else '')
OUT = ROOT / '.cache/character-mmo/m006' / f'{VARIANT}-fitted.glb'
BLEND = ROOT / '.cache/character-mmo/m006' / f'{VARIANT}-fitted.blend'


def verify_source():
    manifest = json.loads(PROVENANCE.read_text())
    record = next(item for item in manifest['styles'] if item['id'] == STYLE)
    for item in record['files']:
        path = ROOT / item['path']
        if not path.is_file():
            raise FileNotFoundError(f'{path} missing; run scripts/character-assets/fetch-makehuman.py')
        found = hashlib.sha256(path.read_bytes()).hexdigest()
        if found != item['sha256']:
            raise ValueError(f'{path} SHA256 mismatch: {found} != {item["sha256"]}')


def bounds(points):
    return [(min(p[i] for p in points), max(p[i] for p in points)) for i in range(3)]


def midpoint(pair):
    return (pair[0] + pair[1]) * 0.5


bpy.ops.wm.read_homefile(use_empty=True)
verify_source()
bpy.ops.import_scene.gltf(filepath=str(SOURCE))
body = next(o for o in bpy.data.objects if o.type == 'MESH' and o.name.startswith('HumanV1Body'))
armature = body.parent
assert armature and armature.type == 'ARMATURE' and len(armature.data.bones) == 65

mh_body, _, _ = mh_io.load_obj(MH / 'base.obj')
mh_io.apply_target(mh_body, MH / 'caucasian-male-young.target')
proxy = mh_io.fit_proxy(mh_body, mh_io.load_mhclo(HAIR / f'{STYLE}.mhclo'))
obj_verts, uvs, faces = mh_io.load_obj(HAIR / f'{STYLE}.obj')
assert len(proxy) == len(obj_verts), f'{STYLE} proxy mapping and OBJ disagree'
mh_body_bl, ground = mh_io.mh_coords_to_blender(mh_body)
hair_bl, _ = mh_io.mh_coords_to_blender(proxy, zmin=ground)

# The imported glTF uses centimetre-local vertices under an armature scaled to metres.
# Keep the hair in that same mesh frame and clone the body's parenting/armature setup.
source_head = [v for v in mh_body_bl[:mh_io.BODY_VERTS] if v[2] > 1.6]
target_head = [v.co for v in body.data.vertices if v.co.z > 160]
assert len(source_head) > 100 and len(target_head) > 100
s = bounds(source_head)
t = bounds(target_head)
sx = (t[0][1] - t[0][0]) / (100 * (s[0][1] - s[0][0]))
sy = (t[1][1] - t[1][0]) / (100 * (s[1][1] - s[1][0]))
assert 0.65 < sx < 1.25 and 0.65 < sy < 1.25, (sx, sy)
source_cx, source_cy = midpoint(s[0]), midpoint(s[1])
target_cx, target_cy = midpoint(t[0]), midpoint(t[1])
source_top, target_top = s[2][1], t[2][1]
fit = [[(v[0] - source_cx) * 100 * sx + target_cx,
        (v[1] - source_cy) * 100 * sy + target_cy,
        (v[2] - source_top) * 100 + target_top]
       for v in hair_bl]
loops = mh_io.obj_loops(faces)
if TAIL_ONLY:
    # The current head already includes sculpted short hair. For this audition, retain
    # only the proxy behind the scalp; the boundary and tie need visual review.
    loops = [loop for loop in loops if sum(fit[c[0]][1] for c in loop) / len(loop) > 12.0]
hair = mh_studio.build_mesh(f'Human{STYLE.title()}', fit, uvs, loops)
hair.parent = armature
hair.matrix_parent_inverse = body.matrix_parent_inverse.copy()
mod = hair.modifiers.new('Armature', 'ARMATURE')
mod.object = armature
mod.use_vertex_groups = True

z_top = max(v[2] for v in fit)
z_bottom = min(v[2] for v in fit)
span = z_top - z_bottom
assert span > 25, span
groups = {name: hair.vertex_groups.new(name=name) for name in
          ('mixamorig:Head', 'mixamorig:Neck', 'mixamorig:Spine2')}
for vert in hair.data.vertices:
    phase = (z_top - vert.co.z) / span
    head_w = max(0.0, 1.0 - 2.0 * phase)
    spine_w = max(0.0, 2.0 * phase - 1.0)
    neck_w = max(0.0, 1.0 - head_w - spine_w)
    for bone, weight in (("mixamorig:Head", head_w), ("mixamorig:Neck", neck_w), ("mixamorig:Spine2", spine_w)):
        if weight > 0:
            groups[bone].add([vert.index], weight, 'REPLACE')

material = mh_studio.mat_pbr(f'Human{STYLE.title()}', albedo_path=HAIR / f'{STYLE}_diffuse.png',
                             alpha_clip=0.12, rough=0.72, specular=0.18, double_sided=True)
mh_hair.wire_export_mask(material, 0.12)
hair.data.materials.append(material)
for polygon in hair.data.polygons:
    polygon.use_smooth = True

OUT.parent.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=str(BLEND))
# Only the new mesh and the original armature leave this candidate export. The saved .blend
# keeps the reference body for follow-up fitting and hand edits.
bpy.ops.object.select_all(action='DESELECT')
hair.select_set(True)
armature.select_set(True)
bpy.context.view_layer.objects.active = hair
bpy.ops.export_scene.gltf(filepath=str(OUT), export_format='GLB', use_selection=True,
                          export_animations=False, export_skins=True,
                          export_morph=False, export_apply=False)
print('source head bounds m:', s)
print('target head bounds cm:', t)
print('fit scales:', sx, sy)
print('hair bounds cm:', bounds(fit))
print('wrote', OUT, 'vertices', len(fit), 'faces', len(hair.data.polygons))
