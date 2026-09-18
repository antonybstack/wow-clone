"""Offline Human mage poses. Blender mathutils; canonical GLB never rewritten.

Author hand targets / elbow poles below. Solve arms in the original glTF basis,
not an imported armature's different local bone axes. mage_motion authors the
torso/legs and bounded Hips translation. Apply after garment composition.
"""
import json,math,bisect,sys
from pathlib import Path
from mathutils import Vector,Quaternion,Matrix
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(Path(__file__).resolve().parent))
import mage_motion
src=json.loads((ROOT/'.cache/armed-mage/source.json').read_text())
nodes=src['nodes'];names={n['name']:i for i,n in enumerate(nodes)}
parents={c:i for i,n in enumerate(nodes) for c in n.get('children',[])}
def quat(v):return Quaternion((v[3],*v[:3]))
rest=[(Vector(n.get('translation',[0,0,0])),quat(n.get('rotation',[0,0,0,1])),Vector(n.get('scale',[1,1,1]))) for n in nodes]
def worlds(local):
 w={}
 def get(i):
  if i not in w:w[i]=(get(parents[i]) if i in parents else Matrix.Identity(4))@Matrix.LocRotScale(*local[i])
  return w[i]
 for i in range(len(nodes)):get(i)
 return w
rw=worlds(rest)
def sample(a,t):
 local=[(v.copy(),r.copy(),s.copy()) for v,r,s in rest]
 for c in a['channels']:
  sm=a['samplers'][c['sampler']];times=sm['input'];k=max(0,min(len(times)-2,bisect.bisect_right(times,t)-1));j=min(k+1,len(times)-1)
  f=max(0,min(1,(t-times[k])/max(1e-9,times[j]-times[k])));path=c['target']['path'];size=4 if path=='rotation' else 3
  v=sm['output'][k*size:(k+1)*size];v2=sm['output'][j*size:(j+1)*size]
  value=quat(v).slerp(quat(v2),f) if path=='rotation' else Vector(v).lerp(Vector(v2),f)
  i=c['target']['node'];tr,r,sc=local[i];local[i]=(value if path=='translation' else tr,value if path=='rotation' else r,value if path=='scale' else sc)
 return local
def rotation(local,name,q):
 i=names[name];t,_,s=local[i];local[i]=(t,q.normalized(),s)
def world_rotation(local,name,q):
 w=worlds(local);i=names[name];parent=w[parents[i]].to_quaternion() if i in parents else Quaternion()
 rotation(local,name,parent.inverted()@q)
def aim(local,name,end,target):
 w=worlds(local);i=names[name];j=names[end]
 delta=(w[j].translation-w[i].translation).rotation_difference(target-w[i].translation)
 world_rotation(local,name,delta@w[i].to_quaternion())

# Palm frame from anatomical metacarpals: across knuckles, toward fingers,
# toward the palm. The staff runs across the curled fingers, not along them.
hand_inv=rw[names['RightHand']].inverted()
mcps=[(hand_inv@rw[names[f'finger{i}-1.R']]).translation for i in range(2,6)]
axis=(mcps[-1]-mcps[0]).normalized()
forward=mcps[1]-axis*mcps[1].dot(axis);forward.normalize()
palm=-axis.cross(forward).normalized()
center=sum(mcps,Vector())/4+palm*.034
source_basis=Matrix((axis,forward,palm)).transposed()
dest_basis=Matrix((Vector((0,-1,0)),Vector((0,0,1)),Vector((1,0,0)))).transposed()
hand_world=(dest_basis@source_basis.transposed()).to_quaternion()

# Shape each finger around the grip cylinder while preserving bone lengths.
# MCP offsets remain anatomical; the arc radius includes finger thickness.
grip_local=[(v.copy(),r.copy(),s.copy()) for v,r,s in rest]
for finger in range(2,6):
 start=mcps[finger-2];along=(start-center).dot(axis)
 ring_center=center+axis*along;radial=start-ring_center;radius=radial.length
 for segment in range(1,4):
  name=f'finger{finger}-{segment}.R';w=worlds(grip_local)
  current=(hand_inv@w[names[name]]).translation
  length=(rest[names[f'finger{finger}-{segment+1}.R']][0].length if segment<3 else .019)
  angle=2*math.asin(min(.95,length/(2*radius)))
  next_radial=Quaternion(axis,-angle)@radial
  target=rw[names['RightHand']]@(ring_center+next_radial)
  old_dir=rw[names[name]].to_quaternion()@Vector((0,1,0))
  desired=(target-w[names[name]].translation).normalized()
  world_rotation(grip_local,name,old_dir.rotation_difference(desired)@rw[names[name]].to_quaternion())
  radial=next_radial
# Thumb opposes the fingers on the upper side of the cylinder.
for segment,target in [(1,center-axis*.026-palm*.025),(2,center-axis*.021+forward*.024),(3,center-axis*.012+forward*.016)]:
 name=f'finger1-{segment}.R';w=worlds(grip_local);origin=w[names[name]].translation
 old_dir=rw[names[name]].to_quaternion()@Vector((0,1,0));desired=rw[names['RightHand']]@target-origin
 world_rotation(grip_local,name,old_dir.rotation_difference(desired.normalized())@rw[names[name]].to_quaternion())

fingers=[n for n in names if n.startswith('finger') and n.endswith('.R')]
arm_names=[f'{side}{part}' for side in ['Left','Right'] for part in ['Arm','ForeArm','Hand']]+[f'{part}.{side}' for side in ['L','R'] for part in ['upperarm02','lowerarm02']]
changed=arm_names+fingers+mage_motion.ROTATIONS
out={'schema':2,'profileId':'human-v1','sourceSha256':src['sha256'],'nodeNames':[n['name'] for n in nodes],
     'grip':{'center':list(center),'axis':list(-axis)},'locomotion':mage_motion.GAITS,'clips':[]}
for a in src['animations']:
 duration=max(max(s['input']) for s in a['samplers']);count=round(duration*30)+1;times=[duration*i/(count-1) for i in range(count)]
 channels={n:[] for n in changed};translations={'Hips':[]}
 for t in times:
  local=sample(a,t);phase=t/duration;wave=math.sin(phase*math.tau)
  hip_delta=mage_motion.author(local,a['name'],t,duration,globals())
  mode=a['name'];running=mode=='run';walking=mode=='walk';jump=mode.startswith('jump');cast=mode=='cast'
  # Stable carrying hand, free arm counter-swing, compact jump balance.
  right=Vector((-.40,.99,.19));left=Vector((.35,.89,.025))
  if running or walking:
   right+=Vector((0,.055 if running else .015,-.035*wave))
   left+=Vector((.005,.10 if running else .025,(.17 if running else .10)*wave))
  elif jump:
   right+=Vector((-.01,.06,.015));left+=Vector((.025,.09,.08))
  elif cast:
   reach=math.sin(math.pi*min(1,phase))**.7
   right+=Vector((-.01,.12*reach,.06*reach));left+=Vector((.035,.30*reach,.35*reach))
  else:
   right.y+=.004*math.sin(phase*math.tau);left.y+=.004*math.sin(phase*math.tau)
  for side,letter,target in [('Right','R',right),('Left','L',left)]:
   for n in [side+'Arm',side+'ForeArm',side+'Hand','upperarm02.'+letter,'lowerarm02.'+letter]:rotation(local,n,rest[names[n]][1])
   w=worlds(local);s=w[names[side+'Arm']].translation;e=w[names[side+'ForeArm']].translation;h=w[names[side+'Hand']].translation
   l1=(e-s).length;l2=(h-e).length;target+=hip_delta
   direction=target-s;distance=min(direction.length,(l1+l2)*.975);direction.normalize();target=s+direction*distance
   pole=Vector((-.25 if side=='Right' else .25,-.15,-1));pole-=direction*pole.dot(direction);pole.normalize()
   along=(l1*l1-l2*l2+distance*distance)/(2*distance);height=math.sqrt(max(0,l1*l1-along*along))
   elbow=s+direction*along+pole*height
   aim(local,side+'Arm',side+'ForeArm',elbow);aim(local,side+'ForeArm',side+'Hand',target)
   if side=='Right':
    tilt=Quaternion(Vector((1,0,0)),(.035*wave if running or walking else -.10*math.sin(math.pi*phase) if cast else 0))
    world_rotation(local,'RightHand',tilt@hand_world)
   else:
    # Preserve the existing relaxed/expressive hand orientation relative to arm.
    rotation(local,'LeftHand',sample(a,t)[names['LeftHand']][1])
  for n in fingers:rotation(local,n,grip_local[names[n]][1])
  translations['Hips'].append(list(local[names['Hips']][0]))
  for n in changed:
   q=local[names[n]][1];prev=channels[n][-1] if channels[n] else None
   v=[q.x,q.y,q.z,q.w]
   if prev and sum(x*y for x,y in zip(prev,v))<0:v=[-x for x in v]
   channels[n].append(v)
 if mode in ['idle','walk','run','jumpLoop']:
  for n in changed:channels[n][-1]=channels[n][0][:]
  translations['Hips'][-1]=translations['Hips'][0][:]
 out['clips'].append({'name':a['name'],'times':times,'rotations':channels,'translations':translations})
dest=ROOT/'public/characters/animations/human-mage-armed-v1.json';dest.parent.mkdir(parents=True,exist_ok=True);dest.write_text(json.dumps(out,separators=(',',':')))
print('ARMED_MAGE',len(out['clips']),'clips',len(changed),'rotation channels per clip','grip',out['grip'])
