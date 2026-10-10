/** Focused ordinary input/UI play and failure checks. Diagnostic setup is named;
 * capture is separate from uncapped throughput measurement. */
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {CDP_URL} from '../lib/cdp.mjs';
import {browserOwnership} from '../lib/browser-ownership.mjs';
import {appendFrame,captureSurface,writeCaptureManifest} from '../lib/capture-manifest.mjs';
const dir=process.env.ASHEN_CAPTURE_DIR||'.cache/vaelmark-expedition-2026-10-09/g10-native';
const url=process.env.ASHEN_TEST_URL||'http://127.0.0.1:5873/?dev&play&at=cathedral-undercroft';
await fs.mkdir(`${dir}/frames`,{recursive:true});
const browser=await chromium.connectOverCDP(CDP_URL);
assert(browser.contexts().flatMap(c=>c.pages()).every(p=>p.url()==='about:blank'),'Another game context is active');
const ownership=await browserOwnership(browser,{cdpPort:new URL(CDP_URL).port,url,purpose:'G10 native memorial/journal motion and failure checks; no FPS claim',renderingClients:1});
await fs.writeFile(`${dir}/ownership.json`,JSON.stringify(ownership,null,2));
const context=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1});
const page=await context.newPage(),errors=[],frames=[],writes=[],report={errors,cases:[]};let cdp,manifest,captureError;
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
await page.addInitScript(()=>{window.__gpuErrors=[];const request=GPUAdapter.prototype.requestDevice;GPUAdapter.prototype.requestDevice=async function(...args){const device=await request.apply(this,args);device.addEventListener('uncapturederror',e=>__gpuErrors.push(e.error.message));return device;};});
const position=()=>page.evaluate(()=>({x:ASHEN.player.body.position.x,y:ASHEN.player.body.position.y,z:ASHEN.player.body.position.z,facing:ASHEN.player.getMotion().facing??ASHEN.player.body.rotation.y,physics:ASHEN.player.getDebugState().usingPhysics,recoveries:ASHEN.player.getDebugState().recoveries}));
async function walkTo(point){
 let state=await position(),distance=Math.hypot(point[0]-state.x,point[2]-state.z),best=distance,lastProgress=Date.now(),start=Date.now();
 while(distance>.35){
  const desired=Math.atan2(point[0]-state.x,point[2]-state.z),error=Math.atan2(Math.sin(desired-state.facing),Math.cos(desired-state.facing));
  if(Math.abs(error)>.045){await page.keyboard.up('KeyW');const key=error>0?'KeyD':'KeyA';await page.keyboard.down(key);await page.waitForTimeout(Math.max(12,Math.min(150,Math.abs(error)/2.55*1000)));await page.keyboard.up(key);}
  else{await page.keyboard.down('KeyW');await page.waitForTimeout(Math.min(150,Math.max(20,(distance-.2)/7*1000)));}
  state=await position();assert(state.physics);distance=Math.hypot(point[0]-state.x,point[2]-state.z);
  if(distance<best-.1){best=distance;lastProgress=Date.now();}
  if(Date.now()-lastProgress>5000||Date.now()-start>45000)throw Error(`Blocked at ${JSON.stringify(state)} toward ${JSON.stringify(point)}`);
 }
 await page.keyboard.up('KeyW');return state;
}
async function mortal(){await page.keyboard.press('Escape');await page.locator('[data-action="developer-tools"]').click();const button=page.locator('[data-action="god"]');if(await button.getAttribute('aria-pressed')==='true')await button.click();await page.keyboard.press('Escape');}
async function entry(){await page.goto(url);await page.waitForFunction(()=>globalThis.ASHEN?.ready&&ASHEN.navigationReady&&ASHEN.hostilesReady&&ASHEN.combat?.exploration,null,{timeout:120000});await page.evaluate(()=>ASHEN.metrics.setInternalResolution(1280,720));await mortal();await page.waitForTimeout(500);}
try{
 await entry();const start=await position();
 assert.equal(await page.evaluate(()=>ASHEN.combat.exploration.snapshot().record.phase),'unstarted');
 manifest={version:1,...await captureSurface(page),frames};cdp=await context.newCDPSession(page);
 cdp.on('Page.screencastFrame',e=>{cdp.send('Page.screencastFrameAck',{sessionId:e.sessionId}).catch(()=>{});if(captureError)return;try{const name=`frame-${String(frames.length).padStart(5,'0')}.jpg`,bytes=Buffer.from(e.data,'base64');if(appendFrame(manifest,{name,timestamp:e.metadata.timestamp,bytes}))writes.push(fs.writeFile(`${dir}/frames/${name}`,bytes).catch(error=>{captureError??=error;}));}catch(error){captureError??=error;}});
 await cdp.send('Page.startScreencast',{format:'jpeg',quality:90,maxWidth:1280,maxHeight:720,everyNthFrame:4});
 const crypt=await page.evaluate(()=>ASHEN.world.cathedral.exploration.undercroft);
 assert(crypt.memorial);await walkTo([-10,crypt.floorY,334]);await walkTo(crypt.memorial.stand);
 await page.waitForFunction(()=>!document.querySelector('#exploration-prompt').hidden);
 await page.screenshot({path:`${dir}/memorial-prompt.png`});
 await page.waitForTimeout(1000);
 await page.keyboard.press('KeyX');
 await page.waitForFunction(()=>ASHEN.menu.isOpen&&ASHEN.combat.exploration.snapshot().record.phase==='inscription-read');
 assert(await page.locator('[data-exploration-journal] [data-discovery="vaelmark-inscription"]').isVisible());
 assert.match(await page.locator('[data-exploration-journal]').innerText(),/western bell/);
 await page.screenshot({path:`${dir}/journal.png`});await page.waitForTimeout(2500);
 await page.locator('[data-action="journal-guide"]').click();assert(await page.locator('.cathedral-guide-content').isVisible());
 await page.waitForTimeout(1500);await page.keyboard.press('Escape');
 await page.waitForTimeout(400);await page.locator('#exploration-prompt button').click();
 await page.waitForFunction(()=>ASHEN.menu.isOpen);
 assert.equal(await page.evaluate(()=>ASHEN.combat.exploration.snapshot().record.discovered.length),1);
 await page.waitForTimeout(1500);
 await page.keyboard.press('Tab');assert(await page.evaluate(()=>document.querySelector('.game-menu-journal').contains(document.activeElement)));
 await page.keyboard.press('Escape');const end=await position();assert.equal(end.recoveries,start.recoveries);
 report.cases.push({case:'native side-aisle walk, X read, guide, button reread, journal focus and return',start,end,snapshot:await page.evaluate(()=>ASHEN.combat.exploration.snapshot())});
 await cdp.send('Page.stopScreencast');cdp=null;await Promise.all(writes);if(captureError)throw captureError;
 await writeCaptureManifest(dir,manifest,await captureSurface(page));
 await entry();assert.equal(await page.evaluate(()=>ASHEN.combat.exploration.snapshot().record.phase),'inscription-read');
 report.cases.push({case:'reload restores journal without replay or duplicate credit',passed:true});
 await walkTo([-10,crypt.floorY,334]);await walkTo(crypt.memorial.stand);await page.waitForTimeout(300);
 const saved=await page.evaluate(()=>localStorage.getItem('ashen.exploration.v1'));
 await page.keyboard.press('Escape');await page.keyboard.press('KeyX');
 assert.equal(await page.evaluate(()=>localStorage.getItem('ashen.exploration.v1')),saved);
 await page.keyboard.press('Escape');await page.keyboard.press('KeyC');
 await page.waitForFunction(()=>ASHEN.armory.isOpen);await page.keyboard.press('KeyX');
 assert.equal(await page.evaluate(()=>ASHEN.menu.isOpen),false);
 await page.keyboard.press('Escape');await page.waitForTimeout(300);
 // Controlled dead-state injection exercises the actual existing combat tick.
 await page.evaluate(()=>{ASHEN.combat.life.dead=true;});await page.waitForTimeout(300);
 assert(await page.locator('#exploration-prompt').isHidden());await page.keyboard.press('KeyX');
 assert.equal(await page.evaluate(()=>ASHEN.menu.isOpen),false);
 await page.evaluate(async()=>{ASHEN.combat.life.dead=false;const {setInputEnabled}=await import('/src/input.js');setInputEnabled(true);});
 report.cases.push({case:'menu, armory and controlled dead-state reject activation',diagnosticDeadState:true,passed:true});
 // Diagnostic geometry query: actual Havok wall, with hypothetical ray origin.
 const wall=await page.evaluate(async()=>{const {interactionReachable}=await import('/src/ashen-reach/exploration.js');const a=ASHEN,y=a.world.cathedral.exploration.undercroft.floorY;
  const query=x=>interactionReachable({getDebugState:()=>a.player.getDebugState(),capsuleHeight:a.player.capsuleHeight,body:{position:{x,y:y+a.player.capsuleHeight/2,z:329}},raycast:a.player.raycast},{standingSurfaceY:y,interact:[-11.3,y+1.15,329]});
  return {blocked:query(-12.7),inside:query(-10.9)};});
 assert.equal(wall.blocked,false);assert.equal(wall.inside,true);report.cases.push({case:'native wall blocks a close interaction ray',diagnostic:true,...wall});
 const before=await page.evaluate(()=>localStorage.getItem('ashen.exploration.v1'));
 await page.keyboard.press('Escape');await page.locator('[data-action="developer-tools"]').click();await page.locator('[data-action="exploration-reset"]').click();
 assert.equal(await page.evaluate(()=>localStorage.getItem('ashen.exploration.v1')),before);
 assert.equal(await page.evaluate(()=>ASHEN.combat.exploration.snapshot().record.phase),'unstarted');await page.keyboard.press('Escape');
 // Nave is 5.6m above the memorial: diagnostic placement proves altitude rejection.
 await page.evaluate(()=>{const a=ASHEN,c=a.world.cathedral.exploration.undercroft,s=c.memorial.stand;a.player.setWorldPos(s[0],a.world.cathedral.floorY+a.player.capsuleHeight/2,s[2]);});await page.waitForTimeout(400);await page.keyboard.press('KeyX');await page.waitForTimeout(300);
 assert.equal(await page.evaluate(()=>ASHEN.combat.exploration.snapshot().record.phase),'unstarted');assert.equal(await page.evaluate(()=>ASHEN.menu.isOpen),false);
 report.cases.push({case:'developer rehearsal preserves save; nave-above activation rejected',diagnostic:true,passed:true});
 report.gpuErrors=await page.evaluate(()=>__gpuErrors);assert.deepEqual(report.gpuErrors,[]);assert.deepEqual(errors,[]);
 await page.evaluate(()=>{window.__disposedExploration=ASHEN.combat.exploration;ASHEN.dispose();});assert.equal(await page.locator('#exploration-prompt').count(),0);assert.equal(await page.locator('[data-exploration-journal]').count(),0);
 assert.equal(await page.evaluate(()=>__disposedExploration.resetSession()),false);
 report.cases.push({case:'scene disposal removes owned prompt and journal',passed:true});
 await page.addInitScript(()=>{for(const key of ['getItem','setItem']){const original=Storage.prototype[key];Storage.prototype[key]=function(name,...args){if(name.startsWith('ashen.exploration.'))throw new DOMException('Controlled journal storage denial','SecurityError');return original.call(this,name,...args);};}});
 await entry();await walkTo([-10,crypt.floorY,334]);await walkTo(crypt.memorial.stand);await page.waitForTimeout(300);await page.keyboard.press('KeyX');
 await page.waitForFunction(()=>ASHEN.menu.isOpen&&ASHEN.combat.exploration.snapshot().record.phase==='inscription-read');
 assert.match(await page.locator('.journal-warning').innerText(),/could not be saved/);
 await page.keyboard.press('Escape');const deniedStart=await position();await walkTo([-10,crypt.floorY,332]);const deniedEnd=await position();assert.equal(deniedStart.recoveries,deniedEnd.recoveries);
 assert.deepEqual(await page.evaluate(()=>__gpuErrors),[]);assert.deepEqual(errors,[]);
 report.cases.push({case:'controlled journal storage denial retains discovery and ordinary movement',passed:true});
}finally{
 if(cdp)await cdp.send('Page.stopScreencast').catch(()=>{});await Promise.all(writes);await page.keyboard.up('KeyW').catch(()=>{});await page.keyboard.up('KeyA').catch(()=>{});await page.keyboard.up('KeyD').catch(()=>{});
 await fs.writeFile(`${dir}/report.json`,JSON.stringify(report,null,2));await context.close();await browser.close();await fs.writeFile(`${dir}/ownership.json`,JSON.stringify({...ownership,active:false,renderingClients:0},null,2));
}
console.log(JSON.stringify({cases:report.cases.length,errors,frames:frames.length,contextClosed:true}));
