import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {CDP_URL} from '../lib/cdp.mjs';
const dir=process.env.ASHEN_CAPTURE_DIR||'ve-capture/ashen-reach/v19/loop';
await fs.mkdir(dir,{recursive:true});
const browser=await chromium.connectOverCDP(CDP_URL),context=await browser.newContext({viewport:{width:1280,height:720}}),page=await context.newPage();
const errors=[],report={errors};
page.on('pageerror',e=>errors.push(e.message));
page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try {
 await page.goto(process.env.ASHEN_TEST_URL||'http://127.0.0.1:5173/ashen-reach.html?play&clean');
 await page.waitForFunction(()=>window.ASHEN?.ready&&ASHEN.hostilesReady,null,{timeout:120000});
 await page.evaluate(()=>{ASHEN.dev.god=true;ASHEN.renderLoop.beginMeasurement();});
 await page.keyboard.down('KeyW');await page.waitForTimeout(1800);await page.keyboard.up('KeyW');
 report.frames=await page.evaluate(()=>({state:{...ASHEN.renderLoop.state},samples:ASHEN.renderLoop.endMeasurement().length,z:ASHEN.player.body.position.z}));
 assert.equal(report.frames.state.maxPending,4);assert(report.frames.state.pending<=4);assert(report.frames.samples>50);assert(report.frames.z>3);
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});
 const hidden=await page.evaluate(()=>ASHEN.renderLoop.state.rendered);await page.waitForTimeout(300);
 assert.equal(await page.evaluate(()=>ASHEN.renderLoop.state.rendered),hidden);
 await page.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));});
 await page.waitForTimeout(300);assert(await page.evaluate(()=>ASHEN.renderLoop.state.rendered)>hidden);
 const views=[['spawn',0,0,0],['gate',0,30,0],['town',0,90,0],['north',0,132,0],['meadow',-28,-12,0]];
 for(const [name,x,z,yaw] of views){
  await page.evaluate(({x,z,yaw})=>{const a=ASHEN;a.player.setWorldPos(x,a.world.groundHeight(x,z)+1.7,z);a.rig.yaw=yaw;a.rig.pitch=.1;a.rig.distance=a.rig.distanceTarget=4.5;},{x,z,yaw});
  await page.waitForTimeout(900);await page.screenshot({path:`${dir}/${name}.png`});
 }
 await page.setViewportSize({width:430,height:780});await page.waitForTimeout(500);await page.screenshot({path:`${dir}/portrait.png`});
 await page.evaluate(()=>ASHEN.renderLoop.dispose());const stopped=await page.evaluate(()=>ASHEN.renderLoop.state.rendered);await page.waitForTimeout(300);
 assert.equal(await page.evaluate(()=>ASHEN.renderLoop.state.rendered),stopped);assert.deepEqual(errors,[]);
 report.passed=true;
}finally{await fs.writeFile(`${dir}/report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report));await context.close();await browser.close();}
