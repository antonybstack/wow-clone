import test from 'node:test';
import assert from 'node:assert/strict';
import {
 NEAR_RADIUS, REPACK_DISTANCE, DETAIL_FADE_START, DETAIL_FADE_END,
 FLUTTER_FADE_START, FLUTTER_FADE_END, plantHashUint, plantHash,
 removalRadius, packingRadius, taper, detailScale, flutterAttenuation, FOLIAGE_LOD_WGSL,
} from '../src/ashen-reach/foliage-lod.js';

const close = (a, b, tolerance = 1e-10) => assert.ok(Math.abs(a - b) <= tolerance, `${a} != ${b}`);
// Independent uint arithmetic reference; wrapping multiplication mirrors WGSL.
function uintReference(x, z) {
 const uint = n => BigInt.asUintN(32, n);
 const q = n => uint(BigInt(Math.floor(Math.fround(n) * 16)));
 let h = uint(q(x) * 0x9e3779b1n) ^ uint(q(z) * 0x85ebca77n);
 h = uint((h ^ (h >> 16n)) * 0x7feb352dn);
 h = uint((h ^ (h >> 15n)) * 0x846ca68bn);
 return Number(uint(h ^ (h >> 16n)));
}

test('policy constants and WGSL constants agree', () => {
 assert.deepEqual([NEAR_RADIUS, REPACK_DISTANCE, DETAIL_FADE_START, DETAIL_FADE_END], [15, 2, 10, 13]);
 for (const [name, value] of Object.entries({NEAR_RADIUS, REPACK_DISTANCE,
  DETAIL_FADE_START, DETAIL_FADE_END, FLUTTER_FADE_START, FLUTTER_FADE_END})) {
  assert.ok(FOLIAGE_LOD_WGSL.includes(`const FOLIAGE_${name}: f32 = ${value}.0;`));
 }
 assert.ok(!/\b(sin|cos)\s*\(/.test(FOLIAGE_LOD_WGSL), 'hash must not depend on GPU trigonometric precision');
 for (const literal of ['0x9e3779b1u', '0x85ebca77u', '0x7feb352du', '0x846ca68bu']) {
  assert.ok(FOLIAGE_LOD_WGSL.includes(literal));
 }
 assert.match(FOLIAGE_LOD_WGSL, /vec2<i32>\(floor\(root \* 16\.0\)\)/);
 assert.match(FOLIAGE_LOD_WGSL, /bitcast<u32>\(q\.x\)/);
 assert.ok(FOLIAGE_LOD_WGSL.includes('var h = (bitcast<u32>(q.x) * 0x9e3779b1u) ^ (bitcast<u32>(q.y) * 0x85ebca77u);'),
  'WGSL requires explicit grouping when mixing multiplication and bitwise XOR');
 assert.match(FOLIAGE_LOD_WGSL, /f32\(foliageRootHash\(root\) >> 8u\) \/ 16777216\.0/);
});

test('uint hash known answers cover positive, negative and fractional roots', () => {
 for (const [x, z, hash] of [[0, 0, 0], [1, 0, 3388130615], [0, 1, 1174967542],
  [-1, 0, 3118402787], [1.25, -2.5, 1344214771], [-.001, .0625, 3848110014],
  [300, -310, 2050996336]]) {
  assert.equal(plantHashUint(x, z), hash);
  assert.equal(uintReference(x, z), hash);
  assert.equal(plantHash(x, z), (hash >>> 8) / 16777216);
 }
});

test('hash matches uint reference and float32 packed roots at quantization boundaries', () => {
 for (let i = -200; i <= 200; i++) {
  for (const offset of [-1e-8, 0, 1e-8, .03125]) {
   const x = i / 16 + offset, z = -x * 1.7;
   assert.equal(plantHashUint(x, z), uintReference(x, z));
   assert.equal(plantHash(x, z), plantHash(Math.fround(x), Math.fround(z)));
   const seed = plantHash(x, z);
   assert.ok(seed >= 0 && seed < 1);
   assert.equal(Math.fround(seed), seed, '24-bit seed is exactly representable in WGSL f32');
  }
 }
 assert.equal(plantHash(.001, .001), plantHash(.06, .06), 'same quantized cell');
});

test('hash distribution retains broadly uniform thinning without preserving sine identities', () => {
 const bins = Array(10).fill(0);
 for (let x = -50; x < 50; x++) for (let z = -50; z < 50; z++) bins[Math.floor(plantHash(x, z) * 10)]++;
 for (const count of bins) assert.ok(count > 850 && count < 1150, `unexpected seed bucket ${count}`);
});

test('removal radius inverts the old keep curve for all shipped pool policies', () => {
 for (const [radius, thin, falloff] of [[28, .72, 1], [28, .93, 1], [185, .85, .9]]) {
  for (let i = 0; i <= 100; i++) {
   const seed = i / 100, end = removalRadius(seed, radius, thin, falloff);
   assert.ok(end >= NEAR_RADIUS && end <= radius);
   for (let d = NEAR_RADIUS; d <= radius; d += .137) {
    if (Math.abs(d - end) < 1e-8) continue;
    const keep = 1 - Math.pow((d - NEAR_RADIUS) / (radius - NEAR_RADIUS), falloff) * thin;
    assert.equal(d <= end, seed <= keep);
   }
  }
  assert.equal(removalRadius(0, radius, thin, falloff), radius);
  assert.equal(removalRadius(1, radius, thin, falloff), NEAR_RADIUS);
  assert.equal(removalRadius(.5, radius, 0, falloff), radius);
  assert.equal(removalRadius(1, radius, 0, falloff), radius, 'zero thinning avoids 0/0');
 }
});

test('taper is bounded, monotone and continuous with flat endpoints', () => {
 for (const end of [15, 28, 185]) for (const width of [1, 4, 7]) {
  const start = Math.max(13, end - width);
  assert.equal(taper(start - 1, end, width), 1);
  assert.equal(taper(end + 1, end, width), 0);
  close(taper((start + end) / 2, end, width), .5);
  close(taper(start + 1e-5, end, width), 1, 1e-8);
  close(taper(end - 1e-5, end, width), 0, 1e-8);
  let previous = 1;
  for (let i = 0; i <= 100; i++) {
   const value = taper(start + (end - start) * i / 100, end, width);
   assert.ok(value >= 0 && value <= previous + 1e-14);
   previous = value;
  }
 }
 assert.equal(taper(24, 28), 1);
 assert.equal(taper(26, 28), .5);
 assert.equal(taper(11, 15), 1);
 assert.equal(taper(13, 15), 1, 'highest seed cannot shrink near coverage before 13 m');
 assert.equal(taper(14, 15), .5);
 assert.equal(taper(15, 15), 0);
 assert.match(FOLIAGE_LOD_WGSL, /max\(FOLIAGE_DETAIL_FADE_END, end - width\)/);
 assert.match(FOLIAGE_LOD_WGSL, /max\(0\.00001, end - start\)/);
});

test('detail is gone before the earliest possible near/far swap between repacks', () => {
 assert.equal(detailScale(DETAIL_FADE_START), 1);
 assert.equal(detailScale(DETAIL_FADE_END), 0);
 assert.ok(DETAIL_FADE_END <= NEAR_RADIUS - REPACK_DISTANCE);
 for (let movement = 0; movement <= REPACK_DISTANCE; movement += .125) {
  assert.equal(detailScale(NEAR_RADIUS - movement), 0);
 }
 close(detailScale(11.5), .5);
});

test('packing guard covers movement in either direction until the next repack', () => {
 for (const end of [15, 19.5, 28, 185]) {
  assert.equal(packingRadius(end), end + 2);
  for (let movement = 0; movement <= REPACK_DISTANCE; movement += .125) {
   // Triangle inequality: a plant excluded at packing cannot become nonzero.
   const excludedDistance = packingRadius(end) + 1e-6;
   assert.equal(taper(excludedDistance - movement, end), 0);
   // A visible plant must have been inside the guarded packing radius.
   const visibleDistance = end - .001;
   assert.ok(visibleDistance + movement < packingRadius(end));
  }
  assert.equal(taper(packingRadius(end), end), 0, 'admission boundary is invisible');
 }
});

test('rooted scaling preserves the root and approaches it continuously', () => {
 const root = [14, 3, -20], offset = [.2, .8, -.1];
 const apply = (p, scale) => p.map((v, i) => root[i] + (v - root[i]) * scale);
 for (const distance of [0, 24, 26, 27.999, 28, 30]) {
  const scale = taper(distance, 28);
  assert.deepEqual(apply(root, scale), root);
  if (distance >= 28) assert.deepEqual(apply(root.map((v, i) => v + offset[i]), scale), root);
 }
});

test('flutter attenuation preserves near wind and suppresses distant fast flutter', () => {
 assert.equal(flutterAttenuation(0), 1);
 assert.equal(flutterAttenuation(FLUTTER_FADE_START), 1);
 assert.equal(flutterAttenuation(FLUTTER_FADE_END), 0);
 assert.equal(flutterAttenuation(185), 0);
 close(flutterAttenuation((FLUTTER_FADE_START + FLUTTER_FADE_END) / 2), .5);
 assert.match(FOLIAGE_LOD_WGSL, /fn foliageScale\(distance: f32, end: f32\)/);
 assert.match(FOLIAGE_LOD_WGSL, /return foliageTaper\(distance, end, 4\.0\)/);
});
