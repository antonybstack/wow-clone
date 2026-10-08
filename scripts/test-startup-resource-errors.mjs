import test from 'node:test';
import assert from 'node:assert/strict';
import {formatGameError} from '../src/ashen-reach/error-display.js';

test('a shared failed transfer retains URL/native cause and only retries on a new request',async()=>{
  const previous=globalThis.fetch,nativeError=new TypeError('Failed to fetch');let calls=0;
  globalThis.fetch=async()=>{calls++;if(calls===1)throw nativeError;return new Response(new Uint8Array([7]));};
  try{
    const api=await import('../src/ashen-reach/startup-fetch.js?resource-request');
    const asset={url:'/body-fixed.bin',bytes:1},early=api.startupAssetBuffer(asset);
    assert.equal(early,api.startupAssetBuffer(asset),'early/main must share the failed task');
    await assert.rejects(early,error=>{
      assert.match(error.message,/body-fixed\.bin: request failed/);
      assert.equal(error.cause,nativeError);return true;
    });
    assert.equal(calls,1,'reporting an error must not schedule a retry');
    assert.deepEqual(new Uint8Array(await api.startupAssetBuffer(asset)),new Uint8Array([7]));
    assert.equal(calls,2,'the failed task must release its cache slot');
  }finally{globalThis.fetch=previous;}
});

test('a 200 response whose body fails identifies decoding separately from the request',async()=>{
  const previous=globalThis.fetch,nativeError=new TypeError('Failed to fetch');
  globalThis.fetch=async()=>new Response(new ReadableStream({start(controller){controller.error(nativeError);}}),{status:200});
  try{
    const api=await import('../src/ashen-reach/startup-fetch.js?resource-body');
    await assert.rejects(api.startupAssetBuffer({url:'/body-after-200.bin',bytes:1}),error=>{
      assert.match(error.message,/body-after-200\.bin: body decoding failed/);
      assert.equal(error.cause,nativeError);return true;
    });
  }finally{globalThis.fetch=previous;}
});

test('manifest failures retain the requested URL and original status',async()=>{
  const previous=globalThis.fetch;
  globalThis.fetch=async()=>new Response('',{status:503});
  try{
    const api=await import('../src/ashen-reach/startup-fetch.js?resource-manifest');
    await assert.rejects(api.preloadHumanShapePack(),error=>{
      assert.match(error.message,/human-shape-v1\/manifest\.json: manifest read failed/);
      assert.match(error.cause.message,/HTTP 503/);return true;
    });
  }finally{globalThis.fetch=previous;}
});

test('native preparation errors preserve their complete formatted cause chain',async()=>{
  const api=await import('../src/ashen-reach/startup-fetch.js?resource-format');
  const nativeError=new TypeError('Image fetch failed');let captured;
  try{await api.withStartupResource('/sky.webp','sky preparation',()=>{throw nativeError;});}
  catch(error){captured=error;}
  assert.equal(captured.cause,nativeError);
  const text=await formatGameError(captured);
  assert.match(text,/Startup resource \/sky\.webp: sky preparation failed/);
  assert.match(text,/Caused by: TypeError: Image fetch failed/);
});

test('a size-valid corrupt buffer is released only by its validating consumer',async()=>{
  const previous=globalThis.fetch;let calls=0;
  globalThis.fetch=async()=>new Response(new Uint8Array(++calls===1?[9,9]:[1,2]));
  try{
    const api=await import('../src/ashen-reach/startup-fetch.js?resource-integrity');
    const asset={url:'/corrupt-rigid.glb',bytes:2};
    const bad=await api.startupAssetBuffer(asset);
    assert.equal(await api.startupAssetBuffer(asset),bad);
    assert.equal(calls,1);
    assert.equal(await api.startupAssetBuffer.invalidate(asset,bad.slice(0)),false,'another buffer must not evict the owner');
    assert.equal(await api.startupAssetBuffer.invalidate(asset,bad),true);
    assert.equal(calls,1,'invalidation must not start a retry');
    const good=await api.startupAssetBuffer(asset);
    assert.deepEqual(new Uint8Array(good),new Uint8Array([1,2]));
    assert.equal(calls,2);
    assert.equal(await api.startupAssetBuffer.invalidate(asset,bad),false,'a stale consumer must not evict the replacement');
    assert.equal(await api.startupAssetBuffer(asset),good);
    assert.equal(calls,2);
  }finally{globalThis.fetch=previous;}
});

test('a cleared old transfer cannot delete a newer cache generation when it fails',async()=>{
  const previous=globalThis.fetch;let rejectFirst,calls=0;
  globalThis.fetch=()=>++calls===1?new Promise((resolve,reject)=>{rejectFirst=reject;}):Promise.resolve(new Response(new Uint8Array([7])));
  try{
    const api=await import('../src/ashen-reach/startup-fetch.js?resource-generation');
    const asset={url:'/replaced-transfer.bin',bytes:1};
    const old=api.startupAssetBuffer(asset);
    api.clearStartupBuffers();
    const fresh=api.startupAssetBuffer(asset);
    rejectFirst(new TypeError('Old transfer failed'));
    await assert.rejects(old,/Old transfer failed/);
    await fresh;
    assert.equal(api.startupAssetBuffer(asset),fresh);
    assert.equal(calls,2);
  }finally{globalThis.fetch=previous;}
});
