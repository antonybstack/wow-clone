/** Same walking-camera waypoints before/after G13, plus ordinary crypt return.
 * Initial Developer nave placement and saved bell phase are labelled fixtures;
 * screenshots/recording are separate from final isolated FPS measurements. */
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {CDP_URL} from '../lib/cdp.mjs';
import {browserOwnership} from '../lib/browser-ownership.mjs';
import {appendFrame,captureSurface,writeCaptureManifest} from '../lib/capture-manifest.mjs';
const dir=process.env.ASHEN_CAPTURE_DIR||'.cache/vaelmark-expedition-2026-10-09/g13-before';
const base=process.env.ASHEN_TEST_URL||'http://127.0.0.1:5873/';
await fs.mkdir(`${dir}/frames`,{recursive:true});
const browser=await chromium.connectOverCDP(CDP_URL);
assert(browser.contexts().flatMap(c=>c.pages()).every(p=>p.url()==='about:blank'));
const owner=await browserOwnership(browser,{cdpPort:new URL(CDP_URL).port,url:base,purpose:'G13 matched ordinary undercroft viewpoints and return; labelled saved bell-rung setup; no FPS claim',renderingClients:1});
await fs.writeFile(`${dir}/ownership.json`,JSON.stringify(owner,null,2));
const report={cases:[],errors:[]};let context,page,cdp,manifest,captureError;const writes=[];
const state=()=>page.evaluate(()=>({x:ASHEN.player.body.position.x,y:ASHEN.player.body.position.y,z:ASHEN.player.body.position.z,facing:ASHEN.player.getFacing(),feet:ASHEN.player.body.position.y-ASHEN.player.capsuleHeight/2,god:ASHEN.dev.god,flying:ASHEN.dev.flying,physics:ASHEN.player.getDebugState().usingPhysics,recoveries:ASHEN.player.getDebugState().recoveries}));
async function go(point){
 let s=await state(),distance=Math.hypot(point[0]-s.x,point[2]-s.z),best=distance,progress=Date.now(),start=Date.now();
 assert(Number.isFinite(s.facing),'Navigation fixture needs the native facing getter');
 while(distance>.35){const desired=Math.atan2(point[0]-s.x,point[2]-s.z),error=Math.atan2(Math.sin(desired-s.facing),Math.cos(desired-s.facing));
  if(Math.abs(error)>.045){await page.keyboard.up('KeyW');const key=error>0?'KeyD':'KeyA';await page.keyboard.down(key);await page.waitForTimeout(Math.max(12,Math.min(150,Math.abs(error)/2.55*1000)));await page.keyboard.up(key);}
  else{await page.keyboard.down('KeyW');await page.waitForTimeout(Math.min(150,Math.max(20,(distance-.2)/7*1000)));}
  s=await state();assert(s.physics&&!s.god&&!s.flying);distance=Math.hypot(point[0]-s.x,point[2]-s.z);if(distance<best-.1){best=distance;progress=Date.now();}
  if(Date.now()-progress>5000||Date.now()-start>45000)throw Error(`Blocked ${JSON.stringify(s)} toward ${JSON.stringify(point)}`);
 }await page.keyboard.up('KeyW');assert(Math.abs(s.feet-point[1])<.8,`Missed authored level ${JSON.stringify(point)}: ${JSON.stringify(s)}`);return s;
}
async function mortal(){await page.keyboard.press('Escape');await page.locator('[data-action="developer-tools"]').click();const b=page.locator('[data-action="god"]');if(await b.getAttribute('aria-pressed')==='true')await b.click();await page.keyboard.press('Escape');}
async function boot(at){const u=new URL(base);u.searchParams.set('dev','');u.searchParams.set('play','');u.searchParams.set('at',at);await page.goto(u.href);await page.waitForFunction(()=>globalThis.ASHEN?.ready&&ASHEN.navigationReady&&ASHEN.hostilesReady&&ASHEN.combat?.exploration.snapshot().reliquary,null,{timeout:120000});await page.evaluate(()=>ASHEN.metrics.setInternalResolution(1280,720));await mortal();await page.waitForTimeout(400);}
async function face(yaw){for(let i=0;i<50;i++){const s=await state(),error=Math.atan2(Math.sin(yaw-s.facing),Math.cos(yaw-s.facing));if(Math.abs(error)<.045)return;const key=error>0?'KeyD':'KeyA';await page.keyboard.down(key);await page.waitForTimeout(Math.max(12,Math.min(150,Math.abs(error)/2.55*1000)));await page.keyboard.up(key);}throw Error('Could not face the memorial with ordinary input');}
async function setup(){
 context=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1});
 await context.addInitScript(()=>localStorage.setItem('ashen.exploration.v1',JSON.stringify({version:1,episode:'vaelmark-bell-v1',phase:'bell-rung',discovered:['vaelmark-inscription','vaelmark-bell']})));
 page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
}
async function shot(name,yaw){
 await face(yaw);await page.waitForTimeout(700);await page.screenshot({path:`${dir}/${name}.png`});
 report.views??=[];report.views.push({name,player:await state(),runtime:await page.evaluate(()=>({rig:{yaw:ASHEN.rig.yaw,pitch:ASHEN.rig.pitch,distance:ASHEN.rig.distance},lights:ASHEN.localLights.state,exploration:ASHEN.combat.exploration.snapshot()}))});
 if(manifest)manifest.markers[name]=Date.now()/1000;
}
try{
 await setup();await boot('cathedral-nave');const start=await state();
 const a=await page.evaluate(()=>({fy:ASHEN.world.cathedral.floorY,crypt:ASHEN.world.cathedral.exploration.undercroft}));
 const steps=[],capture=process.env.ASHEN_READABILITY_CAPTURE==='1';
 if(capture){
  manifest={version:1,...await captureSurface(page),frames:[],markers:{}};cdp=await context.newCDPSession(page);
  cdp.on('Page.screencastFrame',e=>{cdp.send('Page.screencastFrameAck',{sessionId:e.sessionId}).catch(()=>{});if(captureError)return;try{const bytes=Buffer.from(e.data,'base64'),name=`frame-${String(manifest.frames.length).padStart(5,'0')}.jpg`;appendFrame(manifest,{name,timestamp:e.metadata.timestamp,bytes});writes.push(fs.writeFile(`${dir}/frames/${name}`,bytes).catch(e=>{captureError??=e;}));}catch(e){captureError??=e;}});
  await cdp.send('Page.startScreencast',{format:'jpeg',quality:88,maxWidth:1280,maxHeight:720,everyNthFrame:8});
 }
 for(const p of a.crypt.route.slice(0,3))steps.push(await go(p));await shot('stair-mouth',0);
 for(const p of a.crypt.route.slice(3,6))steps.push(await go(p));await shot('corridor-turn',Math.PI/2);
 for(const p of a.crypt.route.slice(6,9))steps.push(await go(p));steps.push(await go(a.crypt.memorial.stand));await shot('memorial',Math.PI/2);
 assert.equal(await page.evaluate(()=>ASHEN.combat.exploration.snapshot().reliquary.relicVisible),true);
 if(capture){await page.waitForTimeout(1500);await page.keyboard.press('KeyX');await page.waitForFunction(()=>ASHEN.menu.isOpen&&ASHEN.combat.exploration.snapshot().record.phase==='relic-claimed');await page.waitForTimeout(1500);await page.keyboard.press('Escape');}
 for(const p of [[-10,a.crypt.floorY,334],...a.crypt.route.slice(12)])steps.push(await go(p));await shot('nave-return',Math.PI);
 const end=await state();assert.equal(end.recoveries,start.recoveries);assert(steps.every(s=>s.recoveries===start.recoveries));assert.deepEqual(await page.evaluate(()=>ASHEN.gpu.errors),[]);assert.deepEqual(report.errors,[]);
 assert(report.views.every(v=>v.runtime.lights.budget===2));
 report.cases.push({case:'ordinary nave/descent/corner/memorial/return',initialDeveloperNaveSetup:true,labelledSavedBellPhase:true,ordinaryCameraNoOrbit:true,start,end,steps});report.passed=true;
}catch(e){report.failure=e.stack;await page?.screenshot({path:`${dir}/failure.png`}).catch(()=>{});throw e;}
finally{
 // A manifest error must not skip closing the owned renderer. Preserve failed
 // recordings with their original timestamps rather than inventing new ones.
 try{
  if(cdp){await cdp.send('Page.stopScreencast').catch(()=>{});await Promise.all(writes);if(!captureError&&manifest.frames.length>=2)await writeCaptureManifest(dir,manifest,await captureSurface(page));}
 }catch(e){captureError??=e;}
 finally{
  if(captureError){report.captureFailure=captureError.stack;report.passed=false;}
  for(const k of ['KeyW','KeyA','KeyD'])await page?.keyboard.up(k).catch(()=>{});await context?.close();await browser.close();await fs.writeFile(`${dir}/report.json`,JSON.stringify(report,null,2));await fs.writeFile(`${dir}/ownership.json`,JSON.stringify({...owner,active:false,renderingClients:0},null,2));
 }
}
if(captureError)throw captureError;
console.log(JSON.stringify({passed:report.passed,views:report.views?.length,frames:manifest?.frames.length,errors:report.errors}));
