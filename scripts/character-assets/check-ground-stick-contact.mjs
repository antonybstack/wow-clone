/** Native support contact, normal travel and standing jitter on known visible surfaces.
 * Initial placements isolate fixtures; every measured move uses normal Havok controls.
 * A terrain-height comparison is valid in the open meadow, not beneath an elevated floor.
 * https://github.com/BabylonJS/Babylon-Lite/blob/npm-lite-v1.31.1/docs/lite/architecture/42-physics.md
 */
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {CDP_URL} from '../lib/cdp.mjs';
import {browserOwnership} from '../lib/browser-ownership.mjs';

const url=process.env.ASHEN_TEST_URL,out=process.argv[2];
assert(url&&out,'URL and report path required');
const b=await chromium.connectOverCDP(CDP_URL);
assert(b.contexts().flatMap(c=>c.pages()).every(p=>p.url()==='about:blank'),'Another owned page is active');
const ownership=await browserOwnership(b,{cdpPort:new URL(CDP_URL).port,url,purpose:'Native feet clearance and stationary jitter; no FPS claim',renderingClients:1});
await fs.writeFile(out+'.ownership.json',JSON.stringify(ownership,null,2));
const c=await b.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1}),p=await c.newPage();
const report={url,rows:[],errors:[]};
p.on('pageerror',e=>report.errors.push(e.message));
p.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
try{
 await p.goto(url);await p.waitForFunction(()=>globalThis.ASHEN?.ready&&ASHEN.hostilesReady,null,{timeout:90000});
 await p.evaluate(()=>{ASHEN.dev.god=true;ASHEN.player.setFlying(false);});
 for(const id of ['meadow','bridge','nave','gallery']){
  await p.evaluate(id=>{
   const a=ASHEN,k=a.world.cathedral;
   const q=id==='meadow'?[0,a.world.groundHeight(0,-65),-65]:id==='bridge'?[0,k.route.heightAt(190),190]:id==='nave'?[0,k.floorY,328]:k.exploration.chapels[0].gallery;
   a.player.setWorldPos(q[0],q[1]+1.7,q[2]);a.player.setFacing(0);a.rig.yaw=0;
  },id);
  await p.waitForTimeout(1000);
  const sample=()=>p.evaluate(id=>{
   const a=ASHEN,d=a.player.getDebugState(),q=d.position,k=a.world.cathedral;
   const y=id==='meadow'?a.world.groundHeight(q.x,q.z):id==='bridge'?k.route.heightAt(q.z):id==='nave'?k.floorY:k.exploration.chapels[0].gallery[1];
   return {gap:q.y-d.capsuleHeight/2-y,y:q.y,z:q.z,grounded:d.grounded,physics:d.usingPhysics,recoveries:d.recoveries};
  },id);
  const stationary=[];for(let i=0;i<25;i++){stationary.push(await sample());await p.waitForTimeout(20);}
  const ys=stationary.map(s=>s.y),gaps=stationary.map(s=>s.gap);
  const row={id,standing:{minGap:Math.min(...gaps),maxGap:Math.max(...gaps),peakToPeakY:Math.max(...ys)-Math.min(...ys)},samples:stationary};
  // Known floor fixtures remain close to the drawn support. Meadow varies slightly
  // because the visual analytic height and triangulated collider are different surfaces.
  assert(stationary.every(s=>s.physics&&s.grounded&&s.recoveries===0));
  assert(row.standing.minGap>=-.02&&row.standing.maxGap<=.04,`${id}: support clearance ${JSON.stringify(row.standing)}`);
  assert(row.standing.peakToPeakY<.001,`${id}: stationary jitter`);
  if(id==='meadow'||id==='bridge'){
   await p.focus('#renderCanvas');await p.keyboard.down('KeyW');
   const moving=[];for(let i=0;i<30;i++){await p.waitForTimeout(100);moving.push(await sample());}
   await p.keyboard.up('KeyW');
   const gs=moving.filter(s=>s.grounded).map(s=>s.gap);
   row.moving={travelZ:moving.at(-1).z-stationary.at(-1).z,minGap:Math.min(...gs),maxGap:Math.max(...gs)};
   row.movingSamples=moving;
   assert(row.moving.travelZ>15,`${id}: normal movement stalled`);
   assert(gs.length>20&&row.moving.minGap>=-.03&&row.moving.maxGap<.05,`${id}: walking ratchet ${JSON.stringify(row.moving)}`);
   await p.keyboard.press('Space');await p.waitForTimeout(2000);
   row.landed=await sample();assert(row.landed.grounded&&row.landed.recoveries===0);
   assert(row.landed.gap>=-.03&&row.landed.gap<.05,`${id}: landing clearance`);
  }
  report.rows.push(row);console.log(JSON.stringify({id,standing:row.standing,moving:row.moving,landed:row.landed}));
 }
 report.gpuErrors=await p.evaluate(()=>ASHEN.gpu.errors.slice());
 assert.deepEqual(report.errors,[]);assert.deepEqual(report.gpuErrors,[]);report.passed=true;
}catch(e){report.failure=e.stack;throw e;}finally{
 await p.keyboard.up('KeyW').catch(()=>{});await fs.writeFile(out,JSON.stringify(report,null,2));
 await c.close();await b.close();await fs.writeFile(out+'.ownership.json',JSON.stringify({...ownership,active:false,renderingClients:0},null,2));
}
