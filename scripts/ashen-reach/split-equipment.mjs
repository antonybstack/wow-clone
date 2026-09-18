/** Derive streamed assets from the reviewed pack; never rebind or re-export motion. */
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {prune} from '@gltf-transform/functions';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {EQUIPMENT_ITEMS,BASE_VISIBLE_MESHES} from '../../src/ashen-reach/equipment-catalog.js';
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS);
const source='public/ashen-reach/wanderer-equipment.glb';
const bytes=await fs.readFile(source), sha=b=>createHash('sha256').update(b).digest('hex');
const dir='public/ashen-reach/equipment';await fs.mkdir(dir,{recursive:true});
const manifest={schema:1,sourceSha256:sha(bytes),items:{}};
for(const [id,names]of [['body',BASE_VISIBLE_MESHES],...Object.entries(EQUIPMENT_ITEMS).filter(([,item])=>item.parts).map(([id,item])=>[id,item.parts.map(p=>p.mesh)])]){
 const doc=await io.readBinary(bytes),root=doc.getRoot();
 const skin=root.listSkins()[0];
 const binding={joints:skin.listJoints().map(n=>[n.getName(),n.getWorldMatrix()]),inverseBind:Array.from(skin.getInverseBindMatrices().getArray())};
 manifest.bindSha256??=sha(JSON.stringify(binding));
 for(const n of root.listNodes())if(n.getMesh()){
   if(!names.includes(n.getName()))n.setMesh(null);
   else if(n.getWorldMatrix().some((v,i)=>Math.abs(v-(i%5===0?1:0))>1e-6))throw Error('Non-identity mesh bind: '+n.getName());
 }
 if(id!=='body')for(const a of root.listAnimations())a.dispose();
 await doc.transform(prune({keepLeaves:true}));
 const output=await io.writeBinary(doc);await fs.writeFile(`${dir}/${id}.glb`,output);
 manifest.items[id]={url:`/ashen-reach/equipment/${id}.glb`,bytes:output.byteLength,sha256:sha(output),meshes:names,fit:EQUIPMENT_ITEMS[id]?.fit};
}
await fs.writeFile(`${dir}/manifest.json`,JSON.stringify(manifest,null,2)+'\n');
console.log('Wrote body and',Object.keys(manifest.items).length-1,'individual garment assets');
