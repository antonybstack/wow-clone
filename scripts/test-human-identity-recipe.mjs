import test from 'node:test';
import assert from 'node:assert/strict';
import {APPEARANCE_REGISTRY,APPEARANCE_IDENTITY_REGISTRY as candidate,APPEARANCE_V1_REGISTRY,APPEARANCE_V2_REGISTRY,APPEARANCE_V3_REGISTRY,APPEARANCE_V4_REGISTRY,APPEARANCE_V5_REGISTRY,APPEARANCE_V6_REGISTRY,validateAppearance,migrateAppearance} from '../src/character/appearance/contract.js';
import {HUMAN_IDENTITY_PRESETS,findHumanIdentityPreset} from '../src/character/appearance/human-identity.js';
import {appearanceFromEquipment} from '../src/character/appearance/from-equipment.js';
import {encodeAppearance,decodeAppearance,decodeMigratingAppearance,appearanceKey} from '../src/character/appearance/codec.js';
import {defaultAppearance,loadAppearance,saveAppearance,APPEARANCE_STORAGE_KEY,APPEARANCE_RECOVERY_KEY} from '../src/character/appearance/store.js';
import {createProductionIdentitySession} from '../src/character/creator/production.js';
const identity=(id,base=migrateAppearance(defaultAppearance(),candidate))=>validateAppearance({...base,components:HUMAN_IDENTITY_PRESETS.find(p=>p.id===id).components},candidate);
const storage=()=>{const data=new Map();return {getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value)};};

test('current v7 (and frozen v6) support authored identity while historical component domains remain closed',()=>{
 assert.equal(APPEARANCE_REGISTRY,candidate);
 assert.equal(APPEARANCE_REGISTRY.catalogVersion,'appearance-catalog-v7');
 assert.equal(candidate.catalogVersion,'appearance-catalog-v7');
 assert.equal(APPEARANCE_V6_REGISTRY.catalogVersion,'appearance-catalog-v6');
 assert.equal(APPEARANCE_V6_REGISTRY.profiles,candidate.profiles);
 for(const registry of [APPEARANCE_V1_REGISTRY,APPEARANCE_V2_REGISTRY,APPEARANCE_V3_REGISTRY,APPEARANCE_V4_REGISTRY,APPEARANCE_V5_REGISTRY]){
  const old=appearanceFromEquipment({race:'human',loadout:{}},registry);
  assert.throws(()=>validateAppearance({...old,components:HUMAN_IDENTITY_PRESETS[1].components},registry),{code:'UNSUPPORTED_PARAMETER'});
 }
 assert.deepEqual(validateAppearance(identity('prime-bald')),identity('prime-bald'));
});

test('four authored identities are canonical, immutable and distinguishable without URLs',()=>{
 const keys=new Set();
 for(const preset of HUMAN_IDENTITY_PRESETS){
  const actual=identity(preset.id),encoded=encodeAppearance(actual,candidate);
  assert.deepEqual(decodeAppearance(encoded,candidate),actual);
  assert(Object.isFrozen(actual.components));assert(Object.isFrozen(preset.components));
  assert.equal(findHumanIdentityPreset(actual.components).id,preset.id);
  assert.equal(encoded.includes('__identity_review__'),false);
  keys.add(appearanceKey(actual,candidate));
 }
 assert.equal(keys.size,4);
 assert.deepEqual(identity('starter').components,{});
});

test('unsupported mixes and arbitrary component data are refused',()=>{
 const base=identity('starter');
 for(const components of [
  {head:'human-weathered-v1',hair:'human-ponytail01-v1'},
  {head:'human-prime-v1',hair:'human-starter-hair-v1'},
  {head:'human-starter-v1',hair:'human-bald-v1'},
  {head:'https://example.invalid/head.glb',hair:'human-bald-v1'},
  {head:'human-prime-v1'},
  {hair:'human-bald-v1'},
  {head:null,hair:'human-bald-v1'},
  {head:'human-prime-v1',hair:'human-bald-v1',age:.5},
  [],Object.create({head:'human-prime-v1'}),
 ])assert.throws(()=>validateAppearance({...base,components},candidate));
 const accessor={hair:'human-bald-v1'};let read=false;
 Object.defineProperty(accessor,'head',{enumerable:true,get(){read=true;return 'human-prime-v1';}});
 assert.throws(()=>validateAppearance({...base,components:accessor},candidate),{code:'INVALID_FIELD'});assert.equal(read,false);
 const forbidden=JSON.parse('{"head":"human-prime-v1","hair":"human-bald-v1","__proto__":{}}');
 assert.throws(()=>validateAppearance({...base,components:forbidden},candidate),{code:'FORBIDDEN_FIELD'});
});

test('Human identity cannot silently apply to Orc or Undead',()=>{
 for(const race of ['orc','undead']){
  const base=migrateAppearance(defaultAppearance(race),candidate);
  assert.deepEqual(base.components,{});
  for(const preset of HUMAN_IDENTITY_PRESETS)assert.throws(()=>validateAppearance({...base,components:preset.components},candidate),{code:'UNSUPPORTED_PARAMETER'});
 }
});

test('v1 through v5 migrate through the bounded decoder without changing existing identity or gear',()=>{
 for(const registry of [APPEARANCE_V1_REGISTRY,APPEARANCE_V2_REGISTRY,APPEARANCE_V3_REGISTRY,APPEARANCE_V4_REGISTRY,APPEARANCE_V5_REGISTRY])for(const race of ['human','orc','undead']){
  let old=appearanceFromEquipment({race,loadout:{torso:'graveweaverTop',boots:'wayfarerBoots',mainHand:'ironSword'}},registry);
  if(registry.schemaVersion===2&&race==='human')old=validateAppearance({...old,shape:{...old.shape,height:1.15,build:-.95}},registry);
  if(registry===APPEARANCE_V5_REGISTRY)old=validateAppearance({...old,dyes:{torso:'moss',boots:'oxblood'}},registry);
  const raw=encodeAppearance(old,registry),migrated=decodeMigratingAppearance(raw,candidate);
  assert.equal(migrated.catalogVersion,candidate.catalogVersion);assert.deepEqual(migrated.components,{});
  assert.deepEqual(migrated.equipment,registry.slots.includes('shoulders')?old.equipment:{...old.equipment,shoulders:null});
  assert.deepEqual(migrated.dyes,old.dyes);
  if(registry.schemaVersion===2)assert.deepEqual(migrated.shape,old.shape);
 }
 assert.throws(()=>decodeMigratingAppearance(JSON.stringify({...defaultAppearance(),catalogVersion:'appearance-catalog-v99'}),candidate),{code:'UNSUPPORTED_CATALOG'});
 assert.throws(()=>decodeMigratingAppearance(JSON.stringify({...defaultAppearance(),schemaVersion:99}),candidate),{code:'UNSUPPORTED_SCHEMA',path:'$.schemaVersion'});
 assert.deepEqual(decodeMigratingAppearance(encodeAppearance(identity('prime-bald'),candidate)),identity('prime-bald'));
 assert.throws(()=>decodeMigratingAppearance(' '.repeat(16385),candidate),{code:'TOO_LARGE'});
});

test('production storage restores v4 and preserves its original record without treating it as corrupt',()=>{
 for(const race of ['human','orc','undead']){
  const old=appearanceFromEquipment({race,loadout:{torso:'lectorCoat',shoulders:'wardenPauldrons'}},APPEARANCE_V4_REGISTRY);
  const raw=encodeAppearance(old,APPEARANCE_V4_REGISTRY),s=storage();s.setItem(APPEARANCE_STORAGE_KEY,raw);
  const loaded=loadAppearance({storage:s});assert(loaded.restored&&loaded.migrated);assert.equal(loaded.warning,null);
  assert.deepEqual(loaded.appearance,{...old,catalogVersion:APPEARANCE_REGISTRY.catalogVersion});
  assert.equal(s.getItem(APPEARANCE_STORAGE_KEY),raw);
  assert(saveAppearance(loaded.appearance,{storage:s}));assert.equal(s.getItem(APPEARANCE_RECOVERY_KEY),null);
  const unsupported={...old,dyes:{torso:'moss'}};s.setItem(APPEARANCE_STORAGE_KEY,JSON.stringify(unsupported));
  assert.equal(loadAppearance({storage:s}).restored,false);assert.equal(s.getItem(APPEARANCE_STORAGE_KEY),JSON.stringify(unsupported));
 }
});

test('identity-only undo preserves later shape, equipment and colour edits',async()=>{
 let actual=identity('starter');
 const session=createProductionIdentitySession({getActorGeneration:()=>0,getAppearance:()=>actual,registry:candidate,applyIdentity:async components=>{actual=validateAppearance({...actual,components},candidate);}});
 await session.set('prime-ponytail');
 actual=validateAppearance({...actual,shape:{...actual.shape,height:1.15,build:-.95},equipment:{...actual.equipment,torso:'lectorCoat'},dyes:{torso:'indigo'}},candidate);
 const {shape,equipment,dyes}=actual;await session.undo();
 assert.equal(session.selected,'starter');assert.deepEqual(actual.shape,shape);assert.deepEqual(actual.equipment,equipment);assert.deepEqual(actual.dyes,dyes);
 assert.equal(session.canUndo,false);
});

test('queued identity changes, failed loads and failed undo leave history consistent',async()=>{
 let actual=identity('starter'),fail=false,calls=0;
 const session=createProductionIdentitySession({getActorGeneration:()=>0,getAppearance:()=>actual,registry:candidate,applyIdentity:async components=>{calls++;await Promise.resolve();if(fail)throw Error('injected fetch refusal');actual=validateAppearance({...actual,components},candidate);}});
 const first=session.set('prime-bald'),second=session.set('weathered-bald');assert.equal(session.canUndo,false);
 await Promise.all([first,second]);assert.equal(session.selected,'weathered-bald');assert.equal(calls,2);
 await session.set('weathered-bald');assert.equal(calls,2);
 fail=true;const before=encodeAppearance(actual,candidate);
 await assert.rejects(session.set('prime-ponytail'),/injected/);assert.equal(encodeAppearance(actual,candidate),before);
 await assert.rejects(session.undo(),/injected/);assert.equal(encodeAppearance(actual,candidate),before);assert(session.canUndo);
 fail=false;await session.undo();assert.equal(session.selected,'prime-bald');await session.undo();assert.equal(session.selected,'starter');
 await session.set('prime-ponytail');await session.reset();assert.equal(session.selected,'starter');
 assert.throws(()=>session.set('old-ponytail'));await session.set('prime-bald');assert.equal(session.selected,'prime-bald');
});

test('identity history expires when changing race and historical session cannot expose identities',async()=>{
 let actual=identity('starter');
 const session=createProductionIdentitySession({getActorGeneration:()=>0,getAppearance:()=>actual,registry:candidate,applyIdentity:async components=>{actual=validateAppearance({...actual,components},candidate);}});
 await session.set('prime-bald');actual=migrateAppearance(defaultAppearance('orc'),candidate);
 assert.equal(session.canUndo,false);assert.equal(session.selected,null);
 await assert.rejects(session.set('prime-bald'),{name:'AbortError'});await assert.rejects(session.undo(),{name:'AbortError'});assert.equal(actual.race,'orc');
 const released=createProductionIdentitySession({getActorGeneration:()=>0,getAppearance:()=>appearanceFromEquipment({race:'human',loadout:{}},APPEARANCE_V5_REGISTRY),registry:APPEARANCE_V5_REGISTRY,applyIdentity:async()=>{throw Error('must not stage');}});
 await assert.rejects(released.set('prime-bald'),{code:'UNSUPPORTED_PARAMETER'});
 assert.deepEqual(await released.reset(),released.state);
});

test('owner generation refuses queued choices after a race round trip even before editor disposal',async()=>{
 let actual=identity('starter'),calls=0,generation=0;
 const session=createProductionIdentitySession({getActorGeneration:()=>generation,getAppearance:()=>actual,registry:candidate,applyIdentity:async components=>{calls++;actual=validateAppearance({...actual,components},candidate);}});
 const queued=session.set('prime-bald');
 actual=migrateAppearance(defaultAppearance('orc'),candidate);generation++;actual=identity('starter');generation++;
 await assert.rejects(queued,{name:'AbortError'});assert.equal(calls,0);assert.equal(session.selected,'starter');assert.equal(session.canUndo,false);
 await assert.rejects(session.set('weathered-bald'),{name:'AbortError'});
});

test('staged actor receives cancellation and can refuse commit before disposing its editor',async()=>{
 let actual=identity('starter'),release,started;
 const begun=new Promise(r=>started=r),staged=new Promise(r=>release=r);
 const session=createProductionIdentitySession({getActorGeneration:()=>0,getAppearance:()=>actual,registry:candidate,applyIdentity:async(components,{signal})=>{started();await staged;signal.throwIfAborted();actual=validateAppearance({...actual,components},candidate);}});
 const request=session.set('prime-ponytail');await begun;session.dispose();release();
 await assert.rejects(request,{name:'AbortError'});assert.equal(session.selected,'starter');assert.equal(session.canUndo,false);
});

test('replacement Human refuses queued undo even without an intermediate race change',async()=>{
 let actual=identity('starter'),generation=0;
 const session=createProductionIdentitySession({getActorGeneration:()=>generation,getAppearance:()=>actual,registry:candidate,applyIdentity:async components=>{actual=validateAppearance({...actual,components},candidate);}});
 await session.set('prime-bald');const pending=session.undo();actual=identity('weathered-bald');generation++;
 const before=encodeAppearance(actual,candidate);await assert.rejects(pending,{name:'AbortError'});
 assert.equal(encodeAppearance(actual,candidate),before);assert.equal(session.canUndo,false);
});

test('in-flight undo checks owner before commit and cannot re-arm history on a replacement',async()=>{
 let actual=identity('starter'),generation=0,hold=false,release,started;
 const begun=new Promise(r=>started=r),staged=new Promise(r=>release=r);
 const session=createProductionIdentitySession({getActorGeneration:()=>generation,getAppearance:()=>actual,registry:candidate,applyIdentity:async(components,{throwIfStale})=>{if(hold){started();await staged;}throwIfStale();actual=validateAppearance({...actual,components},candidate);}});
 await session.set('prime-bald');hold=true;const pending=session.undo();await begun;
 actual=identity('weathered-bald');generation++;const before=encodeAppearance(actual,candidate);release();
 await assert.rejects(pending,{name:'AbortError'});assert.equal(encodeAppearance(actual,candidate),before);assert.equal(session.canUndo,false);
});

test('selected identity persists locally while unpublished shared-region identity is refused',async()=>{
 for(const preset of HUMAN_IDENTITY_PRESETS){
  const recipe=identity(preset.id),raw=encodeAppearance(recipe),s=storage();s.setItem(APPEARANCE_STORAGE_KEY,raw);
  const loaded=loadAppearance({storage:s});assert(loaded.restored);assert.equal(loaded.warning,null);
  assert.deepEqual(loaded.appearance,recipe);assert.equal(s.getItem(APPEARANCE_STORAGE_KEY),raw);
  const {validatePresenceAppearance}=await import('../src/multiplayer/protocol.js');
  if(preset.id==='starter')assert.deepEqual(validatePresenceAppearance(recipe),recipe);
  else assert.throws(()=>validatePresenceAppearance(recipe),/no published head\/hair identity fit/);
 }
});
