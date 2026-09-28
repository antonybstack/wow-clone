#!/usr/bin/env node
/** Paired actual-town confirmation. One owned Chrome tab; seven normal enemies.
 * Raw RAF intervals are presentation pacing, not CPU or GPU execution time.
 * https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import {gzipSync} from 'node:zlib';
import {chromium} from 'playwright';

const cdpPort=Number(process.env.ASHEN_CDP_PORT),vitePort=Number(process.env.ASHEN_VITE_PORT);
if(!cdpPort||!vitePort)throw Error('Use an audited owned CDP/Vite pair');
const output='docs/baselines/character-mmo/m003/town-paired.json';
const rawDir=path.join(path.dirname(output),'raw');
const report={schema:1,sourceHead:process.env.ASHEN_SOURCE_HEAD||null,conditions:{browser:'system Chrome, owned CDP',cdpPort,vitePort,viewport:[1280,720],internalResolution:[1280,720],pixelRatio:1,uncapped:true,environment:'actual town, seven normal enemies, standing player, shadowless probe cohort',warmupMs:2000,seconds:12,runs:3,recording:false},cells:[],errors:[]};
const summarize=xs=>{const s=[...xs].sort((a,b)=>a-b),p=q=>s[Math.ceil(q*s.length)-1],mean=xs.reduce((a,b)=>a+b,0)/xs.length;return {frames:xs.length,meanFps:1000/mean,meanMs:mean,p50Ms:p(.5),p95Ms:p(.95),p99Ms:p(.99),maxMs:s.at(-1),over8_33:xs.filter(x=>x>8.33).length,over16_67:xs.filter(x=>x>16.67).length};};
await fs.mkdir(rawDir,{recursive:true});
const browser=await chromium.connectOverCDP(`http://127.0.0.1:${cdpPort}`);
const pages=browser.contexts()[0].pages();
const candidates=pages.filter(p=>p.url()==='about:blank'||p.url().startsWith(`http://127.0.0.1:${vitePort}/character-crowd-probe.html`));
if(candidates.length!==1)throw Error(`Expected exactly one owned tab: ${pages.map(p=>p.url()).join(', ')}`);
const page=candidates[0];
page.on('pageerror',e=>report.errors.push(e.message));
page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
try {
  await page.setViewportSize({width:1280,height:720});
  await page.goto(`http://127.0.0.1:${vitePort}/ashen-reach.html?play&clean`);
  await page.waitForFunction(()=>globalThis.ASHEN?.ready&&ASHEN.hostilesReady,null,{timeout:90000});
  await page.evaluate(()=>{
    const a=ASHEN;a.dev.god=true;a.setView('play');
    const backing=a.metrics.setInternalResolution(1280,720);
    if(backing[0]!==1280||backing[1]!==720)throw Error(`Internal resolution ${backing}`);
    a.player.setWorldPos(0,a.world.groundHeight(0,100)+1.7,100);
    a.player.setFacing(0);a.rig.yaw=0;a.rig.pitch=-.16;a.rig.distance=a.rig.distanceTarget=4;
  });
  for(const [label,count] of [['baseline',0],['vat-100',100],['vat-300',300],['after-dispose',0]]) {
    if(count) {
      await page.evaluate(async n=>{
        const {mountTownCrowd}=await import('/src/character/crowd-probe/town.js');
        globalThis.M003_TOWN?.dispose();
        globalThis.M003_TOWN=await mountTownCrowd(ASHEN,{count:n,centerZ:120});
      },count);
    } else await page.evaluate(()=>{globalThis.M003_TOWN?.dispose();globalThis.M003_TOWN=null;});
    const cell={label,count,status:await page.evaluate(()=>({canvas:[document.querySelector('canvas').width,document.querySelector('canvas').height],hostilesReady:ASHEN.hostilesReady,sceneMeshes:ASHEN.scene.meshes.length,drawCalls:ASHEN.engine.drawCallCount,submittedPieces:globalThis.M003_TOWN?.submittedPieces??0,projectedActorCenters:globalThis.M003_TOWN?.projectedActorCenters()??0})),runs:[]};
    report.cells.push(cell);
    await page.waitForTimeout(2000);
    if(report.errors.length||(await page.locator('body').innerText()).startsWith('Error\n'))throw Error(`${label}: scene error before measurement: ${report.errors.at(-1)||'in-page render-graph overlay'}`);
    if(label==='vat-100')await page.screenshot({path:'ve-capture/character-mmo/m003/town-vat-100.png'});
    for(let i=0;i<3;i++) {
      const intervals=await page.evaluate(()=>new Promise(resolve=>{
        const xs=[],start=performance.now();let last=0;
        function frame(now){if(last)xs.push(now-last);last=now;if(now-start<12000)requestAnimationFrame(frame);else resolve(xs);}
        requestAnimationFrame(frame);
      }));
      if(report.errors.length||(await page.locator('body').innerText()).startsWith('Error\n'))throw Error(`${label}: scene error during measurement: ${report.errors.at(-1)||'in-page render-graph overlay'}`);
      const name=`town-${label}-run${i+1}.json.gz`;
      await fs.writeFile(path.join(rawDir,name),gzipSync(JSON.stringify(intervals)));
      cell.runs.push({run:i+1,...summarize(intervals),drawCalls:await page.evaluate(()=>ASHEN.engine.drawCallCount),rawFile:`raw/${name}`});
      await fs.writeFile(output,JSON.stringify(report,null,2)+'\n');
    }
    console.log(JSON.stringify({label,fps:cell.runs.map(x=>+x.meanFps.toFixed(1)),p95:cell.runs.map(x=>+x.p95Ms.toFixed(1)),drawCalls:cell.runs[0].drawCalls}));
  }
} catch(e) {report.errors.push(e.stack||e.message);throw e;}
finally {
  await fs.writeFile(output,JSON.stringify(report,null,2)+'\n');
  await page.evaluate(()=>{globalThis.M003_TOWN?.dispose();globalThis.M003_TOWN=null;}).catch(()=>{});
  await page.goto('about:blank').catch(()=>{});
  await browser.close();
}
