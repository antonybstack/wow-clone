/** Where the posed soles actually sit relative to the ground plane.
 *
 * The capsule is grounded -- its bottom sits on the terrain and `grounded` is true -- so a
 * character that looks like it floats is a question about the *visual* feet, not about physics.
 * In the body's own space the ground is y = 0: the engine parks the body root at
 * -capsuleHeight/2 and the body's lowest bind vertex is exactly the capsule bottom.
 *
 * So this poses the clips offline with the existing LBS evaluator and reports the lowest posed
 * vertex of the body's foot region and of each boot. A positive number is a gap.
 * https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#skinning
 */
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import { globalMatricesByName, jointMatricesFromNamed, poseNodes, skinPositions } from './pose-skin.mjs';

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
const BODY = 'public/ashen-reach/equipment/body.glb';
const PIECES = {
    wayfarerBoots: 'public/ashen-reach/equipment/wayfarerBoots.glb',
    duskguardGreaves: 'public/ashen-reach/equipment/duskguardGreaves.glb',
};
const CLIPS = (process.env.ASHEN_CLIPS || 'Idle_Loop,Walk_Loop,Sprint_Loop').split(',');
const out = process.argv[2] || 'docs/baselines/character-mmo/m6/foot-contact.json';

const bodyRoot = (await io.read(BODY)).getRoot();
const bodySkin = bodyRoot.listSkins()[0];
const clips = new Map(bodyRoot.listAnimations().map(c => [c.getName(), c]));
for (const name of CLIPS) assert(clips.has(name), `${BODY} has no clip ${name}`);

/** Lowest posed Y over a primitive, and over the subset whose bind Y marks it as foot geometry. */
function lowestPosed(prim, matrices, footBindCut) {
    const position = prim.getAttribute('POSITION').getArray();
    const joints = prim.getAttribute('JOINTS_0').getArray();
    const weights = prim.getAttribute('WEIGHTS_0').getArray();
    const posed = skinPositions(position, joints, weights, matrices);
    let all = Infinity, foot = Infinity, footCount = 0;
    for (let v = 0; v < posed.length / 3; v++) {
        const y = posed[v * 3 + 1];
        if (y < all) all = y;
        if (position[v * 3 + 1] <= footBindCut) { footCount++; if (y < foot) foot = y; }
    }
    return { lowestY: all, lowestFootY: Number.isFinite(foot) ? foot : null, footVertices: footCount };
}

const rows = [];
for (const clipName of CLIPS) {
    const clip = clips.get(clipName);
    const pose = poseNodes(bodyRoot, clip, 0);
    const globalByName = globalMatricesByName(bodyRoot, pose);
    const bodyMatrices = jointMatricesFromNamed(bodySkin, globalByName);
    const bodyPrim = bodyRoot.listMeshes().find(m => m.getName() === 'HumanV1Body').listPrimitives()[0];
    // Everything below 12 cm in the bind pose is ankle-and-below on this 1.75 m rig.
    const body = lowestPosed(bodyPrim, bodyMatrices, 0.12);
    const row = { clip: clipName, body, pieces: {} };
    for (const [id, path] of Object.entries(PIECES)) {
        const root = (await io.read(path)).getRoot();
        const skin = root.listSkins()[0];
        const matrices = jointMatricesFromNamed(skin, globalByName);
        for (const mesh of root.listMeshes()) {
            for (const prim of mesh.listPrimitives()) {
                row.pieces[mesh.getName()] = { ...lowestPosed(prim, matrices, 0.12), piece: id };
            }
        }
    }
    rows.push(row);
    console.log(JSON.stringify({
        clip: clipName,
        bodyFootLowestY: +body.lowestFootY.toFixed(4),
        pieces: Object.fromEntries(Object.entries(row.pieces).map(([n, v]) => [n, +v.lowestY.toFixed(4)])),
    }));
}
await fs.writeFile(out, JSON.stringify({
    note: 'In the body\'s own space the ground plane is y = 0. A positive lowest Y is a gap between the visual mesh and the ground; negative means it sinks below.',
    body: BODY, pieces: PIECES, clips: CLIPS, rows,
}, null, 2));
console.log('wrote', out);
