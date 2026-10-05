/** Exercise saved identities on the ordinary playable route. Compare actual
 * native meshes, gear, shape and persistence; requests prove first-play source.
 * Failure injection disables HTTP cache and must reach the selected body URL.
 * https://chromedevtools.github.io/devtools-protocol/tot/Network/#method-setCacheDisabled
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {browserOwnership} from '../lib/browser-ownership.mjs';
import {HUMAN_IDENTITY_PRESETS} from '../../src/character/appearance/human-identity.js';
import {defaultAppearance} from '../../src/character/appearance/store.js';
import {validateAppearance} from '../../src/character/appearance/contract.js';
const url=process.env.ASHEN_TEST_URL,port=process.env.ASHEN_CDP_PORT;
assert(url&&port,'Require audited owned browser and game URL');
const out=process.argv[2]||'docs/baselines/character-mmo/m5/saved-identity-2026-10-04/live';
await fs.mkdir(out,{recursive:true});
const index=JSON.parse(await fs.readFile('public/ashen-reach/human-identity-v1/manifest.json','utf8'));
const report={url,scope:'M5 ordinary-route identity persistence/transactions, not a startup or FPS benchmark',rows:[],errors:[]};
const browser=await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
assert(browser.contexts().flatMap(c=>c.pages()).every(p=>p.url()==='about:blank'),'Another owned renderer is active');
const ownership=await browserOwnership(browser,{cdpPort:port,url,purpose:report.scope,renderingClients:1});
await fs.writeFile(`${out}/ownership.json`,JSON.stringify(ownership,null,2));
const snapshot=page=>page.evaluate(()=>({appearance:ASHEN.getAppearance?.(),gear:ASHEN.equipment.getState(),dyes:ASHEN.equipment.getDyes(),storage:localStorage.getItem('ashen.appearance.v2'),height:ASHEN.player.heightScale,shape:ASHEN.humanShape,meshes:ASHEN.scene.meshes.length,visible:ASHEN.scene.meshes.filter(m=>m.visible!==false&&['HumanV1Body','HumanTorsoCore','HumanIdentityEyes','HumanIdentityBrows','HumanPonytail01'].includes(m.name)).map(m=>m.name),gpuErrors:ASHEN.gpu.errors.slice(),physics:ASHEN.player.getDebugState().usingPhysics,recoveries:ASHEN.player.getDebugState().recoveries}));
async function ownedCheck(job){
 const context=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1}),page=await context.newPage();
 page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&!/500 \(Internal Server Error\)/.test(m.text()))report.errors.push(m.text());});
 try{await job(context,page);}finally{await context.close();await fs.writeFile(`${out}/report.json`,JSON.stringify(report,null,2));}
}
const ready=page=>page.waitForFunction(()=>globalThis.ASHEN?.ready,null,{timeout:90000});
try{
 for(const preset of HUMAN_IDENTITY_PRESETS){
  await ownedCheck(async(context,page)=>{
   const base=defaultAppearance(),recipe=validateAppearance({...base,components:preset.id==='starter'?{}:preset.components,dyes:{torso:'moss'},shape:{...base.shape,height:preset.id==='weathered-bald'?.9:1.15,build:preset.id==='weathered-bald'?.95:-.95}});
   await context.addInitScript(seed=>localStorage.setItem('ashen.appearance.v2',JSON.stringify(seed)),recipe);
   const requests=[];page.on('request',r=>requests.push(new URL(r.url()).pathname));
   await page.goto(url);await page.waitForFunction(()=>globalThis.ASHEN?.playableReady,null,{timeout:90000});
   const first=await snapshot(page);assert(first.physics);assert.equal(first.recoveries,0);assert.deepEqual(first.gear,recipe.equipment);assert.deepEqual(first.dyes,recipe.dyes);assert.equal(first.height,recipe.shape.height);
   assert.deepEqual(first.shape.weights,[Math.max(0,-recipe.shape.build),Math.max(0,recipe.shape.build)]);assert.deepEqual(first.gpuErrors,[]);
   if(preset.id!=='starter'){
    assert(requests.includes(index.presets[preset.id].manifest.compactItems.body.url));
    assert(!requests.some(u=>u.startsWith('/ashen-reach/startup/character/body-')),'Wrong face cannot precede selected first play');
    assert(first.visible.includes('HumanIdentityEyes')&&first.visible.includes('HumanIdentityBrows'));
    assert.equal(first.visible.includes('HumanPonytail01'),preset.id==='prime-ponytail');
   }else assert(!requests.some(u=>u.includes('/human-identity-v1/')),'Original identity must not request selected identity index');
   await ready(page);assert.deepEqual((await snapshot(page)).appearance,recipe);
   await page.evaluate(()=>{ASHEN.dev.god=true;ASHEN.armory.open();ASHEN.body.inspection.setPaused(true);ASHEN.body.inspection.seek(0);ASHEN.armory.setFocus({height:1.5*ASHEN.player.heightScale,radius:2.2*ASHEN.player.heightScale,beta:Math.PI/2});ASHEN.armory.camera.alpha=Math.PI/2;});
   await page.screenshot({path:path.join(out,`${preset.id}-restored.png`)});
   for(const race of ['orc','undead','human']){await page.evaluate(r=>ASHEN.equipment.switchRace(r),race);const state=await snapshot(page);assert.equal(state.appearance.race,race);assert.deepEqual(state.appearance.components,race==='human'?recipe.components:{});assert.deepEqual(state.gpuErrors,[]);}
   if(preset.id==='prime-ponytail'){
    await page.evaluate(()=>ASHEN.equipment.equip('helmet','graveweaverHood'));assert.equal((await snapshot(page)).visible.includes('HumanPonytail01'),false);
    await page.evaluate(()=>ASHEN.equipment.equip('helmet',null));assert.equal((await snapshot(page)).visible.includes('HumanPonytail01'),true);
   }
   report.rows.push({case:'selected-first-play-reload-race-return',preset:preset.id,first,settled:await snapshot(page),requests});
  });
 }
 await ownedCheck(async(context,page)=>{
  await page.goto(url);await ready(page);assert.equal(await page.evaluate(()=>ASHEN.creator.identity.selected),'starter');
  await page.evaluate(()=>ASHEN.armory.open());
  await page.getByLabel('Face and hair',{exact:true}).selectOption('prime-ponytail');
  await page.waitForFunction(()=>ASHEN.getAppearance().components.hair==='human-ponytail01-v1');await page.evaluate(()=>ASHEN.creator.settled());
  const chosen=await snapshot(page);
  await page.evaluate(async()=>{await ASHEN.creator.set('build',.95);await ASHEN.creator.set('height',.9);await ASHEN.equipment.equip('torso','lectorCoat');await ASHEN.creator.dyes.set('torso','indigo');});
  const edited=await snapshot(page);
  await page.getByRole('button',{name:'Undo identity',exact:true}).click();await page.waitForFunction(()=>!Object.keys(ASHEN.getAppearance().components).length);await page.evaluate(()=>ASHEN.creator.settled());
  const undone=await snapshot(page);assert.deepEqual(undone.appearance.shape,edited.appearance.shape);assert.deepEqual(undone.gear,edited.gear);assert.deepEqual(undone.dyes,edited.dyes);
  await page.evaluate(()=>Promise.all([ASHEN.creator.identity.set('prime-bald'),ASHEN.creator.identity.set('weathered-bald')]));
  assert.equal(await page.evaluate(()=>ASHEN.creator.identity.selected),'weathered-bald');
  await page.evaluate(()=>ASHEN.creator.identity.reset());assert.equal(await page.evaluate(()=>ASHEN.creator.identity.selected),'starter');
  assert.deepEqual((await snapshot(page)).gpuErrors,[]);
  report.rows.push({case:'actual-ui-and-independent-undo-queued-reset',chosen,edited,undone,final:await snapshot(page)});
 });
 for(const failure of ['http','corrupt'])await ownedCheck(async(context,page)=>{
  await page.goto(url);await ready(page);const cdp=await context.newCDPSession(page);await cdp.send('Network.enable');await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});
  const asset=index.presets['weathered-bald'].manifest.items.body;let hits=0;
  await page.route(`**${asset.url}`,r=>{hits++;return r.fulfill({status:failure==='http'?500:200,body:failure==='http'?'intentional failure':Buffer.alloc(32),contentType:'application/octet-stream'});});
  const before=await snapshot(page),message=await page.evaluate(async()=>{try{await ASHEN.creator.identity.set('weathered-bald');return null;}catch(e){return e.message;}});
  assert(message);assert(hits>=1&&hits<=2,'Refusal must reach the selected native body; failed speculative requests may retry once before staging');assert.deepEqual(await snapshot(page),before);
  await page.unroute(`**${asset.url}`);await page.evaluate(()=>ASHEN.creator.identity.set('weathered-bald'));assert.equal(await page.evaluate(()=>ASHEN.creator.identity.selected),'weathered-bald');
  report.rows.push({case:'failed-source-preserves-and-can-retry',failure,hits,message,before,final:await snapshot(page)});
 });
 await ownedCheck(async(context,page)=>{
  await page.goto(url);await ready(page);const cdp=await context.newCDPSession(page);await cdp.send('Network.enable');await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});
  const asset=index.presets['prime-bald'].manifest.items.body;let hits=0,release;
  const held=new Promise(r=>release=r);
  await page.route(`**${asset.url}`,async r=>{hits++;await held;await r.continue();});
  const before=await snapshot(page);
  try{
   await page.evaluate(()=>{globalThis.__identityPending=ASHEN.creator.identity.set('prime-bald').then(()=>({ok:true}),e=>({ok:false,name:e.name,message:e.message}));});
   for(let i=0;i<100&&!hits;i++)await page.waitForTimeout(30);assert(hits>0,'Held body must reach route');
   assert.deepEqual(await snapshot(page),before);
   await page.evaluate(()=>ASHEN.creator.dispose());release();
   const rejected=await page.evaluate(()=>globalThis.__identityPending);assert.equal(rejected.ok,false);assert.equal(rejected.name,'AbortError');
   assert.deepEqual(await snapshot(page),before);
   report.rows.push({case:'disposed-editor-refuses-held-identity-before-stage',hits,rejected,before,after:await snapshot(page)});
  }finally{release();await page.unroute(`**${asset.url}`);}
 });
 assert.deepEqual(report.errors,[]);report.passed=true;
}finally{
 await fs.writeFile(`${out}/report.json`,JSON.stringify(report,null,2));await browser.close();await fs.writeFile(`${out}/ownership.json`,JSON.stringify({...ownership,active:false,renderingClients:0},null,2));
}
