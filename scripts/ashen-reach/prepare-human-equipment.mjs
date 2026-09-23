/** Replace the playable Human pack with the Tripo-bound body and refitted clothes.

Body is public/characters/candidates/human-source-v1.glb (HumanV1Body, 65 joints,
57 clips). Garments come from fit-orc-garments.mjs --target=human and are rebound
onto that body's skin, the same way the Orc pack borrows its actor palette.

Usage: node scripts/ashen-reach/prepare-human-equipment.mjs
*/
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {mat3, vec3} from 'gl-matrix';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {mergeDocuments, prune, unpartition} from '@gltf-transform/functions';
import {MeshoptDecoder, MeshoptEncoder} from 'meshoptimizer';
import {EQUIPMENT_ITEMS} from '../../src/ashen-reach/equipment-catalog.js';
import {HUMAN_EQUIPMENT_FIT} from '../../src/ashen-reach/equipment-contract.js';

const SRC = 'public/characters/candidates/human-source-v1.glb';
const FITTED = '.cache/armory-assets/human-tripo';
const DIR = 'public/ashen-reach/equipment';
const URL_BASE = '/ashen-reach/equipment';
const BODY_MESHES = ['HumanV1Body'];
const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

await MeshoptDecoder.ready;
await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
    'meshopt.decoder': MeshoptDecoder,
    'meshopt.encoder': MeshoptEncoder,
});
const sha = bytes => createHash('sha256').update(bytes).digest('hex');

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

function rigOf(doc) {
    const skin = doc.getRoot().listSkins()[0];
    return {
        joints: skin.listJoints().map(n => [n.getName(), Array.from(n.getWorldMatrix())]),
        inverseBind: Array.from(skin.getInverseBindMatrices().getArray()),
    };
}

const bodyDoc = await io.read(SRC);
const clips = bodyDoc.getRoot().listAnimations().length;
const bodyMeshes = bodyDoc.getRoot().listNodes().filter(n => n.getMesh()).map(n => n.getName());
for (const name of BODY_MESHES) {
    if (!bodyMeshes.includes(name)) throw Error(`Human body missing ${name}, have ${bodyMeshes}`);
}
if (bodyDoc.getRoot().listSkins()[0].listJoints().length !== 65) throw Error('Not the 65-joint source bind');
if (clips !== 57) throw Error(`Expected 57 clips, have ${clips}`);
{
    const node = bodyDoc.getRoot().listNodes().find(n => n.getName() === 'HumanV1Body' && n.getMesh());
    const pos = node.getMesh().listPrimitives()[0].getAttribute('POSITION').getArray();
    let minY = Infinity, maxY = -Infinity;
    for (let i = 1; i < pos.length; i += 3) {
        if (pos[i] < minY) minY = pos[i];
        if (pos[i] > maxY) maxY = pos[i];
    }
    const height = maxY - minY;
    if (height < 1.5 || height > 2.0) throw Error(`HumanV1Body height ${height.toFixed(3)} m is not the playable scale`);
    console.log(`HumanV1Body Y ${minY.toFixed(3)}..${maxY.toFixed(3)} (${height.toFixed(3)} m)`);
}

const bodyBytes = await io.writeBinary(bodyDoc);
await fs.writeFile(`${DIR}/body.glb`, bodyBytes);
const bodyHash = sha(bodyBytes);
const bodyRig = rigOf(bodyDoc);

const manifest = JSON.parse(await fs.readFile(`${DIR}/manifest.json`, 'utf8'));
manifest.fitId = HUMAN_EQUIPMENT_FIT.body;
manifest.sourceSha256 = bodyHash;
manifest.profileId = 'human-tripo-v1';
manifest.garments = true;
manifest.bindSha256 = sha(JSON.stringify(bodyRig));
manifest.items.body = {
    url: `${URL_BASE}/body.glb`,
    bytes: bodyBytes.byteLength,
    sha256: bodyHash,
    meshes: [...BODY_MESHES],
};

const report = [];
for (const [id, item] of Object.entries(EQUIPMENT_ITEMS).filter(([, entry]) => entry.parts)) {
    const names = item.parts.map(part => part.mesh);
    const fittedPath = `${FITTED}/${id}.glb`;
    await fs.access(fittedPath);
    const doc = await io.readBinary(bodyBytes);
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
    for (const node of root.listNodes()) {
        if (node.getMesh() && !keep.has(node.getName())) node.setMesh(null);
    }
    for (const animation of root.listAnimations()) {
        for (const channel of animation.listChannels()) channel.dispose();
        for (const sampler of animation.listSamplers()) sampler.dispose();
        animation.dispose();
    }
    await doc.transform(unpartition(), prune({keepLeaves: true}));
    const missing = names.filter(name => !root.listNodes().some(node => node.getMesh() && node.getName() === name));
    if (missing.length) throw Error(`${id} missing meshes after pack: ${missing}`);
    for (const node of root.listNodes().filter(node => node.getMesh())) {
        if (!isIdentity(node.getWorldMatrix())) throw Error('Non-identity mesh bind: ' + node.getName());
    }
    const packedRig = rigOf(doc);
    if (JSON.stringify(packedRig) !== JSON.stringify(bodyRig)) throw Error(`${id} skin does not match Human body bind`);
    if (root.listAnimations().length) throw Error(`${id} still has animations`);
    const output = await io.writeBinary(doc);
    await fs.writeFile(`${DIR}/${id}.glb`, output);
    manifest.items[id] = {
        url: `${URL_BASE}/${id}.glb`,
        bytes: output.byteLength,
        sha256: sha(output),
        meshes: names,
        fit: {...HUMAN_EQUIPMENT_FIT},
    };
    report.push({id, bytes: output.byteLength, meshes: names});
}

await fs.writeFile(`${DIR}/manifest.json`, JSON.stringify(manifest, null, 2) + '\n');
await fs.writeFile(`${DIR}/provenance.json`, JSON.stringify({
    pipeline: 'Tripo Mixamo FBX bound to the 65-joint source, replacing the split MakeHuman body',
    source: SRC,
    fitted: FITTED,
    regenerate: 'Blender --background --python scripts/character-assets/human_from_tripo.py && node scripts/character-assets/bind-source-human-tripo.mjs && node scripts/ashen-reach/fit-orc-garments.mjs --target=human && node scripts/ashen-reach/prepare-human-equipment.mjs',
    fit: {...HUMAN_EQUIPMENT_FIT},
    hashes: {[`${DIR}/body.glb`]: bodyHash},
    garments: report,
    note: 'HumanV1Body stays visible under cloth. Hair is part of that mesh, so the hood does not hide a separate hair geoset. The MakeHuman catalogue the fitter still registers from lives in blender/characters/sources/human-catalogue/.',
}, null, 2) + '\n');
console.log(JSON.stringify({body: bodyBytes.byteLength, clips, meshes: bodyMeshes, garments: report}, null, 2));
