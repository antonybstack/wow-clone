/** M6/4: the garment matrix at the supported body extremes, not only at the neutral body.
 *
 * Only the Human has a verified shape family, so "extremes" means the four corners of the
 * released domain -- height 0.90 and 1.15 against build -0.95 and +0.95 -- plus the neutral body
 * as a control. The Orc and Undead have no family, so their supported domain is the neutral body
 * and this says so rather than pretending to sweep it.
 *
 * The shape is reached the way a player reaches it: a saved appearance in storage, which is what
 * makes the production route load the shape family at all. The applied shape is then read back
 * from the running game and asserted, because a seed that silently failed would boot the neutral
 * body and every row would pass at a shape that was never applied.
 */
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import path from 'node:path';
import { chromium } from 'playwright';
import { browserOwnership } from '../lib/browser-ownership.mjs';
import { EQUIPMENT_ITEMS, EQUIPMENT_SLOTS, EQUIPMENT_PRESETS } from '../../src/ashen-reach/equipment-catalog.js';
import { resolveCoverage } from '../../src/ashen-reach/coverage-contract.js';
import { appearanceFromEquipment } from '../../src/character/appearance/from-equipment.js';
import { validateAppearance } from '../../src/character/appearance/contract.js';
import { encodeAppearance } from '../../src/character/appearance/codec.js';
import { APPEARANCE_STORAGE_KEY } from '../../src/character/appearance/store.js';

const url = process.env.ASHEN_TEST_URL, port = process.env.ASHEN_CDP_PORT, out = process.argv[2];
assert(url && port && out, 'ASHEN_TEST_URL, ASHEN_CDP_PORT and an output directory are required');

const SHAPES = [
    { id: 'neutral', height: 1, build: 0 },
    { id: 'tall-slender', height: 1.15, build: -0.95 },
    { id: 'tall-stout', height: 1.15, build: 0.95 },
    { id: 'short-slender', height: 0.9, build: -0.95 },
    { id: 'short-stout', height: 0.9, build: 0.95 },
];
const DESIGNS = ['wayfarer', 'graveweaver', 'pilgrim', 'lector', 'duskguard'];
const HAND_SLOTS = ['mainHand', 'offHand'];
const GARMENT_SLOTS = EQUIPMENT_SLOTS.filter(s => !HAND_SLOTS.includes(s));
const EMPTY = Object.fromEntries(EQUIPMENT_SLOTS.map(s => [s, null]));
const bySlot = Object.fromEntries(GARMENT_SLOTS.map(s => [s, [null, ...Object.values(EQUIPMENT_ITEMS).filter(i => i.slot === s).map(i => i.id)]]));
const loadouts = GARMENT_SLOTS.reduce((acc, s) => acc.flatMap(p => bySlot[s].map(id => ({ ...p, [s]: id }))), [{ ...EMPTY }]);

const savedAppearance = shape => {
    const base = appearanceFromEquipment({ race: 'human', loadout: EQUIPMENT_PRESETS.wayfarer.loadout });
    return encodeAppearance(validateAppearance({ ...base, shape: { ...base.shape, height: shape.height, build: shape.build } }));
};

const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
assert(browser.contexts().flatMap(c => c.pages()).every(p => p.url() === 'about:blank'), 'Another owned page is active');
const ownership = await browserOwnership(browser, { cdpPort: port, url, purpose: 'M6/4 garment matrix at the Human shape extremes', renderingClients: 1 });
await fs.mkdir(out, { recursive: true });
await fs.writeFile(path.join(out, 'ownership.json'), JSON.stringify(ownership, null, 2));
const perShape = {}, disagreements = [], errors = [];
const report = {
    url, combinations: loadouts.length, shapes: SHAPES,
    supportedDomain: {
        human: 'height 0.90-1.15 x build -0.95..0.95, the released production range',
        orc: 'neutral only: no verified shape family',
        undead: 'neutral only: no verified shape family',
    },
    conditions: 'Default production route with a saved appearance seeded in storage, one owned rendering client at a time.',
    perShape, disagreements, errors,
};

try {
    for (const shape of SHAPES) {
        const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
        await context.addInitScript(([key, value]) => {
            try { localStorage.setItem(key, value); } catch {}
        }, [APPEARANCE_STORAGE_KEY, savedAppearance(shape)]);
        const page = await context.newPage();
        page.on('pageerror', e => errors.push(e.stack));
        page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 300)); });
        try {
            await page.goto(url);
            await page.waitForFunction(() => globalThis.ASHEN?.whenRest, null, { timeout: 120000 });
            await page.evaluate(() => ASHEN.whenRest);
            await page.evaluate(() => { ASHEN.dev.god = true; document.body.classList.add('clean'); });

            // A seed that failed would boot the neutral body and every row below would pass at a
            // shape that was never applied. Read the applied shape back and require it.
            const applied = await page.evaluate(() => ASHEN.humanShape);
            const neutral = shape.height === 1 && shape.build === 0;
            if (neutral) {
                // The production route only loads the shape family when the saved appearance
                // actually departs from the default, so the neutral control legitimately has no
                // family at all. What it must not be is some other shape.
                if (applied) {
                    assert.equal(+applied.heightScale.toFixed(4), 1, 'the neutral control is not at height 1');
                    assert.deepEqual(applied.weights.map(w => +w.toFixed(4)), [0, 0], 'the neutral control carries a build weight');
                }
            } else {
                // A seed that failed would boot the neutral body and every row below would pass
                // at a shape that was never applied.
                assert(applied, `${shape.id}: the shape family did not load, so nothing was applied`);
                assert.equal(+applied.heightScale.toFixed(4), shape.height, `${shape.id}: height is ${applied.heightScale}`);
                const expectedWeights = [Math.max(0, -shape.build), Math.max(0, shape.build)];
                assert.deepEqual(applied.weights.map(w => +w.toFixed(4)), expectedWeights, `${shape.id}: weights are ${JSON.stringify(applied.weights)}`);
            }

            const liveSegments = await page.evaluate(() => ASHEN.equipment.getBodySegments());
            const bodyMeshes = Object.keys(liveSegments);
            const hiddenSets = new Set();
            let checked = 0;
            const started = Date.now();
            for (let i = 0; i < loadouts.length; i += 24) {
                const batch = loadouts.slice(i, i + 24);
                const observed = await page.evaluate(async ([group, names]) => {
                    const results = [];
                    for (const loadout of group) {
                        const r = await ASHEN.equipment.setLoadout(loadout);
                        while (ASHEN.equipment.getStatus?.()?.pending) await new Promise(requestAnimationFrame);
                        const inScene = new Map((ASHEN.scene.meshes || []).map(m => [m.name, m]));
                        results.push({
                            status: r.status,
                            present: names.filter(n => inScene.has(n)).sort(),
                            drawn: names.filter(n => inScene.has(n) && inScene.get(n).visible !== false).sort(),
                            gpu: ASHEN.gpu.errors.length, gpuFirst: ASHEN.gpu.errors.slice(0, 2),
                        });
                    }
                    return results;
                }, [batch, bodyMeshes]);
                for (let j = 0; j < batch.length; j++) {
                    const loadout = batch[j], seen = observed[j];
                    if (seen.status !== 'applied') { disagreements.push({ shape: shape.id, loadout, kind: 'REFUSED', status: seen.status }); continue; }
                    assert.equal(seen.gpu, 0, `GPU errors at ${shape.id} ${JSON.stringify(loadout)}: ${JSON.stringify(seen.gpuFirst)}`);
                    const expected = resolveCoverage(loadout, EQUIPMENT_ITEMS, 'human', liveSegments).hiddenMeshes.filter(n => seen.present.includes(n)).sort();
                    hiddenSets.add(JSON.stringify(expected));
                    const actual = seen.present.filter(n => !seen.drawn.includes(n)).sort();
                    if (JSON.stringify(actual) !== JSON.stringify(expected)) disagreements.push({ shape: shape.id, loadout, kind: 'COVERAGE', expected, actual });
                    checked++;
                }
            }
            // Stills for review, at the same pinned camera as the design matrix.
            const stills = [];
            for (const design of DESIGNS) {
                const r = await page.evaluate(d => ASHEN.equipment.equipPreset(d), design);
                assert.equal(r.status, 'applied', `${shape.id}/${design}: ${r.error}`);
                await page.waitForTimeout(500);
                for (const [view, yaw] of [['front', Math.PI], ['back', 0]]) {
                    await page.evaluate(y => { ASHEN.rig.yaw = y; ASHEN.rig.pitch = 0.02; ASHEN.rig.distance = ASHEN.rig.distanceTarget = 2.45; }, yaw);
                    await page.evaluate(() => { for (const g of ASHEN.body.animationGroups) if (g.isPlaying && g.weight > 0.01) { g.currentTime = 0; g.speedRatio = 0; } });
                    await page.waitForTimeout(400);
                    const file = `${shape.id}-${design}-${view}.png`;
                    await page.screenshot({ path: path.join(out, file) });
                    stills.push(file);
                }
                await page.evaluate(() => { for (const g of ASHEN.body.animationGroups) g.speedRatio = 1; });
            }
            perShape[shape.id] = { requested: shape, applied, bodyMeshes, checked, hiddenSets: hiddenSets.size, stills: stills.length, seconds: +((Date.now() - started) / 1000).toFixed(1) };
            console.log(JSON.stringify({ shape: shape.id, ...perShape[shape.id], disagreements: disagreements.length }));
        } finally { await context.close(); }
    }
    report.passed = disagreements.length === 0 && errors.length === 0;
} catch (e) {
    report.failure = e.stack;
    console.error(e);
} finally {
    if (!report.passed) process.exitCode = 1;
    report.summary = { shapes: Object.keys(perShape).length, disagreements: disagreements.length, consoleErrors: errors.length };
    await fs.writeFile(path.join(out, 'extremes.json'), JSON.stringify(report, null, 2));
    await browser.close();
    await fs.writeFile(path.join(out, 'ownership.json'), JSON.stringify({ ...ownership, active: false, renderingClients: 0 }, null, 2));
    console.log(JSON.stringify(report.summary));
}
