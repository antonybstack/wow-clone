/** Pull the Undead Graveweaver hood's rear cloth in toward the skull.
 *
 * The ICP fit left the back of the cowl about 10 cm behind the head bone
 * (z -0.222 vs skull -0.121). The face opening (z >= skull back) is left
 * alone. Re-run after fit-orc-garments.mjs --target=undead --item=graveweaverHood
 * and then prepare, or the balloon comes back.
 *
 *   node scripts/ashen-reach/tuck-undead-hood.mjs
 */
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {MeshoptDecoder, MeshoptEncoder} from 'meshoptimizer';
import {createHash} from 'node:crypto';
import fs from 'node:fs/promises';

const HOOD = 'public/ashen-reach/equipment-undead/graveweaverHood.glb';
const MANIFEST = 'public/ashen-reach/equipment-undead/manifest.json';
const SKULL_BACK = -0.121;
const CLEARANCE = 0.03;

await MeshoptDecoder.ready;
await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'meshopt.decoder': MeshoptDecoder,
  'meshopt.encoder': MeshoptEncoder,
});
const doc = await io.read(HOOD);
const acc = doc.getRoot().listMeshes()[0].listPrimitives()[0].getAttribute('POSITION');
const src = acc.getArray();
const out = new Float32Array(src);
const limit = SKULL_BACK - CLEARANCE;
const smooth = (t) => {
  t = Math.max(0, Math.min(1, t));
  return t * t * (3 - 2 * t);
};
let moved = 0;
for (let i = 0; i < out.length; i += 3) {
  const x = out[i];
  const y = out[i + 1];
  const z = out[i + 2];
  const behind = limit - z;
  if (behind <= 0) continue;
  const crown = smooth((y - 1.48) / 0.32);
  const pull = 0.72 + 0.28 * crown;
  out[i + 2] = z + behind * pull;
  if (Math.abs(x) > 0.095 && z < SKULL_BACK) {
    const tuck = smooth(behind / 0.08) * 0.22 * crown;
    out[i] = x * (1 - tuck);
  }
  moved++;
}
acc.setArray(out);
const bytes = await io.writeBinary(doc);
await fs.writeFile(HOOD, bytes);
const sha = createHash('sha256').update(bytes).digest('hex');
const manifest = JSON.parse(await fs.readFile(MANIFEST, 'utf8'));
manifest.items.graveweaverHood.bytes = bytes.length;
manifest.items.graveweaverHood.sha256 = sha;
await fs.writeFile(MANIFEST, JSON.stringify(manifest, null, 4) + '\n');
console.log(JSON.stringify({moved, bytes: bytes.length, sha}));
