/** Actual-region exact/VAT correctness. Uses one disposable context in an
 * audited owned browser. GPU boundary tests cannot replace this live check.
 */
import {chromium} from 'playwright';import fs from 'node:fs/promises';import assert from 'node:assert/strict';
assert(process.env.ASHEN_CDP_PORT&&process.env.ASHEN_TEST_URL,'Select the audited owned harness');
const browser=await chromium.connectOverCDP(`http://127.0.0.1:${process.env.ASHEN_CDP_PORT}`);assert(browser.contexts().flatMap(c=>c.pages()).every(p=>p.url()==='about:blank'));const context=await browser.newContext({viewport:{width:1280,height:720}}),page=await context.newPage();const report={errors:[],poses:[]};page.on('pageerror',e=>report.errors.push(e.stack));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
try{
 await page.goto(process.env.ASHEN_TEST_URL);await page.waitForFunction(()=>globalThis.ASHEN?.ready&&ASHEN.hostilesReady,null,{timeout:90000});
 report.baseline=await page.evaluate(()=>({meshes:ASHEN.scene.meshes.length,casters:ASHEN.shadows.state.dynamicCasters}));
 await page.evaluate(async()=>{
  globalThis.TEST_TIME=.123;const state=await import('/src/character/region-crowd/actor-state.js');globalThis.STATE=state;
  const {createRegionCrowd}=await import('/src/character/region-crowd/renderer.js');const {decodePreparedCrowdAppearance}=await import('/src/character/crowd-probe/batches.js');const m=await (await fetch('/__region_crowd__/manifest.json')).json();
  globalThis.RECIPES=Object.fromEntries(Object.entries(m.variants).map(([k,v])=>[k,decodePreparedCrowdAppearance(v.recipe)]));
  globalThis.CROWD=await createRegionCrowd(ASHEN,{clock:()=>TEST_TIME});
  globalThis.ACTOR=state.createRegionActor({id:'match',recipe:RECIPES.wayfarer,transform:{x:0,y:ASHEN.world.groundHeight(0,65),z:65,yaw:.2},motion:{clip:'Idle_Loop',loop:true,startedAt:0,offsetSeconds:0}});
  ASHEN.metrics.setInternalResolution(1280,720);ASHEN.dev.god=true;ASHEN.player.setWorldPos(0,ASHEN.world.groundHeight(0,60)+1.7,60);ASHEN.rig.yaw=0;ASHEN.rig.pitch=.12;
 });
 for(const clip of ['Idle_Loop','Walk_Loop','Sword_Attack','Spell_Simple_Enter'])for(const at of [.123,.723,3.123,4096.123]){
  const row=await page.evaluate(async({clip,at})=>{
   TEST_TIME=at;ACTOR=STATE.setActorMotion(ACTOR,{clip,loop:clip.endsWith('Loop'),startedAt:0,offsetSeconds:0});
   const vat=await CROWD.set(ACTOR,'vat'),before=CROWD.snapshot().actors[0].sample;
   const promoted=await CROWD.set(ACTOR,'exact'),entry=CROWD.resources().actors.get('match');
   const mesh=entry.exact.meshes[0],metadata=CROWD.resources().prepared.variants.wayfarer;
   const payload=metadata.payloads[0],data=new Float32Array(await (await fetch(`/__region_crowd__/${payload.file}`)).arrayBuffer());
   const expected=data.subarray(before.row*mesh.skeleton.boneCount*16,(before.row+1)*mesh.skeleton.boneCount*16),actual=mesh.skeleton.boneMatrices;
   let maxDifference=0;for(let i=0;i<expected.length;i++)maxDifference=Math.max(maxDifference,Math.abs(expected[i]-actual[i]));
   await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
   const exactWorld=Array.from(mesh.worldMatrix),after=CROWD.snapshot().actors[0].sample,demoted=await CROWD.set(ACTOR,'vat');await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
   const pool=[...CROWD.resources().pools.values()].find(p=>p.mesh==='HumanV1Body'),prototype=pool.meshes[0],matrix=prototype.thinInstances.matrices;
   const combined=Array(16).fill(0);for(let col=0;col<4;col++)for(let row=0;row<4;row++)for(let k=0;k<4;k++)combined[col*4+row]+=matrix[k*4+row]*prototype.worldMatrix[col*4+k];
   const worldDifference=Math.max(...combined.map((v,i)=>Math.abs(v-exactWorld[i])));
   return {clip,at,before,after,maxDifference,worldDifference,exactWorld,vatWorld:combined,vat,promoted,demoted};
  },{clip,at});
  report.poses.push(row);assert.equal(row.before.row,row.after.row);assert(row.worldDifference<1e-4,`Exact/VAT mesh-world mismatch ${row.worldDifference}`);assert(row.maxDifference<1e-5,`${clip}@${at} diff ${row.maxDifference}`);
 }
 await page.screenshot({path:'.cache/crowd-region-2026-09-30/region-matched.png'});
 report.churn=await page.evaluate(async()=>{
  CROWD.remove('match');TEST_TIME=1.123;const result=[];
  for(let i=0;i<10;i++){
   const recipe=structuredClone(i%2?RECIPES.warden:RECIPES.wayfarer);if(i===8)recipe.shape={...recipe.shape,height:.9,build:.95};if(i===9)recipe.shape={...recipe.shape,height:1.15,build:-.95};
   const x=(i%5-2)*1.7,z=65+Math.floor(i/5)*2;
   const actor=STATE.createRegionActor({id:`varied-${i}`,recipe,transform:{x,y:ASHEN.world.groundHeight(x,z),z,yaw:i*.15},motion:{clip:i%3?'Walk_Loop':'Idle_Loop',loop:true,startedAt:0,offsetSeconds:i*.123}});
   result.push(await CROWD.set(actor));
  }
  const before=CROWD.snapshot();CROWD.remove('varied-4');const after=CROWD.snapshot();
  const changed=STATE.replaceActorAppearance(CROWD.get('varied-2'),RECIPES.warden,2);result.push(await CROWD.set(changed));
  for(let i=0;i<5;i++){result.push(await CROWD.set(CROWD.get('varied-3'),'exact'));result.push(await CROWD.set(CROWD.get('varied-3'),'vat'));}
  return {result,before,after,final:CROWD.snapshot()};
 });
 assert.equal(report.churn.before.count,10);assert.equal(report.churn.after.count,9);assert(report.churn.after.batches.every(b=>!b.ids.includes('varied-4')));assert(report.churn.result.every(r=>r.status==='applied'));
 await page.waitForTimeout(1500);await page.screenshot({path:'.cache/crowd-region-2026-09-30/region-varied.png'});
 report.pending=await page.evaluate(async()=>{const actor=CROWD.get('varied-3'),a=CROWD.set(actor,'exact'),b=CROWD.set(actor,'vat');return Promise.all([a,b]);});
 assert.equal(report.pending[0].status,'superseded');assert.equal(report.pending[1].status,'applied');
 report.hundred=await page.evaluate(async()=>{
  for(const a of CROWD.snapshot().actors)CROWD.remove(a.id);
  const start=performance.now();
  for(let i=0;i<100;i++){
   const x=(i%10-4.5)*1.6,z=53+Math.floor(i/10)*1.6;
   const a=STATE.createRegionActor({id:`hundred-${i}`,recipe:i%2?RECIPES.warden:RECIPES.wayfarer,transform:{x,y:ASHEN.world.groundHeight(x,z),z,yaw:i*.1},motion:{clip:i%3?'Walk_Loop':'Idle_Loop',loop:true,startedAt:0,offsetSeconds:i*.037}});
   await CROWD.set(a);
  }
  const before=CROWD.snapshot(),removed=CROWD.remove('hundred-49'),after=CROWD.snapshot();
  const resources=CROWD.resources(),textures=[...new Set([...resources.pools.values()].flatMap(p=>p.meshes.map(m=>m.vat.texture)))];
  globalThis.BUFFER_RETIRE=[];
  for(const pool of resources.pools.values())for(const m of pool.meshes)for(const name of ['_gpuBuffer','_drawArgsBuffer']){
   const b=m.thinInstances?.[name];if(!b)continue;const row={mesh:m.name,name,size:b.size,destroyed:0},destroy=b.destroy.bind(b);b.destroy=()=>{row.destroyed++;destroy();};BUFFER_RETIRE.push(row);
  }
  return {ms:performance.now()-start,before,after,removed,atlasCount:textures.length,atlasBytes:textures.reduce((n,t)=>n+t.width*t.height*16,0)};
 });
 assert.equal(report.hundred.before.count,100);assert.equal(report.hundred.after.count,99);assert(report.hundred.after.batches.every(b=>!b.ids.includes('hundred-49')));
 await page.waitForTimeout(1000);await page.screenshot({path:'.cache/crowd-region-2026-09-30/region-hundred.png'});
 report.directDraws=await page.evaluate(()=>[...CROWD.resources().pools.values()].flatMap(p=>p.meshes.map(m=>({name:m.name,count:m.thinInstances.count,expected:p.ids.length,indirect:Boolean(m.thinInstances._drawArgsBuffer)}))));assert(report.directDraws.every(m=>m.count===m.expected&&!m.indirect));
 report.gpuErrors=await page.evaluate(()=>ASHEN.gpu.errors);assert.deepEqual(report.errors,[]);assert.deepEqual(report.gpuErrors,[]);
 await page.evaluate(()=>CROWD.dispose());await page.waitForTimeout(1500);report.retirement=await page.evaluate(()=>BUFFER_RETIRE);assert(report.retirement.every(b=>b.destroyed===1));report.after=await page.evaluate(()=>({meshes:ASHEN.scene.meshes.length,casters:ASHEN.shadows.state.dynamicCasters,vat:ASHEN.scene.meshes.filter(m=>m.vat).length}));assert.deepEqual(report.after,{...report.baseline,vat:0});
}catch(e){report.failure=e.stack;process.exitCode=1;console.error(e);}finally{await context.close();await browser.close();await fs.writeFile(process.argv[2]||'.cache/crowd-region-2026-09-30/region-correctness.json',JSON.stringify(report,null,2));console.log(JSON.stringify({errors:report.errors,failure:report.failure,poses:report.poses.map(r=>({clip:r.clip,at:r.at,diff:r.maxDifference})),after:report.after}));}
