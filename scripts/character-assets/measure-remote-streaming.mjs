/** Remote appearance streaming and promotion latency, measured apart from frame cost.
 *
 * measure-remote-pieces.mjs answers what committed owners cost per frame. It does not answer
 * how long an appearance takes to arrive, which is the other half of the gate and is the
 * part a seat actually waits on. measure-production-promotion.mjs covers the *local* player's
 * promotion only.
 *
 * One owned renderer, no recording, no encoders, no FPS claim. Cold rows use a fresh page so
 * the immutable cache and the browser's own HTTP cache are both empty; warm rows reuse that
 * page. Times are wall clock around the public upsert, which is what a caller observes.
 */
import fs from 'node:fs/promises';import os from 'node:os';import assert from 'node:assert/strict';import {chromium} from 'playwright';
import {browserOwnership} from '../lib/browser-ownership.mjs';
const port=process.env.ASHEN_CDP_PORT,url=process.env.ASHEN_TEST_URL,out=process.argv[2];assert(port&&url&&out);
const browser=await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
assert(browser.contexts().flatMap(c=>c.pages()).every(p=>p.url()==='about:blank'),'Another page is already open');
const ownership=await browserOwnership(browser,{cdpPort:port,url,purpose:'Remote appearance streaming/promotion latency; no FPS claim',renderingClients:1});
const report={conditions:{cpu:os.cpus()[0].model,url,viewport:[1280,720],recording:false,renderingClients:1,
 note:'Wall clock around upsert. Cold rows are a fresh page (empty immutable and HTTP caches); warm rows reuse it.'},rows:[],errors:[]};
await fs.writeFile(out+'.ownership.json',JSON.stringify(ownership,null,2));
const bootstrap=async page=>{
 await page.goto(url);await page.waitForFunction(()=>globalThis.ASHEN?.ready&&ASHEN.hostilesReady&&ASHEN.getAppearance,null,{timeout:120000});
 await page.evaluate(async()=>{
  const {createRemotePieceActors}=await import('/src/character/remote-pieces/renderer.js');
  globalThis.REMOTE=await createRemotePieceActors(ASHEN);globalThis.baseRecipe=structuredClone(ASHEN.getAppearance());
  globalThis.actorInput=(id,race='human',preset='duskguard',revision=1,shape)=>{
   const recipe=structuredClone(baseRecipe);recipe.race=race;
   recipe.fitFamily=race==='human'?baseRecipe.fitFamily:{orc:'ashen-orc',undead:'ashen-undead'}[race];
   recipe.shape=race==='human'?{...baseRecipe.shape,...(shape||{build:.95,height:1.15})}:{};
   recipe.equipment={helmet:null,torso:null,legs:null,boots:null,gloves:null,mainHand:null,offHand:null,shoulders:null,...ASHEN.equipment.presets[preset].loadout};
   const x=-5+(Number(String(id).replace(/\D/g,''))%4)*3;
   return {id,recipe,appearanceRevision:revision,transform:{x,y:ASHEN.world.groundHeight(x,-61),z:-61,yaw:Math.PI},motion:{clip:'Walk_Loop',loop:true,startedAt:0,offsetSeconds:0}};
  };
  globalThis.timed=async fn=>{const t=performance.now();const value=await fn();return {ms:performance.now()-t,value};};
  ASHEN.dev.god=true;ASHEN.player.setWorldPos(0,ASHEN.world.groundHeight(0,-65)+1.7,-65);ASHEN.rig.yaw=0;ASHEN.rig.pitch=-.1;ASHEN.rig.distance=ASHEN.rig.distanceTarget=14;ASHEN.setView('play');
 });
};
const page_=async()=>{const c=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1}),p=await c.newPage();
 p.on('pageerror',e=>report.errors.push(e.stack));p.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});return {context:c,page:p};};
const push=(label,race,ms,extra)=>{report.rows.push({case:label,race,ms,...extra});};
try{
 // Cold: one fresh page per race, so nothing of that race is cached anywhere.
 for(const race of ['human','orc','undead']){
  const {context,page}=await page_();
  try{
   await bootstrap(page);
   const cold=await page.evaluate(async race=>{const r=await timed(()=>REMOTE.upsert(actorInput('cold-0',race)));return {ms:r.ms,status:r.value.status,streaming:REMOTE.streaming()};},race);
   push('cold-first-of-race',race,cold.ms,{status:cold.status,cacheEntries:cold.streaming.immutable.entries,reservedBytes:cold.streaming.immutable.reservedBytes});
   // Warm: same race again after the owner is retired; bytes are cached, decode is not.
   const warm=[];
   for(let i=0;i<5;i++){
    const w=await page.evaluate(async race=>{await REMOTE.remove('cold-0');const r=await timed(()=>REMOTE.upsert(actorInput('cold-0',race)));return {ms:r.ms,status:r.value.status};},race);
    warm.push(w.ms);assert.equal(w.status,'applied');
   }
   push('warm-restage-same-race',race,Math.min(...warm),{samples:warm.map(v=>Number(v.toFixed(1))),median:Number(warm.sort((a,b)=>a-b)[2].toFixed(1))});
   // Same-body equipment change: the reuse path, no restage.
   const swaps=[];
   for(let i=0;i<5;i++){
    const preset=['duskguard','lector','graveweaver','pilgrim','wayfarer'][i];
    const s=await page.evaluate(async({race,preset,rev})=>{const r=await timed(()=>REMOTE.upsert(actorInput('cold-0',race,preset,rev)));return {ms:r.ms,status:r.value.status,bodyLoads:REMOTE.streaming().stats.bodyLoads,changes:REMOTE.streaming().stats.liveEquipmentChanges};},{race,preset,rev:i+2});
    swaps.push(s.ms);assert.equal(s.status,'applied');
   }
   push('same-body-equipment-change',race,Math.min(...swaps),{samples:swaps.map(v=>Number(v.toFixed(1))),median:Number(swaps.sort((a,b)=>a-b)[2].toFixed(1))});
   await page.evaluate(()=>REMOTE.dispose());
  }finally{await context.close();}
 }
 // Eight concurrent promotions on one fresh page: what a seat burst actually costs.
 {
  const {context,page}=await page_();
  try{
   await bootstrap(page);
   const burst=await page.evaluate(async()=>{
    const started=performance.now();
    const results=await Promise.all(Array.from({length:8},(_,i)=>REMOTE.upsert(actorInput(`burst-${i}`,['human','orc','undead'][i%3],['duskguard','lector','graveweaver','pilgrim','wayfarer'][i%5]))));
    return {ms:performance.now()-started,statuses:results.map(r=>r.status),snapshot:REMOTE.snapshot(),streaming:REMOTE.streaming()};
   });
   push('eight-concurrent-promotions','mixed',burst.ms,{statuses:burst.statuses,committed:burst.snapshot.count,
    queue:burst.streaming.queue,preparations:burst.streaming.stats.preparations.map(v=>Number(v.toFixed(1))),
    peakReservedBytes:burst.streaming.immutable.peakReservedBytes,ceilingBytes:burst.streaming.immutable.ceilingBytes});
   assert.equal(burst.snapshot.count,8);assert.ok(burst.statuses.every(s=>s==='applied'));
   const after=await page.evaluate(async()=>{await REMOTE.dispose();return {streaming:REMOTE.streaming(),gpuErrors:ASHEN.gpu.errors.slice()};});
   assert.equal(after.streaming.owned,0);assert.deepEqual(after.gpuErrors,[]);
  }finally{await context.close();}
 }
 assert.deepEqual(report.errors,[]);report.passed=true;
}catch(error){report.failure=error.stack;process.exitCode=1;console.error(error);}
finally{
 await fs.writeFile(out,JSON.stringify(report,null,2)+'\n');await browser.close();
 await fs.writeFile(out+'.ownership.json',JSON.stringify({...ownership,active:false,renderingClients:0},null,2));
 console.log(JSON.stringify({passed:report.passed,failure:report.failure?.split('\n')[0],rows:report.rows.map(r=>({case:r.case,race:r.race,ms:Number(r.ms.toFixed(1)),median:r.median}))},null,1));
}
