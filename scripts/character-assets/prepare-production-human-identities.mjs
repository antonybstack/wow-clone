/** Publish corrected authored identities through the existing native pack contract.
 * Preserve the accepted source pins; canonicalize only rig/bind export roundoff.
 * Reuse current compact/full clothing, coverage, meshopt and texture upgrades.
 * https://gltf-transform.dev/modules/core/classes/NodeIO
 * https://gltf-transform.dev/modules/extensions/classes/EXTMeshoptCompression
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gzipSync,gunzipSync} from 'node:zlib';
import {NodeIO,VertexLayout} from '@gltf-transform/core';
import {ALL_EXTENSIONS,EXTMeshoptCompression} from '@gltf-transform/extensions';
import {MeshoptDecoder,MeshoptEncoder,MeshoptSimplifier} from 'meshoptimizer';
import {simplify} from '@gltf-transform/functions';
import sharp from 'sharp';
import {normalizeHumanBind} from './normalize-human-bind.mjs';
import {assertCopiedSkinBind} from '../../src/character/runtime/fit-contract.js';
import {HUMAN_IDENTITY_PRESETS,IDENTITY_CATALOG_VERSION} from '../../src/character/appearance/human-identity.js';
import {startupProvenance} from '../ashen-reach/startup-provenance.mjs';
import {identityGeometryHash,identityAnimationHash} from './human-identity-proof.mjs';
import {manifestBodyCoverage} from '../../src/ashen-reach/coverage-manifest.js';
import {compactPlayableAnimations} from './compact-playable-animations.mjs';
import {repairIdentityTorsoCoverage} from './repair-identity-torso-coverage.mjs';
import {deriveHumanFootCore} from './derive-coverage-geosets.mjs';
import {verifyCoveragePartition} from './verify-coverage-partition.mjs';
const out=process.env.ASHEN_IDENTITY_OUT||'public/ashen-reach/human-identity-v1';
const urlRoot='/ashen-reach/human-identity-v1';
const review='.cache/character-mmo/identity-review-v1';
const pinRoot='docs/baselines/character-mmo/m5/face-2026-10-04';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
await Promise.all([MeshoptDecoder.ready,MeshoptEncoder.ready,MeshoptSimplifier.ready]);
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder,'meshopt.encoder':MeshoptEncoder}).setVertexLayout(VertexLayout.SEPARATE);
const published=JSON.parse(await fs.readFile('public/ashen-reach/human-shape-v1/manifest.json','utf8'));
const sourcePins=JSON.parse(await fs.readFile(`${pinRoot}/source-summary.json`,'utf8'));
const preparedPins=JSON.parse(await fs.readFile(`${pinRoot}/preparation.json`,'utf8'));
const decode=async asset=>{const packed=await fs.readFile('public'+asset.url),bytes=asset.compression==='gzip'?gunzipSync(packed):packed;assert.equal(sha(bytes),asset.sha256);return bytes;};
const referenceDoc=await io.readBinary(await decode(published.items.body)),reference=referenceDoc.getRoot();
function unpack(bytes){const b=Buffer.from(bytes),end=20+b.readUInt32LE(12);return {json:JSON.parse(b.subarray(20,end).toString()),binary:b.subarray(end+8)};}
// Reuse the strict fit checker on native uncompressed serialization. Compressed
// accessor buffers cannot be passed directly to the raw glTF accessor reader.
for(const ext of reference.listExtensionsUsed())if(ext.extensionName==='EXT_meshopt_compression')ext.dispose();
const baseRaw=unpack(await io.writeBinary(referenceDoc));
await fs.mkdir(out,{recursive:true});
const index={schema:1,catalogVersion:IDENTITY_CATALOG_VERSION,fitId:published.fitId,shapeFamily:published.shapeFamily,targetNames:published.targetNames,presets:{}};
const reports=[];
let ownedReferences='';
async function encode(doc,id,metadata){
 const root=doc.getRoot(),textures=[];
 const geometrySha256=identityGeometryHash(root),animationsSha256=identityAnimationHash(root);
 // Dense storage is lossless: native meshopt compresses the same morph values
 // better than sparse index/value pairs here. Keep exact curves/geometry checks.
 // https://gltf-transform.dev/modules/core/classes/Accessor
 for(const accessor of root.listAccessors())if(accessor.getSparse())accessor.setSparse(false);
 for(const texture of root.listTextures()){
  const image=Buffer.from(texture.getImage()),ext={'image/png':'png','image/jpeg':'jpg','image/webp':'webp'}[texture.getMimeType()];assert(ext);
  const name=`texture-${sha(image).slice(0,12)}.${ext}`;await fs.writeFile(path.join(out,name),image);
  const materials=root.listMaterials().filter(m=>m.getBaseColorTexture()===texture).map(m=>m.getName());assert(materials.length);
  textures.push({materials,url:`${urlRoot}/${name}`});
  if(texture.getMimeType()!=='image/webp'||Math.max(...texture.getSize())>256)
   texture.setImage(await sharp(image).resize(256,256,{fit:'inside',withoutEnlargement:true}).webp({quality:85}).toBuffer()).setMimeType('image/webp');
 }
 for(const ext of root.listExtensionsUsed())if(ext.extensionName==='EXT_meshopt_compression')ext.dispose();
 const raw=unpack(await io.writeBinary(doc));
 assertCopiedSkinBind(baseRaw.json,baseRaw.binary,raw.json,raw.binary);
 doc.createExtension(EXTMeshoptCompression).setRequired(true);
 const bytes=await io.writeBinary(doc),encoded=gzipSync(bytes,{level:9}),name=`${id}-${sha(encoded).slice(0,12)}.bin`;
 const decoded=(await io.readBinary(bytes)).getRoot();
 assert.equal(identityGeometryHash(decoded),geometrySha256,'Native compression changed identity geometry');
 assert.equal(identityAnimationHash(decoded),animationsSha256,'Native compression changed source curves');
 const json=unpack(bytes).json;
 for(const mesh of json.meshes)for(const p of mesh.primitives)for(const t of p.targets||[])for(const ai of Object.values(t)){
  const view=json.bufferViews[json.accessors[ai].bufferView];assert(!view?.byteStride||view.byteStride===12,'Pinned Lite needs packed morph accessors');
 }
 await fs.writeFile(path.join(out,name),encoded);
 const item={...metadata,url:`${urlRoot}/${name}`,bytes:bytes.length,encodedBytes:encoded.length,sha256:sha(bytes),compression:'gzip',meshes:root.listMeshes().map(m=>m.getName()),textures,geometrySha256,animationsSha256};
 delete item.coverageSource;delete item.coverageRevision;
 return item;
}
for(const preset of HUMAN_IDENTITY_PRESETS.filter(p=>p.sourceLabel)){
 const label=preset.sourceLabel,pin=sourcePins.assets.find(a=>a.label===label),prepared=preparedPins.find(a=>a.label===label);
 const audition=JSON.parse(await fs.readFile(`${review}/${label}/manifest.json`,'utf8'));
 assert.equal(audition.identityReview.sourceSha256,pin.sha256);assert.equal(audition.items.body.sha256,prepared.bodySha256);
 // The pinned identity audition proves its original shared garments. Later catalogue
 // pieces come from the independently verified production shape family; they must not
 // require rewriting the accepted face/body audition or its source pins.
 // https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#morph-targets
 for(const [id,asset]of Object.entries(audition.items))if(!['body','graveweaverHood'].includes(id))assert.deepEqual(published.items[id],asset,`${label}/${id}: obsolete clothing audition`);
 const bodyBytes=gunzipSync(await fs.readFile(`${review}/${label}/${path.basename(audition.items.body.url)}`));assert.equal(sha(bodyBytes),prepared.bodySha256);
 const doc=await io.readBinary(bodyBytes),acceptedGeometry=identityGeometryHash(doc.getRoot()),acceptedCurves=identityAnimationHash(doc.getRoot());
 normalizeHumanBind(doc.getRoot(),reference,'HumanV1Body','HumanV1Body',{exactReference:true});
 assert.equal(identityGeometryHash(doc.getRoot()),acceptedGeometry,'Canonical bind copy changed accepted face geometry');
 assert.equal(identityAnimationHash(doc.getRoot()),acceptedCurves,'Canonical bind copy changed source animation');
 // The old accepted split left medial back triangles with arm influences
 // visible under shirts. Reclassify indices only; retain the accepted source
 // pins as independent proof rather than rewriting them to accept this output.
 const fullSource=await fs.readFile(`.cache/character-mmo/identity-v1/human-${label}-painted.glb`);assert.equal(sha(fullSource),pin.sha256);
 const sourceDoc=await io.readBinary(fullSource);
 normalizeHumanBind(sourceDoc.getRoot(),reference,'HumanV1Body','HumanV1Body',{exactReference:true});
 verifyCoveragePartition(sourceDoc.getRoot(),doc.getRoot(),'HumanV1Body','HumanTorsoCore');
 const otherGeometry=()=>identityGeometryHash({listMeshes:()=>doc.getRoot().listMeshes().filter(m=>!['HumanV1Body','HumanTorsoCore','HumanFootCore'].includes(m.getName()))});
 const acceptedOtherGeometry=otherGeometry(),torsoCoverage=repairIdentityTorsoCoverage(doc);
 // This bounded policy is reviewed on the three pinned authored bodies. A
 // changed classifier or source must earn a new fit review, not hide a larger
 // surface merely because it still repairs the original five picked faces.
 assert.equal(torsoCoverage.addedTriangles,32,'Unreviewed identity back partition');
 const footCoverage=deriveHumanFootCore(doc);
 assert.equal(otherGeometry(),acceptedOtherGeometry,'Coverage changed accepted eyes, brows or ponytail');
 assert.equal(identityAnimationHash(doc.getRoot()),acceptedCurves,'Coverage changed source curves');
 const repaired=await io.writeBinary(doc);
 torsoCoverage.verification=verifyCoveragePartition(sourceDoc.getRoot(),(await io.readBinary(repaired)).getRoot(),'HumanV1Body',['HumanTorsoCore','HumanFootCore']);
 const body=await encode(doc,'body',published.items.body);
 body.coverageRevision=audition.items.body.coverageRevision;
 // Restore full accepted texture maps, not the already embedded 256px preview.
 body.textures=[];
 const fullRoot=(await io.readBinary(fullSource)).getRoot();
 for(const texture of fullRoot.listTextures()){
  const bytes=Buffer.from(texture.getImage()),ext={'image/png':'png','image/jpeg':'jpg','image/webp':'webp'}[texture.getMimeType()];assert(ext);
  const name=`texture-${sha(bytes).slice(0,12)}.${ext}`,materials=fullRoot.listMaterials().filter(m=>m.getBaseColorTexture()===texture).map(m=>m.getName());assert(materials.length);
  await fs.writeFile(path.join(out,name),bytes);body.textures.push({materials,url:`${urlRoot}/${name}`});
 }
 // The face/skin/morphs are identical, so no body replacement or background
 // download of unused motions is needed. Native Lite keeps this actor/mixer;
 // optional identity editing still has the unchanged full 57-clip source.
 const playableClips=await compactPlayableAnimations(doc);
 const compactBody=await encode(doc,'body-compact',published.items.body);
 compactBody.textures=body.textures;compactBody.coverageRevision=body.coverageRevision;
 compactBody.detail='playable';compactBody.playableClips=playableClips;
 assert.equal(compactBody.geometrySha256,body.geometrySha256,'Playable body changed approved visual');
 const age=label.split('-')[0],hoodPin=JSON.parse(await fs.readFile(`${pinRoot}/hood-${age}-fit.json`,'utf8'));
 const hoodBytes=await fs.readFile(`${review}/${label}/${path.basename(audition.items.graveweaverHood.url)}`);assert.equal(sha(hoodBytes),hoodPin.assembledSha256);
 const hoodDoc=await io.readBinary(hoodBytes);normalizeHumanBind(hoodDoc.getRoot(),reference,'GraveweaverHood','HumanV1Body',{exactReference:true});
 const hood=await encode(hoodDoc,'graveweaverHood',published.items.graveweaverHood);
 // Same native first-play policy as the released clothes: remap every base,
 // skin and morph stream together and retain the face opening's boundary.
 // Full fitted hood remains untouched and upgrades through the existing actor.
 // https://gltf-transform.dev/modules/functions/functions/simplify
 const hoodPolicy={ratio:.4,error:.002,lockBorder:true};
 await hoodDoc.transform(simplify({simplifier:MeshoptSimplifier,...hoodPolicy}));
 const compactHood=await encode(hoodDoc,'graveweaverHood-compact',published.items.graveweaverHood);
 compactHood.textures=hood.textures;compactHood.detail='startup';compactHood.simplification=hoodPolicy;
 const manifest=structuredClone(published);
 manifest.items.body=body;manifest.compactItems.body=compactBody;manifest.items.graveweaverHood=hood;manifest.compactItems.graveweaverHood=compactHood;
 manifest.startup={textures:body.textures};
 manifest.coverage=structuredClone(audition.coverage);
 manifest.coverage.bodySegments.HumanV1Body=manifest.coverage.bodySegments.HumanV1Body.filter(segment=>segment!=='foot');
 manifest.coverage.bodySegments.HumanFootCore=['foot'];
 manifestBodyCoverage(manifest,'human');
 manifest.identity={preset:preset.id,components:preset.components,sourceLabel:label,sourceSha256:pin.sha256,
  bind:'canonical-source-65-v1',sourceBodySha256:prepared.bodySha256,sourceHoodSha256:hoodPin.assembledSha256,
  torsoCoverage,footCoverage,
  head:{id:preset.components.head,url:body.url,meshes:['HumanV1Body','HumanIdentityEyes','HumanIdentityBrows']},
  hair:{id:preset.components.hair,url:body.url,meshes:label.endsWith('-hair')?['HumanPonytail01']:[]}};
 delete manifest.provenance;delete manifest.reproduction;delete manifest.coverageProof;
 manifest.sourceRights={...published.sourceRights,identity:'CC0 MakeHuman source head, eyes, eyebrow001 and ponytail01; pinned source-summary and provenance under docs/baselines/character-mmo/m5/face-2026-10-04'};
 const bytes=Buffer.from(JSON.stringify(manifest)),name=`manifest-${preset.id}-${sha(bytes).slice(0,12)}.json`;
 await fs.writeFile(path.join(out,name),bytes);index.presets[preset.id]={url:`${urlRoot}/${name}`,sha256:sha(bytes),bytes:bytes.length,components:preset.components,manifest};
 ownedReferences+=bytes.toString();
 reports.push({preset:preset.id,sourceLabel:label,bodySha256:body.sha256,bodyEncodedBytes:body.encodedBytes,compactBodySha256:compactBody.sha256,compactBodyEncodedBytes:compactBody.encodedBytes,playableClips,hoodSha256:hood.sha256,hoodEncodedBytes:hood.encodedBytes,compactHoodSha256:compactHood.sha256,compactHoodEncodedBytes:compactHood.encodedBytes,bodyGeometryLossless:true,bindExact:true,torsoCoverage,footCoverage});
}
index.provenance=await startupProvenance(['scripts/character-assets/prepare-production-human-identities.mjs'],['public/ashen-reach/human-shape-v1/manifest.json',`${pinRoot}/source-summary.json`,`${pinRoot}/preparation.json`,`${pinRoot}/hood-old-fit.json`,`${pinRoot}/hood-young-fit.json`]);
await fs.writeFile(path.join(out,'manifest.json'),JSON.stringify(index));
await fs.writeFile(path.join(out,'preparation.json'),JSON.stringify(reports,null,2));
ownedReferences+=JSON.stringify(index);
for(const name of await fs.readdir(out))if(/^(?:body(?:-compact)?|graveweaverHood(?:-compact)?|texture|manifest-[a-z-]+)-[a-f0-9]{12}\.(?:bin|json|png|jpg|webp)$/.test(name)&&!ownedReferences.includes(name))await fs.unlink(path.join(out,name));
console.log(JSON.stringify(reports));
