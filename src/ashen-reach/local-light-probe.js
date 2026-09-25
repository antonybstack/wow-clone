/** Opt-in GPU samples use the exact shared surface/fog visibility functions. */
import {LOCAL_LIGHT_UNIFORMS,LOCAL_LIGHT_WGSL} from './local-light-shared.js';
import {LOCAL_SPECULAR_WGSL} from './local-specular.js';
export async function probeLocalLights(engine,controller,points){
 if(!points.length)return [];
 const device=engine._device,resources=[];
 const buffer=(size,usage)=>{const b=device.createBuffer({size,usage});resources.push(b);return b;};
 const data=new Float32Array(64),samples=new Float32Array(points.length*8);let offset=0;
 for(const spec of LOCAL_LIGHT_UNIFORMS){const value=controller.values[spec.name];data.set(value,offset);offset+=value.length;}
 points.forEach((p,i)=>samples.set([...p,1],i*8));
 const ubo=buffer(256,GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST);
 const storage=buffer(samples.byteLength,GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC);
 const read=buffer(samples.byteLength,GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST);
 try{
  device.queue.writeBuffer(ubo,0,data);device.queue.writeBuffer(storage,0,samples);
  const module=device.createShaderModule({code:`struct Params{${LOCAL_LIGHT_UNIFORMS.map(u=>`${u.name}:${u.type}`).join(',')}};
  struct Sample{p:vec4<f32>,result:vec4<f32>};
  @group(0) @binding(0) var<uniform> u:Params;
  @group(0) @binding(1) var localShadow0:texture_depth_2d;
  @group(0) @binding(2) var localShadow0Sampler:sampler_comparison;
  @group(0) @binding(3) var localShadow1:texture_depth_2d;
  @group(0) @binding(4) var localShadow1Sampler:sampler_comparison;
  @group(0) @binding(5) var<storage,read_write> samples:array<Sample>;
  ${LOCAL_LIGHT_WGSL.replaceAll('shaderUniforms.','u.')}
  ${LOCAL_SPECULAR_WGSL.replaceAll('shaderUniforms.','u.')}
  @compute @workgroup_size(64) fn main(@builtin(global_invocation_id) id:vec3<u32>){
   if(id.x>=arrayLength(&samples)){return;}let p=samples[id.x].p.xyz;
   let specular=localSpecular(p,vec3<f32>(0.0,1.0,0.0),vec3<f32>(0.0,1.0,0.0),.35,vec3<f32>(.04));
   samples[id.x].result=vec4<f32>(localVisibility0(p,vec3<f32>(0.0)),localVisibility1(p,vec3<f32>(0.0)),length(localIrradiance(p,vec3<f32>(0.0,1.0,0.0))),length(specular)*${controller.state.specular?'1.0':'0.0'});
  }`});
  const pipeline=device.createComputePipeline({layout:'auto',compute:{module,entryPoint:'main'}});
  const group=device.createBindGroup({layout:pipeline.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:ubo}},
   ...controller.slots.flatMap((s,i)=>[{binding:1+i*2,resource:s.texture.view},{binding:2+i*2,resource:s.texture.sampler}]),{binding:5,resource:{buffer:storage}}]});
  const enc=device.createCommandEncoder(),pass=enc.beginComputePass();pass.setPipeline(pipeline);pass.setBindGroup(0,group);pass.dispatchWorkgroups(Math.ceil(points.length/64));pass.end();enc.copyBufferToBuffer(storage,0,read,0,samples.byteLength);device.queue.submit([enc.finish()]);
  await read.mapAsync(GPUMapMode.READ);const out=new Float32Array(read.getMappedRange());return points.map((point,i)=>({point,visibility:[out[i*8+4],out[i*8+5]],irradiance:out[i*8+6],specular:out[i*8+7]}));
 }finally{read.unmap();for(const b of resources)b.destroy();}
}
