/** Continuous real startup and keyboard movement; recording is not a FPS/load benchmark. */
import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {CDP_URL} from '../lib/cdp.mjs';
import {appendFrame,captureSurface,writeCaptureManifest} from '../lib/capture-manifest.mjs';
const dir=process.env.ASHEN_CAPTURE_DIR||'ve-capture/ashen-reach/startup-2026-09-27/motion';
const url=process.env.ASHEN_TEST_URL||'http://127.0.0.1:7074/?play&clean&pixelRatio=1';
await fs.mkdir(`${dir}/frames`,{recursive:true});
const browser=await chromium.connectOverCDP(CDP_URL),context=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1}),page=await context.newPage(),cdp=await context.newCDPSession(page),errors=[],writes=[];
let manifest,error;
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
cdp.on('Page.screencastFrame',frame=>{
 void cdp.send('Page.screencastFrameAck',{sessionId:frame.sessionId}).catch(()=>{});
 if(error||!manifest)return;
 try{const bytes=Buffer.from(frame.data,'base64'),name=`frame-${String(manifest.frames.length).padStart(5,'0')}.jpg`;
  if(appendFrame(manifest,{name,timestamp:frame.metadata.timestamp,bytes})!==false)writes.push(fs.writeFile(`${dir}/frames/${name}`,bytes).catch(e=>{error=e;}));
 }catch(e){error=e;}
});
try{
 await cdp.send('Network.enable');await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:40,downloadThroughput:50e6/8,uploadThroughput:10e6/8});
 await page.goto(url,{waitUntil:'commit'});
 await page.waitForFunction(()=>{const c=document.querySelector('canvas');return c?.width===1280&&c?.height===720;});
 manifest={version:1,...await captureSurface(page),frames:[],purpose:'Continuous startup/upgrade visual review; recording affects timing'};
 await cdp.send('Page.startScreencast',{format:'jpeg',quality:90,maxWidth:1280,maxHeight:720,everyNthFrame:1});
 await page.waitForFunction(()=>globalThis.ASHEN?.playableReady,null,{timeout:30000});
 const start=await page.evaluate(()=>({x:ASHEN.player.body.position.x,z:ASHEN.player.body.position.z,recoveries:ASHEN.player.getDebugState().recoveries}));
 // Keep combat damage from interrupting this controlled movement check.
 await page.evaluate(()=>{ASHEN.dev.god=true;});
 await page.screenshot({path:`${dir}/playable.png`});
 await page.keyboard.down('KeyW');
 await page.waitForFunction(()=>ASHEN.ready,null,{timeout:90000});
 await page.evaluate(()=>{ASHEN.dev.god=true;});
 await page.waitForTimeout(5500);await page.keyboard.up('KeyW');
 await page.mouse.move(880,330);await page.mouse.down({button:'right'});await page.mouse.move(720,350,{steps:24});await page.mouse.up({button:'right'});
 await page.waitForTimeout(1000);await page.screenshot({path:`${dir}/complete.png`});
 const report=await page.evaluate(start=>({start,end:{x:ASHEN.player.body.position.x,z:ASHEN.player.body.position.z},recoveries:ASHEN.player.getDebugState().recoveries,physics:ASHEN.player.getDebugState().usingPhysics,marks:ASHEN.startup.timings(),streaming:ASHEN.world.streaming,enemies:ASHEN.combat.enemies.length,foliage:ASHEN.world.stats.foliageInstances,recording:true}),start);
 assert(report.physics);assert.equal(report.recoveries,start.recoveries);assert(report.end.z>25);assert.equal(report.enemies,7);assert.deepEqual(errors,[]);
 await cdp.send('Page.stopScreencast');await Promise.all(writes);if(error)throw error;
 await writeCaptureManifest(dir,manifest,await captureSurface(page));await fs.writeFile(`${dir}/report.json`,JSON.stringify({...report,errors},null,2));console.log(JSON.stringify(report));
}finally{await page.keyboard.up('KeyW').catch(()=>{});await cdp.send('Page.stopScreencast').catch(()=>{});await Promise.all(writes);await context.close();await browser.close();}
