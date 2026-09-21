import test from 'node:test';import assert from 'node:assert/strict';
import {advanceGaitPhase,gaitTime,landingWeight,wrapPhase} from '../src/character/runtime/gait-phase.js';
test('different-duration clips share a contact phase for minutes of diagonal travel',()=>{
 let phase=.17;
 for(let frame=0;frame<20000;frame++){
  phase=advanceGaitPhase(phase,1/144,1.73);
  for(const [duration,contact]of [[1.333333,.233333],[.933333,.983333],[.666667,.175]]){
   const t=gaitTime(phase,duration,contact);assert.ok(t>=0&&t<duration);
   const recovered=wrapPhase(t/duration-contact);
   assert.ok(Math.abs(recovered-phase)<1e-10||Math.abs(recovered-phase)>1-1e-10);
  }
 }
});
test('airborne presentation ignores slope-supported grounded motion',async()=>{
 const {shouldAnimateAirborne}=await import('../src/character/runtime/airborne.js');
 assert.equal(shouldAnimateAirborne({grounded:true,jumpInFlight:false,airTime:0}),false);
 assert.equal(shouldAnimateAirborne({grounded:true,jumpInFlight:true,airTime:0.2,vy:0.76}),false);
 assert.equal(shouldAnimateAirborne({grounded:false,jumpInFlight:true,airTime:0}),true);
 assert.equal(shouldAnimateAirborne({grounded:false,jumpInFlight:false,airTime:0.04}),false);
 assert.equal(shouldAnimateAirborne({grounded:false,jumpInFlight:false,airTime:0.08}),true);
});
test('clock preserves phase at rest and wraps across changing cadences',()=>{
 assert.ok(Math.abs(advanceGaitPhase(.6,.1,0)-.6)<1e-12);
 assert.ok(Math.abs(advanceGaitPhase(.9,.1,2)-.1)<1e-12);
 assert.ok(Math.abs(advanceGaitPhase(.3,-1,2)-.3)<1e-12);
});
test('landing weight ramps into a bounded authored impact and fully releases',()=>{
 for(const peak of [.23,.4]){
  assert.equal(landingWeight(0,.42,peak),0);
  assert.equal(landingWeight(.05,.42,peak),peak);
  assert.equal(landingWeight(.42,.42,peak),0);
  for(let t=0;t<.5;t+=.001){const w=landingWeight(t,.42,peak);assert.ok(w>=0&&w<=peak);assert.ok(Math.abs((1-w)+w-1)<1e-12);}
 }
});
