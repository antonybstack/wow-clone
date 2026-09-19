/** Live sculpt-pipeline Orc: body swap, withheld clothes, parked Human stays hidden. */
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const dir = 've-capture/ashen-reach/orc';
await fs.mkdir(dir, {recursive: true});
const browser = await chromium.connectOverCDP('http://127.0.0.1:9337');
const context = browser.contexts()[0];
const page = context.pages().find(p => p.url().includes('ashen-reach.html')) || await context.newPage();
const checks = [], errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
const check = (name, ok) => { checks.push({name, ok: !!ok}); assert.ok(ok, name); console.log('PASS', name); };
const shot = async name => {
    await page.waitForTimeout(280);
    await page.screenshot({path: `${dir}/${name}.png`});
};

try {
    await page.bringToFront();
    await page.goto(process.env.ASHEN_URL || 'http://127.0.0.1:5173/ashen-reach.html?play&clean', {waitUntil: 'commit', timeout: 60000});
    await page.waitForFunction(() => globalThis.ASHEN?.ready, null, {timeout: 60000});
    await page.waitForTimeout(700);
    await page.locator('#armory-launch').click();
    await page.waitForTimeout(200);
    await page.locator('[data-light]').check();
    check('Orc2 is not a race option', await page.locator('[data-race] option[value="orc2"]').count() === 0);

    await page.locator('[data-race]').selectOption('orc');
    await page.waitForFunction(() => ASHEN.equipment.race === 'orc' && ASHEN.body.parked && ASHEN.scene.meshes.some(m => m.name === 'OrcV1Body' && m.visible) && !ASHEN.equipment.getStatus?.().pending, null, {timeout: 60000});
    const orc = await page.evaluate(() => {
        const vis = name => ASHEN.scene.meshes.some(m => m.name === name && m.visible);
        return {
            bones: ASHEN.body.boneCount,
            parked: ASHEN.body.parked,
            clips: (ASHEN.body.inspection?.options ?? []).map(o => o.id),
            visible: {
                OrcV1Body: vis('OrcV1Body'),
                OrcV1Shorts: vis('OrcV1Shorts'),
                OrcV1Brows: vis('OrcV1Brows'),
                WayfarerTunic: vis('WayfarerTunic'),
                HumanHair: vis('HumanHair'),
            },
            status: document.querySelector('[data-equipment-status]')?.textContent ?? '',
            presetsDisabled: [...document.querySelectorAll('[data-outfit]')].every(b => b.disabled),
            torsoDisabled: document.querySelector('[data-equipment="torso"]')?.disabled === true,
            handsEnabled: document.querySelector('[data-equipment="mainHand"]')?.disabled === false,
            state: ASHEN.equipment.getState(),
        };
    });
    check('Orc shows the sculpt body and parks Human', orc.parked && orc.visible.OrcV1Body && orc.visible.OrcV1Shorts && orc.bones === 65);
    check('Orc does not wear MakeHuman garments', !orc.visible.WayfarerTunic && !orc.visible.HumanHair && orc.state.torso === null);
    check('Orc withholds catalogue clothes and keeps hand slots', orc.presetsDisabled && orc.torsoDisabled && orc.handsEnabled && orc.status.includes('sculpt-pipeline'));
    check('Orc preview exposes the full runtime clip set', ['idle', 'walk', 'run', 'jump', 'land', 'fire', 'lava', 'carry'].every(id => orc.clips.includes(id)));
    await page.locator('[data-view="front"]').click();
    await page.locator('[data-view="full"]').click();
    await shot('orc-front');
    await page.locator('[data-view="side"]').click();
    await shot('orc-side');
    await page.locator('[data-view="front"]').click();
    await page.evaluate(() => { ASHEN.armory.camera.alpha = Math.PI / 2 - ASHEN.player.getFacing() - 0.7; });
    await shot('orc-three-quarter');

    await page.locator('[data-race]').selectOption('human');
    await page.waitForFunction(() => ASHEN.equipment.race === 'human' && !ASHEN.body.parked && ASHEN.scene.meshes.some(m => m.name === 'HumanHair' && m.visible) && !ASHEN.equipment.getStatus?.().pending, null, {timeout: 60000});
    check('Returning to Human unparks the original body', await page.evaluate(() => !ASHEN.body.parked && ASHEN.scene.meshes.some(m => m.name === 'HumanHair' && m.visible)));

    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    await page.locator('#armory-launch').click();
    await page.locator('[data-race]').selectOption('orc');
    await page.waitForFunction(() => ASHEN.equipment.race === 'orc' && ASHEN.scene.meshes.some(m => m.name === 'OrcV1Body' && m.visible), null, {timeout: 60000});
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
    const play = await page.evaluate(() => ({
        race: ASHEN.equipment.race,
        body: ASHEN.scene.meshes.some(m => m.name === 'OrcV1Body' && m.visible),
        hair: ASHEN.scene.meshes.some(m => m.name === 'HumanHair' && m.visible),
        open: ASHEN.armory.getState().open,
    }));
    check('Closing the armory keeps Orc in gameplay', !play.open && play.race === 'orc' && play.body);
    check('Parked Human stays hidden in Orc gameplay', !play.hair);
    await page.keyboard.down('KeyW');
    await page.waitForTimeout(400);
    await page.keyboard.up('KeyW');
    await shot('orc-gameplay-walk');
    check('No runtime errors', errors.length === 0);
} finally {
    await page.keyboard.up('KeyW');
    await fs.writeFile(`${dir}/checks.json`, JSON.stringify({checks, errors}, null, 2));
    await browser.close();
}
