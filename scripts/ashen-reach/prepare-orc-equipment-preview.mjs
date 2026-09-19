/** Merge Orc actor + fitted garments. Writes a full preview plus one GLB per outfit. */
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {mergeDocuments, prune, unpartition} from '@gltf-transform/functions';

const OUTFITS = {
    wayfarer: ['WayfarerTunic', 'WayfarerTrousers', 'WayfarerBoots'],
    pilgrim: ['PilgrimTunic', 'WayfarerTrousers', 'WayfarerBoots'],
    graveweaver: ['GraveweaverHood', 'GraveweaverTop', 'GraveweaverPendant', 'GraveweaverSkirt', 'GraveweaverGloves', 'WayfarerBoots'],
};

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const actorPath = 'public/characters/candidates/orc-source-v1.glb';
const restPath = '.cache/armory-assets/orc-apparel-rest.glb';

function styleMaterial(name, material) {
    material.setDoubleSided(true);
    if (name !== 'GraveweaverPendant') material.setRoughnessFactor(0.94).setMetallicFactor(0);
    if (name === 'GraveweaverTop') material.setBaseColorFactor([0.78, 0.86, 0.83, 1]).setMetallicFactor(0.16).setRoughnessFactor(0.83);
    if (['GraveweaverSkirt', 'GraveweaverHood'].includes(name)) material.setBaseColorFactor([0.55, 0.48, 0.40, 1]);
    if (name === 'GraveweaverGloves') material.setBaseColorFactor([0.20, 0.22, 0.20, 1]);
    const mag = name === 'WayfarerTunic' || name === 'GraveweaverTop' ? 9729 : 9728;
    material.getBaseColorTextureInfo()?.setMagFilter(mag).setMinFilter(mag === 9729 ? 9987 : 9984);
}

async function writePreview(outPath, allow) {
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
        if (allow && !allow.has(source.getName())) {
            node.dispose();
            continue;
        }
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
            styleMaterial(source.getName(), primitive.getMaterial());
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
    await doc.transform(unpartition(), prune());
    await io.write(outPath, doc);
    return {out: outPath, joints: joints.length, clips: root.listAnimations().length, items: info.map(i => i.name)};
}

const full = await writePreview('public/characters/candidates/orc-equipped-preview.glb', null);
const reports = {full};
for (const [name, items] of Object.entries(OUTFITS)) {
    reports[name] = await writePreview(`public/characters/candidates/orc-${name}-preview.glb`, new Set(items));
}
console.log(JSON.stringify(reports, null, 2));
