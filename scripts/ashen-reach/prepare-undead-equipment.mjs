/** Assemble the playable Undead pack from the Tripo-bound source body.

Body is public/characters/candidates/undead-source-v1.glb (single UndeadV1Body
mesh, 65-joint source bind, 57 clips). Catalogue garments are copied from the
Human pack for now — they share joint names and will deform on the actor skin.
A dedicated revenant fit is the next pass.

Usage: node scripts/ashen-reach/prepare-undead-equipment.mjs
*/
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {MeshoptDecoder, MeshoptEncoder} from 'meshoptimizer';
import {EQUIPMENT_ITEMS, UNDEAD_BASE_VISIBLE_MESHES} from '../../src/ashen-reach/equipment-catalog.js';
import {UNDEAD_EQUIPMENT_FIT} from '../../src/ashen-reach/equipment-contract.js';

const SRC = 'public/characters/candidates/undead-source-v1.glb';
const FITTED = '.cache/armory-assets/undead-tripo';
const DIR = 'public/ashen-reach/equipment-undead';
const URL_BASE = '/ashen-reach/equipment-undead';
await MeshoptDecoder.ready;
await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
    'meshopt.decoder': MeshoptDecoder,
    'meshopt.encoder': MeshoptEncoder,
});
const sha = bytes => createHash('sha256').update(bytes).digest('hex');

await fs.mkdir(DIR, {recursive: true});
const bodyDoc = await io.read(SRC);
const clips = bodyDoc.getRoot().listAnimations().length;
const bodyMeshes = bodyDoc.getRoot().listNodes().filter(n => n.getMesh()).map(n => n.getName());
for (const name of UNDEAD_BASE_VISIBLE_MESHES) {
    if (!bodyMeshes.includes(name)) throw Error(`Undead body missing ${name}, have ${bodyMeshes}`);
}
if (bodyDoc.getRoot().listSkins()[0].listJoints().length !== 65) throw Error('Not the 65-joint source bind');
if (clips !== 57) throw Error(`Expected 57 clips, have ${clips}`);

const bodyBytes = await io.writeBinary(bodyDoc);
await fs.writeFile(`${DIR}/body.glb`, bodyBytes);
const bodyHash = sha(bodyBytes);

const manifest = {
    schema: 1,
    fitId: UNDEAD_EQUIPMENT_FIT.body,
    sourceSha256: bodyHash,
    profileId: 'undead-tripo-v1',
    garments: true,
    items: {
        body: {
            url: `${URL_BASE}/body.glb`,
            bytes: bodyBytes.byteLength,
            sha256: bodyHash,
            meshes: [...UNDEAD_BASE_VISIBLE_MESHES],
        },
    },
};

const report = [];
for (const [id, item] of Object.entries(EQUIPMENT_ITEMS).filter(([, i]) => i.parts)) {
    const names = item.parts.map(p => p.mesh);
    const srcPath = `${FITTED}/${id}.glb`;
    const bytes = await fs.readFile(srcPath);
    await fs.writeFile(`${DIR}/${id}.glb`, bytes);
    manifest.items[id] = {
        url: `${URL_BASE}/${id}.glb`,
        bytes: bytes.byteLength,
        sha256: sha(bytes),
        meshes: names,
        fit: {...item.fits.undead},
    };
    report.push({id, bytes: bytes.byteLength, meshes: names});
}

await fs.writeFile(`${DIR}/manifest.json`, JSON.stringify(manifest, null, 4) + '\n');
await fs.writeFile(`${DIR}/provenance.json`, JSON.stringify({
    pipeline: 'Tripo Mixamo FBX bound to the 65-joint source',
    source: SRC,
    regenerate: 'node scripts/character-assets/undead_from_tripo.py && node scripts/character-assets/bind-source-undead.mjs && node scripts/ashen-reach/prepare-undead-equipment.mjs',
    fit: {...UNDEAD_EQUIPMENT_FIT},
    hashes: {[`${DIR}/body.glb`]: bodyHash},
    garments: report,
    note: 'Body is the Tripo Mixamo revenant. Catalogue clothes are ICP-fitted onto that surface (fit-orc-garments --target=undead).',
}, null, 2) + '\n');

console.log(JSON.stringify({
    body: bodyBytes.byteLength, clips, meshes: bodyMeshes, garments: report.length,
    totalMB: +((bodyBytes.byteLength + report.reduce((n, g) => n + g.bytes, 0)) / 1048576).toFixed(2),
}, null, 2));
