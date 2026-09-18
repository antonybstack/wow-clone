import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_CAPSULE, plantSpawnOnTerrain, resolveCapsule, resolveSpawnCenter } from '../src/player.js';
import { PLAYABLE_BODIES, HUMAN_V1_BODY_ID, ORC_V1_BODY_ID, UNDEAD_V1_BODY_ID, LEGACY_BODY_ID } from '../src/character/runtime/playable-body.js';

test('resolveCapsule uses legacy defaults and rejects invalid sizes', () => {
  assert.deepEqual(resolveCapsule(undefined), { height: 1.55, radius: 0.28 });
  assert.deepEqual(resolveCapsule(null), { height: 1.55, radius: 0.28 });
  assert.equal(DEFAULT_CAPSULE.height, 1.55);
  assert.equal(DEFAULT_CAPSULE.radius, 0.28);
  const human = resolveCapsule(PLAYABLE_BODIES[HUMAN_V1_BODY_ID].capsule);
  const orc = resolveCapsule(PLAYABLE_BODIES[ORC_V1_BODY_ID].capsule);
  const undead = resolveCapsule(PLAYABLE_BODIES[UNDEAD_V1_BODY_ID].capsule);
  assert.deepEqual(human, { height: 1.748, radius: 0.28 });
  assert.deepEqual(orc, { height: 2.10, radius: 0.38 });
  assert.deepEqual(undead, { height: 1.66, radius: 0.24 });
  assert.deepEqual(resolveCapsule(PLAYABLE_BODIES[LEGACY_BODY_ID].capsule), { height: 1.55, radius: 0.28 });
  assert.throws(() => resolveCapsule({ height: 0, radius: 0.28 }), /Invalid capsule/);
  assert.throws(() => resolveCapsule({ height: -1, radius: 0.28 }), /Invalid capsule/);
  assert.throws(() => resolveCapsule({ height: 1.7, radius: -0.1 }), /Invalid capsule/);
  assert.throws(() => resolveCapsule({ height: Number.NaN, radius: 0.28 }), /Invalid capsule/);
  assert.throws(() => resolveCapsule({ height: Infinity, radius: 0.28 }), /Invalid capsule/);
  const spec = resolveCapsule({ height: 2.1, radius: 0.38 });
  spec.height = 9;
  assert.equal(DEFAULT_CAPSULE.height, 1.55);
  assert.throws(() => resolveCapsule({ height: 0.5, radius: 0.28 }), /2\*radius/);
});

test('explicit spawn Y is honored; tall capsules clamp up out of the floor', () => {
  const ground = () => 0.125;
  const legacy = resolveCapsule(undefined);
  const high = resolveSpawnCenter({ x: 0, y: 5, z: -6 }, legacy, ground);
  assert.equal(high.y, 5);
  assert.equal(high.clamped, false);
  const defaulted = resolveSpawnCenter({ x: 0, y: 1.15, z: 2.15 }, legacy, ground);
  assert.equal(defaulted.y, 1.15);
  const missingY = resolveSpawnCenter({ x: 2, z: -3 }, legacy, ground);
  assert.equal(missingY.y, 0.125 + 1.55 * 0.5);
  assert.equal(missingY.clamped, true);
  const orc = resolveCapsule(PLAYABLE_BODIES[ORC_V1_BODY_ID].capsule);
  const embedded = resolveSpawnCenter({ x: 0, y: 1, z: -6 }, orc, ground);
  assert.equal(embedded.y, 0.125 + 2.10 * 0.5);
  assert.equal(embedded.clamped, true);
  const undead = resolveCapsule(PLAYABLE_BODIES[UNDEAD_V1_BODY_ID].capsule);
  const undeadOk = resolveSpawnCenter({ x: 0, y: 1, z: -6 }, undead, ground);
  assert.equal(undeadOk.y, Math.max(1, 0.125 + 1.66 * 0.5));
});

test('starter-zone plant sits on terrain even when authored spawn Y is 1', () => {
  const ground0 = () => 0;
  const human = resolveCapsule(PLAYABLE_BODIES[HUMAN_V1_BODY_ID].capsule);
  const planted = plantSpawnOnTerrain({ x: 0, y: 1, z: -6 }, human, ground0);
  assert.equal(planted.y, 1.748 * 0.5);
  assert.equal(planted.ground, 0);
  assert.ok(Math.abs(planted.y - human.height * 0.5) < 1e-12);
  const stillHigh = resolveSpawnCenter({ x: 0, y: 5, z: -6 }, human, ground0);
  assert.equal(stillHigh.y, 5);
  const orc = resolveCapsule(PLAYABLE_BODIES[ORC_V1_BODY_ID].capsule);
  const orcPlant = plantSpawnOnTerrain({ x: 0, y: 1, z: -6 }, orc, ground0);
  assert.equal(orcPlant.y, 2.10 * 0.5);
});
