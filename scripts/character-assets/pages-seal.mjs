#!/usr/bin/env node
/** Seal one gated Pages `dist`, then upload exactly those bytes without rebuilding.
 *
 *   node scripts/character-assets/pages-seal.mjs seal   --dist dist --out <file outside dist> [--scope "<text>"]
 *   node scripts/character-assets/pages-seal.mjs verify --dist dist --seal <file>
 *
 * A seal hashes every regular file in dist, including _headers/_redirects, and
 * fingerprints the product inputs that produced it (git blob ids of src, public,
 * scripts, root HTML, Vite config and package files, including uncommitted and
 * untracked files). Verification refuses changed, missing or extra files,
 * symlinks, unsafe paths, a seal stored inside dist, uncommitted product inputs,
 * and inputs that differ from the sealed build. A later documentation-only commit
 * is accepted because the product fingerprint is unchanged; the upload is then
 * attributed to the current HEAD, which is verified to contain those exact inputs.
 * https://git-scm.com/docs/git-ls-files  https://git-scm.com/docs/git-hash-object
 * https://developers.cloudflare.com/pages/configuration/headers/
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

export const SEAL_KIND='ashen-pages-dist-seal';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
// Interpreter caches beside hook/helper scripts are not product inputs.
const noise=file=>/(^|\/)__pycache__\//.test(file)||file.endsWith('.pyc');
const git=(repo,args,input)=>execFileSync('git',args,{cwd:repo,input,maxBuffer:1<<30,stdio:['pipe','pipe','pipe']});
const split0=bytes=>bytes.toString('utf8').split('\0').filter(Boolean);

export async function productPaths(repo){
 const html=(await fs.readdir(repo)).filter(name=>name.endsWith('.html')).sort();
 return ['src','public','scripts',...html,'vite.config.js','package.json','package-lock.json'];
}

/** Product paths with uncommitted or untracked changes (git status, NUL-separated). */
export function dirtyProductPaths(repo,paths){
 const tokens=split0(git(repo,['status','--porcelain=v1','-z','--untracked-files=all','--',...paths])),dirty=[];
 for(let i=0;i<tokens.length;i++){
  const status=tokens[i].slice(0,2),file=tokens[i].slice(3);
  if(status[0]==='R'||status[0]==='C')i++; // the next token is the rename source
  if(!noise(file))dirty.push(file);
 }
 return dirty.sort();
}

/** Working-tree fingerprint of the product inputs, stable across committing them. */
export async function productInputsSha256(repo,paths){
 const entries=new Map();
 for(const line of split0(git(repo,['ls-files','-s','-z','--',...paths]))){
  const [meta,file]=line.split('\t'),[mode,blob]=meta.split(' ');
  if(!noise(file))entries.set(file,`${mode} ${blob}`);
 }
 const dirty=dirtyProductPaths(repo,paths),hash=[];
 for(const file of dirty){
  const stat=await fs.lstat(path.join(repo,file)).catch(()=>null);
  if(!stat){entries.delete(file);continue;}
  if(stat.isSymbolicLink()){entries.set(file,`120000 ${sha(await fs.readlink(path.join(repo,file)))}`);continue;}
  if(!stat.isFile())throw Error(`Unsupported product input type: ${file}`);
  if(file.includes('\n'))throw Error('Product input paths must not contain newlines');
  hash.push([file,stat.mode&0o111?'100755':'100644']);
 }
 if(hash.length){
  const blobs=git(repo,['hash-object','--stdin-paths'],hash.map(([file])=>file).join('\n')+'\n').toString('utf8').trim().split('\n');
  if(blobs.length!==hash.length)throw Error('git hash-object returned an unexpected count');
  hash.forEach(([file,mode],i)=>entries.set(file,`${mode} ${blobs[i]}`));
 }
 const canonical=[...entries].sort(([a],[b])=>a<b?-1:a>b?1:0).map(([file,id])=>`${file}\0${id}`).join('\n');
 return {sha256:sha(canonical),files:entries.size,uncommitted:dirty.length};
}

const safeKey=key=>typeof key==='string'&&key.length>0&&!key.startsWith('/')&&!key.includes('\\')&&!key.includes('\0')
 &&key.split('/').every(part=>part&&part!=='.'&&part!=='..');

/** Hash every regular file; refuse symlinks and special files anywhere in dist. */
export async function hashDist(dist){
 const root=await fs.lstat(dist).catch(()=>null);
 if(!root?.isDirectory()||root.isSymbolicLink())throw Error(`Build directory is missing or not a real directory: ${dist}`);
 const files=Object.create(null);let bytes=0;
 async function walk(dir){
  for(const entry of await fs.readdir(dir,{withFileTypes:true})){
   const full=path.join(dir,entry.name),key=path.relative(dist,full).split(path.sep).join('/');
   if(!safeKey(key))throw Error(`Unsafe build path: ${key}`);
   if(entry.isSymbolicLink())throw Error(`Refusing symlink in build: ${key}`);
   if(entry.isDirectory())await walk(full);
   else if(entry.isFile()){const data=await fs.readFile(full);files[key]=sha(data);bytes+=data.length;}
   else throw Error(`Refusing special file in build: ${key}`);
  }
 }
 await walk(dist);
 return {files:Object.fromEntries(Object.entries(files).sort(([a],[b])=>a<b?-1:a>b?1:0)),bytes};
}

async function assertOutside(dist,file){
 const distReal=await fs.realpath(dist),parent=await fs.realpath(path.dirname(path.resolve(file)));
 const relative=path.relative(distReal,path.join(parent,path.basename(file)));
 if(!relative.startsWith('..')&&!path.isAbsolute(relative))throw Error('The seal must be stored outside the build directory');
}

async function assertHavok(repo,files){
 const source=await fs.readFile(path.join(repo,'public/HavokPhysics.wasm'));
 if(files['HavokPhysics.wasm']!==sha(source))throw Error('Build is missing the exact public/HavokPhysics.wasm');
}

const sealDigest=seal=>sha(JSON.stringify({kind:seal.kind,schema:seal.schema,source:seal.source,files:seal.files}));

export async function sealDist({dist,out,repo=process.cwd(),scope=''}){
 await assertOutside(dist,out);
 const {files,bytes}=await hashDist(dist);await assertHavok(repo,files);
 const paths=await productPaths(repo),inputs=await productInputsSha256(repo,paths);
 const seal={kind:SEAL_KIND,schema:1,scope:String(scope),createdAt:new Date().toISOString(),
  source:{head:git(repo,['rev-parse','HEAD']).toString().trim(),productPaths:paths,productInputsSha256:inputs.sha256,
   productInputFiles:inputs.files,uncommittedProductInputs:inputs.uncommitted},
  fileCount:Object.keys(files).length,totalBytes:bytes,files};
 seal.sealSha256=sealDigest(seal);
 // Never silently replace an earlier receipt.
 await fs.writeFile(out,JSON.stringify(seal,null,1)+'\n',{flag:'wx'});
 return seal;
}

export async function verifySeal({dist,seal:sealPath,repo=process.cwd()}){
 await assertOutside(dist,sealPath);
 const seal=JSON.parse(await fs.readFile(sealPath,'utf8'));
 if(seal.kind!==SEAL_KIND||seal.schema!==1||!seal.files||typeof seal.files!=='object')throw Error('Not a schema-1 Pages dist seal');
 if(seal.sealSha256!==sealDigest(seal))throw Error('Seal content does not match its digest');
 for(const [key,value]of Object.entries(seal.files))if(!safeKey(key)||!/^[0-9a-f]{64}$/.test(value))throw Error(`Unsafe sealed entry: ${key}`);
 const {files,bytes}=await hashDist(dist);
 const missing=Object.keys(seal.files).filter(key=>!Object.hasOwn(files,key)),extra=Object.keys(files).filter(key=>!Object.hasOwn(seal.files,key));
 const changed=Object.keys(files).filter(key=>Object.hasOwn(seal.files,key)&&files[key]!==seal.files[key]);
 if(missing.length||extra.length||changed.length){
  const list=items=>items.slice(0,10).join(', ')+(items.length>10?` … (+${items.length-10})`:'');
  throw Error(`Build differs from its seal: ${[missing.length&&`missing ${list(missing)}`,extra.length&&`extra ${list(extra)}`,changed.length&&`changed ${list(changed)}`].filter(Boolean).join('; ')}`);
 }
 await assertHavok(repo,files);
 const paths=await productPaths(repo);
 if(JSON.stringify(paths)!==JSON.stringify(seal.source?.productPaths))throw Error('Product input paths differ from the sealed build');
 const dirty=dirtyProductPaths(repo,paths);
 if(dirty.length)throw Error(`Commit product inputs before upload: ${dirty.slice(0,10).join(', ')}${dirty.length>10?' …':''}`);
 const inputs=await productInputsSha256(repo,paths);
 if(inputs.sha256!==seal.source.productInputsSha256)throw Error('Committed product inputs differ from the sealed build; rebuild and gate again');
 const head=git(repo,['rev-parse','HEAD']).toString().trim();
 return {verified:true,head,sealedHead:seal.source.head,sameCommit:head===seal.source.head,files:Object.keys(files).length,bytes,sealSha256:seal.sealSha256};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const [command,...rest]=process.argv.slice(2),options={};
 for(let i=0;i<rest.length;i+=2){
  if(!/^--(dist|out|seal|scope)$/.test(rest[i])||rest[i+1]===undefined){console.error(`Unknown or incomplete option: ${rest[i]}`);process.exit(2);}
  options[rest[i].slice(2)]=rest[i+1];
 }
 try{
  if(command==='seal'&&options.dist&&options.out){
   const seal=await sealDist(options);
   console.log(JSON.stringify({sealed:options.out,head:seal.source.head,uncommittedProductInputs:seal.source.uncommittedProductInputs,files:seal.fileCount,bytes:seal.totalBytes,sealSha256:seal.sealSha256}));
  }else if(command==='verify'&&options.dist&&options.seal)console.log(JSON.stringify(await verifySeal(options)));
  else{console.error('Usage: pages-seal.mjs seal --dist <dir> --out <file> [--scope <text>] | verify --dist <dir> --seal <file>');process.exit(2);}
 }catch(error){console.error(`Pages seal refused: ${error.message}`);process.exit(1);}
}
