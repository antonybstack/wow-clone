import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {CDP_URL} from '../lib/cdp.mjs';
import {appendFrame, captureSurface, writeCaptureManifest} from '../lib/capture-manifest.mjs';
const baseline=process.argv.includes('--baseline'),record=process.argv.includes('--record');
const dir=process.env.ASHEN_CAPTURE_DIR||'ve-capture/ashen-reach/gothic-world/exploration';
await fs.mkdir(`${dir}/frames`,{recursive:true});
const viewport={width:Number(process.env.ASHEN_CAPTURE_WIDTH||1280),height:Number(process.env.ASHEN_CAPTURE_HEIGHT||720)};
assert(Object.values(viewport).every(n=>Number.isInteger(n)&&n>0&&n%2===0),'Capture viewport must use positive even dimensions');
const b=await chromium.connectOverCDP(CDP_URL),c=await b.newContext({viewport}),p=await c.newPage();
const errors=[],frames=[],writes=[],report={baseline,errors};let cdp,manifest,captureError;
p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
await p.addInitScript(()=>{window.__gpuErrors=[];const f=GPUAdapter.prototype.requestDevice;GPUAdapter.prototype.requestDevice=async function(...args){const d=await f.apply(this,args);d.addEventListener('uncapturederror',e=>__gpuErrors.push(e.error.message));return d;};});
try{
 await p.goto(process.env.ASHEN_TEST_URL||'http://127.0.0.1:5173/ashen-reach.html?play&clean');await p.waitForFunction(()=>window.ASHEN?.ready&&ASHEN.hostilesReady,null,{timeout:120000});
 await p.evaluate(()=>{const a=ASHEN;a.dev.god=true;a.player.setFlying(false);a.player.setWorldPos(0,a.world.groundHeight(0,142)+1.7,142);a.player.setFacing(0);a.rig.yaw=0;a.rig.pitch=-.08;a.rig.distance=a.rig.distanceTarget=2.5;});
 await p.waitForTimeout(700);await p.screenshot({path:`${dir}/approach.png`});
 if(record){manifest={version:1,...await captureSurface(p),frames};cdp=await c.newCDPSession(p);cdp.on('Page.screencastFrame',e=>{cdp.send('Page.screencastFrameAck',{sessionId:e.sessionId}).catch(()=>{});if(captureError)return;try{const name=`frame-${String(frames.length).padStart(5,'0')}.jpg`,bytes=Buffer.from(e.data,'base64');if(!appendFrame(manifest,{name,timestamp:e.metadata.timestamp,bytes}))return;writes.push(fs.writeFile(`${dir}/frames/${name}`,bytes).catch(error=>{captureError||=error;}));}catch(error){captureError=error;}});await cdp.send('Page.startScreencast',{format:'jpeg',quality:90,maxWidth:viewport.width,maxHeight:viewport.height,everyNthFrame:1});}
 const samples=[],views=[225,280,298,315];await p.keyboard.down('KeyW');
 for(let i=0;i<(baseline?15:185);i++){await p.waitForTimeout(200);const s=await p.evaluate(()=>({x:ASHEN.player.body.position.x,y:ASHEN.player.body.position.y,z:ASHEN.player.body.position.z,physics:ASHEN.player.getDebugState().usingPhysics,state:ASHEN.player.getDebugState()}));samples.push(s);if(!baseline&&views.length&&s.z>=views[0]){await p.keyboard.up('KeyW');const view=views.shift();if(!record)await p.screenshot({path:`${dir}/route-${view}.png`});await p.keyboard.down('KeyW');}if(!baseline&&s.z>344)break;}
 await p.keyboard.up('KeyW');report.samples=samples;
 if(!record)await p.screenshot({path:`${dir}/destination.png`});
 if(baseline)assert(samples.at(-1).z<=143.01,'Reproduce old clamp');
 else{assert(samples.at(-1).z>344,'Reach cathedral nave on foot');assert(samples.every(s=>Number.isFinite(s.y)&&s.physics));assert.equal(samples.at(-1).state.recoveries,samples[0].state.recoveries,'No fall recovery disguising route failure');assert(samples.some(s=>s.z>145));await p.evaluate(()=>{ASHEN.rig.yaw=Math.PI;ASHEN.rig.pitch=-.28;ASHEN.rig.distance=ASHEN.rig.distanceTarget=4;});await p.waitForTimeout(700);if(!record)await p.screenshot({path:`${dir}/nave-return.png`});await p.keyboard.down('KeyS');for(let i=0;i<100;i++){await p.waitForTimeout(200);if(await p.evaluate(()=>ASHEN.player.body.position.z)<298)break;}await p.keyboard.up('KeyS');report.returnZ=await p.evaluate(()=>ASHEN.player.body.position.z);assert(report.returnZ<298,'Exit the nave back into courtyard');if(!record)await p.screenshot({path:`${dir}/courtyard-return.png`});}
 if(record){await cdp.send('Page.stopScreencast');cdp.removeAllListeners('Page.screencastFrame');await Promise.all(writes);if(captureError)throw captureError;await writeCaptureManifest(dir,manifest,await captureSurface(p));report.recording={frames:frames.length,seconds:manifest.elapsedSeconds,manifest:'capture-manifest.json'};}
 report.sky=await p.evaluate(()=>{const a=ASHEN,m=a.scene.meshes.find(m=>m.name==='AshenSky'),w=a.scene.camera.worldMatrix;return {offset:Math.hypot(m.position.x-w[12],m.position.y-w[13],m.position.z-w[14]),radius:m.scaling.x,far:a.scene.camera.farPlane};});
 assert(report.sky.offset<1&&report.sky.radius+report.sky.offset<report.sky.far,'Sky follows camera inside far plane');
 report.gpuErrors=await p.evaluate(()=>__gpuErrors);assert.deepEqual(errors,[]);assert.deepEqual(report.gpuErrors,[]);report.passed=true;
}catch(e){report.failure=e.stack;throw e;}finally{if(cdp){await cdp.send('Page.stopScreencast').catch(()=>{});cdp.removeAllListeners('Page.screencastFrame');}await Promise.all(writes);await p.keyboard.up('KeyW').catch(()=>{});await p.keyboard.up('KeyS').catch(()=>{});await fs.writeFile(`${dir}/report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify({...report,samples:report.samples?.length}));await c.close();await b.close();}
