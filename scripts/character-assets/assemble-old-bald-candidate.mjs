/** Resize the optional CC0 old/bald source atlases without changing its rig.
 * The Blender source fit is intentionally a diagnostic until its seam and
 * outfit/extreme-shape motion receive full acceptance. Its textures are kept
 * out of the default startup payload.
 * https://gltf-transform.dev/modules/functions/functions/compressTexture
 * https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#morph-targets
 */
import fs from 'node:fs/promises';
import {NodeIO, VertexLayout} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {compressTexture} from '@gltf-transform/functions';
import {normalizeHumanBind} from './normalize-human-bind.mjs';
import sharp from 'sharp';

const input = '.cache/character-mmo/m006/human-old-bald-raw.glb';
const output = '.cache/character-mmo/m006/human-old-bald-candidate.glb';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).setVertexLayout(VertexLayout.SEPARATE);
const doc = await io.read(input);
const root = doc.getRoot();
const base = (await io.read('.cache/character-mmo/m004/human-shape-family-v1.glb')).getRoot();
const {jointNames, remappedJoints} = normalizeHumanBind(root, base);
// The body has M004 slender/stout deltas at the cut neck (about 12–14 mm).
// A separate old head with zero morphs leaves its neutral rim behind and opens
// a slit when the shaped torso moves. Give the head the same target order and
// transfer the body-rim displacement across its first 9 cm, fading to zero
// before the face. This preserves its authored old features and vertex order.
// glTF morphs are primitive-local; one actor weight vector drives both meshes.
// https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#morph-targets
const bodyMesh = root.listMeshes().find(mesh => mesh.getName() === 'HumanV1Body');
const headMesh = root.listMeshes().find(mesh => mesh.getName() === 'OldBaldHeadV2Diagnostic');
const bodyPrim = bodyMesh?.listPrimitives()[0], headPrim = headMesh?.listPrimitives()[0];
if (!bodyPrim || !headPrim || bodyPrim.listTargets().length !== 2 || headPrim.listTargets().length) {
    throw Error('Old head needs the unshaped source and two M004 body targets');
}
const bodyPositions = bodyPrim.getAttribute('POSITION').getArray();
const headPositions = headPrim.getAttribute('POSITION').getArray();
const rim = [];
for (let i = 0; i < bodyPositions.length / 3; i++) {
    if (Math.abs(bodyPositions[i * 3 + 1] - 1.5) < .002) rim.push(i);
}
if (rim.length < 20) throw Error(`Old head lost body neck rim: ${rim.length} vertices`);
const buffer = root.listBuffers()[0];
let movedHeadVertices = 0;
for (let targetIndex = 0; targetIndex < 2; targetIndex++) {
    const bodyDelta = bodyPrim.listTargets()[targetIndex].getAttribute('POSITION').getArray();
    const headDelta = new Float32Array(headPositions.length);
    const normalDelta = new Float32Array(headPositions.length);
    for (let i = 0; i < headPositions.length / 3; i++) {
        const y = headPositions[i * 3 + 1];
        if (y < 1.499 || y > 1.59) continue;
        const x = headPositions[i * 3], z = headPositions[i * 3 + 2];
        let nearest = -1, best = Infinity;
        for (const j of rim) {
            const d = (x - bodyPositions[j * 3]) ** 2 + (z - bodyPositions[j * 3 + 2]) ** 2;
            if (d < best) { best = d; nearest = j; }
        }
        const t = Math.max(0, Math.min(1, (y - 1.5) / .09));
        const weight = 1 - t * t * (3 - 2 * t);
        for (let k = 0; k < 3; k++) headDelta[i * 3 + k] = bodyDelta[nearest * 3 + k] * weight;
        if (targetIndex === 0) movedHeadVertices++;
    }
    headPrim.addTarget(doc.createPrimitiveTarget(['slender', 'stout'][targetIndex])
        .setAttribute('POSITION', doc.createAccessor(`old_head_${targetIndex}_position`)
            .setType('VEC3').setArray(headDelta).setBuffer(buffer))
        .setAttribute('NORMAL', doc.createAccessor(`old_head_${targetIndex}_normal`)
            .setType('VEC3').setArray(normalDelta).setBuffer(buffer)));
}
headMesh.setWeights([0, 0]);
headMesh.setExtras({...(headMesh.getExtras() || {}), targetNames: ['slender', 'stout']});
for (const [name, from, size] of [
    ['old_lightskinned_male_diffuse', 2048, 1024],
    ['old-eye-albedo', 1024, 512],
]) {
    const texture = root.listTextures().find(t => t.getName() === name);
    if (!texture || texture.getSize().join('x') !== `${from}x${from}`) {
        throw Error(`Missing or changed old/bald source atlas: ${name}`);
    }
    await compressTexture(texture, {encoder: sharp, targetFormat: 'png', resize: [size, size], effort: 8});
    if (texture.getMimeType() !== 'image/png' || texture.getSize().join('x') !== `${size}x${size}`) {
        throw Error(`Old/bald atlas resize failed: ${name}`);
    }
}
const bytes = await io.writeBinary(doc);
await fs.writeFile(output, bytes);
const check = (await io.read(output)).getRoot();
const body = check.listMeshes().find(mesh => mesh.getName() === 'HumanV1Body');
const head = check.listMeshes().find(mesh => mesh.getName() === 'OldBaldHeadV2Diagnostic');
if (check.listAnimations().length !== 57 || check.listSkins().length !== 1
    || check.listSkins()[0].listJoints().length !== 65 || !body
    || body.listPrimitives()[0].listTargets().length !== 2
    || head?.listPrimitives()[0].listTargets().length !== 2
    || check.listMeshes().length !== 3
    || check.listSkins()[0].listJoints().some((joint, i) => joint.getName() !== jointNames[i])
    || check.listNodes().filter(node => node.getMesh())
        .some(node => !check.listScenes()[0].listChildren().includes(node))) {
    throw Error('Old/bald candidate lost source clips, skin, shape or head/eye meshes');
}
console.log(JSON.stringify({output, rawBytes: (await fs.stat(input)).size,
    candidateBytes: bytes.length, animations: check.listAnimations().length,
    joints: check.listSkins()[0].listJoints().length,
    shapeTargets: body.listPrimitives()[0].listTargets().length,
    movedHeadVertices,
    remappedJoints}));
