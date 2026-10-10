import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyExploration,validateExploration,transitionExploration,EXPLORATION_PHASES,PHASE_DISCOVERIES} from '../src/ashen-reach/exploration-state.js';
import {loadExploration,saveExploration,decodeExploration,EXPLORATION_STORAGE_KEY as KEY,EXPLORATION_RECOVERY_KEY as RECOVERY} from '../src/ashen-reach/exploration-store.js';
const steps=['read-inscription','ring-bell','claim-relic','return-hollowmere'];
const storage=()=>{const data=new Map();return {data,getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};};

test('the complete episode advances once per required interaction; revisits are harmless',()=>{
 let r=emptyExploration();
 for(const [i,step]of steps.entries()){
  assert.equal(transitionExploration(r,steps.at(-1)).changed,i===3);
  const next=transitionExploration(r,step);assert(next.changed);r=next.record;
  assert.equal(r.phase,EXPLORATION_PHASES[i+1]);assert.equal(r.discovered.length,i+1);
  assert.equal(transitionExploration(r,step).changed,false);
 }
 assert.equal(r.phase,'returned');assert.deepEqual(r.discovered,[...PHASE_DISCOVERIES].sort());
});
test('a premature bell, relic or return does not skip the memorial',()=>{
 for(const action of steps.slice(1)){const next=transitionExploration(emptyExploration(),action);assert(next.blocked);assert(!next.changed);assert.deepEqual(next.record,emptyExploration());}
});
test('regional discovery is independent, idempotent and cannot grant episode progress',()=>{
 const next=transitionExploration(emptyExploration(),'eastwatch-dispatch');assert(next.changed);assert.equal(next.record.phase,'unstarted');
 assert.equal(transitionExploration(next.record,'eastwatch-dispatch').changed,false);assert.throws(()=>transitionExploration(next.record,'unknown'));
});
test('unknown, oversized, duplicate and prerequisite-inconsistent records are rejected',()=>{
 const base=emptyExploration();
 for(const value of [null,[],{...base,version:2},{...base,episode:'future'},{...base,extra:true},{...base,phase:'relic-claimed'},{...base,discovered:['vaelmark-relic']},{...base,discovered:['unknown']},{...base,discovered:['eastwatch-view','eastwatch-view']}])assert.throws(()=>validateExploration(value));
 assert.throws(()=>decodeExploration(' '.repeat(17000)));assert.throws(()=>decodeExploration('{'));
});
test('each phase restores exactly without replaying an interaction or adding credit',()=>{
 let r=emptyExploration();const s=storage();
 for(const action of [null,...steps]){if(action)r=transitionExploration(r,action).record;assert(saveExploration(r,{storage:s}));const saved=loadExploration({storage:s});assert(saved.restored);assert.deepEqual(saved.record,r);assert.equal(saved.warning,null);}
});
test('unknown saved data is retained on load and backed up before a real discovery save',()=>{
 const s=storage(),raw=JSON.stringify({...emptyExploration(),version:9});s.data.set(KEY,raw);
 const loaded=loadExploration({storage:s});assert(!loaded.restored);assert(loaded.warning);assert.equal(s.data.get(KEY),raw);
 assert(saveExploration(transitionExploration(loaded.record,'read-inscription').record,{storage:s}));assert.equal(s.data.get(RECOVERY),raw);assert.equal(loadExploration({storage:s}).record.phase,'inscription-read');
});
test('a failed recovery write preserves unknown data and never claims persistence',()=>{
 const raw='future format',s={getItem:()=>raw,setItem:()=>{throw Error('Quota');}};
 assert(!saveExploration(emptyExploration(),{storage:s}));assert.equal(s.getItem(KEY),raw);
});
test('missing or inaccessible storage keeps a valid in-memory journal',()=>{
 for(const s of [null,{getItem(){throw Error('Denied');},setItem(){throw Error('Denied');}}]){
  const loaded=loadExploration({storage:s});assert(loaded.warning);assert.deepEqual(loaded.record,emptyExploration());
  assert(!saveExploration(transitionExploration(loaded.record,'read-inscription').record,{storage:s}));
 }
});
