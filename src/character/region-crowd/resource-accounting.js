/** Lower-bound allocation accounting, deduplicated by native GPU object. It
 * excludes pipeline caches, driver padding and queued retirements. This is a
 * diagnostic read of pinned Lite fields, never a disposal/ref-count substitute.
 * https://github.com/BabylonJS/Babylon-Lite/blob/npm-lite-v1.31.1/packages/babylon-lite/src/resource/ref-count.ts
 * https://developer.mozilla.org/en-US/docs/Web/API/GPUBuffer/size
 */
export function accountRegionResources(resources) {
 const buffers=new Set(),textures=new Set(),cpu=new Set();
 const addBuffer=b=>{if(b&&Number.isFinite(b.size))buffers.add(b);};
 const addTexture=t=>{if(t&&Number.isFinite(t.width)&&t.format)textures.add(t);};
 const addCpu=a=>{if(ArrayBuffer.isView(a))cpu.add(a.buffer);};
 for(const r of resources)if(!r.disposed)for(const m of r.meshes){
  for(const b of Object.values(m._gpu||{}))addBuffer(b);
  const skeleton=m.skeleton;
  for(const key of ['jointsBuffer','weightsBuffer','joints1Buffer','weights1Buffer'])addBuffer(skeleton?.[key]);
  addTexture(skeleton?.boneTexture);for(const key of ['joints','weights','joints1','weights1','boneMatrices'])addCpu(skeleton?.[key]);
  addBuffer(m.morphTargets?.deltasBuffer);addBuffer(m.morphTargets?.weightsBuffer);addCpu(m.morphTargets?.weights);
  for(const t of m.morphTargets?.targets||[]){addCpu(t.positions);addCpu(t.normals);}
  addBuffer(m.thinInstances?._gpuBuffer);addBuffer(m.thinInstances?._drawArgsBuffer);addCpu(m.thinInstances?.matrices);
  addTexture(m.vat?.texture);addTexture(m.vat?.instanceParamsTexture);
  for(const v of Object.values(m.material||{}))addTexture(v?.texture);
 }
 const bytesPerTexel={rgba8unorm:4,'rgba8unorm-srgb':4,bgra8unorm:4,'bgra8unorm-srgb':4,rgba16float:8,rgba32float:16,rg32float:8,r32float:4,depth32float:4};
 let textureBytes=0,unknownTextureFormats=0;
 for(const t of textures){const bpp=bytesPerTexel[t.format];if(!bpp){unknownTextureFormats++;continue;}for(let level=0;level<(t.mipLevelCount||1);level++)textureBytes+=Math.max(1,t.width>>level)*Math.max(1,t.height>>level)*(t.depthOrArrayLayers||1)*bpp;}
 return {buffers:buffers.size,textures:textures.size,bufferBytes:[...buffers].reduce((n,b)=>n+b.size,0),textureBytes,unknownTextureFormats,knownCpuBytes:[...cpu].reduce((n,b)=>n+b.byteLength,0),scope:'Owned mesh geometry/skin/morph/thin/VAT/material handles only; total GPU/driver memory unknown'};
}
