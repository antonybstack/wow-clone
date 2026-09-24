/** Opt-in GPU diagnostic using exactly the surface receiver's visibility code. */
import {SUN_SHADOW_WGSL} from './sun-shadows.js';

export async function probeSun(engine,shadows,points){
 if(!points.length)return [];
 const device=engine._device,resources=[];
 const buffer=(size,usage)=>{const b=device.createBuffer({size,usage});resources.push(b);return b;};
 const u=new Float32Array(92),samples=new Float32Array(points.length*8);
 u.set(shadows.data.subarray(0,48));u.set(shadows.far._lightMatrix,48);u.set(shadows.view,64);
 u.set(shadows.data.subarray(64,72),80);u.set([+shadows.state.enabled,1/shadows.state.mapSize,shadows.state.range,.1],88);
 points.forEach((p,i)=>samples.set([...p,1],i*8));
 const uniforms=buffer(u.byteLength,GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST);
 const storage=buffer(samples.byteLength,GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC);
 const read=buffer(samples.byteLength,GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST);
 try{
  device.queue.writeBuffer(uniforms,0,u);device.queue.writeBuffer(storage,0,samples);
  const module=device.createShaderModule({code:`
   struct Params{sunCascade0:mat4x4<f32>,sunCascade1:mat4x4<f32>,sunCascade2:mat4x4<f32>,sunFarMatrix:mat4x4<f32>,view:mat4x4<f32>,sunSplits:vec4<f32>,sunLengths:vec4<f32>,sunShadowParams:vec4<f32>};
   struct Sample{p:vec4<f32>,result:vec4<f32>};
   @group(0) @binding(0) var<uniform> u:Params;
   @group(0) @binding(1) var sunCascades:texture_depth_2d_array;
   @group(0) @binding(2) var sunCascadesSampler:sampler_comparison;
   @group(0) @binding(3) var sunFar:texture_depth_2d;
   @group(0) @binding(4) var sunFarSampler:sampler_comparison;
   @group(0) @binding(5) var<storage,read_write> samples:array<Sample>;
   ${SUN_SHADOW_WGSL.replaceAll('shaderUniforms.','u.').replaceAll('shaderSystem.view','u.view')}
   @compute @workgroup_size(64) fn main(@builtin(global_invocation_id) id:vec3<u32>){
    if(id.x>=arrayLength(&samples)){return;}
    samples[id.x].result=vec4<f32>(sunVisibility(samples[id.x].p.xyz,vec3<f32>(0.0,1.0,0.0)),0.0,0.0,1.0);
   }`});
  const pipeline=device.createComputePipeline({layout:'auto',compute:{module,entryPoint:'main'}});
  const group=device.createBindGroup({layout:pipeline.getBindGroupLayout(0),entries:[
   {binding:0,resource:{buffer:uniforms}},{binding:1,resource:shadows.csmTexture.view},
   {binding:2,resource:shadows.csmTexture.sampler},{binding:3,resource:shadows.farTexture.view},
   {binding:4,resource:shadows.farTexture.sampler},{binding:5,resource:{buffer:storage}},
  ]});
  const encoder=device.createCommandEncoder(),pass=encoder.beginComputePass();
  pass.setPipeline(pipeline);pass.setBindGroup(0,group);pass.dispatchWorkgroups(Math.ceil(points.length/64));pass.end();
  encoder.copyBufferToBuffer(storage,0,read,0,samples.byteLength);device.queue.submit([encoder.finish()]);
  await read.mapAsync(GPUMapMode.READ);
  const result=new Float32Array(read.getMappedRange());
  return points.map((point,i)=>({point,visibility:result[i*8+4]}));
 }finally{read.unmap();for(const b of resources)b.destroy();}
}
