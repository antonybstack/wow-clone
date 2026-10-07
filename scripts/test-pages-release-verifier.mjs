/** Actual CLI/HTTP release-gate controls; no game browser or deployed mutation. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {brotliCompressSync} from 'node:zlib';

const manifests=['region-actors-v1','human-identity-v1','human-shape-v1','startup/starter','startup/character'].map(dir=>`ashen-reach/${dir}/manifest.json`);
const asset='ashen-reach/human-identity-v1/body-0123456789ab.bin';
const wasm='physics/HavokPhysics-0123456789ab.wasm.br';
const hash=b=>createHash('sha256').update(b).digest('hex');
async function verify(overrides={}){
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'ashen-pages-verifier-')),dist=path.join(root,'dist'),out=path.join(root,'report.json');
 const fixtures=new Map([['index.html',Buffer.from('<!doctype html><title>game</title>')],['assets/v2/game-Abc.js',Buffer.from('export const ready = true;')],[asset,Buffer.from([1,2,3])],['HavokPhysics.wasm',Buffer.from([0,97,115,109,1,0,0,0])]]);
 fixtures.set(wasm,brotliCompressSync(fixtures.get('HavokPhysics.wasm')));
 for(const file of manifests)fixtures.set(file,Buffer.from(JSON.stringify({file})));
 for(const [file,bytes]of fixtures){await fs.mkdir(path.dirname(path.join(dist,file)),{recursive:true});await fs.writeFile(path.join(dist,file),bytes);}
 const server=http.createServer((req,res)=>{
  const file=new URL(req.url,'http://localhost').pathname.slice(1),bytes=fixtures.get(file),override=overrides[file]||{};
  const status=override.status??(bytes?200:404);
  const type=file.endsWith('.js')?'text/javascript':file.endsWith('.html')?'text/html':file===wasm?'application/wasm':'application/octet-stream';
  const cache=status!==200?'no-store':manifests.includes(file)?'no-cache':file==='index.html'?'public, max-age=60, must-revalidate':'public, max-age=31536000, immutable'+(file===wasm?', no-transform':'');
  res.writeHead(status,{'content-type':override.type??type,'cache-control':override.cache??cache,...(file===wasm&&status===200?{'content-encoding':'br'}:{})});
  res.end(override.body??(status===404?Buffer.from('missing'):bytes));
 });
 try{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const child=spawn(process.execPath,['scripts/character-assets/verify-pages-release.mjs',dist,`http://127.0.0.1:${server.address().port}`,out],{stdio:['ignore','pipe','pipe']});
  let stdout='',stderr='';child.stdout.on('data',v=>{stdout+=v;});child.stderr.on('data',v=>{stderr+=v;});
  const code=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',resolve);});
  return {code,stdout,stderr,rows:JSON.parse(await fs.readFile(out,'utf8')),fixtures};
 }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await fs.rm(root,{recursive:true,force:true});}
}
test('real HTTP bytes/MIME, five mutable policies, Brotli WASM and missing-path controls pass',async()=>{
 const result=await verify();assert.equal(result.code,0,result.stderr);
 assert.equal(JSON.parse(result.stdout).mutableManifestPoliciesChecked,5);
 for(const file of manifests){const row=result.rows.find(r=>r.file===file);assert(row.match&&row.cacheCorrect);assert.equal(row.actualSha256,hash(result.fixtures.get(file)));}
 const compressed=result.rows.find(r=>r.file===wasm);assert(compressed.match&&compressed.cacheCorrect);assert.equal(compressed.actualSha256,hash(result.fixtures.get('HavokPhysics.wasm')));
 assert.equal(result.rows.filter(r=>r.negativeControl&&r.match&&r.cacheCorrect&&r.actualSha256).length,2);
});
for(const file of manifests.slice(2))test(`correct bytes cannot excuse stale-cache policy on ${file}`,async()=>{
 const result=await verify({[file]:{cache:'public, max-age=31536000, immutable'}});assert.notEqual(result.code,0);
 const row=result.rows.find(r=>r.file===file);assert.equal(row.match,true);assert.equal(row.cacheCorrect,false);
});
test('missing immutable asset remains a failed delivery with correct independent error policy and hashes',async()=>{
 const result=await verify({[asset]:{status:404}});assert.notEqual(result.code,0);
 const row=result.rows.find(r=>r.file===asset);assert.equal(row.match,false);assert.equal(row.cacheCorrect,undefined);assert.equal(row.errorCacheCorrect,true);assert.equal(row.cachePolicy,'error-response');
 assert.equal(row.actualSha256,hash(Buffer.from('missing')));assert.equal(row.expectedSha256,hash(result.fixtures.get(asset)));
});
test('wrong executable MIME and equal bytes remain a failed bundle',async()=>{
 const result=await verify({'assets/v2/game-Abc.js':{type:'text/html'}});assert.notEqual(result.code,0);
 const row=result.rows.find(r=>r.file==='assets/v2/game-Abc.js');assert.equal(row.actualSha256,row.expectedSha256);assert.equal(row.match,false);
});
test('a mutable index served from an older release fails its decoded byte hash',async()=>{
 const file=manifests[1],result=await verify({[file]:{body:Buffer.from('{"older":true}')}});assert.notEqual(result.code,0);
 const row=result.rows.find(r=>r.file===file);assert.equal(row.cacheCorrect,true);assert.equal(row.match,false);assert.notEqual(row.actualSha256,row.expectedSha256);
});
