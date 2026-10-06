/** Deliver the pinned, unchanged Havok binary with build-time HTTP compression.
 * Keep Emscripten's native instantiateStreaming path: the browser decodes Brotli
 * and receives application/wasm. No JavaScript decompressor or second WASM loader.
 * https://developer.mozilla.org/en-US/docs/WebAssembly/Reference/JavaScript_interface/instantiateStreaming_static
 * https://developers.cloudflare.com/speed/optimization/content/compression/
 */
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {brotliCompressSync, constants} from 'node:zlib';

export const LEGACY_HAVOK_URL='/HavokPhysics.wasm?v=20260923-1';
export function prepareHavokDelivery(bytes) {
  if(!Buffer.from(bytes.subarray(0,8)).equals(Buffer.from([0,97,115,109,1,0,0,0])))
    throw Error('Havok delivery requires a WebAssembly v1 binary');
  const source=brotliCompressSync(bytes,{params:{[constants.BROTLI_PARAM_QUALITY]:11}});
  const hash=createHash('sha256').update(source).digest('hex');
  const fileName=`physics/HavokPhysics-${hash.slice(0,12)}.wasm.br`;
  return {source,fileName,url:`/${fileName}`};
}

export function havokDeliveryPlugin() {
  let prepared=null;
  return {
    name:'havok-http-brotli',
    // Vite config hooks run before HTML transforms. One URL drives both the
    // fetch preload and Havok's locateFile, including non-Pages production builds.
    // Development retains the existing public WASM endpoint.
    // https://vite.dev/guide/api-plugin.html#config
    config(_config,{command}) {
      prepared=command==='build'?prepareHavokDelivery(readFileSync('public/HavokPhysics.wasm')):null;
      return {define:{'import.meta.env.VITE_HAVOK_WASM_URL':JSON.stringify(prepared?.url||LEGACY_HAVOK_URL)}};
    },
    get url(){return prepared?.url||LEGACY_HAVOK_URL;},
    generateBundle(){if(prepared)this.emitFile({type:'asset',fileName:prepared.fileName,source:prepared.source});},
    configurePreviewServer(server) {
      server.middlewares.use((req,res,next)=>{
        if(/^\/physics\/HavokPhysics-[a-f0-9]{12}\.wasm\.br(?:\?|$)/.test(req.url||'')){
          res.setHeader('Content-Encoding','br');res.setHeader('Content-Type','application/wasm');
        }
        next();
      });
    },
  };
}
