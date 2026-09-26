/** Live proof that disabled custom shadow tasks stop submitting map work. */
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {CDP_URL} from '../lib/cdp.mjs';

const browser=await chromium.connectOverCDP(CDP_URL);
const context=await browser.newContext({viewport:{width:1280,height:720}});
const page=await context.newPage();
const errors=[];
page.on('pageerror',error=>errors.push(error.message));
page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
await page.addInitScript(()=>{
 window.__gpuErrors=[];
 const request=GPUAdapter.prototype.requestDevice;
 GPUAdapter.prototype.requestDevice=async function(...args){
  const device=await request.apply(this,args);
  device.addEventListener('uncapturederror',event=>__gpuErrors.push(event.error.message));
  return device;
 };
});
try{
 await page.goto(process.env.ASHEN_TEST_URL||'http://127.0.0.1:5173/ashen-reach.html?play&clean',{waitUntil:'commit'});
 await page.waitForFunction(()=>window.ASHEN?.ready&&ASHEN.hostilesReady,null,{timeout:120000});
 await page.evaluate(()=>{
  const a=ASHEN,counts={far:0,local:0};window.__shadowCalls=counts;
  a.player.setWorldPos(0,a.world.groundHeight(0,42)+1.7,42);
  for(const [generator,key] of [[a.shadows.far,'far'],...a.localLights.slots.map(s=>[s.generator,'local'])]){
   const original=generator._renderShadowMap;
   generator._renderShadowMap=function(...args){counts[key]++;return original.apply(this,args);};
  }
 });
 const snapshot=()=>page.evaluate(()=>({...__shadowCalls,frames:ASHEN.renderLoop.state.rendered,gpuErrors:[...__gpuErrors]}));
 await page.waitForTimeout(350);
 const before=await snapshot();
 assert(before.far>0&&before.local>0,'Shadow maps must execute while enabled');
 await page.evaluate(()=>ASHEN.shadows.setEnabled(false));
 const offStart=await snapshot();
 await page.waitForTimeout(350);
 const off=await snapshot();
 assert(off.frames>offStart.frames+10,'Render loop did not advance while shadows were disabled');
 assert.equal(off.far,offStart.far,'Far sun map drew while disabled');
 assert.equal(off.local,offStart.local,'Local maps drew while sun shadows were disabled');
 await page.evaluate(()=>ASHEN.shadows.setEnabled(true));
 await page.waitForTimeout(350);
 const restored=await snapshot();
 assert(restored.far>off.far&&restored.local>off.local,'Shadow maps did not resume');
 await page.evaluate(()=>ASHEN.localLights.state.shadows=false);
 const localOffStart=await snapshot();
 await page.waitForTimeout(350);
 const localOff=await snapshot();
 assert.equal(localOff.local,localOffStart.local,'Local maps drew with local shadows disabled');
 assert(localOff.far>localOffStart.far,'Sun map should remain active');
 assert.deepEqual(localOff.gpuErrors,[]);assert.deepEqual(errors,[]);
 console.log(JSON.stringify({before,off,restored,localOff,errors}));
}finally{await context.close();await browser.close();}
