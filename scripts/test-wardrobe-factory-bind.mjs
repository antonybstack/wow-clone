/** Mutation controls against actual tracked source assets. Green metadata alone
 * must not accept a wrong rest palette, unit scale or bending rigid plate.
 */
import test from 'node:test';import assert from 'node:assert/strict';
import {NodeIO} from '@gltf-transform/core';import {ALL_EXTENSIONS} from '@gltf-transform/extensions';import {MeshoptDecoder} from 'meshoptimizer';
import {retainFullStartupGeometry} from './character-assets/startup-geometry-policy.mjs';
import {verifyFactoryEquipmentBind} from './character-assets/verify-factory-equipment-bind.mjs';
await MeshoptDecoder.ready;
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder});
async function inputs(){
 const base=(await io.read('public/ashen-reach/equipment/body.glb')).getRoot(),root=(await io.read('public/ashen-reach/equipment/wardenPauldrons.glb')).getRoot();
 for(const mesh of root.listMeshes())for(const p of mesh.listPrimitives())p.setExtras({deformation:'rigid-bone'});
 return {root,base};
}
test('independent factory gate accepts the written source-compatible plate',async()=>{
 const {root,base}=await inputs(),r=verifyFactoryEquipmentBind(root,base,'HumanV1Body');assert.equal(r.worstPaletteDelta,0);assert.equal(r.inverseBindExact,true);assert.equal(r.joints,65);assert(r.vertices>0);assert(r.bounds.max.every(Number.isFinite));
});
test('gate rejects a changed joint pose even with unchanged inverse binds',async()=>{
 const {root,base}=await inputs(),joint=root.listSkins()[0].listJoints()[0];const t=joint.getTranslation();joint.setTranslation([t[0]+.1,t[1],t[2]]);assert.throws(()=>verifyFactoryEquipmentBind(root,base,'HumanV1Body'),/rest palette/);
});
test('gate rejects a 100x geometry explosion independent of the skin palette',async()=>{
 const {root,base}=await inputs(),p=root.listMeshes()[0].listPrimitives()[0],a=p.getAttribute('POSITION');a.setArray(Float32Array.from(a.getArray(),v=>v*100));assert.throws(()=>verifyFactoryEquipmentBind(root,base,'HumanV1Body'),/body bounds/);
});
test('gate rejects normalized two-bone weights on a declared rigid plate',async()=>{
 const {root,base}=await inputs(),p=root.listMeshes()[0].listPrimitives()[0],a=p.getAttribute('WEIGHTS_0'),w=a.getArray().slice();w[0]=.9;w[1]=.1;a.setArray(w);assert.throws(()=>verifyFactoryEquipmentBind(root,base,'HumanV1Body'),/plate bends/);
});
test('gate rejects wrong inverse bind and absent explicit deformation',async()=>{
 let {root,base}=await inputs();const a=root.listSkins()[0].getInverseBindMatrices(),bind=a.getArray().slice();bind[12]+=.01;a.setArray(bind);assert.throws(()=>verifyFactoryEquipmentBind(root,base,'HumanV1Body'),/inverse bind/);
 ({root,base}=await inputs());root.listMeshes()[0].listPrimitives()[0].setExtras({});assert.throws(()=>verifyFactoryEquipmentBind(root,base,'HumanV1Body'),/deformation/);
});

test('mixed startup geometry preserves any actual rigid primitive without treating metal as rigidity',async()=>{
 const {root}=await inputs();assert.equal(retainFullStartupGeometry(root,{deformation:'mixed'}),true);
 for(const m of root.listMeshes())for(const p of m.listPrimitives())p.setExtras({deformation:'soft-skin'});
 assert.equal(retainFullStartupGeometry(root,{deformation:'mixed'}),false);
 assert.equal(retainFullStartupGeometry(root,{deformation:'rigid-bone'}),true);
});

import fs from 'node:fs/promises';
import {pinNativeWeightRows} from './character-assets/native-weight-stability.mjs';
test('native stability anchors retain reviewed rows and reject source/weight changes',async()=>{
 const policy=JSON.parse(await fs.readFile('blender/characters/wardrobe/weights/lector-orc-native-stability.json'));
 const root=(await io.read(policy.source.path)).getRoot(),p=root.listMeshes()[0].listPrimitives()[1];
 const raw=p.getAttribute('WEIGHTS_0').getArray(),stable=raw.slice(),rows=policy.rows;
 assert.equal(pinNativeWeightRows(p,raw,stable,rows,policy.maximumDelta),0);assert.deepEqual(stable,raw);
 const noisy=raw.slice();noisy[rows[0].vertex*4]+=.000001;
 assert(pinNativeWeightRows(p,noisy,stable,rows,policy.maximumDelta)<.000002);assert.deepEqual(stable,raw);
 const changed=raw.slice();changed[rows[0].vertex*4]+=.000003;
 assert.throws(()=>pinNativeWeightRows(p,changed,raw.slice(),rows,policy.maximumDelta),/exceeds/);
 assert.throws(()=>pinNativeWeightRows(p,raw,raw.slice(),[{...rows[0],position:[0,0,0]}],policy.maximumDelta),/correspondence/);
 assert.throws(()=>pinNativeWeightRows(p,raw,raw.slice(),[{...rows[0],joints:[0,0,0,0]}],policy.maximumDelta),/correspondence/);
});
