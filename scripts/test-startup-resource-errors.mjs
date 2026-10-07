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
