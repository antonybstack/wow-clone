"""Continuous source neck/scalp proof; optional art, never a shipped replacement.

Reuses the CC0 MakeHuman head and the actual M004 torso/bind/source clips.
Unlike the rejected separate-rim fit, split BOTH connected boundaries at their
union of arc-length parameters before welding. The seam then has shared topology,
weights and shapes.
Native BMesh preserves deform/shape/UV layers while splitting and welding:
https://docs.blender.org/api/current/bmesh.utils.html#bmesh.utils.edge_split
https://docs.blender.org/api/current/bmesh.ops.html#bmesh.ops.weld_verts
https://docs.blender.org/manual/en/latest/addons/import_export/scene_gltf2.html
"""
from pathlib import Path
import sys
import math
import json
import hashlib

import bpy
import bmesh
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(Path(__file__).resolve().parent))
import mh_io
import mh_studio
import mh_hair

AGE = sys.argv[sys.argv.index('--') + 1] if '--' in sys.argv else 'old'
if AGE not in ('young', 'old'):
    raise ValueError('Supported adult source targets: young, old')
WITH_HAIR = '--' in sys.argv and 'hair' in sys.argv[sys.argv.index('--')+2:]
LABEL = AGE+('-hair' if WITH_HAIR else '')
OUT = ROOT / '.cache/character-mmo/identity-v1'
OUT.mkdir(parents=True, exist_ok=True)
SRC = ROOT / 'blender/characters/sources'
BASE = ROOT / '.cache/character-mmo/m004/human-shape-family-v1.glb'
CUT = 150.0

provenance=json.loads((ROOT/'blender/characters/candidates/identity-v1/provenance.json').read_text())
for record in [provenance['body']]+[r for r in provenance['files'] if not r.get('zipMember')]:
    path=ROOT/record['path']
    if hashlib.sha256(path.read_bytes()).hexdigest()!=record['sha256']:
        raise ValueError(f'Identity source changed: {path}')
if bpy.app.version[:3]!=(5,2,1):raise ValueError('Reproduce with pinned Blender 5.2.1')
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(BASE))
body = bpy.data.objects['HumanV1Body']
armature = body.parent
keys = body.data.shape_keys.key_blocks
if [k.name for k in keys][1:] != ['slender', 'stout']:
    raise ValueError('Require exact M004 shape order')

bm = bmesh.new()
bm.from_mesh(body.data)
# glTF UV splits are export vertices, not anatomical boundaries. Reconstruct
# their original logical surface before cutting. Only coincident vertices weld.
bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=.00001)
bmesh.ops.bisect_plane(bm, geom=list(bm.verts)+list(bm.edges)+list(bm.faces),
                      dist=.00001, plane_co=(0, 0, CUT), plane_no=(0, 0, 1),
                      clear_outer=True)
rim_edges = [e for e in bm.edges if e.is_boundary and
             all(abs(v.co.z-CUT) < .001 for v in e.verts)]
rim = list({v for e in rim_edges for v in e.verts})
if len(rim) < 20 or any(len([e for e in v.link_edges if e in rim_edges]) != 2 for v in rim):
    raise ValueError('Require one complete neck boundary')
def ordered_boundary(edges):
    vertices = {v for e in edges for v in e.verts}
    start = min(vertices, key=lambda v:(v.co.y, abs(v.co.x)))
    current, previous, order = start, None, []
    while current not in order:
        order.append(current)
        neighbors = [e.other_vert(current) for e in current.link_edges if e in edges]
        if len(neighbors) != 2:
            raise ValueError('Boundary must be a simple cycle')
        nxt = next(v for v in neighbors if v != previous)
        previous, current = current, nxt
    if current != start or len(order) != len(vertices):
        raise ValueError(f'Require exactly one connected neck loop: connected={len(order)}, total={len(vertices)}, remaining={[(round(v.co.x,2),round(v.co.y,2),round(v.co.z,2)) for v in vertices if v not in order][:15]}')
    area = sum(a.co.x*b.co.y-b.co.x*a.co.y for a,b in zip(order,order[1:]+order[:1]))
    if area < 0:
        order = [order[0]]+list(reversed(order[1:]))
    return order

rim = ordered_boundary(rim_edges)

source, uvs, faces = mh_io.load_obj(SRC / 'base.obj')
mh_io.apply_target(source, SRC / f'caucasian-male-{AGE}.target')
coords, ground = mh_io.mh_coords_to_blender(source)
fit = lambda v: (v[0]*133+.3, v[1]*105+11, (v[2]-1.5)*119+CUT)
fitted = [fit(v) for v in coords]
loops = [corners for group, corners in faces if group == 'body' and
         all(fitted[i][2] > 142 for i, _ in corners)]
head = mh_studio.build_mesh('HumanIdentityHead', fitted, uvs, loops)
hb = bmesh.new()
hb.from_mesh(head.data)
bmesh.ops.remove_doubles(hb, verts=list(hb.verts), dist=.00001)
bmesh.ops.bisect_plane(hb, geom=list(hb.verts)+list(hb.edges)+list(hb.faces),
                      dist=.00001, plane_co=(0,0,151), plane_no=(0,0,1),
                      clear_inner=True)
head_rim_edges = [e for e in hb.edges if e.is_boundary and
                  all(abs(v.co.z-151)<.001 for v in e.verts)]
# The CC0 head includes an oral/throat cavity: its smaller internal neck
# boundary must close inside the neck, not interleave with the visible skin.
# Identify connected cycles; cap interior cuts with native BMesh holes_fill.
remaining = set(head_rim_edges)
cycles = []
while remaining:
    seed = next(iter(remaining))
    component, queue = set(), [seed]
    while queue:
        e = queue.pop()
        if e in component:
            continue
        component.add(e)
        for v in e.verts:
            queue.extend(x for x in v.link_edges if x in remaining and x not in component)
    remaining -= component
    cycles.append(list(component))
cycles.sort(key=lambda es:sum(e.calc_length() for e in es), reverse=True)
for interior in cycles[1:]:
    bmesh.ops.holes_fill(hb, edges=interior, sides=0)
head_rim = ordered_boundary(cycles[0])
if len(head_rim)<20:
    raise ValueError('Source lacks complete scalp/neck')

def parameterize(vertices):
    lengths = [(b.co-a.co).length for a,b in zip(vertices,vertices[1:]+vertices[:1])]
    total = sum(lengths)
    params, distance = [], 0
    for length in lengths:
        params.append(distance/total)
        distance += length
    return params

body_params, head_params = parameterize(rim), parameterize(head_rim)
# Actual edge connectivity, not angular sorting: imported source triangles may
# have a concave contour. Arc-length parameters retain every boundary edge.
targets = sorted(set(body_params+head_params))
def split_at_parameters(vertices, params, targets):
    result = []
    for i, a in enumerate(vertices):
        b = vertices[(i+1)%len(vertices)]
        lo, hi = params[i], params[i+1] if i+1<len(params) else 1
        current, position = a, lo
        result.append(a)
        for t in targets:
            if lo+1e-8 < t < hi-1e-8:
                edge = next(e for e in current.link_edges if b in e.verts)
                _, nv = bmesh.utils.edge_split(edge,current,(t-position)/(hi-position))
                result.append(nv)
                current, position = nv, t
    return result

# Deduplicate numerical near-equality while preserving exact original endpoints.
# Use a shared parameter list so seam counts and correspondence are explicit.
unique = []
for t in targets:
    if not unique or t-unique[-1] > 1e-8:
        unique.append(t)
body_split = split_at_parameters(rim,body_params,unique)
head_split = split_at_parameters(head_rim,head_params,unique)
if len(body_split)!=len(head_split):
    raise ValueError('Boundary resampling lost correspondence')
for a,b in zip(body_split,head_split):
    b.co = a.co

bm.to_mesh(body.data)
bm.free()
hb.to_mesh(head.data)
hb.free()

head.parent = armature
head.matrix_parent_inverse = body.matrix_parent_inverse.copy()
head_bone = next(b.name for b in armature.data.bones if b.name.endswith(':Head'))
rim = [v for v in body.data.vertices if abs(v.co.z-CUT)<.001]
head_weights = []
head.shape_key_add(name='Basis')
for name in ('slender','stout'):
    key = head.shape_key_add(name=name)
    for v in head.data.vertices:
        near = min(rim,key=lambda r:(r.co-v.co).length_squared)
        fade = max(0,min(1,(159-v.co.z)/9))
        delta = body.data.shape_keys.key_blocks[name].data[near.index].co-near.co
        key.data[v.index].co = v.co+delta*fade
for v in head.data.vertices:
    near = min(rim,key=lambda r:(r.co-v.co).length_squared)
    fade = max(0,min(1,(160-v.co.z)/10))
    weights = {body.vertex_groups[g.group].name:g.weight*fade for g in near.groups}
    weights[head_bone] = weights.get(head_bone,0)+1-fade
    total = sum(weights.values())
    head_weights.append([(n,w/total) for n,w in weights.items() if w>1e-6])
parents={bone.name:bone.parent.name if bone.parent else None for bone in armature.data.bones}
head_weights,head_weight_reduction,_=mh_io.reduce_weights([dict(row) for row in head_weights],parents,max_influences=4)
if any(len(row)>4 for row in head_weights):raise ValueError('Head influence budget exceeded')
mh_studio.assign_weights(head,head_weights)

original_material = body.data.materials[0]
original_material.name='IdentityOriginalTorsoSource'
original_material.use_fake_user=True
for obj,value in ((body,False),(head,True)):
    area=obj.data.attributes.new(name='identity.head',type='BOOLEAN',domain='FACE')
    for item in area.data:item.value=value
grey = mh_studio.mat_clay('IdentityGrey',(.38,.38,.38))
body.data.materials.clear()
body.data.materials.append(grey)
head.data.materials.clear()
head.data.materials.append(grey)
bpy.ops.object.select_all(action='DESELECT')
body.select_set(True)
head.select_set(True)
bpy.context.view_layer.objects.active = body
bpy.ops.object.join()
body.name = 'HumanIdentityBody'
body.data.name = 'HumanIdentityBody'
bm = bmesh.new()
bm.from_mesh(body.data)
seam = [v for v in bm.verts if abs(v.co.z-CUT)<.001]
before = len(seam)
bmesh.ops.remove_doubles(bm,verts=seam,dist=.0001)
seam = [v for v in bm.verts if abs(v.co.z-CUT)<.001]
if len(seam)*2 != before or any(e.is_boundary for v in seam for e in v.link_edges):
    raise ValueError(f'Neck weld incomplete: {before} -> {len(seam)}')
# Smooth actual geometry in a narrow neck band, carrying the same displacement
# through every shape layer. A painted normal cannot repair a disconnected rim.
band = [v for v in bm.verts if 148 <= v.co.z <= 155]
shape_layers = list(bm.verts.layers.shape.values())
for _ in range(3):
    previous = {v:v.co.copy() for v in band}
    bmesh.ops.smooth_vert(bm,verts=band,factor=.32,use_axis_x=True,
                          use_axis_y=True,use_axis_z=True)
    for v,p in previous.items():
        delta = v.co-p
        for layer in shape_layers:
            v[layer] += delta
bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
bm.normal_update()
neck_edges={e for v in seam for e in v.link_edges}
neck_boundary=sum(e.is_boundary for e in neck_edges)
neck_non_manifold=sum(len(e.link_faces)!=2 for e in neck_edges)
if neck_boundary or neck_non_manifold:raise ValueError('Welded neck is not manifold')
bm.to_mesh(body.data)
bm.free()
for face in body.data.polygons:
    face.use_smooth = True
# Bisect can interpolate different four-joint endpoints into >4 influences.
# Make reduction explicit on the joined logical surface, never leave it to the
# exporter. Existing helper folds discarded mass onto a kept ancestor.
raw_body_weights=[{body.vertex_groups[g.group].name:g.weight for g in vertex.groups if g.weight>1e-7} for vertex in body.data.vertices]
body_weights,body_weight_reduction,_=mh_io.reduce_weights(raw_body_weights,parents,max_influences=4)
body.vertex_groups.clear()
mh_studio.assign_weights(body,body_weights)
assert all(sum(g.weight>1e-7 for g in v.groups)<=4 for v in body.data.vertices)


# Reuse MakeHuman's own fitted CC0 eye proxy and the accepted rig's Head bone.
proxy = mh_io.load_mhclo(SRC / 'low-poly.mhclo')
_, eye_uv, eye_faces = mh_io.load_obj(SRC / 'low-poly.obj')
eye_coords,_ = mh_io.mh_coords_to_blender(mh_io.fit_proxy(source,proxy),zmin=ground)
eyes = mh_studio.build_mesh('HumanIdentityEyes',[fit(v) for v in eye_coords],
                            eye_uv,mh_io.obj_loops(eye_faces))
eyes.parent = armature
eyes.matrix_parent_inverse = body.matrix_parent_inverse.copy()
eyes.data.materials.append(mh_studio.mat_clay('EyeGrey',(.12,.12,.12)))
mh_studio.assign_weights(eyes,[[(head_bone,1.0)] for _ in eyes.data.vertices])
mod = eyes.modifiers.new('Armature','ARMATURE')
mod.object = armature

hair = None
if WITH_HAIR:
    hair_dir = ROOT/'blender/characters/candidates/hair/ponytail01'
    record = next(x for x in json.loads((hair_dir.parent/'m006-provenance.json').read_text())['styles'] if x['id']=='ponytail01')
    for item in record['files']:
        path=ROOT/item['path']
        if hashlib.sha256(path.read_bytes()).hexdigest()!=item['sha256']:
            raise ValueError('CC0 hair source hash mismatch')
    proxy=mh_io.fit_proxy(source,mh_io.load_mhclo(hair_dir/'ponytail01.mhclo'))
    _,hair_uv,hair_faces=mh_io.load_obj(hair_dir/'ponytail01.obj')
    hair_coords,_=mh_io.mh_coords_to_blender(proxy,zmin=ground)
    points=[fit(v) for v in hair_coords]
    hair=mh_studio.build_mesh('HumanPonytail01',points,hair_uv,mh_io.obj_loops(hair_faces))
    hair.parent=armature
    hair.matrix_parent_inverse=body.matrix_parent_inverse.copy()
    top=max(p[2] for p in points); bottom=min(p[2] for p in points)
    weights=[]
    for vertex in hair.data.vertices:
        # Cap belongs to the skull. A height fraction over the whole ponytail
        # put Neck influence at the forehead and let it slide into the scalp.
        # Only the hanging length blends towards the neck/upper spine.
        # glTF skins apply these authored weights; no runtime hair simulation.
        # https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#skins
        phase=max(0,min(1,(160-vertex.co.z)/max(1,160-bottom)))
        head_w=max(0,1-2*phase); spine_w=max(0,2*phase-1)
        weights.append([('mixamorig:Head',head_w),('mixamorig:Neck',1-head_w-spine_w),('mixamorig:Spine2',spine_w)])
    mh_studio.assign_weights(hair,[[(n,w) for n,w in row if w>0] for row in weights])
    mod=hair.modifiers.new('Armature','ARMATURE');mod.object=armature
    material=mh_studio.mat_pbr('IdentityLongHair',albedo_path=hair_dir/'ponytail01_diffuse.png',alpha_clip=.12,rough=.72,specular=.18,double_sided=True)
    mh_hair.wire_export_mask(material,.12)
    hair.data.materials.append(material)
    for face in hair.data.polygons:face.use_smooth=True

report = {'age':AGE,'label':LABEL,'hair':WITH_HAIR,'source':'MakeHuman CC0','neckBefore':before,
          'sharedNeckVertices':len(seam),'neckBoundaryEdges':neck_boundary,
          'neckNonManifoldEdges':neck_non_manifold,
          'headWeightReduction':head_weight_reduction,'bodyWeightReduction':body_weight_reduction,'vertices':len(body.data.vertices),'faces':len(body.data.polygons),
          'shapeOrder':[k.name for k in body.data.shape_keys.key_blocks],
          'baseHash':hashlib.sha256(BASE.read_bytes()).hexdigest()}
(OUT/f'{LABEL}-source.json').write_text(json.dumps(report,indent=2))
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/f'human-{LABEL}-source.blend'))
bpy.ops.object.select_all(action='DESELECT')
for obj in (armature,body,eyes)+((hair,) if hair else ()):
    obj.select_set(True)
bpy.context.view_layer.objects.active = armature
bpy.ops.export_scene.gltf(filepath=str(OUT/f'human-{LABEL}-grey-raw.glb'),
    use_selection=True,export_format='GLB',export_yup=True,
    export_animations=True,export_animation_mode='ACTIONS',export_skins=True,
    export_all_influences=False,export_materials='EXPORT',
    export_cameras=False,export_lights=False,export_texcoords=True,export_normals=True)
print('IDENTITY_SOURCE',json.dumps(report))
