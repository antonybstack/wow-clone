/** Tests actual compiled per-race artifacts, not a duplicate fitting implementation. */
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import {createHash} from 'node:crypto';import {gunzipSync} from 'node:zlib';
import {NodeIO} from '@gltf-transform/core';import {ALL_EXTENSIONS} from '@gltf-transform/extensions';import {MeshoptDecoder} from 'meshoptimizer';
import {EQUIPMENT_ITEMS} from '../src/ashen-reach/equipment-catalog.js';
import {FITS_BY_RACE} from '../src/ashen-reach/equipment-contract.js';
await MeshoptDecoder.ready;const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder});
const descriptor=JSON.parse(await fs.readFile('blender/characters/wardrobe/warden-pauldrons.json','utf8')),sha=b=>createHash('sha256').update(b).digest('hex');
test('published plate descriptor declares the actual slot, material/detail revision and every accepted fit',()=>{
 const item=EQUIPMENT_ITEMS[descriptor.id];assert.equal(descriptor.slot,item.slot);assert.equal(descriptor.layer,item.layer);assert.equal(descriptor.deformation,item.deformation);assert.deepEqual(descriptor.occupies,item.occupies);assert.deepEqual(Object.keys(descriptor.fits).sort(),Object.keys(item.fits).sort());
 assert.equal(descriptor.detail.compact,'same-rigid-geometry');assert.equal(descriptor.material.revision,1);assert.equal(descriptor.corrective.revision,1);
 for(const [race,fit]of Object.entries(descriptor.fits))assert.deepEqual(fit.interface,item.fits[race]);
});
for(const [race,fit]of Object.entries(descriptor.fits))test(`${race} independently streamed plate retains its own exact rest bind and rigid articulation`,async()=>{
 const manifest=JSON.parse(await fs.readFile(`public/ashen-reach/${fit.directory}/manifest.json`,'utf8')),asset=manifest.items.wardenPauldrons,bytes=await fs.readFile(`public${new URL(asset.url,'https://play.sparkify.dev').pathname}`);
 assert.equal(sha(await fs.readFile(fit.source)),fit.sha256);assert.equal(sha(bytes),asset.sha256);assert.equal(bytes.length,asset.bytes);assert.match(asset.url,new RegExp(`${asset.sha256.slice(0,12)}\\.glb$`));assert.deepEqual(asset.fit,FITS_BY_RACE[race]);assert.deepEqual(EQUIPMENT_ITEMS.wardenPauldrons.fits[race],asset.fit);
 const root=(await io.readBinary(bytes)).getRoot(),base=(await io.read(fit.source)).getRoot(),s=root.listSkins()[0],bs=base.listSkins()[0];
 assert.equal(root.listAnimations().length,0);assert.deepEqual(s.getInverseBindMatrices().getArray(),bs.getInverseBindMatrices().getArray());assert.deepEqual(s.listJoints().map(n=>[n.getName(),n.getWorldMatrix()]),bs.listJoints().map(n=>[n.getName(),n.getWorldMatrix()]));
 assert.deepEqual(root.listMeshes().map(m=>m.getName()),['WardenPauldrons']);
 for(const m of root.listMaterials()){
  const actual=[...m.getBaseColorFactor(),m.getMetallicFactor(),m.getRoughnessFactor()],expected=[...descriptor.material.baseColor,descriptor.material.metallic,descriptor.material.roughness];assert(actual.every((v,i)=>Math.abs(v-expected[i])<1e-6));
 }
 const seen=new Set();for(const p of root.listMeshes()[0].listPrimitives()){
  const j=p.getAttribute('JOINTS_0').getArray(),w=p.getAttribute('WEIGHTS_0').getArray();
  for(let i=0;i<w.length;i+=4){assert.deepEqual(Array.from(w.slice(i,i+4)),[1,0,0,0]);const name=s.listJoints()[j[i]].getName();assert(['mixamorig:LeftArm','mixamorig:RightArm'].includes(name));seen.add(name);}
 }
 assert.equal(seen.size,2);
});
test('Human shape plate stays a similarity per arm and compact uses full rigid geometry',async()=>{
 const m=JSON.parse(await fs.readFile('public/ashen-reach/human-shape-v1/manifest.json','utf8'));assert.deepEqual(m.compactItems.wardenPauldrons,m.items.wardenPauldrons);
 const bytes=gunzipSync(await fs.readFile('public'+m.items.wardenPauldrons.url)),root=(await io.readBinary(bytes)).getRoot();
 for(const mesh of root.listMeshes())for(const p of mesh.listPrimitives()){
  const pos=p.getAttribute('POSITION').getArray(),j=p.getAttribute('JOINTS_0').getArray(),w=p.getAttribute('WEIGHTS_0').getArray();assert.equal(p.listTargets().length,2);
  const groups=new Map();for(let i=0;i<w.length;i+=4){assert.deepEqual(Array.from(w.slice(i,i+4)),[1,0,0,0]);if(!groups.has(j[i]))groups.set(j[i],[]);groups.get(j[i]).push(i/4);}
  for(const t of p.listTargets())for(const ids of groups.values()){
   const delta=t.getAttribute('POSITION').getArray(),distance=(a,b,weight)=>Math.hypot(...[0,1,2].map(k=>pos[a*3+k]-pos[b*3+k]+weight*(delta[a*3+k]-delta[b*3+k])));
   for(const weight of [0,.5,.95]){let ratio;for(let i=1;i<ids.length;i++){const d=distance(ids[0],ids[i],0);if(d<.0001)continue;const r=distance(ids[0],ids[i],weight)/d;ratio??=r;assert(Math.abs(r-ratio)<.00001,`plate distorted by ${r-ratio}`);}}
  }
 }
 const jsonLength=bytes.readUInt32LE(12),json=JSON.parse(bytes.subarray(20,20+jsonLength).toString());for(const mesh of json.meshes)for(const p of mesh.primitives)for(const target of p.targets)for(const ai of Object.values(target)){const v=json.bufferViews[json.accessors[ai].bufferView];assert(!v.byteStride||v.byteStride===12);}
});
