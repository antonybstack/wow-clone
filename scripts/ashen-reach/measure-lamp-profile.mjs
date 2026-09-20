#!/usr/bin/env node
// M7a instrumentation: sample the baked per-vertex lamp irradiance term along the street centre
// line, reproducing exactly the light list scene.js registers and exactly the sum formula
// Batch.commit bakes into uv2 (geometry.js). This script imports the REAL height()/pathX()/rng()
// from geometry.js so ground height and the rng stream are bit-identical to the real build; only
// the light-list construction lines are transcribed from scene.js (mesh-building code that would
// otherwise require a live engine is not needed to compute the bake).
//
// Usage: node scripts/ashen-reach/measure-lamp-profile.mjs
import {height, pathX, rng} from '../../src/ashen-reach/geometry.js';

// --- Exact transcription of scene.js's light registration (positions, strengths, falloffs) ---
function buildLights(){
 const lights=[{position:[-3.4,2.5,12.0],strength:.45,falloff:.5},{position:[3.6,2.7,14.0],strength:.4,falloff:.5}];
 const randomNorth=rng(50021),rn=(a,b)=>a+randomNorth()*(b-a);
 function streetLamp(x,z,strength=.68){
  const y=height(x,z);
  const p=[x,y+2.62,z];
  lights.push({position:p,strength,falloff:.42});
  lights.push({position:[x,y+.18,z],strength:1.0,falloff:.62});
 }
 function lychGate(z){
  const x=pathX(z),y=height(x,z),postH=2.3,ridgeY=y+postH+.85;
  lights.push({position:[x,ridgeY-.1,z],strength:.65,falloff:.42});
  lights.push({position:[x,y+.18,z],strength:1.1,falloff:.55});
 }
 lychGate(44);
 for(const [z,side] of [[50,-1],[58,1],[66,-1]])streetLamp(pathX(z)+side*2.8+rn(-.2,.2),z,.68);
 function townGate(z){
  const x=pathX(z),gateHalf=2.6,towerW=3.6,towerH=9;
  for(const side of [-1,1]){
   const tx=x+side*(gateHalf+towerW/2),ty=height(tx,z);
   lights.push({position:[tx,ty+towerH*.55,z],strength:1.0,falloff:.32});
   lights.push({position:[tx,ty+towerH*.55,z],strength:.6,falloff:.15});
  }
 }
 townGate(75);
 for(const [z,side] of [[84,1],[94,-1],[104,1],[114,-1],[124,1],[134,-1]])streetLamp(pathX(z)+side*3.4+rn(-.2,.2),z,.68);
 return lights;
}

// --- Exact transcription of Batch.commit's per-vertex bake formula (geometry.js) ---
function lampAt(x,y,z,lights){
 let lamp=0;
 for(const L of lights){
  const dx=x-L.position[0],dy=y-L.position[1],dz=z-L.position[2],f=(L.falloff??.5);
  const d=Math.sqrt(dx*dx+dy*dy+dz*dz)*f;
  lamp+=L.strength/(1+d*d);
 }
 return lamp;
}

const lights=buildLights();
console.log(`registered ${lights.length} lights`);

const samples=[];
for(let z=44;z<=120;z+=0.5){
 const x=pathX(z),y=height(x,z);
 const lamp=lampAt(x,y,z,lights);
 samples.push({z,lamp});
}

// Find local peaks/troughs
console.log('z\tlamp');
for(const s of samples)console.log(`${s.z.toFixed(1)}\t${s.lamp.toFixed(4)}`);

const lampVals=samples.map(s=>s.lamp);
const peak=Math.max(...lampVals);
const trough=Math.min(...lampVals);
console.log(`\npeak=${peak.toFixed(4)} trough=${trough.toFixed(4)} peak:trough=${(peak/trough).toFixed(3)}`);

// Also report per-lamp local peak/trough pairs: for each streetLamp/lychGate/townGate z, find the
// nearest sample as "peak", and the sample at the midpoint to the next fixture as "trough".
const fixtureZ=[44,50,58,66,75,84,94,104,114,124,134];
console.log('\nfixture-to-fixture local peak/trough:');
for(let i=0;i<fixtureZ.length-1;i++){
 const z0=fixtureZ[i],z1=fixtureZ[i+1],mid=(z0+z1)/2;
 const near=(target)=>samples.reduce((a,b)=>Math.abs(b.z-target)<Math.abs(a.z-target)?b:a);
 const pk=near(z0),tr=near(mid);
 console.log(`  z=${z0}->${z1}: peak@${pk.z}=${pk.lamp.toFixed(4)} trough@${tr.z}=${tr.lamp.toFixed(4)} ratio=${(pk.lamp/tr.lamp).toFixed(3)}`);
}

// Per-light contribution breakdown at a representative mid-corridor trough (z=99.5, between the
// z=94 and z=104 streetLamps, far from both the lych-gate and the town gate) -- which lights make
// up the pedestal there: the two nearest lamps' own tails, or the wide gate-tower halo, or the
// distant lych-gate/other-lamp tails piling up.
const bz=99.5,bx=pathX(bz),by=height(bx,bz);
const contribs=lights.map(L=>{
 const dx=bx-L.position[0],dy=by-L.position[1],dz=bz-L.position[2],f=(L.falloff??.5);
 const d=Math.sqrt(dx*dx+dy*dy+dz*dz)*f;
 return {L,dist:Math.sqrt(dx*dx+dy*dy+dz*dz),term:L.strength/(1+d*d)};
}).sort((a,b)=>b.term-a.term);
console.log(`\nper-light contribution at trough z=${bz} (total lamp=${lampAt(bx,by,bz,lights).toFixed(4)}):`);
for(const c of contribs)console.log(`  pos=[${c.L.position.map(v=>v.toFixed(1))}] strength=${c.L.strength} falloff=${c.L.falloff} dist=${c.dist.toFixed(1)}m term=${c.term.toFixed(4)} (${(100*c.term/lampAt(bx,by,bz,lights)).toFixed(1)}%)`);
