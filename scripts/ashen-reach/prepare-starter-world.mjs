/** Bake only the nearby scene. The full region uses the same generator in a worker. */
import {
  startupProvenance,
  pruneStartupAssets,
} from "./startup-provenance.mjs";
import fs from "node:fs/promises";
import path from "node:path";
import { gzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { MeshoptSimplifier } from "meshoptimizer";
import { buildChurchyard } from "../../src/ashen-reach/scene.js";
import { generateFoliagePlacements } from "../../src/ashen-reach/foliage.js";
import { createFoliageDensity } from "../../src/ashen-reach/foliage-density.js";
import {
  partitionWorld,
  START_BOUNDS,
  nearStart,
  selectTriangles,
} from "../../src/ashen-reach/world-partition.js";

const originalFetch = globalThis.fetch;
globalThis.fetch = async (url, options) =>
  typeof url === "string" && url.startsWith("/")
    ? new Response(await fs.readFile(path.join("public", url)))
    : originalFetch(url, options);
const source = await buildChurchyard(null, null, { dataOnly: true });
const data = partitionWorld(source);
const output = "public/ashen-reach/startup/starter";
await fs.mkdir(output, { recursive: true });
const hash = (b) => createHash("sha256").update(b).digest("hex");
const buffers = [];
let offset = 0;
const describe = ({ buffers: arrays, ...block }) => {
  const attributes = {};
  for (const [name, array] of Object.entries(arrays)) {
    const bytes = Buffer.from(array.buffer, array.byteOffset, array.byteLength);
    attributes[name] = { offset, length: array.length };
    buffers.push(bytes);
    offset += bytes.length;
  }
  return { ...block, attributes };
};
const blocks = data.batches.filter((b) => b.initial).map(describe);
// A temporary, non-colliding skyline made from the existing geometry. Welding
// only affects these distant proxies; final meshes retain every source byte.
// https://github.com/zeux/meshoptimizer/blob/v0.22/js/README.md#simplification
await MeshoptSimplifier.ready;
const proxies = [];
for (const batch of source.batches) {
  if (
    !batch.world ||
    (batch.name.startsWith("Woodland") && !batch.name.endsWith("reduced"))
  )
    continue;
  const data = batch.buffers,
    map = new Map(),
    first = [],
    dense = [],
    remap = new Uint32Array(data.positions.length / 3);
  for (let i = 0; i < remap.length; i++) {
    const p = data.positions.subarray(i * 3, i * 3 + 3),
      key = Array.from(p).join(",");
    if (!map.has(key)) {
      map.set(key, first.length);
      first.push(i);
      dense.push(...p);
    }
    remap[i] = map.get(key);
  }
  const far = [];
  for (let i = 0; i < data.indices.length; i += 3) {
    let x = 0,
      z = 0;
    for (let q = 0; q < 3; q++) {
      const v = data.indices[i + q] * 3;
      x += data.positions[v] / 3;
      z += data.positions[v + 2] / 3;
    }
    if (!nearStart(x, z))
      for (let q = 0; q < 3; q++) far.push(remap[data.indices[i + q]]);
  }
  if (!far.length) continue;
  const target = Math.min(
    far.length,
    batch.name.includes("earth") || batch.name.includes("terrain") ? 4500 : 900,
  );
  const [indices] = MeshoptSimplifier.simplify(
    new Uint32Array(far),
    new Float32Array(dense),
    3,
    target,
    0.002,
    ["Sparse"],
  );
  const original = Uint32Array.from(indices, (index) => first[index]);
  const buffers = selectTriangles(
    { ...data, indices: original },
    Array.from({ length: original.length / 3 }, (_, i) => i * 3),
  );
  proxies.push(
    describe({ name: batch.name, material: batch.material, buffers }),
  );
}
const placements = await generateFoliagePlacements({
  lights: data.metadata.lights,
  density: createFoliageDensity(data.metadata.extraFootprints),
  landmarks: [
    [-3.1, -2, 1.45],
    [3.1, -2.1, 1.5],
    [-3, 4, 1.3],
    [4, 9, 1.15],
    [-4, 12, 1.55],
  ].map(([x, z, scale]) => ({ x, z, scale })),
});
const foliage = {};
for (const [name, pool] of Object.entries(placements)) {
  const matrices = [],
    colors = [];
  for (let i = 0; i < pool.count; i++)
    if (
      nearStart(pool.matrices[i * 16 + 12], pool.matrices[i * 16 + 14]) &&
      (name !== "grass" ||
        i % 4 === 0 ||
        Math.hypot(pool.matrices[i * 16 + 12], pool.matrices[i * 16 + 14]) < 5)
    ) {
      matrices.push(...pool.matrices.subarray(i * 16, i * 16 + 16));
      colors.push(...pool.colors.subarray(i * 4, i * 4 + 4));
    }
  foliage[name] = describe({
    count: matrices.length / 16,
    buffers: {
      matrices: new Float32Array(matrices),
      colors: new Float32Array(colors),
    },
  });
}
const bytes = gzipSync(Buffer.concat(buffers), { level: 9 }),
  file = `near-${hash(bytes).slice(0, 12)}.bin`;
await fs.writeFile(path.join(output, file), bytes);
const textureURLs = {};
for (const url of new Set([
  ...data.surfaces.map((s) => s.url),
  "/ashen-reach/stone-detail.png",
  "/ashen-reach/sky-generated.jpg",
  "/ashen-reach/foliage-atlas.png",
])) {
  const bytes = await sharp(await fs.readFile(path.join("public", url)))
    .resize({
      width: url.endsWith("foliage-atlas.png") ? 512 : 128,
      height: url.endsWith("foliage-atlas.png") ? 512 : 128,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: 85 })
    .toBuffer();
  const name = `texture-${hash(bytes).slice(0, 12)}.webp`;
  await fs.writeFile(path.join(output, name), bytes);
  textureURLs[url] = `/ashen-reach/startup/starter/${name}`;
}
const { batches, ...manifest } = data;
await fs.writeFile(
  path.join(output, "manifest.json"),
  JSON.stringify({
    ...manifest,
    provenance: await startupProvenance(
      [
        "src/ashen-reach/scene.js",
        "src/ashen-reach/world-partition.js",
        "src/ashen-reach/foliage.js",
        "scripts/ashen-reach/prepare-starter-world.mjs",
      ],
      [
        "public/ashen-reach/woodland/trees.json",
        ...Object.keys(textureURLs).map((url) => "public" + url),
      ],
    ),
    bounds: START_BOUNDS,
    textureURLs,
    foliage,
    geometry: {
      file,
      sha256: hash(bytes),
      encodedBytes: bytes.length,
      rawBytes: offset,
      blocks,
      proxies,
    },
  }),
);
console.log(
  JSON.stringify({
    meshes: data.meshes.length,
    blocks: blocks.length,
    encodedBytes: bytes.length,
    rawBytes: offset,
  }),
);

globalThis.fetch = originalFetch;

await pruneStartupAssets("starter");
