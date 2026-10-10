/** Ordinary tower traversal plus narrowly labelled diagnostic audio/lifetime
 * cases. Capture and timed benchmarks are deliberately separate operations. */
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {CDP_URL} from '../lib/cdp.mjs';
import {browserOwnership} from '../lib/browser-ownership.mjs';
import {appendFrame,captureSurface,writeCaptureManifest} from '../lib/capture-manifest.mjs';
const dir=process.env.ASHEN_CAPTURE_DIR||'.cache/vaelmark-expedition-2026-10-09/g12-native';
const base=process.env.ASHEN_TEST_URL||'http://127.0.0.1:5873/';
await fs.mkdir(`${dir}/frames`,{recursive:true});
const browser=await chromium.connectOverCDP(CDP_URL);
assert(browser.contexts().flatMap(c=>c.pages()).every(p=>p.url()==='about:blank'));
const owner=await browserOwnership(browser,{cdpPort:new URL(CDP_URL).port,url:base,purpose:'G12 connected ordinary inscription/bell/reliquary route plus labelled reload/fault cases; no FPS claim',renderingClients:1});
await fs.writeFile(`${dir}/ownership.json`,JSON.stringify(owner,null,2));
const report={cases:[],errors:[]};let context,page,cdp,manifest,captureError,audioStart;const writes=[];
const state=()=>page.evaluate(()=>({x:ASHEN.player.body.position.x,y:ASHEN.player.body.position.y,z:ASHEN.player.body.position.z,facing:ASHEN.player.getFacing(),feet:ASHEN.player.body.position.y-ASHEN.player.capsuleHeight/2,physics:ASHEN.player.getDebugState().usingPhysics,recoveries:ASHEN.player.getDebugState().recoveries}));
async function go(point){
 let s=await state(),distance=Math.hypot(point[0]-s.x,point[2]-s.z),best=distance,progress=Date.now(),start=Date.now();
 assert(Number.isFinite(s.facing),'Navigation fixture needs the native facing getter');
 while(distance>.35){const desired=Math.atan2(point[0]-s.x,point[2]-s.z),error=Math.atan2(Math.sin(desired-s.facing),Math.cos(desired-s.facing));
  if(Math.abs(error)>.045){await page.keyboard.up('KeyW');const key=error>0?'KeyD':'KeyA';await page.keyboard.down(key);await page.waitForTimeout(Math.max(12,Math.min(150,Math.abs(error)/2.55*1000)));await page.keyboard.up(key);}
  else{await page.keyboard.down('KeyW');await page.waitForTimeout(Math.min(150,Math.max(20,(distance-.2)/7*1000)));}
  s=await state();assert(s.physics);distance=Math.hypot(point[0]-s.x,point[2]-s.z);if(distance<best-.1){best=distance;progress=Date.now();}
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
async function errors(){assert.deepEqual(await page.evaluate(()=>ASHEN.gpu.errors),[]);assert.deepEqual(report.errors,[]);}

async function face(yaw){for(let i=0;i<50;i++){const s=await state(),error=Math.atan2(Math.sin(yaw-s.facing),Math.cos(yaw-s.facing));if(Math.abs(error)<.045)return;const key=error>0?'KeyD':'KeyA';await page.keyboard.down(key);await page.waitForTimeout(Math.max(12,Math.min(150,Math.abs(error)/2.55*1000)));await page.keyboard.up(key);}throw Error('Could not face the memorial with ordinary input');}
async function memorialLook(){await page.mouse.move(1000,400);await page.mouse.down({button:'left'});await page.mouse.move(1160,540,{steps:12});await page.mouse.up({button:'left'});await page.waitForTimeout(300);}
async function walk(points,log){const states=[];for(const [i,p]of points.entries()){states.push(await go(p));if(i%8===0)console.log(`${log} ${i}/${points.length-1}`);}return states;}
async function stopCapture(){await cdp.send('Page.stopScreencast');cdp=null;await Promise.all(writes);if(captureError)throw captureError;await writeCaptureManifest(dir,manifest,await captureSurface(page));}
try{
 await setup();await boot('cathedral-nave');const start=await state(),baseline=await page.evaluate(()=>{const s=ASHEN.combat.snapshot();return {progress:s.progress,objective:s.objective};});
 const a=await page.evaluate(()=>({fy:ASHEN.world.cathedral.floorY,crypt:ASHEN.world.cathedral.exploration.undercroft,tower:ASHEN.world.cathedral.exploration.towers.find(t=>t.id==='west-bell')}));
 const inCrypt=a.crypt.route.slice(0,9),outCrypt=[[-10,a.crypt.floorY,334],...a.crypt.route.slice(12)],towerPath=[[0,a.fy,298],[-17,a.fy,298],a.tower.entrance,[-17,a.fy,302.8],...a.tower.route,a.tower.landing];
 assert.equal(await page.evaluate(()=>ASHEN.combat.exploration.snapshot().record.phase),'unstarted');assert.equal(await page.evaluate(()=>ASHEN.combat.exploration.snapshot().reliquary.open),false);
 manifest={version:1,...await captureSurface(page),frames:[],markers:{}};cdp=await context.newCDPSession(page);
 cdp.on('Page.screencastFrame',e=>{cdp.send('Page.screencastFrameAck',{sessionId:e.sessionId}).catch(()=>{});if(captureError)return;try{const bytes=Buffer.from(e.data,'base64'),name=`frame-${String(manifest.frames.length).padStart(5,'0')}.jpg`;appendFrame(manifest,{name,timestamp:e.metadata.timestamp,bytes});writes.push(fs.writeFile(`${dir}/frames/${name}`,bytes).catch(e=>{captureError??=e;}));}catch(e){captureError??=e;}});
 await cdp.send('Page.startScreencast',{format:'jpeg',quality:88,maxWidth:1280,maxHeight:720,everyNthFrame:8});
 const steps=[...await walk(inCrypt,'CRYPT ENTRY'),await go(a.crypt.memorial.stand)];await face(Math.PI/2);await memorialLook();await page.waitForTimeout(900);manifest.markers.closed=Date.now()/1000;await page.screenshot({path:`${dir}/closed.png`});await page.keyboard.press('KeyX');await page.waitForFunction(()=>ASHEN.menu.isOpen&&ASHEN.combat.exploration.snapshot().record.phase==='inscription-read');await page.waitForTimeout(2200);await page.keyboard.press('Escape');
 steps.push(...await walk(outCrypt,'CRYPT RETURN'),...await walk(towerPath,'BELL ASCENT'));await page.waitForTimeout(400);manifest.markers.bell=Date.now()/1000;await page.keyboard.press('KeyX');await page.waitForFunction(()=>ASHEN.combat.exploration.snapshot().record.phase==='bell-rung');assert.equal(await page.evaluate(()=>ASHEN.combat.exploration.snapshot().reliquary.open),false);await page.waitForTimeout(1000);
 steps.push(...await walk(towerPath.slice(0,-1).reverse(),'BELL DESCENT'),...await walk(inCrypt,'CRYPT REVISIT'));
 manifest.markers.return=Date.now()/1000;await go(a.crypt.memorial.stand);await face(Math.PI/2);await page.waitForFunction(()=>ASHEN.combat.exploration.snapshot().reliquary.open);manifest.markers.opened=Date.now()/1000;await page.screenshot({path:`${dir}/opened.png`});assert.equal(await page.evaluate(()=>ASHEN.combat.exploration.snapshot().reliquary.relicVisible),true);await page.waitForTimeout(1800);
 await page.keyboard.press('KeyX');await page.waitForFunction(()=>ASHEN.menu.isOpen&&ASHEN.combat.exploration.snapshot().record.phase==='relic-claimed');assert(await page.locator('[data-discovery="vaelmark-relic"] .remembrance-emblem').isVisible());assert.match(await page.locator('[data-exploration-journal]').innerText(),/Hollowmere/);manifest.markers.journal=Date.now()/1000;await page.screenshot({path:`${dir}/remembrance.png`});await page.waitForTimeout(2500);await page.keyboard.press('Escape');await page.waitForTimeout(500);
 assert.equal(await page.evaluate(()=>ASHEN.combat.exploration.snapshot().reliquary.relicVisible),false);manifest.markers.claimed=Date.now()/1000;await page.screenshot({path:`${dir}/claimed.png`});await page.keyboard.press('KeyX');await page.waitForFunction(()=>ASHEN.menu.isOpen);assert.equal(await page.evaluate(()=>ASHEN.combat.exploration.snapshot().record.discovered.filter(id=>id==='vaelmark-relic').length),1);await page.keyboard.press('Escape');
 // The stone edge is x=-8.25. Allow centimetres of native solver variation
 // while requiring the capsule centre outside it and feet on the crypt floor.
 // A previous -8.60 check sat within 1 mm of ordinary contact and was brittle.
 // Actual tomb contact, followed by both unchanged side aisles and normal return.
 await go(a.crypt.memorial.stand);await face(Math.PI/2);const contactStart=await state();await page.keyboard.down('KeyW');await page.waitForTimeout(1500);await page.keyboard.up('KeyW');const contact=await state();console.log('CONTACT',JSON.stringify({contactStart,contact}));assert(contact.x< -8.50&&Math.abs(contact.feet-a.crypt.floorY)<.1,`Memorial contact escaped: ${JSON.stringify({contactStart,contact})}`);steps.push(await go([-10,a.crypt.floorY,329]),...await walk([[-10,a.crypt.floorY,325],[-4,a.crypt.floorY,325],[-4,a.crypt.floorY,334]],'SIDE AISLES'),...await walk(a.crypt.route.slice(12),'NAVE RETURN'));
 const casterState=await page.evaluate(()=>({sun:ASHEN.shadows.dynamicCasters.filter(m=>/^Vaelmark (bell|reliquary|remembrance)/.test(m.name)).map(m=>m.name),local:ASHEN.localLights.casters.filter(m=>/^Vaelmark (bell|reliquary|remembrance)/.test(m.name)).map(m=>m.name),slots:ASHEN.localLights.state?.active?.length,triangles:ASHEN.combat.exploration.snapshot().propTriangles}));assert.deepEqual(casterState.sun,[]);assert.deepEqual(casterState.local,[]);assert.equal(casterState.slots,2);assert(casterState.triangles<2000);
 const end=await state();assert.equal(end.recoveries,start.recoveries);assert(steps.every(s=>s.recoveries===start.recoveries));assert.deepEqual(await page.evaluate(()=>{const s=ASHEN.combat.snapshot();return {progress:s.progress,objective:s.objective};}),baseline);await errors();
 report.cases.push({case:'connected fresh-journal inscription, west bell, reliquary claim, both aisles and nave return',initialDeveloperNaveSetup:true,ordinaryInputs:true,start,end,steps,contactStart,contact,unchangedCombat:baseline,casterState,final:await page.evaluate(()=>ASHEN.combat.exploration.snapshot())});await stopCapture();await context.close();context=null;
 for(const phase of ['bell-rung','relic-claimed','returned']){
  await setup();await context.addInitScript(phase=>localStorage.setItem('ashen.exploration.v1',JSON.stringify({version:1,episode:'vaelmark-bell-v1',phase,discovered:['vaelmark-inscription','vaelmark-bell',...(phase==='bell-rung'?[]:['vaelmark-relic']),...(phase==='returned'?['hollowmere-return']:[])]})),phase);await boot('cathedral-undercroft');const r=await page.evaluate(()=>ASHEN.combat.exploration.snapshot());assert.equal(r.record.phase,phase);assert.equal(r.reliquary.open,true);assert.equal(r.reliquary.active,false);assert.equal(r.reliquary.relicVisible,phase==='bell-rung');assert.equal(r.bell.rings,0);await errors();report.cases.push({case:`labelled saved ${phase} reload settles directly`,snapshot:r});await context.close();context=null;
 }
 report.passed=true;
}catch(e){report.failure=e.stack;await page?.screenshot({path:`${dir}/failure.png`}).catch(()=>{});throw e;}
finally{if(cdp)await cdp.send('Page.stopScreencast').catch(()=>{});await Promise.all(writes);for(const k of ['KeyW','KeyA','KeyD'])await page?.keyboard.up(k).catch(()=>{});await context?.close();await browser.close();await fs.writeFile(`${dir}/report.json`,JSON.stringify(report,null,2));await fs.writeFile(`${dir}/ownership.json`,JSON.stringify({...owner,active:false,renderingClients:0},null,2));}
console.log(JSON.stringify({cases:report.cases.length,passed:report.passed,frames:manifest?.frames.length,errors:report.errors}));
