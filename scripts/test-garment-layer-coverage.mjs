import test from'node:test';import assert from'node:assert/strict';
import{EQUIPMENT_ITEMS}from'../src/ashen-reach/equipment-catalog.js';
import{validateGarmentLayerCoverage,resolveGarmentLayerVisibility}from'../src/ashen-reach/garment-layer-coverage.js';
import{pilotCoverageForRace}from'../src/ashen-reach/coverage-pilot.js';
test('upper trousers remain visible bare or with a torso without declared long coverage',()=>{
 const rules=pilotCoverageForRace('undead');validateGarmentLayerCoverage(rules,EQUIPMENT_ITEMS,['UndeadV1Body']);
 assert.equal(resolveGarmentLayerVisibility({legs:'wayfarerTrousers',torso:null},EQUIPMENT_ITEMS,rules).WayfarerTrousersUnderTorso,true);
 const cropped={...rules,coversByItem:{}};assert.equal(resolveGarmentLayerVisibility({legs:'wayfarerTrousers',torso:'wayfarerTunic'},EQUIPMENT_ITEMS,cropped).WayfarerTrousersUnderTorso,true);
});
test('long torso hides only the declared geoset and unequip restores it',()=>{
 const rules=pilotCoverageForRace('human'),state={legs:'wayfarerTrousers',torso:'pilgrimTunic'};
 assert.deepEqual(resolveGarmentLayerVisibility(state,EQUIPMENT_ITEMS,rules),{WayfarerTrousersUnderTorso:false});
 assert.equal(resolveGarmentLayerVisibility({...state,torso:null},EQUIPMENT_ITEMS,rules).WayfarerTrousersUnderTorso,true);
 assert.equal(resolveGarmentLayerVisibility({...state,legs:null,torso:null},EQUIPMENT_ITEMS,rules).WayfarerTrousersUnderTorso,false);
});
test('inactive leg alternative cannot override selected geoset visibility',()=>{
 const rules=pilotCoverageForRace('orc');for(const legs of['wayfarerTrousers','graveweaverSkirt'])assert.equal(resolveGarmentLayerVisibility({legs},EQUIPMENT_ITEMS,rules).WayfarerTrousersUnderTorso,true);
});
test('race adapter reflects already cropped Human robe rather than requiring nonexistent parts',()=>{
 assert.equal(pilotCoverageForRace('human').partsByItem.graveweaverSkirt,undefined);assert(pilotCoverageForRace('undead').partsByItem.graveweaverSkirt);assert.throws(()=>pilotCoverageForRace('elf'),/Unknown/);
});
test('unknown regions/items, body masking and duplicate parts fail the explicit contract',()=>{
 const fresh=()=>structuredClone(pilotCoverageForRace('human'));let r=fresh();r.coversByItem.pilgrimTunic=['unknown'];assert.throws(()=>validateGarmentLayerCoverage(r,EQUIPMENT_ITEMS),/region cover/);
 r=fresh();r.coversByItem.ironSword=['trousers.upper'];assert.throws(()=>validateGarmentLayerCoverage(r,EQUIPMENT_ITEMS),/region cover/);
 r=fresh();r.partsByItem.wayfarerTrousers[0].mesh='HumanV1Body';assert.throws(()=>validateGarmentLayerCoverage(r,EQUIPMENT_ITEMS,['HumanV1Body']),/region part/);
 r=fresh();r.partsByItem.wayfarerTrousers.push(r.partsByItem.wayfarerTrousers[0]);assert.throws(()=>validateGarmentLayerCoverage(r,EQUIPMENT_ITEMS),/region part/);
 r=fresh();r.partsByItem.unavailable=r.partsByItem.wayfarerTrousers;assert.throws(()=>validateGarmentLayerCoverage(r,EQUIPMENT_ITEMS),/region source/);
});
