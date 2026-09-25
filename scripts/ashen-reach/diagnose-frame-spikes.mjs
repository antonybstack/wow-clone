/** Production scheduler diagnostics: --seconds=12, using an isolated game harness.
 * API timings include instrumentation overhead; use measure-scene-fps for acceptance.
 * Historical queue-depth/frame-cap experiments belong to docs/v19-frame-spikes-plan.md.
 * This script never replaces the production render loop or submission policy.
 */
import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import {CDP_URL} from '../lib/cdp.mjs';
import {summarizeDurations} from '../../src/ashen-reach/metrics.js';
const dir=process.env.ASHEN_CAPTURE_DIR||'ve-capture/ashen-reach/v19/diagnostic';
const arg=name=>process.argv.find(s=>s.startsWith(`--${name}=`))?.split('=')[1];
for(const name of ['queue-depth','frame-rate','wake-on-complete']){
 if(process.argv.some(s=>s===`--${name}`||s.startsWith(`--${name}=`)))
  throw Error(`--${name} is retired; this diagnostic measures ASHEN.renderLoop. See docs/v19-frame-spikes-plan.md for historical experiments.`);
}
const seconds=Number(arg('seconds')??12);
if(!Number.isFinite(seconds)||seconds<=0)throw Error('--seconds must be positive and finite');
await fs.mkdir(dir,{recursive:true});
const browser=await chromium.connectOverCDP(CDP_URL),home=browser.contexts()[0].pages().find(p=>p.url().includes('ashen-reach'));
if(!home)throw Error('Use isolated game harness');
const url=home.url();await home.goto('about:blank');
const context=await browser.newContext({viewport:{width:1280,height:720}}),page=await context.newPage();
try{
 await page.addInitScript(()=>{
  window.__diagnostic={active:false,slow:[],calls:{},apiMs:{},apiMaxMs:{},bytes:0,pipelines:[]};
  function wrap(proto,name){const original=proto[name];proto[name]=function(...args){
   const d=__diagnostic;if(!d.active)return original.apply(this,args);
   const start=performance.now(),out=original.apply(this,args),ms=performance.now()-start;
   d.calls[name]=(d.calls[name]||0)+1;
   d.apiMs[name]=(d.apiMs[name]||0)+ms;
   d.apiMaxMs[name]=Math.max(d.apiMaxMs[name]||0,ms);
   if(name==='writeBuffer'){
    // Typed-array offsets/sizes are elements; ArrayBuffer/DataView use bytes.
    const data=args[2],unit=data.BYTES_PER_ELEMENT||1;
    d.bytes+=args[4]===undefined?data.byteLength-(args[3]??0)*unit:args[4]*unit;
   }
   if(name==='createRenderPipeline')d.pipelines.push({start,ms,label:args[0].label});
   if(ms>4)d.slow.push({name,start,ms,label:args[0]?.label||this.label||'',stack:new Error().stack});
   return out;
  };}
  for(const name of ['writeBuffer','writeTexture','submit'])wrap(GPUQueue.prototype,name);
  for(const name of ['createBuffer','createRenderPipeline'])wrap(GPUDevice.prototype,name);
  wrap(GPUCommandEncoder.prototype,'finish');
 });
 await page.goto(process.env.ASHEN_URL||url,{waitUntil:'commit'});
 await page.waitForFunction(()=>window.ASHEN?.ready&&ASHEN.hostilesReady,null,{timeout:120000});
 await page.evaluate(()=>{
  const a=ASHEN;
  if(!a.renderLoop?.beginMeasurement||!a.renderLoop?.endMeasurement)throw Error('ASHEN.renderLoop measurement API required');
  a.dev.god=true;a.metrics.setInternalResolution(1280,720);
  a.player.setWorldPos(0,a.world.groundHeight(0,80)+1.7,80);a.player.setFacing(0);a.rig.yaw=0;
 });
 await page.keyboard.down('KeyW');await page.waitForTimeout(1500);
 await page.evaluate(()=>{
  const d=__diagnostic,loop=ASHEN.renderLoop;
  if(document.hidden||loop.state.error)throw Error('Visible, healthy production render loop required');
  d.schedulerStart={...loop.state,error:null};d.startedAt=performance.now();
  loop.beginMeasurement();d.active=true;
 });
 await page.waitForTimeout(seconds*1000);
 const report=await page.evaluate(()=>{
  const d=__diagnostic,loop=ASHEN.renderLoop;d.active=false;
  const endedAt=performance.now(),frames=loop.endMeasurement();
  return {...d,endedAt,elapsedMs:endedAt-d.startedAt,frames,
   schedulerEnd:{...loop.state,error:loop.state.error?String(loop.state.error):null},
   hiddenAtEnd:document.hidden,
   position:{x:ASHEN.player.body.position.x,z:ASHEN.player.body.position.z},summary:ASHEN.metrics.summary()};
 });
 await page.keyboard.up('KeyW');
 report.frameSummary=summarizeDurations(report.frames);
 report.scheduler={maxPending:report.schedulerEnd.maxPending,
  rendered:report.schedulerEnd.rendered-report.schedulerStart.rendered,
  waits:report.schedulerEnd.waits-report.schedulerStart.waits};
 report.measurement={source:'ASHEN.renderLoop',instrumented:true,requestedSeconds:seconds,
  note:'frames are actual render deltas; API timings are synchronous call costs, not GPU or total render durations. First delta can straddle measurement start. Scheduler pending counts unacknowledged submissions, not exact GPU queue depth.'};
 await fs.writeFile(`${dir}/report.json`,JSON.stringify(report,null,2));
 console.log(JSON.stringify({frames:report.frameSummary,elapsedMs:report.elapsedMs,scheduler:report.scheduler,
  calls:report.calls,apiMs:report.apiMs,apiMaxMs:report.apiMaxMs,bytes:report.bytes,pipelines:report.pipelines.length,
  slow:report.slow.map(s=>({name:s.name,ms:s.ms,label:s.label,stack:s.stack?.split('\n').slice(1,4)}))}));
 if(!report.frames.length||report.schedulerEnd.error||report.hiddenAtEnd)throw Error('Invalid diagnostic window: no renders, scheduler error or hidden document; inspect report.json');
}finally{await page.keyboard.up('KeyW').catch(()=>{});await context.close();await home.goto(url,{waitUntil:'commit'});await browser.close();}
