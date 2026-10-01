#!/usr/bin/env node
/** Deterministic, probe-only GLBs from the reviewed Human source pack.
 * The whole source pack already owns one glTF skin and animation graph. Keeping its
 * selected mesh nodes avoids a second hand-written bind/animation implementation.
 * https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#skins
 * https://gltf-transform.dev/modules/functions/functions/prune
 */
import fs from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {NodeIO,VertexLayout} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {mergeDocuments,prune,unpartition} from '@gltf-transform/functions';
import {MeshoptDecoder,MeshoptEncoder} from 'meshoptimizer';
import {mat3,mat4,quat,vec3} from 'gl-matrix';
import {EQUIPMENT_ITEMS,EQUIPMENT_PRESETS,resolveEquipmentVisibility} from '../../src/ashen-reach/equipment-catalog.js';
import {armingSwordGeometry} from '../../src/ashen-reach/arming-sword.js';
import {magePropGeometry} from '../../src/ashen-reach/mage-props.js';
import {appearanceFromEquipment} from '../../src/character/appearance/from-equipment.js';
import {encodeAppearance} from '../../src/character/appearance/codec.js';

const region=process.argv.includes('--region');
const shapeManifest=region?JSON.parse(await fs.readFile('public/ashen-reach/human-shape-v1/manifest.json','utf8')):null;
const source=region?`public${shapeManifest.items.body.url}`:'public/ashen-reach/equipment/body.glb';
const output=region?'.cache/character-mmo/region-crowd':'.cache/character-mmo/m003';
const retainedClips=region?['Idle_Loop','Walk_Loop','Sword_Attack','Spell_Simple_Enter']:['Idle_Loop','Walk_Loop'];
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
await Promise.all([MeshoptDecoder.ready,MeshoptEncoder.ready]);
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder,'meshopt.encoder':MeshoptEncoder}).setVertexLayout(VertexLayout.SEPARATE);
const sourceBytes=region?gunzipSync(await fs.readFile(source)):await fs.readFile(source);
const manifest={schema:1,region,retainedClips,source,sourceSha256:hash(sourceBytes),method:'Merge active split garments onto the active body skin after exact ordered bind validation; retain meshes from resolveEquipmentVisibility; retain selected source clips; prune unreachable resources.',license:'Probe derivative of existing project Human and CC0 garment sources; see docs/plans/character-mmo/results/m001.md',variants:{}};
function addRigidProp(doc,scene,skin,kind) {
  const handIndex=skin.listJoints().findIndex(node=>node.getName()==='mixamorig:RightHand');
  if(handIndex<0) throw Error('Missing RightHand for rigid prop');
  const item=EQUIPMENT_ITEMS[kind==='sword'?'ironSword':'graveweaverGreatstaff'];
  const local=mat4.fromRotationTranslation(mat4.create(),quat.fromValues(...item.gripRotation),vec3.fromValues(item.gripPosition[0],item.gripPosition[1]+.03,item.gripPosition[2]+.015));
  const handWorld=skin.listJoints()[handIndex].getWorldMatrix();
  // The Mixamo joint hierarchy carries a 0.01 source scale even though mesh
  // positions are already in metres. Remove that basis scale when authoring the
  // rigid mesh in mesh-local bind space; skinning still uses the original IBM.
  const handPose=mat4.clone(handWorld);
  for(let column=0;column<3;column++) {
    const off=column*4,length=Math.hypot(handPose[off],handPose[off+1],handPose[off+2]);
    for(let row=0;row<3;row++)handPose[off+row]/=length;
  }
  const bind=mat4.multiply(mat4.create(),handPose,local);
  if(region){
    // The live socket places the grip midway from wrist to the first middle
    // knuckle, with wrist rotation. Preserve its rest offset in this rigid
    // fitted source; per-pose palm tracking remains an explicit approximation.
    // src/character/sockets.js (PALM_BLEND and GRIP_LOCAL)
    const palm=skin.listJoints().find(n=>n.getName()==='mixamorig:RightHandMiddle1');
    if(!palm)throw Error('Missing source palm');
    const p=palm.getWorldMatrix();for(let k=0;k<3;k++)bind[12+k]+=(p[12+k]-handWorld[12+k])*.5;
  }
  const normalMatrix=mat3.normalFromMat4(mat3.create(),bind);
  const buffer=doc.getRoot().listBuffers()[0];
  const mesh=doc.createMesh(kind==='sword'?'ProbeIronSword':'ProbeGreatstaff');
  if(region){
    // Reuse the exact live authored batches, including material primitives;
    // do not maintain a second sword/staff geometry recipe for crowd assets.
    const parts=kind==='sword'?armingSwordGeometry():magePropGeometry('greatstaff');
    for(const {batch,material} of parts){
      const b=batch.buffers(),p=[],n=[];
      for(let i=0;i<b.positions.length;i+=3){p.push(...vec3.transformMat4(vec3.create(),b.positions.subarray(i,i+3),bind));n.push(...vec3.normalize(vec3.create(),vec3.transformMat3(vec3.create(),b.normals.subarray(i,i+3),normalMatrix)));}
      const vertices=p.length/3,joints=new Uint16Array(vertices*4),weights=new Float32Array(vertices*4);
      for(let i=0;i<vertices;i++){joints[i*4]=handIndex;weights[i*4]=1;}
      const accessor=(name,type,array)=>doc.createAccessor(name).setType(type).setArray(array).setBuffer(buffer);
      const mat=doc.createMaterial(batch.name).setBaseColorFactor(material.baseColorFactor).setMetallicFactor(material.metallicFactor||0).setRoughnessFactor(material.roughnessFactor).setDoubleSided(true);
      if(material.emissiveFactor)mat.setEmissiveFactor(material.emissiveFactor);
      mesh.addPrimitive(doc.createPrimitive().setMaterial(mat)
        .setAttribute('POSITION',accessor('prop-position','VEC3',new Float32Array(p)))
        .setAttribute('NORMAL',accessor('prop-normal','VEC3',new Float32Array(n)))
        .setAttribute('TEXCOORD_0',accessor('prop-uv','VEC2',b.uvs))
        .setAttribute('JOINTS_0',accessor('prop-joints','VEC4',joints))
        .setAttribute('WEIGHTS_0',accessor('prop-weights','VEC4',weights))
        .setIndices(accessor('prop-indices','SCALAR',b.indices)));
    }
    scene.addChild(doc.createNode(mesh.getName()).setMesh(mesh).setSkin(skin));return mesh.getName();
  }
  const materials={
    steel:doc.createMaterial('Probe steel').setBaseColorFactor([.53,.52,.49,1]).setMetallicFactor(.25).setRoughnessFactor(.65).setDoubleSided(true),
    leather:doc.createMaterial('Probe leather').setBaseColorFactor([.16,.09,.05,1]).setMetallicFactor(0).setRoughnessFactor(1).setDoubleSided(true),
  };
  const parts=kind==='sword'?
    [['steel',[0,.37,0],[.052,.64,.025]],['steel',[0,.09,0],[.23,.032,.045]],['leather',[0,-.06,0],[.035,.23,.034]],['steel',[0,-.18,0],[.065,.028,.06]]]:
    [['leather',[0,.1,0],[.04,1.95,.04]],['steel',[0,1.05,0],[.14,.20,.14]],['steel',[0,-.88,0],[.07,.08,.07]]];
  for(const material of ['steel','leather']) {
    const p=[],n=[],uv=[],indices=[];
    for(const [type,center,size] of parts) {
      if(type!==material) continue;
      const [cx,cy,cz]=center,[sx,sy,sz]=size;
      const faces=[[[0,0,-1],[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1]],[[0,0,1],[1,-1,1],[-1,-1,1],[-1,1,1],[1,1,1]],[[1,0,0],[1,-1,-1],[1,-1,1],[1,1,1],[1,1,-1]],[[-1,0,0],[-1,-1,1],[-1,-1,-1],[-1,1,-1],[-1,1,1]],[[0,1,0],[-1,1,-1],[1,1,-1],[1,1,1],[-1,1,1]],[[0,-1,0],[-1,-1,1],[1,-1,1],[1,-1,-1],[-1,-1,-1]]];
      for(const [faceNormal,...corners] of faces) {
        const base=p.length/3;
        for(let k=0;k<4;k++) {
          const c=corners[k],point=vec3.transformMat4(vec3.create(),[cx+c[0]*sx/2,cy+c[1]*sy/2,cz+c[2]*sz/2],bind);
          const normal=vec3.normalize(vec3.create(),vec3.transformMat3(vec3.create(),faceNormal,normalMatrix));
          p.push(...point);n.push(...normal);uv.push(k===1||k===2?1:0,k>=2?1:0);
        }
        indices.push(base,base+1,base+2,base,base+2,base+3);
      }
    }
    if(!p.length)continue;
    const vertices=p.length/3;
    const joints=new Uint16Array(vertices*4),weights=new Float32Array(vertices*4);
    for(let i=0;i<vertices;i++){joints[i*4]=handIndex;weights[i*4]=1;}
    const accessor=(name,type,array)=>doc.createAccessor(name).setType(type).setArray(array).setBuffer(buffer);
    mesh.addPrimitive(doc.createPrimitive().setMaterial(materials[material])
      .setAttribute('POSITION',accessor('prop-position','VEC3',new Float32Array(p)))
      .setAttribute('NORMAL',accessor('prop-normal','VEC3',new Float32Array(n)))
      .setAttribute('TEXCOORD_0',accessor('prop-uv','VEC2',new Float32Array(uv)))
      .setAttribute('JOINTS_0',accessor('prop-joints','VEC4',joints))
      .setAttribute('WEIGHTS_0',accessor('prop-weights','VEC4',weights))
      .setIndices(accessor('prop-indices','SCALAR',new Uint16Array(indices))));
  }
  scene.addChild(doc.createNode(mesh.getName()).setMesh(mesh).setSkin(skin));
  return mesh.getName();
}
await fs.mkdir(output,{recursive:true});
for(const presetId of ['wayfarer','warden']) {
  const recipe=appearanceFromEquipment({race:'human',loadout:EQUIPMENT_PRESETS[presetId].loadout});
  const visibility=resolveEquipmentVisibility(recipe.equipment);
  const wanted=new Set(Object.entries(visibility).filter(([,show])=>show).map(([name])=>name));
  // The active Human source is a single body mesh, unlike the older partitioned
  // prewarmed pack; main.js also explicitly selects HumanV1Body for this source.
  wanted.add('HumanV1Body');
  const doc=await io.readBinary(sourceBytes);
  const root=doc.getRoot(),scene=root.getDefaultScene(),skin=root.listSkins()[0],kept=[],assetSha256={};
  const originalNodes=new Set(root.listNodes()),originalScenes=new Set(root.listScenes());
  const targetJoints=skin.listJoints().map(node=>node.getName());
  const targetIbm=skin.getInverseBindMatrices().getArray();
  for(const id of Object.values(recipe.equipment).filter(Boolean)) {
    const item=EQUIPMENT_ITEMS[id];
    if(!item.parts) continue; // Rigid props have a separate socket path.
    const assetPath=region?`public${shapeManifest.items[id].url}`:`public/ashen-reach/equipment/${id}.glb`;
    const bytes=region?gunzipSync(await fs.readFile(assetPath)):await fs.readFile(assetPath);
    assetSha256[id]=hash(bytes);
    const garment=await io.readBinary(bytes),groot=garment.getRoot();
    const sourceSkin=groot.listSkins()[0],joints=sourceSkin.listJoints().map(node=>node.getName());
    const ibm=sourceSkin.getInverseBindMatrices().getArray();
    if(joints.length!==targetJoints.length || joints.some((name,i)=>name!==targetJoints[i]) || ibm.length!==targetIbm.length || ibm.some((v,i)=>Math.abs(v-targetIbm[i])>1e-5)) throw Error(`${id}: ordered skin/bind mismatch`);
    const mapped=mergeDocuments(doc,garment);
    for(const sourceNode of groot.listNodes()) if(sourceNode.getMesh()) {
      const node=mapped.get(sourceNode);
      if(!wanted.has(node.getName())) continue;
      const world=sourceNode.getWorldMatrix();
      if(world.some((v,i)=>Math.abs(v-(i%5===0?1:0))>1e-5)) throw Error(`${id}/${node.getName()}: non-identity mesh frame`);
      node.getParentNode()?.removeChild(node);
      node.setMatrix(world).setSkin(skin);
      scene.addChild(node);
      originalNodes.add(node);
      kept.push(node.getName());
    }
  }
  for(const node of root.listNodes()) if(!originalNodes.has(node)) node.dispose();
  for(const extraScene of root.listScenes()) if(!originalScenes.has(extraScene)) extraScene.dispose();
  for(const extraSkin of root.listSkins()) if(extraSkin!==skin) extraSkin.dispose();
  for(const node of root.listNodes()) if(node.getMesh()) {
    if(wanted.has(node.getName())) kept.push(node.getName());
    else node.setMesh(null);
  }
  if(recipe.equipment.mainHand) kept.push(addRigidProp(doc,scene,skin,presetId==='wayfarer'?'sword':'greatstaff'));
  // Explicitly dispose channels/samplers with unused clips; see the retained
  // glTF Transform cleanup pattern in scripts/ashen-reach/split-equipment.mjs.
  for(const animation of root.listAnimations()) if(!retainedClips.includes(animation.getName())) {
    for(const channel of animation.listChannels()) channel.dispose();
    for(const sampler of animation.listSamplers()) sampler.dispose();
    animation.dispose();
  }
  if(!kept.includes('HumanV1Body') || !kept.some(name=>name.includes('Tunic')||name.includes('Top'))) throw Error(`${presetId}: incomplete dressed source: ${kept.join(', ')}`);
  await doc.transform(unpartition(),prune({keepLeaves:true}));
  const primitives=root.listMeshes().flatMap(mesh=>mesh.listPrimitives());
  const triangles=primitives.reduce((n,p)=>n+(p.getIndices()?.getCount()||p.getAttribute('POSITION')?.getCount()||0)/3,0);
  const vertices=primitives.reduce((n,p)=>n+(p.getAttribute('POSITION')?.getCount()||0),0);
  const bytes=Buffer.from(await io.writeBinary(doc));
  const file=`human-${presetId}.glb`;
  await fs.writeFile(`${output}/${file}`,bytes);
  manifest.variants[presetId]={file,sha256:hash(bytes),bytes:bytes.length,triangles,vertices,primitives:primitives.length,recipe:encodeAppearance(recipe),assetSha256,meshes:[...new Set(kept)].sort(),clips:root.listAnimations().map(a=>a.getName()).sort()};
}
await fs.writeFile(`${output}/manifest.json`,JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({output,sourceSha256:manifest.sourceSha256,variants:Object.fromEntries(Object.entries(manifest.variants).map(([id,v])=>[id,{bytes:v.bytes,sha256:v.sha256,meshes:v.meshes.length,clips:v.clips.length}]))},null,2));
