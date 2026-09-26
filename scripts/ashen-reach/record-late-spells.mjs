/** Reviewed first-use Pyre, Fire Blast and Lava Ball live motion. */
import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import {captureSurface,appendFrame,writeCaptureManifest} from '../lib/capture-manifest.mjs';
import {CDP_URL} from '../lib/cdp.mjs';

const dir=process.env.ASHEN_CAPTURE_DIR||'ve-capture/ashen-reach/lite1311/f6-motion';
const url=process.env.ASHEN_TEST_URL||'http://127.0.0.1:5173/ashen-reach.html?play&clean';
await fs.mkdir(`${dir}/frames`,{recursive:true});
const browser=await chromium.connectOverCDP(CDP_URL);
const context=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1});
const page=await context.newPage(),errors=[],writes=[],timeline=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
let cdp,captureError;
try{
 await page.goto(url,{waitUntil:'commit'});
 await page.waitForFunction(()=>window.ASHEN?.ready&&ASHEN.hostilesReady,null,{timeout:120000});
 await page.evaluate(()=>{
  const a=ASHEN,d=a.combat.dummy.position,z=d.z-2.6;
  a.setView('play');a.player.setWorldPos(d.x,a.world.groundHeight(d.x,z)+a.player.capsuleHeight*.5,z);
  a.player.setFacing(0);a.rig.yaw=.6;a.rig.pitch=.25;a.rig.distance=a.rig.distanceTarget=6;
 });
 await page.waitForFunction(()=>ASHEN.player.getGrounded(),null,{timeout:8000});
 const manifest={version:1,...await captureSurface(page),frames:[]};
 cdp=await context.newCDPSession(page);
 cdp.on('Page.screencastFrame',event=>{
  void cdp.send('Page.screencastFrameAck',{sessionId:event.sessionId}).catch(()=>{});
  if(captureError)return;
  try{
   const name=`frame-${String(manifest.frames.length).padStart(5,'0')}.jpg`,bytes=Buffer.from(event.data,'base64');
   appendFrame(manifest,{name,timestamp:event.metadata.timestamp,bytes});
   writes.push(fs.writeFile(`${dir}/frames/${name}`,bytes).catch(e=>{captureError=e;}));
  }catch(e){captureError=e;}
 });
 const start=Date.now(),mark=name=>timeline.push({name,seconds:(Date.now()-start)/1000});
 await cdp.send('Page.startScreencast',{format:'jpeg',quality:88,maxWidth:1280,maxHeight:720,everyNthFrame:1});
 mark('First Pyre Burst');await page.keyboard.press('Digit3');await page.waitForTimeout(2200);
 mark('Fire Blast');await page.keyboard.press('Tab');await page.keyboard.press('Digit1');await page.waitForTimeout(1800);
 mark('Lava Ball');await page.keyboard.press('Digit2');await page.waitForTimeout(3100);
 mark('Movement');await page.keyboard.down('KeyW');await page.waitForTimeout(1500);await page.keyboard.up('KeyW');
 await cdp.send('Page.stopScreencast');await Promise.all(writes);
 if(captureError)throw captureError;
 await writeCaptureManifest(dir,manifest,await captureSurface(page));
 const casts=await page.evaluate(()=>({pyre:ASHEN.combat.pulse.casts,fire:ASHEN.combat.spell.casts,lava:ASHEN.combat.lava.casts}));
 const report={url,timeline,casts,frames:manifest.frames.length,elapsedSeconds:manifest.elapsedSeconds,errors};
 await fs.writeFile(`${dir}/report.json`,JSON.stringify(report,null,2));
 if(Object.values(casts).some(n=>n<1)||errors.length)throw Error(`Live spell recording failed: ${JSON.stringify(report)}`);
 console.log(JSON.stringify(report));
}finally{
 await page.keyboard.up('KeyW').catch(()=>{});
 await cdp?.detach().catch(()=>{});
 await context.close();await browser.close();
}
