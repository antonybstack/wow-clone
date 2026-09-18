"""Fit CC0 MakeClothes apparel to the existing source-compatible Human.
Isolated Blender process; reuses the project's MakeHuman fitting/rest-pose helpers.
No source animation or source bind is modified. Final bind assembly is glTF Transform.
"""
import bpy,bmesh,sys,json,struct,math
from pathlib import Path
from mathutils import Matrix,Vector,Quaternion
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'scripts/character-assets'))
import mh_io,mh_studio
from build_human_v1 import HUMAN_TARGETS
from retarget_bone_map import BONE_PAIRS
SRC=ROOT/'blender/characters/sources';ASSETS=SRC/'armory';OUT=ROOT/'.cache/armory-assets'
# This script is invoked in its own background Blender process, never the live shrine.
for ob in list(bpy.data.objects):bpy.data.objects.remove(ob,do_unlink=True)
verts,_,_=mh_io.load_obj(SRC/'base.obj');mh_io.apply_targets(verts,[(SRC/n,w) for n,w in HUMAN_TARGETS])
body,zmin=mh_io.mh_coords_to_blender(verts)
bones=mh_io.bones_world(mh_io.load_skel(SRC/'default.mhskel'),body)
arm=mh_studio.build_armature(bones,'ApparelSourceRig','ApparelSource')
weights=[{} for _ in verts]
for bone,entries in json.loads((SRC/'default_weights.mhw').read_text())['weights'].items():
 for index,value in entries:weights[index][mh_io.BONE_RENAME.get(bone,bone)]=value
meshes=[];report=[]
for source,texture,name in [('rehmanpolanski_viking_tunic','TUNIC_Viking.png','WayfarerTunic'),('rehmanpolanski_viking_boots','BootsViking.png','WayfarerBoots'),('rehmanpolanski_viking_pants','PantsViking.png','WayfarerTrousers'),('donitz_monk_robe','robe_brown__diffuse.png','PilgrimTunic'),('rehmanpolanski_viking_tunic','TUNIC_Viking.png','GraveweaverTop'),('donitz_monk_robe','robe_brown__diffuse.png','GraveweaverSkirt'),('donitz_monk_robe_hood','robe_brown__diffuse.png','GraveweaverHood'),('toigo_gloves_short','Gloves03UV.png','GraveweaverGloves')]:
 clo=mh_io.load_mhclo(ASSETS/f'{source}.mhclo')
 points=mh_io.fit_proxy(verts,clo);_,uv,faces=mh_io.load_obj(ASSETS/clo['obj'])
 points,_=mh_io.mh_coords_to_blender(points,zmin=zmin)
 ob=mh_studio.build_mesh(name,points,uv,mh_io.obj_loops(faces))
 # Interpolate the author's body-relative fitting weights, including the same
 # anatomical reference correspondence used to fit the garment vertices.
 rows=[]
 for mapping in clo['mappings']:
  refs=[(mapping[1],1)] if mapping[0]=='helper' else list(zip(mapping[1:4],mapping[4:7]))
  row={}
  for idx,w in refs:
   if idx>=len(weights):raise ValueError('Unweighted helper reference: '+str(idx))
   for bone,value in weights[idx].items():row[bone]=row.get(bone,0)+max(0,w)*value
  total=sum(row.values());assert total>0
  rows.append({bone:w/total for bone,w in row.items() if w>0})
 groups={n:ob.vertex_groups.new(name=n) for n in sorted({n for row in rows for n in row})}
 for i,row in enumerate(rows):
  for bone,w in row.items():groups[bone].add([i],w,'REPLACE')
 if name=='PilgrimTunic':
  # Tailor the authored robe into a thigh-length tunic. BMesh interpolates UVs
  # and vertex-group layers at the hem; do not replace the garment with a shell.
  bm=bmesh.new();bm.from_mesh(ob.data)
  bmesh.ops.bisect_plane(bm,geom=list(bm.verts)+list(bm.edges)+list(bm.faces),dist=.000001,plane_co=(0,0,.76),plane_no=(0,0,1),clear_inner=True,clear_outer=False)
  bm.to_mesh(ob.data);bm.free();ob.data.update()
 if name in ('GraveweaverTop','GraveweaverSkirt'):
  bm=bmesh.new();bm.from_mesh(ob.data)
  cuts=[(.84,True)] if name=='GraveweaverTop' else [(.99,False),(.12,True)]
  for z,below in cuts:
   bmesh.ops.bisect_plane(bm,geom=list(bm.verts)+list(bm.edges)+list(bm.faces),dist=.000001,plane_co=(0,0,z),plane_no=(0,0,1),clear_inner=below,clear_outer=not below)
  if name=='GraveweaverSkirt':
   # Ease the lower garment over the trouser underlayer; preserve the waist seam.
   for v in bm.verts:
    ease=max(0,min(1,(.99-v.co.z)/.16))
    v.co.x*=1+.12*ease
    v.co.y=-.04+(v.co.y+.04)*(1+.30*ease)
  bm.to_mesh(ob.data);bm.free();ob.data.update()
 mh_studio.parent_armature(ob,arm)
 image=bpy.data.images.load(str(ASSETS/texture));image.scale(256,256)
 image.filepath_raw=str(OUT/f'{name}.png');image.file_format='PNG';image.save();image.pack()
 mat=bpy.data.materials.new(name);mat.use_nodes=True
 bsdf=mat.node_tree.nodes.get('Principled BSDF');bsdf.inputs['Roughness'].default_value=.95
 tex=mat.node_tree.nodes.new('ShaderNodeTexImage');tex.image=image;tex.interpolation='Closest';mat.node_tree.links.new(tex.outputs['Color'],bsdf.inputs['Base Color'])
 ob.data.materials.append(mat)
 for face in ob.data.polygons:face.use_smooth=True
 meshes.append(ob);report.append({'item':name,'vertices':len(points),'polygons':len(faces),'source':clo['obj']})
# Reproduce the Human's baked A-rest before using the proven source-rig repose.
mh_studio.apply_human_rest_pose(arm,45.0,7.0);mh_studio.bake_pose_as_rest(arm,meshes)
raw=(ROOT/'public/ashen-reach/wanderer.glb').read_bytes();g=json.loads(raw[20:20+struct.unpack_from('<I',raw,12)[0]])
world={}
def visit(i,parent):
 n=g['nodes'][i];q=n.get('rotation',[0,0,0,1])
 m=Matrix.LocRotScale(Vector(n.get('translation',[0,0,0])),Quaternion((q[3],*q[:3])),Vector(n.get('scale',[1,1,1])))
 if 'matrix' in n:m=Matrix([n['matrix'][k::4] for k in range(4)])
 world[n.get('name',str(i))]=parent@m
 for c in n.get('children',[]):visit(c,parent@m)
for i in g['scenes'][g.get('scene',0)]['nodes']:visit(i,Matrix.Identity(4))
def source_point(name):
 p=world['mixamorig:'+name].translation;return Vector((p.x,-p.z,p.y))
def head(name):return arm.matrix_world@arm.pose.bones[name].head
for side in ['Left','Right']:
 for a,b in [('Arm','ForeArm'),('ForeArm','Hand')]:
  pb=arm.pose.bones[side+a];v=head(side+b)-head(side+a);desired=source_point(side+b)-source_point(side+a)
  q=v.rotation_difference(desired);pw=arm.matrix_world@pb.matrix;origin=pw.translation.copy()
  pb.matrix=arm.matrix_world.inverted()@Matrix.Translation(origin)@q.to_matrix().to_4x4()@Matrix.Translation(-origin)@pw
  bpy.context.view_layer.update()
map_names=dict(BONE_PAIRS);map_names.update({'Spine':'mixamorig:Spine','spine04':'mixamorig:Spine','Spine2':'mixamorig:Spine1','spine02':'mixamorig:Spine1','spine01':'mixamorig:Spine2'})
for bone in arm.data.bones:
 if bone.name in map_names:continue
 parent=bone.parent
 while parent and parent.name not in map_names:parent=parent.parent
 if not parent:raise ValueError('Unmapped bone '+bone.name)
 map_names[bone.name]=map_names[parent.name]
for ob in meshes:
 bpy.context.view_layer.objects.active=ob;ob.select_set(True)
 for mod in list(ob.modifiers):
  if mod.type=='ARMATURE':bpy.ops.object.modifier_apply(modifier=mod.name)
 rows=[]
 for v in ob.data.vertices:
  row={}
  for group in v.groups:
   n=map_names[ob.vertex_groups[group.group].name];row[n]=row.get(n,0)+group.weight
  row=dict(sorted(row.items(),key=lambda x:-x[1])[:4]);total=sum(row.values());rows.append({n:w/total for n,w in row.items()})
 ob.vertex_groups.clear();groups={n:ob.vertex_groups.new(name=n) for n in sorted({n for row in rows for n in row})}
 for i,row in enumerate(rows):
  for n,w in row.items():groups[n].add([i],w,'REPLACE')
bpy.ops.object.select_all(action='DESELECT');arm.select_set(True);bpy.context.view_layer.objects.active=arm
bpy.ops.object.mode_set(mode='EDIT')
for bone in list(arm.data.edit_bones):arm.data.edit_bones.remove(bone)
for i in g['skins'][0]['joints']:
 name=g['nodes'][i]['name'];p=world[name].translation
 bone=arm.data.edit_bones.new(name);bone.head=(p.x,-p.z,p.y);bone.tail=bone.head+Vector((0,0,.05))
bpy.ops.object.mode_set(mode='OBJECT');arm.data.pose_position='REST'
# Original small clasp: faceted amethyst in aged bronze, carried by the chest joint.
pendant_vertices=[];pendant_faces=[];pendant_materials=[]
def pv(x,y,z):
 pendant_vertices.append((x,-z,y));return len(pendant_vertices)-1
def pf(indices,material=0):pendant_faces.append(indices);pendant_materials.append(material)
for side in [-1,1]:
 points=[(side*.085,1.50,.14),(side*.055,1.43,.185),(0,1.355,.215)]
 for a,b in zip(points,points[1:]):
  va=[pv(a[0]-.006,a[1],a[2]),pv(a[0]+.006,a[1],a[2]),pv(b[0]+.006,b[1],b[2]),pv(b[0]-.006,b[1],b[2])];pf(va)
outer=[pv(math.sin(i*math.tau/8)*.044,1.335+math.cos(i*math.tau/8)*.052,.217) for i in range(8)]
inner=[pv(math.sin(i*math.tau/8)*.027,1.335+math.cos(i*math.tau/8)*.034,.228) for i in range(8)]
center=pv(0,1.335,.244)
for i in range(8):pf((outer[i],outer[(i+1)%8],inner[(i+1)%8],inner[i]));pf((center,inner[i],inner[(i+1)%8]),1)
mesh=bpy.data.meshes.new('GraveweaverPendant');mesh.from_pydata(pendant_vertices,[],pendant_faces);mesh.update()
pendant=bpy.data.objects.new('GraveweaverPendant',mesh);bpy.context.collection.objects.link(pendant)
for name,color,metallic in [('Aged bronze',(.38,.29,.12,1),.5),('Amethyst',(.30,.14,.43,1),.15)]:
 mat=bpy.data.materials.new(name);mat.use_nodes=True;bsdf=mat.node_tree.nodes.get('Principled BSDF');bsdf.inputs['Base Color'].default_value=color;bsdf.inputs['Metallic'].default_value=metallic;bsdf.inputs['Roughness'].default_value=.65;mesh.materials.append(mat)
for polygon,material in zip(mesh.polygons,pendant_materials):polygon.material_index=material
pendant.vertex_groups.new(name='mixamorig:Spine2').add(list(range(len(pendant_vertices))),1,'REPLACE');meshes.append(pendant)
for ob in meshes:mh_studio.parent_armature(ob,arm);ob.select_set(True)
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'blender/characters/ashen-wayfarer.blend'))
bpy.ops.export_scene.gltf(filepath=str(OUT/'apparel-rest.glb'),use_selection=True,export_format='GLB',export_animations=False,export_skins=True,export_all_influences=False,export_cameras=False,export_lights=False)
(OUT/'fit-report.json').write_text(json.dumps(report,indent=2));print('APPAREL FIT',report)
