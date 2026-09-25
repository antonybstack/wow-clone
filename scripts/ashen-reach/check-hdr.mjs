/** V13 probes actual float targets, display math, resizing and playable controls. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium} from 'playwright';
import {CDP_URL} from '../lib/cdp.mjs';
import {displayColor,DISPLAY_WGSL} from '../../src/ashen-reach/color-management.js';
const dir='ve-capture/ashen-reach/hdr/check';await fs.mkdir(dir,{recursive:true});
const browser=await chromium.connectOverCDP(CDP_URL);
const context=await browser.newContext({viewport:{width:1280,height:720}}),page=await context.newPage();
const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
await page.addInitScript(()=>{globalThis.__gpuErrors=[];const request=GPUAdapter.prototype.requestDevice;GPUAdapter.prototype.requestDevice=async function(...a){const d=await request.apply(this,a);d.addEventListener('uncapturederror',e=>__gpuErrors.push(e.error.message));return d;};});
const base=process.env.ASHEN_TEST_URL||'http://127.0.0.1:5173/ashen-reach.html?play&clean';
async function open(extra=''){await page.goto(base+extra,{waitUntil:'commit'});await page.waitForFunction(()=>globalThis.ASHEN?.ready,null,{timeout:90000});await page.evaluate(()=>{ASHEN.dev.god=true;});await page.waitForTimeout(500);}
async function probe(){return page.evaluate(async()=>{
 const h=ASHEN.hdr,d=ASHEN.engine._device,targets=[h.sceneRT,h.grounding?.output||h.sceneRT,h.volume?.output||h.sceneRT,h.bloomRT||h.sceneRT];
 const n=128*72,bytes=n*64,out=d.createBuffer({size:bytes,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC}),read=d.createBuffer({size:bytes,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});
 try{
  const module=d.createShaderModule({code:`${targets.map((_,i)=>`@group(0) @binding(${i}) var t${i}:texture_2d<f32>;`).join('')}
   @group(0) @binding(4) var<storage,read_write> out:array<vec4<f32>>;
   @compute @workgroup_size(64) fn main(@builtin(global_invocation_id) id:vec3<u32>){if(id.x>=9216u){return;}
    let uv=(vec2<f32>(f32(id.x%128u),f32(id.x/128u))+.5)/vec2<f32>(128.0,72.0);
    ${targets.map((_,i)=>`out[id.x*4u+${i}u]=textureLoad(t${i},vec2<i32>(uv*vec2<f32>(textureDimensions(t${i}))),0);`).join('')}}`});
  const pipeline=d.createComputePipeline({layout:'auto',compute:{module,entryPoint:'main'}});
  const group=d.createBindGroup({layout:pipeline.getBindGroupLayout(0),entries:[...targets.map((t,i)=>({binding:i,resource:t._colorView})),{binding:4,resource:{buffer:out}}]});
  const encoder=d.createCommandEncoder(),pass=encoder.beginComputePass();pass.setPipeline(pipeline);pass.setBindGroup(0,group);pass.dispatchWorkgroups(n/64);pass.end();encoder.copyBufferToBuffer(out,0,read,0,bytes);d.queue.submit([encoder.finish()]);await read.mapAsync(GPUMapMode.READ);
  const values=new Float32Array(read.getMappedRange()).slice();read.unmap();
  const result=targets.map(t=>({format:t._descriptor.format,max:0,aboveOne:0,nonfinite:0}));let fogDelta=0,groundDelta=0,bloomDelta=0;
  for(let i=0;i<n;i++)for(let t=0;t<4;t++)for(let c=0;c<3;c++){const v=values[i*16+t*4+c],s=result[t];s.max=Math.max(s.max,v);s.aboveOne+=+(v>1);s.nonfinite+=+!Number.isFinite(v);if(t===1)groundDelta=Math.max(groundDelta,Math.abs(v-values[i*16+c]));if(t===2)fogDelta=Math.max(fogDelta,Math.abs(v-values[i*16+4+c]));if(t===3)bloomDelta=Math.max(bloomDelta,Math.abs(v-values[i*16+8+c]));}
  return {targets:result,groundDelta,fogDelta,bloomDelta,display:{...h.display.state},nativeImageProcessing:ASHEN.scene.imageProcessing.toneMapping?.id,nativeMaterials:ASHEN.scene.meshes.filter(m=>m.material?._buildGroup?._materialFamily==='pbr').map(m=>({name:m.name,linear:m.material.plugins?.some(p=>p.name==='ashen-linear-output-v1')})),gpuErrors:[...__gpuErrors]};
 }finally{out.destroy();read.destroy();}
});}
try{
 await open();const views=[];
 for(const [name,x,z,yaw] of [['churchyard',0,0,0],['town',0,98,0],['sun-approach',0,-55,Math.PI]]){
  await page.evaluate(({x,z,yaw})=>{const a=ASHEN;a.player.setWorldPos(x,a.world.groundHeight(x,z)+1.7,z);a.player.setFacing(yaw);a.rig.yaw=yaw;a.rig.pitch=.08;},{x,z,yaw});await page.waitForTimeout(800);
  const p=await probe();assert(p.targets.every(t=>t.format==='rgba16float'&&!t.nonfinite));assert.equal(p.nativeImageProcessing,'ashen-linear-output-v1');assert(p.nativeMaterials.length>0&&p.nativeMaterials.every(m=>m.linear),'Every streamed PBR material has linear output');assert.deepEqual(p.gpuErrors,[]);views.push({name,...p});await page.screenshot({path:`${dir}/${name}.png`});
 }
 assert(views.some(v=>v.targets[0].aboveOne>0),'Scene retains radiance above 1');
 assert(views.some(v=>v.targets[3].aboveOne>0),'Bloom composition retains radiance above 1');
 await page.evaluate(()=>{ASHEN.grounding.state.enabled=false;ASHEN.volumetric.state.enabled=false;ASHEN.hdr.bloomTask.weight=0;});await page.waitForTimeout(250);
 const bypass=await probe();assert.equal(bypass.groundDelta,0);assert.equal(bypass.fogDelta,0);assert.equal(bypass.bloomDelta,0);
 await page.evaluate(()=>{ASHEN.grounding.state.enabled=true;ASHEN.volumetric.state.enabled=true;ASHEN.hdr.bloomTask.weight=.12;});
 // Compare the exact WGSL display function against the CPU mirror on known HDR colors.
 const samples=[[0,0,0],[.18,.18,.18],[1,.5,.1],[2,1,.2],[8,3,.5],[-1,.003,1]];
 const transformed=await page.evaluate(async({samples,code})=>{
  const d=ASHEN.engine._device,n=samples.length,bytes=n*16;
  const src=d.createBuffer({size:bytes,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}),out=d.createBuffer({size:bytes,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC}),read=d.createBuffer({size:bytes,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST});
  try{d.queue.writeBuffer(src,0,new Float32Array(samples.flatMap(c=>[...c,1])));
   const m=d.createShaderModule({code:`${code}\n@group(0) @binding(0) var<storage,read> src:array<vec4<f32>>;@group(0) @binding(1) var<storage,read_write> dst:array<vec4<f32>>;@compute @workgroup_size(1) fn main(@builtin(global_invocation_id) id:vec3<u32>){dst[id.x]=vec4<f32>(displayColor(src[id.x].rgb,.9,1.05),1.0);}`});
   const p=d.createComputePipeline({layout:'auto',compute:{module:m,entryPoint:'main'}}),g=d.createBindGroup({layout:p.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:src}},{binding:1,resource:{buffer:out}}]});
   const e=d.createCommandEncoder(),pass=e.beginComputePass();pass.setPipeline(p);pass.setBindGroup(0,g);pass.dispatchWorkgroups(n);pass.end();e.copyBufferToBuffer(out,0,read,0,bytes);d.queue.submit([e.finish()]);await read.mapAsync(GPUMapMode.READ);const a=Array.from(new Float32Array(read.getMappedRange()));read.unmap();return a;
  }finally{src.destroy();out.destroy();read.destroy();}
 },{samples,code:DISPLAY_WGSL});
 samples.forEach((s,i)=>displayColor(s).forEach((v,c)=>assert(Math.abs(v-transformed[i*4+c])<.00002,'GPU/CPU final transform match')));
 const start=await page.evaluate(()=>({x:ASHEN.player.body.position.x,z:ASHEN.player.body.position.z}));await page.keyboard.down('KeyW');await page.waitForTimeout(900);await page.keyboard.press('Space');await page.waitForTimeout(600);await page.keyboard.up('KeyW');
 const movement=await page.evaluate(s=>Math.hypot(ASHEN.player.body.position.x-s.x,ASHEN.player.body.position.z-s.z),start);assert(movement>3);
 await page.keyboard.press('KeyC');await page.waitForTimeout(500);await page.screenshot({path:`${dir}/armory.png`});await page.keyboard.press('Escape');
 await page.keyboard.press('KeyV');await page.waitForTimeout(250);await page.keyboard.press('KeyV');
 await page.setViewportSize({width:391,height:843});await page.waitForTimeout(600);const portrait=await probe();assert(portrait.display.resolution[0]<portrait.display.resolution[1]);await page.screenshot({path:`${dir}/portrait.png`});
 await page.evaluate(()=>{ASHEN.hdr.display.state.exposure=NaN;ASHEN.hdr.display.state.saturation=100;});await page.waitForTimeout(100);const bounded=await probe();assert.equal(bounded.display.exposure,.9);assert.equal(bounded.display.saturation,1.5);
 await open('&noPost');const direct=await probe();assert(direct.targets.every(t=>!t.nonfinite));assert.equal(direct.display.output,'srgb');await page.screenshot({path:`${dir}/direct.png`});
 // Explicitly dispose a complete HDR scene (including our external bloom target).
 await open();await page.evaluate(()=>ASHEN.whenHostiles);
 const disposed=await page.evaluate(async()=>{
  const source=await (await fetch('/src/ashen-reach/main.js')).text();
  const url=source.match(/from\s*["']([^"']*\/@babylonjs_lite\.js[^"']*)["']/)?.[1];
  if(!url)throw new Error('Could not locate the active Lite module');
  const {unregisterScene,disposeScene}=await import(url),a=ASHEN;
  unregisterScene(a.scene);disposeScene(a.scene);
  return !a.hdr.bloomRT._colorTexture&&!a.hdr.sceneRT._colorTexture;
 });
 assert(disposed,'HDR scene and bloom targets released');const stoppedFrames=await page.evaluate(()=>ASHEN.renderLoop.state.rendered);
 await page.waitForTimeout(200);
 assert.equal(await page.evaluate(()=>ASHEN.renderLoop.state.rendered),stoppedFrames,'Scene disposal stops scheduler');
 assert.deepEqual(errors,[]);assert.deepEqual(await page.evaluate(()=>__gpuErrors),[]);
 const report={views,bypass,movement,portrait,direct,disposed,displayMathSamples:samples.length,errors};await fs.writeFile(`${dir}/report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await context.close();await browser.close();}
