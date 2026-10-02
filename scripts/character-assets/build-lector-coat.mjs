/** Audition native structural tailoring on each exact accepted body/garment bind.
 * Frozen source hashes prevent cumulative tailoring; candidate output is isolated.
 * https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#skins
 * https://gltf-transform.dev/modules/core/classes/NodeIO
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {NodeIO,VertexLayout} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {MeshoptDecoder} from 'meshoptimizer';
import {normalizeHumanBind} from './normalize-human-bind.mjs';
import {pinNativeWeightRows} from './native-weight-stability.mjs';
import {verifyFactoryEquipmentBind} from './verify-factory-equipment-bind.mjs';
const descriptorPath='blender/characters/wardrobe/lector-coat.json';
const descriptor=JSON.parse(await fs.readFile(descriptorPath,'utf8'));
if(descriptor.schema!==1||descriptor.id!=='lectorCoat'||descriptor.blenderVersion!=='5.2.1')throw Error('Unsupported Lector descriptor');
const sha=b=>createHash('sha256').update(b).digest('hex');
const directory='.cache/character-mmo/wardrobe-v1/lector';
const blender=process.env.ASHEN_BLENDER||'/Applications/Blender.app/Contents/MacOS/Blender';
if(!execFileSync(blender,['--version'],{encoding:'utf8'}).startsWith('Blender 5.2.1 '))throw Error('Pinned Blender required');
await MeshoptDecoder.ready;
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder}).setVertexLayout(VertexLayout.SEPARATE);
const selected=process.argv.slice(2);if(selected.some(r=>!descriptor.fits[r]))throw Error('Unknown race');
const toolSources=await Promise.all(["scripts/character-assets/build-lector-coat.mjs", "scripts/character-assets/author-lector-coat.py", "scripts/character-assets/normalize-human-bind.mjs", "scripts/character-assets/verify-factory-equipment-bind.mjs","scripts/character-assets/native_cloth_panels.py","scripts/character-assets/native-weight-stability.mjs"].map(async path=>({path,sha256:sha(await fs.readFile(path))})));
const rows=[];
const stabilityBytes=descriptor.nativeWeightStability?await fs.readFile(descriptor.nativeWeightStability.path):null;
if(stabilityBytes&&sha(stabilityBytes)!==descriptor.nativeWeightStability.sha256)throw Error('Native skin stability provenance mismatch');
const stability=stabilityBytes?JSON.parse(stabilityBytes):null;
if(stability&&(stability.schema!==1||stability.item!==descriptor.id||stability.maximumDelta!==.000002))throw Error('Unsupported native stability anchor');
for(const [race,fit]of Object.entries(descriptor.fits)){
 if(selected.length&&!selected.includes(race))continue;
 const work=path.join(directory,race);await fs.mkdir(work,{recursive:true});
 for(const [file,digest]of [[fit.source,fit.sha256],[fit.garment,fit.garmentSha256],[fit.trousers.source,fit.trousers.sha256]])if(sha(await fs.readFile(file))!==digest)throw Error(`Source hash changed: ${file}`);
 const start=performance.now();
 const result=execFileSync(blender,['--background','--factory-startup','--python-exit-code','1','--python','scripts/character-assets/author-lector-coat.py','--',fit.garment,`${work}/raw.glb`,`${work}/native-report.json`,fit.source],{encoding:'utf8'});
 await fs.writeFile(`${work}/blender.log`,result);
 if(result.includes('more than 4 joint vertex influences'))throw Error('Native skin loss was not explicitly measured');
 const doc=await io.read(`${work}/raw.glb`),base=(await io.read(fit.source)).getRoot(),root=doc.getRoot();
 normalizeHumanBind(root,base,'LectorCoat',fit.bodyMesh);
 const skin=root.listSkins()[0],baseSkin=base.listSkins()[0];
 skin.getInverseBindMatrices().setArray(baseSkin.getInverseBindMatrices().getArray().slice());
 const joints=new Map(baseSkin.listJoints().map(n=>[n.getName(),n]));
 for(const node of root.listNodes())if(!node.getMesh()){
  const original=joints.get(node.getName())||base.listNodes().find(n=>!n.getMesh()&&n.getName()===node.getName());
  if(original)node.setTranslation(original.getTranslation()).setRotation(original.getRotation()).setScale(original.getScale());
 }
 const meshNode=root.listNodes().find(n=>n.getMesh());
 meshNode.setMatrix(base.listNodes().find(n=>n.getMesh()?.getName()===fit.bodyMesh).getWorldMatrix());
 // Blender's linked texture does not retain diffuse_color as a glTF multiplier.
 // Set the declared PBR factor in the native interchange document explicitly.
 // https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#material-pbrmetallicroughness
 for(const material of root.listMaterials()){
  const textured=!!material.getBaseColorTexture();
  const policy=textured?descriptor.design.material:[descriptor.design.foldMaterial,descriptor.design.gussetMaterial].find(p=>p.name===material.getName());
  if(!policy)throw Error(`Unpinned Lector material: ${material.getName()}`);
  if(textured)material.setBaseColorFactor(policy.baseColor).setMetallicFactor(policy.metallic).setRoughnessFactor(policy.roughness);
  const actual=[...material.getBaseColorFactor(),material.getMetallicFactor(),material.getRoughnessFactor()],expected=[...policy.baseColor,policy.metallic,policy.roughness];
  if(actual.some((v,i)=>Math.abs(v-expected[i])>1e-6))throw Error('Lector material revision drift');
 }
 if(root.listMeshes().length!==1||root.listAnimations().length)throw Error('Lector must contain one garment mesh without clips');
 let vertices=0,triangles=0,maxWeightQuantizationDelta=0,stabilityApplied=0;
 for(const [ordinal,primitive]of root.listMeshes()[0].listPrimitives().entries()){
  primitive.setExtras({deformation:'soft-skin'});
  if(primitive.listTargets().length)throw Error('Neutral source contains morph targets');
  const weights=primitive.getAttribute('WEIGHTS_0').getArray(),indices=primitive.getAttribute('JOINTS_0').getArray();
  for(let i=0;i<weights.length;i+=4){let sum=0;for(let k=0;k<4;k++){if(!Number.isFinite(weights[i+k])||weights[i+k]<0||indices[i+k]>=65)throw Error('Invalid garment weight');sum+=weights[i+k];}if(Math.abs(sum-1)>2e-6)throw Error('Unnormalized garment skin');}
  vertices+=primitive.getAttribute('POSITION').getCount();triangles+=primitive.getIndices().getCount()/3;
  // Blender emits identical triangles in a different order after native BMesh
  // extrusion, and Data Transfer can differ below 1e-9. Canonicalize only this
  // new candidate: cyclic rotations preserve winding; 1e-6 weight quantization
  // retains four influences with an exact integer total. No vertex is reindexed.
  // https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#skinned-mesh-attributes
  const indexAccessor=primitive.getIndices(),sourceIndices=indexAccessor.getArray(),ordered=[];
  for(let i=0;i<sourceIndices.length;i+=3){const t=Array.from(sourceIndices.subarray(i,i+3)),n=t.indexOf(Math.min(...t));ordered.push(t.slice(n).concat(t.slice(0,n)));}
  ordered.sort((a,b)=>a[0]-b[0]||a[1]-b[1]||a[2]-b[2]);
  indexAccessor.setArray(new sourceIndices.constructor(ordered.flat()));
  const stableWeights=weights.slice(),precision=1e6;
  for(let i=0;i<weights.length;i+=4){const row=Array.from(weights.subarray(i,i+4),w=>Math.round(w*precision));const dominant=row.indexOf(Math.max(...row));row[dominant]+=precision-row.reduce((a,b)=>a+b,0);for(let k=0;k<4;k++){stableWeights[i+k]=row[k]/precision;maxWeightQuantizationDelta=Math.max(maxWeightQuantizationDelta,Math.abs(stableWeights[i+k]-weights[i+k]));}}
  const anchored=stability?.race===race?stability.rows.filter(r=>r.primitive===ordinal):[];
  maxWeightQuantizationDelta=Math.max(maxWeightQuantizationDelta,
   pinNativeWeightRows(primitive,weights,stableWeights,anchored,.000002));
  stabilityApplied+=anchored.length;
  primitive.getAttribute('WEIGHTS_0').setArray(stableWeights);
 }
 if(stability?.race===race&&stabilityApplied!==stability.rows.length)throw Error('Unused native skin stability row');
 const bytes=await io.writeBinary(doc),file=`${work}/lectorCoat.glb`;await fs.writeFile(file,bytes);
 const verification=verifyFactoryEquipmentBind((await io.read(file)).getRoot(),base,fit.bodyMesh);
 rows.push({race,id:descriptor.id,artifact:file,sha256:sha(bytes),bytes:bytes.length,vertices,triangles,verification,weightQuantization:{precision:1e6,maxAppliedDelta:maxWeightQuantizationDelta},nativeStabilityRows:stabilityApplied,compileSeconds:(performance.now()-start)/1000,native:JSON.parse(await fs.readFile(`${work}/native-report.json`,'utf8'))});
 console.log(JSON.stringify(rows.at(-1)));
}
await fs.writeFile(`${directory}/report.json`,JSON.stringify({schema:1,candidateOnly:true,toolSources,tooling:{blender:descriptor.blenderVersion,node:process.versions.node},descriptor:{path:descriptorPath,sha256:sha(await fs.readFile(descriptorPath))},rights:descriptor.sourceRights,rows},null,2)+'\n');
