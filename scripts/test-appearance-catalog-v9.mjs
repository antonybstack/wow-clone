/** Real saved recipes, historical domain sealing and authored transfer identity. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {APPEARANCE_REGISTRY,APPEARANCE_V8_REGISTRY,APPEARANCE_V9_REGISTRY,migrateAppearance,validateAppearance} from '../src/character/appearance/contract.js';
import {appearanceFromEquipment} from '../src/character/appearance/from-equipment.js';
import {encodeAppearance,decodeAppearance,decodeMigratingAppearance} from '../src/character/appearance/codec.js';
import {EQUIPMENT_ITEMS,EQUIPMENT_SLOTS,BASE_VISIBLE_MESHES,gripHold} from '../src/ashen-reach/equipment-catalog.js';
import {selectedEquipmentResources} from '../src/ashen-reach/equipment-resources.js';
import {validateEquipmentCatalogue,resolveHandEquip} from '../src/ashen-reach/equipment-contract.js';
import {verifyPublishedAuthoredProps} from './character-assets/publish-authored-prop.mjs';

test('v8 keeps the exact released vocabulary and refuses a future shield',()=>{
 assert.equal(createHash('sha256').update(JSON.stringify(APPEARANCE_V8_REGISTRY)).digest('hex'),'3794c321247f812ba99caa03626849f3d4c96bcbf07df8d35a3cfd65b480a379');
 assert.equal(APPEARANCE_REGISTRY,APPEARANCE_V9_REGISTRY);
 assert.equal(APPEARANCE_REGISTRY.profiles,APPEARANCE_V8_REGISTRY.profiles);
 assert.deepEqual(Object.keys(APPEARANCE_REGISTRY.items),[...Object.keys(APPEARANCE_V8_REGISTRY.items),'bastionShield']);
 const old=appearanceFromEquipment({race:'human',loadout:{}},APPEARANCE_V8_REGISTRY);
 assert.throws(()=>decodeMigratingAppearance(JSON.stringify({...old,equipment:{...old.equipment,offHand:'bastionShield'}})),{code:'UNSUPPORTED_ITEM'});
});
test('v8 saved identity, dyes and shape migrate without changing appearance',()=>{
 const base=appearanceFromEquipment({race:'human',loadout:{torso:'fieldcoat',mainHand:'ironSword',offHand:'graveweaverBook'}},APPEARANCE_V8_REGISTRY);
 const old=validateAppearance({...base,shape:{...base.shape,height:1.15,build:-.95},dyes:{torso:'moss'},components:{head:'human-prime-v1',hair:'human-bald-v1'}},APPEARANCE_V8_REGISTRY);
 assert.deepEqual(migrateAppearance(old),{...old,catalogVersion:'appearance-catalog-v9'});
});
test('shield recipes round-trip across all declared races and respect two-hand conflicts',()=>{
 for(const race of ['human','orc','undead']) {
  const recipe=appearanceFromEquipment({race,loadout:{mainHand:'ironSword',offHand:'bastionShield'}});
  assert.deepEqual(decodeAppearance(encodeAppearance(recipe)),recipe);
  assert.deepEqual(decodeMigratingAppearance(JSON.stringify(recipe)),recipe);
  assert.throws(()=>validateAppearance({...recipe,equipment:{...recipe.equipment,mainHand:'graveweaverGreatstaff'}}),{code:'EQUIPMENT_CONFLICT'});
  assert.equal(resolveHandEquip(recipe.equipment,{mainHand:'graveweaverGreatstaff'},EQUIPMENT_ITEMS).offHand,null);
  assert.equal(resolveHandEquip({mainHand:'graveweaverGreatstaff'},{offHand:'bastionShield'},EQUIPMENT_ITEMS).mainHand,null);
 }
 assert.equal(gripHold(EQUIPMENT_ITEMS.bastionShield,'orc').scale,1.12);
});
test('selected native resource set includes shield and excludes procedural hands',()=>{
 const body={url:'/body'},coat={url:'/coat'};
 const manifest={items:{body,fieldcoat:coat}};
 assert.deepEqual([...selectedEquipmentResources(manifest,{torso:'fieldcoat',mainHand:'ironSword',offHand:'bastionShield'},EQUIPMENT_ITEMS)],
  [['body',body],['fieldcoat',coat],['bastionShield',EQUIPMENT_ITEMS.bastionShield.asset]]);
 assert.throws(()=>selectedEquipmentResources(manifest,{boots:'wayfarerBoots'},EQUIPMENT_ITEMS),/Missing selected equipment/);
});
test('unknown factories and missing/foreign/oversize authored resources fail catalogue validation',()=>{
 const options={slots:EQUIPMENT_SLOTS,baseMeshes:BASE_VISIBLE_MESHES};
 for(const change of [item=>{item.factory='unknown'},item=>{delete item.asset},item=>{item.asset.url='/unversioned.glb'},item=>{item.asset.bytes=98305},item=>{item.gripGeometry.axis=[0,0,0]}]) {
  const candidate=structuredClone(EQUIPMENT_ITEMS);change(candidate.bastionShield);
  assert.throws(()=>validateEquipmentCatalogue(candidate,options),/prop factory|authored/);
 }
});
test('published native rigid prop is exact, unskinned and source-verified',async()=>{
 const rows=await verifyPublishedAuthoredProps();
 assert.deepEqual(rows.map(row=>[row.id,row.bytes,row.triangles,row.draws]),[['bastionShield',67352,1104,3]]);
});
