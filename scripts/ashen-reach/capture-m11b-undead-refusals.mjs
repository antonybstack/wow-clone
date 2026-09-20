/** M11b live refusal review, plus the armory framing comparison the happy-path capture cannot give.
 *
 * Section A proves the requirement that matters: with a real Undead asset broken on disk, the
 * browser must say so out loud and leave the character coherent -- never quietly draw a Human.
 * It breaks a garment's bytes, then removes the manifest outright, capturing each refusal, and
 * restores the pack afterwards in a finally block so the worktree is left clean either way.
 *
 * Section B drives ?preloadedEquipment, which is a separate code path that has regressed before.
 * Section C shoots Human and Undead at the same armory views so the framing can be compared.
 *
 * Usage: ASHEN_CDP_PORT=9537 ASHEN_URL=http://127.0.0.1:5873/ashen-reach.html?play&clean \
 *        node scripts/ashen-reach/capture-m11b-undead-refusals.mjs
 */
import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {CDP_URL} from '../lib/cdp.mjs';

const dir = 've-capture/ashen-reach/m11b';
await fs.mkdir(dir, {recursive: true});
const BASE = process.env.ASHEN_URL || 'http://127.0.0.1:5373/ashen-reach.html?play&clean';
const PACK = 'public/ashen-reach/equipment-undead-provisional';
// The backup lives outside public/ on purpose: copying five megabytes of GLB back and forth
// inside the served tree makes Vite's watcher thrash and wedges the page mid-navigation.
const BAK = path.join(os.tmpdir(), 'm11b-undead-pack-backup');
const log = [];

const browser = await chromium.connectOverCDP(CDP_URL);
const context = browser.contexts()[0];
const page = context.pages().find(p => p.url().includes('ashen-reach.html')) || await context.newPage();
const errors = [];
page.on('pageerror', e => errors.push(String(e.message)));

const ready = async url => {
    // One retry: a WebGPU context torn down by the previous reload occasionally leaves the
    // first navigation hanging on commit, and a second attempt always lands.
    for (let attempt = 0; ; attempt++) {
        try { await page.goto(url, {waitUntil: 'commit', timeout: 60000}); break; }
        catch (e) { if (attempt) throw e; await page.waitForTimeout(2000); }
    }
    await page.waitForFunction(() => globalThis.ASHEN?.ready, null, {timeout: 90000});
    await page.waitForTimeout(600);
};

async function shot(name, note, extra = {}) {
    await page.waitForTimeout(250);
    await page.screenshot({path: `${dir}/${name}.png`});
    const state = await page.evaluate(() => ({race: globalThis.ASHEN.equipment.race, loadout: globalThis.ASHEN.equipment.getState()}));
    log.push({shot: name, note, ...state, ...extra});
    console.log(`  ${name.padEnd(36)} race=${state.race}`);
    return state;
}

/** Switch race through the armory UI, the way a player would, and read what the UI says back. */
async function armoryRace(want) {
    await page.locator('[data-race]').selectOption(want);
    await page.waitForTimeout(3000);
    const status = (await page.locator('[data-equipment-status]').textContent()).trim();
    const race = await page.evaluate(() => globalThis.ASHEN.equipment.race);
    console.log(`   race select "${want}" -> race=${race}\n     status: ${status.slice(0, 180)}`);
    return {want, race, status};
}

const openArmory = async () => {
    await page.locator('#armory-launch').click();
    await page.waitForTimeout(400);
    await page.locator('[data-light]').check();
};

const backup = () => fs.cp(PACK, BAK, {recursive: true});
const restore = async () => {
    await fs.cp(BAK, PACK, {recursive: true, force: true});
    await fs.rm(BAK, {recursive: true, force: true});
};

try {
    await page.bringToFront();
    await backup();

    // ---- A1. a real Undead garment corrupted on disk -----------------------------------
    console.log('A1. corrupted undead garment');
    const tunic = `${PACK}/wayfarerTunic.glb`;
    const good = await fs.readFile(tunic);
    const bad = Buffer.from(good);
    bad.fill(0, 200, 40000);                       // same byte length, wrong content -> digest must catch it
    await fs.writeFile(tunic, bad);

    await ready(BASE);
    await openArmory();
    const a1 = await armoryRace('undead');
    log.push({case: 'corrupted-garment-bytes', ...a1});
    await shot('e1-corrupt-garment', 'wayfarerTunic.glb bytes corrupted, same length', {status: a1.status});
    const a1b = await page.evaluate(() => globalThis.ASHEN.equipment.equip('torso', 'wayfarerTunic')
        .then(r => r, e => ({status: 'threw', error: String(e.message || e)})));
    console.log('   direct equip ->', JSON.stringify(a1b));
    log.push({case: 'corrupted-garment-direct-equip', result: a1b});
    await shot('e2-corrupt-garment-after-equip', 'character after the corrupt tunic was refused');

    await restore();
    await backup();

    // ---- A2. the Undead manifest is gone entirely --------------------------------------
    console.log('A2. undead manifest deleted');
    await fs.rm(`${PACK}/manifest.json`);
    await ready(BASE);
    await openArmory();
    const a2 = await armoryRace('undead');
    log.push({case: 'manifest-deleted', ...a2});
    await shot('e3-manifest-deleted', 'undead manifest removed: refusal, previous character intact', {status: a2.status});

    await restore();
    await backup();

    // ---- A3. the manifest declares the Human fit ---------------------------------------
    // The exact silent-fallback shape: a pack that is labelled Undead but carries Human fits.
    console.log('A3. undead manifest relabelled to the human fit');
    const mf = JSON.parse(await fs.readFile(`${PACK}/manifest.json`, 'utf8'));
    mf.fitId = 'ashen-human';
    for (const item of Object.values(mf.items)) item.fit = {body: 'ashen-human', rig: 'source-65', bind: 1, shape: 1};
    await fs.writeFile(`${PACK}/manifest.json`, JSON.stringify(mf, null, 2));
    await ready(BASE);
    await openArmory();
    const a3 = await armoryRace('undead');
    log.push({case: 'manifest-declares-human-fit', ...a3});
    await shot('e4-human-fit-manifest', 'pack labelled undead but carrying human fits', {status: a3.status});

    await restore();

    // ---- B. ?preloadedEquipment --------------------------------------------------------
    console.log('B. ?preloadedEquipment');
    await ready(BASE.replace('?play', '?preloadedEquipment&play'));
    await shot('e5-preloaded-human', 'preloadedEquipment boot: baked human fit');
    const pre = await page.evaluate(async () => {
        const out = {};
        for (const race of ['orc', 'undead', 'human']) {
            out[race] = await globalThis.ASHEN.equipment.switchRace(race)
                .then(() => ({ok: true, race: globalThis.ASHEN.equipment.race}),
                      e => ({ok: false, race: globalThis.ASHEN.equipment.race, error: String(e.message || e)}));
        }
        return out;
    });
    console.log('   ', JSON.stringify(pre));
    log.push({preloadedEquipmentSwitches: pre});
    await shot('e6-preloaded-after-switches', 'preloadedEquipment after undead was refused');

    // ---- C. framing comparison, human vs undead, same views -----------------------------
    console.log('C. armory framing comparison');
    await ready(BASE);
    await openArmory();
    for (const race of ['human', 'undead']) {
        if (race !== 'human') await armoryRace(race);
        for (const view of ['front', 'face', 'full']) {
            await page.locator(`[data-view="${view}"]`).click();
            await page.waitForTimeout(500);
            await shot(`f-${race}-${view}`, `${race} armory ${view} view`);
        }
    }

    await fs.writeFile(`${dir}/refusals.json`, JSON.stringify({log, errors}, null, 2) + '\n');
    console.log(`\npage errors: ${errors.length}`, errors.slice(0, 5));
} finally {
    // If anything above threw mid-corruption the backup is still on disk; put the pack back
    // before clearing it, so a crashed run never leaves a broken asset committed.
    if (await fs.stat(BAK).then(() => true, () => false)) await restore();
    await browser.close();
}
