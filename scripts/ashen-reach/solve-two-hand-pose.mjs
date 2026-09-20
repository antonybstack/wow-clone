/**
 * Offline solver: find local arm rotations that hold the greatstaff two-handed.
 *
 * The masked-overlay approach failed because a source clip's arm locals are
 * relative to that clip's own torso. Here we keep the real locomotion torso and
 * numerically search each arm's bone local rotations (delta from the idle arm
 * pose) so its wrist reaches a chosen chest-relative target. Output is baked
 * into src/character/runtime/two-hand-carry-pose.json and applied at runtime.
 *
 * Run from the repository root with Vite 5173 and owned Chrome CDP 9337.
 */
import { chromium } from 'playwright';
import { CDP_URL } from '../lib/cdp.mjs';
import fs from 'node:fs/promises';

const SIDES = [
    {
        hand: 'mixamorig:RightHand',
        bones: ['mixamorig:RightShoulder', 'mixamorig:RightArm', 'mixamorig:RightForeArm'],
        parents: ['mixamorig:Spine2', 'mixamorig:RightShoulder', 'mixamorig:RightArm'],
        target: [0.28, 0.32, 0.24],
    },
    {
        hand: 'mixamorig:LeftHand',
        bones: ['mixamorig:LeftShoulder', 'mixamorig:LeftArm', 'mixamorig:LeftForeArm'],
        parents: ['mixamorig:Spine2', 'mixamorig:LeftShoulder', 'mixamorig:LeftArm'],
        target: [-0.28, 0.32, 0.24],
    },
];

const url = process.env.ASHEN_URL || 'http://127.0.0.1:5173/ashen-reach.html?play&clean';
const browser = await chromium.connectOverCDP(CDP_URL);
const ctx = browser.contexts()[0];
const page = ctx.pages().find(p => p.url().includes('ashen-reach')) || await ctx.newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message));
await page.bringToFront();
await page.goto(url, { waitUntil: 'commit', timeout: 60000 });
await page.waitForFunction(() => globalThis.ASHEN?.ready, null, { timeout: 60000 });

const solution = await page.evaluate(async (SIDES) => {
    const L = await import('/node_modules/@babylonjs/lite/lib/index.js');
    const vis = ASHEN.body, groups = vis.animationGroups, s = ASHEN.combat.fx.sockets, skel = ASHEN.body.skeleton;
    const bone = name => ASHEN.body.skeleton.bones.find(b => b.name === name);
    const allArm = ['mixamorig:LeftShoulder', 'mixamorig:LeftArm', 'mixamorig:LeftForeArm', 'mixamorig:LeftHand', 'mixamorig:RightShoulder', 'mixamorig:RightArm', 'mixamorig:RightForeArm', 'mixamorig:RightHand'];
    vis.update = () => {};
    for (const g of groups) { L.stopAnimation(g); L.setAnimationWeight(g, 0); g.mask = undefined; }
    const idle = groups.find(g => g.name === 'Idle_Loop');
    idle.mask = L.createAnimationGroupMask(allArm, L.AnimationGroupMaskMode.Exclude);
    idle.loopAnimation = true; L.setAnimationWeight(idle, 1); L.playAnimation(idle); idle.currentTime = 0;
    L.updateAnimationManager(vis.manager, 0);

    const cap = name => { const c = s.toCapsule(bone(name)); return c ? { p: [c.x, c.y, c.z], q: [c.r.x, c.r.y, c.r.z, c.r.w] } : null; };
    const qmul = (a, b) => [a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1], a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0], a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3], a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]];
    const inv4 = q => [-q[0], -q[1], -q[2], q[3]];
    const euler = (x, y, z) => { const cx = Math.cos(x / 2), sx = Math.sin(x / 2), cy = Math.cos(y / 2), sy = Math.sin(y / 2), cz = Math.cos(z / 2), sz = Math.sin(z / 2); return [sx * cy * cz + cx * sy * sz, cx * sy * cz - sx * cy * sz, cx * cy * sz + sx * sy * cz, cx * cy * cz - sx * sy * sz]; };
    const compose = (p, q) => { const [x, y, z, w] = q; return [1 - 2 * (y * y + z * z), 2 * (x * y + z * w), 2 * (x * z - y * w), 0, 2 * (x * y - z * w), 1 - 2 * (x * x + z * z), 2 * (y * z + x * w), 0, 2 * (x * z + y * w), 2 * (y * z - x * w), 1 - 2 * (x * x + y * y), 0, p[0], p[1], p[2], 1]; };
    const mulV = (m, v) => [m[0] * v[0] + m[4] * v[1] + m[8] * v[2] + m[12], m[1] * v[0] + m[5] * v[1] + m[9] * v[2] + m[13], m[2] * v[0] + m[6] * v[1] + m[10] * v[2] + m[14]];
    const inv3 = m => { const a = [[m[0], m[4], m[8]], [m[1], m[5], m[9]], [m[2], m[6], m[10]]]; const d = a[0][0] * (a[1][1] * a[2][2] - a[1][2] * a[2][1]) - a[0][1] * (a[1][0] * a[2][2] - a[1][2] * a[2][0]) + a[0][2] * (a[1][0] * a[2][1] - a[1][1] * a[2][0]); const r = [[(a[1][1] * a[2][2] - a[1][2] * a[2][1]) / d, (a[0][2] * a[2][1] - a[0][1] * a[2][2]) / d, (a[0][1] * a[1][2] - a[0][2] * a[1][1]) / d], [(a[1][2] * a[2][0] - a[1][0] * a[2][2]) / d, (a[0][0] * a[2][2] - a[0][2] * a[2][0]) / d, (a[0][2] * a[1][0] - a[0][0] * a[1][2]) / d], [(a[1][0] * a[2][1] - a[1][1] * a[2][0]) / d, (a[0][1] * a[2][0] - a[0][0] * a[2][1]) / d, (a[0][0] * a[1][1] - a[0][1] * a[1][0]) / d]]; const t = [m[12], m[13], m[14]]; return [r[0][0], r[0][1], r[0][2], 0, r[1][0], r[1][1], r[1][2], 0, r[2][0], r[2][1], r[2][2], 0, -(r[0][0] * t[0] + r[0][1] * t[1] + r[0][2] * t[2]), -(r[1][0] * t[0] + r[1][1] * t[1] + r[1][2] * t[2]), -(r[2][0] * t[0] + r[2][1] * t[1] + r[2][2] * t[2]), 1]; };

    const restOf = (name, parent) => { const c = cap(name), pc = cap(parent); return { t: mulV(inv3(compose(pc.p, pc.q)), c.p), base: qmul(inv4(pc.q), c.q) }; };

    const results = [];
    for (const side of SIDES) {
        const rest = side.bones.map((name, i) => restOf(name, side.parents[i]));
        const params = new Array(side.bones.length * 3).fill(0);
        const applySide = () => side.bones.forEach((name, i) => {
            const rot = qmul(rest[i].base, euler(params[i * 3], params[i * 3 + 1], params[i * 3 + 2]));
            L.setBonePoseDeferred(skel, bone(name), rest[i].t[0], rest[i].t[1], rest[i].t[2], rot[0], rot[1], rot[2], rot[3]);
        });
        const cost = () => {
            applySide(); L.updateAnimationManager(vis.manager, 0);
            const hand = cap(side.hand);
            const d = hand ? (hand.p[0] - side.target[0]) ** 2 + (hand.p[1] - side.target[1]) ** 2 + (hand.p[2] - side.target[2]) ** 2 : 10;
            return d + 0.0004 * params.reduce((a, v) => a + v * v, 0);
        };
        let best = cost(), step = 0.9;
        // Coarse random restarts first: coordinate descent alone got stuck far
        // from the target on the wide two-handed targets.
        for (let k = 0; k < 4000; k++) {
            const save = params.slice();
            for (let i = 0; i < params.length; i++) params[i] = (Math.random() * 2 - 1) * 1.3;
            if (cost() < best) best = cost(); else params.splice(0, params.length, ...save);
        }
        for (let iter = 0; iter < 900 && step > 0.006; iter++) {
            for (let i = 0; i < params.length; i++) {
                for (const dir of [step, -step]) {
                    const save = params[i]; params[i] = save + dir; const c = cost();
                    if (c < best) best = c; else params[i] = save;
                }
            }
            step *= 0.93;
        }
        applySide(); L.updateAnimationManager(vis.manager, 0);
        const hand = cap(side.hand);
        results.push({ hand: side.hand, bones: side.bones, parents: side.parents, params, rest, handPos: hand?.p, handRot: hand?.q, cost: best });
    }
    return results;
}, SIDES);

const arms = solution.flatMap(side => side.bones.map((name, i) => ({
    name,
    parent: side.parents[i],
    hand: side.hand,
    translation: side.rest[i].t,
    base: side.rest[i].base,
    euler: side.params.slice(i * 3, i * 3 + 3),
})));
const out = {
    solvedAt: new Date().toISOString(),
    source: 'Idle_Loop torso + numeric arm solve (solve-two-hand-pose.mjs)',
    targets: Object.fromEntries(SIDES.map(s => [s.hand, s.target])),
    hands: Object.fromEntries(solution.map(s => [s.hand, { p: s.handPos, q: s.handRot }])),
    cost: solution.map(s => s.cost),
    arms,
    errors,
};
await fs.mkdir('ve-capture/ashen-reach/two-handed-v2', { recursive: true });
await fs.writeFile('ve-capture/ashen-reach/two-handed-v2/two-hand-carry-pose.json', JSON.stringify(out, null, 2));
console.log(JSON.stringify({ hands: out.hands, cost: out.cost, errors }, null, 2));
await browser.close();
