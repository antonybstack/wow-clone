/** Actual menu/Fly/mouse controls; native Lite projection only predicts pixels.
 * No private player or camera placement. ASHEN_RECORD=1 captures live motion.
 */
import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createArcRotateCamera, getViewMatrix, getViewProjectionMatrix, projectWorldToScreen, createPickingRay} from '@babylonjs/lite';
import {teleportSurfacePosition} from '../../src/ashen-reach/dev-surface-pick.js';
import {CDP_URL} from '../lib/cdp.mjs';
import {browserOwnership} from '../lib/browser-ownership.mjs';
import {captureSurface,appendFrame,writeCaptureManifest} from '../lib/capture-manifest.mjs';
const url=process.env.ASHEN_TEST_URL||'http://127.0.0.1:5173/?dev&play&clean';
const dir=process.env.ASHEN_CAPTURE_DIR||'.cache/dev-surface';
await fs.mkdir(`${dir}/frames`,{recursive:true});
const browser=await chromium.connectOverCDP(CDP_URL);
assert(browser.contexts().flatMap(c=>c.pages()).every(p=>p.url()==='about:blank'),'Blank the owned harness first');
const ownership=await browserOwnership(browser,{cdpPort:new URL(CDP_URL).port,url,purpose:'Click teleport native UI/capture, no FPS claim',renderingClients:1});
await fs.writeFile(`${dir}/ownership.json`,JSON.stringify(ownership,null,2));
const context=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1});
const page=await context.newPage(),errors=[],report={url,errors,checks:[]};
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
const state=()=>page.evaluate(()=>{const p=ASHEN.player,d=p.getDebugState();return {x:p.body.position.x,y:p.body.position.y,z:p.body.position.z,height:p.capsuleHeight,radius:p.capsuleRadius,flying:p.isFlying(),physics:d.usingPhysics,recoveries:d.recoveries};});
async function menu(){
 const locked=await page.evaluate(()=>!!document.pointerLockElement);
 await page.keyboard.press('Escape');
 if(locked){await page.waitForTimeout(250);await page.keyboard.press('Escape');}
 await page.getByRole('button',{name:'Developer tools',exact:true}).click();
}
async function jump(id){await menu();await page.getByLabel('Destination',{exact:true}).selectOption(id);await page.getByRole('button',{name:'Jump to destination',exact:true}).click();await page.waitForTimeout(550);}
async function fly(on){await menu();await page.getByRole('button',{name:`Fly mode: ${on?'off':'on'}`,exact:true}).click();await page.keyboard.press('Escape');await page.waitForTimeout(250);}
async function aim(dx,dy){await page.mouse.move(640,360);await page.mouse.down({button:'right'});await page.mouse.move(640+dx,360+dy,{steps:20});await page.mouse.up({button:'right'});await page.waitForTimeout(350);}
async function pixel(point){
 const data=await page.evaluate(()=>{const c=ASHEN.camera;return {alpha:c.alpha,beta:c.beta,radius:c.radius,target:{x:c.target.x,y:c.target.y,z:c.target.z},fov:c.fov,near:c.nearPlane,far:c.farPlane};});
 const camera=createArcRotateCamera(data.alpha,data.beta,data.radius,data.target);camera.fov=data.fov;camera.nearPlane=data.near;camera.farPlane=data.far;
 const vp=getViewProjectionMatrix(camera,1280/720);
 const p=projectWorldToScreen({x:point[0],y:point[1],z:point[2]},getViewMatrix(camera),vp,{viewport:{x:0,y:0,width:1280,height:720},backingWidth:1280,backingHeight:720});
 assert(!p.clipped && p.x>130 && p.x<1100 && p.y>90 && p.y<610,`World target not exposed in safe canvas area: ${JSON.stringify(p)}`);
 const ray=createPickingRay(p.x,p.y,vp,1280,720),from={x:ray.origin[0],y:ray.origin[1],z:ray.origin[2]},length=Math.min(ray.length,900);
 const to={x:from.x+ray.direction[0]*length,y:from.y+ray.direction[1]*length,z:from.z+ray.direction[2]*length};
 const hit=await page.evaluate(({from,to})=>{const h=ASHEN.player.raycast(from,to,{ignorePlayer:true});return h?.hasHit?{hitPoint:h.hitPoint,hitNormal:h.hitNormal,fraction:h.fraction}:null;},{from,to});
 return {x:p.x,y:p.y,hit};
}
async function clickSurface(name,point,{floor=true}={}){
 const p=await pixel(point);assert(p.hit,`${name}: no physical hit`);
 if(floor)assert(Math.abs(p.hit.hitPoint.y-point[1])<.25,`${name}: ray hit a different level ${JSON.stringify(p.hit)}`);
 const before=await state(),expected=teleportSurfacePosition(p.hit,before.height,before.radius);
 await page.mouse.click(p.x,p.y);await page.waitForTimeout(250);
 const after=await state();
 assert(after.flying && after.physics && after.recoveries===before.recoveries);
 assert(Math.hypot(after.x-expected.x,after.y-expected.y,after.z-expected.z)<.08,`${name}: click did not reach physical surface: ${JSON.stringify({expected,after})}`);
 report.checks.push({name,point,pixel:p,before,after});await page.waitForTimeout(900);
 return after;
}
let cdp,manifest,captureError;const writes=[];
try{
 await page.goto(url,{waitUntil:'commit'});await page.waitForFunction(()=>window.ASHEN?.ready,null,{timeout:120000});
 if(process.env.ASHEN_RECORD==='1'){
  manifest={version:1,...await captureSurface(page),frames:[]};cdp=await context.newCDPSession(page);
  cdp.on('Page.screencastFrame',e=>{cdp.send('Page.screencastFrameAck',{sessionId:e.sessionId}).catch(()=>{});if(captureError)return;try{const bytes=Buffer.from(e.data,'base64'),name=`frame-${String(manifest.frames.length).padStart(5,'0')}.jpg`;appendFrame(manifest,{name,timestamp:e.metadata.timestamp,bytes});writes.push(fs.writeFile(`${dir}/frames/${name}`,bytes).catch(e=>captureError=e));}catch(e){captureError=e;}});
  await cdp.send('Page.startScreencast',{format:'jpeg',quality:87,maxWidth:1280,maxHeight:720,everyNthFrame:1});
 }
 const k=await page.evaluate(()=>({floorY:ASHEN.world.cathedral.floorY}));
 await jump('cathedral-parapet');await fly(true);
 await clickSurface('Exterior parapet — above terrain',[-27.5,k.floorY+8.5,350.5]);
 await fly(false);await page.waitForTimeout(900);
 assert(Math.abs((await state()).y-(await state()).height/2-(k.floorY+8.5))<.25,'Fly-off fell below the parapet');
 await jump('cathedral-gallery');await fly(true);
 await clickSurface('Upper gallery — above nave',[-7.5,k.floorY+8.5,343.5]);
 await jump('cathedral-nave');await fly(true);
 await clickSurface('Nave — above underlying terrain',[.8,k.floorY,313.5]);
 await jump('start');await fly(true);
 const ground=await page.evaluate(()=>ASHEN.world.groundHeight(.8,3.5));
 await clickSurface('Ordinary ground',[.8,ground,3.5]);
 await jump('cathedral-parapet');await fly(true);
 // These are the existing user controls: Space lifts, RMB orbits/downward look.
 await page.keyboard.down('Space');await page.waitForTimeout(2400);await page.keyboard.up('Space');
 await aim(436,240);
 const roofPoint=[-9,k.floorY+36-12.2/13.1*9,345];
 await clickSurface('Sloped cathedral roof',roofPoint);
 await aim(0,-500); // expose empty sky instead of aiming through the castle
 const before=await state();await page.mouse.click(500,140);await page.waitForTimeout(250);const after=await state();
 assert(Math.hypot(after.x-before.x,after.y-before.y,after.z-before.z)<.03,'Sky miss moved the player');
 report.checks.push({name:'Sky miss remains in place',before,after});
 if(cdp){await cdp.send('Page.stopScreencast');cdp.removeAllListeners('Page.screencastFrame');await Promise.all(writes);if(captureError)throw captureError;await writeCaptureManifest(dir,manifest,await captureSurface(page));}
 report.gpuErrors=await page.evaluate(()=>ASHEN.gpu.errors);assert.deepEqual(errors,[]);assert.deepEqual(report.gpuErrors,[]);report.passed=true;
}catch(error){report.failure=error.stack;await page.screenshot({path:`${dir}/failure.png`}).catch(()=>{});throw error;
}finally{
 await page.keyboard.up('Space').catch(()=>{});await cdp?.send('Page.stopScreencast').catch(()=>{});await Promise.all(writes);
 await fs.writeFile(`${dir}/report.json`,JSON.stringify(report,null,2));await context.close();await browser.close();
 await fs.writeFile(`${dir}/ownership.json`,JSON.stringify({...ownership,active:false,renderingClients:0},null,2));
}
console.log(`PASS: ${report.checks.length} native click checks, elevated Fly-off, no runtime/GPU errors`);
