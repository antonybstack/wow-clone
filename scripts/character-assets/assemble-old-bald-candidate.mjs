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
import sharp from 'sharp';

const input = '.cache/character-mmo/m006/human-old-bald-raw.glb';
const output = '.cache/character-mmo/m006/human-old-bald-candidate.glb';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).setVertexLayout(VertexLayout.SEPARATE);
const doc = await io.read(input);
const root = doc.getRoot();
const base = (await io.read('.cache/character-mmo/m004/human-shape-family-v1.glb')).getRoot();
const skin = root.listSkins()[0], baseSkin = base.listSkins()[0];
if (!skin || !baseSkin || skin.listJoints().length !== 65 || baseSkin.listJoints().length !== 65) {
    throw Error('Old/bald and active Human must share a 65-joint skin');
}
const from = skin.listJoints(), to = baseSkin.listJoints();
const toIndex = new Map(to.map((joint, i) => [joint.getName(), i]));
const remap = from.map(joint => toIndex.get(joint.getName()));
if (remap.some(index => index === undefined) || new Set(remap).size !== 65) {
    throw Error('Old/bald skin changed the named Human joint set');
}
const oldBind = skin.getInverseBindMatrices().getArray();
const baseBind = baseSkin.getInverseBindMatrices().getArray();
const newBind = new Float32Array(oldBind.length);
for (let old = 0; old < from.length; old++) {
    const target = remap[old];
    for (let k = 0; k < 16; k++) {
        const value = oldBind[old * 16 + k], expected = baseBind[target * 16 + k];
        if (Math.abs(value - expected) / Math.max(1, Math.abs(expected)) > .002) {
            throw Error(`Old/bald inverse bind changed at ${from[old].getName()}[${k}]`);
        }
        newBind[target * 16 + k] = value;
    }
}
// The streamed equipment path borrows the live body's palette by joint *index*.
// Blender preserves the named bones but exports them in a different order. Restore
// the active Human order and rewrite JOINTS_0 on every candidate mesh before
// putting this variant under that loader.
// https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#skins
for (const mesh of root.listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
        const joints = prim.getAttribute('JOINTS_0');
        const weights = prim.getAttribute('WEIGHTS_0');
        if (!joints || !weights) throw Error(`Unskinned old/bald mesh: ${mesh.getName()}`);
        joints.setArray(Uint16Array.from(joints.getArray(), (index, i) => {
            if (remap[index] === undefined && weights.getArray()[i] > 0) {
                throw Error(`Unmapped weighted joint ${index} in ${mesh.getName()}`);
            }
            return remap[index] ?? 0;
        }));
    }
}
for (const joint of from) skin.removeJoint(joint);
for (const joint of to) {
    const matching = from.find(candidate => candidate.getName() === joint.getName());
    skin.addJoint(matching);
}
skin.getInverseBindMatrices().setArray(newBind);
// Blender also nests exported skinned meshes under the armature's 0.01 scale
// node. The active Human keeps its mesh at the scene root and only the joints
// under that node. Lite computes inverse(meshWorld) * jointWorld * IBM for each
// palette entry; retaining Blender's extra mesh parent made that palette 100x
// larger and sent every borrowed garment offscreen. Match the active frame.
// https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#skins
const scene = root.listScenes()[0];
for (const node of root.listNodes().filter(candidate => candidate.getMesh())) {
    scene.addChild(node);
}
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
if (check.listAnimations().length !== 57 || check.listSkins().length !== 1
    || check.listSkins()[0].listJoints().length !== 65 || !body
    || body.listPrimitives()[0].listTargets().length !== 2
    || check.listMeshes().length !== 3
    || check.listSkins()[0].listJoints().some((joint, i) => joint.getName() !== to[i].getName())
    || check.listNodes().filter(node => node.getMesh())
        .some(node => !check.listScenes()[0].listChildren().includes(node))) {
    throw Error('Old/bald candidate lost source clips, skin, shape or head/eye meshes');
}
console.log(JSON.stringify({output, rawBytes: (await fs.stat(input)).size,
    candidateBytes: bytes.length, animations: check.listAnimations().length,
    joints: check.listSkins()[0].listJoints().length,
    shapeTargets: body.listPrimitives()[0].listTargets().length,
    remappedJoints: remap.filter((index, old) => index !== old).length}));
