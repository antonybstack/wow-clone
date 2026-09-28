/** Developer-only old/bald Human hood fit experiment.
 * This writes an ignored candidate and matching streamed manifest. It is not
 * selected by the game or copied to public/. The old head's material seam and
 * creator capability remain unresolved, so a better hood alone cannot ship it.
 * glTF morph targets are primitive-local deltas and keep their original order:
 * https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#morph-targets
 */
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import {NodeIO, VertexLayout} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {MeshoptDecoder} from 'meshoptimizer';

await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({'meshopt.decoder': MeshoptDecoder})
  .setVertexLayout(VertexLayout.SEPARATE);
const source = '.cache/character-mmo/m005/graveweaverHood.glb';
const sourceManifest = '.cache/character-mmo/m005/manifest.json';
const amount = Number(process.argv[2] ?? 0.035);
if (!(amount > 0 && amount <= 0.04)) throw Error('Expected hood outward fit in (0, 0.04] m');
const label = Math.round(amount * 1000);
const output = `.cache/character-mmo/m006/graveweaver-hood-old-fit-${label}mm.glb`;
const outputManifest = `.cache/character-mmo/m006/graveweaver-hood-old-fit-${label}mm.json`;
const doc = await io.read(source);
const mesh = doc.getRoot().listMeshes().find(m => m.getName() === 'GraveweaverHood');
if (!mesh || mesh.listPrimitives().length !== 1) throw Error('Unexpected hood structure');
const prim = mesh.listPrimitives()[0];
if (prim.listTargets().length !== 2) throw Error('Hood lost two shape targets');
const accessor = prim.getAttribute('POSITION');
const old = accessor.getArray();
const positions = new Float32Array(old);
let moved = 0, maxShift = 0;
for (let i = 0; i < positions.length; i += 3) {
  const x = old[i], y = old[i + 1], z = old[i + 2];
  // Keep the neckline and face opening near their authored positions. Enlarge
  // only the skull enclosure; the old head and native head share the same skin.
  const k = Math.max(0, Math.min(1, (y - 1.545) / .12));
  const smooth = k * k * (3 - 2 * k);
  const side = Math.max(0, Math.min(1, (Math.abs(x) - .035) / .055));
  const rear = Math.max(0, Math.min(1, (-z - .018) / .105));
  const dx = Math.sign(x) * amount * smooth * side;
  const dz = -amount * .75 * smooth * rear;
  const dy = amount * .4 * Math.max(0, Math.min(1, (y - 1.675) / .10));
  positions[i] += dx;
  positions[i + 1] += dy;
  positions[i + 2] += dz;
  const shift = Math.hypot(dx, dy, dz);
  if (shift > 1e-7) moved++;
  maxShift = Math.max(maxShift, shift);
}
accessor.setArray(positions);
const bytes = await io.writeBinary(doc);
await fs.writeFile(output, bytes);
const check = (await io.read(output)).getRoot();
const fitted = check.listMeshes().find(m => m.getName() === 'GraveweaverHood')?.listPrimitives()[0];
if (check.listMeshes().length !== 1 || check.listSkins()[0]?.listJoints().length !== 65
  || fitted?.getAttribute('POSITION')?.getCount() !== old.length / 3
  || fitted.getIndices().getCount() !== prim.getIndices().getCount()
  || fitted.listTargets().length !== 2
  || check.listMaterials().length !== doc.getRoot().listMaterials().length) {
  throw Error('Old-head hood candidate lost mesh, bind, morph or material structure');
}
for (let target = 0; target < 2; target++) {
  const sourceDelta = prim.listTargets()[target].getAttribute('POSITION').getArray();
  const fittedDelta = fitted.listTargets()[target].getAttribute('POSITION').getArray();
  if (sourceDelta.length !== fittedDelta.length
    || sourceDelta.some((value, index) => Math.abs(value - fittedDelta[index]) > 1e-7)) {
    throw Error(`Old-head hood candidate changed morph target ${target}`);
  }
}
const manifest = JSON.parse(await fs.readFile(sourceManifest, 'utf8'));
manifest.items.graveweaverHood.bytes = bytes.length;
manifest.items.graveweaverHood.sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
await fs.writeFile(outputManifest, JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify({output, outputManifest, bytes: bytes.length, moved, maxShift,
  vertices: fitted.getAttribute('POSITION').getCount(), triangles: fitted.getIndices().getCount() / 3}));
