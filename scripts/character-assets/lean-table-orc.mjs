/** Hips->Neck lean comparison: base.glb vs orc-source-v1.glb at matched
 * clip/times (mirrors the Human bind-v2 evidence table). Rotations are
 * asserted identical by test-source-motion; any lean delta is rest-shape
 * error (e.g. the MH posterior-Hips pitfall). Offline; exit non-zero if any
 * matched delta exceeds 1 degree. */
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {mat4, vec3, quat} from 'gl-matrix';

const TIMES = [
    ['Idle_Loop', 0.5], ['Walk_Loop', 0.333333], ['Sprint_Loop', 0.166667],
    ['Sprint_Loop', 0.333333], ['Jump_Start', 0.15], ['Jump_Loop', 0.15],
    ['Jump_Land', 0.15], ['Spell_Simple_Shoot', 0.3],
];
const CHAIN = ['mixamorig:Hips', 'mixamorig:Spine', 'mixamorig:Spine1', 'mixamorig:Spine2', 'mixamorig:Neck'];

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const load = async f => {
    const doc = await io.read(f), root = doc.getRoot();
    const nodes = new Map(root.listNodes().map(n => [n.getName(), n]));
    const local = new Map();
    for (const [name, n] of nodes) {
        const t = n.getTranslation(), r = n.getRotation(), s = n.getScale();
        local.set(name, mat4.fromRotationTranslationScale(mat4.create(),
            quat.fromValues(r[0], r[1], r[2], r[3]), vec3.fromValues(t[0], t[1], t[2]), vec3.fromValues(s[0], s[1], s[2])));
    }
    const tracks = new Map(); // joint -> {times, quats} for rotation channels
    const anims = new Map();
    for (const a of root.listAnimations()) {
        anims.set(a.getName(), a);
        for (const ch of a.listChannels()) {
            if (ch.getTargetPath() !== 'rotation') continue;
            const s = ch.getSampler();
            tracks.set(a.getName() + '|' + ch.getTargetNode().getName(), {
                times: Array.from(s.getInput().getArray()),
                quats: Array.from(s.getOutput().getArray()),
            });
        }
    }
    const parents = new Map();
    for (const [name, n] of nodes) for (const c of n.listChildren()) parents.set(c.getName(), name);
    return {nodes, local, tracks, anims, parents};
};
const sample = (tr, t) => {
    const {times, quats} = tr, n = times.length;
    const q = i => quats.slice(i * 4, i * 4 + 4);
    if (t <= times[0]) return q(0);
    for (let i = 1; i < n; i++) {
        if (t <= times[i]) {
            const f = (t - times[i - 1]) / Math.max(1e-9, times[i] - times[i - 1]);
            const a = q(i - 1), b = q(i), o = a.map((v, k) => v + (b[k] - v) * f);
            const l = Math.hypot(...o);
            return o.map(v => v / l);
        }
    }
    return q(n - 1);
};
const lean = (asset, clip, t) => {
    // World matrices down the chain with animated rotations, rest translations.
    const lineage = [...CHAIN];
    let top = 'mixamorig:Hips';
    while (asset.parents.get(top)) { top = asset.parents.get(top); lineage.unshift(top); }
    let parent = mat4.create();
    const mats = new Map();
    for (const name of lineage) {
        const node = asset.nodes.get(name);
        const tt = node.getTranslation(), ss = node.getScale();
        const tr = asset.tracks.get(clip + '|' + name);
        let q;
        if (tr) { const s = sample(tr, t); q = quat.fromValues(s[0], s[1], s[2], s[3]); }
        else { const r = node.getRotation(); q = quat.fromValues(r[0], r[1], r[2], r[3]); }
        const m = mat4.fromRotationTranslationScale(mat4.create(), q,
            vec3.fromValues(tt[0], tt[1], tt[2]), vec3.fromValues(ss[0], ss[1], ss[2]));
        parent = mat4.multiply(mat4.create(), parent, m);
        mats.set(name, parent.slice());
    }
    const hips = vec3.transformMat4(vec3.create(), vec3.fromValues(0, 0, 0), mats.get('mixamorig:Hips'));
    const neck = vec3.transformMat4(vec3.create(), vec3.fromValues(0, 0, 0), mats.get('mixamorig:Neck'));
    const d = vec3.sub(vec3.create(), neck, hips);
    vec3.normalize(d, d);
    return Math.acos(Math.min(1, Math.abs(d[1]))) * 180 / Math.PI;
};

const base = await load('public/characters/base.glb');
const orc = await load('public/characters/candidates/orc-source-v1.glb');
let worst = 0;
console.log('clip/time | base | orc | delta');
for (const [clip, t] of TIMES) {
    if (!base.anims.has(clip) || !orc.anims.has(clip)) { console.log(`${clip}/${t}: MISSING`); process.exitCode = 1; continue; }
    const b = lean(base, clip, t), o = lean(orc, clip, t), d = Math.abs(b - o);
    worst = Math.max(worst, d);
    console.log(`${clip} @ ${t}s | ${b.toFixed(1)}° | ${o.toFixed(1)}° | Δ${d.toFixed(2)}°`);
}
console.log('worst matched delta:', worst.toFixed(2) + '°');
if (worst > 1) { console.error('LEAN MISMATCH exceeds 1°'); process.exitCode = 1; }
