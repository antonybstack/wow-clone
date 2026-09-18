import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parseGlb,readAccessor} from '../src/character/runtime/glb.js';
import {applyArmedMage,armedMageGrip,armedMagePlayback} from '../src/character/runtime/armed-mage.js';
import {fileSha256,jointRestWorld} from '../src/character/runtime/fit-contract.js';
const bytes=await readFile('public/characters/bodies/human-animated-v1.glb');
const buffer=bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);
const pose=JSON.parse(await readFile('public/characters/animations/human-mage-armed-v1.json'));

test('armed poses preserve mesh/bind data and all unedited channels',async()=>{
 assert.equal(await fileSha256(buffer),`sha256:${pose.sourceSha256}`);
 const before=parseGlb(buffer),after=parseGlb(applyArmedMage(buffer,pose));
 for(const key of ['nodes','skins','meshes','materials','scenes'])assert.deepEqual(after.json[key],before.json[key]);
 assert.deepEqual(after.binary.slice(0,before.binary.length),before.binary);
 assert.equal(after.json.animations.length,7);
 for(const a of before.json.animations){
  const patched=after.json.animations.find(b=>b.name===a.name),authored=pose.clips.find(c=>c.name===a.name);
  assert.ok(authored);
  for(const c of a.channels){
   const pc=patched.channels.find(p=>p.target.node===c.target.node&&p.target.path===c.target.path);
   const name=before.json.nodes[c.target.node].name;
   const values=c.target.path==='rotation'?authored.rotations[name]:c.target.path==='translation'?authored.translations?.[name]:null;
   if(values){
    assert.deepEqual(readAccessor(after.json,after.binary,patched.samplers[pc.sampler].output),new Float32Array(values.flat()));
   }else for(const key of ['input','output'])assert.deepEqual(readAccessor(after.json,after.binary,patched.samplers[pc.sampler][key]),readAccessor(before.json,before.binary,a.samplers[c.sampler][key]));
  }
 }
});
test('loop seam and finger grasp remain continuous across authored clips',()=>{
 const grip=pose.clips[0].rotations['finger3-2.R'][0];
 for(const c of pose.clips){
  for(const q of c.rotations['finger3-2.R'])assert.ok(Math.abs(Math.abs(q.reduce((s,v,i)=>s+v*grip[i],0))-1)<1e-5);
  if(['idle','walk','run','jumpLoop'].includes(c.name))for(const keys of [...Object.values(c.rotations),...Object.values(c.translations||{})])assert.deepEqual(keys.at(-1),keys[0]);
 }
});
test('grip transform maps staff Y to the measured wrist-frame axis',()=>{
 const offset=[.0051,.0696,.0011],g=armedMageGrip(pose,offset),q=g.rotationQuaternion;
 assert.ok(Math.abs(Math.hypot(q.x,q.y,q.z,q.w)-1)<1e-6);
 const axis=[2*(q.x*q.y-q.w*q.z),1-2*(q.x*q.x+q.z*q.z),2*(q.y*q.z+q.w*q.x)];
 const expected=[pose.grip.axis[0],-pose.grip.axis[1],pose.grip.axis[2]];
 axis.forEach((v,i)=>assert.ok(Math.abs(v-expected[i])<1e-6));
 assert.ok(Math.abs(g.position.y+offset[1]+pose.grip.center[1])<1e-9);
});
test('wrong rig and invalid authored channels fail before loading',()=>{
 const wrong=structuredClone(pose);wrong.nodeNames[0]='wrong';assert.throws(()=>applyArmedMage(buffer,wrong),/layout mismatch/);
 const bad=structuredClone(pose);bad.clips[0].rotations.RightHand[0]=[0,0,0,0];assert.throws(()=>applyArmedMage(buffer,bad),/quaternion/);
 const translated=structuredClone(pose);translated.clips[0].translations={Head:[[0,0,0]]};assert.throws(()=>applyArmedMage(buffer,translated),/translation/);
});
test('authored stride cadence tracks travel speed without changing legacy poses',()=>{
 for(const name of ['walk','run']){
  const g=pose.locomotion[name],duration=pose.clips.find(c=>c.name===name).times.at(-1);
  assert.ok(Math.abs(duration/armedMagePlayback(pose,name,g.speed)-g.cycleSeconds)<1e-9);
  assert.ok(Math.abs(g.span/(g.stance*g.cycleSeconds)-g.speed)<1e-6);
  assert.ok(Math.abs(armedMagePlayback(pose,name,g.speed*.5)*2-armedMagePlayback(pose,name,g.speed))<1e-9);
 }
 assert.equal(armedMagePlayback(null,'run',7),null);
});
test('baked posture avoids the hunch, deep stride collapse and airborne landing feet',()=>{
 const source=parseGlb(buffer).json,names=new Map(source.nodes.map((n,i)=>[n.name,i]));
 const point=(j,name)=>jointRestWorld(j,names.get(name)).world.slice(12,15);
 for(const clip of pose.clips){
  for(let k=0;k<clip.times.length;k++){
   const j={nodes:structuredClone(source.nodes)};
   for(const [name,keys]of Object.entries(clip.rotations))j.nodes[names.get(name)].rotation=keys[k];
   for(const [name,keys]of Object.entries(clip.translations||{}))j.nodes[names.get(name)].translation=keys[k];
   const hips=point(j,'Hips'),neck=point(j,'Neck');
   const lean=Math.atan2(neck[2]-hips[2],neck[1]-hips[1])*180/Math.PI;
   assert.ok(lean>2&&lean<15,`${clip.name}: torso lean ${lean}`);
   assert.ok(hips[1]>.79&&hips[1]<.95,`${clip.name}: pelvis height ${hips[1]}`);
   if(clip.name==='jumpLand')for(const side of ['Left','Right'])assert.ok(point(j,side+'Foot')[1]<.085,'landing must not replay airborne takeoff');
  }
 }
});
