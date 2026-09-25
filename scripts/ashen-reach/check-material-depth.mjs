/** Live V16 visibility, native materials, data textures, movement and optional motion. */
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {CDP_URL} from '../lib/cdp.mjs';
const record=process.argv.includes('--record'),dir=process.env.ASHEN_CAPTURE_DIR||'ve-capture/ashen-reach/v16/check';
await fs.mkdir(`${dir}/frames`,{recursive:true});
const b=await chromium.connectOverCDP(CDP_URL),c=await b.newContext({viewport:{width:1280,height:720}}),p=await c.newPage(),errors=[],report={errors},frames=[],writes=[];
p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
await p.addInitScript(()=>{window.__gpuErrors=[];const r=GPUAdapter.prototype.requestDevice;GPUAdapter.prototype.requestDevice=async function(...args){const d=await r.apply(this,args);d.addEventListener('uncapturederror',e=>__gpuErrors.push(e.error.message));return d;};});
const wait=()=>p.waitForTimeout(800),label=t=>p.evaluate(t=>document.getElementById('capture-label').textContent=t,t);
const place=async(x,z,yaw=0)=>{await p.evaluate(({x,z,yaw})=>{const a=ASHEN;a.player.setWorldPos(x,a.world.groundHeight(x,z)+1.7,z);a.player.setFacing(yaw);a.rig.yaw=yaw;a.rig.pitch=.14;a.rig.distance=a.rig.distanceTarget=3.8;},{x,z,yaw});await wait();await p.waitForFunction(()=>ASHEN.localLights.state.active.every(s=>s.weight===1));};
let cdp;
try{
 await p.goto(process.env.ASHEN_TEST_URL||'http://127.0.0.1:5173/ashen-reach.html?play&clean',{waitUntil:'commit'});await p.waitForFunction(()=>window.ASHEN?.ready&&ASHEN.hostilesReady,null,{timeout:120000});
 await p.evaluate(()=>{ASHEN.dev.god=true;const d=document.createElement('div');d.id='capture-label';d.style.cssText='position:fixed;top:20px;left:50%;transform:translateX(-50%);background:#101715dd;padding:8px 16px;color:#eadbbe;font:16px Georgia;z-index:100;pointer-events:none';document.body.append(d);});
 await place(0,96);
 report.materials=await p.evaluate(()=>ASHEN.scene.meshes.filter(m=>m.material?._uniformValues?.has('surfaceDetailStrength')).map(m=>m.material.name));assert(report.materials.length>=2);
 const lamp=await p.evaluate(()=>ASHEN.world.localLights.find(l=>l.id==='street-94'));await place(lamp.position[0],94);
 const points=await p.evaluate(l=>{const a=[];for(let x=l.position[0]-2;x<l.position[0]+2;x+=.15)for(let z=92;z<96;z+=.15)a.push([x,ASHEN.world.groundHeight(x,z)+.12,z]);return a;},lamp);
 const probe=()=>p.evaluate(points=>ASHEN.localLights.probe(points),points);
 const blocked=await probe();assert(blocked.every(v=>Number.isFinite(v.specular)&&v.specular>=0));
 await p.evaluate(()=>ASHEN.localLights.state.shadows=false);await wait();const open=await probe();report.specularBlocked=open.filter((v,i)=>v.specular-blocked[i].specular>.0001).length;assert(report.specularBlocked>5,'Real lamp shadows must occlude the shared specular function');
 await p.evaluate(()=>{ASHEN.localLights.state.shadows=true;ASHEN.localLights.state.specular=false;});await wait();assert((await probe()).every(v=>v.specular===0));
 await place(0,102);await p.evaluate(()=>ASHEN.localLights.state.details=false);await label('Diagnostic · Material detail and lantern highlights off');await wait();await p.screenshot({path:`${dir}/off.png`});
 if(record){cdp=await c.newCDPSession(p);cdp.on('Page.screencastFrame',e=>{cdp.send('Page.screencastFrameAck',{sessionId:e.sessionId}).catch(()=>{});const name=`frame-${String(frames.length).padStart(5,'0')}.jpg`;frames.push({name,ts:e.metadata.timestamp});writes.push(fs.writeFile(`${dir}/frames/${name}`,Buffer.from(e.data,'base64')));});await cdp.send('Page.startScreencast',{format:'jpeg',quality:90,maxWidth:1280,maxHeight:720,everyNthFrame:1});}
 await p.waitForTimeout(1500);await p.evaluate(()=>{ASHEN.localLights.state.specular=true;ASHEN.localLights.state.details=true;});await label('Stone relief and roughness · Shadowed metal highlights');await p.waitForTimeout(1800);await p.screenshot({path:`${dir}/on.png`});
 await label('Keyboard movement · Hollowmere materials');const start=await p.evaluate(()=>({x:ASHEN.player.body.position.x,z:ASHEN.player.body.position.z}));await p.keyboard.down('KeyW');await p.waitForTimeout(2200);await p.keyboard.up('KeyW');report.movement=await p.evaluate(s=>Math.hypot(ASHEN.player.body.position.x-s.x,ASHEN.player.body.position.z-s.z),start);assert(report.movement>5&&report.movement<20);
 await label('Camera cut · Returning beneath the lanterns');await place(0,126,Math.PI);await p.keyboard.down('KeyW');await p.waitForTimeout(2500);await p.keyboard.up('KeyW');await wait();await p.screenshot({path:`${dir}/return.png`});
 if(record){await cdp.send('Page.stopScreencast');await Promise.all(writes);const concat=['ffconcat version 1.0'];frames.forEach((f,i)=>concat.push(`file 'frames/${f.name}'`,`duration ${Math.max(.008,(frames[i+1]?.ts??f.ts+1/60)-f.ts)}`));concat.push(`file 'frames/${frames.at(-1).name}'`);await fs.writeFile(`${dir}/frames.ffconcat`,concat.join('\n')+'\n');report.recording={frames:frames.length,seconds:frames.at(-1).ts-frames[0].ts};}
 await p.setViewportSize({width:391,height:843});await wait();await p.screenshot({path:`${dir}/portrait.png`});report.gpuErrors=await p.evaluate(()=>__gpuErrors);assert.deepEqual(errors,[]);assert.deepEqual(report.gpuErrors,[]);report.passed=true;
}catch(e){report.failure=e.stack;throw e;}finally{await fs.writeFile(`${dir}/report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report));await c.close();await b.close();}
