/** Bounded candidate/control review in the actual Lite/Havok game. No publication.
 * Capture native source playback and normal controls separately; timestamps own duration.
 * https://chromedevtools.github.io/devtools-protocol/tot/Page/#event-screencastFrame
 */
import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {browserOwnership} from '../lib/browser-ownership.mjs';
import {appendFrame,captureSurface,writeCaptureManifest} from '../lib/capture-manifest.mjs';
const url=process.env.ASHEN_TEST_URL,port=process.env.ASHEN_CDP_PORT;
assert(url&&port,'Owned test URL and CDP port required');
const dir=process.env.ASHEN_CAPTURE_DIR||'ve-capture/character-mmo/pilgrim-native-weights-2026-10-01';
const candidate=process.env.ASHEN_SKIN_CANDIDATE||'.cache/character-mmo/wardrobe-v1/skin-corrective-shaped/pilgrimTunic.glb';
const auditionLabel=process.env.ASHEN_GARMENT_AUDITION_LABEL;
const record=process.env.ASHEN_GARMENT_RECORD!=='0';
assert(candidate.startsWith('.cache/'),'Candidate must be isolated');
const bytes=await fs.readFile(candidate),digest=createHash('sha256').update(bytes).digest('hex');
await fs.mkdir(path.join(dir,'frames'),{recursive:true});
const browser=await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
assert(browser.contexts().flatMap(c=>c.pages()).every(p=>p.url()==='about:blank'),'Another owned game is rendering');
const ownership=await browserOwnership(browser,{cdpPort:port,url,purpose:'Pilgrim native weight transfer: baseline/candidate source motions and normal movement',renderingClients:1});
await fs.writeFile(`${dir}/ownership.json`,JSON.stringify(ownership));
const rows=[],errors=[],writes=[];let cdp,context,manifest,recording=false;
try{for(const corrected of [false,true]){
 context=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1});const page=await context.newPage();
 page.on('pageerror',e=>errors.push(e.stack));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 if(corrected){await context.route('**/ashen-reach/human-shape-v1/manifest.json',async route=>{
  const pack=JSON.parse(await fs.readFile('public/ashen-reach/human-shape-v1/manifest.json','utf8'));
  const entry={...pack.items.pilgrimTunic,url:'/__skin_candidate__/pilgrimTunic.glb',bytes:bytes.length,sha256:digest};
  delete entry.compression;delete entry.encodedBytes;pack.items.pilgrimTunic=entry;pack.compactItems.pilgrimTunic=entry;
  await route.fulfill({contentType:'application/json',body:JSON.stringify(pack)});
 });await context.route('**/__skin_candidate__/pilgrimTunic.glb',r=>r.fulfill({contentType:'model/gltf-binary',body:bytes}));}
 await page.goto(url);await page.waitForFunction(()=>globalThis.ASHEN?.whenRest,null,{timeout:90000});await page.evaluate(()=>ASHEN.whenRest);
 await page.evaluate(()=>ASHEN.armory.open());await page.locator('#armory [data-outfit="pilgrim"]').click();
 await page.waitForFunction(()=>!ASHEN.equipment.getStatus().pending&&ASHEN.equipment.getState().torso==='pilgrimTunic');
 await page.waitForFunction(()=>[...document.querySelectorAll('#armory [data-equipment]')].every(e=>e.value===(ASHEN.equipment.getState()[e.dataset.equipment]||'')));
 await page.check('#armory [data-light]');
 const tag=await page.evaluate(label=>{const el=document.createElement('div');el.textContent=label;Object.assign(el.style,{position:'fixed',left:'20px',top:'80px',color:'white',background:'#111d',padding:'8px',zIndex:10000});document.body.append(el);return label;},corrected?(auditionLabel||'CANDIDATE: native body weights'):'BASELINE: retained garment weights');
 if(corrected&&record){manifest={...(await captureSurface(page)),frames:[],timeline:rows};cdp=await context.newCDPSession(page);
 cdp.on('Page.screencastFrame',e=>{void cdp.send('Page.screencastFrameAck',{sessionId:e.sessionId}).catch(()=>{});if(!recording)return;try{const name=`frame-${String(manifest.frames.length).padStart(6,'0')}.jpg`,data=Buffer.from(e.data,'base64');appendFrame(manifest,{name,timestamp:e.metadata.timestamp,bytes:data});writes.push(fs.writeFile(path.join(dir,'frames',name),data));}catch(e){errors.push(e.stack);recording=false;}});
 recording=true;await cdp.send('Page.startScreencast',{format:'jpeg',quality:88,maxWidth:1280,maxHeight:720,everyNthFrame:2});}
 for(const [build,height]of corrected?[[0,1],[-.95,.9],[.95,1.15]]:[[.95,1.15]]){
  await page.evaluate(async({build,height})=>{await ASHEN.creator.set('build',build);await ASHEN.creator.set('height',height);ASHEN.armory.setFocus({height:1.25*height,radius:2.5*height,beta:1.4});ASHEN.scene.camera=ASHEN.armory.camera;},{build,height});
  for(const view of ['front','side','back']){
   await page.locator(`#armory [data-view="${view}"]`).evaluate(e=>e.click());
   for(const motion of ['idle','run','jump','land','fire','lava']){
    await page.selectOption('#armory [data-motion]',motion);await page.evaluate(()=>ASHEN.body.inspection.setPaused(false));
    const duration=await page.evaluate(()=>ASHEN.body.inspection.getState().duration);
    await page.waitForTimeout(corrected&&record?Math.ceil((duration+.15)*1000):100);
    await page.evaluate(()=>{ASHEN.body.inspection.setPaused(true);ASHEN.body.inspection.seek(.48);});await page.waitForTimeout(80);
    await page.screenshot({path:`${dir}/${corrected?'candidate':'baseline'}-${build}-${height}-${view}-${motion}.png`});
   }
  }
  rows.push({tag,build,height,time:Date.now()/1000,state:await page.evaluate(()=>({appearance:ASHEN.getAppearance(),equipment:ASHEN.equipment.getState(),physics:ASHEN.player.getDebugState().usingPhysics,recoveries:ASHEN.player.getDebugState().recoveries,gpuErrors:ASHEN.gpu.errors.slice()}))});
  if(corrected){await page.evaluate(()=>{ASHEN.armory.close();ASHEN.setView('play');ASHEN.rig.distance=ASHEN.rig.distanceTarget=2.7;});
   await page.keyboard.down('KeyW');await page.keyboard.down('ShiftLeft');await page.waitForTimeout(400);await page.keyboard.down('KeyA');await page.waitForTimeout(250);await page.keyboard.up('KeyA');await page.keyboard.press('Space');await page.waitForTimeout(900);await page.keyboard.up('ShiftLeft');await page.keyboard.up('KeyW');
   const state=await page.evaluate(()=>ASHEN.player.getDebugState());assert(state.usingPhysics);assert.equal(state.recoveries,0);rows.push({label:'Normal Havok run, turn and jump',build,height,time:Date.now()/1000});await page.evaluate(()=>ASHEN.armory.open());await page.check('#armory [data-light]');
  }
 }
 if(corrected&&record){recording=false;await cdp.send('Page.stopScreencast');await Promise.all(writes);await writeCaptureManifest(dir,manifest,await captureSurface(page));}
 await context.close();context=null;
 }
 assert.deepEqual(errors,[]);assert(rows.filter(r=>r.state).every(r=>r.state.physics&&r.state.recoveries===0&&r.state.gpuErrors.length===0));
 await fs.writeFile(`${dir}/report.json`,JSON.stringify({candidate,digest,rows,errors,passed:true},null,2));
 console.log(JSON.stringify({frames:manifest?.frames.length||0,rows:rows.length,errors}));
}finally{recording=false;if(cdp)await cdp.send('Page.stopScreencast').catch(()=>{});await Promise.all(writes);await context?.close();await browser.close();await fs.writeFile(`${dir}/ownership.json`,JSON.stringify({...ownership,active:false,renderingClients:0}));}
