import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {CDP_URL} from '../lib/cdp.mjs';
import {captureSurface,appendFrame,writeCaptureManifest} from '../lib/capture-manifest.mjs';
const dir=process.env.ASHEN_CAPTURE_DIR||'ve-capture/ashen-reach/v26/motion';
await fs.mkdir(dir+'/frames',{recursive:true});
const browser=await chromium.connectOverCDP(CDP_URL),context=await browser.newContext({viewport:{width:1280,height:720}}),page=await context.newPage(),errors=[],report={shots:[],errors};
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
let cdp,manifest,captureError;const writes=[];
const position=()=>page.evaluate(()=>({x:ASHEN.player.body.position.x,y:ASHEN.player.body.position.y,z:ASHEN.player.body.position.z,facing:ASHEN.player.getMotion().facing??ASHEN.player.body.rotation.y,physics:ASHEN.player.getDebugState().usingPhysics,recoveries:ASHEN.player.getDebugState().recoveries}));
async function go(point){
 let state=await position(),distance=Math.hypot(point[0]-state.x,point[2]-state.z),best=distance,lastProgress=Date.now(),start=Date.now();
 while(distance>.42){
  const desired=Math.atan2(point[0]-state.x,point[2]-state.z),error=Math.atan2(Math.sin(desired-state.facing),Math.cos(desired-state.facing));
  if(Math.abs(error)>.045){await page.keyboard.up('KeyW');const key=error>0?'KeyD':'KeyA';await page.keyboard.down(key);await page.waitForTimeout(Math.max(12,Math.min(150,Math.abs(error)/2.55*1000)));await page.keyboard.up(key);}
  else {await page.keyboard.down('KeyW');await page.waitForTimeout(Math.min(150,Math.max(20,(distance-.3)/7*1000)));}
  state=await position();distance=Math.hypot(point[0]-state.x,point[2]-state.z);assert(state.physics);assert(Number.isFinite(state.y));
  if(distance<best-.12){best=distance;lastProgress=Date.now();}
  if(Date.now()-lastProgress>5000||Date.now()-start>45000)throw Error(`Blocked at ${JSON.stringify(state)} toward ${JSON.stringify(point)} (distance ${distance})`);
 }
 await page.keyboard.up('KeyW');return state;
}

try{
 await page.goto(process.env.ASHEN_TEST_URL||'http://127.0.0.1:5173/ashen-reach.html?play&clean',{waitUntil:'commit'});
 await page.waitForFunction(()=>window.ASHEN?.ready&&ASHEN.hostilesReady,null,{timeout:120000});
 await page.evaluate(()=>{ASHEN.dev.god=true;ASHEN.metrics.setInternalResolution(1280,720);});
 manifest={version:1,...await captureSurface(page),frames:[]};cdp=await context.newCDPSession(page);
 cdp.on('Page.screencastFrame',e=>{cdp.send('Page.screencastFrameAck',{sessionId:e.sessionId}).catch(()=>{});if(captureError)return;try{const bytes=Buffer.from(e.data,'base64'),name=`frame-${String(manifest.frames.length).padStart(5,'0')}.jpg`;if(appendFrame(manifest,{name,timestamp:e.metadata.timestamp,bytes})!==false)writes.push(fs.writeFile(`${dir}/frames/${name}`,bytes).catch(e=>captureError=e));}catch(e){captureError=e;}});
 await cdp.send('Page.startScreencast',{format:'jpeg',quality:87,maxWidth:1280,maxHeight:720,everyNthFrame:1});
 const shots=await page.evaluate(()=>{
  const k=ASHEN.world.cathedral,e=k.exploration,y=k.floorY,q=e.chapels[0],t=e.towers[0];
  return [
   {id:'Cliff silhouette (raised camera)',path:[[38,ASHEN.world.groundHeight(38,250),250],[34,ASHEN.world.groundHeight(34,257),257]],distance:18,pitch:-.18,pivot:9,pause:600},
   {id:'Cliff approach',path:[[0,k.route.heightAt(248),248],[0,k.route.heightAt(268),268]],distance:7,pitch:-.24},
   {id:'Recessed portal',path:[[0,y,286],[0,y,310]],distance:4,pitch:-.22},
   {id:'West side chapel',path:[[0,y,328],q.entry,q.interior],distance:3,pitch:-.14},
   {id:'Chapel stair',path:q.stairs.slice(2,4),distance:3,pitch:.10},
   {id:'Upper gallery',path:[q.gallery,[-7,y+8.5,328]],distance:3,pitch:-.10},
   {id:'Bell tower stairs',path:t.route.slice(20,23),distance:2.4,pitch:.12},
   {id:'Bell landing',path:[t.route.at(-1),t.landing],distance:2.4,pitch:-.14,pause:900},
   {id:'Exterior parapet',path:[q.parapet,[-27,y+8.5,356]],distance:4,pitch:-.12,pause:400},
  ];
 });
 for(const shot of shots){
  const first=shot.path[0],next=shot.path[1],yaw=Math.atan2(next[0]-first[0],next[2]-first[2]);
  await page.evaluate(({shot,first,yaw})=>{const a=ASHEN;a.player.setFlying(false);a.player.setWorldPos(first[0],first[1]+1.7,first[2]);a.player.setFacing(yaw);a.rig.yaw=yaw;a.rig.pitch=shot.pitch;a.rig.pivotHeight=shot.pivot||.55;a.rig.distance=a.rig.distanceTarget=shot.distance;
   let label=document.getElementById('cathedral-review');if(!label){label=document.createElement('div');label.id='cathedral-review';Object.assign(label.style,{position:'fixed',top:'12px',left:'100px',color:'white',background:'#000a',padding:'6px',zIndex:999});document.body.append(label);}label.textContent=`Vaelmark route excerpts — ${shot.id}`;
  },{shot,first,yaw});
  await page.waitForTimeout(450);const before=await position();for(const point of shot.path.slice(1))await go(point);await page.waitForTimeout(shot.pause||150);const after=await position();assert.equal(after.recoveries,before.recoveries);report.shots.push({id:shot.id,before,after});
 }
 await cdp.send('Page.stopScreencast');cdp.removeAllListeners('Page.screencastFrame');await Promise.all(writes);if(captureError)throw captureError;
 await writeCaptureManifest(dir,manifest,await captureSurface(page));assert.deepEqual(errors,[]);report.passed=true;
}finally{await page.keyboard.up('KeyW').catch(()=>{});if(cdp)await cdp.send('Page.stopScreencast').catch(()=>{});await Promise.all(writes);await fs.writeFile(dir+'/report.json',JSON.stringify(report,null,2));await context.close();await browser.close();}
