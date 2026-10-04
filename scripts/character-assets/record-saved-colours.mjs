/** Default-route Armory, save/reload and gameplay review. Inspection close-ups
 * are labelled and use the existing body mixer/camera, not an offline render.
 * Source dimensions and elapsed time are validated by the shared capture tool.
 * https://chromedevtools.github.io/devtools-protocol/tot/Page/#event-screencastFrame
 */
import fs from 'node:fs/promises';import path from 'node:path';import assert from 'node:assert/strict';import {chromium} from 'playwright';
import {appendFrame,captureSurface,writeCaptureManifest} from '../lib/capture-manifest.mjs';import {browserOwnership} from '../lib/browser-ownership.mjs';
const port=process.env.ASHEN_CDP_PORT,url=process.env.ASHEN_TEST_URL,dir=process.env.ASHEN_CAPTURE_DIR||'ve-capture/character-mmo/m7/saved-colours-2026-10-04';assert(port&&url);
await fs.mkdir(path.join(dir,'frames'),{recursive:true});
const browser=await chromium.connectOverCDP(`http://127.0.0.1:${port}`);assert(browser.contexts().flatMap(c=>c.pages()).every(p=>p.url()==='about:blank'));
const context=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1}),page=await context.newPage();
const ownership=await browserOwnership(browser,{cdpPort:port,url,purpose:'M7 saved colours and v5 sword grip live review; no FPS claim',renderingClients:1});await fs.writeFile(path.join(dir,'ownership.json'),JSON.stringify(ownership,null,2));
const report={url,errors:[],timeline:[],rows:[]},writes=[];let manifest,recording=false;const cdp=await context.newCDPSession(page);
page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
cdp.on('Page.screencastFrame',e=>{void cdp.send('Page.screencastFrameAck',{sessionId:e.sessionId}).catch(()=>{});if(!recording)return;try{const name=`frame-${String(manifest.frames.length).padStart(6,'0')}.jpg`,bytes=Buffer.from(e.data,'base64');appendFrame(manifest,{name,timestamp:e.metadata.timestamp,bytes});writes.push(fs.writeFile(path.join(dir,'frames',name),bytes));}catch(e){recording=false;report.errors.push(e.stack);}});
const note=async label=>{report.timeline.push({label,frame:manifest?.frames.length||0,time:Date.now()});await page.evaluate(label=>{let n=document.getElementById('capture-note');if(!n){n=document.createElement('p');n.id='capture-note';n.style='position:fixed;top:12px;left:50%;transform:translateX(-50%);z-index:99999;background:#171811e8;color:#eee2ac;padding:8px 14px;font:15px Georgia;pointer-events:none;max-width:620px;text-align:center;';document.body.append(n);}n.textContent=label;},label);};
const snapshot=label=>page.evaluate(label=>({case:label,appearance:ASHEN.getAppearance(),gpuErrors:ASHEN.gpu.errors.slice(),physics:ASHEN.player.getDebugState().usingPhysics,recoveries:ASHEN.player.getDebugState().recoveries}),label);
const dye=async(slot,id)=>{await page.locator(`[data-dye="${slot}"]`).selectOption(id);await page.waitForFunction(([slot,id])=>(ASHEN.getAppearance().dyes[slot]||'undyed')===id,[slot,id]);await page.waitForTimeout(300);};
const wear=async preset=>{const r=await page.evaluate(id=>ASHEN.equipment.equipPreset(id),preset);assert.equal(r.status,'applied',r.error);};
const walkPreview=()=>page.locator('#armory [data-motion]').selectOption('walk');
try{
 await page.goto(url);await page.waitForFunction(()=>globalThis.ASHEN?.ready,null,{timeout:90000});await page.evaluate(()=>{ASHEN.dev.god=true;ASHEN.armory.open();});await walkPreview();await page.waitForTimeout(700);
 manifest={...(await captureSurface(page)),frames:[],timeline:report.timeline};assert.equal(manifest.canvas.width,1280);assert.equal(manifest.canvas.height,720);
 recording=true;await cdp.send('Page.startScreencast',{format:'jpeg',quality:88,maxWidth:1280,maxHeight:720,everyNthFrame:3});
 await note('Human · Armory colours apply to the moving character');await page.waitForTimeout(1800);
 for(const id of ['oxblood','moss','indigo']){await note(`Human torso · ${id}`);await dye('torso',id);await page.waitForTimeout(1900);}
 await note('Undo colour · returns to Moss');await page.locator('button').filter({hasText:/^Undo colour$/}).click();await page.waitForFunction(()=>ASHEN.getAppearance().dyes.torso==='moss');await page.waitForTimeout(2000);
 await note('Save and reload · the selected colour is present at first play');const wanted=await page.evaluate(()=>ASHEN.getAppearance());
 await page.reload();await page.waitForFunction(()=>globalThis.ASHEN?.ready,null,{timeout:90000});assert.deepEqual(await page.evaluate(()=>ASHEN.getAppearance()),wanted);await note('Restored Human · Moss');await page.waitForTimeout(2000);
 await page.evaluate(()=>ASHEN.armory.open());
 for(const preset of ['graveweaver','pilgrim','lector','duskguard']){await note(`Human · ${preset} · torso keeps the saved slot colour`);await wear(preset);await walkPreview();await page.waitForTimeout(2100);}
 for(const race of ['human','orc','undead']){
  if(race!=='human'){await page.evaluate(()=>ASHEN.armory.close());await page.evaluate(r=>ASHEN.equipment.switchRace(r),race);await page.evaluate(()=>ASHEN.armory.open());}
  await wear('wayfarer');await page.evaluate(()=>ASHEN.equipment.equip('mainHand','ironSword'));await dye('torso',race==='human'?'moss':race==='orc'?'oxblood':'indigo');await walkPreview();
  await note(`${race} · saved colour and source-compatible moving equipment`);await page.waitForTimeout(2600);
  await page.evaluate(()=>{ASHEN.armory.setFocus({height:.75,radius:2.5,alpha:Math.PI/2,beta:1.36});});
  await note(`${race} · sword grip · existing inspection camera close-up`);await page.waitForTimeout(2300);await page.screenshot({path:path.join(dir,`${race}-sword-grip.png`)});
  await page.evaluate(()=>{ASHEN.armory.setFocus({height:.78,radius:4.8,alpha:Math.PI/2,beta:1.36});});
  await wear('duskguard');await walkPreview();await note(`${race} · Duskguard mix · colour and fitted parts`);await page.waitForTimeout(2300);
  report.rows.push(await snapshot(race));
 }
 await page.evaluate(()=>{ASHEN.armory.close();ASHEN.setView('play');});await note('Normal controls · walking, jumping and spell motion with the saved outfit');
 await page.focus('#renderCanvas');await page.keyboard.down('KeyW');await page.waitForTimeout(2400);await page.keyboard.up('KeyW');await page.keyboard.press('Space');await page.waitForTimeout(1000);await page.keyboard.press('Digit1');await page.waitForTimeout(2500);
 report.rows.push(await snapshot('ordinary-input'));recording=false;await cdp.send('Page.stopScreencast');await Promise.all(writes);await writeCaptureManifest(dir,manifest,await captureSurface(page));
 assert.deepEqual(report.errors,[]);for(const r of report.rows){assert.deepEqual(r.gpuErrors,[]);assert(r.physics);}
 report.frames=manifest.frames.length;report.elapsedSeconds=manifest.elapsedSeconds;report.passed=true;
}finally{
 recording=false;await cdp.send('Page.stopScreencast').catch(()=>{});await Promise.all(writes);await fs.writeFile(path.join(dir,'report.json'),JSON.stringify(report,null,2));await context.close();await browser.close();await fs.writeFile(path.join(dir,'ownership.json'),JSON.stringify({...ownership,active:false,renderingClients:0},null,2));
}
