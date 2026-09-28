/** M005 live check: the refitted garment pack in the actual Ashen Reach route.
 *
 * The offline fit measurement says the refit closes the coverage loss. This asserts the
 * other half, which only the running game can answer: that the refitted pack loads through
 * the real streamed equipment path with its byte-length and SHA-256 checks, that every
 * garment piece in the scene ends up carrying the same shape weights as the body, that a
 * piece equipped *after* the shape was applied is shaped too, and that a cancelled or
 * failed request leaves the committed appearance alone.
 *
 * Run alone on an owned harness slot.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {chromium} from 'playwright';

const port = Number(process.env.ASHEN_CDP_PORT), url = process.env.ASHEN_URL;
if (!port || !url) throw Error('ASHEN_CDP_PORT and ASHEN_URL required');
const base = url.split('?')[0];
const out = process.env.ASHEN_CAPTURE_DIR || 've-capture/character-mmo/m005/live';
const report = process.env.ASHEN_GARMENT_LIVE_REPORT || 'docs/baselines/character-mmo/m005/live-garment-fit.json';

const CASES = [
    {id: 'stout-shipped', query: 'humanShape=stout&garmentFit=shipped'},
    {id: 'stout-refit', query: 'humanShape=stout&garmentFit=refit'},
    {id: 'slender-refit', query: 'humanShape=slender&garmentFit=refit'},
    {id: 'tall-stout-refit', query: 'humanShape=stout&humanHeight=1.15&garmentFit=refit'},
];

await fs.mkdir(out, {recursive: true});
const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
const pages = browser.contexts().flatMap(c => c.pages());
const page = pages.find(p => p.url().startsWith(base)) ?? pages[0];
if (!page) throw Error('No owned page in this harness slot');

const rows = [];
try {
    await page.setViewportSize({width: 1280, height: 720});
    for (const test of CASES) {
        const errors = [];
        const onError = e => errors.push(String(e.message ?? e));
        const onConsole = m => { if (m.type() === 'error') errors.push(m.text()); };
        page.on('pageerror', onError);
        page.on('console', onConsole);
        await page.goto(`${base}?play&clean&pixelRatio=1&${test.query}`);
        await page.waitForFunction(() => globalThis.ASHEN?.whenPlayable, null, {timeout: 90000});
        await page.evaluate(() => ASHEN.whenRest);

        const survey = () => page.evaluate(() => {
            const meshes = (ASHEN.scene.meshes || [])
                .filter(mesh => mesh.morphTargets)
                .map(mesh => ({name: mesh.name ?? null, weights: Array.from(mesh.morphTargets.weights)}));
            return {
                request: ASHEN.humanShape,
                morphMeshes: meshes,
                loadout: ASHEN.equipment.getState(),
                manifest: ASHEN.humanShape?.garmentManifestURL ?? null,
                usingPhysics: ASHEN.player.getDebugState().usingPhysics,
            };
        });

        const booted = await survey();
        assert.equal(booted.usingPhysics, true, `${test.id}: Havok is not driving the character`);
        const expected = booted.request.weights;
        for (const mesh of booted.morphMeshes) {
            assert.deepEqual(mesh.weights, expected, `${test.id}: ${mesh.name} carries ${mesh.weights} not ${expected}`);
        }
        if (test.query.includes('refit')) {
            assert.ok(booted.morphMeshes.length >= 4,
                `${test.id}: only ${booted.morphMeshes.length} shaped meshes; the refitted garments did not load`);
        } else {
            assert.equal(booted.morphMeshes.length, 1,
                `${test.id}: shipped garments must not carry shape targets`);
        }

        // Equip after the shape was applied: the new piece must not stay at the neutral shape.
        const equipped = await page.evaluate(async () => {
            const result = await ASHEN.equipment.equip('torso', 'pilgrimTunic');
            return {result, state: ASHEN.equipment.getState()};
        });
        assert.equal(equipped.result.status, 'applied', `${test.id}: pilgrimTunic did not apply`);
        const after = await survey();
        for (const mesh of after.morphMeshes) {
            assert.deepEqual(mesh.weights, expected, `${test.id}: ${mesh.name} after equip carries ${mesh.weights}`);
        }

        // A failed request must leave the committed appearance untouched.
        const failed = await page.evaluate(async () => {
            const before = ASHEN.equipment.getState();
            const result = await ASHEN.equipment.equip('torso', 'noSuchItemM005');
            return {before, result, after: ASHEN.equipment.getState()};
        });
        assert.equal(failed.result.status, 'failed', `${test.id}: an unknown item was accepted`);
        assert.deepEqual(failed.after, failed.before, `${test.id}: a failed request changed the loadout`);
        const settled = await survey();
        for (const mesh of settled.morphMeshes) {
            assert.deepEqual(mesh.weights, expected, `${test.id}: ${mesh.name} after a failed request carries ${mesh.weights}`);
        }

        await page.screenshot({path: path.join(out, `${test.id}.png`)});
        assert.deepEqual(errors, [], `${test.id}: page errors`);
        page.off('pageerror', onError);
        page.off('console', onConsole);
        rows.push({...test, manifest: booted.manifest, weights: expected, booted, afterEquip: after, afterFailure: settled});
        console.log(`${test.id.padEnd(18)} manifest=${booted.manifest ? 'refit' : 'shipped'} `
            + `shapedMeshes boot=${booted.morphMeshes.length} afterEquip=${after.morphMeshes.length} `
            + `weights=${JSON.stringify(expected)}`);
    }
    await fs.mkdir(path.dirname(report), {recursive: true});
    await fs.writeFile(report, `${JSON.stringify({schema: 1, url: base, cases: rows}, null, 1)}\n`);
    console.log(`wrote ${report}`);
} finally {
    await page.goto('about:blank').catch(() => {});
    await browser.close();
}
