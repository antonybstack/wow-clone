import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { gunzipSync, brotliDecompressSync } from "node:zlib";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { MeshoptDecoder } from "meshoptimizer";
import { verifyStartupAssets } from "./ashen-reach/startup-provenance.mjs";
import {
  partitionWorld,
  selectTriangles,
} from "../src/ashen-reach/world-partition.js";
await MeshoptDecoder.ready;
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ "meshopt.decoder": MeshoptDecoder });
const read = async (file) => io.readBinary(await fs.readFile(file));
const array = (a) => Array.from(a.getArray());

test(
  "prepared files match authoring inputs and content hashes",
  verifyStartupAssets,
);
test('starter terrain is actual Brotli data with matching HTTP metadata',async()=>{
  const root='public/ashen-reach/startup/starter/',manifest=JSON.parse(await fs.readFile(root+'manifest.json'));
  assert.equal(manifest.geometry.compression,'http-br');assert(manifest.geometry.file.endsWith('.br'));
  const bytes=brotliDecompressSync(await fs.readFile(root+manifest.geometry.file));
  assert.equal(bytes.length,manifest.geometry.rawBytes);
  for(const block of [...manifest.geometry.blocks,...manifest.geometry.proxies])
    for(const a of Object.values(block.attributes))assert(a.offset+a.length*4<=bytes.length);
  const headers=await fs.readFile('public/_headers','utf8');
  assert.match(headers,/\/ashen-reach\/startup\/starter\/\*\.br\s+Content-Type: application\/octet-stream\s+Content-Encoding: br/);
});
test("starter body preserves every source vertex, joint, weight and animation sample", async () => {
  const manifest = JSON.parse(
    await fs.readFile("public/ashen-reach/startup/character/manifest.json"),
  );
  const original = (
    await read("public/ashen-reach/equipment/body.glb")
  ).getRoot();
  const starter = (
    await io.readBinary(
      gunzipSync(await fs.readFile("public" + manifest.items.body.url)),
    )
  ).getRoot();
  assert.deepEqual(
    starter
      .listNodes()
      .map((n) => [
        n.getName(),
        n.getTranslation(),
        n.getRotation(),
        n.getScale(),
      ]),
    original
      .listNodes()
      .map((n) => [
        n.getName(),
        n.getTranslation(),
        n.getRotation(),
        n.getScale(),
      ]),
  );
  assert.equal(starter.listMeshes().length, original.listMeshes().length);
  for (let i = 0; i < original.listMeshes().length; i++) {
    const a = original.listMeshes()[i].listPrimitives(),
      b = starter.listMeshes()[i].listPrimitives();
    assert.equal(a.length, b.length);
    for (let j = 0; j < a.length; j++) {
      assert.deepEqual(array(b[j].getIndices()), array(a[j].getIndices()));
      assert.deepEqual(b[j].listSemantics(), a[j].listSemantics());
      for (const key of a[j].listSemantics())
        assert.deepEqual(
          array(b[j].getAttribute(key)),
          array(a[j].getAttribute(key)),
          `mesh ${i} ${key}`,
        );
    }
  }
  assert.deepEqual(
    starter
      .listSkins()
      .map((s) => [
        s.listJoints().map((n) => n.getName()),
        array(s.getInverseBindMatrices()),
      ]),
    original
      .listSkins()
      .map((s) => [
        s.listJoints().map((n) => n.getName()),
        array(s.getInverseBindMatrices()),
      ]),
  );
  const clips = (root) =>
    root
      .listAnimations()
      .map((a) => ({
        name: a.getName(),
        channels: a
          .listChannels()
          .map((c) => ({
            node: c.getTargetNode().getName(),
            path: c.getTargetPath(),
            interpolation: c.getSampler().getInterpolation(),
            input: array(c.getSampler().getInput()),
            output: array(c.getSampler().getOutput()),
          })),
      }));
  assert.equal(original.listAnimations().length, 57);
  assert.deepEqual(clips(starter), clips(original));
  for (const id of ["wayfarerTunic", "wayfarerTrousers", "wayfarerBoots"])
    assert.deepEqual(
      gunzipSync(await fs.readFile("public" + manifest.items[id].url)),
      await fs.readFile(`public/ashen-reach/equipment/${id}.glb`),
    );
});
test("partition preserves triangle attributes across the playable frontier", () => {
  const positions = new Float32Array([
    -2, 0, -2, 2, 0, -2, 0, 0, 2, 40, 3, 0, 42, 3, 0, 41, 3, 4,
  ]);
  const buffers = {
    positions,
    normals: new Float32Array(18).fill(0.25),
    uvs: new Float32Array(12).map((_, i) => i / 12),
    uv2: new Float32Array(12).fill(0.8),
    colors: new Float32Array(24).fill(0.6),
    indices: new Uint32Array([0, 1, 2, 3, 4, 5]),
  };
  const data = partitionWorld({
    batches: [
      { name: "ground", world: true, collision: true, material: 0, buffers },
    ],
  });
  assert.deepEqual(
    data.batches.map((b) => b.initial),
    [true, false],
  );
  assert.equal(data.meshes[0].indices, 6);
  for (let i = 0; i < 2; i++)
    assert.deepEqual(
      data.batches[i].buffers,
      selectTriangles(buffers, [i * 3]),
    );
  assert.equal(data.batches[1].vertexOffset, 3);
  assert.equal(data.batches[1].indexOffset, 3);
});
