/** M6/3: every published design on every published race, at a pinned camera and a frozen pose.
 *
 * 768 combinations agree with the resolver and twelve have been looked at. This is the looking
 * part: one still per design, race and view, all from the same camera with the idle clip held
 * at the same time, so the three races can be compared to each other rather than to memory.
 *
 * Framing is pinned rather than gameplay-driven on purpose. The gameplay camera pivots on the
 * feet, so a taller body reframes the shot and two stills stop being comparable.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { browserOwnership } from '../lib/browser-ownership.mjs';
import { EQUIPMENT_PRESETS, EQUIPMENT_ITEMS } from '../../src/ashen-reach/equipment-catalog.js';

const url = process.env.ASHEN_TEST_URL, port = process.env.ASHEN_CDP_PORT, out = process.argv[2];
assert(url && port && out, 'ASHEN_TEST_URL, ASHEN_CDP_PORT and an output directory are required');
const DESIGNS = (process.env.ASHEN_DESIGNS || 'wayfarer,graveweaver,pilgrim,lector,duskguard').split(',');
const RACES = (process.env.ASHEN_RACES || 'human,orc,undead').split(',');
const VIEWS = [['front', Math.PI], ['side', Math.PI * 0.5], ['back', 0]];
for (const design of DESIGNS) assert(EQUIPMENT_PRESETS[design], `unknown design ${design}`);

const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
assert(browser.contexts().flatMap(c => c.pages()).every(p => p.url() === 'about:blank'), 'Another owned page is active');
const ownership = await browserOwnership(browser, { cdpPort: port, url, purpose: 'M6/3 design x race visual matrix; stills only', renderingClients: 1 });
await fs.mkdir(out, { recursive: true });
await fs.writeFile(path.join(out, 'ownership.json'), JSON.stringify(ownership, null, 2));
const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 }),
    page = await context.newPage();
const rows = [], errors = [];
page.on('pageerror', e => errors.push(e.stack));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 400)); });

try {
    await page.goto(url);
    await page.waitForFunction(() => globalThis.ASHEN?.whenRest, null, { timeout: 120000 });
    await page.evaluate(() => ASHEN.whenRest);
    await page.evaluate(() => { ASHEN.dev.god = true; ASHEN.setView('play'); document.body.classList.add('clean'); });

    for (const race of RACES) {
        if (await page.evaluate(() => ASHEN.equipment.race) !== race) {
            const result = await page.evaluate(r => ASHEN.equipment.switchRace(r), race);
            assert.notEqual(result?.status, 'failed', `switchRace(${race}): ${result?.error}`);
            await page.evaluate(() => ASHEN.whenRest);
        }
        for (const design of DESIGNS) {
            const applied = await page.evaluate(d => ASHEN.equipment.equipPreset(d), design);
            assert.equal(applied.status, 'applied', `${race}/${design}: ${applied.error}`);
            await page.waitForTimeout(700);
            const worn = await page.evaluate(() => ASHEN.equipment.getState());
            // The preset is the claim; what the body is actually wearing is the evidence.
            for (const [slot, id] of Object.entries(EQUIPMENT_PRESETS[design].loadout)) {
                assert.equal(worn[slot] ?? null, id ?? null, `${race}/${design} ${slot} is ${worn[slot]}, not ${id}`);
            }
            // A part with hideWhenSlots is meant to disappear once that slot is filled -- the
            // trouser cuffs go under the boots -- so it is not an expected mesh here. Counting
            // it as one made all 45 rows report a missing part that is working correctly.
            const pieceMeshes = Object.values(worn).filter(Boolean)
                .flatMap(id => (EQUIPMENT_ITEMS[id].parts ?? [])
                    .filter(part => !part.hideWhenSlots?.some(slot => worn[slot]))
                    .map(part => part.mesh));
            for (const [view, yaw] of VIEWS) {
                await page.evaluate(y => {
                    ASHEN.rig.yaw = y; ASHEN.rig.pitch = 0.02;
                    ASHEN.rig.distance = ASHEN.rig.distanceTarget = 2.45;
                }, yaw);
                // One frozen pose for every still, so a difference between two of them is the
                // garment rather than the frame the gait happened to be on.
                await page.evaluate(() => {
                    for (const g of ASHEN.body.animationGroups) if (g.isPlaying && g.weight > 0.01) { g.currentTime = 0; g.speedRatio = 0; }
                });
                await page.waitForTimeout(450);
                const file = `${race}-${design}-${view}.png`;
                await page.screenshot({ path: path.join(out, file) });
                rows.push({
                    race, design, view, file, worn,
                    rendered: await page.evaluate(names => names.filter(n => ASHEN.scene.meshes.some(m => m.name === n && m.visible !== false)), pieceMeshes),
                    expected: pieceMeshes,
                    gpuErrors: await page.evaluate(() => ASHEN.gpu.errors.slice()),
                });
            }
            await page.evaluate(() => { for (const g of ASHEN.body.animationGroups) g.speedRatio = 1; });
        }
    }
    // Every piece of every design must actually draw; a still of an invisible garment reviews
    // nothing.
    const missing = rows.filter(r => r.expected.some(m => !r.rendered.includes(m)))
        .map(r => ({ race: r.race, design: r.design, view: r.view, absent: r.expected.filter(m => !r.rendered.includes(m)) }));
    await fs.writeFile(path.join(out, 'matrix.json'), JSON.stringify({
        url, conditions: 'Pinned camera (yaw per view, pitch 0.02, distance 2.45), idle clip frozen at 0, clean HUD, 1280x720, deviceScaleFactor 1.',
        designs: DESIGNS, races: RACES, views: VIEWS.map(v => v[0]), rows, missing, errors,
    }, null, 2));
    console.log(JSON.stringify({ stills: rows.length, missingParts: missing.length, errors: errors.length }));
    if (errors.length) process.exitCode = 1;
} catch (e) {
    console.error(e);
    process.exitCode = 1;
    await fs.writeFile(path.join(out, 'matrix.json'), JSON.stringify({ failure: e.stack, rows, errors }, null, 2));
} finally {
    await context.close();
    await browser.close();
    await fs.writeFile(path.join(out, 'ownership.json'), JSON.stringify({ ...ownership, active: false, renderingClients: 0 }, null, 2));
}
