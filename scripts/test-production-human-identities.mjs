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
import {ASHEN_PLAYABLE_CLIP_NAMES,ASHEN_PLAYABLE_MOTION} from '../src/character/runtime/ashen-playable-motion.js';
import {resolvePlayableBody,resolvePlayableClips} from '../src/character/runtime/playable-body.js';
import {compactPlayableAnimations} from './character-assets/compact-playable-animations.mjs';
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
test('playable contract includes directional, channel, carry, hit and all spell layers',()=>{
 const definition={...resolvePlayableBody('?character=human-source'),...ASHEN_PLAYABLE_MOTION};
 const resolved=resolvePlayableClips(ASHEN_PLAYABLE_CLIP_NAMES,definition);
 assert.deepEqual(resolved.clips,definition.clips);
 for(const clip of ['Jog_Bwd_Loop','Jog_Left_Loop','Jog_Right_Loop','Turn90_L','Turn90_R','Hit_Chest',
  'Spell_Simple_Enter','Spell_Simple_Idle_Loop','Spell_Simple_Exit','Walk_Carry_Loop',
  'FireBlast_Upper','FireBlast_Lower','LavaBall_Upper','LavaBall_Lower','PyreBurst_Upper','PyreBurst_Lower'])
  assert(ASHEN_PLAYABLE_CLIP_NAMES.includes(clip),`Missing ${clip}`);
});
test('compact compiler refuses a missing playable curve before changing the source',async()=>{
 const doc=await read(index.presets['prime-bald'].manifest.items.body),root=doc.getRoot();
 root.listAnimations().find(a=>a.getName()==='LavaBall_Lower').dispose();
 const before=identityAnimationHash(root);
 await assert.rejects(compactPlayableAnimations(doc),/Missing playable source clip: LavaBall_Lower/);
 assert.equal(identityAnimationHash(root),before);
});
for(const [preset,entry]of Object.entries(index.presets))for(const [tier,id]of [['items','body'],['compactItems','body'],['items','graveweaverHood'],['compactItems','graveweaverHood']])test(`${preset}/${tier}/${id} has exact native bind, geometry/morph proof and source curves`,async()=>{
 const asset=entry.manifest[tier][id],doc=await read(asset),root=doc.getRoot(),actual=await raw(doc);
 assert.equal(assertCopiedSkinBind(referenceRaw.json,referenceRaw.binary,actual.json,actual.binary).jointCount,65);
 assert.equal(identityGeometryHash(root),asset.geometrySha256);assert.equal(identityAnimationHash(root),asset.animationsSha256);
 for(const mesh of root.listMeshes()){
  assert.deepEqual(mesh.getExtras().targetNames,['slender','stout']);
  for(const p of mesh.listPrimitives())assert.equal(p.listTargets().length,2);
 }
 if(id==='body'){
  if(tier==='items'){
   assert.equal(root.listAnimations().length,57);assert.equal(identityAnimationHash(root),identityAnimationHash(reference.getRoot()));
  }else{
   const full=(await read(entry.manifest.items.body)).getRoot();
   assert.deepEqual(root.listAnimations().map(a=>a.getName()).sort(),[...ASHEN_PLAYABLE_CLIP_NAMES].sort());
   assert.deepEqual(asset.playableClips,root.listAnimations().map(a=>a.getName()));
   assert.equal(identityGeometryHash(root),identityGeometryHash(full),'First play preserves the exact full body and face');
   assert.equal(identityAnimationHash(root),identityAnimationHash(full,{names:new Set(ASHEN_PLAYABLE_CLIP_NAMES)}),'Playable samples/interpolation/timestamps stay exact');
   assert.equal(asset.coverageRevision,entry.manifest.items.body.coverageRevision);
   assert(asset.encodedBytes<entry.manifest.items.body.encodedBytes*.8);
   const sampler=root.listAnimations()[0].listSamplers()[0],input=sampler.getInput(),original=input.getArray().slice(),times=original.slice();
   times[0]+=.0001;input.setArray(times);
   assert.notEqual(identityAnimationHash(root),asset.animationsSha256,'Curve proof must catch altered time');
   input.setArray(original);
  }
  assert(root.listMeshes().some(m=>m.getName()==='HumanIdentityEyes'));assert(root.listMeshes().some(m=>m.getName()==='HumanIdentityBrows'));
  assert.equal(root.listMeshes().some(m=>m.getName()==='HumanPonytail01'),preset==='prime-ponytail');
 }
 if(tier==='compactItems')assert.deepEqual(asset.textures,entry.manifest.items[id].textures,'Compact visual must upgrade to the full source texture');
 if(tier==='compactItems'&&id==='graveweaverHood'){
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
