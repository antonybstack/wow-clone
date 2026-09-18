/**
 * Grounded sole min Y from skinned mesh AABB / bind-space vertex samples.
 * Lite has no public bone world matrix; this uses public `computeMaxExtents`
 * plus the same CPU positions / boneMatrices the extents helper already reads.
 */
import { computeMaxExtents } from "@babylonjs/lite";

function transformPoint(matrix, x, y, z) {
  return [
    matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12],
    matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13],
    matrix[2] * x + matrix[6] * y + matrix[10] * z + matrix[14],
  ];
}

function accumulateSkinned(skeleton, vertex, lx, ly, lz, out) {
  const boneMatrices = skeleton.boneMatrices;
  if (!boneMatrices) return false;
  const apply = (joints, weights) => {
    if (!joints || !weights) return;
    const base = vertex * 4;
    for (let k = 0; k < 4; k++) {
      const w = weights[base + k];
      if (!(w > 0)) continue;
      const bone = joints[base + k];
      const mo = bone * 16;
      out[0] += w * (boneMatrices[mo] * lx + boneMatrices[mo + 4] * ly + boneMatrices[mo + 8] * lz + boneMatrices[mo + 12]);
      out[1] += w * (boneMatrices[mo + 1] * lx + boneMatrices[mo + 5] * ly + boneMatrices[mo + 9] * lz + boneMatrices[mo + 13]);
      out[2] += w * (boneMatrices[mo + 2] * lx + boneMatrices[mo + 6] * ly + boneMatrices[mo + 10] * lz + boneMatrices[mo + 14]);
    }
  };
  apply(skeleton.joints, skeleton.weights);
  apply(skeleton.joints1, skeleton.weights1);
  return true;
}

function aabbMinY(meshes) {
  if (!meshes.length) return null;
  const extents = computeMaxExtents(meshes);
  let minY = Infinity;
  for (const e of extents) {
    if (Number.isFinite(e.minimum[1])) minY = Math.min(minY, e.minimum[1]);
  }
  return Number.isFinite(minY) ? minY : null;
}

function vertexMinY(meshes) {
  let minY = Infinity;
  let sampled = 0;
  const local = [0, 0, 0];
  for (const mesh of meshes) {
    const positions = mesh._cpuPositions;
    const skeleton = mesh.skeleton;
    const world = mesh.worldMatrix;
    if (!positions || !world || positions.length < 3) continue;
    const vertexCount = (positions.length / 3) | 0;
    const canSkin = skeleton && skeleton.boneMatrices && skeleton.joints && skeleton.weights;
    for (let v = 0; v < vertexCount; v++) {
      const o = v * 3;
      const lx = positions[o];
      const ly = positions[o + 1];
      const lz = positions[o + 2];
      let x;
      let y;
      let z;
      if (canSkin) {
        local[0] = 0;
        local[1] = 0;
        local[2] = 0;
        if (!accumulateSkinned(skeleton, v, lx, ly, lz, local)) continue;
        [x, y, z] = transformPoint(world, local[0], local[1], local[2]);
      } else {
        [x, y, z] = transformPoint(world, lx, ly, lz);
      }
      if (!Number.isFinite(y)) continue;
      if (y < minY) minY = y;
      sampled++;
    }
  }
  return sampled ? { minY, sampled } : { minY: null, sampled: 0 };
}

/** World-space min Y of currently posed skinned meshes (actor is already rest-grounded). */
export function measureGroundedSole(meshes) {
  const all = meshes ?? [];
  const skinned = all.filter((m) => m.skeleton);
  const target = skinned.length ? skinned : all;
  const aabb = aabbMinY(target);
  const verts = vertexMinY(target);
  const minY = verts.minY ?? aabb;
  return {
    minY,
    aabbMinY: aabb,
    vertexMinY: verts.minY,
    sampledVertices: verts.sampled,
    meshCount: target.length,
    skinnedCount: skinned.length,
    method: verts.minY != null ? "vertex" : "aabb",
  };
}
