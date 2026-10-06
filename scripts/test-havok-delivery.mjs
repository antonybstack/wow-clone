import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {brotliDecompressSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {prepareHavokDelivery,havokDeliveryPlugin,LEGACY_HAVOK_URL} from './ashen-reach/havok-delivery.mjs';

test('build delivery preserves the pinned WASM and changes its URL when bytes change',()=>{
  const raw=readFileSync('public/HavokPhysics.wasm'),prepared=prepareHavokDelivery(raw);
  assert.deepEqual(brotliDecompressSync(prepared.source),raw);
  assert.ok(prepared.source.length<raw.length*.3);
  assert.ok(prepared.fileName.includes(createHash('sha256').update(prepared.source).digest('hex').slice(0,12)));
  assert.equal(WebAssembly.validate(brotliDecompressSync(prepared.source)),true);
  const changed=Buffer.from(raw);changed[changed.length-1]^=1;
  assert.notEqual(prepareHavokDelivery(changed).url,prepared.url);
  assert.throws(()=>prepareHavokDelivery(Buffer.from('<html>fallback</html>')),/WebAssembly/);
});

test('HTML preload and runtime share the exact emitted URL; dev retains the public endpoint',()=>{
  const plugin=havokDeliveryPlugin(),emitted=[];
  const build=plugin.config({}, {command:'build'});
  assert.equal(JSON.parse(build.define['import.meta.env.VITE_HAVOK_WASM_URL']),plugin.url);
  plugin.generateBundle.call({emitFile:asset=>emitted.push(asset)});
  assert.equal(emitted.length,1);assert.equal('/'+emitted[0].fileName,plugin.url);
  assert.deepEqual(brotliDecompressSync(emitted[0].source),readFileSync('public/HavokPhysics.wasm'));
  const dev=plugin.config({}, {command:'serve'});
  assert.equal(JSON.parse(dev.define['import.meta.env.VITE_HAVOK_WASM_URL']),LEGACY_HAVOK_URL);
  plugin.generateBundle.call({emitFile:()=>assert.fail('dev must not emit another binary')});
});

test('preview applies streaming WASM MIME and HTTP decoding only to the generated namespace',()=>{
  let middleware;havokDeliveryPlugin().configurePreviewServer({middlewares:{use:fn=>{middleware=fn;}}});
  for(const [url,expected] of [['/physics/HavokPhysics-0123456789ab.wasm.br?probe=1',true],['/unrelated.br',false],['/HavokPhysics.wasm',false]]){
    const headers={};let next=0;
    middleware({url},{setHeader:(key,value)=>{headers[key]=value;}},()=>next++);
    assert.equal(next,1);assert.deepEqual(headers,expected?{'Content-Encoding':'br','Content-Type':'application/wasm'}:{});
  }
});
