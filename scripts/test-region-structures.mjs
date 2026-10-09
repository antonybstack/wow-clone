import test from 'node:test';
import assert from 'node:assert/strict';
import {Batch} from '../src/ashen-reach/geometry.js';
import {buildRegionStructures} from '../src/ashen-reach/region-structures.js';

const landmarks=[
 {id:'east-keep',name:'Eastwatch',kind:'keep',x:196,z:-38,floorY:45.688,yaw:Math.PI/2,height:39,width:32},
 {id:'west',kind:'keep',x:-186,z:112,floorY:49.655,yaw:-Math.PI/2,height:35,width:32},
 {id:'south',kind:'keep',x:74,z:-214,floorY:54.184,yaw:Math.PI,height:43,width:32},
 {id:'east-tower',kind:'tower',x:132,z:-55,floorY:19.792,yaw:0,height:24,width:6},
 {id:'west-tower',kind:'tower',x:-125,z:-80,floorY:5.347,yaw:0,height:22,width:6},
 {id:'north-tower',kind:'tower',x:78,z:168,floorY:13.886,yaw:0,height:26,width:6},
];
const create=()=>Object.fromEntries(['stone','roof','rock','glow'].map(name=>[name,new Batch(name)]));
const batches=create();batches.stone.tri([-1,0,0],[0,0,1],[1,0,0]);
const before=Object.fromEntries(['p','n','idx'].map(key=>[key,[...batches.stone[key]]]));
const built=buildRegionStructures({...batches,landmarks,groundHeight:(x,z)=>2+Math.sin(x*.04)+Math.cos(z*.03)});
const sub=(a,b)=>a.map((v,i)=>v-b[i]);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
const point=(site,u,y,d)=>[site.x+u*Math.cos(site.yaw)+d*Math.sin(site.yaw),site.floorY+y,site.z-u*Math.sin(site.yaw)+d*Math.cos(site.yaw)];
const collision=built.collisionBatch;
const triangles=[];
for(let i=0;i<collision.idx.length;i+=3){
 const [a,b,c]=collision.idx.slice(i,i+3).map(index=>collision.p.slice(index*3,index*3+3));
 triangles.push({a,ab:sub(b,a),ac:sub(c,a)});
}
function hit(from,to){
 const direction=sub(to,from);let result=null;
 for(const {a,ab,ac} of triangles){
  const p=cross(direction,ac),det=dot(ab,p);if(Math.abs(det)<1e-9)continue;
  const t=sub(from,a),u=dot(t,p)/det;if(u< -1e-9||u>1+1e-9)continue;
  const q=cross(t,ab),v=dot(direction,q)/det;if(v< -1e-9||u+v>1+1e-9)continue;
  const fraction=dot(ac,q)/det;
  if(fraction>=0&&fraction<=1&&(!result||fraction<result.fraction))result={fraction,normal:cross(ab,ac)};
 }
 return result;
}

test('all six landmarks retain position, orientation and skyline with bounded geometry',()=>{
 assert.equal(built.destinations.length,6);assert(built.triangles>3000&&built.triangles<13000);
 const walk=built.destinations.find(s=>s.id==='east-keep').wallWalk;
 assert.equal(built.triangles-built.collisionTriangles,walk.stairs.visualTriangles-walk.rampTriangles,'only visible stair treads differ from their smooth collision ramp');
 for(let i=0;i<landmarks.length;i++){
  const a=landmarks[i],b=built.destinations[i];assert.equal(b.id,a.id);assert.equal(b.floorY,a.floorY);
  assert.deepEqual(b.entrance,point(a,0,0,a.kind==='keep'?-20:-3));
  assert.equal(b.topY,a.floorY+a.height*(a.kind==='keep'?1.05:1.23));
 }
 for(const key of ['p','n','idx'])assert.deepEqual(batches.stone[key].slice(0,before[key].length),before[key]);
});

test('all material and collision triangles are finite, nondegenerate and coherently wound',()=>{
 for(const batch of [...Object.values(batches),collision]){
  for(const key of ['p','n','u','c'])assert(batch[key].every(Number.isFinite),`${batch.name}.${key}`);
  const count=batch.p.length/3;assert.equal(batch.n.length,count*3);assert.equal(batch.u.length,count*2);assert.equal(batch.c.length,count*4);
  assert(batch.idx.every(index=>Number.isInteger(index)&&index>=0&&index<count));
  for(let i=0;i<batch.idx.length;i+=3){
   const [a,b,c]=batch.idx.slice(i,i+3).map(index=>batch.p.slice(index*3,index*3+3)),normal=cross(sub(b,a),sub(c,a));
   assert(Math.hypot(...normal)>1e-8,`${batch.name}: triangle ${i/3}`);
   for(const index of batch.idx.slice(i,i+3))assert(dot(normal,batch.n.slice(index*3,index*3+3))>0,'winding agrees with lighting');
  }
 }
});

test('threshold, courtyard, hall and return have continuous flush floors and capsule clearance',()=>{
 for(const site of landmarks){
  const start=site.kind==='keep'?-21:-3.8,end=site.kind==='keep'?13:1.5;
  for(let d=start;d<end;d+=.5)for(const u of [-.42,0,.42]){
   const floor=hit(point(site,u,.3,d),point(site,u,-.3,d));
   assert(floor&&Math.abs(floor.fraction-.5)<1e-7&&floor.normal[1]>0,`${site.id} supported at ${u},${d}`);
   for(const h of [.15,1,1.95])assert.equal(hit(point(site,u,h,d),point(site,u,h,d+.45)),null,`${site.id} clearance ${d},${h}`);
  }
 }
});

test('gate and hall widths are genuinely open, with solid jambs, walls and ceilings',()=>{
 for(const site of landmarks){
  const keep=site.kind==='keep',front=keep?-20:-3,half=keep?2.5:1.5;
  for(const u of [-half+.12,0,half-.12])assert.equal(hit(point(site,u,1.9,front-1),point(site,u,1.9,front+1.5)),null,`${site.id} gate width`);
  assert(hit(point(site,half+.8,1,front-1),point(site,half+.8,1,front+1.5)),`${site.id} solid jamb`);
  if(keep){
   for(const u of [-1.35,0,1.35])assert.equal(hit(point(site,u,1.9,-3),point(site,u,1.9,0)),null,`${site.id} hall doorway`);
   assert(hit(point(site,0,1,14),point(site,0,1,18)),'hall back wall');
   assert(hit(point(site,0,2,5),point(site,9,2,5)),'hall side wall');
   assert(hit(point(site,2,20,5),point(site,2,2,5)),'hall roof');
  }else{
   assert(hit(point(site,0,1,1),point(site,0,1,4)),'tower back wall');
   assert(hit(point(site,0,1,0),point(site,4,1,0)),'tower side wall');
   assert(hit(point(site,0,10,0),point(site,0,2,0)),'tower ceiling');
  }
 }
});

test('invalid sites fail before modifying shared batches',()=>{
 for(const replacement of [{floorY:NaN},{yaw:NaN},{height:0}]){
  const empty=create();assert.throws(()=>buildRegionStructures({...empty,groundHeight:()=>0,landmarks:[{...landmarks[0],...replacement}]}));
  assert(Object.values(empty).every(batch=>batch.idx.length===0));
 }
 const empty=create();assert.throws(()=>buildRegionStructures({...empty,groundHeight:()=>NaN,landmarks}),/finite/);
 assert(Object.values(empty).every(batch=>batch.idx.length===0));
});


test('raised rear lancets are open views with solid lower walls and pointed crowns',()=>{
 for(const site of landmarks){
  const keep=site.kind==='keep',d=keep?15.5:2.6;
  const {bottom,spring,tip,width}=built.destinations.find(s=>s.id===site.id).rearWindow;
  // Stop beyond the actual rear wall, before Eastwatch's new outside guard.
  const back=(u,h)=>hit(point(site,u,h,d-1),point(site,u,h,d+.6));
  for(const h of [bottom+.15,spring,tip-.25])assert.equal(back(0,h),null,`${site.id} actual view at ${h}`);
  assert(back(0,bottom-.2),`${site.id} lower masonry remains solid`);
  assert(back(0,tip+.2),`${site.id} crown masonry remains solid`);
  assert(back(width/2+.6,spring-.5),`${site.id} jamb masonry remains solid`);
 }
});

test('Eastwatch stairs and all high turns are continuously supported with capsule headroom',()=>{
 const site=landmarks[0],walk=built.destinations[0].wallWalk;
 assert(walk&&walk.clearWidth>=1.8&&walk.railHeight>=1.1);
 assert.equal(walk.stairs.run,16);assert(walk.stairs.rise/walk.stairs.run<Math.tan(20*Math.PI/180));
 const samples=[];
 for(let d=-10;d<=6;d+=.25)samples.push([13.6,5.2*(d+10)/16,d]);
 for(let d=6;d<=17.6;d+=.25)samples.push([13.6,5.2,d]);
 for(let u=-13.6;u<=13.6;u+=.25)samples.push([u,5.2,17.6]);
 for(let d=-8.8;d<=17.6;d+=.25)samples.push([-13.6,5.2,d]);
 for(const [u,y,d] of samples){
  const floor=hit(point(site,u,y+.25,d),point(site,u,y-.25,d));
  assert(floor&&Math.abs(floor.fraction-.5)<1e-7&&floor.normal[1]>0,`high floor ${u},${d}`);
  for(const du of [-.32,0,.32])assert.equal(hit(point(site,u+du,y+.04,d),point(site,u+du,y+1.95,d)),null,`headroom ${u+du},${d}`);
 }
});

test('Eastwatch inner/outer guards and rear lancet view are physically real',()=>{
 const site=landmarks[0];
 for(const d of [-8,-2,4,9,14]){
  const y=d<6?5.2*(d+10)/16:5.2;
  assert(hit(point(site,13.6,y+.6,d),point(site,11.8,y+.6,d)),`inner stair/walk guard ${d}`);
  assert(hit(point(site,13.6,y+.6,d),point(site,16,y+.6,d)),`outer masonry ${d}`);
 }
 for(const u of [-10,6,10]){
  assert(hit(point(site,u,5.8,17.6),point(site,u,5.8,15.8)),'rear inner parapet');
  assert(hit(point(site,u,5.8,17.6),point(site,u,5.8,20.5)),'rear outer wall');
 }
 assert(hit(point(site,-13.6,5.8,-8.8),point(site,-13.6,5.8,-11)),'left end guard');
 assert.equal(hit(point(site,0,6.9,17.6),point(site,0,6.9,14)),null,'view over the guard through the actual raised opening');
});

test('Eastwatch balcony joins through a clear raised door while preserving the lower hall lane',()=>{
 const site=landmarks[0],balcony=built.destinations[0].wallWalk.hallBalcony;
 assert(balcony.clearWidth>=1.8&&balcony.headroom>=1.9);
 assert.deepEqual(built.destinations[0].rearWindow,{bottom:3.2,spring:6.4,tip:9,width:3.8});
 for(let d=9.75;d<=17.6;d+=.25)for(const u of [-.9,0,.9]){
  const floor=hit(point(site,u,5.45,d),point(site,u,4.95,d));
  assert(floor&&Math.abs(floor.fraction-.5)<1e-7&&floor.normal[1]>0,`balcony floor ${u},${d}`);
  assert.equal(hit(point(site,u,5.24,d),point(site,u,7.15,d)),null,`balcony headroom ${u},${d}`);
 }
 for(const u of [-1.3,0,1.3])for(const h of [.2,1,1.95])assert.equal(hit(point(site,u,h,8),point(site,u,h,13)),null,'lower hall lane remains open');
 for(const u of [-1.2,0,1.2])assert.equal(hit(point(site,u,7.15,14),point(site,u,7.15,17.6)),null,'raised door capsule-width offsets');
 assert.equal(hit(point(site,0,5.8,17.6),point(site,0,5.8,14)),null,'rear guard really opens into bridge');
 assert(hit(point(site,0,5.8,11),point(site,0,5.8,8)),'balcony front guard');
 for(const sign of [-1,1]){
  assert(hit(point(site,0,5.8,13.5),point(site,sign*3,5.8,13.5)),'balcony side guard');
  assert(hit(point(site,0,5.8,16),point(site,sign*2,5.8,16)),'bridge side guard');
 }
});

test('Eastwatch upper view has closed gables beneath the retained roof outline',()=>{
 const site=landmarks[0];
 assert(hit(point(site,5.2,11,0),point(site,5.2,11,-4)),'front gable closes above the ground portal');
 assert(hit(point(site,5.2,11,14),point(site,5.2,11,18)),'rear gable closes outside the upper keep body');
 assert.equal(hit(point(site,0,7.15,14),point(site,0,7.15,17.6)),null,'raised door stays open below the gable');
});
