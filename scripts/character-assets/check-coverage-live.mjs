/**
 * M007 live check: does the semantic resolver predict what the engine actually draws?
 *
 * `coverage-contract.js` says which body meshes a loadout may hide. That is a claim about
 * the running game, and this is where it gets tested against it rather than against itself:
 * for each loadout the probe equips the pieces for real, reads which body meshes are in the
 * scene and visible, and compares that with the prediction.
 *
 * It also covers the two behaviours the milestone names that only a running game can show:
 * a failed request must leave the last committed appearance alone, and rapid swaps must
 * settle on the last request rather than on whichever load happened to finish last.
 *
 * A mesh's `visible` flag alone is not proof it renders -- an evicted mesh keeps it -- so
 * membership of `scene.meshes` is required too.
 *
 * Run alone on an owned harness slot.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {chromium} from 'playwright';
import {EQUIPMENT_ITEMS} from '../../src/ashen-reach/equipment-catalog.js';
import {RACE_BODY_SEGMENTS, loadoutSeams, resolveCoverage} from '../../src/ashen-reach/coverage-contract.js';

const port = Number(process.env.ASHEN_CDP_PORT), url = process.env.ASHEN_URL;
if (!port || !url) throw Error('ASHEN_CDP_PORT and ASHEN_URL required');
const requestedRace = process.env.ASHEN_RACE || 'human';
if (!Object.hasOwn(RACE_BODY_SEGMENTS, requestedRace)) throw Error(`No coverage adapter for ${requestedRace}`);
const base = url.split('?')[0];
const out = process.env.ASHEN_CAPTURE_DIR || `ve-capture/character-mmo/m007/live/${requestedRace}`;
const report = process.env.ASHEN_COVERAGE_LIVE_REPORT || `docs/baselines/character-mmo/m007/live-coverage-${requestedRace}.json`;

const EMPTY = {helmet: null, torso: null, legs: null, boots: null, gloves: null, mainHand: null, offHand: null};
const CASES = [
    {id: 'bare', loadout: {...EMPTY}},
    {id: 'wayfarer', loadout: {...EMPTY, torso: 'wayfarerTunic', legs: 'wayfarerTrousers', boots: 'wayfarerBoots', mainHand: 'ironSword'}},
    {id: 'graveweaver', loadout: {...EMPTY, helmet: 'graveweaverHood', torso: 'graveweaverTop', legs: 'graveweaverSkirt', boots: 'wayfarerBoots', gloves: 'graveweaverGloves', mainHand: 'graveweaverStaff', offHand: 'graveweaverBook'}},
    // Cross-set: pieces from different outfits worn together, which is the point of M007.
    {id: 'cross-hood-wayfarer', loadout: {...EMPTY, helmet: 'graveweaverHood', torso: 'wayfarerTunic', legs: 'wayfarerTrousers', boots: 'wayfarerBoots'}},
    {id: 'cross-pilgrim-skirt', loadout: {...EMPTY, torso: 'pilgrimTunic', legs: 'graveweaverSkirt', boots: 'wayfarerBoots', gloves: 'graveweaverGloves'}},
    {id: 'no-helmet-no-gloves', loadout: {...EMPTY, torso: 'graveweaverTop', legs: 'wayfarerTrousers', boots: 'wayfarerBoots'}},
    // Trousers with no boots: the cuff part is the short-versus-tall case the brief names.
    {id: 'cuffs-no-boots', loadout: {...EMPTY, torso: 'wayfarerTunic', legs: 'wayfarerTrousers'}},
    {id: 'two-handed', loadout: {...EMPTY, torso: 'graveweaverTop', legs: 'graveweaverSkirt', boots: 'wayfarerBoots', mainHand: 'graveweaverGreatstaff'}},
];

await fs.mkdir(out, {recursive: true});
const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
const pages = browser.contexts().flatMap(c => c.pages());
const page = pages.find(p => p.url().startsWith(base)) ?? pages[0];
if (!page) throw Error('No owned page in this harness slot');

const errors = [];
page.on('pageerror', e => errors.push(String(e.message ?? e)));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

const rows = [];
try {
    await page.setViewportSize({width: 1280, height: 720});
    await page.goto(`${base}?play&clean&pixelRatio=1`);
    await page.waitForFunction(() => globalThis.ASHEN?.whenPlayable, null, {timeout: 90000});
    await page.evaluate(() => ASHEN.whenRest);
    if (requestedRace !== 'human') await page.evaluate(race => ASHEN.equipment.switchRace(race), requestedRace);
    const race = await page.evaluate(() => ASHEN.equipment.race);
    assert.equal(race, requestedRace);
    const bodyMeshes = Object.keys(RACE_BODY_SEGMENTS[race]);

    for (const test of CASES) {
        const applied = await page.evaluate(l => ASHEN.equipment.setLoadout(l), test.loadout);
        await page.waitForFunction(() => !ASHEN.equipment.getStatus?.()?.pending, null, {timeout: 30000});
        assert.equal(applied.status, 'applied', `${test.id}: ${JSON.stringify(applied)}`);

        const observed = await page.evaluate((names) => {
            const inScene = new Map((ASHEN.scene.meshes || []).map(m => [m.name, m]));
            return names.map(name => ({
                name,
                inScene: inScene.has(name),
                // A mesh can keep visible:true after eviction, so membership is required too.
                visible: inScene.has(name) ? inScene.get(name).visible !== false : false,
            }));
        }, bodyMeshes);

        const predicted = resolveCoverage(test.loadout, EQUIPMENT_ITEMS, race);
        const drawn = observed.filter(m => m.inScene && m.visible).map(m => m.name).sort();
        const predictedHidden = predicted.hiddenMeshes;
        const present = observed.filter(m => m.inScene).map(m => m.name).sort();
        const actuallyHidden = present.filter(name => !drawn.includes(name)).sort();

        assert.deepEqual(actuallyHidden, predictedHidden.filter(m => present.includes(m)),
            `${test.id}: predicted hidden ${JSON.stringify(predictedHidden)} but engine hid ${JSON.stringify(actuallyHidden)}`);

        await page.screenshot({path: path.join(out, `${test.id}.png`)});
        rows.push({
            ...test,
            seams: loadoutSeams(test.loadout).map(s => `${s.seam}:${s.slots.join('+')}`),
            predictedHidden,
            predictedExceptions: predicted.exceptions.map(e => ({code: e.code, mesh: e.mesh ?? e.segment, reason: e.reason})),
            bodyMeshesInScene: present,
            actuallyHidden,
        });
        console.log(`${test.id.padEnd(20)} seams=${rows.at(-1).seams.length} hidden=${actuallyHidden.join(',') || '(none)'} `
            + `exceptions=${predicted.exceptions.length}`);
    }

    // A failed request must not disturb the committed appearance.
    const failed = await page.evaluate(async () => {
        const before = ASHEN.equipment.getState();
        const result = await ASHEN.equipment.equip('torso', 'noSuchItemM007');
        return {before, result, after: ASHEN.equipment.getState()};
    });
    assert.equal(failed.result.status, 'failed');
    assert.deepEqual(failed.after, failed.before, 'a failed request changed the committed loadout');

    // Rapid swaps must settle on the last request, not on whichever load finished last.
    const swapped = await page.evaluate(async () => {
        const requests = ['wayfarerTunic', 'pilgrimTunic', 'graveweaverTop', 'wayfarerTunic', 'pilgrimTunic'];
        const pending = requests.map(id => ASHEN.equipment.equip('torso', id));
        const results = await Promise.all(pending);
        return {requests, statuses: results.map(r => r.status), final: ASHEN.equipment.getState().torso};
    });
    assert.equal(swapped.final, swapped.requests.at(-1),
        `rapid swaps settled on ${swapped.final}, not the last request ${swapped.requests.at(-1)}`);

    await fs.mkdir(path.dirname(report), {recursive: true});
    await fs.writeFile(report, `${JSON.stringify({
        schema: 1, url: base, race, bodyMeshes, cases: rows,
        failedRequest: {status: failed.result.status, loadoutUnchanged: true},
        rapidSwap: swapped,
        errors,
    }, null, 1)}\n`);
    console.log(`failed request preserved the loadout; rapid swaps settled on ${swapped.final} (${swapped.statuses.join(',')})`);
    assert.deepEqual(errors, [], 'page errors');
    console.log(`wrote ${report}`);
} finally {
    await page.goto('about:blank').catch(() => {});
    await browser.close();
}
