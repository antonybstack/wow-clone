/** Live GPU regression for V14; no screenshot-only or CPU-only acceptance. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium} from 'playwright';
import sharp from 'sharp';
import {CDP_URL} from '../lib/cdp.mjs';
import {fogPixels as readFogPixels} from '../lib/fog-pixels.mjs';
const dir='ve-capture/ashen-reach/local-lights/check';await fs.mkdir(dir,{recursive:true});
const url=process.env.ASHEN_TEST_URL||'http://127.0.0.1:5173/ashen-reach.html?play&clean';
const browser=await chromium.connectOverCDP(CDP_URL),context=await browser.newContext({viewport:{width:1280,height:720}}),page=await context.newPage();
const errors=[],report={requestedUrl:url,visitedUrl:null,errors};page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
await page.addInitScript(()=>{window.__gpuErrors=[];const f=GPUAdapter.prototype.requestDevice;GPUAdapter.prototype.requestDevice=async function(...a){const d=await f.apply(this,a);d.addEventListener('uncapturederror',e=>__gpuErrors.push(e.error.message));return d;};});
const wait=()=>page.waitForTimeout(700);
const place=async(x,z,yaw=0)=>{await page.evaluate(({x,z,yaw})=>{const a=ASHEN;a.player.setWorldPos(x,a.world.groundHeight(x,z)+1.7,z);a.player.setFacing(yaw);a.rig.yaw=yaw;a.rig.pitch=.12;a.rig.distance=a.rig.distanceTarget=5;},{x,z,yaw});await wait();};
const capture=async name=>{const png=await page.screenshot({path:`${dir}/${name}.png`});const s=await sharp(png).extract({left:Math.floor((await page.viewportSize()).width*.25),top:220,width:150,height:120}).stats();assert(s.channels.slice(0,3).some(c=>c.mean>12),`${name}: black world`);};
const probe=()=>page.evaluate(async()=>{const a=ASHEN,points=[];for(let z=40;z<=48;z+=.2)for(let x=-3;x<=3;x+=.2)points.push([x,a.world.groundHeight(x,z)+.10,z]);return a.localLights.probe(points);});
const fogPixels=()=>readFogPixels(page);
try{
 await page.goto(url,{waitUntil:'commit'});report.visitedUrl=page.url();await page.waitForFunction(()=>window.ASHEN?.ready&&ASHEN.hostilesReady,null,{timeout:120000});await page.evaluate(()=>ASHEN.dev.god=true);
 await place(0,42);await capture('gate');
 const withActor=await probe();await page.evaluate(()=>ASHEN.localLights.state.characters=false);await wait();const worldOnly=await probe();
 report.actorShadowSamples=withActor.filter((p,i)=>worldOnly[i].visibility[0]-p.visibility[0]>.4).length;assert(report.actorShadowSamples>5,'Animated player must cast a local shadow');
 const shadowedFog=await fogPixels();assert(shadowedFog.every(Number.isFinite));
 await page.evaluate(()=>ASHEN.localLights.state.shadows=false);await wait();const noShadows=await probe();
 report.staticShadowSamples=worldOnly.filter((p,i)=>noShadows[i].irradiance>.15&&noShadows[i].irradiance-p.irradiance>.15).length;assert(report.staticShadowSamples>10,'Gate timbers must occlude surface light');
 const openFog=await fogPixels();report.fogShadowSamples=openFog.filter((v,i)=>v-shadowedFog[i]>.002).length;assert(report.fogShadowSamples>10,'Gate timbers must also occlude integrated fog radiance');
 await page.evaluate(()=>{ASHEN.localLights.state.shadows=true;ASHEN.localLights.state.characters=true;});await wait();
 await place(1.2,42);const movedActor=await probe();report.movedShadowSamples=movedActor.filter((p,i)=>Math.abs(p.visibility[0]-withActor[i].visibility[0])>.4).length;assert(report.movedShadowSamples>5,'Actor shadow must track changed position');
 await page.evaluate(()=>{ASHEN.localLights.state.enabled=false;});await wait();await capture('disabled');const disabled=await probe();assert(disabled.every(p=>p.irradiance===0));
 await page.evaluate(()=>ASHEN.localLights.state.enabled=true);await place(0,40);await capture('restored');
 const start=await page.evaluate(()=>({x:ASHEN.player.body.position.x,z:ASHEN.player.body.position.z}));await page.keyboard.down('KeyW');await page.waitForTimeout(1800);await page.keyboard.up('KeyW');report.movement=await page.evaluate(p=>Math.hypot(ASHEN.player.body.position.x-p.x,ASHEN.player.body.position.z-p.z),start);assert(report.movement>5);
 await place(1,56);await capture('street');report.selection=await page.evaluate(()=>ASHEN.localLights.state.active);assert.deepEqual(new Set(report.selection.map(s=>s.id)),new Set(['street-50','street-58']));assert(report.selection.every(s=>s.weight===1));
 await place(-1.3,50);await capture('near-lamp');await page.keyboard.press('KeyC');await wait();await capture('armory');await page.keyboard.press('Escape');
 await page.setViewportSize({width:391,height:843});await wait();await capture('portrait');
 report.runtime=await page.evaluate(()=>({physics:ASHEN.player.getDebugState().usingPhysics,local:ASHEN.localLights.state,native:ASHEN.scene.meshes.filter(m=>m.material?._buildGroup?._materialFamily==='pbr').map(m=>({name:m.name,local:m.material.plugins?.some(p=>p.name==='ashen-local-light-v1')})),gpuErrors:__gpuErrors}));
 assert(report.runtime.physics);assert(report.runtime.native.length>0&&report.runtime.native.every(m=>m.local));assert.deepEqual(report.runtime.gpuErrors,[]);assert.deepEqual(errors,[]);
 report.passed=true;
}catch(e){report.failure=e.stack;throw e;}finally{await fs.writeFile(`${dir}/report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report));await context.close();await browser.close();}
