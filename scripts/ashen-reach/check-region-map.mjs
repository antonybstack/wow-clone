/** Native Region map menu controls; optional timestamped live capture.
 * ASHEN_CDP_PORT=10037 ASHEN_TEST_URL=... ASHEN_RECORD=1 ASHEN_CAPTURE_DIR=...
 */
import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {CDP_URL} from '../lib/cdp.mjs';
import {browserOwnership} from '../lib/browser-ownership.mjs';
import {captureSurface,appendFrame,writeCaptureManifest} from '../lib/capture-manifest.mjs';
const url=process.env.ASHEN_TEST_URL||'http://127.0.0.1:7074/?play&clean&pixelRatio=1';
const dir=process.env.ASHEN_CAPTURE_DIR||'.cache/region-map';
const record=process.env.ASHEN_RECORD==='1';
await fs.mkdir(dir+'/frames',{recursive:true});
const browser=await chromium.connectOverCDP(CDP_URL);
assert(browser.contexts().flatMap(c=>c.pages()).every(p=>p.url()==='about:blank'),'Blank the owned harness first');
const ownership=await browserOwnership(browser,{cdpPort:new URL(CDP_URL).port,url,purpose:'G04 ordinary Region map native UI check/capture; no FPS claim',renderingClients:1});
await fs.writeFile(dir+'/ownership.json',JSON.stringify(ownership,null,2));
const context=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1});
const page=await context.newPage(),errors=[],report={url,errors,selections:[]};
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
const state=()=>page.evaluate(()=>{const p=ASHEN.player,d=p.getDebugState();return {x:p.body.position.x,y:p.body.position.y,z:p.body.position.z,facing:p.getFacing(),physics:d.usingPhysics,recoveries:d.recoveries,flying:p.isFlying(),objective:ASHEN.combat.objective.snapshot(),selected:ASHEN.combat.regionMap.selected?.id||null};});
const pane=page.locator('.game-menu-map');
async function map(){await page.keyboard.press('Escape');await page.getByRole('button',{name:'Region map',exact:true}).click();}
const writes=[];let cdp,manifest,captureError;
async function stopCapture(){if(!manifest)return;await cdp.send('Page.stopScreencast');cdp.removeAllListeners('Page.screencastFrame');await Promise.all(writes);if(captureError)throw captureError;await writeCaptureManifest(dir,manifest,await captureSurface(page));manifest=null;}
try{
 await page.goto(url,{waitUntil:'commit'});await page.waitForFunction(()=>window.ASHEN?.ready&&ASHEN.hostilesReady,null,{timeout:120000});
 report.start=await state();assert(report.start.physics&&!report.start.flying&&report.start.recoveries===0);
 await page.keyboard.down('d');await page.waitForTimeout(450);await page.keyboard.up('d');
 report.turned=await state();assert(report.turned.facing>report.start.facing+.5,'Native turn did not reach a visibly eastward heading');
 if(record){
  manifest={version:1,...await captureSurface(page),frames:[]};cdp=await context.newCDPSession(page);
  cdp.on('Page.screencastFrame',e=>{cdp.send('Page.screencastFrameAck',{sessionId:e.sessionId}).catch(()=>{});if(!manifest||captureError)return;try{const bytes=Buffer.from(e.data,'base64'),name=`frame-${String(manifest.frames.length).padStart(5,'0')}.jpg`;appendFrame(manifest,{name,timestamp:e.metadata.timestamp,bytes});writes.push(fs.writeFile(dir+'/frames/'+name,bytes).catch(e=>captureError=e));}catch(e){captureError=e;}});
  await cdp.send('Page.startScreencast',{format:'jpeg',quality:87,maxWidth:1280,maxHeight:720,everyNthFrame:4});
  await page.waitForTimeout(1200);
 }
 await map();assert(await pane.isVisible());
 assert.equal(await page.locator('#game-menu').getAttribute('aria-labelledby'),'region-map-title');
 const sites=await page.evaluate(()=>ASHEN.world.landmarks.map(s=>({id:s.id,name:s.name,routePoints:s.route.length})));
 assert.equal(sites.length,8);assert.equal(await pane.locator('[data-map-destination]').count(),8);
 assert(await page.getByRole('button',{name:'Clear destination',exact:true}).isDisabled());
 assert.equal(await page.evaluate(()=>document.activeElement?.dataset.mapDestination),sites[0].id);
 // The ordinary menu owns input/pause; opening a map must not add another loop.
 const paused=await state();await page.keyboard.down('w');await page.waitForTimeout(450);await page.keyboard.up('w');const afterPaused=await state();
 assert(Math.hypot(afterPaused.x-paused.x,afterPaused.y-paused.y,afterPaused.z-paused.z)<.02,'Map did not preserve paused movement');
 for(const site of sites){
  await pane.getByRole('button',{name:site.name,exact:true}).click();
  assert.equal((await state()).selected,site.id);
  assert.equal(await pane.getByRole('button',{name:site.name,exact:true}).getAttribute('aria-pressed'),'true');
  assert.match(await pane.locator('[role="status"]').innerText(),new RegExp(site.name));
  assert.equal(await pane.locator('[aria-pressed="true"]').count(),1);
  report.selections.push({id:site.id,routePoints:site.routePoints});
  if(record)await page.waitForTimeout(site.id==='vaelmark'?1800:550);
 }
 await page.screenshot({path:dir+'/map-vaelmark.png'});
 assert.deepEqual((await state()).objective,paused.objective,'Selecting map guidance changed the watchman objective');
 // Last Back control wraps to the first destination and Shift-Tab returns.
 await pane.getByRole('button',{name:'Back',exact:true}).focus();await page.keyboard.press('Tab');
 assert.equal(await page.evaluate(()=>document.activeElement.dataset.mapDestination),sites[0].id);
 await page.keyboard.press('Shift+Tab');assert.equal(await page.evaluate(()=>document.activeElement.dataset.action),'hub');
 await pane.getByRole('button',{name:'Back',exact:true}).click();assert(await page.locator('.game-menu-hub').isVisible());
 await page.getByRole('button',{name:'Resume',exact:false}).click();await page.waitForTimeout(350);
 assert(!await page.locator('#game-menu').isVisible());
 assert.equal(await page.evaluate(()=>document.activeElement.id),'renderCanvas');
 const pin=await page.locator('.minimap canvas').evaluate(c=>{const data=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let blue=0,gold=0;for(let i=0;i<data.length;i+=4){if(data[i]===155&&data[i+1]===221&&data[i+2]===223)blue++;if(data[i]===255&&data[i+1]===225&&data[i+2]===168)gold++;}return {blue,gold};});
 assert(pin.blue>4&&pin.gold>4,`Destination and watchman pins must coexist: ${JSON.stringify(pin)}`);report.minimapPins=pin;
 await page.screenshot({path:dir+'/minimap-selected.png'});
 const beforeWalk=await state();await page.keyboard.down('w');await page.waitForTimeout(1100);await page.keyboard.up('w');await page.waitForTimeout(300);report.afterWalk=await state();
 assert(Math.hypot(report.afterWalk.x-beforeWalk.x,report.afterWalk.z-beforeWalk.z)>2,'Walking did not resume');
 await map();assert.equal(await pane.getByRole('button',{name:'Vaelmark',exact:true}).getAttribute('aria-pressed'),'true');
 await pane.getByRole('button',{name:'Clear destination',exact:true}).click();assert.equal((await state()).selected,null);
 assert(await pane.getByRole('button',{name:'Clear destination',exact:true}).isDisabled());
 await page.screenshot({path:dir+'/map-cleared.png'});if(record)await page.waitForTimeout(1200);
 await page.keyboard.press('Escape');assert(!await page.locator('#game-menu').isVisible());
 report.end=await state();assert(report.end.physics&&!report.end.flying&&report.end.recoveries===0);
 await stopCapture();
 // Exercise the existing scene-disposal API separately from gameplay motion.
 // No placement, movement or collision helper is substituted in the live checks.
 await page.evaluate(()=>ASHEN.dispose());
 assert.equal(await page.locator('.minimap').count(),0);
 assert.equal(await page.locator('.region-map-content').count(),0);
 assert.equal(await page.evaluate(()=>ASHEN.combat.regionMap.selected),null);
 report.disposal={minimapRemoved:true,chartRemoved:true,selectionCleared:true};
 report.gpuErrors=await page.evaluate(()=>ASHEN.gpu.errors);assert.deepEqual(errors,[]);assert.deepEqual(report.gpuErrors,[]);report.passed=true;
}catch(error){report.failure=error.stack;await page.screenshot({path:dir+'/failure.png'}).catch(()=>{});throw error;
}finally{
 await page.keyboard.up('w').catch(()=>{});await page.keyboard.up('d').catch(()=>{});await cdp?.send('Page.stopScreencast').catch(()=>{});await Promise.all(writes);
 await fs.writeFile(dir+'/report.json',JSON.stringify(report,null,2));await context.close();await browser.close();
 await fs.writeFile(dir+'/ownership.json',JSON.stringify({...ownership,active:false,renderingClients:0},null,2));
}
console.log('PASS: ordinary Region map, eight selections, pause/focus, retained/cleared guidance, two distinct minimap pins and resumed Havok walking; no runtime/GPU errors');
