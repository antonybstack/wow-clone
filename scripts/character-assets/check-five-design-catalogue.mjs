/** Actual published IDs and normal built Armory, with one tracked renderer.
 * Native source clips and Havok input are separate from throughput measurements.
 * https://chromedevtools.github.io/devtools-protocol/tot/Page/#event-screencastFrame
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {browserOwnership} from '../lib/browser-ownership.mjs';
import {appendFrame,captureSurface,writeCaptureManifest} from '../lib/capture-manifest.mjs';
const url=process.env.ASHEN_TEST_URL,port=process.env.ASHEN_CDP_PORT;
assert(url&&port&&!new URL(url).searchParams.has('coveragePilot'));
const dir=process.env.ASHEN_CAPTURE_DIR||'ve-capture/character-mmo/five-design-catalogue-2026-10-01';
await fs.mkdir(path.join(dir,'frames'),{recursive:true});
const browser=await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
assert(browser.contexts().flatMap(c=>c.pages()).every(p=>p.url()==='about:blank'),'Another owned game is rendering');
const ownership=await browserOwnership(browser,{cdpPort:port,url,purpose:'Five actual wardrobe designs; normal built UI; recording, not FPS',renderingClients:1});
await fs.writeFile(`${dir}/ownership.json`,JSON.stringify(ownership,null,2));
const context=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1}),page=await context.newPage();
const errors=[],timeline=[],requests=[],writes=[];let cdp,manifest,recording=false;
page.on('pageerror',e=>errors.push(e.stack));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('request',r=>requests.push(r.url()));
const mark=async label=>timeline.push({label,timestamp:Date.now()/1000,state:await page.evaluate(()=>({appearance:ASHEN.getAppearance(),equipment:ASHEN.equipment.getState(),physics:ASHEN.player.getDebugState(),gpuErrors:ASHEN.gpu.errors.slice()}))});
async function preset(id){await page.locator(`#armory [data-outfit="${id}"]`).click();await page.waitForFunction(id=>!ASHEN.equipment.getStatus().pending&&Object.entries(ASHEN.equipment.presets[id].loadout).every(([s,v])=>ASHEN.equipment.getState()[s]===v&&document.querySelector(`#armory [data-equipment="${s}"]`).value===(v||'')),id);}
async function patch(values){for(const [slot,id]of Object.entries(values)){const control=page.locator(`#armory [data-equipment="${slot}"]`);if(await control.inputValue()!==(id||''))await control.selectOption(id||'');await page.waitForFunction(({slot,id})=>!ASHEN.equipment.getStatus().pending&&ASHEN.equipment.getState()[slot]===id,{slot,id});}}
async function inspect(label,{motions=['idle','run','fire'],views=['front','side','back']}={}){
 await mark(label);
 for(const view of views){await page.locator(`#armory [data-view="${view}"]`).evaluate(e=>e.click());for(const motion of motions){await page.selectOption('#armory [data-motion]',motion);await page.evaluate(()=>ASHEN.body.inspection.setPaused(false));const duration=await page.evaluate(()=>ASHEN.body.inspection.getState().duration);await page.waitForTimeout((duration+.08)*1000);await page.evaluate(()=>{ASHEN.body.inspection.setPaused(true);ASHEN.body.inspection.seek(.48);});await page.waitForTimeout(60);await page.screenshot({path:path.join(dir,`${label}-${view}-${motion}.png`)});}}
}
try{
 await page.goto(url);await page.waitForFunction(()=>globalThis.ASHEN?.whenRest,null,{timeout:90000});await page.evaluate(()=>ASHEN.whenRest);
 await page.evaluate(()=>{ASHEN.dev.god=true;ASHEN.armory.open();});
 manifest={...(await captureSurface(page)),sourceUrl:url,frames:[],timeline,normalPublishedIds:true,fixturePolicy:'Quiet meadow resets are pose fixtures, not traversal evidence; seven enemies remain active'};cdp=await context.newCDPSession(page);
 cdp.on('Page.screencastFrame',e=>{void cdp.send('Page.screencastFrameAck',{sessionId:e.sessionId}).catch(()=>{});if(!recording)return;try{const name=`frame-${String(manifest.frames.length).padStart(6,'0')}.jpg`,bytes=Buffer.from(e.data,'base64');appendFrame(manifest,{name,timestamp:e.metadata.timestamp,bytes});writes.push(fs.writeFile(path.join(dir,'frames',name),bytes));}catch(e){errors.push(e.stack);recording=false;}});
 recording=true;await cdp.send('Page.startScreencast',{format:'jpeg',quality:86,maxWidth:1280,maxHeight:720,everyNthFrame:2});
 for(const race of ['human','orc','undead']){
  await page.evaluate(()=>ASHEN.armory.open());if(await page.evaluate(()=>ASHEN.equipment.race)!==race){await page.selectOption('#armory [data-race]',race);await page.waitForFunction(r=>ASHEN.equipment.race===r&&!ASHEN.equipment.getStatus().pending,race);}
  await page.check('#armory [data-light]');
  for(const [build,height]of race==='human'?[[0,1],[-.95,.9],[.95,1.15]]:[[0,1]]){
   if(race==='human')await page.evaluate(async({build,height})=>{await ASHEN.creator.set('build',build);await ASHEN.creator.set('height',height);},{build,height});
   await page.evaluate(()=>{ASHEN.reset();ASHEN.player.setWorldPos(0,ASHEN.world.groundHeight(0,-65)+1.7,-65);ASHEN.setView('play');ASHEN.armory.open();ASHEN.armory.setFocus({height:.9*ASHEN.player.heightScale,radius:3.5*ASHEN.player.heightScale,beta:1.4});ASHEN.scene.camera=ASHEN.armory.camera;});
   for(const outfit of ['wayfarer','pilgrim','graveweaver','lector','duskguard']){await preset(outfit);await inspect(`${race}-${build}-${height}-${outfit}`,{motions:outfit==='duskguard'?['idle','run','jump','land','fire','lava','pulse','carry']:outfit==='lector'?['idle','walk','run','fire']:['run'],views:outfit==='duskguard'||outfit==='lector'?['front','side','back']:['back']});}
   for(const [label,base,values]of [
    ['lector-tassets','lector',{legs:'duskguardTassets',boots:'duskguardGreaves',gloves:'duskguardVambraces'}],
    ['pilgrim-tassets','pilgrim',{legs:'duskguardTassets',boots:'duskguardGreaves',gloves:'duskguardVambraces'}],
    ['cuirass-wayfarer','duskguard',{legs:'wayfarerTrousers',boots:'wayfarerBoots',gloves:null,shoulders:null}],
    ['cuirass-graveweaver','duskguard',{legs:'graveweaverSkirt',boots:null,gloves:'graveweaverGloves',shoulders:null}],
    ['bare','duskguard',{helmet:null,torso:null,legs:null,boots:null,gloves:null,shoulders:null,mainHand:null,offHand:null}],
    ['plates-only','duskguard',{torso:null,legs:null,shoulders:null}],
   ]){await preset(base);await patch(values);await inspect(`${race}-${build}-${height}-${label}`,{motions:['run'],views:['front','back']});}
   await preset('duskguard');await page.selectOption('#armory [data-motion]','idle');await page.evaluate(()=>{ASHEN.armory.close();ASHEN.setView('play');ASHEN.rig.distance=ASHEN.rig.distanceTarget=3.3;});
   await page.keyboard.down('KeyW');await page.keyboard.down('ShiftLeft');await page.waitForTimeout(450);await page.keyboard.down('KeyA');await page.waitForTimeout(200);await page.keyboard.up('KeyA');await page.keyboard.press('Space');await page.waitForTimeout(1100);await page.keyboard.up('ShiftLeft');await page.keyboard.up('KeyW');await mark(`${race}-${build}-${height}-native-run-turn-jump`);
   const physics=await page.evaluate(()=>ASHEN.player.getDebugState());assert(physics.usingPhysics&&physics.recoveries===0);await page.evaluate(()=>ASHEN.armory.open());
  }
 }
 assert(!requests.some(u=>u.includes('/__wardrobe_audition__/')||u.includes('/__garment_fit__/')),'A DEV candidate entered the published review');
 for(const id of ['lectorCoat','duskguardCuirass','duskguardTassets','duskguardGreaves','duskguardVambraces'])assert(requests.some(u=>u.includes(id)),`${id} never requested`);
 recording=false;await cdp.send('Page.stopScreencast');await Promise.all(writes);await writeCaptureManifest(dir,manifest,await captureSurface(page));
 assert.deepEqual(errors,[]);assert.deepEqual(await page.evaluate(()=>ASHEN.gpu.errors),[]);
 await fs.writeFile(`${dir}/report.json`,JSON.stringify({sourceUrl:url,actualCatalogue:true,timeline,errors,requests,runtimePassed:true,visualAcceptance:'parent review required'},null,2));
 console.log(JSON.stringify({frames:manifest.frames.length,seconds:manifest.elapsedSeconds,errors}));
}catch(error){await fs.writeFile(`${dir}/failure.json`,JSON.stringify({message:error.stack,timeline,errors,state:await page.evaluate(()=>({appearance:ASHEN.getAppearance(),equipment:ASHEN.equipment.getStatus()})).catch(()=>null)},null,2));throw error;}finally{recording=false;if(cdp)await cdp.send('Page.stopScreencast').catch(()=>{});await Promise.all(writes);if(manifest?.frames.length>1)await writeCaptureManifest(dir,manifest,await captureSurface(page)).catch(()=>{});await context.close();await browser.close();await fs.writeFile(`${dir}/ownership.json`,JSON.stringify({...ownership,active:false,renderingClients:0},null,2));}
