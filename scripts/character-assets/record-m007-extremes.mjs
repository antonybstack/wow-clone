/** M007: the worst posed-fit cases from the offline matrix, in actual gameplay motion.
 *
 * `measure-posed-garment-fit.mjs` ranks Turn90_L, Roll and Crouch_Fwd_Loop worst. The armory's
 * motion list exposes nine named previews and none of those three, but `main.js` maps
 * Turn90_L/Turn90_R to gameplay turning, so this drives the character rather than scrubbing a
 * preview: walk, turn hard both ways, sprint, jump and land, then cast.
 * https://chromedevtools.github.io/devtools-protocol/tot/Page/#event-screencastFrame
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import {chromium} from 'playwright';

const port = Number(process.env.ASHEN_CDP_PORT), url = process.env.ASHEN_URL;
const shape = process.env.ASHEN_EXTREME_SHAPE || 'stout';
if (!port || !url || !['slender', 'stout'].includes(shape)) throw Error('Owned CDP/URL and a shape required');
const origin = `http://127.0.0.1:${new URL(url).port}`;
const dir = path.resolve(`ve-capture/character-mmo/m007/extremes-${shape}-${process.env.ASHEN_EXTREME_OUTFIT || 'mixed-top-wayfarer'}`);
await fs.mkdir(path.join(dir, 'frames'), {recursive: true});
const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
const pages = browser.contexts()[0].pages();
const page = pages.find(p => p.url().includes('/ashen-reach.html')) ?? pages.find(p => p.url() === 'about:blank');
const errors = [], frames = [], writes = [], timeline = [];
page.on('pageerror', e => errors.push(String(e.message ?? e)));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
const cdp = await page.context().newCDPSession(page);
let recording = false;
cdp.on('Page.screencastFrame', e => {
    cdp.send('Page.screencastFrameAck', {sessionId: e.sessionId}).catch(() => {});
    if (!recording) return;
    const name = `frame-${String(frames.length).padStart(5, '0')}.jpg`;
    frames.push({name, time: e.metadata.timestamp, width: e.metadata.deviceWidth, height: e.metadata.deviceHeight});
    writes.push(fs.writeFile(path.join(dir, 'frames', name), Buffer.from(e.data, 'base64')));
});
const mark = label => timeline.push({frame: frames.length, label});
try {
    await page.setViewportSize({width: 1280, height: 720});
    await page.goto(`${origin}/ashen-reach.html?play&clean&legacyStart=1&noEnemies=1&pixelRatio=1&creator=1`);
    await page.waitForFunction(() => globalThis.ASHEN?.whenPlayable, null, {timeout: 90000});
    await page.evaluate(() => ASHEN.whenRest);
    await page.waitForSelector('.creator-panel:not([hidden])', {timeout: 20000});
    await page.evaluate(() => { ASHEN.dev.god = true; ASHEN.creator.clear(); });
    await page.evaluate(s => { ASHEN.creator.set('build', {[s]: 0.95}); }, shape);
    await page.evaluate(() => ASHEN.creator.settled());
    await page.evaluate(() => ASHEN.creator.close());
    // Which mixed outfit the offline matrix ranks worst depends on the shape, so it is
    // selected rather than hard-coded.
    const OUTFITS = {
        'mixed-top-wayfarer': [['torso', 'wayfarerTunic'], ['legs', 'graveweaverSkirt'], ['boots', 'wayfarerBoots']],
        'mixed-top-graveweaver': [['torso', 'graveweaverTop'], ['legs', 'wayfarerTrousers'], ['boots', 'wayfarerBoots']],
        wayfarer: [['torso', 'wayfarerTunic'], ['legs', 'wayfarerTrousers'], ['boots', 'wayfarerBoots']],
    };
    const outfitName = process.env.ASHEN_EXTREME_OUTFIT || 'mixed-top-wayfarer';
    if (!OUTFITS[outfitName]) throw Error(`Unknown outfit ${outfitName}`);
    await page.evaluate(() => ASHEN.armory.open());
    for (const [slot, id] of [...OUTFITS[outfitName], ['helmet', ''], ['gloves', ''], ['mainHand', '']]) {
        await page.selectOption(`#armory [data-equipment="${slot}"]`, id);
        // No catch: a silently rejected option would leave the wrong outfit on the character.
        await page.waitForFunction(([s, i]) => (ASHEN.equipment.getState()[s] || '') === i, [slot, id], {timeout: 20000});
    }
    const outfit = await page.evaluate(() => ASHEN.equipment.getState());
    const applied = await page.evaluate(() => ASHEN.humanShape);
    await page.evaluate(() => ASHEN.armory.close());
    await page.evaluate(() => ASHEN.setView('play'));
    await page.waitForTimeout(500);
    const canvas = await page.evaluate(() => [renderCanvas.width, renderCanvas.height]);
    recording = true;
    await cdp.send('Page.startScreencast', {format: 'jpeg', quality: 86, maxWidth: 1280, maxHeight: 720, everyNthFrame: 2});

    mark(`${shape} 0.95, ${outfitName} — orbit at rest`);
    await page.evaluate(async () => {
        const from = ASHEN.rig.yaw, t0 = performance.now();
        ASHEN.rig.distance = ASHEN.rig.distanceTarget = 2.6; ASHEN.rig.pitch = 0.1;
        for (;;) { const k = Math.min(1, (performance.now() - t0) / 4200);
            ASHEN.rig.yaw = from + 2 * Math.PI * k; if (k >= 1) break; await new Promise(requestAnimationFrame); }
    });
    mark('walk, then hard turns both ways (Turn90_L / Turn90_R)');
    await page.keyboard.down('KeyW'); await page.waitForTimeout(900);
    await page.keyboard.down('KeyA'); await page.waitForTimeout(1500); await page.keyboard.up('KeyA');
    await page.keyboard.down('KeyD'); await page.waitForTimeout(1500); await page.keyboard.up('KeyD');
    mark('sprint, jump and land');
    await page.keyboard.down('ShiftLeft'); await page.waitForTimeout(1200);
    await page.keyboard.press('Space'); await page.waitForTimeout(1600);
    await page.keyboard.up('ShiftLeft'); await page.keyboard.up('KeyW');
    await page.waitForTimeout(700);
    mark('cast');
    await page.keyboard.press('Digit1'); await page.waitForTimeout(1700);
    if (process.env.ASHEN_EXTREME_SWORD === '1') {
        // Sword_Attack is the numeric peak of the offline matrix, so it gets driven rather
        // than assumed. The sword goes on here, after the fit passes above, so the clip
        // still shows the outfit the matrix measured.
        mark('sword drawn, target acquired, swing (Sword_Attack)');
        await page.evaluate(async () => {
            ASHEN.armory.open();
            const s = document.querySelector('#armory [data-equipment="mainHand"]');
            s.value = 'ironSword'; s.dispatchEvent(new Event('change', {bubbles: true}));
        });
        await page.waitForFunction(() => ASHEN.equipment.getState().mainHand === 'ironSword', null, {timeout: 20000});
        await page.evaluate(() => ASHEN.armory.close());
        await page.waitForTimeout(500);
        await page.keyboard.press('Tab'); await page.waitForTimeout(400);
        for (let i = 0; i < 4; i++) { await page.keyboard.press('KeyF'); await page.waitForTimeout(800); }
    }

    recording = false;
    await cdp.send('Page.stopScreencast');
    await Promise.all(writes);
    const endCanvas = await page.evaluate(() => [renderCanvas.width, renderCanvas.height]);
    const alive = await page.evaluate(() => ASHEN.combat?.getState?.()?.dead ?? false);
    if (alive) throw Error('Character died during capture');
    if (canvas.join('x') !== '1280x720' || endCanvas.join('x') !== canvas.join('x')) throw Error(`Canvas changed: ${canvas} -> ${endCanvas}`);
    if (frames.some(f => f.width !== 1280 || f.height !== 720 || !Number.isFinite(f.time))) throw Error('Frame metadata invalid');
    const byTime = frames.toSorted((a, b) => a.time - b.time);
    const ordered = byTime.filter((f, i) => i === 0 || f.time !== byTime[i - 1].time);
    let concat = 'ffconcat version 1.0\n';
    for (let i = 0; i < ordered.length; i++) {
        concat += `file 'frames/${ordered[i].name}'\n`;
        if (i + 1 < ordered.length) concat += `duration ${Math.max(.001, ordered[i + 1].time - ordered[i].time).toFixed(6)}\n`;
    }
    await fs.writeFile(path.join(dir, 'frames.ffconcat'), concat);
    const report = {shape, outfitName, outfit, appliedShape: applied, sourceUrl: page.url(), viewport: [1280, 720], canvas,
        frames: frames.length, encodedFrames: ordered.length,
        firstTimestamp: ordered[0].time, lastTimestamp: ordered.at(-1).time, timeline, errors};
    await fs.writeFile(path.join(dir, 'recording.json'), JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify(report));
} finally {
    recording = false;
    await cdp.send('Page.stopScreencast').catch(() => {});
    await cdp.detach().catch(() => {});
    await page.goto('about:blank').catch(() => {});
    await browser.close();
}
