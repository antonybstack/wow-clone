/** How far the player's feet sit above the visual terrain, sampled across the region.
 *
 * The capsule reports `grounded` and rests on the collision world; the grass and ground the
 * player looks at are the visual heightfield. Those are two different surfaces, and where they
 * disagree the character stands on nothing visible. This measures the disagreement rather than
 * arguing about a screenshot: drop the player at a grid of points, let physics settle, and
 * report capsule bottom minus terrain height.
 */
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { browserOwnership } from '../lib/browser-ownership.mjs';

const url = process.env.ASHEN_TEST_URL, port = process.env.ASHEN_CDP_PORT, out = process.argv[2];
assert(url && port && out, 'ASHEN_TEST_URL, ASHEN_CDP_PORT and an output path are required');
const STEP = Number(process.env.ASHEN_STEP || 6), SPAN = Number(process.env.ASHEN_SPAN || 30);

const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
assert(browser.contexts().flatMap(c => c.pages()).every(p => p.url() === 'about:blank'), 'Another owned page is active');
const ownership = await browserOwnership(browser, { cdpPort: port, url, purpose: 'Ground contact: capsule bottom against visual terrain', renderingClients: 1 });
await fs.writeFile(out + '.ownership.json', JSON.stringify(ownership, null, 2));
const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 }), page = await context.newPage();
const rows = [], errors = [];
page.on('pageerror', e => errors.push(e.stack));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 300)); });

try {
    await page.goto(url);
    await page.waitForFunction(() => globalThis.ASHEN?.whenRest, null, { timeout: 120000 });
    await page.evaluate(() => ASHEN.whenRest);
    await page.evaluate(() => { ASHEN.dev.god = true; });

    for (let x = -SPAN; x <= SPAN; x += STEP) {
        for (let z = -SPAN; z <= SPAN; z += STEP) {
            const row = await page.evaluate(async ([px, pz]) => {
                const { height } = await import('/src/ashen-reach/geometry.js');
                const terrain = height(px, pz);
                // Drop from clearly above so physics resolves the contact rather than starting inside it.
                ASHEN.player.setWorldPos(px, terrain + ASHEN.player.capsuleHeight / 2 + 1.5, pz);
                for (let f = 0; f < 90; f++) await new Promise(requestAnimationFrame);
                const p = ASHEN.player.getDebugState();
                const settledTerrain = height(p.position.x, p.position.z);
                return {
                    x: px, z: pz,
                    capsuleBottomY: p.position.y - ASHEN.player.capsuleHeight / 2,
                    terrainY: settledTerrain,
                    grounded: p.grounded,
                    drift: Math.hypot(p.position.x - px, p.position.z - pz),
                };
            }, [x, z]);
            row.gap = +(row.capsuleBottomY - row.terrainY).toFixed(4);
            row.capsuleBottomY = +row.capsuleBottomY.toFixed(4);
            row.terrainY = +row.terrainY.toFixed(4);
            row.drift = +row.drift.toFixed(3);
            rows.push(row);
        }
        console.log(JSON.stringify({ x, done: rows.length }));
    }
    const settled = rows.filter(r => r.grounded && r.drift < 1);
    const gaps = settled.map(r => r.gap).sort((a, b) => a - b);
    const q = p => gaps[Math.min(gaps.length - 1, Math.floor(p * gaps.length))];
    const summary = {
        sampled: rows.length, settledAndGrounded: settled.length,
        gapMedian: q(0.5), gapP95: q(0.95), gapMax: gaps.at(-1), gapMin: gaps[0],
        above10mm: gaps.filter(g => g > 0.01).length,
        above50mm: gaps.filter(g => g > 0.05).length,
        below: gaps.filter(g => g < -0.01).length,
    };
    await fs.writeFile(out, JSON.stringify({
        url, note: 'gap = capsule bottom minus visual terrain height at the settled position. Positive means the player stands above the ground that is drawn.',
        step: STEP, span: SPAN, summary, rows, errors,
    }, null, 2));
    console.log(JSON.stringify(summary));
} catch (e) {
    console.error(e); process.exitCode = 1;
} finally {
    await context.close();
    await browser.close();
    await fs.writeFile(out + '.ownership.json', JSON.stringify({ ...ownership, active: false, renderingClients: 0 }, null, 2));
}
