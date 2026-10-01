"""Offline native Blender weight transfer; preserves source garment geometry.

Run in an isolated Blender 5.2.1 process with --python-exit-code 1. Emits only
world positions and four normalized named influences for a NodeIO assembler;
no exporter topology/UV reordering or replacement body/animation is required.
https://docs.blender.org/manual/en/latest/modeling/modifiers/modify/data_transfer.html
https://docs.blender.org/api/current/bpy.types.DataTransferModifier.html
"""
import argparse
import json
import math
import sys
from pathlib import Path
import bpy

parser=argparse.ArgumentParser()
parser.add_argument('--body',required=True)
parser.add_argument('--body-mesh',required=True,action='append')
parser.add_argument('--garment',required=True)
parser.add_argument('--garment-mesh',required=True)
parser.add_argument('--out',required=True)
parser.add_argument('--mask',choices=['full','lower-torso','front-abdomen'],default='full')
a=parser.parse_args(sys.argv[sys.argv.index('--')+1:])
if bpy.app.version[:3]!=(5,2,1):raise ValueError('Require pinned Blender 5.2.1')
bpy.ops.wm.read_factory_settings(use_empty=True)

def load(path):
    before=set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(Path(path).resolve()))
    imported=set(bpy.data.objects)-before
    for obj in imported:
        if obj.type=='ARMATURE':
            obj.animation_data_clear()
            obj.data.pose_position='REST'
        for modifier in obj.modifiers:
            if modifier.type=='ARMATURE':modifier.show_viewport=False
    bpy.context.view_layer.update()
    return imported

body_objects=load(a.body)
regions=[obj for obj in body_objects if obj.type=='MESH' and obj.name in a.body_mesh]
if len(regions)!=len(a.body_mesh):raise ValueError('Missing explicit body skin region')
bpy.ops.object.select_all(action='DESELECT')
for obj in regions:obj.select_set(True)
bpy.context.view_layer.objects.active=regions[0]
if len(regions)>1:bpy.ops.object.join()
body=bpy.context.view_layer.objects.active
imported=load(a.garment)
garment=next((obj for obj in imported if obj.type=='MESH' and obj.name==a.garment_mesh),None)
if garment is None or garment.data.shape_keys:raise ValueError('Require one neutral source garment')
original=[(garment.matrix_world @ vertex.co).copy() for vertex in garment.data.vertices]
# Native source-all / destination-by-name group transfer. Existing names are
# cleared so a body group omitted at a destination cannot leave stale weights.
if a.mask=='full':garment.vertex_groups.clear()
for group in body.vertex_groups:
    if not garment.vertex_groups.get(group.name):garment.vertex_groups.new(name=group.name)
factors=[1.0]*len(original)
mask_group=None
mask_landmarks=None
if a.mask!='full':
    # Native vertex-group masking retains authored cape/sleeve/loose-hem skinning.
    # The artist correction is defined against this body's actual joint landmarks,
    # not viewport coordinates, a hand-built skin solver or a runtime collision fix.
    # https://docs.blender.org/manual/en/latest/modeling/modifiers/modify/data_transfer.html#influence
    rig=next(obj for obj in body_objects if obj.type=='ARMATURE')
    def height(name):return (rig.matrix_world @ rig.data.bones['mixamorig:'+name].head_local).z
    hips,spine,spine1,spine2=[height(name)for name in ['Hips','Spine','Spine1','Spine2']]
    low=hips-(spine-hips)/2
    high=(spine1+spine2)/2
    mask_landmarks={'hips':hips,'spine':spine,'spine1':spine1,'spine2':spine2,'lowerFadeStart':low,'upperFadeEnd':high}
    front_center=-(rig.matrix_world @ rig.data.bones['mixamorig:Spine1'].head_local).y
    if a.mask=='front-abdomen':mask_landmarks.update({'frontCenterGltfZ':front_center,'frontFadeLengthM':0.08,'forwardAxis':'glTF +Z'})
    mask_group=garment.vertex_groups.new(name='__LowerTorsoCorrective')
    for vertex,world in zip(garment.data.vertices,original):
        factor=max(0.0,min(1.0,(world.z-low)/(spine-low),(high-world.z)/(high-spine1)))
        if a.mask=='front-abdomen':
            t=max(0.0,min(1.0,(-world.y-front_center)/0.08))
            factor*=t*t*(3-2*t)
        factors[vertex.index]=factor
        if factor>0:mask_group.add([vertex.index],factor,'REPLACE')
for inherited in list(garment.modifiers):
    if inherited.type=='ARMATURE':garment.modifiers.remove(inherited)
modifier=garment.modifiers.new('AcceptedBodySkinWeights','DATA_TRANSFER')
modifier.object=body
modifier.use_vert_data=True
modifier.data_types_verts={'VGROUP_WEIGHTS'}
modifier.vert_mapping='POLYINTERP_NEAREST'
modifier.layers_vgroup_select_src='ALL'
modifier.layers_vgroup_select_dst='NAME'
modifier.mix_mode='REPLACE'
modifier.mix_factor=1.0
if mask_group:modifier.vertex_group=mask_group.name
bpy.ops.object.select_all(action='DESELECT')
garment.select_set(True)
bpy.context.view_layer.objects.active=garment
bpy.ops.object.modifier_apply(modifier=modifier.name)
# Applying a modifier replaces RNA group wrappers; re-resolve by stable name.
applied_mask=garment.vertex_groups.get('__LowerTorsoCorrective')
if applied_mask:garment.vertex_groups.remove(applied_mask)
if len(garment.data.vertices)!=len(original):raise ValueError('Transfer changed topology')
rows=[]
for vertex,before in zip(garment.data.vertices,original):
    world=garment.matrix_world @ vertex.co
    if (world-before).length>1e-7:raise ValueError('Transfer moved garment geometry')
    all_influences=sorted([(garment.vertex_groups[g.group].name,float(g.weight)) for g in vertex.groups if g.weight>0],key=lambda row:(-row[1],row[0]))
    influences=all_influences[:4]
    total=sum(weight for _,weight in influences)
    if not math.isfinite(total) or total<=0:raise ValueError('Unweighted transferred vertex')
    # The glTF importer owns Y-up -> Blender Z-up; undo that axis convention
    # only for this correspondence report, never for an exported mesh/skin.
    rows.append({'position':[world.x,world.z,-world.y],'transferFactor':factors[vertex.index],'discardedWeightFraction':sum(w for _,w in all_influences[4:])/sum(w for _,w in all_influences),'weights':[[name,weight/total]for name,weight in influences]})
Path(a.out).write_text(json.dumps({'tool':'Blender '+bpy.app.version_string,'mask':a.mask,'maskLandmarksM':mask_landmarks,'method':'Native Data Transfer / nearest-face interpolated vertex groups, then strongest four normalized','rows':rows},separators=(',',':'))+'\n')
print('TRANSFERRED',len(rows),'vertices; source geometry unchanged')
