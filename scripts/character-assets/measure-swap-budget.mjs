/** M6/6: what a piece change costs when the bytes are not already there.
 *
 * The motion matrix measured 18.8 ms median, but 119 of its 120 equip rows rebuilt a piece from
 * bytes the browser already held: the loader's residency cache keeps only two idle pieces, so a
 * piece is usually rebuilt, but it is almost never re-fetched. That is the resident cost, not
 * the cost a player pays the first time they put something on.
 *
 * Each cold row therefore runs in a fresh context with the HTTP cache disabled, against a piece
 * that context has never loaded, and asserts the request actually happened. The resident row
 * immediately re-equips the same piece in the same context. Throttling is applied through CDP so
 * the figure is not just a loopback read.
 */
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { browserOwnership } from '../lib/browser-ownership.mjs';
import { EQUIPMENT_ITEMS, EQUIPMENT_SLOTS } from '../../src/ashen-reach/equipment-catalog.js';

const url = process.env.ASHEN_TEST_URL, port = process.env.ASHEN_CDP_PORT, out = process.argv[2];
assert(url && port && out, 'ASHEN_TEST_URL, ASHEN_CDP_PORT and an output path are required');
const RACES = (process.env.ASHEN_RACES || 'human,orc,undead').split(',');
const REPEATS = Number(process.env.ASHEN_REPEATS || 3);
// The shared acceptance profile's network condition, so this figure sits beside the cold-start one.
const NETWORK = { downloadThroughput: 50 * 1024 * 1024 / 8, uploadThroughput: 50 * 1024 * 1024 / 8, latency: 40, offline: false };
// A factory prop is built in the page with no response to fetch, so it has no cold cost to
// measure. Excluded by its catalogue shape rather than by name.
const NETWORK_SLOTS = EQUIPMENT_SLOTS.filter(slot => Object.values(EQUIPMENT_ITEMS).some(i => i.slot === slot && i.parts?.length));
const ROTATION = Object.fromEntries(EQUIPMENT_SLOTS.map(slot =>
    [slot, Object.entries(EQUIPMENT_ITEMS).filter(([, i]) => i.slot === slot).map(([id]) => id)]));
const isPieceRequest = (requestUrl, id) => {
    const file = new URL(requestUrl).pathname.split('/').pop();
    return file.startsWith(id) && /^[-.]/.test(file.slice(id.length) || '.');
};

const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
assert(browser.contexts().flatMap(c => c.pages()).every(p => p.url() === 'about:blank'), 'Another owned page is active');
const ownership = await browserOwnership(browser, { cdpPort: port, url, purpose: 'M6/6 cold and resident swap cost; one client at a time', renderingClients: 1 });
await fs.writeFile(out + '.ownership.json', JSON.stringify(ownership, null, 2));
const rows = [], errors = [], skipped = [];
const report = {
    url, network: { ...NETWORK, note: '50 Mbit/s, 40 ms, matching the shared cold-start profile' },
    conditions: 'One owned rendering client at a time. Each cold row is a fresh context with the HTTP cache disabled against a piece that context has never loaded. Hand slots are excluded: a factory prop is built in the page and has no response to fetch.',
    slots: NETWORK_SLOTS,
    repeats: REPEATS, rows, skipped, errors,
};

try {
    for (const race of RACES) {
        for (const slot of NETWORK_SLOTS) {
            for (let repeat = 1; repeat <= REPEATS; repeat++) {
                const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
                const page = await context.newPage();
                page.on('pageerror', e => errors.push(e.stack));
                page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 300)); });
                try {
                    const cdp = await context.newCDPSession(page);
                    await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
                    await page.goto(url);
                    await page.waitForFunction(() => globalThis.ASHEN?.whenRest, null, { timeout: 120000 });
                    await page.evaluate(() => ASHEN.whenRest);
                    await page.evaluate(() => { ASHEN.dev.god = true; });
                    if (await page.evaluate(() => ASHEN.equipment.race) !== race) {
                        const switched = await page.evaluate(r => ASHEN.equipment.switchRace(r), race);
                        assert.notEqual(switched?.status, 'failed', `switchRace(${race}): ${switched?.error}`);
                        await page.evaluate(() => ASHEN.whenRest);
                    }
                    // Throttle only after startup, so the cold-start gate is not what is measured.
                    await cdp.send('Network.emulateNetworkConditions', NETWORK);
                    const booted = new Set(await page.evaluate(() => ASHEN.equipment.getStatus().cached));
                    const worn = await page.evaluate(s => ASHEN.equipment.getState()[s] ?? null, slot);
                    const target = ROTATION[slot].find(id => id !== worn && !booted.has(id)) ?? null;
                    if (!target) {
                        skipped.push({ race, slot, repeat, reason: 'every item in this slot is loaded at boot on this race' });
                        continue;
                    }
                    let hits = 0, bytes = 0;
                    await page.route('**/*.glb*', async route => {
                        if (isPieceRequest(route.request().url(), target)) hits++;
                        await route.continue();
                    });
                    page.on('response', async response => {
                        if (isPieceRequest(response.url(), target)) bytes = Number(response.headers()['content-length'] ?? 0);
                    });
                    // Latency and frame cost are different claims. A 130 ms fetch is fine; a
                    // 130 ms frame is not, and only the second is a stall the player sees.
                    const cold = await page.evaluate(async ([s, id]) => {
                        ASHEN.renderLoop.beginMeasurement();
                        const t0 = performance.now();
                        const result = await ASHEN.equipment.equip(s, id);
                        while (ASHEN.equipment.getStatus?.()?.pending) await new Promise(requestAnimationFrame);
                        const ms = performance.now() - t0;
                        await new Promise(requestAnimationFrame);
                        const intervals = ASHEN.renderLoop.endMeasurement();
                        return {
                            ms, status: result.status, error: result.error ?? null,
                            worstFrameMs: intervals.length ? Math.max(...intervals) : null,
                            frames: intervals.length,
                        };
                    }, [slot, target]);
                    assert.equal(cold.status, 'applied', `${race}/${slot} cold ${target}: ${cold.error}`);
                    // Without a request there is no cold measurement, only a resident one wearing its name.
                    assert(hits > 0, `${race}/${slot} ${target} was never fetched, so this is not a cold cost`);

                    const other = ROTATION[slot].find(id => id !== target) ?? null;
                    let resident = null;
                    if (other !== null) {
                        await page.evaluate(([s, id]) => ASHEN.equipment.equip(s, id), [slot, other]);
                        await page.waitForTimeout(150);
                        resident = await page.evaluate(async ([s, id]) => {
                            const t0 = performance.now();
                            const result = await ASHEN.equipment.equip(s, id);
                            while (ASHEN.equipment.getStatus?.()?.pending) await new Promise(requestAnimationFrame);
                            return { ms: performance.now() - t0, status: result.status };
                        }, [slot, target]);
                    }
                    rows.push({ race, slot, item: target, repeat, bytes, hits, coldMs: +cold.ms.toFixed(1),
                        coldWorstFrameMs: cold.worstFrameMs === null ? null : +cold.worstFrameMs.toFixed(2), coldFrames: cold.frames,
                        residentMs: resident ? +resident.ms.toFixed(1) : null });
                    console.log(JSON.stringify(rows.at(-1)));
                    await fs.writeFile(out, JSON.stringify(report, null, 2));
                } finally { await context.close(); }
            }
        }
    }
    report.passed = errors.length === 0;
} catch (e) {
    report.failure = e.stack;
    console.error(e);
} finally {
    if (!report.passed) process.exitCode = 1;
    report.summary = { rows: rows.length, skipped: skipped.length, consoleErrors: errors.length };
    await fs.writeFile(out, JSON.stringify(report, null, 2));
    await browser.close();
    await fs.writeFile(out + '.ownership.json', JSON.stringify({ ...ownership, active: false, renderingClients: 0 }, null, 2));
    console.log(JSON.stringify(report.summary));
}
