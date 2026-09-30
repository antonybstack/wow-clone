/** Owned single-renderer functional/visual checks. Run separately from FPS sampling. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium} from 'playwright';
const port=process.env.ASHEN_CDP_PORT,url=process.env.ASHEN_TEST_URL;
assert(port&&url,'An audited owned CDP port and game URL are required');
const out=process.env.ASHEN_CUSTOMIZATION_REPORT || '.cache/production-customization-2026-09-30/functional.json';
const browser=await chromium.connectOverCDP(`http://127.0.0.1:${port}`),context=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1}),page=await context.newPage();
const errors=[],requests=[],report={url,rows:[],errors};
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('500'))errors.push(m.text());});page.on('request',r=>requests.push(r.url()));
const ready=async()=>{await page.goto(url);await page.waitForFunction(()=>globalThis.ASHEN?.ready,null,{timeout:90000});await page.evaluate(()=>{ASHEN.dev.god=true;});};
const snapshot=()=>page.evaluate(()=>({appearance:ASHEN.getAppearance(),shape:ASHEN.humanShape,height:ASHEN.player.capsuleHeight,rootY:ASHEN.body.root.position.y,gpuErrors:ASHEN.gpu.errors.slice(),meshes:ASHEN.scene.meshes.length,bodyName:ASHEN.body.root.name}));
try{
 await ready();assert(!requests.some(u=>u.includes('/human-shape-v1/')),'neutral startup must not fetch the family');
 report.rows.push({case:'neutral',...await snapshot()});
 // Fail both requests initially: a successful speculative garment fetch would otherwise
 // make the later garment-failure route hit a warmed promise rather than the network.
 await page.route('**/human-shape-v1/wayfarerTunic-*.bin',r=>r.fulfill({status:500,body:'intentional garment failure'}));
 await page.route('**/human-shape-v1/body-*.bin',r=>r.fulfill({status:500,body:'intentional body failure'}));
 const failed=await page.evaluate(async()=>{ASHEN.armory.open();const before=ASHEN.body.root;try{await ASHEN.creator.set('build',.5);return {failed:false};}catch{return {failed:true,same:before===ASHEN.body.root,build:ASHEN.getAppearance().shape.build,status:document.querySelector('.creator-section [role=status]').textContent};}});
 assert(failed.failed&&failed.same&&failed.build===0);assert.match(failed.status,/unchanged/);report.rows.push({case:'failed-body',...failed});
 await page.unroute('**/human-shape-v1/body-*.bin');
 const garmentFailure=await page.evaluate(async()=>{const before=ASHEN.body.root,meshes=ASHEN.scene.meshes.length;try{await ASHEN.creator.set('build',.5);return {failed:false};}catch{return {failed:true,same:before===ASHEN.body.root,build:ASHEN.getAppearance().shape.build,meshesBefore:meshes,meshesAfter:ASHEN.scene.meshes.length,gpuErrors:ASHEN.gpu.errors.slice()};}});
 assert(garmentFailure.failed&&garmentFailure.same&&garmentFailure.build===0);assert.equal(garmentFailure.meshesBefore,garmentFailure.meshesAfter);assert.deepEqual(garmentFailure.gpuErrors,[]);report.rows.push({case:'failed-garment',...garmentFailure});
 await page.unroute('**/human-shape-v1/wayfarerTunic-*.bin');

 // Delay the first optional texture refinement, then change race while it is
 // loading. The completed upload must not rebuild the retired Human material.
 await page.route('**/human-shape-v1/texture-*',async r=>{await new Promise(resolve=>setTimeout(resolve,600));await r.continue();});
 await page.evaluate(()=>ASHEN.creator.set('build',-.95));
 await page.evaluate(()=>ASHEN.equipment.switchRace('orc'));await page.waitForTimeout(900);
 assert.deepEqual((await snapshot()).gpuErrors,[]);report.rows.push({case:'race-during-texture-refinement',...await snapshot()});
 await page.unroute('**/human-shape-v1/texture-*');await page.evaluate(()=>ASHEN.equipment.switchRace('human'));
 await page.evaluate(()=>ASHEN.renderLoop.beginMeasurement());
 for(const build of [-.95,-.5,0,.5,.95])for(const height of [.9,1.15]) {
  await page.evaluate(async({build,height})=>{await ASHEN.creator.set('build',build);await ASHEN.creator.set('height',height);},{build,height});
  for(const preset of ['wayfarer','graveweaver']) {
   const result=await page.evaluate(id=>ASHEN.equipment.equipPreset(id),preset);assert.equal(result.status,'applied');
   const state=await snapshot();assert.equal(state.appearance.shape.build,build);assert.equal(state.appearance.shape.height,height);assert.equal(state.rootY,-state.height/2);assert.deepEqual(state.gpuErrors,[]);report.rows.push({case:'domain',preset,build,height,...state});
  }
 }
 await page.evaluate(async()=>{await ASHEN.creator.set('build',-.95);await ASHEN.creator.set('height',.9);});
 report.promotionIntervals=await page.evaluate(()=>ASHEN.renderLoop.endMeasurement());
 const saved=(await snapshot()).appearance;
 await page.reload();await page.waitForFunction(()=>globalThis.ASHEN?.playableReady,null,{timeout:90000});
 const first=await page.evaluate(()=>({shape:ASHEN.humanShape,gpuErrors:ASHEN.gpu.errors.slice()}));assert.deepEqual(first.shape.weights,[.95,0]);assert.equal(first.shape.heightScale,.9);assert.deepEqual(first.gpuErrors,[]);
 await page.waitForFunction(()=>ASHEN.ready,null,{timeout:90000});assert.deepEqual((await snapshot()).appearance,saved);report.rows.push({case:'saved-first-playable',...first});
 for(const race of ['orc','undead','human']) {
  await page.evaluate(r=>ASHEN.equipment.switchRace(r),race);const state=await snapshot();assert.equal(state.appearance.race,race);assert.equal(await page.evaluate(()=>ASHEN.creator.state.race),race);assert.deepEqual(state.gpuErrors,[]);report.rows.push({case:'race',race,...state});
 }
 // Save/reload a non-Human outfit without replacing it with a default preset.
 for(const race of ['orc','undead']) {
  await page.evaluate(async r=>{await ASHEN.equipment.switchRace(r);await ASHEN.equipment.equip('helmet',null);},race);
  const wanted=(await snapshot()).appearance;
  await page.reload();await page.waitForFunction(()=>globalThis.ASHEN?.ready,null,{timeout:90000});
  assert.deepEqual((await snapshot()).appearance,wanted);report.rows.push({case:'saved-race-outfit',race,...await snapshot()});
 }
 // Race bodies must stay staged until their outfit also succeeds. The inherited
 // swap-first rollback recreated the donor and orphaned the previous clothing.
 await page.evaluate(async()=>{await ASHEN.equipment.switchRace('orc');await ASHEN.equipment.equipPreset('graveweaver');});
 const refusedRace=async(target)=>page.evaluate(async race=>{
  const root=ASHEN.body.root,before=ASHEN.getAppearance(),meshes=ASHEN.scene.meshes.length;
  try{await ASHEN.equipment.switchRace(race);return {failed:false};}
  catch{return {failed:true,sameRoot:root===ASHEN.body.root,sameAppearance:JSON.stringify(before)===JSON.stringify(ASHEN.getAppearance()),meshesBefore:meshes,meshesAfter:ASHEN.scene.meshes.length};}
 },target);
 for(const [pattern,target]of [['**/equipment-undead/body.glb','undead'],['**/equipment-undead/manifest.json','undead']]) {
  await page.route(pattern,r=>r.fulfill({status:500,body:'intentional race failure'}));
  const result=await refusedRace(target);assert(result.failed&&result.sameRoot&&result.sameAppearance);assert.equal(result.meshesBefore,result.meshesAfter);report.rows.push({case:'failed-race',pattern,...result});await page.unroute(pattern);
 }
 const pilgrim=await page.evaluate(()=>ASHEN.equipment.equip('torso','pilgrimTunic'));assert.equal(pilgrim.status,'applied');
 assert.equal(await page.evaluate(()=>ASHEN.equipment.getState().torso),'pilgrimTunic');
 const returnPattern='**/ashen-reach/equipment/pilgrimTunic.glb';await page.route(returnPattern,r=>r.fulfill({status:500,body:'intentional Human return failure'}));
 const failedReturn=await refusedRace('human');assert(failedReturn.failed&&failedReturn.sameRoot&&failedReturn.sameAppearance);assert.equal(failedReturn.meshesBefore,failedReturn.meshesAfter);report.rows.push({case:'failed-Human-return',...failedReturn});await page.unroute(returnPattern);
 await page.evaluate(()=>ASHEN.equipment.switchRace('human'));
 await page.evaluate(()=>ASHEN.armory.open());
 assert.equal(await page.locator('#armory [data-race]').inputValue(),'human');
 await page.screenshot({path:out.replace('.json','-armory.png')});
 await page.evaluate(()=>ASHEN.armory.close());await page.keyboard.down('KeyW');await page.waitForTimeout(1200);await page.keyboard.up('KeyW');await page.keyboard.press('Space');await page.waitForTimeout(500);await page.keyboard.press('Digit1');await page.waitForTimeout(1100);
 assert.deepEqual((await snapshot()).gpuErrors,[]);assert.deepEqual(errors,[]);
}finally{await fs.writeFile(out,JSON.stringify(report,null,2));await context.close();await browser.close();}
