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
import {EQUIPMENT_ITEMS} from '../../src/ashen-reach/equipment-catalog.js';

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

// Native bounds belong to exact piece hashes, and their semantic adapters come
// from this source pack. Refuse a stale source before writing any publication.
for(const [race,data]of Object.entries(manifest.races)){
 const source=data.sourceManifest;
 if(!source?.path?.startsWith('public/ashen-reach/')||source.path.includes('..')||!/^[a-f0-9]{64}$/.test(source.sha256))refuse(`${race} has invalid source manifest provenance`);
 if(sha(await fs.readFile(source.path))!==source.sha256)refuse(`${race} source manifest changed; re-prepare before publication`);
}

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
// Reuse the existing timestamp when nothing else about the publication changed. A fresh
// `publishedAt` on every run made the descriptor differ from the committed one each time
// even though all 45 content-addressed pieces were byte-identical, so "republishing an
// unchanged set is idempotent" was true of the pieces and false of the descriptor.
const previous=await fs.readFile(path.join(OUT,'prepared.json'),'utf8').then(JSON.parse,()=>null);
const publishedBody={version:PUBLISH_VERSION,sourceCompilerSha256:compilerSha,
 pieceCount:published.length,uniqueFiles:files.size,totalBytes,lite,catalogVersion:APPEARANCE_CATALOG_VERSION};
const unchanged=previous&&Object.entries(publishedBody).every(([k,v])=>JSON.stringify(previous.published?.[k])===JSON.stringify(v));
const publishedAt=unchanged?previous.published.publishedAt:new Date().toISOString();
const descriptor={...prepared,candidateOnly:false,
 manifest:{...manifest,candidateOnly:false},
 // Key order matters only so an unchanged republish produces a byte-identical file.
 published:{version:publishedBody.version,publishedAt,...Object.fromEntries(Object.entries(publishedBody).filter(([k])=>k!=='version'))}};
await fs.writeFile(path.join(OUT,'prepared.json'),JSON.stringify(descriptor,null,1)+'\n');
const index={schema:1,version:PUBLISH_VERSION,publishedAt,
 lite,catalogVersion:APPEARANCE_CATALOG_VERSION,sourceCompilerSha256:compilerSha,
 uniqueFiles:files.size,totalBytes,pieces:published.sort((a,b)=>a.file.localeCompare(b.file))};
await fs.writeFile(path.join(OUT,'index.json'),JSON.stringify(index,null,1)+'\n');
// The shared region may only accept appearances it can actually render. Derive that table
// from what was just published rather than widening a constant by hand, so the server's
// authority can never claim a race or a piece the published set does not carry. Factory items
// are generated at runtime and need no per-race fit, so they are supported everywhere.
const factoryItems=Object.values(EQUIPMENT_ITEMS).filter(i=>i.factory).map(i=>i.id).sort();
const races=Object.fromEntries(Object.entries(manifest.races).map(([race,data])=>{
 const fitted=Object.keys(data.manifest.items).filter(id=>id!=='body');
 return [race,[...new Set([...fitted,...factoryItems])].sort()];
}));
const catalogueModule=`/** Generated by scripts/character-assets/publish-remote-pieces.mjs. Do not edit.
 *
 * What the shared region can actually render, derived from the published remote-piece set.
 * The presence server validates seat appearances against this, so authority can never accept
 * a race or a piece that was never published. Factory items are generated at runtime and
 * carry no per-race fit, so they appear under every race.
 */
export const PRESENCE_PIECE_CATALOGUE=Object.freeze({
 publishVersion:${PUBLISH_VERSION},
 catalogVersion:${JSON.stringify(APPEARANCE_CATALOG_VERSION)},
 sourceCompilerSha256:${JSON.stringify(compilerSha)},
 races:Object.freeze({
${Object.entries(races).map(([race,ids])=>`  ${race}:Object.freeze(${JSON.stringify(ids)}),`).join('\n')}
 }),
});
`;
await fs.writeFile('src/multiplayer/presence-catalogue.js',catalogueModule);

console.log(JSON.stringify({published:OUT,version:PUBLISH_VERSION,races:Object.keys(manifest.races),
 catalogueRaces:Object.fromEntries(Object.entries(races).map(([r,ids])=>[r,ids.length])),
 pieces:published.length,uniqueFiles:files.size,totalBytes,descriptorBytes:(await fs.stat(path.join(OUT,'prepared.json'))).size},null,1));
