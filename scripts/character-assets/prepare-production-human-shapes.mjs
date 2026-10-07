/** Reproduce the production Human family from tracked canonical inputs, never .cache inputs.
 * Lossless meshopt preserves bind/accessor order; compact textures upgrade independently.
 * https://gltf-transform.dev/modules/extensions/classes/EXTMeshoptCompression
 * https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#morph-targets
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {NodeIO, VertexLayout} from '@gltf-transform/core';
import {ALL_EXTENSIONS, EXTMeshoptCompression} from '@gltf-transform/extensions';
import {MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier} from 'meshoptimizer';
import sharp from 'sharp';
import {simplify} from '@gltf-transform/functions';
import {EQUIPMENT_ITEMS} from '../../src/ashen-reach/equipment-catalog.js';
import {retainFullStartupGeometry} from './startup-geometry-policy.mjs';
import {compileCoverageManifest,writeCoverageCompilation} from './compile-coverage-manifest.mjs';
import {compactPlayableAnimations} from './compact-playable-animations.mjs';
import {quantizeCharacterNormals,assertCharacterNormalProof,characterNormalProof} from './quantize-character-normals.mjs';
import {compactNormalPolicy} from './compact-normal-policy.mjs';
import {startupProvenance} from '../ashen-reach/startup-provenance.mjs';
const out=process.env.ASHEN_PRODUCTION_SHAPE_OUT || 'public/ashen-reach/human-shape-v1';
const urlRoot='/ashen-reach/human-shape-v1';
const family='ashen-human-shape-v1';
const sha=b=>createHash('sha256').update(b).digest('hex');
const work=await fs.mkdtemp(path.join(os.tmpdir(),'ashen-human-family-'));
try {
  const body=path.join(work,'body.glb'), garments=path.join(work,'garments');
  const run=(file,extra)=>execFileSync(process.execPath,[file],{env:{...process.env,...extra},stdio:'inherit'});
  run('scripts/character-assets/build-human-shape-family.mjs',{ASHEN_SHAPE_OUT:body,ASHEN_SHAPE_REPORT:path.join(work,'body-report.json')});
  run('scripts/character-assets/build-garment-shape-family.mjs',{ASHEN_GARMENT_BODY:body,ASHEN_GARMENT_OUT:garments,ASHEN_GARMENT_REPORT:path.join(work,'garment-report.json'),ASHEN_SKIP_PLATE:'1',ASHEN_PRODUCTION_PLATE:'1',ASHEN_FIT_MODE:'track',ASHEN_HEMS:'1'});
  await Promise.all([MeshoptDecoder.ready,MeshoptEncoder.ready,MeshoptSimplifier.ready]);
  const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder,'meshopt.encoder':MeshoptEncoder}).setVertexLayout(VertexLayout.SEPARATE);
  await fs.mkdir(out,{recursive:true});
  const base=JSON.parse(await fs.readFile('public/ashen-reach/equipment/manifest.json','utf8'));
  let manifest={schema:base.schema,fitId:base.fitId,shapeFamily:family,targetNames:['slender','stout'],items:{},compactItems:{}};
  const source=JSON.parse(await fs.readFile(path.join(work,'body-report.json'),'utf8'));
  const fits=JSON.parse(await fs.readFile(path.join(work,'garment-report.json'),'utf8'));
  for(const id of Object.keys(base.items)) {
    const src=id==='body'?body:path.join(garments,`${id}.glb`);
    const doc=await io.read(src),textures=[];
    for(const t of doc.getRoot().listTextures()) {
      const original=Buffer.from(t.getImage());
      const mime=t.getMimeType(),ext=mime==='image/png'?'png':mime==='image/jpeg'?'jpg':mime==='image/webp'?'webp':null;
      if(!ext)throw Error(`Unsupported source texture ${mime}`);
      const name=`texture-${sha(original).slice(0,12)}.${ext}`;
      await fs.writeFile(path.join(out,name),original);
      const materials=doc.getRoot().listMaterials().filter(m=>m.getBaseColorTexture()===t).map(m=>m.getName());
      if(!materials.length)throw Error(`Non-base-color texture needs explicit upgrade policy: ${id}`);
      textures.push({materials,url:`${urlRoot}/${name}`});
      t.setImage(await sharp(original).resize(256,256,{fit:'inside',withoutEnlargement:true}).webp({quality:85}).toBuffer()).setMimeType('image/webp');
    }
    doc.createExtension(EXTMeshoptCompression).setRequired(true);
    const bytes=await io.writeBinary(doc),encoded=gzipSync(bytes,{level:9});
    // Loader 1.31.1 ignores morph byteStride; keep each target tightly packed.
    const jsonLength=Buffer.from(bytes).readUInt32LE(12),json=JSON.parse(Buffer.from(bytes).subarray(20,20+jsonLength).toString());
    for(const m of json.meshes)for(const p of m.primitives)for(const target of p.targets||[])for(const ai of Object.values(target)) {
      const view=json.bufferViews[json.accessors[ai].bufferView];
      if(view.byteStride && view.byteStride!==12)throw Error(`${id}: interleaved morph target`);
    }
    const name=`${id}-${sha(encoded).slice(0,12)}.bin`;
    await fs.writeFile(path.join(out,name),encoded);
    const sourceMetadata={...base.items[id]};delete sourceMetadata.coverageSource;delete sourceMetadata.coverageRevision;
    manifest.items[id]={...sourceMetadata,meshes:doc.getRoot().listMeshes().map(m=>m.getName()),url:`${urlRoot}/${name}`,bytes:bytes.length,encodedBytes:encoded.length,sha256:sha(bytes),compression:'gzip',shapeFamily:family,textures};
    if(id==='body') {
      // First play of a saved shaped original needs only the shared playable clips. Keep
      // items.body as the full 57-clip source; publish a distinct compact body through the
      // same helper and metadata pattern as the identity pack (detail 'playable').
      // https://gltf-transform.dev/modules/functions/functions/prune
      const playableClips=await compactPlayableAnimations(doc);
      const normals=await quantizeCharacterNormals(doc,{method:'exp16'});
      const compact=await io.writeBinary(doc),packed=gzipSync(compact,{level:9});
      assertCharacterNormalProof(normals.before,characterNormalProof((await io.readBinary(compact)).getRoot()),normals.maxError);
      const compactName=`${id}-compact-${sha(packed).slice(0,12)}.bin`;
      await fs.writeFile(path.join(out,compactName),packed);
      manifest.compactItems[id]={...manifest.items[id],url:`${urlRoot}/${compactName}`,bytes:compact.length,encodedBytes:packed.length,sha256:sha(compact),detail:'playable',playableClips,normalPacking:compactNormalPolicy(normals)};
    }
    else if(retainFullStartupGeometry(doc.getRoot(),EQUIPMENT_ITEMS[id]))manifest.compactItems[id]=manifest.items[id];
    else {
      // glTF Transform remaps ALL base/skin/morph attributes together. Preserve seam
      // boundaries and use this only for first-play clothing; full detail follows after play.
      // https://gltf-transform.dev/modules/functions/functions/simplify
      await doc.transform(simplify({simplifier:MeshoptSimplifier,ratio:.4,error:.002,lockBorder:true}));
      // Preserve the hood's reviewed opening records, including exact normals.
      // Round eligible cloth before coverage partitioning so its source proof stays exact.
      const normals=id==='graveweaverHood'?null:await quantizeCharacterNormals(doc,{method:'exp16'});
      const compact=await io.writeBinary(doc),packed=gzipSync(compact,{level:9});
      if(normals)assertCharacterNormalProof(normals.before,characterNormalProof((await io.readBinary(compact)).getRoot()),normals.maxError);
      const compactName=`${id}-compact-${sha(packed).slice(0,12)}.bin`;
      await fs.writeFile(path.join(out,compactName),packed);
      manifest.compactItems[id]={...manifest.items[id],url:`${urlRoot}/${compactName}`,bytes:compact.length,encodedBytes:packed.length,sha256:sha(compact),detail:'startup',simplification:{ratio:.4,error:.002,lockBorder:true},...(normals?{normalPacking:compactNormalPolicy(normals)}:{})};
    }
    console.log(`${id}: ${encoded.length} full / ${manifest.compactItems[id].encodedBytes} compact bytes`);
  }
  if(out!=='public/ashen-reach/human-shape-v1'){await fs.mkdir(path.join(work,'source-public',urlRoot),{recursive:true});for(const name of await fs.readdir(out))await fs.copyFile(path.join(out,name),path.join(work,'source-public',urlRoot,name));}
  const coverage=await compileCoverageManifest({io,manifest,race:'human',outDirectory:out,urlRoot,sourceRoot:out==='public/ashen-reach/human-shape-v1'?'public':path.join(work,'source-public')});
  await writeCoverageCompilation(coverage);manifest=coverage.manifest;
  manifest.coverageProof=coverage.reports;
  manifest.startup={textures:manifest.items.body.textures};
  manifest.provenance=await startupProvenance(['scripts/character-assets/prepare-production-human-shapes.mjs','scripts/character-assets/quantize-character-normals.mjs','scripts/character-assets/compact-normal-policy.mjs','scripts/character-assets/human-identity-proof.mjs','scripts/character-assets/build-human-shape-family.mjs','scripts/character-assets/build-garment-shape-family.mjs','scripts/character-assets/startup-geometry-policy.mjs','scripts/character-assets/compile-coverage-manifest.mjs','scripts/character-assets/derive-coverage-geosets.mjs','scripts/character-assets/partition-coverage-mesh.mjs','scripts/character-assets/verify-coverage-partition.mjs','src/ashen-reach/coverage-contract.js','src/ashen-reach/coverage-pilot.js','src/ashen-reach/equipment-catalog.js','src/ashen-reach/equipment-contract.js'],['docs/baselines/character-mmo/m004/makehuman-girth.json','public/ashen-reach/equipment/manifest.json',...Object.keys(base.items).map(id=>`public/ashen-reach/equipment/${id}.glb`)]);
  manifest.reproduction={neutralIdentity:source.neutralIdentity,clips:source.clips,girthSource:source.girthSource,
    garments:fits.garments.map(({item,source,pieces,hems})=>({item,source,pieces,hems}))};
  manifest.tooling={node:process.versions.node};
  for(const name of ['@gltf-transform/core','meshoptimizer','@babylonjs/lite','sharp'])
    manifest.tooling[name]=JSON.parse(await fs.readFile(`node_modules/${name}/package.json`,'utf8')).version;
  manifest.sourceRights={girth:'CC0 MakeHuman measured ratios; see girthSource and vendored provenance',
    garments:'CC0 MakeHuman suits02/gloves01 plus project-authored trim/fits; docs/ashen-equipment-authoring.md',
    body:'Existing published project Tripo/Mixamo Human; original grant absent from provenance (M001 documented limitation). No new source actor is generated by this recipe.'};
  const serialized=JSON.stringify(manifest);
  await fs.writeFile(path.join(out,'manifest.json'),serialized);
  // Canonical immutable URLs can still be referenced by a retained identity
  // descriptor or an in-flight client. Asset garbage collection is a separate
  // operation; an equipment update must not delete those outstanding requests.
  // https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cache-Control#immutable
  if(out!=='public/ashen-reach/human-shape-v1')for(const name of await fs.readdir(out))
    if(/^(?:[A-Za-z]+(?:-compact)?-[a-f0-9]{12}\.bin|texture-[a-f0-9]{12}\.(?:png|jpg|webp))$/.test(name)&&!serialized.includes(name))await fs.unlink(path.join(out,name));
} finally {await fs.rm(work,{recursive:true,force:true});}
