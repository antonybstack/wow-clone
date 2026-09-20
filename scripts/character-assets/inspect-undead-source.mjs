#!/usr/bin/env node
// M11a measurement tool: report bind/clip/mesh facts for any character GLB so the
// "rebuild vs reuse" decision is made on numbers rather than on a guess.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import process from 'node:process';

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);

function bounds(prim) {
  const pos = prim.getAttribute('POSITION');
  if (!pos) return null;
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  const el = [0, 0, 0];
  for (let i = 0; i < pos.getCount(); i += 1) {
    pos.getElement(i, el);
    for (let a = 0; a < 3; a += 1) {
      if (el[a] < min[a]) min[a] = el[a];
      if (el[a] > max[a]) max[a] = el[a];
    }
  }
  return { min, max };
}

for (const path of process.argv.slice(2)) {
  const doc = await io.read(path);
  const root = doc.getRoot();
  const skins = root.listSkins();
  const anims = root.listAnimations();
  const meshes = root.listMeshes();

  let tris = 0;
  const overall = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
  const meshRows = [];
  for (const mesh of meshes) {
    let mTris = 0;
    let mVerts = 0;
    for (const prim of mesh.listPrimitives()) {
      const idx = prim.getIndices();
      const pos = prim.getAttribute('POSITION');
      mTris += idx ? idx.getCount() / 3 : (pos ? pos.getCount() / 3 : 0);
      mVerts += pos ? pos.getCount() : 0;
      const b = bounds(prim);
      if (b) {
        for (let a = 0; a < 3; a += 1) {
          overall.min[a] = Math.min(overall.min[a], b.min[a]);
          overall.max[a] = Math.max(overall.max[a], b.max[a]);
        }
      }
    }
    tris += mTris;
    meshRows.push(`${mesh.getName()} (${mVerts} v, ${Math.round(mTris)} tri)`);
  }

  const joints = skins.map((s) => s.listJoints().map((j) => j.getName()));
  const textures = root.listTextures().map((t) => t.getName() || t.getURI() || '(embedded)');

  console.log(`\n=== ${path} ===`);
  console.log(`nodes ${root.listNodes().length}  meshes ${meshes.length}  skins ${skins.length}  animations ${anims.length}  triangles ${Math.round(tris)}`);
  console.log(`skin joints: ${joints.map((j) => j.length).join(', ') || 'none'}`);
  console.log(`meshes: ${meshRows.join(' | ')}`);
  console.log(`textures: ${textures.join(', ') || 'none'}`);
  console.log(`materials: ${root.listMaterials().map((m) => m.getName()).join(', ')}`);
  if (Number.isFinite(overall.min[1])) {
    console.log(`rest bounds Y ${overall.min[1].toFixed(4)} .. ${overall.max[1].toFixed(4)} (height ${(overall.max[1] - overall.min[1]).toFixed(4)} m)`);
    console.log(`rest bounds X ${overall.min[0].toFixed(4)} .. ${overall.max[0].toFixed(4)} (span ${(overall.max[0] - overall.min[0]).toFixed(4)} m)`);
  }
  if (process.env.LIST_CLIPS) console.log(`clips:\n  ${anims.map((a) => a.getName()).join('\n  ')}`);
  if (process.env.LIST_JOINTS) joints.forEach((j, i) => console.log(`joints[${i}]:\n  ${j.join('\n  ')}`));
}
