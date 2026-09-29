/** Measure the rendered head/body join on the M006 old-head candidate, deterministically.
 *
 * Why a still and not a frame from the motion capture: the review orbit is driven by
 * requestAnimationFrame, so a frame index does not pin a camera pose and the same index
 * lands on a different yaw between runs. Two builds compared that way are not comparable.
 * Here the armory camera is set to exact angles, so every build is sampled from the same
 * viewpoint under the same fill light.
 *
 * The join row is found from the image rather than assumed. The head and body are two
 * meshes butted at y=1.5 m, so the seam is a horizontal step in skin tone; the probe scans
 * a window for the row with the largest such step and reports the step there. That keeps
 * the metric honest when the pose or the framing shifts.
 *
 * Reported: worst per-channel difference across the join, luminance difference and warmth
 * (R-B) difference. Warmth is the hue break that reads as "wrong skin"; the atlas-space rim
 * delta this replaces was matched to 0 while the rendered join was still plainly visible.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import {chromium} from 'playwright';
import sharp from 'sharp';

const port = Number(process.env.ASHEN_CDP_PORT);
const url = process.env.ASHEN_URL;
const label = process.env.ASHEN_JOIN_LABEL ?? 'candidate';
const file = path.resolve(process.env.ASHEN_CANDIDATE_FILE
    ?? '.cache/character-mmo/m006/human-old-bald-atlas-matched.glb');
if (!port || !url || !/^[a-z0-9.-]+$/.test(label)) throw Error('Owned ASHEN_CDP_PORT, ASHEN_URL and a label required');
const views = [
    {name: 'front-quarter', alpha: Math.PI * 0.75, beta: 1.52},
    {name: 'back', alpha: Math.PI * 1.75, beta: 1.52},
];
const dir = path.resolve(`ve-capture/character-mmo/m006/join/${label}`);
await fs.mkdir(dir, {recursive: true});

const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
const pages = browser.contexts()[0].pages();
const page = pages.find(p => p.url().includes(`127.0.0.1:${new URL(url).port}/ashen-reach.html`))
    ?? pages.find(p => p.url() === 'about:blank');
if (!page) throw Error('No owned Ashen Reach page in this harness slot');
const errors = [];
page.on('pageerror', e => errors.push(String(e.message ?? e)));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
let bodyRequests = 0;
await page.route('**/__human_head__/*.glb', async route => {
    bodyRequests++;
    await route.fulfill({status: 200, contentType: 'model/gltf-binary', body: await fs.readFile(file)});
});

/** Largest horizontal step in mean skin tone inside the search window. */
function locateJoin(data, info) {
    const meanRow = y => {
        const keep = [];
        for (let x = 60; x <= 420; x += 2) {
            const o = (y * info.width + x) * info.channels;
            const r = [data[o], data[o + 1], data[o + 2]];
            // Skin: bright enough to be lit, and red-dominant. Excludes sky, grass and stone.
            if (r[0] * .2126 + r[1] * .7152 + r[2] * .0722 > 95 && r[0] > r[2] + 8) keep.push(r);
        }
        return keep.length >= 25 ? [0, 1, 2].map(c => keep.reduce((a, r) => a + r[c], 0) / keep.length) : null;
    };
    // Search only the neck band. Once the join is corrected it stops being the largest step
    // in the frame -- the brow and the stubble line take over -- and an unconstrained search
    // silently starts measuring a different edge on each build.
    const LO = 400, HI = 520;
    const rows = new Map();
    for (let y = LO - 12; y <= HI + 12; y++) rows.set(y, meanRow(y));
    let best = null;
    for (let y = LO; y <= HI; y++) {
        const above = [], below = [];
        for (let k = 4; k <= 12; k++) { const a = rows.get(y - k), b = rows.get(y + k); if (a) above.push(a); if (b) below.push(b); }
        if (above.length < 7 || below.length < 7) continue;
        const m = list => [0, 1, 2].map(c => list.reduce((a, r) => a + r[c], 0) / list.length);
        const A = m(above), B = m(below);
        const step = Math.max(...[0, 1, 2].map(c => Math.abs(B[c] - A[c])));
        if (!best || step > best.step) best = {row: y, step, head: A, body: B};
    }
    return best;
}

const results = [];
try {
    await page.setViewportSize({width: 1280, height: 720});
    await page.goto(`http://127.0.0.1:${new URL(url).port}/ashen-reach.html?play&clean&legacyStart=1&noEnemies=1&pixelRatio=1&humanHead=old-bald`);
    await page.waitForFunction(() => globalThis.ASHEN?.whenPlayable, null, {timeout: 90000});
    await page.evaluate(() => ASHEN.whenRest);
    if (bodyRequests !== 1) throw Error(`Expected one intercepted head-candidate request, got ${bodyRequests}`);
    await page.evaluate(() => { ASHEN.dev.god = true; ASHEN.armory.open(); ASHEN.armory.setFocus({height: 1.52, radius: 1.05, beta: 1.52}); });
    for (const slot of ['torso', 'legs', 'boots', 'mainHand']) {
        await page.selectOption(`#armory [data-equipment="${slot}"]`, '');
        await page.waitForFunction(s => ASHEN.equipment.getState()[s] === null, slot);
    }
    await page.check('#armory [data-light]');
    for (const view of views) {
        await page.evaluate(v => { ASHEN.armory.camera.alpha = v.alpha; ASHEN.armory.camera.beta = v.beta; }, view);
        await page.evaluate(() => ASHEN.whenNextGpuFrame());
        await page.evaluate(() => ASHEN.whenNextGpuFrame());
        const shot = path.join(dir, `${view.name}.png`);
        await page.screenshot({path: shot});
        const {data, info} = await sharp(shot).removeAlpha().raw().toBuffer({resolveWithObject: true});
        const found = locateJoin(data, info);
        if (!found) throw Error(`No skin step found in ${view.name}`);
        const lum = a => a[0] * .2126 + a[1] * .7152 + a[2] * .0722;
        results.push({
            view: view.name, joinRow: found.row,
            head: found.head.map(v => Math.round(v)), body: found.body.map(v => Math.round(v)),
            maxChannelStep: Number(found.step.toFixed(1)),
            lumStep: Number((lum(found.body) - lum(found.head)).toFixed(1)),
            warmthStep: Number(((found.head[0] - found.head[2]) - (found.body[0] - found.body[2])).toFixed(1)),
        });
    }
    const report = {label, file, sourceUrl: page.url(), viewport: [1280, 720], bodyRequests, views: results, errors};
    await fs.writeFile(path.join(dir, 'join.json'), JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify(report));
} finally {
    await page.evaluate(() => ASHEN.armory?.close()).catch(() => {});
    await page.goto('about:blank').catch(() => {});
    await browser.close();
}
