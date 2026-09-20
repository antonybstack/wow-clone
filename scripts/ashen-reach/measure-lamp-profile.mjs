#!/usr/bin/env node
// M7a instrumentation: sample the baked per-vertex lamp irradiance term along the street centre
// line, reproducing exactly the light list scene.js registers and exactly the sum formula
// Batch.commit bakes into uv2 (geometry.js). This script imports the REAL height()/pathX()/rng()
// from geometry.js so ground height and the rng stream are bit-identical to the real build; only
// the light-list construction lines (positions/strengths/falloffs/radii) are transcribed from
// scene.js (mesh-building code that would otherwise require a live engine is not needed to
// compute the bake). Prints BOTH the pre-M7a unwindowed profile and the post-M7a windowed profile
// (Batch.commit's actual formula, radius included) side by side.
//
// Usage: node scripts/ashen-reach/measure-lamp-profile.mjs
import {height, pathX, rng} from '../../src/ashen-reach/geometry.js';

// --- Exact transcription of scene.js's current (post-M7a) light registration ---
function buildLights(){
 const lights=[{position:[-3.4,2.5,12.0],strength:.45,falloff:.5},{position:[3.6,2.7,14.0],strength:.4,falloff:.5}];
 const randomNorth=rng(50021),rn=(a,b)=>a+randomNorth()*(b-a);
 function streetLamp(x,z,strength=.68){
  const y=height(x,z);
  const p=[x,y+2.62,z];
  lights.push({position:p,strength,falloff:.42,radius:9});
  lights.push({position:[x,y+.18,z],strength:1.0,falloff:.62,radius:5});
 }
 function lychGate(z){
  const x=pathX(z),y=height(x,z),postH=2.3,ridgeY=y+postH+.85;
  lights.push({position:[x,ridgeY-.1,z],strength:.65,falloff:.42,radius:9});
  lights.push({position:[x,y+.18,z],strength:1.1,falloff:.55,radius:6.5});
 }
 lychGate(44);
 for(const [z,side] of [[50,-1],[58,1],[66,-1]])streetLamp(pathX(z)+side*2.8+rn(-.2,.2),z,.68);
 function townGate(z){
  const x=pathX(z),gateHalf=2.6,towerW=3.6,towerH=9;
  for(const side of [-1,1]){
   const tx=x+side*(gateHalf+towerW/2),ty=height(tx,z);
   lights.push({position:[tx,ty+towerH*.55,z],strength:1.0,falloff:.32,radius:14});
   lights.push({position:[tx,ty+towerH*.55,z],strength:.6,falloff:.15,radius:30});
  }
 }
 townGate(75);
 for(const [z,side] of [[84,1],[94,-1],[104,1],[114,-1],[124,1],[134,-1]])streetLamp(pathX(z)+side*3.4+rn(-.2,.2),z,.68);
 return lights;
}

// --- Exact transcription of Batch.commit's per-vertex bake formula, both branches ---
function lampAtUnwindowed(x,y,z,lights){
 let lamp=0;
 for(const L of lights){
  const dx=x-L.position[0],dy=y-L.position[1],dz=z-L.position[2],f=(L.falloff??.5);
  const d=Math.sqrt(dx*dx+dy*dy+dz*dz)*f;
  lamp+=L.strength/(1+d*d);
 }
 return lamp;
}
function lampAtWindowed(x,y,z,lights){
 // Mirrors Batch.commit exactly: `windowed` is z>40 (always true for the z=44..120 samples below,
 // since that is the whole point -- this is the branch Hollowmere's ground actually bakes through).
 const windowed=z>40;
 let lamp=0;
 for(const L of lights){
  const dx=x-L.position[0],dy=y-L.position[1],dz=z-L.position[2],f=(L.falloff??.5),dist=Math.sqrt(dx*dx+dy*dy+dz*dz),d=dist*f;
  let term=L.strength/(1+d*d);
  if(windowed&&L.radius!=null){const t=Math.min(1,dist/L.radius),w=(1-t*t)*(1-t*t);term*=w;}
  lamp+=term;
 }
 return lamp;
}

const lights=buildLights();
console.log(`registered ${lights.length} lights`);

const samples=[];
for(let z=44;z<=120;z+=0.5){
 const x=pathX(z),y=height(x,z);
 samples.push({z,before:lampAtUnwindowed(x,y,z,lights),after:lampAtWindowed(x,y,z,lights)});
}

console.log('z\tbefore\tafter');
for(const s of samples)console.log(`${s.z.toFixed(1)}\t${s.before.toFixed(4)}\t${s.after.toFixed(4)}`);

function stats(vals){const peak=Math.max(...vals),trough=Math.min(...vals);return {peak,trough,ratio:peak/trough};}
const bStats=stats(samples.map(s=>s.before)),aStats=stats(samples.map(s=>s.after));
console.log(`\nBEFORE (unwindowed, pre-M7a): peak=${bStats.peak.toFixed(4)} trough=${bStats.trough.toFixed(4)} global peak:trough=${bStats.ratio.toFixed(3)}`);
console.log(`AFTER  (windowed, post-M7a): peak=${aStats.peak.toFixed(4)} trough=${aStats.trough.toFixed(4)} global peak:trough=${aStats.ratio.toFixed(3)}`);

// Fixture-to-fixture local peak/trough, before and after -- this is the number that actually
// determines whether a wide shot reads as discrete pools (the global peak:trough above is
// dominated by extremes and can be misleading).
const fixtureZ=[44,50,58,66,75,84,94,104,114,124,134];
console.log('\nfixture-to-fixture local peak/trough (before -> after):');
for(let i=0;i<fixtureZ.length-1;i++){
 const z0=fixtureZ[i],z1=fixtureZ[i+1],mid=(z0+z1)/2;
 const near=(target)=>samples.reduce((a,b)=>Math.abs(b.z-target)<Math.abs(a.z-target)?b:a);
 const pk=near(z0),tr=near(mid);
 const rBefore=pk.before/tr.before,rAfter=pk.after/tr.after;
 console.log(`  z=${z0}->${z1}: peak@${pk.z} trough@${tr.z}  before=${pk.before.toFixed(3)}/${tr.before.toFixed(3)}=${rBefore.toFixed(2)}x   after=${pk.after.toFixed(3)}/${tr.after.toFixed(3)}=${rAfter.toFixed(2)}x`);
}

// Per-light contribution breakdown at a representative mid-corridor trough (z=99.5), after windowing.
const bz=99.5,bx=pathX(bz),by=height(bx,bz);
const windowed=bz>40;
const contribs=lights.map(L=>{
 const dx=bx-L.position[0],dy=by-L.position[1],dz=bz-L.position[2],f=(L.falloff??.5),dist=Math.sqrt(dx*dx+dy*dy+dz*dz),d=dist*f;
 let term=L.strength/(1+d*d);const before=term;
 if(windowed&&L.radius!=null){const t=Math.min(1,dist/L.radius),w=(1-t*t)*(1-t*t);term*=w;}
 return {L,dist,before,after:term};
}).sort((a,b)=>b.after-a.after);
const totalAfter=lampAtWindowed(bx,by,bz,lights);
console.log(`\nper-light contribution at trough z=${bz} AFTER windowing (total lamp=${totalAfter.toFixed(4)}, was ${lampAtUnwindowed(bx,by,bz,lights).toFixed(4)} before):`);
for(const c of contribs.slice(0,8))console.log(`  pos=[${c.L.position.map(v=>v.toFixed(1))}] falloff=${c.L.falloff} radius=${c.L.radius??'none'} dist=${c.dist.toFixed(1)}m  before=${c.before.toFixed(4)} after=${c.after.toFixed(4)}`);
