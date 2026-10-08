/** Independent remote body/piece pack; no whole-outfit permutations.
 * Geometry/skin/morph/source curves are lossless; only the declared texture
 * policy changes. Publish only after native motion and resource verification.
 * https://gltf-transform.dev/modules/extensions/classes/EXTMeshoptCompression
 * https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#skins
 */
import fs from 'node:fs/promises';import path from 'node:path';import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';import {gunzipSync} from 'node:zlib';
import {NodeIO,VertexLayout} from '@gltf-transform/core';import {ALL_EXTENSIONS,EXTMeshoptCompression} from '@gltf-transform/extensions';
import {MeshoptDecoder,MeshoptEncoder} from 'meshoptimizer';import sharp from 'sharp';
import {APPEARANCE_CATALOG_VERSION} from '../../src/character/appearance/contract.js';
import {EQUIPMENT_ITEMS} from '../../src/ashen-reach/equipment-catalog.js';
const out=process.env.ASHEN_REMOTE_PIECES_OUT||'.cache/character-mmo/remote-pieces-v1';
assert(!path.resolve(out).startsWith(path.resolve('public')+path.sep),'Native remote review must precede publication');
const sha=b=>createHash('sha256').update(b).digest('hex');
await Promise.all([MeshoptDecoder.ready,MeshoptEncoder.ready]);
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder,'meshopt.encoder':MeshoptEncoder}).setVertexLayout(VertexLayout.SEPARATE);
const array=a=>Array.from(a.getArray());
const triangles=a=>Array.from({length:a.length/3},(_,i)=>{const t=Array.from(a.slice(i*3,i*3+3)),k=t.indexOf(Math.min(...t));return t.slice(k).concat(t.slice(0,k));});
const clips=root=>root.listAnimations().map(a=>({name:a.getName(),channels:a.listChannels().map(c=>({node:c.getTargetNode().getName(),path:c.getTargetPath(),interpolation:c.getSampler().getInterpolation(),input:array(c.getSampler().getInput()),output:array(c.getSampler().getOutput())}))}));
function verify(source,actual){
 assert.deepEqual(actual.listNodes().map(n=>[n.getName(),n.getWorldMatrix()]),source.listNodes().map(n=>[n.getName(),n.getWorldMatrix()]));
 assert.deepEqual(actual.listSkins().map(s=>[s.listJoints().map(j=>j.getName()),array(s.getInverseBindMatrices())]),source.listSkins().map(s=>[s.listJoints().map(j=>j.getName()),array(s.getInverseBindMatrices())]));
 assert.deepEqual(clips(actual),clips(source));assert.deepEqual(actual.listMeshes().map(m=>m.getName()),source.listMeshes().map(m=>m.getName()));
 for(const [i,m]of source.listMeshes().entries()){
  const a=actual.listMeshes()[i];assert.deepEqual(a.getWeights(),m.getWeights());assert.deepEqual(a.getExtras(),m.getExtras());assert.equal(a.listPrimitives().length,m.listPrimitives().length);
  for(const [j,p]of m.listPrimitives().entries()){
   const q=a.listPrimitives()[j];assert.equal(q.getMode(),p.getMode());assert.deepEqual(q.getExtras(),p.getExtras());assert.equal(q.getMaterial()?.getName(),p.getMaterial()?.getName());assert.deepEqual(triangles(q.getIndices().getArray()),triangles(p.getIndices().getArray()));assert.deepEqual(q.listSemantics(),p.listSemantics());
   for(const s of p.listSemantics()){assert.equal(q.getAttribute(s).getNormalized(),p.getAttribute(s).getNormalized());assert.deepEqual(q.getAttribute(s).getArray(),p.getAttribute(s).getArray());}
   assert.equal(q.listTargets().length,p.listTargets().length);for(const [k,t]of p.listTargets().entries()){const u=q.listTargets()[k];assert.deepEqual(u.listSemantics(),t.listSemantics());for(const s of t.listSemantics())assert.deepEqual(u.getAttribute(s).getArray(),t.getAttribute(s).getArray());}
  }
 }
 return {geometryExact:true,morphsExact:true,bindAndFramesExact:true,sourceCurvesExact:true,triangleWindingExact:true};
}
await fs.mkdir(out,{recursive:true});const result={schema:1,lite:'1.31.1',catalogVersion:APPEARANCE_CATALOG_VERSION,candidateOnly:true,
 authoredProps:Object.fromEntries(Object.values(EQUIPMENT_ITEMS).filter(item=>item.asset).map(item=>[item.id,item.asset])),
 texturePolicy:{human:'at most 512px from published full texture masters; WebP quality 90',otherRaces:'at most 512px; WebP quality 90 for color/data, lossless encoding for resized normal maps'},races:{}};
for(const [race,directory]of [['human','human-shape-v1'],['orc','equipment-orc'],['undead','equipment-undead']]){
 const manifestPath=`public/ashen-reach/${directory}/${race==='human'?'manifest.json':'manifest-coverage-v1.json'}`,manifestBytes=await fs.readFile(manifestPath),manifest=JSON.parse(manifestBytes),items={};
 for(const [id,entry]of Object.entries(manifest.items)){
  const file='public'+new URL(entry.url,'https://play.sparkify.dev').pathname,encoded=await fs.readFile(file),sourceBytes=entry.compression==='gzip'?gunzipSync(encoded):encoded;
  assert.equal(sourceBytes.length,entry.bytes);assert.equal(sha(sourceBytes),entry.sha256);
  const doc=await io.readBinary(sourceBytes),reference=(await io.readBinary(sourceBytes)).getRoot(),textures=[];
  for(const [ordinal,t]of doc.getRoot().listTextures().entries()){
   const materials=doc.getRoot().listMaterials(),normal=materials.some(m=>m.getNormalTexture()===t);
   let original=Buffer.from(t.getImage());
   if(race==='human'){
    const names=materials.filter(m=>m.getBaseColorTexture()===t).map(m=>m.getName());
    const master=entry.textures?.find(a=>names.some(n=>a.materials.includes(n)));assert(master,'Human full texture master absent');
    original=await fs.readFile('public'+new URL(master.url,'https://play.sparkify.dev').pathname);
    assert(master.url.includes(`texture-${sha(original).slice(0,12)}.`),'Human texture master hash mismatch');
   }
   const changed=await sharp(original).resize(512,512,{fit:'inside',withoutEnlargement:true}).webp(normal?{lossless:true}:{quality:90}).toBuffer();
   t.setImage(changed).setMimeType('image/webp');textures.push({name:t.getName(),sourceSha256:sha(original),sha256:sha(changed),normalMap:normal,sourceSize:race==='human'?undefined:reference.listTextures()[ordinal].getSize(),size:t.getSize(),bytes:changed.length});
  }
  for(const e of doc.getRoot().listExtensionsUsed())if(e.extensionName==='EXT_meshopt_compression')e.dispose();doc.createExtension(EXTMeshoptCompression).setRequired(true);
  const bytes=await io.writeBinary(doc),root=(await io.readBinary(bytes)).getRoot(),verification=verify(reference,root),digest=sha(bytes),name=`${id}-${digest}.glb`;
  const jsonLength=Buffer.from(bytes).readUInt32LE(12),json=JSON.parse(Buffer.from(bytes).subarray(20,20+jsonLength));for(const m of json.meshes)for(const p of m.primitives)for(const target of p.targets||[])for(const index of Object.values(target)){const v=json.bufferViews[json.accessors[index].bufferView];assert(!v.byteStride||v.byteStride===12,'Interleaved morph target');}
  await fs.writeFile(path.join(out,name),bytes);
  const asset={...entry,file:name,bytes:bytes.length,sha256:digest,source:{path:file,sha256:entry.sha256,bytes:entry.bytes},verification,textures};for(const field of ['url','compression','encodedBytes','coverageSource'])delete asset[field];items[id]=asset;
 }
 result.races[race]={sourceManifest:{path:manifestPath,sha256:sha(manifestBytes)},manifest:{schema:manifest.schema,fitId:manifest.fitId,profileId:manifest.profileId,shapeFamily:manifest.shapeFamily,bindSha256:manifest.bindSha256,coverage:manifest.coverage,garmentLayerCoverage:manifest.garmentLayerCoverage,items}};delete result.races[race].manifest.compactItems;delete result.races[race].manifest.coverageProof;
 console.log(JSON.stringify({race,items:Object.keys(items).length,totalBytes:Object.values(items).reduce((n,a)=>n+a.bytes,0),bodyBytes:items.body.bytes}));
}
result.tooling={node:process.versions.node};for(const name of ['@gltf-transform/core','meshoptimizer','sharp'])result.tooling[name]=JSON.parse(await fs.readFile(`node_modules/${name}/package.json`)).version;
result.compilerSha256=sha(await fs.readFile('scripts/character-assets/prepare-remote-pieces.mjs'));
await fs.writeFile(path.join(out,'manifest.json'),JSON.stringify(result,null,2)+'\n');
