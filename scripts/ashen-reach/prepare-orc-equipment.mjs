/** Copy the sculpt-pipeline Orc into the playable pack and remap fitted garments.

Catalogue clothes are shrink-fit onto this topology (not MHCLO). Each streamed
garment borrows the actor skin: joint order and inverse binds match body.glb.
OrcV1Body stays one surface; shorts/hair hide through packVisibility.
*/
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {mat3, vec3} from 'gl-matrix';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {mergeDocuments, prune, unpartition} from '@gltf-transform/functions';
import {EQUIPMENT_ITEMS, ORC_BASE_VISIBLE_MESHES} from '../../src/ashen-reach/equipment-catalog.js';

const SRC = 'public/characters/candidates/orc-source-v1.glb';
const DIR = 'public/ashen-reach/equipment-orc';
const BODY = `${DIR}/body.glb`;
const FITTED = '.cache/armory-assets/orc-sculpt';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);

function isIdentity(m) {
    return m.every((v, i) => Math.abs(v - (i % 5 === 0 ? 1 : 0)) < 1e-5);
}

function bakeIdentity(node) {
    const world = node.getWorldMatrix();
    node.setMatrix(IDENTITY);
    if (isIdentity(world)) return;
    const mesh = node.getMesh();
    if (!mesh) return;
    const nm = mat3.normalFromMat4(mat3.create(), world);
    const tmp = vec3.create();
    for (const prim of mesh.listPrimitives()) {
        const pos = prim.getAttribute('POSITION');
        if (pos) {
            const arr = pos.getArray();
            for (let i = 0; i < arr.length; i += 3) {
                vec3.transformMat4(tmp, [arr[i], arr[i + 1], arr[i + 2]], world);
                arr[i] = tmp[0];
                arr[i + 1] = tmp[1];
                arr[i + 2] = tmp[2];
            }
            pos.setArray(arr);
        }
        const nrm = prim.getAttribute('NORMAL');
        if (nrm) {
            const arr = nrm.getArray();
            for (let i = 0; i < arr.length; i += 3) {
                vec3.transformMat3(tmp, [arr[i], arr[i + 1], arr[i + 2]], nm);
                vec3.normalize(tmp, tmp);
                arr[i] = tmp[0];
                arr[i + 1] = tmp[1];
                arr[i + 2] = tmp[2];
            }
            nrm.setArray(arr);
        }
    }
}

function remapSkin(node, joints) {
    const oldSkin = node.getSkin();
    if (!oldSkin) throw Error('Unskinned garment ' + node.getName());
    const mapping = oldSkin.listJoints().map(n => joints.findIndex(j => j.getName() === n.getName()));
    for (const primitive of node.getMesh().listPrimitives()) {
        const weights = primitive.getAttribute('WEIGHTS_0')?.getArray();
        const indices = primitive.getAttribute('JOINTS_0');
        if (!weights || !indices) throw Error('Garment missing skin attributes: ' + node.getName());
        indices.setArray(Uint16Array.from(indices.getArray(), (joint, i) => {
            if (mapping[joint] < 0 && weights[i] > 0) {
                throw Error(`Unmapped weighted joint ${node.getName()} ${oldSkin.listJoints()[joint]?.getName()}`);
            }
            return Math.max(0, mapping[joint]);
        }));
    }
}

await fs.mkdir(DIR, {recursive: true});
const bytes = await fs.readFile(SRC);
await fs.writeFile(BODY, bytes);
const bodyDoc = await io.read(BODY);
for (const mesh of bodyDoc.getRoot().listMeshes()) {
    if (mesh.getName().startsWith('OrcV1Eyes')) mesh.setName('OrcV1Eyes');
}
const bodyMeshes = bodyDoc.getRoot().listMeshes().map(m => m.getName());
for (const name of ORC_BASE_VISIBLE_MESHES) {
    if (!bodyMeshes.includes(name)) throw Error(`Orc body missing ${name}`);
}
await io.write(BODY, bodyDoc);
const packed = await fs.readFile(BODY);
const bodyHash = sha(packed);
const bodyRig = (() => {
    const skin = bodyDoc.getRoot().listSkins()[0];
    return {
        joints: skin.listJoints().map(n => [n.getName(), n.getWorldMatrix()]),
        inverseBind: Array.from(skin.getInverseBindMatrices().getArray()),
    };
})();

const garmentItems = Object.entries(EQUIPMENT_ITEMS).filter(([, item]) => item.parts);
const manifest = {
    schema: 1,
    sourceSha256: bodyHash,
    profileId: 'orc-sculpt-v1',
    garments: true,
    items: {
        body: {
            url: '/ashen-reach/equipment-orc/body.glb',
            bytes: packed.byteLength,
            sha256: bodyHash,
            meshes: [...ORC_BASE_VISIBLE_MESHES],
        },
    },
    bindSha256: sha(JSON.stringify(bodyRig)),
};

const garmentReport = [];
for (const [id, item] of garmentItems) {
    const names = item.parts.map(p => p.mesh);
    const fittedPath = `${FITTED}/${id}.glb`;
    await fs.access(fittedPath);
    const doc = await io.readBinary(packed);
    const keepNodes = new Set(doc.getRoot().listNodes());
    const keepScenes = new Set(doc.getRoot().listScenes());
    const rest = await io.read(fittedPath);
    const merged = mergeDocuments(doc, rest);
    const root = doc.getRoot();
    const scene = root.getDefaultScene();
    const skin = root.listSkins()[0];
    const joints = skin.listJoints();
    for (const source of rest.getRoot().listNodes()) {
        if (!source.getMesh()) continue;
        const node = merged.get(source);
        remapSkin(node, joints);
        node.getParentNode()?.removeChild(node);
        bakeIdentity(node);
        node.setSkin(skin);
        scene.addChild(node);
        keepNodes.add(node);
    }
    for (const node of root.listNodes()) if (!keepNodes.has(node)) node.dispose();
    for (const extra of root.listScenes()) if (!keepScenes.has(extra)) extra.dispose();
    for (const extra of root.listSkins()) if (extra !== skin) extra.dispose();
    const keep = new Set(names);
    for (const n of root.listNodes()) {
        if (n.getMesh() && !keep.has(n.getName())) n.setMesh(null);
    }
    for (const a of root.listAnimations()) a.dispose();
    await doc.transform(unpartition(), prune({keepLeaves: true}));
    const missing = names.filter(name => !root.listNodes().some(n => n.getMesh() && n.getName() === name));
    if (missing.length) throw Error(`${id} missing meshes after pack: ${missing}`);
    for (const n of root.listNodes().filter(n => n.getMesh())) {
        if (!isIdentity(n.getWorldMatrix())) throw Error('Non-identity mesh bind: ' + n.getName());
    }
    const packedSkin = root.listSkins()[0];
    const packedRig = {
        joints: packedSkin.listJoints().map(n => [n.getName(), n.getWorldMatrix()]),
        inverseBind: Array.from(packedSkin.getInverseBindMatrices().getArray()),
    };
    if (JSON.stringify(packedRig) !== JSON.stringify(bodyRig)) {
        throw Error(`${id} skin does not match Orc body bind`);
    }
    const output = await io.writeBinary(doc);
    await fs.writeFile(`${DIR}/${id}.glb`, output);
    manifest.items[id] = {
        url: `/ashen-reach/equipment-orc/${id}.glb`,
        bytes: output.byteLength,
        sha256: sha(output),
        meshes: names,
        fit: item.fits.orc,
    };
    garmentReport.push({id, bytes: output.byteLength, meshes: names});
}

await fs.writeFile(`${DIR}/manifest.json`, JSON.stringify(manifest, null, 4) + '\n');
await fs.writeFile(`${DIR}/provenance.json`, JSON.stringify({
    pipeline: 'orc sculpt-pipeline pack',
    source: SRC,
    fitted: FITTED,
    note: 'Playable Orc is the print-sculpt retopo on the 65-joint source bind. Catalogue garments are scaled to Orc stature and pushed off OrcV1Body; Human mixamorig weights are reused. Surface derived from Male Orc for Print by Crayon (CC-BY 4.0). Garments remain CC0 MakeHuman suits02/gloves01.',
    hashes: {[SRC]: sha(bytes), [BODY]: bodyHash},
    garments: garmentReport,
}, null, 2) + '\n');
console.log(JSON.stringify({bytes: packed.byteLength, meshes: bodyMeshes, sha256: bodyHash, garments: garmentReport}));
