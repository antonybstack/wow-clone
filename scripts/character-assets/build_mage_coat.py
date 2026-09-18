"""Tailored Human mage kit. Isolated Blender; exact existing palette/weights.

Run prepare-mage-fit.mjs, then Blender --background --python this file, then
bake-mage-fit.mjs. Blender owns modeled surfaces, UVs, bevels and smooth normals.
Export a neutral mesh payload; the bake preserves the canonical GLB bind verbatim.
"""
import bpy, json, math
from pathlib import Path
from mathutils import Vector, Matrix
from mathutils.kdtree import KDTree
from mathutils.bvhtree import BVHTree

ROOT=Path(__file__).resolve().parents[2]
SRC=json.loads((ROOT/'.cache/mage-source.json').read_text())
OUT=ROOT/'.cache/mage-geometry.json'
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
PALETTE=SRC['body']['joints']
BODY=SRC['body']['primitives'][0]['attributes']
pts=list(zip(*[iter(BODY['POSITION'])]*3))
tree=KDTree(len(pts))
for i,p in enumerate(pts):tree.insert(p,i)
tree.balance()
body_tris=list(zip(*[iter(SRC['body']['primitives'][0]['indices'])]*3))
body_surface=BVHTree.FromPolygons(pts,body_tris,all_triangles=True)
objects=[]
COLORS=[(.055,.066,.15,1),(.022,.025,.052,1),(.13,.075,.037,1),(.48,.30,.095,1),(.27,.23,.16,1)]
NAMES=['MageWool','MageLining','MageLeather','MageBrass','MageLinen']
materials=[]
for name,col in zip(NAMES,COLORS):
 m=bpy.data.materials.new(name);m.diffuse_color=col;m.use_nodes=True
 bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=col
 bs.inputs['Roughness'].default_value=.84 if name!='MageBrass' else .38
 bs.inputs['Metallic'].default_value=.7 if name=='MageBrass' else 0
 materials.append(m)

def bone_head(name):
 i=PALETTE.index(name)*16;arr=SRC['body']['inverseBinds'][i:i+16]
 return Matrix([[arr[c*4+r] for c in range(4)] for r in range(4)]).inverted().translation

def smoothstep(a,b,x):
 t=max(0,min(1,(x-a)/(b-a)));return t*t*(3-2*t)

def chest_surface(x,y,clearance=.028):
 hit,normal,_,_=body_surface.ray_cast(Vector((x,y,1)),Vector((0,0,-1)),2)
 return hit.z+clearance if hit is not None else .13

def weights(p,kind=None):
 if kind=='head':return {'Head':1}
 if kind=='belt':return {'Hips':.65,'Spine':.35}
 if kind=='coat':p=(math.copysign(max(.09,abs(p[0])),p[0]),p[1],p[2])
 if isinstance(kind,dict):return kind
 result={};total=0
 for _,idx,dist in tree.find_n(p,4):
  factor=1/max(.0001,dist)**2;total+=factor
  for k in range(4):
   bone=PALETTE[BODY['JOINTS_0'][idx*4+k]]
   result[bone]=result.get(bone,0)+BODY['WEIGHTS_0'][idx*4+k]*factor
 result={bone:w/total for bone,w in result.items() if w>0}
 if kind=='coat':
  # A long coat quarter must not inherit the knee/ankle bend of the closest
  # trouser vertex. Carry lower-leg influences with the thigh instead, with a
  # little hip retention. This avoids wrapping the hem around a raised calf.
  carried={}
  for bone,w in result.items():
   side='Left' if p[0]>0 else 'Right'
   if any(token in bone.lower() for token in ['leg','foot','toe']):bone=side+'UpLeg'
   carried[bone]=carried.get(bone,0)+w
  # Heavy wool hangs from the waist; it should not become a rigid trouser leg.
  # Front quarters retain more thigh clearance, while the rear/hem retain more
  # pelvis influence. A vertical gradient bends the panel instead of rotating
  # its entire length as one board. Piping/lining use this identical field.
  front=smoothstep(-.08,.14,p[2])
  hem=1-smoothstep(.36,.80,p[1])
  leg_share=(.62+.20*front)-.20*hem
  result={bone:w*leg_share for bone,w in carried.items()}
  result['Hips']=result.get('Hips',0)+1-leg_share
  blend=smoothstep(.86,1.035,p[1]);result={bone:w*(1-blend) for bone,w in result.items()}
  for bone,w in [('Hips',.65),('Spine',.35)]:result[bone]=result.get(bone,0)+w*blend
 return result

def mesh(name,verts,faces,mat=0,uvs=None,kind=None,custom_weights=None):
 # Geometry authoring uses glTF Y-up coordinates; Blender stores Z-up.
 me=bpy.data.meshes.new(name);me.from_pydata([(x,-z,y) for x,y,z in verts],[],faces);me.update()
 ob=bpy.data.objects.new(name,me);bpy.context.collection.objects.link(ob);objects.append(ob)
 me.materials.append(materials[mat])
 for poly in me.polygons:poly.use_smooth=True
 uv=me.uv_layers.new(name='UVMap')
 for poly in me.polygons:
  for li in poly.loop_indices:
   vi=me.loops[li].vertex_index;p=verts[vi]
   uv.data[li].uv=uvs[vi] if uvs else (p[0]*5,p[1]*5)
 groups={}
 for i,p in enumerate(verts):
  w=custom_weights[i] if custom_weights else weights(p,kind)
  for bone,value in w.items():
   if value<=0:continue
   if bone not in groups:groups[bone]=ob.vertex_groups.new(name=bone)
   groups[bone].add([i],value,'REPLACE')
 return ob

def grid(name,rows,cols,fn,mat=0,kind=None,thickness=0):
 v=[];uv=[];f=[]
 for r in range(rows+1):
  for c in range(cols+1):
   u=c/cols;t=r/rows;v.append(fn(u,t))
 # Physical-distance UVs keep the same weave/grain scale on differently sized
 # panels. Parameter-space UVs stretched the first pass around the arms/hood.
 for r in range(rows+1):
  arc=0
  for c in range(cols+1):
   i=r*(cols+1)+c
   if c:arc+=(Vector(v[i])-Vector(v[i-1])).length
   along=0
   for rr in range(r):along+=(Vector(v[(rr+1)*(cols+1)+c])-Vector(v[rr*(cols+1)+c])).length
   density=18 if mat==0 else 4
   uv.append((arc*density,along*density))
 for r in range(rows):
  for c in range(cols):
   a=r*(cols+1)+c;f.append((a,a+1,a+cols+2,a+cols+1))
 ob=mesh(name,v,f,mat,uv,kind)
 if thickness:
  mod=ob.modifiers.new('Finished cloth thickness','SOLIDIFY');mod.thickness=thickness;mod.offset=0
 return ob

def tube(name,path,radius=.003,mat=3,kind=None):
 verts=[];faces=[]
 for i,p in enumerate(path):
  tangent=Vector(path[min(len(path)-1,i+1)])-Vector(path[max(0,i-1)])
  tangent.normalize();ref=Vector((0,1,0)) if abs(tangent.y)<.9 else Vector((1,0,0))
  a=tangent.cross(ref).normalized();b=tangent.cross(a).normalized()
  for j in range(6):verts.append(tuple(Vector(p)+radius*(a*math.cos(j*math.tau/6)+b*math.sin(j*math.tau/6))))
 for i in range(len(path)-1):
  for j in range(6):a=i*6+j;faces.append((a,i*6+(j+1)%6,(i+1)*6+(j+1)%6,a+6))
 return mesh(name,verts,faces,mat,kind=kind)

# Retain the proven arm/torso skin weights, replace material and cover cut edges.
p=SRC['shirt']['primitives'][0];a=p['attributes'];v=list(zip(*[iter(a['POSITION'])]*3))
arm_axes=[]
for side in ['Left','Right']:
 wrist=bone_head(side+'Hand');axis=(wrist-bone_head(side+'ForeArm')).normalized();arm_axes.append((wrist,axis))
uvs=[]
for i,pv in enumerate(v):
 pnt=Vector(pv)
 if abs(pv[0])>.22:
  wrist,axis=min(arm_axes,key=lambda wa:(pnt-wa[0]).length)
  axial=(wrist-pnt).dot(axis);center=wrist-axis*axial;radial=pnt-center
  # Reduce the lower sleeve itself, allowing a fitted cuff rather than a
  # large cone that merely hides the sleeve's cut edge.
  shrink=.78+.22*smoothstep(.13,.26,axial);pnt=center+radial*shrink
  uvs.append((math.atan2(radial.z,radial.y)*.055*18,axial*18))
 else:
  uvs.append((math.atan2(pv[0],pv[2]-.025)*.14*18,pv[1]*18))
 # Small shaped folds gather into the belt, without displacing neck/arms.
 if abs(pnt.x)<.17 and 1.09<pnt.y<1.35:
  fold=.0035*math.sin(pnt.x*74+(pnt.y-1.1)*14)*math.sin((pnt.y-1.09)/.26*math.pi)
  pnt.z+=math.copysign(fold,pnt.z-.025)
 v[i]=tuple(pnt)
w=[{PALETTE[a['JOINTS_0'][i*4+k]]:a['WEIGHTS_0'][i*4+k] for k in range(4) if a['WEIGHTS_0'][i*4+k]>0} for i in range(len(v))]
f=[]
for prim in SRC['shirt']['primitives']:
 for tri in zip(*[iter(prim['indices'])]*3):
  # The underside of the starter shirt extends toward the crotch; remove it.
  if min(v[i][1] for i in tri)>.995:f.append(tri)
mesh('Tailored tunic',v,f,uvs=uvs,custom_weights=w)

# Continuous high-waisted leather belt, layered raised edges and buckle.
def belt(u,t):
 a=u*math.tau;return (.170*math.sin(a),1.015+t*.088,.033+.124*math.cos(a))
grid('Broad waist belt',4,64,belt,2,kind='belt',thickness=.009)
for t in [.09,.86]:tube('Belt rolled welt',[belt(i/64,t) for i in range(65)],.004,3,'belt')
tube('Rectangular belt buckle',[(-.028,1.048,.157),(-.028,1.09,.157),(.027,1.09,.157),(.027,1.048,.157),(-.028,1.048,.157)],.006,3,'belt')
tube('Buckle pin',[(0,1.053,.16),(0,1.09,.16)],.0025,3,'belt')

# Four separate coat quarters. Open center front/back and sides free the stride.
for k,(start,end) in enumerate([(.15,1.48),(1.64,math.pi-.07),(math.pi+.07,4.64),(4.8,math.tau-.15)]):
 def panel(u,t,start=start,end=end,k=k):
  angle=start+(end-start)*u
  y=1.04-.68*t + .020*math.sin(math.pi*u)*t
  rx=.167+.128*math.sqrt(t);rz=.123+.088*math.sqrt(t)
  pleat=(.009*math.sin(u*math.pi*6+.28*t)+.004*math.sin(u*math.pi*10-.4*t))*math.sin(t*math.pi*.75)
  return ((rx+pleat)*math.sin(angle),y,.028+(rz+pleat)*math.cos(angle))
 grid('Split coat quarter '+str(k),18,18,panel,0,kind='coat',thickness=.007)
 for u in [0,1]:tube('Coat vertical piping',[panel(u,i/24) for i in range(25)],.0035,3,'coat')
 tube('Weighted coat hem',[panel(i/24,1) for i in range(25)],.004,3,'coat')
 for stitch in range(26):
  tube('Coat hem stitch',[panel((stitch+.15)/26,.978),panel((stitch+.57)/26,.978)],.0012,4,'coat')

# Shoulder capelet fitted over the clavicle, with a pointed center back.
def mantle(u,t):
 a=.42+u*(math.tau-.84)
 rx=.108+t*.20;rz=.11+t*.08
 y=1.535-.105*t-.21*(max(0,-math.cos(a))**5)*t
 return (rx*math.sin(a),y,.025+rz*math.cos(a))
grid('Tailored shoulder mantle',8,52,mantle,0,thickness=.01)
tube('Mantle gold edge',[mantle(i/72,1) for i in range(73)],.004)
for stitch in range(52):
 tube('Mantle saddle stitch',[mantle((stitch+.15)/52,.94),mantle((stitch+.52)/52,.94)],.0012,4)
# A small embroidered moon / branching sigil makes the back readable in play.
for sign in [-1,1]:
 tube('Mantle branch sigil',[(0,1.28,-.181),(sign*.028,1.30,-.181),(sign*.046,1.34,-.177)],.0028,3,{'Spine2':1})
tube('Mantle sigil stem',[(0,1.245,-.181),(0,1.36,-.181)],.0028,3,{'Spine2':1})
tube('Mantle crescent',[(.021*math.sin(a),1.375+.023*math.cos(a),-.17) for a in [i*math.pi*1.6/24+.2 for i in range(25)]],.0025,3,{'Spine2':1})

# Hood is an open shell, front aperture + true inner lining, bound to Head.
# Latitude top closes over crown; no torso-sized lathe or faceless mask.
def hood(u,t,inner=False):
 cap=max(0,(t-.55)/.45)
 aperture=.79*(1-cap*cap)+.025
 a=aperture+u*(math.tau-2*aperture)
 y=1.43+.365*t
 radial=max(.015,math.sqrt(max(0,1-cap*cap)))
 fold=.004*math.sin(u*math.pi*8+.5*t)*math.sin(math.pi*t)
 rx=(.146-.010*inner+fold)*radial
 rz=(.155-.010*inner+fold)*radial
 return (rx*math.sin(a),y,.052+rz*math.cos(a))
grid('Structured hood exterior',20,40,hood,0,kind='head',thickness=.008)
grid('Shadowed hood lining',20,40,lambda u,t:hood(u,t,True),1,kind='head')
for u in [0,1]:tube('Hood rolled opening',[hood(u,i/32) for i in range(33)],.004,3,'head')

# High collar seals the former ragged neckline while leaving the face visible.
def collar(u,t):
 a=u*math.tau
 y=1.46+t*(.065-.026*max(0,math.cos(a))**6)
 return ((.12-.035*t)*math.sin(a),y,.022+(.104-.018*t)*math.cos(a))
grid('Standing linen collar',5,40,collar,4,kind={'Neck':.65,'Spine2':.35},thickness=.006)
tube('Collar seam',[collar(i/48,1) for i in range(49)],.0025,3,{'Neck':.65,'Spine2':.35})
# Front overlapping lapels, finite thickness and modeled piping.
for side in [-1,1]:
 def lapel(u,t,side=side):
  x=side*((.07+.12*u)*(1-t)+.009*t)
  y=1.475-.055*u-.365*t
  z=chest_surface(x,y,.033)+.003*math.sin(math.pi*t)
  return (x,y,z)
 grid('Overlapping lapel',18,6,lapel,0,thickness=.006)
 tube('Lapel border',[lapel(1,i/20) for i in range(21)],.003)

# Copy skin-tight boot uppers, adding a proper single toe box and welted soles.
bp=SRC['boots']['primitives'][0];ba=bp['attributes'];bv=list(zip(*[iter(ba['POSITION'])]*3))
for side in [-1,1]:
 foot=[v for v in bv if v[0]*side>0 and v[1]<.10]
 cx=side*.215
 def boot(u,t,side=side,cx=cx):
  a=u*math.tau
  # Elliptical leather shell, narrows toward ankle; rounded single toe box.
  # Keep a low broad toe box, then a distinct vertical ankle shaft.
  taper=min(1,max(0,(t-.20)/.19))
  rx=.064*(1-taper)+.05*taper;rz=.141*(1-taper)+.073*taper
  return (cx+rx*math.sin(a),.018+.32*t,.077*(1-taper)-.001*taper+rz*math.cos(a))
 grid('Leather boot upper',12,36,boot,2,thickness=.005)
 for t in [.02,.86,1]:tube('Boot welt',[boot(i/48,t) for i in range(49)],.0045,2)
 for stitch in range(40):tube('Boot welt stitch',[boot((stitch+.1)/40,.065),boot((stitch+.5)/40,.065)],.0012,4)
 # Instep seam and a narrow ankle strap separate toe box from boot shaft.
 tube('Boot vamp seam',[boot(i/36,.26) for i in range(37)],.002,2)
 grid('Boot ankle strap',2,36,lambda u,v:tuple(Vector(boot(u,.51+v*.08))+Vector((math.sin(u*math.tau),0,math.cos(u*math.tau)))*.002),2)
 grid('Boot sole',2,36,lambda u,t: (boot(u,0)[0],.003+t*.024,boot(u,0)[2]),1,kind={('LeftFoot' if side>0 else 'RightFoot'):1})
 ring=[(boot(i/36,0)[0],.003,boot(i/36,0)[2]) for i in range(36)]
 mesh('Boot closed outsole',ring,[tuple(reversed(range(36)))],1,kind={('LeftFoot' if side>0 else 'RightFoot'):1})

# Fitted leather cuffs follow the forearm bind axis and cover the raw wrist hem.
for side in ['Left','Right']:
 wrist=bone_head(side+'Hand');elbow=bone_head(side+'ForeArm')
 axis=(wrist-elbow).normalized();a=axis.cross(Vector((0,0,1))).normalized();b=axis.cross(a).normalized()
 def cuff(u,t):
  center=wrist-axis*(.008+.16*t);r=.043+.014*t
  return tuple(center+r*(a*math.cos(u*math.tau)+b*math.sin(u*math.tau)))
 grid('Leather forearm cuff '+side,7,28,cuff,2,thickness=.005)
 for t in [0,1]:tube('Cuff edging '+side,[cuff(i/36,t) for i in range(37)],.003)
 for t in [.18,.80]:
  grid('Cuff strap '+side,2,28,lambda u,v,t=t:tuple(Vector(cuff(u,t+v*.075))+(a*math.cos(u*math.tau)+b*math.sin(u*math.tau))*.002),2)

# Export evaluated Blender surfaces with smooth normals / UV and normalized top4.
deps=bpy.context.evaluated_depsgraph_get();result={'materials':NAMES,'parts':[]}
for ob in objects:
 ev=ob.evaluated_get(deps);me=ev.to_mesh();me.calc_loop_triangles()
 part={'name':ob.name,'material':NAMES.index(ob.data.materials[0].name),'positions':[],'normals':[],'uv':[],'joints':[],'weights':[],'indices':[]}
 # Split vertices at UV seams / normals. Shared global arrays are assembled offline.
 for tri in me.loop_triangles:
  for li in tri.loops:
   vert=me.vertices[me.loops[li].vertex_index];p=vert.co;n=me.corner_normals[li].vector
   part['positions'] += [p.x,p.z,-p.y];part['normals'] += [n.x,n.z,-n.y]
   part['uv'] += list(me.uv_layers.active.data[li].uv)
   ww=sorted([(PALETTE.index(ob.vertex_groups[g.group].name),g.weight) for g in vert.groups if g.weight>0],key=lambda q:-q[1])[:4]
   if not ww:raise RuntimeError('Unweighted vertex '+ob.name)
   total=sum(q[1] for q in ww);ww=[(j,w/total) for j,w in ww]
   ww += [(0,0)]*(4-len(ww));part['joints'] += [j for j,w in ww];part['weights'] += [w for j,w in ww]
   part['indices'].append(len(part['indices']))
 result['parts'].append(part);ev.to_mesh_clear()
OUT.write_text(json.dumps(result,separators=(',',':')))
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'blender/characters/human-mage-coat-v1.blend'))
print('MAGE_GEOMETRY',sum(len(p['indices'])//3 for p in result['parts']),'triangles',OUT)
