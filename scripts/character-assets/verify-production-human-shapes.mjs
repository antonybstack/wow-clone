/** Fail release builds if the published family differs from its recorded sources.
 * Content-addressed URLs remain immutable; manifests are deployment-specific.
 * https://developers.cloudflare.com/pages/configuration/headers/
 */
import assert from 'node:assert/strict';
import {verifyCompactNormalPolicy} from './compact-normal-policy.mjs';
import fs from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {verifyHumanCoveragePolicy} from './verify-human-coverage-policy.mjs';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
export async function verifyProductionHumanShapes() {
 const manifest=JSON.parse(await fs.readFile('public/ashen-reach/human-shape-v1/manifest.json','utf8'));
 verifyHumanCoveragePolicy(manifest);
 verifyCompactNormalPolicy(manifest.compactItems.body.normalPacking);
 for(const [id,item] of Object.entries(manifest.compactItems)){
  if(item.normalPacking)verifyCompactNormalPolicy(item.normalPacking);
  if(id==='graveweaverHood'||item.url===manifest.items[id].url)assert.equal(item.normalPacking,undefined,'Protected full geometry or hood was rounded');
 }
 for(const item of Object.values(manifest.items))assert.equal(item.normalPacking,undefined,'Full source must stay lossless');
 if(manifest.provenance?.schema!==1||hash(JSON.stringify(manifest.provenance.inputs))!==manifest.provenance.sha256)throw Error('Human family provenance missing or corrupt');
 for(const [file,expected] of Object.entries(manifest.provenance.inputs))
  if(hash(await fs.readFile(file))!==expected)throw Error(`Stale Human family: ${file}. Run npm run prepare:human-shapes`);
 for(const item of [...Object.values(manifest.items),...Object.values(manifest.compactItems)]) {
  if(!hash(await fs.readFile('public'+item.url)).startsWith(item.url.match(/-([a-f0-9]{12})\./)?.[1]||'invalid'))throw Error(`Corrupt Human family: ${item.url}`);
  const decoded=gunzipSync(await fs.readFile('public'+item.url));
  if(decoded.length!==item.bytes||hash(decoded)!==item.sha256)throw Error(`Corrupt decoded Human family: ${item.url}`);
  for(const texture of item.textures||[])
   if(!hash(await fs.readFile('public'+texture.url)).startsWith(texture.url.match(/-([a-f0-9]{12})\./)?.[1]||'invalid'))throw Error(`Corrupt Human texture: ${texture.url}`);
 }
}
