/** V18 LOD policy; distances are horizontal metres from stable instance roots. */
export const NEAR_RADIUS = 15;
export const REPACK_DISTANCE = 2;
export const DETAIL_FADE_START = 10;
export const DETAIL_FADE_END = 13;
export const FLUTTER_FADE_START = 10;
export const FLUTTER_FADE_END = 28;

/**
 * Hash the SAME float32 root used by the shader, before wind/displacement.
 * Quantize to 1/16 m; signed grid coordinates must fit i32 (game roots do).
 * Power-of-two quantization and uint operations match WGSL exactly. This keeps
 * planted positions, but intentionally changes the old sine hash's thinning
 * identities, retaining a uniform seed distribution rather than exact subsets.
 */
export function plantHashUint(x, z) {
 const qx = Math.floor(Math.fround(x) * 16) | 0;
 const qz = Math.floor(Math.fround(z) * 16) | 0;
 let h = Math.imul(qx, 0x9e3779b1) ^ Math.imul(qz, 0x85ebca77);
 h = Math.imul(h ^ (h >>> 16), 0x7feb352d);
 h = Math.imul(h ^ (h >>> 15), 0x846ca68b);
 return (h ^ (h >>> 16)) >>> 0;
}

/** [0,1), using 24 bits so CPU and GPU seeds are exactly representable in f32. */
export function plantHash(x, z) { return (plantHashUint(x, z) >>> 8) / 16777216; }

/** Valid pools: seed in [0,1], farRadius > 15, thin in [0,1], falloff > 0. */
export function removalRadius(seed, farRadius, farThin, farFalloff) {
 if (farThin === 0) return farRadius;
 return NEAR_RADIUS + (farRadius - NEAR_RADIUS) *
  Math.min(1, Math.pow((1 - seed) / farThin, 1 / farFalloff));
}

/** Rooted scale: start at max(13,end-width), zero at end. Valid end >= 15, width > 0. */
export function taper(distance, end, width = 4) {
 return intervalScale(distance, Math.max(DETAIL_FADE_END, end - width), end);
}

function intervalScale(distance, start, end) {
 const t = Math.max(0, Math.min(1, (distance - start) / Math.max(1e-5, end - start)));
 return 1 - t * t * (3 - 2 * t);
}

/** CPU packing uses <= this radius; repack before moving beyond the 2 m margin. */
export function packingRadius(end) { return end + REPACK_DISTANCE; }
export function detailScale(distance) {
 return intervalScale(distance, DETAIL_FADE_START, DETAIL_FADE_END);
}
/** Only multiplies fast flutter; preserve low-frequency gusts and player bending. */
export function flutterAttenuation(cameraDistance) {
 return intervalScale(cameraDistance, FLUTTER_FADE_START, FLUTTER_FADE_END);
}

/**
 * No uniforms or Lite imports. Root input must match CPU packed float32 X/Z;
 * do not hash a displaced vertex or a floating-origin-relative camera position.
 * Plant/detail distances use the current player; flutter uses the camera.
 * Multiply offsets from the root by scales (not the root position itself).
 * Radius pow arithmetic can differ by float32 roundoff; packing has a 2 m guard.
 */
export const FOLIAGE_LOD_WGSL = /* wgsl */ `
const FOLIAGE_NEAR_RADIUS: f32 = ${NEAR_RADIUS}.0;
const FOLIAGE_REPACK_DISTANCE: f32 = ${REPACK_DISTANCE}.0;
const FOLIAGE_DETAIL_FADE_START: f32 = ${DETAIL_FADE_START}.0;
const FOLIAGE_DETAIL_FADE_END: f32 = ${DETAIL_FADE_END}.0;
const FOLIAGE_FLUTTER_FADE_START: f32 = ${FLUTTER_FADE_START}.0;
const FOLIAGE_FLUTTER_FADE_END: f32 = ${FLUTTER_FADE_END}.0;

fn foliageRootHash(root: vec2<f32>) -> u32 {
 let q = vec2<i32>(floor(root * 16.0));
 var h = (bitcast<u32>(q.x) * 0x9e3779b1u) ^ (bitcast<u32>(q.y) * 0x85ebca77u);
 h = (h ^ (h >> 16u)) * 0x7feb352du;
 h = (h ^ (h >> 15u)) * 0x846ca68bu;
 return h ^ (h >> 16u);
}
fn foliagePlantHash(root: vec2<f32>) -> f32 {
 return f32(foliageRootHash(root) >> 8u) / 16777216.0;
}
fn foliageRemovalRadius(seed: f32, farRadius: f32, farThin: f32, farFalloff: f32) -> f32 {
 if (farThin == 0.0) { return farRadius; }
 return FOLIAGE_NEAR_RADIUS + (farRadius - FOLIAGE_NEAR_RADIUS) *
  min(1.0, pow((1.0 - seed) / farThin, 1.0 / farFalloff));
}
fn foliageIntervalScale(distance: f32, start: f32, end: f32) -> f32 {
 let t = clamp((distance - start) / max(0.00001, end - start), 0.0, 1.0);
 return 1.0 - t * t * (3.0 - 2.0 * t);
}
fn foliageTaper(distance: f32, end: f32, width: f32) -> f32 {
 return foliageIntervalScale(distance, max(FOLIAGE_DETAIL_FADE_END, end - width), end);
}
fn foliageScale(distance: f32, end: f32) -> f32 {
 return foliageTaper(distance, end, 4.0);
}
fn foliagePackingRadius(end: f32) -> f32 { return end + FOLIAGE_REPACK_DISTANCE; }
fn foliageDetailScale(distance: f32) -> f32 {
 return foliageIntervalScale(distance, FOLIAGE_DETAIL_FADE_START, FOLIAGE_DETAIL_FADE_END);
}
fn foliageFlutterAttenuation(cameraDistance: f32) -> f32 {
 return foliageIntervalScale(cameraDistance, FOLIAGE_FLUTTER_FADE_START, FOLIAGE_FLUTTER_FADE_END);
}
`;
