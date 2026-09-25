/** Opt-in compute diagnostic; uses the live renderer's device and shared WGSL. */
import {FOLIAGE_LOD_WGSL} from './foliage-lod.js';

/**
 * roots: array of [x,z] pairs, packed to float32 exactly as instance roots are.
 * Returns [{root:[x,z], seed, end, moorEnd, scale}], where scale samples end-2.
 * Seed should match CPU exactly; radius/scale comparisons need f32 tolerance.
 * No scene tasks, material changes, or persistent GPU resources are installed.
 */
export async function probeFoliageLod(engine, roots) {
 if (!roots.length) return [];
 const device = engine._device, count = roots.length, bytes = count * 32;
 if (bytes > device.limits.maxStorageBufferBindingSize || bytes > device.limits.maxBufferSize ||
  Math.ceil(count / 64) > device.limits.maxComputeWorkgroupsPerDimension) {
  throw new RangeError('Foliage LOD probe exceeds device buffer/dispatch limits');
 }
 const data = new Float32Array(count * 8);
 for (let i = 0; i < count; i++) {
  const root = roots[i];
  if (!root || root.length !== 2) throw new TypeError('Foliage LOD roots must be [x,z] pairs');
  for (let axis = 0; axis < 2; axis++) {
   const value = Math.fround(root[axis]), grid = Math.floor(value * 16);
   if (!Number.isFinite(value) || grid < -2147483648 || grid > 2147483647) {
    throw new RangeError('Foliage LOD root must quantize to a finite signed 32-bit coordinate');
   }
   data[i * 8 + axis] = value;
  }
 }
 const resources = [];
 const buffer = (label, usage) => {
  const result = device.createBuffer({label, size: bytes, usage});
  resources.push(result);
  return result;
 };
 let read;
 try {
  // Pop all scopes synchronously after submission, before yielding to game frames.
  device.pushErrorScope('validation');
  device.pushErrorScope('out-of-memory');
  device.pushErrorScope('internal');
  let submissionError, scopeResults;
  try {
   const storage = buffer('foliage-lod-probe-storage', GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC);
   read = buffer('foliage-lod-probe-readback', GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST);
   device.queue.writeBuffer(storage, 0, data);
   const module = device.createShaderModule({label: 'foliage-lod-probe', code: `
    struct Sample { root: vec4<f32>, result: vec4<f32> };
    @group(0) @binding(0) var<storage, read_write> samples: array<Sample>;
    ${FOLIAGE_LOD_WGSL}
    @compute @workgroup_size(64)
    fn main(@builtin(global_invocation_id) id: vec3<u32>) {
     if (id.x >= arrayLength(&samples)) { return; }
     let seed = foliagePlantHash(samples[id.x].root.xy);
     let end = foliageRemovalRadius(seed, 28.0, 0.72, 1.0);
     let moorEnd = foliageRemovalRadius(seed, 185.0, 0.85, 0.9);
     samples[id.x].result = vec4<f32>(seed, end, moorEnd, foliageScale(end - 2.0, end));
    }
   `});
   const pipeline = device.createComputePipeline({label: 'foliage-lod-probe', layout: 'auto', compute: {module, entryPoint: 'main'}});
   const group = device.createBindGroup({layout: pipeline.getBindGroupLayout(0), entries: [{binding: 0, resource: {buffer: storage}}]});
   const encoder = device.createCommandEncoder({label: 'foliage-lod-probe'});
   const pass = encoder.beginComputePass();
   pass.setPipeline(pipeline); pass.setBindGroup(0, group);
   pass.dispatchWorkgroups(Math.ceil(count / 64)); pass.end();
   encoder.copyBufferToBuffer(storage, 0, read, 0, bytes);
   device.queue.submit([encoder.finish()]);
  } catch (error) {
   submissionError = error;
  } finally {
   scopeResults = await Promise.allSettled([device.popErrorScope(), device.popErrorScope(), device.popErrorScope()]);
  }
  if (submissionError) throw submissionError;
  for (const result of scopeResults) {
   if (result.status === 'rejected') throw result.reason;
   if (result.value) throw new Error(`Foliage LOD GPU probe: ${result.value.message}`);
  }
  await read.mapAsync(GPUMapMode.READ);
  const output = new Float32Array(read.getMappedRange());
  return Array.from({length: count}, (_, i) => ({
   root: [data[i * 8], data[i * 8 + 1]], seed: output[i * 8 + 4],
   end: output[i * 8 + 5], moorEnd: output[i * 8 + 6], scale: output[i * 8 + 7],
  }));
 } finally {
  if (read?.mapState === 'mapped') read.unmap();
  for (const resource of resources) resource.destroy();
 }
}
