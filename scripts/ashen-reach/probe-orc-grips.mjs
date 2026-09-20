/** Measure Human vs Orc palm-to-prop contact. Does not close CDP Chrome. */
import {chromium} from 'playwright';
import { CDP_URL } from '../lib/cdp.mjs';
import fs from 'node:fs/promises';

const dir = 've-capture/ashen-reach/orc-grips';
await fs.mkdir(dir, {recursive: true});
const browser = await chromium.connectOverCDP(CDP_URL);
const page = browser.contexts()[0].pages().find(p => p.url().includes('ashen-reach.html'))
    || await browser.contexts()[0].newPage();

const measure = () => page.evaluate(() => {
    const s = ASHEN.combat.fx.sockets;
    const bw = ASHEN.player.body.worldMatrix;
    const xf = (m, x, y, z) => [
        m[0] * x + m[4] * y + m[8] * z + m[12],
        m[1] * x + m[5] * y + m[9] * z + m[13],
        m[2] * x + m[6] * y + m[10] * z + m[14],
    ];
    const boneWorld = name => {
        const bone = ASHEN.body.skeleton.bones.find(b => b.name === name);
        if (!bone) return null;
        const c = s.toCapsule(bone);
        if (!c) return null;
        return xf(bw, c.x, c.y, c.z);
    };
    const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
    const axisOf = meshName => {
        const mesh = ASHEN.scene.meshes.find(m => m.name === meshName);
        const root = mesh?.parent;
        if (!root?.worldMatrix) return null;
        const w = root.worldMatrix;
        const o = [w[12], w[13], w[14]];
        const ax = [w[4], w[5], w[6]];
        const n = Math.hypot(...ax) || 1;
        const u = ax.map(v => v / n);
        const toAxis = p => {
            const v = [p[0] - o[0], p[1] - o[1], p[2] - o[2]];
            const t = v[0] * u[0] + v[1] * u[1] + v[2] * u[2];
            return Math.hypot(p[0] - (o[0] + u[0] * t), p[1] - (o[1] + u[1] * t), p[2] - (o[2] + u[2] * t));
        };
        return {root, toAxis, local: [root.position.x, root.position.y, root.position.z]};
    };
    const right = boneWorld('mixamorig:RightHand');
    const left = boneWorld('mixamorig:LeftHand');
    const rMid1 = boneWorld('mixamorig:RightHandMiddle1');
    const rMid2 = boneWorld('mixamorig:RightHandMiddle2');
    const lMid1 = boneWorld('mixamorig:LeftHandMiddle1');
    const main = s.sockets.mainHand.node;
    const off = s.sockets.offHand.node;
    const socket = xf(main.worldMatrix, 0, 0, 0);
    const offSocket = xf(off.worldMatrix, 0, 0, 0);
    const palmLen = right && rMid1 ? dist(right, rMid1) : null;
    const report = {
        race: ASHEN.equipment.race,
        loadout: ASHEN.equipment.getState(),
        palmLenRight: palmLen,
        wristToSocket: right ? dist(right, socket) : null,
        mid1ToSocket: rMid1 ? dist(rMid1, socket) : null,
        socketLocal: [main.position.x, main.position.y, main.position.z],
    };
    for (const [label, mesh] of [['sword', 'SwordSteel'], ['staff', 'staffWood'], ['greatstaff', 'greatstaffWood'], ['book', 'bookCover']]) {
        const axis = axisOf(mesh);
        if (!axis) continue;
        report[label] = {
            local: axis.local,
            right: right ? axis.toAxis(right) : null,
            rMid1: rMid1 ? axis.toAxis(rMid1) : null,
            rMid2: rMid2 ? axis.toAxis(rMid2) : null,
            socket: axis.toAxis(socket),
            left: left ? axis.toAxis(left) : null,
            lMid1: lMid1 ? axis.toAxis(lMid1) : null,
            offSocket: axis.toAxis(offSocket),
        };
    }
    return report;
});

const settled = () => page.waitForFunction(() => !ASHEN.equipment.getStatus?.().pending, null, {timeout: 60000});
const shot = async name => {
    await page.waitForTimeout(220);
    await page.screenshot({path: `${dir}/${name}.png`});
};
const focusHand = async (slot, alpha, beta = 1.5, radius = 0.72) => {
    await page.evaluate(({slot, alpha, beta, radius}) => {
        const c = ASHEN.armory.camera;
        const m = ASHEN.combat.fx.sockets.sockets[slot].node.worldMatrix;
        c.target.set(m[12], m[13] - 0.04, m[14]);
        c.radius = radius;
        c.alpha = alpha;
        c.beta = beta;
    }, {slot, alpha, beta, radius});
    await page.waitForTimeout(250);
};

const reports = [];
try {
    await page.bringToFront();
    await page.goto('http://127.0.0.1:5173/ashen-reach.html?play&clean', {waitUntil: 'commit', timeout: 60000});
    await page.waitForFunction(() => globalThis.ASHEN?.ready, null, {timeout: 60000});
    await page.waitForTimeout(600);
    await page.locator('#armory-launch').click();
    await page.locator('[data-light]').check();
    await page.evaluate(() => {
        window.__armoryUpdate = ASHEN.armory.update;
        ASHEN.armory.update = () => {};
        document.querySelector('#armory').style.visibility = 'hidden';
        ASHEN.body.inspection.setPaused(true);
        ASHEN.body.inspection.seek(0.1);
    });

    for (const race of ['human', 'orc']) {
        await page.locator('[data-race]').selectOption(race);
        await page.waitForFunction(want => ASHEN.equipment.race === want && !ASHEN.equipment.getStatus?.().pending, race, {timeout: 60000});
        for (const preset of ['wayfarer', 'graveweaver', 'warden']) {
            await page.locator(`[data-outfit="${preset}"]`).click();
            await settled();
            await page.evaluate(id => {
                const p = ASHEN.body.inspection;
                p.select(id);
                p.setPaused(true);
                p.seek(id === 'carry' ? 0.9 : 0.1);
            }, preset === 'warden' ? 'carry' : 'idle');
            await page.waitForTimeout(200);
            const row = await measure();
            reports.push(row);
            console.log(JSON.stringify(row));
            if (preset === 'wayfarer') {
                await focusHand('mainHand', 0.8);
                await shot(`${race}-sword-palm`);
                await focusHand('mainHand', 2.1, 2.0);
                await shot(`${race}-sword-under`);
            }
            if (preset === 'graveweaver') {
                await focusHand('mainHand', 0.8);
                await shot(`${race}-staff-palm`);
                await focusHand('offHand', 3.7, 1.5, 0.7);
                await shot(`${race}-book-palm`);
            }
            if (preset === 'warden') {
                await focusHand('mainHand', 0.8, 1.5, 0.85);
                await shot(`${race}-greatstaff-palm`);
            }
        }
    }
    await fs.writeFile(`${dir}/measure.json`, JSON.stringify(reports, null, 2) + '\n');
    await page.evaluate(() => {
        if (window.__armoryUpdate) {
            ASHEN.armory.update = window.__armoryUpdate;
            delete window.__armoryUpdate;
        }
        const el = document.querySelector('#armory');
        if (el) el.style.visibility = '';
    }).catch(() => {});
} finally {
    process.exit(0);
}
