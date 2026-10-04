/** M7/1: the dye channel driven through the loader, proved and costed in the running game.
 *
 * A dye is applied when the piece's material is built into the scene, so changing one rebuilds
 * that piece. This equips a piece, dyes it through every palette entry, and measures both the
 * cost of the change and whether the rendered garment actually moved colour -- against a static
 * control, because a scene that drifts between captures would otherwise supply the difference.
 */
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { chromium } from 'playwright';
import { browserOwnership } from '../lib/browser-ownership.mjs';
import { DYE_IDS, DYE_PALETTE, DYE_PALETTE_VERSION } from '../../src/ashen-reach/dye-palette.js';

const url = process.env.ASHEN_TEST_URL, port = process.env.ASHEN_CDP_PORT, out = process.argv[2];
assert(url && port && out, 'ASHEN_TEST_URL, ASHEN_CDP_PORT and an output path are required');
const ITEM = process.env.ASHEN_DYE_ITEM || 'wayfarerTunic';
const SLOT = process.env.ASHEN_DYE_SLOT || 'torso';
const CLIP = { x: 575, y: 330, width: 130, height: 110 };

const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
assert(browser.contexts().flatMap(c => c.pages()).every(p => p.url() === 'about:blank'), 'Another owned page is active');
const ownership = await browserOwnership(browser, { cdpPort: port, url, purpose: 'M7 dye channel: proof and cost', renderingClients: 1 });
await fs.writeFile(out + '.ownership.json', JSON.stringify(ownership, null, 2));
const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 }), page = await context.newPage();
const rows = [], errors = [];
page.on('pageerror', e => errors.push(e.stack));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 300)); });

const meanRgb = async () => {
    const buffer = await page.screenshot({ clip: CLIP });
    const { data, info } = await sharp(buffer).raw().toBuffer({ resolveWithObject: true });
    let r = 0, g = 0, b = 0, n = 0;
    for (let i = 0; i < data.length; i += info.channels) { r += data[i]; g += data[i + 1]; b += data[i + 2]; n++; }
    return [r / n, g / n, b / n].map(v => +v.toFixed(2));
};
const distance = (a, b) => +Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]).toFixed(2);

try {
    await page.goto(url);
    await page.waitForFunction(() => globalThis.ASHEN?.whenRest, null, { timeout: 120000 });
    await page.evaluate(() => ASHEN.whenRest);
    await page.evaluate(() => { ASHEN.dev.god = true; });
    const worn = await page.evaluate(([slot, item]) => ASHEN.equipment.equip(slot, item), [SLOT, ITEM]);
    assert.equal(worn.status, 'applied', `could not wear ${ITEM}: ${worn.error}`);
    await page.waitForTimeout(900);
    // Freeze the pose and pin the camera, so nothing but the dye can move the pixels.
    await page.evaluate(() => { for (const g of ASHEN.body.animationGroups) if (g.isPlaying && g.weight > 0.01) { g.currentTime = 0; g.speedRatio = 0; } });
    await page.evaluate(() => { ASHEN.rig.yaw = Math.PI; ASHEN.rig.pitch = 0.03; });
    await page.waitForTimeout(800);

    // Two identical samples first. If these differ, every later difference is suspect.
    const controlA = await meanRgb();
    await page.waitForTimeout(900);
    const controlB = await meanRgb();
    const drift = distance(controlA, controlB);
    assert(drift < 1, `the scene drifts by ${drift} between identical captures, so dye differences cannot be attributed`);

    for (const dye of DYE_IDS) {
        const change = await page.evaluate(async ([item, id]) => {
            const t0 = performance.now();
            const result = await ASHEN.equipment.setDye(item, id);
            while (ASHEN.equipment.getStatus?.()?.pending) await new Promise(requestAnimationFrame);
            return { ms: +(performance.now() - t0).toFixed(1), status: result.status, error: result.error ?? null };
        }, [ITEM, dye]);
        assert.equal(change.status, 'applied', `${dye}: ${change.error}`);
        await page.waitForTimeout(600);
        const rgb = await meanRgb();
        const state = await page.evaluate(() => ({ dyes: ASHEN.equipment.getDyes(), equip: ASHEN.equipment.getState(), gpu: ASHEN.gpu.errors.length }));
        assert.equal(state.equip[SLOT], ITEM, `${dye} lost the piece from ${SLOT}`);
        assert.equal(state.dyes[ITEM], dye === 'undyed' ? 'undyed' : dye);
        assert.equal(state.gpu, 0, `GPU errors after dyeing ${dye}`);
        if (process.env.ASHEN_DYE_STILLS) {
            await fs.mkdir(process.env.ASHEN_DYE_STILLS, { recursive: true });
            await page.screenshot({ path: `${process.env.ASHEN_DYE_STILLS}/${dye}.png` });
        }
        rows.push({ dye, factor: DYE_PALETTE[dye].factor, ms: change.ms, rgb, fromUndyed: null });
        console.log(JSON.stringify({ dye, ms: change.ms, rgb }));
    }
    const undyed = rows.find(r => r.dye === 'undyed').rgb;
    for (const row of rows) row.fromUndyed = distance(row.rgb, undyed);
    // A palette entry that does not move the rendered garment is not a dye.
    for (const row of rows) {
        if (row.dye === 'undyed') continue;
        assert(row.fromUndyed > drift * 4, `${row.dye} moved the garment by ${row.fromUndyed}, within the ${drift} capture noise`);
    }
    await fs.writeFile(out, JSON.stringify({
        url, palette: DYE_PALETTE_VERSION, item: ITEM, slot: SLOT, clip: CLIP,
        control: { a: controlA, b: controlB, drift },
        note: 'rgb is the mean sRGB of a pinned crop of the garment at a frozen pose; fromUndyed is the Euclidean distance from the undyed capture. ms is the cost of the dye change, which rebuilds the piece.',
        rows, errors,
    }, null, 2));
    const costs = rows.map(r => r.ms).sort((a, b) => a - b);
    console.log(JSON.stringify({ control: drift, dyes: rows.length, medianMs: costs[Math.floor(costs.length / 2)], maxMs: costs.at(-1), minSeparation: Math.min(...rows.filter(r => r.dye !== 'undyed').map(r => r.fromUndyed)) }));
    if (errors.length) process.exitCode = 1;
} catch (e) {
    console.error(e); process.exitCode = 1;
} finally {
    await context.close();
    await browser.close();
    await fs.writeFile(out + '.ownership.json', JSON.stringify({ ...ownership, active: false, renderingClients: 0 }, null, 2));
}
