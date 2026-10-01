/** Isolated single-appearance windows; use an audited uncapped harness, with no
 * recording or competing renderer. Native same-fit weights must avoid builds.
 * https://github.com/BabylonJS/Babylon-Lite/blob/npm-lite-v1.31.1/docs/lite/architecture/14-morph-targets.md
 */
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {summarizeFrameIntervals} from './summarize-frame-intervals.mjs';
const port=process.env.ASHEN_CDP_PORT,url=process.env.ASHEN_TEST_URL,out=process.argv[2];
assert(port&&url&&out);
const browser=await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
assert(browser.contexts().flatMap(c=>c.pages()).every(p=>p.url()==='about:blank'));
const context=await browser.newContext({viewport:{width:1280,height:720}}),page=await context.newPage();
const report={url,viewport:[1280,720],recording:false,rows:[],errors:[]};
page.on('pageerror',e=>report.errors.push(e.stack));
page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
try {
 await page.goto(url);await page.waitForFunction(()=>ASHEN?.ready&&ASHEN.hostilesReady,null,{timeout:90000});
 report.initial=await page.evaluate(async()=>{
  const {createRegionCrowd}=await import('/src/character/region-crowd/renderer.js');
  const {REGION_ACTOR_RELEASE}=await import('/src/character/region-crowd/release.js');
  globalThis.STATE=await import('/src/character/region-crowd/actor-state.js');
  const {decodePreparedCrowdAppearance}=await import('/src/character/crowd-probe/batches.js');
  globalThis.CROWD=await createRegionCrowd(ASHEN,REGION_ACTOR_RELEASE);
  globalThis.RECIPES=Object.fromEntries(Object.entries(CROWD.resources().prepared.manifest.variants).map(([k,v])=>[k,decodePreparedCrowdAppearance(v.recipe)]));
  ASHEN.metrics.setInternalResolution(1280,720);ASHEN.dev.god=true;ASHEN.setView('play');
  ASHEN.player.setWorldPos(0,ASHEN.world.groundHeight(0,75)+1.7,75);ASHEN.rig.yaw=0;ASHEN.rig.pitch=-.16;
  const actor=STATE.createRegionActor({id:'target',recipe:RECIPES.wayfarer,transform:{x:2,y:ASHEN.world.groundHeight(2,82),z:82,yaw:0},motion:{clip:'Idle_Loop',loop:true,startedAt:CROWD.now(),offsetSeconds:0}});
  await CROWD.set(actor,'exact',{priority:1});return CROWD.streaming();
 });
 await page.waitForTimeout(3000);
 for(let i=0;i<30;i++){
  const kind=i<20?'same-fit':'different-fit';
  await page.evaluate(()=>ASHEN.renderLoop.beginMeasurement());
  const row=await page.evaluate(async({i,kind})=>{
   const old=CROWD.get('target'),recipe=kind==='same-fit'?{...old.recipe,shape:{...old.recipe.shape,build:i%2?.95:-.95}}:{...RECIPES[i%2?'wayfarer':'warden'],shape:old.recipe.shape};
   const before=CROWD.streaming(),t=performance.now();
   const result=await CROWD.set(STATE.replaceActorAppearance(old,recipe,old.appearanceRevision+1),'exact',{priority:1});
   return {kind,index:i,result,convergenceMs:performance.now()-t,before,after:CROWD.streaming()};
  },{i,kind});
  await page.waitForTimeout(500);
  row.frames=await page.evaluate(()=>ASHEN.renderLoop.endMeasurement());
  row.tails=summarizeFrameIntervals(row.frames);report.rows.push(row);
  assert.equal(row.result.status,'applied');
  if(kind==='same-fit')assert.equal(row.after.stats.exactLoads,row.before.stats.exactLoads);
 }
 await page.evaluate(()=>CROWD.dispose());report.final=await page.evaluate(()=>({streaming:CROWD.streaming(),gpu:ASHEN.gpu.errors,physics:ASHEN.player.getDebugState().usingPhysics}));
 assert.equal(report.final.streaming.owned,0);assert(report.final.physics);assert.deepEqual(report.final.gpu,[]);assert.deepEqual(report.errors,[]);
 report.passed=true;
}catch(e){report.failure=e.stack;process.exitCode=1;console.error(e);}finally{await page.evaluate(()=>globalThis.CROWD?.dispose()).catch(()=>{});await fs.writeFile(out,JSON.stringify(report,null,2));await context.close();await browser.close();}
