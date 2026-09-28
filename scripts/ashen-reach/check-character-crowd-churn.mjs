#!/usr/bin/env node
/** M003 60-second swap/spawn/despawn and ten-cycle native ownership probe.
 * This diagnostic rebuilds whole cohorts and reports the transition cost;
 * it does not claim production-frame upload scheduling.
 */
import fs from 'node:fs/promises';
import {gzipSync} from 'node:zlib';
import {chromium} from 'playwright';
const cdp=Number(process.env.ASHEN_CDP_PORT),vite=Number(process.env.ASHEN_VITE_PORT);
if(!cdp||!vite)throw Error('Use an audited owned CDP/Vite pair');
const dir='docs/baselines/character-mmo/m003';
const browser=await chromium.connectOverCDP(`http://127.0.0.1:${cdp}`);
const candidates=browser.contexts()[0].pages().filter(p=>p.url()==='about:blank');
if(candidates.length!==1)throw Error(`Expected one owned blank tab; got ${candidates.length}`);
const page=candidates[0],errors=[],report={schema:1,viewport:[1280,720],seconds:60,shadows:false,stages:[],disposalCycles:[],errors};
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
const summary=xs=>{if(!xs.length)return null;const s=[...xs].sort((a,b)=>a-b),mean=xs.reduce((a,b)=>a+b,0)/xs.length;return {frames:xs.length,meanFps:1000/mean,p95Ms:s[Math.ceil(.95*s.length)-1],p99Ms:s[Math.ceil(.99*s.length)-1],maxMs:s.at(-1)};};
try {
  await page.setViewportSize({width:1280,height:720});
  await page.goto(`http://127.0.0.1:${vite}/character-crowd-probe.html?path=vat&count=100&appearance=repeat&motion=walk`);
  await page.waitForFunction(()=>globalThis.CROWD_PROBE?.ready,null,{timeout:90000});
  await page.evaluate(()=>{
    const c={stage:'initial-repeat',frames:[],active:true,last:0,start:performance.now()};
    globalThis.M003_CHURN=c;
    function tick(now){if(!c.active)return;if(c.last)c.frames.push({ms:now-c.last,stage:c.stage});c.last=now;requestAnimationFrame(tick);}requestAnimationFrame(tick);
  });
  const steps=[
    {stage:'initial-repeat',options:null},
    {stage:'swap-quarter',options:{path:'vat',count:100,appearance:'quarter',motion:'walk'}},
    {stage:'spawn-150',options:{path:'vat',count:150,appearance:'quarter',motion:'walk'}},
    {stage:'despawn-100',options:{path:'vat',count:100,appearance:'quarter',motion:'walk'}},
  ];
  for(const step of steps) {
    let transitionMs=0;
    if(step.options){
      await page.evaluate(name=>{M003_CHURN.stage=`transition-${name}`;},step.stage);
      const start=Date.now();await page.evaluate(options=>CROWD_PROBE.set(options),step.options);transitionMs=Date.now()-start;
    }
    await page.evaluate(name=>{M003_CHURN.stage=name;},step.stage);
    const status=await page.evaluate(()=>CROWD_PROBE.status());
    report.stages.push({name:step.stage,transitionMs,status});
    await page.waitForTimeout(15000);
  }
  const frames=await page.evaluate(()=>{M003_CHURN.active=false;return M003_CHURN.frames;});
  await fs.writeFile(`${dir}/raw/churn-60s.json.gz`,gzipSync(JSON.stringify(frames)));
  for(const stage of report.stages)stage.frameIntervals=summary(frames.filter(x=>x.stage===stage.name).map(x=>x.ms));
  report.transitionFrameIntervals=summary(frames.filter(x=>x.stage.startsWith('transition-')).map(x=>x.ms));
  report.totalFrames=frames.length;
  for(let i=0;i<10;i++) {
    await page.evaluate(()=>CROWD_PROBE.set({path:'vat',count:10,appearance:'mixed',motion:'walk'}));
    const live=await page.evaluate(()=>CROWD_PROBE.status());
    await page.evaluate(()=>CROWD_PROBE.clear());
    const clear=await page.evaluate(()=>CROWD_PROBE.status());
    report.disposalCycles.push({cycle:i+1,liveMeshes:live.sceneMeshes,liveContainers:live.ownedContainers,afterMeshes:clear.sceneMeshes,afterContainers:clear.ownedContainers});
  }
  if(errors.length)throw Error(`Runtime errors: ${errors.join(' | ')}`);
  console.log(JSON.stringify({stages:report.stages.map(x=>({name:x.name,transitionMs:x.transitionMs,fps:x.frameIntervals.meanFps,p99:x.frameIntervals.p99Ms})),disposal:report.disposalCycles,errors}));
} catch(e){report.failure=e.stack||e.message;throw e;}
finally {await fs.writeFile(`${dir}/churn.json`,JSON.stringify(report,null,2)+'\n');await page.goto('about:blank').catch(()=>{});await browser.close();}
