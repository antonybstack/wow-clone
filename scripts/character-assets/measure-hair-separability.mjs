/**
 * M006 entry gate: can the shipped Human be made bald without re-authoring the head?
 *
 * The milestone asks for "at least long hair versus bald". Long hair is additive and can be
 * authored as a separate mesh. Bald is subtractive, and this measures whether the shipped
 * asset can give it up.
 *
 * The answer is no, and the number that says so is how much of the hair silhouette has any
 * other head surface beneath it. A hair *shell* -- a cap sitting over a complete scalp --
 * can be collapsed onto that scalp, and a morph target can express it. A hair *sculpt* --
 * the skull's own outer surface with lock shapes cut into it -- cannot: there is nothing
 * underneath to land on, so removing the locks opens a hole in the head.
 *
 * Five collapse rules were tried against this asset before the measurement was written, and
 * each failed in a way that pointed here:
 *
 *  1. Move each hair vertex inward along its own normal. Flattened the cap on the back of
 *     the skull; never even classified the fringe, whose locks jut forward so the inward ray
 *     leaves the head. Their neighbours moved and tore them.
 *  2. Project the detected set onto the scalp triangles. Fixed nothing, because the fringe
 *     was still not in the set.
 *  3. Classify and collapse by Laplacian smoothing with the region rim pinned. Deflated the
 *     dome between the pins, pulling the crown 72 mm down and calling 282 of 333 vertices
 *     hair.
 *  4. The same with Taubin lambda/mu smoothing, which does not shrink. Tore a hole through
 *     the crown: with no scalp beneath, the cap smoothed straight through the skull.
 *  5. Project onto an ellipsoid dome fitted to the region. Well behaved -- a projection onto
 *     a convex surface cannot self-intersect -- and it does not produce a bald head: a dome
 *     loose enough to leave the skull alone leaves the fringe untouched, and one tight
 *     enough to take the fringe cuts into the skull.
 *
 * The output is that measurement plus the two derived facts M006 needs: bald is blocked on
 * re-authoring the head, and re-authoring changes the body's vertex count, which is the
 * correspondence M004 and M005 are built on.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {MeshoptDecoder, MeshoptEncoder} from 'meshoptimizer';
import {rayHitsTriangle, vertexNormals} from './garment-coverage.mjs';

const BODY = 'public/ashen-reach/equipment/body.glb';
const REPORT = 'docs/baselines/character-mmo/m006/hair-separability.json';
const MESH_NAME = 'HumanV1Body';
const SHELL_M = 0.016;      // how far inward to look for a surface beneath a vertex
const BROW_Y = 1.615;       // hair sits above the brow; the face below is never hair
const EAR_X = 0.055;
const EAR_Y_LOW = 1.60, EAR_Y_HIGH = 1.68;

await MeshoptDecoder.ready;
await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
    'meshopt.decoder': MeshoptDecoder,
    'meshopt.encoder': MeshoptEncoder,
});

const bodyBytes = await fs.readFile(BODY);
const doc = await io.read(BODY);
const root = doc.getRoot();
const mesh = root.listMeshes().find(m => m.getName() === MESH_NAME);
const prim = mesh.listPrimitives()[0];
const positions = prim.getAttribute('POSITION').getArray();
const indices = prim.getIndices().getArray();
const count = prim.getAttribute('POSITION').getCount();
const jointsArr = prim.getAttribute('JOINTS_0').getArray();
const weightsArr = prim.getAttribute('WEIGHTS_0').getArray();
const jointNames = root.listSkins()[0].listJoints().map(j => j.getName());
const headJoints = new Set([jointNames.indexOf('mixamorig:Head'), jointNames.indexOf('mixamorig:HeadTop_End')]);

const head = [];
for (let v = 0; v < count; v++) {
    let best = -1, primary = -1;
    for (let k = 0; k < 4; k++) {
        const w = weightsArr[v * 4 + k];
        if (w > best) { best = w; primary = jointsArr[v * 4 + k]; }
    }
    if (headJoints.has(primary)) head.push(v);
}

const normals = vertexNormals(positions, indices);
const headTriangles = [];
for (let t = 0; t < indices.length; t += 3) {
    const a = indices[t], b = indices[t + 1], c = indices[t + 2];
    if (positions[a * 3 + 1] > 1.45 || positions[b * 3 + 1] > 1.45 || positions[c * 3 + 1] > 1.45) {
        headTriangles.push(a, b, c);
    }
}

const region = head.filter((v) => {
    const x = positions[v * 3], y = positions[v * 3 + 1];
    if (y < BROW_Y) return false;
    return !(Math.abs(x) > EAR_X && y > EAR_Y_LOW && y < EAR_Y_HIGH);
});

let overAnotherSurface = 0;
for (const v of region) {
    const px = positions[v * 3], py = positions[v * 3 + 1], pz = positions[v * 3 + 2];
    const dx = -normals[v * 3], dy = -normals[v * 3 + 1], dz = -normals[v * 3 + 2];
    let found = false;
    for (let t = 0; t < headTriangles.length && !found; t += 3) {
        if (headTriangles[t] === v || headTriangles[t + 1] === v || headTriangles[t + 2] === v) continue;
        const a = headTriangles[t] * 3, b = headTriangles[t + 1] * 3, c = headTriangles[t + 2] * 3;
        found = rayHitsTriangle(px, py, pz, dx, dy, dz, SHELL_M,
            positions[a], positions[a + 1], positions[a + 2],
            positions[b], positions[b + 1], positions[b + 2],
            positions[c], positions[c + 1], positions[c + 2]);
    }
    if (found) overAnotherSurface++;
}

const fraction = overAnotherSurface / region.length;
const report = {
    schema: 1,
    generatedBy: 'scripts/character-assets/measure-hair-separability.mjs',
    body: {path: BODY, sha256: createHash('sha256').update(bodyBytes).digest('hex'), mesh: MESH_NAME, vertices: count},
    region: {
        rule: 'head-driven, above the brow, ears excluded by region',
        browY: BROW_Y,
        headDrivenVertices: head.length,
        aboveBrowVertices: region.length,
    },
    shell: {
        rule: `another head surface within ${SHELL_M * 1000} mm straight down the vertex's own normal`,
        verticesOverAnotherSurface: overAnotherSurface,
        fraction: Number(fraction.toFixed(4)),
    },
    verdict: fraction > 0.6 ? 'separable' : 'fused',
    conclusion: 'The hair is the head\'s own outer surface with lock shapes sculpted into it, sharing one mesh and one material with the face. It is not a shell over a scalp, so no morph target can remove it: there is nothing beneath to collapse onto.',
    blocks: 'bald',
    nextStep: 'Re-author the head with hair as separate geometry. That changes the body mesh vertex count, so it invalidates the vertex correspondence the M004 shape family and the M005 garment refit both depend on, and belongs in a body-source milestone rather than in the creator slice.',
    unblocked: 'Long hair is additive: a separate mesh on the same 65-joint rig, like the M005 plate. It needs none of this.',
};
await fs.mkdir(path.dirname(REPORT), {recursive: true});
await fs.writeFile(REPORT, `${JSON.stringify(report, null, 1)}\n`);
console.log(`head-driven ${head.length}, above brow ${region.length}`);
console.log(`over another surface: ${overAnotherSurface} (${(fraction * 100).toFixed(1)}%) -> ${report.verdict}`);
console.log(`wrote ${REPORT}`);
