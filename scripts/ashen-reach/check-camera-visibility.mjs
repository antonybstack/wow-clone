/** Native Havok obstruction, visual ownership and real keyboard/touch controls.
 * Caller owns one audited CDP browser. Holding only the real region worker's
 * start message keeps the real loading fence available for transactions; this
 * is a diagnostic control, never a load/FPS benchmark or traversal substitute.
 * https://developer.mozilla.org/en-US/docs/Web/API/Worker/postMessage
 */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {chromium} from 'playwright';
import {CDP_URL} from '../lib/cdp.mjs';
import {browserOwnership} from '../lib/browser-ownership.mjs';

const dir=process.env.ASHEN_CAPTURE_DIR;
const url=process.env.ASHEN_TEST_URL;
assert(dir&&url,'Require a report directory and audited game URL');
const recipe=JSON.parse(await fs.readFile(process.env.ASHEN_PROBE_APPEARANCE,'utf8'));
const identities=JSON.parse(await fs.readFile('public/ashen-reach/human-identity-v1/manifest.json','utf8'));
const browser=await chromium.connectOverCDP(CDP_URL);
assert(browser.contexts().flatMap(c=>c.pages()).every(p=>p.url()==='about:blank'),'Another owned page is active');
await fs.mkdir(dir,{recursive:true});
const ownership=await browserOwnership(browser,{cdpPort:process.env.ASHEN_CDP_PORT,url,purpose:'Native camera visibility diagnostics; no FPS/load claim',renderingClients:1});
await fs.writeFile(path.join(dir,'ownership.json'),JSON.stringify(ownership,null,2));
const report={url,diagnosticRegionHold:true,rows:[]};

const snapshot=page=>page.evaluate(()=>{
 const a=ASHEN,c=a.rig.camera,m=c.worldMatrix;
 // Public camera world transform, from the active game graph. No duplicate
 // Lite import or hand-built orbit/ray math is used by this probe.
 // https://github.com/BabylonJS/Babylon-Lite/blob/npm-lite-v1.31.1/docs/lite/architecture/02-camera.md
 const lens={x:m[12],y:m[13],z:m[14]};
 const local=a.scene.meshes.filter(mesh=>{
  if(mesh===a.player.body)return false;
  for(let node=mesh;node;node=node.parent)if(node===a.player.body)return true;
  return false;
 });
 return {radius:c.radius,requested:a.rig.distance,characterVisible:a.rig.characterVisible,
  rootVisible:a.body.root.visible,local:local.map(mesh=>({name:mesh.name,visible:mesh.visible!==false})),
  lens,sweep:a.rig.collisionSweep(c.target,lens),position:{...a.player.body.position},
  physics:a.player.getDebugState(),appearance:a.getAppearance?.(),equipment:a.equipment.getState(),
  gpuErrors:a.gpu.errors.slice(),armory:a.armory?.isOpen,ready:a.ready,held:!!__heldRegionStart,
  worldShadowCasters:a.shadows?.state?.staticCasters};
});
function hidden(state){
 assert.equal(state.characterVisible,false);assert.equal(state.rootVisible,false);
 assert(state.local.length>0,'Probe must identify actual local meshes');
 assert(state.local.every(mesh=>!mesh.visible),'A body or worn piece leaked into the close view');
 assert(state.physics.usingPhysics);assert.equal(state.physics.recoveries,0);
 assert(!state.sweep.hasHit||state.sweep.fraction>.995,'Native lens sweep penetrates the obstruction');
 assert.deepEqual(state.gpuErrors,[]);
}
function shown(state){
 assert.equal(state.rootVisible,true);assert(state.local.some(mesh=>mesh.visible),'No actual local visual restored');
 assert(state.physics.usingPhysics);assert.equal(state.physics.recoveries,0);assert.deepEqual(state.gpuErrors,[]);
}
async function run(name,{maximum=false,touch=false,transactions=false}={}){
 const context=await browser.newContext({viewport:touch?{width:390,height:844}:{width:1280,height:720},deviceScaleFactor:1,hasTouch:touch,isMobile:touch});
 const page=await context.newPage(),cdp=await context.newCDPSession(page),row={name,touchEmulation:touch,steps:[],errors:[]};
 report.rows.push(row);
 const save=()=>fs.writeFile(path.join(dir,'report.json'),JSON.stringify(report,null,2));
 page.on('pageerror',e=>row.errors.push(e.message));
 page.on('console',message=>{if(message.type()==='error')row.errors.push(message.text());});
 await context.addInitScript(seed=>{
  if(seed)localStorage.setItem('ashen.appearance.v2',JSON.stringify(seed));
  const NativeWorker=Worker;
  globalThis.__heldRegionStart=null;
  globalThis.__releaseRegion=()=>{const held=__heldRegionStart;__heldRegionStart=null;held?.release();};
  globalThis.Worker=new Proxy(NativeWorker,{construct(target,args,newTarget){
   const worker=Reflect.construct(target,args,newTarget);
   if(String(args[0]).includes('world-worker')){
    const post=worker.postMessage.bind(worker);
    worker.postMessage=(message,...rest)=>{
     if(message?.start){__heldRegionStart={release:()=>post(message,...rest)};return;}
     return post(message,...rest);
    };
   }
   return worker;
  }});
 },maximum?recipe:null);
 async function step(label,check){
  await page.evaluate(()=>ASHEN.whenNextGpuFrame());
  const state=await snapshot(page);row.steps.push({label,state});await save();check?.(state);
 }
 async function keyUntil(key,condition){
  await page.keyboard.down(key);
  try{await page.waitForFunction(condition,null,{timeout:7000});}
  finally{await page.keyboard.up(key);}
 }
 async function touchEvent(type,points){await cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points});}
 try{
  await page.goto(url+(touch?'&touch=1':''),{waitUntil:'commit'});
  await page.waitForFunction(()=>globalThis.ASHEN?.playableReady&&ASHEN.creator&&__heldRegionStart,null,{timeout:60000});
  await page.evaluate(()=>{ASHEN.dev.god=true;});
  await step('dressed starting view',shown);
  if(touch){
   const box=await page.locator('.touch-stick').boundingBox();assert(box);
   const point={x:box.x+box.width/2,y:box.y+box.height/2,id:1};
   await touchEvent('touchStart',[point]);await touchEvent('touchMove',[{...point,y:point.y-46}]);
   try{await page.waitForFunction(()=>ASHEN.player.body.position.z>20.05,null,{timeout:7000});}
   finally{await touchEvent('touchEnd',[]);}
   // Actual single-finger world drags; each stays inside the portrait viewport.
   for(let swipe=0;swipe<5&&await page.evaluate(()=>ASHEN.rig.camera.radius>=.5);swipe++){
    await touchEvent('touchStart',[{x:150,y:350,id:2}]);
    for(let i=1;i<=8;i++)await touchEvent('touchMove',[{x:150+i*25,y:350,id:2}]);
    await touchEvent('touchEnd',[]);await page.waitForTimeout(100);
   }
  }else{
   await keyUntil('KeyW',()=>ASHEN.player.body.position.z>20.05);
   // A without RMB turns; it is not a strafe. This is the real failing route.
   await keyUntil('KeyA',()=>ASHEN.rig.camera.radius<.5);
  }
  await step('native close obstruction',hidden);
  await page.screenshot({path:path.join(dir,name+'-close.png')});
  const root=await page.evaluate(()=>{globalThis.__cameraOriginalRoot=ASHEN.body.root;return ASHEN.rig.camera.radius;});
  assert(root<1.4,'Fixture did not reproduce the close camera');
  if(transactions){
   const applied=await page.evaluate(()=>ASHEN.equipment.equip('helmet',null));assert.equal(applied.status,'applied');
   await step('new equipment while hidden',hidden);
   await page.evaluate(()=>ASHEN.creator.identity.set('weathered-bald'));
   await step('identity promotion while hidden',hidden);
   assert.equal(await page.evaluate(()=>ASHEN.body.root===__cameraOriginalRoot),false,'Source replacement was not exercised');
   // A real compatible source is decoded by native Streams and staged by the
   // existing Lite body owner. Reject at promotion to exercise rollback, not
   // a synthetic mesh or alternate loader.
   row.rollback=await page.evaluate(async asset=>{
    const response=await fetch(asset.url),bytes=await new Response(response.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
    const before=ASHEN.body.root,staged=await ASHEN.body.stageSource(bytes);
    try{await staged.commit(()=>{throw Error('Controlled camera visibility rollback');});return {rejected:false};}
    catch(error){return {rejected:true,message:error.message,sameRoot:ASHEN.body.root===before};}
    finally{staged.dispose();}
   },identities.presets['weathered-bald'].manifest.items.body);
   assert(row.rollback.rejected&&row.rollback.sameRoot);await step('source rollback while hidden',hidden);
   for(const race of ['orc','undead','human']){
    await page.evaluate(race=>ASHEN.equipment.switchRace(race),race);
    await step(race+' promotion while hidden',hidden);
   }
  }
  await page.getByRole('button',{name:'Armory',exact:true}).click();
  await page.waitForFunction(()=>ASHEN.armory.isOpen);
  await step('inspection after hidden gameplay',shown);
  await page.screenshot({path:path.join(dir,name+'-inspection.png')});
  await page.evaluate(()=>ASHEN.armory.close());
  await step('inspection close restores obstruction policy',hidden);
  await page.evaluate(()=>ASHEN.setView('reference'));
  assert.equal((await snapshot(page)).rootVisible,false);
  await page.evaluate(()=>ASHEN.setView('play'));await step('view keys cannot reveal close actor',hidden);
  if(!touch){
   await keyUntil('KeyW',()=>ASHEN.rig.characterVisible&&ASHEN.rig.camera.radius>2);
   await step('normal movement clears obstruction',shown);
  }
  await page.evaluate(()=>__releaseRegion());
  await page.waitForFunction(()=>ASHEN.ready&&ASHEN.hostilesReady,null,{timeout:120000});
  await step('full region restores gameplay framing',shown);
  await page.screenshot({path:path.join(dir,name+'-clear.png')});
  row.disposal=await page.evaluate(async()=>{
   ASHEN.dispose();await Promise.all([ASHEN.shadows.gpuRelease,ASHEN.localLights.gpuRelease]);
   ASHEN.body.setVisible(true); // Retired owners must be safe to call.
   return {sweepDetached:ASHEN.rig.collisionSweep===null,gpuErrors:ASHEN.gpu.errors.slice()};
  });
  assert(row.disposal.sweepDetached);assert.deepEqual(row.disposal.gpuErrors,[]);
  await page.keyboard.press('KeyW');await page.waitForTimeout(100);
  assert.deepEqual(row.errors,[]);row.passed=true;
 }catch(error){row.failure=String(error.stack||error);row.failedState=await snapshot(page).catch(()=>null);await save();await page.screenshot({path:path.join(dir,name+'-failed.png')}).catch(()=>{});throw error;}
 finally{
  await save();
  await page.keyboard.up('KeyW').catch(()=>{});await page.keyboard.up('KeyA').catch(()=>{});
  await touchEvent('touchEnd',[]).catch(()=>{});await context.close();
 }
}
try{
 await run('default-keyboard');
 await run('maximum-transactions',{maximum:true,transactions:true});
 await run('portrait-touch',{maximum:true,touch:true});
}finally{
 await browser.close();await fs.writeFile(path.join(dir,'ownership.json'),JSON.stringify({...ownership,active:false,renderingClients:0},null,2));
}
console.log('Three native camera ownership/control cases pass.');
