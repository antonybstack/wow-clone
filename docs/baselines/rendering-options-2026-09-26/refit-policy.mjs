// Probe the installed 1.31.1 implementation, not an application replacement.
// https://github.com/BabylonJS/Babylon-Lite/pull/701
import assert from 'node:assert/strict';
import {createCsmRefitGate,createCsmStaticRefitScheduler} from '../../../node_modules/@babylonjs/lite/lib/shadow/csm-refit-gate.js';
const gate=createCsmRefitGate({refitAngle:.01,refitMaxIntervalMs:0,demoteQuietFrames:2});
const caster={worldMatrixVersion:0};gate.syncCasters([caster]);
const scheduler=createCsmStaticRefitScheduler(3,1), rows=[];
for(const [label,t,x,cameraChanged] of [['initial',0,0,false],['quiet',1,0,false],['quietDemotion',2,0,false],['stable',3,0,false],['camera',4,0,true],['sunDrift',5,.1,false]]){
 const decision=gate.update(x,-1,0,t,cameraChanged,false,()=>{},()=>{});
 if(decision.refit)scheduler.arm(gate._lastRefitDriftOnly());
 rows.push({label,...decision,driftOnly:gate._lastRefitDriftOnly(),layersThisFrame:[...scheduler.take()],remaining:scheduler.pending()});
}
assert.deepEqual(rows.find(r=>r.label==='camera').layersThisFrame,[0,1,2]);
assert.deepEqual(rows.find(r=>r.label==='sunDrift').layersThisFrame,[0]);
assert.equal(rows.find(r=>r.label==='stable').refit,false);
console.log(JSON.stringify(rows,null,2));
