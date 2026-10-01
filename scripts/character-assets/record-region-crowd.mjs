/** Actual-region actor transitions in reviewed live motion. Capture is separate
 * from performance sampling and owns one disposable browser context.
 * https://chromedevtools.github.io/devtools-protocol/tot/Page/#method-startScreencast
 */
import fs from 'node:fs/promises';import path from 'node:path';import assert from 'node:assert/strict';import {chromium} from 'playwright';
import {appendFrame,captureSurface,writeCaptureManifest} from '../lib/capture-manifest.mjs';
const port=Number(process.env.ASHEN_CDP_PORT),url=process.env.ASHEN_TEST_URL;assert(port&&url,'Select an audited owned harness');
const dir=process.env.ASHEN_CAPTURE_DIR||'ve-capture/character-mmo/region-actors-2026-10-01';await fs.mkdir(path.join(dir,'frames'),{recursive:true});
const browser=await chromium.connectOverCDP(`http://127.0.0.1:${port}`);assert(browser.contexts().flatMap(c=>c.pages()).every(p=>p.url()==='about:blank'));
const context=await browser.newContext({viewport:{width:1280,height:720}}),page=await context.newPage(),errors=[],timeline=[],writes=[];let cdp,manifest,recording=false;
page.on('pageerror',e=>errors.push(e.stack));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
async function mark(label){timeline.push({label,timestamp:manifest.frames.at(-1)?.timestamp,state:await page.evaluate(()=>CROWD.snapshot())});}
try{
 await page.goto(url);await page.waitForFunction(()=>globalThis.ASHEN?.ready&&ASHEN.hostilesReady,null,{timeout:90000});
 await page.evaluate(async()=>{
  const {createRegionCrowd}=await import('/src/character/region-crowd/renderer.js');globalThis.STATE=await import('/src/character/region-crowd/actor-state.js');const {decodePreparedCrowdAppearance}=await import('/src/character/crowd-probe/batches.js');globalThis.CROWD=await createRegionCrowd(ASHEN);globalThis.RECIPES=Object.fromEntries(Object.entries(CROWD.resources().prepared.manifest.variants).map(([k,v])=>[k,decodePreparedCrowdAppearance(v.recipe)]));
  ASHEN.metrics.setInternalResolution(1280,720);ASHEN.dev.god=true;ASHEN.setView('play');ASHEN.player.setWorldPos(0,ASHEN.world.groundHeight(0,59)+1.7,59);ASHEN.player.setFacing(0);ASHEN.rig.yaw=0;ASHEN.rig.pitch=.13;ASHEN.rig.distance=ASHEN.rig.distanceTarget=4;
  for(let i=0;i<5;i++){const recipe=structuredClone(i%2?RECIPES.warden:RECIPES.wayfarer);if(i===0)recipe.shape={...recipe.shape,height:.9,build:.95};if(i===4)recipe.shape={...recipe.shape,height:1.15,build:-.95};const x=(i-2)*1.7,z=65;await CROWD.set(STATE.createRegionActor({id:`motion-${i}`,recipe,transform:{x,y:ASHEN.world.groundHeight(x,z),z,yaw:i*.08},motion:{clip:i%2?'Idle_Loop':'Walk_Loop',loop:true,startedAt:CROWD.now(),offsetSeconds:i*.1}}));}
 });await page.waitForTimeout(1200);
 manifest={schemaVersion:1,sourceUrl:url,...await captureSurface(page),frames:[],timeline,errors};cdp=await context.newCDPSession(page);
 cdp.on('Page.screencastFrame',e=>{void cdp.send('Page.screencastFrameAck',{sessionId:e.sessionId}).catch(()=>{});if(!recording)return;try{const name=`frame-${String(manifest.frames.length).padStart(6,'0')}.jpg`,bytes=Buffer.from(e.data,'base64');appendFrame(manifest,{name,timestamp:e.metadata.timestamp,bytes});writes.push(fs.writeFile(path.join(dir,'frames',name),bytes));}catch(e){errors.push(e.stack);recording=false;}});
 recording=true;await cdp.send('Page.startScreencast',{format:'jpeg',quality:88,maxWidth:1280,maxHeight:720,everyNthFrame:2});
 await mark('Five real source actors; exact short/stout and tall/slender endpoints');await page.waitForTimeout(3500);
 await page.evaluate(async()=>{for(const [id,clip]of[['motion-2','Sword_Attack'],['motion-1','Spell_Simple_Enter']])await CROWD.set(STATE.setActorMotion(CROWD.get(id),{clip,loop:false,startedAt:CROWD.now(),offsetSeconds:0}));});await mark('Source sword and spell actions; hold terminal frame');await page.waitForTimeout(2200);
 await page.evaluate(async()=>{await CROWD.set(STATE.setActorMotion(CROWD.get('motion-2'),{clip:'Walk_Loop',loop:true,startedAt:CROWD.now(),offsetSeconds:0}));await CROWD.set(CROWD.get('motion-2'),'exact');});await mark('Same actor and action promoted to exact');await page.waitForTimeout(2000);
 await page.evaluate(()=>CROWD.set(CROWD.get('motion-2'),'vat'));await mark('Same actor and action returned to VAT');await page.waitForTimeout(1800);
 await page.evaluate(()=>CROWD.set(STATE.replaceActorAppearance(CROWD.get('motion-2'),RECIPES.warden,2)));await mark('Atomic outfit change retains actor and motion');await page.waitForTimeout(2200);
 await page.evaluate(()=>{CROWD.remove('motion-1');});await mark('Middle actor removed; survivor identity remains');await page.waitForTimeout(2000);
 await page.evaluate(async()=>{
  for(const a of CROWD.snapshot().actors)CROWD.remove(a.id);
  ASHEN.player.setWorldPos(0,ASHEN.world.groundHeight(0,37)+1.7,37);ASHEN.rig.pitch=.27;ASHEN.rig.distance=ASHEN.rig.distanceTarget=7;
  for(let i=0;i<100;i++){const x=(i%10-4.5)*1.6,z=53+Math.floor(i/10)*1.6;await CROWD.set(STATE.createRegionActor({id:`hundred-${i}`,recipe:i%2?RECIPES.warden:RECIPES.wayfarer,transform:{x,y:ASHEN.world.groundHeight(x,z),z,yaw:i*.07},motion:{clip:i%3?'Walk_Loop':'Idle_Loop',loop:true,startedAt:CROWD.now(),offsetSeconds:i*.037}}));}
 });await mark('100 mixed dressed actors; correctness, not accepted hub capacity');await page.waitForTimeout(3500);
 await page.evaluate(()=>CROWD.dispose());await page.waitForTimeout(800);await mark('Crowd disposed; normal Havok traversal');
 const before=await page.evaluate(()=>({x:ASHEN.player.body.position.x,z:ASHEN.player.body.position.z,recoveries:ASHEN.player.getDebugState().recoveries}));await page.keyboard.down('KeyW');await page.waitForTimeout(2500);await page.keyboard.up('KeyW');
 const after=await page.evaluate(()=>({x:ASHEN.player.body.position.x,z:ASHEN.player.body.position.z,recoveries:ASHEN.player.getDebugState().recoveries,physics:ASHEN.player.getDebugState().usingPhysics,vat:ASHEN.scene.meshes.filter(m=>m.vat).length,gpuErrors:ASHEN.gpu.errors}));assert(after.physics);assert.equal(after.recoveries,before.recoveries);assert.equal(after.vat,0);assert(Math.hypot(after.x-before.x,after.z-before.z)>3);assert.deepEqual(after.gpuErrors,[]);manifest.movement={before,after};
 recording=false;await cdp.send('Page.stopScreencast');await Promise.all(writes);assert.deepEqual(errors,[]);await writeCaptureManifest(dir,manifest,await captureSurface(page));console.log(JSON.stringify({dir,frames:manifest.frames.length,seconds:manifest.elapsedSeconds,movement:manifest.movement,errors}));
}finally{recording=false;await page.keyboard.up('KeyW').catch(()=>{});await cdp?.send('Page.stopScreencast').catch(()=>{});await Promise.allSettled(writes);await page.evaluate(()=>globalThis.CROWD?.dispose()).catch(()=>{});await context.close();await browser.close();}
