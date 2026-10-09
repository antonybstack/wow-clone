/** Native controls with optional work deliberately withheld. No private placement.
 * Worker transport fault injection is confined to fresh test contexts.
 */
import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {brotliDecompressSync} from 'node:zlib';
import {createArcRotateCamera,getViewMatrix,getViewProjectionMatrix,projectWorldToScreen} from '@babylonjs/lite';
import {CDP_URL} from '../lib/cdp.mjs';
import {browserOwnership} from '../lib/browser-ownership.mjs';
const base=process.env.ASHEN_TEST_URL||'http://127.0.0.1:5173/ashen-reach.html?dev&play&clean&fastStart&pixelRatio=1';
const dir=process.env.ASHEN_CAPTURE_DIR||'.cache/region-readiness';
await fs.mkdir(dir,{recursive:true});
const browser=await chromium.connectOverCDP(CDP_URL);
assert(browser.contexts().flatMap(c=>c.pages()).every(p=>p.url()==='about:blank'),'Blank the owned harness first');
const ownership=await browserOwnership(browser,{cdpPort:new URL(CDP_URL).port,url:base,purpose:'Navigation/full-region boundaries, held foliage/combat, failure/disposal; no FPS claim',renderingClients:1});
await fs.writeFile(`${dir}/ownership.json`,JSON.stringify(ownership,null,2));
const report={url:base,checks:[],errors:[]};
const state=page=>page.evaluate(()=>({navigationReady:ASHEN.navigationReady,regionReady:ASHEN.regionReady,combatReady:ASHEN.combatReady,ready:ASHEN.ready,physics:ASHEN.player.getDebugState(),marks:ASHEN.startup.timings(),position:[ASHEN.player.body.position.x,ASHEN.player.body.position.y,ASHEN.player.body.position.z],height:ASHEN.player.capsuleHeight}));
async function pane(page){
 const locked=await page.evaluate(()=>!!document.pointerLockElement);
 await page.keyboard.press('Escape');
 if(locked){await page.waitForTimeout(250);await page.keyboard.press('Escape');}
 await page.getByRole('button',{name:'Developer tools',exact:true}).click();
}
async function setup({mode='hold',at,legacy=false,holdCombat=false,holdTexture=false,packet=false}={}){
 const context=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 let releaseCombat=()=>{},releaseTexture=()=>{},releaseFoliage=()=>{},textureHeld=false;
 const manifest=JSON.parse(await fs.readFile('public/ashen-reach/startup/starter/manifest.json'));
 if(!packet&&manifest.geometry.region){
  const fallback=structuredClone(manifest);delete fallback.geometry.region;
  await context.route('**/ashen-reach/startup/starter/manifest.json',route=>route.fulfill({json:fallback}));
 }
 if(packet){
  assert(manifest.geometry.region,'Prepare region packets before the packet controls');
  const index=JSON.parse(brotliDecompressSync(await fs.readFile('public/ashen-reach/startup/starter/'+manifest.geometry.region.file)));
  if(mode==='hold'){
   const held=new Promise(r=>{releaseFoliage=r;});
   await context.route(`**/ashen-reach/startup/starter/${index.foliage.file}`,async route=>{await held;await route.continue().catch(()=>{});});
  }
  if(mode==='mismatch'){
   index.meshes[0].name='X'.repeat(index.meshes[0].name.length);
   await context.route(`**/ashen-reach/startup/starter/${manifest.geometry.region.file}`,route=>route.fulfill({contentType:'application/json',body:JSON.stringify(index)}));
  }
  if(mode==='dispose'){
   const held=new Promise(r=>{releaseFoliage=r;});
   await context.route(`**/ashen-reach/startup/starter/${index.geometry.file}`,async route=>{await held;await route.continue().catch(()=>{});});
  }
  if(mode==='foliage-failure'){
   let requests=0;
   await context.route(`**/ashen-reach/startup/starter/${index.foliage.file}`,async route=>{
    if(++requests===1)await route.fulfill({status:503,body:'Deliberate grass response failure'});
    else await route.continue();
   });
  }
 }
 if(holdCombat){const held=new Promise(r=>{releaseCombat=r;});await context.route('**/src/ashen-reach/combat.js*',async route=>{await held;await route.continue().catch(()=>{});});}
 if(holdTexture){
  const held=new Promise(r=>{releaseTexture=r;});
  await context.route(`**${manifest.surfaces[0].url}`,async route=>{textureHeld=true;await held;await route.continue().catch(()=>{});});
 }
 await page.addInitScript(({mode})=>{
  const Native=window.Worker,held=[];
  window.regionReadinessTest={held:0,released:false,foliageFailed:false,workerStarts:[]};
  window.releaseRegionReadiness=()=>{regionReadinessTest.released=true;for(const f of held.splice(0))f();};
  window.Worker=class extends Native{
   constructor(url,options){super(url,options);this.region=String(url).includes('world-worker');}
   postMessage(data,...args){if(this.region&&data.start)regionReadinessTest.workerStarts.push({foliageOnly:!!data.foliageOnly});return super.postMessage(data,...args);}
   set onmessage(handler){super.onmessage=event=>{
    if(this.region&&mode==='mismatch'&&event.data.header){handler({data:{header:{meshes:[]}}});return;}
    if(this.region&&mode==='hold'&&!regionReadinessTest.released&&(event.data.foliage||event.data.done)){
     regionReadinessTest.held++;held.push(()=>handler(event));return;
    }
    if(this.region&&mode==='foliage-failure'&&!regionReadinessTest.foliageFailed&&(event.data.foliage||event.data.done)){
     if(event.data.foliage){
      const fail=()=>{if(!window.ASHEN?.navigationReady){setTimeout(fail,20);return;}regionReadinessTest.foliageFailed=true;handler({data:{error:'Deliberate grass worker failure'}});};fail();
     }
     return;
    }
    handler(event);
   };}
  };
 },{mode:packet?'pass':mode});
 const url=new URL(base);if(at)url.searchParams.set('at',at);if(legacy){url.searchParams.delete('fastStart');url.searchParams.set('legacyStart','');}
 try{
  await page.goto(url.href,{waitUntil:'commit'});await page.waitForFunction(()=>window.ASHEN?.playableReady,null,{timeout:120000});
  return {context,page,errors,releaseCombat,releaseTexture,async releaseFoliage(){releaseFoliage();await page.evaluate(()=>releaseRegionReadiness());},get textureHeld(){return textureHeld;}};
 }catch(error){releaseCombat();releaseTexture();releaseFoliage();await context.close();throw error;}
}
async function surfaceClick(page){
 const data=await page.evaluate(()=>{const c=ASHEN.camera;return {alpha:c.alpha,beta:c.beta,radius:c.radius,target:{x:c.target.x,y:c.target.y,z:c.target.z},fov:c.fov,near:c.nearPlane,far:c.farPlane,floorY:ASHEN.world.cathedral.floorY};});
 const c=createArcRotateCamera(data.alpha,data.beta,data.radius,data.target);c.fov=data.fov;c.nearPlane=data.near;c.farPlane=data.far;
 const p=projectWorldToScreen({x:.8,y:data.floorY,z:313.5},getViewMatrix(c),getViewProjectionMatrix(c,1280/720),{viewport:{x:0,y:0,width:1280,height:720},backingWidth:1280,backingHeight:720});
 assert(!p.clipped&&p.x>120&&p.x<1160&&p.y>100&&p.y<630,'Nave floor is visible');
 const before=await state(page);await page.mouse.click(p.x,p.y);await page.waitForTimeout(300);const after=await state(page);
 assert(after.physics.usingPhysics&&after.physics.recoveries===before.physics.recoveries);
 assert(Math.hypot(after.position[0]-before.position[0],after.position[2]-before.position[2])>.1,'Actual click moved the player');
 assert(after.position[1]-after.height/2>data.floorY,'Actual click remains above nave floor');
 return {before,after};
}
try{
 // Optional combat and foliage are held simultaneously: navigation must use neither.
 let test;
 for(const packet of [false,true]){
 test=await setup({holdCombat:true,holdTexture:true,packet});
 try{
  const {page}=test;await pane(page);
  assert(await page.getByRole('button',{name:'God mode: on',exact:true}).isEnabled(),'Tools exist before combat');
  await page.getByLabel('Destination',{exact:true}).selectOption('cathedral-nave');
  assert(!await page.getByRole('button',{name:'Jump to destination',exact:true}).isEnabled(),'No early collision jump');
  await page.waitForFunction(()=>ASHEN.navigationReady,null,{timeout:120000});
  const early=await state(page);assert(!early.regionReady&&!early.ready&&!early.combatReady);
  assert(await page.getByRole('button',{name:'Jump to destination',exact:true}).isEnabled());
  assert.match(await page.locator('[data-dev-status]').innerText(),/Details are still loading/);
  await page.screenshot({path:`${dir}/routes-ready-details-pending.jpg`});
  await page.getByRole('button',{name:'Jump to destination',exact:true}).click();await page.waitForTimeout(700);
  const grounded=await state(page),floor=await page.evaluate(()=>ASHEN.world.cathedral.floorY);
  assert(grounded.physics.grounded&&grounded.physics.usingPhysics&&grounded.physics.recoveries===0);
  assert(Math.abs(grounded.position[1]-grounded.height/2-floor)<.25);
  await page.keyboard.down('KeyW');await page.waitForTimeout(500);await page.keyboard.up('KeyW');
  const walked=await state(page);assert(Math.hypot(walked.position[0]-grounded.position[0],walked.position[2]-grounded.position[2])>.5);
  await pane(page);await page.getByRole('button',{name:'Jump to destination',exact:true}).click();await page.waitForTimeout(400);
  await pane(page);await page.getByRole('button',{name:'Fly mode: off',exact:true}).click();await page.keyboard.press('Escape');await page.waitForTimeout(350);
  const click=await surfaceClick(page);
  await pane(page);await page.getByRole('button',{name:'Fly mode: on',exact:true}).click();await page.keyboard.press('Escape');
  test.releaseCombat();await test.releaseFoliage();
  const waitUntil=Date.now()+10000;while(!test.textureHeld&&Date.now()<waitUntil)await page.waitForTimeout(50);
  assert(test.textureHeld,'Enhancement request was actually held');
  const texturePending=await state(page);assert(texturePending.navigationReady&&!texturePending.regionReady&&!texturePending.ready);
  test.releaseTexture();
  await page.waitForFunction(()=>ASHEN.ready,null,{timeout:120000});
  const complete=await state(page);assert(complete.regionReady&&complete.combatReady&&complete.navigationReady);
  assert(complete.physics.recoveries===0);assert.deepEqual(test.errors,[]);assert.deepEqual(await page.evaluate(()=>ASHEN.gpu.errors),[]);
  report.checks.push({name:`${packet?'Prepared packet':'Worker fallback'}: early tools; guarded Jump; navigation before held combat/foliage; actual jump/walk/surface click; held enhancement remains optional; full readiness after release`,early,grounded,walked,click,texturePending,complete});
 }finally{test.releaseCombat();test.releaseTexture();await test.releaseFoliage();await test.context.close();}
 }
 test=await setup({at:'cathedral-undercroft',packet:true});
 try{
  await test.page.waitForFunction(()=>ASHEN.navigationReady&&Math.abs(ASHEN.player.body.position.z-ASHEN.world.cathedral.exploration.undercroft.route.find(p=>p[1]===ASHEN.world.cathedral.exploration.undercroft.floorY&&p[0]>ASHEN.world.cathedral.exploration.undercroft.bounds.minX&&p[0]<ASHEN.world.cathedral.exploration.undercroft.bounds.maxX&&p[2]>ASHEN.world.cathedral.exploration.undercroft.bounds.minZ&&p[2]<ASHEN.world.cathedral.exploration.undercroft.bounds.maxZ)[2])<.5,null,{timeout:120000});
  await test.page.waitForTimeout(700);const s=await state(test.page);assert(!s.ready&&s.physics.grounded&&s.physics.recoveries===0);assert.deepEqual(test.errors,[]);
  report.checks.push({name:'Spawn link reaches undercroft before held foliage/full readiness',state:s});
 }finally{await test.releaseFoliage();await test.context.close();}
 for(const packet of [false,true]){
 test=await setup({mode:'mismatch',packet});
 try{
  await test.page.waitForFunction(()=>ASHEN.backgroundError,null,{timeout:120000});await pane(test.page);
  const s=await state(test.page);assert(!s.navigationReady&&!s.regionReady);assert(!await test.page.getByRole('button',{name:'Jump to destination',exact:true}).isEnabled());
  report.checks.push({name:`${packet?'Prepared packet':'Worker fallback'}: failed collision/header cannot unlock navigation`,state:s,expectedErrors:test.errors});
 }finally{await test.context.close();}
 }
 for(const packet of [false,true]){
 test=await setup({mode:'foliage-failure',packet});
 try{
  await test.page.waitForFunction(()=>ASHEN.backgroundError,null,{timeout:120000});
  const before=await test.page.evaluate(()=>({navigationReady:ASHEN.navigationReady,blocks:ASHEN.world.streaming.blocks,colliders:ASHEN.world.colliders.length,fence:ASHEN.world.meshes.some(m=>m.name==='Opening paths fence')}));
  assert(before.navigationReady&&!before.fence);
  await test.page.getByRole('button',{name:'Retry loading',exact:true}).click();
  await test.page.waitForFunction(()=>ASHEN.ready,null,{timeout:120000});
  const after=await test.page.evaluate(()=>({navigationReady:ASHEN.navigationReady,blocks:ASHEN.world.streaming.blocks,colliders:ASHEN.world.colliders.length,fence:ASHEN.world.meshes.some(m=>m.name==='Opening paths fence'),starts:regionReadinessTest.workerStarts}));
  assert.equal(after.blocks,before.blocks);assert.equal(after.colliders,before.colliders);assert(after.navigationReady&&!after.fence);
  if(!packet)assert.deepEqual(after.starts,[{foliageOnly:false},{foliageOnly:true}]);
  assert.equal((await state(test.page)).physics.recoveries,0);
  report.checks.push({name:`${packet?'Prepared stream':'Worker'}: late grass retry preserves open routes and collision without reinstalling geometry`,before,after,expectedErrors:test.errors});
 }finally{await test.context.close();}
 }
 test=await setup({packet:true,mode:'dispose'});
 try{
  const results=await test.page.evaluate(async()=>{const promises=[ASHEN.whenNavigation,ASHEN.whenRegion];ASHEN.dispose();return (await Promise.allSettled(promises)).map(r=>({status:r.status,reason:r.reason?.message}));});
  assert(results.every(r=>r.status==='rejected'));report.checks.push({name:'Disposal rejects pending readiness without unlocking navigation',results});
 }finally{await test.releaseFoliage();await test.context.close();}
 test=await setup({legacy:true,holdCombat:true});
 try{
  await test.page.waitForFunction(()=>ASHEN.navigationReady,null,{timeout:120000});const s=await state(test.page);assert(!s.combatReady&&s.physics.usingPhysics);await pane(test.page);
  assert(await test.page.getByRole('button',{name:'Jump to destination',exact:true}).isEnabled());assert.deepEqual(test.errors,[]);
  report.checks.push({name:'Full-world diagnostic establishes navigation before optional combat',state:s});
 }finally{test.releaseCombat();await test.context.close();}
 report.passed=true;
}catch(error){report.failure=error.stack;throw error;
}finally{await fs.writeFile(`${dir}/report.json`,JSON.stringify(report,null,2));await browser.close();await fs.writeFile(`${dir}/ownership.json`,JSON.stringify({...ownership,active:false,renderingClients:0},null,2));}
console.log(`PASS: ${report.checks.length} native region-readiness controls`);
