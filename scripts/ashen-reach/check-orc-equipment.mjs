/** Live Orc equipment: fitted pack in the armory, selection carried across races,
 * greatstaff stow/draw and both spells on the Orc in the churchyard. */
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const dir = 've-capture/orc-motion/orc-equipment-v1';
await fs.mkdir(dir, {recursive: true});
const browser = await chromium.connectOverCDP('http://127.0.0.1:9337');
const context = browser.contexts()[0];
const page = context.pages().find(p => p.url().includes('ashen-reach.html')) || await context.newPage();
const checks = [], errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
const check = (name, ok) => { checks.push({name, ok: !!ok}); assert.ok(ok, name); console.log('PASS', name); };
const settled = () => page.waitForFunction(() => !ASHEN.equipment.getStatus?.().pending);
const waitOrc = () => page.waitForFunction(() => ASHEN.equipment.race === 'orc' && ASHEN.armory.getState().race === 'orc' && ASHEN.body.parked && ASHEN.scene.meshes.some(m => m.name === 'OrcV1Brows' && m.visible) && !ASHEN.equipment.getStatus?.().pending, null, {timeout: 60000});
const waitHuman = () => page.waitForFunction(() => ASHEN.equipment.race === 'human' && ASHEN.armory.getState().race === 'human' && !ASHEN.body.parked && ASHEN.scene.meshes.some(m => m.name === 'HumanHair') && !ASHEN.equipment.getStatus?.().pending, null, {timeout: 60000});
const state = () => page.evaluate(() => {
    const nodes = ASHEN.scene.meshes.map(n => ({name: n.name, visible: !!n.visible}));
    const visible = name => nodes.some(n => n.name === name && n.visible);
    return {
        race: ASHEN.armory.getState().race,
        parked: ASHEN.body.parked,
        bones: ASHEN.body.boneCount,
        equipment: ASHEN.equipment.getState(),
        status: document.querySelector('[data-equipment-status]')?.textContent ?? '',
        visible: {
            OrcV1Hair: visible('OrcV1Hair'),
            OrcV1Brows: visible('OrcV1Brows'),
            OrcV1Eyes: visible('OrcV1Eyes'),
            HumanHair: visible('HumanHair'),
            OrcV1Body: visible('OrcV1Body'),
            BodyExposed: visible('BodyExposed'),
            WayfarerTunic: visible('WayfarerTunic'),
            WayfarerTrousers: visible('WayfarerTrousers'),
            WayfarerBoots: visible('WayfarerBoots'),
            PilgrimTunic: visible('PilgrimTunic'),
            GraveweaverHood: visible('GraveweaverHood'),
            GraveweaverTop: visible('GraveweaverTop'),
            GraveweaverSkirt: visible('GraveweaverSkirt'),
            GraveweaverGloves: visible('GraveweaverGloves'),
            GraveweaverPendant: visible('GraveweaverPendant'),
        },
        names: nodes.map(n => n.name),
        attachment: ASHEN.equipment.attachment,
        hp: ASHEN.combat.dummy.hp,
        casts: ASHEN.combat.spell.casts,
        lavaCasts: ASHEN.combat.lava.casts,
        socket: ASHEN.combat.fx.sockets.sockets.mainHand.bone?.name ?? null,
        skinned: ASHEN.combat.fx.sockets.skinned?.name ?? null,
    };
});
const shot = async name => {
    await page.waitForTimeout(280);
    await page.screenshot({path: `${dir}/${name}.png`});
};
const threeQuarter = () => page.evaluate(() => { ASHEN.armory.camera.alpha = Math.PI / 2 - ASHEN.player.getFacing() - 0.7; });

try {
    await page.bringToFront();
    await page.goto(process.env.ASHEN_URL || 'http://127.0.0.1:5173/ashen-reach.html?play&clean', {waitUntil: 'commit', timeout: 60000});
    await page.waitForFunction(() => globalThis.ASHEN?.ready, null, {timeout: 60000});
    await page.waitForTimeout(700);
    await page.locator('#armory-launch').click();
    await page.waitForTimeout(200);
    await page.locator('[data-light]').check();

    await page.locator('[data-race]').selectOption('orc');
    await waitOrc();
    await page.locator('[data-outfit="wayfarer"]').click();
    await settled();
    await page.waitForFunction(() => ASHEN.scene.meshes.some(m => m.name === 'WayfarerTunic' && m.visible) && ASHEN.scene.meshes.some(m => m.name === 'WayfarerTrousers' && m.visible), null, {timeout: 15000});
    let s = await state();
    check('Orc body swap parks Human and shows the Orc pack', s.parked && s.visible.OrcV1Hair && s.visible.OrcV1Brows && !s.visible.HumanHair && !s.names.includes('OrcV1Body') && s.bones === 65);
    check('Wayfarer on Orc shows fitted garments', s.equipment.torso === 'wayfarerTunic' && s.visible.WayfarerTunic && s.visible.WayfarerTrousers && s.visible.WayfarerBoots);
    check('Human hair is absent while Orc hair is visible', !s.visible.HumanHair && s.visible.OrcV1Hair);
    check('Orc status asks for clipping reports', s.status.includes('report clipping'));
    check('Orc presets and slots stay enabled', await page.locator('[data-outfit]').first().isDisabled() === false && await page.locator('[data-equipment="torso"]').isDisabled() === false);
    await page.locator('[data-view="front"]').click();
    await page.locator('[data-view="full"]').click();
    await page.locator('[data-motion]').selectOption('idle');
    await shot('wayfarer-front');
    await threeQuarter();
    await shot('wayfarer-three-quarter');

    await page.locator('[data-outfit="pilgrim"]').click();
    await settled();
    s = await state();
    check('Pilgrim on Orc replaces the tunic on the same actor', s.equipment.torso === 'pilgrimTunic' && s.visible.PilgrimTunic && !s.visible.WayfarerTunic && s.visible.OrcV1Hair);
    await page.locator('[data-view="front"]').click();
    await shot('pilgrim-front');
    await threeQuarter();
    await shot('pilgrim-three-quarter');

    await page.locator('[data-outfit="graveweaver"]').click();
    await settled();
    s = await state();
    check('Graveweaver on Orc shows fitted hood and vestment', s.equipment.helmet === 'graveweaverHood' && s.visible.GraveweaverHood && s.visible.GraveweaverTop && s.visible.GraveweaverSkirt && s.visible.GraveweaverGloves && !s.visible.OrcV1Hair);
    await page.locator('[data-view="front"]').click();
    await page.locator('[data-view="full"]').click();
    await shot('graveweaver-front');
    await threeQuarter();
    await shot('graveweaver-three-quarter');

    await page.locator('[data-race]').selectOption('human');
    await waitHuman();
    s = await state();
    check('Returning to Human restores Human hair and keeps Graveweaver selection', !s.parked && s.names.includes('HumanHair') && !s.visible.OrcV1Hair && !s.visible.OrcV1Brows && s.equipment.helmet === 'graveweaverHood' && s.equipment.torso === 'graveweaverTop' && s.visible.GraveweaverHood);

    await page.locator('[data-race]').selectOption('orc');
    await waitOrc();
    await page.locator('[data-outfit="warden"]').click();
    await settled();
    s = await state();
    check('Orc equips the greatstaff with no off-hand', s.equipment.mainHand === 'graveweaverGreatstaff' && s.equipment.offHand === null);
    check('Hand sockets follow the visible Orc body', !!s.socket && s.parked && s.visible.OrcV1Brows);

    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    s = await state();
    check('Closing the armory keeps the Orc in gameplay', s.parked && s.visible.OrcV1Brows && s.equipment.mainHand === 'graveweaverGreatstaff');

    await page.keyboard.press('Tab');
    await page.keyboard.press('Digit1');
    await page.waitForFunction(() => ASHEN.combat.spell.casts === 1, null, {timeout: 8000});
    check('Orc Fire Blast stows the greatstaff', await page.evaluate(() => ASHEN.equipment.attachment === 'back'));
    await page.waitForTimeout(1200);
    check('Orc Fire Blast returns the greatstaff to the hand', await page.evaluate(() => ASHEN.equipment.attachment === 'hand'));
    check('Orc Fire Blast deals timed damage', (await state()).hp === 480);

    await page.keyboard.press('Digit2');
    await page.waitForFunction(() => ASHEN.combat.pendingSpell === 2, null, {timeout: 6000});
    check('Orc Lava Ball charge stows the greatstaff', await page.evaluate(() => ASHEN.equipment.attachment === 'back'));
    await page.waitForFunction(() => ASHEN.combat.lava.casts === 1, null, {timeout: 9000});
    await page.waitForTimeout(1400);
    check('Orc Lava Ball recovers and hits', await page.evaluate(() => ASHEN.equipment.attachment === 'hand' && ASHEN.combat.dummy.hp === 240));

    await page.waitForTimeout(200);
    await page.screenshot({path: `${dir}/gameplay-churchyard.png`});
    check('No runtime errors', errors.length === 0);
} finally {
    await page.keyboard.up('KeyW').catch(() => {});
    await fs.writeFile(`${dir}/checks.json`, JSON.stringify({checks, errors, state: await state().catch(() => null)}, null, 2));
    await browser.close();
}
