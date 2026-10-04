/** Where the foot comes out through the boot, measured rather than described.
 *
 * Dyeing the boot separated two speckle populations at close range: the ankle ones take the dye
 * and are the boot's own coincident geometry, the toe ones stay skin-coloured and are the body's
 * foot. This measures the second: posed at the idle, which body foot vertices are not covered by
 * the boot, and how far out they sit.
 * https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#skinning
 */
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import { classifyCoverage, vertexNormals } from './garment-coverage.mjs';
import { globalMatricesByName, jointMatricesFromNamed, poseNodes, skinPositions } from './pose-skin.mjs';

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
const BODY = 'public/ashen-reach/equipment/body.glb';
const BOOTS = { wayfarerBoots: 'public/ashen-reach/equipment/wayfarerBoots.glb', duskguardGreaves: 'public/ashen-reach/equipment/duskguardGreaves.glb' };
const CLIPS = (process.env.ASHEN_CLIPS || 'Idle_Loop,Walk_Loop,Sprint_Loop').split(',');
/** Bind-pose height below which a body vertex is ankle-and-below on this 1.75 m rig. */
const FOOT_CUT = Number(process.env.ASHEN_FOOT_CUT || 0.12);
const out = process.argv[2] || 'docs/baselines/character-mmo/m6/boot-fit.json';

const bodyRoot = (await io.read(BODY)).getRoot();
const bodySkin = bodyRoot.listSkins()[0];
const bodyPrim = bodyRoot.listMeshes().find(m => m.getName() === 'HumanV1Body').listPrimitives()[0];
const bodyBase = bodyPrim.getAttribute('POSITION').getArray();
const bodyJoints = bodyPrim.getAttribute('JOINTS_0').getArray();
const bodyWeights = bodyPrim.getAttribute('WEIGHTS_0').getArray();
const bodyIndices = bodyPrim.getIndices().getArray();
const clips = new Map(bodyRoot.listAnimations().map(c => [c.getName(), c]));

const rows = [];
for (const clipName of CLIPS) {
    assert(clips.has(clipName), `${BODY} has no clip ${clipName}`);
    const pose = poseNodes(bodyRoot, clips.get(clipName), 0);
    const byName = globalMatricesByName(bodyRoot, pose);
    const posed = skinPositions(bodyBase, bodyJoints, bodyWeights, jointMatricesFromNamed(bodySkin, byName));
    const normals = vertexNormals(posed, bodyIndices);

    for (const [id, path] of Object.entries(BOOTS)) {
        const root = (await io.read(path)).getRoot();
        const skin = root.listSkins()[0];
        const mats = jointMatricesFromNamed(skin, byName);
        const parts = [];
        for (const mesh of root.listMeshes()) {
            for (const prim of mesh.listPrimitives()) {
                const p = prim.getAttribute('POSITION').getArray();
                const j = prim.getAttribute('JOINTS_0')?.getArray(), w = prim.getAttribute('WEIGHTS_0')?.getArray();
                parts.push({ positions: j && w ? skinPositions(p, j, w, mats) : p, indices: prim.getIndices().getArray(), mesh: mesh.getName() });
            }
        }
        const { distance, covered } = classifyCoverage(posed, normals, parts);
        // Only the foot: the boot is not expected to cover a knee.
        const exposed = [];
        for (let v = 0; v < bodyBase.length / 3; v++) {
            if (bodyBase[v * 3 + 1] > FOOT_CUT) continue;
            if (covered[v]) continue;
            // A vertex far from any boot triangle is simply not under the boot at all.
            if (!Number.isFinite(distance[v]) || distance[v] > 0.05) continue;
            exposed.push({ v, distance: +distance[v].toFixed(5), y: +bodyBase[v * 3 + 1].toFixed(4) });
        }
        let footVerts = 0;
        for (let v = 0; v < bodyBase.length / 3; v++) if (bodyBase[v * 3 + 1] <= FOOT_CUT) footVerts++;
        exposed.sort((a, b) => a.distance - b.distance);
        rows.push({ clip: clipName, boot: id, footVertices: footVerts, exposed: exposed.length, parts: parts.map(p => p.mesh), worst: exposed.slice(0, 6) });
        console.log(JSON.stringify({ clip: clipName, boot: id, footVertices: footVerts, exposed: exposed.length, closest: exposed[0]?.distance ?? null }));
    }
}
await fs.writeFile(out, JSON.stringify({
    body: BODY, boots: BOOTS, clips: CLIPS, footCut: FOOT_CUT,
    note: 'exposed = body foot vertices within 50 mm of the boot whose outward normal does not hit it, i.e. the foot is outside the shell there.',
    rows,
}, null, 2));
console.log('wrote', out);
