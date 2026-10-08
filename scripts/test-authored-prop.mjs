/** Refusal controls mutate the actual native shield export, not a mocked renderer. */
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import test from 'node:test';
import {NodeIO,VertexLayout} from '@gltf-transform/core';
import {sha256} from './character-assets/equipment-factory-contract.mjs';
import {validatePropDescriptor,verifyAuthoredProp} from './character-assets/prepare-authored-prop.mjs';
const d=JSON.parse(await fs.readFile('blender/characters/props/bastion-shield.json','utf8'));
const bytes=await fs.readFile('blender/characters/props/bastion-shield.glb');
const io=new NodeIO().setVertexLayout(VertexLayout.SEPARATE);
async function modified(edit){const doc=await io.readBinary(bytes);edit(doc,doc.getRoot());return Buffer.from(await io.writeBinary(doc));}

test('authored source export meets rigid hand prop policy and builder pin',async()=>{
 assert.equal(sha256(await fs.readFile(d.builder.path)),d.builder.sha256);
 const r=await verifyAuthoredProp(io,bytes,d);
 assert.equal(r.skins,0);assert.equal(r.animations,0);assert.equal(r.textures,0);
 assert.equal(r.materialGroups.length,3);assert(r.triangles<=2200&&r.bytes<=98304);
});
test('rigged and animated items cannot enter the unskinned hand prop path',async()=>{
 const skin=await modified((doc,root)=>root.listNodes()[0].setSkin(doc.createSkin('foreign actor skin').addJoint(doc.createNode('foreign joint'))));
 await assert.rejects(verifyAuthoredProp(io,skin,d),/undeclared rig/);
 const clip=await modified((doc,root)=>{
  const input=doc.createAccessor().setType('SCALAR').setArray(new Float32Array([0,1])).setBuffer(root.listBuffers()[0]);
  const output=doc.createAccessor().setType('VEC3').setArray(new Float32Array([0,0,0,0,.1,0])).setBuffer(root.listBuffers()[0]);
  const sampler=doc.createAnimationSampler().setInput(input).setOutput(output);
  doc.createAnimation('foreign source clip').addSampler(sampler).addChannel(doc.createAnimationChannel().setTargetNode(root.listNodes()[0]).setTargetPath('translation').setSampler(sampler));
 });
 await assert.rejects(verifyAuthoredProp(io,clip,d),/undeclared rig, motion/);
});
test('nonidentity mesh origin is refused instead of silently changing the grip',async()=>{
 const shifted=await modified((_,root)=>root.listNodes()[0].setTranslation([0,.1,0]));
 await assert.rejects(verifyAuthoredProp(io,shifted,d),/grip frame/);
});
test('a nonfinite normal or position is refused',async()=>{
 for(const semantic of ['NORMAL','POSITION']){
  const corrupted=await modified((_,root)=>{const a=root.listMeshes()[0].listPrimitives()[0].getAttribute(semantic);const v=a.getArray().slice();v[0]=NaN;a.setArray(v);});
  await assert.rejects(verifyAuthoredProp(io,corrupted,d),/Malformed prop geometry/);
 }
});
test('collapsed triangle and morph targets are refused',async()=>{
 const degenerate=await modified((_,root)=>{const a=root.listMeshes()[0].listPrimitives()[0].getIndices(),v=a.getArray().slice();v[0]=v[1];a.setArray(v);});
 await assert.rejects(verifyAuthoredProp(io,degenerate,d),/Degenerate prop triangle/);
 const morphed=await modified((doc,root)=>{const p=root.listMeshes()[0].listPrimitives()[0];p.addTarget(doc.createPrimitiveTarget('unsupported').setAttribute('POSITION',p.getAttribute('POSITION')));});
 await assert.rejects(verifyAuthoredProp(io,morphed,d),/Unexpected prop vertex policy/);
});
test('material policy and render cost cannot drift from the descriptor',async()=>{
 const changed=await modified((_,root)=>root.listMaterials()[0].setRoughnessFactor(.01));
 await assert.rejects(verifyAuthoredProp(io,changed,d),/material differs/);
 const duplicate=await modified((_,root)=>{const m=root.listMeshes()[0];m.addPrimitive(m.listPrimitives()[0].clone());});
 await assert.rejects(verifyAuthoredProp(io,duplicate,d),/draw\/material group budget/);
 const tiny=structuredClone(d);tiny.detail.bytes=1;
 await assert.rejects(verifyAuthoredProp(io,bytes,tiny),/byte budget/);
});
test('declared dimensions reject a wrong-scale export',async()=>{
 const scaled=await modified((_,root)=>{for(const p of root.listMeshes()[0].listPrimitives()){const a=p.getAttribute('POSITION'),v=a.getArray().slice();for(let i=0;i<v.length;i++)v[i]*=2;a.setArray(v);}});
 await assert.rejects(verifyAuthoredProp(io,scaled,d),/dimensions\/triangle budget/);
});
test('an unpinned descriptor cannot start native authoring',()=>{
 assert.throws(()=>validatePropDescriptor({...d,blenderVersion:'unreviewed'}),/Unpinned Blender/);
 assert.throws(()=>validatePropDescriptor({...d,builder:{...d.builder,sha256:'bad'}}),/Unpinned prop builder/);
});

test('a hole and inward face are refused on the actual native board',async()=>{
 const open=await modified((_,root)=>{const a=root.listMeshes()[0].listPrimitives()[0].getIndices();a.setArray(a.getArray().slice(3));});
 await assert.rejects(verifyAuthoredProp(io,open,d),/surface is open/);
 const reversed=await modified((_,root)=>{const a=root.listMeshes()[0].listPrimitives()[0].getIndices(),v=a.getArray().slice();[v[0],v[1]]=[v[1],v[0]];a.setArray(v);});
 await assert.rejects(verifyAuthoredProp(io,reversed,d),/normal disagrees/);
});
test('declared facing axes cannot drift from the source grip contract',()=>{
 for(const key of ['front','up'])assert.throws(()=>validatePropDescriptor({...d,grip:{...d.grip,[key]:'-X'}}),/grip frame/);
});

test('a closed inward board with matching normals is refused',async()=>{
 const inward=await modified((_,root)=>{
  const p=root.listMeshes()[0].listPrimitives()[0],a=p.getIndices(),idx=a.getArray().slice();
  for(let i=0;i<idx.length;i+=3)[idx[i+1],idx[i+2]]=[idx[i+2],idx[i+1]];a.setArray(idx);
  const normal=p.getAttribute('NORMAL'),n=normal.getArray().slice();for(let i=0;i<n.length;i++)n[i]=-n[i];normal.setArray(n);
 });
 await assert.rejects(verifyAuthoredProp(io,inward,d),/surface is open or inward-facing/);
});
test('opposite edge winding is checked after the first-vertex normal gate',async()=>{
 const inconsistent=await modified((_,root)=>{
  const p=root.listMeshes()[0].listPrimitives()[0],a=p.getIndices(),idx=a.getArray().slice();
  const firstCounts=new Map();for(let i=0;i<idx.length;i+=3)firstCounts.set(idx[i],(firstCounts.get(idx[i])||0)+1);
  let t=-1;for(let i=0;i<idx.length;i+=3)if(firstCounts.get(idx[i])===1){t=i;break;}assert(t>=0);
  [idx[t+1],idx[t+2]]=[idx[t+2],idx[t+1]];a.setArray(idx);
  const normal=p.getAttribute('NORMAL'),n=normal.getArray().slice();
  for(let k=0;k<3;k++)n[idx[t]*3+k]=-n[idx[t]*3+k];normal.setArray(n);
 });
 await assert.rejects(verifyAuthoredProp(io,inconsistent,d),/surface is open or inward-facing/);
});
