/** Native per-race rigid pieces composed with exact accepted soft underlayers.
 * One streamed item per slot; no full-outfit permutation cache or animation copies.
 * Mesh dependencies reuse glTF Transform's supported document-copy operation.
 * https://gltf-transform.dev/modules/functions/functions/copyToDocument
 * https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#skins
 */
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {NodeIO,VertexLayout} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {copyToDocument,unpartition} from '@gltf-transform/functions';
import {MeshoptDecoder,MeshoptEncoder} from 'meshoptimizer';
import {normalizeHumanBind} from './normalize-human-bind.mjs';
import {verifyFactoryEquipmentBind} from './verify-factory-equipment-bind.mjs';
const descriptorPath='blender/characters/wardrobe/duskguard-armor.json';
const descriptor=JSON.parse(await fs.readFile(descriptorPath,'utf8'));
if(descriptor.schema!==1||descriptor.id!=='duskguard'||descriptor.blenderVersion!=='5.2.1')throw Error('Unsupported armor descriptor');
const sha=b=>createHash('sha256').update(b).digest('hex');
const directory='.cache/character-mmo/wardrobe-v1/duskguard';
const blender=process.env.ASHEN_BLENDER||'/Applications/Blender.app/Contents/MacOS/Blender';
if(!execFileSync(blender,['--version'],{encoding:'utf8'}).startsWith('Blender 5.2.1 '))throw Error('Pinned Blender required');
await Promise.all([MeshoptDecoder.ready,MeshoptEncoder.ready]);
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder,'meshopt.encoder':MeshoptEncoder}).setVertexLayout(VertexLayout.SEPARATE);
const selected=process.argv.slice(2);if(selected.some(r=>!descriptor.fits[r]))throw Error('Unknown race');
const toolSources=await Promise.all(["scripts/character-assets/build-duskguard-armor.mjs", "scripts/character-assets/author-duskguard-plates.py", "scripts/character-assets/normalize-human-bind.mjs", "scripts/character-assets/verify-factory-equipment-bind.mjs","scripts/character-assets/native_cloth_panels.py"].map(async path=>({path,sha256:sha(await fs.readFile(path))})));
const rows=[];
for(const [race,fit]of Object.entries(descriptor.fits)){
 if(selected.length&&!selected.includes(race))continue;
 const work=`${directory}/${race}`;await fs.mkdir(work,{recursive:true});
 for(const source of [{source:fit.source,sha256:fit.sha256},...Object.values(fit.underlayers)])
  if(sha(await fs.readFile(source.source))!==source.sha256)throw Error(`Unreviewed changed source: ${source.source}`);
 const start=performance.now();
 const authorArgs=[fit.source,fit.bodyMesh,work];
 if(fit.greaveEnvelope){
  if(race!=='orc'||fit.greaveEnvelope!=='wayfarerBoots')throw Error('Unreviewed greave envelope policy');
  // This underlayer was hash-checked above; Blender uses its rest surface for
  // the native convex hull/Solidify envelope rather than a joint-radius guess.
  // https://docs.blender.org/api/current/bmesh.ops.html#bmesh.ops.convex_hull
  authorArgs.push(fit.underlayers[fit.greaveEnvelope].source);
 }
 const log=execFileSync(blender,['--background','--factory-startup','--python-exit-code','1','--python','scripts/character-assets/author-duskguard-plates.py','--',...authorArgs],{encoding:'utf8'});
 await fs.writeFile(`${work}/blender.log`,log);
 const base=(await io.read(fit.source)).getRoot(),baseSkin=base.listSkins()[0],names=baseSkin.listJoints().map(n=>n.getName());
 const native=JSON.parse(await fs.readFile(`${work}/native-report.json`,'utf8'));
 const baseMesh=base.listNodes().find(n=>n.getMesh()?.getName()===fit.bodyMesh);
 for(const [id,item]of Object.entries(descriptor.items)){
  const plateDoc=await io.read(`${work}/${item.plate}.glb`),plateRoot=plateDoc.getRoot();
  normalizeHumanBind(plateRoot,base,item.plate,fit.bodyMesh);
  const plate=plateRoot.listMeshes()[0];
  if(plateRoot.listMeshes().length!==1||plateRoot.listAnimations().length)throw Error('Plate exporter produced unexpected content');
  let rigidVertices=0,rigidTriangles=0;
  const intended=new Set(native.pieces.filter(p=>p.itemMesh===item.plate).map(p=>`mixamorig:${p.bone}`)),seen=new Set();
  for(const primitive of plate.listPrimitives()){
   const weights=primitive.getAttribute('WEIGHTS_0').getArray(),joints=primitive.getAttribute('JOINTS_0').getArray();
   for(let i=0;i<weights.length;i+=4){if(weights[i]!==1||weights[i+1]!==0||weights[i+2]!==0||weights[i+3]!==0||!intended.has(names[joints[i]]))throw Error(`${race}/${id} has an invalid rigid bone`);seen.add(names[joints[i]]);}
   const material=primitive.getMaterial(),policy=descriptor.materials[material.getName()];
   if(!policy||[...material.getBaseColorFactor(),material.getMetallicFactor(),material.getRoughnessFactor()].some((v,i)=>Math.abs(v-[...policy.baseColor,policy.metallic,policy.roughness][i])>1e-6))throw Error('Plate material revision drift');
   primitive.setExtras({deformation:'rigid-bone'});
   rigidVertices+=primitive.getAttribute('POSITION').getCount();rigidTriangles+=primitive.getIndices().getCount()/3;
  }
  if(seen.size!==intended.size)throw Error('Missing intended plate articulation');
  const doc=await io.read(fit.underlayers[item.underlayer].source),root=doc.getRoot(),skin=root.listSkins()[0];
  if(JSON.stringify(skin.listJoints().map(n=>n.getName()))!==JSON.stringify(names)||root.listAnimations().length||
     Array.from(skin.getInverseBindMatrices().getArray()).some((v,i)=>v!==baseSkin.getInverseBindMatrices().getArray()[i]))throw Error(`${race}/${id}: underlayer palette changed`);
  for(const mesh of root.listMeshes()){
   if(!item.rename[mesh.getName()])throw Error(`${race}/${id}: unexpected underlayer ${mesh.getName()}`);
   mesh.setName(item.rename[mesh.getName()]);
   for(const primitive of mesh.listPrimitives())primitive.setExtras({deformation:'soft-skin'});
  }
  for(const node of root.listNodes())if(node.getMesh())node.setName(node.getMesh().getName());
  // Copy the mesh/material/accessor dependencies only. Its original named joints
  // have been remapped to the exact accepted indices and now borrow this skin.
  const mapped=copyToDocument(doc,plateDoc,[plate]);
  const node=doc.createNode(item.plate).setMesh(mapped.get(plate)).setSkin(skin).setMatrix(baseMesh.getWorldMatrix());
  root.listScenes()[0].addChild(node);
  if(id==='duskguardCuirass'){
   const gussetDoc=await io.read(`${work}/DuskguardGussets.glb`);
   normalizeHumanBind(gussetDoc.getRoot(),base,'DuskguardGussets',fit.bodyMesh);
   const mesh=gussetDoc.getRoot().listMeshes()[0];
   for(const primitive of mesh.listPrimitives()){
    const material=primitive.getMaterial(),policy=descriptor.materials[material.getName()];
    if(!policy||[...material.getBaseColorFactor(),material.getMetallicFactor(),material.getRoughnessFactor()].some((v,i)=>Math.abs(v-[...policy.baseColor,policy.metallic,policy.roughness][i])>1e-6))throw Error('Soft corrective material drift');
    primitive.setExtras({deformation:'soft-skin'});
   }
   const copied=copyToDocument(doc,gussetDoc,[mesh]);
   root.listScenes()[0].addChild(doc.createNode('DuskguardGussets').setMesh(copied.get(mesh)).setSkin(skin).setMatrix(baseMesh.getWorldMatrix()));
  }
  if(root.listSkins().length!==1)throw Error('Armor assembly duplicated the skin');
  await doc.transform(unpartition());
  const byName=new Map(baseSkin.listJoints().map(n=>[n.getName(),n]));
  for(const joint of skin.listJoints()){
   const original=byName.get(joint.getName());
   joint.setTranslation(original.getTranslation()).setRotation(original.getRotation()).setScale(original.getScale());
  }
  const bytes=await io.writeBinary(doc),file=`${work}/${id}.glb`;await fs.writeFile(file,bytes);
  const verification=verifyFactoryEquipmentBind((await io.read(file)).getRoot(),base,fit.bodyMesh);
  rows.push({race,id,artifact:file,sha256:sha(bytes),bytes:bytes.length,meshes:root.listMeshes().map(m=>m.getName()),rigidVertices,rigidTriangles,verification});
  console.log(JSON.stringify(rows.at(-1)));
 }
 rows.push({race,native:JSON.parse(await fs.readFile(`${work}/native-report.json`,'utf8')),compileSeconds:(performance.now()-start)/1000});
}
await fs.writeFile(`${directory}/report.json`,JSON.stringify({schema:1,candidateOnly:true,toolSources,tooling:{blender:descriptor.blenderVersion,node:process.versions.node},descriptor:{path:descriptorPath,sha256:sha(await fs.readFile(descriptorPath))},rights:descriptor.sourceRights,rows},null,2)+'\n');
