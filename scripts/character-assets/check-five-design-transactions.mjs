/** Normal built save/refinement/failure checks, one owned renderer, no FPS claim.
 * Hold actual responses to exercise commit boundaries rather than mock adapters.
 * https://playwright.dev/docs/network
 */
import fs from 'node:fs/promises';import assert from 'node:assert/strict';import {chromium} from 'playwright';
import {browserOwnership} from '../lib/browser-ownership.mjs';
const url=process.env.ASHEN_TEST_URL,port=process.env.ASHEN_CDP_PORT,out=process.argv[2];assert(url&&port&&out);
const browser=await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
assert(browser.contexts().flatMap(c=>c.pages()).every(p=>p.url()==='about:blank'),'Another owned page is active');
const ownership=await browserOwnership(browser,{cdpPort:port,url,purpose:'Five-design normal transactions; no recording or FPS',renderingClients:1});
await fs.writeFile(out+'.ownership.json',JSON.stringify(ownership,null,2));
const context=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1}),page=await context.newPage();
const report={url,conditions:'Functional transaction/resource checks only; concurrent source reproduction and encoding may affect timing; no frame-time acceptance',rows:[],errors:[]},requests=[];
page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('503'))report.errors.push(m.text());});page.on('request',r=>requests.push(r.url()));
const snapshot=()=>page.evaluate(()=>({appearance:ASHEN.getAppearance?.()||null,shape:ASHEN.humanShape,equipment:ASHEN.equipment.getState(),meshes:ASHEN.scene.meshes.length,parts:ASHEN.scene.meshes.filter(m=>['HumanTorsoCore','UndeadTorsoCore','DuskguardTrousersUnderTorso','WayfarerTrousersUnderTorso'].includes(m.name)).map(m=>({name:m.name,visible:m.visible!==false})),gpuErrors:ASHEN.gpu.errors.slice(),physics:ASHEN.player.getDebugState()}));
const ready=async()=>{await page.waitForFunction(()=>globalThis.ASHEN?.whenRest,null,{timeout:90000});await page.evaluate(()=>ASHEN.whenRest);};
const equip=async id=>{const r=await page.evaluate(id=>ASHEN.equipment.equipPreset(id),id);assert.equal(r.status,'applied');};
try{
 await page.goto(url);await ready();assert(!requests.some(u=>/lectorCoat|duskguard/.test(u)),'Default start downloaded optional new designs');report.rows.push({case:'default-skips-optional',...await snapshot()});
 await page.evaluate(()=>ASHEN.creator.set('build',.95));
 const human=JSON.parse(await fs.readFile('public/ashen-reach/human-shape-v1/manifest.json'));
 const corrupt=route=>route.fulfill({contentType:'model/gltf-binary',body:Buffer.from([0])}),asset=human.items.duskguardCuirass;
 const before=await snapshot();await page.route(`**${asset.url}`,corrupt);
 const failed=await page.evaluate(()=>ASHEN.equipment.equip('torso','duskguardCuirass'));
 assert.equal(failed.status,'failed');assert.deepEqual((await snapshot()).appearance,before.appearance);assert.equal((await snapshot()).meshes,before.meshes);
 await page.unroute(`**${asset.url}`,corrupt);report.rows.push({case:'corrupt-new-plate-preserves-appearance',result:failed,...await snapshot()});
 const raceResults=await page.evaluate(async()=>Promise.all([ASHEN.equipment.equipPreset('lector'),ASHEN.equipment.equipPreset('duskguard')]));assert.equal(raceResults[1].status,'applied');assert.equal((await snapshot()).appearance.equipment.torso,'duskguardCuirass');report.rows.push({case:'latest-new-design-wins',results:raceResults.map(r=>r.status),...await snapshot()});
 for(const race of ['human','orc','undead']){
  if(await page.evaluate(()=>ASHEN.equipment.race)!==race)await page.evaluate(r=>ASHEN.equipment.switchRace(r),race);
  for(const preset of ['lector','duskguard']){
   await equip(preset);const saved=(await snapshot()).appearance;
   await page.reload();await ready();assert.deepEqual((await snapshot()).appearance,saved);report.rows.push({case:'new-design-save-reload',race,preset,...await snapshot()});
  }
  await page.evaluate(()=>ASHEN.renderLoop.beginMeasurement());
  const counts=[];
  for(let cycle=0;cycle<12;cycle++){
   for(const preset of ['lector','duskguard','wayfarer','graveweaver'])await equip(preset);
   const state=await snapshot();assert.deepEqual(state.gpuErrors,[]);counts.push(state.meshes);
  }
  assert(counts.slice(3).every(n=>n===counts[3]),`Unbounded ${race} mesh growth: ${counts}`);report.rows.push({case:'new-piece-swap-plateau',race,cycles:12,meshCounts:counts,intervals:await page.evaluate(()=>ASHEN.renderLoop.endMeasurement())});
 }
 await page.evaluate(()=>ASHEN.equipment.switchRace('human'));await page.evaluate(async()=>{await ASHEN.creator.set('build',-.95);await ASHEN.creator.set('height',.9);});await equip('lector');
 const saved=(await snapshot()).appearance;let release;const gate=new Promise(resolve=>{release=resolve;});let held=0;
 await page.route(`**${human.items.lectorCoat.url}`,async route=>{held++;await gate;await route.continue();});
 try{await page.reload();await page.waitForFunction(()=>globalThis.ASHEN?.playableReady,null,{timeout:90000});const first=await snapshot();assert.deepEqual(first.shape.weights,[.95,0]);assert.equal(first.shape.heightScale,.9);assert.deepEqual(first.equipment,saved.equipment);assert(requests.some(u=>u.endsWith(human.compactItems.lectorCoat.url)));await page.keyboard.down('KeyW');await page.waitForTimeout(400);await page.keyboard.up('KeyW');report.rows.push({case:'saved-lector-compact-play-before-full',...await snapshot()});}finally{release();}
 await page.unrouteAll({behavior:'wait'});await ready();assert.deepEqual((await snapshot()).appearance,saved);assert(held>0,'The full Lector refinement response was never held');report.rows.push({case:'full-lector-refines-same-identity',heldResponses:held,...await snapshot()});
 assert.deepEqual(report.errors,[]);assert.deepEqual((await snapshot()).gpuErrors,[]);report.passed=true;
}finally{await fs.writeFile(out,JSON.stringify(report,null,2));await context.close();await browser.close();await fs.writeFile(out+'.ownership.json',JSON.stringify({...ownership,active:false,renderingClients:0},null,2));}
