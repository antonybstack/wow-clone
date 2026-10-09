import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { gunzipSync, brotliDecompressSync, brotliCompressSync, constants } from "node:zlib";
import { createHash } from "node:crypto";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { MeshoptDecoder } from "meshoptimizer";
import { verifyCoveragePartition } from './character-assets/verify-coverage-partition.mjs';
import { verifyStartupAssets } from "./ashen-reach/startup-provenance.mjs";
import { verifyStarterGeometry } from "./ashen-reach/verify-starter-geometry.mjs";
import { ASHEN_PLAYABLE_CLIP_NAMES } from "../src/character/runtime/ashen-playable-motion.js";
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
  // Required near packet and (when split) the background skyline packet: hash, size,
  // decoded length and exact descriptor tiling of each, and proxies in exactly one packet.
  const result=await verifyStarterGeometry(manifest,file=>fs.readFile(root+file));
  assert(result.proxies>0&&result.near>0);
  if(manifest.geometry.skyline){
    const names=[...(manifest.geometry.proxies??[]),...manifest.geometry.skyline.proxies].map(p=>p.name);
    assert.equal(new Set(names).size,names.length);
    assert(manifest.geometry.skyline.file.startsWith('skyline-')&&manifest.geometry.skyline.file.endsWith('.br'));
    assert(result.skyline>0);
  }
  const headers=await fs.readFile('public/_headers','utf8');
  assert.match(headers,/\/ashen-reach\/startup\/starter\/\*\.br\s+Content-Type: application\/octet-stream\s+Content-Encoding: br/);
});
test("starter body preserves every source vertex, joint and weight, and exactly the playable animation samples", async () => {
  const manifest = JSON.parse(
    await fs.readFile("public/ashen-reach/startup/character/manifest.json"),
  );
  const original = (
    await read("public/ashen-reach/equipment/body.glb")
  ).getRoot();
  const actualStarter = (
    await io.readBinary(
      gunzipSync(await fs.readFile("public" + manifest.items.body.url)),
    )
  ).getRoot();
  // Check the unchanged source geometry separately from its conservative split.
  // https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#meshes
  const starter = (await io.readBinary(gunzipSync(await fs.readFile(
    'public' + manifest.items.body.coverageSource.url)))).getRoot();
  verifyCoveragePartition(starter, actualStarter, 'HumanV1Body', ['HumanTorsoCore', 'HumanFootCore']);
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
  // Source stays the full 57-clip library; first play carries exactly the 22 playable clips
  // with byte-identical samples (compactPlayableAnimations), never resampled or renamed.
  const playable = new Set(ASHEN_PLAYABLE_CLIP_NAMES);
  assert.equal(original.listAnimations().length, 57);
  assert.equal(playable.size, 22);
  assert.deepEqual(clips(starter).map((c) => c.name).sort(), [...playable].sort());
  assert.deepEqual(clips(starter), clips(original).filter((c) => playable.has(c.name)));
  assert.deepEqual(clips(actualStarter), clips(starter), "coverage split keeps the compact clips");
  assert.equal(manifest.items.body.detail, "playable");
  assert.deepEqual(manifest.items.body.playableClips, clips(starter).map((c) => c.name));
  assert.deepEqual(manifest.startup.sourceAnimations, original.listAnimations().map((a) => a.getName()));
  assert.deepEqual(manifest.startup.animations, manifest.items.body.playableClips);
  for (const id of ["wayfarerTunic", "wayfarerTrousers", "wayfarerBoots"]) {
    const entry = manifest.items[id];
    const current = gunzipSync(await fs.readFile("public" + entry.url));
    const canonical = await fs.readFile(`public/ashen-reach/equipment/${id}.glb`);
    const source = entry.coverageSource
      ? gunzipSync(await fs.readFile("public" + entry.coverageSource.url)) : current;
    assert.deepEqual(source, canonical, `${id} unsplit starter source`);
    if (entry.coverageSource) verifyCoveragePartition(
      (await io.readBinary(source)).getRoot(), (await io.readBinary(current)).getRoot(),
      'WayfarerTrousers', 'WayfarerTrousersUnderTorso');
  }
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

// In-memory packets following the generator's packing: proves the contract the verifier
// enforces without regenerated assets. Same Brotli/http-br form, tiny geometry.
function syntheticStarter() {
  const packet=(prefix,blocks)=>{let offset=0;const buffers=[];const described=blocks.map(({name,arrays})=>({name,attributes:Object.fromEntries(Object.entries(arrays).map(([k,a])=>{const r=[k,{offset,length:a.length}];buffers.push(Buffer.from(a.buffer));offset+=a.byteLength;return r;}))}));
    const bytes=brotliCompressSync(Buffer.concat(buffers),{params:{[constants.BROTLI_PARAM_QUALITY]:1}}),sha=createHash('sha256').update(bytes).digest('hex');
    return {descriptor:{compression:'http-br',file:`${prefix}-${sha.slice(0,12)}.br`,sha256:sha,encodedBytes:bytes.length,rawBytes:offset},described,bytes};};
  const tri=n=>({positions:new Float32Array(9).fill(n),indices:new Uint32Array([0,1,2])});
  const near=packet('near',[{name:'Earth',arrays:tri(1)},{name:undefined,arrays:{matrices:new Float32Array(16).fill(2),colors:new Float32Array(4)}}]);
  const sky=packet('skyline',[{name:'Earth',arrays:tri(3)}]);
  const files=new Map([[near.descriptor.file,near.bytes],[sky.descriptor.file,sky.bytes]]);
  const manifest={foliage:{grass:{count:1,attributes:near.described[1].attributes}},
    geometry:{...near.descriptor,blocks:[near.described[0]],skyline:{...sky.descriptor,proxies:sky.described}}};
  return {manifest,files,read:async f=>{if(!files.has(f))throw Error('missing '+f);return files.get(f);}};
}
test('split starter packets verify; corrupt hash, size, length, layout or placement is refused',async()=>{
  const ok=syntheticStarter();
  assert.deepEqual(await verifyStarterGeometry(ok.manifest,ok.read),{near:ok.manifest.geometry.rawBytes,skyline:ok.manifest.geometry.skyline.rawBytes,proxies:1,region:0,regionFoliage:0});
  const cases={
    'near sha':m=>{m.geometry.sha256='0'.repeat(64);},
    'skyline size':m=>{m.geometry.skyline.encodedBytes++;},
    'decoded length':m=>{m.geometry.skyline.rawBytes+=4;},
    'overlap':m=>{m.geometry.skyline.proxies[0].attributes.indices.offset=0;},
    'gap':m=>{m.geometry.blocks[0].attributes.indices.offset+=4;},
    'out of bounds':m=>{m.geometry.blocks[0].attributes.indices.length+=1;},
    'misaligned':m=>{m.geometry.blocks[0].attributes.positions.offset=2;},
    'proxies in both packets':m=>{m.geometry.proxies=m.geometry.skyline.proxies;},
    'stray proxy bytes left in near':m=>{m.geometry.blocks=[];},
    'wrong packet prefix':m=>{m.geometry.skyline.file=m.geometry.skyline.file.replace('skyline','near');},
    'not http-br':m=>{m.geometry.skyline.compression='gzip';},
  };
  for(const [name,mutate] of Object.entries(cases)){
    const c=syntheticStarter();mutate(c.manifest);
    await assert.rejects(verifyStarterGeometry(c.manifest,c.read),/Corrupt|both packets|missing/,name);
  }
  // Dropping the skyline descriptor leaves a valid near-only packet with no proxies; the real
  // asset test above requires proxies, so a regenerated manifest cannot silently lose them.
  const dropped=syntheticStarter();delete dropped.manifest.geometry.skyline;
  assert.equal((await verifyStarterGeometry(dropped.manifest,dropped.read)).proxies,0);
});
test('background render blocks may not duplicate required blocks or install collision',async()=>{
  const fixture=()=>{
    const c=syntheticStarter(),g=c.manifest.geometry;
    c.manifest.meshes=[{world:true,collision:false},{world:true,collision:true}];
    Object.assign(g.blocks[0],{meshId:1,indexOffset:0});
    g.skyline.blocks=[{...g.skyline.proxies[0],meshId:0,indexOffset:0}];
    g.skyline.proxies=[];
    return c;
  };
  const valid=fixture();await verifyStarterGeometry(valid.manifest,valid.read);
  for(const mutate of [
    c=>{c.manifest.meshes[0].collision=true;},
    c=>{c.manifest.geometry.blocks[0].meshId=0;},
    c=>{c.manifest.geometry.skyline.blocks[0].meshId=99;},
  ]){
    const c=fixture();mutate(c);
    await assert.rejects(verifyStarterGeometry(c.manifest,c.read),/Invalid non-colliding background block/);
  }
});
