// Investigation only: requires csm-experiment.patch in a separate checkout and harness slot 13.
// Native cache contract: https://github.com/BabylonJS/Babylon-Lite/blob/npm-lite-v1.31.1/docs/lite/architecture/17-cascaded-shadow.md
import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import os from 'node:os';
import {summarizeDurations} from '../../../src/ashen-reach/metrics.js';
const browser=await chromium.connectOverCDP('http://127.0.0.1:10637');
const page=browser.contexts()[0].pages()[0];
const report={commit:'837f18a',cpu:os.cpus()[0].model,browser:browser.version(),conditions:{resolution:[1280,720],enemies:7,seconds:8,recording:false,gpuTiming:true,order:['baseline','cache','cache','baseline']},rows:[],errors:[]};
page.on('pageerror',e=>report.errors.push(e.message));
page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
await page.addInitScript(()=>{window.__gpuErrors=[];if(!window.GPUAdapter)return;const fn=GPUAdapter.prototype.requestDevice;GPUAdapter.prototype.requestDevice=async function(...args){const d=await fn.apply(this,args);d.addEventListener('uncapturederror',e=>__gpuErrors.push(e.error.message));return d;};});
await page.setViewportSize({width:1280,height:720});
try{
for(const [run,mode] of report.conditions.order.entries()){
 await page.goto(`http://127.0.0.1:6473/ashen-reach.html?play&clean&gpuTiming${mode==='cache'?'&csmCache':''}`,{waitUntil:'commit'});
 await page.waitForFunction(()=>window.ASHEN?.ready&&ASHEN.hostilesReady,null,{timeout:120000});
 await page.evaluate(()=>{ASHEN.metrics.setInternalResolution(1280,720);ASHEN.dev.god=true;const sg=window.__csmTrial;window.__trialCounts={renders:0,staticExecutes:0,dynamicExecutes:0};const old=sg._renderShadowMap;const wrapped=new WeakSet();sg._renderShadowMap=function(e,s){for(const [key,list] of [['staticExecutes',s._staticTasks],['dynamicExecutes',s._tasks]])for(const t of list||[])if(!wrapped.has(t)){wrapped.add(t);const exec=t.execute;t.execute=function(...a){__trialCounts[key]++;return exec.apply(this,a);};}__trialCounts.renders++;return old.call(this,e,s);};});
 for(const [route,x,z,walking] of [['idle',0,-60,false],['town',0,80,true],['bridge',0,190,true],['forest',130,-50,true]]){
  await page.evaluate(({x,z})=>{const a=ASHEN;a.setView('play');a.player.setWorldPos(x,a.world.groundHeight(x,z)+1.7,z);a.player.setFacing(0);a.rig.yaw=0;a.rig.pitch=.24;a.rig.distance=a.rig.distanceTarget=5;},{x,z});
  await page.waitForTimeout(1500);
  if(walking)await page.keyboard.down('KeyW');
  await page.waitForTimeout(1500);
  const before=await page.evaluate(()=>{window.__trialCounts={renders:0,staticExecutes:0,dynamicExecutes:0};ASHEN.metrics.reset();ASHEN.renderLoop.beginMeasurement();return {x:ASHEN.player.body.position.x,z:ASHEN.player.body.position.z,physics:ASHEN.player.getDebugState()};});
  await page.waitForTimeout(8000);
  const result=await page.evaluate(()=>({frames:ASHEN.renderLoop.endMeasurement(),counts:__trialCounts,metrics:ASHEN.metrics.summary(),physics:ASHEN.player.getDebugState(),x:ASHEN.player.body.position.x,z:ASHEN.player.body.position.z,errors:__gpuErrors,cacheLoaded:!!__csmTrial._csmCache?._loaded,cacheStates:!!__csmTrial._shadowTaskState?._gate}));
  await page.keyboard.up('KeyW');
  const row={mode,run:run+1,route,before,...result,summary:summarizeDurations(result.frames)};report.rows.push(row);
  await fs.writeFile('/tmp/ashen-csm-trial.json',JSON.stringify(report,null,2));
  console.log(JSON.stringify({mode,run:run+1,route,summary:row.summary,counts:result.counts,gpuMs:result.metrics.gpuMeanMs,gpuReadback:result.metrics.gpuTimingReadback,cache:result.cacheStates,errors:result.errors}));
 }
}
}finally{await page.keyboard.up('KeyW').catch(()=>{});await page.goto('about:blank');await browser.close();await fs.writeFile('/tmp/ashen-csm-trial.json',JSON.stringify(report,null,2));}
