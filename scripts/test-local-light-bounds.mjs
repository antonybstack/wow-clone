import test from 'node:test';
import assert from 'node:assert/strict';
import {canAffectLocalLight, createLocalLightBoundsCache} from '../src/ashen-reach/local-light-bounds.js';

const identity = () => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const translate = (x, y = 0, z = 0) => {
 const matrix = identity(); matrix[12] = x; matrix[13] = y; matrix[14] = z; return matrix;
};
const mesh = (overrides = {}) => ({boundMin: [-1, -1, -1], boundMax: [1, 1, 1], worldMatrix: identity(), ...overrides});
const skin = (...matrices) => ({boneCount: matrices.length, boneMatrices: new Float32Array(matrices.flat())});
const point = (matrix, p) => [0, 1, 2].map(i => matrix[i] * p[0] + matrix[i + 4] * p[1] + matrix[i + 8] * p[2] + matrix[i + 12]);

test('default range includes touching boxes and excludes separated boxes', () => {
 assert.equal(canAffectLocalLight(mesh(), [9, 0, 0]), true);
 assert.equal(canAffectLocalLight(mesh(), [9.01, 0, 0]), false);
 assert.equal(canAffectLocalLight(mesh(), [0, 0, 0], 0), true);
 assert.equal(canAffectLocalLight(mesh(), [1.1, 0, 0], 0), false);
 assert.equal(canAffectLocalLight(mesh(), [7, 7, 0]), false);
});

test('off-center geometry is selected by its bound, not mesh origin or camera visibility', () => {
 const subject = mesh({boundMin: [20, -1, -1], boundMax: [22, 1, 1], visible: false});
 Object.defineProperty(subject, 'isInFrustum', {get() {throw Error('camera must not be read');}});
 assert.equal(canAffectLocalLight(subject, [21, 0, 0]), true);
 assert.equal(canAffectLocalLight(subject, [0, 0, 0]), false);
});

test('world bounds include nonuniform scale, reflection, shear, rotation and translation', () => {
 const world = [0, -2, 0, 0, 4, 1, 0, 0, 0, 0, -.5, 0, 20, 3, 0, 1];
 const subject = mesh({worldMatrix: world});
 assert.equal(canAffectLocalLight(subject, [24, 4, -.5], 0), true);
 assert.equal(canAffectLocalLight(subject, [25, 4, 0], .5), false);
 assert.equal(canAffectLocalLight(subject, [20, 3, 0], 0), true);
});

test('a posed limb outside the bind box remains a caster', () => {
 const subject = mesh({worldMatrix: translate(30), skeleton: skin(identity(), translate(-30))});
 assert.equal(canAffectLocalLight(mesh({worldMatrix: translate(30)}), [0, 0, 0]), false);
 assert.equal(canAffectLocalLight(subject, [0, 0, 0]), true);
 assert.equal(canAffectLocalLight(subject, [60, 0, 0]), false);
});

test('world times bone order includes bone scale and parent affine transforms', () => {
 const world = [0, 2, 0, 0, -3, 1, 0, 0, 0, 0, .5, 0, 5, 7, 9, 1];
 const bone = [4, 0, 0, 0, 1, -.5, 0, 0, 0, 0, 2, 0, 10, 20, 30, 1];
 const subject = mesh({worldMatrix: world, skeleton: skin(bone)});
 for (let corner = 0; corner < 8; corner++) {
  const p = [0, 1, 2].map(i => corner & (1 << i) ? 1 : -1);
  assert.equal(canAffectLocalLight(subject, point(world, point(bone, p)), 0), true);
 }
 assert.equal(canAffectLocalLight(subject, [1000, 1000, 1000]), false);
});

test('union includes mixed-weight vertices between disjoint bone bounds', () => {
 const left = translate(-30), right = translate(30);
 assert.equal(canAffectLocalLight(mesh({skeleton: skin(left)}), [0, 0, 0]), false);
 assert.equal(canAffectLocalLight(mesh({skeleton: skin(right)}), [0, 0, 0]), false);
 assert.equal(canAffectLocalLight(mesh({skeleton: skin(left, right)}), [0, 0, 0]), true);
});

test('four/eight normalized influences and affine poses contain sampled blended vertices', () => {
 let seed = 17;
 const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32);
 const affine = () => {
  const m = identity();
  for (const i of [0, 1, 2, 4, 5, 6, 8, 9, 10]) m[i] = random() * 6 - 3;
  for (const i of [12, 13, 14]) m[i] = random() * 80 - 40;
  return m;
 };
 for (const count of [4, 8]) for (let pose = 0; pose < 30; pose++) {
  const matrices = Array.from({length: count}, affine), world = affine();
  const skeleton = skin(...matrices), subject = mesh({worldMatrix: world, skeleton});
  for (let vertex = 0; vertex < 12; vertex++) {
   const p = Array.from({length: 3}, () => random() * 2 - 1);
   const weights = Array.from({length: count}, random), total = weights.reduce((a, b) => a + b, 0);
   const blended = [0, 0, 0];
   for (let bone = 0; bone < count; bone++) {
    const posed = point(skeleton.boneMatrices.subarray(bone * 16, bone * 16 + 16), p);
    for (let axis = 0; axis < 3; axis++) blended[axis] += posed[axis] * weights[bone] / total;
   }
   assert.equal(canAffectLocalLight(subject, point(world, blended), 0), true);
  }
 }
});

test('live palette and world updates are read on every call', () => {
 const subject = mesh({worldMatrix: translate(30), skeleton: skin(identity())});
 assert.equal(canAffectLocalLight(subject, [0, 0, 0]), false);
 subject.skeleton.boneMatrices[12] = -30;
 assert.equal(canAffectLocalLight(subject, [0, 0, 0]), true);
 subject.skeleton.boneMatrices[12] = 0;
 subject.worldMatrix[12] = 0;
 assert.equal(canAffectLocalLight(subject, [0, 0, 0]), true);
});

test('missing, nonfinite, inverted and non-affine inputs conservatively include', () => {
 const invalid = [null, {}, mesh({boundMin: undefined}), mesh({boundMax: []}),
  mesh({boundMin: [NaN, 0, 0]}), mesh({boundMax: [Infinity, 1, 1]}),
  mesh({boundMin: [2, 0, 0]}), mesh({worldMatrix: undefined}), mesh({worldMatrix: [1]}),
  mesh({skeleton: {}}), mesh({skeleton: skin()}),
  mesh({skeleton: {boneCount: 2, boneMatrices: new Float32Array(identity())}}),
  mesh({skeleton: {boneCount: 1025, boneMatrices: new Float32Array(1025 * 16)}})];
 for (const value of [NaN, Infinity, -Infinity]) for (let i = 0; i < 16; i++) {
  const world = identity(); world[i] = value; invalid.push(mesh({worldMatrix: world}));
  const skeleton = skin(identity(), identity()); skeleton.boneMatrices[16 + i] = value;
  invalid.push(mesh({skeleton}));
 }
 for (const i of [3, 7, 11, 15]) {
  const matrix = identity(); matrix[i] = .5;
  invalid.push(mesh({worldMatrix: matrix}), mesh({skeleton: skin(matrix)}));
 }
 for (const subject of invalid) assert.equal(canAffectLocalLight(subject, [1000, 0, 0]), true);
 for (const position of [undefined, [], [NaN, 0, 0], [0, Infinity, 0]]) {
  assert.equal(canAffectLocalLight(mesh(), position), true);
 }
 for (const range of [-1, NaN, Infinity]) assert.equal(canAffectLocalLight(mesh(), [1000, 0, 0], range), true);
});

test('unsupported deformations and numeric overflow conservatively include', () => {
 for (const property of ['morphTargets', 'vat', 'thinInstances']) {
  assert.equal(canAffectLocalLight(mesh({[property]: {}}), [1000, 0, 0]), true);
 }
 const world = identity(); world[0] = Number.MAX_VALUE;
 assert.equal(canAffectLocalLight(mesh({worldMatrix: world, boundMax: [2, 1, 1]}), [1000, 0, 0]), true);
});

test('selection does not mutate mesh data or consult per-vertex buffers', () => {
 const subject = mesh({skeleton: {boneCount: 1, boneMatrices: Object.freeze(identity())}});
 for (const property of ['weights', 'joints', 'weights1', 'joints1']) {
  Object.defineProperty(subject.skeleton, property, {get() {throw Error('no vertex scan');}});
 }
 Object.freeze(subject.skeleton); Object.freeze(subject.worldMatrix);
 Object.freeze(subject.boundMin); Object.freeze(subject.boundMax); Object.freeze(subject);
 assert.equal(canAffectLocalLight(subject, Object.freeze([0, 0, 0])), true);
 assert.equal(canAffectLocalLight(subject, [1000, 0, 0]), false);
});

test('cache evaluates once for both lights, with independent position/range queries', () => {
 const cache = createLocalLightBoundsCache(), subject = mesh({skeleton: skin(identity())});
 let reads = 0;
 const world = subject.worldMatrix;
 Object.defineProperty(subject, 'worldMatrix', {get() { reads++; return world; }});
 cache.beginFrame();
 assert.equal(cache.canAffect(subject, [0, 0, 0]), true);
 assert.equal(cache.canAffect(subject, [30, 0, 0]), false);
 assert.equal(cache.canAffect(subject, [9.5, 0, 0], 8), false);
 assert.equal(cache.canAffect(subject, [9.5, 0, 0], 9), true);
 assert.equal(reads, 1);
 assert.deepEqual(cache.stats, {evaluations: 1, hits: 3});
 cache.beginFrame();
 cache.canAffect(subject, [0, 0, 0]);
 assert.equal(reads, 2);
 assert.deepEqual(cache.stats, {evaluations: 2, hits: 3});
});

test('beginFrame refreshes stationary animation despite unchanged worldMatrixVersion', () => {
 const cache = createLocalLightBoundsCache();
 const subject = mesh({worldMatrix: translate(30), worldMatrixVersion: 1, skeleton: skin(identity())});
 cache.beginFrame();
 assert.equal(cache.canAffect(subject, [0, 0, 0]), false);
 subject.skeleton.boneMatrices[12] = -30;
 assert.equal(cache.canAffect(subject, [0, 0, 0]), false, 'current epoch is a pose snapshot');
 assert.equal(canAffectLocalLight(subject, [0, 0, 0]), true, 'uncached API remains live');
 cache.beginFrame();
 assert.equal(cache.canAffect(subject, [0, 0, 0]), true);
 subject.skeleton.boneMatrices[12] = 0;
 cache.beginFrame();
 assert.equal(cache.canAffect(subject, [0, 0, 0]), false, 'bounds shrink as well as grow');
 assert.equal(subject.worldMatrixVersion, 1);
});

test('new epochs refresh mutated world matrices and local bounds', () => {
 const cache = createLocalLightBoundsCache(), subject = mesh();
 assert.equal(cache.canAffect(subject, [0, 0, 0]), true);
 subject.worldMatrix[12] = 30;
 cache.beginFrame();
 assert.equal(cache.canAffect(subject, [0, 0, 0]), false);
 subject.boundMin[0] = -31; subject.boundMax[0] = -29;
 cache.beginFrame();
 assert.equal(cache.canAffect(subject, [0, 0, 0]), true);
});

test('mesh identities and independent cache instances do not share entries', () => {
 const cache = createLocalLightBoundsCache(), otherCache = createLocalLightBoundsCache();
 const skeleton = skin(identity());
 const first = mesh({skeleton}), replacement = mesh({skeleton, worldMatrix: translate(30)});
 assert.equal(cache.canAffect(first, [0, 0, 0]), true);
 assert.equal(cache.canAffect(replacement, [0, 0, 0]), false);
 assert.deepEqual(cache.stats, {evaluations: 2, hits: 0});
 first.worldMatrix[12] = 30;
 assert.equal(otherCache.canAffect(first, [0, 0, 0]), false);
 assert.equal(cache.canAffect(first, [0, 0, 0]), true);
});

test('unknown results are cached conservatively and recover next epoch', () => {
 const cache = createLocalLightBoundsCache(), subject = mesh({skeleton: skin(identity())});
 assert.equal(cache.canAffect(subject, [1000, 0, 0]), false);
 subject.skeleton.boneMatrices[0] = NaN;
 cache.beginFrame();
 assert.equal(cache.canAffect(subject, [1000, 0, 0]), true);
 subject.skeleton.boneMatrices[0] = 1;
 assert.equal(cache.canAffect(subject, [2000, 0, 0]), true);
 assert.deepEqual(cache.stats, {evaluations: 2, hits: 1});
 cache.beginFrame();
 assert.equal(cache.canAffect(subject, [1000, 0, 0]), false);
});

test('cached malformed inputs include and invalid queries do not poison mesh entries', () => {
 const cache = createLocalLightBoundsCache();
 const badWorld = identity(); badWorld[15] = .5;
 const overflow = identity(); overflow[0] = Number.MAX_VALUE;
 const invalid = [null, undefined, 1, 'mesh', {}, mesh({boundMin: undefined}),
  mesh({boundMax: []}), mesh({boundMin: [2, 0, 0]}), mesh({boundMax: [Infinity, 1, 1]}),
  mesh({worldMatrix: badWorld}), mesh({skeleton: {}}), mesh({skeleton: skin()}),
  mesh({skeleton: {boneCount: 1025, boneMatrices: new Float32Array(1025 * 16)}}),
  mesh({worldMatrix: overflow, boundMax: [2, 1, 1]}),
  ...['morphTargets', 'vat', 'thinInstances'].map(property => mesh({[property]: {}}))];
 for (const subject of invalid) {
  assert.equal(cache.canAffect(subject, [1000, 0, 0]), true);
  assert.equal(cache.canAffect(subject, [2000, 0, 0]), true);
 }
 const subject = mesh();
 for (const position of [undefined, [], [NaN, 0, 0], [0, Infinity, 0]]) {
  assert.equal(cache.canAffect(subject, position), true);
 }
 for (const range of [-1, NaN, Infinity]) assert.equal(cache.canAffect(subject, [1000, 0, 0], range), true);
 assert.equal(cache.canAffect(subject, [1000, 0, 0]), false);
});

test('cached queries preserve affine, blended-bone and offscreen selection', () => {
 const cache = createLocalLightBoundsCache();
 const subject = mesh({visible: false,
  worldMatrix: [0, -2, 0, 0, 4, 1, 0, 0, 0, 0, -.5, 0, 20, 3, 0, 1],
  skeleton: skin(translate(-30), translate(30))});
 Object.defineProperty(subject, 'isInFrustum', {get() {throw Error('camera must not be read');}});
 Object.freeze(subject.worldMatrix); Object.freeze(subject.boundMin); Object.freeze(subject.boundMax);
 Object.freeze(subject.skeleton); Object.freeze(subject);
 cache.beginFrame();
 assert.equal(cache.canAffect(subject, [20, 3, 0], 0), true, 'blended middle stays inside union');
 for (const position of [[0, 0, 0], [24, 64, -.5], [25, 64, 0], [1000, 0, 0]]) {
  for (const range of [0, .5, 8, 9]) {
   assert.equal(cache.canAffect(subject, position, range), canAffectLocalLight(subject, position, range));
  }
 }
 assert.deepEqual(cache.stats, {evaluations: 1, hits: 16});
});
