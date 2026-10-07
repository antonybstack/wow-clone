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
]);
async function walk(dir){for(const e of await fs.readdir(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())await walk(p);else if(e.name!=='_headers'&&e.name!=='_redirects')files.push(p);}}
await walk(root);
let index=0;
await Promise.all(Array.from({length:8},async()=>{
 for(;;){const i=index++;if(i>=files.length)return;const p=files[i],file=path.relative(root,p);
  const row={file,status:null,bytes:null,actualSha256:null,expectedSha256:null,match:false};let stage='read-build';
  try{
  const encoded=await fs.readFile(p);row.sourceSha256=hash(encoded);
  stage='fetch';const response=await request(file);
  Object.assign(row,{status:response.status,responseType:response.headers.get('content-type'),cacheControl:response.headers.get('cache-control'),contentEncoding:response.headers.get('content-encoding'),cfRay:response.headers.get('cf-ray'),
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
  // Error bodies have their own policy; a missing immutable asset remains a
  // failed byte/status check, without mislabelling correct no-store as a bad
  // successful-asset cache policy. Keep the actual decoded body hash above.
  // https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cache-Control#no-store
  if(!response.ok){
    row.cacheControl=response.headers.get('cache-control');row.cachePolicy='error-response';
    row.errorCacheCorrect=row.cacheControl?.split(',').map(v=>v.trim()).includes('no-store')===true;
  }
  if(response.ok&&(file==='index.html'||file==='ashen-reach.html')){
    row.cacheControl=response.headers.get('cache-control');
    // Generated Early Hints must not replace the existing HTML cache rule.
    const directives=row.cacheControl?.split(',').map(value=>value.trim());
    row.cacheCorrect=['public','max-age=60','must-revalidate'].every(value=>directives?.includes(value))
      && !directives?.includes('max-age=0');
  }
  if(response.ok&&/^physics\/HavokPhysics-[a-f0-9]{12}\.wasm\.br$/.test(file)){
    row.type=response.headers.get('content-type');row.encoding=response.headers.get('content-encoding');row.cacheControl=response.headers.get('cache-control');
    row.cacheCorrect=Boolean(row.cacheControl?.includes('immutable')&&row.cacheControl?.includes('no-transform'));
    row.match&&=row.type==='application/wasm'&&row.encoding==='br'&&actual.equals(await fs.readFile(path.join(root,'HavokPhysics.wasm')));
  }
  // These mutable catalogues rotate immutable URLs. Checking only byte equality
  // would accept a deployment that strands returning clients on a stale index.
  // Authoring preparation.json is a receipt rather than a runtime descriptor.
  // Shape and starter indices rotate URLs too. Validate every published mutable
  // runtime index against its explicit _headers rule, retaining strict bytes.
  // https://developers.cloudflare.com/pages/configuration/headers/
  if(response.ok&&mutableManifests.has(file)){
    row.cacheControl=response.headers.get('cache-control');row.cachePolicy='mutable-manifest';
    row.cacheCorrect=row.cacheControl==='no-cache';
  }else if(response.ok&&(file.includes('/region-actors-v1/')||(file.includes('/human-identity-v1/')&&!file.endsWith('/preparation.json')))){
    row.cacheControl=response.headers.get('cache-control');row.cachePolicy='immutable-asset';
    row.cacheCorrect=Boolean(row.cacheControl?.includes('immutable')&&!row.cacheControl.includes('no-cache'));
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
  cacheControl,cacheCorrect:cacheControl?.split(',').map(v=>v.trim()).includes('no-store')===true,
 });
 }catch(error){row.match=false;row.failure=failure(error,stage);}
 rows.push(row);
}
rows.sort((a,b)=>a.file.localeCompare(b.file));await fs.writeFile(out,JSON.stringify(rows,null,2));
assert(rows.every(r=>r.match&&r.cacheCorrect!==false&&r.errorCacheCorrect!==false),'Artifact or cache policy mismatch; inspect the report');console.log(JSON.stringify({checked:rows.length,matched:true,mutableManifestPoliciesChecked:rows.filter(r=>r.cachePolicy==='mutable-manifest'&&r.cacheCorrect).length,regionCachePoliciesChecked:rows.filter(r=>r.cacheCorrect&&r.file.includes('/region-actors-v1/')).length,identityCachePoliciesChecked:rows.filter(r=>r.cacheCorrect&&r.file.includes('/human-identity-v1/')).length}));
