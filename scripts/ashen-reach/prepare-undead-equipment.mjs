/** Assemble the playable Undead pack from the Tripo-bound source body.

Body is public/characters/candidates/undead-source-v1.glb (single UndeadV1Body
mesh, 65-joint source bind, 57 clips). The fitted garments are already in the
Undead body's rest-space but still carry the Human catalogue skin. Assemble
each item on the actual Undead skin before the runtime borrows its live palette.
glTF skinning uses each joint's world transform and its inverse bind matrix;
matching joint names alone is not enough:
https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#skins

Usage: node scripts/ashen-reach/prepare-undead-equipment.mjs
*/
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {mat3, vec3} from 'gl-matrix';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {mergeDocuments, prune, unpartition} from '@gltf-transform/functions';
import {MeshoptDecoder, MeshoptEncoder} from 'meshoptimizer';
import {EQUIPMENT_ITEMS, UNDEAD_BASE_VISIBLE_MESHES} from '../../src/ashen-reach/equipment-catalog.js';
import {UNDEAD_EQUIPMENT_FIT} from '../../src/ashen-reach/equipment-contract.js';

const SRC = 'public/characters/candidates/undead-source-v1.glb';
const FITTED = '.cache/armory-assets/undead-tripo';
const DIR = 'public/ashen-reach/equipment-undead';
const URL_BASE = '/ashen-reach/equipment-undead';
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
    const normalMatrix = mat3.normalFromMat4(mat3.create(), world);
    if (!normalMatrix) throw Error(`Singular garment transform: ${node.getName()}`);
    const tmp = vec3.create();
    for (const prim of mesh.listPrimitives()) {
        for (const [semantic, matrix, normalise] of [
            ['POSITION', world, false], ['NORMAL', normalMatrix, true],
        ]) {
            const attr = prim.getAttribute(semantic);
            if (!attr) continue;
            const array = attr.getArray();
            for (let i = 0; i < array.length; i += 3) {
                if (semantic === 'POSITION') vec3.transformMat4(tmp, array.subarray(i, i + 3), matrix);
                else vec3.transformMat3(tmp, array.subarray(i, i + 3), matrix);
                if (normalise) vec3.normalize(tmp, tmp);
                array.set(tmp, i);
            }
            attr.setArray(array);
        }
    }
}

function remapSkin(node, joints) {
    const sourceSkin = node.getSkin();
    if (!sourceSkin) throw Error(`Unskinned Undead garment: ${node.getName()}`);
    const targetByName = new Map(joints.map((joint, i) => [joint.getName(), i]));
    const mapping = sourceSkin.listJoints().map(joint => targetByName.get(joint.getName()));
    for (const prim of node.getMesh().listPrimitives()) {
        const weights = prim.getAttribute('WEIGHTS_0')?.getArray();
        const indices = prim.getAttribute('JOINTS_0');
        if (!weights || !indices) throw Error(`Garment missing skin attributes: ${node.getName()}`);
        indices.setArray(Uint16Array.from(indices.getArray(), (joint, i) => {
            if (mapping[joint] === undefined && weights[i] > 0)
                throw Error(`Unmapped weighted joint ${sourceSkin.listJoints()[joint]?.getName()}`);
            return mapping[joint] ?? 0;
        }));
    }
}

function rigOf(doc) {
    const skin = doc.getRoot().listSkins()[0];
    return {
        joints: skin.listJoints().map(node => [node.getName(), Array.from(node.getWorldMatrix())]),
        inverseBind: Array.from(skin.getInverseBindMatrices().getArray()),
    };
}

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
const bodyRig = rigOf(bodyDoc);

const manifest = {
    schema: 1,
    fitId: UNDEAD_EQUIPMENT_FIT.body,
    sourceSha256: bodyHash,
    profileId: 'undead-tripo-v1',
    garments: true,
    bindSha256: sha(JSON.stringify(bodyRig)),
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
    const doc = await io.readBinary(bodyBytes);
    const originalNodes = new Set(doc.getRoot().listNodes());
    const originalScenes = new Set(doc.getRoot().listScenes());
    const fitted = await io.read(srcPath);
    const merged = mergeDocuments(doc, fitted);
    const root = doc.getRoot();
    const scene = root.getDefaultScene();
    const skin = root.listSkins()[0];
    for (const source of fitted.getRoot().listNodes()) {
        if (!source.getMesh()) continue;
        const node = merged.get(source);
        remapSkin(node, skin.listJoints());
        node.getParentNode()?.removeChild(node);
        bakeIdentity(node);
        node.setSkin(skin);
        scene.addChild(node);
        originalNodes.add(node);
    }
    for (const node of root.listNodes()) if (!originalNodes.has(node)) node.dispose();
    for (const extra of root.listScenes()) if (!originalScenes.has(extra)) extra.dispose();
    for (const extra of root.listSkins()) if (extra !== skin) extra.dispose();
    const keep = new Set(names);
    for (const node of root.listNodes()) {
        if (node.getMesh() && !keep.has(node.getName())) node.setMesh(null);
    }
    // Detached glTF animation channels and samplers retain large keyframe accessors
    // unless explicitly disposed before prune; see the equivalent Human/Orc pack paths.
    for (const animation of root.listAnimations()) {
        for (const channel of animation.listChannels()) channel.dispose();
        for (const sampler of animation.listSamplers()) sampler.dispose();
        animation.dispose();
    }
    await doc.transform(unpartition(), prune({keepLeaves: true}));
    const missing = names.filter(name => !root.listNodes().some(node => node.getMesh() && node.getName() === name));
    if (missing.length) throw Error(`${id} missing meshes after pack: ${missing}`);
    for (const node of root.listNodes().filter(node => node.getMesh())) {
        if (!isIdentity(node.getWorldMatrix())) throw Error(`Non-identity garment bind: ${node.getName()}`);
    }
    if (JSON.stringify(rigOf(doc)) !== JSON.stringify(bodyRig))
        throw Error(`${id} skin does not match Undead body bind`);
    const bytes = await io.writeBinary(doc);
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

await fs.writeFile(`${DIR}/manifest.json`, JSON.stringify(manifest, null, 2) + '\n');
await fs.writeFile(`${DIR}/provenance.json`, JSON.stringify({
    pipeline: 'Tripo Mixamo FBX bound to the 65-joint source',
    source: SRC,
    fitted: FITTED,
    regenerate: 'Blender --background --python scripts/character-assets/undead_from_tripo.py && node scripts/character-assets/bind-source-undead.mjs && node scripts/ashen-reach/fit-orc-garments.mjs --target=undead && node scripts/ashen-reach/prepare-undead-equipment.mjs',
    fit: {...UNDEAD_EQUIPMENT_FIT},
    hashes: {[`${DIR}/body.glb`]: bodyHash},
    garments: report,
    note: 'Body is the Tripo Mixamo revenant. Catalogue clothes are ICP-fitted onto that surface (fit-orc-garments --target=undead), then attached to this body skin with exact joint order and inverse binds.',
}, null, 2) + '\n');

console.log(JSON.stringify({
    body: bodyBytes.byteLength, clips, meshes: bodyMeshes, garments: report.length,
    totalMB: +((bodyBytes.byteLength + report.reduce((n, g) => n + g.bytes, 0)) / 1048576).toFixed(2),
}, null, 2));
