/**
 * Combine an M006 hair audition with the active Human for live motion review.
 * This writes only to .cache; it never changes the shipped body or startup pack.
 * The hair's own Blender skin has the same named joints but a reordered joint table.
 * Match by name, verify inverse binds, then attach the copied mesh to the body's skin.
 * https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#skins
 * copyToDocument retains authored material, texture, UVs and alpha mask rather than
 * rebuilding those properties by hand.
 * https://gltf-transform.dev/modules/functions/functions/copyToDocument
 */
import fs from 'node:fs/promises';
import {NodeIO, VertexLayout} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {compressTexture, copyToDocument, unpartition} from '@gltf-transform/functions';
import {MeshoptDecoder, MeshoptEncoder} from 'meshoptimizer';
import sharp from 'sharp';

const variant = process.argv[2] ?? 'ponytail01-tail';
if (!['long01', 'ponytail01', 'ponytail01-tail'].includes(variant)) throw Error(`Unknown variant ${variant}`);
const bodyPath = 'public/ashen-reach/equipment/body.glb';
const hairPath = `.cache/character-mmo/m006/${variant}-fitted.glb`;
const outPath = `.cache/character-mmo/m006/human-${variant}-candidate.glb`;
const tolerance = 2e-3; // Same Blender round-trip tolerance as M005's rigid plate.

await MeshoptDecoder.ready;
await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
    'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder,
}).setVertexLayout(VertexLayout.SEPARATE);
const bodyDoc = await io.read(bodyPath), hairDoc = await io.read(hairPath);
const body = bodyDoc.getRoot(), hair = hairDoc.getRoot();
// The CC0 source carries a 2048² masked atlas even though this candidate retains
// only the rear tie and tail. Reuse glTF Transform's alpha-safe PNG resize, keeping
// the authored UVs and MASK material intact rather than introducing a custom
// texture conversion or a runtime image decode step.
// https://gltf-transform.dev/modules/functions/functions/compressTexture
if (variant === 'ponytail01-tail') {
    const texture = hair.listTextures().find(t => t.getName() === 'ponytail01_diffuse');
    if (!texture || texture.getSize().join('x') !== '2048x2048')
        throw Error('Unexpected ponytail source atlas');
    await compressTexture(texture, {encoder: sharp, targetFormat: 'png', resize: [1024, 1024], effort: 8});
    if (texture.getMimeType() !== 'image/png' || texture.getSize().join('x') !== '1024x1024')
        throw Error('Ponytail atlas resize lost PNG or expected dimensions');
}
const bodySkin = body.listSkins()[0], hairSkin = hair.listSkins()[0];
if (!bodySkin || !hairSkin) throw Error('Both candidates need a skin');
const bodyIndex = new Map(bodySkin.listJoints().map((j, i) => [j.getName(), i]));
const bodyBind = bodySkin.getInverseBindMatrices().getArray();
const hairBind = hairSkin.getInverseBindMatrices().getArray();
const remap = hairSkin.listJoints().map((joint, i) => {
    const j = bodyIndex.get(joint.getName());
    if (j === undefined) throw Error(`Unknown hair joint ${joint.getName()}`);
    for (let k = 0; k < 16; k++) {
        const a = hairBind[16 * i + k], b = bodyBind[16 * j + k];
        if (Math.abs(a - b) / Math.max(1, Math.abs(b)) > tolerance) {
            throw Error(`Inverse bind mismatch at ${joint.getName()}[${k}]`);
        }
    }
    return j;
});
const sourceMesh = hair.listMeshes()[0];
if (hair.listMeshes().length !== 1 || !sourceMesh) throw Error('Expected one hair mesh');
const copies = copyToDocument(bodyDoc, hairDoc, [sourceMesh]);
const mesh = copies.get(sourceMesh);
for (const prim of mesh.listPrimitives()) {
    const joints = prim.getAttribute('JOINTS_0');
    if (!joints || !prim.getAttribute('WEIGHTS_0')) throw Error('Hair must be weighted');
    const values = joints.getArray().slice();
    for (let i = 0; i < values.length; i++) values[i] = remap[values[i]];
    joints.setArray(values);
    const material = prim.getMaterial();
    if (material?.getAlphaMode() !== 'MASK' || !material.getBaseColorTexture()) {
        throw Error('Hair lost its authored mask or texture');
    }
    if (variant === 'ponytail01-tail') {
        // Audition-only color match against the shipped dark sculpted hair. A creator
        // dye system must drive both surfaces from one declared palette instead.
        material.setBaseColorFactor([0.20, 0.35, 0.60, 1]);
    }
}
body.listScenes()[0].addChild(bodyDoc.createNode(mesh.getName()).setMesh(mesh).setSkin(bodySkin));
await bodyDoc.transform(unpartition());
const binary = await io.writeBinary(bodyDoc);
await fs.writeFile(outPath, binary);
const check = (await io.read(outPath)).getRoot();
const node = check.listNodes().find(n => n.getMesh()?.getName() === mesh.getName());
if (node?.getSkin() !== check.listSkins()[0] || check.listAnimations().length !== 57) {
    throw Error('Hair/body skin or source animation lost in round trip');
}
console.log(JSON.stringify({variant, outPath, bytes: binary.length,
    hairTriangles: node.getMesh().listPrimitives().reduce((n, p) => n + p.getIndices().getCount() / 3, 0),
    joints: bodySkin.listJoints().length, animations: check.listAnimations().length}));
