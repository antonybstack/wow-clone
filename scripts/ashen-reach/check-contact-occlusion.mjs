/** Live V12 masks, exact bypass, bounded composition, controls and camera regression. */
import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {CDP_URL} from '../lib/cdp.mjs';
const i=process.argv.indexOf('--tag'),tag=i<0?'v12-check':process.argv[i+1];
const dir=`ve-capture/ashen-reach/contact-occlusion/${tag}`;await fs.mkdir(dir,{recursive:true});
const url=process.env.ASHEN_TEST_URL||'http://127.0.0.1:5173/ashen-reach.html?play&clean';
const browser=await chromium.connectOverCDP(CDP_URL);
const context=await browser.newContext({viewport:{width:1280,height:720}});
const page=await context.newPage();
const errors=[];page.on('pageerror',e=>errors.push(e.message));
page.on('console',m=>{if(m.type()==='error'||/validation|invalid.*(bind|shader|command|pipeline)/i.test(m.text()))errors.push(m.text());});
async function stats(){return page.evaluate(async()=>{
 const g=ASHEN.grounding,d=ASHEN.engine._device,N=128*72,bytes=N*32;
 const result=d.createBuffer({size:bytes,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC});
 const read=d.createBuffer({size:bytes,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});
 try{
 const module=d.createShaderModule({code:`
 @group(0) @binding(0) var depth:texture_depth_2d;
 @group(0) @binding(1) var ao:texture_2d<f32>;
 @group(0) @binding(2) var contact:texture_2d<f32>;
 @group(0) @binding(3) var source:texture_2d<f32>;
 @group(0) @binding(4) var output:texture_2d<f32>;
 struct Sample {a:vec4<f32>,b:vec4<f32>};
 @group(0) @binding(5) var<storage,read_write> values:array<Sample>;
 @compute @workgroup_size(64) fn probe(@builtin(global_invocation_id) id:vec3<u32>){
 if(id.x>=9216u){return;}let uv=(vec2<f32>(f32(id.x%128u),f32(id.x/128u))+.5)/vec2<f32>(128.0,72.0);
 let p=vec2<i32>(uv*vec2<f32>(textureDimensions(source)));let a=textureLoad(ao,vec2<i32>(uv*vec2<f32>(textureDimensions(ao))),0).rg;
 let c=textureLoad(contact,p,0).r;let s=textureLoad(source,p,0).rgb;let o=textureLoad(output,p,0).rgb;
 let bright=max(s.r,max(s.g,s.b));let delta=abs(s-o);let lum=dot(s,vec3<f32>(.2126,.7152,.0722));
 values[id.x].a=vec4<f32>(a.x,c,1.0-dot(o,vec3<f32>(.2126,.7152,.0722))/max(.00001,lum),textureLoad(depth,p,0));
 values[id.x].b=vec4<f32>(bright,max(delta.r,max(delta.g,delta.b)),lum,a.y);
 }`});
 const pipe=d.createComputePipeline({layout:'auto',compute:{module,entryPoint:'probe'}});
 const group=d.createBindGroup({layout:pipe.getBindGroupLayout(0),entries:[
 {binding:0,resource:g.sourceRT._depthTexture.createView({aspect:'depth-only'})},
 {binding:1,resource:g.aoRT._colorView},{binding:2,resource:g.contactTask.shadowTexture._colorView},
 {binding:3,resource:g.sourceRT._colorView},{binding:4,resource:g.output._colorView},{binding:5,resource:{buffer:result}}]});
 const encoder=d.createCommandEncoder(),pass=encoder.beginComputePass();pass.setPipeline(pipe);pass.setBindGroup(0,group);pass.dispatchWorkgroups(N/64);pass.end();
 encoder.copyBufferToBuffer(result,0,read,0,bytes);d.queue.submit([encoder.finish()]);await read.mapAsync(GPUMapMode.READ);
 const a=new Float32Array(read.getMappedRange()).slice();read.unmap();
 const r={samples:N,aoSamples:0,contactSamples:0,skySamples:0,highlightSamples:0,maxAO:0,maxContact:0,maxDarkening:0,maxCeilingExcess:0,maxSkyDelta:0,maxHighlightDelta:0,maxDelta:0,darkened:0};
 for(let i=0;i<N;i++){const k=i*8;r.aoSamples+=+(a[k]>.025);r.contactSamples+=+(a[k+1]>.025);r.maxAO=Math.max(r.maxAO,a[k]);r.maxContact=Math.max(r.maxContact,a[k+1]);
 if(a[k+6]>.05){r.maxDarkening=Math.max(r.maxDarkening,a[k+2]);r.maxCeilingExcess=Math.max(r.maxCeilingExcess,(a[k+2]-.25)*a[k+6]-.5/255);}
 if(a[k+3]<=0){r.skySamples++;r.maxSkyDelta=Math.max(r.maxSkyDelta,a[k+5]);}
 if(a[k+4]>.89){r.highlightSamples++;r.maxHighlightDelta=Math.max(r.maxHighlightDelta,a[k+5]);}r.maxDelta=Math.max(r.maxDelta,a[k+5]);r.darkened+=+(a[k+5]>.004);
 }return r;
 }finally{result.destroy();read.destroy();}
});}
try{
 await page.setViewportSize({width:1280,height:720});
 await page.goto(url,{waitUntil:'commit'});
 await page.waitForFunction(()=>window.ASHEN?.ready&&ASHEN.hostilesReady,null,{timeout:90000});
 // Keep the seven live actors while preventing combat death during mask captures.
 await page.evaluate(()=>{ASHEN.dev.god=true;});
 const views=[];
 for(const [name,x,z,pitch,distance] of [['feet',0,-55,.44,3.5],['stones',1,-7,.28,4],['street',0,95,.24,4.5]]){
  await page.evaluate(({x,z,pitch,distance})=>{const A=ASHEN;A.setView('play');A.player.setWorldPos(x,A.world.groundHeight(x,z)+1.7,z);A.player.setFacing(0);A.rig.yaw=0;A.rig.pitch=pitch;A.rig.distance=A.rig.distanceTarget=distance;},{x,z,pitch,distance});
  await page.waitForTimeout(1500);
  const enabled=await stats();await page.screenshot({path:`${dir}/${name}-on.png`});
  // UNORM8 rounding allows half a color step, not a flat extra 4% attenuation.
  assert(enabled.maxCeilingExcess<.00001,'Composition exceeded quantization-aware darkening ceiling');assert.equal(enabled.maxSkyDelta,0,'Clear sky was modified');assert.equal(enabled.maxHighlightDelta,0,'Bright emission was modified');
  await page.evaluate(()=>{ASHEN.grounding.state.enabled=false;});await page.waitForTimeout(120);
  const disabled=await stats();assert.equal(disabled.maxDelta,0,'Disabled effect did not preserve source color');await page.screenshot({path:`${dir}/${name}-off.png`});
  await page.evaluate(()=>{ASHEN.grounding.state.enabled=true;ASHEN.grounding.state.debug=1;ASHEN.volumetric.state.enabled=false;});await page.waitForTimeout(120);
  await page.screenshot({path:`${dir}/${name}-ao.png`});
  await page.evaluate(()=>{ASHEN.grounding.state.debug=2;});await page.waitForTimeout(120);await page.screenshot({path:`${dir}/${name}-contact.png`});
  await page.evaluate(()=>{ASHEN.grounding.state.debug=0;ASHEN.volumetric.state.enabled=true;});
  views.push({name,enabled,disabled});
 }
 assert(views.some(v=>v.enabled.aoSamples>50),'AO did not find nearby intersections');
 assert(views.some(v=>v.enabled.contactSamples>10),'Contact tracing did not find occluders');
 assert(views.some(v=>v.enabled.skySamples>10),'Sky comparison had insufficient coverage');
 assert(views.some(v=>v.enabled.highlightSamples>10),'Highlight comparison had insufficient coverage');
 await page.evaluate(()=>{ASHEN.player.setWorldPos(0,ASHEN.world.groundHeight(0,-55)+1.7,-55);ASHEN.player.setFacing(0);ASHEN.rig.yaw=0;});await page.waitForTimeout(1200);
 const before=await page.evaluate(()=>{const p=ASHEN.player.body.position;return {x:p.x,z:p.z};});await page.keyboard.down('KeyW');await page.waitForTimeout(900);await page.keyboard.press('Space');await page.waitForTimeout(600);await page.keyboard.up('KeyW');
 const after=await page.evaluate(()=>{const p=ASHEN.player.body.position;return {x:p.x,z:p.z};});assert(Math.hypot(before.x-after.x,before.z-after.z)>3);
 await page.keyboard.press('KeyV');await page.waitForTimeout(300);await page.screenshot({path:`${dir}/reference-camera.png`});
 await page.keyboard.press('KeyV');await page.waitForTimeout(300);
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(600);await page.screenshot({path:`${dir}/portrait.png`});
 const portrait=await page.evaluate(()=>({...ASHEN.grounding.state}));assert(portrait.resolution[0]<portrait.resolution[1]);
 await page.setViewportSize({width:1280,height:720});await page.waitForTimeout(400);
 const report={requestedUrl:url,visitedUrl:page.url(),views,movement:Math.hypot(before.x-after.x,before.z-after.z),portrait,errors};
 await fs.writeFile(`${dir}/report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report));assert.equal(errors.length,0,'Runtime/GPU errors');
}finally{
 await page.keyboard.up('KeyW').catch(()=>{});
  await page.evaluate(()=>{if(ASHEN.grounding)Object.assign(ASHEN.grounding.state,{enabled:true,debug:0});if(ASHEN.volumetric)ASHEN.volumetric.state.enabled=true;ASHEN.dev.god=false;}).catch(()=>{});
 await context.close();await browser.close();
}
