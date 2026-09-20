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
import {height, pathX, rng, buildingPads, bakeLamp} from '../../src/ashen-reach/geometry.js';

// Corridor lights transcribed from scene.js. Strengths are parameterised so this file can
// print the frozen pre-M7a / M7a columns next to the live M8b list without the before-column
// drifting whenever a strength is retuned (that was a real M8b trap: applyWindow=false on the
// *current* list is not the pre-M7a world).
function buildCorridorLights({head=.82,pool=1.70,lychA=.80,lychP=1.49,gate=1.20,halo=.6}={}){
 const lights=[{position:[-3.4,2.5,12.0],strength:.45,falloff:.5},{position:[3.6,2.7,14.0],strength:.4,falloff:.5}];
 const randomNorth=rng(50021),rn=(a,b)=>a+randomNorth()*(b-a);
 function streetLamp(x,z){
  const y=height(x,z);
  lights.push({position:[x,y+2.62,z],strength:head,falloff:.42,radius:9});
  lights.push({position:[x,y+.18,z],strength:pool,falloff:.62,radius:5});
 }
 function lychGate(z){
  const x=pathX(z),y=height(x,z),postH=2.3,ridgeY=y+postH+.85;
  lights.push({position:[x,ridgeY-.1,z],strength:lychA,falloff:.42,radius:9});
  lights.push({position:[x,y+.18,z],strength:lychP,falloff:.55,radius:6.5});
 }
 lychGate(44);
 for(const [z,side] of [[50,-1],[58,1],[66,-1]])streetLamp(pathX(z)+side*2.8+rn(-.2,.2),z);
 function townGate(z){
  const x=pathX(z),gateHalf=2.6,towerW=3.6,towerH=9;
  for(const side of [-1,1]){
   const tx=x+side*(gateHalf+towerW/2),ty=height(tx,z);
   lights.push({position:[tx,ty+towerH*.55,z],strength:gate,falloff:.32,radius:14});
   lights.push({position:[tx,ty+towerH*.55,z],strength:halo,falloff:.15,radius:30});
  }
 }
 townGate(75);
 for(const [z,side] of [[84,1],[94,-1],[104,1],[114,-1],[124,1],[134,-1]])streetLamp(pathX(z)+side*3.4+rn(-.2,.2),z);
 return lights;
}
const LIGHTS_M7A={head:.68,pool:1.0,lychA:.65,lychP:1.1,gate:1.0,halo:.6};

// Bake formula is imported from geometry.js (the function Batch.commit actually runs). The
// before-column still forces applyWindow=false so it reports the pre-M7a unwindowed sum.
function lampAtUnwindowed(x,y,z,lights){return bakeLamp(x,y,z,lights,false);}
function lampAtWindowed(x,y,z,lights){return bakeLamp(x,y,z,lights,true);}

// materials.js fragment knee, transcribed because the shader string is not a callable. Identity
// below 1.4, 1.4+(1-exp(-(lamp-1.4))) above, mixed by lampGate=smoothstep(40,55,z).
function smoothstep(e0,e1,x){const t=Math.min(1,Math.max(0,(x-e0)/(e1-e0)));return t*t*(3-2*t);}
function lampKnee(lamp){return lamp>1.4?1.4+(1-Math.exp(-(lamp-1.4))):lamp;}
function lampEff(lamp,z){const g=smoothstep(40,55,z);return lamp*(1-g)+lampKnee(lamp)*g;}

const lightsM7a=buildCorridorLights(LIGHTS_M7A);
const lights=buildCorridorLights();
console.log(`registered ${lights.length} lights (M7a list ${lightsM7a.length})`);

// Swept to z=142.5 (the last 0.5m-aligned sample inside scene.js's `inLampCorridor` bound
// `z>=40&&z<143`), not z=120: the original 44-120 sweep stopped short of the last two street
// lamps (z=124, z=134) and the tail of corridor beyond them, which is exactly the region the
// diagnosis was most concerned about -- the town-gate halo's tail and the cumulative sum of many
// small lights were the two effects furthest from any single fixture, so the segments nearest the
// end of the corridor are the ones that most stress-test whether the window actually kills them.
const samples=[];
for(let z=44;z<=142.5;z+=0.5){
 const x=pathX(z),y=height(x,z);
 samples.push({
  z,
  before:lampAtUnwindowed(x,y,z,lightsM7a),
  m7a:lampAtWindowed(x,y,z,lightsM7a),
  after:lampAtWindowed(x,y,z,lights),
 });
}

console.log('z\tpre-M7a\tM7a\tM8b');
for(const s of samples)console.log(`${s.z.toFixed(1)}\t${s.before.toFixed(4)}\t${s.m7a.toFixed(4)}\t${s.after.toFixed(4)}`);

function stats(vals){const peak=Math.max(...vals),trough=Math.min(...vals);return {peak,trough,ratio:peak/trough};}
const bStats=stats(samples.map(s=>s.before)),mStats=stats(samples.map(s=>s.m7a)),aStats=stats(samples.map(s=>s.after));
console.log(`\nPRE-M7A (unwindowed, original strengths): peak=${bStats.peak.toFixed(4)} trough=${bStats.trough.toFixed(4)} global peak:trough=${bStats.ratio.toFixed(3)}`);
console.log(`M7A     (windowed, original strengths):  peak=${mStats.peak.toFixed(4)} trough=${mStats.trough.toFixed(4)} global peak:trough=${mStats.ratio.toFixed(3)}`);
console.log(`M8B     (windowed, re-leveled strengths): peak=${aStats.peak.toFixed(4)} trough=${aStats.trough.toFixed(4)} global peak:trough=${aStats.ratio.toFixed(3)}`);

// M8b: is the 19% peak drop the window, the materials.js knee (max 2.4), or both?
const peakBefore=samples.reduce((a,b)=>b.before>a.before?b:a);
const peakAfter=samples.reduce((a,b)=>b.after>a.after?b:a);
const nBeforeAbove=samples.filter(s=>s.before>1.4).length;
const nAfterAbove=samples.filter(s=>s.after>1.4).length;
const effBefore=samples.map(s=>lampEff(s.before,s.z));
const effAfter=samples.map(s=>lampEff(s.after,s.z));
const eB=stats(effBefore),eA=stats(effAfter);
const peakM7a=samples.reduce((a,b)=>b.m7a>a.m7a?b:a);
console.log('\n--- M8b knee vs window ---');
console.log(`baked peak: pre-M7a z=${peakBefore.z.toFixed(1)} ${peakBefore.before.toFixed(4)}  M7a z=${peakM7a.z.toFixed(1)} ${peakM7a.m7a.toFixed(4)} (${((1-peakM7a.m7a/peakBefore.before)*100).toFixed(1)}% drop)  M8b z=${peakAfter.z.toFixed(1)} ${peakAfter.after.toFixed(4)}`);
console.log(`samples with baked lamp>1.4 (knee engages): before=${nBeforeAbove}/${samples.length}  after=${nAfterAbove}/${samples.length}`);
console.log(`shader lampEff (knee mixed by lampGate): before peak=${eB.peak.toFixed(4)} trough=${eB.trough.toFixed(4)}  after peak=${eA.peak.toFixed(4)} trough=${eA.trough.toFixed(4)}`);
console.log(`at baked-after peak z=${peakAfter.z.toFixed(1)}: lampGate=${smoothstep(40,55,peakAfter.z).toFixed(3)}  baked ${peakAfter.after.toFixed(4)} -> lampEff ${lampEff(peakAfter.after,peakAfter.z).toFixed(4)} (knee would map ${peakAfter.after.toFixed(4)} -> ${lampKnee(peakAfter.after).toFixed(4)})`);
console.log(`at baked-before peak z=${peakBefore.z.toFixed(1)}: lampGate=${smoothstep(40,55,peakBefore.z).toFixed(3)}  baked ${peakBefore.before.toFixed(4)} -> lampEff ${lampEff(peakBefore.before,peakBefore.z).toFixed(4)} (knee ${lampKnee(peakBefore.before).toFixed(4)})`);
const fullKnee=samples.filter(s=>s.z>=55);
const fullBeforeMax=Math.max(...fullKnee.map(s=>s.before));
const fullAfterMax=Math.max(...fullKnee.map(s=>s.after));
console.log(`full-knee region z>=55: baked peak before=${fullBeforeMax.toFixed(4)} after=${fullAfterMax.toFixed(4)}  (knee threshold 1.4; headroom after=${(1.4-fullAfterMax).toFixed(4)})`);

// Fixture-to-fixture local peak/trough, before and after -- this is the number that actually
// determines whether a wide shot reads as discrete pools (the global peak:trough above is
// dominated by extremes and can be misleading).
// 142.5 (the corridor's far edge, not a lamp) is appended so the last row measures the tail past
// the final street lamp (z=134) out to where the corridor ends, instead of stopping at z=134 the
// way the pre-extension sweep implicitly did.
const fixtureZ=[44,50,58,66,75,84,94,104,114,124,134,142.5];
console.log('\nfixture-to-fixture local peak/trough (pre-M7a -> M7a -> M8b):');
for(let i=0;i<fixtureZ.length-1;i++){
 const z0=fixtureZ[i],z1=fixtureZ[i+1],mid=(z0+z1)/2;
 const near=(target)=>samples.reduce((a,b)=>Math.abs(b.z-target)<Math.abs(a.z-target)?b:a);
 const pk=near(z0),tr=near(mid);
 const rBefore=pk.before/tr.before,rM7a=pk.m7a/tr.m7a,rAfter=pk.after/tr.after;
 console.log(`  z=${z0}->${z1}: peak@${pk.z} trough@${tr.z}  pre=${pk.before.toFixed(3)}/${tr.before.toFixed(3)}=${rBefore.toFixed(2)}x   m7a=${pk.m7a.toFixed(3)}/${tr.m7a.toFixed(3)}=${rM7a.toFixed(2)}x   m8b=${pk.after.toFixed(3)}/${tr.after.toFixed(3)}=${rAfter.toFixed(2)}x`);
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

// --- M7a well-square addendum -------------------------------------------------------------
// Does the residual pedestal visible at the well square (ve-capture .../well-square.png,
// changed 43.9% of pixels before/after) come from buildings.js's own lights -- out of this
// milestone's allowed paths, unwindowed, therefore identical before and after -- or from this
// milestone's windowed corridor lights still reaching that far, or both? Settled by combining
// `buildLights()` above (scene.js's corridor lights: churchyard, lych-gate, street lamps, town
// gate) with a transcription of every light buildings.js registers (well, market stalls, house/
// tavern/chapel/watchtower window glow, the tavern's sign lantern, the smithy's forge), evaluated
// at the well-square position with the exact same `lampAtUnwindowed`/`lampAtWindowed` formulas
// used above. Transcribed from buildings.js's `building()`, `windowGlow()`, `well()`,
// `marketStall()` and `forgeGlow()` (local->world `toWorld`/`P` transforms reproduced exactly)
// and from scene.js's actual call sites (lines ~238-273). None of these carry a `radius` -- they
// were never touched by this milestone -- so every one evaluates identically in the before and
// after column below; only the corridor lights (tagged `corridor-windowed` where they carry a
// radius) can differ.
const WEST=0,EAST=Math.PI;
function toWorldFrom(x,z,yaw){const c=Math.cos(yaw),s=Math.sin(yaw);return(lx,ly,lz)=>[x+lx*c+lz*s,ly,z-lx*s+lz*c];}
function windowLights(center,yaw,w,h,side,strength){
 const s=Math.sin(yaw),c=Math.cos(yaw);
 const out=side===0?[c,0,-s]:[s*side,0,c*side];
 const right=side===0?[s,0,c]:[c,0,-s];
 const at=(rx,ry,off=0)=>[center[0]+right[0]*rx+out[0]*off,center[1]+ry,center[2]+right[2]*rx+out[2]*off];
 return [
  {position:at(0,0,.15),strength,falloff:.55,radius:4.5,src:'buildings.js:window'},
  {position:at(0,-h*.9,.5),strength:strength*.7,falloff:.5,radius:3.5,src:'buildings.js:window-spill'},
 ];
}
function buildingLights(spec){
 const {x,z,w,d,yaw=0,wallH=2.6,kind='house',windows=[],upper=false,sign=false,upperH=null}=spec;
 const gy=height(x,z);
 const tw0=toWorldFrom(x,z,yaw);
 const toW=(lx,ly,lz)=>{const p=tw0(lx,ly,lz);return[p[0],gy+p[1],p[2]];};
 const plinthY=.22,lowerTopY=plinthY+wallH;
 const upH=(upper&&kind!=='watchtower')?(upperH??wallH*.5):0;
 const wallTopY=lowerTopY+upH;
 const out=[];
 if(kind==='watchtower'){
  const topY=wallTopY+.12;
  out.push({position:toW(0,topY+.55,0),strength:.85,falloff:.4,radius:10,src:'buildings.js:watchtower-beacon'});
  for(const win of windows){
   const p=toW(win.lx??0,win.ly??wallTopY*0.55,(win.wall??1)*(d/2+.02));
   out.push({position:p,strength:win.strength??.22,falloff:.7,radius:4,src:'buildings.js:watchtower-window'});
  }
 } else {
  for(const win of windows)out.push(...windowLights(toW(win.lx??0,win.ly??(plinthY+wallH*.62),(win.wall??1)*(d/2+.015)),yaw,win.w??.55,win.h??.6,win.wall??1,win.strength??.45));
  for(const lz of [-.95,.95])out.push(...windowLights(toW(w/2+.015,plinthY+wallH*.58,lz),yaw,.40,.50,0,.45));
  const doorH=1.55;
  out.push({position:toW(w/2+.16,plinthY+doorH+.14,0),strength:.42,falloff:.6,radius:3.5,src:'buildings.js:door-lantern'});
  if(sign)out.push({position:toW(w/2+.5,1.95,0),strength:.3,falloff:.65,radius:3.5,src:'buildings.js:sign'});
 }
 return {lights:out, front:toW(w/2+.5,0,0)};
}
function marketStallLights(x,z,yaw=0){
 const gy=height(x,z),s=Math.sin(yaw),c=Math.cos(yaw);
 const P=(lx,ly,lz)=>[x+lx*c+lz*s,gy+ly,z-lx*s+lz*c];
 return [
  {position:P(0,1.67,0),strength:.42,falloff:.55,src:'buildings.js:stall-ambient'},
  {position:P(0,.18,0),strength:.75,falloff:.75,src:'buildings.js:stall-pool'},
 ];
}
function wellLights(x,z){
 const gy=height(x,z),wallH=.6,ridgeY=gy+wallH+2.0;
 return [
  {position:[x,ridgeY-.18,z],strength:.95,falloff:.4,src:'buildings.js:well-ambient'},
  {position:[x,gy+.18,z],strength:1.3,falloff:.55,src:'buildings.js:well-pool'},
 ];
}
function forgeLights(x,z,yaw){
 const gy=height(x,z),s=Math.sin(yaw),c=Math.cos(yaw);
 const P=(lx,ly,lz)=>[x+lx*c+lz*s,gy+ly,z-lx*s+lz*c];
 return [
  {position:P(0,.64,.20),strength:1.3,falloff:.4,radius:6,src:'buildings.js:forge'},
  {position:P(0,.05,.55),strength:.65,falloff:.55,radius:4.5,src:'buildings.js:forge-spill'},
 ];
}
function buildAllBuildingLights(){
 const pads=buildingPads,out=[];
 out.push(...buildingLights({x:pads[0].x,z:pads[0].z,w:6.6,d:6.2,yaw:WEST,wallH:2.4,kind:'house',windows:[{wall:1,w:.55,h:.6},{wall:-1,w:.55,h:.6}]}).lights);
 out.push(...buildingLights({x:pads[1].x,z:pads[1].z,w:6.0,d:6.4,yaw:EAST,wallH:2.6,kind:'house',upper:true,windows:[{wall:1,w:.55,h:.6},{wall:-1,w:.55,h:.6},{wall:1,ly:3.97,w:.42,h:.5},{wall:-1,ly:3.97,w:.42,h:.5}]}).lights);
 out.push(...buildingLights({x:pads[2].x,z:pads[2].z,w:7.6,d:6.6,yaw:WEST,wallH:3.0,kind:'tavern',upper:true,sign:true,
  windows:[{wall:1,lx:-1.7,w:.5,h:.58},{wall:1,lx:1.7,w:.5,h:.58},{wall:-1,lx:-1.7,w:.5,h:.58},{wall:-1,lx:1.7,w:.5,h:.58},
   {wall:1,lx:-1.7,ly:3.97,w:.42,h:.5},{wall:1,lx:1.7,ly:3.97,w:.42,h:.5}]}).lights);
 const smithy=buildingLights({x:pads[3].x,z:pads[3].z,w:7.2,d:6.4,yaw:EAST,wallH:2.7,kind:'smithy',windows:[{wall:1,w:.5,h:.5}]});
 out.push(...smithy.lights);
 out.push(...forgeLights(smithy.front[0],smithy.front[2],EAST));
 out.push(...buildingLights({x:pads[4].x,z:pads[4].z,w:5.6,d:6.8,yaw:WEST,wallH:2.8,kind:'house',windows:[{wall:1,w:.5,h:.58},{wall:-1,w:.5,h:.58}]}).lights);
 out.push(...buildingLights({x:pads[5].x,z:pads[5].z,w:6.6,d:7.6,yaw:EAST,wallH:3.2,kind:'chapel',windows:[{wall:1,w:.8,h:1.05},{wall:-1,w:.8,h:1.05}]}).lights);
 out.push(...buildingLights({x:pads[6].x,z:pads[6].z,w:6.8,d:5.0,yaw:WEST,wallH:2.3,kind:'house',windows:[{wall:1,w:.5,h:.58},{wall:-1,w:.5,h:.58}]}).lights);
 out.push(...buildingLights({x:pads[7].x,z:pads[7].z,w:4.4,d:4.4,yaw:EAST,wallH:6.2,kind:'watchtower',
  windows:[{wall:1,ly:2.6},{wall:-1,ly:2.6},{wall:1,ly:4.6},{wall:-1,ly:4.6},{wall:1,ly:5.6},{wall:-1,ly:5.6}]}).lights);
 out.push(...wellLights(pads[8].x,pads[8].z));
 out.push(...marketStallLights(pads[8].x-4.6,pads[8].z-2.0,WEST));
 out.push(...marketStallLights(pads[8].x+4.6,pads[8].z-1.4,EAST));
 out.push(...marketStallLights(pads[8].x-3.4,pads[8].z+3.2,WEST+.35));
 for(const [z,side] of [[90,-1],[106,1]]){const sx=pathX(z)+side*3.0;out.push(...marketStallLights(sx,z,side<0?EAST:WEST));}
 return out;
}
const buildingLightList=buildAllBuildingLights();
console.log(`\nbuildings.js lights transcribed: ${buildingLightList.length}`);

// Corridor lights, labelled without modifying buildLights() itself: a light with a `radius` is
// one this milestone windowed; the two original (position z<=40) lamps are the untouched
// churchyard fixtures; any other unlabelled corridor light would be a windowing miss.
const corridorLabelled=lights.map(L=>({...L,src:L.radius!=null?'corridor-windowed':(L.position[2]<=40?'corridor:churchyard':'corridor:unwindowed-other')}));
const allLights=[...corridorLabelled,...buildingLightList];

function lampBreakdownAt(label,wx,wz){
 const wy=height(wx,wz);
 const w=wz>40;
 const rows=allLights.map(L=>{
  const dx=wx-L.position[0],dy=wy-L.position[1],dz=wz-L.position[2],f=(L.falloff??.5),dist=Math.sqrt(dx*dx+dy*dy+dz*dz),d=dist*f;
  let before=L.strength/(1+d*d),after=before;
  if(w&&L.radius!=null){const t=Math.min(1,dist/L.radius),win=(1-t*t)*(1-t*t);after=before*win;}
  return {L,dist,before,after};
 }).sort((a,b)=>b.after-a.after);
 const totalBefore=rows.reduce((a,r)=>a+r.before,0),totalAfter=rows.reduce((a,r)=>a+r.after,0);
 const byGroup=(pred)=>({before:rows.filter(r=>pred(r.L)).reduce((a,r)=>a+r.before,0),after:rows.filter(r=>pred(r.L)).reduce((a,r)=>a+r.after,0)});
 const buildingsSum=byGroup(L=>L.src.startsWith('buildings.js'));
 const corridorWindowedSum=byGroup(L=>L.src==='corridor-windowed');
 const corridorOtherSum=byGroup(L=>L.src.startsWith('corridor:'));
 console.log(`\n--- lamp breakdown at ${label} (x=${wx}, z=${wz}, y=${wy.toFixed(2)}) ---`);
 console.log(`total lamp: before=${totalBefore.toFixed(4)} after=${totalAfter.toFixed(4)} (${((1-totalAfter/totalBefore)*100).toFixed(1)}% lower)`);
 console.log(`  buildings.js (unwindowed, out of scope):    before=${buildingsSum.before.toFixed(4)} after=${buildingsSum.after.toFixed(4)}  (${(buildingsSum.before/totalBefore*100).toFixed(1)}% of before total, ${(buildingsSum.after/totalAfter*100).toFixed(1)}% of after total)`);
 console.log(`  corridor lights this milestone windowed:    before=${corridorWindowedSum.before.toFixed(4)} after=${corridorWindowedSum.after.toFixed(4)}  (${(corridorWindowedSum.before/totalBefore*100).toFixed(1)}% of before total, ${(corridorWindowedSum.after/totalAfter*100).toFixed(1)}% of after total)`);
 console.log(`  corridor churchyard/other (untouched):      before=${corridorOtherSum.before.toFixed(4)} after=${corridorOtherSum.after.toFixed(4)}`);
 console.log('top 10 contributors AFTER:');
 for(const r of rows.slice(0,10))console.log(`  [${r.L.src}] pos=[${r.L.position.map(v=>v.toFixed(1))}] falloff=${r.L.falloff} radius=${r.L.radius??'none'} dist=${r.dist.toFixed(1)}m  before=${r.before.toFixed(4)} after=${r.after.toFixed(4)}`);
}
// The well square's own centre (buildingPads[8], where well() is placed) and the m7a capture
// script's camera stand point (x:0, z:131, ~5m south of the well) -- the well-square.png shot.
lampBreakdownAt('well-square centre (buildingPads[8])', buildingPads[8].x, buildingPads[8].z);
lampBreakdownAt('well-square camera stand (capture-m7a-lamp-pools.mjs)', 0, 131);

// M8b facades: street-facing gable of the first house (pad 0, west of the road at z=82) and
// the tavern (pad 2, z=98). Sampled at mid-wall height so this is what a 15 m street view of
// the elevation actually bakes, not the centre-line ground profile.
function facadeAt(label,pad,w){
 const gy=height(pad.x,pad.z);
 const gableX=pad.x<0?pad.x+w/2:pad.x-w/2;
 const y=gy+1.6,z=pad.z,x=gableX;
 const before=lampAtUnwindowed(x,y,z,allLights),after=lampAtWindowed(x,y,z,allLights);
 console.log(`\n--- facade ${label} (gable x=${x.toFixed(2)} y=${y.toFixed(2)} z=${z}) ---`);
 console.log(`baked lamp: before=${before.toFixed(4)} after=${after.toFixed(4)}  lampEff after=${lampEff(after,z).toFixed(4)}`);
 const streetX=pathX(z),streetDist=Math.abs(x-streetX);
 console.log(`distance from street centre: ${streetDist.toFixed(2)} m`);
}
facadeAt('house pad0', buildingPads[0], 6.6);
facadeAt('tavern pad2', buildingPads[2], 7.6);
facadeAt('smithy pad3', buildingPads[3], 7.2);
