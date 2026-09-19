/** Copy the sculpt-pipeline Orc candidate into the playable Orc pack.

Does not use MakeHuman garments or bulk_orc.py. Catalogue clothes are withheld
until a new fit exists for this topology.
*/
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';

const SRC = 'public/characters/candidates/orc-source-v1.glb';
const DIR = 'public/ashen-reach/equipment-orc';
const BODY = `${DIR}/body.glb`;
const sha = bytes => createHash('sha256').update(bytes).digest('hex');

await fs.mkdir(DIR, {recursive: true});
const bytes = await fs.readFile(SRC);
await fs.writeFile(BODY, bytes);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(BODY);
for (const mesh of doc.getRoot().listMeshes()) {
    if (mesh.getName().startsWith('OrcV1Eyes')) mesh.setName('OrcV1Eyes');
}
const meshes = doc.getRoot().listMeshes().map(m => m.getName());
const required = ['OrcV1Body', 'OrcV1Hair', 'OrcV1Brows', 'OrcV1Eyes', 'OrcV1Shorts'];
for (const name of required) {
    if (!meshes.includes(name)) throw Error(`Orc body missing ${name}`);
}
await io.write(BODY, doc);
const packed = await fs.readFile(BODY);
const hash = sha(packed);
const manifest = {
    schema: 1,
    sourceSha256: hash,
    profileId: 'orc-sculpt-v1',
    garments: false,
    items: {
        body: {
            url: '/ashen-reach/equipment-orc/body.glb',
            bytes: packed.byteLength,
            sha256: hash,
            meshes,
        },
    },
};
await fs.writeFile(`${DIR}/manifest.json`, JSON.stringify(manifest, null, 4) + '\n');
await fs.writeFile(`${DIR}/provenance.json`, JSON.stringify({
    pipeline: 'orc sculpt-pipeline pack',
    source: SRC,
    note: 'Playable Orc is the print-sculpt retopo on the 65-joint source bind. Catalogue garments are withheld. Surface derived from Male Orc for Print by Crayon (CC-BY 4.0).',
    hashes: {[SRC]: sha(bytes), [BODY]: hash},
}, null, 2) + '\n');
console.log(JSON.stringify({bytes: packed.byteLength, meshes, sha256: hash}));
