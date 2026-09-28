/**
 * Measure what the M004 shape family does to the fit of the Human starter garments.
 *
 * The active Human is one mesh, `HumanV1Body`. Unlike the Orc it has no separate body
 * regions to hide, so `equipment-stream.js` has nothing to switch off when a tunic goes on:
 * the whole body stays drawn, and the garment only looks right because it is authored to sit
 * outside the body's surface. Change the body's girth and that margin is spent.
 *
 * A body vertex counts as *covered* by a garment when a short ray along its own outward
 * normal hits that garment's cloth. The headline number is not the raw uncovered count --
 * the throat above a collar and the back of a hand are uncovered by design -- but the
 * change against the neutral body: vertices that the shipped configuration covers and this
 * shape does not. Neutral is the control, so anything the metric reports is something the
 * shape actually broke.
 *
 * Two earlier versions of this script failed that control and were replaced. Signing each
 * vertex against its nearest garment triangle reported 72 penetrations on the neutral body,
 * because these garments are shelled and the inner surface's normal points back at the body.
 * Calling every uncovered vertex within 60 mm a penetration reported 174, because most of
 * them were simply outside the garment's area.
 *
 * Measured in the shared rest pose. Animation can open or close the margin further, so a
 * clean rest-pose result would not by itself prove a clean walk cycle.
 *
 * With `ASHEN_GARMENT_DIR` pointing at the M005 refitted garments, the garment is shaped by
 * its own morph target of the same name before the comparison, which is what measures
 * whether the refit actually closed the gap. The control is unchanged either way: both the
 * body and the garment sit at weight 0 for the neutral row.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {MeshoptDecoder, MeshoptEncoder} from 'meshoptimizer';
import {COVER_M, classifyCoverage, vertexNormals} from './garment-coverage.mjs';

const CANDIDATE = '.cache/character-mmo/m004/human-shape-family-v1.glb';
const GARMENTS = [
    {slot: 'torso', item: 'wayfarerTunic', file: 'public/ashen-reach/equipment/wayfarerTunic.glb'},
    {slot: 'legs', item: 'wayfarerTrousers', file: 'public/ashen-reach/equipment/wayfarerTrousers.glb'},
    {slot: 'boots', item: 'wayfarerBoots', file: 'public/ashen-reach/equipment/wayfarerBoots.glb'},
];
const GARMENT_DIR = process.env.ASHEN_GARMENT_DIR || null;
const OUT = process.env.ASHEN_FIT_REPORT
    || (GARMENT_DIR ? 'docs/baselines/character-mmo/m005/shape-garment-fit.json'
        : 'docs/baselines/character-mmo/m004/shape-garment-fit.json');
const NEAR_M = 0.06;   // beyond this a body vertex is not in the garment's neighbourhood

await MeshoptDecoder.ready;
await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
    'meshopt.decoder': MeshoptDecoder,
    'meshopt.encoder': MeshoptEncoder,
});

async function readGarment(file) {
    const doc = await io.read(file);
    const parts = [];
    for (const mesh of doc.getRoot().listMeshes()) {
        const names = mesh.getExtras()?.targetNames || [];
        for (const prim of mesh.listPrimitives()) {
            const base = prim.getAttribute('POSITION').getArray();
            const shapes = {neutral: base};
            prim.listTargets().forEach((target, i) => {
                const delta = target.getAttribute('POSITION').getArray();
                const arr = Float32Array.from(base);
                for (let k = 0; k < arr.length; k++) arr[k] += delta[k];
                shapes[names[i] ?? `target${i}`] = arr;
            });
            parts.push({name: mesh.getName(), positions: base, shapes, indices: prim.getIndices().getArray()});
        }
    }
    return parts;
}

/** The same pieces with the positions of one shape selected. */
function garmentAt(parts, shape) {
    return parts.map(part => ({...part, positions: part.shapes[shape] ?? part.positions}));
}

async function main() {
    const doc = await io.read(CANDIDATE);
    const mesh = doc.getRoot().listMeshes().find(m => m.getName() === 'HumanV1Body');
    const prim = mesh.listPrimitives()[0];
    const base = prim.getAttribute('POSITION').getArray();
    const indices = prim.getIndices().getArray();
    const names = mesh.getExtras().targetNames;
    const shapes = {neutral: Float32Array.from(base)};
    prim.listTargets().forEach((target, i) => {
        const delta = target.getAttribute('POSITION').getArray();
        const arr = Float32Array.from(base);
        for (let k = 0; k < arr.length; k++) arr[k] += delta[k];
        shapes[names[i]] = arr;
    });

    const rows = [];
    for (const garment of GARMENTS) {
        const file = GARMENT_DIR ? path.join(GARMENT_DIR, path.basename(garment.file)) : garment.file;
        const parts = await readGarment(file);
        const refitted = parts.some(part => Object.keys(part.shapes).length > 1);
        const results = {};
        for (const [shape, positions] of Object.entries(shapes)) {
            // A refitted garment moves with the body; a shipped one stays where it is.
            results[shape] = classifyCoverage(positions, vertexNormals(positions, indices), garmentAt(parts, shape));
        }
        const control = results.neutral;
        for (const [shape, result] of Object.entries(results)) {
            let inRegion = 0, covered = 0, lost = 0, gained = 0, worst = 0, sum = 0;
            const worstAt = {x: 0, y: 0, z: 0};
            for (let v = 0; v < result.distance.length; v++) {
                if (result.distance[v] <= NEAR_M) inRegion++;
                if (result.covered[v]) covered++;
                if (control.covered[v] && !result.covered[v]) {
                    lost++;
                    const d = result.distance[v];
                    sum += d;
                    if (d > worst) {
                        worst = d;
                        worstAt.x = shapes[shape][v * 3]; worstAt.y = shapes[shape][v * 3 + 1]; worstAt.z = shapes[shape][v * 3 + 2];
                    }
                }
                if (!control.covered[v] && result.covered[v]) gained++;
            }
            const row = {
                garment: garment.item, slot: garment.slot, shape, refitted,
                bodyVerticesInRegion: inRegion,
                coveredByGarment: covered,
                newlyUncovered: lost,
                newlyCovered: gained,
                worstNewGapMm: Number((worst * 1000).toFixed(2)),
                meanNewGapMm: lost ? Number((sum / lost * 1000).toFixed(2)) : 0,
                worstAt: {x: Number(worstAt.x.toFixed(4)), y: Number(worstAt.y.toFixed(4)), z: Number(worstAt.z.toFixed(4))},
            };
            rows.push(row);
            console.log(`${garment.item.padEnd(17)} ${shape.padEnd(8)} ${refitted ? 'refit' : 'ship '} region=${String(inRegion).padStart(4)} `
                + `covered=${String(covered).padStart(4)} newlyUncovered=${String(lost).padStart(4)} `
                + `newlyCovered=${String(gained).padStart(3)} worstGap=${row.worstNewGapMm.toFixed(1)}mm`);
        }
    }

    await fs.mkdir(path.dirname(OUT), {recursive: true});
    await fs.writeFile(OUT, `${JSON.stringify({
        schema: 1,
        generatedBy: 'scripts/character-assets/measure-shape-garment-fit.mjs',
        candidate: CANDIDATE,
        garmentDir: GARMENT_DIR,
        pose: 'shared rest pose; animation is not evaluated',
        thresholds: {nearMetres: NEAR_M, coverRayMetres: COVER_M},
        definitions: {
            coveredByGarment: 'a ray along the body vertex normal, coverRayMetres long, hits the garment',
            newlyUncovered: 'covered on the neutral body and not on this shape: skin this shape put outside the cloth',
            newlyCovered: 'uncovered on neutral and covered here: the shape pulled the body back inside',
            worstNewGapMm: 'largest distance from the cloth among the newly uncovered vertices',
        },
        note: 'HumanV1Body is a single mesh with no hideable regions, so every newly uncovered vertex is drawn.',
        rows,
    }, null, 1)}\n`);
    console.log(`wrote ${OUT}`);
}

await main();
