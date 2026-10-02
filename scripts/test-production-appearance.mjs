import test from 'node:test';
import assert from 'node:assert/strict';
import {appearanceFromEquipment} from '../src/character/appearance/from-equipment.js';
import {APPEARANCE_V1_REGISTRY,APPEARANCE_V2_REGISTRY,APPEARANCE_V3_REGISTRY,APPEARANCE_CATALOG_VERSION,validateAppearance,migrateAppearance,appearanceShapeWeights} from '../src/character/appearance/contract.js';
import {encodeAppearance,decodeAppearance,decodeMigratingAppearance} from '../src/character/appearance/codec.js';
import {APPEARANCE_STORAGE_KEY,APPEARANCE_RECOVERY_KEY,LEGACY_CREATOR_KEY,defaultAppearance,migrateLegacyCreator,loadAppearance,saveAppearance} from '../src/character/appearance/store.js';
const store=()=>{const data=new Map();return {data,getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};};
const shaped=(b,h=1)=>{const a=defaultAppearance();return {...a,shape:{...a.shape,build:b,height:h}};};
test('production recipe preserves one signed axis, equipment and canonical round trip',()=>{
 for(const b of [-.95,-.5,0,.5,.95])for(const h of [.9,1,1.15]) {
  const a=validateAppearance(shaped(b,h));assert.deepEqual(decodeAppearance(encodeAppearance(a)),a);
  const w=appearanceShapeWeights(a);assert.equal(w[0]*w[1],0);assert.equal(w[1]-w[0],b);assert(Object.isFrozen(a.shape));
 }
});
test('shape family, numeric domain and neutral-only races are enforced',()=>{
 for(const b of [-1,1,NaN,Infinity,'0.5',null])assert.throws(()=>validateAppearance(shaped(b)));
 for(const h of [.89,1.16,NaN,'1'])assert.throws(()=>validateAppearance(shaped(0,h)));
 const a=shaped(0);assert.throws(()=>validateAppearance({...a,shape:{...a.shape,slender:.1}}));
 assert.throws(()=>validateAppearance({...a,shape:{...a.shape,family:'another'}}));
 for(const race of ['orc','undead']){const r=defaultAppearance(race);assert.deepEqual(r.shape,{});assert.throws(()=>validateAppearance({...r,shape:a.shape}));}
});
test('v1 appearance migrates explicitly; future version/catalogue cannot be guessed',()=>{
 for(const race of ['human','orc','undead']) {
  const old=appearanceFromEquipment({race,loadout:{}},APPEARANCE_V1_REGISTRY),next=migrateAppearance(old);
  assert.equal(next.schemaVersion,2);assert.deepEqual(next.equipment,{...old.equipment,shoulders:null});
  assert.throws(()=>migrateAppearance({...old,catalogVersion:'foreign'}));
  assert.throws(()=>migrateAppearance({...old,schemaVersion:99}));
 }
});
test('legacy single axes migrate exactly; mixed axes and wider domains remain recoverable',()=>{
 const legacy=b=>({schemaVersion:1,race:'human',controls:{height:.9,build:b}});
 assert.equal(migrateLegacyCreator(legacy({slender:.85,stout:0})).shape.build,-.85);
 const storage=store(),original=JSON.stringify(legacy({slender:.4,stout:.3}));storage.setItem(LEGACY_CREATOR_KEY,original);
 const result=loadAppearance({storage});assert.match(result.warning,/UNSUPPORTED_BLEND/);assert.equal(result.restored,false);assert.equal(storage.getItem(LEGACY_CREATOR_KEY),original);
 assert.throws(()=>migrateLegacyCreator(legacy({slender:0,stout:1})));
 assert.throws(()=>migrateLegacyCreator({...legacy({slender:0,stout:0}),schemaVersion:99}));
 for(const race of ['orc','undead']){const s=store();s.setItem(LEGACY_CREATOR_KEY,JSON.stringify({schemaVersion:1,race,controls:{}}));assert.equal(loadAppearance({storage:s}).appearance.race,race);}
});
test('bad current storage is backed up before overwrite; blocked storage stays playable',()=>{
 const storage=store(),raw='{broken';storage.setItem(APPEARANCE_STORAGE_KEY,raw);
 assert.match(loadAppearance({storage}).warning,/retained/);assert.equal(saveAppearance(shaped(.5),{storage}),true);assert.equal(storage.getItem(APPEARANCE_RECOVERY_KEY),raw);
 const blocked={getItem(){throw Error('blocked');},setItem(){throw Error('blocked');}};
 assert.equal(loadAppearance({storage:blocked}).restored,false);assert.equal(saveAppearance(shaped(0),{storage:blocked}),false);
 assert.equal(saveAppearance(shaped(0),{storage:null}),false);
});
test('shape records reject hidden/getter/prototype fields without evaluating them',()=>{
 const a=shaped(0);Object.defineProperty(a.shape,'height',{get(){throw Error('evaluated');},enumerable:true});
 assert.throws(()=>validateAppearance(a),e=>e.code==='INVALID_FIELD');
 const storage=store();storage.setItem(LEGACY_CREATOR_KEY,'{"schemaVersion":1,"race":"human","controls":{"height":1,"build":{"__proto__":{},"slender":0,"stout":0}}}');
 assert.match(loadAppearance({storage}).warning,/FORBIDDEN_FIELD/);assert.equal({}.polluted,undefined);
});

// Exercise queued drafts and failed application through the real production session.
import {createProductionCreatorSession} from '../src/character/creator/production.js';
test('queued controls, undo and failure retain one committed appearance',async()=>{
 let actual=defaultAppearance(),fail=false;
 const session=createProductionCreatorSession({getAppearance:()=>actual,applyBody:async shape=>{await Promise.resolve();if(fail)throw Error('injected');actual=validateAppearance({...actual,shape});}});
 await Promise.all([session.set('height',.9),session.set('build',-.95)]);
 assert.equal(actual.shape.height,.9);assert.equal(actual.shape.build,-.95);
 await session.undo();assert.equal(actual.shape.build,0);assert.equal(actual.shape.height,.9);
 await session.undo();assert.equal(actual.shape.height,1);assert.equal(session.canUndo,false);
 fail=true;await assert.rejects(session.set('build',.5));assert.equal(session.state.controls.build,0);assert.equal(actual.shape.build,0);
 assert.throws(()=>session.set('build','0.5'));assert.throws(()=>session.set('build',{slender:'0.5'}));
});

test('seven-slot v2 recipes migrate exactly, including endpoints and all races',()=>{
 for(const race of ['human','orc','undead'])for(const build of [-.95,0,.95]) {
  const legacy=appearanceFromEquipment({race,loadout:{torso:'graveweaverTop',mainHand:'graveweaverGreatstaff'}},APPEARANCE_V2_REGISTRY);
  const old=race==='human'?validateAppearance({...legacy,shape:{...legacy.shape,height:build>0?1.15:.9,build}},APPEARANCE_V2_REGISTRY):legacy;
  const text=encodeAppearance(old,APPEARANCE_V2_REGISTRY),s=store();s.setItem(APPEARANCE_STORAGE_KEY,text);
  const loaded=loadAppearance({storage:s});assert.equal(loaded.restored,true);assert.equal(loaded.migrated,true);
  assert.deepEqual(loaded.appearance.shape,old.shape);assert.deepEqual(loaded.appearance.equipment,{...old.equipment,shoulders:null});
  assert.deepEqual(decodeMigratingAppearance(text),loaded.appearance);assert.equal(s.getItem(APPEARANCE_STORAGE_KEY),text);
  assert.equal(saveAppearance(loaded.appearance,{storage:s}),true);assert.equal(s.getItem(APPEARANCE_RECOVERY_KEY),null);
  assert.deepEqual(decodeAppearance(s.getItem(APPEARANCE_STORAGE_KEY)),loaded.appearance);
 }
});
test('historical catalogues reject future items/slots and unknown catalogues remain recoverable',()=>{
 const old=appearanceFromEquipment({race:'human',loadout:{}},APPEARANCE_V2_REGISTRY);
 for(const patch of [{catalogVersion:'appearance-catalog-v99'},{equipment:{...old.equipment,shoulders:'wardenPauldrons'}},{equipment:{...old.equipment,helmet:'wardenPauldrons'}}]) {
  const text=JSON.stringify({...old,...patch}),s=store();s.setItem(APPEARANCE_STORAGE_KEY,text);
  assert.throws(()=>decodeMigratingAppearance(text));assert.equal(loadAppearance({storage:s}).restored,false);
  assert.equal(s.getItem(APPEARANCE_STORAGE_KEY),text);assert.equal(saveAppearance(defaultAppearance(),{storage:s}),true);assert.equal(s.getItem(APPEARANCE_RECOVERY_KEY),text);
 }
 const current=defaultAppearance();assert.deepEqual(decodeAppearance(encodeAppearance({...current,equipment:{...current.equipment,shoulders:'wardenPauldrons'}})).equipment.shoulders,'wardenPauldrons');
});

test('v3 migration preserves armor, shape, race and original storage bytes',()=>{
 const ids=Object.keys(APPEARANCE_V3_REGISTRY.items).sort();
 assert.deepEqual(ids,['graveweaverBook','graveweaverGloves','graveweaverGreatstaff','graveweaverHood','graveweaverSkirt','graveweaverStaff','graveweaverTop','ironSword','pilgrimTunic','wardenPauldrons','wayfarerBoots','wayfarerTrousers','wayfarerTunic'].sort());
 for(const race of ['human','orc','undead']){
  const base=appearanceFromEquipment({race,loadout:{torso:'pilgrimTunic',shoulders:'wardenPauldrons'}},APPEARANCE_V3_REGISTRY);
  const old=race==='human'?validateAppearance({...base,shape:{...base.shape,height:.9,build:-.95}},APPEARANCE_V3_REGISTRY):base;
  const text=encodeAppearance(old,APPEARANCE_V3_REGISTRY),s=store();s.setItem(APPEARANCE_STORAGE_KEY,text);
  const loaded=loadAppearance({storage:s});assert(loaded.restored&&loaded.migrated);
  assert.deepEqual(loaded.appearance,{...old,catalogVersion:APPEARANCE_CATALOG_VERSION});
  assert.equal(s.getItem(APPEARANCE_STORAGE_KEY),text);
  for(const [slot,id]of [['torso','lectorCoat'],['torso','duskguardCuirass'],['legs','duskguardTassets'],['boots','duskguardGreaves'],['gloves','duskguardVambraces']]){
   const invalid={...old,equipment:{...old.equipment,[slot]:id}},raw=JSON.stringify(invalid);s.setItem(APPEARANCE_STORAGE_KEY,raw);
   assert.throws(()=>migrateAppearance(invalid),e=>e.code==='UNSUPPORTED_ITEM');
   assert.equal(loadAppearance({storage:s}).restored,false);assert.equal(s.getItem(APPEARANCE_STORAGE_KEY),raw);
   const valid=validateAppearance({...invalid,catalogVersion:APPEARANCE_CATALOG_VERSION});
   assert.deepEqual(decodeAppearance(encodeAppearance(valid)),valid);
  }
 }
});

test('v1 and v2 registries reject every v4 piece even in its correct slot',()=>{
 for(const registry of [APPEARANCE_V1_REGISTRY,APPEARANCE_V2_REGISTRY]){
  const old=appearanceFromEquipment({race:'human',loadout:{}},registry);
  for(const [slot,id]of [['torso','lectorCoat'],['torso','duskguardCuirass'],['legs','duskguardTassets'],['boots','duskguardGreaves'],['gloves','duskguardVambraces']])
   assert.throws(()=>decodeMigratingAppearance(JSON.stringify({...old,equipment:{...old.equipment,[slot]:id}})),e=>e.code==='UNSUPPORTED_ITEM');
 }
});
