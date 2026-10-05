import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {NodeIO,VertexLayout} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {MeshoptDecoder} from 'meshoptimizer';
import {verifyProductionHumanIdentities} from './character-assets/verify-production-human-identities.mjs';
import {identityGeometryHash,identityAnimationHash} from './character-assets/human-identity-proof.mjs';
import {parseGlb} from '../src/character/runtime/glb.js';
import {assertCopiedSkinBind} from '../src/character/runtime/fit-contract.js';
await MeshoptDecoder.ready;
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder}).setVertexLayout(VertexLayout.SEPARATE);
const index=JSON.parse(await fs.readFile('public/ashen-reach/human-identity-v1/manifest.json','utf8'));
const canonical=JSON.parse(await fs.readFile('public/ashen-reach/human-shape-v1/manifest.json','utf8'));
const read=async asset=>io.readBinary(asset.compression==='gzip'?gunzipSync(await fs.readFile('public'+asset.url)):await fs.readFile('public'+asset.url));
const raw=async doc=>{for(const e of doc.getRoot().listExtensionsUsed())if(e.extensionName==='EXT_meshopt_compression')e.dispose();const bytes=await io.writeBinary(doc);return parseGlb(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));};
const reference=await read(canonical.items.body),referenceRaw=await raw(reference);
// Count edges by position so duplicated UV/normal corners do not become fake
// openings. Compare complete native vertex records, including skin/morphs;
// retaining POSITION alone would miss a deformed opening that clips the face.
function openingBoundaryRecords(primitive){
 const position=i=>primitive.getAttribute('POSITION').getElement(i,[]).join(',');
 const edges=new Map(),indices=primitive.getIndices().getArray();
 for(let i=0;i<indices.length;i+=3)for(let j=0;j<3;j++){
  const points=[position(indices[i+j]),position(indices[i+(j+1)%3])],key=points.slice().sort().join('|');
  const edge=edges.get(key)||{count:0,points};edge.count++;edges.set(key,edge);
 }
 const boundary=new Set([...edges.values()].filter(e=>e.count===1).flatMap(e=>e.points));
 return {boundary,indices,position};
}
const vertexRecord=(primitive,i)=>JSON.stringify([
 primitive.listSemantics().map(s=>[s,primitive.getAttribute(s).getElement(i,[])]),
 primitive.listTargets().map(t=>t.listSemantics().map(s=>[s,t.getAttribute(s).getElement(i,[])])),
]);
test('sealed selected packs agree with current inputs, embedded descriptors and all content addresses',async()=>{
 assert.equal((await verifyProductionHumanIdentities()).presets,3);
});
test('release guard refuses a stale authoring input and a modified embedded descriptor',async()=>{
 const input=Object.keys(index.provenance.inputs)[0];
 await assert.rejects(verifyProductionHumanIdentities({readFile:(file,...args)=>file===input?Promise.resolve(Buffer.from('injected mutation')):fs.readFile(file,...args)}),/Stale identity input/);
 const tampered=structuredClone(index);tampered.presets['prime-bald'].manifest.identity.preset='weathered-bald';
 await assert.rejects(verifyProductionHumanIdentities({readFile:(file,...args)=>file.endsWith('human-identity-v1/manifest.json')?Promise.resolve(JSON.stringify(tampered)):fs.readFile(file,...args)}),/Embedded identity descriptor/);
});
for(const [preset,entry]of Object.entries(index.presets))for(const [tier,id]of [['items','body'],['items','graveweaverHood'],['compactItems','graveweaverHood']])test(`${preset}/${tier}/${id} has exact native bind, geometry/morph proof and source curves`,async()=>{
 const asset=entry.manifest[tier][id],doc=await read(asset),root=doc.getRoot(),actual=await raw(doc);
 assert.equal(assertCopiedSkinBind(referenceRaw.json,referenceRaw.binary,actual.json,actual.binary).jointCount,65);
 assert.equal(identityGeometryHash(root),asset.geometrySha256);assert.equal(identityAnimationHash(root),asset.animationsSha256);
 for(const mesh of root.listMeshes()){
  assert.deepEqual(mesh.getExtras().targetNames,['slender','stout']);
  for(const p of mesh.listPrimitives())assert.equal(p.listTargets().length,2);
 }
 if(id==='body'){
  assert.deepEqual(entry.manifest.compactItems.body,asset,'First play preserves the exact full body and face');
  assert.equal(root.listAnimations().length,57);assert.equal(identityAnimationHash(root),identityAnimationHash(reference.getRoot()));
  assert(root.listMeshes().some(m=>m.getName()==='HumanIdentityEyes'));assert(root.listMeshes().some(m=>m.getName()==='HumanIdentityBrows'));
  assert.equal(root.listMeshes().some(m=>m.getName()==='HumanPonytail01'),preset==='prime-ponytail');
 }
 if(tier==='compactItems'){
  assert.deepEqual(asset.simplification,{ratio:.4,error:.002,lockBorder:true});
  assert(asset.encodedBytes<entry.manifest.items[id].encodedBytes*.6);
  assert.deepEqual(asset.textures,entry.manifest.items[id].textures,'Compact hood must upgrade to the full source texture');
  const full=(await read(entry.manifest.items[id])).getRoot();
  for(const mesh of full.listMeshes())for(const [pi,p]of mesh.listPrimitives().entries()){
   const compact=root.listMeshes().find(m=>m.getName()===mesh.getName()).listPrimitives()[pi];
   const {boundary,indices,position}=openingBoundaryRecords(p);
   assert(boundary.size>200,'The independent full-hood control must contain a real opening');
   const used=new Set(compact.getIndices().getArray());
   const records=new Set([...used].map(i=>vertexRecord(compact,i)));
   const required=[...new Set(indices)].filter(i=>boundary.has(position(i))).map(i=>vertexRecord(p,i));
   assert(required.every(record=>records.has(record)),'Compact opening must retain exact normals, UVs, weights and both morphs');
   const broken=new Set(records);broken.delete(required[0]);
   assert(!required.every(record=>broken.has(record)),'Missing boundary vertex control must fail');
  }
 }
 // A copied rest hierarchy cannot be verified by geometry/hash assertions alone.
 const changed=structuredClone(actual.json);changed.nodes[changed.skins[0].joints[0]].translation=[1,2,3];
 assert.throws(()=>assertCopiedSkinBind(referenceRaw.json,referenceRaw.binary,changed,actual.binary),/rest ancestry|rest world/);
 const primitive=root.listMeshes()[0].listPrimitives()[0],position=primitive.getAttribute('POSITION'),values=position.getArray();values[0]+=.01;position.setArray(values);
 assert.notEqual(identityGeometryHash(root),asset.geometrySha256,'Geometry proof must catch a changed vertex');
});
