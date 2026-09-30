/** Record the M006 creator in the running game on one owned CDP slot.
 * Frame timestamps and dimensions follow the M007 capture protocol.
 * https://chromedevtools.github.io/devtools-protocol/tot/Page/#event-screencastFrame */
import fs from 'node:fs/promises';
import path from 'node:path';
import {chromium} from 'playwright';

const port = Number(process.env.ASHEN_CDP_PORT), url = process.env.ASHEN_URL;
if (!port || !url) throw Error('Owned ASHEN_CDP_PORT and ASHEN_URL required');
const origin = `http://127.0.0.1:${new URL(url).port}`;
const dir = path.resolve('ve-capture/character-mmo/m006/creator-live');
await fs.mkdir(path.join(dir, 'frames'), {recursive: true});
const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
const pages = browser.contexts()[0].pages();
const page = pages.find(p => p.url().includes('/ashen-reach.html')) ?? pages.find(p => p.url() === 'about:blank');
if (!page) throw Error('No owned Ashen Reach page in this harness slot');
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
const settle = async () => {
    await page.evaluate(() => ASHEN.creator?.settled?.());
    await page.evaluate(() => ASHEN.whenNextGpuFrame());
};
/** Drag a slider over `ms`, so the clip shows the body following the control. */
const sweep = async (index, to, ms) => {
    await page.evaluate(async ([i, target, dur]) => {
        const input = [...document.querySelectorAll('.creator-section input[type="range"]')][i];
        const from = Number(input.value), t0 = performance.now();
        for (;;) {
            const k = Math.min(1, (performance.now() - t0) / dur);
            input.value = String(from + (target - from) * k);
            input.dispatchEvent(new Event('input', {bubbles: true}));
            if (k >= 1) break;
            await new Promise(requestAnimationFrame);
        }
    }, [index, to, ms]);
    await settle();
};
try {
    await page.setViewportSize({width: 1280, height: 720});
    await page.goto(`${origin}/ashen-reach.html?play&clean&legacyStart=1&noEnemies=1&pixelRatio=1&creator=1`);
    await page.waitForFunction(() => globalThis.ASHEN?.whenPlayable, null, {timeout: 90000});
    await page.evaluate(() => ASHEN.whenRest);
    await page.evaluate(() => ASHEN.armory.open());
    await page.waitForSelector('#armory .creator-section', {timeout: 20000});
    await page.evaluate(() => { ASHEN.dev.god = true; ASHEN.creator.clear(); });
    await settle();
    const canvas = await page.evaluate(() => [renderCanvas.width, renderCanvas.height]);
    recording = true;
    await cdp.send('Page.startScreencast', {format: 'jpeg', quality: 84, maxWidth: 1280, maxHeight: 720, everyNthFrame: 2});

    mark('default character; only verified controls are offered');
    await page.waitForTimeout(1600);
    mark('height 1.00 -> 0.93, slender 0 -> 0.85');
    await sweep(0, 0.93, 1400);
    await sweep(1, 0.85, 1600);
    await page.waitForTimeout(700);
    mark('the Wayfarer and Graveweaver outfits fit the slender body');
    await page.evaluate(() => ASHEN.creator.close());
    for (const outfit of ['wayfarer', 'graveweaver']) {
        await page.evaluate(id => { ASHEN.armory.open(); document.querySelector(`#armory [data-outfit="${id}"]`).click(); }, outfit);
        await page.waitForFunction(id => {
            const s = ASHEN.equipment.getState();
            return id === 'wayfarer' ? s.torso === 'wayfarerTunic' : s.helmet === 'graveweaverHood';
        }, outfit, {timeout: 20000});
        await settle();
        await page.waitForTimeout(900);
    }
    mark('reset, then height 1.15 and stout 0.95 on the same outfit');
    await page.evaluate(() => { ASHEN.armory.close(); ASHEN.creator.open(); ASHEN.creator.reset(); });
    await settle();
    await sweep(0, 1.15, 1400);
    await sweep(2, 0.95, 1600);
    await page.waitForTimeout(700);
    mark('undo, then back');
    await page.evaluate(() => ASHEN.creator.undo());
    await settle();
    await page.waitForTimeout(800);
    if (process.env.ASHEN_CREATOR_RESTORE === '1') {
        mark('saved, then the page is reloaded');
        await page.evaluate(() => ASHEN.creator.save());
        await page.waitForTimeout(700);
        await page.reload();
        await page.waitForFunction(() => globalThis.ASHEN?.whenPlayable, null, {timeout: 90000});
        await page.evaluate(() => ASHEN.whenRest);
        await page.evaluate(() => ASHEN.armory.open());
    await page.waitForSelector('#armory .creator-section', {timeout: 20000});
        await page.evaluate(() => { ASHEN.dev.god = true; });
        await settle();
        mark('restored: same sliders, same body, no re-entry needed');
        await page.waitForTimeout(1800);
    }
    mark('into the churchyard: walk, run, jump');
    await page.evaluate(() => ASHEN.creator.close());
    await page.waitForTimeout(600);
    await page.evaluate(() => ASHEN.setView('play'));
    await page.keyboard.down('KeyW'); await page.waitForTimeout(1300);
    await page.keyboard.down('ShiftLeft'); await page.waitForTimeout(1200);
    await page.keyboard.press('Space'); await page.waitForTimeout(1400);
    await page.keyboard.up('ShiftLeft'); await page.keyboard.up('KeyW');
    await page.waitForTimeout(900);

    recording = false;
    await cdp.send('Page.stopScreencast');
    await Promise.all(writes);
    const endCanvas = await page.evaluate(() => [renderCanvas.width, renderCanvas.height]);
    if (canvas.join('x') !== '1280x720' || endCanvas.join('x') !== canvas.join('x')) throw Error(`Canvas changed: ${canvas} -> ${endCanvas}`);
    if (frames.some(f => f.width !== 1280 || f.height !== 720 || !Number.isFinite(f.time))) throw Error('Frame dimensions or timestamps invalid');
    const byTime = frames.toSorted((a, b) => a.time - b.time);
    const ordered = byTime.filter((f, i) => i === 0 || f.time !== byTime[i - 1].time);
    let concat = 'ffconcat version 1.0\n';
    for (let i = 0; i < ordered.length; i++) {
        concat += `file 'frames/${ordered[i].name}'\n`;
        if (i + 1 < ordered.length) concat += `duration ${Math.max(.001, ordered[i + 1].time - ordered[i].time).toFixed(6)}\n`;
    }
    await fs.writeFile(path.join(dir, 'frames.ffconcat'), concat);
    const report = {sourceUrl: page.url(), viewport: [1280, 720], canvas, frames: frames.length,
        encodedFrames: ordered.length, firstTimestamp: ordered[0].time, lastTimestamp: ordered.at(-1).time,
        outOfOrderArrivals: frames.reduce((n, f, i) => n + Number(i > 0 && f.time < frames[i - 1].time), 0),
        frameDimensions: ['1280x720'], timeline, errors};
    await fs.writeFile(path.join(dir, 'recording.json'), JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify(report));
} finally {
    recording = false;
    await cdp.send('Page.stopScreencast').catch(() => {});
    await cdp.detach().catch(() => {});
    await page.goto('about:blank').catch(() => {});
    await browser.close();
}
