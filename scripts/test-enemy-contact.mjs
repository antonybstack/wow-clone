import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
// Replace only asset construction, which these contact tests never call.
registerHooks({resolve(specifier, context, next) {
 if (specifier.endsWith('/character/npc.js')) return {url:'data:text/javascript,export const attachAnimatedHuman=()=>{};export const prefetchNpcBuffer=()=>{};',shortCircuit:true};
 return next(specifier, context);
}});
const {updateEnemies,ENEMY_TUNING,syncDiagnosticEnemy}=await import('../src/ashen-reach/enemies.js');
function fixture(){
 const enemy={id:'shade',position:{x:0,y:0,z:0},spawn:{x:0,z:0},state:'attack',stateAge:0,attackCooldown:0,attackWindup:null,hp:360,hpMax:360,yaw:0,diagnosticFloorY:0,root:{position:{set(){}},rotation:{set(){}}}};
 const events=[],hits=[];
 const ctx={player:{body:{position:{x:0,y:.9,z:2}},capsuleHeight:1.8},world:{colliders:[]},raycast:()=>({hasHit:false}),playerDead:false,onPlayerHit:n=>hits.push(n),onCombatEvent:(type,e,detail)=>events.push({type,...detail})};
 return {enemy,ctx,events,hits,step:dt=>updateEnemies([enemy],dt,ctx)};
}
test('enemy damage occurs once at contact after a visible windup',()=>{
 const f=fixture();f.step(.01);assert.equal(f.hits.length,0);assert.equal(f.events[0].type,'enemy-windup');
 f.step(.3);assert.equal(f.hits.length,0);f.step(.3);assert.deepEqual(f.hits,[ENEMY_TUNING.attackDamage]);f.step(.1);assert.equal(f.hits.length,1);
});
test('contact revalidates wall, vertical floor and range; unavailable collision fails closed',()=>{
 for(const breakContact of [f=>f.ctx.raycast=()=>null,f=>f.ctx.raycast=()=>({hasHit:true,hitDistance:.5}),f=>f.ctx.player.body.position.y=5,f=>f.ctx.player.body.position.z=3]){
  const f=fixture();f.step(.01);breakContact(f);f.step(.6);assert.equal(f.hits.length,0);
 }
});
test('death during enemy windup cancels the hit',()=>{
 const f=fixture();f.step(.01);f.enemy.hp=0;f.step(.6);assert.equal(f.hits.length,0);assert.equal(f.enemy.attackWindup,null);
});

test('diagnostic restore cancels a pending punch rather than hitting from idle',()=>{
 const f=fixture();f.step(.01);assert(f.enemy.attackWindup>0);syncDiagnosticEnemy(f.enemy);assert.equal(f.enemy.attackWindup,null);f.step(.6);assert.equal(f.hits.length,0);
});
test('player death during a windup cancels contact',()=>{
 const f=fixture();f.step(.01);f.ctx.playerDead=true;f.step(.6);assert.equal(f.hits.length,0);assert.equal(f.enemy.attackWindup,null);
});
