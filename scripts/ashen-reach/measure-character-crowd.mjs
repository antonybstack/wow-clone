#!/usr/bin/env node
/** Sequential M003 measurements in one audited CDP browser and one game tab.
 * requestAnimationFrame interval is presentation pacing, not CPU/GPU duration.
 * https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import {gzipSync} from 'node:zlib';
import {chromium} from 'playwright';

const cdpPort=Number(process.env.ASHEN_CDP_PORT),vitePort=Number(process.env.ASHEN_VITE_PORT);
if(!cdpPort||!vitePort)throw Error('ASHEN_CDP_PORT and ASHEN_VITE_PORT must name an audited owned harness');
const option=(name,fallback)=>{const i=process.argv.indexOf(`--${name}`);return i<0?fallback:process.argv[i+1];};
const split=(name,fallback)=>option(name,fallback).split(',').map(x=>x.trim()).filter(Boolean);
const paths=split('paths','independent,vat'),counts=split('counts','100,300,1000').map(Number),appearances=split('appearances','repeat,mixed'),motions=split('motions','idle,walk');
const seconds=Number(option('seconds','12')),runs=Number(option('runs','3')),warmupMs=Number(option('warmup-ms','2000'));
const shadows=process.argv.includes('--shadows');
const output=option('output','docs/baselines/character-mmo/m003/crowd-core.json');
const rawDir=path.join(path.dirname(output),'raw');
const cells=[];
for(const appearance of appearances)for(const count of counts)for(const path of paths)for(const motion of motions)cells.push({appearance,count,path,motion});
const percentile=(sorted,p)=>sorted[Math.min(sorted.length-1,Math.max(0,Math.ceil(p*sorted.length)-1))];
function summarize(intervals) {
  const sorted=[...intervals].sort((a,b)=>a-b),sum=intervals.reduce((a,b)=>a+b,0),meanMs=sum/intervals.length;
  return {frames:intervals.length,meanFps:1000/meanMs,meanMs,p50Ms:percentile(sorted,.5),p95Ms:percentile(sorted,.95),p99Ms:percentile(sorted,.99),maxMs:sorted.at(-1),over6_94:intervals.filter(x=>x>6.94).length,over8_33:intervals.filter(x=>x>8.33).length,over16_67:intervals.filter(x=>x>16.67).length,over33_33:intervals.filter(x=>x>33.33).length};
}
function summarizeGpu(samples) {
  const {frames,meanMs,p50Ms,p95Ms,p99Ms,maxMs}=summarize(samples);
  return {samples:frames,meanMs,p50Ms,p95Ms,p99Ms,maxMs};
}
const browser=await chromium.connectOverCDP(`http://127.0.0.1:${cdpPort}`);
const context=browser.contexts()[0],pages=context.pages();
const candidates=pages.filter(p=>p.url().startsWith(`http://127.0.0.1:${vitePort}/character-crowd-probe.html`)||p.url()==='about:blank');
if(candidates.length!==1)throw Error(`Expected one owned probe/blank tab; found ${candidates.length}: ${pages.map(p=>p.url()).join(', ')}`);
const page=candidates[0];page.setDefaultTimeout(120000);
const report={schema:1,sourceHead:process.env.ASHEN_SOURCE_HEAD||null,sourceState:'uncommitted M003 working tree on sourceHead',conditions:{browser:'system Chrome via owned CDP',cdpPort,vitePort,viewport:[1280,720],pixelRatio:1,uncapped:true,shadows,seconds,runs,warmupMs,metric:'requestAnimationFrame interval; nearest-rank tails; no recording',gpuTiming:'Lite GPU timer enabled when supported; sampled every twentieth animation frame; zero/missing reported unavailable'},cells:[]};
await fs.mkdir(rawDir,{recursive:true});
const persist=()=>fs.writeFile(output,JSON.stringify(report,null,2)+'\n');
try {
  await page.setViewportSize({width:1280,height:720});
  for(const cell of cells) {
    const record={...cell,startedAt:new Date().toISOString(),runs:[],errors:[]};report.cells.push(record);
    const pageErrors=[];
    const onError=e=>pageErrors.push(e.message),onConsole=m=>{if(m.type()==='error')pageErrors.push(m.text());};
    page.on('pageerror',onError);page.on('console',onConsole);
    try {
      const target=`http://127.0.0.1:${vitePort}/character-crowd-probe.html?path=${cell.path}&count=${cell.count}&appearance=${cell.appearance}&motion=${cell.motion}${shadows?'&shadows':''}`;
      await page.goto(target,{timeout:90000});
      await page.waitForFunction(()=>globalThis.CROWD_PROBE?.ready||document.getElementById('error')?.textContent,null,{timeout:90000});
      if(!await page.evaluate(()=>globalThis.CROWD_PROBE?.ready))throw Error((await page.locator('#error').textContent()).split('\n')[0]);
      record.status=await page.evaluate(()=>CROWD_PROBE.status());
      if(record.status.count!==cell.count||record.status.canvas.join('x')!=='1280x720')throw Error('Incorrect cohort or canvas');
      if(record.status.projectedActorCenters<cell.count)record.note='Some actor centers are outside the viewport; submission count remains full.';
      await page.waitForTimeout(warmupMs);
      for(let run=0;run<runs;run++) {
        const samples=await page.evaluate(duration=>new Promise(resolve=>{
          const intervals=[],gpu=[],start=performance.now();let last=0,frame=0;
          function tick(now){
            if(last)intervals.push(now-last);last=now;
            if((frame++%20)===0){const value=CROWD_PROBE.engine.gpuFrameTimeMs;if(Number.isFinite(value)&&value>0)gpu.push(value);}
            if(now-start<duration)requestAnimationFrame(tick);else resolve({intervals,gpu});
          }
          requestAnimationFrame(tick);
        }),seconds*1000);
        const status=await page.evaluate(()=>CROWD_PROBE.status());
        const rawFile=`${cell.path}-${cell.count}-${cell.appearance}-${cell.motion}-run${run+1}.json.gz`;
        await fs.writeFile(path.join(rawDir,rawFile),gzipSync(JSON.stringify(samples.intervals)));
        record.runs.push({run:run+1,...summarize(samples.intervals),drawCalls:status.drawCalls,gpu:samples.gpu.length?{sampleStride:20,unit:'GPU frame ms',...summarizeGpu(samples.gpu)}:null,rawFile:`raw/${rawFile}`});
        await persist();
      }
      record.errors.push(...pageErrors);
      console.log(JSON.stringify({cell,projected:record.status.projectedActorCenters,meanFps:record.runs.map(x=>+x.meanFps.toFixed(1)),p95:record.runs.map(x=>+x.p95Ms.toFixed(2)),errors:record.errors.length}));
    } catch(error) {
      record.errors.push(error.message,...pageErrors);
      console.log(JSON.stringify({cell,failed:record.errors}));
    } finally {page.off('pageerror',onError);page.off('console',onConsole);await persist();}
  }
} finally {
  await page.goto('about:blank').catch(()=>{});
  await browser.close();
}
