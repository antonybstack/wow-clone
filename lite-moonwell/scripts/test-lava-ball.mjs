import test from 'node:test';import assert from 'node:assert/strict';
import {LavaBall,LAVA_BALL} from '../src/spells/lava-ball.js';
import {FireBlast} from '../src/spells/fire-blast.js';
const fixture=()=>({target:{id:'dummy',position:{x:0,y:0,z:8},hp:600,hpMax:600},position:{x:0,y:1.1,z:0},grounded:true});
const clear=()=>({hasHit:false});
test('lava release reserves cooldown but does not apply damage before impact',()=>{
 const s=new LavaBall(),a=fixture();assert.ok(s.release(a,a.position).ok);assert.equal(a.target.hp,600);assert.equal(s.cooldown,6);assert.equal(s.casts,1);
 assert.equal(s.advance(.2,clear),null);assert.equal(a.target.hp,600);
 const result=s.advance(1,clear);assert.equal(result.damage,240);assert.equal(a.target.hp,360);assert.equal(s.flight,null);assert.equal(s.advance(1,clear),null);
});
test('swept collision prevents tunnelling across a wall even on a long frame',()=>{
 const s=new LavaBall(),a=fixture();s.release(a,a.position);let segment;
 const result=s.advance(1,(from,to)=>{segment=[from,to];return {hasHit:true,hitPoint:{x:0,y:1.1,z:3},body:{node:{metadata:{colliderId:'wall'}}}};});
 assert.equal(result.ok,false);assert.equal(result.position.z,3);assert.equal(a.target.hp,600);assert.equal(segment[0].z,0);assert.equal(segment[1].z,8);assert.equal(s.flight,null);
});
test('target collider contact applies one hit before reaching the target centre',()=>{
 const s=new LavaBall(),a=fixture();s.release(a,a.position);
 const hit=s.advance(.6,()=>({hasHit:true,hitPoint:{x:0,y:1.1,z:7.8},body:{node:{metadata:{colliderId:'dummy'}}}}));
 assert.equal(hit.damage,240);assert.equal(hit.position.z,7.8);assert.equal(a.target.hits,1);assert.equal(s.advance(1,clear),null);
});
test('invalid release consumes neither health nor cooldown',()=>{
 for(const override of [{target:null},{grounded:false},{position:{x:0,y:1,z:-17}},{hasLineOfSight:()=>false}]){
  const s=new LavaBall(),a={...fixture(),...override};assert.equal(s.release(a,a.position).ok,false);assert.equal(s.casts,0);assert.equal(s.cooldown,0);assert.equal(s.flight,null);
 }
});
test('missing physics data terminates the projectile without damage',()=>{
 const s=new LavaBall(),a=fixture();s.release(a,a.position);assert.equal(s.advance(.1,()=>null).ok,false);assert.equal(a.target.hp,600);assert.equal(s.flight,null);
});
test('projectile keeps its launch trajectory when caster or target moves',()=>{
 const s=new LavaBall(),a=fixture();s.release(a,a.position);a.position.x=20;a.target.position.x=10;
 const result=s.advance(1,clear);assert.equal(result.ok,false);assert.equal(result.position.x,0);assert.equal(a.target.hp,600);
});
test('fire and lava share target health, with one recovery from a lethal impact',()=>{
 const fire=new FireBlast(),lava=new LavaBall(),a=fixture();a.target.hp=250;
 fire.cast(a);lava.release(a,a.position);assert.equal(lava.advance(1,clear).damage,130);assert.equal(a.target.hp,0);
 fire.update(3.1);assert.equal(a.target.hp,0);lava.update(3.1);assert.equal(a.target.hp,600);fire.update(5);lava.update(5);assert.equal(a.target.hp,600);
});
test('lava cooldown prevents a duplicate launch and damage clamps at zero',()=>{
 const s=new LavaBall(),a=fixture();a.target.hp=40;s.release(a,a.position);assert.equal(s.release(a,a.position).ok,false);assert.equal(s.advance(1,clear).damage,40);assert.equal(a.target.hp,0);assert.equal(s.casts,1);assert.equal(LAVA_BALL.castTime,1.5);
});
