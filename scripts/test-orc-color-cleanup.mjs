import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {Document, NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {removeWhiteOrcColors} from './character-assets/remove-white-orc-colors.mjs';

function fixture(values) {
  const document = new Document();
  const buffer = document.createBuffer();
  const color = document.createAccessor().setType('VEC4').setArray(Uint8Array.from(values)).setBuffer(buffer);
  const primitive = document.createPrimitive().setAttribute('COLOR_0', color);
  document.createMesh('OrcV1Body').addPrimitive(primitive);
  return {document, primitive};
}

test('removes neutral Orc colors and their now-unused accessor', () => {
  const {document, primitive} = fixture([255, 255, 255, 255]);
  assert.deepEqual(removeWhiteOrcColors(document), {primitives: 1, accessors: 1});
  assert.equal(primitive.getAttribute('COLOR_0'), null);
  assert.equal(document.getRoot().listAccessors().length, 0);
  assert.deepEqual(removeWhiteOrcColors(document), {primitives: 0, accessors: 0});
});

test('rejects nonwhite or translucent color data without changing the mesh', () => {
  for (const values of [[254, 255, 255, 255], [255, 255, 255, 128]]) {
    const {document, primitive} = fixture(values);
    assert.throws(() => removeWhiteOrcColors(document), /appearance data/);
    assert.deepEqual(Array.from(primitive.getAttribute('COLOR_0').getArray()), values);
  }
  const first = fixture([255, 255, 255, 255]);
  const second = first.document.createAccessor().setType('VEC4').setArray(Uint8Array.from([255, 200, 255, 255])).setBuffer(first.document.getRoot().listBuffers()[0]);
  first.document.createMesh('OrcV1Shorts').addPrimitive(first.document.createPrimitive().setAttribute('COLOR_0', second));
  assert.throws(() => removeWhiteOrcColors(first.document), /appearance data/);
  assert.ok(first.primitive.getAttribute('COLOR_0'), 'validation must precede every mutation');
});

test('shipped Orc source and pack contain no COLOR_0 and metadata matches files', async () => {
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  const sourcePath = 'public/characters/candidates/orc-source-v1.glb';
  const bodyPath = 'public/ashen-reach/equipment-orc/body.glb';
  const binderPath = 'scripts/character-assets/bind-source-orc.mjs';
  const source = await io.read(sourcePath);
  const body = await io.read(bodyPath);
  for (const document of [source, body]) {
    for (const mesh of document.getRoot().listMeshes()) {
      for (const primitive of mesh.listPrimitives()) assert.equal(primitive.getAttribute('COLOR_0'), null, mesh.getName());
    }
    assert.equal(document.getRoot().listAnimations().length, 57);
    assert.equal(document.getRoot().listSkins()[0].listJoints().length, 65);
  }
  const sourceBytes = await fs.readFile(sourcePath);
  const bodyBytes = await fs.readFile(bodyPath);
  const binderBytes = await fs.readFile(binderPath);
  const sha = bytes => createHash('sha256').update(bytes).digest('hex');
  const manifest = JSON.parse(await fs.readFile('public/ashen-reach/equipment-orc/manifest.json', 'utf8'));
  const sourceProvenance = JSON.parse(await fs.readFile('public/characters/candidates/orc-source-v1.provenance.json', 'utf8'));
  const packProvenance = JSON.parse(await fs.readFile('public/ashen-reach/equipment-orc/provenance.json', 'utf8'));
  assert.equal(manifest.items.body.bytes, bodyBytes.length);
  assert.equal(manifest.items.body.sha256, sha(bodyBytes));
  assert.equal(manifest.sourceSha256, sha(bodyBytes));
  assert.equal(sourceProvenance.hashes[sourcePath], sha(sourceBytes));
  assert.equal(sourceProvenance.hashes[binderPath], sha(binderBytes));
  assert.equal(packProvenance.hashes[sourcePath], sha(sourceBytes));
  assert.equal(packProvenance.hashes[bodyPath], sha(bodyBytes));
});
