/** One owned live game: real slot/UI, race fits, shape extremes and failed delivery.
 * Recording preserves capture timestamps/dimensions; it is never an FPS benchmark.
 * https://chromedevtools.github.io/devtools-protocol/tot/Page/#event-screencastFrame
 */
import fs from 'node:fs/promises';import path from 'node:path';import assert from 'node:assert/strict';import {chromium} from 'playwright';
import {browserOwnership} from '../lib/browser-ownership.mjs';
import {appendFrame,captureSurface,writeCaptureManifest} from '../lib/capture-manifest.mjs';
const port=process.env.ASHEN_CDP_PORT,url=process.env.ASHEN_TEST_URL;assert(port&&url);
const dir=process.env.ASHEN_CAPTURE_DIR||'ve-capture/character-mmo/wardrobe-shoulders-2026-10-01';await fs.mkdir(path.join(dir,'frames'),{recursive:true});
const browser=await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
assert(browser.contexts().flatMap(c=>c.pages()).every(p=>p.url()==='about:blank'),'Another owned game page is rendering');
const context=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1}),page=await context.newPage();
const errors=[],expectedHttpErrors=[],timeline=[],writes=[],requests=[];let failing=false;let recording=false,manifest,cdp;
await fs.writeFile(`${dir}/ownership.json`,JSON.stringify(await browserOwnership(browser,{cdpPort:port,url,purpose:'M6 streamed shoulder item, fits and live motion',renderingClients:1})));
page.on('pageerror',e=>errors.push(e.stack));page.on('console',m=>{if(m.type()==='error'){if(failing&&m.text().includes('503')&&m.location().url.includes('wardenPauldrons'))expectedHttpErrors.push(m.text());else errors.push(m.text());}});page.on('request',r=>requests.push(r.url()));
const mark=async label=>timeline.push({label,timestamp:Date.now()/1000,state:await page.evaluate(()=>({appearance:ASHEN.getAppearance(),equipment:ASHEN.equipment.getState(),status:ASHEN.equipment.getStatus(),physics:ASHEN.player.getDebugState().usingPhysics,recoveries:ASHEN.player.getDebugState().recoveries,gpuErrors:ASHEN.gpu.errors.slice(),plates:ASHEN.scene.meshes.filter(m=>m.name==='WardenPauldrons').map(m=>({visible:m.visible,bones:m.skeleton?.boneCount,morph:!!m.morphTargets}))}))});
const equip=async id=>{await page.selectOption('#armory [data-equipment="shoulders"]',id||'');await page.waitForFunction(id=>ASHEN.equipment.getState().shoulders===(id||null),id);};
try{
 await page.goto(url);await page.waitForFunction(()=>globalThis.ASHEN?.whenRest,null,{timeout:90000});await page.evaluate(()=>ASHEN.whenRest);
 assert(!requests.some(u=>/wardenPauldrons|human-shape-v1/.test(u)),'Default starter fetched optional equipment');
 await page.evaluate(()=>{ASHEN.dev.god=true;ASHEN.armory.open();});await page.check('#armory [data-light]');
 await equip('wardenPauldrons');await page.waitForTimeout(400);
 manifest={...(await captureSurface(page)),frames:[],timeline};cdp=await context.newCDPSession(page);
 cdp.on('Page.screencastFrame',e=>{void cdp.send('Page.screencastFrameAck',{sessionId:e.sessionId}).catch(()=>{});if(!recording)return;try{const name=`frame-${String(manifest.frames.length).padStart(6,'0')}.jpg`,bytes=Buffer.from(e.data,'base64');appendFrame(manifest,{name,timestamp:e.metadata.timestamp,bytes});writes.push(fs.writeFile(path.join(dir,'frames',name),bytes));}catch(e){errors.push(e.stack);recording=false;}});
 recording=true;await cdp.send('Page.startScreencast',{format:'jpeg',quality:88,maxWidth:1280,maxHeight:720,everyNthFrame:2});
 for(const race of ['human','orc','undead']){
  await page.evaluate(()=>ASHEN.armory.open());
  if(await page.evaluate(()=>ASHEN.equipment.race)!==race){await page.selectOption('#armory [data-race]',race);await page.waitForFunction(r=>ASHEN.equipment.race===r,race);}
  const shapes=race==='human'?[[-.95,.9],[.95,1.15]]:[[0,1]];
  for(const [build,height]of shapes)for(const outfit of ['wayfarer','pilgrim','graveweaver']){
   await page.evaluate(()=>ASHEN.armory.open());await page.locator(`#armory [data-outfit="${outfit}"]`).click();
   await page.waitForFunction(id=>!ASHEN.equipment.getStatus().pending&&Object.entries(ASHEN.equipment.presets[id].loadout).every(([slot,item])=>ASHEN.equipment.getState()[slot]===item),outfit);
   await equip('wardenPauldrons');
   await page.waitForFunction(()=>[...document.querySelectorAll('#armory [data-equipment]')].every(select=>select.value===(ASHEN.equipment.getState()[select.dataset.equipment]||'')));
   if(race==='human')await page.evaluate(async({build,height})=>{await ASHEN.creator.set('build',build);await ASHEN.creator.set('height',height);},{build,height});
   await page.evaluate(()=>{ASHEN.armory.open();ASHEN.armory.setFocus({height:1.25*ASHEN.player.heightScale,radius:2.5*ASHEN.player.heightScale,beta:1.4});ASHEN.scene.camera=ASHEN.armory.camera;});
   for(const view of ['front','side','back']){await page.locator(`#armory [data-view="${view}"]`).evaluate(e=>e.click());await page.waitForTimeout(300);await page.screenshot({path:`${dir}/${race}-${build}-${height}-${outfit}-${view}.png`});}
   await page.locator('#armory [data-view="front"]').evaluate(e=>e.click());
   for(const motion of ['run','jump','land','fire','lava']){await page.selectOption('#armory [data-motion]',motion);await page.waitForTimeout(450);await page.screenshot({path:`${dir}/${race}-${build}-${height}-${outfit}-${motion}.png`});}
   await mark(`${race} ${outfit} build ${build} height ${height}: front/side/back and native source run/jump/land/Fire Blast/Lava Ball diagnostic playback`);
   await page.selectOption('#armory [data-motion]','idle');
   await page.evaluate(()=>{ASHEN.armory.close();ASHEN.setView('play');ASHEN.rig.distance=ASHEN.rig.distanceTarget=2.7;});
   await page.keyboard.down('KeyW');await page.keyboard.down('ShiftLeft');await page.waitForTimeout(400);await page.keyboard.down('KeyA');await page.waitForTimeout(250);await page.keyboard.up('KeyA');await page.keyboard.press('Space');await page.waitForTimeout(900);await page.keyboard.up('ShiftLeft');await page.keyboard.up('KeyW');
   await mark(`${race} ${outfit}: normal Havok run, turn and jump`);
  }
 }
 await page.evaluate(()=>ASHEN.armory.open());await page.selectOption('#armory [data-race]','human');await page.waitForFunction(()=>ASHEN.equipment.race==='human');await equip('wardenPauldrons');
 // A selected compact shoulder remains part of the same saved recipe on reload.
 const saved=await page.evaluate(()=>ASHEN.getAppearance());assert.equal(saved.equipment.shoulders,'wardenPauldrons');
 await page.reload();await page.waitForFunction(()=>globalThis.ASHEN?.whenRest,null,{timeout:90000});await page.evaluate(()=>ASHEN.whenRest);assert.deepEqual(await page.evaluate(()=>ASHEN.getAppearance()),saved);await mark('Saved shoulders restored after compact startup and full refinement');
 await page.evaluate(()=>ASHEN.armory.open());await equip(null);
 // Failure must not commit or silently substitute another fit.
 await page.reload();await page.waitForFunction(()=>globalThis.ASHEN?.whenRest,null,{timeout:90000});await page.evaluate(()=>ASHEN.whenRest);await page.evaluate(()=>ASHEN.armory.open());
 const before=await page.evaluate(()=>ASHEN.getAppearance());let denied=0;
 failing=true;await page.route('**/*wardenPauldrons*',route=>{denied++;return route.fulfill({status:503,body:'unavailable'});});
 const result=await page.evaluate(()=>ASHEN.equipment.equip('shoulders','wardenPauldrons'));assert.equal(result.status,'failed');assert(denied);assert.deepEqual(await page.evaluate(()=>ASHEN.getAppearance()),before);await mark('Missing shoulder asset retains prior committed appearance');
 await page.unrouteAll({behavior:'wait'});failing=false;
 await equip('wardenPauldrons');
 const settled=await page.evaluate(async()=>{await ASHEN.equipment.equip('shoulders',null);return Promise.all([ASHEN.equipment.equip('shoulders','wardenPauldrons'),ASHEN.equipment.equip('shoulders',null),ASHEN.equipment.equip('shoulders','wardenPauldrons')]);});
 assert.equal(await page.evaluate(()=>ASHEN.equipment.getState().shoulders),'wardenPauldrons');await mark('Rapid shoulder changes settle on final identity');
 recording=false;await cdp.send('Page.stopScreencast');await Promise.all(writes);await writeCaptureManifest(dir,manifest,await captureSurface(page));
 assert.deepEqual(errors,[]);assert.deepEqual(await page.evaluate(()=>ASHEN.gpu.errors),[]);
 await fs.writeFile(`${dir}/report.json`,JSON.stringify({timeline,errors,expectedHttpErrors,defaultOptionalRequests:0,failedRequests:denied,rapidResults:settled,passed:true},null,2));console.log(JSON.stringify({frames:manifest.frames.length,errors,denied}));
}finally{recording=false;if(cdp)await cdp.send('Page.stopScreencast').catch(()=>{});await Promise.all(writes);await context.close();await browser.close();const ownership=JSON.parse(await fs.readFile(`${dir}/ownership.json`));ownership.active=false;await fs.writeFile(`${dir}/ownership.json`,JSON.stringify(ownership));}
