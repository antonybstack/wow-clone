import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createAuraStore} from '../src/ashen-reach/combat/aura-store.js';
import {createDamageResolver} from '../src/ashen-reach/combat/damage-resolver.js';
import {createEventTimeline,COMBAT_PHASE} from '../src/ashen-reach/combat/event-timeline.js';
import {createActionScheduler} from '../src/ashen-reach/combat/action-scheduler.js';
import {createProgression} from '../src/ashen-reach/progression.js';
function fixture(hp=1000){
 const target={id:'dummy',generation:1,hp,hpMax:hp,position:{x:0,y:0,z:0},hostile:true};
 const hits=[],kills=[];let sourceAlive=true;
 const damage=createDamageResolver({getTarget:id=>id===target.id?target:null,onHit:(t,e)=>hits.push(e),onKill:(t,e)=>kills.push(e)});
 const auras=createAuraStore({getTarget:id=>id===target.id?target:null,isSourceAlive:()=>sourceAlive,
  onTick:(a,e)=>damage.resolve({...e,targetId:a.targetId,targetGeneration:a.targetGeneration,amount:a.amount,abilityId:a.effectId,flags:['periodic']})});
 const timeline=createEventTimeline();
 return {target,damage,auras,timeline,hits,kills,killSource(){sourceAlive=false;},
  apply:(time,extra={})=>auras.apply({targetId:target.id,targetGeneration:target.generation,time,...extra}),
  step(now){auras.schedule(now,timeline);timeline.drain(now);auras.expire(now);}};
}
test('Brand deals exactly six complete ticks at 30/60/144Hz, including a 120ms hitch',()=>{
 for(const hz of [30,60,144]){const f=fixture();f.apply(0);let time=0,hitched=false;while(time<12.2){const hitch=!hitched&&time>=5;if(hitch)hitched=true;time+=hitch?.12:1/hz;f.step(time);}assert(hitched);assert.equal(f.hits.length,6);assert.equal(f.target.hp,910);assert.equal(f.auras.size,0);assert.deepEqual(f.hits.map(h=>h.time),[2,4,6,8,10,12]);}
});
test('refresh carries at most 30%, keeps cadence, snapshots new multiplier and has no fractional expiry tick',()=>{
 const f=fixture();f.apply(0);f.step(9);const refreshed=f.apply(9,{multiplier:2}).aura;
 assert.equal(refreshed.expiresAt,24);assert.equal(refreshed.nextTickAt,10);f.step(24);assert.equal(f.hits.length,12);assert.equal(f.target.hp,1000-4*15-8*30);
 const early=fixture();early.apply(0);assert.equal(early.apply(1).aura.expiresAt,16.6);early.step(16.6);assert.equal(early.hits.length,8);assert.equal(early.auras.size,0);
});
test('expired reapplication is a new aura; different casters remain independent',()=>{
 const f=fixture();const old=f.apply(0).aura;f.step(12);const next=f.apply(13).aura;assert.notEqual(next.id,old.id);assert.equal(next.nextTickAt,15);
 f.apply(13,{sourceId:'other'});f.step(15);assert.equal(f.hits.length,8);assert.equal(f.auras.size,2);
});
test('death, generation reuse, leash return and source death suppress pending ticks',()=>{
 for(const invalidate of [f=>f.target.hp=0,f=>f.target.generation++,f=>f.target.state='return',f=>f.killSource()]){
  const f=fixture();f.apply(0);f.auras.schedule(2,f.timeline);invalidate(f);f.timeline.drain(2);f.auras.expire(2);assert.equal(f.hits.length,0);assert.equal(f.auras.size,0);
 }
});
test('periodic and direct impacts resolve lethal target once; reused actor rejects old IDs',()=>{
 const f=fixture(15);f.apply(0);f.auras.schedule(2,f.timeline);
 f.timeline.add(2,COMBAT_PHASE.impact,()=>f.damage.resolve({eventId:'direct',targetId:'dummy',targetGeneration:1,amount:100,time:2}));f.timeline.drain(2);
 assert.equal(f.kills.length,1);assert.equal(f.hits.length,1);assert.equal(f.hits[0].abilityId,'ashen-brand');
 f.target.hp=100;f.target.generation=2;assert.equal(f.damage.resolve({targetId:'dummy',targetGeneration:1,amount:15}).ok,false);
 assert.equal(f.damage.resolve({eventId:'new',targetId:'dummy',targetGeneration:2,amount:100}).ok,true);assert.equal(f.kills.length,2);
});
test('deadline order: earlier timestamp first; same-time periodic precedes release/contact/impact/expiry',()=>{
 const q=createEventTimeline(),order=[];
 for(const [label,phase] of Object.entries(COMBAT_PHASE).reverse())q.add(1,phase,()=>order.push(label));
 q.add(.9,COMBAT_PHASE.impact,()=>order.push('earlier'));q.drain(1);
 assert.deepEqual(order,['earlier','interrupt','periodic','release','contact','impact','expiry']);
});
test('periodic death before cast release cancels rather than spending reserved mana',()=>{
 const f=fixture(15);let mana=100;
 const s=createActionScheduler({definitions:{cast:{id:'cast',targeted:true,castTime:2,cost:12,cooldown:3,gcd:1.5}},getTarget:()=>f.target,resource:{get:()=>mana,spend:n=>mana-=n}});
 f.apply(0);s.request({abilityId:'cast',targetId:'dummy'});f.auras.schedule(2,f.timeline);
 f.timeline.add(2,COMBAT_PHASE.release,()=>s.advance(2,{drainQueue:false}));f.timeline.drain(2);assert.equal(s.active,null);assert.equal(mana,100);assert.equal(s.reserved,0);
});
test('mana regenerates in combat, out of combat stays separately tuned, cap never overflows',()=>{
 const p=createProgression();p.progress.mana=0;p.regenMana(.12,true,4);assert.equal(p.progress.mana,.72);
 p.regenMana(1,false,4);assert.equal(p.progress.mana,4.72);p.regenMana(100,true,4);assert.equal(p.progress.mana,100);
 assert.equal(p.spendMana(1),true);assert.equal(p.progress.mana,100);
});

test('expiry just before the final deadline cannot discard the scheduled tick',()=>{
 const f=fixture();f.apply(0);f.step(12-1e-10);assert.equal(f.hits.length,5);assert.equal(f.auras.size,1);
 f.step(12);assert.equal(f.hits.length,6);assert.equal(f.auras.size,0);
});
test('one lethal generation rejects resurrected HP until the generation changes',()=>{
 const f=fixture(10);assert(f.damage.resolve({targetId:'dummy',targetGeneration:1,amount:10}).ok);
 f.target.hp=10;assert.equal(f.damage.resolve({targetId:'dummy',targetGeneration:1,amount:10}).ok,false);
 f.target.generation++;assert(f.damage.resolve({targetId:'dummy',targetGeneration:2,amount:10}).ok);assert.equal(f.kills.length,2);
});

test('fractional application times retain all six ticks without executing future deadlines',()=>{
 for(let i=0;i<1000;i++){const f=fixture(),start=i*.019317;f.apply(start);f.step(start+12-1e-9);assert.equal(f.hits.length,5);f.step(start+12);assert.equal(f.hits.length,6);assert.equal(f.auras.size,0);}
});
