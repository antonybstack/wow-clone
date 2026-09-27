// Archived investigation: apply async-experiment.patch in an isolated checkout and use harness slot 14.
// https://github.com/BabylonJS/Babylon-Lite/blob/npm-lite-v1.31.1/docs/lite/architecture/53-async-shader-pipeline-compilation.md
// Fresh contexts do not prove a warm HTTP/driver cache; only browser-process reuse is established.
import {chromium} from 'playwright';
import fs from 'node:fs/promises';
const browser=await chromium.connectOverCDP('http://127.0.0.1:10737');
for(const p of browser.contexts()[0].pages())if(p.url().includes('6573'))await p.goto('about:blank');
const report={date:new Date().toISOString(),browser:browser.version(),conditions:'M1 Max; headless Chromium WebGPU; Vite dev localhost; 1280x720 viewport/canvas pixelRatio=1; fresh contexts per run; first context clears browser HTTP cache, subsequent cache warm; GPU/driver and Vite caches uncontrolled; serial, uncapped; foreign historical CDP9937 game tab may exist, not controlled; same instrumentation in both variants.',runs:[]};
try{
for(const [i,enabled] of [false,true,true,false,false,true,true,false].entries()){
 const context=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1});
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 const cdp=await context.newCDPSession(page);if(i===0)await cdp.send('Network.clearBrowserCache');
 await page.addInitScript(()=>{
  window.__probe={sync:[],async:[],longTasks:[],frames:[],gpuErrors:[]};const p=window.__probe;
  new PerformanceObserver(list=>p.longTasks.push(...list.getEntries().map(e=>({start:e.startTime,duration:e.duration})))).observe({type:'longtask',buffered:true});
  const sync=GPUDevice.prototype.createRenderPipeline, async=GPUDevice.prototype.createRenderPipelineAsync;
  GPUDevice.prototype.createRenderPipeline=function(d){const start=performance.now();try{return sync.call(this,d);}finally{p.sync.push({at:start,duration:performance.now()-start,label:d.label||'',vertex:d.vertex.entryPoint,fragment:d.fragment?.entryPoint});}};
  GPUDevice.prototype.createRenderPipelineAsync=function(d){const start=performance.now();return async.call(this,d).then(result=>{p.async.push({at:start,duration:performance.now()-start,label:d.label||'',vertex:d.vertex.entryPoint,fragment:d.fragment?.entryPoint});return result;},e=>{p.async.push({at:start,duration:performance.now()-start,error:String(e)});throw e;});};
  const request=GPUAdapter.prototype.requestDevice;GPUAdapter.prototype.requestDevice=async function(...args){const device=await request.apply(this,args);device.addEventListener('uncapturederror',e=>p.gpuErrors.push(e.error.message));return device;};
  let prev;function frame(t){if(prev)p.frames.push({at:t,interval:t-prev});prev=t;requestAnimationFrame(frame);}requestAnimationFrame(frame);
 });
 await page.goto(`http://127.0.0.1:6573/ashen-reach.html?play&clean&pixelRatio=1${enabled?'&asyncCompile':''}`,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.ASHEN?.ready&&ASHEN.hostilesReady,null,{timeout:120000});
 await page.waitForTimeout(2000);
 const run=await page.evaluate(()=>({marks:performance.getEntriesByType('mark').map(e=>({name:e.name,at:e.startTime})),...window.__probe,loadMs:ASHEN.loadMs,presentMs:ASHEN.presentMs,enemies:ASHEN.combat.enemies.length,canvas:{width:ASHEN.engine.canvas.width,height:ASHEN.engine.canvas.height},physics:ASHEN.player.getDebugState(),nav:performance.getEntriesByType('navigation')[0].toJSON()}));
 run.enabled=enabled;run.index=i;run.errors=errors;
 if(i===0||i===1)await page.screenshot({path:`/tmp/ashen-async-${enabled?'candidate':'baseline'}.png`});
 report.runs.push(run);await fs.writeFile('/tmp/ashen-async-load-results.json',JSON.stringify(report,null,2));
 console.log(JSON.stringify({i,enabled,marks:run.marks,sync:run.sync.length,async:run.async.length,maxSyncMs:Math.max(...run.sync.map(x=>x.duration)),longTasks:run.longTasks.length,longTaskMax:Math.max(...run.longTasks.map(x=>x.duration)),errors:run.errors,gpuErrors:run.gpuErrors}));
 await context.close();
}
}finally{await browser.close();}
