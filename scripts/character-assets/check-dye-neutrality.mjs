/** M7/4: a dye must change the colour of a piece and nothing else.
 *
 * The dye is a `baseColorFactor`, so it should leave geometry, coverage and mesh membership
 * untouched. That is a claim about the running game, and this is where it is tested against it:
 * for every dyeable slot on every race, the piece is dyed and everything milestone 6 gated is
 * re-read and compared.
 *
 * The colour change is asserted as well. Without it the check passes trivially whenever the dye
 * silently fails to apply, which is the one way a neutrality test can lie.
 */
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { chromium } from 'playwright';
import { browserOwnership } from '../lib/browser-ownership.mjs';
import { EQUIPMENT_ITEMS, EQUIPMENT_SLOTS } from '../../src/ashen-reach/equipment-catalog.js';
import { resolveCoverage } from '../../src/ashen-reach/coverage-contract.js';

const url = process.env.ASHEN_TEST_URL, port = process.env.ASHEN_CDP_PORT, out = process.argv[2];
assert(url && port && out, 'ASHEN_TEST_URL, ASHEN_CDP_PORT and an output path are required');
const RACES = (process.env.ASHEN_RACES || 'human,orc,undead').split(',');
// The two entries the palette measurement showed separate most strongly, so a dye that fails to
// apply cannot hide inside capture noise.
const DYES = (process.env.ASHEN_DYES || 'oxblood,moss').split(',');
const DYEABLE = EQUIPMENT_SLOTS.filter(slot => Object.values(EQUIPMENT_ITEMS).some(i => i.slot === slot && i.parts?.length));
const CLIP = { x: 520, y: 250, width: 240, height: 320 };

const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
assert(browser.contexts().flatMap(c => c.pages()).every(p => p.url() === 'about:blank'), 'Another owned page is active');
const ownership = await browserOwnership(browser, { cdpPort: port, url, purpose: 'M7/4 dye neutrality against the milestone 6 gates', renderingClients: 1 });
await fs.writeFile(out + '.ownership.json', JSON.stringify(ownership, null, 2));
const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 }), page = await context.newPage();
const rows = [], failures = [], errors = [];
const report = { url, dyes: DYES, slots: DYEABLE, races: RACES, rows, failures, errors };
page.on('pageerror', e => errors.push(e.stack));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 300)); });

/** Mean sRGB of the crop. Chosen over counting changed pixels after measuring both on the
 *  weakest case, a dyed pauldron: the mean shifts 0.286 against 0.021 of capture noise, a 13.6x
 *  separation, while the changed-pixel share moves only 3.57% to 4.67%. The scene's motes and
 *  grass are symmetric noise that a mean averages away, whereas a dye shifts a whole region in
 *  one direction, so the mean survives the piece being small. */
const meanRgb = async () => {
    const buffer = await page.screenshot({ clip: CLIP });
    const { data, info } = await sharp(buffer).raw().toBuffer({ resolveWithObject: true });
    let r = 0, g = 0, b = 0, n = 0;
    for (let i = 0; i < data.length; i += info.channels) { r += data[i]; g += data[i + 1]; b += data[i + 2]; n++; }
    return [r / n, g / n, b / n];
};
const apart = (a, b) => +Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]).toFixed(4);
/** Everything milestone 6 gated, read in one evaluate so both sides share a frame. */
const observe = (page, bodyMeshes) => page.evaluate(names => ({
    equip: ASHEN.equipment.getState(),
    dyes: ASHEN.equipment.getDyes(),
    visible: ASHEN.scene.meshes.filter(m => m.visible !== false && m.isEnabled?.() !== false).map(m => m.name).sort(),
    present: names.filter(n => ASHEN.scene.meshes.some(m => m.name === n)).sort(),
    drawn: names.filter(n => ASHEN.scene.meshes.some(m => m.name === n && m.visible !== false)).sort(),
    meshes: ASHEN.scene.meshes.length,
    triangles: ASHEN.metrics.summary().sceneTriangles,
    gpu: ASHEN.gpu.errors.length,
}), bodyMeshes);

try {
    await page.goto(url);
    await page.waitForFunction(() => globalThis.ASHEN?.whenRest, null, { timeout: 120000 });
    await page.evaluate(() => ASHEN.whenRest);
    await page.evaluate(() => { ASHEN.dev.god = true; });

    for (const race of RACES) {
        if (await page.evaluate(() => ASHEN.equipment.race) !== race) {
            const switched = await page.evaluate(r => ASHEN.equipment.switchRace(r), race);
            assert.notEqual(switched?.status, 'failed', `switchRace(${race}): ${switched?.error}`);
            await page.evaluate(() => ASHEN.whenRest);
        }
        const segments = await page.evaluate(() => ASHEN.equipment.getBodySegments());
        const bodyMeshes = Object.keys(segments);
        for (const slot of DYEABLE) {
            const item = Object.entries(EQUIPMENT_ITEMS).find(([, i]) => i.slot === slot)?.[0];
            const worn = await page.evaluate(([s, i]) => ASHEN.equipment.equip(s, i), [slot, item]);
            assert.equal(worn.status, 'applied', `${race}/${slot}: ${worn.error}`);
            await page.evaluate(([i]) => ASHEN.equipment.setDye(i, null), [item]);
            await page.waitForTimeout(700);
            await page.evaluate(() => { for (const g of ASHEN.body.animationGroups) if (g.isPlaying && g.weight > 0.01) { g.currentTime = 0; g.speedRatio = 0; } });
            await page.evaluate(() => { ASHEN.rig.yaw = Math.PI; ASHEN.rig.pitch = 0.03; });
            await page.waitForTimeout(600);

            // Capture noise, characterised rather than sampled once. The scene's motes and
            // grass keep moving, so a single pair lands anywhere between 0.003 and 0.06 and a
            // threshold built on one sample fails whenever that sample is unlucky -- which is
            // exactly how six rows failed with the dye plainly applied. Take the worst of
            // several pairs so the bar reflects the real ceiling.
            const noiseSamples = [];
            let previous = await meanRgb();
            for (let i = 0; i < 4; i++) {
                await page.waitForTimeout(420);
                const next = await meanRgb();
                noiseSamples.push(apart(previous, next));
                previous = next;
            }
            const noise = Math.max(...noiseSamples);
            const before = await observe(page, bodyMeshes);
            const beforeRgb = await meanRgb();

            for (const dye of DYES) {
                const row = { race, slot, item, dye, noise, noiseSamples };
                try {
                    const applied = await page.evaluate(([i, d]) => ASHEN.equipment.setDye(i, d), [item, dye]);
                    assert.equal(applied.status, 'applied', `${dye}: ${applied.error}`);
                    await page.waitForTimeout(600);
                    const after = await observe(page, bodyMeshes);
                    const moved = apart(beforeRgb, await meanRgb());
                    Object.assign(row, { moved, triangles: [before.triangles, after.triangles], meshes: [before.meshes, after.meshes] });

                    // The dye happened at all.
                    assert.equal(after.dyes[item], dye, `${item} does not record ${dye}`);
                    // Relative to the measured noise, with a small absolute floor for the
                    // capture's own quantisation. An absolute floor of 0.5 was the earlier
                    // mistake: it is a whole-body figure that no small piece can reach.
                    const floor = Math.max(noise * 2.5, 0.12);
                    row.floor = +floor.toFixed(4);
                    row.margin = +(moved / floor).toFixed(2);
                    assert(moved > floor, `${dye} shifted the crop mean by ${moved}, under the ${floor.toFixed(4)} floor set by ${noise} capture noise`);
                    // And changed nothing else.
                    assert.equal(after.equip[slot], item, 'the dye lost the piece');
                    assert.deepEqual(after.visible, before.visible, 'the dye changed which meshes render');
                    // Not an equality: a piece swapped a moment earlier may still be awaiting
                    // disposal, so the count can legitimately settle between the two reads. What
                    // must not happen is growth across repeated dyes, which the plateau below
                    // covers.
                    assert.equal(after.triangles, before.triangles, 'the dye changed the triangle count');
                    assert.equal(after.gpu, 0, 'GPU errors after dyeing');
                    // Coverage still agrees with the resolver on the dyed body.
                    const expected = resolveCoverage(after.equip, EQUIPMENT_ITEMS, race, segments).hiddenMeshes.filter(n => after.present.includes(n)).sort();
                    const actual = after.present.filter(n => !after.drawn.includes(n)).sort();
                    assert.deepEqual(actual, expected, 'the dye changed what coverage hides');
                    row.passed = true;
                } catch (error) {
                    row.passed = false; row.error = error.message;
                    failures.push({ race, slot, dye, error: error.message });
                } finally {
                    rows.push(row);
                    await fs.writeFile(out, JSON.stringify(report, null, 2));
                    console.log(JSON.stringify({ race, slot, dye, passed: row.passed, moved: row.moved, noise, err: row.error }));
                }
            }
            // Repeated dyes must not accumulate meshes. The rebuild path forgets and re-equips,
            // so a missed disposal would show here rather than in a single transition.
            const counts = [];
            for (const dye of [...DYES, null, ...DYES, null]) {
                await page.evaluate(([i, d]) => ASHEN.equipment.setDye(i, d), [item, dye]);
                await page.waitForTimeout(260);
                counts.push(await page.evaluate(() => ASHEN.scene.meshes.length));
            }
            const plateau = counts.slice(2).every(n => n === counts[2]);
            rows.push({ race, slot, item, case: 'plateau', counts, passed: plateau });
            if (!plateau) failures.push({ race, slot, case: 'plateau', error: `mesh growth across dyes: ${counts}` });
            console.log(JSON.stringify({ race, slot, case: 'plateau', counts, passed: plateau }));
            await page.evaluate(([i]) => ASHEN.equipment.setDye(i, null), [item]);
            await page.evaluate(() => { for (const g of ASHEN.body.animationGroups) g.speedRatio = 1; });
        }
    }
    report.passed = failures.length === 0 && errors.length === 0;
} catch (e) {
    report.failure = e.stack; console.error(e);
} finally {
    if (!report.passed) process.exitCode = 1;
    report.summary = { rows: rows.length, failed: failures.length, consoleErrors: errors.length };
    await fs.writeFile(out, JSON.stringify(report, null, 2));
    await context.close(); await browser.close();
    await fs.writeFile(out + '.ownership.json', JSON.stringify({ ...ownership, active: false, renderingClients: 0 }, null, 2));
    console.log(JSON.stringify(report.summary));
}
