import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {MeshoptDecoder} from 'meshoptimizer';
import {PRODUCTION_HUMAN_FAMILY} from '../src/character/appearance/contract.js';
const root='public/ashen-reach/human-shape-v1';
await MeshoptDecoder.ready;
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder});
const manifest=JSON.parse(await fs.readFile(`${root}/manifest.json`,'utf8'));
test('published family declares one deformation layout and ten content-addressed artifacts',()=>{
 assert.equal(manifest.shapeFamily,PRODUCTION_HUMAN_FAMILY);assert.deepEqual(manifest.targetNames,['slender','stout']);assert.equal(Object.keys(manifest.items).length,10);assert.equal(manifest.reproduction.clips,57);assert.equal(manifest.reproduction.neutralIdentity.matchesShippedBody,true);
});
for(const [id,asset] of Object.entries(manifest.items))test(`${id} retains repaired canonical topology, bind and neutral geometry`,async()=>{
 const encoded=await fs.readFile(`public${asset.url}`),bytes=gunzipSync(encoded);
 assert.equal(encoded.length,asset.encodedBytes);assert.equal(bytes.length,asset.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),asset.sha256);assert.equal(asset.shapeFamily,PRODUCTION_HUMAN_FAMILY);
 const base=(await io.read(`public/ashen-reach/equipment/${id}.glb`)).getRoot(),packed=(await io.readBinary(bytes)).getRoot();
 assert.deepEqual(packed.listAnimations().map(a=>a.getName()),base.listAnimations().map(a=>a.getName()));
 const bs=base.listSkins()[0],ps=packed.listSkins()[0];assert.deepEqual(ps.listJoints().map(j=>j.getName()),bs.listJoints().map(j=>j.getName()));assert.deepEqual(ps.getInverseBindMatrices().getArray(),bs.getInverseBindMatrices().getArray());
 assert.deepEqual(packed.listMeshes().map(m=>m.getName()),base.listMeshes().map(m=>m.getName()));
 for(const [mi,m] of packed.listMeshes().entries())for(const [pi,p] of m.listPrimitives().entries()) {
  const original=base.listMeshes()[mi].listPrimitives()[pi];
  // Meshopt's triangle codec may rotate a triangle's first corner while retaining
  // its winding, membership and order. Vertex/skin/morph attributes remain exact.
  // https://github.com/zeux/meshoptimizer/blob/v0.22/README.md#lossless-index-buffer-compression
  if(id==='wardenPauldrons'){const canonical=a=>Array.from({length:a.length/3},(_,i)=>{const t=Array.from(a.slice(i*3,i*3+3)),k=t.indexOf(Math.min(...t));return [...t.slice(k),...t.slice(0,k)];});assert.deepEqual(canonical(p.getIndices().getArray()),canonical(original.getIndices().getArray()));}
  else assert.deepEqual(p.getIndices().getArray(),original.getIndices().getArray());
  for(const sem of original.listSemantics())assert.deepEqual(p.getAttribute(sem).getArray(),original.getAttribute(sem).getArray(),`${id}/${m.getName()}/${sem}`);
  assert.equal(p.listTargets().length,2);assert.deepEqual(m.getExtras().targetNames,['slender','stout']);
 }
});
for(const [id,asset] of Object.entries(manifest.compactItems))test(`${id} compact keeps corresponding skin/morph vertices and the canonical bind`,async()=>{
 const read=async a=>(await io.readBinary(gunzipSync(await fs.readFile('public'+a.url)))).getRoot();
 const full=await read(manifest.items[id]),compact=await read(asset);
 assert.deepEqual(compact.listSkins()[0].getInverseBindMatrices().getArray(),full.listSkins()[0].getInverseBindMatrices().getArray());
 assert.deepEqual(compact.listAnimations().map(a=>a.getName()),full.listAnimations().map(a=>a.getName()));
 for(const [mi,mesh]of compact.listMeshes().entries())for(const [pi,p]of mesh.listPrimitives().entries()) {
  const source=full.listMeshes()[mi].listPrimitives()[pi];
  const tuple=(p,i)=>JSON.stringify([...p.listSemantics().sort().flatMap(s=>p.getAttribute(s).getElement(i,[])),...p.listTargets().flatMap(t=>t.listSemantics().sort().flatMap(s=>t.getAttribute(s).getElement(i,[])))]);
  const originals=new Set(Array.from({length:source.getAttribute('POSITION').getCount()},(_,i)=>tuple(source,i)));
  for(let i=0;i<p.getAttribute('POSITION').getCount();i++)assert(originals.has(tuple(p,i)),`${id} compact vertex ${i} loses correspondence`);
  assert(p.getIndices().getCount()<=source.getIndices().getCount());
 }
});
