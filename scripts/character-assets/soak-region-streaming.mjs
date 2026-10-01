/** Isolated appearance churn endurance. No video, encoding or workers while
 * sampling. Raw frame intervals remain separate from one-time capture evidence.
 */
import fs from 'node:fs/promises';import assert from 'node:assert/strict';import {chromium} from 'playwright';import {execFileSync} from 'node:child_process';
import {summarizeFrameIntervals} from './summarize-frame-intervals.mjs';
const port=process.env.ASHEN_CDP_PORT,url=process.env.ASHEN_TEST_URL,out=process.argv[2],seconds=Number(process.env.ASHEN_SOAK_SECONDS||1800);assert(port&&url&&out&&seconds>=30);
const browser=await chromium.connectOverCDP(`http://127.0.0.1:${port}`);assert(browser.contexts().flatMap(c=>c.pages()).every(p=>p.url()==='about:blank'));
const context=await browser.newContext({viewport:{width:1280,height:720}}),page=await context.newPage(),cdp=await context.newCDPSession(page),report={conditions:{url,seconds,resolution:[1280,720],enemies:7,recording:false,cpu:'M1 Max',profile:'native network; cold sources checked separately at 10 Mbit/s / 80 ms'},errors:[],rows:[]};page.on('pageerror',e=>report.errors.push(e.stack));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
try{
 await page.goto(url);await page.waitForFunction(()=>ASHEN?.ready&&ASHEN.hostilesReady,null,{timeout:90000});
 await page.evaluate(async()=>{
  globalThis.REGION=await import('/src/character/region-crowd/renderer.js');globalThis.STATE=await import('/src/character/region-crowd/actor-state.js');const {decodePreparedCrowdAppearance}=await import('/src/character/crowd-probe/batches.js');globalThis.CROWD=await REGION.createRegionCrowd(ASHEN);globalThis.RECIPES=Object.fromEntries(Object.entries(CROWD.resources().prepared.manifest.variants).map(([k,v])=>[k,decodePreparedCrowdAppearance(v.recipe)]));ASHEN.metrics.setInternalResolution(1280,720);ASHEN.dev.god=true;ASHEN.setView('play');ASHEN.rig.yaw=0;ASHEN.rig.pitch=.12;globalThis.makeActor=(id,i,build=0)=>STATE.createRegionActor({id,recipe:{...RECIPES[i%2?'warden':'wayfarer'],shape:{...RECIPES.wayfarer.shape,build,height:i%2?1.15:.9}},transform:{x:(i-3.5)*1.6,y:ASHEN.world.groundHeight((i-3.5)*1.6,67),z:67,yaw:i*.1},motion:{clip:i%2?'Walk_Loop':'Idle_Loop',loop:true,startedAt:CROWD.now(),offsetSeconds:i*.1}});
 });
 await cdp.send('Performance.enable');const start=Date.now();let cycle=0;
 while(Date.now()-start<seconds*1000){
  const row=await page.evaluate(async cycle=>{
   for(const actor of CROWD.snapshot().actors)CROWD.remove(actor.id);ASHEN.player.setWorldPos(0,ASHEN.world.groundHeight(0,60)+1.7,60);const before={x:ASHEN.player.body.position.x,z:ASHEN.player.body.position.z,recoveries:ASHEN.player.getDebugState().recoveries};ASHEN.renderLoop.beginMeasurement();
   const arrived=await Promise.all(Array.from({length:8},(_,i)=>CROWD.set(makeActor(`cycle-${i}`,i,i%2?-.95:.95),'exact',{priority:i===0?0:i<3?1:2})));
   const peak=CROWD.streaming();for(let i=0;i<6;i++)CROWD.remove(`cycle-${i}`);
   for(let j=0;j<4;j++){const actor=CROWD.get('cycle-6'),recipe={...RECIPES[j%2?'warden':'wayfarer'],shape:{...actor.recipe.shape,build:j%2?-.6:.6}};await CROWD.set(STATE.replaceActorAppearance(actor,recipe,actor.appearanceRevision+1),'exact',{priority:0});}
   const actor=CROWD.get('cycle-7'),p=CROWD.set(STATE.replaceActorAppearance(actor,RECIPES.wayfarer,actor.appearanceRevision+1),'vat'),q=CROWD.set(STATE.replaceActorAppearance(actor,RECIPES.warden,actor.appearanceRevision+2),'vat');const supersede=await Promise.all([p,q]);
   return {cycle,arrived,peak,supersede,before};
  },cycle);
  await page.keyboard.down('KeyW');await page.waitForTimeout(800);await page.keyboard.up('KeyW');await page.keyboard.down('KeyS');await page.waitForTimeout(800);await page.keyboard.up('KeyS');
  const end=await page.evaluate(()=>{for(const a of CROWD.snapshot().actors)CROWD.remove(a.id);return {intervals:ASHEN.renderLoop.endMeasurement(),idle:CROWD.streaming(),recoveries:ASHEN.player.getDebugState().recoveries,physics:ASHEN.player.getDebugState().usingPhysics,gpuErrors:ASHEN.gpu.errors,meshes:ASHEN.scene.meshes.length};});
  assert(row.arrived.every(r=>r.status==='applied'));assert(row.supersede[0].status==='superseded'&&row.supersede[1].status==='applied');assert(end.physics);assert.equal(end.recoveries,row.before.recoveries);assert.equal(end.idle.idleExact,2);assert.equal(end.idle.owned,4);assert.equal(end.idle.queue.pending,0);assert.deepEqual(end.gpuErrors,[]);
  const perf=await cdp.send('Performance.getMetrics');row.jsHeapBytes=perf.metrics.find(m=>m.name==='JSHeapUsedSize')?.value;row.atSeconds=(Date.now()-start)/1000;Object.assign(row,end);row.tails=summarizeFrameIntervals(end.intervals);report.rows.push(row);
  if(cycle%10===0){row.processes=execFileSync('ps',['-axo','pid=,ppid=,rss=,%cpu=,command='],{encoding:'utf8'}).split('\n').filter(l=>l.includes('/tmp/ashen-cdp-9837'));await fs.writeFile(out,JSON.stringify(report,null,2));console.log(JSON.stringify({cycle,seconds:row.atSeconds,heap:row.jsHeapBytes,alloc:row.idle.allocation,max:row.tails.maxMs}));}
  cycle++;await page.waitForTimeout(13000);
 }
 report.elapsedSeconds=(Date.now()-start)/1000;report.cycles=cycle;await page.evaluate(()=>CROWD.dispose());await page.waitForTimeout(2000);report.final=await page.evaluate(()=>CROWD.streaming());assert.equal(report.final.owned,0);assert.equal(report.final.immutable.reservedBytes,0);assert.deepEqual(report.errors,[]);report.passed=true;
}catch(e){report.failure=e.stack;process.exitCode=1;console.error(e);}finally{for(const key of ['KeyW','KeyS'])await page.keyboard.up(key).catch(()=>{});await page.evaluate(()=>globalThis.CROWD?.dispose()).catch(()=>{});await fs.writeFile(out,JSON.stringify(report,null,2));await context.close();await browser.close();}
