import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';

const sha = path => createHash('sha256').update(fs.readFileSync(path)).digest('hex');
const json = path => JSON.parse(fs.readFileSync(path, 'utf8'));
const packs = ['equipment', 'equipment-orc', 'equipment-undead', 'equipment-undead-provisional'];
const races = ['human', 'orc', 'undead'];

test('F3 body manifests match the shipped bytes and bind-source provenance', () => {
  for (const pack of packs) {
    const dir = `public/ashen-reach/${pack}`;
    const manifest = json(`${dir}/manifest.json`);
    const body = manifest.items.body;
    const path = `public${body.url}`;
    assert.equal(body.sha256, sha(path), `${pack} body SHA-256`);
    assert.equal(body.bytes, fs.statSync(path).size, `${pack} body bytes`);
    assert.equal(manifest.sourceSha256, sha(path), `${pack} manifest sourceSha256`);
  }
  for (const race of races) {
    const path = `public/characters/candidates/${race}-source-v1.provenance.json`;
    const provenance = json(path);
    for (const [asset, expected] of Object.entries(provenance.hashes)) {
      if (fs.existsSync(asset)) assert.equal(expected, sha(asset), `${path}: ${asset}`);
    }
  }
});

test('F3 pack and animation provenance match their current GLBs', () => {
  for (const pack of packs) {
    const path = `public/ashen-reach/${pack}/provenance.json`;
    const provenance = json(path);
    for (const [asset, expected] of Object.entries(provenance.hashes)) {
      if (fs.existsSync(asset)) assert.equal(expected, sha(asset), `${path}: ${asset}`);
    }
  }
  const wanderer = sha('public/ashen-reach/wanderer.glb');
  for (const name of ['animation', 'fire-cast', 'lava-cast', 'pyre-cast']) {
    const path = `public/ashen-reach/${name}-provenance.json`;
    assert.equal(json(path).outputSha256, wanderer, `${path}: outputSha256`);
  }
  const equipment = json('public/ashen-reach/equipment-provenance.json');
  assert.equal(equipment.sourceSha256, wanderer, 'equipment sourceSha256');
  assert.equal(equipment.outputSha256, sha('public/ashen-reach/wanderer-equipment.glb'), 'equipment outputSha256');
});
