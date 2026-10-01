/** Reproduce a real independently streamed rigid shoulder item for each accepted body.
 * Author with native Blender BMesh/Solidify, then restore THAT body's ordered bind.
 * No animation copies, retargeting, inferred Human fallback or baked-outfit combinations.
 * https://docs.blender.org/manual/en/latest/modeling/modifiers/generate/solidify.html
 * https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#skins
 */
import fs from 'node:fs/promises';
import {spawn,execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {NodeIO,VertexLayout} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {MeshoptDecoder} from 'meshoptimizer';
import {normalizeHumanBind} from './normalize-human-bind.mjs';
import {FITS_BY_RACE,assertAssetFit} from '../../src/ashen-reach/equipment-contract.js';
import {EQUIPMENT_ITEMS} from '../../src/ashen-reach/equipment-catalog.js';
const sha=b=>createHash('sha256').update(b).digest('hex');
const work='.cache/character-mmo/wardrobe-v1';await fs.mkdir(work,{recursive:true});
await MeshoptDecoder.ready;
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder}).setVertexLayout(VertexLayout.SEPARATE);
const descriptor=JSON.parse(await fs.readFile('blender/characters/wardrobe/warden-pauldrons.json','utf8'));
if(descriptor.schema!==1||descriptor.id!=='wardenPauldrons'||descriptor.slot!=='shoulders')throw Error('Unsupported plate descriptor');
const item=EQUIPMENT_ITEMS[descriptor.id];
for(const key of ['slot','layer','deformation'])if(descriptor[key]!==item[key])throw Error(`Descriptor/catalogue ${key} mismatch`);
if(JSON.stringify(descriptor.occupies)!==JSON.stringify(item.occupies)||
 JSON.stringify(Object.keys(descriptor.fits).sort())!==JSON.stringify(Object.keys(item.fits).sort()))throw Error('Descriptor/catalogue occupancy or race mismatch');
const blender=process.env.ASHEN_BLENDER||'/Applications/Blender.app/Contents/MacOS/Blender';
if(!execFileSync(blender,['--version'],{encoding:'utf8'}).startsWith(`Blender ${descriptor.blenderVersion} `))throw Error('Plate compiler requires pinned Blender');
const rows=[],pending=[],toolSources=[];
for(const path of ['scripts/character-assets/prepare-warden-pauldrons.mjs','scripts/character-assets/build_warden_pauldrons.py','scripts/character-assets/normalize-human-bind.mjs'])toolSources.push({path,sha256:sha(await fs.readFile(path))});
for(const [race,fit]of Object.entries(descriptor.fits)){
 assertAssetFit({fit:fit.interface},item,race);
 const {directory:dir,bodyMesh:meshName,source}=fit;
 if(!FITS_BY_RACE[race]||sha(await fs.readFile(source))!==fit.sha256)throw Error(`Unverified ${race} source; revise the descriptor explicitly`);
 const raw=`${work}/${race}-pauldrons-raw.glb`,blend=`${work}/${race}-pauldrons.blend`;
 const child=spawn(blender,['--background','--factory-startup','--python-exit-code','1','--python','scripts/character-assets/build_warden_pauldrons.py'],{stdio:'inherit',env:{...process.env,ASHEN_PLATE_SOURCE:source,ASHEN_PLATE_OUT:raw,ASHEN_PLATE_BLEND:blend,ASHEN_PLATE_BODY_MESH:meshName}});
 await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',(code,signal)=>code===0?resolve():reject(Error(`${race} plate export failed: ${signal||code}`)));});
 const doc=await io.read(raw),root=doc.getRoot(),base=(await io.read(source)).getRoot();
 normalizeHumanBind(root,base,'WardenPauldrons',meshName);
 // Blender float roundtrips are close enough to verify; consumers borrow the exact
 // accepted palette. Restore its matrices/hierarchy after checking, so hashes also agree.
 root.listSkins()[0].getInverseBindMatrices().setArray(base.listSkins()[0].getInverseBindMatrices().getArray().slice());
 const joints=new Map(base.listSkins()[0].listJoints().map(n=>[n.getName(),n]));
 const copyTRS=(target,source)=>target.setTranslation(source.getTranslation()).setRotation(source.getRotation()).setScale(source.getScale());
 for(const n of root.listNodes())if(joints.has(n.getName()))copyTRS(n,joints.get(n.getName()));
 // Match non-joint ancestor transforms as well, including the armature scale node.
 for(const n of root.listNodes())if(!n.getMesh()&&!joints.has(n.getName())){
  const matching=base.listNodes().find(b=>b.getName()===n.getName());if(matching)copyTRS(n,matching);
 }
 for(const n of root.listNodes().filter(n=>n.getMesh()))n.setMatrix(base.listNodes().find(n=>n.getMesh()?.getName()===meshName).getWorldMatrix());
 const skin=root.listSkins()[0],names=skin.listJoints().map(n=>n.getName());let vertices=0,triangles=0;
 for(const mesh of root.listMeshes())for(const p of mesh.listPrimitives()){
  const weights=p.getAttribute('WEIGHTS_0').getArray(),indices=p.getAttribute('JOINTS_0').getArray();
  for(let v=0;v<weights.length;v+=4){if(weights[v]!==1||weights[v+1]!==0||weights[v+2]!==0||weights[v+3]!==0||!['mixamorig:LeftArm','mixamorig:RightArm'].includes(names[indices[v]]))throw Error(`${race} plate is not single-bone rigid`);}
  vertices+=p.getAttribute('POSITION').getCount();triangles+=p.getIndices().getCount()/3;
 }
 if(root.listAnimations().length)throw Error('Equipment must not carry clips');
 for(const material of root.listMaterials()){
  const actual=[...material.getBaseColorFactor(),material.getMetallicFactor(),material.getRoughnessFactor()];
  const expected=[...descriptor.material.baseColor,descriptor.material.metallic,descriptor.material.roughness];
  if(actual.length!==expected.length||actual.some((n,i)=>Math.abs(n-expected[i])>1e-6))throw Error(`${race}: material differs from its descriptor revision`);
 }
 const bytes=await io.writeBinary(doc),digest=sha(bytes),file=`public/ashen-reach/${dir}/wardenPauldrons.glb`;
 const immutable=file.replace('.glb',`-${digest.slice(0,12)}.glb`);
 pending.push({file,immutable,bytes});
 const manifestPath=`public/ashen-reach/${dir}/manifest.json`,manifest=JSON.parse(await fs.readFile(manifestPath,'utf8'));
 manifest.items.wardenPauldrons={url:`/ashen-reach/${dir}/wardenPauldrons-${digest.slice(0,12)}.glb`,bytes:bytes.length,sha256:digest,meshes:['WardenPauldrons'],fit:FITS_BY_RACE[race]};
 pending.push({file:manifestPath,bytes:JSON.stringify(manifest,null,2)+'\n'});
 rows.push({race,interface:fit.interface,source:{path:source,sha256:sha(await fs.readFile(source))},artifact:{path:file,sha256:digest,bytes:bytes.length},vertices,triangles,rigidity:'Every vertex is weighted 1.0 to one accepted upper-arm bone.'});
 console.log(`${race}: ${vertices} vertices, ${triangles} triangles, ${bytes.length} bytes`);
}
// All race geometry/bind checks pass before any advertised manifest changes.
// Write every referenced immutable artifact before replacing any manifest. A
// failed artifact write must leave all advertised race manifests untouched.
for(const entry of pending.filter(e=>e.immutable)){await fs.writeFile(entry.file,entry.bytes);await fs.writeFile(entry.immutable,entry.bytes);}
for(const entry of pending.filter(e=>!e.immutable))await fs.writeFile(entry.file,entry.bytes);
const report={descriptor:{path:'blender/characters/wardrobe/warden-pauldrons.json',sha256:sha(await fs.readFile('blender/characters/wardrobe/warden-pauldrons.json'))},schema:1,item:'wardenPauldrons',slot:'shoulders',generatedBy:'scripts/character-assets/prepare-warden-pauldrons.mjs',toolSources,sourceRights:descriptor.sourceRights,material:descriptor.material,detail:descriptor.detail,corrective:descriptor.corrective,tooling:{blender:'5.2.1',node:process.versions.node},authoring:{standoffM:.032,thicknessM:.010,capRadius:'0.46 × actual upper-arm rest length, clamped 0.115–0.20 m',deformation:'one full-weight upper-arm bone per plate'},fits:rows};
await fs.writeFile('public/ashen-reach/warden-pauldrons-provenance.json',JSON.stringify(report,null,2)+'\n');
