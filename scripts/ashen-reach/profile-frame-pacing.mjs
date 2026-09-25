/** Diagnostic CPU profiler; its frame times are NOT an uninstrumented benchmark. */
import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import {CDP_URL} from '../lib/cdp.mjs';
const dir=process.env.ASHEN_CAPTURE_DIR||'ve-capture/ashen-reach/v17/profile';await fs.mkdir(dir,{recursive:true});
if(process.env.ASHEN_UNCAPPED!=='1')throw Error('Run profiling in an isolated uncapped harness slot');
const b=await chromium.connectOverCDP(CDP_URL),harnessPage=b.contexts()[0].pages().find(p=>p.url().includes('ashen-reach.html'));
if(!harnessPage)throw Error('Isolated harness game page missing');
const previousUrl=harnessPage.url();await harnessPage.goto('about:blank');
const c=await b.newContext({viewport:{width:1280,height:720}}),p=await c.newPage(),cdp=await c.newCDPSession(p);
await p.addInitScript(()=>{window.__pipelines=[];const original=GPUDevice.prototype.createRenderPipeline;GPUDevice.prototype.createRenderPipeline=function(...args){const start=performance.now(),out=original.apply(this,args);__pipelines.push({start,ms:performance.now()-start,label:args[0].label});return out;};window.__longFrames=[];try{new PerformanceObserver(l=>__longFrames.push(...l.getEntries().map(e=>({start:e.startTime,duration:e.duration,blocking:e.blockingDuration,scripts:e.scripts?.map(s=>({duration:s.duration,source:s.sourceURL,fn:s.sourceFunctionName}))})))).observe({type:'long-animation-frame',buffered:true});}catch{}});
try{
 await p.goto(process.env.ASHEN_URL||'http://127.0.0.1:5173/ashen-reach.html?play&clean',{waitUntil:'commit'});await p.waitForFunction(()=>window.ASHEN?.ready&&ASHEN.hostilesReady,null,{timeout:120000});
 await p.evaluate(()=>{const a=ASHEN;a.dev.god=true;a.metrics.setInternalResolution(1280,720);a.player.setWorldPos(0,a.world.groundHeight(0,80)+1.7,80);a.rig.yaw=0;a.player.setFacing(0);});await p.waitForTimeout(1500);
 await cdp.send('Profiler.enable');await cdp.send('Profiler.setSamplingInterval',{interval:1000});await cdp.send('Profiler.start');
 await p.evaluate(()=>{window.__start=performance.now();window.__frames=[];let last=__start;window.__profiling=true;function sample(t){if(!__profiling)return;__frames.push(t-last);last=t;requestAnimationFrame(sample);}requestAnimationFrame(sample);});
 for(const yaw of [0,Math.PI,0]){await p.evaluate(yaw=>{ASHEN.rig.yaw=yaw;ASHEN.player.setFacing(yaw);},yaw);await p.keyboard.down('KeyW');await p.waitForTimeout(5000);await p.keyboard.up('KeyW');}
 const {profile}=await cdp.send('Profiler.stop');const report=await p.evaluate(()=>{__profiling=false;return {frames:__frames,pipelines:__pipelines.filter(x=>x.start>=__start),longFrames:__longFrames.filter(x=>x.start>=__start),heap:performance.memory?{used:performance.memory.usedJSHeapSize,total:performance.memory.totalJSHeapSize}:null,local:ASHEN.localLights.state,position:{x:ASHEN.player.body.position.x,z:ASHEN.player.body.position.z},enemies:ASHEN.combat.enemies.length};});
 const nodes=new Map(profile.nodes.map(n=>[n.id,n]));const times=new Map();profile.samples.forEach((id,i)=>times.set(id,(times.get(id)||0)+(profile.timeDeltas[i]||0)));
 report.cpuTop=[...times].sort((a,b)=>b[1]-a[1]).slice(0,35).map(([id,us])=>({ms:us/1000,...nodes.get(id).callFrame}));report.profilerEnabled=true;
 await fs.writeFile(`${dir}/cpu.cpuprofile`,JSON.stringify(profile));await fs.writeFile(`${dir}/report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify({...report,frames:{count:report.frames.length,worst:Math.max(...report.frames)},longFrames:report.longFrames.slice(0,12)}));
}finally{await p.keyboard.up('KeyW').catch(()=>{});await c.close();await harnessPage.goto(previousUrl,{waitUntil:'commit'});await b.close();}
