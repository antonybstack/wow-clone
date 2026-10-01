/** Reproduce independent per-slot designs, then publish every immutable fit before
 * changing advertised manifests. This never builds full-outfit permutations.
 * Native glTF Transform compression preserves indices/skin and mesh dependencies.
 * https://gltf-transform.dev/modules/extensions/classes/EXTMeshoptCompression
 * https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#skins
 */
import fs from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {NodeIO,VertexLayout} from '@gltf-transform/core';
import {ALL_EXTENSIONS,EXTMeshoptCompression} from '@gltf-transform/extensions';
import {MeshoptDecoder,MeshoptEncoder} from 'meshoptimizer';
import {EQUIPMENT_ITEMS} from '../../src/ashen-reach/equipment-catalog.js';
import {assertAssetFit,FITS_BY_RACE} from '../../src/ashen-reach/equipment-contract.js';
import {verifyFactoryEquipmentBind} from './verify-factory-equipment-bind.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
const specifications=[{kind:'lector',descriptor:'lector-coat',compiler:'build-lector-coat',ids:['lectorCoat']},
 {kind:'duskguard',descriptor:'duskguard-armor',compiler:'build-duskguard-armor',ids:['duskguardCuirass','duskguardTassets','duskguardGreaves','duskguardVambraces']}];
await Promise.all([MeshoptDecoder.ready,MeshoptEncoder.ready]);
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder,'meshopt.encoder':MeshoptEncoder}).setVertexLayout(VertexLayout.SEPARATE);
const artifacts=[],manifests=new Map(),reports=[];
for(const spec of specifications){
 const descriptorPath=`blender/characters/wardrobe/${spec.descriptor}.json`;
 const descriptor=JSON.parse(await fs.readFile(descriptorPath,'utf8'));
 if(descriptor.status!=='reviewed-source; production integration pending')throw Error(`Source motion review is not recorded: ${spec.kind}`);
 execFileSync(process.execPath,[`scripts/character-assets/${spec.compiler}.mjs`],{stdio:'inherit'});
 const report=JSON.parse(await fs.readFile(`.cache/character-mmo/wardrobe-v1/${spec.kind}/report.json`,'utf8'));
 if(report.descriptor.sha256!==sha(await fs.readFile(descriptorPath)))throw Error('Factory descriptor/report mismatch');
 for(const tool of report.toolSources)if(sha(await fs.readFile(tool.path))!==tool.sha256)throw Error('Factory tool provenance mismatch');
 for(const [race,fit]of Object.entries(descriptor.fits)){
  const base=(await io.read(fit.source)).getRoot(),manifestPath=`public/ashen-reach/${fit.directory}/manifest.json`;
  if(sha(await fs.readFile(fit.source))!==fit.sha256)throw Error('Factory body source changed');
  if(!manifests.has(manifestPath))manifests.set(manifestPath,JSON.parse(await fs.readFile(manifestPath,'utf8')));
  const manifest=manifests.get(manifestPath);
  for(const id of spec.ids){
   const item=EQUIPMENT_ITEMS[id];if(!item)throw Error(`Factory item absent from catalogue: ${id}`);
   assertAssetFit({fit:fit.interface},item,race);
   const file=`.cache/character-mmo/wardrobe-v1/${spec.kind}/${race}/${id}.glb`,source=await fs.readFile(file);
   const row=report.rows.find(r=>r.race===race&&(r.id===id||id==='lectorCoat'));
   if(!row||row.sha256!==sha(source))throw Error('Factory artifact/report mismatch');
   const doc=await io.readBinary(source),root=doc.getRoot(),expected=item.parts.map(p=>p.mesh).sort();
   if(JSON.stringify(root.listMeshes().map(m=>m.getName()).sort())!==JSON.stringify(expected))throw Error(`${race}/${id}: factory mesh catalogue mismatch`);
   verifyFactoryEquipmentBind(root,base,fit.bodyMesh);
   for(const extension of root.listExtensionsUsed())if(extension.extensionName==='EXT_meshopt_compression')extension.dispose();
   doc.createExtension(EXTMeshoptCompression).setRequired(true);
   const bytes=await io.writeBinary(doc),digest=sha(bytes),name=`${id}-${digest.slice(0,12)}.glb`;
   const verification=verifyFactoryEquipmentBind((await io.readBinary(bytes)).getRoot(),base,fit.bodyMesh);
   const path=`public/ashen-reach/${fit.directory}/${id}.glb`,immutable=`public/ashen-reach/${fit.directory}/${name}`;
   artifacts.push({path,immutable,bytes});
   manifest.items[id]={url:`/ashen-reach/${fit.directory}/${name}`,bytes:bytes.length,sha256:digest,meshes:expected,fit:FITS_BY_RACE[race]};
   reports.push({race,id,source:{path:file,sha256:sha(source)},artifact:{path,immutable,sha256:digest,bytes:bytes.length},verification});
  }
 }
}
// Validate every fit and artifact before writing any advertised manifest. Referenced
// immutable assets are first; each small manifest is replaced atomically afterwards.
for(const a of artifacts){await fs.writeFile(a.immutable,a.bytes);await fs.writeFile(a.path,a.bytes);}
for(const [path,manifest]of manifests){const temp=`${path}.wardrobe-tmp`;await fs.writeFile(temp,JSON.stringify(manifest,null,2)+'\n');await fs.rename(temp,path);}
await fs.writeFile('public/ashen-reach/wardrobe-designs-provenance.json',JSON.stringify({schema:1,generatedBy:'scripts/character-assets/prepare-wardrobe-designs.mjs',sourceReports:await Promise.all(specifications.map(async s=>JSON.parse(await fs.readFile(`.cache/character-mmo/wardrobe-v1/${s.kind}/report.json`,'utf8')))),fits:reports},null,2)+'\n');
console.log(`Published ${reports.length} exact per-piece/race fits; no outfit permutations.`);
