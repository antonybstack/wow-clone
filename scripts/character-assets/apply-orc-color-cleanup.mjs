/** One-time in-place refresh of the shipped Orc source and playable body.
 * The regular bind/pack scripts call the same guarded transform on future builds.
 */
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {removeWhiteOrcColors} from './remove-white-orc-colors.mjs';

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const sourcePath = 'public/characters/candidates/orc-source-v1.glb';
const bodyPath = 'public/ashen-reach/equipment-orc/body.glb';
const binderPath = 'scripts/character-assets/bind-source-orc.mjs';
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const summary = {};

for (const path of [sourcePath, bodyPath]) {
  const document = await io.read(path);
  const removed = removeWhiteOrcColors(document);
  if (removed.primitives) await fs.writeFile(path, await io.writeBinary(document));
  const bytes = await fs.readFile(path);
  summary[path] = {removed, bytes: bytes.length, sha256: digest(bytes)};
}

const sourceProvenancePath = 'public/characters/candidates/orc-source-v1.provenance.json';
const sourceProvenance = JSON.parse(await fs.readFile(sourceProvenancePath, 'utf8'));
sourceProvenance.hashes[sourcePath] = summary[sourcePath].sha256;
sourceProvenance.hashes[binderPath] = digest(await fs.readFile(binderPath));
sourceProvenance.vertexColorCleanup = 'Neutral RGBA8 COLOR_0 removed after albedo baking; the original painted cavity survives in texture.';
await fs.writeFile(sourceProvenancePath, JSON.stringify(sourceProvenance, null, 2) + '\n');

const manifestPath = 'public/ashen-reach/equipment-orc/manifest.json';
const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
manifest.sourceSha256 = summary[bodyPath].sha256;
manifest.items.body.bytes = summary[bodyPath].bytes;
manifest.items.body.sha256 = summary[bodyPath].sha256;
await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');

const packProvenancePath = 'public/ashen-reach/equipment-orc/provenance.json';
const packProvenance = JSON.parse(await fs.readFile(packProvenancePath, 'utf8'));
packProvenance.hashes[sourcePath] = summary[sourcePath].sha256;
packProvenance.hashes[bodyPath] = summary[bodyPath].sha256;
packProvenance.vertexColorCleanup = sourceProvenance.vertexColorCleanup;
await fs.writeFile(packProvenancePath, JSON.stringify(packProvenance, null, 2) + '\n');

console.log(JSON.stringify(summary, null, 2));
