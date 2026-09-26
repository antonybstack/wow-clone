/** Normalize authored Hit_Chest in shipped race and equipment GLBs. */
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {MeshoptDecoder, MeshoptEncoder} from 'meshoptimizer';
import {stripChestHitHipsTranslation} from './strip-chest-hit-hips.mjs';
import {CHEST_HIT_ASSETS} from './chest-hit-assets.mjs';

const ASSETS = CHEST_HIT_ASSETS;

await MeshoptDecoder.ready;
await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'meshopt.decoder': MeshoptDecoder,
  'meshopt.encoder': MeshoptEncoder,
});
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const replacements = new Map();
const sizes = new Map();
for (const file of ASSETS) {
  const before = await fs.readFile(file);
  const doc = await io.read(file);
  const counts = stripChestHitHipsTranslation(doc, {allowPrepared: true});
  if (counts.before === counts.after) { console.log(JSON.stringify({file, ...counts})); continue; }
  const after = await io.writeBinary(doc);
  await fs.writeFile(file, after);
  replacements.set(sha(before), sha(after));
  sizes.set(file, after.length);
  console.log(JSON.stringify({file, ...counts}));
}

async function refreshJson(directory) {
  for (const entry of await fs.readdir(directory, {withFileTypes: true})) {
    const file = `${directory}/${entry.name}`;
    if (entry.isDirectory()) { await refreshJson(file); continue; }
    if (!entry.name.endsWith('.json')) continue;
    let data;
    try { data = JSON.parse(await fs.readFile(file, 'utf8')); } catch { continue; }
    let changed = false;
    function visit(value) {
      if (typeof value === 'string') {
        const next = replacements.get(value);
        if (next) { changed = true; return next; }
        return value;
      }
      if (Array.isArray(value)) return value.map(visit);
      if (value && typeof value === 'object') {
        for (const [key, child] of Object.entries(value)) value[key] = visit(child);
        if (typeof value.url === 'string' && typeof value.bytes === 'number') {
          const asset = `public${value.url}`;
          if (sizes.has(asset)) { value.bytes = sizes.get(asset); changed = true; }
        }
      }
      return value;
    }
    visit(data);
    if (changed) await fs.writeFile(file, JSON.stringify(data, null, 2) + '\n');
  }
}
await refreshJson('public/characters/candidates');
await refreshJson('public/ashen-reach');
