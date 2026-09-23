/** Assemble the source-compatible Human candidate on the original 65-joint bind.
 *
 * Same shape of process as bind-source-orc.mjs, which in turn mirrors the
 * sanctioned Human pipeline: keep base.glb's hierarchy and local rotation
 * frames, fit joint translations from isolated-Blender centres (metres) into
 * the stored centimetre units, recompute the inverse binds, attach the Human
 * surfaces with a palette remap, shift every Hips translation key by the
 * constant rest offset, then copy the runtime-only clips the game selects but
 * base.glb lacks, so the Human can be picked anywhere the Human can.
 *
 * Writes public/characters/candidates/human-source-v1.glb + provenance.
 */
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS, KHRMaterialsEmissiveStrength} from '@gltf-transform/extensions';
import {mat4, vec3, quat} from 'gl-matrix';
import {MeshoptDecoder, MeshoptEncoder} from 'meshoptimizer';

const REST = '.cache/source-motion/human-tripo-source-rest.glb';
const JOINTS = '.cache/source-motion/human-tripo-source-joints.json';
const OUT = 'public/characters/candidates/human-source-v1.glb';
const PROVENANCE = 'public/characters/candidates/human-source-v1.provenance.json';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');

await MeshoptDecoder.ready;
await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
    'meshopt.decoder': MeshoptDecoder,
    'meshopt.encoder': MeshoptEncoder,
});
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
for (const name of order) if (!fitted[name]) throw Error(`Fitted joints miss ${name}`);

const trs = n => ({t: Array.from(n.getTranslation()), r: Array.from(n.getRotation()), s: Array.from(n.getScale())});
const compose = ({t, r, s}) => mat4.fromRotationTranslationScale(mat4.create(),
    quat.fromValues(r[0], r[1], r[2], r[3]), vec3.fromValues(t[0], t[1], t[2]), vec3.fromValues(s[0], s[1], s[2]));

// Fit translations: fitted world (m) -> stored local (cm) through new parents.
const world = new Map();
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
for (const sceneRoot of root.listScenes()[0].listChildren()) visit(sceneRoot, mat4.create());

// Recompute inverse binds against the fitted hierarchy.
const ibm = new Float32Array(65 * 16);
order.forEach((name, i) => ibm.set(Array.from(mat4.invert(mat4.create(), world.get(name))), i * 16));
skin.getInverseBindMatrices().setArray(ibm);

// Hips animation offset: new rest local minus base rest local (stored cm).
const baseHips = await io.read('public/characters/base.glb')
    .then(d => Array.from(d.getRoot().listNodes().find(n => n.getName() === 'mixamorig:Hips').getTranslation()));
const newHips = Array.from(nodes.get('mixamorig:Hips').getTranslation());
const offset = newHips.map((v, k) => v - baseHips[k]);
const shiftHips = arr => {
    for (let i = 0; i < arr.length; i += 3) { arr[i] += offset[0]; arr[i + 1] += offset[1]; arr[i + 2] += offset[2]; }
    return arr;
};
for (const anim of root.listAnimations()) {
    for (const ch of anim.listChannels()) {
        if (ch.getTargetNode().getName() !== 'mixamorig:Hips' || ch.getTargetPath() !== 'translation') continue;
        const out = ch.getSampler().getOutput();
        out.setArray(new Float32Array(shiftHips(Array.from(out.getArray()))));
    }
}

// Drop the mannequin meshes, materials and images; the Human brings its own.
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

// Attach the Human surfaces with a palette remap into the final 65-joint order.
const restRoot = rest.getRoot();
const restSkin = restRoot.listSkins()[0];
const remap = restSkin.listJoints().map(j => {
    const i = indexOf.get(j.getName());
    if (i === undefined) throw Error(`Temp joint ${j.getName()} missing from the 65-joint order`);
    return i;
});
const copyAccessor = (original, array) => doc.createAccessor()
    .setType(original.getType()).setArray(array ?? original.getArray().slice()).setBuffer(buffer);
const textureCache = new Map(), materialCache = new Map();
const copyTexture = tex => {
    if (textureCache.has(tex)) return textureCache.get(tex);
    const out = doc.createTexture(tex.getName()).setMimeType(tex.getMimeType()).setImage(tex.getImage().slice());
    textureCache.set(tex, out);
    return out;
};
const emissiveStrength = doc.createExtension(KHRMaterialsEmissiveStrength);
const copyMaterial = mat => {
    if (!mat) return null;
    if (materialCache.has(mat)) return materialCache.get(mat);
    const name = mat.getName() || '';
    let metal = mat.getMetallicFactor();
    let rough = mat.getRoughnessFactor();
    let alpha = mat.getAlphaMode();
    const factor = mat.getBaseColorFactor().slice();
    // Dry bone and desiccated hide: never metallic, never glossy, never cut out.
    if (/Body|Cloth|Hair|Brows/.test(name)) {
        metal = 0;
        rough = Math.max(rough, 0.82);
        alpha = 'OPAQUE';
        factor[3] = 1;
    }
    const out = doc.createMaterial(name)
        .setBaseColorFactor(factor)
        .setMetallicFactor(metal).setRoughnessFactor(rough)
        .setEmissiveFactor(mat.getEmissiveFactor().slice())
        .setAlphaMode(alpha).setAlphaCutoff(mat.getAlphaCutoff())
        // The body is a closed volume after the voxel union, so single sided is
        // correct and cheaper. Only the eye beads keep whatever Blender set.
        .setDoubleSided(name.includes('Eyes') ? mat.getDoubleSided() : false);
    if (mat.getBaseColorTexture()) out.setBaseColorTexture(copyTexture(mat.getBaseColorTexture()));
    if (mat.getNormalTexture()) {
        out.setNormalTexture(copyTexture(mat.getNormalTexture()));
        out.setNormalScale(mat.getNormalScale());
    }
    if (mat.getMetallicRoughnessTexture()) out.setMetallicRoughnessTexture(copyTexture(mat.getMetallicRoughnessTexture()));
    // Carry the amber eye glow across; the strength lives in an extension.
    const src = mat.getExtension('KHR_materials_emissive_strength');
    if (src) out.setExtension('KHR_materials_emissive_strength',
        emissiveStrength.createEmissiveStrength().setEmissiveStrength(src.getEmissiveStrength()));
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
                const Ctor = attr.getArray().constructor;
                out.setAttribute(sem, copyAccessor(attr, new Ctor(Array.from(attr.getArray()).map(k => remap[k]))));
            } else {
                out.setAttribute(sem, copyAccessor(attr));
            }
        }
        if (prim.getIndices()) out.setIndices(copyAccessor(prim.getIndices()));
        dst.addPrimitive(out);
    }
    scene.addChild(doc.createNode(mesh.getName()).setMesh(dst).setSkin(skin));
}

// Runtime parity: copy the clips the game selects that base.glb lacks
// (5 directional gaits, 4 split cast layers, the retargeted two-handed carry)
// from the authoring pack. Same 65-joint rig, so the channels apply directly.
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
            output = doc.createAccessor().setType('VEC3')
                .setArray(new Float32Array(shiftHips(Array.from(srcSampler.getOutput().getArray()))))
                .setBuffer(buffer);
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
    pipeline: 'source-compatible Human binding from Tripo Mixamo FBX',
    hashes: {
        'public/characters/base.glb': sha(await fs.readFile('public/characters/base.glb')),
        'public/ashen-reach/wanderer.glb': sha(await fs.readFile('public/ashen-reach/wanderer.glb')),
        [OUT]: sha(bytes),
        'scripts/character-assets/human_from_tripo.py': sha(await fs.readFile('scripts/character-assets/human_from_tripo.py')),
        'scripts/character-assets/bind-source-human-tripo.mjs': sha(await fs.readFile('scripts/character-assets/bind-source-human-tripo.mjs')),
        'blender/characters/sources/human-tripo/provenance.json': sha(await fs.readFile('blender/characters/sources/human-tripo/provenance.json')),
    },
    versions: {blender: '5.2.1', gltfTransform: versions['@gltf-transform/core'], glMatrix: versions['gl-matrix']},
    source: {
        title: 'Tripo Mixamo auto-rig from the approved human A-pose study',
        filesNote: 'docs/references/human',
        files: 'blender/characters/sources/human-tripo/human-tripo.fbx',
    },
    licenseNotes: 'Body is a Tripo generation from the user-approved human body study. Source rig and original clips retain base.glb provenance.',
}, null, 2) + '\n');
console.log(JSON.stringify({
    clips: root.listAnimations().length, joints: order.length,
    runtimeExtras: extras.map(a => a.getName()),
    meshes: root.listMeshes().map(m => m.getName()),
    hipsOffsetCm: offset.map(v => +v.toFixed(3)), bytes: bytes.length,
}));
