/** M7/1 review clip: the v2 dye palette on a garment that is actually moving.
 *
 * check-dye-live.mjs measures the palette at a frozen pose against a pinned camera, which is
 * what makes the separation numbers attributable. This exists so the result can be looked at:
 * a palette is a judgement about whether a player can tell two entries apart, and a frozen
 * crop is not how a player sees them. Every dye below is applied with the gait running.
 *
 * The pair to watch is sage/ash. They are the designed minimum -- 3.80 whole-crop units
 * against a 0.01 capture drift -- so if any pair reads as one colour in motion, it is that one.
 *
 * The camera is pinned in front of the character and the character is returned to spawn between
 * sections. The first cut of this clip simply held KeyW through the whole palette: the character
 * walked away from the camera and out of the meadow, so every entry was judged at a different
 * size under different lighting, which is the one thing a colour comparison cannot survive.
 * https://chromedevtools.github.io/devtools-protocol/tot/Page/#event-screencastFrame
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import { DYE_IDS, DYE_PALETTE, DYE_PALETTE_VERSION } from '../../src/ashen-reach/dye-palette.js';

const port = Number(process.env.ASHEN_CDP_PORT), url = process.env.ASHEN_URL;
if (!port || !url) throw Error('Owned CDP port and URL required');
const origin = `http://127.0.0.1:${new URL(url).port}`;
const tag = process.env.ASHEN_TAG || 'v1';
const ITEM = process.env.ASHEN_DYE_ITEM || 'wayfarerTunic';
const SLOT = process.env.ASHEN_DYE_SLOT || 'torso';
const dir = path.resolve(`ve-capture/character-mmo/m7/dye-palette-${tag}`);
await fs.mkdir(path.join(dir, 'frames'), { recursive: true });
const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
const pages = browser.contexts()[0].pages();
const page = pages.find(p => p.url().includes('/ashen-reach.html')) ?? pages.find(p => p.url() === 'about:blank');
const errors = [], frames = [], writes = [], timeline = [], applied = [];
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
/** Dye in frame, and record what the character was doing at that instant.
 *  A refused dye would show nothing changing and read as a pass, so it throws. */
const dye = async (id) => {
    const before = await page.evaluate(() => ASHEN.body.getClipLabel());
    const result = await page.evaluate(async ([item, d]) => {
        const t0 = performance.now();
        const r = await ASHEN.equipment.setDye(item, d);
        while (ASHEN.equipment.getStatus?.()?.pending) await new Promise(requestAnimationFrame);
        return { ...r, ms: +(performance.now() - t0).toFixed(1) };
    }, [ITEM, id]);
    if (result.status !== 'applied') throw Error(`dye ${id} was ${result.status}: ${result.error}`);
    applied.push({ frame: frames.length, dye: id, factor: [...DYE_PALETTE[id].factor],
                   ms: result.ms, clip: before });
};
try {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto(`${origin}/ashen-reach.html?play&clean&pixelRatio=1`);
    await page.waitForFunction(() => globalThis.ASHEN?.whenPlayable, null, { timeout: 90000 });
    await page.evaluate(() => ASHEN.whenRest);
    await page.evaluate(() => { ASHEN.dev.god = true; ASHEN.setView('play'); });
    await page.focus('#renderCanvas');
    const worn = await page.evaluate(([s, i]) => ASHEN.equipment.equip(s, i), [SLOT, ITEM]);
    if (worn.status !== 'applied') throw Error(`setup ${SLOT} ${ITEM}: ${worn.error}`);
    // Front view, close enough to read the garment, and held there: ASHEN.reset() restores the
    // gameplay rig, so this is re-applied after every return to spawn rather than set once.
    const frame = () => page.evaluate(() => {
        ASHEN.rig.distance = ASHEN.rig.distanceTarget = 2.6;
        ASHEN.rig.pitch = 0.06; ASHEN.rig.yaw = Math.PI;
    });
    const home = async () => {
        await page.evaluate(() => { ASHEN.reset(); ASHEN.setView('play'); });
        await frame();
        await page.waitForTimeout(500);
    };
    await frame();
    await page.waitForTimeout(900);
    // The garment has to be on screen before the first dye, or the opening seconds show a bare
    // torso and the clip's first entry is a lie. Checked, not assumed.
    const dressed = await page.evaluate(([slot, item]) => {
        const state = ASHEN.equipment.getState();
        return { worn: state[slot], meshes: ASHEN.scene.meshes.filter(m => m.name.toLowerCase()
            .includes(item.replace(/^wayfarer/i, '').toLowerCase())).length };
    }, [SLOT, ITEM]);
    if (dressed.worn !== ITEM || dressed.meshes === 0) {
        throw Error(`${ITEM} is not rendering before recording: ${JSON.stringify(dressed)}`);
    }
    const canvas = await page.evaluate(() => [renderCanvas.width, renderCanvas.height]);
    recording = true;
    await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 86, maxWidth: 1280, maxHeight: 720, everyNthFrame: 2 });

    // Hold on the dressed character first. A dye change drops the piece for a median of one
    // animation frame and up to three (measure-dye-gap.mjs, with an idle control at zero), so
    // opening straight into the first change put a bare torso in frame 0 and read as "no
    // garment". The flicker still appears at every change below; it is just not the first thing
    // the clip asserts.
    await page.waitForTimeout(700);

    // Every entry at one framing under one light, which is the only way ten colours can be
    // compared with each other rather than each judged against a different background.
    mark(`${DYE_PALETTE_VERSION}: every entry, one framing, idle animation running`);
    for (const id of DYE_IDS) {
        await dye(id);
        await page.waitForTimeout(760);
    }

    // The designed-minimum pair, back to back and twice, because that is the one judgement the
    // numbers cannot make: 3.80 units is a measurement, "a player can tell them apart" is not.
    mark('the closest designed pair, alternating: sage / ash');
    await page.waitForTimeout(400);
    for (let i = 0; i < 2; i++) {
        await dye('sage'); await page.waitForTimeout(950);
        await dye('ash'); await page.waitForTimeout(950);
    }

    mark('walking, camera held in front: the dye reads the same on a moving garment');
    await home();
    await dye('heather');
    // Yaw AND distance are re-pinned every frame. Pinning only the yaw put the camera in front
    // of a character who then walked straight into it -- W moves along the camera's forward axis,
    // so a front camera means walking at the lens -- and the middle of the section became a
    // close-up of the inside of his shoulder.
    const walkFacing = page.evaluate(async () => {
        const t0 = performance.now();
        while (performance.now() - t0 < 4200) {
            ASHEN.rig.yaw = Math.PI;
            ASHEN.rig.distance = ASHEN.rig.distanceTarget = 3.4;
            await new Promise(requestAnimationFrame);
        }
    });
    await page.keyboard.down('KeyW'); await page.waitForTimeout(1300);
    await dye('moss'); await page.waitForTimeout(1300);
    await dye('amber'); await page.waitForTimeout(1200);
    await page.keyboard.up('KeyW');
    await walkFacing;

    mark('oxblood at a full orbit — the dye holds through every lighting angle');
    await home();
    // The orbit needs more room than the review framing: at 2.6 m the camera met the terrain
    // behind the character and collision pulled it to arm's length, so a third of the previous
    // cut's orbit was a close-up of his throat.
    await page.evaluate(() => { ASHEN.rig.distance = ASHEN.rig.distanceTarget = 4.6; ASHEN.rig.pitch = 0.16; });
    await page.waitForTimeout(400);
    await dye('oxblood');
    await page.evaluate(async () => {
        const from = ASHEN.rig.yaw, t0 = performance.now();
        for (;;) { const k = Math.min(1, (performance.now() - t0) / 4000);
            ASHEN.rig.yaw = from + 2 * Math.PI * k;
            ASHEN.rig.distance = ASHEN.rig.distanceTarget = 4.6;
            if (k >= 1) break; await new Promise(requestAnimationFrame); }
    });

    mark('sprint and jump dyed — a rebuild mid-stride does not reset the gait');
    await home();
    // Wider than the review framing: at 2.6 m the jump brought the character through the near
    // plane and one section of the previous cut was a close-up of the inside of his shoulder.
    await page.evaluate(() => { ASHEN.rig.distance = ASHEN.rig.distanceTarget = 4.4; ASHEN.rig.pitch = 0.1; });
    await page.waitForTimeout(400);
    const sprintFraming = page.evaluate(async () => {
        const t0 = performance.now();
        while (performance.now() - t0 < 4600) {
            ASHEN.rig.distance = ASHEN.rig.distanceTarget = 4.4;
            await new Promise(requestAnimationFrame);
        }
    });
    await page.keyboard.down('ShiftLeft'); await page.keyboard.down('KeyW');
    await page.waitForTimeout(800);
    await dye('verdigris'); await page.waitForTimeout(500);
    await page.keyboard.down('Space'); await page.waitForTimeout(60); await page.keyboard.up('Space');
    await page.waitForTimeout(150);
    await dye('amber');
    await page.waitForTimeout(1400);
    await page.keyboard.up('KeyW'); await page.keyboard.up('ShiftLeft');
    await sprintFraming;
    await page.waitForTimeout(900);

    recording = false;
    await cdp.send('Page.stopScreencast');
    await Promise.all(writes);
    const endCanvas = await page.evaluate(() => [renderCanvas.width, renderCanvas.height]);
    const gpu = await page.evaluate(() => ASHEN.gpu.errors);
    if (canvas.join('x') !== '1280x720' || endCanvas.join('x') !== canvas.join('x')) throw Error(`Canvas changed: ${canvas} -> ${endCanvas}`);
    if (frames.some(f => f.width !== 1280 || f.height !== 720 || !Number.isFinite(f.time))) throw Error('Frame metadata invalid');
    if (gpu.length) throw Error(`GPU errors: ${JSON.stringify(gpu)}`);
    if (applied.length !== DYE_IDS.length + 10) throw Error(`only ${applied.length} dyes applied`);
    const byTime = frames.toSorted((a, b) => a.time - b.time);
    const ordered = byTime.filter((f, i) => i === 0 || f.time !== byTime[i - 1].time);
    let concat = 'ffconcat version 1.0\n';
    for (let i = 0; i < ordered.length; i++) {
        concat += `file 'frames/${ordered[i].name}'\n`;
        if (i + 1 < ordered.length) concat += `duration ${Math.max(.001, ordered[i + 1].time - ordered[i].time).toFixed(6)}\n`;
    }
    await fs.writeFile(path.join(dir, 'frames.ffconcat'), concat);
    await fs.writeFile(path.join(dir, 'report.json'), JSON.stringify({
        sourceUrl: page.url(), palette: DYE_PALETTE_VERSION, item: ITEM, slot: SLOT,
        viewport: [1280, 720], canvas, frames: ordered.length,
        seconds: +(ordered.at(-1).time - ordered[0].time).toFixed(2), timeline, applied,
        dyes: await page.evaluate(() => ASHEN.equipment.getDyes()), errors,
    }, null, 2));
    console.log(JSON.stringify({ dir, frames: ordered.length, dyes: applied.length, errors: errors.length }));
    if (errors.length) process.exitCode = 1;
} catch (e) {
    console.error(e); process.exitCode = 1;
} finally {
    recording = false;
    await cdp.send('Page.stopScreencast').catch(() => {});
    await page.goto('about:blank').catch(() => {});
    await browser.close();
}
