/** Assemble the source-compatible Orc candidate on the original 65-joint bind.
 * Mirrors the sanctioned Human pipeline
 * (docs/source-motion-recovery-implementation-2026-09-17.md):
 * keep base.glb hierarchy and local rotation frames, fit joint translations
 * from isolated-Blender centres (metres) into stored centimetre units,
 * recompute inverse binds, attach Orc surfaces with palette remap, copy every
 * animation rotation key unchanged (Hips translation: constant rest offset),
 * then copy the ten runtime-only clips from the authoring pack so the Orc can
 * be selected wherever the Human can.
 * Writes public/characters/candidates/orc-source-v1.glb + provenance.
 */
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {mat4, vec3, quat} from 'gl-matrix';

const REST = '.cache/source-motion/orc-source-rest.glb';
const JOINTS = '.cache/source-motion/orc-source-joints.json';
const OUT = 'public/characters/candidates/orc-source-v1.glb';
const PROVENANCE = 'public/characters/candidates/orc-source-v1.provenance.json';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read('public/characters/base.glb');
const root = doc.getRoot();
const buffer = root.listBuffers()[0];
const rest = await io.read(REST);
const fitted = JSON.parse(await fs.readFile(JOINTS, 'utf8')); // metres, glTF Y-up

const nodes = new Map(root.listNodes().map(n => [n.getName(), n]));
const skin = root.listSkins()[0];
const order = skin.listJoints().map(j => j.getName());
if (order.length !== 65) throw Error(`Expected 65 skin joints, have ${order.length}`);
const indexOf = new Map(order.map((n, i) => [n, i]));

// Local TRS helpers in raw stored units (cm-numbers under the .01 root).
const trs = n => ({t: Array.from(n.getTranslation()), r: Array.from(n.getRotation()), s: Array.from(n.getScale())});
const compose = ({t, r, s}) => mat4.fromRotationTranslationScale(mat4.create(),
    quat.fromValues(r[0], r[1], r[2], r[3]), vec3.fromValues(t[0], t[1], t[2]), vec3.fromValues(s[0], s[1], s[2]));

// Fit translations: fitted world (m) -> stored local (cm) through new parents.
const world = new Map();
const sceneRoots = root.listScenes()[0].listChildren();
const visit = (node, parentWorld) => {
    const name = node.getName();
    let local;
    if (fitted[name]) {
        const target = vec3.fromValues(...fitted[name]);
        const inv = mat4.invert(mat4.create(), parentWorld);
        const p = vec3.transformMat4(vec3.create(), target, inv);
        const cur = trs(node);
        local = {t: [p[0], p[1], p[2]], r: cur.r, s: cur.s};
        node.setTranslation(local.t);
    } else {
        local = trs(node);
    }
    const w = mat4.multiply(mat4.create(), parentWorld, compose(local));
    world.set(name, w);
    for (const child of node.listChildren()) visit(child, w);
};
for (const sceneRoot of sceneRoots) visit(sceneRoot, mat4.create());

// Recompute inverse binds against the fitted hierarchy (mesh nodes identity).
const ibm = new Float32Array(65 * 16);
order.forEach((name, i) => ibm.set(Array.from(mat4.invert(mat4.create(), world.get(name))), i * 16));
skin.getInverseBindMatrices().setArray(ibm);

// Hips animation offset: new rest local minus base rest local (stored cm).
const baseHips = await io.read('public/characters/base.glb').then(d => Array.from(d.getRoot().listNodes().find(n => n.getName() === 'mixamorig:Hips').getTranslation()));
const newHips = Array.from(nodes.get('mixamorig:Hips').getTranslation());
const offset = newHips.map((v, k) => v - baseHips[k]);
for (const anim of root.listAnimations()) {
    for (const ch of anim.listChannels()) {
        if (ch.getTargetNode().getName() !== 'mixamorig:Hips' || ch.getTargetPath() !== 'translation') continue;
        const out = ch.getSampler().getOutput(), arr = Array.from(out.getArray());
        for (let i = 0; i < arr.length; i += 3) { arr[i] += offset[0]; arr[i + 1] += offset[1]; arr[i + 2] += offset[2]; }
        out.setArray(new Float32Array(arr));
    }
}

// Drop the mannequin meshes, materials and images; Orc brings its own.
for (const node of root.listNodes()) if (node.getMesh()) node.setMesh(null);
for (const mesh of root.listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
        for (const sem of prim.listSemantics()) prim.getAttribute(sem)?.dispose();
        prim.getIndices()?.dispose();
    }
    mesh.dispose();
}
for (const m of root.listMaterials()) m.dispose();
for (const t of root.listTextures()) t.dispose();

// Attach Orc surfaces with palette remap (temp 52-name skin -> final order).
const restRoot = rest.getRoot();
const restSkin = restRoot.listSkins()[0];
const restNames = restSkin.listJoints().map(j => j.getName());
const remap = restNames.map(n => {
    const i = indexOf.get(n);
    if (i === undefined) throw Error(`Temp joint ${n} missing from 65-joint order`);
    return i;
});
const copyAccessor = (original, array) => doc.createAccessor()
    .setType(original.getType()).setArray(array ?? original.getArray().slice()).setBuffer(buffer);
const textureCache = new Map(), materialCache = new Map();
const copyTexture = tex => {
    if (textureCache.has(tex)) return textureCache.get(tex);
    const out = doc.createTexture(tex.getName()).setMimeType(tex.getMimeType());
    out.setImage(tex.getImage().slice());
    textureCache.set(tex, out);
    return out;
};
const copyMaterial = mat => {
    if (!mat) return null;
    if (materialCache.has(mat)) return materialCache.get(mat);
    const name = mat.getName() || '';
    let metal = mat.getMetallicFactor();
    let rough = mat.getRoughnessFactor();
    let alpha = mat.getAlphaMode();
    const factor = mat.getBaseColorFactor().slice();
    if (name.includes('Skin')) {
        metal = 0;
        rough = 1;
        alpha = 'OPAQUE';
        factor[0] = Math.min(1, factor[0] * 1.04);
        factor[1] = factor[1] * 0.90;
        factor[2] = factor[2] * 0.80;
        factor[3] = 1;
    }
    if (name.includes('Ivory')) {
        metal = 0;
        rough = Math.max(rough, 0.62);
        alpha = 'OPAQUE';
        factor[3] = 1;
    }
    if (name.includes('Topknot')) {
        alpha = 'OPAQUE';
        factor[3] = 1;
    }
    const out = doc.createMaterial(mat.getName())
        .setBaseColorFactor(factor)
        .setMetallicFactor(metal).setRoughnessFactor(rough)
        .setEmissiveFactor(mat.getEmissiveFactor().slice())
        .setAlphaMode(alpha).setAlphaCutoff(mat.getAlphaCutoff())
        .setDoubleSided(name.includes('Skin') || name.includes('Ivory') || mat.getDoubleSided());
    if (mat.getBaseColorTexture()) out.setBaseColorTexture(copyTexture(mat.getBaseColorTexture()));
    if (mat.getNormalTexture()) out.setNormalTexture(copyTexture(mat.getNormalTexture()));
    if (mat.getMetallicRoughnessTexture()) out.setMetallicRoughnessTexture(copyTexture(mat.getMetallicRoughnessTexture()));
    materialCache.set(mat, out);
    return out;
};
const scene = root.listScenes()[0];
for (const mesh of restRoot.listMeshes()) {
    const dst = doc.createMesh(mesh.getName());
    for (const prim of mesh.listPrimitives()) {
        const out = doc.createPrimitive().setMaterial(copyMaterial(prim.getMaterial()));
        for (const sem of prim.listSemantics()) {
            const attr = prim.getAttribute(sem);
            if (sem.startsWith('JOINTS_')) {
                const src = Array.from(attr.getArray());
                const Ctor = attr.getArray().constructor;
                out.setAttribute(sem, copyAccessor(attr, new Ctor(src.map(j => remap[j]))));
            } else {
                out.setAttribute(sem, copyAccessor(attr));
            }
        }
        if (prim.getIndices()) out.setIndices(copyAccessor(prim.getIndices()));
        dst.addPrimitive(out);
    }
    const node = doc.createNode(mesh.getName()).setMesh(dst);
    node.setSkin(skin);
    scene.addChild(node);
}

// Runtime parity: copy the clips the game selects that base.glb lacks
// (5 directional gaits, 4 split cast layers, the retargeted two-handed carry)
// from the authoring pack. Same 65-joint rig, so the channels apply directly;
// Hips translation keeps the same constant rest offset as the base clips.
const RUNTIME_PACK = 'public/ashen-reach/wanderer.glb';
const runtimeDoc = await io.read(RUNTIME_PACK);
const present = new Set(root.listAnimations().map(a => a.getName()));
const extras = runtimeDoc.getRoot().listAnimations().filter(a => !present.has(a.getName()));
for (const src of extras) {
    const anim = doc.createAnimation(src.getName());
    for (const srcCh of src.listChannels()) {
        const node = nodes.get(srcCh.getTargetNode().getName());
        if (!node) throw Error(`Missing target joint ${srcCh.getTargetNode().getName()} for ${src.getName()}`);
        const srcSampler = srcCh.getSampler();
        let output = copyAccessor(srcSampler.getOutput());
        if (node.getName() === 'mixamorig:Hips' && srcCh.getTargetPath() === 'translation') {
            const arr = Array.from(srcSampler.getOutput().getArray());
            for (let i = 0; i < arr.length; i += 3) { arr[i] += offset[0]; arr[i + 1] += offset[1]; arr[i + 2] += offset[2]; }
            output = doc.createAccessor().setType('VEC3').setArray(new Float32Array(arr)).setBuffer(buffer);
        }
        const sampler = doc.createAnimationSampler().setInterpolation(srcSampler.getInterpolation())
            .setInput(copyAccessor(srcSampler.getInput())).setOutput(output);
        anim.addSampler(sampler);
        anim.addChannel(doc.createAnimationChannel().setTargetNode(node)
            .setTargetPath(srcCh.getTargetPath()).setSampler(sampler));
    }
}

const bytes = await io.writeBinary(doc);
await fs.writeFile(OUT, bytes);
const versions = JSON.parse(await fs.readFile('package.json', 'utf8')).devDependencies || {};
await fs.writeFile(PROVENANCE, JSON.stringify({
    pipeline: 'source-compatible Orc binding',
    capture: 've-capture/orc-motion/grok-v5',
    hashes: {
        'public/characters/base.glb': sha(await fs.readFile('public/characters/base.glb')),
        'public/ashen-reach/wanderer.glb': sha(await fs.readFile('public/ashen-reach/wanderer.glb')),
        'public/characters/bodies/orc-animated-v1.glb': sha(await fs.readFile('public/characters/bodies/orc-animated-v1.glb')),
        [OUT]: sha(bytes),
        'scripts/character-assets/bulk_orc.py': sha(await fs.readFile('scripts/character-assets/bulk_orc.py')),
        'scripts/character-assets/bind_source_orc.py': sha(await fs.readFile('scripts/character-assets/bind_source_orc.py')),
        'scripts/character-assets/bind-source-orc.mjs': sha(await fs.readFile('scripts/character-assets/bind-source-orc.mjs')),
    },
    versions: {blender: '5.2.1', gltfTransform: versions['@gltf-transform/core'], glMatrix: versions['gl-matrix']},
    licenseNotes: 'Orc assets retain existing MakeHuman graphics provenance (CC0); source rig and original clips retain base.glb provenance. No blanket CC0 claim for the source rig.',
}, null, 2) + '\n');
console.log(JSON.stringify({clips: root.listAnimations().length, joints: order.length,
    runtimeExtras: extras.map(a => a.getName()),
    meshes: root.listMeshes().map(m => m.getName()), hipsOffsetCm: offset.map(v => +v.toFixed(3))}));
