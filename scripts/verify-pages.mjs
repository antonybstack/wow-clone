import {brotliDecompressSync} from 'node:zlib';
/** Compare the current Pages build's executable and critical static resources. */
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
const base=process.env.ASHEN_RELEASE_URL||'https://play.sparkify.dev',destination=process.argv[2];
if(!destination)throw Error('Usage: node scripts/verify-pages.mjs <report.json>');
async function walk(dir){const files=[];for(const e of await fs.readdir(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())files.push(...await walk(p));else files.push(p);}return files;}
const files=(await walk('dist')).filter(p=>p.endsWith('.js')||(p.includes('/ashen-reach/')&&/\.(png|jpe?g|webp)$/.test(p))||p.includes('/tex/')||p.includes('/startup/')||p.includes('/human-shape-v1/')||p.includes('/human-identity-v1/')||(p.includes('/remote-pieces/v1/')&&p.endsWith('.json'))||p.endsWith('/favicon.png')||/woodland|HavokPhysics|index.html|ashen-reach.html/.test(p));
const results=[];let cursor=0;
// Resolve against a directory URL so a trailing slash cannot produce //asset
// requests, which a server URL parser can interpret as a different host.
// https://nodejs.org/api/url.html#new-urlinput-base
// Match browser negotiation so a stale compressed preview cannot pass through
// a fresh uncompressed response. Fetch decodes HTTP content encodings for us.
// https://fetch.spec.whatwg.org/#http-network-fetch
await Promise.all(Array.from({length:6},async()=>{while(cursor<files.length){const file=files[cursor++],route=file.slice(5),response=await fetch(new URL(route+'?verify='+Date.now(),base.endsWith('/')?base:base+'/'),{cache:'no-store',headers:{'accept-encoding':'br,gzip,deflate'}}),stored=await fs.readFile(file),expected=file.endsWith('.br')?brotliDecompressSync(stored):stored,actual=Buffer.from(await response.arrayBuffer());results.push({path:route,status:response.status,type:response.headers.get('content-type'),encoding:response.headers.get('content-encoding'),match:expected.equals(actual),sha256:crypto.createHash('sha256').update(actual).digest('hex')});}}));
const failures=results.filter(r=>!r.match||r.status!==200||(/\.wasm(?:\.br)?$/.test(r.path)&&(!r.type?.includes('application/wasm')||(r.path.endsWith('.br')&&r.encoding!=='br'))));
await fs.mkdir(path.dirname(destination),{recursive:true});await fs.writeFile(destination,JSON.stringify({url:base,checked:results.length,passed:!failures.length,results},null,2));console.log(JSON.stringify({checked:results.length,failures}));if(failures.length)process.exitCode=1;
