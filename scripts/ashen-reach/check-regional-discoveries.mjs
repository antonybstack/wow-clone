/** Five out-of-order regional reading/escape cases. Each starts at an existing
 * public Developer entrance; all subsequent movement and interactions are native.
 * Timestamped capture includes the declared navigation/loading transitions. */
import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {CDP_URL} from '../lib/cdp.mjs';
import {browserOwnership} from '../lib/browser-ownership.mjs';
import {captureSurface,appendFrame,writeCaptureManifest} from '../lib/capture-manifest.mjs';
const url=new URL(process.env.ASHEN_TEST_URL||'http://127.0.0.1:7074/');
for(const [key,value] of [['dev',''],['play',''],['clean',''],['at','north-tower'],['pixelRatio','1']])url.searchParams.set(key,value);
const dir=process.env.ASHEN_CAPTURE_DIR||'.cache/regional-discoveries',record=process.env.ASHEN_RECORD==='1';
const exploration=true;
if(exploration)url.searchParams.delete('clean');
await fs.mkdir(dir+'/frames',{recursive:true});
const browser=await chromium.connectOverCDP(CDP_URL);
assert(browser.contexts().flatMap(c=>c.pages()).every(p=>p.url()==='about:blank'),'Blank the owned harness first');
const ownership=await browserOwnership(browser,{cdpPort:new URL(CDP_URL).port,url:url.href,purpose:'G16 five ordinary entry/read/repeat/escape cases with labelled Developer entrances, map read flags and actual reload; no FPS claim',renderingClients:1});
await fs.writeFile(dir+'/ownership.json',JSON.stringify(ownership,null,2));
const context=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1}),page=await context.newPage();
const errors=[],report={url:url.href,errors,samples:[],contacts:[],initialPlacement:'public developer spawn link only'};
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
const state=()=>page.evaluate(()=>{const p=ASHEN.player,d=p.getDebugState();return{x:p.body.position.x,y:p.body.position.y,z:p.body.position.z,feet:p.body.position.y-p.capsuleHeight/2,facing:p.getFacing(),physics:d.usingPhysics,recoveries:d.recoveries,flying:p.isFlying(),god:ASHEN.dev.god};});
let initialRecoveries,site,cdp,manifest,captureError;const writes=[];
function valid(s,label){assert(s.physics&&!s.flying&&Number.isFinite(s.y),label);if(exploration)assert(!s.god,label+': God mode enabled');assert.equal(s.recoveries,initialRecoveries,label+': recovery teleport');}
async function face(yaw){
 const start=Date.now();
 for(;;){const s=await state(),error=Math.atan2(Math.sin(yaw-s.facing),Math.cos(yaw-s.facing));if(Math.abs(error)<.04)break;
  assert(Date.now()-start<10000,'Native turn did not converge');const key=error>0?'d':'a';await page.keyboard.down(key);await page.waitForTimeout(Math.max(12,Math.min(150,Math.abs(error)/2.55*1000)));await page.keyboard.up(key);
 }
}
async function go(point,label){
 let s=await state(),distance=Math.hypot(point[0]-s.x,point[2]-s.z),best=distance,last=Date.now(),start=last;
 while(distance>.4){
  const desired=Math.atan2(point[0]-s.x,point[2]-s.z),error=Math.atan2(Math.sin(desired-s.facing),Math.cos(desired-s.facing));
  if(Math.abs(error)>.045){await page.keyboard.up('w');await face(desired);}
  else{await page.keyboard.down('w');await page.waitForTimeout(Math.min(150,Math.max(20,(distance-.3)/7*1000)));}
  s=await state();valid(s,label);distance=Math.hypot(point[0]-s.x,point[2]-s.z);
  if(distance<best-.12){best=distance;last=Date.now();}
  assert(Date.now()-last<5000&&Date.now()-start<60000,`Blocked ${label}: ${JSON.stringify({s,point,distance})}`);
 }
 await page.keyboard.up('w');await page.waitForTimeout(120);s=await state();valid(s,label);
 assert(Math.abs(s.feet-point[1])<.3,`${label}: expected floor ${point[1]}, actual ${s.feet}`);
 report.samples.push({label,target:point,...s});await fs.writeFile(dir+'/report.json',JSON.stringify(report,null,2));return s;
}
async function stopCapture(){if(!manifest)return;await cdp.send('Page.stopScreencast');cdp.removeAllListeners('Page.screencastFrame');await Promise.all(writes);if(captureError)throw captureError;await writeCaptureManifest(dir,manifest,await captureSurface(page));manifest=null;}
let start,expected=[];
try{
 const allCases=[['north-tower','bell-watch-view'],['south-keep','southwatch-account'],['east-tower','ash-tower-view'],['west-keep','westwatch-account'],['west-tower','moor-tower-view']];
 const selected=process.env.ASHEN_DISCOVERY_SITES?.split(',');if(selected)assert(selected.every(id=>allCases.some(([site])=>id===site)));const cases=selected?allCases.filter(([id])=>selected.includes(id)):allCases;
 for(const [index,[id,discovery]]of cases.entries()){
  url.searchParams.set('at',id);await page.goto(url.href);await page.waitForFunction(()=>globalThis.ASHEN?.ready&&ASHEN.navigationReady&&ASHEN.hostilesReady&&ASHEN.combat?.exploration,null,{timeout:120000});
  site=await page.evaluate(id=>ASHEN.world.regionStructures.destinations.find(s=>s.id===id),id);const anchor=site.discoveries.find(a=>a.id===discovery);assert(anchor);
  await page.keyboard.press('Escape');await page.getByRole('button',{name:'Developer tools',exact:true}).click();const god=page.locator('[data-action="god"]');if(await god.getAttribute('aria-pressed')==='true')await god.click();await page.keyboard.press('Escape');
  initialRecoveries=(await state()).recoveries;assert.equal(initialRecoveries,0);start=await state();valid(start,id);report.samples.push({label:id+':developer-entrance',...start});
  if(record&&!manifest){manifest={version:1,...await captureSurface(page),frames:[],markers:{}};cdp=await context.newCDPSession(page);cdp.on('Page.screencastFrame',e=>{cdp.send('Page.screencastFrameAck',{sessionId:e.sessionId}).catch(()=>{});if(!manifest||captureError)return;try{const bytes=Buffer.from(e.data,'base64'),name=`frame-${String(manifest.frames.length).padStart(5,'0')}.jpg`;appendFrame(manifest,{name,timestamp:e.metadata.timestamp,bytes});writes.push(fs.writeFile(dir+'/frames/'+name,bytes).catch(e=>captureError=e));}catch(e){captureError=e;}});await cdp.send('Page.startScreencast',{format:'jpeg',quality:88,maxWidth:1280,maxHeight:720,everyNthFrame:8});}
  // Each native navigation starts at its existing public developer entrance.
  if(site.courtyard)await go(site.courtyard,id+':courtyard');await go(site.hall,id+':hall');await go(anchor.stand,id+':reading');await face(anchor.heading);await page.waitForTimeout(600);
  await page.waitForFunction(id=>ASHEN.combat.exploration.snapshot().candidate===id,discovery);
  if(manifest)manifest.markers[discovery]=Date.now()/1000;await page.screenshot({path:dir+'/'+discovery+'.png'});
  const before=await page.evaluate(()=>{const s=ASHEN.combat.snapshot();return {progress:s.progress,objective:s.objective};});
  await page.keyboard.press('KeyX');await page.waitForFunction(()=>ASHEN.menu.isOpen);assert(await page.locator(`[data-discovery="${discovery}"]`).isVisible());
  expected.push(discovery);const saved=await page.evaluate(()=>ASHEN.combat.exploration.snapshot().record);assert.equal(saved.phase,'unstarted');assert.deepEqual(saved.discovered,[...expected].sort());assert.deepEqual(await page.evaluate(()=>{const s=ASHEN.combat.snapshot();return {progress:s.progress,objective:s.objective};}),before);await page.waitForTimeout(900);
  await page.locator('[data-action="journal-region-map"]').click();assert.equal(await page.locator(`[data-map-destination="${id}"]`).getAttribute('data-read'),'true');assert.match(await page.locator(`[data-map-destination="${id}"]`).innerText(),/Read/);await page.locator(`[data-map-destination="${id}"]`).click();assert.equal(await page.locator(`[data-map-destination="${id}"]`).getAttribute('aria-pressed'),'true');assert.equal(await page.locator('[data-map-destination="east-keep"]').getAttribute('data-read'),'false');await page.screenshot({path:dir+'/'+discovery+'-map.png'});await page.waitForTimeout(900);await page.keyboard.press('Escape');
  await page.keyboard.press('KeyX');await page.waitForFunction(()=>ASHEN.menu.isOpen);assert.deepEqual(await page.evaluate(()=>ASHEN.combat.exploration.snapshot().record),saved);await page.keyboard.press('Escape');await page.waitForTimeout(300);assert.match(await page.locator('#exploration-prompt button').innerText(),/Read again/);
  if(site.courtyard){await go(site.hall,id+':hall-return');await go(site.courtyard,id+':court-return');}await go(site.entrance,id+':escape');const end=await state();valid(end,id);await page.waitForTimeout(700);
  (report.discoveries??=[]).push({id,discovery,anchor,start,end,record:saved,unchangedInteractionCombat:before});console.log('PASS',id,discovery);
 }
 await stopCapture();await page.reload();await page.waitForFunction(()=>globalThis.ASHEN?.ready&&ASHEN.navigationReady&&ASHEN.hostilesReady&&ASHEN.combat?.exploration,null,{timeout:120000});report.reload=await page.evaluate(()=>ASHEN.combat.exploration.snapshot().record);assert.equal(report.reload.phase,'unstarted');assert.deepEqual(report.reload.discovered,[...expected].sort());
 await page.keyboard.press('Escape');await page.getByRole('button',{name:'Region map',exact:true}).click();for(const [id]of cases){assert.equal(await page.locator(`[data-map-destination="${id}"]`).getAttribute('data-read'),'true');assert(await page.locator(`[data-map-destination="${id}"]`).isEnabled());}await page.screenshot({path:dir+'/persisted-map.png'});
 report.gpuErrors=await page.evaluate(()=>ASHEN.gpu.errors);assert.deepEqual(errors,[]);assert.deepEqual(report.gpuErrors,[]);report.passed=true;
}catch(error){report.failure=error.stack;await page.screenshot({path:dir+'/failure.png'}).catch(()=>{});throw error;}
finally{
 for(const key of ['w','a','d'])await page.keyboard.up(key).catch(()=>{});await cdp?.send('Page.stopScreencast').catch(()=>{});await Promise.all(writes);
 try{if(manifest&&manifest.frames.length>=2&&!captureError)await writeCaptureManifest(dir,manifest,await captureSurface(page));}catch(error){captureError??=error;}
 if(captureError){report.captureFailure=captureError.stack;report.passed=false;}
 try{await fs.writeFile(dir+'/report.json',JSON.stringify(report,null,2));}finally{await context.close();await browser.close();await fs.writeFile(dir+'/ownership.json',JSON.stringify({...ownership,active:false,renderingClients:0},null,2));}
}
if(captureError)throw captureError;
console.log(JSON.stringify({passed:report.passed,cases:report.discoveries?.length,errors}));
