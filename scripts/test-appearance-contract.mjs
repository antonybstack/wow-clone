import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {EQUIPMENT_ITEMS,EQUIPMENT_PRESETS,EQUIPMENT_SLOTS} from '../src/ashen-reach/equipment-catalog.js';
import {FITS_BY_RACE} from '../src/ashen-reach/equipment-contract.js';
import {APPEARANCE_V1_REGISTRY as APPEARANCE_REGISTRY,AppearanceError,validateAppearance as validateCurrentAppearance} from '../src/character/appearance/contract.js';
import {appearanceKey as currentKey,decodeAppearance as currentDecode,encodeAppearance as currentEncode} from '../src/character/appearance/codec.js';
import {appearanceFromEquipment as currentFromEquipment} from '../src/character/appearance/from-equipment.js';

// Schema 1 fixtures remain exact; these tests intentionally verify the frozen legacy registry.
const validateAppearance=(r,registry=APPEARANCE_REGISTRY)=>validateCurrentAppearance(r,registry);
const encodeAppearance=(r,registry=APPEARANCE_REGISTRY)=>currentEncode(r,registry);
const decodeAppearance=(r,registry=APPEARANCE_REGISTRY)=>currentDecode(r,registry);
const appearanceKey=(r,registry=APPEARANCE_REGISTRY)=>currentKey(r,registry);
const appearanceFromEquipment=(r,registry=APPEARANCE_REGISTRY)=>currentFromEquipment(r,registry);
const wayfarer=()=>appearanceFromEquipment({race:'human',loadout:EQUIPMENT_PRESETS.wayfarer.loadout});
const clone=x=>structuredClone(x);
const rejects=(action,code,path)=>assert.throws(action,e=>e instanceof AppearanceError && e.code===code && e.path===path,`${code} at ${path}`);

test('every current race and preset has one immutable round-trip',()=>{
  assert.deepEqual(Object.keys(APPEARANCE_REGISTRY.profiles),['human','orc','undead']);
  for(const race of Object.keys(APPEARANCE_REGISTRY.profiles)) assert.deepEqual(APPEARANCE_REGISTRY.profiles[race].fit,FITS_BY_RACE[race]);
  for(const race of ['human','orc','undead']) for(const [id,preset] of Object.entries(EQUIPMENT_PRESETS)) {
    const recipe=appearanceFromEquipment({race,loadout:preset.loadout});
    const decoded=decodeAppearance(encodeAppearance(recipe));
    assert.deepEqual(decoded,recipe,`${race}/${id}`);
    assert(Object.isFrozen(recipe) && Object.isFrozen(recipe.fit) && Object.isFrozen(recipe.equipment));
    assert.equal(recipe.fitFamily,APPEARANCE_REGISTRY.profiles[race].fit.body);
    assert.deepEqual(recipe.shape,{});
    assert.deepEqual(recipe.components,{});
    assert.deepEqual(recipe.dyes,{});
  }
});
test('adapter fills known empty slots and never retains or mutates source state',()=>{
  const loadout={torso:'wayfarerTunic'};
  const original=clone(loadout);
  const recipe=appearanceFromEquipment({race:'human',loadout});
  assert.deepEqual(loadout,original);
  assert.deepEqual(Object.keys(recipe.equipment),EQUIPMENT_SLOTS);
  assert.equal(recipe.equipment.torso,'wayfarerTunic');
  assert.equal(recipe.equipment.helmet,null);
  loadout.torso=null;
  assert.equal(recipe.equipment.torso,'wayfarerTunic');
  rejects(()=>validateAppearance({...recipe,equipment:{torso:'wayfarerTunic'}}),'MISSING_FIELD','$.equipment.helmet');
});
test('canonical bytes and semantic key ignore caller property order but reflect gear changes',()=>{
  const recipe=wayfarer();
  const reordered=Object.fromEntries(Object.entries(recipe).reverse());
  reordered.fit=Object.fromEntries(Object.entries(recipe.fit).reverse());
  reordered.equipment=Object.fromEntries(Object.entries(recipe.equipment).reverse());
  assert.equal(encodeAppearance(reordered),encodeAppearance(recipe));
  assert.equal(appearanceKey(reordered),appearanceKey(recipe));
  const other=clone(recipe);other.equipment.mainHand=null;
  assert.notEqual(appearanceKey(other),appearanceKey(recipe));
  assert(encodeAppearance(recipe).length<1024);
  const keys=[];
  for(const race of ['human','orc','undead']) for(const preset of Object.values(EQUIPMENT_PRESETS)) keys.push(appearanceKey(appearanceFromEquipment({race,loadout:preset.loadout})));
  assert.equal(new Set(keys).size,keys.length);
});
test('race, fit family, bind and catalogue versions must agree',()=>{
  const r=clone(wayfarer());
  r.race='elf';rejects(()=>validateAppearance(r),'UNSUPPORTED_RACE','$.race');
  r.race='orc';rejects(()=>validateAppearance(r),'FIT_MISMATCH','$.fitFamily');
  r.race='human';r.fit.bind=2;rejects(()=>validateAppearance(r),'FIT_MISMATCH','$.fit.bind');
  r.fit.bind=1;r.fitFamily='human-tripo-v1';rejects(()=>validateAppearance(r),'FIT_MISMATCH','$.fitFamily');
  r.fitFamily='ashen-human';r.catalogVersion='appearance-catalog-v2';rejects(()=>validateAppearance(r),'UNSUPPORTED_CATALOG','$.catalogVersion');
  r.catalogVersion='appearance-catalog-v1';r.schemaVersion=2;rejects(()=>validateAppearance(r),'UNSUPPORTED_SCHEMA','$.schemaVersion');
});
test('occupancy, item slot and declared per-race fit reuse current equipment rules',()=>{
  const r=clone(wayfarer());
  r.equipment.mainHand='graveweaverGreatstaff';r.equipment.offHand='graveweaverBook';
  rejects(()=>validateAppearance(r),'EQUIPMENT_CONFLICT','$.equipment.offHand');
  r.equipment.offHand=null;r.equipment.torso='ironSword';
  rejects(()=>validateAppearance(r),'UNSUPPORTED_ITEM','$.equipment.torso');
  r.equipment.torso='wayfarerTunic';r.equipment.mainHand='ironSword';
  const item=EQUIPMENT_ITEMS.ironSword;
  const registry={...APPEARANCE_REGISTRY,items:{...EQUIPMENT_ITEMS,ironSword:{...item,fits:{human:item.fits.human}}}};
  const orc=appearanceFromEquipment({race:'orc',loadout:EQUIPMENT_PRESETS.wayfarer.loadout});
  rejects(()=>validateAppearance(orc,registry),'UNSUPPORTED_ITEM_FIT','$.equipment.mainHand');
});
test('unimplemented shape, component, dye and arbitrary descriptor fields are rejected',()=>{
  const r=clone(wayfarer());
  r.shape.height=1.8;rejects(()=>validateAppearance(r),'UNSUPPORTED_PARAMETER','$.shape.height');
  r.shape.height=NaN;rejects(()=>validateAppearance(r),'INVALID_VALUE','$.shape.height');
  r.shape={};r.components.hair='long';rejects(()=>validateAppearance(r),'UNSUPPORTED_PARAMETER','$.components.hair');
  r.components={};r.dyes.tunic='#000';rejects(()=>validateAppearance(r),'UNSUPPORTED_PARAMETER','$.dyes.tunic');
  r.dyes={};r.assetUrl='https://example.invalid/actor.glb';rejects(()=>validateAppearance(r),'UNKNOWN_FIELD','$.assetUrl');
  delete r.assetUrl;r.equipment.helmet='notReal';rejects(()=>validateAppearance(r),'UNSUPPORTED_ITEM','$.equipment.helmet');
});
test('untrusted JSON and object prototypes cannot smuggle fields or code',()=>{
  const r=clone(wayfarer());
  r.fit=Object.create({rig:'source-65'});r.fit.bind=1;r.fit.shape=1;
  rejects(()=>validateAppearance(r),'INVALID_TYPE','$.fit');
  const parsed=JSON.parse(encodeAppearance(wayfarer()));
  parsed.equipment.__proto__=null; // prototype mutation is refused as an unexpected object.
  rejects(()=>validateAppearance(parsed),'INVALID_TYPE','$.equipment');
  const withForbidden=JSON.parse(encodeAppearance(wayfarer()));
  Object.defineProperty(withForbidden.shape,'__proto__',{value:'bad',enumerable:true});
  rejects(()=>validateAppearance(withForbidden),'FORBIDDEN_FIELD','$.shape.__proto__');
  const withGetter=clone(wayfarer());
  Object.defineProperty(withGetter,'race',{get(){throw Error('must not run');},enumerable:true});
  rejects(()=>validateAppearance(withGetter),'INVALID_FIELD','$.race');
  rejects(()=>appearanceFromEquipment({race:'human',loadout:Object.assign(Object.create(null),{torso:'wayfarerTunic'})}),'INVALID_TYPE','$.loadout');
  const arrayShape=clone(wayfarer());arrayShape.shape=[];
  rejects(()=>validateAppearance(arrayShape),'INVALID_TYPE','$.shape');
  const nested=clone(wayfarer());nested.fit.assetUrl='/a.glb';
  rejects(()=>validateAppearance(nested),'UNKNOWN_FIELD','$.fit.assetUrl');
  const extraSlot=clone(wayfarer());extraSlot.equipment.secret='value';
  rejects(()=>validateAppearance(extraSlot),'UNKNOWN_FIELD','$.equipment.secret');
});
test('decoder bounds UTF-8 bytes and returns controlled parse errors',()=>{
  rejects(()=>decodeAppearance('{'),'INVALID_JSON','$');
  rejects(()=>decodeAppearance('é'.repeat(9000)),'TOO_LARGE','$');
  rejects(()=>decodeAppearance(' '.repeat(16385)),'TOO_LARGE','$');
  rejects(()=>decodeAppearance(1),'INVALID_TYPE','$');
  const text=encodeAppearance(wayfarer());
  assert.deepEqual(decodeAppearance(text),wayfarer());
});
test('committed seed fixtures stay canonical and document three active families',async()=>{
  const data=JSON.parse(await fs.readFile(new URL('./fixtures/appearance/v1-recipes.json',import.meta.url)));
  assert.equal(data.schema,1);
  for(const [source,digest] of Object.entries(data.sourceSha256)) {
    const bytes=await fs.readFile(new URL(`../${source}`,import.meta.url));
    assert.equal(createHash('sha256').update(bytes).digest('hex'),digest,source);
  }
  for(const [name,{race,preset,recipe}] of Object.entries(data.fixtures)) {
    const expected=appearanceFromEquipment({race,loadout:preset==='empty'?{}:EQUIPMENT_PRESETS[preset].loadout});
    assert.deepEqual(recipe,expected,name);
    assert.equal(encodeAppearance(recipe),encodeAppearance(expected));
  }
});
