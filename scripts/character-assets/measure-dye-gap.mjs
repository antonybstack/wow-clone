/** Does a dye change leave the piece un-rendered, and for how long?
 *
 * The v2 review capture opened on a bare torso: its first frame landed inside the first dye's
 * rebuild. A dye is applied when the material is built, so the piece is rebuilt rather than
 * retinted, and "rebuilt" could mean anything from a sub-frame swap to a visible flicker. One
 * captured frame cannot tell those apart, so this samples scene membership every animation
 * frame across many dye changes and reports the distribution.
 *
 * The probe is existence plus the `visible` flag, and both are needed. A dye change disposes the
 * piece's mesh and appends a new one -- its index in scene.meshes moves from 77 to 137 across a
 * single dye -- so membership alone cannot see the gap, and the mesh count is 138 whether the
 * torso is worn or bare. On this path `visible` is what the equipment system toggles between
 * worn and bare, which was verified directly rather than assumed; the project's standing warning
 * that `visible` is not render proof is about evicted meshes on the streaming path, not this one.
 */
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { DYE_IDS } from '../../src/ashen-reach/dye-palette.js';

const url = process.env.ASHEN_TEST_URL, port = process.env.ASHEN_CDP_PORT, out = process.argv[2];
assert(url && port && out, 'ASHEN_TEST_URL, ASHEN_CDP_PORT and an output path are required');
const ITEM = process.env.ASHEN_DYE_ITEM || 'wayfarerTunic';
const SLOT = process.env.ASHEN_DYE_SLOT || 'torso';
const ROUNDS = Number(process.env.ASHEN_DYE_ROUNDS || 4);

const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
assert(browser.contexts().flatMap(c => c.pages()).every(p => p.url() === 'about:blank'), 'Another owned page is active');
const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
const page = await context.newPage();
const errors = [];
page.on('pageerror', e => errors.push(String(e.message ?? e)));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 300)); });
try {
    await page.goto(url);
    await page.waitForFunction(() => globalThis.ASHEN?.whenRest, null, { timeout: 120000 });
    await page.evaluate(() => ASHEN.whenRest);
    await page.evaluate(() => { ASHEN.dev.god = true; });
    const worn = await page.evaluate(([s, i]) => ASHEN.equipment.equip(s, i), [SLOT, ITEM]);
    assert.equal(worn.status, 'applied', worn.error);
    await page.waitForTimeout(900);

    const result = await page.evaluate(async ([item, ids, rounds, meshName]) => {
        const find = () => ASHEN.scene.meshes.find(m => m.name === meshName);
        if (!find()) return { error: `no mesh named ${meshName} while the piece is worn` };

        let sampling = true, frames = 0, absent = 0;
        const runs = [], reasons = { missing: 0, invisible: 0 };
        let run = 0;
        const tick = () => {
            if (!sampling) return;
            frames++;
            const mesh = find();
            const gone = !mesh || mesh.visible === false;
            if (gone) {
                absent++; run++;
                if (!mesh) reasons.missing++; else reasons.invisible++;
            } else if (run) { runs.push(run); run = 0; }
            requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);

        // A control first: the same number of animation frames with no dye change at all. If the
        // idle scene reports gaps, the sampler itself is what is being measured.
        await new Promise(r => setTimeout(r, 1500));
        const controlFrames = frames, controlAbsent = absent;

        const costs = [];
        for (let r = 0; r < rounds; r++) {
            for (const id of ids) {
                const t0 = performance.now();
                const res = await ASHEN.equipment.setDye(item, id);
                while (ASHEN.equipment.getStatus?.()?.pending) await new Promise(requestAnimationFrame);
                costs.push(+(performance.now() - t0).toFixed(2));
                if (res.status !== 'applied') return { error: `${id}: ${res.error}` };
                await new Promise(r2 => setTimeout(r2, 90));
            }
        }
        sampling = false;
        if (run) runs.push(run);
        return { changes: costs.length, frames, absentFrames: absent, gapRuns: runs, costs, reasons,
                 control: { frames: controlFrames, absent: controlAbsent } };
    }, [ITEM, DYE_IDS, ROUNDS, process.env.ASHEN_DYE_MESH || 'WayfarerTunic']);

    assert(!result.error, result.error);
    const runs = result.gapRuns.sort((a, b) => a - b);
    const sorted = result.costs.slice().sort((a, b) => a - b);
    const report = {
        item: ITEM, slot: SLOT, rounds: ROUNDS, dyeChanges: result.changes,
        sampledFrames: result.frames, meshName: process.env.ASHEN_DYE_MESH || 'WayfarerTunic',
        control: result.control, gapReasons: result.reasons,
        framesWithPieceAbsent: result.absentFrames,
        gapCount: runs.length, longestGapFrames: runs.at(-1) ?? 0,
        medianGapFrames: runs.length ? runs[Math.floor(runs.length / 2)] : 0,
        gapsPerChange: +(runs.length / result.changes).toFixed(2),
        costMs: { median: sorted[Math.floor(sorted.length / 2)], worst: sorted.at(-1) },
        note: 'A gap is a run of consecutive animation frames in which the piece\'s mesh is either '
            + 'absent from scene.meshes or present with visible:false. Both are needed: a dye change '
            + 'disposes and re-appends the mesh, and the scene mesh count does not change. The control '
            + 'is the same sampler over an idle scene with no dye change, so a sampler that reports '
            + 'gaps on its own is caught rather than believed.',
        errors,
    };
    await fs.writeFile(out, JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
    if (errors.length) process.exitCode = 1;
} catch (e) {
    console.error(e); process.exitCode = 1;
} finally {
    await context.close();
    await browser.close();
}
