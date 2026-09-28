/**
 * M005: put the rigid plate where the running game can actually wear it.
 *
 * The plate has no home in the equipment catalogue. The seven slots are helmet, torso,
 * legs, boots, gloves and two hands; there is no shoulder slot, and adding one -- plus a
 * catalogue entry and a shipped asset -- is production content this milestone excludes. So
 * the plate rides on the *body* asset instead: this merges `WardenPauldrons` into a variant
 * of the M004 body candidate, and the game loads that variant behind `?plate=1`.
 *
 * That is not a slot system, and the report says so. What it does give is live motion of a
 * rigidly weighted plate on the real character, in the real scene, under the real clips.
 *
 * The merge is also a bind-compatibility proof. The plate came out of Blender with its own
 * skin, so its joint order need not match the body's. Every joint is matched by name, the
 * inverse binds are compared, and `JOINTS_0` is rewritten through that mapping before the
 * mesh is attached to the body's own skin. A mismatch fails the build rather than shipping
 * a plate that deforms against a different rest pose than the body it sits on.
 * https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#skins
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {NodeIO, VertexLayout} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {MeshoptDecoder, MeshoptEncoder} from 'meshoptimizer';

const BODY = '.cache/character-mmo/m004/human-shape-family-v1.glb';
const PLATE = '.cache/character-mmo/m005/warden-pauldrons-shaped.glb';
const OUT = '.cache/character-mmo/m005/human-shape-family-plated.glb';
const REPORT = 'docs/baselines/character-mmo/m005/plated-body.json';
const PLATE_MESH = 'WardenPauldrons';
// This gate is a sanity check, not a correctness requirement: the plate joins the body's
// skin, so the body's inverse binds are the ones that will be used and the plate's own are
// discarded. What has to be true is that the plate's vertices were authored against the
// same rest pose, which is what comparing the two sets confirms.
//
// The threshold is relative, and loose on purpose. Blender re-derives bind matrices from
// its own bone transforms, and the round trip moves a rotation component of magnitude ~1.7
// by ~1.3e-3, about 0.08 degrees. The shipped Human garments agree with the body to 1e-5
// because they never left the same pipeline; a real mismatch is not subtle either way --
// M001 measured 15.4 in these units on the Undead garments and called it a blocker.
const BIND_RELATIVE_TOLERANCE = 2e-3;

const sha = bytes => createHash('sha256').update(bytes).digest('hex');

await MeshoptDecoder.ready;
await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
    'meshopt.decoder': MeshoptDecoder,
    'meshopt.encoder': MeshoptEncoder,
}).setVertexLayout(VertexLayout.SEPARATE);

const bodyBytes = await fs.readFile(BODY);
const plateBytes = await fs.readFile(PLATE);
const doc = await io.read(BODY);
const root = doc.getRoot();
const bodySkin = root.listSkins()[0];
const bodyJoints = bodySkin.listJoints().map(j => j.getName());
const bodyIbm = bodySkin.getInverseBindMatrices().getArray();

const plateDoc = await io.read(PLATE);
const plateRoot = plateDoc.getRoot();
const plateSkin = plateRoot.listSkins()[0];
const plateJoints = plateSkin.listJoints().map(j => j.getName());
const plateIbm = plateSkin.getInverseBindMatrices().getArray();

// Name-matched joint remap, with the inverse binds checked rather than assumed.
const bodyIndexOf = new Map(bodyJoints.map((name, i) => [name, i]));
const remap = new Int32Array(plateJoints.length);
let worstBind = 0, worstRelative = 0;
plateJoints.forEach((name, from) => {
    const to = bodyIndexOf.get(name);
    if (to === undefined) throw Error(`Plate joint ${name} has no match on the body skin`);
    remap[from] = to;
    for (let k = 0; k < 16; k++) {
        const mine = plateIbm[from * 16 + k], theirs = bodyIbm[to * 16 + k];
        const delta = Math.abs(mine - theirs);
        if (delta > worstBind) worstBind = delta;
        const relative = delta / Math.max(1, Math.abs(theirs));
        if (relative > worstRelative) worstRelative = relative;
    }
});
if (worstRelative > BIND_RELATIVE_TOLERANCE) {
    throw Error(`Plate and body inverse binds differ by ${worstRelative} relative (${worstBind} absolute); `
        + 'the plate would deform against a different rest pose');
}
const reordered = plateJoints.some((name, i) => bodyIndexOf.get(name) !== i);

// Copy the plate's mesh into the body document, rebuilt attribute by attribute so the
// joint indices can be rewritten on the way in.
const plateMesh = plateRoot.listMeshes().find(m => m.getName() === PLATE_MESH);
if (!plateMesh) throw Error(`No ${PLATE_MESH} mesh in ${PLATE}`);
const buffer = root.listBuffers()[0];
const targetNames = plateMesh.getExtras()?.targetNames ?? [];
const newMesh = doc.createMesh(PLATE_MESH);
let vertices = 0, triangles = 0;

for (const prim of plateMesh.listPrimitives()) {
    const copy = doc.createPrimitive().setMode(prim.getMode());
    for (const semantic of prim.listSemantics()) {
        const source = prim.getAttribute(semantic);
        const array = source.getArray();
        const values = semantic === 'JOINTS_0'
            ? array.map(index => remap[index])
            : array.slice();
        copy.setAttribute(semantic, doc.createAccessor(`plate_${semantic}`)
            .setType(source.getType()).setArray(values).setBuffer(buffer));
    }
    const indices = prim.getIndices().getArray();
    copy.setIndices(doc.createAccessor('plate_indices').setType('SCALAR').setArray(indices.slice()).setBuffer(buffer));
    prim.listTargets().forEach((target, i) => {
        const name = targetNames[i] ?? `target${i}`;
        const copied = doc.createPrimitiveTarget(name);
        for (const semantic of target.listSemantics()) {
            const source = target.getAttribute(semantic);
            copied.setAttribute(semantic, doc.createAccessor(`plate_${name}_${semantic}`)
                .setType(source.getType()).setArray(source.getArray().slice()).setBuffer(buffer));
        }
        copy.addTarget(copied);
    });
    const source = prim.getMaterial();
    if (source) {
        copy.setMaterial(doc.createMaterial(source.getName() || PLATE_MESH)
            .setBaseColorFactor(source.getBaseColorFactor())
            .setMetallicFactor(source.getMetallicFactor())
            .setRoughnessFactor(source.getRoughnessFactor()));
    }
    newMesh.addPrimitive(copy);
    vertices += prim.getAttribute('POSITION').getCount();
    triangles += indices.length / 3;
}
newMesh.setWeights(targetNames.map(() => 0));
newMesh.setExtras({targetNames: [...targetNames]});

// The plate node sits beside the body mesh node, on the body's own skin, so one skeleton
// and one set of clips drive both.
const bodyMeshNode = root.listNodes().find(node => node.getMesh() && node.getSkin() === bodySkin);
if (!bodyMeshNode) throw Error('Could not find the body mesh node');
const plateNode = doc.createNode(PLATE_MESH).setMesh(newMesh).setSkin(bodySkin);
const scene = root.listScenes()[0];
scene.addChild(plateNode);

const outBytes = await io.writeBinary(doc);
await fs.mkdir(path.dirname(OUT), {recursive: true});
await fs.writeFile(OUT, outBytes);

// Re-read and confirm the plate survived with the body's skin and every clip intact.
const check = await io.read(OUT);
const checkRoot = check.getRoot();
const names = checkRoot.listMeshes().map(m => m.getName());
if (!names.includes(PLATE_MESH) || !names.includes('HumanV1Body')) {
    throw Error(`Written file has meshes ${names.join(', ')}`);
}
const plateNodeBack = checkRoot.listNodes().find(n => n.getMesh()?.getName() === PLATE_MESH);
if (plateNodeBack.getSkin() !== checkRoot.listSkins()[0]) throw Error('Plate is not on the body skin');
const clips = checkRoot.listAnimations().length;
if (clips !== 57) throw Error(`Expected 57 clips, have ${clips}`);

const report = {
    schema: 1,
    generatedBy: 'scripts/character-assets/build-plated-body.mjs',
    body: {path: BODY, sha256: sha(bodyBytes)},
    plate: {path: PLATE, sha256: sha(plateBytes), mesh: PLATE_MESH, vertices, triangles},
    output: {path: OUT, sha256: sha(outBytes), bytes: outBytes.byteLength},
    bind: {
        jointsMatchedByName: plateJoints.length,
        jointOrderDiffered: reordered,
        worstInverseBindDelta: Number(worstBind.toExponential(3)),
        worstRelativeDelta: Number(worstRelative.toExponential(3)),
        relativeTolerance: BIND_RELATIVE_TOLERANCE,
        units: 'inverse binds are in the asset\'s centimetre joint units',
    },
    clips,
    note: 'The plate has no catalogue slot, so it is carried by the body asset. This is not a slot system.',
};
await fs.mkdir(path.dirname(REPORT), {recursive: true});
await fs.writeFile(REPORT, `${JSON.stringify(report, null, 1)}\n`);
console.log(`wrote ${OUT} (${outBytes.byteLength} bytes, sha256 ${report.output.sha256.slice(0, 12)})`);
console.log(`plate ${vertices} vertices / ${triangles} triangles on the body skin; `
    + `${plateJoints.length} joints matched by name, order ${reordered ? 'differed and was remapped' : 'already matched'}, `
    + `worst inverse-bind delta ${report.bind.worstInverseBindDelta} absolute / ${report.bind.worstRelativeDelta} relative`);
