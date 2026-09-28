/** M005 live motion capture: the refitted garments against the shipped ones.
 *
 * The first pass wears the shipped garments on a stout body, which is the defect M004
 * measured. Every pass after it wears the refitted pack. Each runs the same set -- an orbit
 * for front, side and back, both spells, then walk into run into jump and land -- so the
 * difference on screen is the fit and nothing else.
 *
 * Page.startScreencast: https://chromedevtools.github.io/devtools-protocol/tot/Page/#method-startScreencast
 * Only run against an owned harness slot; the tab is parked on about:blank afterwards.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import {chromium} from 'playwright';

const port = Number(process.env.ASHEN_CDP_PORT), url = process.env.ASHEN_URL;
if (!port || !url) throw Error('ASHEN_CDP_PORT and ASHEN_URL required');
const base = url.split('?')[0];
const dir = process.env.ASHEN_CAPTURE_DIR || 've-capture/character-mmo/m005/motion';

const PASSES = [
    {id: 'stout-shipped', query: 'humanShape=stout&garmentFit=shipped', label: 'stout, shipped garments'},
    {id: 'stout-refit', query: 'humanShape=stout&garmentFit=refit', label: 'stout, refitted garments'},
    {id: 'slender-refit', query: 'humanShape=slender&garmentFit=refit', label: 'slender, refitted garments'},
    {id: 'short-refit', query: 'humanShape=slender&humanHeight=0.9&garmentFit=refit', label: 'slender at 1.58 m, refitted'},
    {id: 'tall-refit', query: 'humanShape=stout&humanHeight=1.15&garmentFit=refit', label: 'stout at 2.02 m, refitted'},
];
const EMPTY = {helmet: null, torso: null, legs: null, boots: null, gloves: null, mainHand: null, offHand: null};
const STARTER = {helmet: null, torso: 'wayfarerTunic', legs: 'wayfarerTrousers', boots: 'wayfarerBoots', gloves: null, mainHand: null, offHand: null};

await fs.mkdir(path.join(dir, 'frames'), {recursive: true});
const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
const pages = browser.contexts().flatMap(c => c.pages());
const page = pages.find(p => p.url().startsWith(base)) ?? pages[0];
if (!page) throw Error('No owned page in this harness slot');

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
const pause = ms => page.waitForTimeout(ms);
// Marks are anchored to the screencast's own frame counter, not wall-clock. The two
// clocks differ by however long the first navigation took, which silently moved every
// label several seconds away from what it described in the first capture.
const mark = label => timeline.push({frame: frames.length, label});

/** Sweep the orbit yaw so one pass shows front, side and back without cutting. */
async function orbit(page, degrees, ms) {
    await page.evaluate(async ([deg, duration]) => {
        const from = ASHEN.rig.yaw, to = from + deg * Math.PI / 180;
        const t0 = performance.now();
        for (;;) {
            const k = Math.min(1, (performance.now() - t0) / duration);
            ASHEN.rig.yaw = from + (to - from) * k;
            if (k >= 1) return;
            await new Promise(requestAnimationFrame);
        }
    }, [degrees, ms]);
}

let canvas = null;
try {
    await page.setViewportSize({width: 1280, height: 720});
    for (const pass of PASSES) {
        await page.goto(`${base}?play&clean&pixelRatio=1&${pass.query}`);
        await page.waitForFunction(() => globalThis.ASHEN?.whenPlayable, null, {timeout: 90000});
        await page.evaluate(() => ASHEN.whenRest);
        await page.evaluate(() => { ASHEN.setView('play'); ASHEN.rig.pitch = 0.08; ASHEN.rig.distance = ASHEN.rig.distanceTarget = 3.4; });
        canvas ??= await page.evaluate(() => [document.getElementById('renderCanvas').width, document.getElementById('renderCanvas').height]);
        if (!recording) {
            recording = true;
            await cdp.send('Page.startScreencast', {format: 'jpeg', quality: 84, maxWidth: 1280, maxHeight: 720, everyNthFrame: 2});
        }

        await page.evaluate(l => ASHEN.equipment.setLoadout(l), STARTER);
        await page.waitForFunction(() => !ASHEN.equipment.getStatus?.()?.pending, null, {timeout: 30000});
        await pause(400);
        mark(`${pass.label} — orbit back to front to back`);
        const yawBefore = await page.evaluate(() => ASHEN.rig.yaw);
        await orbit(page, 360, 3000);
        const yawAfter = await page.evaluate(() => ASHEN.rig.yaw);
        if (Math.abs(yawAfter - yawBefore - 2 * Math.PI) > 0.05) {
            errors.push(`${pass.id}: camera orbit did not hold (${yawBefore.toFixed(2)} -> ${yawAfter.toFixed(2)})`);
        }

        // Spells first, from the spawn point. Walking forward puts a headstone between the
        // character and the training dummy, and the first capture spent both casts printing
        // "Target is blocked" instead of showing a cast.
        mark(`${pass.label} — fire blast and lava cast`);
        const targeted = await page.evaluate(() => {
            const id = ASHEN.combat?.dummy?.id;
            if (id == null) return null;
            ASHEN.combat.targeting.select(id);
            return ASHEN.combat.snapshot().target === id ? ASHEN.combat.snapshot().dummy.hp : null;
        });
        if (targeted == null) errors.push(`${pass.id}: training dummy target unavailable`);
        await page.keyboard.press('Digit1'); await pause(1200);
        await page.keyboard.press('Digit2'); await pause(1500);
        const afterCast = await page.evaluate(() => ASHEN.combat.snapshot().dummy.hp);
        if (targeted != null && !(afterCast < targeted)) {
            errors.push(`${pass.id}: neither cast damaged the dummy (${targeted} -> ${afterCast})`);
        }

        mark(`${pass.label} — walk, run, jump and land`);
        await page.keyboard.down('KeyW'); await pause(900);
        await page.keyboard.down('ShiftLeft'); await pause(800); await page.keyboard.up('ShiftLeft');
        await page.keyboard.press('Space'); await pause(900);
        await page.keyboard.up('KeyW'); await pause(300);

        mark(`${pass.label} — second orbit under load`);
        await orbit(page, 200, 1300);
        await page.keyboard.down('KeyW'); await pause(700); await page.keyboard.up('KeyW');
        await pause(300);
        await page.screenshot({path: path.join(dir, `${pass.id}.png`)});
        if (await page.evaluate(() => ASHEN.combat.snapshot().life.dead)) throw Error(`${pass.id} died during motion review`);
    }
    recording = false;
    await cdp.send('Page.stopScreencast');
    await Promise.all(writes);
    let concat = 'ffconcat version 1.0\n';
    for (let i = 0; i < frames.length; i++) {
        concat += `file 'frames/${frames[i].name}'\n`;
        if (i + 1 < frames.length) concat += `duration ${Math.max(0.001, frames[i + 1].time - frames[i].time).toFixed(6)}\n`;
    }
    await fs.writeFile(path.join(dir, 'frames.ffconcat'), concat);
    await fs.writeFile(path.join(dir, 'recording.json'), `${JSON.stringify({
        sourceUrl: base, passes: PASSES, viewport: [1280, 720], canvas,
        frames: frames.length, firstTimestamp: frames[0]?.time, lastTimestamp: frames.at(-1)?.time,
        frameDimensions: [...new Set(frames.map(f => `${f.width}x${f.height}`))], timeline, errors,
    }, null, 2)}\n`);
    console.log(JSON.stringify({frames: frames.length, canvas, seconds: Number((frames.at(-1)?.time - frames[0]?.time).toFixed(3)), errors}));
} finally {
    recording = false;
    await cdp.send('Page.stopScreencast').catch(() => {});
    await cdp.detach().catch(() => {});
    await page.goto('about:blank').catch(() => {});
    await browser.close();
}
