/** M11b live review: Human -> Orc -> Undead -> Human during motion, catalogue work on the
 * Undead, and the refusal paths.
 *
 * Every still is taken at the same camera: the player is parked at a fixed world position
 * and facing with a fixed rig before each shot, while the movement keys stay held, so the
 * character is genuinely mid-stride and the frames are comparable side by side.
 *
 * Usage: node scripts/harness/up.mjs --slot 2 && node scripts/ashen-reach/capture-m11b-undead.mjs
 */
import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import {CDP_URL} from '../lib/cdp.mjs';

const dir = 've-capture/ashen-reach/m11b';
await fs.mkdir(dir, {recursive: true});
const BASE = process.env.ASHEN_URL || 'http://127.0.0.1:5373/ashen-reach.html?play&clean';
const log = [];

const browser = await chromium.connectOverCDP(CDP_URL);
const context = browser.contexts()[0];
const page = context.pages().find(p => p.url().includes('ashen-reach.html')) || await context.newPage();
const errors = [];
page.on('pageerror', e => errors.push(String(e.message)));

const ready = async url => {
    await page.goto(url, {waitUntil: 'commit'});
    await page.waitForFunction(() => globalThis.ASHEN?.ready, null, {timeout: 90000});
    await page.waitForTimeout(600);
};

/** Park the actor and camera identically for every comparison still. */
const parkCamera = () => page.evaluate(() => {
    const {player, rig, world} = globalThis.ASHEN;
    player.setWorldPos(0, globalThis.ASHEN.world ? player.body.position.y : 1, 0);
    player.setFacing(Math.PI);
    rig.yaw = 0; rig.pitch = .06; rig.distance = rig.distanceTarget = 4.2;
    void world;
});

async function shot(name, note) {
    await page.waitForTimeout(260);
    await page.screenshot({path: `${dir}/${name}.png`});
    const state = await page.evaluate(() => ({
        race: globalThis.ASHEN.equipment.race,
        loadout: globalThis.ASHEN.equipment.getState(),
    }));
    log.push({shot: name, note, ...state});
    console.log(`  ${name.padEnd(34)} race=${state.race}`);
}

/** Run fn while W is held down, so the switch really happens mid-stride. */
async function duringMotion(fn) {
    await page.locator('#renderCanvas').click({position: {x: 400, y: 300}}).catch(() => {});
    await page.keyboard.down('w');
    await page.waitForTimeout(700);
    const result = await fn();
    await page.waitForTimeout(400);
    return result;
}
const releaseKeys = () => page.keyboard.up('w').catch(() => {});

const switchRace = race => page.evaluate(async r => {
    try { await globalThis.ASHEN.equipment.switchRace(r); return {ok: true, race: globalThis.ASHEN.equipment.race}; }
    catch (e) { return {ok: false, race: globalThis.ASHEN.equipment.race, error: String(e.message || e)}; }
}, race);

try {
    await page.bringToFront();

    // ---- A. race switching during motion, same camera ----------------------------------
    console.log('A. race switching during motion');
    await ready(BASE);
    await duringMotion(async () => {
        await parkCamera();
        await shot('a1-human-walk', 'start: Human, walking');
    });

    for (const [race, name] of [['orc', 'a2-orc-walk'], ['undead', 'a3-undead-walk'], ['human', 'a4-human-return-walk']]) {
        const res = await duringMotion(() => switchRace(race));
        console.log(`   switchRace(${race}) -> ${JSON.stringify(res)}`);
        log.push({transition: `->${race}`, ...res});
        await parkCamera();
        await shot(name, `switched to ${race} while walking`);
    }
    await releaseKeys();

    // ---- B. the Undead in the armory, catalogue work ------------------------------------
    console.log('B. undead catalogue');
    await ready(BASE);
    await page.locator('#armory-launch').click();
    await page.waitForTimeout(400);
    await page.locator('[data-light]').check();
    await page.locator('[data-race]').selectOption('undead');
    await page.waitForTimeout(2500);
    const raceStatus = await page.locator('[data-equipment-status]').textContent();
    console.log('   armory status:', raceStatus.trim().slice(0, 120));
    log.push({armoryStatusAfterUndeadSwitch: raceStatus.trim()});

    for (const view of ['front', 'side', 'back', 'face']) {
        await page.locator(`[data-view="${view}"]`).click();
        await shot(`b1-undead-${view}`, `undead armory ${view}`);
    }
    await page.locator('[data-view="full"]').click();

    for (const preset of ['wayfarer', 'pilgrim', 'graveweaver', 'warden']) {
        await page.locator(`[data-outfit="${preset}"]`).click();
        await page.waitForTimeout(1600);
        await shot(`b2-undead-${preset}`, `undead wearing ${preset}`);
    }

    // unequip a slot, then a mixed outfit
    await page.locator('[data-equipment="torso"]').selectOption('');
    await page.waitForTimeout(1200);
    await shot('b3-undead-torso-unequipped', 'torso unequipped on undead');
    await page.locator('[data-equipment="torso"]').selectOption('pilgrimTunic');
    await page.locator('[data-equipment="helmet"]').selectOption('');
    await page.waitForTimeout(1600);
    await shot('b4-undead-mixed', 'mixed outfit, no helmet');

    // ---- C. invalid request on the Undead ----------------------------------------------
    console.log('C. invalid requests');
    const invalid = await page.evaluate(async () => {
        const out = {};
        out.unknownItem = await globalThis.ASHEN.equipment.equip('torso', 'thereIsNoSuchItem')
            .then(r => r, e => ({status: 'threw', error: String(e.message || e)}));
        out.wrongSlot = await globalThis.ASHEN.equipment.equip('helmet', 'wayfarerBoots')
            .then(r => r, e => ({status: 'threw', error: String(e.message || e)}));
        out.unknownPreset = await globalThis.ASHEN.equipment.equipPreset('nosuchoutfit');
        out.afterwards = globalThis.ASHEN.equipment.getState();
        out.race = globalThis.ASHEN.equipment.race;
        return out;
    });
    console.log('   ', JSON.stringify(invalid).slice(0, 300));
    log.push({invalidRequests: invalid});
    await shot('c1-undead-after-invalid', 'character after three invalid requests');

    // ---- D. race switch back out of the armory ------------------------------------------
    await page.locator('[data-race]').selectOption('human');
    await page.waitForTimeout(2500);
    await shot('d1-human-after-undead', 'back to human from undead, loadout preserved');
    await page.locator('[data-race]').selectOption('undead');
    await page.waitForTimeout(2500);
    await shot('d2-undead-again', 'undead again, loadout preserved');

    await fs.writeFile(`${dir}/state.json`, JSON.stringify({log, errors}, null, 2) + '\n');
    console.log(`\ncaptured ${log.filter(l => l.shot).length} stills into ${dir}`);
    console.log('page errors:', errors.length, errors.slice(0, 5));
} finally {
    await releaseKeys();
    await browser.close();
}
