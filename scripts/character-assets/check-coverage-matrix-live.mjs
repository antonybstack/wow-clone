/** M6/5: the coverage contract checked against the running engine for every garment combination.
 *
 * `measure-coverage-matrix.mjs` resolves the whole catalogue offline, and `check-coverage-live.mjs`
 * drives the engine -- but only over eight hand-picked loadouts, chosen before the shoulders slot
 * and the Lector and Duskguard pieces existed. So the rule is exhaustive and the engine check is
 * not, which is the wrong way round: a resolver that agrees with itself proves nothing about what
 * the player sees.
 *
 * This drives every garment combination on every race and compares the body meshes the engine
 * actually draws with what the resolver predicted it would hide. Hand props are excluded because
 * they carry no coverage segments at all -- that is asserted here rather than assumed.
 *
 * Batched through one evaluate per group: 864 combinations per race is 2,592 commits, and a
 * round trip each would dominate the run.
 */
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { browserOwnership } from '../lib/browser-ownership.mjs';
import { EQUIPMENT_ITEMS, EQUIPMENT_SLOTS } from '../../src/ashen-reach/equipment-catalog.js';
import { RACE_BODY_SEGMENTS, itemSegments, resolveCoverage } from '../../src/ashen-reach/coverage-contract.js';

const url = process.env.ASHEN_TEST_URL, port = process.env.ASHEN_CDP_PORT, out = process.argv[2];
assert(url && port && out, 'ASHEN_TEST_URL, ASHEN_CDP_PORT and an output path are required');
const RACES = (process.env.ASHEN_RACES || 'human,orc,undead').split(',');
const BATCH = Number(process.env.ASHEN_BATCH || 24);

const HAND_SLOTS = ['mainHand', 'offHand'];
const GARMENT_SLOTS = EQUIPMENT_SLOTS.filter(slot => !HAND_SLOTS.includes(slot));
// Asserted, not assumed: if a hand item ever claims a body segment, this sweep's scope is wrong.
for (const item of Object.values(EQUIPMENT_ITEMS)) {
    if (!HAND_SLOTS.includes(item.slot)) continue;
    assert.deepEqual(itemSegments(item) ?? [], [], `${item.id} claims coverage, so hand slots cannot be excluded`);
}
const EMPTY = Object.fromEntries(EQUIPMENT_SLOTS.map(slot => [slot, null]));
const bySlot = Object.fromEntries(GARMENT_SLOTS.map(slot => [slot, [null, ...Object.values(EQUIPMENT_ITEMS).filter(i => i.slot === slot).map(i => i.id)]]));
const loadouts = GARMENT_SLOTS.reduce((acc, slot) =>
    acc.flatMap(partial => bySlot[slot].map(id => ({ ...partial, [slot]: id }))), [{ ...EMPTY }]);

const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
assert(browser.contexts().flatMap(c => c.pages()).every(p => p.url() === 'about:blank'), 'Another owned page is active');
const ownership = await browserOwnership(browser, { cdpPort: port, url, purpose: 'M6/5 live coverage over every garment combination', renderingClients: 1 });
await fs.writeFile(out + '.ownership.json', JSON.stringify(ownership, null, 2));
const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 }),
    page = await context.newPage();
const disagreements = [], errors = [], perRace = {};
const report = {
    url,
    conditions: `Default production route, one owned rendering client, functional only. ${loadouts.length} garment combinations per race; hand slots excluded because no hand item claims a body segment.`,
    combinations: loadouts.length, races: RACES, perRace, disagreements, errors,
};
page.on('pageerror', e => errors.push(e.stack));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 400)); });

try {
    await page.goto(url);
    await page.waitForFunction(() => globalThis.ASHEN?.whenRest, null, { timeout: 120000 });
    await page.evaluate(() => ASHEN.whenRest);
    await page.evaluate(() => { ASHEN.dev.god = true; });

    for (const race of RACES) {
        if (await page.evaluate(() => ASHEN.equipment.race) !== race) {
            const result = await page.evaluate(r => ASHEN.equipment.switchRace(r), race);
            assert.notEqual(result?.status, 'failed', `switchRace(${race}): ${result?.error}`);
            await page.evaluate(() => ASHEN.whenRest);
        }
        // The segment map the engine is driving, not the static fallback. A published coverage
        // manifest replaces RACE_BODY_SEGMENTS, and the running game carries body meshes the
        // constant does not list -- HumanTorsoCore and UndeadTorsoCore -- so reading the
        // constant made the Human and Undead comparisons empty on both sides.
        const liveSegments = await page.evaluate(() => ASHEN.equipment.getBodySegments());
        assert(liveSegments && Object.keys(liveSegments).length, `${race} exposes no body segment map`);
        const bodyMeshes = Object.keys(liveSegments);
        const fallbackOnly = Object.keys(RACE_BODY_SEGMENTS[race]).filter(n => !bodyMeshes.includes(n));
        const liveOnly = bodyMeshes.filter(n => !Object.keys(RACE_BODY_SEGMENTS[race]).includes(n));
        perRace[race] = { bodyMeshes, liveOnly, fallbackOnly };
        let checked = 0, refused = 0;
        // How many distinct hidden-mesh sets the resolver predicts across the sweep. One means
        // the comparison is the same on both sides every time and proves nothing for this race.
        const hiddenSets = new Set();
        const started = Date.now();
        for (let i = 0; i < loadouts.length; i += BATCH) {
            const batch = loadouts.slice(i, i + BATCH);
            const observed = await page.evaluate(async ([group, names]) => {
                const results = [];
                for (const loadout of group) {
                    const applied = await ASHEN.equipment.setLoadout(loadout);
                    // The commit can land a tick after the request resolves.
                    while (ASHEN.equipment.getStatus?.()?.pending) await new Promise(requestAnimationFrame);
                    const inScene = new Map((ASHEN.scene.meshes || []).map(m => [m.name, m]));
                    results.push({
                        status: applied.status, error: applied.error ?? null,
                        // A mesh can keep visible:true after eviction, so membership is required too.
                        present: names.filter(n => inScene.has(n)).sort(),
                        drawn: names.filter(n => inScene.has(n) && inScene.get(n).visible !== false).sort(),
                        gpuErrors: ASHEN.gpu.errors.length,
                    });
                }
                return results;
            }, [batch, bodyMeshes]);

            for (let j = 0; j < batch.length; j++) {
                const loadout = batch[j], seen = observed[j];
                if (seen.status !== 'applied') {
                    refused++;
                    disagreements.push({ race, loadout, kind: 'REFUSED', status: seen.status, error: seen.error });
                    continue;
                }
                assert.equal(seen.gpuErrors, 0, `GPU errors at ${JSON.stringify(loadout)}`);
                const predicted = resolveCoverage(loadout, EQUIPMENT_ITEMS, race, liveSegments);
                const actuallyHidden = seen.present.filter(n => !seen.drawn.includes(n)).sort();
                let expectedHidden = predicted.hiddenMeshes.filter(n => seen.present.includes(n)).sort();
                hiddenSets.add(JSON.stringify(expectedHidden));
                // ASHEN_CONTROL inverts the prediction against the same build. A sweep that
                // still reports zero disagreements under it is not comparing anything, which is
                // how the first version of this check passed 864 Human rows while both sides
                // were empty. The control must fail; the real run must not.
                if (process.env.ASHEN_CONTROL) expectedHidden = seen.present.filter(n => !expectedHidden.includes(n)).sort();
                if (JSON.stringify(actuallyHidden) !== JSON.stringify(expectedHidden)) {
                    disagreements.push({ race, loadout, kind: 'COVERAGE', expectedHidden, actuallyHidden, present: seen.present });
                }
                checked++;
            }
            if (i % (BATCH * 10) === 0) console.log(JSON.stringify({ race, done: i + batch.length, of: loadouts.length, disagreements: disagreements.length }));
        }
        Object.assign(perRace[race], { checked, refused, hiddenSets: hiddenSets.size, seconds: +((Date.now() - started) / 1000).toFixed(1) });
        console.log(JSON.stringify({ race, ...perRace[race], disagreements: disagreements.length }));
    }
    report.passed = disagreements.length === 0 && errors.length === 0;
} catch (e) {
    report.failure = e.stack;
    console.error(e);
} finally {
    if (!report.passed) process.exitCode = 1;
    report.summary = { combinations: loadouts.length, races: RACES.length, disagreements: disagreements.length, consoleErrors: errors.length };
    await fs.writeFile(out, JSON.stringify(report, null, 2));
    await context.close();
    await browser.close();
    await fs.writeFile(out + '.ownership.json', JSON.stringify({ ...ownership, active: false, renderingClients: 0 }, null, 2));
    console.log(JSON.stringify(report.summary));
}
