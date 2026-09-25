import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {CDP_URL} from '../lib/cdp.mjs';
const dir=process.env.ASHEN_CAPTURE_DIR||'ve-capture/ashen-reach/v19/loop';
await fs.mkdir(dir,{recursive:true});
const browser=await chromium.connectOverCDP(CDP_URL),context=await browser.newContext({viewport:{width:1280,height:720}}),page=await context.newPage();
const errors=[],report={errors};
const record=process.argv.includes('--record'),frames=[],writes=[];
let cdp;
page.on('pageerror',e=>errors.push(e.message));
page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
await page.addInitScript(()=>{window.__gpuErrors=[];const original=GPUAdapter.prototype.requestDevice;GPUAdapter.prototype.requestDevice=async function(...args){const d=await original.apply(this,args);d.addEventListener('uncapturederror',e=>__gpuErrors.push(e.error.message));return d;};});
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
 if(record){
  await fs.mkdir(`${dir}/frames`,{recursive:true});
  await page.evaluate(()=>{const d=document.createElement('div');d.id='composition-label';d.style.cssText='position:fixed;top:60px;left:16px;background:#101715dd;color:#eadcbb;padding:8px;z-index:100';document.body.append(d);});
  cdp=await context.newCDPSession(page);
  cdp.on('Page.screencastFrame',e=>{cdp.send('Page.screencastFrameAck',{sessionId:e.sessionId}).catch(()=>{});const name=`frame-${String(frames.length).padStart(5,'0')}.jpg`;frames.push({name,ts:e.metadata.timestamp});writes.push(fs.writeFile(`${dir}/frames/${name}`,Buffer.from(e.data,'base64')));});
  await cdp.send('Page.startScreencast',{format:'jpeg',quality:90,maxWidth:1280,maxHeight:720,everyNthFrame:1});
 }
 const views=[['spawn',0,0,0],['gate',0,30,0],['town',0,90,0],['north',0,132,0],['meadow',-28,-12,0]];
 if(process.argv.includes('--vistas'))views.push(['transition',0,44,0],['north-west',-35,130,.19],['north-east',35,130,-.19],['town-return',0,108,Math.PI]);
 for(const [name,x,z,yaw] of views){
  if(record)await page.evaluate(name=>document.getElementById('composition-label').textContent=`Camera cut: ${name} — keyboard walk`,name);
  await page.evaluate(({x,z,yaw})=>{const a=ASHEN;a.player.setWorldPos(x,a.world.groundHeight(x,z)+1.7,z);a.rig.yaw=yaw;a.rig.pitch=.1;a.rig.distance=a.rig.distanceTarget=4.5;},{x,z,yaw});
  await page.waitForTimeout(900);await page.screenshot({path:`${dir}/${name}.png`});
  if(process.argv.includes('--composition')){
   const blocked=await page.evaluate(()=>ASHEN.world.foliage.pools.reduce((n,pool)=>{for(let i=0;i<pool.nearCount;i++){const x=pool.nM[i*16+12],z=pool.nM[i*16+14];if(z>=-95&&z<=145&&Math.abs(x-Math.sin(z*.14)*1.25)<1)n++;}return n;},0));
   assert.equal(blocked,0,`${name}: no packed plant roots in walking center`);
  }
  if(record){await page.keyboard.down('KeyW');await page.waitForTimeout(1500);await page.keyboard.up('KeyW');}
 }
 if(record){
  await cdp.send('Page.stopScreencast');await Promise.all(writes);
  const lines=['ffconcat version 1.0'];for(let i=0;i<frames.length;i++)lines.push(`file 'frames/${frames[i].name}'`,`duration ${Math.max(.008,(frames[i+1]?.ts??frames[i].ts+1/60)-frames[i].ts)}`);
  lines.push(`file 'frames/${frames.at(-1).name}'`);await fs.writeFile(`${dir}/frames.ffconcat`,lines.join('\n')+'\n');
  report.recording={frames:frames.length,seconds:frames.at(-1).ts-frames[0].ts};
 }
 await page.setViewportSize({width:430,height:780});await page.waitForTimeout(500);await page.screenshot({path:`${dir}/portrait.png`});
 await page.evaluate(()=>ASHEN.renderLoop.dispose());const stopped=await page.evaluate(()=>ASHEN.renderLoop.state.rendered);await page.waitForTimeout(300);
 assert.equal(await page.evaluate(()=>ASHEN.renderLoop.state.rendered),stopped);assert.deepEqual(errors,[]);
 report.gpuErrors=await page.evaluate(()=>__gpuErrors);assert.deepEqual(report.gpuErrors,[]);
 report.world=await page.evaluate(()=>ASHEN.world.stats);
 report.passed=true;
}finally{await fs.writeFile(`${dir}/report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report));await context.close();await browser.close();}
