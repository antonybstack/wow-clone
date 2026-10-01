import test from 'node:test';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {createRequestQueue} from '../src/character/region-crowd/request-queue.js';
import {acquireRegionAsset,regionAssetCacheSnapshot} from '../src/character/region-crowd/asset-cache.js';
const deferred=()=>{let resolve;return {promise:new Promise(r=>resolve=r),resolve:(...a)=>resolve(...a)};};
const tick=()=>new Promise(r=>setImmediate(r));
test('queue admission is bounded, preserves admitted work, coalesces and prioritizes',async()=>{
 const gate=deferred(),order=[],q=createRequestQueue({limit:4});const a=q.submit('active',2,async current=>{await gate.promise;return {status:current()?'applied':'superseded'};});await tick();
 const low=q.submit('low',4,async()=>{order.push('low');return 4;});const replaced=q.submit('target',3,()=>assert.fail());const high=q.submit('target',0,async()=>{order.push('target');return 0;});const middle=q.submit('near',2,async()=>{order.push('near');return 2;});
 assert.throws(()=>q.submit('overflow',0,()=>assert.fail()),/full/);assert.equal(q.snapshot().pending,3);assert.equal(q.snapshot().active,1);assert.equal((await replaced).status,'superseded');gate.resolve();await Promise.all([a,low,high,middle]);assert.deepEqual(order,['target','near','low']);assert.equal(q.snapshot().peakPending,3);
});
test('closing a queue cancels waiting work and drains an uninterruptible native operation',async()=>{
 const gate=deferred(),q=createRequestQueue();let drained=false;const running=q.submit('active',0,async current=>{await gate.promise;return {status:current()?'applied':'superseded'};});await tick();const pending=q.submit('waiting',1,()=>assert.fail());const done=q.close().then(()=>drained=true);await tick();assert(!drained);assert.equal((await pending).status,'superseded');gate.resolve();await done;assert.equal((await running).status,'superseded');assert.equal(q.snapshot().pending,0);assert.equal((await q.submit('late',0,()=>assert.fail())).status,'disposed');
});
test('one cancelled byte consumer does not abort another; final lease clears storage',async()=>{
 const buffer=new Uint8Array([1,2,3,4]).buffer,hash=createHash('sha256').update(new Uint8Array(buffer)).digest('hex'),gate=deferred();let calls=0;
 globalThis.fetch=async(_url,{signal})=>{calls++;await gate.promise;signal.throwIfAborted();return {ok:true,arrayBuffer:async()=>buffer};};
 const a=new AbortController(),b=new AbortController(),one=acquireRegionAsset('/immutable',hash,4,a.signal),two=acquireRegionAsset('/immutable',hash,4,b.signal);a.abort();await assert.rejects(one.promise);gate.resolve();assert.equal(await two.promise,buffer);assert.equal(calls,1);assert.equal(regionAssetCacheSnapshot().leases,1);two.release();two.release();assert.equal(regionAssetCacheSnapshot().reservedBytes,0);
});
test('failed verification is retriable and hash/size/ceiling cannot be bypassed',async()=>{
 const buffer=new Uint8Array([7,8]).buffer,hash=createHash('sha256').update(new Uint8Array(buffer)).digest('hex'),signal=new AbortController().signal;
 globalThis.fetch=async()=>({ok:true,arrayBuffer:async()=>new Uint8Array([4,5]).buffer});const bad=acquireRegionAsset('/bad',hash,2,signal);await assert.rejects(bad.promise,/hash mismatch/);assert.equal(regionAssetCacheSnapshot().reservedBytes,0);
 globalThis.fetch=async()=>({ok:true,arrayBuffer:async()=>buffer});const good=acquireRegionAsset('/good',hash,2,signal);assert.equal(await good.promise,buffer);assert.throws(()=>acquireRegionAsset('/conflict',hash,3,signal),/Conflicting/);assert.throws(()=>acquireRegionAsset('/large','0'.repeat(64),9*1024*1024,signal),/ceiling/);good.release();assert.equal(regionAssetCacheSnapshot().entries,0);
});

test('active identity can replace its revision when all unique slots are occupied',async()=>{
 const gate=deferred(),q=createRequestQueue({limit:2});const active=q.submit('actor',1,async current=>{await gate.promise;return {status:current()?'applied':'superseded'};});await tick();const other=q.submit('other',2,async()=>({status:'applied'}));const latest=q.submit('actor',0,async()=>({status:'applied',revision:2}));assert.equal(q.snapshot().uniqueIds,2);assert.equal(q.snapshot().pending,2);assert.throws(()=>q.submit('new',0,()=>assert.fail()),/full/);gate.resolve();assert.equal((await active).status,'superseded');assert.equal((await latest).revision,2);await other;
});
