/** Prepare the existing connected Human source for current clothing review.
 * This is an explicit DEV diagnostic pack, never a production fit declaration.
 * Reuse native geoset partitioning and lossless meshopt; preserve every original
 * animation/skin/morph accessor. The default entry has no dependency on this tool.
 * https://gltf-transform.dev/modules/extensions/classes/EXTMeshoptCompression
 * https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#morph-targets
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {NodeIO,VertexLayout,PropertyType} from '@gltf-transform/core';
import {ALL_EXTENSIONS,EXTMeshoptCompression} from '@gltf-transform/extensions';
import {dedup} from '@gltf-transform/functions';
import {MeshoptDecoder,MeshoptEncoder} from 'meshoptimizer';
import sharp from 'sharp';
import {deriveTorsoCore} from './derive-coverage-geosets.mjs';
import {verifyCoveragePartition} from './verify-coverage-partition.mjs';
import {manifestBodyCoverage} from '../../src/ashen-reach/coverage-manifest.js';

const labels=process.argv.slice(2).length?process.argv.slice(2):['old','young','young-hair'];
const sourceDir='.cache/character-mmo/identity-v1',out='.cache/character-mmo/identity-review-v1';
const sha=b=>createHash('sha256').update(b).digest('hex');
const sourceSummary=JSON.parse(await fs.readFile(process.env.ASHEN_IDENTITY_SOURCE_SUMMARY||'docs/baselines/character-mmo/m5/face-2026-10-04/source-summary.json','utf8'));
const published=JSON.parse(await fs.readFile('public/ashen-reach/human-shape-v1/manifest.json','utf8'));
await Promise.all([MeshoptDecoder.ready,MeshoptEncoder.ready]);
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder,'meshopt.encoder':MeshoptEncoder}).setVertexLayout(VertexLayout.SEPARATE);
const reports=[];
for(const label of labels){
 assert(['old','young','young-hair'].includes(label));
 const source=await fs.readFile(`${sourceDir}/human-${label}-painted.glb`),pin=sourceSummary.assets.find(a=>a.label===label);
 assert.equal(sha(source),pin?.sha256,`${label}: rebuild/record changed source before reviewing`);
 const doc=await io.readBinary(source),root=doc.getRoot(),dir=path.join(out,label);
 await fs.mkdir(dir,{recursive:true});
 assert.equal(root.listAnimations().length,57);assert.equal(root.listSkins().length,1);assert.equal(root.listSkins()[0].listJoints().length,65);
 const textures=[];
 for(const [i,texture]of root.listTextures().entries()){
  const image=Buffer.from(texture.getImage()),mime=texture.getMimeType(),ext={'image/png':'png','image/jpeg':'jpg','image/webp':'webp'}[mime];assert(ext);
  const name=`texture-${sha(image).slice(0,12)}.${ext}`;await fs.writeFile(path.join(dir,name),image);
  const materials=root.listMaterials().filter(m=>m.getBaseColorTexture()===texture).map(m=>m.getName());
  assert(materials.length,`Explicit texture upgrade policy required for ${label}/${i}`);
  textures.push({materials,url:`/__identity_review__/${label}/${name}`});
  texture.setImage(await sharp(image).resize(256,256,{fit:'inside',withoutEnlargement:true}).webp({quality:85}).toBuffer()).setMimeType('image/webp');
 }
 // Independently reparse the unsplit body. Check actual emitted native sharing,
 // not the producer's triangle totals or a guessed body visibility list.
 const reference=(await io.readBinary(await io.writeBinary(doc))).getRoot();
 // copyToDocument retains exact original curves, including repeated immutable
 // input/output data. Native accessor dedup shares those bytes without resampling
 // animation, changing morph order or quantizing any skin attribute.
 // https://gltf-transform.dev/modules/functions/functions/dedup
 await doc.transform(dedup({propertyTypes:[PropertyType.ACCESSOR]}));
 const derived=deriveTorsoCore(doc,'human');
 doc.createExtension(EXTMeshoptCompression).setRequired(true);
 const bytes=await io.writeBinary(doc),actual=(await io.readBinary(bytes)).getRoot();
 const partition=verifyCoveragePartition(reference,actual,derived.partition.source,derived.partition.covered);
 const binary=Buffer.from(bytes),json=JSON.parse(binary.subarray(20,20+binary.readUInt32LE(12)).toString());
 for(const mesh of json.meshes)for(const p of mesh.primitives)for(const target of p.targets||[])for(const id of Object.values(target)){
  const view=json.bufferViews[json.accessors[id].bufferView];assert(!view?.byteStride||view.byteStride===12,'Pinned Lite requires tightly packed morph targets');
 }
 const encoded=gzipSync(bytes,{level:9}),name=`body-${sha(encoded).slice(0,12)}.bin`;
 await fs.writeFile(path.join(dir,name),encoded);
 const manifest=structuredClone(published),base=manifest.items.body;
 // Keep the actual released garment descriptors/coverage. Only the diagnostic
 // body changes; compare fit on these current pieces before authoring a new family.
 const body={...base,url:`/__identity_review__/${label}/${name}`,bytes:bytes.length,encodedBytes:encoded.length,sha256:sha(bytes),compression:'gzip',meshes:actual.listMeshes().map(m=>m.getName()),textures};
 delete body.coverageSource;
 manifest.items.body=body;manifest.compactItems.body=body;manifest.startup.textures=textures;
 if(process.env.ASHEN_IDENTITY_UNFITTED==='1'){
  // Explicit published-hood control for the DEV live comparison. Retain the
  // same runtime provenance guard as fitted auditions; absence used to make
  // this documented control fail before ASHEN.ready.
  manifest.identityHoodReview={age:label.split('-')[0],kind:'published-control',sha256:published.items.graveweaverHood.sha256};
 }else{
  const age=label.split('-')[0],fitDir=`${process.env.ASHEN_IDENTITY_HOOD_DIR||'.cache/character-mmo/m5-face-2026-10-04'}/hood-${age}`;
  const fit=JSON.parse(await fs.readFile(`${fitDir}/hood-${age}-fit.json`,'utf8'));
  const hoodBytes=await fs.readFile(`${fitDir}/hood-${age}.glb`);
  assert.equal(sha(hoodBytes),fit.assembledSha256,`${age}: stale hood fit`);
  assert.equal(sha(await fs.readFile(`${sourceDir}/human-${age}-grey.glb`)),fit.targetSha256,`${age}: hood was fitted to another skull`);
  const name=`hood-${sha(hoodBytes).slice(0,12)}.glb`;
  await fs.writeFile(path.join(dir,name),hoodBytes);
  const item={...published.items.graveweaverHood,url:`/__identity_review__/${label}/${name}`,bytes:hoodBytes.length,sha256:sha(hoodBytes),compression:null};
  delete item.encodedBytes;delete item.coverageSource;
  manifest.items.graveweaverHood=item;manifest.compactItems.graveweaverHood=item;
  manifest.identityHoodReview={age,sha256:fit.assembledSha256,fit};
 }
 manifest.coverage.bodySegments.HumanIdentityEyes=['head.face'];
 manifest.coverage.bodySegments.HumanIdentityBrows=['head.face'];
 // This audition deliberately reproduces the pinned historical torso-only
 // bytes. The production publisher adds reviewed back/foot partitions later;
 // inheriting its adapter here would falsely advertise an absent foot mesh.
 delete manifest.coverage.bodySegments.HumanFootCore;
 if(!manifest.coverage.bodySegments.HumanV1Body.includes('foot'))manifest.coverage.bodySegments.HumanV1Body.push('foot');
 if(label.endsWith('-hair'))manifest.coverage.bodySegments.HumanPonytail01=['head.scalp'];
 assert.deepEqual(manifestBodyCoverage(manifest,'human').baseMeshes.sort(),[...body.meshes].sort());
 manifest.identityReview={label,sourceSha256:sha(source),publishedClothesUnchanged:process.env.ASHEN_IDENTITY_UNFITTED==='1',productionAcceptance:false};
 await fs.writeFile(path.join(dir,'manifest.json'),JSON.stringify(manifest));
 reports.push({label,sourceSha256:sha(source),bodySha256:body.sha256,bytes:bytes.length,encodedBytes:encoded.length,meshes:body.meshes,textures: textures.length,partition});
}
await fs.writeFile(path.join(out,'preparation.json'),JSON.stringify(reports,null,2));
console.log(JSON.stringify(reports));
