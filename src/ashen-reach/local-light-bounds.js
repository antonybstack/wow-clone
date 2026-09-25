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
 * This deliberately costs O(boneCount), with no vertex scan, pose cache, or
 * deep Lite imports; it also works for either four or eight skin influences.
 *
 * Morph, VAT and thin-instance deformation need other bounds; include them
 * conservatively. Missing, invalid or non-affine bounds/transforms also include.
 * Custom vertex displacement must supply bounds covering its displacement.
 */
export function canAffectLocalLight(mesh, positionArray, range = 8) {
 if (!mesh || !positionArray || !Number.isFinite(range) || range < 0) return true;
 const minimum = mesh.boundMin, maximum = mesh.boundMax;
 if (!minimum || !maximum) return true;
 for (let axis = 0; axis < 3; axis++) {
  if (!Number.isFinite(positionArray[axis]) || !Number.isFinite(minimum[axis]) ||
   !Number.isFinite(maximum[axis]) || minimum[axis] > maximum[axis]) return true;
 }
 if (mesh.morphTargets || mesh.vat || mesh.thinInstances) return true;
 const world = mesh.worldMatrix;
 if (!finiteAffine(world)) return true;
 const skeleton = mesh.skeleton;
 const bones = skeleton?.boneMatrices;
 const count = skeleton ? skeleton.boneCount : 1;
 // A malformed/oversized palette must not turn selection into unbounded work.
 if (!Number.isInteger(count) || count < 1 || count > 1024 ||
  (skeleton && (!bones || bones.length < count * 16))) return true;

 const worldMin = [Infinity, Infinity, Infinity];
 const worldMax = [-Infinity, -Infinity, -Infinity];
 for (let bone = 0; bone < count; bone++) {
  const offset = bone * 16;
  if (skeleton && !finiteAffine(bones, offset)) return true;
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
   if (!Number.isFinite(low) || !Number.isFinite(high)) return true;
   worldMin[axis] = Math.min(worldMin[axis], low);
   worldMax[axis] = Math.max(worldMax[axis], high);
  }
 }
 // A small relative margin absorbs float32 skinning/transform roundoff at edges.
 let scale = Math.max(1, range);
 const gap = [0, 0, 0];
 for (let axis = 0; axis < 3; axis++) {
  const p = positionArray[axis];
  scale = Math.max(scale, Math.abs(p), Math.abs(worldMin[axis]), Math.abs(worldMax[axis]));
  gap[axis] = Math.max(worldMin[axis] - p, 0, p - worldMax[axis]);
 }
 return Math.hypot(...gap) <= range + scale * 1e-5;
}
