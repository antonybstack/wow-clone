/** Bounded comparison of the existing dev-UI region modes, not a release cohort.
 * Uses Lite's existing render-loop interval capture; no recording or profiler.
 * https://chromedevtools.github.io/devtools-protocol/tot/Network/#method-emulateNetworkConditions
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {browserOwnership} from '../lib/browser-ownership.mjs';
import {summarizeFrameIntervals} from '../character-assets/summarize-frame-intervals.mjs';

const file=process.argv[2];assert(file,'Specify report.json');
const base=new URL(process.env.ASHEN_TEST_URL||'http://127.0.0.1:7074/');
const report={conditions:{cpu:os.cpus()[0].model,url:base.href,pairs:3,
 viewport:[1280,720],dpr:1,network:{downloadMbps:50,uploadMbps:10,latencyMs:40},
 freshBrowserEachVisit:true,httpCacheDisabled:true,uncapped:true,recording:false,
 gpuTimestampQueries:false,shaderDiskCacheDisabled:false,
 limits:'Local transport/CPU comparison; OS/driver caches uncontrolled. Not public cold-start qualification or settled FPS. Starting meadow W movement, no God/Fly/teleport.'},rows:[]};
await fs.mkdir(path.dirname(file),{recursive:true});
const save=()=>fs.writeFile(file,JSON.stringify(report,null,2)+'\n');
for(let pair=1;pair<=3;pair++)for(const mode of pair%2?['whole','core']:['core','whole']){
 const url=new URL(base);url.searchParams.set('dev','');url.searchParams.set('play','');
 url.searchParams.set('clean','');url.searchParams.set('pixelRatio','1');
 url.searchParams.delete('gpuTiming');url.searchParams.delete('at');
 url.searchParams.set('regionCore',mode==='core'?'1':'0');
 let browser,context,page,owner;const errors=[],requests=new Map();let offset;
 const row={pair,mode,url:url.href};report.rows.push(row);await save();
 try{
  browser=await chromium.launch({channel:'chrome',headless:true,args:['--disable-gpu-vsync','--disable-frame-rate-limit']});
  owner={...await browserOwnership(browser,{cdpPort:null,url:url.href,purpose:`Region timing pair${pair} ${mode}`,renderingClients:1}),cdpPort:null,controllerPid:process.pid};row.ownership=owner;await save();
  context=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1,serviceWorkers:'block'});
  page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  const cdp=await context.newCDPSession(page);await cdp.send('Network.enable');
  await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});
  await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:40,downloadThroughput:6250000,uploadThroughput:1250000});
  // Native CDP bytes include partial responses at each declared boundary;
  // ResourceTiming encodedBodySize alone would omit an unfinished detail packet.
  // https://chromedevtools.github.io/devtools-protocol/tot/Network/#event-dataReceived
  cdp.on('Network.requestWillBeSent',e=>{offset??=e.wallTime-e.timestamp;requests.set(e.requestId,{url:e.request.url,start:e.timestamp,chunks:[]});});
  cdp.on('Network.dataReceived',e=>requests.get(e.requestId)?.chunks.push({at:e.timestamp,bytes:e.encodedDataLength}));
  cdp.on('Network.loadingFinished',e=>{const r=requests.get(e.requestId);if(r)Object.assign(r,{end:e.timestamp,bytes:e.encodedDataLength});});
  const bytesAt=(origin,at)=>[...requests.values()].filter(r=>(r.start+offset)*1000-origin<=at).reduce((n,r)=>n+(r.end!==undefined&&(r.end+offset)*1000-origin<=at?r.bytes:r.chunks.filter(c=>(c.at+offset)*1000-origin<=at).reduce((s,c)=>s+c.bytes,0)),0);
  await page.goto(url.href,{waitUntil:'commit'});
  await page.waitForFunction(()=>globalThis.ASHEN?.playableReady,null,{timeout:30000});
  row.start=await page.evaluate(()=>{
   // ?dev deliberately starts invulnerable. Use the same exposed God state as
   // Developer tools before the mortal-motion comparison, and retain it.
   ASHEN.dev.god=false;ASHEN.renderLoop.beginMeasurement();
   return {origin:performance.timeOrigin,marks:ASHEN.startup.timings(),god:ASHEN.dev.god,position:[ASHEN.player.body.position.x,ASHEN.player.body.position.z],recoveries:ASHEN.player.getDebugState().recoveries};
  });
  await page.keyboard.down('KeyW');
  await page.waitForFunction(()=>ASHEN.navigationReady,null,{timeout:90000});
  row.navigation=await page.evaluate(()=>{const frames=ASHEN.renderLoop.endMeasurement();ASHEN.renderLoop.beginMeasurement();return {marks:ASHEN.startup.timings(),frames,streaming:{...ASHEN.world.streaming},gpuErrors:[...ASHEN.gpu.errors],physics:ASHEN.player.getDebugState(),flying:ASHEN.player.isFlying(),mode:ASHEN.world.regionCoreLoading,position:[ASHEN.player.body.position.x,ASHEN.player.body.position.z]};});
  row.navigation.encodedBytes=bytesAt(row.start.origin,row.navigation.marks['navigation-ready']);
  await page.waitForFunction(()=>ASHEN.ready,null,{timeout:90000});
  row.complete=await page.evaluate(()=>({marks:ASHEN.startup.timings(),frames:ASHEN.renderLoop.endMeasurement(),streaming:{...ASHEN.world.streaming},gpuErrors:[...ASHEN.gpu.errors],physics:ASHEN.player.getDebugState(),flying:ASHEN.player.isFlying(),god:ASHEN.dev.god,enemies:ASHEN.combat.enemies.length,canvas:[ASHEN.engine.canvas.width,ASHEN.engine.canvas.height]}));
  await page.keyboard.up('KeyW');
  row.complete.encodedBytes=bytesAt(row.start.origin,row.complete.marks.ready);
  row.runtimeErrors=errors;row.navigation.tails=summarizeFrameIntervals(row.navigation.frames);
  row.complete.tails=summarizeFrameIntervals(row.complete.frames);
  await save();
  assert.equal(row.navigation.mode,mode==='core');assert.deepEqual(errors,[]);
  for(const state of [row.navigation,row.complete]){assert.deepEqual(state.gpuErrors,[]);assert(state.physics.usingPhysics&&state.physics.grounded);assert.equal(state.physics.recoveries,row.start.recoveries);assert.equal(state.flying,false);}
  assert.equal(row.start.recoveries,0);assert.equal(row.complete.god,false);
  assert.equal(row.complete.enemies,7);assert.deepEqual(row.complete.canvas,[1280,720]);
  assert(row.start.marks.playable<=1000,'Local first play exceeded1s; stop and retain');
  assert(Math.hypot(...row.navigation.position.map((v,i)=>v-row.start.position[i]))>.1,'Native W movement not observed');
  row.passed=true;console.log(JSON.stringify({pair,mode,playableMs:row.start.marks.playable,navigationMs:row.navigation.marks['navigation-ready'],readyMs:row.complete.marks.ready,navigationBytes:row.navigation.encodedBytes,tails:row.navigation.tails}));
 }catch(error){row.failure=error.stack;await save();throw error;}
 finally{await page?.keyboard.up('KeyW').catch(()=>{});await context?.close().catch(()=>{});await browser?.close();if(owner)Object.assign(owner,{active:false,renderingClients:0});await save();}
}
const median=values=>[...values].sort((a,b)=>a-b)[1];
const whole=median(report.rows.filter(r=>r.mode==='whole').map(r=>r.navigation.marks['navigation-ready']));
const core=median(report.rows.filter(r=>r.mode==='core').map(r=>r.navigation.marks['navigation-ready']));
report.result={wholeMedianNavigationMs:whole,coreMedianNavigationMs:core,gainFraction:1-core/whole,meets20Percent:core<=whole*.8};
await save();console.log(JSON.stringify(report.result));
