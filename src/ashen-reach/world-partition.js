/** Pure, deterministic partition shared by the asset build and background worker.
 * No geometry simplification: every triangle and attribute survives unchanged.
 */
export const START_BOUNDS = { minX: -16, maxX: 16, minZ: -16, maxZ: 24 };
export const WORLD_COMPONENTS = {
  positions: 3,
  normals: 3,
  uvs: 2,
  uv2: 2,
  colors: 4,
};
export function nearStart(x, z) {
  return (
    x >= START_BOUNDS.minX &&
    x <= START_BOUNDS.maxX &&
    z >= START_BOUNDS.minZ &&
    z <= START_BOUNDS.maxZ
  );
}

export function selectTriangles(data, triangles) {
  const remap = new Map(),
    source = [],
    indices = new Uint32Array(triangles.length * 3);
  let cursor = 0;
  for (const triangle of triangles)
    for (let q = 0; q < 3; q++) {
      const old = data.indices[triangle + q];
      let next = remap.get(old);
      if (next === undefined) {
        next = source.length;
        source.push(old);
        remap.set(old, next);
      }
      indices[cursor++] = next;
    }
  const result = { indices };
  for (const [name, size] of Object.entries(WORLD_COMPONENTS)) {
    const values = (result[name] = new Float32Array(source.length * size));
    for (let i = 0; i < source.length; i++)
      for (let q = 0; q < size; q++)
        values[i * size + q] = data[name][source[i] * size + q];
  }
  return result;
}

export function partitionWorld(data) {
  const batches = [],
    meshes = [];
  for (const batch of data.batches) {
    const mesh = {
      name: batch.name,
      material: batch.material,
      world: batch.world,
      collision: batch.collision,
      vertices: 0,
      indices: 0,
      boundMin: [Infinity, Infinity, Infinity],
      boundMax: [-Infinity, -Infinity, -Infinity],
    };
    const meshId = meshes.length;
    meshes.push(mesh);
    const buckets = [[], []],
      b = batch.buffers;
    for (let i = 0; i < b.positions.length; i++) {
      const axis = i % 3;
      mesh.boundMin[axis] = Math.min(mesh.boundMin[axis], b.positions[i]);
      mesh.boundMax[axis] = Math.max(mesh.boundMax[axis], b.positions[i]);
    }
    for (let i = 0; i < b.indices.length; i += 3) {
      let x = 0,
        z = 0;
      for (let q = 0; q < 3; q++) {
        const v = b.indices[i + q] * 3;
        x += b.positions[v] / 3;
        z += b.positions[v + 2] / 3;
      }
      buckets[nearStart(x, z) ? 0 : 1].push(i);
    }
    for (let zone = 0; zone < 2; zone++) {
      // A bounded upload per scene mesh; hidden collision cooks use smaller pieces.
      // Havok cooking cannot yield inside one shape; keep each collision chunk
      // small enough to install while the player is moving.
      const limit = batch.collision ? 512 : 4096;
      for (let from = 0; from < buckets[zone].length; from += limit) {
        const buffers = selectTriangles(
          b,
          buckets[zone].slice(from, from + limit),
        );
        batches.push({
          meshId,
          initial: zone === 0,
          vertexOffset: mesh.vertices,
          indexOffset: mesh.indices,
          buffers,
        });
        mesh.vertices += buffers.positions.length / 3;
        mesh.indices += buffers.indices.length;
      }
    }
  }
  return { ...data, meshes, batches };
}
