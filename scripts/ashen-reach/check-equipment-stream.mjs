import {chromium} from 'playwright';
import { CDP_URL } from '../lib/cdp.mjs';import assert from 'node:assert/strict';import fs from 'node:fs/promises';
const browser=await chromium.connectOverCDP(CDP_URL);
const page=browser.contexts()[0].pages().find(p=>p.url().includes('ashen-reach.html'))||await browser.contexts()[0].newPage();
const dir='ve-capture/ashen-reach/streamed-equipment';await fs.mkdir(dir,{recursive:true});const checks=[],errors=[],requests=[];
const check=(name,value)=>{assert.ok(value,name);checks.push(name);console.log('PASS',name);};
page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.url().includes('/equipment/')&&r.url().endsWith('.glb'))requests.push(r.url());});
const url=process.env.ASHEN_URL||'http://127.0.0.1:5173/ashen-reach.html?play&clean';
try{
 await page.goto(url,{waitUntil:'commit'});await page.waitForFunction(()=>globalThis.ASHEN?.ready,null,{timeout:60000});await page.bringToFront();await page.keyboard.press('KeyC');
 check('Initial loading excludes unequipped hood and robe',!requests.some(u=>u.includes('graveweaver')));
 const before=await page.evaluate(()=>{window.__streamActor=ASHEN.body.root;window.__streamPalette=ASHEN.scene.meshes.find(m=>m.name==='BodyExposed'&&m.skeleton).skeleton.boneTexture;return ASHEN.equipment.getState();});
 await page.route('**/equipment/graveweaverHood.glb',r=>r.fulfill({status:503,body:'test failure'}));
 await page.locator('[data-outfit="graveweaver"]').click();await page.waitForFunction(()=>!ASHEN.equipment.getStatus().pending);
 check('Failed fetch preserves all selected slots',JSON.stringify(await page.evaluate(()=>ASHEN.equipment.getState()))===JSON.stringify(before));
 check('Failure is explained in armory',await page.locator('[data-equipment-status]').textContent()==='Could not equip that item. Your current outfit is unchanged.');
 await page.unroute('**/equipment/graveweaverHood.glb');
 await page.route('**/equipment/graveweaverSkirt.glb',async r=>{await new Promise(resolve=>setTimeout(resolve,500));await r.continue();});
 await page.locator('[data-outfit="graveweaver"]').click();await page.waitForFunction(()=>ASHEN.equipment.getStatus().pending);
 check('Current outfit remains visible during preparation',JSON.stringify(await page.evaluate(()=>ASHEN.equipment.getState()))===JSON.stringify(before));
 await page.locator('[data-outfit="pilgrim"]').click();await page.waitForFunction(()=>!ASHEN.equipment.getStatus().pending);
 check('Most recent preset wins delayed request',await page.evaluate(()=>ASHEN.equipment.getState().torso==='pilgrimTunic'&&ASHEN.equipment.getState().helmet===null));
 await page.unroute('**/equipment/graveweaverSkirt.glb');
 await page.locator('[data-outfit="graveweaver"]').click();await page.waitForFunction(()=>!ASHEN.equipment.getStatus().pending);
 check('Retry equips complete outfit',await page.evaluate(()=>ASHEN.equipment.getState().helmet==='graveweaverHood'&&ASHEN.equipment.getState().offHand==='graveweaverBook'));
 const stable=await page.evaluate(async()=>{const counts=[];for(let i=0;i<12;i++){
  await ASHEN.equipment.equipPreset('pilgrim');await ASHEN.equipment.equipPreset('graveweaver');
  const state=ASHEN.equipment.getState(),status=ASHEN.equipment.getStatus();
  if(status.error||status.cached.filter(id=>!Object.values(state).includes(id)).length>2)return false;
  counts.push(ASHEN.scene.meshes.length);
 }return new Set(counts).size===1&&ASHEN.body.root===window.__streamActor&&ASHEN.scene.meshes.find(m=>m.name==='BodyExposed'&&m.skeleton).skeleton.boneTexture===window.__streamPalette;});
 check('Eviction/reload keeps stable scene count, actor and shared pose palette',stable);
 await page.locator('[data-light]').check();await page.locator('[data-motion]').selectOption('run');await page.locator('[data-time-slider]').fill('0.24');await page.waitForTimeout(200);await page.screenshot({path:dir+'/run.png'});
 await page.locator('[data-motion]').selectOption('idle');await page.locator('[data-view="front"]').click();await page.locator('[data-view="full"]').click();await page.waitForTimeout(200);await page.screenshot({path:dir+'/front.png'});
 check('No unhandled runtime errors after eviction stress',errors.length===0);
}finally{await fs.writeFile(dir+'/checks.json',JSON.stringify({checks,errors,requests},null,2));await browser.close();}
