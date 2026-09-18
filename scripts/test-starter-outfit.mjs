import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseGlb, readAccessor } from '../src/character/runtime/glb.js';
import { composeStarterOutfit, STARTER_PROFILES } from '../src/character/runtime/compose-starter-outfit.js';
import { HUMAN_V1_BODY_ID, ORC_V1_BODY_ID, UNDEAD_V1_BODY_ID, resolvePlayableBody } from '../src/character/runtime/playable-body.js';

const file = await readFile(new URL('../public/characters/bodies/human-animated-v1.glb', import.meta.url));
const source = file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength);

function triSet(indices) {
  const out = new Set();
  for (let i = 0; i < indices.length; i += 3) {
    out.add(`${indices[i]},${indices[i + 1]},${indices[i + 2]}`);
  }
  return out;
}

test('unsupported profile is rejected; Human defaults to mage with explicit starter escape hatch', () => {
  assert.throws(() => composeStarterOutfit(source, { profile: 'elf-v1', outfit: 'starter' }), /Unsupported fit profile/);
  assert.throws(() => composeStarterOutfit(source, { profile: 'human-v1', outfit: 'mage' }), /Unsupported outfit/);
  assert.deepEqual(Object.keys(STARTER_PROFILES).sort(), [HUMAN_V1_BODY_ID, ORC_V1_BODY_ID, UNDEAD_V1_BODY_ID].sort());
  assert.equal(STARTER_PROFILES['orc-v1'].bodyMesh, 'OrcV1Body');
  assert.equal(STARTER_PROFILES['undead-v1'].bodyMesh, 'UndeadV1Body');
  assert.equal(resolvePlayableBody('').outfit, 'mage');
  assert.equal(resolvePlayableBody('?character=human-v1').outfit, 'mage');
  assert.equal(resolvePlayableBody('?character=human-v1&outfit=starter').outfit, 'starter');
  assert.equal(resolvePlayableBody('?character=human-v1&outfit=body').outfit, 'body');
});

test('body mode preserves source scene and does not mutate the input buffer', () => {
  const before = new Uint8Array(source).slice();
  const { buffer, manifest } = composeStarterOutfit(source, { profile: 'human-v1', outfit: 'body' });
  assert.deepEqual(new Uint8Array(source), before);
  assert.equal(manifest.outfit, 'body');
  assert.equal(manifest.components.length, 0);
  assert.equal(buffer.byteLength, source.byteLength);
  const src = parseGlb(source);
  const out = parseGlb(buffer);
  assert.deepEqual(out.json.meshes.map((m) => m.name), src.json.meshes.map((m) => m.name));
  assert.equal(out.json.nodes.find((n) => n.name === 'HumanShorts') != null, true);
  const parent = out.json.nodes.find((n) => n.children?.includes(out.json.nodes.findIndex((x) => x.name === 'HumanShorts')));
  assert.ok(parent, 'shorts stay parented in body mode');
});

test('starter compose is source-immutable and keeps joints, IBM, animations', () => {
  const before = new Uint8Array(source).slice();
  const src = parseGlb(source);
  const { buffer, manifest } = composeStarterOutfit(source, { profile: 'human-v1', outfit: 'starter' });
  assert.deepEqual(new Uint8Array(source), before);
  const out = parseGlb(buffer);
  const srcSkin = src.json.skins[0];
  const outSkin = out.json.skins[manifest.sourceSkin];
  assert.deepEqual(outSkin.joints, srcSkin.joints);
  const srcIbm = readAccessor(src.json, src.binary, srcSkin.inverseBindMatrices);
  const outIbm = readAccessor(out.json, out.binary, outSkin.inverseBindMatrices);
  assert.deepEqual(Array.from(outIbm), Array.from(srcIbm));
  assert.deepEqual(
    (out.json.animations || []).map((a) => ({ name: a.name, channels: a.channels.length, samplers: a.samplers.length })),
    (src.json.animations || []).map((a) => ({ name: a.name, channels: a.channels.length, samplers: a.samplers.length })),
  );
  for (const name of ['HumanSkin', 'HumanBrows', 'HumanEyes', 'HumanHair']) {
    assert.ok(out.json.materials.some((m) => m.name === name), name);
  }
  assert.equal(src.json.materials.find((m) => m.name === 'HumanSkin').pbrMetallicRoughness?.baseColorTexture != null
    || src.json.materials.find((m) => m.name === 'HumanSkin').pbrMetallicRoughness != null, true);
});

test('starter has three nonempty skinned garments on the body skin; shorts unparented; head/hands kept', () => {
  const src = parseGlb(source);
  const { buffer, manifest } = composeStarterOutfit(source, { profile: 'human-v1', outfit: 'starter' });
  const out = parseGlb(buffer);
  assert.equal(manifest.profile, 'human-v1');
  assert.equal(manifest.sourceMesh, 'HumanBody');
  assert.equal(typeof manifest.sourceSkin, 'number');
  assert.deepEqual(manifest.components.map((c) => c.id), ['shirt', 'trousers', 'boots']);
  const bodyNode = out.json.nodes.find((n) => n.name === 'HumanBody');
  assert.equal(bodyNode.skin, manifest.sourceSkin);
  for (const id of ['StarterShirt', 'StarterTrousers', 'StarterBoots']) {
    const node = out.json.nodes.find((n) => n.name === id);
    assert.ok(node, id);
    assert.equal(node.skin, bodyNode.skin);
    const mesh = out.json.meshes[node.mesh];
    const p = mesh.primitives[0];
    assert.ok(p.attributes.JOINTS_0 != null);
    assert.ok(p.attributes.WEIGHTS_0 != null);
    const idx = readAccessor(out.json, out.binary, p.indices);
    assert.ok(idx.length >= 3, `${id} empty`);
  }

  const shortsIdx = out.json.nodes.findIndex((n) => n.name === 'HumanShorts');
  assert.ok(shortsIdx >= 0);
  assert.equal(out.json.nodes.some((n) => n.children?.includes(shortsIdx)), false);

  const srcBody = src.json.nodes.find((n) => n.name === 'HumanBody');
  const srcPrim = src.json.meshes[srcBody.mesh].primitives[0];
  const srcIdx = readAccessor(src.json, src.binary, srcPrim.indices);
  const srcJoints = readAccessor(src.json, src.binary, srcPrim.attributes.JOINTS_0);
  const srcWeights = readAccessor(src.json, src.binary, srcPrim.attributes.WEIGHTS_0);
  const outPrim = out.json.meshes[bodyNode.mesh].primitives[0];
  const outIdx = readAccessor(out.json, out.binary, outPrim.indices);
  assert.equal(outIdx.length / 3, srcIdx.length / 3 - manifest.coveredCount);
  const srcTris = triSet(srcIdx);
  for (let i = 0; i < outIdx.length; i += 3) {
    assert.ok(srcTris.has(`${outIdx[i]},${outIdx[i + 1]},${outIdx[i + 2]}`));
  }
  const coveredSet = new Set(manifest.coveredTriangles);
  for (const off of coveredSet) {
    const key = `${srcIdx[off]},${srcIdx[off + 1]},${srcIdx[off + 2]}`;
    assert.equal(triSet(outIdx).has(key), false);
  }

  const jointNames = src.json.skins[0].joints.map((i) => src.json.nodes[i].name);
  const headJi = jointNames.indexOf('Head');
  const handJi = jointNames.indexOf('LeftHand');
  let headHits = 0;
  let handHits = 0;
  for (let i = 0; i < outIdx.length; i++) {
    const v = outIdx[i];
    let best = 0;
    let w = -1;
    for (let k = 0; k < 4; k++) {
      if (srcWeights[v * 4 + k] > w) {
        w = srcWeights[v * 4 + k];
        best = srcJoints[v * 4 + k];
      }
    }
    if (best === headJi) headHits++;
    if (best === handJi) handHits++;
  }
  assert.ok(headHits > 10, `head verts remaining ${headHits}`);
  assert.ok(handHits > 10, `hand verts remaining ${handHits}`);
  assert.ok(manifest.components.every((c) => c.sourceTriangles > 80));
});

test('compose does not apply Orc/Undead profile to the Human buffer', () => {
  assert.throws(() => composeStarterOutfit(source, { profile: 'orc-v1', outfit: 'starter' }), /Missing OrcV1Body/);
  assert.throws(() => composeStarterOutfit(source, { profile: 'undead-v1', outfit: 'starter' }), /Missing UndeadV1Body/);
});

async function loadRace(rel) {
  const buf = await readFile(new URL(`../${rel}`, import.meta.url));
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
}

function assertOwnSkinCompose(srcBuf, profile, bodyName, shortsName) {
  const src = parseGlb(srcBuf);
  const before = new Uint8Array(srcBuf).slice();
  const bodyNode = src.json.nodes.find((n) => n.name === bodyName);
  assert.ok(bodyNode, bodyName);
  const srcSkinIndex = bodyNode.skin;
  assert.equal(typeof srcSkinIndex, 'number');
  const srcSkin = src.json.skins[srcSkinIndex];
  const srcIbm = readAccessor(src.json, src.binary, srcSkin.inverseBindMatrices);
  const srcAnims = (src.json.animations || []).map((a) => ({ name: a.name, channels: a.channels.length, samplers: a.samplers.length }));
  const { buffer, manifest } = composeStarterOutfit(srcBuf, { profile, outfit: 'starter' });
  assert.deepEqual(new Uint8Array(srcBuf), before);
  assert.equal(manifest.profile, profile);
  assert.equal(manifest.sourceMesh, bodyName);
  assert.equal(manifest.sourceSkin, srcSkinIndex);
  const out = parseGlb(buffer);
  const outBody = out.json.nodes.find((n) => n.name === bodyName);
  assert.equal(outBody.skin, srcSkinIndex);
  const outSkin = out.json.skins[manifest.sourceSkin];
  assert.deepEqual(outSkin.joints, srcSkin.joints);
  const outIbm = readAccessor(out.json, out.binary, outSkin.inverseBindMatrices);
  assert.deepEqual(Array.from(outIbm), Array.from(srcIbm));
  assert.deepEqual(
    (out.json.animations || []).map((a) => ({ name: a.name, channels: a.channels.length, samplers: a.samplers.length })),
    srcAnims,
  );
  assert.deepEqual(srcAnims.map((a) => a.name).sort(), ['cast', 'idle', 'jumpLand', 'jumpLoop', 'jumpStart', 'run', 'walk']);
  for (const id of ['StarterShirt', 'StarterTrousers', 'StarterBoots']) {
    const node = out.json.nodes.find((n) => n.name === id);
    assert.ok(node, `${profile} ${id}`);
    assert.equal(node.skin, srcSkinIndex, `${profile} ${id} must use source body skin`);
    const idx = readAccessor(out.json, out.binary, out.json.meshes[node.mesh].primitives[0].indices);
    assert.ok(idx.length >= 3, `${profile} ${id} empty`);
  }
  const shortsIdx = out.json.nodes.findIndex((n) => n.name === shortsName);
  assert.ok(shortsIdx >= 0, shortsName);
  assert.equal(out.json.nodes.some((n) => n.children?.includes(shortsIdx)), false);
}

test('orc starter compose keeps orc skin, IBM, and animations', async () => {
  const buf = await loadRace('public/characters/bodies/orc-animated-v1.glb');
  assertOwnSkinCompose(buf, 'orc-v1', 'OrcV1Body', 'OrcV1Shorts');
});

test('undead starter compose keeps undead skin, IBM, and animations', async () => {
  const buf = await loadRace('public/characters/bodies/undead-animated-v1.glb');
  assertOwnSkinCompose(buf, 'undead-v1', 'UndeadV1Body', 'UndeadV1Shorts');
});
