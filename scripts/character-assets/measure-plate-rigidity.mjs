/**
 * M005: prove the rigid plate does not bend, on both axes it could.
 *
 * "Hard plates must not bend like cloth" has two failure modes, and each has an exact test
 * rather than an eyeball.
 *
 * Under **animation**, a mesh deforms because its vertices are driven by different bones in
 * different proportions. A piece whose every vertex carries exactly one influence at full
 * weight is transformed by a single bone matrix, so every distance inside it is preserved
 * for every pose of every clip, by construction. That is checked here by reading the
 * weights, which settles the whole clip library at once and does not depend on sampling the
 * right frames.
 *
 * Under a **shape change**, the piece could be squashed by the fit. The rigid fit mode emits
 * one uniform scale and translation per rigid piece, so every pairwise distance inside a
 * piece changes by the *same* factor and no angle changes: the plate is the same object at
 * a different size. What is measured is therefore not "did distances change" but "did they
 * all change by the same factor" -- the deviation of each pair's ratio from the piece's
 * median ratio. A cloth garment has no such factor and its deviation is large.
 *
 * Pairs are taken inside a rigid piece. Two pauldrons are two rigid bodies carried by two
 * different bones, and the distance between them is supposed to change.
 *
 * A cloth garment is measured the same way as the control. It is expected to fail both, and
 * a run where the tunic looks rigid means the measurement is broken, not that cloth is stiff.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {MeshoptDecoder, MeshoptEncoder} from 'meshoptimizer';

const PIECES = [
    {id: 'wardenPauldrons', kind: 'plate', file: '.cache/character-mmo/m005/warden-pauldrons-shaped.glb'},
    {id: 'wayfarerTunic', kind: 'cloth', file: '.cache/character-mmo/m005/wayfarerTunic.glb'},
    {id: 'wayfarerTrousers', kind: 'cloth', file: '.cache/character-mmo/m005/wayfarerTrousers.glb'},
];
const OUT = 'docs/baselines/character-mmo/m005/plate-rigidity.json';
const SAMPLE = 120;   // vertices sampled per piece; 120 gives 7,140 distinct pairs

await MeshoptDecoder.ready;
await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
    'meshopt.decoder': MeshoptDecoder,
    'meshopt.encoder': MeshoptEncoder,
});

/** Evenly spaced indices, so the sample is the same on every run and spans the mesh. */
function sampleIndices(count, wanted) {
    const n = Math.min(count, wanted);
    const out = [];
    for (let i = 0; i < n; i++) out.push(Math.floor((i * count) / n));
    return out;
}

function similarityDeviation(base, shaped, indices) {
    const ratios = [];
    const pairs = [];
    for (let a = 0; a < indices.length; a++) {
        for (let b = a + 1; b < indices.length; b++) {
            const i = indices[a] * 3, j = indices[b] * 3;
            const d0 = Math.hypot(base[i] - base[j], base[i + 1] - base[j + 1], base[i + 2] - base[j + 2]);
            const d1 = Math.hypot(shaped[i] - shaped[j], shaped[i + 1] - shaped[j + 1], shaped[i + 2] - shaped[j + 2]);
            if (d0 < 1e-4) continue;
            ratios.push(d1 / d0);
            pairs.push({d0, d1});
        }
    }
    if (!ratios.length) return null;
    const sorted = [...ratios].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    let worstRatio = 0, worstAbs = 0;
    for (let k = 0; k < ratios.length; k++) {
        const dev = Math.abs(ratios[k] - median);
        if (dev > worstRatio) worstRatio = dev;
        const abs = Math.abs(pairs[k].d1 - median * pairs[k].d0);
        if (abs > worstAbs) worstAbs = abs;
    }
    return {
        pairs: ratios.length,
        medianRatio: Number(median.toFixed(6)),
        worstRatioDeviation: Number(worstRatio.toFixed(6)),
        worstDeviationMm: Number((worstAbs * 1000).toFixed(4)),
    };
}

const rows = [];
for (const piece of PIECES) {
    const doc = await io.read(piece.file);
    for (const mesh of doc.getRoot().listMeshes()) {
        const names = mesh.getExtras()?.targetNames || [];
        for (const prim of mesh.listPrimitives()) {
            const base = prim.getAttribute('POSITION').getArray();
            const count = prim.getAttribute('POSITION').getCount();
            const jointsArr = prim.getAttribute('JOINTS_0').getArray();
            const weightsArr = prim.getAttribute('WEIGHTS_0').getArray();

            // Animation rigidity: one influence at full weight for every vertex.
            let singleBone = 0, maxSecondary = 0;
            const bones = new Set();
            for (let v = 0; v < count; v++) {
                let primary = 0, secondary = 0, primaryJoint = -1;
                for (let k = 0; k < 4; k++) {
                    const w = weightsArr[v * 4 + k];
                    if (w > primary) { secondary = Math.max(secondary, primary); primary = w; primaryJoint = jointsArr[v * 4 + k]; }
                    else secondary = Math.max(secondary, w);
                }
                if (secondary <= 1e-4 && Math.abs(primary - 1) <= 1e-4) singleBone++;
                if (secondary > maxSecondary) maxSecondary = secondary;
                if (primaryJoint >= 0) bones.add(primaryJoint);
            }

            // Sample inside each rigid group so a pair never spans two rigid bodies.
            const byGroup = new Map();
            for (let v = 0; v < count; v++) {
                let primary = -1, best = -1;
                for (let k = 0; k < 4; k++) {
                    const w = weightsArr[v * 4 + k];
                    if (w > best) { best = w; primary = jointsArr[v * 4 + k]; }
                }
                if (!byGroup.has(primary)) byGroup.set(primary, []);
                byGroup.get(primary).push(v);
            }
            const groups = [...byGroup.entries()]
                .sort((a, b) => b[1].length - a[1].length)
                .slice(0, 2)
                .map(([joint, members]) => ({joint, members}));
            const shapes = {};
            prim.listTargets().forEach((target, i) => {
                const delta = target.getAttribute('POSITION').getArray();
                const shaped = Float32Array.from(base);
                for (let k = 0; k < shaped.length; k++) shaped[k] += delta[k];
                shapes[names[i] ?? `target${i}`] = groups.map(({joint, members}) => {
                    const picked = sampleIndices(members.length, SAMPLE).map(k => members[k]);
                    return {joint, vertices: members.length, ...similarityDeviation(base, shaped, picked)};
                });
            });

            const row = {
                piece: piece.id, kind: piece.kind, mesh: mesh.getName(), vertices: count,
                animation: {
                    verticesOnOneBoneAtFullWeight: singleBone,
                    fraction: Number((singleBone / count).toFixed(4)),
                    largestSecondaryWeight: Number(maxSecondary.toFixed(4)),
                    distinctPrimaryBones: bones.size,
                },
                shape: shapes,
                rigidGroupsMeasured: groups.length,
            };
            rows.push(row);
            const worst = Object.entries(shapes)
                .map(([k, v]) => `${k} ${v.map(g => `${g.medianRatio}x±${g.worstDeviationMm}mm`).join(',')}`).join(' ');
            console.log(`${piece.id.padEnd(17)} ${piece.kind.padEnd(5)} ${mesh.getName().padEnd(24)} `
                + `rigidVerts=${row.animation.fraction} maxSecondaryWeight=${row.animation.largestSecondaryWeight} `
                + `bones=${bones.size} | ${worst}`);
        }
    }
}

await fs.mkdir(path.dirname(OUT), {recursive: true});
await fs.writeFile(OUT, `${JSON.stringify({
    schema: 1,
    generatedBy: 'scripts/character-assets/measure-plate-rigidity.mjs',
    definitions: {
        'animation.verticesOnOneBoneAtFullWeight': 'vertices with exactly one influence at weight 1; such a piece is transformed by a single bone matrix, so every internal distance survives every pose',
        'shape[].medianRatio': 'the uniform factor every distance inside that rigid piece changed by',
        'shape[].worstDeviationMm': 'largest departure from that uniform factor; 0 means a pure similarity, so no bending',
    },
    sampleVertices: SAMPLE,
    rows,
}, null, 1)}\n`);
console.log(`wrote ${OUT}`);
