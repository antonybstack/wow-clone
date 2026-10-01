/** Verified immutable bytes shared by compatible consumers, never decoded live
 * skeletons. Abort releases only the caller's lease; the final consumer aborts
 * the fetch. Rejected or unowned buffers are not retained as a second cache.
 * https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/digest
 * https://developer.mozilla.org/en-US/docs/Web/API/AbortController
 */
import {REGION_IMMUTABLE_BYTES} from './streaming-policy.js';
const entries=new Map();const ceiling=REGION_IMMUTABLE_BYTES;
let reserved=0,peak=0;
export function acquireRegionAsset(url,hash,bytes,signal) {
 signal.throwIfAborted();
 if(!/^[0-9a-f]{64}$/.test(hash)||!Number.isSafeInteger(bytes)||bytes<1)throw Error('Asset needs a concrete hash and byte size');
 let entry=entries.get(hash);
 if(entry&&entry.bytes!==bytes)throw Error('Conflicting asset size');
 if(!entry){
  if(reserved+bytes>ceiling)throw RangeError('Immutable region asset ceiling exceeded');
  const controller=new AbortController();entry={hash,bytes,refs:0,controller};entries.set(hash,entry);reserved+=bytes;peak=Math.max(peak,reserved);
  entry.promise=(async()=>{
   const response=await fetch(url,{signal:controller.signal});if(!response.ok)throw Error(`Crowd asset HTTP ${response.status}: ${url}`);
   // Check declared and actual size. Trusted manifests cap reservation before
   // allocation; a mismatched response is rejected before it reaches a decoder.
   const length=response.headers?.get('content-length'),encoding=response.headers?.get('content-encoding');if(length&&!encoding&&Number(length)!==bytes)throw Error('Asset content length mismatch');
   const buffer=await response.arrayBuffer();if(buffer.byteLength!==bytes)throw Error('Asset byte size mismatch');
   const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',buffer)),b=>b.toString(16).padStart(2,'0')).join('');
   if(digest!==hash)throw Error(`Crowd asset hash mismatch: ${url}`);return buffer;
  })();
 }
 entry.refs++;let released=false,rejectAbort;
 const release=()=>{if(released)return;released=true;signal.removeEventListener('abort',abort);if(--entry.refs===0){entry.controller.abort();if(entries.get(hash)===entry){entries.delete(hash);reserved-=bytes;}}};
 const abort=()=>{release();rejectAbort(signal.reason||new DOMException('Aborted','AbortError'));};
 const aborted=new Promise((_,reject)=>{rejectAbort=reject;});signal.addEventListener('abort',abort,{once:true});
 const promise=Promise.race([entry.promise,aborted]).catch(error=>{release();throw error;});
 return {promise,release};
}
export function regionAssetCacheSnapshot(){return {entries:entries.size,reservedBytes:reserved,peakReservedBytes:peak,ceilingBytes:ceiling,leases:[...entries.values()].reduce((n,e)=>n+e.refs,0)};}
