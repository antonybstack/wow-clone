/** Exercise real pinned native count/sync/invalidation semantics without a GPU.
 * Live receiver/color evidence remains necessary for cached bundle acceptance.
 */
import test from 'node:test';import assert from 'node:assert/strict';
globalThis.GPUBufferUsage={VERTEX:32,COPY_DST:8,STORAGE:128,INDIRECT:256};
const {syncThinInstanceForDraw}=await import('../node_modules/@babylonjs/lite/lib/mesh/thin-instance-gpu.js');
const nativeEpoch=await import('../node_modules/@babylonjs/lite/lib/engine/engine.js');
const {setDirectInstanceCount}=await import('../src/character/region-crowd/direct-count.js');
const {setThinInstances,removeThinInstance}=await import('@babylonjs/lite');
function setup(){const allocations=[],writes=[],scene={_renderableVersion:0},engine={_renderingContexts:[scene],_device:{createBuffer(d){const b={...d,destroy(){}};allocations.push(b);return b;},queue:{writeBuffer(...args){writes.push(args);}}}},mesh={};setThinInstances(mesh,new Float32Array(10*16),10);return {engine,mesh,scene,allocations,writes,gpu:{indexCount:6,indexFormat:'uint32'}};}
function sync(f){const args=syncThinInstanceForDraw(f.engine,f.mesh.thinInstances,false,f.gpu);assert.equal(args,null);assert.equal(f.mesh.thinInstances._drawArgsBuffer,undefined);assert.equal(f.mesh.thinInstances._drawArgsInstanceCount,f.mesh.thinInstances.count);}
test('real native direct pools preserve allocation and acknowledge every population transition',()=>{
 const f=setup();for(const count of [0,1,10]){const epoch=nativeEpoch._vis,version=f.scene._renderableVersion;setDirectInstanceCount(f.engine,f.mesh,count);assert(nativeEpoch._vis>epoch);assert.equal(f.scene._renderableVersion,version+1);sync(f);}
 const original=f.mesh.thinInstances._gpuBuffer;f.mesh.thinInstances.matrices[9*16+12]=91;removeThinInstance(f.mesh,3);assert.equal(f.mesh.thinInstances.matrices[3*16+12],91);
 const version=f.scene._renderableVersion;setDirectInstanceCount(f.engine,f.mesh,9);assert.equal(f.scene._renderableVersion,version+1);sync(f);
 for(const count of [0,1]){setDirectInstanceCount(f.engine,f.mesh,count);sync(f);}
 assert.equal(f.mesh.thinInstances._gpuBuffer,original);assert.equal(f.allocations.length,1);assert.equal(f.allocations[0].size,640);
});
test('native count already changed still invalidates unless the capture also matches',()=>{
 const f=setup();setDirectInstanceCount(f.engine,f.mesh,1);sync(f);const v=f.scene._renderableVersion;setDirectInstanceCount(f.engine,f.mesh,1);assert.equal(f.scene._renderableVersion,v);
 f.mesh.thinInstances.count=0;setDirectInstanceCount(f.engine,f.mesh,0);assert.equal(f.scene._renderableVersion,v+1);sync(f);
});
test('guard rejects indirect, culling, LOD and out-of-capacity pools before mutation',()=>{
 for(const flag of ['_drawArgsBuffer','_gpuCullingEnabled','_lodPartner','_lodSource']){const f=setup();f.mesh.thinInstances[flag]={};assert.throws(()=>setDirectInstanceCount(f.engine,f.mesh,1),/direct pool/);assert.equal(f.mesh.thinInstances.count,10);assert.equal(f.scene._renderableVersion,0);}
 const f=setup();for(const count of [-1,11,1.5,NaN])assert.throws(()=>setDirectInstanceCount(f.engine,f.mesh,count),/capacity/);assert.equal(f.scene._renderableVersion,0);
});
