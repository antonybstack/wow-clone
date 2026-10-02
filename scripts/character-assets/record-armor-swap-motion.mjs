/** M6/1 review clip: pieces changing while the character is actually moving.
 *
 * The matrix in check-armor-swap-motion.mjs measures the swaps; this exists so the claim can
 * be looked at. Every swap below happens with the motion already running and the camera close
 * enough to read the piece, because a swap that quietly restarts the gait or drops the weapon
 * is obvious in motion and invisible in a still.
 * https://chromedevtools.github.io/devtools-protocol/tot/Page/#event-screencastFrame
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const port = Number(process.env.ASHEN_CDP_PORT), url = process.env.ASHEN_URL;
if (!port || !url) throw Error('Owned CDP port and URL required');
const origin = `http://127.0.0.1:${new URL(url).port}`;
const tag = process.env.ASHEN_TAG || 'v1';
const dir = path.resolve(`ve-capture/character-mmo/m6/swap-motion-${tag}`);
await fs.mkdir(path.join(dir, 'frames'), { recursive: true });
const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
const pages = browser.contexts()[0].pages();
const page = pages.find(p => p.url().includes('/ashen-reach.html')) ?? pages.find(p => p.url() === 'about:blank');
const errors = [], frames = [], writes = [], timeline = [], swaps = [];
page.on('pageerror', e => errors.push(String(e.message ?? e)));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
const cdp = await page.context().newCDPSession(page);
let recording = false;
cdp.on('Page.screencastFrame', e => {
    cdp.send('Page.screencastFrameAck', { sessionId: e.sessionId }).catch(() => {});
    if (!recording) return;
    const name = `frame-${String(frames.length).padStart(5, '0')}.jpg`;
    frames.push({ name, time: e.metadata.timestamp, width: e.metadata.deviceWidth, height: e.metadata.deviceHeight });
    writes.push(fs.writeFile(path.join(dir, 'frames', name), Buffer.from(e.data, 'base64')));
});
const mark = label => timeline.push({ frame: frames.length, label });
/** Swap in frame, and record what the character was doing at that instant. */
const swap = async (slot, id) => {
    const before = await page.evaluate(() => ({ label: ASHEN.body.getClipLabel(), phase: ASHEN.body.getState().phase }));
    const result = await page.evaluate(([s, i]) => ASHEN.equipment.equip(s, i), [slot, id]);
    const after = await page.evaluate(() => ({ label: ASHEN.body.getClipLabel(), phase: ASHEN.body.getState().phase, equip: ASHEN.equipment.getState() }));
    swaps.push({ frame: frames.length, slot, to: id, status: result.status, error: result.error ?? null, before, after });
    // A refused swap in a review clip would show nothing changing and read as a pass.
    if (result.status !== 'applied') throw Error(`${slot} -> ${id} was ${result.status}: ${result.error}`);
};
try {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto(`${origin}/ashen-reach.html?play&clean&pixelRatio=1`);
    await page.waitForFunction(() => globalThis.ASHEN?.whenPlayable, null, { timeout: 90000 });
    await page.evaluate(() => ASHEN.whenRest);
    await page.evaluate(() => { ASHEN.dev.god = true; ASHEN.setView('play'); });
    await page.focus('#renderCanvas');
    for (const [slot, id] of [['torso', 'duskguardCuirass'], ['legs', 'duskguardTassets'], ['boots', 'duskguardGreaves'], ['gloves', 'duskguardVambraces'], ['shoulders', 'wardenPauldrons'], ['mainHand', 'ironSword'], ['helmet', null], ['offHand', null]]) {
        const r = await page.evaluate(([s, i]) => ASHEN.equipment.equip(s, i), [slot, id]);
        if (r.status !== 'applied') throw Error(`setup ${slot} ${id}: ${r.error}`);
    }
    // reset() restores the gameplay rig, so the review framing has to be re-pinned after it
    // rather than set once: the first cast section was shot from the default distance and the
    // helmet and gloves changing were too small to read.
    const frame = () => page.evaluate(() => { ASHEN.rig.distance = ASHEN.rig.distanceTarget = 3.1; ASHEN.rig.pitch = 0.08; });
    await frame();
    await page.waitForTimeout(600);
    const canvas = await page.evaluate(() => [renderCanvas.width, renderCanvas.height]);
    recording = true;
    await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 86, maxWidth: 1280, maxHeight: 720, everyNthFrame: 2 });

    mark('Duskguard plate, pauldrons and sword — orbit at rest');
    await page.evaluate(async () => {
        const from = ASHEN.rig.yaw, t0 = performance.now();
        for (;;) { const k = Math.min(1, (performance.now() - t0) / 3600);
            ASHEN.rig.yaw = from + 2 * Math.PI * k; if (k >= 1) break; await new Promise(requestAnimationFrame); }
    });

    mark('walking: torso, legs and shoulders change mid-stride');
    await page.keyboard.down('ShiftLeft'); await page.keyboard.down('KeyW'); await page.waitForTimeout(1100);
    await swap('torso', 'lectorCoat'); await page.waitForTimeout(900);
    await swap('legs', 'graveweaverSkirt'); await page.waitForTimeout(900);
    await swap('shoulders', null); await page.waitForTimeout(800);
    await page.keyboard.up('ShiftLeft');

    mark('sprinting: boots change, then the weapon changes in mid-air');
    await page.waitForTimeout(900);
    await swap('boots', 'wayfarerBoots'); await page.waitForTimeout(700);
    await page.keyboard.down('Space'); await page.waitForTimeout(60); await page.keyboard.up('Space');
    await page.waitForTimeout(140);
    await swap('mainHand', 'graveweaverGreatstaff');
    await page.waitForTimeout(1400);
    await page.keyboard.up('KeyW'); await page.waitForTimeout(900);

    mark('casting: helmet and gloves change without interrupting the cast');
    // Back to spawn so a hostile is in range at all, then cycle and press until the cast is
    // actually under way. The first version of this clip pressed once and swapped anyway, and
    // its own labels showed Idle_Loop throughout: a cast section with no cast in it.
    await page.evaluate(() => { ASHEN.reset(); ASHEN.setView('play'); });
    await frame();
    await page.waitForTimeout(400);
    for (let attempt = 0; attempt < 24 && !await page.evaluate(() => ASHEN.body.getState().castingShoot); attempt++) {
        await page.keyboard.press('Digit1'); await page.waitForTimeout(140);
        if (await page.evaluate(() => ASHEN.body.getState().castingShoot)) break;
        await page.keyboard.press('Tab'); await page.waitForTimeout(160);
    }
    if (!await page.evaluate(() => ASHEN.body.getState().castingShoot)) throw Error('No cast was in progress for the casting section');
    await swap('helmet', 'graveweaverHood'); await page.waitForTimeout(200);
    await swap('gloves', 'graveweaverGloves'); await page.waitForTimeout(1600);

    mark('swinging a sword: the off hand fills during the swing');
    await swap('mainHand', 'ironSword'); await page.waitForTimeout(600);
    if (!await page.evaluate(() => ASHEN.body.playMelee())) throw Error('playMelee refused, so the swing section has no swing');
    await page.waitForTimeout(180);
    await swap('offHand', 'graveweaverBook');
    await page.waitForTimeout(1500);

    mark('final orbit — every piece swapped above is the one being worn');
    await page.evaluate(async () => {
        const from = ASHEN.rig.yaw, t0 = performance.now();
        for (;;) { const k = Math.min(1, (performance.now() - t0) / 3600);
            ASHEN.rig.yaw = from + 2 * Math.PI * k; if (k >= 1) break; await new Promise(requestAnimationFrame); }
    });

    recording = false;
    await cdp.send('Page.stopScreencast');
    await Promise.all(writes);
    const endCanvas = await page.evaluate(() => [renderCanvas.width, renderCanvas.height]);
    const gpu = await page.evaluate(() => ASHEN.gpu.errors);
    if (canvas.join('x') !== '1280x720' || endCanvas.join('x') !== canvas.join('x')) throw Error(`Canvas changed: ${canvas} -> ${endCanvas}`);
    if (frames.some(f => f.width !== 1280 || f.height !== 720 || !Number.isFinite(f.time))) throw Error('Frame metadata invalid');
    if (gpu.length) throw Error(`GPU errors: ${JSON.stringify(gpu)}`);
    const byTime = frames.toSorted((a, b) => a.time - b.time);
    const ordered = byTime.filter((f, i) => i === 0 || f.time !== byTime[i - 1].time);
    let concat = 'ffconcat version 1.0\n';
    for (let i = 0; i < ordered.length; i++) {
        concat += `file 'frames/${ordered[i].name}'\n`;
        if (i + 1 < ordered.length) concat += `duration ${Math.max(.001, ordered[i + 1].time - ordered[i].time).toFixed(6)}\n`;
    }
    await fs.writeFile(path.join(dir, 'frames.ffconcat'), concat);
    await fs.writeFile(path.join(dir, 'report.json'), JSON.stringify({
        sourceUrl: page.url(), viewport: [1280, 720], canvas, frames: ordered.length,
        seconds: +(ordered.at(-1).time - ordered[0].time).toFixed(2), timeline, swaps,
        finalEquipment: await page.evaluate(() => ASHEN.equipment.getState()), errors,
    }, null, 2));
    console.log(JSON.stringify({ dir, frames: ordered.length, swaps: swaps.length, errors: errors.length }));
    if (errors.length) process.exitCode = 1;
} catch (e) {
    recording = false;
    await cdp.send('Page.stopScreencast').catch(() => {});
    await fs.writeFile(path.join(dir, 'report.json'), JSON.stringify({ failure: e.stack, timeline, swaps, errors }, null, 2));
    process.exitCode = 1;
    console.error(e);
} finally {
    await browser.close();
}
