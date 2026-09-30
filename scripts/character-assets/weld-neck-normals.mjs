/**
 * Weld the shading normals across the M006 head/body cut.
 *
 * Five colour corrections were tried on this seam and each left a thin straight line under
 * the jaw. The reason is not colour: at the y=1.5 m rim the head's normals and the body's
 * normals disagree by a **median of 48 degrees**, p90 103, max 167. Two surfaces that meet
 * with normals that far apart shade differently no matter what their albedo is, and a
 * lighting step along a straight mesh boundary is exactly a thin straight line.
 *
 * That was measurable from the start. It went unmeasured while the albedo was fitted five
 * times, which is the same mistake as measuring the atlas instead of the render.
 *
 * The fix is the standard one: both sides adopt one shared normal at the rim. Each head rim
 * vertex takes the inverse-distance blend of the nearest body rim normals and each body rim
 * vertex the blend of the nearest head rim normals, then both are averaged with their own and
 * renormalised, so the two surfaces converge on the same direction and the lighting is
 * continuous across the join.
 *
 * Positions, UVs, joints, weights, indices and the morph targets are untouched — only
 * NORMAL changes, and morph NORMAL deltas are relative, so the shape family still reads
 * correctly. glTF normals are per-vertex and unit length:
 * https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#meshes-overview
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import {NodeIO, VertexLayout} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';

const IN = process.env.ASHEN_WELD_IN || '.cache/character-mmo/m006/human-old-bald-atlas-matched.glb';
const OUT = process.env.ASHEN_WELD_OUT || '.cache/character-mmo/m006/human-old-bald-welded.glb';
const REPORT = 'docs/baselines/character-mmo/m006/neck-normal-weld.json';
const CUT_Y = 1.5;
const RIM_EPS = 0.002;
const NEIGHBOURS = 3;
const ITERATIONS = Number(process.env.ASHEN_WELD_ITERATIONS ?? 12);

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).setVertexLayout(VertexLayout.SEPARATE);
const doc = await io.read(IN);
const root = doc.getRoot();
const prim = name => {
    const mesh = root.listMeshes().find(m => m.getName() === name);
    if (!mesh) throw Error(`Missing mesh ${name}`);
    return mesh.listPrimitives()[0];
};
const headPrim = prim('OldBaldHeadV2Diagnostic');
const bodyPrim = prim('HumanV1Body');

const side = p => {
    const pos = p.getAttribute('POSITION').getArray();
    const nrmAccessor = p.getAttribute('NORMAL');
    const nrm = Float32Array.from(nrmAccessor.getArray());
    const rim = [];
    for (let i = 0; i < pos.length / 3; i++) if (Math.abs(pos[i * 3 + 1] - CUT_Y) <= RIM_EPS) rim.push(i);
    return {pos, nrm, nrmAccessor, rim};
};
const head = side(headPrim);
const body = side(bodyPrim);
if (!head.rim.length || !body.rim.length) throw Error('No rim vertices at the cut');

const angleBetween = (a, ai, b, bi) => {
    const d = a[ai * 3] * b[bi * 3] + a[ai * 3 + 1] * b[bi * 3 + 1] + a[ai * 3 + 2] * b[bi * 3 + 2];
    return Math.acos(Math.max(-1, Math.min(1, d))) * 180 / Math.PI;
};
/** Inverse-distance blend of the nearest rim normals on the other surface. */
function blendFrom(src, srcRim, pos, i) {
    const near = srcRim
        .map(j => ({j, d: Math.hypot(pos[i * 3] - src.pos[j * 3], pos[i * 3 + 1] - src.pos[j * 3 + 1], pos[i * 3 + 2] - src.pos[j * 3 + 2])}))
        .sort((a, b) => a.d - b.d).slice(0, NEIGHBOURS);
    let x = 0, y = 0, z = 0, w = 0;
    for (const {j, d} of near) {
        const k = 1 / Math.max(1e-4, d);
        x += src.nrm[j * 3] * k; y += src.nrm[j * 3 + 1] * k; z += src.nrm[j * 3 + 2] * k; w += k;
    }
    return [x / w, y / w, z / w];
}
const unit = v => {
    const l = Math.hypot(v[0], v[1], v[2]) || 1;
    return [v[0] / l, v[1] / l, v[2] / l];
};

const before = [];
for (const i of head.rim) {
    const near = body.rim
        .map(j => ({j, d: Math.hypot(head.pos[i * 3] - body.pos[j * 3], head.pos[i * 3 + 1] - body.pos[j * 3 + 1], head.pos[i * 3 + 2] - body.pos[j * 3 + 2])}))
        .sort((a, b) => a.d - b.d)[0];
    before.push(angleBetween(head.nrm, i, body.nrm, near.j));
}

// Both surfaces move half way to the other, so neither is dragged to the other's shape.
//
// Iterated, because the two rims are not the same density -- 89 head vertices against 41 on
// the body -- so one pass of an inverse-distance blend does not converge: each side is
// averaging a differently-weighted view of the other. Repeating drives both to one shared
// field along the rim.
for (let pass = 0; pass < ITERATIONS; pass++) {
    const headTargets = head.rim.map(i => unit(blendFrom(body, body.rim, head.pos, i)));
    const bodyTargets = body.rim.map(i => unit(blendFrom(head, head.rim, body.pos, i)));
    head.rim.forEach((i, k) => {
        const t = headTargets[k];
        const v = unit([head.nrm[i * 3] + t[0], head.nrm[i * 3 + 1] + t[1], head.nrm[i * 3 + 2] + t[2]]);
        head.nrm[i * 3] = v[0]; head.nrm[i * 3 + 1] = v[1]; head.nrm[i * 3 + 2] = v[2];
    });
    body.rim.forEach((i, k) => {
        const t = bodyTargets[k];
        const v = unit([body.nrm[i * 3] + t[0], body.nrm[i * 3 + 1] + t[1], body.nrm[i * 3 + 2] + t[2]]);
        body.nrm[i * 3] = v[0]; body.nrm[i * 3 + 1] = v[1]; body.nrm[i * 3 + 2] = v[2];
    });
}

const after = [];
for (const i of head.rim) {
    const near = body.rim
        .map(j => ({j, d: Math.hypot(head.pos[i * 3] - body.pos[j * 3], head.pos[i * 3 + 1] - body.pos[j * 3 + 1], head.pos[i * 3 + 2] - body.pos[j * 3 + 2])}))
        .sort((a, b) => a.d - b.d)[0];
    after.push(angleBetween(head.nrm, i, body.nrm, near.j));
}

head.nrmAccessor.setArray(head.nrm);
body.nrmAccessor.setArray(body.nrm);
await fs.mkdir(path.dirname(OUT), {recursive: true});
const bytes = await io.writeBinary(doc);
await fs.writeFile(OUT, bytes);

const stats = list => {
    const s = [...list].sort((a, b) => a - b);
    const q = f => s[Math.min(s.length - 1, Math.floor(s.length * f))];
    return {p50: Number(q(.5).toFixed(1)), p90: Number(q(.9).toFixed(1)), max: Number(s.at(-1).toFixed(1))};
};
const report = {
    generatedBy: 'scripts/character-assets/weld-neck-normals.mjs',
    input: IN, output: OUT, bytes: bytes.byteLength,
    cutY: CUT_Y, rimEpsM: RIM_EPS, neighbours: NEIGHBOURS, iterations: ITERATIONS,
    headRimVertices: head.rim.length, bodyRimVertices: body.rim.length,
    normalAngleDegrees: {before: stats(before), after: stats(after)},
    changed: 'NORMAL only; positions, UVs, joints, weights, indices and morph targets untouched',
};
await fs.mkdir(path.dirname(REPORT), {recursive: true});
await fs.writeFile(REPORT, JSON.stringify(report, null, 1) + '\n');
console.log(`rim: head ${head.rim.length}, body ${body.rim.length}`);
console.log(`normal angle across the cut, before  p50 ${report.normalAngleDegrees.before.p50} p90 ${report.normalAngleDegrees.before.p90} max ${report.normalAngleDegrees.before.max}`);
console.log(`                              after   p50 ${report.normalAngleDegrees.after.p50} p90 ${report.normalAngleDegrees.after.p90} max ${report.normalAngleDegrees.after.max}`);
console.log(`wrote ${OUT} (${bytes.byteLength} bytes)`);
