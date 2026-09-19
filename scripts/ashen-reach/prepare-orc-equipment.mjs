/** Orc equipment pack: original Orc source skin/clips plus fitted garments. */
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {mergeDocuments, prune, unpartition} from '@gltf-transform/functions';

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const actorPath = 'public/characters/candidates/orc-source-v1.glb';
const restPath = '.cache/armory-assets/orc-apparel-rest.glb';
const outPath = '.cache/armory-assets/orc-equipment-pack.glb';
const doc = await io.read(actorPath);
const rest = await io.read(restPath);
const root = doc.getRoot();
const scene = root.getDefaultScene();
const skin = root.listSkins()[0];
const joints = skin.listJoints();
const originalNodes = new Set(root.listNodes());
const originalScenes = new Set(root.listScenes());
const merged = mergeDocuments(doc, rest);
const info = [];
for (const source of rest.getRoot().listNodes()) {
    if (!source.getMesh()) continue;
    const node = merged.get(source);
    const oldSkin = node.getSkin();
    if (!oldSkin) throw Error('Unskinned garment ' + source.getName());
    const mapping = oldSkin.listJoints().map(n => joints.findIndex(j => j.getName() === n.getName()));
    for (const primitive of node.getMesh().listPrimitives()) {
        const weights = primitive.getAttribute('WEIGHTS_0').getArray();
        const indices = primitive.getAttribute('JOINTS_0');
        indices.setArray(Uint16Array.from(indices.getArray(), (joint, i) => {
            if (mapping[joint] < 0 && weights[i] > 0) throw Error('Unmapped weighted joint ' + source.getName());
            return Math.max(0, mapping[joint]);
        }));
        const material = primitive.getMaterial();
        material.setDoubleSided(true);
        if (source.getName() !== 'GraveweaverPendant') material.setRoughnessFactor(0.94).setMetallicFactor(0);
        if (source.getName() === 'GraveweaverTop') material.setBaseColorFactor([0.78, 0.86, 0.83, 1]).setMetallicFactor(0.16).setRoughnessFactor(0.83);
        if (['GraveweaverSkirt', 'GraveweaverHood'].includes(source.getName())) material.setBaseColorFactor([0.55, 0.48, 0.40, 1]);
        if (source.getName() === 'GraveweaverGloves') material.setBaseColorFactor([0.20, 0.22, 0.20, 1]);
        const mag = source.getName() === 'WayfarerTunic' || source.getName() === 'GraveweaverTop' ? 9729 : 9728;
        material.getBaseColorTextureInfo()?.setMagFilter(mag).setMinFilter(mag === 9729 ? 9987 : 9984);
    }
    const transform = source.getWorldMatrix();
    node.getParentNode()?.removeChild(node);
    node.setMatrix(transform).setSkin(skin);
    scene.addChild(node);
    originalNodes.add(node);
    const position = node.getMesh().listPrimitives()[0].getAttribute('POSITION');
    info.push({name: node.getName(), vertices: position.getCount()});
}
for (const node of root.listNodes()) if (!originalNodes.has(node)) node.dispose();
for (const s of root.listScenes()) if (!originalScenes.has(s)) s.dispose();
for (const s of root.listSkins()) if (s !== skin) s.dispose();

const trousers = root.listNodes().find(n => n.getName() === 'WayfarerTrousers' && n.getMesh());
const pantsMesh = trousers.getMesh();
const pantsParts = new Map(['WayfarerTrousers', 'WayfarerTrousersCuffs'].map(name => [name, doc.createMesh(name)]));
for (const primitive of pantsMesh.listPrimitives()) {
    const positions = primitive.getAttribute('POSITION').getArray();
    const indices = primitive.getIndices().getArray();
    const groups = new Map([...pantsParts.keys()].map(name => [name, []]));
    for (let i = 0; i < indices.length; i += 3) {
        const vs = Array.from(indices.slice(i, i + 3));
        const y = vs.reduce((sum, index) => sum + positions[index * 3 + 1], 0) / 3;
        groups.get(y < 0.37 ? 'WayfarerTrousersCuffs' : 'WayfarerTrousers').push(...vs);
    }
    for (const [name, ids] of groups) {
        if (!ids.length) continue;
        const part = doc.createPrimitive().setMaterial(primitive.getMaterial());
        for (const semantic of primitive.listSemantics()) part.setAttribute(semantic, primitive.getAttribute(semantic));
        part.setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint32Array(ids)).setBuffer(root.listBuffers()[0]));
        pantsParts.get(name).addPrimitive(part);
    }
}
const pantsMatrix = trousers.getWorldMatrix();
trousers.setMesh(null);
for (const [name, part] of pantsParts) scene.addChild(doc.createNode(name).setMesh(part).setSkin(skin).setMatrix(pantsMatrix));
pantsMesh.dispose();

const body = root.listNodes().find(n => n.getMesh()?.getName() === 'OrcV1Body');
const mesh = body.getMesh();
const buffer = root.listBuffers()[0];
const parts = new Map(['BodyExposed', 'BodyUnderTunic', 'BodyUnderBoots', 'BodyUnderLegs', 'BodyWaist', 'BodyHands'].map(name => [name, doc.createMesh(name)]));
const counts = {};
for (const primitive of mesh.listPrimitives()) {
    const positions = primitive.getAttribute('POSITION').getArray();
    const indices = primitive.getIndices().getArray();
    const groups = new Map([...parts.keys()].map(name => [name, []]));
    const weights = primitive.getAttribute('WEIGHTS_0').getArray();
    const boneIds = primitive.getAttribute('JOINTS_0').getArray();
    for (let i = 0; i < indices.length; i += 3) {
        const vs = Array.from(indices.slice(i, i + 3));
        const p = [0, 1, 2].map(k => vs.reduce((sum, index) => sum + positions[index * 3 + k], 0) / 3);
        const [x, y] = p;
        const handWeight = vs.reduce((sum, index) => sum + [0, 1, 2, 3].reduce((w, k) => w + (/Hand/.test(joints[boneIds[index * 4 + k]].getName()) ? weights[index * 4 + k] : 0), 0), 0) / 3;
        const region = handWeight > 0.75 ? 'BodyHands' : y < 0.336 ? 'BodyUnderBoots' : y < 1.032 ? 'BodyUnderLegs' : y < 1.20 ? 'BodyWaist' : y < 1.752 && Math.abs(x) < 0.684 ? 'BodyUnderTunic' : 'BodyExposed';
        groups.get(region).push(...vs);
    }
    for (const [name, idx] of groups) {
        if (!idx.length) continue;
        const part = doc.createPrimitive().setMaterial(primitive.getMaterial());
        for (const semantic of primitive.listSemantics()) part.setAttribute(semantic, primitive.getAttribute(semantic));
        part.setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint32Array(idx)).setBuffer(buffer));
        parts.get(name).addPrimitive(part);
        counts[name] = (counts[name] || 0) + idx.length / 3;
    }
}
for (const [name, part] of parts) scene.addChild(doc.createNode(name).setMesh(part).setSkin(skin).setMatrix(body.getWorldMatrix()));
body.setMesh(null);
mesh.dispose();
await doc.transform(unpartition(), prune());
await io.write(outPath, doc);
const sha = async path => createHash('sha256').update(await fs.readFile(path)).digest('hex');
const report = {
    schemaVersion: 1,
    bodyProfile: 'orc-male-v1',
    rigJoints: joints.length,
    clips: root.listAnimations().length,
    items: info,
    coverageTriangles: counts,
    sourceSha256: await sha(actorPath),
    apparelSha256: await sha(restPath),
    outputSha256: await sha(outPath),
};
await fs.writeFile('.cache/armory-assets/orc-equipment-provenance.json', JSON.stringify(report, null, 2));
console.log(report);
