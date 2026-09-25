export const fogPixels=page=>page.evaluate(async()=>{
 const d=ASHEN.engine._device,rt=ASHEN.volumetric.fogRT,bytes=96*54*4;
 const out=d.createBuffer({size:bytes,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC}),read=d.createBuffer({size:bytes,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST});
 try{
  const module=d.createShaderModule({code:`@group(0) @binding(0) var fog:texture_2d<f32>;@group(0) @binding(1) var<storage,read_write> out:array<f32>;
   @compute @workgroup_size(64) fn main(@builtin(global_invocation_id) id:vec3<u32>){if(id.x>=5184u){return;}let uv=(vec2<f32>(f32(id.x%96u),f32(id.x/96u))+.5)/vec2<f32>(96.0,54.0);out[id.x]=textureLoad(fog,vec2<i32>(uv*vec2<f32>(textureDimensions(fog))),0).r;}`});
  const pipeline=d.createComputePipeline({layout:'auto',compute:{module,entryPoint:'main'}}),group=d.createBindGroup({layout:pipeline.getBindGroupLayout(0),entries:[{binding:0,resource:rt._colorView},{binding:1,resource:{buffer:out}}]});
  const enc=d.createCommandEncoder(),pass=enc.beginComputePass();pass.setPipeline(pipeline);pass.setBindGroup(0,group);pass.dispatchWorkgroups(81);pass.end();enc.copyBufferToBuffer(out,0,read,0,bytes);d.queue.submit([enc.finish()]);await read.mapAsync(GPUMapMode.READ);return Array.from(new Float32Array(read.getMappedRange()));
 }finally{read.unmap();read.destroy();out.destroy();}
});
