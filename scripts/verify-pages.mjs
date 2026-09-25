/** Compare the current Pages build's executable and critical static resources. */
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
const base=process.env.ASHEN_RELEASE_URL||'https://play.sparkify.dev',destination=process.argv[2];
if(!destination)throw Error('Usage: node scripts/verify-pages.mjs <report.json>');
async function walk(dir){const files=[];for(const e of await fs.readdir(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())files.push(...await walk(p));else files.push(p);}return files;}
const files=(await walk('dist')).filter(p=>p.endsWith('.js')||p.includes('/tex/')||/woodland|HavokPhysics|index.html|ashen-reach.html/.test(p));
const results=[];let cursor=0;
await Promise.all(Array.from({length:6},async()=>{while(cursor<files.length){const file=files[cursor++],route=file.slice(5),response=await fetch(`${base}/${route}?verify=${Date.now()}`,{cache:'no-store'}),expected=await fs.readFile(file),actual=Buffer.from(await response.arrayBuffer());results.push({path:route,status:response.status,type:response.headers.get('content-type'),match:expected.equals(actual),sha256:crypto.createHash('sha256').update(actual).digest('hex')});}}));
const failures=results.filter(r=>!r.match||r.status!==200||(r.path==='HavokPhysics.wasm'&&!r.type?.includes('application/wasm')));
await fs.mkdir(path.dirname(destination),{recursive:true});await fs.writeFile(destination,JSON.stringify({url:base,checked:results.length,passed:!failures.length,results},null,2));console.log(JSON.stringify({checked:results.length,failures}));if(failures.length)process.exitCode=1;
