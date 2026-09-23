/** Fit the Human catalogue onto the print-sculpt Orc rest by non-rigid body
 *  registration, then carry the garments on the resulting displacement field.
 *
 * Coverage of a much larger limb is a problem of growing the garment surface, so
 * the fit is driven by the one thing that already knows the Orc's shape: the Orc
 * body mesh itself.
 *
 *   1. Prealign. Both bodies and every garment carry weights on the same 65 named
 *      mixamorig joints, so one skinning evaluation - p' = sum_b w_b * O_b * IBM_b * p
 *      - takes the Human bind pose onto the Orc rest skeleton. Each mesh undoes its
 *      own bind with its own inverse bind matrices, so no bone convention leaks in.
 *      This settles stature and limb length; girth is still Human.
 *   2. Register. Deform the prealigned Human body onto the Orc body surface with an
 *      annealed non-rigid ICP: closest compatible surface point as the data term, a
 *      Laplacian on the displacement field as the regulariser. The field, not the
 *      registered mesh, is the product.
 *   3. Transfer. Move every garment vertex by the field, interpolated from the
 *      nearby Human body vertices and weighted by skin-weight similarity so a
 *      sleeve reads the arm rather than the ribs it happens to hang beside.
 *
 * Because the field is the Human surface travelling to the Orc surface, a boot
 * that enclosed the Human foot encloses the Orc foot: the garment grows with the
 * body instead of being offset along its own normals. The field is smooth by
 * construction, so it cannot shear, invert or shred the way a per-vertex push can.
 * The clearance step that follows is then a few millimetres of cloth thickness
 * rather than the corrective mechanism.
 *
 * Offline rest bake only. No runtime wrap. Output feeds prepare-orc-equipment.mjs
 * unchanged.
 *
 *   node scripts/ashen-reach/fit-orc-garments.mjs [--item=wayfarerBoots] [--report]
 *                                                 [--debug-body]
 */
import fs from 'node:fs/promises';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {MeshoptDecoder, MeshoptEncoder} from 'meshoptimizer';
import {EQUIPMENT_ITEMS} from '../../src/ashen-reach/equipment-catalog.js';

await MeshoptDecoder.ready;
await MeshoptEncoder.ready;
const TARGET = process.argv.find((arg) => arg.startsWith('--target='))?.slice('--target='.length) || 'orc';
const TARGETS = {
    orc: ['public/characters/candidates/orc-source-v1.glb', 'OrcV1Body', '.cache/armory-assets/orc-sculpt'],
    undead: ['public/characters/candidates/undead-source-v1.glb', 'UndeadV1Body', '.cache/armory-assets/undead-tripo'],
    human: ['public/characters/candidates/human-source-v1.glb', 'HumanV1Body', '.cache/armory-assets/human-tripo'],
};
if (!TARGETS[TARGET]) throw Error(`Unknown fit target ${TARGET}`);
const [ORC, TARGET_BODY, OUT] = TARGETS[TARGET];
// The live Human pack is the Tripo body. Registration still starts from the
// split MakeHuman catalogue these garments were authored on.
const HUMAN = 'blender/characters/sources/human-catalogue/body.glb';
const HUMAN_DIR = 'blender/characters/sources/human-catalogue';

/** Garment thickness held off the skin, metres. Real leather/cloth, not a fudge. */
const CLEARANCE = {
    wayfarerBoots: 0.012,
    graveweaverGloves: 0.008,
    wayfarerTunic: 0.014,
    pilgrimTunic: 0.016,
    wayfarerTrousers: 0.012,
    graveweaverTop: 0.014,
    graveweaverSkirt: 0.012,
    graveweaverHood: 0.010,
};
const ITEMS = Object.keys(CLEARANCE);

/* ---------------------------------------------------------------- linear algebra
   glTF matrices are column-major arrays of 16. */
const mul = (a, b) => {
    const o = new Float64Array(16);
    for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
        let s = 0;
        for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
        o[c * 4 + r] = s;
    }
    return o;
};
const xform = (m, p) => [
    m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12],
    m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13],
    m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14],
];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scl = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = a => Math.hypot(a[0], a[1], a[2]);
const unit = a => {const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l];};

/* ------------------------------------------------------------------- rig + mesh */
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
    'meshopt.decoder': MeshoptDecoder,
    'meshopt.encoder': MeshoptEncoder,
});

/** Joint rest world matrices by name. */
function readRig(root) {
    const skin = root.listSkins()[0];
    if (!skin) throw Error('no skin');
    const joints = skin.listJoints();
    return {joints, byName: new Map(joints.map(j => [j.getName(), Array.from(j.getWorldMatrix())]))};
}

/** World-space triangle soup of the named meshes, with a uniform grid index. */
/** Unique surface points of a body, for the tests that ask what the skin does
 *  rather than what a triangle does. */
function readPoints(root, pick) {
    const out = [], seen = new Set();
    for (const node of root.listNodes()) {
        const mesh = node.getMesh();
        if (!mesh || !pick(node.getName())) continue;
        const M = Array.from(node.getWorldMatrix());
        for (const prim of mesh.listPrimitives()) {
            const P = prim.getAttribute('POSITION').getArray();
            for (const i of new Set(prim.getIndices().getArray())) {
                const v = xform(M, [P[i * 3], P[i * 3 + 1], P[i * 3 + 2]]);
                const k = `${Math.round(v[0] * 1e4)},${Math.round(v[1] * 1e4)},${Math.round(v[2] * 1e4)}`;
                if (seen.has(k)) continue;
                seen.add(k);
                out.push(v);
            }
        }
    }
    return out;
}

function readBody(root, pick) {
    const tris = [];
    for (const node of root.listNodes()) {
        const mesh = node.getMesh();
        if (!mesh || !pick(node.getName())) continue;
        const M = Array.from(node.getWorldMatrix());
        for (const prim of mesh.listPrimitives()) {
            const P = prim.getAttribute('POSITION').getArray();
            const I = prim.getIndices().getArray();
            const v = i => xform(M, [P[i * 3], P[i * 3 + 1], P[i * 3 + 2]]);
            for (let i = 0; i < I.length; i += 3) tris.push([v(I[i]), v(I[i + 1]), v(I[i + 2])]);
        }
    }
    if (!tris.length) throw Error('no body triangles');
    return tris;
}

const CELL = 0.05;
function buildGrid(tris) {
    const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
    for (const t of tris) for (const p of t) for (let k = 0; k < 3; k++) {
        if (p[k] < lo[k]) lo[k] = p[k];
        if (p[k] > hi[k]) hi[k] = p[k];
    }
    const dim = [0, 1, 2].map(k => Math.max(1, Math.ceil((hi[k] - lo[k]) / CELL) + 1));
    const cells = new Map();
    const key = (a, b, c) => (a * dim[1] + b) * dim[2] + c;
    tris.forEach((t, n) => {
        const mn = [0, 1, 2].map(k => Math.min(dim[k] - 1, Math.max(0, Math.floor((Math.min(t[0][k], t[1][k], t[2][k]) - lo[k]) / CELL))));
        const mx = [0, 1, 2].map(k => Math.min(dim[k] - 1, Math.max(0, Math.floor((Math.max(t[0][k], t[1][k], t[2][k]) - lo[k]) / CELL))));
        for (let x = mn[0]; x <= mx[0]; x++) for (let y = mn[1]; y <= mx[1]; y++) for (let z = mn[2]; z <= mx[2]; z++) {
            const k = key(x, y, z);
            let list = cells.get(k);
            if (!list) cells.set(k, list = []);
            list.push(n);
        }
    });
    return {tris, lo, hi, dim, cells, key, stamp: new Int32Array(tris.length), token: 0};
}

/** Nearest point on a triangle (Ericson, Real-Time Collision Detection). */
function closestOnTri(p, t) {
    const [a, b, c] = t;
    const ab = sub(b, a), ac = sub(c, a), ap = sub(p, a);
    const d1 = dot(ab, ap), d2 = dot(ac, ap);
    if (d1 <= 0 && d2 <= 0) return a;
    const bp = sub(p, b), d3 = dot(ab, bp), d4 = dot(ac, bp);
    if (d3 >= 0 && d4 <= d3) return b;
    const vc = d1 * d4 - d3 * d2;
    if (vc <= 0 && d1 >= 0 && d3 <= 0) return add(a, scl(ab, d1 / (d1 - d3)));
    const cp = sub(p, c), d5 = dot(ab, cp), d6 = dot(ac, cp);
    if (d6 >= 0 && d5 <= d6) return c;
    const vb = d5 * d2 - d1 * d6;
    if (vb <= 0 && d2 >= 0 && d6 <= 0) return add(a, scl(ac, d2 / (d2 - d6)));
    const va = d3 * d6 - d5 * d4;
    if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) return add(b, scl(sub(c, b), (d4 - d3) / ((d4 - d3) + (d5 - d6))));
    const denom = 1 / (va + vb + vc);
    return add(a, add(scl(ab, vb * denom), scl(ac, vc * denom)));
}

/** Signed distance to the body surface; negative inside. */
function signedDistance(grid, p) {
    const {tris, lo, dim, cells, key} = grid;
    const base = [0, 1, 2].map(k => Math.min(dim[k] - 1, Math.max(0, Math.floor((p[k] - lo[k]) / CELL))));
    let best = Infinity, bestTri = null, bestPt = null, bestIdx = -1;
    for (let ring = 0; ring < 6; ring++) {
        for (let x = base[0] - ring; x <= base[0] + ring; x++) {
            if (x < 0 || x >= dim[0]) continue;
            for (let y = base[1] - ring; y <= base[1] + ring; y++) {
                if (y < 0 || y >= dim[1]) continue;
                for (let z = base[2] - ring; z <= base[2] + ring; z++) {
                    if (z < 0 || z >= dim[2]) continue;
                    if (ring && Math.max(Math.abs(x - base[0]), Math.abs(y - base[1]), Math.abs(z - base[2])) !== ring) continue;
                    const list = cells.get(key(x, y, z));
                    if (!list) continue;
                    for (const n of list) {
                        const q = closestOnTri(p, tris[n]);
                        const d = len(sub(p, q));
                        if (d < best) {best = d; bestTri = tris[n]; bestPt = q; bestIdx = n;}
                    }
                }
            }
        }
        if (bestTri && best <= ring * CELL) break;
    }
    if (!bestTri) return {d: Infinity, normal: [0, 1, 0]};
    const n = unit(cross(sub(bestTri[1], bestTri[0]), sub(bestTri[2], bestTri[0])));
    const outward = dot(sub(p, bestPt), n) < 0 ? -1 : 1;
    return {d: best * outward, normal: n, point: bestPt, tri: bestIdx};
}

/* ------------------------------------------------------------- mesh utilities */
/** Area-weighted vertex normals from the deformed geometry. */
function recomputeNormals(pos, idx) {
    const n = pos.length / 3;
    const N = new Float32Array(pos.length);
    for (let i = 0; i < idx.length; i += 3) {
        const a = idx[i], b = idx[i + 1], c = idx[i + 2];
        const A = [pos[a * 3], pos[a * 3 + 1], pos[a * 3 + 2]];
        const B = [pos[b * 3], pos[b * 3 + 1], pos[b * 3 + 2]];
        const C = [pos[c * 3], pos[c * 3 + 1], pos[c * 3 + 2]];
        const f = cross(sub(B, A), sub(C, A));
        for (const v of [a, b, c]) {N[v * 3] += f[0]; N[v * 3 + 1] += f[1]; N[v * 3 + 2] += f[2];}
    }
    for (let i = 0; i < n; i++) {
        const l = Math.hypot(N[i * 3], N[i * 3 + 1], N[i * 3 + 2]) || 1;
        N[i * 3] /= l; N[i * 3 + 1] /= l; N[i * 3 + 2] /= l;
    }
    return N;
}

/** Vertex adjacency over welded positions, so a split-UV seam still smooths across. */
function buildAdjacency(pos, idx) {
    const n = pos.length / 3;
    const weld = new Map();
    const rep = new Int32Array(n);
    for (let i = 0; i < n; i++) {
        const key = `${Math.round(pos[i * 3] * 1e4)},${Math.round(pos[i * 3 + 1] * 1e4)},${Math.round(pos[i * 3 + 2] * 1e4)}`;
        if (!weld.has(key)) weld.set(key, i);
        rep[i] = weld.get(key);
    }
    const adj = Array.from({length: n}, () => new Set());
    const link = (a, b) => {adj[rep[a]].add(rep[b]); adj[rep[b]].add(rep[a]);};
    for (let i = 0; i < idx.length; i += 3) {
        link(idx[i], idx[i + 1]); link(idx[i + 1], idx[i + 2]); link(idx[i + 2], idx[i]);
    }
    return {rep, adj};
}

/** Take the vertex-to-vertex noise out of the transfer.
 *  Each garment vertex is seated on its own blend of body triangles, so two neighbours
 *  can pick different triangles and land millimetres apart. Across a boot that reads as
 *  a torn toe cap and a shredded lace. The displacement itself varies slowly, so
 *  smoothing it over the welded mesh removes the noise and leaves the fit. */
function relaxTransfer(pos, rest, idx) {
    const {rep, adj} = buildAdjacency(rest, idx);
    if (RELAX_PASSES < 0) return {before: roughOf(pos, rest, rep, adj), after: roughOf(pos, rest, rep, adj)};
    const n = pos.length / 3;
    let u = new Float64Array(pos.length);
    for (let i = 0; i < n; i++) for (let k = 0; k < 3; k++) u[i * 3 + k] = pos[i * 3 + k] - rest[i * 3 + k];
    const before = roughness(u, rep, adj);
    for (let pass = 0; pass < RELAX_PASSES; pass++) {
        const next = new Float64Array(u);
        for (let i = 0; i < n; i++) {
            if (rep[i] !== i || !adj[i].size) continue;
            let x = 0, y = 0, z = 0;
            for (const j of adj[i]) {x += u[j * 3]; y += u[j * 3 + 1]; z += u[j * 3 + 2];}
            const deg = adj[i].size;
            next[i * 3] = RELAX_SELF * u[i * 3] + (1 - RELAX_SELF) * x / deg;
            next[i * 3 + 1] = RELAX_SELF * u[i * 3 + 1] + (1 - RELAX_SELF) * y / deg;
            next[i * 3 + 2] = RELAX_SELF * u[i * 3 + 2] + (1 - RELAX_SELF) * z / deg;
        }
        u = next;
    }
    const after = roughness(u, rep, adj);
    for (let i = 0; i < n; i++) {
        const r = rep[i];
        for (let k = 0; k < 3; k++) pos[i * 3 + k] = rest[i * 3 + k] + u[r * 3 + k];
    }
    return {before, after};
}

/** Roughness of the move from one pose to another, measured on the welded mesh. */
function roughOf(pos, rest, rep, adj) {
    const u = new Float64Array(pos.length);
    for (let i = 0; i < pos.length; i++) u[i] = pos[i] - rest[i];
    return roughness(u, rep, adj);
}

/** How far each vertex's displacement sits from its neighbours' mean. */
function roughness(u, rep, adj) {
    const mags = [];
    for (let i = 0; i < rep.length; i++) {
        if (rep[i] !== i || !adj[i].size) continue;
        let x = 0, y = 0, z = 0;
        for (const j of adj[i]) {x += u[j * 3]; y += u[j * 3 + 1]; z += u[j * 3 + 2];}
        const deg = adj[i].size;
        mags.push(Math.hypot(u[i * 3] - x / deg, u[i * 3 + 1] - y / deg, u[i * 3 + 2] - z / deg));
    }
    mags.sort((a, b) => a - b);
    const q = f => mags[Math.min(mags.length - 1, Math.floor(f * mags.length))];
    return {p50: q(0.5), p99: q(0.99), max: mags[mags.length - 1]};
}

/** Prepare a coarse lattice over the garment and return a resolver that replaces a
 *  per-vertex correction with the lattice's smooth reading of it.
 *  Corrections computed per vertex tear thin detail: a boot's lace is a tube a few
 *  millimetres across, and its two sides face opposite ways, so any scheme that pushes
 *  each vertex along its own normal turns the tube inside out. A lattice is a function
 *  of position rather than of the mesh, so every vertex in a neighbourhood moves
 *  together and the lace rides the boot instead of cutting through it. Unlike blurring
 *  the correction in place, neighbouring lattice nodes are free to move apart, so the
 *  toe box can still grow to clear a wider foot. */
function makeLattice(pos, rep, cell) {
    const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < pos.length / 3; i++) {
        if (rep[i] !== i) continue;
        for (let k = 0; k < 3; k++) {
            lo[k] = Math.min(lo[k], pos[i * 3 + k]);
            hi[k] = Math.max(hi[k], pos[i * 3 + k]);
        }
    }
    const org = lo.map(v => v - cell);
    const dim = [0, 1, 2].map(k => Math.max(2, Math.ceil((hi[k] - org[k]) / cell) + 2));
    const at = (x, y, z) => (z * dim[1] + y) * dim[0] + x;
    const nodes = dim[0] * dim[1] * dim[2];

    const ids = [], wts = [], pick = [];
    for (let i = 0; i < pos.length / 3; i++) {
        if (rep[i] !== i) continue;
        const f = [0, 1, 2].map(k => (pos[i * 3 + k] - org[k]) / cell);
        const base = [0, 1, 2].map(k => Math.max(0, Math.min(dim[k] - 2, Math.floor(f[k]))));
        const t = [0, 1, 2].map(k => Math.max(0, Math.min(1, f[k] - base[k])));
        const w = [], id = [];
        for (let dz = 0; dz < 2; dz++) for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
            w.push((dx ? t[0] : 1 - t[0]) * (dy ? t[1] : 1 - t[1]) * (dz ? t[2] : 1 - t[2]));
            id.push(at(base[0] + dx, base[1] + dy, base[2] + dz));
        }
        pick.push(i); ids.push(id); wts.push(w);
    }

    const d = new Float64Array(nodes * 3);
    const num = new Float64Array(nodes * 3), den = new Float64Array(nodes);
    return function resolve(push) {
        d.fill(0);
        for (let iter = 0; iter < FFD_ITERS; iter++) {
            num.fill(0); den.fill(0);
            for (let v = 0; v < pick.length; v++) {
                const i = pick[v], id = ids[v], w = wts[v];
                let ux = 0, uy = 0, uz = 0;
                for (let k = 0; k < 8; k++) {
                    ux += w[k] * d[id[k] * 3]; uy += w[k] * d[id[k] * 3 + 1]; uz += w[k] * d[id[k] * 3 + 2];
                }
                const rx = push[i * 3] - ux, ry = push[i * 3 + 1] - uy, rz = push[i * 3 + 2] - uz;
                for (let k = 0; k < 8; k++) {
                    const n = id[k], wk = w[k];
                    num[n * 3] += wk * rx; num[n * 3 + 1] += wk * ry; num[n * 3 + 2] += wk * rz;
                    den[n] += wk;
                }
            }
            for (let n = 0; n < nodes; n++) {
                if (den[n] <= 1e-9) continue;
                for (let k = 0; k < 3; k++) d[n * 3 + k] += num[n * 3 + k] / den[n];
            }
            for (let pass = 0; pass < FFD_SMOOTH; pass++) {
                const next = new Float64Array(d);
                for (let z = 0; z < dim[2]; z++) for (let y = 0; y < dim[1]; y++) for (let x = 0; x < dim[0]; x++) {
                    const n = at(x, y, z);
                    let sx = 0, sy = 0, sz = 0, cnt = 0;
                    const add6 = (X, Y, Z) => {
                        if (X < 0 || Y < 0 || Z < 0 || X >= dim[0] || Y >= dim[1] || Z >= dim[2]) return;
                        const m = at(X, Y, Z);
                        sx += d[m * 3]; sy += d[m * 3 + 1]; sz += d[m * 3 + 2]; cnt++;
                    };
                    add6(x - 1, y, z); add6(x + 1, y, z); add6(x, y - 1, z);
                    add6(x, y + 1, z); add6(x, y, z - 1); add6(x, y, z + 1);
                    if (!cnt) continue;
                    next[n * 3] = 0.5 * d[n * 3] + 0.5 * sx / cnt;
                    next[n * 3 + 1] = 0.5 * d[n * 3 + 1] + 0.5 * sy / cnt;
                    next[n * 3 + 2] = 0.5 * d[n * 3 + 2] + 0.5 * sz / cnt;
                }
                d.set(next);
            }
        }
        push.fill(0);
        for (let v = 0; v < pick.length; v++) {
            const i = pick[v], id = ids[v], w = wts[v];
            for (let k = 0; k < 8; k++) {
                push[i * 3] += w[k] * d[id[k] * 3];
                push[i * 3 + 1] += w[k] * d[id[k] * 3 + 1];
                push[i * 3 + 2] += w[k] * d[id[k] * 3 + 2];
            }
        }
    };
}

/** Hold the garment off the skin. The transfer is already volume-correct, so this
 *  is a few millimetres of cloth thickness - small enough to stay under the concave
 *  curvature radius that makes a naive normal offset self-intersect.
 *
 *  The push runs along the body's outward normal, never the garment's own: a boot's
 *  inner wall faces the leg, so pushing it along its own normal drives it further
 *  in. The displacement is smoothed over the garment before it is applied, so a
 *  locally deep poke cannot shear its neighbours. */
function clearancePush(pos, idx, grid, clearance, cap, cell) {
    const n = pos.length / 3;
    const {rep} = buildAdjacency(pos, idx);
    const resolve = makeLattice(pos, rep, cell);
    const base = Float64Array.from(pos);
    const moved = new Float64Array(pos.length);
    let deepest = 0, touched = 0;
    for (let round = 0; round < CLEAR_ROUNDS; round++) {
        const push = new Float64Array(pos.length);
        let worst = 0, hot = 0;
        for (let i = 0; i < n; i++) {
            if (rep[i] !== i) continue;
            const p = [pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]];
            const hit = signedDistance(grid, p);
            if (!isFinite(hit.d)) continue;
            const d = insideBody(grid, p) ? -Math.abs(hit.d) : Math.abs(hit.d);
            const deficit = clearance - d;
            if (deficit <= 1e-4) continue;
            hot++;
            if (deficit > worst) worst = deficit;
            if (round === 0 && deficit > deepest) deepest = deficit;
            const move = Math.min(deficit, CLEAR_STEP);
            push[i * 3] = hit.normal[0] * move;
            push[i * 3 + 1] = hit.normal[1] * move;
            push[i * 3 + 2] = hit.normal[2] * move;
        }
        if (round === 0) touched = hot;
        if (!hot) break;
        resolve(push);
        for (let i = 0; i < n; i++) {
            const r = rep[i];
            for (let k = 0; k < 3; k++) moved[i * 3 + k] += push[r * 3 + k];
        }
        // Never carry a vertex much further from where the transfer put it than the
        // cap, so a bad correspondence cannot quietly balloon the garment over many
        // rounds. The limit has to ease in: a hard clamp stops one vertex dead while
        // its neighbours keep moving, and creases the cloth exactly where the
        // correction is largest, which across a boot reads as a torn toe cap.
        for (let i = 0; i < n; i++) {
            const m = Math.hypot(moved[i * 3], moved[i * 3 + 1], moved[i * 3 + 2]);
            const s = m > 1e-9 ? cap * Math.tanh(m / cap) / m : 1;
            for (let k = 0; k < 3; k++) pos[i * 3 + k] = base[i * 3 + k] + moved[i * 3 + k] * s;
        }
        if (worst < 5e-4) break;
    }
    return {touched, deepest};
}

/** Push the garment out until it still covers the skin the Human fit covered.
 *  Garment-vertex tests miss this: the Orc's toes are finer than the boot's toe cap,
 *  so a toe can pass between boot vertices with no boot vertex inside the body.
 *
 *  An item's meshes are sealed together. Each target is answered by whichever of them
 *  is nearest, so a trouser cuff and its leg share the work at the hem, and a pendant
 *  lying on a vestment is never asked to cover the chest behind the vestment. */
function sealItem(jobs, targets, clearance) {
    const parts = jobs.map(job => {
        const {rep} = buildAdjacency(job.pos, job.idx);
        return {job, rep, resolve: makeLattice(job.pos, rep, job.cell), n: job.pos.length / 3};
    });
    let loose = targets.length, first = 0;
    for (let round = 0; round < SEAL_ROUNDS; round++) {
        const tris = [], own = [];
        const shells = [];
        for (const part of parts) {
            const {pos, idx} = part.job;
            const mine = [];
            for (let i = 0; i < idx.length; i += 3) {
                const t = [0, 1, 2].map(k => {
                    const v = idx[i + k];
                    return [pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]];
                });
                tris.push(t); mine.push(t);
                own.push([part, idx[i], idx[i + 1], idx[i + 2]]);
            }
            shells.push(buildGrid(mine));
        }
        const g = buildGrid(tris);
        const push = parts.map(part => new Float64Array(part.job.pos.length));
        const hits = parts.map(part => new Float64Array(part.n));
        loose = 0;
        for (const p of targets) {
            const near = signedDistance(g, p);
            if (!isFinite(near.d)) continue;
            // Covered means inside one of the item's shells, tested a shell at a time.
            // Parity over all of them together cannot answer it: a leg inside both a
            // trouser and a skirt over it crosses two surfaces on the way out, so the
            // count comes back even and the seal drives the trouser into the body.
            const within = shells.some(sh => insideBody(sh, p));
            if (within && Math.abs(near.d) >= clearance) continue;
            loose++;
            const gap = within ? clearance - Math.abs(near.d) : clearance + Math.abs(near.d);
            const away = sub(p, near.point);
            const dir = len(away) > 1e-6 ? scl(unit(away), within ? -1 : 1) : near.normal;
            const move = Math.min(gap, SEAL_STEP);
            // Nudge the triangle that failed to cover this point, not the point's own
            // neighbourhood: the cloth is what is allowed to move.
            const [part, ...vs] = own[near.tri];
            const at = parts.indexOf(part);
            for (const v of vs) {
                const r = part.rep[v];
                hits[at][r]++;
                push[at][r * 3] += dir[0] * move;
                push[at][r * 3 + 1] += dir[1] * move;
                push[at][r * 3 + 2] += dir[2] * move;
            }
        }
        if (round === 0) first = loose;
        if (!loose) break;
        for (let at = 0; at < parts.length; at++) {
            const part = parts[at];
            for (let i = 0; i < part.n; i++) {
                if (hits[at][i] > 1) for (let k = 0; k < 3; k++) push[at][i * 3 + k] /= hits[at][i];
            }
            // Spread the correction well past the point that asked for it: a toe pushing
            // through has to lift the whole toe cap, or the boot grows a toe of its own.
            part.resolve(push[at]);
            const {pos} = part.job;
            for (let i = 0; i < part.n; i++) {
                const r = part.rep[i];
                for (let k = 0; k < 3; k++) pos[i * 3 + k] += push[at][r * 3 + k];
            }
        }
    }
    return {before: first, after: loose, targets: targets.length};
}

/** A sole graded by foot girth can end up below the floor, because the radial term
 *  scales downward as well as sideways. Lift anything under the ground plane with a
 *  falloff that dies out by ankle height, so the last keeps its shape. */
const SOLE_DROP = 0.008;
const GROUND_BAND = 0.10;
function groundGuard(pos) {
    let minY = Infinity;
    for (let i = 1; i < pos.length; i += 3) if (pos[i] < minY) minY = pos[i];
    const lift = -SOLE_DROP - minY;
    if (lift <= 0) return 0;
    for (let i = 1; i < pos.length; i += 3) {
        const y = pos[i];
        if (y >= GROUND_BAND) continue;
        const f = (GROUND_BAND - y) / (GROUND_BAND - minY);
        pos[i] = y + lift * f * f * (3 - 2 * f);
    }
    return lift;
}
/** Axis-aligned bounds of a packed position array, rounded for the report. */
function bounds(p) {
    const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < p.length; i += 3) for (let c = 0; c < 3; c++) {
        if (p[i + c] < lo[c]) lo[c] = p[i + c];
        if (p[i + c] > hi[c]) hi[c] = p[i + c];
    }
    return [lo.map(v => +v.toFixed(3)), hi.map(v => +v.toFixed(3))];
}

/* --------------------------------------------------------- prealign to the Orc rig
   The garment's own inverse bind matrices supply the undo, so a Blender bone roll
   or axis convention baked into the source cannot reach the result. */

/** M_b = O_b * IBM_b for every joint of one skin. */
function bakeMatrices(skinJoints, ibm, orcRig) {
    return skinJoints.map((joint, b) => {
        const world = orcRig.byName.get(joint.getName());
        if (!world) throw Error(`Orc rig has no joint ${joint.getName()}`);
        return mul(world, Array.from(ibm.slice(b * 16, b * 16 + 16)));
    });
}

/** Linear blend skinning of a bind-space vertex array. */
function skinPoints(pos, J, W, M) {
    const n = pos.length / 3;
    const out = new Float64Array(pos.length);
    for (let i = 0; i < n; i++) {
        const p = [pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]];
        let wsum = 0;
        for (let c = 0; c < 4; c++) wsum += W[i * 4 + c];
        if (wsum < 1e-9) {out[i * 3] = p[0]; out[i * 3 + 1] = p[1]; out[i * 3 + 2] = p[2]; continue;}
        let x = 0, y = 0, z = 0;
        for (let c = 0; c < 4; c++) {
            const w = W[i * 4 + c] / wsum;
            if (w <= 0) continue;
            const q = xform(M[J[i * 4 + c]], p);
            x += q[0] * w; y += q[1] * w; z += q[2] * w;
        }
        out[i * 3] = x; out[i * 3 + 1] = y; out[i * 3 + 2] = z;
    }
    return out;
}

/** The Human body ships as coverage geosets that share one vertex array, so the
 *  union of their index buffers is the whole skin mesh. */
function readHumanBody(root) {
    const skin = root.listSkins()[0];
    let acc = null, J = null, W = null;
    const idx = [];
    // Which geoset each triangle belongs to, so the Orc body can inherit the exact
    // same cut through the registration instead of guessing at bone weights.
    const region = [];
    for (const node of root.listNodes()) {
        const mesh = node.getMesh();
        const name = node.getName();
        if (!mesh || !name.startsWith('Body')) continue;
        const M = Array.from(node.getWorldMatrix());
        if (M.some((v, i) => Math.abs(v - (i % 5 === 0 ? 1 : 0)) > 1e-5)) {
            throw Error(`Human ${name} has a non-identity bind transform`);
        }
        for (const prim of mesh.listPrimitives()) {
            const P = prim.getAttribute('POSITION');
            if (!acc) {
                acc = P;
                J = prim.getAttribute('JOINTS_0').getArray();
                W = prim.getAttribute('WEIGHTS_0').getArray();
            } else if (P !== acc) throw Error('Human body geosets do not share one vertex array');
            const I = prim.getIndices().getArray();
            for (let i = 0; i < I.length; i++) idx.push(I[i]);
            for (let i = 0; i < I.length / 3; i++) region.push(name);
        }
    }
    if (!acc) throw Error('no Human body mesh');
    return {skin, pos: acc.getArray(), idx: Uint32Array.from(idx), J, W, region};
}


/** Moller-Trumbore, returning the ray parameter and the triangle's facing. */
function hitTriangle(o, d, t) {
    const [a, b, c] = t;
    const e1 = sub(b, a), e2 = sub(c, a);
    const h = cross(d, e2);
    const det = dot(e1, h);
    if (Math.abs(det) < 1e-14) return null;
    const inv = 1 / det, s = sub(o, a);
    const u = dot(s, h) * inv;
    if (u < 0 || u > 1) return null;
    const q = cross(s, e1);
    const v = dot(d, q) * inv;
    if (v < 0 || u + v > 1) return null;
    const tt = dot(e2, q) * inv;
    if (tt <= 1e-6) return null;
    return tt;
}

/** The nearest crossing of the body along a ray, by walking the grid (Amanatides
 *  and Woo), with the sign of the crossing: positive where the ray leaves the body.
 *  That sign is what settles inside versus outside, which a nearest-triangle normal
 *  gets wrong in every crease. */
function rayFirst(grid, o, d, maxT) {
    const {tris, lo, dim, cells, key, stamp} = grid;
    const token = ++grid.token;
    const cell = [0, 1, 2].map(k => Math.floor((o[k] - lo[k]) / CELL));
    for (let k = 0; k < 3; k++) if (cell[k] < 0 || cell[k] >= dim[k]) return null;
    const step = [0, 1, 2].map(k => (d[k] > 0 ? 1 : -1));
    const delta = [0, 1, 2].map(k => (Math.abs(d[k]) < 1e-12 ? Infinity : CELL / Math.abs(d[k])));
    const next = [0, 1, 2].map(k => (Math.abs(d[k]) < 1e-12 ? Infinity
        : (lo[k] + (cell[k] + (d[k] > 0 ? 1 : 0)) * CELL - o[k]) / d[k]));
    let best = null;
    for (let guard = 0; guard < 4096; guard++) {
        const list = cells.get(key(cell[0], cell[1], cell[2]));
        if (list) for (const n of list) {
            if (stamp[n] === token) continue;
            stamp[n] = token;
            const t = hitTriangle(o, d, tris[n]);
            if (t === null || t > maxT) continue;
            if (!best || t < best.t) {
                const tri = tris[n];
                best = {t, facing: dot(d, cross(sub(tri[1], tri[0]), sub(tri[2], tri[0])))};
            }
        }
        const k = next[0] < next[1] ? (next[0] < next[2] ? 0 : 2) : (next[1] < next[2] ? 1 : 2);
        if (!isFinite(next[k]) || next[k] > maxT) break;
        // A triangle indexed in this cell may still lie beyond it, so only stop once
        // the best hit is inside the span already walked.
        if (best && best.t <= next[k]) break;
        cell[k] += step[k];
        if (cell[k] < 0 || cell[k] >= dim[k]) break;
        next[k] += delta[k];
    }
    return best;
}

/** How many times a ray leaves or enters the body, for the inside test. */
function crossings(grid, o, d) {
    const {tris, lo, dim, cells, key, stamp} = grid;
    const token = ++grid.token;
    const cell = [0, 1, 2].map(k => Math.floor((o[k] - lo[k]) / CELL));
    for (let k = 0; k < 3; k++) if (cell[k] < 0 || cell[k] >= dim[k]) return 0;
    const step = [0, 1, 2].map(k => (d[k] > 0 ? 1 : -1));
    const delta = [0, 1, 2].map(k => (Math.abs(d[k]) < 1e-12 ? Infinity : CELL / Math.abs(d[k])));
    const next = [0, 1, 2].map(k => (Math.abs(d[k]) < 1e-12 ? Infinity
        : (lo[k] + (cell[k] + (d[k] > 0 ? 1 : 0)) * CELL - o[k]) / d[k]));
    let hits = 0;
    for (let guard = 0; guard < 4096; guard++) {
        const list = cells.get(key(cell[0], cell[1], cell[2]));
        if (list) for (const n of list) {
            if (stamp[n] === token) continue;
            stamp[n] = token;
            if (hitTriangle(o, d, tris[n]) !== null) hits++;
        }
        const k = next[0] < next[1] ? (next[0] < next[2] ? 0 : 2) : (next[1] < next[2] ? 1 : 2);
        if (!isFinite(next[k])) break;
        cell[k] += step[k];
        if (cell[k] < 0 || cell[k] >= dim[k]) break;
        next[k] += delta[k];
    }
    return hits;
}

/** Where this vertex has to move along its own normal to land on the Orc skin;
 *  positive outwards, null if the skin is out of range either way. Following the
 *  normal rather than reaching for the closest point is what keeps the back of a
 *  knee from folding shut onto the calf that faces it. */
function alongNormal(grid, p, n, maxT) {
    const ahead = rayFirst(grid, p, n, maxT);
    // Leaving the body on the way out means this vertex is inside it, so move out.
    if (ahead && ahead.facing > 0) return ahead.t;
    // Anything else ahead is a surface this vertex is outside of - the far leg seen
    // across the crotch, or the arm beside the ribs. Snapping to it fuses the two,
    // so the only accepted pull is backwards onto the skin this vertex sits above.
    const behind = rayFirst(grid, p, scl(n, -1), maxT);
    return behind ? -behind.t : null;
}

/* ------------------------------------------------------- non-rigid registration
   Annealed ICP on a displacement field. Each round picks the closest Orc surface
   point whose normal agrees, then solves (w_data*I + stiff*L) u = w_data*d by
   Jacobi sweeps, so unmatched regions are filled by harmonic extension from their
   neighbours rather than left behind. Stiffness and the rejection radius both fall
   over the schedule: early rounds move whole limbs, late rounds settle the surface.

   The data term is deliberately not "move to the closest point". Reaching for the
   closest surface lets the back of a knee snap onto the calf that faces it, which
   folds the crease shut and inverts the triangles there; a garment bound to an
   inverted triangle then rebuilds inside the body, which is most of what went
   wrong before. Each vertex instead travels along its own normal to where that ray
   crosses the Orc skin, so the correspondence stays on the vertex's own side of the
   surface and the map is a normal displacement, which cannot fold for the
   displacements involved here.

   The registered mesh is a means, not the product - what the garments ride on is
   the field, which stays smooth even where the fit is imperfect. */
const REG_ROUNDS = 26;
const REG_CYCLES = 4;
const REG_SWEEPS = 10;
const REG_STIFF = [80, 3];
const REG_REACH = [0.30, 0.05];
const REG_SCALE = [0.5, 4];

/** The transfer leaves a little residual poke-through wherever the correspondence is
 *  weakest. Relaxing it out over several small smoothed rounds spreads the correction
 *  across the cloth, where one large push would shear the neighbours instead. */
const CLEAR_ROUNDS = 24;
const CLEAR_STEP = 0.006;
const DESPIKE_PASSES = 6;
const DESPIKE_RATIO = 2.5;
const DESPIKE_FLOOR = 0.03;
const SEAL_ROUNDS = 80;
const SEAL_STEP = 0.005;
const RELAX_PASSES = 12;
const FINISH_PASSES = 2;
const RELAX_SELF = 0.3;
/* Write the transfer alone, with no clearance or seal correction. Setting this and
   comparing the capture against a normal build says whether a visible artefact came from
   the correspondence or from a push, which is how the tearing was traced to the transfer. */
const NO_PUSH = process.env.ORC_NO_PUSH === '1';
/* Lattice cell per garment. It has to stay under the thickness of what it wraps: a
   cell wider than the Orc's hand averages the push on the back of the hand against
   the push on the palm, and the two cancel instead of opening the glove. */
const FFD_CELL = {graveweaverGloves: 0.018};
const FFD_DEFAULT = 0.03;
const FFD_ITERS = 1;
const FFD_SMOOTH = 6;
const FFD_RELAX = 1;
/* Laplacian passes taken out of the fit before a garment rides it, per garment. */
const FIELD_SMOOTH = {wayfarerBoots: 14, graveweaverGloves: 2};
const FIELD_DEFAULT = 8;

const anneal = (range, t) => range[0] * Math.pow(range[1] / range[0], t);

/** The rotation closest to a 3x3 matrix, by Newton iteration on R <- (R + R^-T)/2.
 *  Only the rotation is wanted: the scale and shear are what the fit is allowed to
 *  change, and separating them is what stops shear from accumulating. */
function polar(M) {
    const R = M.slice();
    for (let it = 0; it < 16; it++) {
        const det = R[0] * (R[4] * R[8] - R[5] * R[7]) - R[1] * (R[3] * R[8] - R[5] * R[6])
            + R[2] * (R[3] * R[7] - R[4] * R[6]);
        if (!(Math.abs(det) > 1e-18)) return null;
        // The inverse transpose of a 3x3 is its cofactor matrix over the determinant.
        const c = [
            (R[4] * R[8] - R[5] * R[7]) / det, (R[5] * R[6] - R[3] * R[8]) / det, (R[3] * R[7] - R[4] * R[6]) / det,
            (R[2] * R[7] - R[1] * R[8]) / det, (R[0] * R[8] - R[2] * R[6]) / det, (R[1] * R[6] - R[0] * R[7]) / det,
            (R[1] * R[5] - R[2] * R[4]) / det, (R[2] * R[3] - R[0] * R[5]) / det, (R[0] * R[4] - R[1] * R[3]) / det,
        ];
        let move = 0;
        for (let k = 0; k < 9; k++) {
            const v = 0.5 * (R[k] + c[k]);
            move += Math.abs(v - R[k]);
            R[k] = v;
        }
        if (move < 1e-10) break;
    }
    return R;
}

/** Per-vertex rotation and uniform scale that best carries the rest one-ring onto
 *  the current one. The Orc is a thicker Human, so growth is allowed; shear is not,
 *  and it is unchecked shear that stretched patches six hundredfold before. */
function fitSimilarity(V, rest, adj, i, A) {
    const S = new Float64Array(9);
    let restSq = 0;
    const px = V[i * 3], py = V[i * 3 + 1], pz = V[i * 3 + 2];
    const rx = rest[i * 3], ry = rest[i * 3 + 1], rz = rest[i * 3 + 2];
    for (const j of adj[i]) {
        const ex = px - V[j * 3], ey = py - V[j * 3 + 1], ez = pz - V[j * 3 + 2];
        const fx = rx - rest[j * 3], fy = ry - rest[j * 3 + 1], fz = rz - rest[j * 3 + 2];
        S[0] += ex * fx; S[1] += ex * fy; S[2] += ex * fz;
        S[3] += ey * fx; S[4] += ey * fy; S[5] += ey * fz;
        S[6] += ez * fx; S[7] += ez * fy; S[8] += ez * fz;
        restSq += fx * fx + fy * fy + fz * fz;
    }
    const R = restSq > 1e-18 ? polar(S) : null;
    if (!R) {
        for (let k = 0; k < 9; k++) A[i * 9 + k] = k % 4 === 0 ? 1 : 0;
        return;
    }
    // trace(R^T S) is the sum of (R e_rest) . e_cur, so the scale falls straight out.
    let num = 0;
    for (let k = 0; k < 9; k++) num += R[k] * S[k];
    const s = Math.min(REG_SCALE[1], Math.max(REG_SCALE[0], num / restSq));
    for (let k = 0; k < 9; k++) A[i * 9 + k] = s * R[k];
}

/** Triangles incident on each welded vertex, for the fold guard. */
function vertexTriangles(idx, rep) {
    const of = new Map();
    for (let n = 0; n < idx.length / 3; n++) {
        for (let k = 0; k < 3; k++) {
            const v = rep[idx[n * 3 + k]];
            let list = of.get(v);
            if (!list) of.set(v, list = []);
            list.push(n);
        }
    }
    return of;
}

const triNormal = (V, idx, n) => {
    const at = k => {const v = idx[n * 3 + k]; return [V[v * 3], V[v * 3 + 1], V[v * 3 + 2]];};
    const a = at(0);
    return cross(sub(at(1), a), sub(at(2), a));
};

/** Apply the round's displacement, backing off wherever it would turn a triangle
 *  inside out. A garment bound to an inverted triangle rebuilds inside the body, so
 *  a fold costs more than the millimetre of fit that caused it. */
function applyNoFlip(V, u, idx, rep, triOf) {
    const n = V.length / 3;
    const before = Float64Array.from(V);
    const alpha = new Float64Array(n).fill(1);
    const sign = new Float64Array(idx.length / 3);
    for (let t = 0; t < sign.length; t++) sign[t] = 1;
    const rest = Array.from({length: idx.length / 3}, (_, t) => triNormal(before, idx, t));
    let backed = 0;
    for (let guard = 0; guard < 8; guard++) {
        for (let i = 0; i < n; i++) {
            const r = rep[i];
            V[i * 3] = before[i * 3] + alpha[r] * u[r * 3];
            V[i * 3 + 1] = before[i * 3 + 1] + alpha[r] * u[r * 3 + 1];
            V[i * 3 + 2] = before[i * 3 + 2] + alpha[r] * u[r * 3 + 2];
        }
        let bad = 0;
        for (let t = 0; t < sign.length; t++) {
            if (dot(rest[t], triNormal(V, idx, t)) > 0) continue;
            bad++;
            for (let k = 0; k < 3; k++) alpha[rep[idx[t * 3 + k]]] *= 0.5;
        }
        if (!bad) break;
        backed = bad;
    }
    return backed;
}

/** Pull back the handful of vertices the fit flings away from their neighbours -
 *  cavity walls inside the mouth, and rays that grazed a rim. One of them is enough
 *  to carry a hood vertex a metre off the head, because the transfer binds to it. */
function despike(V, rest, adj, rep, log) {
    let fixed = 0;
    for (let pass = 0; pass < DESPIKE_PASSES; pass++) {
        const u = new Float64Array(V.length);
        for (let i = 0; i < V.length; i++) u[i] = V[i] - rest[i];
        const hit = [];
        for (let i = 0; i < V.length / 3; i++) {
            if (rep[i] !== i || !adj[i].size) continue;
            const mine = Math.hypot(u[i * 3], u[i * 3 + 1], u[i * 3 + 2]);
            const near = [];
            let ax = 0, ay = 0, az = 0;
            for (const j of adj[i]) {
                near.push(Math.hypot(u[j * 3], u[j * 3 + 1], u[j * 3 + 2]));
                ax += u[j * 3]; ay += u[j * 3 + 1]; az += u[j * 3 + 2];
            }
            near.sort((a, b) => a - b);
            const med = near[near.length >> 1];
            if (mine < DESPIKE_FLOOR || mine < DESPIKE_RATIO * med + DESPIKE_FLOOR) continue;
            const d = near.length;
            hit.push([i, ax / d, ay / d, az / d]);
        }
        if (!hit.length) break;
        fixed += hit.length;
        for (const [i, x, y, z] of hit) {
            V[i * 3] = rest[i * 3] + x;
            V[i * 3 + 1] = rest[i * 3 + 1] + y;
            V[i * 3 + 2] = rest[i * 3 + 2] + z;
        }
    }
    for (let i = 0; i < V.length / 3; i++) {
        const r = rep[i];
        if (r === i) continue;
        V[i * 3] = V[r * 3]; V[i * 3 + 1] = V[r * 3 + 1]; V[i * 3 + 2] = V[r * 3 + 2];
    }
    if (log) console.log(`despike: pulled back ${fixed} runaway vertices`);
    return fixed;
}

function registerBody(V, rest, idx, adj, rep, grid, log) {
    const n = V.length / 3;
    const u = new Float64Array(V.length);
    const target = new Float64Array(V.length);
    const has = new Uint8Array(n);
    const A = new Float64Array(n * 9);
    const P = Float64Array.from(V);
    const next = new Float64Array(V.length);
    const triOf = vertexTriangles(idx, rep);
    let stat = null;
    for (let round = 0; round < REG_ROUNDS; round++) {
        const t = REG_ROUNDS > 1 ? round / (REG_ROUNDS - 1) : 1;
        const stiff = anneal(REG_STIFF, t), reach = anneal(REG_REACH, t);
        const N = recomputeNormals(V, idx);
        let matched = 0, owned = 0, sum = 0, worst = 0, away = 0;
        P.set(V);
        for (let i = 0; i < n; i++) {
            has[i] = 0;
            target[i * 3] = V[i * 3];
            target[i * 3 + 1] = V[i * 3 + 1];
            target[i * 3 + 2] = V[i * 3 + 2];
            if (rep[i] !== i) continue;
            owned++;
            const p = [V[i * 3], V[i * 3 + 1], V[i * 3 + 2]];
            const nv = [N[i * 3], N[i * 3 + 1], N[i * 3 + 2]];
            const hit = alongNormal(grid, p, nv, reach);
            if (hit === null) {away++; continue;}
            const gap = Math.abs(hit);
            sum += gap;
            if (gap > worst) worst = gap;
            has[i] = 1;
            matched++;
            target[i * 3] = p[0] + nv[0] * hit;
            target[i * 3 + 1] = p[1] + nv[1] * hit;
            target[i * 3 + 2] = p[2] + nv[2] * hit;
        }
        // Alternate the local similarity fit with a Jacobi solve of the global system,
        // which is the standard shape-matching split: the data term pulls onto the Orc,
        // the similarity term keeps every one-ring a scaled rotation of its rest shape.
        for (let cycle = 0; cycle < REG_CYCLES; cycle++) {
            for (let i = 0; i < n; i++) if (rep[i] === i && adj[i].size) fitSimilarity(P, rest, adj, i, A);
            for (let sweep = 0; sweep < REG_SWEEPS; sweep++) {
                for (let i = 0; i < n; i++) {
                    if (rep[i] !== i) continue;
                    const deg = adj[i].size;
                    if (!deg) continue;
                    let ax = 0, ay = 0, az = 0;
                    for (const j of adj[i]) {
                        const fx = rest[i * 3] - rest[j * 3];
                        const fy = rest[i * 3 + 1] - rest[j * 3 + 1];
                        const fz = rest[i * 3 + 2] - rest[j * 3 + 2];
                        const a = i * 9, b = j * 9;
                        ax += P[j * 3] + 0.5 * ((A[a] + A[b]) * fx + (A[a + 1] + A[b + 1]) * fy + (A[a + 2] + A[b + 2]) * fz);
                        ay += P[j * 3 + 1] + 0.5 * ((A[a + 3] + A[b + 3]) * fx + (A[a + 4] + A[b + 4]) * fy + (A[a + 5] + A[b + 5]) * fz);
                        az += P[j * 3 + 2] + 0.5 * ((A[a + 6] + A[b + 6]) * fx + (A[a + 7] + A[b + 7]) * fy + (A[a + 8] + A[b + 8]) * fz);
                    }
                    const wd = has[i] ? 1 : 0;
                    const den = wd + stiff;
                    next[i * 3] = (wd * target[i * 3] + stiff * ax / deg) / den;
                    next[i * 3 + 1] = (wd * target[i * 3 + 1] + stiff * ay / deg) / den;
                    next[i * 3 + 2] = (wd * target[i * 3 + 2] + stiff * az / deg) / den;
                }
                for (let i = 0; i < n; i++) {
                    if (rep[i] !== i || !adj[i].size) continue;
                    P[i * 3] = next[i * 3]; P[i * 3 + 1] = next[i * 3 + 1]; P[i * 3 + 2] = next[i * 3 + 2];
                }
            }
        }
        for (let i = 0; i < n; i++) {
            const r = rep[i];
            u[r * 3] = P[r * 3] - V[r * 3];
            u[r * 3 + 1] = P[r * 3 + 1] - V[r * 3 + 1];
            u[r * 3 + 2] = P[r * 3 + 2] - V[r * 3 + 2];
        }
        const folded = applyNoFlip(V, u, idx, rep, triOf);
        stat = {matched, owned, mean: sum / Math.max(owned, 1), worst, folded};
        if (log) {
            console.log(`  register ${String(round).padStart(2)}  stiff ${stiff.toFixed(1).padStart(5)}  ` +
                `reach ${String(Math.round(reach * 1000)).padStart(3)}mm  matched ${matched}/${owned}  ` +
                `unseen ${String(away).padStart(4)}  ` +
                `fold ${String(folded).padStart(4)}  ` +
                `mean ${(stat.mean * 1000).toFixed(1)}mm  worst ${(worst * 1000).toFixed(0)}mm`);
        }
    }
    return stat;
}

/* ------------------------------------------------------------- surface binding
   A garment vertex is stored in the local frame of the rest-body triangles nearest
   to it - barycentric along the two edges plus a normal offset that scales with the
   triangle - and rebuilt from the same triangles after registration. This is the
   MakeHuman clothes binding, and it is exact for a vertex sitting on the skin.
   Blending the K nearest triangles keeps it smooth for cloth that hangs away from
   the body, where a single triangle would pop between neighbours.

   The skin-weight overlap term breaks the remaining ties: it is what keeps an inner
   thigh from binding to the other leg, or a cuff to the hip it hangs beside. */
const BIND_K = 8;
const BIND_SWELL = [0.75, 1.5];
const BIND_FLOOR = 0.15;
const BIND_EPS = 0.01;

/** An orthonormal frame on a triangle: along the first edge, across it, and out.
 *  Also the triangle's scale, as the square root of its area. */
function triBasis(a, b, c) {
    const e1 = sub(b, a), e2 = sub(c, a);
    const cr = cross(e1, e2);
    const area = Math.max(len(cr), 1e-12);
    const n = scl(cr, 1 / area);
    const u1 = unit(e1);
    return [u1, cross(n, u1), n, Math.sqrt(area)];
}

/** Barycentric coordinates of a point already known to lie in the triangle's plane. */
function baryOf(t, q) {
    const v0 = sub(t[1], t[0]), v1 = sub(t[2], t[0]), v2 = sub(q, t[0]);
    const d00 = dot(v0, v0), d01 = dot(v0, v1), d11 = dot(v1, v1);
    const den = d00 * d11 - d01 * d01;
    if (Math.abs(den) < 1e-18) return [1, 0, 0];
    const d20 = dot(v2, v0), d21 = dot(v2, v1);
    const v = (d11 * d20 - d01 * d21) / den;
    const w = (d00 * d21 - d01 * d20) / den;
    return [1 - v - w, v, w];
}

/** Per-vertex skin weights re-indexed into one shared joint numbering. */
function sharedWeights(J, W, jointNames, globalId) {
    const n = J.length / 4;
    const gj = new Int32Array(J.length);
    const gw = new Float32Array(J.length);
    for (let i = 0; i < n; i++) {
        let s = 0;
        for (let c = 0; c < 4; c++) s += W[i * 4 + c];
        for (let c = 0; c < 4; c++) {
            gj[i * 4 + c] = globalId.get(jointNames[J[i * 4 + c]]) ?? -1;
            gw[i * 4 + c] = s > 0 ? W[i * 4 + c] / s : 0;
        }
    }
    return {gj, gw};
}

/** Shared skin weight between two vertices: the sum of min() over common joints. */
function weightOverlap(aj, aw, a, bj, bw, b) {
    let s = 0;
    for (let c = 0; c < 4; c++) {
        const j = aj[a * 4 + c];
        if (j < 0 || aw[a * 4 + c] <= 0) continue;
        for (let d = 0; d < 4; d++) {
            if (bj[b * 4 + d] !== j) continue;
            s += Math.min(aw[a * 4 + c], bw[b * 4 + d]);
            break;
        }
    }
    return s;
}

/** Carry a whole garment across on the rest body's triangles. */
function transferSurface(pos, gj, gw, grid, triVerts, moved, bj, bw, note) {
    const {tris, lo, dim, cells, key} = grid;
    const out = new Float64Array(pos.length);
    let reach = 0;
    const near = [];
    for (let i = 0; i < pos.length / 3; i++) {
        const p = [pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]];
        const base = [0, 1, 2].map(k => Math.min(dim[k] - 1, Math.max(0, Math.floor((p[k] - lo[k]) / CELL))));
        near.length = 0;
        for (let ring = 0; ring < 8; ring++) {
            for (let x = base[0] - ring; x <= base[0] + ring; x++) {
                if (x < 0 || x >= dim[0]) continue;
                for (let y = base[1] - ring; y <= base[1] + ring; y++) {
                    if (y < 0 || y >= dim[1]) continue;
                    for (let z = base[2] - ring; z <= base[2] + ring; z++) {
                        if (z < 0 || z >= dim[2]) continue;
                        if (ring && Math.max(Math.abs(x - base[0]), Math.abs(y - base[1]), Math.abs(z - base[2])) !== ring) continue;
                        const list = cells.get(key(x, y, z));
                        if (!list) continue;
                        for (const n of list) near.push([n, len(sub(p, closestOnTri(p, tris[n])))]);
                    }
                }
            }
            // One ring past the first hits, so a vertex near a cell wall is not biased.
            if (near.length >= BIND_K && ring >= 1) break;
        }
        if (!near.length) {out[i * 3] = p[0]; out[i * 3 + 1] = p[1]; out[i * 3 + 2] = p[2]; continue;}
        near.sort((a, b) => a[1] - b[1]);
        if (near[0][1] > reach) reach = near[0][1];
        let wsum = 0, qx = 0, qy = 0, qz = 0;
        for (let k = 0; k < Math.min(BIND_K, near.length); k++) {
            const [n, d] = near[k];
            const t = tris[n];
            const ia = triVerts[n * 3], ib = triVerts[n * 3 + 1], ic = triVerts[n * 3 + 2];
            let overlap = 0;
            for (const v of [ia, ib, ic]) overlap += weightOverlap(gj, gw, i, bj, bw, v);
            const w = (BIND_FLOOR + (1 - BIND_FLOOR) * overlap / 3) / (d * d + BIND_EPS * BIND_EPS);
            // The anchor is the closest point *on* the triangle, never an extrapolation
            // along its edges: a cowl standing 100mm off the scalp would otherwise be
            // thrown metres away by a scalp triangle that tripled in size.
            const foot = closestOnTri(p, t);
            const bc = baryOf(t, foot);
            const rf = triBasis(t[0], t[1], t[2]);
            const off = sub(p, foot);
            const local = [dot(off, rf[0]), dot(off, rf[1]), dot(off, rf[2])];
            const at = v => [moved[v * 3], moved[v * 3 + 1], moved[v * 3 + 2]];
            const a = at(ia), mb = at(ib), mc = at(ic);
            const f = triBasis(a, mb, mc);
            // Cloth stands off thicker skin a little further, never many times further,
            // so the standoff follows the patch scale only within a narrow band.
            const swell = Math.min(BIND_SWELL[1], Math.max(BIND_SWELL[0], f[3] / Math.max(rf[3], 1e-9)));
            const seat = add(scl(a, bc[0]), add(scl(mb, bc[1]), scl(mc, bc[2])));
            const q = add(seat, scl(add(scl(f[0], local[0]), add(scl(f[1], local[1]), scl(f[2], local[2]))), swell));
            wsum += w; qx += q[0] * w; qy += q[1] * w; qz += q[2] * w;
            if (note) note(i, {d, w, local, q, tri: n,
                restArea: rf[3] * rf[3],
                movedArea: f[3] * f[3],
                mid: scl(add(a, add(mb, mc)), 1 / 3),
                normal: f[2]});
        }
        if (!wsum) {out[i * 3] = p[0]; out[i * 3 + 1] = p[1]; out[i * 3 + 2] = p[2]; continue;}
        out[i * 3] = qx / wsum; out[i * 3 + 1] = qy / wsum; out[i * 3 + 2] = qz / wsum;
    }
    return {pos: out, reach};
}

/** Penetration depth into the Orc body over a vertex array: how far short of the
 *  clearance each vertex falls, as a distribution rather than a single worst case. */
/** Inside or outside, by counting crossings along three fixed directions and taking
 *  the majority. The nearest face's normal answers this wrongly in every crease,
 *  which is enough to make a coverage report flatter a bad fit. */
const PARITY_DIRS = [[0.9412, 0.2354, 0.2412], [0.2354, 0.9412, -0.2412], [-0.2412, 0.2354, 0.9412]];
function insideBody(grid, p) {
    let vote = 0;
    for (const d of PARITY_DIRS) if (crossings(grid, p, d) % 2 === 1) vote++;
    return vote >= 2;
}

function coverage(pos, grid, clearance) {
    const d = [];
    let inside = 0;
    for (let i = 0; i < pos.length; i += 3) {
        const p = [pos[i], pos[i + 1], pos[i + 2]];
        const hit = signedDistance(grid, p);
        if (!isFinite(hit.d)) continue;
        const gap = insideBody(grid, p) ? -Math.abs(hit.d) : Math.abs(hit.d);
        if (gap < 0) inside++;
        d.push(Math.max(0, clearance - gap));
    }
    d.sort((a, b) => a - b);
    const q = f => d.length ? d[Math.min(d.length - 1, Math.floor(d.length * f))] : 0;
    return {inside, n: d.length, p50: q(0.5), p90: q(0.9), p99: q(0.99), max: q(1)};
}

const mm = v => (v * 1000).toFixed(0) + 'mm';

/* -------------------------------------------------------------------------- run */
const argv = process.argv.slice(2);
const wanted = new Set(argv.filter(a => a.startsWith('--item=')).map(a => a.split('=')[1]));
const verbose = argv.includes('--report');
const debugBody = argv.includes('--debug-body');
const explain = argv.includes('--explain');

await fs.mkdir(OUT, {recursive: true});
console.log('reading rigs');
const orcDoc = await io.read(ORC);
const humanDoc = await io.read(HUMAN);
const orcRig = readRig(orcDoc.getRoot());
const humanRig = readRig(humanDoc.getRoot());
const missing = humanRig.joints.map(j => j.getName()).filter(n => !orcRig.byName.has(n));
if (missing.length) throw Error('Orc rig is missing Human joints: ' + missing.join(','));
const globalId = new Map(orcRig.joints.map((j, i) => [j.getName(), i]));
console.log(`rigs agree on ${humanRig.joints.length} joints`);

const orcGrid = buildGrid(readBody(orcDoc.getRoot(), n => n === TARGET_BODY));
const humanGrid = buildGrid(readBody(humanDoc.getRoot(), n => n.startsWith('Body')));
console.log(`bodies: Human ${humanGrid.tris.length} triangles, Orc ${orcGrid.tris.length}`);

/* 1. prealign the Human body onto the Orc rest skeleton */
const body = readHumanBody(humanDoc.getRoot());
const bodyJoints = body.skin.listJoints();
const bodyNames = bodyJoints.map(j => j.getName());
const bodyM = bakeMatrices(bodyJoints, body.skin.getInverseBindMatrices().getArray(), orcRig);
const rest = skinPoints(body.pos, body.J, body.W, bodyM);
const {rep, adj} = buildAdjacency(rest, body.idx);
const welded = rep.reduce((n, r, i) => n + (r === i ? 1 : 0), 0);
console.log(`Human body: ${rest.length / 3} vertices (${welded} welded), ${body.idx.length / 3} triangles`);
console.log(`  bind pose ${JSON.stringify(bounds(body.pos))}`);
console.log(`  prealigned ${JSON.stringify(bounds(rest))}`);
console.log(`  Orc body   ${JSON.stringify(bounds(orcGrid.tris.flat().flat()))}`);

/* 2. register the prealigned Human body onto the Orc body surface */
console.time('register');
const moved = Float64Array.from(rest);
const reg = registerBody(moved, rest, body.idx, adj, rep, orcGrid, verbose);
despike(moved, rest, adj, rep, verbose);
console.timeEnd('register');
console.log(`registration: matched ${reg.matched}/${reg.owned}, mean gap ${(reg.mean * 1000).toFixed(1)}mm, ` +
    `worst ${(reg.worst * 1000).toFixed(0)}mm`);

/* 3. the field is what the garments ride on */
const field = new Float64Array(rest.length);
let fieldMax = 0;
for (let i = 0; i < field.length; i += 3) {
    field[i] = moved[i] - rest[i];
    field[i + 1] = moved[i + 1] - rest[i + 1];
    field[i + 2] = moved[i + 2] - rest[i + 2];
    const m = Math.hypot(field[i], field[i + 1], field[i + 2]);
    if (m > fieldMax) fieldMax = m;
}
console.log(`field: up to ${(fieldMax * 1000).toFixed(0)}mm of growth`);
{
    // A registration that lands on the surface but folds on the way is useless as a
    // binding target, so check the triangles survived rather than just the distance.
    const ratios = [];
    let flipped = 0;
    for (let n = 0; n < body.idx.length / 3; n++) {
        const get = (A, k) => {const v = body.idx[n * 3 + k]; return [A[v * 3], A[v * 3 + 1], A[v * 3 + 2]];};
        const nr = cross(sub(get(rest, 1), get(rest, 0)), sub(get(rest, 2), get(rest, 0)));
        const nm = cross(sub(get(moved, 1), get(moved, 0)), sub(get(moved, 2), get(moved, 0)));
        const ar = len(nr), am = len(nm);
        if (ar < 1e-12) continue;
        ratios.push(am / ar);
        if (dot(nr, nm) < 0) flipped++;
    }
    // Against the Orc surface, not the rest pose: a patch may legitimately turn
    // through 90 degrees, but it must never end up facing into the body.
    let against = 0, checked = 0, was = 0;
    for (let n = 0; n < body.idx.length / 3; n += 3) {
        const atRest = k => {const v = body.idx[n * 3 + k]; return [rest[v * 3], rest[v * 3 + 1], rest[v * 3 + 2]];};
        const r0 = atRest(0);
        const nr = cross(sub(atRest(1), r0), sub(atRest(2), r0));
        const rh = signedDistance(orcGrid, scl(add(r0, add(atRest(1), atRest(2))), 1 / 3));
        if (len(nr) > 1e-12 && isFinite(rh.d) && dot(unit(nr), rh.normal) < 0) was++;
        const at = k => {const v = body.idx[n * 3 + k]; return [moved[v * 3], moved[v * 3 + 1], moved[v * 3 + 2]];};
        const a = at(0), b = at(1), c = at(2);
        const nm = cross(sub(b, a), sub(c, a));
        if (len(nm) < 1e-12) continue;
        const hit = signedDistance(orcGrid, scl(add(a, add(b, c)), 1 / 3));
        if (!isFinite(hit.d)) continue;
        checked++;
        if (dot(unit(nm), hit.normal) < 0) against++;
    }
    console.log(`orientation vs Orc: prealigned ${was}, registered ${against}, of ${checked} sampled triangles`);
    ratios.sort((a, b) => a - b);
    const q = f => ratios[Math.min(ratios.length - 1, Math.floor(ratios.length * f))];
    console.log(`registered triangles: area x${q(0.01).toFixed(2)}/${q(0.5).toFixed(2)}/${q(0.99).toFixed(2)} ` +
        `(p1/p50/p99), ${flipped} flipped`);
}
const restGrid = buildGrid(Array.from({length: body.idx.length / 3}, (_, n) =>
    [0, 1, 2].map(k => {
        const v = body.idx[n * 3 + k];
        return [rest[v * 3], rest[v * 3 + 1], rest[v * 3 + 2]];
    })));
/* Garments ride a low-passed copy of the fit. The print sculpt models the Orc's toes
   and knuckles individually; a boot that follows those grows toes of its own, so the
   cloth follows the limb and the seal below handles whatever still pokes out. How much
   to low-pass is the garment's own business: a boot wants the toes gone, a glove has
   to keep the fingers it is supposed to have. */
const carriers = new Map();
function carrierFor(passes) {
    const had = carriers.get(passes);
    if (had) return had;
    const carrier = Float64Array.from(moved);
    const u = new Float64Array(carrier.length);
    for (let i = 0; i < u.length; i++) u[i] = carrier[i] - rest[i];
    const next = new Float64Array(u.length);
    for (let pass = 0; pass < passes; pass++) {
        for (let i = 0; i < u.length / 3; i++) {
            if (rep[i] !== i || !adj[i].size) continue;
            let x = 0, y = 0, z = 0;
            for (const j of adj[i]) {x += u[j * 3]; y += u[j * 3 + 1]; z += u[j * 3 + 2];}
            const deg = adj[i].size;
            next[i * 3] = 0.4 * u[i * 3] + 0.6 * x / deg;
            next[i * 3 + 1] = 0.4 * u[i * 3 + 1] + 0.6 * y / deg;
            next[i * 3 + 2] = 0.4 * u[i * 3 + 2] + 0.6 * z / deg;
        }
        for (let i = 0; i < u.length / 3; i++) {
            if (rep[i] !== i || !adj[i].size) continue;
            u[i * 3] = next[i * 3]; u[i * 3 + 1] = next[i * 3 + 1]; u[i * 3 + 2] = next[i * 3 + 2];
        }
    }
    for (let i = 0; i < carrier.length / 3; i++) {
        const r = rep[i];
        for (let k = 0; k < 3; k++) carrier[i * 3 + k] = rest[i * 3 + k] + u[r * 3 + k];
    }
    carriers.set(passes, carrier);
    return carrier;
}

const movedGrid = buildGrid(Array.from({length: body.idx.length / 3}, (_, n) =>
    [0, 1, 2].map(k => {
        const v = body.idx[n * 3 + k];
        return [moved[v * 3], moved[v * 3 + 1], moved[v * 3 + 2]];
    })));
const orcPoints = readPoints(orcDoc.getRoot(), n => n === TARGET_BODY);

let orcRegions = [];
const orcByRegion = new Map();
/* Carry the Human geoset cut onto the Orc. Every Orc vertex takes the geoset of the
   registered Human triangle it lands on, so the skin hidden under a garment is the
   skin that garment covers, at the Orc's own proportions. */
{
    const orcBody = orcDoc.getRoot().listNodes().find(n => n.getMesh() && n.getName() === TARGET_BODY);
    const prim = orcBody.getMesh().listPrimitives()[0];
    const P = prim.getAttribute('POSITION').getArray();
    const M = Array.from(orcBody.getWorldMatrix());
    const names = [...new Set(body.region)];
    orcRegions = names;
    const labels = new Int16Array(P.length / 3).fill(-1);
    const tally = Object.fromEntries(names.map(n => [n, 0]));
    for (let i = 0; i < labels.length; i++) {
        const near = signedDistance(movedGrid, xform(M, [P[i * 3], P[i * 3 + 1], P[i * 3 + 2]]));
        if (!isFinite(near.d) || near.tri < 0) continue;
        const name = body.region[near.tri];
        labels[i] = names.indexOf(name);
        tally[name]++;
        let bag = orcByRegion.get(name);
        if (!bag) orcByRegion.set(name, bag = []);
        bag.push({p: xform(M, [P[i * 3], P[i * 3 + 1], P[i * 3 + 2]]), tri: near.tri});
    }
    await fs.writeFile(`${OUT}/coverage.json`, JSON.stringify({
        source: 'Human geoset labels carried onto the Orc by the body registration',
        regions: names, labels: Array.from(labels),
    }));
    console.log('Orc geoset labels:', JSON.stringify(tally));
}
const bodyShared = sharedWeights(body.J, body.W, bodyNames, globalId);

/** The Orc skin a garment has to keep covered: whatever the same garment covers on
 *  the Human, carried across by the registration. The Human catalogue is the only
 *  statement of intent about which skin is meant to be hidden, so it is the spec. */
/** The skin this garment is responsible for hiding, at the Orc's own proportions.
 *  The catalogue names the geosets each item covers and every Orc vertex carries the
 *  geoset of the Human surface it registered onto, which together name the skin the
 *  game hides when the item is worn. That set is then cut back to what the Human
 *  garment actually encloses: a sleeveless tunic hides the shoulder geoset without
 *  covering the shoulder, and asking the Orc's copy to cover it stretches the armhole
 *  out over the arm. */
function coverTargets(id, rests) {
    const want = EQUIPMENT_ITEMS[id]?.coverage || [];
    if (!want.length) return [];
    const shells = rests.map(({pos, idx}) => buildGrid(Array.from({length: idx.length / 3}, (_, n) =>
        [0, 1, 2].map(k => {
            const v = idx[n * 3 + k];
            return [pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]];
        }))));
    const covered = new Uint8Array(body.pos.length / 3);
    for (let i = 0; i < covered.length; i++) {
        const q = [body.pos[i * 3], body.pos[i * 3 + 1], body.pos[i * 3 + 2]];
        covered[i] = shells.some(sh => insideBody(sh, q)) ? 1 : 0;
    }
    const out = [];
    for (const name of want) {
        // A hood covers hair, which the Orc carries as its own print mesh rather than a
        // geoset of the registered Human body, so there is nothing here to seal against.
        if (!orcRegions.includes(name)) continue;
        for (const {p, tri} of orcByRegion.get(name) || []) {
            const a = body.idx[tri * 3], b = body.idx[tri * 3 + 1], c = body.idx[tri * 3 + 2];
            if (covered[a] && covered[b] && covered[c]) out.push(p);
        }
    }
    return out;
}

if (debugBody) {
    const dbg = await io.read(HUMAN);
    const dbgBody = readHumanBody(dbg.getRoot());
    for (const node of dbg.getRoot().listNodes()) {
        const mesh = node.getMesh();
        if (!mesh || !node.getName().startsWith('Body')) continue;
        for (const prim of mesh.listPrimitives()) {
            prim.getAttribute('POSITION').setArray(Float32Array.from(moved));
            const nrm = prim.getAttribute('NORMAL');
            if (nrm) nrm.setArray(recomputeNormals(moved, dbgBody.idx));
        }
    }
    await fs.writeFile(`${OUT}/_registered-body.glb`, await io.writeBinary(dbg));
    console.log(`wrote ${OUT}/_registered-body.glb`);
}

const report = [];
for (const id of ITEMS) {
    if (wanted.size && !wanted.has(id)) continue;
    const doc = await io.read(`${HUMAN_DIR}/${id}.glb`);
    const root = doc.getRoot();
    const skin = root.listSkins()[0];
    const jointNames = skin.listJoints().map(j => j.getName());
    const M = bakeMatrices(skin.listJoints(), skin.getInverseBindMatrices().getArray(), orcRig);
    const clearance = CLEARANCE[id];
    const meshes = [];
    // Sibling nodes in the catalogue share one POSITION accessor, so the rest pose has
    // to be read before anything is written back, and each accessor fitted once.
    const restOf = new Map(), fittedOf = new Map();
    const jobs = [], aliases = [];
    for (const node of root.listNodes()) {
        const mesh = node.getMesh();
        if (!mesh || node.getSkin() !== skin) continue;
        for (const prim of mesh.listPrimitives()) {
            const acc = prim.getAttribute('POSITION');
            if (!restOf.has(acc)) restOf.set(acc, Float64Array.from(acc.getArray()));
        }
    }
    for (const node of root.listNodes()) {
        const mesh = node.getMesh();
        if (!mesh || node.getSkin() !== skin) continue;
        // Bind-space vertices are what the skin matrices expect; a non-identity
        // node transform would be applied twice, so refuse it rather than guess.
        const W = Array.from(node.getWorldMatrix());
        if (W.some((v, i) => Math.abs(v - (i % 5 === 0 ? 1 : 0)) > 1e-5)) {
            throw Error(`${id}: ${node.getName()} has a non-identity bind transform`);
        }
        for (const prim of mesh.listPrimitives()) {
            const posAcc = prim.getAttribute('POSITION');
            const idx = prim.getIndices().getArray();
            const before = restOf.get(posAcc);
            if (fittedOf.has(posAcc)) {
                aliases.push({node, prim, posAcc, idx});
                continue;
            }
            fittedOf.set(posAcc, null);
            const gJ = prim.getAttribute('JOINTS_0').getArray();
            const gW = prim.getAttribute('WEIGHTS_0').getArray();
            const bb = bounds(before);
            // The Human catalogue already lets skin through where a geoset hides it,
            // so the target is not zero penetration - it is the Human's own figure.
            const base = coverage(before, humanGrid, clearance);
            const shared = sharedWeights(gJ, gW, jointNames, globalId);
            const aligned = skinPoints(before, gJ, gW, M);
            const notes = explain ? new Map() : null;
            const carried = transferSurface(aligned, shared.gj, shared.gw, restGrid, body.idx,
                carrierFor(FIELD_SMOOTH[id] ?? FIELD_DEFAULT), bodyShared.gj, bodyShared.gw, notes && ((i, r) => {
                    let l = notes.get(i); if (!l) notes.set(i, l = []); l.push(r);
                }));
            const pos = carried.pos;
            const cell = FFD_CELL[id] ?? FFD_DEFAULT;
            const rough = relaxTransfer(pos, aligned, idx);
            const weld = buildAdjacency(aligned, idx);
            const stage = t => mm(roughOf(pos, aligned, weld.rep, weld.adj)[t]);
            const trace = [`relax ${stage('p99')}/${stage('max')}`];
            const lifted = groundGuard(pos);
            trace.push(`ground ${stage('p99')}/${stage('max')}`);
            const carriedFit = coverage(pos, orcGrid, clearance);
            if (explain) {
                const rank = [];
                for (let i = 0; i < pos.length / 3; i++) {
                    const hit = signedDistance(orcGrid, [pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]]);
                    if (isFinite(hit.d)) rank.push([i, clearance - hit.d]);
                }
                rank.sort((a, b) => b[1] - a[1]);
                for (const [i, def] of rank.slice(0, 4)) {
                    console.log(`  worst v${i} deficit ${mm(def)} human ${[0,1,2].map(c => aligned[i*3+c].toFixed(3))} -> orc ${[0,1,2].map(c => pos[i*3+c].toFixed(3))}`);
                    for (const r of notes.get(i) || []) {
                        const h = signedDistance(orcGrid, r.mid);
                        console.log(`     tri ${r.tri} d ${mm(r.d)} local ${r.local.map(v => v.toFixed(2))} ` +
                            `area ${r.restArea.toExponential(1)}->${r.movedArea.toExponential(1)} ` +
                            `mid ${mm(h.d)} from Orc, facing ${dot(r.normal, h.normal).toFixed(2)} q ${r.q.map(v => v.toFixed(3))}`);
                    }
                }
            }
            const push = NO_PUSH ? {rounds: 0} : clearancePush(pos, idx, orcGrid, clearance, 0.030, cell);
            trace.push(`clear ${stage('p99')}/${stage('max')}`);
            jobs.push({node, prim, posAcc, idx, pos, before, aligned, weld, cell, trace, stage,
                rough, carried, carriedFit, base, bb, lifted, push});
        }
    }
    // The seal is the item's job, not one mesh's: a target belongs to whichever of the
    // item's surfaces is nearest it, so a pendant lying on a vestment is never asked to
    // cover the chest behind the vestment.
    const seal = NO_PUSH ? {before: 0, after: 0, targets: 0}
        : sealItem(jobs, coverTargets(id, jobs.map(j => ({pos: j.before, idx: j.idx}))), clearance * 0.5);
    if (verbose) {
        console.log(`  ${id} seal:    ${seal.before} -> ${seal.after} of ${seal.targets} ` +
            'covered Orc points left uncovered');
    }
    for (const job of jobs) {
        const {node, prim, posAcc, idx, pos, aligned, weld, trace, stage, rough, carried,
            carriedFit, base, bb, lifted, push} = job;
        if (FINISH_PASSES) {
            const u = new Float64Array(pos.length);
            for (let i = 0; i < pos.length; i++) u[i] = pos[i] - aligned[i];
            let cur = u;
            for (let pass = 0; pass < FINISH_PASSES; pass++) {
                const next = new Float64Array(cur);
                for (let i = 0; i < pos.length / 3; i++) {
                    if (weld.rep[i] !== i || !weld.adj[i].size) continue;
                    let x = 0, y = 0, z = 0;
                    for (const j of weld.adj[i]) {x += cur[j * 3]; y += cur[j * 3 + 1]; z += cur[j * 3 + 2];}
                    const deg = weld.adj[i].size;
                    next[i * 3] = 0.5 * cur[i * 3] + 0.5 * x / deg;
                    next[i * 3 + 1] = 0.5 * cur[i * 3 + 1] + 0.5 * y / deg;
                    next[i * 3 + 2] = 0.5 * cur[i * 3 + 2] + 0.5 * z / deg;
                }
                cur = next;
            }
            for (let i = 0; i < pos.length / 3; i++) {
                const r = weld.rep[i];
                for (let k = 0; k < 3; k++) pos[i * 3 + k] = aligned[i * 3 + k] + cur[r * 3 + k];
            }
        }
        trace.push(`seal ${stage('p99')}/${stage('max')}`);
        const finalFit = coverage(pos, orcGrid, clearance);
        const endRough = roughOf(pos, aligned, weld.rep, weld.adj);
        if (verbose) {
            console.log(`  ${node.getName()} trace:   ${trace.join('  ')}`);
            console.log(`  ${node.getName()} human:   inside ${base.inside}/${base.n} ` +
                `p50 ${mm(base.p50)} p90 ${mm(base.p90)} p99 ${mm(base.p99)} max ${mm(base.max)}`);
            console.log(`  ${node.getName()} relax:   roughness p50 ${mm(rough.before.p50)} -> ${mm(rough.after.p50)} ` +
                `p99 ${mm(rough.before.p99)} -> ${mm(rough.after.p99)} max ${mm(rough.before.max)} -> ${mm(rough.after.max)}`);
            console.log(`  ${node.getName()} carried: inside ${carriedFit.inside}/${carriedFit.n} ` +
                `p50 ${mm(carriedFit.p50)} p90 ${mm(carriedFit.p90)} p99 ${mm(carriedFit.p99)} max ${mm(carriedFit.max)}`);
            console.log(`  ${node.getName()} pushed:  inside ${finalFit.inside}/${finalFit.n} ` +
                `p50 ${mm(finalFit.p50)} p90 ${mm(finalFit.p90)} p99 ${mm(finalFit.p99)} max ${mm(finalFit.max)} ` +
                `| roughness p50 ${mm(endRough.p50)} p99 ${mm(endRough.p99)} max ${mm(endRough.max)}`);
        }
        posAcc.setArray(Float32Array.from(pos));
        const nrm = prim.getAttribute('NORMAL');
        if (nrm) nrm.setArray(recomputeNormals(pos, idx));
        const record = {
            name: node.getName(),
            verts: pos.length / 3,
            humanBounds: bb,
            orc: bounds(pos),
            bind: +carried.reach.toFixed(4),
            pushed: push.touched,
            deepest: +push.deepest.toFixed(4),
            lifted: +lifted.toFixed(4),
            human: base,
            carried: carriedFit,
            fit: finalFit,
            seal,
        };
        fittedOf.set(posAcc, {pos, record});
        meshes.push(record);
    }
    for (const a2 of aliases) {
        const seen = fittedOf.get(a2.posAcc);
        a2.posAcc.setArray(Float32Array.from(seen.pos));
        const n0 = a2.prim.getAttribute('NORMAL');
        if (n0) n0.setArray(recomputeNormals(seen.pos, a2.idx));
        meshes.push({...seen.record, name: a2.node.getName()});
    }
    if (!meshes.length) throw Error(`${id}: nothing skinned to the catalogue skin`);
    const bin = await io.writeBinary(doc);
    await fs.writeFile(`${OUT}/${id}.glb`, bin);
    report.push({id, bytes: bin.byteLength, clearance, meshes});
    for (const m of meshes) {
        console.log(`${id.padEnd(19)} ${m.name.padEnd(24)} v${String(m.verts).padStart(5)}  ` +
            `human Y ${m.humanBounds[0][1].toFixed(2)}..${m.humanBounds[1][1].toFixed(2)}  ` +
            `orc Y ${m.orc[0][1].toFixed(2)}..${m.orc[1][1].toFixed(2)}  ` +
            `X ${m.orc[1][0].toFixed(2)}  bind ${(m.bind * 1000).toFixed(0)}mm  ` +
            `push ${m.pushed} max ${(m.deepest * 1000).toFixed(0)}mm` +
            `${m.lifted ? `  ground +${(m.lifted * 1000).toFixed(0)}mm` : ''}`);
    }
}
await fs.writeFile(`${OUT}/fit-report.json`, JSON.stringify({
    method: 'non-rigid body registration; garments carried on the displacement field',
    registration: {
        rounds: REG_ROUNDS, sweeps: REG_SWEEPS, stiffness: REG_STIFF, reach: REG_REACH,
        matched: reg.matched, vertices: reg.owned,
        meanGap: +reg.mean.toFixed(4), worstGap: +reg.worst.toFixed(4),
        fieldMax: +fieldMax.toFixed(4),
    },
    items: report,
}, null, 2) + '\n');
console.log(`\nwrote ${report.length} garments to ${OUT}`);
