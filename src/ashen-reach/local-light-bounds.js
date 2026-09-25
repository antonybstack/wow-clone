/** Conservative light-range selection; independent of the gameplay camera. */

function finiteAffine(matrix, offset = 0) {
 if (!matrix || matrix.length < offset + 16) return false;
 for (let i = 0; i < 16; i++) if (!Number.isFinite(matrix[offset + i])) return false;
 return matrix[offset + 3] === 0 && matrix[offset + 7] === 0 &&
  matrix[offset + 11] === 0 && matrix[offset + 15] === 1;
}

/**
 * Whether any part of a mesh could intersect a light's spherical range.
 * Lite 1.28: Mesh.boundMin/Max are local; SkeletonData.boneMatrices contains
 * boneCount column-major matrices. The native skeleton fragment uses
 * world * sum(weight * boneMatrix). Call after the animation/transform update.
 *
 * Transform the whole local box by every palette bone, then union the world
 * boxes. For native nonnegative, normalized skin weights, this convex union
 * contains blended vertices BETWEEN bones too. Testing bones individually
 * would miss those vertices. Including unused bones only adds false positives.
 * This deliberately costs O(boneCount), with no vertex scan or
 * deep Lite imports; it also works for either four or eight skin influences.
 *
 * Morph, VAT and thin-instance deformation need other bounds; include them
 * conservatively. Missing, invalid or non-affine bounds/transforms also include.
 * Custom vertex displacement must supply bounds covering its displacement.
 */
export function canAffectLocalLight(mesh, positionArray, range = 8) {
 if (!validQuery(positionArray, range)) return true;
 const bounds = createBounds();
 return !evaluateWorldBounds(mesh, bounds) || intersectsRange(bounds, positionArray, range);
}

/**
 * Call beginFrame once AFTER pose/transform updates, BEFORE either slot queries.
 * Each mesh's posed box (including unknown results) is reused for that epoch.
 * Mutations within an epoch require another beginFrame; no transform/version
 * heuristic can detect stationary animation. Stats are cumulative across frames.
 */
export function createLocalLightBoundsCache() {
 const entries = new WeakMap(), stats = {evaluations: 0, hits: 0};
 let epoch = 0;
 return {
  stats,
  beginFrame() { epoch++; },
  canAffect(mesh, positionArray, range = 8) {
   if (!validQuery(positionArray, range) || !mesh ||
    (typeof mesh !== 'object' && typeof mesh !== 'function')) return true;
   let bounds = entries.get(mesh);
   if (bounds?.epoch === epoch) {
    stats.hits++;
   } else {
    if (!bounds) { bounds = createBounds(); entries.set(mesh, bounds); }
    bounds.known = evaluateWorldBounds(mesh, bounds);
    bounds.epoch = epoch;
    stats.evaluations++;
   }
   return !bounds.known || intersectsRange(bounds, positionArray, range);
  },
 };
}

function validQuery(position, range) {
 return position && Number.isFinite(range) && range >= 0 &&
  Number.isFinite(position[0]) && Number.isFinite(position[1]) && Number.isFinite(position[2]);
}

function createBounds() {
 return {min: [0, 0, 0], max: [0, 0, 0], epoch: -1, known: false};
}

// False means unknown, never an empty box. Reuse storage across cache epochs.
function evaluateWorldBounds(mesh, bounds) {
 if (!mesh) return false;
 const minimum = mesh.boundMin, maximum = mesh.boundMax;
 if (!minimum || !maximum) return false;
 for (let axis = 0; axis < 3; axis++) {
  if (!Number.isFinite(minimum[axis]) ||
   !Number.isFinite(maximum[axis]) || minimum[axis] > maximum[axis]) return false;
 }
 if (mesh.morphTargets || mesh.vat || mesh.thinInstances) return false;
 const world = mesh.worldMatrix;
 if (!finiteAffine(world)) return false;
 const skeleton = mesh.skeleton;
 const bones = skeleton?.boneMatrices;
 const count = skeleton ? skeleton.boneCount : 1;
 // A malformed/oversized palette must not turn selection into unbounded work.
 if (!Number.isInteger(count) || count < 1 || count > 1024 ||
  (skeleton && (!bones || bones.length < count * 16))) return false;

 const worldMin = bounds.min, worldMax = bounds.max;
 worldMin.fill(Infinity); worldMax.fill(-Infinity);
 for (let bone = 0; bone < count; bone++) {
  const offset = bone * 16;
  if (skeleton && !finiteAffine(bones, offset)) return false;
  for (let axis = 0; axis < 3; axis++) {
   let x = world[axis], y = world[axis + 4], z = world[axis + 8];
   let translation = world[axis + 12];
   if (skeleton) {
    // One row of world * bone, including parent scale, shear and reflection.
    translation += x * bones[offset + 12] + y * bones[offset + 13] + z * bones[offset + 14];
    const a = x * bones[offset] + y * bones[offset + 1] + z * bones[offset + 2];
    const b = x * bones[offset + 4] + y * bones[offset + 5] + z * bones[offset + 6];
    const c = x * bones[offset + 8] + y * bones[offset + 9] + z * bones[offset + 10];
    x = a; y = b; z = c;
   }
   const low = translation + x * (x < 0 ? maximum[0] : minimum[0]) +
    y * (y < 0 ? maximum[1] : minimum[1]) + z * (z < 0 ? maximum[2] : minimum[2]);
   const high = translation + x * (x < 0 ? minimum[0] : maximum[0]) +
    y * (y < 0 ? minimum[1] : maximum[1]) + z * (z < 0 ? minimum[2] : maximum[2]);
   if (!Number.isFinite(low) || !Number.isFinite(high)) return false;
   worldMin[axis] = Math.min(worldMin[axis], low);
   worldMax[axis] = Math.max(worldMax[axis], high);
  }
 }
 return true;
}

function intersectsRange(bounds, positionArray, range) {
 const worldMin = bounds.min, worldMax = bounds.max;
 // A small relative margin absorbs float32 skinning/transform roundoff at edges.
 let scale = Math.max(1, range);
 for (let axis = 0; axis < 3; axis++) {
  const p = positionArray[axis];
  scale = Math.max(scale, Math.abs(p), Math.abs(worldMin[axis]), Math.abs(worldMax[axis]));
 }
 const x = Math.max(worldMin[0] - positionArray[0], 0, positionArray[0] - worldMax[0]);
 const y = Math.max(worldMin[1] - positionArray[1], 0, positionArray[1] - worldMax[1]);
 const z = Math.max(worldMin[2] - positionArray[2], 0, positionArray[2] - worldMax[2]);
 return Math.hypot(x, y, z) <= range + scale * 1e-5;
}
