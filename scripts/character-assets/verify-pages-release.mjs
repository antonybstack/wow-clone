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
async function walk(dir){for(const e of await fs.readdir(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())await walk(p);else if(e.name!=='_headers'&&e.name!=='_redirects')files.push(p);}}
await walk(root);
let index=0;
await Promise.all(Array.from({length:8},async()=>{
 for(;;){const i=index++;if(i>=files.length)return;const p=files[i],file=path.relative(root,p),response=await fetch(new URL(file,base.endsWith('/')?base:base+'/'),{headers:{'accept-encoding':'br,gzip,deflate'}});const actual=Buffer.from(await response.arrayBuffer());
  const encoded=await fs.readFile(p),expected=file.endsWith('.br')&&response.headers.get('content-encoding')==='br'?brotliDecompressSync(encoded):encoded;
  const row={file,status:response.status,bytes:actual.length,match:(response.ok||(file==='404.html'&&response.status===404))&&hash(actual)===hash(expected),
    responseType:response.headers.get('content-type'),cfRay:response.headers.get('cf-ray'),
    cfCacheStatus:response.headers.get('cf-cache-status'),age:response.headers.get('age')};
  // Byte equality alone can accept correct JS with a non-executable MIME type.
  // https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/X-Content-Type-Options
  const type=row.responseType?.split(';')[0].trim().toLowerCase();
  if(file.endsWith('.js'))row.match&&=['application/javascript','text/javascript'].includes(type);
  if(file.endsWith('.css'))row.match&&=type==='text/css';
  if(file==='index.html'||file==='ashen-reach.html'){
    row.cacheControl=response.headers.get('cache-control');
    // Generated Early Hints must not replace the existing HTML cache rule.
    const directives=row.cacheControl?.split(',').map(value=>value.trim());
    row.cacheCorrect=['public','max-age=60','must-revalidate'].every(value=>directives?.includes(value))
      && !directives?.includes('max-age=0');
  }
  if(/^physics\/HavokPhysics-[a-f0-9]{12}\.wasm\.br$/.test(file)){
    row.type=response.headers.get('content-type');row.encoding=response.headers.get('content-encoding');row.cacheControl=response.headers.get('cache-control');
    row.cacheCorrect=row.cacheControl?.includes('immutable')&&row.cacheControl?.includes('no-transform');
    row.match&&=row.type==='application/wasm'&&row.encoding==='br'&&actual.equals(await fs.readFile(path.join(root,'HavokPhysics.wasm')));
  }
  // These mutable catalogues rotate immutable URLs. Checking only byte equality
  // would accept a deployment that strands returning clients on a stale index.
  // Authoring preparation.json is a receipt rather than a runtime descriptor.
  if(file.includes('/region-actors-v1/')||(file.includes('/human-identity-v1/')&&!file.endsWith('/preparation.json'))){row.cacheControl=response.headers.get('cache-control');const mutable=file.endsWith('/manifest.json');row.cacheCorrect=mutable?row.cacheControl==='no-cache':row.cacheControl?.includes('immutable')&&!row.cacheControl.includes('no-cache');}
  rows.push(row);
 }
}));
// A top-level 404.html disables Pages' implicit SPA 200 fallback. Exercise both
// a missing bundle and a missing route; use a unique name to avoid old CDN rows.
// https://developers.cloudflare.com/pages/configuration/serving-pages/#not-found-behavior
for(const file of [`assets/v2/missing-${randomUUID()}.js`,`missing-${randomUUID()}`]){
 const response=await fetch(new URL(file,base.endsWith('/')?base:base+'/'));
 await response.arrayBuffer();
 const cacheControl=response.headers.get('cache-control');
 rows.push({file,negativeControl:true,status:response.status,match:response.status===404,
  cacheControl,cacheCorrect:cacheControl?.split(',').map(v=>v.trim()).includes('no-store')===true,
  responseType:response.headers.get('content-type'),cfRay:response.headers.get('cf-ray'),
  cfCacheStatus:response.headers.get('cf-cache-status')});
}
rows.sort((a,b)=>a.file.localeCompare(b.file));await fs.writeFile(out,JSON.stringify(rows,null,2));
assert(rows.every(r=>r.match&&r.cacheCorrect!==false),'Artifact or cache policy mismatch; inspect the report');console.log(JSON.stringify({checked:rows.length,matched:true,regionCachePoliciesChecked:rows.filter(r=>r.cacheCorrect&&r.file.includes('/region-actors-v1/')).length,identityCachePoliciesChecked:rows.filter(r=>r.cacheCorrect&&r.file.includes('/human-identity-v1/')).length}));
