"""Orc rest-mesh preparation for the original source deformation rig.
Isolated background Blender. No animation curves are generated or retargeted.

Mirrors bind_source_human.py: the Orc keeps its own anatomical joint centres
(hip-socket midpoint pelvis, source torso rest curve, Orc head height) while
adopting the 65-joint source hierarchy/names so all source clips apply
unchanged. See docs/source-motion-recovery-implementation-2026-09-17.md and
docs/character-race-sources.md.

Input is the bulked Orc (scripts/character-assets/bulk_orc.py output), so the
bind follows the Grommash-scale flesh, not the stock MakeHuman proportions.
"""
import bpy,json,struct,sys
from pathlib import Path
from mathutils import Vector,Matrix,Quaternion
sys.path.insert(0,str(Path(__file__).resolve().parent))
from retarget_bone_map import BONE_PAIRS
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'.cache/source-motion'
OUT.mkdir(parents=True,exist_ok=True)
for ob in list(bpy.data.objects):bpy.data.objects.remove(ob,do_unlink=True)
raw=(ROOT/'public/characters/base.glb').read_bytes();j=json.loads(raw[20:20+struct.unpack_from('<I',raw,12)[0]])
world={}
def visit(i,parent):
 n=j['nodes'][i];r=n.get('rotation',[0,0,0,1]);m=Matrix.LocRotScale(Vector(n.get('translation',[0,0,0])),Quaternion((r[3],*r[:3])),Vector(n.get('scale',[1,1,1])))
 world[n.get('name',str(i))]=parent@m
 for c in n.get('children',[]):visit(c,parent@m)
for i in j['scenes'][0]['nodes']:visit(i,Matrix.Identity(4))
def source_point(name):
 p=world['mixamorig:'+name].translation;return Vector((p.x,-p.z,p.y))
bpy.ops.import_scene.gltf(filepath=str(ROOT/'.cache/source-motion/orc-bulked.glb'))
arm=next(o for o in bpy.data.objects if o.type=='ARMATURE')
arm.animation_data_clear();arm.data.pose_position='POSE'
for p in arm.pose.bones:p.matrix_basis=Matrix.Identity(4)
bpy.context.view_layer.update()
def head(name):return arm.matrix_world@arm.pose.bones[name].head
# Repose existing Orc skin from A into the SOURCE rest-arm directions with
# Blender's existing armature modifier. This establishes a new mesh bind pose.
for side in ['Left','Right']:
 for a,b in [('Arm','ForeArm'),('ForeArm','Hand')]:
  name=side+a;pb=arm.pose.bones[name];v=head(side+b)-head(name)
  desired=source_point(side+b)-source_point(name)
  q=v.rotation_difference(desired)
  pw=arm.matrix_world@pb.matrix;origin=pw.translation.copy()
  rotate=Matrix.Translation(origin)@q.to_matrix().to_4x4()@Matrix.Translation(-origin)
  pb.matrix=arm.matrix_world.inverted()@rotate@pw
  bpy.context.view_layer.update()
# Semantic joint centers for the new rig. The extra MH spine segments are not
# source spine joints; distribute the three source centers using source height
# fractions between pelvis and neck instead of matching spineNN names.
points={s:list(head(d)) for d,s in BONE_PAIRS}
# MH Hips is a posterior rig pivot, not the centre between the hip sockets.
# Using that pivot as the source pelvis adds a permanent torso lean. Preserve
# the source torso rest curve, fitting its height between anatomical hips/neck.
hip=(head('LeftUpLeg')+head('RightUpLeg'))*.5
neck=head('Neck');sh=source_point('Hips');sn=source_point('Neck')
scale=(neck.z-hip.z)/(sn.z-sh.z)
points['mixamorig:Hips']=list(hip)
for name in ['Spine','Spine1','Spine2','Neck','Head']:
 p=source_point(name)
 fit=hip+(p-sh)*scale
 if name=='Head':fit.z=head('Head').z
 points['mixamorig:'+name]=list(fit)
# Outboard arm-joint shift stretched posed hands once the deltoids were bulked
# (rotation around a joint that no longer matches the baked wrist). Keep 0 so
# fists stay intact; deltoid extra in bulk_orc.py is mild enough that armpits
# do not web without this offset.
ARM_SHIFT=0.0
for side,sign in [('Left',1.0),('Right',-1.0)]:
 for n in ['Shoulder','Arm','ForeArm','Hand']+['Hand'+f+str(s) for f in ['Thumb','Index','Middle','Ring','Pinky'] for s in (1,2,3)]:
  key='mixamorig:'+side+n
  if key in points:points[key][0]+=sign*ARM_SHIFT
# Keep anatomical Orc joint centers elsewhere; weights on helper/face bones
# collapse into their nearest supported ancestor. No nearest-surface guess.
map_names=dict(BONE_PAIRS)
map_names.update({'Spine':'mixamorig:Spine','spine04':'mixamorig:Spine','Spine2':'mixamorig:Spine1','spine02':'mixamorig:Spine1','spine01':'mixamorig:Spine2'})
for bone in arm.data.bones:
 if bone.name in map_names:continue
 p=bone.parent
 while p and p.name not in map_names:p=p.parent
 if not p:raise RuntimeError('Unmapped root '+bone.name)
 map_names[bone.name]=map_names[p.name]
meshes=[o for o in bpy.data.objects if o.type=='MESH' and any(m.type=='ARMATURE' and m.object==arm for m in o.modifiers)]
for ob in meshes:
 bpy.context.view_layer.objects.active=ob;ob.select_set(True)
 for mod in list(ob.modifiers):
  if mod.type=='ARMATURE':bpy.ops.object.modifier_apply(modifier=mod.name)
 weights=[]
 for v in ob.data.vertices:
  row={}
  for g in v.groups:
   name=map_names[ob.vertex_groups[g.group].name];row[name]=row.get(name,0)+g.weight
  weights.append(row)
 ob.vertex_groups.clear();groups={n:ob.vertex_groups.new(name=n) for n in sorted(set(n for r in weights for n in r))}
 for i,row in enumerate(weights):
  for name,value in row.items():groups[name].add([i],value,'REPLACE')
# Exporting the posed geometry through Blender retains its UVs/materials and
# writes weights against this temporary rig. The final GLB uses original source
# joint frames/curves, assembled offline in bind-source-orc.mjs.
bpy.ops.object.select_all(action='DESELECT');arm.select_set(True);bpy.context.view_layer.objects.active=arm
bpy.ops.object.mode_set(mode='EDIT')
for bone in list(arm.data.edit_bones):arm.data.edit_bones.remove(bone)
for name,p in points.items():
 b=arm.data.edit_bones.new(name);b.head=p;b.tail=Vector(p)+Vector((0,0,.05));b.use_deform=True
bpy.ops.object.mode_set(mode='OBJECT')
for ob in meshes:
 ob.parent=arm;mod=ob.modifiers.new('SourceBinding','ARMATURE');mod.object=arm;ob.select_set(True)
 arm.data.pose_position='REST'
bpy.ops.export_scene.gltf(filepath=str(OUT/'orc-source-rest.glb'),use_selection=True,export_format='GLB',export_yup=True,export_animations=False,export_skins=True,export_all_influences=False,export_materials='EXPORT',export_cameras=False,export_lights=False)
def yup(p):return [p[0],p[2],-p[1]]
(OUT/'orc-source-joints.json').write_text(json.dumps({n:yup(p) for n,p in points.items()},indent=2))
print('SOURCE BIND PREPARATION COMPLETE',len(meshes),'meshes',len(points),'fitted centers')
