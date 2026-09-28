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
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {MeshoptDecoder, MeshoptEncoder} from 'meshoptimizer';

const CANDIDATE = '.cache/character-mmo/m004/human-shape-family-v1.glb';
const GARMENTS = [
    {slot: 'torso', item: 'wayfarerTunic', file: 'public/ashen-reach/equipment/wayfarerTunic.glb'},
    {slot: 'legs', item: 'wayfarerTrousers', file: 'public/ashen-reach/equipment/wayfarerTrousers.glb'},
    {slot: 'boots', item: 'wayfarerBoots', file: 'public/ashen-reach/equipment/wayfarerBoots.glb'},
];
const OUT = 'docs/baselines/character-mmo/m004/shape-garment-fit.json';
const NEAR_M = 0.06;   // beyond this a body vertex is not in the garment's neighbourhood
const COVER_M = 0.06;  // how far the outward normal ray looks for cloth
const REJECT_SQ = 0.09;

await MeshoptDecoder.ready;
await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
    'meshopt.decoder': MeshoptDecoder,
    'meshopt.encoder': MeshoptEncoder,
});

/** Moller-Trumbore, two-sided: cloth shells are not reliably wound outward.
 *  https://dl.acm.org/doi/10.1080/10867651.1997.10487468 */
function rayHitsTriangle(ox, oy, oz, dx, dy, dz, maxT, ax, ay, az, bx, by, bz, cx, cy, cz) {
    const e1x = bx - ax, e1y = by - ay, e1z = bz - az;
    const e2x = cx - ax, e2y = cy - ay, e2z = cz - az;
    const px = dy * e2z - dz * e2y, py = dz * e2x - dx * e2z, pz = dx * e2y - dy * e2x;
    const det = e1x * px + e1y * py + e1z * pz;
    if (Math.abs(det) < 1e-12) return false;
    const inv = 1 / det;
    const tx = ox - ax, ty = oy - ay, tz = oz - az;
    const u = (tx * px + ty * py + tz * pz) * inv;
    if (u < 0 || u > 1) return false;
    const qx = ty * e1z - tz * e1y, qy = tz * e1x - tx * e1z, qz = tx * e1y - ty * e1x;
    const v = (dx * qx + dy * qy + dz * qz) * inv;
    if (v < 0 || u + v > 1) return false;
    const t = (e2x * qx + e2y * qy + e2z * qz) * inv;
    return t > 1e-5 && t <= maxT;
}

/** Squared distance from a point to a triangle. Ericson, Real-Time Collision Detection 5.1.5. */
function distanceToTriangle(px, py, pz, ax, ay, az, bx, by, bz, cx, cy, cz) {
    const abx = bx - ax, aby = by - ay, abz = bz - az;
    const acx = cx - ax, acy = cy - ay, acz = cz - az;
    const apx = px - ax, apy = py - ay, apz = pz - az;
    const d1 = abx * apx + aby * apy + abz * apz;
    const d2 = acx * apx + acy * apy + acz * apz;
    let qx, qy, qz;
    if (d1 <= 0 && d2 <= 0) { qx = ax; qy = ay; qz = az; }
    else {
        const bpx = px - bx, bpy = py - by, bpz = pz - bz;
        const d3 = abx * bpx + aby * bpy + abz * bpz;
        const d4 = acx * bpx + acy * bpy + acz * bpz;
        if (d3 >= 0 && d4 <= d3) { qx = bx; qy = by; qz = bz; }
        else {
            const vc = d1 * d4 - d3 * d2;
            if (vc <= 0 && d1 >= 0 && d3 <= 0) {
                const v = d1 / (d1 - d3);
                qx = ax + abx * v; qy = ay + aby * v; qz = az + abz * v;
            } else {
                const cpx = px - cx, cpy = py - cy, cpz = pz - cz;
                const d5 = abx * cpx + aby * cpy + abz * cpz;
                const d6 = acx * cpx + acy * cpy + acz * cpz;
                if (d6 >= 0 && d5 <= d6) { qx = cx; qy = cy; qz = cz; }
                else {
                    const vb = d5 * d2 - d1 * d6;
                    if (vb <= 0 && d2 >= 0 && d6 <= 0) {
                        const w = d2 / (d2 - d6);
                        qx = ax + acx * w; qy = ay + acy * w; qz = az + acz * w;
                    } else {
                        const va = d3 * d6 - d5 * d4;
                        if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) {
                            const w = (d4 - d3) / ((d4 - d3) + (d5 - d6));
                            qx = bx + (cx - bx) * w; qy = by + (cy - by) * w; qz = bz + (cz - bz) * w;
                        } else {
                            const denom = 1 / (va + vb + vc), v = vb * denom, w = vc * denom;
                            qx = ax + abx * v + acx * w; qy = ay + aby * v + acy * w; qz = az + abz * v + acz * w;
                        }
                    }
                }
            }
        }
    }
    const dx = px - qx, dy = py - qy, dz = pz - qz;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function vertexNormals(positions, indices) {
    const n = new Float32Array(positions.length);
    for (let t = 0; t < indices.length; t += 3) {
        const a = indices[t] * 3, b = indices[t + 1] * 3, c = indices[t + 2] * 3;
        const ux = positions[b] - positions[a], uy = positions[b + 1] - positions[a + 1], uz = positions[b + 2] - positions[a + 2];
        const wx = positions[c] - positions[a], wy = positions[c + 1] - positions[a + 1], wz = positions[c + 2] - positions[a + 2];
        const fx = uy * wz - uz * wy, fy = uz * wx - ux * wz, fz = ux * wy - uy * wx;
        for (const o of [a, b, c]) { n[o] += fx; n[o + 1] += fy; n[o + 2] += fz; }
    }
    for (let i = 0; i < n.length; i += 3) {
        const m = Math.hypot(n[i], n[i + 1], n[i + 2]);
        if (m > 1e-9) { n[i] /= m; n[i + 1] /= m; n[i + 2] /= m; }
    }
    return n;
}

async function readGarment(file) {
    const doc = await io.read(file);
    const parts = [];
    for (const mesh of doc.getRoot().listMeshes()) {
        for (const prim of mesh.listPrimitives()) {
            parts.push({
                name: mesh.getName(),
                positions: prim.getAttribute('POSITION').getArray(),
                indices: prim.getIndices().getArray(),
            });
        }
    }
    return parts;
}

/** Per body vertex: nearest distance to the cloth, and whether the outward normal finds it. */
function classify(positions, normals, parts) {
    const count = positions.length / 3;
    const distance = new Float32Array(count).fill(Infinity);
    const covered = new Uint8Array(count);
    for (let v = 0; v < count; v++) {
        const px = positions[v * 3], py = positions[v * 3 + 1], pz = positions[v * 3 + 2];
        const nx = normals[v * 3], ny = normals[v * 3 + 1], nz = normals[v * 3 + 2];
        let best = Infinity, hit = false;
        for (const part of parts) {
            const gp = part.positions, gi = part.indices;
            for (let t = 0; t < gi.length; t += 3) {
                const a = gi[t] * 3, b = gi[t + 1] * 3, c = gi[t + 2] * 3;
                const rx = px - gp[a], ry = py - gp[a + 1], rz = pz - gp[a + 2];
                if (rx * rx + ry * ry + rz * rz > REJECT_SQ) continue;
                if (!hit && rayHitsTriangle(px, py, pz, nx, ny, nz, COVER_M,
                    gp[a], gp[a + 1], gp[a + 2], gp[b], gp[b + 1], gp[b + 2], gp[c], gp[c + 1], gp[c + 2])) hit = true;
                const d = distanceToTriangle(px, py, pz,
                    gp[a], gp[a + 1], gp[a + 2], gp[b], gp[b + 1], gp[b + 2], gp[c], gp[c + 1], gp[c + 2]);
                if (d < best) best = d;
            }
        }
        distance[v] = best;
        covered[v] = hit ? 1 : 0;
    }
    return {distance, covered};
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
        const parts = await readGarment(garment.file);
        const results = {};
        for (const [shape, positions] of Object.entries(shapes)) {
            results[shape] = classify(positions, vertexNormals(positions, indices), parts);
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
                garment: garment.item, slot: garment.slot, shape,
                bodyVerticesInRegion: inRegion,
                coveredByGarment: covered,
                newlyUncovered: lost,
                newlyCovered: gained,
                worstNewGapMm: Number((worst * 1000).toFixed(2)),
                meanNewGapMm: lost ? Number((sum / lost * 1000).toFixed(2)) : 0,
                worstAt: {x: Number(worstAt.x.toFixed(4)), y: Number(worstAt.y.toFixed(4)), z: Number(worstAt.z.toFixed(4))},
            };
            rows.push(row);
            console.log(`${garment.item.padEnd(17)} ${shape.padEnd(8)} region=${String(inRegion).padStart(4)} `
                + `covered=${String(covered).padStart(4)} newlyUncovered=${String(lost).padStart(4)} `
                + `newlyCovered=${String(gained).padStart(3)} worstGap=${row.worstNewGapMm.toFixed(1)}mm`);
        }
    }

    await fs.mkdir(path.dirname(OUT), {recursive: true});
    await fs.writeFile(OUT, `${JSON.stringify({
        schema: 1,
        generatedBy: 'scripts/character-assets/measure-shape-garment-fit.mjs',
        candidate: CANDIDATE,
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
