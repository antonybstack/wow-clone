/** Native game audio lifecycle controls. Not a benchmark; caller owns/isolate CDP. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium} from 'playwright';
import {CDP_URL} from '../lib/cdp.mjs';

const output=process.argv[2];assert(output,'Pass a report.json destination');
const url=process.env.ASHEN_TEST_URL||'http://127.0.0.1:5173/?play&clean&pixelRatio=1&dev';
const browser=await chromium.connectOverCDP(CDP_URL),cases=[];
assert(browser.contexts().flatMap(c=>c.pages()).every(p=>p.url()==='about:blank'),'Another owned game page is active');
function installAudioProbe(fail){
  window.__audioProbe={contexts:[],closeCalls:0,sourceStarts:0,menuEvents:[],decodeSettled:0,gainsAfterClose:0,gainCount:0,unhandled:[]};
  for(const type of ['pointerup','click'])document.addEventListener(type,event=>{
   if(event.target.closest?.('.touch-menu,#game-menu'))__audioProbe.menuEvents.push({type,at:performance.now(),target:event.target.id||event.target.className||event.target.tagName,open:window.ASHEN?.menu.isOpen});
  },true);
  const NativeAudioContext=window.AudioContext,close=NativeAudioContext.prototype.close,start=AudioBufferSourceNode.prototype.start,decode=NativeAudioContext.prototype.decodeAudioData,NativeGainNode=window.GainNode;
  window.AudioContext=new Proxy(NativeAudioContext,{construct(target,args,newTarget){
   if(fail)throw Error('Controlled AudioContext construction failure');
   const at=performance.now(),created=Reflect.construct(target,args,newTarget);
   __audioProbe.contexts.push({created,at,constructorMs:performance.now()-at});return created;
  }});
  NativeAudioContext.prototype.close=function(...args){__audioProbe.closeCalls++;return Reflect.apply(close,this,args);};
  NativeAudioContext.prototype.decodeAudioData=function(...args){try{const out=Reflect.apply(decode,this,args);out.then(()=>__audioProbe.decodeSettled++,()=>__audioProbe.decodeSettled++);return out;}catch(error){__audioProbe.decodeSettled++;throw error;}};
  // Lite constructs GainNode directly; a createGain-only observer misses graphs.
  // https://github.com/BabylonJS/Babylon-Lite/blob/npm-lite-v1.31.1/packages/babylon-lite/src/audio/sound-sub-graph.ts
  window.GainNode=new Proxy(NativeGainNode,{construct(target,args,newTarget){__audioProbe.gainCount++;if(args[0]?.state==='closed')__audioProbe.gainsAfterClose++;return Reflect.construct(target,args,newTarget);}});
  window.addEventListener('unhandledrejection',e=>__audioProbe.unhandled.push(String(e.reason)));
  AudioBufferSourceNode.prototype.start=function(...args){__audioProbe.sourceStarts++;return Reflect.apply(start,this,args);};
}
async function run(name,check,{touch=false,failContext=false,disposed=false}={}){
 if(process.env.ASHEN_AUDIO_CASE&&!name.includes(process.env.ASHEN_AUDIO_CASE))return;
 const context=await browser.newContext({viewport:touch?{width:390,height:844}:{width:1280,height:720},deviceScaleFactor:1,hasTouch:touch,isMobile:touch});
 const page=await context.newPage(),errors=[],requests=[],row={name,errors,requests,touchEmulation:touch};
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('request',r=>{if(r.url().endsWith('.wav'))requests.push(r.url());});
 await context.addInitScript(installAudioProbe,failContext);
 try{
  await check(page,context,row);
  await page.evaluate(()=>new Promise(r=>requestAnimationFrame(r)));
  row.final=await page.evaluate(()=>({audio:ASHEN.combat.audio.status,muted:ASHEN.combat.audio.muted,contexts:__audioProbe.contexts.length,contextStates:__audioProbe.contexts.map(c=>c.created.state),constructorMs:__audioProbe.contexts.map(c=>c.constructorMs),closeCalls:__audioProbe.closeCalls,sourceStarts:__audioProbe.sourceStarts,decodeSettled:__audioProbe.decodeSettled,gainsAfterClose:__audioProbe.gainsAfterClose,gainCount:__audioProbe.gainCount,unhandled:__audioProbe.unhandled,physics:ASHEN.player.getDebugState().usingPhysics,recoveries:ASHEN.player.getDebugState().recoveries}));
  assert.equal(row.final.gainsAfterClose,0,'A late decoded sibling created a graph after disposal');
  assert.deepEqual(row.final.unhandled,[]);
  if(row.final.contexts)assert(row.final.gainCount>=2,'Native engine gains were not observed');
  assert.deepEqual(errors,[]);assert.equal(row.final.physics,!disposed);assert.equal(row.final.recoveries,0);row.passed=true;
 }catch(error){row.passed=false;row.failure=String(error.stack||error);row.failedGameState=await page.evaluate(()=>({audio:ASHEN?.combat?.audio.status,lastResult:ASHEN?.combat?.spell.lastResult,pending:ASHEN?.combat?.pendingSpell,menuOpen:ASHEN?.menu.isOpen,menuEvents:__audioProbe.menuEvents,body:ASHEN?.body?.getState(),player:ASHEN?.player?.getDebugState()})).catch(()=>null);await page.screenshot({path:output.replace(/\.json$/,'.failed.png')}).catch(()=>{});throw error;}
 finally{cases.push(row);await fs.writeFile(output,JSON.stringify({url,cases,diagnosticOnly:true},null,2));await context.close();}
}
async function boot(page,{complete=false}={}){
 await page.goto(url,{waitUntil:'commit'});await page.waitForFunction(()=>globalThis.ASHEN?.combatReady,null,{timeout:60000});
 if(complete)await page.waitForFunction(()=>ASHEN.ready&&ASHEN.hostilesReady,null,{timeout:120000});
 assert.equal(await page.evaluate(()=>__audioProbe.contexts.length),0,'Muted gameplay eagerly created AudioContext');
 assert.equal(await page.evaluate(()=>ASHEN.combat.audio.muted&&!ASHEN.combat.audio.status.ready&&!ASHEN.combat.audio.status.initializing),true);
 assert.equal(await page.locator('.sound-toggle').isEnabled(),true);
 assert.equal(await page.evaluate(()=>ASHEN.player.getDebugState().usingPhysics),true,'Havok must be active before the audio check');
}
async function ready(page){await page.waitForFunction(()=>ASHEN.combat.audio.status.ready&&ASHEN.combat.audio.status.state==='running'&&!ASHEN.combat.audio.status.initializing,null,{timeout:20000});}
try{
 await run('muted movement/cast; pointer sound; capture; remute/keyboard resume',async(page,context,row)=>{
  await boot(page,{complete:true});await page.evaluate(()=>{ASHEN.dev.god=true;});
  const before=await page.evaluate(()=>({x:ASHEN.player.body.position.x,z:ASHEN.player.body.position.z}));
  await page.keyboard.down('KeyW');await page.waitForTimeout(300);await page.keyboard.up('KeyW');
  const after=await page.evaluate(()=>({x:ASHEN.player.body.position.x,z:ASHEN.player.body.position.z}));assert(Math.hypot(after.x-before.x,after.z-before.z)>.1);
  await page.waitForFunction(()=>ASHEN.player.getGrounded()&&ASHEN.body.getState().phase!=='air');
  await page.keyboard.press('Tab');await page.waitForTimeout(100);await page.keyboard.press('Digit1');await page.waitForFunction(()=>ASHEN.combat.spell.casts===1,null,{timeout:5000});
  row.muted=await page.evaluate(()=>({contexts:__audioProbe.contexts.length,audio:ASHEN.combat.audio.status,casts:ASHEN.combat.spell.casts,lastResult:ASHEN.combat.spell.lastResult}));assert.equal(row.muted.contexts,0);assert.equal(row.muted.casts,1);assert.deepEqual(row.requests,[]);
  await page.locator('.sound-toggle').click();await ready(page);
  assert.equal(await page.evaluate(()=>__audioProbe.contexts.length),1);
  await page.waitForTimeout(1600);await page.waitForFunction(()=>ASHEN.combat.spell.cooldown===0&&!ASHEN.body.getState().castingShoot);await page.keyboard.press('Digit1');await page.waitForFunction(()=>ASHEN.combat.audio.status.played===1,null,{timeout:5000});
  row.playback=await page.evaluate(()=>{const capture=ASHEN.combat.audio.capture();const state={played:ASHEN.combat.audio.status.played,sourceStarts:__audioProbe.sourceStarts,tracks:capture.stream.getAudioTracks().map(t=>({kind:t.kind,state:t.readyState})),contexts:__audioProbe.contexts.length};capture.dispose();return state;});
  assert.equal(row.playback.played,1);assert(row.playback.sourceStarts>0);assert.equal(row.playback.tracks.length,1);assert.equal(row.playback.tracks[0].state,'live');assert.equal(row.playback.contexts,1);
  await page.locator('.sound-toggle').click();assert(await page.evaluate(()=>ASHEN.combat.audio.muted));
  await page.locator('.sound-toggle').focus();await page.keyboard.press('Enter');await ready(page);assert.equal(await page.evaluate(()=>ASHEN.combat.audio.muted),false);
  await page.screenshot({path:output.replace(/\.json$/,'.png')});
 });
 await run('first request through keyboard activation',async(page)=>{await boot(page);await page.locator('.sound-toggle').focus();await page.keyboard.press('Enter');await ready(page);assert.equal(await page.evaluate(()=>__audioProbe.contexts.length),1);});
 await run('first request through mobile menu touch activation',async(page)=>{await boot(page);await page.getByRole('button',{name:'Menu',exact:true}).tap();await page.locator('#game-menu [data-action="sound"]').tap();await ready(page);await page.waitForFunction(()=>document.querySelector('#game-menu [data-action="sound"]').textContent==='Sound: on');assert.equal(await page.locator('#game-menu [data-action="sound"]').isEnabled(),true);assert.equal(await page.evaluate(()=>__audioProbe.contexts.length),1);},{touch:true});
 await run('explicit capture preparation shares one native engine',async(page)=>{
  await boot(page);const result=await page.evaluate(async()=>{const a=ASHEN.combat.audio,p=a.prepare(),same=p===a.prepare();await p;const capture=a.capture(),tracks=capture.stream.getAudioTracks().length;capture.dispose();return {same,tracks,muted:a.muted,contexts:__audioProbe.contexts.length};});
  assert.deepEqual(result,{same:true,tracks:1,muted:true,contexts:1});await page.locator('.sound-toggle').click();await ready(page);
 });
 await run('construction failure disables sound; movement remains live',async(page,context,row)=>{
  await boot(page);await page.locator('.sound-toggle').click();await page.waitForFunction(()=>!!ASHEN.combat.audio.status.error);
  assert.equal(await page.locator('.sound-toggle').textContent(),'Sound unavailable');assert.equal(await page.locator('.sound-toggle').isEnabled(),false);
  row.failureStatus=await page.evaluate(()=>ASHEN.combat.audio.status);assert.match(row.failureStatus.error,/Controlled AudioContext/);
  const before=await page.evaluate(()=>ASHEN.player.body.position.z);await page.keyboard.down('KeyW');await page.waitForTimeout(300);await page.keyboard.up('KeyW');assert.notEqual(await page.evaluate(()=>ASHEN.player.body.position.z),before);
 },{failContext:true});
 await run('dispose during held native sound fetch',async(page,context,row)=>{
  let release,seen;const held=new Promise(r=>{release=r;}),arrived=new Promise(r=>{seen=r;});
  await context.route('**/fireball-julien-matthey.wav',async route=>{seen();await held;await route.continue();});
  await boot(page);await page.locator('.sound-toggle').click();await Promise.race([arrived,new Promise((_,reject)=>setTimeout(()=>reject(Error('Audio request not observed')),10000))]);
  await page.waitForFunction(()=>__audioProbe.decodeSettled===1,null,{timeout:10000});
  assert.equal(await page.evaluate(()=>ASHEN.combat.audio.status.initializing),true);
  assert.equal(await page.locator('.sound-toggle').isEnabled(),false);
  await page.evaluate(()=>ASHEN.dispose());release();await page.waitForFunction(()=>__audioProbe.contexts.every(c=>c.created.state==='closed'));await page.waitForTimeout(1200);
  row.disposed=await page.evaluate(()=>({meshes:ASHEN.scene.meshes.length,ready:ASHEN.combat.audio.status.ready,contexts:__audioProbe.contexts.length,closes:__audioProbe.closeCalls}));assert.deepEqual(row.disposed,{meshes:0,ready:false,contexts:1,closes:1});
 },{disposed:true});
 // Either native decode can fail while the sibling still owns an in-flight fetch.
 // Releasing that sibling after engine cleanup must not install a late graph.
 // https://github.com/BabylonJS/Babylon-Lite/blob/npm-lite-v1.31.1/packages/babylon-lite/src/audio/static-sound.ts
 for(const failedFile of ['fireball-julien-matthey.wav','lava-charge.wav'])await run(`failed ${failedFile} decode with held sibling`,async(page,context,row)=>{
  const heldFile=failedFile==='lava-charge.wav'?'fireball-julien-matthey.wav':'lava-charge.wav';
  let release,seen;const held=new Promise(r=>{release=r;}),arrived=new Promise(r=>{seen=r;});
  await context.route(`**/${heldFile}`,async route=>{seen();await held;await route.continue();});
  await context.route(`**/${failedFile}`,route=>route.fulfill({status:200,contentType:'audio/wav',body:'Controlled invalid WAV'}));
  try{
   await boot(page);await page.locator('.sound-toggle').click();
   await Promise.race([arrived,new Promise((_,reject)=>setTimeout(()=>reject(Error('Sibling request not observed')),10000))]);
   await page.waitForFunction(()=>!!ASHEN.combat.audio.status.error&&!ASHEN.combat.audio.status.initializing&&__audioProbe.contexts.every(c=>c.created.state==='closed'));
   assert.equal(await page.locator('.sound-toggle').textContent(),'Sound unavailable');
   const gainCount=await page.evaluate(()=>__audioProbe.gainCount);release();
   await page.waitForFunction(()=>__audioProbe.decodeSettled===2,null,{timeout:10000});
   row.failureStatus=await page.evaluate(()=>ASHEN.combat.audio.status);
   assert.equal(row.failureStatus.ready,false);assert.equal(await page.evaluate(()=>__audioProbe.gainCount),gainCount);
   assert.equal(await page.evaluate(()=>__audioProbe.closeCalls),1);
   const before=await page.evaluate(()=>ASHEN.player.body.position.z);await page.keyboard.down('KeyW');await page.waitForTimeout(300);await page.keyboard.up('KeyW');assert.notEqual(await page.evaluate(()=>ASHEN.player.body.position.z),before);
  }finally{release();}
 });
 await run('dispose without any sound request creates nothing',async(page)=>{await boot(page);await page.evaluate(()=>ASHEN.dispose());await page.keyboard.press('KeyW');assert.equal(await page.evaluate(()=>__audioProbe.contexts.length),0);},{disposed:true});
 // Negative controls exercise the same native probe on a blank page.
 // Promise.all installs rejection reactions on every input, including late ones:
 // https://tc39.es/ecma262/multipage/control-abstraction-objects.html#sec-performpromiseall
 const probeContext=await browser.newContext();await probeContext.addInitScript(installAudioProbe,false);
 try{
  const probePage=await probeContext.newPage();await probePage.goto('about:blank');
  const graph=await probePage.evaluate(async()=>{const c=new AudioContext();await c.close();let constructorError=null;try{new GainNode(c);}catch(e){constructorError=String(e);}return{attempts:__audioProbe.gainCount,afterClose:__audioProbe.gainsAfterClose,constructorError};});
  assert.equal(graph.attempts,1);assert.equal(graph.afterClose,1);
  const promises=await probePage.evaluate(async()=>{
   let lateDone=false,caught=null;
   try{await Promise.all([Promise.reject('controlled early'),new Promise((_,reject)=>setTimeout(()=>{lateDone=true;reject('controlled late');},10))]);}catch(e){caught=String(e);}
   await new Promise(r=>setTimeout(r,50));const allUnhandled=[...__audioProbe.unhandled];
   Promise.reject('controlled bare rejection');await new Promise(r=>setTimeout(r,50));
   return{lateDone,caught,allUnhandled,negativeControlUnhandled:[...__audioProbe.unhandled]};
  });
  assert.equal(promises.lateDone,true);assert.equal(promises.caught,'controlled early');assert.deepEqual(promises.allUnhandled,[]);assert.deepEqual(promises.negativeControlUnhandled,['controlled bare rejection']);
  await fs.writeFile(output.replace(/\.json$/,'.probe-controls.json'),JSON.stringify({graph,promises,passed:true,nativeBlankPage:true},null,2));
 }finally{await probeContext.close();}
}finally{await browser.close();}
console.log(JSON.stringify({passed:true,cases:cases.map(c=>({name:c.name,passed:c.passed})),output}));
