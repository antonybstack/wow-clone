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

// Two means per capture. The whole-crop mean is what the v1 baseline recorded and is kept so
// the two palettes stay comparable; the masked mean is the one that answers the question,
// because the crop is roughly half face, background and trousers and a fitted model over the
// v1 entries showed the dye drives only ~26% of the whole-crop mean. Measuring the garment
// through a frame that is mostly not the garment is the "pixel weight is not pixel value"
// mistake, and it is what made v1's separations look uniformly small.
let MASK = null;   // Uint8Array over the crop: 1 where a dye change actually moves the pixel.
const means = async () => {
    const buffer = await page.screenshot({ clip: CLIP });
    const { data, info } = await sharp(buffer).raw().toBuffer({ resolveWithObject: true });
    let r = 0, g = 0, b = 0, n = 0, mr = 0, mg = 0, mb = 0, mn = 0;
    for (let i = 0, px = 0; i < data.length; i += info.channels, px++) {
        r += data[i]; g += data[i + 1]; b += data[i + 2]; n++;
        if (MASK && MASK[px]) { mr += data[i]; mg += data[i + 1]; mb += data[i + 2]; mn++; }
    }
    const round = v => +v.toFixed(2);
    return {
        rgb: [r / n, g / n, b / n].map(round),
        masked: mn ? [mr / mn, mg / mn, mb / mn].map(round) : null,
    };
};
const meanRgb = async () => (await means()).rgb;
/** Pixels that move when the dye does, measured rather than assumed. */
const buildMask = async (reference) => {
    const before = await page.screenshot({ clip: CLIP });
    await page.evaluate(async ([item, id]) => {
        await ASHEN.equipment.setDye(item, id);
        while (ASHEN.equipment.getStatus?.()?.pending) await new Promise(requestAnimationFrame);
    }, [ITEM, reference]);
    await page.waitForTimeout(700);
    const after = await page.screenshot({ clip: CLIP });
    await page.evaluate(async ([item]) => {
        await ASHEN.equipment.setDye(item, 'undyed');
        while (ASHEN.equipment.getStatus?.()?.pending) await new Promise(requestAnimationFrame);
    }, [ITEM]);
    await page.waitForTimeout(700);
    const a = await sharp(before).raw().toBuffer({ resolveWithObject: true });
    const b = await sharp(after).raw().toBuffer({ resolveWithObject: true });
    const n = a.info.width * a.info.height, ch = a.info.channels, mask = new Uint8Array(n);
    let hits = 0;
    for (let px = 0; px < n; px++) {
        const i = px * ch;
        const d = Math.abs(a.data[i] - b.data[i]) + Math.abs(a.data[i + 1] - b.data[i + 1])
                + Math.abs(a.data[i + 2] - b.data[i + 2]);
        if (d > 8) { mask[px] = 1; hits++; }
    }
    // A mask that covers almost nothing makes every later masked mean meaningless, so it is a
    // failure rather than a quiet zero.
    assert(hits / n > 0.15, `only ${(hits / n * 100).toFixed(1)}% of the crop responds to a dye; `
        + 'the crop does not frame the garment');
    return { mask, share: +(hits / n * 100).toFixed(1), pixels: n, hits };
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

    // The mask is built before the controls, so the drift measurement is taken through exactly
    // the same mask the dye rows are measured through.
    const maskInfo = await buildMask(process.env.ASHEN_DYE_MASK_REF || 'pitch');
    MASK = maskInfo.mask;
    console.log(JSON.stringify({ maskSharePct: maskInfo.share, maskPixels: maskInfo.hits }));

    // Two identical samples first. If these differ, every later difference is suspect.
    const sampleA = await means();
    await page.waitForTimeout(900);
    const sampleB = await means();
    const controlA = sampleA.rgb, controlB = sampleB.rgb;
    const drift = distance(controlA, controlB);
    const maskedDrift = distance(sampleA.masked, sampleB.masked);
    assert(drift < 1, `the scene drifts by ${drift} between identical captures, so dye differences cannot be attributed`);
    assert(maskedDrift < 2, `the masked crop drifts by ${maskedDrift} between identical captures`);

    for (const dye of DYE_IDS) {
        const change = await page.evaluate(async ([item, id]) => {
            const t0 = performance.now();
            const result = await ASHEN.equipment.setDye(item, id);
            while (ASHEN.equipment.getStatus?.()?.pending) await new Promise(requestAnimationFrame);
            return { ms: +(performance.now() - t0).toFixed(1), status: result.status, error: result.error ?? null };
        }, [ITEM, dye]);
        assert.equal(change.status, 'applied', `${dye}: ${change.error}`);
        await page.waitForTimeout(600);
        const { rgb, masked } = await means();
        const state = await page.evaluate(() => ({ dyes: ASHEN.equipment.getDyes(), equip: ASHEN.equipment.getState(), gpu: ASHEN.gpu.errors.length }));
        assert.equal(state.equip[SLOT], ITEM, `${dye} lost the piece from ${SLOT}`);
        assert.equal(state.dyes[ITEM], dye === 'undyed' ? 'undyed' : dye);
        assert.equal(state.gpu, 0, `GPU errors after dyeing ${dye}`);
        if (process.env.ASHEN_DYE_STILLS) {
            await fs.mkdir(process.env.ASHEN_DYE_STILLS, { recursive: true });
            await page.screenshot({ path: `${process.env.ASHEN_DYE_STILLS}/${dye}.png` });
        }
        rows.push({ dye, factor: DYE_PALETTE[dye].factor, ms: change.ms, rgb, masked, fromUndyed: null });
        console.log(JSON.stringify({ dye, ms: change.ms, rgb, masked }));
    }
    const undyed = rows.find(r => r.dye === 'undyed');
    for (const row of rows) {
        row.fromUndyed = distance(row.rgb, undyed.rgb);
        row.maskedFromUndyed = distance(row.masked, undyed.masked);
    }
    // A palette entry that does not move the rendered garment is not a dye.
    for (const row of rows) {
        if (row.dye === 'undyed') continue;
        assert(row.fromUndyed > drift * 4, `${row.dye} moved the garment by ${row.fromUndyed}, within the ${drift} capture noise`);
    }
    // Distance from undyed is not the player's question: two dyes that are both far from undyed
    // and close to each other are one dye and a wasted slot. That is what v1 shipped -- eight
    // entries 8-11 units from undyed but 1.7-3.6 from one another -- so the pairwise floor is
    // asserted, against the characterised capture noise rather than a round number.
    const pairs = [];
    for (let i = 0; i < rows.length; i++) {
        for (let j = i + 1; j < rows.length; j++) {
            pairs.push({ a: rows[i].dye, b: rows[j].dye,
                         gap: distance(rows[i].rgb, rows[j].rgb),
                         maskedGap: distance(rows[i].masked, rows[j].masked) });
        }
    }
    pairs.sort((x, y) => x.gap - y.gap);
    const floor = Math.max(drift * 8, 1.0);
    assert(pairs[0].gap > floor,
        `${pairs[0].a} and ${pairs[0].b} are only ${pairs[0].gap} apart, at or under the ${floor} floor`);
    await fs.writeFile(out, JSON.stringify({
        url, palette: DYE_PALETTE_VERSION, item: ITEM, slot: SLOT, clip: CLIP,
        control: { a: controlA, b: controlB, drift, maskedDrift },
        mask: { reference: process.env.ASHEN_DYE_MASK_REF || 'pitch', sharePct: maskInfo.share,
                pixels: maskInfo.pixels, responsive: maskInfo.hits },
        closestPairs: pairs.slice(0, 5),
        note: 'rgb is the mean sRGB of a pinned crop at a frozen pose; masked is the same mean over only '
            + 'the pixels a dye change actually moves, which is the garment rather than the surrounding '
            + 'face, background and trousers. fromUndyed and maskedFromUndyed are Euclidean distances '
            + 'from the undyed capture; closestPairs is the pairwise separation that decides whether a '
            + 'player can tell two entries apart. ms is the cost of the dye change, which rebuilds the piece.',
        rows, errors,
    }, null, 2));
    const costs = rows.map(r => r.ms).sort((a, b) => a - b);
    console.log(JSON.stringify({ control: drift, maskedDrift, dyes: rows.length,
        medianMs: costs[Math.floor(costs.length / 2)], maxMs: costs.at(-1),
        minFromUndyed: Math.min(...rows.filter(r => r.dye !== 'undyed').map(r => r.fromUndyed)),
        minPairwise: pairs[0].gap, minPairwisePair: `${pairs[0].a}/${pairs[0].b}`,
        minPairwiseMasked: Math.min(...pairs.map(p => p.maskedGap)) }));
    if (errors.length) process.exitCode = 1;
} catch (e) {
    console.error(e); process.exitCode = 1;
} finally {
    await context.close();
    await browser.close();
    await fs.writeFile(out + '.ownership.json', JSON.stringify({ ...ownership, active: false, renderingClients: 0 }, null, 2));
}
