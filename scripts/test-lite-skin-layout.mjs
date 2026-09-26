import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assertLiteSocketLayout, liteAnimationClip, liteSkinBinding, liteSocketLayoutReady,
} from '../src/character/adapters/lite-skin-layout.js';
import { jointWorldMatrix } from '../src/character/sockets.js';

const identity = () => Float32Array.from([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
const translation = (x, y, z) => {
  const out = identity();
  out[12] = x; out[13] = y; out[14] = z;
  return out;
};
const binding = () => ({
  jointNodes: [4], boneMatrices: translation(2, 3, 4),
  inverseBindMatrices: translation(-1, -2, -3), invMeshWorld: translation(-5, 0, 0),
});
const loaded = (skin = binding()) => ({
  skeleton: { bones: [{ name: 'RightHand', _nodeIndex: 4 }] },
  groups: [{ name: 'Walk_Loop', targetedAnimations: [{ path: 'rotation' }], _gltfMixer: [
    { channels: [] }, null, [skin],
  ] }],
  skinned: { skeleton: { boneMatrices: skin.boneMatrices } },
  hand: { name: 'RightHand', _nodeIndex: 4 },
});

test('loading state stays nullable and a loaded skin with changed private layout fails clearly', () => {
  assert.doesNotThrow(() => assertLiteSocketLayout({ skeleton: null, groups: [], skinned: null }));
  const actor = loaded();
  assert.equal(liteSocketLayoutReady(actor), true);
  assert.equal(liteSkinBinding(actor.groups), actor.groups[0]._gltfMixer[2][0]);
  assert.doesNotThrow(() => assertLiteSocketLayout(actor));
  assert.throws(() => assertLiteSocketLayout({ ...actor, groups: [{
    name: 'Walk_Loop', targetedAnimations: [{ path: 'rotation' }],
  }] }), /LITE_SKIN_LAYOUT.*hand palette/);
  assert.throws(() => assertLiteSocketLayout({ ...actor, hand: { name: 'RightHand' } }),
    /LITE_SKIN_LAYOUT.*indexed main-hand/);
});

test('socket joint world reconstruction retains palette, inverse bind and mesh-load order', () => {
  const actor = loaded();
  const result = jointWorldMatrix(actor.groups, actor.hand);
  assert.deepEqual(Array.from(result.slice(12, 15)), [8, 5, 7]);
});

test('animation root-channel bridge allows loading but reports a loaded incompatible mixer', () => {
  assert.equal(liteAnimationClip({ name: 'pending' }), null);
  const clip = { channels: [] };
  assert.equal(liteAnimationClip({ _gltfMixer: [clip] }), clip);
  assert.throws(() => liteAnimationClip({ name: 'Hit_Chest', targetedAnimations: [{}] }),
    /LITE_SKIN_LAYOUT.*Hit_Chest/);
});
