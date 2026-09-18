import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseGlb, readAccessor } from '../src/character/runtime/glb.js';
import { composeFixture, OUTFITS } from '../src/character/runtime/compose-fixture.js';
import { FrameMetrics } from '../src/character/runtime/frame-metrics.js';
const file = await readFile(new URL('../public/characters/base.glb', import.meta.url));
const source = file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength);

test('assembly keeps one joint hierarchy, immutable source, and mesh-specific weights', () => {
  const before = new Uint8Array(source).slice();
  for (const outfit of Object.keys(OUTFITS)) {
    const { buffer, manifest } = composeFixture(source, { outfit });
    const { json, binary } = parseGlb(buffer);
    assert.equal(json.skins.length, 1);
    assert.equal(json.nodes.filter(n => n.skin === 0).length, 2 + OUTFITS[outfit].length);
    assert.equal(manifest.jointNames.length, 65);
    const ibm = readAccessor(json, binary, json.skins[0].inverseBindMatrices);
    assert.equal(ibm.length, 65 * 16);
    for (const mesh of json.meshes) {
      const p = mesh.primitives[0];
      const positions = readAccessor(json, binary, p.attributes.POSITION);
      const joints = readAccessor(json, binary, p.attributes.JOINTS_0);
      const weights = readAccessor(json, binary, p.attributes.WEIGHTS_0);
      assert.equal(joints.length, positions.length / 3 * 4);
      for (let i = 0; i < weights.length; i += 4) {
        assert.ok(Math.abs(weights[i] + weights[i + 1] + weights[i + 2] + weights[i + 3] - 1) < .001);
        for (let j = 0; j < 4; j++) assert.ok(joints[i + j] < 65);
      }
      assert.equal(readAccessor(json, binary, p.targets[0].POSITION).length, positions.length);
    }
  }
  assert.deepEqual(new Uint8Array(source), before);
});
test('unsupported profile/outfit and damaged GLB fail before replacement', () => {
  assert.throws(() => composeFixture(source, { profile: 'orc' }), /Unsupported fit/);
  assert.throws(() => composeFixture(source, { outfit: 'missing' }), /Unsupported outfit/);
  assert.throws(() => parseGlb(source.slice(0, 28)), /Invalid GLB/);
});
test('garment shells preserve source skin attributes but own shape and topology', () => {
  const { json, binary } = parseGlb(composeFixture(source).buffer);
  const body = json.meshes[1].primitives[0];
  for (const mesh of json.meshes.slice(2)) {
    const p = mesh.primitives[0];
    assert.notEqual(p.attributes.POSITION, body.attributes.POSITION);
    assert.notEqual(p.attributes.JOINTS_0, body.attributes.JOINTS_0);
    const positions = readAccessor(json, binary, p.attributes.POSITION);
    const joints = readAccessor(json, binary, p.attributes.JOINTS_0);
    const weights = readAccessor(json, binary, p.attributes.WEIGHTS_0);
    const indices = readAccessor(json, binary, p.indices);
    assert.equal(joints.length, positions.length / 3 * 4);
    assert.ok(indices.length > 600);
    assert.ok(p.attributes.TEXCOORD_0 != null);
    assert.ok(p.attributes.NORMAL != null);
    for (let i = 0; i < weights.length; i += 4) {
      assert.ok(Math.abs(weights[i] + weights[i + 1] + weights[i + 2] + weights[i + 3] - 1) < 0.001);
    }
  }
});
test('full outfit includes a skinned sleeve region separate from the torso shell', () => {
  const { json, binary } = parseGlb(composeFixture(source, { outfit: 'full' }).buffer);
  const names = json.meshes.map((m) => m.name);
  assert.ok(names.includes('Fixture_tunic'));
  assert.ok(names.includes('Fixture_trousers'));
  assert.ok(names.includes('Fixture_sleeve'));
  const sleeve = json.meshes.find((m) => m.name === 'Fixture_sleeve').primitives[0];
  const tunic = json.meshes.find((m) => m.name === 'Fixture_tunic').primitives[0];
  assert.notEqual(sleeve.indices, tunic.indices);
  assert.ok(readAccessor(json, binary, sleeve.indices).length > 300);
});
test('full outfit masks covered body triangles and keeps hand joints off the sleeve', () => {
  const before = new Uint8Array(source).slice();
  const src = parseGlb(source);
  const srcBody = src.json.meshes.find((m) => m.name === 'Alpha_Surface').primitives[0];
  const sourceCount = src.json.accessors[srcBody.indices].count;
  const { json, binary } = parseGlb(composeFixture(source, { outfit: 'full' }).buffer);
  const body = json.meshes.find((m) => m.name === 'Alpha_Surface').primitives[0];
  assert.ok(json.accessors[body.indices].count < sourceCount);
  const sleeve = json.meshes.find((m) => m.name === 'Fixture_sleeve').primitives[0];
  const joints = readAccessor(json, binary, sleeve.attributes.JOINTS_0);
  const weights = readAccessor(json, binary, sleeve.attributes.WEIGHTS_0);
  const sleeveIdx = readAccessor(json, binary, sleeve.indices);
  const handJoints = new Set(json.skins[0].joints.map((j, i) => [i, json.nodes[j].name]).filter(([, n]) => /Hand/.test(n)).map(([i]) => i));
  for (const v of sleeveIdx) {
    let best = 0, val = -1;
    for (let k = 0; k < 4; k++) {
      if (weights[v * 4 + k] > val) { val = weights[v * 4 + k]; best = joints[v * 4 + k]; }
    }
    assert.equal(handJoints.has(best), false);
  }
  const tunic = json.meshes.find((m) => m.name === 'Fixture_tunic').primitives[0];
  const tunicPos = readAccessor(json, binary, tunic.attributes.POSITION);
  const tunicIdx = readAccessor(json, binary, tunic.indices);
  assert.ok([...tunicIdx].some((v) => tunicPos[v * 3 + 1] < 1.05));
  assert.ok(json.asset.extras.shell === 'watertight-tube');
  assert.deepEqual(new Uint8Array(source), before);
});
test('frame metrics retain stalls, distinguish absent GPU timing, and flag overflow', () => {
  const metrics = new FrameMetrics(4); metrics.start({ scene: 'test' });
  for (const ms of [7, 7, 7, 200]) metrics.record(ms, 10, 0);
  const result = metrics.stop();
  assert.equal(result.meanMs, 55.25); assert.equal(result.worstMs, 200);
  assert.equal(result.above50, 1); assert.equal(result.gpuMs, null);
  metrics.start(); for (let i = 0; i < 5; i++) metrics.record(7);
  assert.equal(metrics.stop().truncated, true);
});

test('compacted garment probes retain the exact source vertex identity and skin weights', () => {
  const { buffer, manifest } = composeFixture(source);
  const { json, binary } = parseGlb(buffer);
  const body = json.meshes.find(m => m.name === 'Alpha_Surface').primitives[0];
  const bodyPos = readAccessor(json, binary, body.attributes.POSITION);
  const bodyJoints = readAccessor(json, binary, body.attributes.JOINTS_0);
  const bodyWeights = readAccessor(json, binary, body.attributes.WEIGHTS_0);
  for (const [id, pairs] of Object.entries(manifest.probes)) {
    const mesh = json.meshes.find(m => m.name === `Fixture_${id}`).primitives[0];
    const pos = readAccessor(json, binary, mesh.attributes.POSITION);
    const joints = readAccessor(json, binary, mesh.attributes.JOINTS_0);
    const weights = readAccessor(json, binary, mesh.attributes.WEIGHTS_0);
    assert.ok(pairs.length >= 40);
    assert.ok(pairs.some(p => p.bodyVertex !== p.garmentVertex));
    for (const { bodyVertex: a, garmentVertex: b } of pairs) {
      const gap = Math.hypot(...[0, 1, 2].map(k => pos[b * 3 + k] - bodyPos[a * 3 + k]));
      assert.ok(gap > .03 && gap < .04, `Invalid bind-space shell gap: ${gap}`);
      assert.deepEqual(joints.slice(b * 4, b * 4 + 4), bodyJoints.slice(a * 4, a * 4 + 4));
      assert.deepEqual(weights.slice(b * 4, b * 4 + 4), bodyWeights.slice(a * 4, a * 4 + 4));
    }
  }
});
