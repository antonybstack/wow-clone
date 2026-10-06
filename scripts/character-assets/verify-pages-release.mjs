/** Compare every served build artifact with the released public bytes.
 * fetch returns decoded HTTP bytes: a precompressed .br file must be decoded
 * locally before comparison, unlike an ordinary JS file compressed by the CDN.
 * https://developers.cloudflare.com/pages/configuration/headers/
 * https://fetch.spec.whatwg.org/#http-network-fetch
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
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
  const row={file,status:response.status,bytes:actual.length,match:response.ok&&hash(actual)===hash(expected)};
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
rows.sort((a,b)=>a.file.localeCompare(b.file));await fs.writeFile(out,JSON.stringify(rows,null,2));
assert(rows.every(r=>r.match&&r.cacheCorrect!==false),'Artifact or cache policy mismatch; inspect the report');console.log(JSON.stringify({checked:rows.length,matched:true,regionCachePoliciesChecked:rows.filter(r=>r.cacheCorrect&&r.file.includes('/region-actors-v1/')).length,identityCachePoliciesChecked:rows.filter(r=>r.cacheCorrect&&r.file.includes('/human-identity-v1/')).length}));
