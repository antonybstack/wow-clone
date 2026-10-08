/** Publish the reviewed sole derivative through the existing per-piece tools.
 * Local source packs only; shape/coverage/identity/remote preparation and a
 * sealed Pages release remain separate gates. No outfit permutation builder.
 * https://gltf-transform.dev/modules/extensions/classes/EXTMeshoptCompression
 * https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#skins
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {NodeIO,VertexLayout} from '@gltf-transform/core';
import {ALL_EXTENSIONS,EXTMeshoptCompression} from '@gltf-transform/extensions';
import {MeshoptDecoder,MeshoptEncoder} from 'meshoptimizer';
import {planPublication,executePublication,canonicalizeFactoryTriangles} from './equipment-factory-contract.mjs';
import {verifyFactoryEquipmentBind} from './verify-factory-equipment-bind.mjs';
import {EQUIPMENT_ITEMS} from '../../src/ashen-reach/equipment-catalog.js';
import {FITS_BY_RACE,assertAssetFit} from '../../src/ashen-reach/equipment-contract.js';
import {assertTriangleRotations} from './triangle-index-contract.mjs';

const args=process.argv.slice(2),strapPass=args.length===2&&args[0]==='--publish'&&args[1]==='--straps';
const lastPass=args.length===2&&args[0]==='--publish'&&args[1]==='--last';
const forefootPass=args.length===2&&args[0]==='--publish'&&args[1]==='--forefoot',codecPass=strapPass||lastPass||forefootPass;
assert(codecPass||JSON.stringify(args)===JSON.stringify(['--publish']),'Use --publish [--straps|--last|--forefoot] for local source packs; this does not deploy');
const sha=b=>createHash('sha256').update(b).digest('hex');
// Reuse the same immutable-file/manifest publication and Duskguard compiler
// for the reviewed strap derivative; do not introduce another asset publisher.
const pass=forefootPass?'forefoot':lastPass?'last':strapPass?'straps':'sole',builder=`scripts/character-assets/build-boot-${forefootPass?'last':pass}.mjs`;
const descriptorPath=`blender/characters/wardrobe/boot-${pass}.json`;
const descriptorBytes=await fs.readFile(descriptorPath),descriptor=JSON.parse(descriptorBytes);
const races=lastPass?['orc']:strapPass?['human','undead','orc']:['human','undead'],directory={human:'equipment',undead:'equipment-undead',orc:'equipment-orc'};
await fs.mkdir(`.cache/character-mmo/boot-${pass}`,{recursive:true});
const work=await fs.mkdtemp(`.cache/character-mmo/boot-${pass}/publication-`);
const run=(script,args)=>execFileSync(process.execPath,[script,...args],{stdio:'inherit'});
await Promise.all([MeshoptDecoder.ready,MeshoptEncoder.ready]);
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder,'meshopt.encoder':MeshoptEncoder}).setVertexLayout(VertexLayout.SEPARATE);
const oldPlates=new Map();
for(const race of races)oldPlates.set(race,(await io.read(`public/ashen-reach/${directory[race]}/duskguardGreaves.glb`)).getRoot().listMeshes().find(m=>m.getName()==='DuskguardGreaves'));
run(builder,[`${work}/first`,...(forefootPass?[descriptorPath]:[])]);
run(builder,[`${work}/repeat`,...(forefootPass?[descriptorPath]:[])]);
const builds={},manifests={},fits={};
const armorDescriptorPath='blender/characters/wardrobe/duskguard-armor.json';
const armorDescriptor=JSON.parse(await fs.readFile(armorDescriptorPath,'utf8'));
for(const race of races){
 const bytes=await fs.readFile(`${work}/first/${race}/wayfarerBoots.glb`);
 assert.deepEqual(bytes,await fs.readFile(`${work}/repeat/${race}/wayfarerBoots.glb`),'Non-repeatable boot build');
 const root=(await io.readBinary(bytes)).getRoot(),base=(await io.read(descriptor.fits[race].body)).getRoot();
 const verification=verifyFactoryEquipmentBind(root,base,descriptor.fits[race].bodyMesh);
 assertAssetFit({fit:FITS_BY_RACE[race]},EQUIPMENT_ITEMS.wayfarerBoots,race);
 builds[race]={bytes,sha256:sha(bytes),verification};fits[race]={directory:directory[race]};
 assert.equal(armorDescriptor.fits[race].underlayers.wayfarerBoots.sha256,sha(bytes),'Pin the reviewed Duskguard underlayer before any publication');
 manifests[race]=JSON.parse(await fs.readFile(`public/ashen-reach/${directory[race]}/manifest.json`,'utf8'));
}
assert.equal(sha(await fs.readFile(descriptorPath)),sha(descriptorBytes),'Boot descriptor changed');
const buildReport=JSON.parse(await fs.readFile(`${work}/first/report.json`,'utf8'));
const provenance={schema:1,generatedBy:'scripts/character-assets/prepare-boot-sole.mjs',...(codecPass?{arguments:args}:{}),localPacksPublished:true,productionReleased:false,byteIdenticalRebuild:true,[forefootPass?'forefootReport':lastPass?'lastReport':strapPass?'strapReport':'soleReport']:buildReport};
// The established publication primitive writes immutable assets and canonical
// authoring copies first, then atomically replaces each advertised manifest.
// No game check or release is permitted until the remaining derivatives finish.
await executePublication(planPublication({id:'wayfarerBoots',mesh:'WayfarerBoots',fits},builds,manifests,provenance));

// The existing Duskguard compiler reads the newly published canonical underlayer
// and enforces its reviewed descriptor hash. No copied private audition plate.
run('scripts/character-assets/build-duskguard-armor.mjs',races);
const armorReport=JSON.parse(await fs.readFile('.cache/character-mmo/wardrobe-v1/duskguard/report.json','utf8'));
assert.equal(armorReport.descriptor.sha256,sha(await fs.readFile(armorDescriptorPath)));
for(const tool of armorReport.toolSources)assert.equal(sha(await fs.readFile(tool.path)),tool.sha256,'Duskguard tools changed');
const files=[],manifestWrites=[],rows=[];
for(const race of races){
 const source=`.cache/character-mmo/wardrobe-v1/duskguard/${race}/duskguardGreaves.glb`,input=await fs.readFile(source);
 const row=armorReport.rows.find(r=>r.race===race&&r.id==='duskguardGreaves');assert.equal(sha(input),row.sha256);
 const doc=await io.readBinary(input),root=doc.getRoot(),plate=root.listMeshes().find(m=>m.getName()==='DuskguardGreaves'),old=oldPlates.get(race);
 assert.equal(plate.listPrimitives().length,old.listPrimitives().length);
 let plateIndicesExact=!lastPass;
 // The last pass explicitly replaces the Orc greave envelope. Compare its
 // decoded geometry with the independently live-reviewed plate fingerprint;
 // the existing strap/sole paths still require their old plate arrays exact.
 if(lastPass){
  assert.equal(race,'orc');assert.equal(armorDescriptor.fits.orc.greaveEnvelope,'wayfarerBoots');
  // Normalize a separate readback with the established BMesh triangle helper:
  // it retains winding and duplicates while handling exporter face ordering.
  // The actual published arrays are untouched and encoding is checked below.
  const reviewedRoot=(await io.readBinary(input)).getRoot();canonicalizeFactoryTriangles(reviewedRoot);
  const reviewedPlate=reviewedRoot.listMeshes().find(m=>m.getName()==='DuskguardGreaves');
  const fingerprint=sha(Buffer.from(JSON.stringify(reviewedPlate.listPrimitives().map(p=>({indices:Array.from(p.getIndices().getArray()),semantics:Object.fromEntries(p.listSemantics().sort().map(s=>[s,Array.from(p.getAttribute(s).getArray())])),material:p.getMaterial().getName()})))));
  assert.equal(fingerprint,descriptor.reviewedGreaveGeometrySha256,'Greave differs from live-reviewed envelope');
 }
 for(let i=0;!lastPass&&i<old.listPrimitives().length;i++){
  const p=plate.listPrimitives()[i],before=old.listPrimitives()[i];
  const actual=p.getIndices().getArray(),expected=before.getIndices().getArray();
  if(codecPass)assertTriangleRotations(actual,expected,'Existing plate topology');
  else assert.deepEqual(actual,expected,'Existing plate topology changed');
  plateIndicesExact&&=actual.every((v,i)=>v===expected[i]);
  assert.deepEqual(p.listSemantics().sort(),before.listSemantics().sort());
  for(const semantic of before.listSemantics())assert.deepEqual(p.getAttribute(semantic).getArray(),before.getAttribute(semantic).getArray(),`Existing plate ${semantic} changed`);
 }
 const underlayer=root.listMeshes().find(m=>m.getName()==='DuskguardBootUnderlayer').listPrimitives()[0];
 const sole=(await io.readBinary(builds[race].bytes)).getRoot().listMeshes()[0].listPrimitives()[0];
 if(codecPass)assertTriangleRotations(underlayer.getIndices().getArray(),sole.getIndices().getArray(),'Reviewed underlayer topology');
 else assert.deepEqual(underlayer.getIndices().getArray(),sole.getIndices().getArray());
 const underlayerIndicesExact=underlayer.getIndices().getArray().every((v,i)=>v===sole.getIndices().getArray()[i]);
 for(const semantic of sole.listSemantics())assert.deepEqual(underlayer.getAttribute(semantic).getArray(),sole.getAttribute(semantic).getArray(),`Underlayer ${semantic} differs from reviewed sole`);
 for(const extension of root.listExtensionsUsed())if(extension.extensionName==='EXT_meshopt_compression')extension.dispose();
 doc.createExtension(EXTMeshoptCompression).setRequired(true);
 const bytes=await io.writeBinary(doc),digest=sha(bytes),id='duskguardGreaves',dir=`public/ashen-reach/${directory[race]}`,name=`${id}-${digest.slice(0,12)}.glb`;
 const written=(await io.readBinary(bytes)).getRoot(),base=(await io.read(descriptor.fits[race].body)).getRoot();
 // Compression is independently read back. Cyclic rotations are documented
 // by the codec; actual vertex attributes and ordered wound faces stay exact.
 // https://github.com/zeux/meshoptimizer#index-compression
 if(codecPass)for(const mesh of root.listMeshes()){
  const check=written.listMeshes().find(m=>m.getName()===mesh.getName());assert(check);assert.equal(check.listPrimitives().length,mesh.listPrimitives().length);
  for(const [i,p]of mesh.listPrimitives().entries()){
   const q=check.listPrimitives()[i];assertTriangleRotations(q.getIndices().getArray(),p.getIndices().getArray(),`Written ${mesh.getName()}`);
   assert.deepEqual(q.listSemantics().sort(),p.listSemantics().sort());
   for(const semantic of p.listSemantics())assert.deepEqual(q.getAttribute(semantic).getArray(),p.getAttribute(semantic).getArray(),`Written ${mesh.getName()}/${semantic}`);
  }
 }
 const verification=verifyFactoryEquipmentBind(written,base,descriptor.fits[race].bodyMesh),meshes=EQUIPMENT_ITEMS[id].parts.map(p=>p.mesh).sort();
 assert.deepEqual(written.listMeshes().map(m=>m.getName()).sort(),meshes);
 assertAssetFit({fit:FITS_BY_RACE[race]},EQUIPMENT_ITEMS[id],race);
 const manifest=JSON.parse(await fs.readFile(`${dir}/manifest.json`,'utf8'));
 manifest.items[id]={url:`/ashen-reach/${directory[race]}/${name}`,bytes:bytes.length,sha256:digest,meshes,fit:FITS_BY_RACE[race]};
 files.push({path:`${dir}/${name}`,bytes},{path:`${dir}/${id}.glb`,bytes});
 manifestWrites.push({path:`${dir}/manifest.json`,bytes:Buffer.from(JSON.stringify(manifest,null,2)+'\n')});
 rows.push({race,id,source:{path:source,sha256:sha(input)},artifact:manifest.items[id],verification,existingPlateArraysExact:plateIndicesExact,reviewedUnderlayerArraysExact:underlayerIndicesExact,...(codecPass?{existingPlateSemanticArraysExact:!lastPass,orderedWoundTrianglesExact:true,encodedReadbackArraysAndTrianglesVerified:true}: {}),...(lastPass?{reviewedGreaveGeometrySha256:descriptor.reviewedGreaveGeometrySha256}: {})});
}
provenance.duskguard={sourceReport:armorReport,rows};
provenance.tools=await Promise.all(['scripts/character-assets/prepare-boot-sole.mjs',builder,'scripts/character-assets/equipment-factory-contract.mjs',...(codecPass?['scripts/character-assets/triangle-index-contract.mjs']:[]),descriptorPath,armorDescriptorPath].map(async p=>({path:p,sha256:sha(await fs.readFile(p))})));
files.push({path:`public/ashen-reach/boot-${pass}-provenance.json`,bytes:Buffer.from(JSON.stringify(provenance,null,2)+'\n')});
await executePublication({files,manifests:manifestWrites});
await fs.writeFile(path.join(work,'publication.json'),JSON.stringify(provenance,null,2)+'\n');
console.log(JSON.stringify({localSourcePacksPublished:true,productionReleased:false,races,work,remaining:['Human shapes','starter compacts','coverage','identity equipment','native remote bounds','live canonical acceptance','sealed release']}));
