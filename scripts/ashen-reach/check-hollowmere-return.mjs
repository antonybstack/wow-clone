/** G14 altar closure: ordinary cathedral return plus labelled phase fixtures.
 * Live recording is separate from final isolated performance measurements. */
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {CDP_URL} from '../lib/cdp.mjs';
import {browserOwnership} from '../lib/browser-ownership.mjs';
import {appendFrame,captureSurface,writeCaptureManifest} from '../lib/capture-manifest.mjs';
const dir=process.env.ASHEN_CAPTURE_DIR||'.cache/vaelmark-expedition-2026-10-09/g14-native';
const base=process.env.ASHEN_TEST_URL||'http://127.0.0.1:5873/';
const mode=process.env.ASHEN_RETURN_MODE||'full';assert(['full','survey','capture'].includes(mode));
await fs.mkdir(`${dir}/frames`,{recursive:true});
const browser=await chromium.connectOverCDP(CDP_URL);
assert(browser.contexts().flatMap(c=>c.pages()).every(p=>p.url()==='about:blank'));
const owner=await browserOwnership(browser,{cdpPort:new URL(CDP_URL).port,url:base,purpose:'G14 ordinary cathedral-to-Hollowmere return, altar prerequisites/repeats/reload and journal map; no FPS claim',renderingClients:1});
await fs.writeFile(`${dir}/ownership.json`,JSON.stringify(owner,null,2));
const report={mode,cases:[],errors:[],combatClears:[]};let context,page,cdp,manifest,captureError;const writes=[];
const state=()=>page.evaluate(()=>({x:ASHEN.player.body.position.x,y:ASHEN.player.body.position.y,z:ASHEN.player.body.position.z,facing:ASHEN.player.getFacing(),feet:ASHEN.player.body.position.y-ASHEN.player.capsuleHeight/2,god:ASHEN.dev.god,flying:ASHEN.dev.flying,physics:ASHEN.player.getDebugState().usingPhysics,recoveries:ASHEN.player.getDebugState().recoveries}));
async function go(point){
 let s=await state(),distance=Math.hypot(point[0]-s.x,point[2]-s.z),best=distance,progress=Date.now(),start=Date.now();
 assert(Number.isFinite(s.facing),'Navigation fixture needs the native facing getter');
 while(distance>.35){const desired=Math.atan2(point[0]-s.x,point[2]-s.z),error=Math.atan2(Math.sin(desired-s.facing),Math.cos(desired-s.facing));
  if(Math.abs(error)>.045){await page.keyboard.up('KeyW');const key=error>0?'KeyD':'KeyA';await page.keyboard.down(key);await page.waitForTimeout(Math.max(12,Math.min(150,Math.abs(error)/2.55*1000)));await page.keyboard.up(key);}
  else{await page.keyboard.down('KeyW');await page.waitForTimeout(Math.min(150,Math.max(20,(distance-.2)/7*1000)));}
  s=await state();assert(s.physics&&!s.god&&!s.flying);distance=Math.hypot(point[0]-s.x,point[2]-s.z);if(distance<best-.1){best=distance;progress=Date.now();}
  if(Date.now()-progress>5000||Date.now()-start>45000)throw Error(`Blocked ${JSON.stringify(s)} toward ${JSON.stringify(point)}`);
 }await page.keyboard.up('KeyW');assert(Math.abs(s.feet-point[1])<.8,`Missed authored level ${JSON.stringify(point)}: ${JSON.stringify(s)}`);return s;
}
async function mortal(){await page.keyboard.press('Escape');await page.locator('[data-action="developer-tools"]').click();const b=page.locator('[data-action="god"]');if(await b.getAttribute('aria-pressed')==='true')await b.click();await page.keyboard.press('Escape');}
async function boot(at){const u=new URL(base);u.searchParams.set('dev','');u.searchParams.set('play','');u.searchParams.set('at',at);await page.goto(u.href);await page.waitForFunction(()=>globalThis.ASHEN?.ready&&ASHEN.navigationReady&&ASHEN.hostilesReady&&ASHEN.combat?.exploration.snapshot().reliquary,null,{timeout:120000});await page.evaluate(()=>ASHEN.metrics.setInternalResolution(1280,720));await mortal();await page.waitForTimeout(400);}
async function face(yaw){for(let i=0;i<50;i++){const s=await state(),error=Math.atan2(Math.sin(yaw-s.facing),Math.cos(yaw-s.facing));if(Math.abs(error)<.045)return;const key=error>0?'KeyD':'KeyA';await page.keyboard.down(key);await page.waitForTimeout(Math.max(12,Math.min(150,Math.abs(error)/2.55*1000)));await page.keyboard.up(key);}throw Error('Could not face the memorial with ordinary input');}
async function setup(phase=null){
 context=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1});
 if(phase)await context.addInitScript(phase=>{
  if(sessionStorage.getItem('hollowmere-fixture-seeded'))return;
  const index=['unstarted','inscription-read','bell-rung','relic-claimed','returned'].indexOf(phase);
  localStorage.setItem('ashen.exploration.v1',JSON.stringify({version:1,episode:'vaelmark-bell-v1',phase,discovered:['vaelmark-inscription','vaelmark-bell','vaelmark-relic','hollowmere-return'].slice(0,index)}));
  sessionStorage.setItem('hollowmere-fixture-seeded','1');
 },phase);
 page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
}
async function checkErrors(){assert.deepEqual(await page.evaluate(()=>ASHEN.gpu.errors),[]);assert.deepEqual(report.errors,[]);}
async function clearNearbyHostiles(){
 const nearby=()=>page.evaluate(()=>{const p=ASHEN.player.body.position;return ASHEN.combat.enemies.filter(e=>!e.hidden&&e.hp>0&&e.state!=='dead'&&Math.hypot(e.position.x-p.x,e.position.z-p.z)<12&&ASHEN.combat.lineOfSight(e).clear).map(e=>({id:e.id,hp:e.hp}));});
 if(!(await nearby()).length)return;
 const start=Date.now();assert.equal(await page.evaluate(()=>ASHEN.combat.snapshot().auto.weapon),'ironSword');
 if(!(await page.evaluate(()=>ASHEN.combat.snapshot().auto.enabled)))await page.keyboard.press('KeyT');
 await page.waitForFunction(()=>ASHEN.combat.snapshot().auto.enabled);
 while((await nearby()).length){
  assert(Date.now()-start<30000,'Ordinary hostile clearing did not finish');
  const desired=(await nearby()).sort((a,b)=>a.hp-b.hp)[0].id;
  for(let tries=0;tries<8&&await page.evaluate(()=>ASHEN.combat.targeting.current?.id)!==desired;tries++){await page.keyboard.press('Tab');await page.waitForTimeout(80);}
  assert.equal(await page.evaluate(()=>ASHEN.combat.targeting.current?.id),desired);
  if(await page.evaluate(()=>ASHEN.combat.snapshot().progress.mana)>=20)await page.keyboard.press('Digit1');
  await page.waitForTimeout(1600);
  assert.equal(await page.evaluate(()=>ASHEN.combat.snapshot().life.dead),false);
  report.combatClears.push({target:desired,remaining:await nearby(),progress:await page.evaluate(()=>ASHEN.combat.snapshot().progress)});
 }
 if(await page.evaluate(()=>ASHEN.combat.snapshot().auto.enabled))await page.keyboard.press('KeyT');
 await page.waitForFunction(()=>!ASHEN.combat.snapshot().auto.enabled);
}
async function startCapture(){
 manifest={version:1,...await captureSurface(page),frames:[],markers:{}};cdp=await context.newCDPSession(page);
 cdp.on('Page.screencastFrame',e=>{cdp.send('Page.screencastFrameAck',{sessionId:e.sessionId}).catch(()=>{});if(captureError)return;try{const bytes=Buffer.from(e.data,'base64'),name=`frame-${String(manifest.frames.length).padStart(5,'0')}.jpg`;appendFrame(manifest,{name,timestamp:e.metadata.timestamp,bytes});writes.push(fs.writeFile(`${dir}/frames/${name}`,bytes).catch(e=>{captureError??=e;}));}catch(e){captureError??=e;}});
 await cdp.send('Page.startScreencast',{format:'jpeg',quality:88,maxWidth:1280,maxHeight:720,everyNthFrame:8});
}
try{
 // Short camera/interaction survey precedes the long connected capture.
 for(const phase of (mode==='capture'?[]:[null,'inscription-read','bell-rung'])){
  await setup(phase);await boot('hollowmere-chapel');const altar=await page.evaluate(()=>ASHEN.world.hollowmere?.altar);assert(altar,'Missing canonical chapel altar');
  const start=await state();await go(altar.stand);await face(Math.PI/2);await page.waitForTimeout(500);await page.screenshot({path:`${dir}/altar-${phase??'unstarted'}.png`});
  const before=await page.evaluate(()=>ASHEN.combat.exploration.snapshot().record);await page.keyboard.press('KeyX');await page.waitForTimeout(300);assert.deepEqual(await page.evaluate(()=>ASHEN.combat.exploration.snapshot().record),before);assert.equal(await page.evaluate(()=>ASHEN.menu.isOpen),false);assert(await page.locator('#exploration-prompt small').isVisible());assert.match(await page.locator('#exploration-prompt small').innerText(),/memorial|west bell/i);assert.equal((await state()).recoveries,start.recoveries);await checkErrors();
  report.cases.push({case:`early ${phase??'unstarted'} altar offers clue with no credit or journal start`,labelledPhaseSetup:!!phase,record:before,altar,player:await state()});await context.close();context=null;
 }
 if(mode!=='survey'){
 await setup('relic-claimed');await boot('cathedral-nave');const start=await state();
 const baseline=await page.evaluate(()=>{const s=ASHEN.combat.snapshot();return {progress:s.progress,objective:s.objective};});
 const a=await page.evaluate(()=>{const c=ASHEN.world.cathedral,w=ASHEN.world.buildingPads[8],height=ASHEN.world.groundHeight;return {fy:c.floorY,bridgeStart:c.route.start,bridgeEnd:c.route.end,chapel:ASHEN.world.hollowmere,route:ASHEN.world.routes.find(r=>r.id==='hollowmere-chapel').points,town:[0,height(0,114)+.05,114],wellDetour:[w.z+6,w.z-4].map(z=>[w.x-2.8,height(w.x-2.8,z)+.05,z])};});
 await startCapture();const steps=[];
 // Existing region traversal uses the west side of the physical well, never its centreline.
 for(const point of [[0,a.fy,310],[0,a.fy,298],[0,a.fy,280],a.bridgeEnd,a.bridgeStart,...a.wellDetour])steps.push(await go(point));
 steps.push(await go(a.town));
 for(const point of [...a.route.slice(1),a.chapel.altar.stand])steps.push(await go(point));
 // Clear the doorway from inside, using the sword's ordinary reach and mana-aware casts.
 const doorwayStand=[a.chapel.front[0]+(a.chapel.altar.stand[0]-a.chapel.front[0])*.44,a.chapel.altar.standingSurfaceY,a.chapel.altar.stand[2]];
 steps.push(await go(doorwayStand));await clearNearbyHostiles();steps.push(await go(a.chapel.altar.stand));
 await face(Math.PI/2);await page.waitForTimeout(600);manifest.markers.altar=Date.now()/1000;await page.screenshot({path:`${dir}/altar-arrival.png`});
 const beforeAltar=await page.evaluate(()=>{const s=ASHEN.combat.snapshot();return {progress:s.progress,objective:s.objective};});
 assert.equal(await page.evaluate(()=>ASHEN.combat.exploration.snapshot().candidate),'hollowmere-return');await page.keyboard.press('KeyX');await page.waitForFunction(()=>ASHEN.menu.isOpen&&ASHEN.combat.exploration.snapshot().record.phase==='returned');assert(await page.locator('[data-discovery="hollowmere-return"]').isVisible());assert.match(await page.locator('.journal-goal').innerText(),/complete/);assert(await page.locator('[data-discovery="vaelmark-relic"] .remembrance-emblem').isVisible());assert.deepEqual(await page.evaluate(()=>{const s=ASHEN.combat.snapshot();return {progress:s.progress,objective:s.objective};}),beforeAltar);manifest.markers.complete=Date.now()/1000;await page.screenshot({path:`${dir}/completed.png`});await page.waitForTimeout(1800);
 await page.locator('[data-action="journal-region-map"]').click();assert(await page.locator('.region-map-content').isVisible());assert.equal(await page.locator('[data-exploration-journal]').isVisible(),false);await page.locator('[data-map-destination="north-tower"]').click();assert.equal(await page.locator('[data-map-destination="north-tower"]').getAttribute('aria-pressed'),'true');manifest.markers.map=Date.now()/1000;await page.screenshot({path:`${dir}/next-destination.png`});await page.waitForTimeout(1300);await page.keyboard.press('Escape');
 await page.keyboard.press('KeyX');await page.waitForFunction(()=>ASHEN.menu.isOpen);assert.equal(await page.evaluate(()=>ASHEN.combat.exploration.snapshot().record.discovered.filter(id=>id==='hollowmere-return').length),1);await page.keyboard.press('Escape');
 steps.push(await go(doorwayStand));await clearNearbyHostiles();for(const p of [...a.route.slice(1).reverse(),a.town])steps.push(await go(p));const end=await state();assert.equal(end.recoveries,start.recoveries);assert(steps.every(s=>s.recoveries===start.recoveries));assert.deepEqual(await page.evaluate(()=>ASHEN.combat.snapshot().objective),baseline.objective);assert.equal(await page.evaluate(()=>ASHEN.combat.snapshot().life.dead),false);await checkErrors();
 report.cases.push({case:'ordinary nave/terrace/bridge/chapel return, ordinary hostile clearing, one-time altar completion, journal map and chapel escape',initialDeveloperNaveSetup:true,labelledRelicClaimedSetup:true,start,end,steps,initialCombat:baseline,unchangedAltarCombat:beforeAltar,record:await page.evaluate(()=>ASHEN.combat.exploration.snapshot().record)});
 await cdp.send('Page.stopScreencast');cdp=null;await Promise.all(writes);if(captureError)throw captureError;await writeCaptureManifest(dir,manifest,await captureSurface(page));
 await boot('hollowmere-chapel');assert.equal(await page.evaluate(()=>ASHEN.combat.exploration.snapshot().record.phase),'returned');await go(a.chapel.altar.stand);await page.keyboard.press('KeyX');await page.waitForFunction(()=>ASHEN.menu.isOpen);assert(await page.locator('[data-discovery="hollowmere-return"]').isVisible());assert.equal(await page.evaluate(()=>ASHEN.combat.exploration.snapshot().record.discovered.length),4);await checkErrors();report.cases.push({case:'completed origin-local journal survives actual reload without fixture reseed or duplicate credit',record:await page.evaluate(()=>ASHEN.combat.exploration.snapshot().record)});
 }
 report.passed=true;
}catch(e){report.failure=e.stack;await page?.screenshot({path:`${dir}/failure.png`}).catch(()=>{});throw e;}
finally{
 try{if(cdp){await cdp.send('Page.stopScreencast').catch(()=>{});await Promise.all(writes);if(!captureError&&manifest.frames.length>=2)await writeCaptureManifest(dir,manifest,await captureSurface(page));}}
 catch(e){captureError??=e;}
 finally{if(captureError){report.captureFailure=captureError.stack;report.passed=false;}for(const k of ['KeyW','KeyA','KeyD'])await page?.keyboard.up(k).catch(()=>{});await context?.close();await browser.close();await fs.writeFile(`${dir}/report.json`,JSON.stringify(report,null,2));await fs.writeFile(`${dir}/ownership.json`,JSON.stringify({...owner,active:false,renderingClients:0},null,2));}
}
if(captureError)throw captureError;
console.log(JSON.stringify({passed:report.passed,cases:report.cases.length,frames:manifest?.frames.length,errors:report.errors}));
