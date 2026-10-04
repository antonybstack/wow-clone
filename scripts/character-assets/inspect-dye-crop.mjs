/** What does the dye check's crop actually frame?
 *
 * The fitted model says the dye drives only 26% of the crop's mean, which means ~74% of what
 * the metric measures does not respond to the dye at all. Before respending a palette against
 * that metric, look at the crop. Same pose freeze and camera pin as check-dye-live.mjs.
 */
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { chromium } from 'playwright';

const url = process.env.ASHEN_TEST_URL, port = process.env.ASHEN_CDP_PORT;
const OUT = process.argv[2];
const CLIP = { x: 575, y: 330, width: 130, height: 110 };
const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
const page = await context.newPage();
await fs.mkdir(OUT, { recursive: true });
try {
    await page.goto(url);
    await page.waitForFunction(() => globalThis.ASHEN?.whenRest, null, { timeout: 120000 });
    await page.evaluate(() => ASHEN.whenRest);
    await page.evaluate(() => { ASHEN.dev.god = true; });
    const worn = await page.evaluate(() => ASHEN.equipment.equip('torso', 'wayfarerTunic'));
    assert.equal(worn.status, 'applied', worn.error);
    await page.waitForTimeout(900);
    await page.evaluate(() => { for (const g of ASHEN.body.animationGroups) if (g.isPlaying && g.weight > 0.01) { g.currentTime = 0; g.speedRatio = 0; } });
    await page.evaluate(() => { ASHEN.rig.yaw = Math.PI; ASHEN.rig.pitch = 0.03; });
    await page.waitForTimeout(800);

    await page.screenshot({ path: `${OUT}/full.png` });
    // The crop, enlarged 6x: a 130x110 region judged at native size is how phantom defects get
    // reported in this project.
    const crop = await page.screenshot({ clip: CLIP });
    await sharp(crop).resize({ width: CLIP.width * 6, kernel: 'nearest' }).toFile(`${OUT}/crop-6x.png`);

    // Which pixels respond to the dye? Difference the undyed capture against a hard dye, so the
    // garment's actual footprint in the crop is measured rather than guessed.
    const undyed = await page.screenshot({ clip: CLIP });
    await page.evaluate(async () => { await ASHEN.equipment.setDye('wayfarerTunic', 'pitch');
        while (ASHEN.equipment.getStatus?.()?.pending) await new Promise(requestAnimationFrame); });
    await page.waitForTimeout(700);
    const dyed = await page.screenshot({ clip: CLIP });
    const a = await sharp(undyed).raw().toBuffer({ resolveWithObject: true });
    const b = await sharp(dyed).raw().toBuffer({ resolveWithObject: true });
    const n = a.info.width * a.info.height, ch = a.info.channels;
    let responsive = 0, mask = Buffer.alloc(n * 3);
    for (let i = 0; i < n; i++) {
        const d = Math.abs(a.data[i*ch] - b.data[i*ch]) + Math.abs(a.data[i*ch+1] - b.data[i*ch+1])
                + Math.abs(a.data[i*ch+2] - b.data[i*ch+2]);
        const hit = d > 8;
        if (hit) responsive++;
        mask[i*3] = mask[i*3+1] = mask[i*3+2] = hit ? 255 : 0;
    }
    await sharp(mask, { raw: { width: a.info.width, height: a.info.height, channels: 3 } })
        .resize({ width: a.info.width * 6, kernel: 'nearest' }).png().toFile(`${OUT}/responsive-mask-6x.png`);
    console.log(JSON.stringify({ crop: CLIP, pixels: n, responsive,
        responsiveShare: +(responsive / n * 100).toFixed(1) }, null, 2));
} finally {
    await context.close();
    await browser.close();
}
