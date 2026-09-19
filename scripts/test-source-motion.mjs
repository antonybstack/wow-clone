import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {mat4} from 'gl-matrix';
import {parseGlb,readAccessor} from '../src/character/runtime/glb.js';
import {resolvePlayableBody,resolvePlayableClips} from '../src/character/runtime/playable-body.js';
function load(path){const b=fs.readFileSync(path);return parseGlb(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength));}
const source=load('public/characters/base.glb');
function tracks(asset,a){return new Map(a.channels.map(c=>[asset.json.nodes[c.target.node].name+':'+c.target.path,{channel:c,sampler:a.samplers[c.sampler]}]));}
function values(asset,index){return readAccessor(asset.json,asset.binary,index);}
const RUNTIME_EXTRA_CLIPS=['Jog_Bwd_Loop','Jog_Left_Loop','Jog_Right_Loop','Turn90_L','Turn90_R','FireBlast_Upper','FireBlast_Lower','LavaBall_Upper','LavaBall_Lower','Walk_Carry_Loop'];
const candidates=[
 {path:'public/characters/candidates/human-source-v1.glb',meshes:['HumanBody','HumanBrows','HumanEyes','HumanHair','HumanShorts'],extra:[]},
 {path:'public/characters/candidates/orc-source-v1.glb',meshes:['OrcV1Body','OrcV1Brows','OrcV1Eyes','OrcV1Hair','OrcV1Shorts'],extra:RUNTIME_EXTRA_CLIPS},
];
for(const {path:candidatePath,meshes:expectedMeshes,extra:expectedExtra} of candidates){
const candidate=load(candidatePath);
test(`${candidatePath} preserves every source rotation key, interpolation and timestamp`,()=>{
 assert.equal(candidate.json.animations.length,source.json.animations.length+expectedExtra.length);
 for(const name of expectedExtra)assert.ok(candidate.json.animations.some(a=>a.name===name),name);
 for(const src of source.json.animations){
  const dst=candidate.json.animations.find(a=>a.name===src.name);assert.ok(dst,src.name);
  const have=tracks(candidate,dst);assert.equal(have.size,src.channels.length);
  for(const [key,{sampler:a}]of tracks(source,src)){
   const b=have.get(key)?.sampler;assert.ok(b,key);
   assert.equal(b.interpolation||'LINEAR',a.interpolation||'LINEAR');
   assert.deepEqual(values(candidate,b.input),values(source,a.input),src.name+' '+key+' timing');
   if(key.endsWith(':rotation'))assert.deepEqual(values(candidate,b.output),values(source,a.output),src.name+' '+key+' rotations');
   else {
    assert.equal(key,'mixamorig:Hips:translation');
    const x=values(source,a.output),y=values(candidate,b.output);
    for(let i=3;i<x.length;i++)assert.ok(Math.abs((x[i]-x[i%3])-(y[i]-y[i%3]))<2e-5,'Hip displacement must remain source-authored');
   }
  }
 }
});
test('new skin binds are inverses of the fitted source hierarchy',()=>{
 const j=candidate.json,world=new Map();
 function visit(i,parent){const n=j.nodes[i],local=n.matrix||mat4.fromRotationTranslationScale(mat4.create(),n.rotation||[0,0,0,1],n.translation||[0,0,0],n.scale||[1,1,1]);const w=mat4.multiply(mat4.create(),parent,local);world.set(i,w);for(const child of n.children||[])visit(child,w);}
 for(const i of j.scenes[j.scene||0].nodes)visit(i,mat4.create());
 assert.equal(j.skins.length,1);const skin=j.skins[0];assert.equal(skin.joints.length,65);
 const binds=values(candidate,skin.inverseBindMatrices);
 for(const [i,joint]of skin.joints.entries()){
  const m=mat4.multiply(mat4.create(),world.get(joint),binds.slice(i*16,i*16+16));
  for(let k=0;k<16;k++)assert.ok(Math.abs(m[k]-(k%5===0?1:0))<2e-5,`${j.nodes[joint].name} bind`);
 }
 assert.deepEqual(j.meshes.map(m=>m.name).sort(),[...expectedMeshes].sort());
 for(const mesh of j.meshes)for(const p of mesh.primitives){
  const weights=values(candidate,p.attributes.WEIGHTS_0),joints=values(candidate,p.attributes.JOINTS_0);
  for(let i=0;i<weights.length;i+=4){assert.ok(Math.abs(weights.slice(i,i+4).reduce((a,b)=>a+b,0)-1)<1e-5);for(let k=0;k<4;k++)assert.ok(joints[i+k]<65);}
 }
});
}
const humanCandidate=load('public/characters/candidates/human-source-v1.glb');
const routeBodies={'source-reference':source,'human-source':humanCandidate,'orc-source':load('public/characters/candidates/orc-source-v1.glb')};
const routeUrls={'source-reference':'/characters/base.glb','human-source':'/characters/candidates/human-source-v1.glb','orc-source':'/characters/candidates/orc-source-v1.glb'};
test('diagnostic gameplay routes select original clips without procedural mage composition',()=>{
 for(const id of ['source-reference','human-source','orc-source']){
  const d=resolvePlayableBody('?character='+id);assert.equal(d.composeStarter,false);assert.equal(d.capabilities.wipeTextures,false);
  assert.equal(d.assetURL,routeUrls[id]);
  const clips=resolvePlayableClips(routeBodies[id].json.animations.map(a=>a.name),d);assert.equal(clips.clips.run,'Sprint_Loop');assert.equal(clips.clips.walk,'Walk_Loop');
 }
});
