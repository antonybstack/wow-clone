/** Ordinary saved route, with only post-play garment refinement withheld.
 * Network interception must be reached: a cached or unblocked full hood would
 * make the startup-fit check vacuous. Native body/mixer ownership stays intact.
 * https://playwright.dev/docs/network#handle-requests
 * Optional live capture uses source timestamps, separately from FPS measurement:
 * https://chromedevtools.github.io/devtools-protocol/tot/Page/#method-startScreencast
 */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {chromium} from 'playwright';
import {browserOwnership} from '../lib/browser-ownership.mjs';
import {captureSurface,appendFrame,writeCaptureManifest} from '../lib/capture-manifest.mjs';
import {defaultAppearance} from '../../src/character/appearance/store.js';
import {validateAppearance} from '../../src/character/appearance/contract.js';
import {EQUIPMENT_PRESETS} from '../../src/ashen-reach/equipment-catalog.js';
const port=process.env.ASHEN_CDP_PORT,url=process.env.ASHEN_TEST_URL;
assert(port&&url,'Require an audited owned browser and ordinary built route');
const out=process.argv[2]||'.cache/character-mmo/m5-startup-2026-10-04/live';
const motionOut=process.env.ASHEN_COMPACT_IDENTITY_MOTION_OUT;
const recordOnly=process.env.ASHEN_COMPACT_IDENTITY_RECORD_ONLY==='1';
assert(!recordOnly||motionOut,'Record-only checks require a motion output');
const motionCase=(preset,build,height)=>(preset==='prime-bald'&&build===0)||(preset==='prime-ponytail'&&height===1.15)||(preset==='weathered-bald'&&height===.9);
await fs.mkdir(out,{recursive:true});
const index=JSON.parse(await fs.readFile('public/ashen-reach/human-identity-v1/manifest.json'));
const browser=await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
assert(browser.contexts().flatMap(c=>c.pages()).every(p=>p.url()==='about:blank'),'Another owned renderer is active');
const report={url,scope:'Functional and visual compact-to-full identity refinement; no timing or FPS acceptance',rows:[],errors:[]};
const ownership=await browserOwnership(browser,{cdpPort:port,url,purpose:report.scope,renderingClients:1});
await fs.writeFile(`${out}/ownership.json`,JSON.stringify(ownership,null,2));
const state=page=>page.evaluate(()=>({
 appearance:ASHEN.getAppearance?.()??null,stored:JSON.parse(localStorage.getItem('ashen.appearance.v2')),
 gear:ASHEN.equipment.getState(),dyes:ASHEN.equipment.getDyes(),
 height:ASHEN.player.heightScale,shape:ASHEN.humanShape,physics:ASHEN.player.getDebugState().usingPhysics,
 recoveries:ASHEN.player.getDebugState().recoveries,grounded:ASHEN.player.getGrounded(),
 hair:ASHEN.scene.meshes.find(m=>m.name==='HumanPonytail01')?.visible??null,
 hoods:ASHEN.scene.meshes.filter(m=>m.name==='GraveweaverHood'&&m.visible!==false).length,
 faceMeshes:ASHEN.scene.meshes.filter(m=>['HumanIdentityEyes','HumanIdentityBrows'].includes(m.name)&&m.visible!==false).map(m=>m.name),
 gpuErrors:ASHEN.gpu.errors.slice(),detailError:ASHEN.appearanceDetailError??null,
}));
async function run(preset,build,height,mode='normal'){
 const manifest=index.presets[preset].manifest,base=defaultAppearance();
 const recipe=validateAppearance({...base,components:manifest.identity.components,
  shape:{...base.shape,height,build},equipment:{...EQUIPMENT_PRESETS.graveweaver.loadout,torso:'pilgrimTunic',shoulders:'wardenPauldrons'},
  dyes:{helmet:'moss',torso:'oxblood',legs:'indigo'}});
 // Rigid shoulders and body are already full at first play. Hold only actual
 // differing refinement URLs, never an inferred filename pattern or all assets.
 const fullUrls=new Set(Object.values(recipe.equipment).filter(id=>id&&manifest.items[id]&&manifest.items[id].url!==manifest.compactItems[id]?.url).map(id=>manifest.items[id].url));
 assert(fullUrls.has(manifest.items.graveweaverHood.url));
 const context=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1}),page=await context.newPage();
 let release;const gate=new Promise(resolve=>release=resolve),held=[],requests=[],errors=[],writes=[],timeline=[];
 let cdp,recording=false,capture,recordDir;
 const captureThis=motionOut&&mode==='normal'&&motionCase(preset,build,height);
 const mark=async name=>timeline.push({name,timestamp:Date.now()/1000,state:await state(page)});
 page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error'&&!/500 \(Internal Server Error\)/.test(m.text()))errors.push(m.text());});
 page.on('request',r=>requests.push(new URL(r.url()).pathname));
 try{
  await context.addInitScript(seed=>localStorage.setItem('ashen.appearance.v2',JSON.stringify(seed)),recipe);
  await page.route('**/*.bin',async route=>{
   const pathname=new URL(route.request().url()).pathname;
   if(fullUrls.has(pathname)){
    held.push(pathname);await gate;
    if(mode==='failure'&&pathname===manifest.items.graveweaverHood.url)return route.fulfill({status:500,body:'intentional full-detail failure'});
   }
   await route.continue();
  });
  await page.goto(url);await page.waitForFunction(()=>globalThis.ASHEN?.playableReady,null,{timeout:90000});
  const first=await state(page);
  assert(first.physics&&first.grounded);assert.equal(first.recoveries,0);assert.equal(first.hoods,1);
  assert.deepEqual(first.stored,recipe);assert.deepEqual(first.gear,recipe.equipment);assert.deepEqual(first.dyes,recipe.dyes);
  assert(first.faceMeshes.includes('HumanIdentityEyes')&&first.faceMeshes.includes('HumanIdentityBrows'));
  assert.deepEqual(first.shape.weights,[Math.max(0,-build),Math.max(0,build)]);assert.equal(first.height,height);
  assert(requests.includes(manifest.items.body.url));assert(requests.includes(manifest.compactItems.graveweaverHood.url));
  assert(!requests.some(u=>u.startsWith('/ashen-reach/startup/character/body-')),'Selected face must be present at first play');
  await page.waitForFunction(()=>ASHEN.ready,null,{timeout:90000});
  assert.deepEqual((await state(page)).appearance,recipe);
  assert(held.length>0&&held.includes(manifest.items.graveweaverHood.url),'Full detail must actually reach the held route');
  await page.evaluate(()=>{
   ASHEN.dev.god=true;ASHEN.armory.open();ASHEN.body.inspection.select('idle');ASHEN.body.inspection.setPaused(true);ASHEN.body.inspection.seek(.4);
   ASHEN.armory.setFocus({height:1.5*ASHEN.player.heightScale,radius:2.1*ASHEN.player.heightScale,beta:Math.PI/2});
   globalThis.__compactActor={container:ASHEN.body.container,groups:ASHEN.body.animationGroups.slice(),times:ASHEN.body.animationGroups.map(g=>g.currentTime),hood:ASHEN.scene.meshes.find(m=>m.name==='GraveweaverHood'&&m.visible!==false)};
  });
  await page.check('#armory [data-light]');
  const prefix=`${preset}-${height}-${build}`;
  if(captureThis){
   recordDir=path.join(motionOut,preset);await fs.mkdir(path.join(recordDir,'frames'),{recursive:true});
   capture={...await captureSurface(page),frames:[],timeline};cdp=await context.newCDPSession(page);
   cdp.on('Page.screencastFrame',e=>{
    void cdp.send('Page.screencastFrameAck',{sessionId:e.sessionId}).catch(()=>{});
    if(!recording)return;
    try{const name=`frame-${String(capture.frames.length).padStart(6,'0')}.jpg`,bytes=Buffer.from(e.data,'base64');appendFrame(capture,{name,timestamp:e.metadata.timestamp,bytes});writes.push(fs.writeFile(path.join(recordDir,'frames',name),bytes));}
    catch(e){errors.push(e.message);recording=false;}
   });
   recording=true;await cdp.send('Page.startScreencast',{format:'jpeg',quality:88,maxWidth:1280,maxHeight:720,everyNthFrame:2});
  }
  for(const [label,alpha]of [['front',Math.PI/2],['profile',0],['back',-Math.PI/2]]){
   await page.evaluate(a=>ASHEN.armory.camera.alpha=a,alpha);await mark(`Compact hood ${label}`);
   if(captureThis)await page.waitForTimeout(350);
   await page.screenshot({path:`${out}/${prefix}-compact-${label}.png`});
  }
  await page.evaluate(()=>ASHEN.armory.camera.alpha=Math.PI/2);
  if(captureThis){
   // Inspect actual deformation before release as well as the detail handover.
   // Boundary equality alone cannot establish the rest of the hood's live fit.
   await page.evaluate(()=>ASHEN.body.inspection.setPaused(false));
   // Keep the deliberate hold below the unchanged 15-second equipment timeout.
   // Recording overhead is not grounds for extending the player's load budget.
   for(const motion of ['walk','jump','fire']){await page.selectOption('#armory [data-motion]',motion);await mark(`Compact hood native ${motion}`);await page.waitForTimeout(500);}
   await page.evaluate(()=>{ASHEN.body.inspection.select('idle');ASHEN.body.inspection.setPaused(true);ASHEN.body.inspection.seek(.4);ASHEN.armory.camera.alpha=Math.PI/2;__compactActor.times=ASHEN.body.animationGroups.map(g=>g.currentTime);});
  }
  const compact=await state(page);
  if(mode==='queued'){
   await page.evaluate(()=>{globalThis.__queuedIdentity=ASHEN.creator.identity.set('weathered-bald');});
   assert.deepEqual((await state(page)).appearance,recipe,'Queued identity cannot bypass the held actor transaction');
  }
  release();
  // Same-value height queues behind the actual actorRequest refinement; no
  // artificial ready flag or fixed wait stands in for completion.
  await page.evaluate(h=>ASHEN.creator.set('height',h),height);
  if(mode==='queued')await page.evaluate(()=>globalThis.__queuedIdentity);
  const full=await state(page),native=await page.evaluate(()=>({
   bodyUnchanged:ASHEN.body.container===__compactActor.container,
   groupsUnchanged:ASHEN.body.animationGroups.every((g,i)=>g===__compactActor.groups[i]),
   timesUnchanged:ASHEN.body.animationGroups.every((g,i)=>g.currentTime===__compactActor.times[i]),
   compactHoodRetired:!ASHEN.scene.meshes.includes(__compactActor.hood),
   compactHoodStillVisible:ASHEN.scene.meshes.includes(__compactActor.hood)&&__compactActor.hood.visible!==false,
  }));
  assert(full.physics);assert.equal(full.recoveries,0);assert.equal(full.hoods,1);assert.deepEqual(full.gear,recipe.equipment);assert.deepEqual(full.dyes,recipe.dyes);
  if(mode==='queued'){
   assert.equal(await page.evaluate(()=>ASHEN.creator.identity.selected),'weathered-bald');assert(!native.bodyUnchanged);
   assert.deepEqual(full.appearance.shape,recipe.shape);
  }else{
   assert(native.bodyUnchanged&&native.groupsUnchanged&&native.timesUnchanged,'Clothing detail must preserve the actual native body and paused mixer phase');
   assert.deepEqual(full.appearance,recipe);
   if(mode==='failure'){assert(full.detailError);assert(native.compactHoodStillVisible);}
   else{assert.equal(full.detailError,null);assert(native.compactHoodRetired);}
  }
  for(const [label,alpha]of [['front',Math.PI/2],['profile',0],['back',-Math.PI/2]]){
   await page.evaluate(a=>ASHEN.armory.camera.alpha=a,alpha);await mark(`Full hood ${label}`);
   if(captureThis)await page.waitForTimeout(850);
   await page.screenshot({path:`${out}/${prefix}-full-${label}.png`});
  }
  if(captureThis){
   await page.evaluate(()=>{ASHEN.armory.camera.alpha=Math.PI/2;ASHEN.body.inspection.setPaused(false);});
   for(const motion of ['walk','run','jump','land','fire','carry']){await page.selectOption('#armory [data-motion]',motion);await mark(`Full hood native ${motion}`);await page.waitForTimeout(800);}
   await page.evaluate(()=>ASHEN.equipment.equip('helmet',null));await mark('Hood removed; selected hair restored');
   if(preset==='prime-ponytail')assert.equal((await state(page)).hair,true);
   await page.waitForTimeout(1000);
   await page.evaluate(()=>{ASHEN.armory.close();ASHEN.setView('play');ASHEN.rig.distance=ASHEN.rig.distanceTarget=2.5;});
   await mark('Normal Havok controls');await page.keyboard.down('KeyW');await page.waitForTimeout(1000);await page.keyboard.press('Space');await page.waitForTimeout(800);await page.keyboard.up('KeyW');
   await page.keyboard.press('Digit1');await page.waitForTimeout(1200);await page.keyboard.press('KeyT');await page.waitForTimeout(900);await mark('Normal walk jump cast attack complete');
   await cdp.send('Page.stopScreencast');recording=false;await Promise.all(writes);
   await writeCaptureManifest(recordDir,capture,await captureSurface(page));
   await fs.writeFile(`${recordDir}/report.json`,JSON.stringify({preset,build,height,timeline,scope:report.scope,passed:true},null,2));
  }
  assert.deepEqual(errors,[]);assert.deepEqual((await state(page)).gpuErrors,[]);assert.equal((await state(page)).recoveries,0);
  report.rows.push({preset,build,height,mode,first,compact,full,native,held,requests,errors,recordDir});
  console.log(JSON.stringify({preset,build,height,mode,passed:true,frames:capture?.frames.length}));
 }finally{
  release();recording=false;if(cdp)await cdp.send('Page.stopScreencast').catch(()=>{});await Promise.all(writes);await context.close();
  await fs.writeFile(`${out}/report.json`,JSON.stringify(report,null,2));
 }
}
try{
 for(const preset of Object.keys(index.presets))for(const [build,height]of [[0,1],[.95,.9],[-.95,1.15]])if(!recordOnly||motionCase(preset,build,height))await run(preset,build,height);
 if(!recordOnly){await run('prime-ponytail',-.95,1.15,'failure');await run('prime-ponytail',-.95,1.15,'queued');}
 report.passed=true;
}finally{
 await fs.writeFile(`${out}/report.json`,JSON.stringify(report,null,2));await browser.close();
 await fs.writeFile(`${out}/ownership.json`,JSON.stringify({...ownership,active:false,renderingClients:0},null,2));
}
