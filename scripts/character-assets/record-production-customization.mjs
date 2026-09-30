/** Live domain review on one owned game page, separately from performance sampling.
 * Capture timestamps and dimensions: https://chromedevtools.github.io/devtools-protocol/tot/Page/#event-screencastFrame
 */
import fs from 'node:fs/promises';import path from 'node:path';import assert from 'node:assert/strict';import {chromium} from 'playwright';
const url=process.env.ASHEN_TEST_URL,port=process.env.ASHEN_CDP_PORT;assert(url&&port);
const dir=process.env.ASHEN_CAPTURE_DIR||'ve-capture/character-mmo/production-customization-2026-09-30';await fs.mkdir(path.join(dir,'frames'),{recursive:true});
const browser=await chromium.connectOverCDP(`http://127.0.0.1:${port}`),context=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1}),page=await context.newPage(),cdp=await context.newCDPSession(page);
const frames=[],writes=[],timeline=[],errors=[];let recording=false;
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
cdp.on('Page.screencastFrame',e=>{void cdp.send('Page.screencastFrameAck',{sessionId:e.sessionId});if(!recording)return;const name=`frame-${String(frames.length).padStart(5,'0')}.jpg`;frames.push({name,timestamp:e.metadata.timestamp,width:e.metadata.deviceWidth,height:e.metadata.deviceHeight});writes.push(fs.writeFile(path.join(dir,'frames',name),Buffer.from(e.data,'base64')));});
const mark=async(label)=>timeline.push({frame:frames.length,timestamp:frames.at(-1)?.timestamp??null,label,appearance:await page.evaluate(()=>ASHEN.getAppearance())});
const settle=async()=>{await page.evaluate(()=>ASHEN.creator.settled());await page.evaluate(()=>ASHEN.whenNextGpuFrame());};
const wait=ms=>page.waitForTimeout(ms);
try {
 await page.goto(url);await page.waitForFunction(()=>globalThis.ASHEN?.ready,null,{timeout:90000});await page.evaluate(()=>{ASHEN.dev.god=true;ASHEN.armory.open();});
 recording=true;await cdp.send('Page.startScreencast',{format:'jpeg',quality:86,maxWidth:1280,maxHeight:720,everyNthFrame:2});
 await mark('Normal URL: Human height and signed build controls');await wait(1000);
 // Use the rendered UI, then allow its real asynchronous transaction to settle.
 for(const [name,value] of [['Build',-.95],['Height',.9]]) {
  const input=page.locator(`.creator-section input[aria-label="${name}"]`);await input.fill(String(value));await input.dispatchEvent('input');await settle();await wait(600);
 }
 await mark('Saved short slender identity, full Graveweaver');await page.evaluate(()=>ASHEN.equipment.equipPreset('graveweaver'));await wait(900);
 let releaseRefinement;
 const refinementGate=new Promise(resolve=>{releaseRefinement=resolve;});
 await page.route('**/human-shape-v1/*.bin',async route=>{
  if(!/\/body-|\-compact-/.test(route.request().url()))await refinementGate;
  await route.continue();
 });
 try {
  await page.reload();await page.waitForFunction(()=>globalThis.ASHEN?.ready,null,{timeout:90000});
  await page.evaluate(()=>{ASHEN.dev.god=true;});await mark('Reload restores selected silhouette and compact clothing before detail');
  await page.keyboard.down('KeyW');await wait(700);await page.keyboard.down('KeyA');await wait(350);await page.keyboard.up('KeyA');
  await page.keyboard.press('Space');await wait(1100);await page.keyboard.up('KeyW');
 }finally{releaseRefinement();}
 // Wait for held responses to finish before removing their handlers.
 // https://playwright.dev/docs/api/class-page#page-unroute-all
 await page.unrouteAll({behavior:'wait'});
 await page.evaluate(()=>ASHEN.creator.set('height',.9));
 await page.evaluate(()=>ASHEN.armory.open());await mark('Full clothing refines the same saved identity');await wait(1200);
 const presets={
  wayfarer:{helmet:null,torso:'wayfarerTunic',legs:'wayfarerTrousers',boots:'wayfarerBoots',gloves:null,mainHand:'ironSword',offHand:null},
  graveweaver:{helmet:'graveweaverHood',torso:'graveweaverTop',legs:'graveweaverSkirt',boots:null,gloves:'graveweaverGloves',mainHand:'graveweaverStaff',offHand:'graveweaverBook'},
  'pilgrim-largest':{helmet:'graveweaverHood',torso:'pilgrimTunic',legs:'graveweaverSkirt',boots:'wayfarerBoots',gloves:'graveweaverGloves',mainHand:'graveweaverStaff',offHand:'graveweaverBook'},
  'mixed-uncovered':{helmet:null,torso:'wayfarerTunic',legs:'graveweaverSkirt',boots:'wayfarerBoots',gloves:null,mainHand:null,offHand:null},
  'mixed-staff':{helmet:null,torso:'graveweaverTop',legs:'wayfarerTrousers',boots:'wayfarerBoots',gloves:null,mainHand:'graveweaverStaff',offHand:null},
 };
 for(const build of [-.95,.95])for(const height of [.9,1.15])for(const [outfit,gear]of Object.entries(presets)) {
  await page.evaluate(async({build,height,gear})=>{await ASHEN.creator.set('build',build);await ASHEN.creator.set('height',height);await ASHEN.equipment.setLoadout(gear);ASHEN.armory.close();ASHEN.setView('play');ASHEN.rig.distance=ASHEN.rig.distanceTarget=2.7;ASHEN.rig.pitch=.1;
   // Repeatable pose fixtures near the real dummy; these resets are not traversal evidence.
   const d=ASHEN.combat.dummy.position,z=d.z-24;
   ASHEN.player.setWorldPos(d.x,ASHEN.world.groundHeight(d.x,z)+1.7,z);
   ASHEN.player.setFacing(0);ASHEN.rig.yaw=0;ASHEN.combat.targeting.clear();
  },{build,height,gear});
  await mark(`${build<0?'slender':'stout'} ${Math.abs(build)} / height ${height} / ${outfit}: orbit, travel, jump, cast`);
  await page.evaluate(async()=>{const y=ASHEN.rig.yaw,t=performance.now();while(performance.now()-t<1600){ASHEN.rig.yaw=y+(performance.now()-t)/1600*Math.PI*2;await new Promise(requestAnimationFrame);}ASHEN.rig.yaw=y;});
  await page.keyboard.down('KeyW');await wait(500);await page.keyboard.down('KeyA');await wait(300);await page.keyboard.up('KeyA');await page.keyboard.down('ShiftLeft');await page.keyboard.press('Space');await wait(1000);await page.keyboard.up('ShiftLeft');await page.keyboard.up('KeyW');await page.waitForFunction(()=>ASHEN.player.getGrounded()&&ASHEN.body.getState().phase!=='air');
  for(let attempt=0;attempt<16;attempt++) {
   await page.keyboard.press('Tab');await wait(40);
   if(await page.evaluate(()=>ASHEN.combat.targeting.current===ASHEN.combat.dummy))break;
  }
  assert(await page.evaluate(()=>ASHEN.combat.targeting.current===ASHEN.combat.dummy),'Tab must select the real dummy');
  for(const key of [1,2]) {
   await page.keyboard.press(`Digit${key}`);
   await page.waitForFunction(k=>ASHEN.combat.pendingSpell===k&&ASHEN.body.getState().castingShoot,key,{timeout:1500});
   await mark(`Verified spell ${key} windup`);
   await wait(key===2?2400:1700);
   await page.waitForFunction(()=>!ASHEN.body.getState().castingShoot);
  }
 }
 for(const race of ['orc','undead','human']) {
  await page.evaluate(()=>ASHEN.armory.open());
  await page.locator('#armory [data-race]').selectOption(race);
  await page.waitForFunction(r=>ASHEN.equipment.race===r,race);
  await page.evaluate(()=>ASHEN.armory.close());await mark(`Atomic race change: ${race}`);
  await page.keyboard.down('KeyA');await wait(700);await page.keyboard.up('KeyA');await wait(500);
 }
 await page.evaluate(()=>ASHEN.armory.open());await mark('The same editable recipe remains after gameplay');await wait(1000);
 recording=false;await cdp.send('Page.stopScreencast');await Promise.all(writes);
 const sorted=frames.toSorted((a,b)=>a.timestamp-b.timestamp).filter((f,i,a)=>i===0||f.timestamp!==a[i-1].timestamp);
 assert(sorted.length>2);assert(sorted.every(f=>f.width===1280&&f.height===720));assert.deepEqual(await page.evaluate(()=>[renderCanvas.width,renderCanvas.height]),[1280,720]);assert.deepEqual(errors,[]);assert.deepEqual(await page.evaluate(()=>ASHEN.gpu.errors),[]);
 await fs.writeFile(path.join(dir,'capture-manifest.json'),JSON.stringify({sourceUrl:url,viewport:[1280,720],canvas:[1280,720],frames:sorted,timeline,errors},null,2));
 console.log(JSON.stringify({frames:sorted.length,seconds:sorted.at(-1).timestamp-sorted[0].timestamp,errors}));
}finally{recording=false;await cdp.send('Page.stopScreencast').catch(()=>{});await cdp.detach();await context.close();await browser.close();}
