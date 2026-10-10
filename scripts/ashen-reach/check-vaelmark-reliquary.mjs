/** Ordinary tower traversal plus narrowly labelled diagnostic audio/lifetime
 * cases. Capture and timed benchmarks are deliberately separate operations. */
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {summarizeFrameIntervals} from '../character-assets/summarize-frame-intervals.mjs';
import {CDP_URL} from '../lib/cdp.mjs';
import {browserOwnership} from '../lib/browser-ownership.mjs';
import {appendFrame,captureSurface,writeCaptureManifest} from '../lib/capture-manifest.mjs';
const dir=process.env.ASHEN_CAPTURE_DIR||'.cache/vaelmark-expedition-2026-10-09/g12-native';
const base=process.env.ASHEN_TEST_URL||'http://127.0.0.1:5873/';
const completeReturn=process.env.ASHEN_EXPEDITION_RETURN==='1';
const recording=process.env.ASHEN_RECORD!=='0';
const soakSeconds=Number(process.env.ASHEN_SOAK_SECONDS||0);
assert(!soakSeconds||(completeReturn&&Number.isFinite(soakSeconds)&&soakSeconds>=1200),'The integrated ordinary soak needs a completed episode and at least twenty minutes');
await fs.mkdir(`${dir}/frames`,{recursive:true});
const browser=await chromium.connectOverCDP(CDP_URL);
assert(browser.contexts().flatMap(c=>c.pages()).every(p=>p.url()==='about:blank'));
const owner=await browserOwnership(browser,{cdpPort:new URL(CDP_URL).port,url:base,purpose:completeReturn?'G17 fresh ordinary complete episode, regional follow-on, actual reload and optional ordinary soak':'G12 connected ordinary inscription/bell/reliquary route plus labelled reload/fault cases; no FPS claim',renderingClients:1});
await fs.writeFile(`${dir}/ownership.json`,JSON.stringify(owner,null,2));
const report={cases:[],errors:[]};let context,page,cdp,manifest,captureError,audioStart;const writes=[];
const state=()=>page.evaluate(()=>({x:ASHEN.player.body.position.x,y:ASHEN.player.body.position.y,z:ASHEN.player.body.position.z,facing:ASHEN.player.getFacing(),feet:ASHEN.player.body.position.y-ASHEN.player.capsuleHeight/2,physics:ASHEN.player.getDebugState().usingPhysics,recoveries:ASHEN.player.getDebugState().recoveries,god:ASHEN.dev.god,flying:ASHEN.player.isFlying()}));
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
async function jump(id){await page.keyboard.press('Escape');await page.locator('[data-action="developer-tools"]').click();await page.getByLabel('Destination',{exact:true}).selectOption(id);await page.locator('[data-action="jump"]').click();await page.waitForTimeout(500);}
async function setup(seed=false){context=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1});if(seed)await context.addInitScript(()=>{if(!sessionStorage.getItem('bell-fixture-seeded')){localStorage.setItem('ashen.exploration.v1',JSON.stringify({version:1,episode:'vaelmark-bell-v1',phase:'inscription-read',discovered:['vaelmark-inscription']}));sessionStorage.setItem('bell-fixture-seeded','1');}});
 page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
 await page.addInitScript(()=>{window.__audioProbe={contexts:[],starts:0,gainsAfterClose:0};const native=AudioContext;window.AudioContext=new Proxy(native,{construct(t,a,n){const c=Reflect.construct(t,a,n);__audioProbe.contexts.push(c);return c;}});const start=AudioBufferSourceNode.prototype.start;AudioBufferSourceNode.prototype.start=function(...a){__audioProbe.starts++;return start.apply(this,a);};const gain=GainNode;window.GainNode=new Proxy(gain,{construct(t,a,n){if(a[0]?.state==='closed')__audioProbe.gainsAfterClose++;return Reflect.construct(t,a,n);}});});
}
async function screenshot(name){if(recording)await page.screenshot({path:`${dir}/${name}`});}
async function errors(){assert.deepEqual(await page.evaluate(()=>ASHEN.gpu.errors),[]);assert.deepEqual(report.errors,[]);}

async function face(yaw){for(let i=0;i<50;i++){const s=await state(),error=Math.atan2(Math.sin(yaw-s.facing),Math.cos(yaw-s.facing));if(Math.abs(error)<.045)return;const key=error>0?'KeyD':'KeyA';await page.keyboard.down(key);await page.waitForTimeout(Math.max(12,Math.min(150,Math.abs(error)/2.55*1000)));await page.keyboard.up(key);}throw Error('Could not face the memorial with ordinary input');}
async function memorialLook(){await page.mouse.move(1000,400);await page.mouse.down({button:'left'});await page.mouse.move(1160,540,{steps:12});await page.mouse.up({button:'left'});await page.waitForTimeout(300);}
async function walk(points,log){const states=[];for(const [i,p]of points.entries()){states.push(await go(p));if(i%8===0)console.log(`${log} ${i}/${points.length-1}`);}return states;}
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
  (report.combatClears??=[]).push({target:desired,remaining:await nearby(),progress:await page.evaluate(()=>ASHEN.combat.snapshot().progress)});
 }
 if(await page.evaluate(()=>ASHEN.combat.snapshot().auto.enabled))await page.keyboard.press('KeyT');
 await page.waitForFunction(()=>!ASHEN.combat.snapshot().auto.enabled);
}

async function finishReturn(baseline){
 const start=await state();
 const a=await page.evaluate(()=>{const c=ASHEN.world.cathedral,w=ASHEN.world.buildingPads[8],height=ASHEN.world.groundHeight;return {fy:c.floorY,bridgeStart:c.route.start,bridgeEnd:c.route.end,chapel:ASHEN.world.hollowmere,route:ASHEN.world.routes.find(r=>r.id==='hollowmere-chapel').points,town:[0,height(0,114)+.05,114],wellDetour:[w.z+6,w.z-4].map(z=>[w.x-2.8,height(w.x-2.8,z)+.05,z])};});
 const steps=[];
 // Existing region traversal uses the west side of the physical well, never its centreline.
 for(const point of [[0,a.fy,310],[0,a.fy,298],[0,a.fy,280],a.bridgeEnd,a.bridgeStart,...a.wellDetour])steps.push(await go(point));
 steps.push(await go(a.town));
 for(const point of [...a.route.slice(1),a.chapel.altar.stand])steps.push(await go(point));
 // Clear the doorway from inside, using the sword's ordinary reach and mana-aware casts.
 const doorwayStand=[a.chapel.front[0]+(a.chapel.altar.stand[0]-a.chapel.front[0])*.44,a.chapel.altar.standingSurfaceY,a.chapel.altar.stand[2]];
 steps.push(await go(doorwayStand));await clearNearbyHostiles();steps.push(await go(a.chapel.altar.stand));
 await face(Math.PI/2);await page.waitForTimeout(600);manifest.markers.altar=Date.now()/1000;await screenshot('altar-arrival.png');
 const beforeAltar=await page.evaluate(()=>{const s=ASHEN.combat.snapshot();return {progress:s.progress,objective:s.objective};});
 assert.equal(await page.evaluate(()=>ASHEN.combat.exploration.snapshot().candidate),'hollowmere-return');await page.keyboard.press('KeyX');await page.waitForFunction(()=>ASHEN.menu.isOpen&&ASHEN.combat.exploration.snapshot().record.phase==='returned');assert(await page.locator('[data-discovery="hollowmere-return"]').isVisible());assert.match(await page.locator('.journal-goal').innerText(),/complete/);assert(await page.locator('[data-discovery="vaelmark-relic"] .remembrance-emblem').isVisible());assert.deepEqual(await page.evaluate(()=>{const s=ASHEN.combat.snapshot();return {progress:s.progress,objective:s.objective};}),beforeAltar);manifest.markers.complete=Date.now()/1000;await screenshot('completed.png');await page.waitForTimeout(1800);
 await page.locator('[data-action="journal-region-map"]').click();assert(await page.locator('.region-map-content').isVisible());assert.equal(await page.locator('[data-exploration-journal]').isVisible(),false);await page.locator('[data-map-destination="north-tower"]').click();assert.equal(await page.locator('[data-map-destination="north-tower"]').getAttribute('aria-pressed'),'true');manifest.markers.map=Date.now()/1000;await screenshot('next-destination.png');await page.waitForTimeout(1300);await page.keyboard.press('Escape');
 await page.keyboard.press('KeyX');await page.waitForFunction(()=>ASHEN.menu.isOpen);assert.equal(await page.evaluate(()=>ASHEN.combat.exploration.snapshot().record.discovered.filter(id=>id==='hollowmere-return').length),1);await page.keyboard.press('Escape');
 steps.push(await go(doorwayStand));await clearNearbyHostiles();for(const p of [...a.route.slice(1).reverse(),a.town])steps.push(await go(p));const end=await state();assert.equal(end.recoveries,start.recoveries);assert(steps.every(s=>s.recoveries===start.recoveries));assert.deepEqual(await page.evaluate(()=>ASHEN.combat.snapshot().objective),baseline.objective);assert.equal(await page.evaluate(()=>ASHEN.combat.snapshot().life.dead),false);await errors();
 report.cases.push({case:'ordinary nave/terrace/bridge/chapel return, ordinary hostile clearing, one-time altar completion, journal map and chapel escape',freshJournal:true,ordinaryInputs:true,start,end,steps,initialCombat:baseline,unchangedAltarCombat:beforeAltar,record:await page.evaluate(()=>ASHEN.combat.exploration.snapshot().record)});
 // Continue from the completed episode to the selected Bell Watch, using the
 // authored road and physical well detour. This is a normal post-episode visit,
 // not one of the separately labelled regional entrance fixtures.
 const north=await page.evaluate(()=>({route:ASHEN.world.routes.find(r=>r.id==='north-tower').points,
  site:ASHEN.world.regionStructures.destinations.find(s=>s.id==='north-tower')}));
 const mark=north.site.discoveries.find(a=>a.id==='bell-watch-view'),regionalSteps=[];
 for(const point of [...a.wellDetour.slice().reverse(),...north.route,north.site.interior,mark.stand])regionalSteps.push(await go(point));
 await face(mark.heading);await page.waitForTimeout(600);await page.waitForFunction(()=>ASHEN.combat.exploration.snapshot().candidate==='bell-watch-view');manifest.markers.bellWatch=Date.now()/1000;await screenshot('bell-watch.png');
 const beforeWatch=await page.evaluate(()=>{const s=ASHEN.combat.snapshot();return {progress:s.progress,objective:s.objective};});
 await page.keyboard.press('KeyX');await page.waitForFunction(()=>ASHEN.menu.isOpen);const knowledge=await page.evaluate(()=>ASHEN.combat.exploration.snapshot().record);assert.equal(knowledge.phase,'returned');assert.equal(knowledge.discovered.length,5);assert(knowledge.discovered.includes('bell-watch-view'));assert.deepEqual(await page.evaluate(()=>{const s=ASHEN.combat.snapshot();return {progress:s.progress,objective:s.objective};}),beforeWatch);await page.waitForTimeout(1500);
 await page.locator('[data-action="journal-region-map"]').click();for(const id of ['vaelmark','hollowmere-chapel','north-tower'])assert.equal(await page.locator(`[data-map-destination="${id}"]`).getAttribute('data-read'),'true');await page.locator('[data-map-destination="hollowmere-chapel"]').click();await page.waitForTimeout(1200);await page.keyboard.press('Escape');
 await page.keyboard.press('KeyX');await page.waitForFunction(()=>ASHEN.menu.isOpen);assert.deepEqual(await page.evaluate(()=>ASHEN.combat.exploration.snapshot().record),knowledge);await page.keyboard.press('Escape');
 for(const point of [north.site.entrance,...north.route.slice().reverse(),...a.wellDetour,a.town])regionalSteps.push(await go(point));
 assert(regionalSteps.every(s=>s.recoveries===start.recoveries));assert.equal((await state()).recoveries,start.recoveries);assert.equal(await page.evaluate(()=>ASHEN.combat.snapshot().life.dead),false);assert.deepEqual(await page.evaluate(()=>ASHEN.combat.snapshot().objective),baseline.objective);await errors();
 report.cases.push({case:'ordinary post-completion town/Bell Watch/return route, optional read/repeat and retained map knowledge',ordinaryInputs:true,steps:regionalSteps,unchangedWatchInteractionCombat:beforeWatch,record:knowledge,end:await state()});

}

async function stopCapture(){if(!cdp)return;await cdp.send('Page.stopScreencast');cdp=null;await Promise.all(writes);if(captureError)throw captureError;await writeCaptureManifest(dir,manifest,await captureSurface(page));}

async function soak(saved){
 // Only the initial soak placement is diagnostic. The twenty-minute loop uses
 // ordinary controls on the existing crypt floor, with the tomb aisles intact.
 await jump('cathedral-undercroft');await mortal();
 const crypt=await page.evaluate(()=>ASHEN.world.cathedral.exploration.undercroft);
 await go([-10,crypt.floorY,334]);await go([-10,crypt.floorY,329]);await go(crypt.memorial.stand);await face(Math.PI/2);await page.waitForTimeout(500);
 const probe=await context.newCDPSession(page);await probe.send('Performance.enable');
 async function resources(){
  const counts=await page.evaluate(()=>({meshes:ASHEN.scene.meshes.length,propTriangles:ASHEN.combat.exploration.snapshot().propTriangles,
   localSlots:ASHEN.localLights.state.active.length,sunCasters:ASHEN.shadows.dynamicCasters.length,localCasters:ASHEN.localLights.casters.length,
   prompts:document.querySelectorAll('#exploration-prompt').length,journals:document.querySelectorAll('[data-exploration-journal]').length,maps:document.querySelectorAll('.region-map-content').length,
   record:ASHEN.combat.exploration.snapshot().record,recoveries:ASHEN.player.getDebugState().recoveries,gpuErrors:[...ASHEN.gpu.errors]}));
  const listeners={};
  // Native protocol observation counts actual registered listeners, including
  // AbortSignal removal, without replacing EventTarget methods in the game.
  // https://chromedevtools.github.io/devtools-protocol/tot/DOMDebugger/#method-getEventListeners
  for(const expression of ['window','document','document.getElementById("renderCanvas")']){
   const {result}=await probe.send('Runtime.evaluate',{expression});assert(result.objectId);
   const {listeners:list}=await probe.send('DOMDebugger.getEventListeners',{objectId:result.objectId});
   listeners[expression]=list.map(l=>`${l.type}:${l.useCapture}`).sort();await probe.send('Runtime.releaseObject',{objectId:result.objectId});
  }
  const {metrics}=await probe.send('Performance.getMetrics');
  return {...counts,listeners,jsHeapUsedBytes:metrics.find(m=>m.name==='JSHeapUsedSize')?.value??null};
 }
 async function revisit(){
  await page.waitForTimeout(250);await page.keyboard.press('KeyX');await page.waitForFunction(()=>ASHEN.menu.isOpen);
  await page.locator('[data-action="journal-region-map"]').click();await page.locator('[data-map-destination="north-tower"]').click();
  assert.equal(await page.locator('[data-map-destination="north-tower"]').getAttribute('data-read'),'true');
  assert.equal(await page.locator('[data-map-destination]').count(),8);assert.equal(await page.locator('[data-map-destination]:disabled').count(),0);
  await page.keyboard.press('Escape');
 }
 await revisit();const initial=await resources(),start=Date.now();let cycles=0;
 assert.deepEqual(initial.record,saved);assert.equal(initial.recoveries,0);assert.equal(initial.localSlots,2);
 const rows=[];
 while((Date.now()-start)/1000<soakSeconds){
  for(const point of [[-10,crypt.floorY,334],[-10,crypt.floorY,325],[-4,crypt.floorY,325],[-4,crypt.floorY,334],[-10,crypt.floorY,334],[-10,crypt.floorY,329],crypt.memorial.stand])await go(point);
  await face(Math.PI/2);cycles++;if(cycles<=10)await revisit();
  if(cycles<=10||cycles%5===0){
   const row=await resources();rows.push({cycle:cycles,elapsedSeconds:(Date.now()-start)/1000,...row});
   for(const key of ['meshes','propTriangles','localSlots','sunCasters','localCasters','prompts','journals','maps','listeners','record','recoveries'])assert.deepEqual(row[key],initial[key],`Soak resource changed: ${key}`);
   assert.deepEqual(row.gpuErrors,[]);await errors();
   report.soak={diagnosticInitialPlacement:true,ordinaryMovement:true,requestedSeconds:soakSeconds,cycles,revisits:Math.min(10,cycles),initial,rows};
   await fs.writeFile(`${dir}/report.json`,JSON.stringify(report,null,2));console.log(`SOAK ${cycles} cycles / ${Math.round((Date.now()-start)/1000)} s`);
  }
 }
 assert(cycles>=10);report.soak.elapsedSeconds=(Date.now()-start)/1000;report.soak.final=await resources();
 // JS heap is a supported CPU metric, not a measurement of GPU allocation.
 await page.evaluate(()=>ASHEN.dispose());await page.waitForTimeout(300);
 report.soak.disposal=await page.evaluate(()=>({meshes:ASHEN.scene.meshes.length,prompts:document.querySelectorAll('#exploration-prompt').length,journals:document.querySelectorAll('[data-exploration-journal]').length,maps:document.querySelectorAll('.region-map-content').length,gpuErrors:[...ASHEN.gpu.errors]}));
 assert.equal(report.soak.disposal.meshes,0);assert.equal(report.soak.disposal.prompts,0);assert.equal(report.soak.disposal.journals,0);assert.equal(report.soak.disposal.maps,0);assert.deepEqual(report.soak.disposal.gpuErrors,[]);
 await probe.detach();await errors();
}
try{
 await setup();await boot('cathedral-nave');const start=await state(),baseline=await page.evaluate(()=>{const s=ASHEN.combat.snapshot();return {progress:s.progress,objective:s.objective};});
 const a=await page.evaluate(()=>({fy:ASHEN.world.cathedral.floorY,crypt:ASHEN.world.cathedral.exploration.undercroft,tower:ASHEN.world.cathedral.exploration.towers.find(t=>t.id==='west-bell')}));
 const inCrypt=a.crypt.route.slice(0,9),outCrypt=[[-10,a.crypt.floorY,334],...a.crypt.route.slice(12)],towerPath=[[0,a.fy,298],[-17,a.fy,298],a.tower.entrance,[-17,a.fy,302.8],...a.tower.route,a.tower.landing];
 assert.equal(await page.evaluate(()=>ASHEN.combat.exploration.snapshot().record.phase),'unstarted');assert.equal(await page.evaluate(()=>ASHEN.combat.exploration.snapshot().reliquary.open),false);
 manifest={version:1,...await captureSurface(page),frames:[],markers:{}};if(recording){cdp=await context.newCDPSession(page);
 cdp.on('Page.screencastFrame',e=>{cdp.send('Page.screencastFrameAck',{sessionId:e.sessionId}).catch(()=>{});if(captureError)return;try{const bytes=Buffer.from(e.data,'base64'),name=`frame-${String(manifest.frames.length).padStart(5,'0')}.jpg`;appendFrame(manifest,{name,timestamp:e.metadata.timestamp,bytes});writes.push(fs.writeFile(`${dir}/frames/${name}`,bytes).catch(e=>{captureError??=e;}));}catch(e){captureError??=e;}});
 await cdp.send('Page.startScreencast',{format:'jpeg',quality:88,maxWidth:1280,maxHeight:720,everyNthFrame:8});}
 if(!recording)await page.evaluate(()=>ASHEN.renderLoop.beginMeasurement());
 const steps=[...await walk(inCrypt,'CRYPT ENTRY'),await go(a.crypt.memorial.stand)];await face(Math.PI/2);await memorialLook();await page.waitForTimeout(900);manifest.markers.closed=Date.now()/1000;await screenshot('closed.png');await page.keyboard.press('KeyX');await page.waitForFunction(()=>ASHEN.menu.isOpen&&ASHEN.combat.exploration.snapshot().record.phase==='inscription-read');await page.waitForTimeout(2200);await page.keyboard.press('Escape');
 steps.push(...await walk(outCrypt,'CRYPT RETURN'),...await walk(towerPath,'BELL ASCENT'));await page.waitForTimeout(400);manifest.markers.bell=Date.now()/1000;await page.keyboard.press('KeyX');await page.waitForFunction(()=>ASHEN.combat.exploration.snapshot().record.phase==='bell-rung');assert.equal(await page.evaluate(()=>ASHEN.combat.exploration.snapshot().reliquary.open),false);await page.waitForTimeout(1000);
 steps.push(...await walk(towerPath.slice(0,-1).reverse(),'BELL DESCENT'),...await walk(inCrypt,'CRYPT REVISIT'));
 manifest.markers.return=Date.now()/1000;await go(a.crypt.memorial.stand);await face(Math.PI/2);await page.waitForFunction(()=>ASHEN.combat.exploration.snapshot().reliquary.open);manifest.markers.opened=Date.now()/1000;await screenshot('opened.png');assert.equal(await page.evaluate(()=>ASHEN.combat.exploration.snapshot().reliquary.relicVisible),true);await page.waitForTimeout(1800);
 await page.keyboard.press('KeyX');await page.waitForFunction(()=>ASHEN.menu.isOpen&&ASHEN.combat.exploration.snapshot().record.phase==='relic-claimed');assert(await page.locator('[data-discovery="vaelmark-relic"] .remembrance-emblem').isVisible());assert.match(await page.locator('[data-exploration-journal]').innerText(),/Hollowmere/);manifest.markers.journal=Date.now()/1000;await screenshot('remembrance.png');await page.waitForTimeout(2500);await page.keyboard.press('Escape');await page.waitForTimeout(500);
 assert.equal(await page.evaluate(()=>ASHEN.combat.exploration.snapshot().reliquary.relicVisible),false);manifest.markers.claimed=Date.now()/1000;await screenshot('claimed.png');await page.keyboard.press('KeyX');await page.waitForFunction(()=>ASHEN.menu.isOpen);assert.equal(await page.evaluate(()=>ASHEN.combat.exploration.snapshot().record.discovered.filter(id=>id==='vaelmark-relic').length),1);await page.keyboard.press('Escape');
 // The stone edge is x=-8.25. Allow centimetres of native solver variation
 // while requiring the capsule centre outside it and feet on the crypt floor.
 // A previous -8.60 check sat within 1 mm of ordinary contact and was brittle.
 // Actual tomb contact, followed by both unchanged side aisles and normal return.
 await go(a.crypt.memorial.stand);await face(Math.PI/2);const contactStart=await state();await page.keyboard.down('KeyW');await page.waitForTimeout(1500);await page.keyboard.up('KeyW');const contact=await state();console.log('CONTACT',JSON.stringify({contactStart,contact}));assert(contact.x< -8.50&&Math.abs(contact.feet-a.crypt.floorY)<.1,`Memorial contact escaped: ${JSON.stringify({contactStart,contact})}`);steps.push(await go([-10,a.crypt.floorY,329]),...await walk([[-10,a.crypt.floorY,325],[-4,a.crypt.floorY,325],[-4,a.crypt.floorY,334]],'SIDE AISLES'),...await walk(a.crypt.route.slice(12),'NAVE RETURN'));
 const casterState=await page.evaluate(()=>({sun:ASHEN.shadows.dynamicCasters.filter(m=>/^Vaelmark (bell|reliquary|remembrance)/.test(m.name)).map(m=>m.name),local:ASHEN.localLights.casters.filter(m=>/^Vaelmark (bell|reliquary|remembrance)/.test(m.name)).map(m=>m.name),slots:ASHEN.localLights.state?.active?.length,triangles:ASHEN.combat.exploration.snapshot().propTriangles}));assert.deepEqual(casterState.sun,[]);assert.deepEqual(casterState.local,[]);assert.equal(casterState.slots,2);assert(casterState.triangles<2000);
 const end=await state();assert.equal(end.recoveries,start.recoveries);assert(steps.every(s=>s.recoveries===start.recoveries));assert.deepEqual(await page.evaluate(()=>{const s=ASHEN.combat.snapshot();return {progress:s.progress,objective:s.objective};}),baseline);await errors();
 report.cases.push({case:'connected fresh-journal inscription, west bell, reliquary claim, both aisles and nave return',initialDeveloperNaveSetup:true,ordinaryInputs:true,start,end,steps,contactStart,contact,unchangedCombat:baseline,casterState,final:await page.evaluate(()=>ASHEN.combat.exploration.snapshot())});
 if(completeReturn){await finishReturn(baseline);if(!recording){const frames=await page.evaluate(()=>ASHEN.renderLoop.endMeasurement());report.actionTiming={recording:false,kind:'ordinary actions, traversal and menu pauses; no video/stills, separate from settled FPS',frames,tails:summarizeFrameIntervals(frames)};}await stopCapture();await boot('hollowmere-chapel');const saved=await page.evaluate(()=>ASHEN.combat.exploration.snapshot().record);assert.equal(saved.phase,'returned');assert.equal(saved.discovered.length,5);assert(saved.discovered.includes('bell-watch-view'));report.cases.push({case:'actual completed episode reload without phase seeding',record:saved});await errors();
  await page.locator('#armory-launch').click();const torso=page.locator('[data-equipment="torso"]');
  const oldTorso=await torso.inputValue(),newTorso=await torso.locator('option').evaluateAll((options,current)=>options.find(o=>o.value&&o.value!==current)?.value,oldTorso);assert(newTorso,'The appearance fixture needs a second authored torso');
  await torso.selectOption(newTorso);await page.waitForFunction(item=>ASHEN.equipment.getState().torso===item&&!ASHEN.equipment.getStatus().pending,newTorso,{timeout:60000});
  assert.deepEqual(await page.evaluate(()=>ASHEN.combat.exploration.snapshot().record),saved);await page.keyboard.press('Escape');await boot('hollowmere-chapel');
  assert.deepEqual(await page.evaluate(()=>ASHEN.combat.exploration.snapshot().record),saved);assert.equal(await page.evaluate(()=>ASHEN.equipment.getState().torso),newTorso);
  report.cases.push({case:'ordinary armory equipment change and actual reload preserve the completed journal independently',oldTorso,newTorso,record:saved});await errors();if(soakSeconds)await soak(saved);}
 else await stopCapture();
 await context.close();context=null;
 for(const phase of (completeReturn?[]:['bell-rung','relic-claimed','returned'])){
  await setup();await context.addInitScript(phase=>localStorage.setItem('ashen.exploration.v1',JSON.stringify({version:1,episode:'vaelmark-bell-v1',phase,discovered:['vaelmark-inscription','vaelmark-bell',...(phase==='bell-rung'?[]:['vaelmark-relic']),...(phase==='returned'?['hollowmere-return']:[])]})),phase);await boot('cathedral-undercroft');const r=await page.evaluate(()=>ASHEN.combat.exploration.snapshot());assert.equal(r.record.phase,phase);assert.equal(r.reliquary.open,true);assert.equal(r.reliquary.active,false);assert.equal(r.reliquary.relicVisible,phase==='bell-rung');assert.equal(r.bell.rings,0);await errors();report.cases.push({case:`labelled saved ${phase} reload settles directly`,snapshot:r});await context.close();context=null;
 }
 report.passed=true;
}catch(e){report.failure=e.stack;await page?.screenshot({path:`${dir}/failure.png`}).catch(()=>{});throw e;}
finally{
 try{if(cdp){await cdp.send('Page.stopScreencast').catch(()=>{});await Promise.all(writes);if(!captureError&&manifest.frames.length>=2)await writeCaptureManifest(dir,manifest,await captureSurface(page));}}
 catch(e){captureError??=e;}
 finally{if(captureError){report.captureFailure=captureError.stack;report.passed=false;}for(const k of ['KeyW','KeyA','KeyD'])await page?.keyboard.up(k).catch(()=>{});await context?.close();await browser.close();await fs.writeFile(`${dir}/report.json`,JSON.stringify(report,null,2));await fs.writeFile(`${dir}/ownership.json`,JSON.stringify({...owner,active:false,renderingClients:0},null,2));}
}
if(captureError)throw captureError;
console.log(JSON.stringify({cases:report.cases.length,passed:report.passed,frames:manifest?.frames.length,errors:report.errors}));
