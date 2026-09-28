/** Check the optional M006 ponytail against the actual streamed equipment mesh flags.
 * The candidate stays in .cache; run on one owned Vite/CDP harness after building
 * `human-ponytail01-tail-shape-family-candidate.glb`.
 * glTF visibility is at the mesh boundary:
 * https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#meshes
 */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium} from 'playwright';

const cdp = Number(process.env.ASHEN_CDP_PORT);
const origin = process.env.ASHEN_URL?.split('?')[0];
if (!cdp || !origin) throw Error('Set owned ASHEN_CDP_PORT and ASHEN_URL');
const shape = process.env.ASHEN_HAIR_SHAPE || 'stout';
if (!['neutral', 'slender', 'stout'].includes(shape)) throw Error('Invalid hair check shape');
const height = Number(process.env.ASHEN_HAIR_HEIGHT || 1);
if (![0.9, 1, 1.15].includes(height)) throw Error('Invalid hair check height');
const out = `ve-capture/character-mmo/m006/hair-coverage-${shape}-${height}`;
await fs.mkdir(out, {recursive: true});
const browser = await chromium.connectOverCDP(`http://127.0.0.1:${cdp}`);
const page = browser.contexts()[0].pages().find(p => p.url().startsWith(origin))
    ?? browser.contexts()[0].pages().find(p => p.url() === 'about:blank');
if (!page) throw Error('No page in owned harness');
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
const rows = [];
try {
    await page.setViewportSize({width: 1280, height: 720});
    await page.goto(`${origin}?play&clean&noEnemies&pixelRatio=1&humanHair=ponytail&humanShape=${shape}&humanHeight=${height}&garmentFit=refit`);
    await page.waitForFunction(() => globalThis.ASHEN?.whenPlayable, null, {timeout: 90000});
    await page.evaluate(() => ASHEN.whenRest);
    for (const helmet of [null, 'graveweaverHood', null]) {
        const result = await page.evaluate(id => ASHEN.equipment.equip('helmet', id), helmet);
        assert.equal(result.status, 'applied', JSON.stringify(result));
        await page.evaluate(() => ASHEN.whenNextGpuFrame());
        const row = await page.evaluate(() => {
            const meshes = new Map(ASHEN.scene.meshes.map(mesh => [mesh.name, mesh]));
            return {
                helmet: ASHEN.equipment.getState().helmet,
                hair: meshes.get('HumanPonytail01')?.visible,
                body: meshes.get('HumanV1Body')?.visible,
                hood: meshes.get('GraveweaverHood')?.visible,
                weights: ASHEN.humanShape?.weights,
                height: ASHEN.player.capsuleHeight,
            };
        });
        rows.push(row);
        assert.equal(row.hair, !helmet);
        assert.equal(row.body, true);
        assert.ok(Math.abs(row.height - 1.748 * height) < .006);
        if (helmet) assert.equal(row.hood, true);
        await page.screenshot({path: `${out}/${helmet ? 'hood' : rows.length === 1 ? 'bare' : 'restored'}.png`});
    }
    // A race return rebuilds the Human equipment stream. The body stays shaped
    // while fresh garments start with neutral morph weights, so this catches a
    // visually subtle mismatch that mesh visibility checks alone would miss.
    await page.evaluate(() => ASHEN.equipment.switchRace('orc'));
    assert.equal(await page.evaluate(() => ASHEN.equipment.race), 'orc');
    await page.evaluate(() => ASHEN.equipment.switchRace('human'));
    const afterRaceReturn = await page.evaluate(() => ({
        race: ASHEN.equipment.race,
        hair: ASHEN.scene.meshes.find(m => m.name === 'HumanPonytail01')?.visible,
        garments: ASHEN.scene.meshes.filter(m => m.visible && m.morphTargets
            && ['WayfarerTunic', 'WayfarerTrousers', 'WayfarerBoots'].includes(m.name))
            .map(m => ({name: m.name, weights: Array.from(m.morphTargets.weights)})),
    }));
    assert.equal(afterRaceReturn.race, 'human');
    assert.equal(afterRaceReturn.hair, true);
    assert.equal(afterRaceReturn.garments.length, shape === 'neutral' ? 0 : 3);
    for (const garment of afterRaceReturn.garments) {
        assert.deepEqual(garment.weights, shape === 'stout' ? [0, 1] : shape === 'slender' ? [1, 0] : [0, 0]);
    }
    assert.deepEqual(errors, []);
    const report = {shape, height, rows, afterRaceReturn, errors, url: page.url(), viewport: [1280, 720]};
    await fs.writeFile(`${out}/report.json`, JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify(report));
} finally {
    await page.goto('about:blank').catch(() => {});
    await browser.close();
}
