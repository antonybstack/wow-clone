/** Live source geometry/material review in the actual game.
 * Own one audited renderer, route only the existing shape candidate asset.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
import {browserOwnership} from '../lib/browser-ownership.mjs';
import {appendFrame,captureSurface,writeCaptureManifest} from '../lib/capture-manifest.mjs';
const port=process.env.ASHEN_CDP_PORT,url=process.env.ASHEN_TEST_URL,age=process.argv[2]||'old';
assert(port&&url&&['young','old','young-hair','old-hair'].includes(age));
const kind=process.env.ASHEN_IDENTITY_KIND||'grey';assert(['grey','painted'].includes(kind));
const file=`.cache/character-mmo/identity-v1/human-${age}-${kind}.glb`;
const sourceBytes=await fs.readFile(file),sourceSha256=createHash('sha256').update(sourceBytes).digest('hex');
let hoodSha256=null;
const dir=`ve-capture/character-mmo/identity-v1/${age}-${kind}`;
await fs.mkdir(path.join(dir,'frames'),{recursive:true});
const browser=await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
assert(browser.contexts().flatMap(c=>c.pages()).every(p=>p.url()==='about:blank'));
const context=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1}),page=await context.newPage();
const errors=[],timeline=[],writes=[];
let cdp,manifest,recording=false;
await fs.writeFile(`${dir}/ownership.json`,JSON.stringify(await browserOwnership(browser,{cdpPort:port,url,purpose:'Human continuous-source geometry/material review',renderingClients:1})));
page.on('pageerror',e=>errors.push(e.stack));
page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
const assetPattern=age.includes('-hair')?'**/__human_hair__/human-ponytail01-tail-shape-family-candidate.glb':'**/__human_shape__/human-shape-family-v1.glb';
await page.route(assetPattern,async r=>r.fulfill({status:200,contentType:'model/gltf-binary',body:sourceBytes}));
if(process.env.ASHEN_IDENTITY_HOOD){
 const crypto=await import('node:crypto'),bytes=await fs.readFile(`.cache/character-mmo/identity-v1/hood-${age.split('-')[0]}.glb`),manifest=JSON.parse(await fs.readFile('.cache/character-mmo/m005/manifest.json','utf8'));
 const fit=JSON.parse(await fs.readFile(`.cache/character-mmo/identity-v1/hood-${age.split('-')[0]}-fit.json`,'utf8'));
 assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),fit.assembledSha256,'Stale age-specific hood');
 hoodSha256=fit.assembledSha256;
 manifest.items.graveweaverHood.sha256=crypto.createHash('sha256').update(bytes).digest('hex');manifest.items.graveweaverHood.bytes=bytes.length;
 await page.route('**/__garment_fit__/manifest.json',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(manifest)}));
 await page.route('**/__garment_fit__/graveweaverHood.glb',r=>r.fulfill({status:200,contentType:'model/gltf-binary',body:bytes}));
}
const mark=async(label)=>timeline.push({label,timestamp:Date.now()/1000,state:await page.evaluate(()=>({height:ASHEN.player.capsuleHeight,hairVisible:ASHEN.scene.meshes.find(m=>m.name==='HumanPonytail01')?.visible,armoryOpen:ASHEN.armory.isOpen,cameraActive:ASHEN.scene.camera===ASHEN.armory.camera,camera:{target:{x:ASHEN.armory.camera.target.x,y:ASHEN.armory.camera.target.y,z:ASHEN.armory.camera.target.z},radius:ASHEN.armory.camera.radius},rootY:ASHEN.body.root.position.y,shape:ASHEN.humanShape,physics:ASHEN.player.getDebugState().usingPhysics,recoveries:ASHEN.player.getDebugState().recoveries,gpuErrors:ASHEN.gpu.errors.slice()}))});
try{
 const routeUrl=new URL(url);if(age.includes('-hair'))routeUrl.searchParams.set('humanHair','ponytail');
 await page.goto(routeUrl.href);
 await page.waitForFunction(()=>globalThis.ASHEN?.whenRest,null,{timeout:90000});
 await page.evaluate(()=>ASHEN.whenRest);
 await page.evaluate(()=>{const shape=ASHEN.humanShape;ASHEN.setHumanShapeLive({weights:shape.weights.map(w=>w*.95),heightScale:shape.heightScale});});
 await page.evaluate(()=>{ASHEN.dev.god=true;ASHEN.armory.open();ASHEN.armory.setFocus({height:1.55,radius:1.35,beta:1.42});});
 for(const slot of ['torso','legs','boots','mainHand']){
  await page.selectOption(`#armory [data-equipment="${slot}"]`,'');
  await page.waitForFunction(slot=>ASHEN.equipment.getState()[slot]===null,slot);
 }
 await page.check('#armory [data-light]');
 await page.addStyleTag({content:'#armory > * { opacity: 0 !important; }'});
 await page.evaluate(()=>ASHEN.armory.setFocus({height:1.5*ASHEN.player.heightScale,radius:2.1*ASHEN.player.heightScale,beta:Math.PI/2}));
 await page.waitForTimeout(400);
 manifest={...(await captureSurface(page)),frames:[],timeline};
 cdp=await context.newCDPSession(page);
 cdp.on('Page.screencastFrame',e=>{
  void cdp.send('Page.screencastFrameAck',{sessionId:e.sessionId}).catch(()=>{});
  if(!recording)return;
  try{const name=`frame-${String(manifest.frames.length).padStart(6,'0')}.jpg`,bytes=Buffer.from(e.data,'base64');appendFrame(manifest,{name,timestamp:e.metadata.timestamp,bytes});writes.push(fs.writeFile(path.join(dir,'frames',name),bytes));}catch(e){errors.push(e.stack);recording=false;}
 });
 recording=true;
 await cdp.send('Page.startScreencast',{format:'jpeg',quality:88,maxWidth:1280,maxHeight:720,everyNthFrame:2});
 for(const [name,delta]of [['front',0],['side',Math.PI/2],['back',Math.PI/2]]){
  await page.evaluate(delta=>{ASHEN.armory.camera.alpha+=delta;ASHEN.scene.camera=ASHEN.armory.camera;},delta);
  await mark(name);await page.waitForTimeout(1200);await page.screenshot({path:`${dir}/${name}.png`});
 }
 await page.locator('#armory [data-outfit="warden"]').evaluate(e=>e.click());
 await page.waitForFunction(()=>ASHEN.equipment.getState().helmet==='graveweaverHood');
 await page.evaluate(()=>{ASHEN.armory.open();ASHEN.armory.setFocus({height:1.5*ASHEN.player.heightScale,radius:2.1*ASHEN.player.heightScale,beta:Math.PI/2});});
 await page.evaluate(()=>{ASHEN.scene.camera=ASHEN.armory.camera;});
 await page.waitForTimeout(600);await mark('hood at source neck/scalp');
 await page.screenshot({path:`${dir}/hood.png`});await page.waitForTimeout(1400);
 for(const [name,delta]of [['hood-back',0],['hood-side',-Math.PI/2],['hood-front',-Math.PI/2]]){
  await page.evaluate(delta=>{ASHEN.armory.camera.alpha+=delta;},delta);
  await mark(name);await page.waitForTimeout(800);await page.screenshot({path:`${dir}/${name}.png`});
 }
 await page.selectOption('#armory [data-equipment="helmet"]','');
 await page.waitForFunction(()=>ASHEN.equipment.getState().helmet===null);
 await mark('headwear removed; component restored');
 await page.evaluate(()=>{ASHEN.armory.close();ASHEN.setView('play');ASHEN.rig.distance=ASHEN.rig.distanceTarget=2.2;});
 await mark('normal Havok locomotion');await page.keyboard.down('KeyW');await page.waitForTimeout(1400);
 await page.keyboard.press('Space');await page.waitForTimeout(800);await page.keyboard.up('KeyW');
 await page.keyboard.press('Digit1');await page.waitForTimeout(1800);
 await mark('source cast');
 assert.deepEqual(errors,[]);assert.deepEqual(await page.evaluate(()=>ASHEN.gpu.errors),[]);
 await cdp.send('Page.stopScreencast');recording=false;await Promise.all(writes);
 await writeCaptureManifest(dir,manifest,await captureSurface(page));
 if(age.includes('-hair')){assert.equal(timeline[0].state.hairVisible,true);assert.equal(timeline.find(m=>m.label==='hood at source neck/scalp').state.hairVisible,false);assert.equal(timeline.find(m=>m.label==='headwear removed; component restored').state.hairVisible,true);}
 await fs.writeFile(`${dir}/report.json`,JSON.stringify({age,file,sourceSha256,hoodSha256,hood:process.env.ASHEN_IDENTITY_HOOD?'normalized native fit':'original M005',timeline,errors,passed:true},null,2));
 console.log(JSON.stringify({age,frames:manifest.frames.length,errors}));
}finally{
 recording=false;if(cdp)await cdp.send('Page.stopScreencast').catch(()=>{});
 await Promise.all(writes);await context.close();await browser.close();
 const ownership=JSON.parse(await fs.readFile(`${dir}/ownership.json`));ownership.active=false;await fs.writeFile(`${dir}/ownership.json`,JSON.stringify(ownership));
}
