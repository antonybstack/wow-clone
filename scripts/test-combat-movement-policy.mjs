import test from 'node:test';
import assert from 'node:assert/strict';
import { movementRefusal, canAutoFace, facingRefusal, inContactRange } from '../src/ashen-reach/combat/movement-policy.js';

test('instants preserve running and airborne motion; ground-origin attacks require actual ground', () => {
  const air = { grounded: false, jump: true, speed: 7, forward: 1 };
  assert.equal(movementRefusal({ castTime: 0 }, air), '');
  assert.equal(movementRefusal({ castTime: 0, groundOrigin: true }, air), 'Land before casting');
  assert.equal(movementRefusal({ castTime: 0, groundOrigin: true }, { ...air, grounded: true, jump: false }), '');
});
test('stationary casts reject translation intent, residual movement and takeoff, but allow turning', () => {
  const hard = { castTime: 1.5 }, still = { grounded: true, speed: 0 };
  for (const delta of [{ forward: 1 }, { strafe: -1 }, { speed: .2 }]) assert.equal(movementRefusal(hard, { ...still, ...delta }), 'Stand still to cast');
  assert.equal(movementRefusal(hard, { ...still, jump: true }), 'Land before casting');
  assert.equal(movementRefusal(hard, { ...still, turn: 1 }), '');
});
test('idle auto-facing never overrides steering; ninety-degree cone has an explicit boundary', () => {
  assert.equal(canAutoFace({}, {}), true);
  for (const key of ['turn', 'rmb', 'faceCamera', 'looking']) assert.equal(canAutoFace({}, { [key]: 1 }), false);
  assert.equal(canAutoFace({ strafe: .5 }, {}), false);
  assert.equal(facingRefusal({ targeted: true }, Math.PI / 2, false), '');
  assert.equal(facingRefusal({ targeted: true }, Math.PI / 2 + .001, false), 'Face your target');
  assert.equal(facingRefusal({ targeted: true }, Math.PI, true), '');
});
test('melee contact rejects floors and escaped reach while accepting ordinary steps', () => {
  const from = { x: 0, y: 4, z: 0 };
  assert.equal(inContactRange(from, { x: 0, y: 5, z: 2 }, 2.5), true);
  assert.equal(inContactRange(from, { x: 0, y: 8, z: 0 }, 2.5), false);
  assert.equal(inContactRange(from, { x: 0, y: 4, z: 2.51 }, 2.5), false);
});
