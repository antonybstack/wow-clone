import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {parseGlb,readAccessor} from '../src/character/runtime/glb.js';
const load=p=>{const b=fs.readFileSync(p);return parseGlb(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength));};
const original=load('public/characters/candidates/human-source-v1.glb'),current=load('public/ashen-reach/wanderer.glb');
const tracks=(asset,a)=>new Map(a.channels.map(c=>[asset.json.nodes[c.target.node].name+':'+c.target.path,a.samplers[c.sampler]]));
const values=(asset,i)=>readAccessor(asset.json,asset.binary,i);
test('Ashen directional import preserves all original 45 motion curves exactly',()=>{
 for(const a of original.json.animations){
  const b=current.json.animations.find(b=>b.name===a.name);assert.ok(b,a.name);
  const have=tracks(current,b);
  assert.equal(have.size,a.channels.length);
  for(const [name,s]of tracks(original,a)){
   const t=have.get(name);assert.ok(t,name);
   assert.equal(t.interpolation||'LINEAR',s.interpolation||'LINEAR');
   assert.deepEqual(values(current,t.input),values(original,s.input));
   assert.deepEqual(values(current,t.output),values(original,s.output));
  }
 }
});
test('directional import preserves the source-human joint bind and rest transforms',()=>{
 const a=original.json.skins[0],b=current.json.skins[0];
 assert.equal(b.joints.length,65);
 assert.deepEqual(values(current,b.inverseBindMatrices),values(original,a.inverseBindMatrices));
 for(let i=0;i<a.joints.length;i++){
  const x=original.json.nodes[a.joints[i]],y=current.json.nodes[b.joints[i]];
  for(const k of ['name','translation','rotation','scale','matrix'])assert.deepEqual(y[k],x[k],x.name+' '+k);
 }
});
test('five added motions contain complete finite joint channels and no capsule/root transform tracks',()=>{
 assert.equal(current.json.animations.length,57);
 for(const name of ['Jog_Bwd_Loop','Jog_Left_Loop','Jog_Right_Loop','Turn90_L','Turn90_R']){
  const a=current.json.animations.find(a=>a.name===name);assert.ok(a,name);assert.equal(a.channels.length,53);
  const channels=tracks(current,a);assert.equal(channels.size,53);
  for(const [target,s]of channels){
   assert.ok(target.startsWith('mixamorig:'),target);
   if(target.endsWith(':translation'))assert.equal(target,'mixamorig:Hips:translation');
   assert.ok([...values(current,s.output)].every(Number.isFinite));
   assert.ok(values(current,s.input).at(-1)>0);
  }
 }
 const provenance=JSON.parse(fs.readFileSync('public/ashen-reach/animation-provenance.json'));
 assert.equal(provenance.outputSha256,createHash('sha256').update(fs.readFileSync('public/ashen-reach/wanderer.glb')).digest('hex'));
});

test('imported pelvis motion retains metre-scale excursion under the centimetre rig',()=>{
 for(const name of ['Jog_Bwd_Loop','Jog_Left_Loop','Jog_Right_Loop']){
  const a=current.json.animations.find(a=>a.name===name);
  const s=tracks(current,a).get('mixamorig:Hips:translation');
  const v=values(current,s.output),y=[];
  for(let i=1;i<v.length;i+=3)y.push(v[i]);
  // This rig stores centimetres beneath RootNode's .01 uniform scale.
  const root=current.json.nodes.find(n=>n.name==='RootNode');
  assert.ok(Math.abs(root.scale[1]-.01)<1e-7);
  const metres=(Math.max(...y)-Math.min(...y))*root.scale[1];
  assert.ok(metres>.15&&metres<.25,`${name}: ${metres}m pelvis excursion; check import units`);
 }
});

test('fire cast layers partition the authored joints, start/end at their additive baseline, and retain the bind',()=>{
 const channels=new Set();for(const name of ['FireBlast_Upper','FireBlast_Lower']){
  const a=current.json.animations.find(a=>a.name===name);assert.ok(a,name);
  for(const [target,s] of tracks(current,a)){
   assert.ok(!channels.has(target),'duplicate '+target);channels.add(target);assert.ok(target.startsWith('mixamorig:'));
   const v=values(current,s.output),times=values(current,s.input),n=target.endsWith(':rotation')?4:3;
   assert.ok(Math.abs(times.at(-1)-1.4)<1e-5);assert.ok([...v].every(Number.isFinite));
   for(let j=0;j<n;j++)assert.ok(Math.abs(v[j]-v[v.length-n+j])<1e-5,target+' recovery');
  }
 }
 assert.equal(channels.size,53);
 const provenance=JSON.parse(fs.readFileSync('public/ashen-reach/fire-cast-provenance.json'));assert.equal(provenance.releaseTime,.55);assert.equal(provenance.hand,'mainHand');
});

test('lava layers preserve the additive reference, complete joint partition and authored release timing',()=>{
 const seen=new Set();
 for(const name of ['LavaBall_Upper','LavaBall_Lower']){
  const a=current.json.animations.find(a=>a.name===name);assert.ok(a,name);
  for(const [target,s] of tracks(current,a)){
   assert.ok(!seen.has(target));seen.add(target);const v=values(current,s.output),t=values(current,s.input),n=target.endsWith(':rotation')?4:3;
   assert.ok([...v].every(Number.isFinite));assert.ok(Math.abs(t.at(-1)-2.3)<1e-5);
   for(let j=0;j<n;j++)assert.ok(Math.abs(v[j]-v[v.length-n+j])<1e-5,target);
  }
 }
 assert.equal(seen.size,53);const p=JSON.parse(fs.readFileSync('public/ashen-reach/lava-cast-provenance.json'));assert.equal(p.releaseTime,1.5);assert.equal(p.outputSha256,createHash('sha256').update(fs.readFileSync('public/ashen-reach/wanderer.glb')).digest('hex'));
});

test('pyre layers preserve the additive reference, two-handed partition and slam release timing',()=>{
 const seen=new Set();
 for(const name of ['PyreBurst_Upper','PyreBurst_Lower']){
  const a=current.json.animations.find(a=>a.name===name);assert.ok(a,name);
  for(const [target,s] of tracks(current,a)){
   assert.ok(!seen.has(target));seen.add(target);const v=values(current,s.output),t=values(current,s.input),n=target.endsWith(':rotation')?4:3;
   assert.ok([...v].every(Number.isFinite));assert.ok(Math.abs(t.at(-1)-1.9)<1e-5);
   for(let j=0;j<n;j++)assert.ok(Math.abs(v[j]-v[v.length-n+j])<1e-5,target);
  }
 }
 assert.equal(seen.size,53);const p=JSON.parse(fs.readFileSync('public/ashen-reach/pyre-cast-provenance.json'));assert.equal(p.releaseTime,1.1);assert.equal(p.outputSha256,createHash('sha256').update(fs.readFileSync('public/ashen-reach/wanderer.glb')).digest('hex'));
});
