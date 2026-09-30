import test from 'node:test';
import assert from 'node:assert/strict';
import {appearanceFromEquipment} from '../src/character/appearance/from-equipment.js';
import {APPEARANCE_V1_REGISTRY,validateAppearance,migrateAppearance,appearanceShapeWeights} from '../src/character/appearance/contract.js';
import {encodeAppearance,decodeAppearance} from '../src/character/appearance/codec.js';
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
  assert.equal(next.schemaVersion,2);assert.deepEqual(next.equipment,old.equipment);
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
