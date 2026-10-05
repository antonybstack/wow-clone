import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {sealDist,verifySeal} from './character-assets/pages-seal.mjs';

const git=(repo,...args)=>execFileSync('git',['-c','user.name=seal-test','-c','user.email=seal@test.invalid','-c','commit.gpgsign=false',...args],{cwd:repo,stdio:'pipe'});
async function write(file,content){await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,content);}

// A real temporary repository and build: product inputs, an unrelated doc and a dist.
async function fixture(){
 const repo=await fs.mkdtemp(path.join(os.tmpdir(),'ashen-pages-seal-'));
 git(repo,'init','-q');
 for(const [file,content]of Object.entries({'src/main.js':'export const v=1;\n','public/HavokPhysics.wasm':'havok-1','public/_headers':'/*\n  X: y\n',
  'scripts/build.mjs':'// build\n','index.html':'<!doctype html>\n','vite.config.js':'export default {};\n','package.json':'{}\n','package-lock.json':'{}\n','docs/notes.md':'notes\n'}))
  await write(path.join(repo,file),content);
 git(repo,'add','-A');git(repo,'commit','-q','-m','product');
 const dist=path.join(repo,'dist');
 for(const [file,content]of Object.entries({'index.html':'<!doctype html>\n','HavokPhysics.wasm':'havok-1','_headers':'/*\n  X: y\n','assets/main-abc.js':'export const v=1;'}))
  await write(path.join(dist,file),content);
 const receipts=await fs.mkdtemp(path.join(os.tmpdir(),'ashen-pages-receipt-'));
 const sealPath=path.join(receipts,'seal.json');
 await sealDist({dist,out:sealPath,repo,scope:'test'});
 return {repo,dist,sealPath,cleanup:()=>Promise.all([repo,receipts].map(d=>fs.rm(d,{recursive:true,force:true})))};
}
const refuses=(f,pattern)=>assert.rejects(verifySeal({dist:f.dist,seal:f.sealPath,repo:f.repo}),pattern);

test('exact sealed bytes verify; a later docs-only commit is accepted and attributed to its HEAD',async()=>{
 const f=await fixture();try{
  const first=await verifySeal({dist:f.dist,seal:f.sealPath,repo:f.repo});
  assert.equal(first.verified,true);assert.equal(first.sameCommit,true);assert.equal(first.files,4);
  await write(path.join(f.repo,'docs/notes.md'),'release notes\n');await write(path.join(f.repo,'scripts/lib/__pycache__/x.pyc'),'cache');
  git(f.repo,'add','docs');git(f.repo,'commit','-q','-m','docs');
  const later=await verifySeal({dist:f.dist,seal:f.sealPath,repo:f.repo});
  assert.equal(later.sameCommit,false);assert.equal(later.head,git(f.repo,'rev-parse','HEAD').toString().trim());
 }finally{await f.cleanup();}
});

test('changed, extra, missing, _redirects and symlinked build files are refused',async()=>{
 const f=await fixture();try{
  const file=path.join(f.dist,'assets/main-abc.js'),original=await fs.readFile(file);
  await fs.writeFile(file,'export const v=2;');await refuses(f,/changed assets\/main-abc\.js/);await fs.writeFile(file,original);
  await write(path.join(f.dist,'_redirects'),'/a /b 301\n');await refuses(f,/extra _redirects/);await fs.rm(path.join(f.dist,'_redirects'));
  // A valid filename must not disappear through Object.prototype setters.
  await write(path.join(f.dist,'__proto__'),'unexpected artifact');await refuses(f,/extra __proto__/);await fs.rm(path.join(f.dist,'__proto__'));
  await fs.rm(path.join(f.dist,'_headers'));await refuses(f,/missing _headers/);await write(path.join(f.dist,'_headers'),'/*\n  X: y\n');
  await fs.symlink(path.join(f.repo,'docs/notes.md'),path.join(f.dist,'link.md'));await refuses(f,/symlink/);await fs.rm(path.join(f.dist,'link.md'));
  await verifySeal({dist:f.dist,seal:f.sealPath,repo:f.repo});
 }finally{await f.cleanup();}
});

test('a seal inside dist, a tampered seal or unsafe sealed paths are refused',async()=>{
 const f=await fixture();try{
  await assert.rejects(sealDist({dist:f.dist,out:path.join(f.dist,'seal.json'),repo:f.repo}),/outside the build directory/);
  await assert.rejects(sealDist({dist:f.dist,out:f.sealPath,repo:f.repo}),/EEXIST/);
  const seal=JSON.parse(await fs.readFile(f.sealPath,'utf8')),original=JSON.stringify(seal);
  seal.files['../escape.js']=seal.files['index.html'];await fs.writeFile(f.sealPath,JSON.stringify(seal));await refuses(f,/digest/);
  await fs.writeFile(f.sealPath,original);await verifySeal({dist:f.dist,seal:f.sealPath,repo:f.repo});
 }finally{await f.cleanup();}
});

test('uncommitted or committed product changes are refused; Havok must match',async()=>{
 const f=await fixture();try{
  await write(path.join(f.repo,'src/main.js'),'export const v=2;\n');await refuses(f,/Commit product inputs before upload: src\/main\.js/);
  git(f.repo,'commit','-q','-am','product change');await refuses(f,/differ from the sealed build/);
  git(f.repo,'revert','--no-edit','HEAD');await verifySeal({dist:f.dist,seal:f.sealPath,repo:f.repo});
  await write(path.join(f.repo,'public/untracked.bin'),'x');await refuses(f,/public\/untracked\.bin/);await fs.rm(path.join(f.repo,'public/untracked.bin'));
  await write(path.join(f.repo,'public/HavokPhysics.wasm'),'havok-2');git(f.repo,'commit','-q','-am','havok');await refuses(f,/HavokPhysics/);
 }finally{await f.cleanup();}
});
