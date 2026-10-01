import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {EQUIPMENT_PRESETS} from '../src/ashen-reach/equipment-catalog.js';
import {appearanceFromEquipment} from '../src/character/appearance/from-equipment.js';
import {actorPhaseSeconds,decodePreparedCrowdAppearance,planCrowdBatches} from '../src/character/crowd-probe/batches.js';
import {encodeAppearance} from '../src/character/appearance/codec.js';

const prepared=JSON.parse(await fs.readFile(new URL('../docs/baselines/character-mmo/m003/prepared-assets.json',import.meta.url),'utf8'));
const actor=(id,outfit)=>({id,outfit,recipe:appearanceFromEquipment({race:'human',loadout:EQUIPMENT_PRESETS[outfit].loadout})});
const batch=(plan,mesh)=>plan.batches.find(b=>b.mesh===mesh);

test('prepared v1 recipes migrate exactly and current recipes decode without changing shape',()=>{
  for(const outfit of ['wayfarer','warden']){
    const migrated=decodePreparedCrowdAppearance(prepared.variants[outfit].recipe);
    assert.deepEqual(migrated,actor('control',outfit).recipe);
    assert.deepEqual(decodePreparedCrowdAppearance(encodeAppearance(migrated)),migrated);
  }
  const unknown=JSON.parse(prepared.variants.wayfarer.recipe);unknown.schemaVersion=99;
  assert.throws(()=>decodePreparedCrowdAppearance(JSON.stringify(unknown)),/Unsupported schema/);
  assert.throws(()=>decodePreparedCrowdAppearance('x'.repeat(17000)),/16 KiB/);
  assert.throws(()=>decodePreparedCrowdAppearance('{'),/Malformed/);
});
test('neutral prepared geometry cannot silently represent a customized body',()=>{
  for(const shape of [{height:1.15,build:0},{height:1,build:.95}]){
    const a=actor('shaped','wayfarer');a.recipe=structuredClone(a.recipe);Object.assign(a.recipe.shape,shape);
    assert.throws(()=>planCrowdBatches([a],prepared),/neutral Human shape only/);
  }
});

test('shared body and boots retain stable actor IDs across unequal item populations',()=>{
  const actors=Array.from({length:10},(_,i)=>actor(`a-${i}`,i%2?'warden':'wayfarer'));
  const plan=planCrowdBatches(actors,prepared);
  assert.deepEqual(batch(plan,'HumanV1Body').actorIds,actors.map(a=>a.id));
  assert.deepEqual(batch(plan,'WayfarerBoots').actorIds,actors.map(a=>a.id));
  assert.deepEqual(batch(plan,'WayfarerTunic').actorIds,['a-0','a-2','a-4','a-6','a-8']);
  assert.deepEqual(batch(plan,'GraveweaverTop').actorIds,['a-1','a-3','a-5','a-7','a-9']);
  assert.equal(plan.actorToBatches.size,10);
  for(const actor of actors) for(const key of plan.actorToBatches.get(actor.id)) assert(plan.batches.find(b=>b.key===key)?.actorIds.includes(actor.id));
  assert.equal(batch(plan,'HumanV1Body').sourceOutfit,'wayfarer');
  assert.equal(batch(plan,'WayfarerBoots').sourceOutfit,'wayfarer');
});
test('per-piece phase is stable across every batch holding an actor',()=>{
  const actors=[actor('one','wayfarer'),actor('two','warden'),actor('three','wayfarer')];
  const plan=planCrowdBatches(actors,prepared);
  for(let i=0;i<actors.length;i++) {
    const phase=actorPhaseSeconds(actors[i].id);
    assert(Number.isFinite(phase)&&phase>=0&&phase<1.7);
    for(const key of plan.actorToBatches.get(actors[i].id)) {
      const b=plan.batches.find(entry=>entry.key===key);
      assert.equal(actorPhaseSeconds(b.actorIds[b.actorIds.indexOf(actors[i].id)]),phase);
    }
  }
});
test('logical phase survives middle removal, reordering and unrelated insertion',()=>{
  const actors=[actor('one','wayfarer'),actor('two','warden'),actor('three','wayfarer')];
  const initial=new Map(actors.map(a=>[a.id,actorPhaseSeconds(a.id)]));
  for(const cohort of [[actors[2],actors[0]],[actor('new','warden'),actors[0],actors[2]]]){
    const plan=planCrowdBatches(cohort,prepared);
    for(const b of plan.batches)for(const id of b.actorIds)if(initial.has(id))assert.equal(actorPhaseSeconds(id),initial.get(id));
  }
  assert.throws(()=>actorPhaseSeconds(''),/actor ID/);
});
test('invalid IDs, unsupported fit family and capacity fail before native allocation',()=>{
  assert.throws(()=>planCrowdBatches([actor('same','wayfarer'),actor('same','warden')],prepared),/unique/);
  assert.throws(()=>planCrowdBatches(Array.from({length:1001},(_,i)=>actor(`a-${i}`,'wayfarer')),prepared),/1–1000/);
  assert.throws(()=>planCrowdBatches([{id:'orc',outfit:'wayfarer',recipe:appearanceFromEquipment({race:'orc',loadout:EQUIPMENT_PRESETS.wayfarer.loadout})}],prepared),/Human only/);
  const wrong=actor('x','wayfarer');wrong.recipe=structuredClone(wrong.recipe);wrong.recipe.fit.bind=2;
  assert.throws(()=>planCrowdBatches([wrong],prepared),/Fit version differs/);
  assert.throws(()=>planCrowdBatches([actor('x','wayfarer')],{...prepared,variants:{}}),/Missing prepared outfit/);
});
