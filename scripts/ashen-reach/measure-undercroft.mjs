/** Three unrecorded 12-second native keyboard circuits around the memorial. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {performance} from 'node:perf_hooks';
import {chromium} from 'playwright';
import {CDP_URL} from '../lib/cdp.mjs';
import {browserOwnership} from '../lib/browser-ownership.mjs';
import {summarizeDurations,detectVsyncCap} from '../../src/ashen-reach/metrics.js';

const destination=process.argv[2];
assert(destination,'Usage: measure-undercroft.mjs <report.json> (isolated uncapped harness)');
await fs.mkdir(path.dirname(destination),{recursive:true});
const browser=await chromium.connectOverCDP(CDP_URL);
assert(browser.contexts().flatMap(c=>c.pages()).every(p=>p.url()==='about:blank'),'Another owned renderer is active');
const context=await browser.newContext({viewport:{width:1280,height:720}}),page=await context.newPage();
const target=new URL(process.env.ASHEN_TEST_URL||'http://127.0.0.1:5173/ashen-reach.html?play&clean&pixelRatio=1');
target.searchParams.delete('gpuTiming');const url=target.href;
const ownership=await browserOwnership(browser,{cdpPort:new URL(CDP_URL).port,url,purpose:'Undercroft performance; no recording/builds/other game',renderingClients:1});
const errors=[],report={at:new Date().toISOString(),ownership,conditions:{cpu:os.cpus()[0]?.model,browser:browser.version(),viewport:{width:1280,height:720},enemyCount:7,runSeconds:12,recording:false,gpuTimestampQueries:false,controller:'Real W/A/D, native Havok; sampled keyboard steering adds driver overhead'},rows:[],errors};
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
const state=()=>page.evaluate(()=>{
  const a=ASHEN,p=a.player.body.position,c=document.getElementById('renderCanvas');
  return {p:{x:p.x,y:p.y,z:p.z},facing:a.player.body.rotation.y,physics:a.player.getDebugState(),enemies:a.combat.enemies.length,canvas:{width:c.width,height:c.height}};
});
try{
  await page.goto(url,{waitUntil:'commit'});await page.waitForFunction(()=>window.ASHEN?.ready&&ASHEN.hostilesReady,null,{timeout:120000});
  assert.equal(await page.evaluate(()=>ASHEN.metrics.summary().gpuTimingEnabled),false,'Timestamp queries must be disabled for throughput acceptance');
  const y=await page.evaluate(()=>{ASHEN.metrics.setInternalResolution(1280,720);ASHEN.dev.god=true;return ASHEN.world.cathedral.exploration.undercroft.floorY;});
  const circuit=[[-10,334],[-10,325],[-4,325],[-4,334],[-7,337]];
  for(let run=1;run<=3;run++){
    await page.evaluate(y=>{const a=ASHEN;a.player.setFlying(false);a.player.setWorldPos(-7,y+1.7,337);a.player.setFacing(-Math.PI*.75);a.rig.yaw=-Math.PI*.75;a.rig.pitch=.1;a.rig.distance=a.rig.distanceTarget=3;},y);
    await page.waitForTimeout(1500);const before=await state();assert(before.physics.usingPhysics);assert.equal(before.enemies,7);assert.deepEqual(before.canvas,{width:1280,height:720});
    let s=before,target=0,distance=0;await page.evaluate(()=>ASHEN.renderLoop.beginMeasurement());const end=performance.now()+12000;
    while(performance.now()<end){
      const point=circuit[target],d=Math.hypot(point[0]-s.p.x,point[1]-s.p.z);
      if(d<.42){target=(target+1)%circuit.length;await page.keyboard.up('KeyW');continue;}
      const yaw=Math.atan2(point[0]-s.p.x,point[1]-s.p.z),error=Math.atan2(Math.sin(yaw-s.facing),Math.cos(yaw-s.facing));
      const wait=Math.min(end-performance.now(),Math.abs(error)>.045?Math.max(12,Math.min(150,Math.abs(error)/2.55*1000)):Math.min(150,Math.max(20,(d-.3)/7*1000)));
      if(wait<=0)break;
      if(Math.abs(error)>.045){await page.keyboard.up('KeyW');const key=error>0?'KeyD':'KeyA';await page.keyboard.down(key);await page.waitForTimeout(wait);await page.keyboard.up(key);}
      else{await page.keyboard.down('KeyW');await page.waitForTimeout(wait);}
      const next=await state();distance+=Math.hypot(next.p.x-s.p.x,next.p.z-s.p.z);assert.equal(next.physics.recoveries,before.physics.recoveries);s=next;
    }
    const frames=await page.evaluate(()=>ASHEN.renderLoop.endMeasurement());await page.keyboard.up('KeyW');const after=await state();
    const row={run,...summarizeDurations(frames),...detectVsyncCap(frames),distanceM:distance,before,after};report.rows.push(row);
    await fs.writeFile(path.join(path.dirname(destination),`undercroft-${run}-frames.json`),JSON.stringify(frames));await fs.writeFile(destination,JSON.stringify(report,null,2));
    console.log(JSON.stringify({run,fps:row.fps,p99Ms:row.p99Ms,worstMs:row.worstMs,distanceM:distance,vsyncCapped:row.vsyncCapped}));
    assert(distance>15,'Insufficient movement around memorial');assert(row.fps>120,'Below performance floor');
  }
  report.gpuErrors=await page.evaluate(()=>ASHEN.gpu.errors);assert.deepEqual(errors,[]);assert.deepEqual(report.gpuErrors,[]);report.passed=true;
}catch(error){report.failure=error.stack;throw error;
}finally{
  for(const key of ['KeyW','KeyA','KeyD'])await page.keyboard.up(key).catch(()=>{});
  await context.close();await browser.close();report.ownership={...ownership,active:false,renderingClients:0};await fs.writeFile(destination,JSON.stringify(report,null,2));
}
