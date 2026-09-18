import {BODY_REGIONS,EQUIPMENT_ITEMS,EQUIPMENT_PRESETS,validateLoadout,resolveEquipmentVisibility} from '../src/ashen-reach/equipment-catalog.js';
import {test} from 'node:test';import assert from 'node:assert/strict';import {NodeIO} from '@gltf-transform/core';import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS),source=await io.read('public/ashen-reach/wanderer.glb'),equipped=await io.read('public/ashen-reach/wanderer-equipment.glb');
const animations=doc=>doc.getRoot().listAnimations().map(a=>({name:a.getName(),channels:a.listChannels().map(c=>({target:c.getTargetNode().getName(),path:c.getTargetPath(),interpolation:c.getSampler().getInterpolation(),times:Array.from(c.getSampler().getInput().getArray()),values:Array.from(c.getSampler().getOutput().getArray())}))}));
test('Equipment pack preserves all 55 authored clips exactly',()=>{assert.equal(source.getRoot().listAnimations().length,55);assert.deepEqual(animations(equipped),animations(source));});
test('Equipment uses the original ordered source bind and rest hierarchy',()=>{
 const before=source.getRoot().listSkins()[0],after=equipped.getRoot().listSkins()[0];assert.equal(equipped.getRoot().listSkins().length,1);assert.equal(after.listJoints().length,65);
 assert.deepEqual(Array.from(after.getInverseBindMatrices().getArray()),Array.from(before.getInverseBindMatrices().getArray()));
 assert.deepEqual(after.listJoints().map(n=>[n.getName(),n.getWorldMatrix()]),before.listJoints().map(n=>[n.getName(),n.getWorldMatrix()]));
});
test('Every catalog garment has separate geometry with valid normalized source weights',()=>{
 for(const name of Object.values(EQUIPMENT_ITEMS).flatMap(item=>(item.parts||[]).map(p=>p.mesh))){
  const node=equipped.getRoot().listNodes().find(n=>n.getName()===name&&n.getMesh());assert.ok(node);assert.equal(node.getSkin(),equipped.getRoot().listSkins()[0]);
  for(const p of node.getMesh().listPrimitives()){
   assert.ok(p.getAttribute('POSITION').getCount()>0);const w=p.getAttribute('WEIGHTS_0').getArray(),j=p.getAttribute('JOINTS_0').getArray();
   for(let i=0;i<w.length;i+=4){assert.ok(Math.abs(w[i]+w[i+1]+w[i+2]+w[i+3]-1)<1e-5);for(let k=0;k<4;k++){assert.ok(w[i+k]>=0&&Number.isFinite(w[i+k]));assert.ok(j[i+k]>=0&&j[i+k]<65);}}
  }
 }
});
test('Body coverage partitions preserve every original material triangle exactly once',()=>{
 const signature=(p,indices)=>{const pos=p.getAttribute('POSITION').getArray();return p.getMaterial().getName()+':'+indices.flatMap(i=>Array.from(pos.slice(i*3,i*3+3))).join(',');};
 const triangles=meshes=>meshes.flatMap(m=>m.listPrimitives().flatMap(p=>{const ids=p.getIndices().getArray(),out=[];for(let i=0;i<ids.length;i+=3)out.push(signature(p,Array.from(ids.slice(i,i+3))));return out;})).sort();
 const original=source.getRoot().listMeshes().filter(m=>m.getName()==='HumanBody'),parts=equipped.getRoot().listMeshes().filter(m=>BODY_REGIONS.includes(m.getName()));
 assert.equal(parts.length,BODY_REGIONS.length);assert.deepEqual(triangles(parts),triangles(original));
});

test('Shared waist coverage survives either garment being removed',()=>{
 for(const torso of ['wayfarerTunic','pilgrimTunic']){
  const full={torso,legs:'wayfarerTrousers',boots:'wayfarerBoots',mainHand:null};
  assert.equal(resolveEquipmentVisibility(full).BodyWaist,false);
  assert.equal(resolveEquipmentVisibility({...full,torso:null}).BodyWaist,false);
  assert.equal(resolveEquipmentVisibility({...full,legs:null}).BodyWaist,false);
  assert.equal(resolveEquipmentVisibility({...full,torso:null,legs:null}).BodyWaist,true);
 }
});
test('Boots tuck only trouser cuffs; barefoot restores cuffs and underlying feet',()=>{
 const loadout={torso:'pilgrimTunic',legs:'wayfarerTrousers',boots:'wayfarerBoots',mainHand:null};
 const boots=resolveEquipmentVisibility(loadout),bare=resolveEquipmentVisibility({...loadout,boots:null});
 assert.equal(boots.WayfarerTrousers,true);assert.equal(boots.WayfarerTrousersCuffs,false);assert.equal(boots.BodyUnderBoots,false);
 assert.equal(bare.WayfarerTrousers,true);assert.equal(bare.WayfarerTrousersCuffs,true);assert.equal(bare.BodyUnderBoots,true);
});
test('Torso alternatives are exclusive and invalid combinations fail',()=>{
 const s=resolveEquipmentVisibility({torso:'pilgrimTunic',legs:null,boots:null,mainHand:null});
 assert.equal(s.PilgrimTunic,true);assert.equal(s.WayfarerTunic,false);assert.equal(s.BodyUnderTunic,false);
 assert.throws(()=>resolveEquipmentVisibility({torso:'wayfarerTrousers'}),/slot/);
});

test('Hood and gloves independently hide hair and underlying hands',()=>{
 const mage=EQUIPMENT_PRESETS.graveweaver.loadout;validateLoadout(mage);
 const dressed=resolveEquipmentVisibility(mage),bare=resolveEquipmentVisibility({...mage,helmet:null,gloves:null});
 assert.equal(dressed.HumanHair,false);assert.equal(dressed.BodyHands,false);
 assert.equal(bare.HumanHair,true);assert.equal(bare.BodyHands,true);
 assert.equal(bare.GraveweaverTop,true);assert.equal(bare.GraveweaverSkirt,true);
});
test('Every preset is complete and valid; staff supports the independent book slot',()=>{
 for(const preset of Object.values(EQUIPMENT_PRESETS)){validateLoadout(preset.loadout);assert.equal(Object.keys(preset.loadout).length,7);}
 const mage=EQUIPMENT_PRESETS.graveweaver.loadout;assert.equal(mage.mainHand,'graveweaverStaff');assert.equal(mage.offHand,'graveweaverBook');
 assert.throws(()=>validateLoadout({...mage,boots:'graveweaverHood'}),/slot/);
 assert.throws(()=>validateLoadout({...mage,unknown:null}),/slot/);
});
