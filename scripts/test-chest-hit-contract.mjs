import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {MeshoptDecoder, MeshoptEncoder} from 'meshoptimizer';
import {CHEST_HIT_ASSETS as ASSETS} from './character-assets/chest-hit-assets.mjs';
import {inspectChestHit} from './character-assets/chest-hit-inspect.mjs';
import {needsLegacyChestStrip} from '../src/character/runtime/body-visual.js';

await MeshoptDecoder.ready;
await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'meshopt.decoder': MeshoptDecoder,
  'meshopt.encoder': MeshoptEncoder,
});
const inventory=JSON.parse(await fs.readFile('scripts/character-assets/chest-hit-inventory.json','utf8'));

for (const file of ASSETS) test(`${file} retains every other animation channel and curve`, async()=>{
  const actual=inspectChestHit(await io.read(file));
  const expected=inventory[file];
  assert.equal(actual.clips,expected.clips);
  assert.equal(actual.chest,expected.afterChest);
  assert.equal(actual.chestHips,0);
  assert.equal(actual.head,expected.head);
  assert.equal(actual.headHips,expected.headHips);
  assert.equal(actual.preservedSha256,expected.preservedSha256);
});

test('legacy source alone retains the runtime adapter; Hit_Head is never stripped',()=>{
  assert.equal(needsLegacyChestStrip({assetURL:'/characters/base.glb'},{name:'Hit_Chest'}),true);
  assert.equal(needsLegacyChestStrip({id:'source-reference'},{name:'Hit_Chest'}),true);
  assert.equal(needsLegacyChestStrip({assetURL:'/characters/candidates/human-source-v1.glb'},{name:'Hit_Chest'}),false);
  assert.equal(needsLegacyChestStrip({assetURL:'/characters/base.glb'},{name:'Hit_Head'}),false);
});
