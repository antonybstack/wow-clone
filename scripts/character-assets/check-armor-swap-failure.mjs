/** M6/2: a failed or superseded piece change must leave the committed appearance intact.
 *
 * The existing proof covered one slot on one race -- a corrupt Duskguard cuirass on the Human.
 * This extends it to every slot that has a network asset, on all three published races, and
 * adds the two cases a player actually produces: clicking faster than the loader, and asking
 * for something that does not exist.
 *
 * Injecting a failure is harder than routing a URL. The loader memoises a prepared piece above
 * its own bounded residency cache, and the browser answers a second fetch from its HTTP cache,
 * so a route installed after the piece has once loaded is simply never taken -- the test would
 * pass having proved nothing. Every injected case therefore runs in a fresh browser context,
 * with the HTTP cache disabled, against pieces that context has never loaded, and asserts the
 * route was actually hit. A piece a race loads at boot cannot be made un-fetched that way, and
 * is recorded as untestable rather than skipped quietly.
 */
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { browserOwnership } from '../lib/browser-ownership.mjs';
import { EQUIPMENT_ITEMS, EQUIPMENT_SLOTS } from '../../src/ashen-reach/equipment-catalog.js';

const url = process.env.ASHEN_TEST_URL, port = process.env.ASHEN_CDP_PORT, out = process.argv[2];
assert(url && port && out, 'ASHEN_TEST_URL, ASHEN_CDP_PORT and an output path are required');
const onlyRaces = process.env.ASHEN_ONLY_RACES ? new Set(process.env.ASHEN_ONLY_RACES.split(',')) : null;

const RACES = ['human', 'orc', 'undead'];
/** Which request belongs to a piece, decided from the request rather than predicted.
 *
 * Predicting the URL from a manifest on disk does not work: the default route boots from the
 * startup pack, so the same piece is served from /startup/character/ for one item and
 * /equipment/ for another, and a route built from the wrong manifest is never taken. The id is
 * in the file name in every pack, so the handler reads it off the request. */
const isPieceRequest = (requestUrl, id) => {
    const file = new URL(requestUrl).pathname.split('/').pop();
    return file.startsWith(id) && /^[-.]/.test(file.slice(id.length) || '.');
};
// Rigid authored hand props have real delivery; only procedural props have no
// response to corrupt. Keep all items in the storm rotation below.
const GEOMETRY_SLOTS = EQUIPMENT_SLOTS.filter(slot => Object.values(EQUIPMENT_ITEMS).some(item => item.slot === slot && (item.parts?.length||item.asset)));
const ROTATION = Object.fromEntries(EQUIPMENT_SLOTS.map(slot =>
    [slot, Object.entries(EQUIPMENT_ITEMS).filter(([, i]) => i.slot === slot).map(([id]) => id)]));

const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
assert(browser.contexts().flatMap(c => c.pages()).every(p => p.url() === 'about:blank'), 'Another owned page is active');
const ownership = await browserOwnership(browser, { cdpPort: port, url, purpose: 'M6/2 swap failure and storm correctness; functional only', renderingClients: 1 });
await fs.writeFile(out + '.ownership.json', JSON.stringify(ownership, null, 2));
const rows = [], failures = [], errors = [], untestable = [];
const report = { url, conditions: 'Default production route, one owned rendering client at a time, functional only. No FPS claim.', rows, failures, untestable, errors };

/** One rendering client at a time: a fresh context, used, then closed. */
const openClient = async () => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    page.on('pageerror', e => errors.push(e.stack));
    // An injected 500 and a deliberately corrupt GLB both log; those are the point of the test.
    page.on('console', m => {
        const text = m.text();
        if (m.type() === 'error' && !/50\d|corrupt|Unable to load|Failed to fetch|NetworkError|Invalid glTF|magic/i.test(text)) errors.push(text.slice(0, 400));
    });
    const cdp = await context.newCDPSession(page);
    await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
    await page.goto(url);
    await page.waitForFunction(() => globalThis.ASHEN?.whenRest, null, { timeout: 120000 });
    await page.evaluate(() => ASHEN.whenRest);
    await page.evaluate(() => { ASHEN.dev.god = true; });
    return { context, page };
};
const settleRace = async (page, race) => {
    if (await page.evaluate(() => ASHEN.equipment.race) === race) return;
    const result = await page.evaluate(r => ASHEN.equipment.switchRace(r), race);
    assert.notEqual(result?.status, 'failed', `switchRace(${race}): ${result?.error}`);
    await page.waitForFunction(() => globalThis.ASHEN?.whenRest, null, { timeout: 120000 });
    await page.evaluate(() => ASHEN.whenRest);
};
const snapshot = page => page.evaluate(() => ({
    equip: ASHEN.equipment.getState(),
    cached: ASHEN.equipment.getStatus?.()?.cached?.slice().sort() ?? null,
    visible: ASHEN.scene.meshes.filter(m => m.visible !== false && m.isEnabled?.() !== false).map(m => m.name).sort(),
    meshes: ASHEN.scene.meshes.length,
    gpuErrors: ASHEN.gpu.errors.slice(),
}));
const committed = s => ({ equip: s.equip, visible: s.visible, meshes: s.meshes });
const equip = (page, slot, id) => page.evaluate(([s, i]) => ASHEN.equipment.equip(s, i), [slot, id]);
const record = async (row, body) => {
    try { await body(row); row.passed = true; }
    catch (error) { row.passed = false; row.error = error.message; failures.push({ ...row, error: error.message }); }
    finally {
        rows.push(row);
        await fs.writeFile(out, JSON.stringify(report, null, 2));
        console.log(JSON.stringify({ case: row.case, race: row.race, slot: row.slot, passed: row.passed, err: row.error }));
    }
};

try {
    for (const race of RACES) {
        if (onlyRaces && !onlyRaces.has(race)) continue;

        for (const mode of ['corrupt-bytes', 'http-500']) {
            const fulfil = mode === 'corrupt-bytes'
                ? route => route.fulfill({ status: 200, contentType: 'model/gltf-binary', body: Buffer.from([0]) })
                : route => route.fulfill({ status: 500, contentType: 'text/plain', body: 'injected' });
            const { context, page } = await openClient();
            try {
                await settleRace(page, race);
                const booted = new Set(await page.evaluate(() => ASHEN.equipment.getStatus().cached));
                const hits = {}, seen = {}, targets = {};
                for (const slot of GEOMETRY_SLOTS) {
                    const worn = await page.evaluate(s => ASHEN.equipment.getState()[s] ?? null, slot);
                    const target = ROTATION[slot].find(id => (EQUIPMENT_ITEMS[id].parts?.length||EQUIPMENT_ITEMS[id].asset) && id !== worn && !booted.has(id)) ?? null;
                    targets[slot] = target;
                    if (target) hits[target] = 0;
                }
                const wanted = Object.values(targets).filter(Boolean);
                await page.route('**/*.glb*', route => {
                    const requestUrl = route.request().url();
                    const id = wanted.find(candidate => isPieceRequest(requestUrl, candidate));
                    if (!id) return route.continue();
                    hits[id]++; seen[id] = new URL(requestUrl).pathname;
                    return fulfil(route);
                });
                for (const slot of GEOMETRY_SLOTS) {
                    const target = targets[slot];
                    if (!target) {
                        const reason = ROTATION[slot].every(id => booted.has(id))
                            ? 'every item in this slot is loaded at boot on this race'
                            : 'no alternative item in this slot';
                        untestable.push({ case: mode, race, slot, reason });
                        console.log(JSON.stringify({ case: mode, race, slot, untestable: reason }));
                        continue;
                    }
                    await record({ case: mode, race, slot, item: target }, async row => {
                        const before = await snapshot(page);
                        const result = await equip(page, slot, target);
                        const after = await snapshot(page);
                        Object.assign(row, { result, hits: hits[target], servedFrom: seen[target] ?? null, before: committed(before), after: committed(after) });
                        assert(hits[target] > 0, 'The injected response was never requested, so nothing was proved');
                        assert.equal(result.status, 'failed', `a ${mode} load reported ${result.status}`);
                        assert.deepEqual(committed(after), committed(before), 'the committed appearance moved on a failed change');
                        assert.deepEqual(after.gpuErrors, [], 'GPU errors from a failed change');
                    });
                }
                await page.unrouteAll({ behavior: 'wait' });
                // A failure must not poison the piece: the same change now succeeds, and on
                // this page that is a genuine refetch rather than a cached result.
                for (const slot of GEOMETRY_SLOTS) {
                    const target = targets[slot];
                    if (!target) continue;
                    await record({ case: `${mode}-recovery`, race, slot, item: target }, async row => {
                        const recovery = await equip(page, slot, target);
                        row.result = recovery;
                        assert.equal(recovery.status, 'applied', `${target} failed to equip after ${mode}: ${recovery.error}`);
                        assert.equal(await page.evaluate(s => ASHEN.equipment.getState()[s], slot), target);
                    });
                }
            } finally { await context.close(); }
        }

        // Clicking faster than the loader, and asking for something that does not exist.
        const { context, page } = await openClient();
        try {
            await settleRace(page, race);
            for (const slot of EQUIPMENT_SLOTS) {
                const rotation = ROTATION[slot];
                await record({ case: 'swap-storm', race, slot }, async row => {
                    const counts = [];
                    for (let cycle = 0; cycle < 6; cycle++) {
                        // Fired together, so later requests supersede earlier ones in flight.
                        const wanted = await page.evaluate(([s, ids]) =>
                            Promise.allSettled(ids.map(id => ASHEN.equipment.equip(s, id))).then(() => ids.at(-1)), [slot, rotation]);
                        const state = await snapshot(page);
                        counts.push(state.meshes);
                        assert.equal(state.equip[slot] ?? null, wanted, `after a storm the slot holds ${state.equip[slot]}, not the last request ${wanted}`);
                        assert.deepEqual(state.gpuErrors, [], 'GPU errors during a storm');
                    }
                    row.meshCounts = counts;
                    // The first cycles may add meshes as pieces load; after that it must settle.
                    assert(counts.slice(2).every(n => n === counts[2]), `unbounded mesh growth: ${counts}`);
                });
            }
            for (const slot of EQUIPMENT_SLOTS) {
                await record({ case: 'unknown-item', race, slot }, async row => {
                    const before = await snapshot(page);
                    const result = await equip(page, slot, 'inventedPiece');
                    const after = await snapshot(page);
                    Object.assign(row, { result, before: committed(before), after: committed(after) });
                    assert.notEqual(result.status, 'applied', 'an unknown item was accepted');
                    assert.deepEqual(committed(after), committed(before), 'an unknown item moved the committed appearance');
                });
            }
        } finally { await context.close(); }
    }
    report.passed = failures.length === 0 && errors.length === 0;
} catch (e) {
    report.failure = e.stack;
    console.error(e);
} finally {
    if (!report.passed) process.exitCode = 1;
    report.summary = { rows: rows.length, failed: failures.length, untestable: untestable.length, consoleErrors: errors.length };
    await fs.writeFile(out, JSON.stringify(report, null, 2));
    await browser.close();
    await fs.writeFile(out + '.ownership.json', JSON.stringify({ ...ownership, active: false, renderingClients: 0 }, null, 2));
    console.log(JSON.stringify(report.summary));
}
