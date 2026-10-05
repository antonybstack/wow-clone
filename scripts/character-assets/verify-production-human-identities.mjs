/** Reject stale inputs, mutable descriptors or corrupt selected-identity assets.
 * Shared manifest embeds immutable descriptors to avoid another startup request.
 * https://developers.cloudflare.com/pages/configuration/headers/
 */
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {HUMAN_IDENTITY_PRESETS,IDENTITY_CATALOG_VERSION} from '../../src/character/appearance/human-identity.js';
import {manifestBodyCoverage} from '../../src/ashen-reach/coverage-manifest.js';
import {ASHEN_PLAYABLE_CLIP_NAMES} from '../../src/character/runtime/ashen-playable-motion.js';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
export async function verifyProductionHumanIdentities({readFile=fs.readFile}={}){
 const index=JSON.parse(await readFile('public/ashen-reach/human-identity-v1/manifest.json','utf8'));
 const current=JSON.parse(await readFile('public/ashen-reach/human-shape-v1/manifest.json','utf8'));
 assert.equal(index.schema,1);assert.equal(index.catalogVersion,IDENTITY_CATALOG_VERSION);
 assert.equal(index.fitId,current.fitId);assert.equal(index.shapeFamily,current.shapeFamily);assert.deepEqual(index.targetNames,current.targetNames);
 assert.equal(index.provenance?.schema,1);assert.equal(sha(JSON.stringify(index.provenance.inputs)),index.provenance.sha256,'Corrupt identity provenance');
 for(const [file,expected]of Object.entries(index.provenance.inputs))assert.equal(sha(await readFile(file)),expected,`Stale identity input: ${file}. Run npm run prepare:human-identities`);
 const presets=HUMAN_IDENTITY_PRESETS.filter(p=>p.sourceLabel);
 assert.deepEqual(Object.keys(index.presets).sort(),presets.map(p=>p.id).sort());
 const checked=new Set();
 async function addressed(url){
  assert(/^\/ashen-reach\/[a-zA-Z0-9/_.-]+$/.test(url)&&!url.includes('..'),'Asset URL must be a local prepared file');
  const bytes=await readFile('public'+url),suffix=/-([a-f0-9]{12})\./.exec(url)?.[1];
  assert(suffix&&sha(bytes).startsWith(suffix),`Corrupt content address: ${url}`);return bytes;
 }
 for(const preset of presets){
  const entry=index.presets[preset.id],descriptor=await addressed(entry.url);
  assert.equal(descriptor.length,entry.bytes);assert.equal(sha(descriptor),entry.sha256);
  assert.equal(descriptor.toString(),JSON.stringify(entry.manifest),'Embedded identity descriptor differs from immutable file');
  const manifest=entry.manifest;
  manifestBodyCoverage(manifest,'human');
  assert.equal(manifest.identity.preset,preset.id);assert.deepEqual(entry.components,preset.components);assert.deepEqual(manifest.identity.components,preset.components);
  assert.equal(manifest.identity.bind,'canonical-source-65-v1');assert.equal(manifest.fitId,current.fitId);assert.equal(manifest.shapeFamily,current.shapeFamily);assert.deepEqual(manifest.targetNames,current.targetNames);
  const torso=manifest.identity.torsoCoverage;
  assert.equal(torso?.revision,'human-medial-back-v1','Missing reviewed back coverage policy');
  assert(torso.addedTriangles>0&&torso.partition.coveredTriangles===torso.originalCoreTriangles+torso.addedTriangles,'Invalid back coverage counts');
  assert.equal(torso.verification?.triangles,torso.partition.originalTriangles,'Invalid written triangle union');
  for(const field of ['attributesExact','morphsExact','skinExact','framesExact','sourceAnimationExact'])assert.equal(torso.verification[field],true,`Missing written ${field} proof`);
  const playable=manifest.compactItems?.body;
  assert.equal(playable?.detail,'playable');
  assert(Array.isArray(playable.playableClips),'Missing compact playable-clip declaration');
  assert.deepEqual([...playable.playableClips].sort(),[...ASHEN_PLAYABLE_CLIP_NAMES].sort(),'Compact clip declaration differs from the current runtime');
  assert.equal(playable.geometrySha256,manifest.items.body.geometrySha256,'Compact visual differs from the approved full body');
  assert.equal(playable.coverageRevision,manifest.items.body.coverageRevision,'Compact body coverage differs');
  for(const tier of ['items','compactItems']){
   assert.deepEqual(Object.keys(manifest[tier]).sort(),Object.keys(current[tier]).sort());
   for(const [id,item]of Object.entries(manifest[tier])){
    if(!['body','graveweaverHood'].includes(id))assert.deepEqual(item,current[tier][id],`${preset.id}/${tier}/${id}: changed shared clothing`);
    if(!checked.has(item.url)){
     const encoded=await addressed(item.url),decoded=item.compression==='gzip'?gunzipSync(encoded):encoded;
     assert.equal(decoded.length,item.bytes);assert.equal(sha(decoded),item.sha256,`Corrupt decoded asset: ${item.url}`);
     if(item.encodedBytes!==undefined)assert.equal(encoded.length,item.encodedBytes);
     checked.add(item.url);
    }
    for(const texture of item.textures||[])if(!checked.has(texture.url)){await addressed(texture.url);checked.add(texture.url);}
   }
  }
  assert.equal(manifest.identity.head.url,manifest.items.body.url);assert.equal(manifest.identity.hair.url,manifest.items.body.url);
  for(const name of [...manifest.identity.head.meshes,...manifest.identity.hair.meshes])assert(manifest.items.body.meshes.includes(name));
 }
 return {presets:presets.length,assets:checked.size,provenance:index.provenance.sha256};
}
