/** Developer crowd proof in the real region. Reuses exactly one audited owned
 * game page; captures elapsed time and dimensions with the shared recorder.
 * https://chromedevtools.github.io/devtools-protocol/tot/Page/#method-startScreencast
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {appendFrame,captureSurface,writeCaptureManifest} from '../lib/capture-manifest.mjs';
const port=Number(process.env.ASHEN_CDP_PORT),url=process.env.ASHEN_TEST_URL;
assert(port&&url,'Use an audited owned CDP port and local game URL');
const dir=process.env.ASHEN_CAPTURE_DIR||'ve-capture/character-mmo/crowd-region-2026-09-30';
await fs.mkdir(path.join(dir,'frames'),{recursive:true});
const browser=await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
const pages=browser.contexts().flatMap(c=>c.pages());
const games=[];
for(const page of pages)if(await page.evaluate(()=>Boolean(globalThis.ASHEN?.scene)).catch(()=>false))games.push(page);
assert.equal(games.length,1,'Expected one active owned game page');
const page=games[0];assert(page.url().startsWith(new URL(url).origin),'Owned game origin differs');
const cdp=await page.context().newCDPSession(page),writes=[],timeline=[],errors=[];
let recording=false,manifest;
page.on('pageerror',e=>errors.push(e.stack));
page.on('console',m=>{if(m.type()==='error'||/validation.*error/i.test(m.text()))errors.push(m.text());});
cdp.on('Page.screencastFrame',event=>{
 void cdp.send('Page.screencastFrameAck',{sessionId:event.sessionId}).catch(()=>{});
 if(!recording)return;
 try{
  const name=`frame-${String(manifest.frames.length).padStart(6,'0')}.jpg`,bytes=Buffer.from(event.data,'base64');
  appendFrame(manifest,{name,timestamp:event.metadata.timestamp,bytes});
  writes.push(fs.writeFile(path.join(dir,'frames',name),bytes));
 }catch(error){errors.push(error.stack);recording=false;}
});
async function place(z,pitch=.2,distance=5){
 await page.evaluate(({z,pitch,distance})=>{const a=ASHEN;a.player.setFlying(false);a.player.setWorldPos(-1,a.world.groundHeight(-1,z)+1.7,z);a.player.setFacing(0);a.rig.yaw=0;a.rig.pitch=pitch;a.rig.distance=a.rig.distanceTarget=distance;},{z,pitch,distance});
}
async function mark(label){
 timeline.push({label,timestamp:manifest.frames.at(-1)?.timestamp??null,state:await page.evaluate(()=>({meshes:ASHEN.scene.meshes.length,casters:ASHEN.shadows.state.dynamicCasters,physics:ASHEN.player.getDebugState().usingPhysics,vat:ASHEN.scene.meshes.filter(m=>m.vat).map(m=>({name:m.name,count:m.thinInstances.count}))}))});
 await page.evaluate(label=>{let tag=document.getElementById('crowd-proof-label');if(!tag){tag=document.createElement('div');tag.id='crowd-proof-label';tag.style.cssText='position:fixed;top:74px;left:12px;padding:8px 12px;background:#151515dd;color:#eedda0;font:13px monospace;pointer-events:none;z-index:999';document.body.append(tag);}tag.textContent=`Developer proof · ${label}`;},label);
}
async function mount(options){
 await page.evaluate(async options=>{globalThis.TOWN_CROWD?.dispose();const {mountTownCrowd}=await import('/src/character/crowd-probe/town.js');globalThis.TOWN_CROWD=await mountTownCrowd(ASHEN,options);},options);
}
try{
 await page.goto(url);await page.setViewportSize({width:1280,height:720});
 await page.waitForFunction(()=>ASHEN?.ready&&ASHEN.hostilesReady,null,{timeout:90000});
 await page.evaluate(()=>{ASHEN.metrics.setInternalResolution(1280,720);ASHEN.dev.god=true;ASHEN.setView('play');});
 await place(62);await mount({count:1,centerZ:68,motion:'walk'});await page.waitForTimeout(1200);
 const surface=await captureSurface(page);assert.deepEqual(surface.viewport,{width:1280,height:720});
 assert.equal(surface.canvas.width,1280);assert.equal(surface.canvas.height,720);
 manifest={schemaVersion:1,sourceUrl:url,...surface,frames:[],timeline,errors};
 recording=true;await cdp.send('Page.startScreencast',{format:'jpeg',quality:86,maxWidth:1280,maxHeight:720,everyNthFrame:2});
 await mark('one Wayfarer walking, unchanged sun shadows');await page.waitForTimeout(3300);
 await page.evaluate(()=>{ASHEN.rig.yaw=.5;});await page.waitForTimeout(1500);
 await place(57,.25,5);await mount({count:10,outfit:'warden',motion:'idle',centerZ:70});
 await mark('ten Warden actors idle, all dressed primitives');await page.waitForTimeout(3800);
 await place(37,.3,7);await mount({count:100,centerZ:62});
 await mark('100 Wayfarers walking: correctness smoke, not a capacity claim');await page.waitForTimeout(4000);
 await page.keyboard.down('KeyW');await page.waitForTimeout(1800);await page.keyboard.up('KeyW');
 await page.evaluate(()=>{TOWN_CROWD.dispose();TOWN_CROWD.dispose();});await page.waitForTimeout(700);
 await mark('cohort removed; normal Havok movement');
 const before=await page.evaluate(()=>({x:ASHEN.player.body.position.x,z:ASHEN.player.body.position.z,recoveries:ASHEN.player.getDebugState().recoveries}));
 await page.keyboard.down('KeyW');await page.waitForTimeout(2500);await page.keyboard.up('KeyW');
 const after=await page.evaluate(()=>({x:ASHEN.player.body.position.x,z:ASHEN.player.body.position.z,recoveries:ASHEN.player.getDebugState().recoveries,physics:ASHEN.player.getDebugState().usingPhysics,vat:ASHEN.scene.meshes.filter(m=>m.vat).length,gpuErrors:ASHEN.gpu.errors}));
 assert(after.physics);assert.equal(after.recoveries,before.recoveries);assert.equal(after.vat,0);assert(Math.hypot(after.x-before.x,after.z-before.z)>3);assert.deepEqual(after.gpuErrors,[]);
 manifest.movement={before,after};
 recording=false;await cdp.send('Page.stopScreencast');await Promise.all(writes);
 assert.deepEqual(errors,[]);await writeCaptureManifest(dir,manifest,await captureSurface(page));
 console.log(JSON.stringify({dir,frames:manifest.frames.length,seconds:manifest.elapsedSeconds,movement:manifest.movement,errors}));
}finally{
 recording=false;await page.keyboard.up('KeyW').catch(()=>{});await cdp.send('Page.stopScreencast').catch(()=>{});await Promise.allSettled(writes);
 await page.evaluate(()=>{globalThis.TOWN_CROWD?.dispose();document.getElementById('crowd-proof-label')?.remove();}).catch(()=>{});
 await cdp.detach().catch(()=>{});await browser.close();
}
