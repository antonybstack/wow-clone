/** Actual saved Human movement and live Armory boot transactions.
 * Normal Havok travel and labelled native pose previews are separate chapters.
 * Capture timestamps/dimensions use the shared recorder, never an FPS estimate.
 * https://chromedevtools.github.io/devtools-protocol/tot/Page/#method-startScreencast
 * https://github.com/BabylonJS/Babylon-Lite/blob/npm-lite-v1.31.1/docs/lite/architecture/02-camera.md
 */
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {CDP_URL} from '../lib/cdp.mjs';
import {browserOwnership} from '../lib/browser-ownership.mjs';
import {captureSurface,appendFrame,writeCaptureManifest} from '../lib/capture-manifest.mjs';
import {defaultAppearance} from '../../src/character/appearance/store.js';
import {validateAppearance} from '../../src/character/appearance/contract.js';
import {HUMAN_IDENTITY_PRESETS} from '../../src/character/appearance/human-identity.js';
import {EQUIPMENT_PRESETS} from '../../src/ashen-reach/equipment-catalog.js';
import {MIXED_FIT_CASES} from './mixed-fit-cases.mjs';
const mixedReview=process.env.ASHEN_MIXED_MOTION==='1';

const url=process.env.ASHEN_TEST_URL,dir=process.env.ASHEN_CAPTURE_DIR;
assert(url&&dir,'An audited URL and new capture directory are required');
const browser=await chromium.connectOverCDP(CDP_URL);
assert(browser.contexts().flatMap(c=>c.pages()).every(p=>p.url()==='about:blank'),'Another owned page is active');
const context=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1});
const page=await context.newPage(),cdp=await context.newCDPSession(page);
const base=defaultAppearance();
const seed=validateAppearance({...base,shape:{...base.shape,height:1.15,build:-.95},equipment:EQUIPMENT_PRESETS.wayfarer.loadout});
await context.addInitScript(recipe=>localStorage.setItem('ashen.appearance.v2',JSON.stringify(recipe)),seed);
await fs.mkdir(`${dir}/frames`,{recursive:true});
const ownership=await browserOwnership(browser,{cdpPort:new URL(CDP_URL).port,url,purpose:'Shared back/foot release motion; no FPS or startup timing claim',renderingClients:1});
await fs.writeFile(`${dir}/ownership.json`,JSON.stringify(ownership,null,2));
const errors=[],timeline=[],writes=[];let manifest,captureError,recording=false;
page.on('pageerror',e=>errors.push(e.message));
page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
cdp.on('Page.screencastFrame',event=>{
 void cdp.send('Page.screencastFrameAck',{sessionId:event.sessionId}).catch(()=>{});
 if(!recording||captureError)return;
 try{
  const name=`frame-${String(manifest.frames.length).padStart(6,'0')}.jpg`,bytes=Buffer.from(event.data,'base64');
  if(appendFrame(manifest,{name,timestamp:event.metadata.timestamp,bytes})!==false)
   writes.push(fs.writeFile(`${dir}/frames/${name}`,bytes).catch(e=>{captureError=e;}));
 }catch(e){captureError=e;}
});
const mark=async name=>{
 await page.evaluate(name=>{
  let label=document.getElementById('capture-note');
  if(!label){label=document.createElement('p');label.id='capture-note';label.style='position:fixed;left:20px;bottom:6px;z-index:99999;background:#171b16e8;color:#eee2ac;padding:6px 10px;font:12px Georgia;pointer-events:none';document.body.append(label);}
  label.textContent=name;
 },name);
 const state=await page.evaluate(()=>({appearance:ASHEN.getAppearance(),physics:ASHEN.player.getDebugState(),enemies:ASHEN.combat.enemies.length,preview:ASHEN.body.inspection?.getState()??null,foot:ASHEN.scene.meshes.filter(m=>m.name==='HumanFootCore').map(m=>({visible:m.visible!==false})),gpuErrors:ASHEN.gpu.errors.slice()}));
 assert(state.physics.usingPhysics);assert.equal(state.physics.recoveries,0);assert.equal(state.enemies,7);assert.deepEqual(state.gpuErrors,[]);
 timeline.push({name,timestamp:manifest?.frames.at(-1)?.timestamp??Date.now()/1000,state});
};
const travel=async name=>{
 await mark(`${name} · normal sprint / jump / Havok · invulnerable`);
 const before=await page.evaluate(()=>({...ASHEN.player.getDebugState().position}));
 // Plain W is the native sprint gait; Shift requests walk in src/input.js.
 await page.keyboard.down('KeyW');await page.waitForTimeout(2500);
 await page.keyboard.press('Space');await page.waitForTimeout(1400);
 await page.keyboard.up('KeyW');await page.waitForTimeout(700);
 const after=await page.evaluate(()=>({...ASHEN.player.getDebugState().position}));
 assert(Math.hypot(after.x-before.x,after.z-before.z)>5,'Normal controls must travel');
 timeline.push({name:`${name} travel`,timestamp:manifest.frames.at(-1)?.timestamp,before,after});
};
const inspectBoots=async(name,{both=false}={})=>{
 await page.getByRole('button',{name:'Armory',exact:true}).click();
 await page.selectOption('#armory [data-motion]','run');
 await page.evaluate(()=>{ASHEN.body.inspection.setPaused(false);ASHEN.armory.setFocus({height:.25*ASHEN.player.heightScale,radius:1.8*ASHEN.player.heightScale,beta:1.05,alpha:Math.PI/2});});
 for(const boots of both?['wayfarerBoots','duskguardGreaves',null]:['wayfarerBoots',null]){
  await page.selectOption('#armory [data-equipment="boots"]',boots??'');
  await page.waitForFunction(id=>ASHEN.equipment.getState().boots===id,boots);
  await mark(`${name} · native Armory run preview · ${boots??'bare feet restored'}`);
  const foot=timeline.at(-1).state.foot;
  assert.equal(foot.length,1);assert.equal(foot[0].visible,boots===null);
  await page.waitForTimeout(1800);
 }
 await page.selectOption('#armory [data-equipment="boots"]','wayfarerBoots');
 await page.waitForFunction(()=>ASHEN.equipment.getState().boots==='wayfarerBoots');
};
try{
 await page.goto(url);await page.waitForFunction(()=>globalThis.ASHEN?.ready&&ASHEN.hostilesReady,null,{timeout:90000});
 assert.deepEqual(await page.evaluate(()=>ASHEN.getAppearance()),seed);
 // Initial open-meadow fixture keeps columns/grave plinths out of close boot views.
 // No further placement or recovery teleport occurs during measured movement.
 await page.evaluate(()=>{const a=ASHEN;a.dev.god=true;a.player.setFlying(false);a.player.setWorldPos(0,a.world.groundHeight(0,-100)+1.7,-100);a.player.setFacing(0);a.rig.yaw=0;a.rig.distance=a.rig.distanceTarget=2.5;});
 await page.waitForTimeout(1000);await page.focus('#renderCanvas');
 manifest={version:1,...await captureSurface(page),frames:[],timeline,purpose:'Normal saved-source motion and labelled native Armory boot previews; no performance claim'};
 recording=true;await cdp.send('Page.startScreencast',{format:'jpeg',quality:90,maxWidth:1280,maxHeight:720,everyNthFrame:4});
 if(mixedReview){
  // Bounded mixed-fit evidence uses the existing recorder and actual Armory.
  // The static matrix owns identity/shape corners; this chapter owns continuous
  // poses, real controls and mid-motion swaps. It is not a performance sample.
  for(const [race,identity,height,build]of [
   ['human','prime-ponytail',1.15,-.95],['human','weathered-bald',.9,.95],
   ['orc',null,1,0],['undead',null,1,0],
  ]){
   await page.evaluate(()=>ASHEN.armory.open());
   if(await page.evaluate(()=>ASHEN.equipment.race)!==race){await page.selectOption('#armory [data-race]',race);await page.waitForFunction(r=>ASHEN.equipment.race===r,race);}
   if(identity){
    await page.getByLabel('Face and hair',{exact:true}).selectOption(identity);
    await page.waitForFunction(id=>ASHEN.creator.identity.selected===id,identity);
    await page.evaluate(async({height,build})=>{await ASHEN.creator.set('height',height);await ASHEN.creator.set('build',build);await ASHEN.creator.settled();},{height,build});
   }
   for(const id of ['cloth-plate','plate-robe']){
    const loadout=MIXED_FIT_CASES.find(c=>c.id===id).loadout;
    assert.equal((await page.evaluate(l=>ASHEN.equipment.setLoadout(l),loadout)).status,'applied');
    await page.evaluate(()=>{ASHEN.armory.close();ASHEN.armory.open();ASHEN.armory.setFocus({height:.86*ASHEN.player.heightScale,radius:3.25*ASHEN.player.heightScale,beta:1.42});});
    await page.check('#armory [data-light]');
    await page.selectOption('#armory [data-motion]','run');await page.evaluate(()=>ASHEN.body.inspection.setPaused(false));
    await mark(`${identity||race} · ${id} · native Armory run preview`);
    for(const alpha of [Math.PI/2,0,-Math.PI/2]){await page.evaluate(alpha=>ASHEN.armory.setFocus({alpha}),alpha);await page.waitForTimeout(800);}
    await page.selectOption('#armory [data-motion]','jump');await page.waitForTimeout(1000);
    await page.selectOption('#armory [data-motion]','fire');await page.waitForTimeout(1000);
   }
   await page.getByRole('button',{name:'Close armory',exact:true}).click();
   await page.focus('#renderCanvas');await travel(`${identity||race} · plate / robe / greaves`);
   // Human boot/foot visibility is checked during swaps. The worn robe partly
   // occludes the upper cuff; full sole views belong to the trouser stills.
   if(identity){await inspectBoots(identity,{both:true});await page.getByRole('button',{name:'Close armory',exact:true}).click();}
  }
 }else{
 await travel('Original Human tall/slender');await inspectBoots('Original Human',{both:true});
 for(const [id,height,build,label]of [['prime-ponytail',1.15,-.95,'Prime ponytail tall/slender'],['weathered-bald',.9,.95,'Weathered bald short/stout']]){
  await page.getByLabel('Face and hair',{exact:true}).selectOption(id);
  await page.waitForFunction(id=>ASHEN.creator.identity.selected===id,id);
  await page.evaluate(async({height,build})=>{await ASHEN.creator.set('height',height);await ASHEN.creator.set('build',build);},{height,build});
  await page.evaluate(()=>ASHEN.creator.settled());
  const appearance=await page.evaluate(()=>ASHEN.getAppearance());
  assert.deepEqual(appearance.components,HUMAN_IDENTITY_PRESETS.find(p=>p.id===id).components);
  assert.equal(appearance.shape.height,height);assert.equal(appearance.shape.build,build);
  await page.selectOption('#armory [data-motion]','idle');
  await page.evaluate(()=>ASHEN.armory.setFocus({height:.85*ASHEN.player.heightScale,radius:3.5*ASHEN.player.heightScale,beta:1.36,alpha:Math.PI/2}));
  assert.equal((await page.evaluate(()=>ASHEN.body.inspection.getState())).id,'idle');
  await mark(`${label} · identity selected through Armory`);await page.waitForTimeout(1800);
  await page.getByRole('button',{name:'Close armory',exact:true}).click();
  await travel(label);await inspectBoots(label);
 }
 await page.getByRole('button',{name:'Close armory',exact:true}).click();
 }
 await mark(mixedReview?'Mixed-fit review complete · Human, Orc and Undead':'Release fit review complete · original, Prime and Weathered');await page.waitForTimeout(700);
 await cdp.send('Page.stopScreencast');recording=false;await Promise.all(writes);if(captureError)throw captureError;
 assert.deepEqual(errors,[]);await writeCaptureManifest(dir,manifest,await captureSurface(page));
 await fs.writeFile(`${dir}/report.json`,JSON.stringify({url,seed,timeline,errors,passed:true},null,2));
 console.log(JSON.stringify({frames:manifest.frames.length,elapsedSeconds:manifest.elapsedSeconds,chapters:timeline.length,errors}));
}finally{
 recording=false;await cdp.send('Page.stopScreencast').catch(()=>{});await Promise.all(writes);
 for(const key of ['KeyW','ShiftLeft'])await page.keyboard.up(key).catch(()=>{});
 await context.close();await browser.close();
 await fs.writeFile(`${dir}/ownership.json`,JSON.stringify({...ownership,active:false,renderingClients:0},null,2));
}
