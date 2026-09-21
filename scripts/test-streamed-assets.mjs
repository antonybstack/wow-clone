import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import {createHash} from 'node:crypto';
import {NodeIO} from '@gltf-transform/core';import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {MeshoptDecoder} from 'meshoptimizer';
await MeshoptDecoder.ready;
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder}),dir='public/ashen-reach/equipment';
const manifest=JSON.parse(await fs.readFile(`${dir}/manifest.json`,'utf8'));
const source=await io.read('public/ashen-reach/wanderer-equipment.glb');
const rig=doc=>{const skin=doc.getRoot().listSkins()[0];return {joints:skin.listJoints().map(n=>[n.getName(),n.getWorldMatrix()]),inverseBind:Array.from(skin.getInverseBindMatrices().getArray())};};
const animation=doc=>doc.getRoot().listAnimations().map(a=>[a.getName(),a.listChannels().map(c=>[c.getTargetNode().getName(),c.getTargetPath(),c.getSampler().getInterpolation(),Array.from(c.getSampler().getInput().getArray()),Array.from(c.getSampler().getOutput().getArray())])]);
/** Meshopt index encoding may rotate a triangle's vertices; winding and membership stay the same. */
function triangleSet(indices){
 const tris=[];
 for(let i=0;i<indices.length;i+=3){
  let a=indices[i],b=indices[i+1],c=indices[i+2];
  const m=Math.min(a,b,c);
  if(b===m) [a,b,c]=[b,c,a];
  else if(c===m) [a,b,c]=[c,a,b];
  tris.push(`${a},${b},${c}`);
 }
 tris.sort();
 return tris;
}
test('streamed body keeps exact 54 clips and source bind; every garment uses that same palette space',async()=>{
 for(const [id,asset]of Object.entries(manifest.items)){
  const bytes=await fs.readFile(`public${asset.url}`);assert.equal(bytes.length,asset.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),asset.sha256);
  const doc=await io.readBinary(bytes);assert.deepEqual(rig(doc),rig(source),id);
  assert.deepEqual(doc.getRoot().listNodes().filter(n=>n.getMesh()).map(n=>n.getName()).sort(),[...asset.meshes].sort(),id);
  for(const node of doc.getRoot().listNodes().filter(n=>n.getMesh())){
   assert.deepEqual(node.getWorldMatrix(),[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);
   const original=source.getRoot().listNodes().find(n=>n.getMesh()&&n.getName()===node.getName());
   for(const [i,p]of node.getMesh().listPrimitives().entries()){
    const before=original.getMesh().listPrimitives()[i];
    for(const semantic of p.listSemantics())assert.deepEqual(p.getAttribute(semantic).getArray(),before.getAttribute(semantic).getArray());
    assert.deepEqual(triangleSet(p.getIndices().getArray()),triangleSet(before.getIndices().getArray()));
   }
  }
  if(id==='body')assert.deepEqual(animation(doc),animation(source));else assert.equal(doc.getRoot().listAnimations().length,0);
 }
});
