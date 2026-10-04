/** Real default-route colour transactions. Every checkpoint checks the committed
 * recipe AND visible native material; a saved value alone cannot prove restoration.
 * The held/corrupt responses run with the HTTP cache disabled and assert a hit.
 * https://chromedevtools.github.io/devtools-protocol/tot/Network/#method-setCacheDisabled
 */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {chromium} from 'playwright';
import {browserOwnership} from '../lib/browser-ownership.mjs';
import {EQUIPMENT_ITEMS} from '../../src/ashen-reach/equipment-catalog.js';
import {dyeFactor} from '../../src/ashen-reach/dye-palette.js';
const url=process.env.ASHEN_TEST_URL,port=process.env.ASHEN_CDP_PORT,out=process.argv[2];
assert(url&&port&&out,'Require an owned CDP, game URL and report path');
await fs.mkdir(path.dirname(out),{recursive:true});
const browser=await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
assert(browser.contexts().flatMap(c=>c.pages()).every(p=>p.url()==='about:blank'),'Another game page is active');
const ownership=await browserOwnership(browser,{cdpPort:port,url,purpose:'Saved equipment colours, atomic refusal and Armory controls',renderingClients:1});
await fs.writeFile(out+'.ownership.json',JSON.stringify(ownership,null,2));
const context=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1}),page=await context.newPage();
const report={url,rows:[],errors:[]},requests=[];
page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('500'))report.errors.push(m.text());});page.on('request',r=>requests.push(r.url()));
const ready=async()=>{await page.waitForFunction(()=>globalThis.ASHEN?.ready,null,{timeout:90000});await page.evaluate(()=>{ASHEN.dev.god=true;});};
const snapshot=()=>page.evaluate(items=>({appearance:ASHEN.getAppearance?.(),dyes:ASHEN.equipment.getDyes(),storage:localStorage.getItem('ashen.appearance.v2'),meshes:ASHEN.scene.meshes.length,gpuErrors:ASHEN.gpu.errors.slice(),
 factors:Object.fromEntries(Object.entries(ASHEN.equipment.getState()).filter(([slot,id])=>id&&!items[id].factory).map(([slot,id])=>[slot,ASHEN.scene.meshes.filter(m=>m.visible!==false&&items[id].parts.some(p=>p.mesh===m.name)).map(m=>({name:m.name,factor:m.material?.baseColorFactor??null}))]))}),EQUIPMENT_ITEMS);
const check=async(name)=>{
 const s=await snapshot();assert.deepEqual(s.dyes,s.appearance.dyes);assert.deepEqual(JSON.parse(s.storage).dyes,s.dyes);assert.deepEqual(s.gpuErrors,[]);
 for(const [slot,id]of Object.entries(s.dyes)){assert(s.factors[slot]?.length,`${name}: no visible ${slot}`);for(const m of s.factors[slot])assert.deepEqual(m.factor,dyeFactor(id),`${name}: ${slot}/${m.name}`);}
 report.rows.push({case:name,...s});return s;
};
try{
 await page.goto(url);await ready();
 const original=await snapshot();
 await page.evaluate(()=>ASHEN.armory.open());
 await page.locator('[data-dye="torso"]').selectOption('moss');
 await page.waitForFunction(()=>ASHEN.getAppearance().dyes.torso==='moss');
 await page.locator('button').filter({hasText:/^Undo colour$/}).click();
 await page.waitForFunction(()=>!ASHEN.getAppearance().dyes.torso);await check('ui-undo');
 await page.locator('[data-dye="torso"]').selectOption('oxblood');
 await page.waitForFunction(()=>ASHEN.getAppearance().dyes.torso==='oxblood');await check('ui-commit');
 await page.screenshot({path:out.replace('.json','-armory.png')});
 await page.evaluate(()=>ASHEN.armory.close());
 const wanted=(await snapshot()).appearance;
 await page.reload();await page.waitForFunction(()=>globalThis.ASHEN?.playableReady,null,{timeout:90000});
 const first=await page.evaluate(()=>({dyes:ASHEN.equipment.getDyes(),factors:ASHEN.scene.meshes.filter(m=>m.name==='WayfarerTunic'&&m.visible!==false).map(m=>m.material.baseColorFactor),errors:ASHEN.gpu.errors.slice()}));
 assert.deepEqual(first.dyes,wanted.dyes);assert.deepEqual(first.factors,[dyeFactor('oxblood')]);assert.deepEqual(first.errors,[]);
 report.rows.push({case:'saved-neutral-first-playable',...first});await ready();assert.deepEqual((await check('saved-neutral-settled')).appearance,wanted);
 assert(!requests.some(u=>u.includes('/human-shape-v1/')),'Dye-only startup must not fetch morph assets');
 await page.evaluate(async()=>{await ASHEN.creator.set('build',-.95);await ASHEN.creator.set('height',.9);});await check('body-promotion-retains-colour');
 const shaped=(await snapshot()).appearance;await page.reload();await page.waitForFunction(()=>globalThis.ASHEN?.playableReady,null,{timeout:90000});
 assert.deepEqual(await page.evaluate(()=>ASHEN.equipment.getDyes()),shaped.dyes);await ready();assert.deepEqual((await check('saved-shaped-and-full-detail')).appearance,shaped);
 for(const race of ['orc','undead','human']){
  await page.evaluate(r=>ASHEN.equipment.switchRace(r),race);await check(`race-${race}`);
  assert.equal((await page.evaluate(()=>ASHEN.equipment.setDye('torso','indigo'))).status,'applied');
  const saved=(await check(`dyed-${race}`)).appearance;await page.reload();await ready();assert.deepEqual((await check(`restored-${race}`)).appearance,saved);
 }
 await page.evaluate(()=>ASHEN.equipment.equip('helmet',null));
 for(const [slot,id]of [['torso','moss'],['mainHand','moss'],['helmet','moss'],['torso','unknown']]){
  if(slot==='torso'&&id==='moss')continue;
  const before=await snapshot(),result=await page.evaluate(([s,d])=>ASHEN.equipment.setDye(s,d),[slot,id]);
  assert.equal(result.status,'failed');assert.deepEqual(await snapshot(),before);report.rows.push({case:'invalid-refused',slot,id,error:result.error});
 }
 // Reusing an idle item must compare colour identity, not only its logical ID.
 await page.evaluate(async()=>{await ASHEN.equipment.equip('torso','wayfarerTunic');await ASHEN.equipment.setDye('torso','moss');await ASHEN.equipment.equip('torso','lectorCoat');await ASHEN.equipment.setDye('torso','oxblood');await ASHEN.equipment.equip('torso','wayfarerTunic');});await check('idle-piece-recoloured');
 await page.evaluate(()=>ASHEN.equipment.setDye('torso','undyed'));
 assert.deepEqual((await snapshot()).factors.torso,original.factors.torso);await check('undyed-restores-authored-factor');
 await page.evaluate(()=>ASHEN.equipment.equip('torso',null));assert(!Object.hasOwn(await page.evaluate(()=>ASHEN.equipment.getDyes()),'torso'));await check('empty-slot-clears-colour');
 await page.evaluate(async()=>{await ASHEN.equipment.switchRace('orc');await ASHEN.equipment.equip('torso','wayfarerTunic');await ASHEN.equipment.setDye('torso','moss');});
 const cdp=await context.newCDPSession(page);await cdp.send('Network.enable');await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});
 let hits=0,release;const held=new Promise(r=>release=r);
 await page.route('**/*wayfarerTunic*.glb*',async r=>{hits++;await held;await r.continue();});
 const beforeHeld=await snapshot();await page.evaluate(()=>{globalThis.__pendingDye=ASHEN.equipment.setDye('torso','oxblood');});
 for(let i=0;i<100&&!hits;i++)await page.waitForTimeout(30);assert.equal(hits,1,'Held request must reach the route');
 const duringHeld=await snapshot();assert.deepEqual(duringHeld,beforeHeld);release();assert.equal((await page.evaluate(()=>globalThis.__pendingDye)).status,'applied');
 await page.unroute('**/*wayfarerTunic*.glb*');await check('held-keeps-last-visible-colour');
 hits=0;await page.route('**/*wayfarerTunic*.glb*',r=>{hits++;return r.fulfill({status:500,body:'intentional dye refusal'});});
 const beforeFailure=await snapshot(),failed=await page.evaluate(()=>ASHEN.equipment.setDye('torso','indigo'));
 assert.equal(hits,1);assert.equal(failed.status,'failed');assert.deepEqual(await snapshot(),beforeFailure);report.rows.push({case:'fetch-failure-preserves-visible-recipe-and-storage',hits,error:failed.error});
 await page.unroute('**/*wayfarerTunic*.glb*');assert.equal((await page.evaluate(()=>ASHEN.equipment.setDye('torso','indigo'))).status,'applied');await check('failed-colour-can-retry');
 // The existing local shared-region surface locks ordinary Armory edits while
 // the authority owns appearance. Exercise its real timer/DOM, without starting
 // a server or another renderer. A transport test is a separate parked gate.
 if(await page.evaluate(()=>Boolean(ASHEN.presenceEntry?.element))){
  await page.evaluate(()=>{ASHEN.presence={closed:false,connected:true,room:{sessionId:'control',state:{players:new Map()}}};ASHEN.armory.open();});
  await page.waitForFunction(()=>[...document.querySelectorAll('#armory [data-dye]')].every(s=>s.disabled));
  const locked=await snapshot();
  await page.evaluate(()=>{delete ASHEN.presence;});
  await page.waitForFunction(()=>!document.querySelector('#armory [data-dye="torso"]').disabled);
  assert.deepEqual(await snapshot(),locked);report.rows.push({case:'shared-region-locks-and-restores-colour-controls'});
 }else report.rows.push({case:'shared-region-entry-unavailable',publicHosting:false});
 assert.deepEqual(report.errors,[]);report.passed=true;
}finally{
 await fs.writeFile(out,JSON.stringify(report,null,2));await context.close();await browser.close();await fs.writeFile(out+'.ownership.json',JSON.stringify({...ownership,active:false,renderingClients:0},null,2));
}
