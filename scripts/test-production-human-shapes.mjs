import {verifyCompactNormalPolicy} from './character-assets/compact-normal-policy.mjs';
import {characterNormalProof,assertCharacterNormalProof} from './character-assets/quantize-character-normals.mjs';
import {identityGeometryHash} from './character-assets/human-identity-proof.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {MeshoptDecoder} from 'meshoptimizer';
import {verifyCoveragePartition} from './character-assets/verify-coverage-partition.mjs';
import {verifyHumanCoveragePolicy} from './character-assets/verify-human-coverage-policy.mjs';
import {PRODUCTION_HUMAN_FAMILY} from '../src/character/appearance/contract.js';
import {ASHEN_PLAYABLE_CLIP_NAMES} from '../src/character/runtime/ashen-playable-motion.js';
import {EQUIPMENT_ITEMS} from '../src/ashen-reach/equipment-catalog.js';
const root='public/ashen-reach/human-shape-v1';
await MeshoptDecoder.ready;
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder});
const manifest=JSON.parse(await fs.readFile(`${root}/manifest.json`,'utf8'));
// Preserve triangle order, winding and duplicate membership while accepting the
// native codec's cyclic first-corner choice. Do not sort triangles or vertices.
// https://github.com/zeux/meshoptimizer/blob/v0.22/README.md#lossless-index-buffer-compression
const canonicalCorners=a=>Array.from({length:a.length/3},(_,i)=>{const t=Array.from(a.slice(i*3,i*3+3)),k=t.indexOf(Math.min(...t));return [...t.slice(k),...t.slice(0,k)];});
test('native index proof accepts cyclic corners but rejects reversed, missing, reordered or duplicate triangles',()=>{
 const source=canonicalCorners([0,1,2,3,4,5]);
 assert.deepEqual(canonicalCorners([1,2,0,5,3,4]),source);
 for(const changed of [[0,2,1,3,4,5],[0,1,2],[3,4,5,0,1,2],[0,1,2,0,1,2]])
  assert.notDeepEqual(canonicalCorners(changed),source);
});
test('published family declares one deformation layout and exactly the catalogued garment artifacts',()=>{
 assert.equal(manifest.shapeFamily,PRODUCTION_HUMAN_FAMILY);assert.deepEqual(manifest.targetNames,['slender','stout']);assert.deepEqual(Object.keys(manifest.items).sort(),['body',...Object.keys(EQUIPMENT_ITEMS).filter(id=>!EQUIPMENT_ITEMS[id].factory)].sort());assert.equal(manifest.reproduction.clips,57);assert.equal(manifest.reproduction.neutralIdentity.matchesShippedBody,true);
});
test('release refuses strict legacy partitions and inert foot coverage adapters',()=>{
 verifyHumanCoveragePolicy(manifest);
 const strict=structuredClone(manifest);strict.coverageProof.find(r=>r.id==='body').partitionPolicy='conservative-geosets-v1';
 assert.throws(()=>verifyHumanCoveragePolicy(strict),/back policy/);
 const inert=structuredClone(manifest);inert.coverage.bodySegments.HumanV1Body.push('foot');
 assert.throws(()=>verifyHumanCoveragePolicy(inert),/own visibility boundary/);
});
for(const [id,asset] of Object.entries(manifest.items))test(`${id} retains repaired canonical geometry, complete index union, bind and neutral shape`,async()=>{
 const encoded=await fs.readFile(`public${asset.url}`),bytes=gunzipSync(encoded);
 assert.equal(encoded.length,asset.encodedBytes);assert.equal(bytes.length,asset.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),asset.sha256);assert.equal(asset.shapeFamily,PRODUCTION_HUMAN_FAMILY);
 const actual=(await io.readBinary(bytes)).getRoot();
 const unpartitioned=asset.coverageSource?gunzipSync(await fs.readFile('public'+asset.coverageSource.url)):bytes;
 const base=(await io.read(`public/ashen-reach/equipment/${id}.glb`)).getRoot(),packed=(await io.readBinary(unpartitioned)).getRoot();
 if(asset.coverageSource){const source=id==='body'?'HumanV1Body':id==='duskguardTassets'?'DuskguardTrousers':'WayfarerTrousers',covered=id==='body'?['HumanTorsoCore','HumanFootCore']:`${source}UnderTorso`;verifyCoveragePartition(packed,actual,source,covered);}

 assert.deepEqual(packed.listAnimations().map(a=>a.getName()),base.listAnimations().map(a=>a.getName()));
 const bs=base.listSkins()[0],ps=packed.listSkins()[0];assert.deepEqual(ps.listJoints().map(j=>j.getName()),bs.listJoints().map(j=>j.getName()));assert.deepEqual(ps.getInverseBindMatrices().getArray(),bs.getInverseBindMatrices().getArray());
 assert.deepEqual(packed.listMeshes().map(m=>m.getName()),base.listMeshes().map(m=>m.getName()));
 for(const [mi,m] of packed.listMeshes().entries())for(const [pi,p] of m.listPrimitives().entries()) {
  const original=base.listMeshes()[mi].listPrimitives()[pi];
  // Meshopt's triangle codec may rotate a triangle's first corner while retaining
  // its winding, membership and order. Vertex/skin/morph attributes remain exact.
  // https://github.com/zeux/meshoptimizer/blob/v0.22/README.md#lossless-index-buffer-compression
  if(EQUIPMENT_ITEMS[id]?.deformation==='rigid-bone'||id==='fieldcoat')assert.deepEqual(canonicalCorners(p.getIndices().getArray()),canonicalCorners(original.getIndices().getArray()));
  else assert.deepEqual(p.getIndices().getArray(),original.getIndices().getArray());
  for(const sem of original.listSemantics())assert.deepEqual(p.getAttribute(sem).getArray(),original.getAttribute(sem).getArray(),`${id}/${m.getName()}/${sem}`);
  assert.equal(p.listTargets().length,2);assert.deepEqual(m.getExtras().targetNames,['slender','stout']);
 }
});
for(const [id,asset] of Object.entries(manifest.compactItems))test(`${id} compact keeps corresponding skin/morph vertices and the canonical bind`,async()=>{
 const read=async a=>(await io.readBinary(gunzipSync(await fs.readFile('public'+a.url)))).getRoot();
 const full=await read(manifest.items[id]),compact=await read(asset);
 assert.deepEqual(compact.listSkins()[0].getInverseBindMatrices().getArray(),full.listSkins()[0].getInverseBindMatrices().getArray());
 if(id==='body'){
  // Distinct first-play body: full 57-clip source in items, exactly the 22 playable clips
  // with byte-identical samples here (compactPlayableAnimations), plus its metadata contract.
  const playable=new Set(ASHEN_PLAYABLE_CLIP_NAMES);
  const clips=root=>root.listAnimations().map(a=>({name:a.getName(),channels:a.listChannels().map(c=>[c.getTargetNode().getName(),c.getTargetPath(),c.getSampler().getInterpolation(),Array.from(c.getSampler().getInput().getArray()),Array.from(c.getSampler().getOutput().getArray())])}));
  assert.equal(full.listAnimations().length,57);assert.equal(playable.size,22);
  assert.notEqual(asset.url,manifest.items.body.url);assert.equal(asset.detail,'playable');
  assert.deepEqual(asset.playableClips,compact.listAnimations().map(a=>a.getName()));
  assert.deepEqual(clips(compact).map(c=>c.name).sort(),[...playable].sort());
  assert.deepEqual(clips(compact),clips(full).filter(c=>playable.has(c.name)));
  assert.deepEqual(compact.listNodes().map(n=>[n.getName(),n.getTranslation(),n.getRotation(),n.getScale()]),full.listNodes().map(n=>[n.getName(),n.getTranslation(),n.getRotation(),n.getScale()]));
  const unpartitionedFull=await read(manifest.items.body.coverageSource??manifest.items.body);
  const policy=verifyCompactNormalPolicy(asset.normalPacking,identityGeometryHash(unpartitionedFull));
  assertCharacterNormalProof(characterNormalProof(full,{animationNames:playable}),characterNormalProof(compact),policy.tolerance);
 }
 else assert.deepEqual(compact.listAnimations().map(a=>a.getName()),full.listAnimations().map(a=>a.getName()));
 for(const [mi,mesh]of compact.listMeshes().entries())for(const [pi,p]of mesh.listPrimitives().entries()) {
  const source=full.listMeshes().find(m=>m.getName()===mesh.getName()).listPrimitives()[pi];
  const tolerance=asset.normalPacking?verifyCompactNormalPolicy(asset.normalPacking).tolerance:0;
  // Native simplification selects original vertices. Match all non-normal streams
  // exactly (including both morph positions); allow only declared normal rounding.
  const record=(primitive,i,normals)=>JSON.stringify([primitive,...primitive.listTargets()].map(owner=>
   owner.listSemantics().sort().filter(sem=>normals===/^(NORMAL|TANGENT)$/.test(sem)).map(sem=>[sem,owner.getAttribute(sem).getElement(i,[])])));
  const normalValues=(primitive,i)=>[primitive,...primitive.listTargets()].flatMap(owner=>owner.listSemantics().sort().filter(sem=>/^(NORMAL|TANGENT)$/.test(sem)).flatMap(sem=>owner.getAttribute(sem).getElement(i,[])));
  const originals=new Map();
  for(let i=0;i<source.getAttribute('POSITION').getCount();i++){
   const key=record(source,i,false),candidates=originals.get(key)??[];
   candidates.push({layout:JSON.parse(record(source,i,true)).map(target=>target.map(([sem,values])=>[sem,values.length])),values:normalValues(source,i)});originals.set(key,candidates);
  }
  for(let i=0;i<p.getAttribute('POSITION').getCount();i++){
   const values=normalValues(p,i),layout=JSON.parse(record(p,i,true)).map(target=>target.map(([sem,v])=>[sem,v.length]));
   assert(originals.get(record(p,i,false))?.some(candidate=>JSON.stringify(candidate.layout)===JSON.stringify(layout)&&candidate.values.length===values.length&&values.every((v,j)=>Number.isFinite(v)&&Math.abs(v-candidate.values[j])<=tolerance)),`${id} compact vertex ${i} loses correspondence`);
  }
  assert(p.getIndices().getCount()<=source.getIndices().getCount());
 }
});
