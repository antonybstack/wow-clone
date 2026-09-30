/**
 * Close the residual M006 head/body join by diffusing a *local* rim correction over the
 * head's surface, and baking it into the head's atlas.
 *
 * `match-old-head-atlas.mjs` fits one affine for the whole head. That is the right first
 * move — it removed the orange-versus-grey break — but one affine cannot follow a mismatch
 * that varies around the neck, and what is left is a thin straight line under the jaw whose
 * size differs front to back (worst per-channel step 10.9 front-quarter, 16.1 back).
 *
 * This is deliberately not any of the five routes already rejected. It is not a material
 * factor, a vertex-colour fade, a per-vertex *ratio* at render time, a UV remap, or the
 * spatial taper whose weight stepped across UV islands. It is an **additive CIELAB
 * correction solved on the mesh graph and written into the texture**:
 *
 *  1. For each head rim vertex, the correction is the body's colour at the matching rim
 *     position minus the head's own — sampled the way the rasteriser samples, nudged toward
 *     each triangle's centroid, because a vertex UV sits exactly on an island boundary where
 *     the GPU never samples.
 *  2. Vertices are merged **by 3D position**, so the two halves of a UV seam are one node.
 *     This is precisely what broke the earlier taper: a weight that is smooth in 3D is a
 *     step in texture space, and six passes of dilation did not remove the patch it left on
 *     the nape. Solving on the merged graph makes the field continuous by construction.
 *  3. Dijkstra from the rim over real edge lengths carries each node its nearest rim
 *     correction, scaled by a falloff in geodesic distance, then a few Laplacian passes
 *     smooth it. Geodesic distance, not Euclidean: the chin is close to the throat through
 *     the air and far across the surface, and the correction must travel over the skin.
 *  4. The per-vertex field is rasterised barycentrically into the head atlas.
 *
 * The head's geometry, UVs, rig, weights and morph targets are untouched; only texels change.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import {NodeIO, VertexLayout} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import sharp from 'sharp';

const IN = process.env.ASHEN_SEAM_IN || '.cache/character-mmo/m006/human-old-bald-atlas-matched.glb';
const OUT = process.env.ASHEN_SEAM_OUT || '.cache/character-mmo/m006/human-old-bald-seam-diffused.glb';
const REPORT = 'docs/baselines/character-mmo/m006/neck-seam-diffusion.json';
const CUT_Y = 1.5;
const RIM_EPS = 0.002;                                    // metres either side of the cut
const FALLOFF_M = Number(process.env.ASHEN_SEAM_FALLOFF ?? 0.075);  // geodesic reach
const SMOOTH_PASSES = Number(process.env.ASHEN_SEAM_SMOOTH ?? 12);
const STRENGTH = Number(process.env.ASHEN_SEAM_STRENGTH ?? 1);

// sRGB <-> CIELAB (D65). Correcting in Lab keeps a lightness change from dragging hue.
const toLinear = c => (c /= 255) <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4;
const toSRGB = c => Math.max(0, Math.min(255, Math.round(255 * (c <= .0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - .055))));
const f = t => t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116;
const fInv = t => t ** 3 > 216 / 24389 ? t ** 3 : (116 * t - 16) * 27 / 24389;
function rgbToLab(r, g, b) {
    const R = toLinear(r), G = toLinear(g), B = toLinear(b);
    const x = f((.4124564 * R + .3575761 * G + .1804375 * B) / .95047);
    const y = f(.2126729 * R + .7151522 * G + .0721750 * B);
    const z = f((.0193339 * R + .1191920 * G + .9503041 * B) / 1.08883);
    return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}
function labToRgb(L, a, bb) {
    const y = (L + 16) / 116, x = y + a / 500, z = y - bb / 200;
    const X = fInv(x) * .95047, Y = fInv(y), Z = fInv(z) * 1.08883;
    return [
        toSRGB(3.2404542 * X - 1.5371385 * Y - .4985314 * Z),
        toSRGB(-.9692660 * X + 1.8760108 * Y + .0415560 * Z),
        toSRGB(.0556434 * X - .2040259 * Y + 1.0572252 * Z),
    ];
}

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).setVertexLayout(VertexLayout.SEPARATE);
const doc = await io.read(IN);
const root = doc.getRoot();
const meshOf = name => root.listMeshes().find(m => m.getName() === name);
const headMesh = meshOf('OldBaldHeadV2Diagnostic');
const bodyMesh = meshOf('HumanV1Body');
if (!headMesh || !bodyMesh) throw Error('Expected HumanV1Body and OldBaldHeadV2Diagnostic');
const headPrim = headMesh.listPrimitives()[0];
const bodyPrim = bodyMesh.listPrimitives()[0];

async function surface(prim) {
    const tex = prim.getMaterial().getBaseColorTexture();
    const {data, info} = await sharp(tex.getImage()).removeAlpha().raw().toBuffer({resolveWithObject: true});
    const uv = prim.getAttribute('TEXCOORD_0').getArray();
    const pos = prim.getAttribute('POSITION').getArray();
    const idx = prim.getIndices().getArray();
    const tris = new Map();
    for (let t = 0; t < idx.length; t += 3) {
        for (const v of [idx[t], idx[t + 1], idx[t + 2]]) {
            if (!tris.has(v)) tris.set(v, []);
            tris.get(v).push(t);
        }
    }
    const texel = (u, v) => {
        const x = Math.min(info.width - 1, Math.max(0, Math.round(u * (info.width - 1))));
        const y = Math.min(info.height - 1, Math.max(0, Math.round((1 - v) * (info.height - 1))));
        const o = (y * info.width + x) * info.channels;
        return [data[o], data[o + 1], data[o + 2]];
    };
    /** Average of samples taken a little inside each triangle that uses this vertex. */
    const sampleInward = (vi, k = 0.14) => {
        const out = [];
        for (const t of tris.get(vi) ?? []) {
            const [a, b, c] = [idx[t], idx[t + 1], idx[t + 2]];
            const cu = (uv[a * 2] + uv[b * 2] + uv[c * 2]) / 3;
            const cv = (uv[a * 2 + 1] + uv[b * 2 + 1] + uv[c * 2 + 1]) / 3;
            out.push(texel(uv[vi * 2] + (cu - uv[vi * 2]) * k, uv[vi * 2 + 1] + (cv - uv[vi * 2 + 1]) * k));
        }
        if (!out.length) out.push(texel(uv[vi * 2], uv[vi * 2 + 1]));
        return [0, 1, 2].map(ch => out.reduce((s, r) => s + r[ch], 0) / out.length);
    };
    return {tex, data, info, uv, pos, idx, tris, sampleInward};
}

const head = await surface(headPrim);
const body = await surface(bodyPrim);

// --- merge head vertices by position, so a UV seam is one node -------------------------
const key = (p, i) => [0, 1, 2].map(c => Math.round(p[i * 3 + c] * 1e5)).join(',');
const nodeOf = new Int32Array(head.pos.length / 3).fill(-1);
const nodePos = [];
const nodeMembers = [];
const seen = new Map();
for (let i = 0; i < head.pos.length / 3; i++) {
    const k = key(head.pos, i);
    let n = seen.get(k);
    if (n === undefined) {
        n = nodePos.length;
        seen.set(k, n);
        nodePos.push([head.pos[i * 3], head.pos[i * 3 + 1], head.pos[i * 3 + 2]]);
        nodeMembers.push([]);
    }
    nodeOf[i] = n;
    nodeMembers[n].push(i);
}
const nodeCount = nodePos.length;

const adj = Array.from({length: nodeCount}, () => new Set());
for (let t = 0; t < head.idx.length; t += 3) {
    const a = nodeOf[head.idx[t]], b = nodeOf[head.idx[t + 1]], c = nodeOf[head.idx[t + 2]];
    adj[a].add(b); adj[b].add(a); adj[b].add(c); adj[c].add(b); adj[c].add(a); adj[a].add(c);
}
const dist3 = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);

// --- the correction wanted at each rim node --------------------------------------------
const bodyRim = [];
for (let i = 0; i < body.pos.length / 3; i++) {
    if (Math.abs(body.pos[i * 3 + 1] - CUT_Y) > RIM_EPS) continue;
    bodyRim.push({p: [body.pos[i * 3], body.pos[i * 3 + 1], body.pos[i * 3 + 2]], lab: rgbToLab(...body.sampleInward(i))});
}
if (bodyRim.length < 12) throw Error(`Too few body rim vertices: ${bodyRim.length}`);

const rimNodes = [];
const correction = new Float64Array(nodeCount * 3);
for (let n = 0; n < nodeCount; n++) {
    if (Math.abs(nodePos[n][1] - CUT_Y) > RIM_EPS) continue;
    // The head's colour at this node, averaged over its UV copies.
    const labs = nodeMembers[n].map(i => rgbToLab(...head.sampleInward(i)));
    const headLab = [0, 1, 2].map(c => labs.reduce((s, l) => s + l[c], 0) / labs.length);
    // Nearest body rim vertex, and a short inverse-distance blend of its neighbours so the
    // target follows the neck's own variation instead of snapping between vertices.
    const near = bodyRim.map(r => ({r, d: dist3(nodePos[n], r.p)})).sort((a, b) => a.d - b.d).slice(0, 3);
    let wsum = 0;
    const target = [0, 0, 0];
    for (const {r, d} of near) {
        const w = 1 / Math.max(1e-4, d);
        wsum += w;
        for (let c = 0; c < 3; c++) target[c] += r.lab[c] * w;
    }
    for (let c = 0; c < 3; c++) correction[n * 3 + c] = STRENGTH * (target[c] / wsum - headLab[c]);
    rimNodes.push(n);
}
if (!rimNodes.length) throw Error('No head rim nodes found at the cut');

// --- carry it over the surface by geodesic distance -------------------------------------
const distance = new Float64Array(nodeCount).fill(Infinity);
const field = new Float64Array(nodeCount * 3);
// Dijkstra from every rim node at once; each node inherits its nearest rim's correction.
const queue = [];
for (const n of rimNodes) {
    distance[n] = 0;
    for (let c = 0; c < 3; c++) field[n * 3 + c] = correction[n * 3 + c];
    queue.push(n);
}
queue.sort((a, b) => distance[a] - distance[b]);
const visited = new Uint8Array(nodeCount);
while (queue.length) {
    queue.sort((a, b) => distance[a] - distance[b]);
    const n = queue.shift();
    if (visited[n]) continue;
    visited[n] = 1;
    if (distance[n] > FALLOFF_M) continue;
    for (const m of adj[n]) {
        const d = distance[n] + dist3(nodePos[n], nodePos[m]);
        if (d < distance[m]) {
            distance[m] = d;
            for (let c = 0; c < 3; c++) field[m * 3 + c] = field[n * 3 + c];
            queue.push(m);
        }
    }
}
// Falloff, then smooth on the graph. Smoothing after the falloff keeps the rim exact.
const weightAt = d => (d >= FALLOFF_M || !Number.isFinite(d) ? 0 : (1 + Math.cos(Math.PI * d / FALLOFF_M)) / 2);
for (let n = 0; n < nodeCount; n++) {
    const w = weightAt(distance[n]);
    for (let c = 0; c < 3; c++) field[n * 3 + c] *= w;
}
for (let pass = 0; pass < SMOOTH_PASSES; pass++) {
    const next = Float64Array.from(field);
    for (let n = 0; n < nodeCount; n++) {
        if (distance[n] === 0) continue;                 // rim stays pinned
        const nb = adj[n];
        if (!nb.size) continue;
        for (let c = 0; c < 3; c++) {
            let s = 0;
            for (const m of nb) s += field[m * 3 + c];
            next[n * 3 + c] = 0.5 * field[n * 3 + c] + 0.5 * (s / nb.size);
        }
    }
    field.set(next);
}

// --- rasterise the per-vertex field into the head atlas ---------------------------------
const {data, info} = head;
const acc = new Float64Array(info.width * info.height * 3);
const hit = new Uint8Array(info.width * info.height);
const px = (u, v) => [u * (info.width - 1), (1 - v) * (info.height - 1)];
for (let t = 0; t < head.idx.length; t += 3) {
    const vi = [head.idx[t], head.idx[t + 1], head.idx[t + 2]];
    const P = vi.map(i => px(head.uv[i * 2], head.uv[i * 2 + 1]));
    const F = vi.map(i => [0, 1, 2].map(c => field[nodeOf[i] * 3 + c]));
    if (F.every(v => v.every(x => Math.abs(x) < 1e-6))) continue;
    const minX = Math.max(0, Math.floor(Math.min(...P.map(p => p[0])) - 1));
    const maxX = Math.min(info.width - 1, Math.ceil(Math.max(...P.map(p => p[0])) + 1));
    const minY = Math.max(0, Math.floor(Math.min(...P.map(p => p[1])) - 1));
    const maxY = Math.min(info.height - 1, Math.ceil(Math.max(...P.map(p => p[1])) + 1));
    const d = (P[1][0] - P[0][0]) * (P[2][1] - P[0][1]) - (P[2][0] - P[0][0]) * (P[1][1] - P[0][1]);
    if (Math.abs(d) < 1e-12) continue;
    for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
        const w1 = ((x - P[0][0]) * (P[2][1] - P[0][1]) - (P[2][0] - P[0][0]) * (y - P[0][1])) / d;
        const w2 = ((P[1][0] - P[0][0]) * (y - P[0][1]) - (x - P[0][0]) * (P[1][1] - P[0][1])) / d;
        const w0 = 1 - w1 - w2;
        if (w0 < -0.06 || w1 < -0.06 || w2 < -0.06) continue;
        const o = y * info.width + x;
        hit[o] = 1;
        for (let c = 0; c < 3; c++) acc[o * 3 + c] = w0 * F[0][c] + w1 * F[1][c] + w2 * F[2][c];
    }
}
const corrected = Buffer.from(data);
let touched = 0, biggest = 0;
for (let o = 0; o < info.width * info.height; o++) {
    if (!hit[o]) continue;
    const dL = acc[o * 3], da = acc[o * 3 + 1], db = acc[o * 3 + 2];
    if (Math.abs(dL) < 1e-4 && Math.abs(da) < 1e-4 && Math.abs(db) < 1e-4) continue;
    const i = o * info.channels;
    const [L, a, b] = rgbToLab(data[i], data[i + 1], data[i + 2]);
    const rgb = labToRgb(L + dL, Math.max(-128, Math.min(127, a + da)), Math.max(-128, Math.min(127, b + db)));
    for (let c = 0; c < 3; c++) {
        biggest = Math.max(biggest, Math.abs(rgb[c] - data[i + c]));
        corrected[i + c] = rgb[c];
    }
    touched++;
}
head.tex.setImage(await sharp(corrected, {raw: {width: info.width, height: info.height, channels: info.channels}})
    .png().toBuffer()).setMimeType('image/png');

await fs.mkdir(path.dirname(OUT), {recursive: true});
const bytes = await io.writeBinary(doc);
await fs.writeFile(OUT, bytes);

const rimDeltas = rimNodes.map(n => Math.hypot(correction[n * 3], correction[n * 3 + 1], correction[n * 3 + 2]));
const report = {
    generatedBy: 'scripts/character-assets/diffuse-neck-seam.mjs',
    input: IN, output: OUT, bytes: bytes.byteLength,
    parameters: {cutY: CUT_Y, rimEpsM: RIM_EPS, falloffM: FALLOFF_M, smoothPasses: SMOOTH_PASSES, strength: STRENGTH},
    headVertices: head.pos.length / 3, mergedNodes: nodeCount,
    uvSplitNodes: nodeCount === head.pos.length / 3 ? 0 : head.pos.length / 3 - nodeCount,
    rimNodes: rimNodes.length, bodyRimVertices: bodyRim.length,
    rimCorrectionLabDistance: {
        min: Number(Math.min(...rimDeltas).toFixed(2)),
        mean: Number((rimDeltas.reduce((a, b) => a + b, 0) / rimDeltas.length).toFixed(2)),
        max: Number(Math.max(...rimDeltas).toFixed(2)),
    },
    texelsTouched: touched, largestChannelChange: biggest,
};
await fs.mkdir(path.dirname(REPORT), {recursive: true});
await fs.writeFile(REPORT, JSON.stringify(report, null, 1) + '\n');
console.log(`merged ${head.pos.length / 3} head vertices into ${nodeCount} nodes (${report.uvSplitNodes} UV splits)`);
console.log(`rim nodes ${rimNodes.length}, body rim ${bodyRim.length}; Lab correction min/mean/max ${report.rimCorrectionLabDistance.min}/${report.rimCorrectionLabDistance.mean}/${report.rimCorrectionLabDistance.max}`);
console.log(`touched ${touched} texels, largest channel change ${biggest}`);
console.log(`wrote ${OUT} (${bytes.byteLength} bytes)`);
