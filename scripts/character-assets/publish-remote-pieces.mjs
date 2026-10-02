/** Publish the prepared native remote pieces as immutable, individually addressed assets.
 *
 * "Never publish by copying arbitrary stale .cache files" is the rule this script exists to
 * enforce. Every gate below refuses rather than repairs, because a half-correct published set
 * is worse than an absent one: the runtime would fetch it and trust it.
 *
 * Gates, in order:
 *  1. The prepared descriptor's `compilerSha256` must equal the hash of the *current*
 *     `prepare-remote-pieces.mjs`. A prepared set from an older compiler is stale by
 *     definition, whatever its files look like.
 *  2. Schema, pinned Lite version and catalogue version must match the installed ones.
 *  3. The native sweep must have found zero bound escapes.
 *  4. Every piece file must exist, be named `<id>-<sha256>.glb`, and match the manifest's
 *     recorded byte length and SHA-256 exactly.
 *
 * Output is content-addressed, so republishing an unchanged set rewrites identical bytes and
 * a changed piece lands beside the old one under a new name rather than over it.
 *
 * What this does and does not assert: each *piece* is hash-sealed, and the runtime re-verifies
 * that hash when it fetches. The descriptor itself is trusted by origin -- it carries
 * provenance and a version, not a self-seal, which would be circular.
 */
import fs from 'node:fs/promises';import path from 'node:path';import {createHash} from 'node:crypto';
import {APPEARANCE_CATALOG_VERSION} from '../../src/character/appearance/contract.js';

const PUBLISH_VERSION=1;
const SOURCE='.cache/character-mmo/remote-pieces-v1';
const OUT=process.env.ASHEN_PUBLISH_DIR||'public/ashen-reach/remote-pieces/v1';
const COMPILER='scripts/character-assets/prepare-remote-pieces.mjs';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const lite=JSON.parse(await fs.readFile('node_modules/@babylonjs/lite/package.json','utf8')).version;

const prepared=JSON.parse(await fs.readFile(path.join(SOURCE,'prepared.json'),'utf8'));
const manifest=prepared.manifest;
const compilerSha=sha(await fs.readFile(COMPILER));
const refuse=message=>{throw Error(`Refusing to publish: ${message}`);};

if(manifest.compilerSha256!==compilerSha)refuse(`prepared set was built by a different ${COMPILER} (${manifest.compilerSha256?.slice(0,12)} vs current ${compilerSha.slice(0,12)}); re-run the preparation`);
if(prepared.schema!==1||manifest.schema!==1)refuse('unsupported descriptor schema');
if(prepared.lite!==lite||manifest.lite!==lite)refuse(`descriptor pins Lite ${prepared.lite}, installed is ${lite}`);
if(prepared.catalogVersion!==APPEARANCE_CATALOG_VERSION||manifest.catalogVersion!==APPEARANCE_CATALOG_VERSION)refuse(`catalogue version mismatch against ${APPEARANCE_CATALOG_VERSION}`);
if(prepared.candidateOnly!==true||manifest.candidateOnly!==true)refuse('source descriptor is not the candidate set');
if(prepared.escaped!==0)refuse(`native sweep recorded ${prepared.escaped} bound escapes`);
if(!Number.isSafeInteger(prepared.points)||prepared.points<1)refuse('native sweep recorded no sampled points');

const published=[];let totalBytes=0;
await fs.mkdir(OUT,{recursive:true});
for(const [race,data]of Object.entries(manifest.races)){
 for(const [id,entry]of Object.entries(data.manifest.items)){
  if(entry.file!==`${id}-${entry.sha256}.glb`)refuse(`${race}/${id} is not content-addressed as ${id}-<sha256>.glb`);
  const source=path.join(SOURCE,entry.file);
  let bytes;try{bytes=await fs.readFile(source);}catch{refuse(`${race}/${id} file ${entry.file} is absent from the prepared set`);}
  if(bytes.byteLength!==entry.bytes)refuse(`${race}/${id} is ${bytes.byteLength} bytes, manifest says ${entry.bytes}`);
  const actual=sha(bytes);
  if(actual!==entry.sha256)refuse(`${race}/${id} hashes ${actual.slice(0,12)}, manifest says ${entry.sha256.slice(0,12)}`);
  const bound=prepared.races[race]?.pieces?.[id];
  if(bound?.sha256!==entry.sha256)refuse(`${race}/${id} has no swept bounds for this exact hash`);
  if(bound.escaped!==0)refuse(`${race}/${id} has ${bound.escaped} bound escapes`);
  await fs.writeFile(path.join(OUT,entry.file),bytes);
  published.push({race,id,file:entry.file,bytes:entry.bytes,sha256:entry.sha256});totalBytes+=entry.bytes;
 }
}
// Deduplicate: a piece shared by two races is one immutable file, written once above.
const files=new Set(published.map(p=>p.file));
const descriptor={...prepared,candidateOnly:false,
 manifest:{...manifest,candidateOnly:false},
 published:{version:PUBLISH_VERSION,publishedAt:new Date().toISOString(),sourceCompilerSha256:compilerSha,
  pieceCount:published.length,uniqueFiles:files.size,totalBytes,lite,catalogVersion:APPEARANCE_CATALOG_VERSION}};
await fs.writeFile(path.join(OUT,'prepared.json'),JSON.stringify(descriptor,null,1)+'\n');
const index={schema:1,version:PUBLISH_VERSION,publishedAt:descriptor.published.publishedAt,
 lite,catalogVersion:APPEARANCE_CATALOG_VERSION,sourceCompilerSha256:compilerSha,
 uniqueFiles:files.size,totalBytes,pieces:published.sort((a,b)=>a.file.localeCompare(b.file))};
await fs.writeFile(path.join(OUT,'index.json'),JSON.stringify(index,null,1)+'\n');
console.log(JSON.stringify({published:OUT,version:PUBLISH_VERSION,races:Object.keys(manifest.races),
 pieces:published.length,uniqueFiles:files.size,totalBytes,descriptorBytes:(await fs.stat(path.join(OUT,'prepared.json'))).size},null,1));
