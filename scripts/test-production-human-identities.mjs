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
test('sealed selected packs agree with current inputs, embedded descriptors and all content addresses',async()=>{
 assert.equal((await verifyProductionHumanIdentities()).presets,3);
});
test('release guard refuses a stale authoring input and a modified embedded descriptor',async()=>{
 const input=Object.keys(index.provenance.inputs)[0];
 await assert.rejects(verifyProductionHumanIdentities({readFile:(file,...args)=>file===input?Promise.resolve(Buffer.from('injected mutation')):fs.readFile(file,...args)}),/Stale identity input/);
 const tampered=structuredClone(index);tampered.presets['prime-bald'].manifest.identity.preset='weathered-bald';
 await assert.rejects(verifyProductionHumanIdentities({readFile:(file,...args)=>file.endsWith('human-identity-v1/manifest.json')?Promise.resolve(JSON.stringify(tampered)):fs.readFile(file,...args)}),/Embedded identity descriptor/);
});
for(const [preset,entry]of Object.entries(index.presets))for(const id of ['body','graveweaverHood'])test(`${preset}/${id} has exact native bind, geometry/morph proof and source curves`,async()=>{
 const asset=entry.manifest.items[id],doc=await read(asset),root=doc.getRoot(),actual=await raw(doc);
 assert.equal(assertCopiedSkinBind(referenceRaw.json,referenceRaw.binary,actual.json,actual.binary).jointCount,65);
 assert.equal(identityGeometryHash(root),asset.geometrySha256);assert.equal(identityAnimationHash(root),asset.animationsSha256);
 for(const mesh of root.listMeshes()){
  assert.deepEqual(mesh.getExtras().targetNames,['slender','stout']);
  for(const p of mesh.listPrimitives())assert.equal(p.listTargets().length,2);
 }
 if(id==='body'){
  assert.equal(root.listAnimations().length,57);assert.equal(identityAnimationHash(root),identityAnimationHash(reference.getRoot()));
  assert(root.listMeshes().some(m=>m.getName()==='HumanIdentityEyes'));assert(root.listMeshes().some(m=>m.getName()==='HumanIdentityBrows'));
  assert.equal(root.listMeshes().some(m=>m.getName()==='HumanPonytail01'),preset==='prime-ponytail');
 }
 // A copied rest hierarchy cannot be verified by geometry/hash assertions alone.
 const changed=structuredClone(actual.json);changed.nodes[changed.skins[0].joints[0]].translation=[1,2,3];
 assert.throws(()=>assertCopiedSkinBind(referenceRaw.json,referenceRaw.binary,changed,actual.binary),/rest ancestry|rest world/);
 const primitive=root.listMeshes()[0].listPrimitives()[0],position=primitive.getAttribute('POSITION'),values=position.getArray();values[0]+=.01;position.setArray(values);
 assert.notEqual(identityGeometryHash(root),asset.geometrySha256,'Geometry proof must catch a changed vertex');
});
