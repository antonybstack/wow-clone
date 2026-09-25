import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {CDP_URL} from '../lib/cdp.mjs';
import {captureSurface,appendFrame,writeCaptureManifest} from '../lib/capture-manifest.mjs';
const dir=process.env.ASHEN_CAPTURE_DIR||'ve-capture/ashen-reach/v25/motion';
await fs.mkdir(dir+'/frames',{recursive:true});
const browser=await chromium.connectOverCDP(CDP_URL),context=await browser.newContext({viewport:{width:1280,height:720}}),page=await context.newPage(),errors=[],report={shots:[],errors};
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
let cdp,manifest,captureError;const writes=[];
try{
 await page.goto(process.env.ASHEN_TEST_URL||'http://127.0.0.1:5173/ashen-reach.html?play&clean',{waitUntil:'commit'});
 await page.waitForFunction(()=>window.ASHEN?.ready&&ASHEN.hostilesReady,null,{timeout:120000});
 await page.evaluate(()=>{ASHEN.dev.god=true;ASHEN.metrics.setInternalResolution(1280,720);});
 manifest={version:1,...await captureSurface(page),frames:[]};cdp=await context.newCDPSession(page);
 cdp.on('Page.screencastFrame',e=>{cdp.send('Page.screencastFrameAck',{sessionId:e.sessionId}).catch(()=>{});if(captureError)return;try{const bytes=Buffer.from(e.data,'base64'),name=`frame-${String(manifest.frames.length).padStart(5,'0')}.jpg`;if(appendFrame(manifest,{name,timestamp:e.metadata.timestamp,bytes})!==false)writes.push(fs.writeFile(`${dir}/frames/${name}`,bytes).catch(e=>captureError=e));}catch(e){captureError=e;}});
 await cdp.send('Page.startScreencast',{format:'jpeg',quality:87,maxWidth:1280,maxHeight:720,everyNthFrame:1});
 for(const id of ['east-keep','west-keep','south-keep','east-tower','west-tower','north-tower','hollowmere-chapel','boundary']){
  await page.evaluate(id=>{const a=ASHEN,l=a.world.landmarks.find(l=>l.id===id);let x,z,y,yaw;
   if(l){yaw=l.yaw||0;const distance=l.kind==='keep'?12:l.kind==='chapel'?0:7;
    if(l.kind==='chapel'){x=.5;z=114;y=a.world.groundHeight(x,z);yaw=Math.PI/2;}
    else{x=l.entrance[0]-Math.sin(yaw)*distance;z=l.entrance[2]-Math.cos(yaw)*distance;y=l.floorY;}
   }else{x=a.world.regionWorld.bounds.maxX-38;z=0;y=a.world.groundHeight(x,z);yaw=Math.PI/2;}
   a.player.setFlying(false);a.player.setWorldPos(x,y+1.7,z);a.player.setFacing(yaw);a.rig.yaw=yaw;a.rig.pitch=-.16;a.rig.distance=a.rig.distanceTarget=4;
   let label=document.getElementById('region-review');if(!label){label=document.createElement('div');label.id='region-review';Object.assign(label.style,{position:'fixed',top:'12px',left:'100px',color:'white',background:'#000a',padding:'6px',zIndex:999});document.body.append(label);}label.textContent=`Route excerpts — ${l?.name||'finite cliff boundary'}`;
  },id);
  await page.waitForTimeout(600);const before=await page.evaluate(()=>({x:ASHEN.player.body.position.x,z:ASHEN.player.body.position.z,recoveries:ASHEN.player.getDebugState().recoveries}));
  await page.keyboard.down('KeyW');await page.waitForTimeout(id.includes('keep')?4700:id==='boundary'?2800:id==='hollowmere-chapel'?900:1600);await page.keyboard.up('KeyW');
  await page.waitForTimeout(250);const after=await page.evaluate(()=>({x:ASHEN.player.body.position.x,z:ASHEN.player.body.position.z,debug:ASHEN.player.getDebugState()}));
  assert(after.debug.usingPhysics);assert.equal(after.debug.recoveries,before.recoveries);assert(Math.hypot(after.x-before.x,after.z-before.z)>2);report.shots.push({id,before,after});
 }
 await cdp.send('Page.stopScreencast');cdp.removeAllListeners('Page.screencastFrame');await Promise.all(writes);if(captureError)throw captureError;
 await writeCaptureManifest(dir,manifest,await captureSurface(page));assert.deepEqual(errors,[]);report.passed=true;
}finally{await page.keyboard.up('KeyW').catch(()=>{});if(cdp)await cdp.send('Page.stopScreencast').catch(()=>{});await Promise.all(writes);await fs.writeFile(dir+'/report.json',JSON.stringify(report,null,2));await context.close();await browser.close();}
