/** Compare every served build artifact with the released public bytes.
 * fetch returns decoded HTTP bytes: a precompressed .br file must be decoded
 * locally before comparison, unlike an ordinary JS file compressed by the CDN.
 * https://developers.cloudflare.com/pages/configuration/headers/
 * https://fetch.spec.whatwg.org/#http-network-fetch
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {brotliDecompressSync} from 'node:zlib';
import assert from 'node:assert/strict';
const [root,base,out]=process.argv.slice(2);assert(root&&base&&out);
const files=[],rows=[],hash=b=>createHash('sha256').update(b).digest('hex');
const timeoutMs=Number(process.env.ASHEN_VERIFY_TIMEOUT_MS??30000);
assert(Number.isSafeInteger(timeoutMs)&&timeoutMs>0,'ASHEN_VERIFY_TIMEOUT_MS must be a positive integer');
// Keep the native failure chain, without dumping request headers/socket objects.
// A resolved fetch is only the response boundary; body consumption can still fail.
// https://fetch.spec.whatwg.org/#concept-body-consume-body
function failure(error,stage){
 const causes=[],seen=new Set();
 for(let current=error;current&&!seen.has(current)&&causes.length<8;current=current.cause){
  seen.add(current);causes.push({name:current.name??typeof current,message:current.message??String(current),...(current.code?{code:current.code}:{})});
 }
 return {stage,causes};
}
async function request(file){
 // Bound the whole response, including stalled bodies, using the native signal.
 // https://dom.spec.whatwg.org/#dom-abortsignal-timeout
 return fetch(new URL(file,base.endsWith('/')?base:base+'/'),{
  headers:{'accept-encoding':'br,gzip,deflate'},signal:AbortSignal.timeout(timeoutMs),
 });
}
const mutableManifests=new Set([
 'ashen-reach/region-actors-v1/manifest.json',
 'ashen-reach/human-identity-v1/manifest.json',
 'ashen-reach/human-shape-v1/manifest.json',
 'ashen-reach/startup/starter/manifest.json',
 'ashen-reach/startup/character/manifest.json',
 'ashen-reach/presence-v1/manifest.json',
]);
const immutableCache='public, max-age=31536000, immutable';
const htmlCache='public, max-age=60, must-revalidate';
// Cover the explicit families in public/_headers, including entry URLs that
// Pages serves without .html. Assets without a declared policy stay unclassified;
// do not invent an immutable policy for legacy unhashed textures or receipts.
// https://developers.cloudflare.com/pages/configuration/headers/
// https://developers.cloudflare.com/pages/configuration/serving-pages/#route-matching
function expectedCache(file){
 if(['index.html','ashen-reach.html','/','ashen-reach'].includes(file))return {policy:'html-entry',value:htmlCache};
 if(mutableManifests.has(file))return {policy:'mutable-manifest',value:'no-cache'};
 if(/^physics\/HavokPhysics-[a-f0-9]{12}\.wasm\.br$/.test(file))return {policy:'immutable-havok',value:immutableCache+', no-transform'};
 if(/^ashen-reach\/startup\/starter\/.+\.br$/.test(file))return {policy:'immutable-world',value:immutableCache+', no-transform'};
 if(file==='HavokPhysics.wasm')return {policy:'legacy-wasm',value:htmlCache};
 if(file.startsWith('assets/')||file.includes('/props/')||file.includes('/region-actors-v1/')
   ||(file.includes('/human-identity-v1/')&&!file.endsWith('/preparation.json'))
   ||/^ashen-reach\/human-shape-v1\/(?:.+\.bin|texture-.+)$/.test(file)
   ||file.startsWith('ashen-reach/presence-v1/collision-'))return {policy:'immutable-asset',value:immutableCache};
 return null;
}
// Cache directive names are case-insensitive. Compare complete directive sets,
// allowing order/whitespace/duplicate variation but rejecting conflicting TTLs,
// private/no-store additions and missing headers. No substring "immutable" pass.
// https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cache-Control
function cacheMatches(actual,expected){
 if(!actual)return false;
 const directives=value=>new Set(value.split(',').map(v=>v.trim().toLowerCase()).filter(Boolean));
 const wanted=directives(expected),got=directives(actual);
 return got.size===wanted.size&&[...wanted].every(v=>got.has(v));
}
async function walk(dir){for(const e of await fs.readdir(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())await walk(p);else if(e.name!=='_headers'&&e.name!=='_redirects')files.push(p);}}
await walk(root);
const artifacts=files.map(p=>({p,file:path.relative(root,p)}));
artifacts.push({p:path.join(root,'index.html'),file:'/',entryAlias:true},
 {p:path.join(root,'ashen-reach.html'),file:'ashen-reach',entryAlias:true});
let index=0;
await Promise.all(Array.from({length:8},async()=>{
 for(;;){const i=index++;if(i>=artifacts.length)return;const {p,file,entryAlias}=artifacts[i];
  const row={file,...(entryAlias?{entryAlias:true,expectedFile:path.relative(root,p)}:{}),status:null,bytes:null,actualSha256:null,expectedSha256:null,match:false};let stage='read-build';
  try{
  const encoded=await fs.readFile(p);row.sourceSha256=hash(encoded);
  stage='fetch';const response=await request(file);
  Object.assign(row,{status:response.status,resolvedUrl:response.url,responseType:response.headers.get('content-type'),cacheControl:response.headers.get('cache-control'),contentEncoding:response.headers.get('content-encoding'),cfRay:response.headers.get('cf-ray'),
    cfCacheStatus:response.headers.get('cf-cache-status'),age:response.headers.get('age')});
  stage='decode-build';const expected=file.endsWith('.br')&&response.headers.get('content-encoding')==='br'?brotliDecompressSync(encoded):encoded;
  row.expectedSha256=hash(expected);
  stage='read-response';const actual=Buffer.from(await response.arrayBuffer());
  const actualSha256=hash(actual),expectedSha256=hash(expected);
  Object.assign(row,{bytes:actual.length,actualSha256,expectedSha256,match:(response.ok||(file==='404.html'&&response.status===404))&&actualSha256===expectedSha256});
  stage='validate-response';
  // Byte equality alone can accept correct JS with a non-executable MIME type.
  // https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/X-Content-Type-Options
  const type=row.responseType?.split(';')[0].trim().toLowerCase();
  if(file.endsWith('.js'))row.match&&=['application/javascript','text/javascript'].includes(type);
  if(file.endsWith('.css'))row.match&&=type==='text/css';
  if(file.endsWith('.html')||entryAlias)row.match&&=type==='text/html';
  if(file.endsWith('.wasm'))row.match&&=type==='application/wasm';
  // Error bodies have their own policy; a missing immutable asset remains a
  // failed byte/status check, without mislabelling correct no-store as a bad
  // successful-asset cache policy. Keep the actual decoded body hash above.
  // https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cache-Control#no-store
  if(!response.ok){
    row.cacheControl=response.headers.get('cache-control');row.cachePolicy='error-response';
    row.errorCacheCorrect=row.cacheControl?.split(',').map(v=>v.trim().toLowerCase()).includes('no-store')===true;
  }
  if(response.ok){
    const expected=expectedCache(file);
    if(expected){
      row.cachePolicy=expected.policy;row.expectedCacheControl=expected.value;row.cacheCorrect=cacheMatches(row.cacheControl,expected.value);
      // Prepared world packets are transport-Brotli, not files the application
      // decompresses. Equal encoded bytes without this header cannot pass.
      if(expected.policy==='immutable-world')row.match&&=type==='application/octet-stream'&&row.contentEncoding==='br';
    }
    if(file.includes('/props/'))row.match&&=type==='model/gltf-binary';
  }
  if(response.ok&&/^physics\/HavokPhysics-[a-f0-9]{12}\.wasm\.br$/.test(file)){
    row.type=response.headers.get('content-type');row.encoding=response.headers.get('content-encoding');row.cacheControl=response.headers.get('cache-control');
    row.match&&=row.type==='application/wasm'&&row.encoding==='br'&&actual.equals(await fs.readFile(path.join(root,'HavokPhysics.wasm')));
  }
  }catch(error){row.match=false;row.failure=failure(error,stage);}
  rows.push(row);
 }
}));
// A top-level 404.html disables Pages' implicit SPA 200 fallback. Exercise both
// a missing bundle and a missing route; use a unique name to avoid old CDN rows.
// https://developers.cloudflare.com/pages/configuration/serving-pages/#not-found-behavior
for(const file of [`assets/v2/missing-${randomUUID()}.js`,`missing-${randomUUID()}`]){
 const row={file,negativeControl:true,status:null,bytes:null,actualSha256:null,match:false};let stage='fetch';
 try{
 const response=await request(file);
 Object.assign(row,{status:response.status,responseType:response.headers.get('content-type'),cfRay:response.headers.get('cf-ray'),
  cfCacheStatus:response.headers.get('cf-cache-status'),cacheControl:response.headers.get('cache-control')});
 stage='read-response';
 const actual=Buffer.from(await response.arrayBuffer());
 const cacheControl=response.headers.get('cache-control');
 Object.assign(row,{bytes:actual.length,actualSha256:hash(actual),match:response.status===404,
  cacheControl,cacheCorrect:cacheControl?.split(',').map(v=>v.trim().toLowerCase()).includes('no-store')===true,
 });
 }catch(error){row.match=false;row.failure=failure(error,stage);}
 rows.push(row);
}
rows.sort((a,b)=>a.file.localeCompare(b.file));await fs.writeFile(out,JSON.stringify(rows,null,2));
assert(rows.every(r=>r.match&&r.cacheCorrect!==false&&r.errorCacheCorrect!==false),'Artifact or cache policy mismatch; inspect the report');console.log(JSON.stringify({checked:rows.length,matched:true,mutableManifestPoliciesChecked:rows.filter(r=>r.cachePolicy==='mutable-manifest'&&r.cacheCorrect).length,htmlEntryPoliciesChecked:rows.filter(r=>r.cachePolicy==='html-entry'&&r.cacheCorrect).length,cachePoliciesChecked:rows.filter(r=>r.cacheCorrect===true).length,unclassifiedCachePolicies:rows.filter(r=>r.status===200&&r.cacheCorrect===undefined).length,regionCachePoliciesChecked:rows.filter(r=>r.cacheCorrect&&r.file.includes('/region-actors-v1/')).length,identityCachePoliciesChecked:rows.filter(r=>r.cacheCorrect&&r.file.includes('/human-identity-v1/')).length}));
