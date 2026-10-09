import test from 'node:test';
import assert from 'node:assert/strict';
import {readRegionBlocks} from '../src/ashen-reach/region-stream.js';
const packet={rawBytes:24,blocks:[
  {meshId:0,attributes:{positions:{offset:0,length:3}}},
  {meshId:1,attributes:{indices:{offset:12,length:3}}},
]};
const bytes=new Uint8Array(24);
new Float32Array(bytes.buffer,0,3).set([1,2,3]);
new Uint32Array(bytes.buffer,12,3).set([2,1,0]);
const collect=async(response,meta=packet)=>{const result=[];for await(const b of readRegionBlocks(response,meta))result.push(b);return result;};
test('native stream yields first exact block before the remainder arrives',async()=>{
  let controller;
  const stream=new ReadableStream({start(c){controller=c;}});
  const blocks=readRegionBlocks(new Response(stream),packet);
  controller.enqueue(bytes.subarray(0,12));
  const first=await blocks.next();
  assert.deepEqual([...first.value.buffers.positions],[1,2,3]);
  assert.equal(first.value.buffers.positions.buffer.byteLength,12);
  controller.enqueue(bytes.subarray(12));controller.close();
  const second=await blocks.next();assert.deepEqual([...second.value.buffers.indices],[2,1,0]);
  assert.equal((await blocks.next()).done,true);
});
test('arbitrary native chunk boundaries keep identical typed arrays',async()=>{
  for(const size of [1,7,13,24]){
    const stream=new ReadableStream({start(c){for(let offset=0;offset<bytes.length;offset+=size)c.enqueue(bytes.subarray(offset,offset+size));c.close();}});
    const result=await collect(new Response(stream));
    assert.deepEqual([...result[0].buffers.positions],[1,2,3]);assert.deepEqual([...result[1].buffers.indices],[2,1,0]);
  }
});
test('truncated body cannot complete geometry',async()=>{
  await assert.rejects(collect(new Response(bytes.subarray(0,23))),/truncated/);
});
test('trailing bytes cannot complete geometry',async()=>{
  await assert.rejects(collect(new Response(new Uint8Array(25))),/trailing/);
});
test('invalid metadata is refused before reading the body',async()=>{
  for(const change of [p=>{p.blocks[1].attributes.indices.offset=16;},p=>{p.rawBytes=28;},p=>{p.blocks[0].attributes.positions.length=-1;}]){
    const meta=structuredClone(packet);change(meta);await assert.rejects(collect(new Response(bytes),meta),/range|cover|exceeds/);
  }
});
test('leaving installation cancels and unlocks the native reader',async()=>{
  let cancelled=false;
  const stream=new ReadableStream({start(c){c.enqueue(bytes.subarray(0,12));},cancel(){cancelled=true;}});
  const blocks=readRegionBlocks(new Response(stream),packet);await blocks.next();await blocks.return();
  assert(cancelled);assert.equal(stream.locked,false);
});
test('native network errors propagate',async()=>{
  const stream=new ReadableStream({start(c){c.error(Error('transport failure'));}});
  await assert.rejects(collect(new Response(stream)),/transport failure/);
});
