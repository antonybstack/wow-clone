/** Scan the retargeted `Walk_Carry_Loop` for its most neutral phase: the sample
 * time minimizing torso lean plus arm raise from the bind pose. The stationary
 * two-handed hold freezes there instead of parking a lean-back walk extreme.
 * Offline; never imported by the game. */
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';

const TORSO = ['mixamorig:Spine', 'mixamorig:Spine1', 'mixamorig:Spine2', 'mixamorig:Neck', 'mixamorig:Head'];
const HIPS = ['mixamorig:Hips'];
const ARMS = ['mixamorig:LeftShoulder', 'mixamorig:RightShoulder', 'mixamorig:LeftArm', 'mixamorig:RightArm',
    'mixamorig:LeftForeArm', 'mixamorig:RightForeArm', 'mixamorig:LeftHand', 'mixamorig:RightHand'];
const LEGS = ['mixamorig:LeftUpLeg', 'mixamorig:RightUpLeg', 'mixamorig:LeftLeg', 'mixamorig:RightLeg'];

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read('public/ashen-reach/wanderer.glb');
const root = doc.getRoot();
const nodes = new Map(root.listNodes().map(n => [n.getName(), n]));
const anim = root.listAnimations().find(a => a.getName() === 'Walk_Carry_Loop');
if (!anim) throw Error('Missing Walk_Carry_Loop');

const tracks = new Map(); // name -> {times, quats}
let duration = 0;
for (const ch of anim.listChannels()) {
    if (ch.getTargetPath() !== 'rotation') continue;
    const name = ch.getTargetNode().getName();
    if (!TORSO.includes(name) && !ARMS.includes(name) && !HIPS.includes(name) && !LEGS.includes(name)) continue;
    const s = ch.getSampler(), times = Array.from(s.getInput().getArray()), out = Array.from(s.getOutput().getArray());
    duration = Math.max(duration, times.at(-1));
    const quats = [];
    for (let i = 0; i < times.length; i++) quats.push(out.slice(i * 4, i * 4 + 4));
    tracks.set(name, {times, quats});
}
console.log('duration', duration.toFixed(3), 'tracked joints', tracks.size);

const sample = (tr, t) => {
    const {times, quats} = tr;
    if (t <= times[0]) return quats[0];
    for (let i = 1; i < times.length; i++) {
        if (t <= times[i]) {
            const f = (t - times[i - 1]) / Math.max(1e-9, times[i] - times[i - 1]);
            const a = quats[i - 1], b = quats[i];
            const q = [0, 1, 2, 3].map(k => a[k] + (b[k] - a[k]) * f);
            const n = Math.hypot(...q);
            return q.map(v => v / n);
        }
    }
    return quats.at(-1);
};
const angle = (a, b) => 2 * Math.acos(Math.min(1, Math.abs(a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3])));

const score = t => {
    let torso = 0, arms = 0, hips = 0, legs = 0;
    for (const [name, tr] of tracks) {
        const bind = nodes.get(name).getRotation(), d = angle(sample(tr, t), Array.from(bind));
        if (TORSO.includes(name)) torso += d;
        else if (HIPS.includes(name)) hips += d;
        else if (LEGS.includes(name)) legs += d;
        else arms += d;
    }
    return 2 * torso + arms + 3 * hips + legs;
};

const N = 120, ranked = [];
for (let i = 0; i < N; i++) {
    const t = duration * i / N;
    ranked.push({t, score: score(t)});
}
ranked.sort((a, b) => a.score - b.score);
console.log('most neutral phases (seconds):');
for (const r of ranked.slice(0, 5)) console.log('  t=' + r.t.toFixed(3), 'score=' + r.score.toFixed(3));
console.log('least neutral (current risk): t=' + ranked.at(-1).t.toFixed(3), 'score=' + ranked.at(-1).score.toFixed(3));
