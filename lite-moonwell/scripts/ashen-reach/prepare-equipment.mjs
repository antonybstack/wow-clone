/** Prewarmed small catalogue: original source skin and animation, separate item/coverage meshes. */
import fs from 'node:fs/promises';import {createHash} from 'node:crypto';
import {NodeIO} from '@gltf-transform/core';import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {mergeDocuments,prune,unpartition} from '@gltf-transform/functions';
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc=await io.read('public/ashen-reach/wanderer.glb'),rest=await io.read('.cache/armory-assets/apparel-rest.glb');
const root=doc.getRoot(),scene=root.getDefaultScene(),skin=root.listSkins()[0],joints=skin.listJoints();
const originalNodes=new Set(root.listNodes()),originalScenes=new Set(root.listScenes()),merged=mergeDocuments(doc,rest),info=[];
for(const source of rest.getRoot().listNodes()){
 if(!source.getMesh())continue;
 const node=merged.get(source),oldSkin=node.getSkin();if(!oldSkin)throw Error('Unskinned garment '+source.getName());
 const mapping=oldSkin.listJoints().map(n=>joints.findIndex(j=>j.getName()===n.getName()));
 for(const primitive of node.getMesh().listPrimitives()){
  const weights=primitive.getAttribute('WEIGHTS_0').getArray(),indices=primitive.getAttribute('JOINTS_0');
  indices.setArray(Uint16Array.from(indices.getArray(),(joint,i)=>{if(mapping[joint]<0&&weights[i]>0)throw Error('Unmapped weighted joint');return Math.max(0,mapping[joint]);}));
  const material=primitive.getMaterial();material.setDoubleSided(true);if(source.getName()!=='GraveweaverPendant')material.setRoughnessFactor(.94).setMetallicFactor(0);
  if(source.getName()==='GraveweaverTop'){material.setBaseColorFactor([.78,.86,.83,1]).setMetallicFactor(.16).setRoughnessFactor(.83);}
  if(['GraveweaverSkirt','GraveweaverHood'].includes(source.getName()))material.setBaseColorFactor([.62,.80,.87,1]);
  if(source.getName()==='GraveweaverGloves')material.setBaseColorFactor([.20,.22,.20,1]);
  material.getBaseColorTextureInfo()?.setMagFilter(9728).setMinFilter(9984);
 }
 const transform=source.getWorldMatrix();node.getParentNode()?.removeChild(node);node.setMatrix(transform).setSkin(skin);scene.addChild(node);originalNodes.add(node);
 const position=node.getMesh().listPrimitives()[0].getAttribute('POSITION');info.push({name:node.getName(),vertices:position.getCount(),min:position.getMin([]),max:position.getMax([])});
}
for(const node of root.listNodes())if(!originalNodes.has(node))node.dispose();
for(const s of root.listScenes())if(!originalScenes.has(s))s.dispose();
for(const s of root.listSkins())if(s!==skin)s.dispose();
// Keep full trousers when barefoot; hide only the tucked lower panels under boots.
const trousers=root.listNodes().find(n=>n.getName()==='WayfarerTrousers'&&n.getMesh());
const pantsMesh=trousers.getMesh(),pantsParts=new Map(['WayfarerTrousers','WayfarerTrousersCuffs'].map(name=>[name,doc.createMesh(name)]));
for(const primitive of pantsMesh.listPrimitives()){
 const positions=primitive.getAttribute('POSITION').getArray(),indices=primitive.getIndices().getArray(),groups=new Map([...pantsParts.keys()].map(name=>[name,[]]));
 for(let i=0;i<indices.length;i+=3){const vs=Array.from(indices.slice(i,i+3)),y=vs.reduce((sum,index)=>sum+positions[index*3+1],0)/3;groups.get(y<.31?'WayfarerTrousersCuffs':'WayfarerTrousers').push(...vs);}
 for(const [name,ids]of groups){if(!ids.length)continue;const part=doc.createPrimitive().setMaterial(primitive.getMaterial());for(const semantic of primitive.listSemantics())part.setAttribute(semantic,primitive.getAttribute(semantic));part.setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint32Array(ids)).setBuffer(root.listBuffers()[0]));pantsParts.get(name).addPrimitive(part);}
}
const pantsMatrix=trousers.getWorldMatrix();trousers.setMesh(null);
for(const [name,part]of pantsParts)scene.addChild(doc.createNode(name).setMesh(part).setSkin(skin).setMatrix(pantsMatrix));pantsMesh.dispose();
// These coverage boundaries are specific to this body/garment fit, not a universal race mask.
const body=root.listNodes().find(n=>n.getMesh()?.getName()==='HumanBody'),mesh=body.getMesh(),buffer=root.listBuffers()[0];
const parts=new Map(['BodyExposed','BodyUnderTunic','BodyUnderBoots','BodyUnderLegs','BodyWaist','BodyHands'].map(name=>[name,doc.createMesh(name)])),counts={};
for(const primitive of mesh.listPrimitives()){
 const positions=primitive.getAttribute('POSITION').getArray(),indices=primitive.getIndices().getArray(),groups=new Map([...parts.keys()].map(name=>[name,[]])),weights=primitive.getAttribute('WEIGHTS_0').getArray(),boneIds=primitive.getAttribute('JOINTS_0').getArray();
 for(let i=0;i<indices.length;i+=3){
  const vs=Array.from(indices.slice(i,i+3)),p=[0,1,2].map(k=>vs.reduce((sum,index)=>sum+positions[index*3+k],0)/3),[x,y]=p;
  const handWeight=vs.reduce((sum,index)=>sum+[0,1,2,3].reduce((w,k)=>w+(/Hand/.test(joints[boneIds[index*4+k]].getName())?weights[index*4+k]:0),0),0)/3;
  const region=handWeight>.75?'BodyHands':y<.28?'BodyUnderBoots':y<.86?'BodyUnderLegs':y<1.00?'BodyWaist':y<1.46&&Math.abs(x)<.57?'BodyUnderTunic':'BodyExposed';groups.get(region).push(...vs);
 }
 for(const [name,idx]of groups){if(!idx.length)continue;const part=doc.createPrimitive().setMaterial(primitive.getMaterial());for(const semantic of primitive.listSemantics())part.setAttribute(semantic,primitive.getAttribute(semantic));part.setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint32Array(idx)).setBuffer(buffer));parts.get(name).addPrimitive(part);counts[name]=(counts[name]||0)+idx.length/3;}
}
for(const [name,part]of parts)scene.addChild(doc.createNode(name).setMesh(part).setSkin(skin).setMatrix(body.getWorldMatrix()));
body.setMesh(null);mesh.dispose();await doc.transform(unpartition(),prune());
await io.write('public/ashen-reach/wanderer-equipment.glb',doc);
const sha=async path=>createHash('sha256').update(await fs.readFile(path)).digest('hex');
const report={schemaVersion:1,bodyProfile:'human-source-v1',rigJoints:joints.length,clips:root.listAnimations().length,items:info,coverageTriangles:counts,sourceSha256:await sha('public/ashen-reach/wanderer.glb'),outputSha256:await sha('public/ashen-reach/wanderer-equipment.glb'),source:'Rehman Polanski Viking garments; Donitz Monk robe/hood; Margaret Toigo short gloves. CC0 MakeHuman suits02 and gloves01 packs',license:'CC0-1.0 (garments only; actor/rig retain existing licenses)',sourcePage:'https://static.makehumancommunity.org/assets/assetpacks/suits02.html',archiveSha256:'437f4d7ab92b698c1fb1047e7d62b22c11f195b2473e936118661dc8e6b7eb7a',additionalSources:[{sourcePage:'https://static.makehumancommunity.org/assets/assetpacks/gloves01.html',archiveSha256:'ecdaee1d02749d17352791d415cb622a883350cc8a4b90eda3725aef35d9afb2',author:'Margaret Toigo',asset:'short gloves',license:'CC0-1.0'},{author:'Project-original',asset:'Graveweaver pendant, runtime staff and grimoire',method:'Authored low-poly geometry; OSRS Ahrim silhouette reference only, no copied game assets.'}],method:'MakeClothes fitting/weight interpolation; existing Human rest/repose; original source skin and clips; bounded prewarmed catalogue.'};
await fs.writeFile('public/ashen-reach/equipment-provenance.json',JSON.stringify(report,null,2));console.log(report);
