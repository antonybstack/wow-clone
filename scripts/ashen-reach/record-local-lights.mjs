/** Actual keyboard traversal. Diagnostic shadow toggle/camera cuts are labeled. */
import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {CDP_URL} from '../lib/cdp.mjs';
const street=process.argv.includes('--street');
const dir=process.env.ASHEN_CAPTURE_DIR||(street?'ve-capture/ashen-reach/street-lights/video':'ve-capture/ashen-reach/local-lights/video');await fs.mkdir(`${dir}/frames`,{recursive:true});
const browser=await chromium.connectOverCDP(CDP_URL),context=await browser.newContext({viewport:{width:1280,height:720}}),page=await context.newPage();
const frames=[],writes=[],errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
await page.addInitScript(()=>{window.__gpuErrors=[];const f=GPUAdapter.prototype.requestDevice;GPUAdapter.prototype.requestDevice=async function(...a){const d=await f.apply(this,a);d.addEventListener('uncapturederror',e=>__gpuErrors.push(e.error.message));return d;};});
const cdp=await context.newCDPSession(page);cdp.on('Page.screencastFrame',e=>{cdp.send('Page.screencastFrameAck',{sessionId:e.sessionId}).catch(()=>{});const name=`frame-${String(frames.length).padStart(5,'0')}.jpg`;frames.push({name,ts:e.metadata.timestamp});writes.push(fs.writeFile(`${dir}/frames/${name}`,Buffer.from(e.data,'base64')));});
const label=t=>page.evaluate(t=>document.getElementById('capture-label').textContent=t,t);
async function place(x,z,yaw=0){await page.evaluate(({x,z,yaw})=>{const a=ASHEN;a.player.setWorldPos(x,a.world.groundHeight(x,z)+1.7,z);a.player.setFacing(yaw);a.rig.yaw=yaw;a.rig.pitch=.22;a.rig.distance=a.rig.distanceTarget=4.5;},{x,z,yaw});await page.waitForTimeout(800);}
async function walk(ms){const p=await page.evaluate(()=>({x:ASHEN.player.body.position.x,z:ASHEN.player.body.position.z}));await page.keyboard.down('KeyW');await page.waitForTimeout(ms);await page.keyboard.up('KeyW');return page.evaluate(p=>Math.hypot(ASHEN.player.body.position.x-p.x,ASHEN.player.body.position.z-p.z),p);}
try{
 await page.goto(process.env.ASHEN_TEST_URL||'http://127.0.0.1:5173/ashen-reach.html?play&clean&noEnemies',{waitUntil:'commit'});await page.waitForFunction(()=>window.ASHEN?.ready,null,{timeout:90000});
 await page.evaluate(()=>{ASHEN.dev.god=true;const d=document.createElement('div');d.id='capture-label';d.style.cssText='position:fixed;top:22px;left:50%;transform:translateX(-50%);padding:8px 15px;background:#101715dd;color:#e0d3b8;font:16px Georgia;z-index:100;pointer-events:none';document.body.append(d);});
 let gateMovement,lampMovement,streetMovement;
 if(street){
 await place(0,102);await page.evaluate(()=>ASHEN.localLights.state.shadows=false);await label('V15 · Main street · Lamp shadows off');
 await cdp.send('Page.startScreencast',{format:'jpeg',quality:90,maxWidth:1280,maxHeight:720,everyNthFrame:1});await page.waitForTimeout(1600);
 await page.evaluate(()=>ASHEN.localLights.state.shadows=true);await label('Lamp shadows on · Shared surfaces and mist');await page.waitForTimeout(1900);
 await label('Keyboard traversal · Hollowmere lanterns');gateMovement=await walk(2600);await page.waitForTimeout(600);
 await label('Camera cut · Returning along the street');await place(0,126,Math.PI);lampMovement=await walk(1500);await page.waitForTimeout(700);
 await label('Continuous movement · Two cached shadow maps');streetMovement=await walk(1500);await page.waitForTimeout(800);
 }else{
 await place(0,41);await page.evaluate(()=>ASHEN.localLights.state.shadows=false);await label('V14 · Diagnostic comparison · Lamp shadows off');
 await cdp.send('Page.startScreencast',{format:'jpeg',quality:90,maxWidth:1280,maxHeight:720,everyNthFrame:1});await page.waitForTimeout(1800);
 await page.evaluate(()=>ASHEN.localLights.state.shadows=true);await label('Lamp shadows on · Timber blocks the pool and the mist');await page.waitForTimeout(2200);
 await label('Keyboard traversal · Shared actor and fog shadows');gateMovement=await walk(2000);await page.waitForTimeout(600);
 await label('Camera cut · Passing beneath the street lantern');await place(-1.3,50,.05);lampMovement=await walk(1000);await page.waitForTimeout(700);
 await page.keyboard.down('KeyD');await page.waitForTimeout(900);await page.keyboard.up('KeyD');await page.waitForTimeout(900);
 await label('Camera cut · Two shadow slots across three fixtures');await place(.5,53,0);streetMovement=await walk(1500);await page.waitForTimeout(1000);
 }
 await cdp.send('Page.stopScreencast');await Promise.all(writes);
 const concat=['ffconcat version 1.0'];frames.forEach((f,i)=>concat.push(`file 'frames/${f.name}'`,`duration ${Math.max(.008,(frames[i+1]?.ts??f.ts+1/60)-f.ts)}`));concat.push(`file 'frames/${frames.at(-1).name}'`);await fs.writeFile(`${dir}/frames.ffconcat`,concat.join('\n')+'\n');
 const report={gateMovement,lampMovement,streetMovement,frames:frames.length,seconds:frames.at(-1).ts-frames[0].ts,errors,runtime:await page.evaluate(()=>({gpuErrors:__gpuErrors,canvas:[ASHEN.engine.canvas.width,ASHEN.engine.canvas.height],local:ASHEN.localLights.state}))};
 await fs.writeFile(`${dir}/report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report));assert(gateMovement>5&&lampMovement>3&&streetMovement>5);assert.deepEqual(errors,[]);assert.deepEqual(report.runtime.gpuErrors,[]);
}finally{await page.keyboard.up('KeyW').catch(()=>{});await page.keyboard.up('KeyD').catch(()=>{});await context.close();await browser.close();}
