/** Ordinary tower traversal plus narrowly labelled diagnostic audio/lifetime
 * cases. Capture and timed benchmarks are deliberately separate operations. */
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {CDP_URL} from '../lib/cdp.mjs';
import {browserOwnership} from '../lib/browser-ownership.mjs';
import {appendFrame,captureSurface,writeCaptureManifest} from '../lib/capture-manifest.mjs';
const dir=process.env.ASHEN_CAPTURE_DIR||'.cache/vaelmark-expedition-2026-10-09/g11-native';
const base=process.env.ASHEN_TEST_URL||'http://127.0.0.1:5873/';
await fs.mkdir(`${dir}/frames`,{recursive:true});
const browser=await chromium.connectOverCDP(CDP_URL);
assert(browser.contexts().flatMap(c=>c.pages()).every(p=>p.url()==='about:blank'));
const owner=await browserOwnership(browser,{cdpPort:new URL(CDP_URL).port,url:base,purpose:'G11 ordinary bell stairs and diagnostic cue/motion/failure checks; no FPS claim',renderingClients:1});
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
async function boot(at){const u=new URL(base);u.searchParams.set('dev','');u.searchParams.set('play','');u.searchParams.set('at',at);await page.goto(u.href);await page.waitForFunction(()=>globalThis.ASHEN?.ready&&ASHEN.navigationReady&&ASHEN.hostilesReady&&ASHEN.combat?.exploration.snapshot().bell,null,{timeout:120000});await page.evaluate(()=>ASHEN.metrics.setInternalResolution(1280,720));await mortal();await page.waitForTimeout(400);}
async function jump(id){await page.keyboard.press('Escape');await page.locator('[data-action="developer-tools"]').click();await page.getByLabel('Destination',{exact:true}).selectOption(id);await page.locator('[data-action="jump"]').click();await page.waitForTimeout(500);}
async function setup(seed=false){context=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1});if(seed)await context.addInitScript(()=>{if(!sessionStorage.getItem('bell-fixture-seeded')){localStorage.setItem('ashen.exploration.v1',JSON.stringify({version:1,episode:'vaelmark-bell-v1',phase:'inscription-read',discovered:['vaelmark-inscription']}));sessionStorage.setItem('bell-fixture-seeded','1');}});
 page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
 await page.addInitScript(()=>{window.__audioProbe={contexts:[],starts:0,gainsAfterClose:0};const native=AudioContext;window.AudioContext=new Proxy(native,{construct(t,a,n){const c=Reflect.construct(t,a,n);__audioProbe.contexts.push(c);return c;}});const start=AudioBufferSourceNode.prototype.start;AudioBufferSourceNode.prototype.start=function(...a){__audioProbe.starts++;return start.apply(this,a);};const gain=GainNode;window.GainNode=new Proxy(gain,{construct(t,a,n){if(a[0]?.state==='closed')__audioProbe.gainsAfterClose++;return Reflect.construct(t,a,n);}});});
}
async function errors(){assert.deepEqual(await page.evaluate(()=>ASHEN.gpu.errors),[]);assert.deepEqual(report.errors,[]);}
try{
 if(process.env.ASHEN_BELL_FAULTS_ONLY!=='1'){
 if(process.env.ASHEN_BELL_CAPTURE_ONLY!=='1'){
 await setup();await boot('cathedral-nave');const start=await state();console.log('BOOT: mortal/Havok ready; ordinary west-bell route');
 const authored=await page.evaluate(()=>{const c=ASHEN.world.cathedral,t=c.exploration.towers.find(t=>t.id==='west-bell');return {floor:c.floorY,tower:t};});
 const path=[[0,authored.floor,298],[-17,authored.floor,298],authored.tower.entrance,[-17,authored.floor,302.8],...authored.tower.route,authored.tower.landing];
 const steps=[];for(const [i,point]of path.entries()){steps.push(await go(point));if(i%8===0)console.log(`ASCENT: waypoint ${i}/${path.length-1}`);}
 await page.waitForFunction(()=>ASHEN.combat.exploration.snapshot().candidate==='vaelmark-bell');
 await page.screenshot({path:`${dir}/ordinary-top.png`});await page.keyboard.press('KeyX');await page.waitForTimeout(150);
 assert.equal(await page.evaluate(()=>ASHEN.combat.exploration.snapshot().record.phase),'unstarted');
 assert.equal(await page.evaluate(()=>ASHEN.combat.exploration.snapshot().bell.rings),1);
 assert(Math.abs(await page.evaluate(()=>ASHEN.combat.exploration.snapshot().bell.angle))>.001);
 await page.keyboard.press('KeyX');assert.equal(await page.evaluate(()=>ASHEN.combat.exploration.snapshot().bell.rings),1);
 assert.equal(await page.evaluate(()=>__audioProbe.contexts.length),0,'Muted bell created AudioContext');
 await page.waitForTimeout(3700);assert.equal(await page.evaluate(()=>ASHEN.combat.exploration.snapshot().bell.active),false);
 for(const [i,point]of path.slice(0,-1).reverse().entries()){steps.push(await go(point));if(i%8===0)console.log(`DESCENT: waypoint ${i}/${path.length-2}`);}
 const end=await state();assert.equal(end.recoveries,start.recoveries);assert(steps.every(s=>s.recoveries===start.recoveries));await errors();
 report.cases.push({case:'ordinary terrace entrance, 24-flight west ascent, pre-inscription ring and full descent',start,end,steps,phase:'unstarted',mutedContexts:0});
 console.log('PASS: ordinary ascent, pre-inscription ring/rate limit/mute and full descent');
 await jump('cathedral-undercroft');const crypt=await page.evaluate(()=>ASHEN.world.cathedral.exploration.undercroft);await go([-10,crypt.floorY,334]);await go(crypt.memorial.stand);await page.waitForTimeout(300);await page.keyboard.press('KeyX');await page.waitForFunction(()=>ASHEN.menu.isOpen&&ASHEN.combat.exploration.snapshot().record.phase==='inscription-read');
 }else await setup(true);
 await boot('cathedral-west-bell');assert.equal(await page.evaluate(()=>ASHEN.combat.exploration.snapshot().record.phase),'inscription-read');
 await page.locator('.sound-toggle').click();await page.waitForFunction(()=>ASHEN.combat.audio.status.bellReady&&ASHEN.combat.audio.status.state==='running',null,{timeout:20000});
 // Ordinary RMB look raises the view toward the existing bell and new mechanism.
 await page.mouse.move(640,360);await page.mouse.down({button:'right'});await page.mouse.move(900,145,{steps:18});await page.mouse.up({button:'right'});await page.waitForTimeout(600);
 await page.screenshot({path:`${dir}/mechanism.png`});
 audioStart=await page.evaluate(()=>{const capture=ASHEN.combat.audio.capture(),recorder=new MediaRecorder(capture.stream,{mimeType:'audio/webm;codecs=opus'}),chunks=[],done=new Promise(resolve=>recorder.onstop=resolve);recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};window.__bellCapture={capture,recorder,chunks,done};recorder.start(250);return Date.now()/1000;});
 manifest={version:1,...await captureSurface(page),frames:[]};cdp=await context.newCDPSession(page);
 cdp.on('Page.screencastFrame',e=>{cdp.send('Page.screencastFrameAck',{sessionId:e.sessionId}).catch(()=>{});if(captureError)return;try{const bytes=Buffer.from(e.data,'base64'),name=`frame-${String(manifest.frames.length).padStart(5,'0')}.jpg`;appendFrame(manifest,{name,timestamp:e.metadata.timestamp,bytes});writes.push(fs.writeFile(`${dir}/frames/${name}`,bytes).catch(e=>{captureError??=e;}));}catch(e){captureError??=e;}});
 await cdp.send('Page.startScreencast',{format:'jpeg',quality:90,maxWidth:1280,maxHeight:720,everyNthFrame:4});await page.waitForTimeout(800);await page.keyboard.press('KeyX');await page.waitForTimeout(200);
 assert.equal(await page.evaluate(()=>ASHEN.combat.exploration.snapshot().record.phase),'bell-rung');assert.equal(await page.evaluate(()=>ASHEN.combat.audio.status.bellPlayed),1);
 const casters=await page.evaluate(()=>({sun:ASHEN.shadows.dynamicCasters.filter(m=>m.name.startsWith('Vaelmark bell')).map(m=>m.name),local:ASHEN.localLights.casters.filter(m=>m.name.startsWith('Vaelmark bell')).map(m=>m.name),triangles:ASHEN.combat.exploration.snapshot().propTriangles,slots:ASHEN.localLights.state?.active?.length}));assert.deepEqual(casters.sun,[]);assert.deepEqual(casters.local,[]);assert(casters.triangles>0&&casters.triangles<=2000);
 await page.keyboard.press('KeyX');assert.equal(await page.evaluate(()=>ASHEN.combat.exploration.snapshot().bell.rings),1);
 await page.waitForTimeout(4000);await page.keyboard.press('Escape');await page.locator('[data-action="journal"]').click();assert(await page.locator('[data-discovery="vaelmark-bell"]').isVisible());await page.waitForTimeout(2200);await page.keyboard.press('Escape');
 await page.waitForTimeout(700);await cdp.send('Page.stopScreencast');cdp=null;await Promise.all(writes);if(captureError)throw captureError;
 await writeCaptureManifest(dir,manifest,await captureSurface(page));
 const audioData=await page.evaluate(async()=>{const a=__bellCapture;a.recorder.stop();await a.done;const bytes=new Uint8Array(await new Blob(a.chunks).arrayBuffer());a.capture.dispose();delete window.__bellCapture;let s='';for(const b of bytes)s+=String.fromCharCode(b);return btoa(s);});await fs.writeFile(`${dir}/audio.webm`,Buffer.from(audioData,'base64'));await fs.writeFile(`${dir}/recording.json`,JSON.stringify({audioOffset:manifest.frames[0].timestamp-audioStart,elapsedSeconds:manifest.elapsedSeconds,captureScope:'Diagnostic top-landing setup, ordinary RMB look, ring mechanism and journal; full ordinary ascent/descent tested separately'},null,2));
 assert.equal(await page.evaluate(()=>__audioProbe.contexts.length),1);await page.evaluate(()=>ASHEN.combat.audio.play());await page.waitForTimeout(100);assert.equal(await page.evaluate(()=>ASHEN.combat.audio.status.played),1);
 await page.locator('.sound-toggle').click();await page.waitForTimeout(2100);await page.keyboard.press('KeyX');await page.waitForTimeout(100);assert.equal(await page.evaluate(()=>ASHEN.combat.audio.status.bellPlayed),1);assert.equal(await page.evaluate(()=>ASHEN.combat.exploration.snapshot().record.discovered.length),2);
 report.cases.push({case:'inscription reload, native sound activation, bell motion/credit/rate limit, journal, master mute and shared spell mixer',diagnosticTopSetup:true,casters,audio:await page.evaluate(()=>ASHEN.combat.audio.status)});
 await boot('cathedral-west-bell');assert.equal(await page.evaluate(()=>ASHEN.combat.exploration.snapshot().record.phase),'bell-rung');assert.equal(await page.evaluate(()=>ASHEN.combat.exploration.snapshot().bell.rings),0);assert.equal(await page.evaluate(()=>ASHEN.combat.audio.status.bellPlayed),0);await errors();report.cases.push({case:'bell-rung reload restores knowledge without motion or audio replay',passed:true});await context.close();context=null;
 }
 for(const fail of (process.env.ASHEN_BELL_CAPTURE_ONLY==='1'?[]:['invalid-cue','held-cue-departure','held-cue-disposal'])){
  await setup(true);let release,arrived;const hold=new Promise(r=>release=r),seen=new Promise(r=>arrived=r);
  await context.route('**/vaelmark-bell.wav',async route=>{arrived();if(fail.startsWith('held-cue')){await hold;await route.continue();}else await route.fulfill({status:200,contentType:'audio/wav',body:'Controlled invalid bell cue'});});
  try{await boot('cathedral-west-bell');await page.locator('.sound-toggle').click();await seen;
   if(fail==='invalid-cue'){await page.waitForFunction(()=>ASHEN.combat.audio.status.bellError);assert(await page.evaluate(()=>ASHEN.combat.audio.status.ready&&!ASHEN.combat.audio.status.error));await page.keyboard.press('KeyX');await page.waitForTimeout(300);assert.equal(await page.evaluate(()=>ASHEN.combat.exploration.snapshot().record.phase),'bell-rung');await page.evaluate(()=>ASHEN.combat.audio.play());assert.equal(await page.evaluate(()=>ASHEN.combat.audio.status.played),1);}
   else if(fail==='held-cue-departure'){await page.keyboard.press('KeyX');await page.waitForTimeout(150);const point=await page.evaluate(()=>ASHEN.world.cathedral.exploration.towers.find(t=>t.id==='west-bell').route.at(-1));await go(point);release();await page.waitForFunction(()=>ASHEN.combat.audio.status.bellReady);await page.waitForTimeout(300);assert.equal(await page.evaluate(()=>ASHEN.combat.audio.status.bellPlayed),0);assert.equal(await page.evaluate(()=>ASHEN.combat.exploration.snapshot().record.phase),'bell-rung');}
   else{await page.evaluate(()=>ASHEN.dispose());release();await page.waitForTimeout(1000);assert.equal(await page.evaluate(()=>__audioProbe.gainsAfterClose),0);assert(await page.evaluate(()=>__audioProbe.contexts.every(c=>c.state==='closed')));assert.equal(await page.locator('#exploration-prompt').count(),0);assert.equal(await page.evaluate(()=>ASHEN.scene.meshes.length),0);}
   await errors();report.cases.push({case:fail,controlledAudioFault:true,passed:true,audio:await page.evaluate(()=>ASHEN.combat.audio.status)});
  }finally{release();await context.close();context=null;}
 }
 report.passed=true;
}catch(e){report.failure=e.stack;await page?.screenshot({path:`${dir}/failure.png`}).catch(()=>{});throw e;}
finally{if(cdp)await cdp.send('Page.stopScreencast').catch(()=>{});await Promise.all(writes);for(const k of ['KeyW','KeyA','KeyD'])await page?.keyboard.up(k).catch(()=>{});await context?.close();await browser.close();await fs.writeFile(`${dir}/report.json`,JSON.stringify(report,null,2));await fs.writeFile(`${dir}/ownership.json`,JSON.stringify({...owner,active:false,renderingClients:0},null,2));}
console.log(JSON.stringify({cases:report.cases.length,passed:report.passed,errors:report.errors,frames:manifest?.frames.length}));
