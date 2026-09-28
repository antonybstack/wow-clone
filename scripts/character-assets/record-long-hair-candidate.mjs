/** Record an M006 hair audition in the actual game, using one owned CDP slot.
 * The candidate is substituted at the body fetch boundary; no runtime or public asset
 * changes are needed. Frame timestamps and dimensions follow the M007 capture protocol.
 * https://chromedevtools.github.io/devtools-protocol/tot/Page/#event-screencastFrame
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import {chromium} from 'playwright';

const port = Number(process.env.ASHEN_CDP_PORT);
const url = process.env.ASHEN_URL;
const variant = process.env.ASHEN_HAIR_VARIANT ?? 'ponytail01-tail';
if (!port || !url || !['long01', 'ponytail01', 'ponytail01-tail'].includes(variant)) {
    throw Error('Owned ASHEN_CDP_PORT, ASHEN_URL and valid ASHEN_HAIR_VARIANT required');
}
const file = path.resolve(`.cache/character-mmo/m006/human-${variant}-candidate.glb`);
const dir = path.resolve(`ve-capture/character-mmo/m006/${variant}-live`);
await fs.mkdir(path.join(dir, 'frames'), {recursive: true});
const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
const pages = browser.contexts()[0].pages();
const page = pages.find(p => p.url().includes(`127.0.0.1:${new URL(url).port}/ashen-reach.html`))
    ?? pages.find(p => p.url() === 'about:blank');
if (!page) throw Error('No owned Ashen Reach page in this harness slot');
const errors = [], frames = [], writes = [], timeline = [];
page.on('pageerror', e => errors.push(String(e.message ?? e)));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
let bodyRequests = 0, recording = false;
await page.route('**/ashen-reach/equipment/body.glb', async route => {
    bodyRequests++;
    await route.fulfill({status: 200, contentType: 'model/gltf-binary', body: await fs.readFile(file)});
});
const cdp = await page.context().newCDPSession(page);
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
    await page.goto(`http://127.0.0.1:${new URL(url).port}/ashen-reach.html?play&clean&legacyStart=1&noEnemies=1&pixelRatio=1`);
    await page.waitForFunction(() => globalThis.ASHEN?.whenPlayable, null, {timeout: 90000});
    await page.evaluate(() => ASHEN.whenRest);
    if (bodyRequests !== 1) throw Error(`Expected one intercepted body request, got ${bodyRequests}`);
    await page.evaluate(() => { ASHEN.dev.god = true; ASHEN.setView('play'); ASHEN.rig.pitch = 0.08; ASHEN.rig.distance = ASHEN.rig.distanceTarget = 3.1; });
    const canvas = await page.evaluate(() => [document.getElementById('renderCanvas').width, document.getElementById('renderCanvas').height]);
    recording = true;
    await cdp.send('Page.startScreencast', {format: 'jpeg', quality: 84, maxWidth: 1280, maxHeight: 720, everyNthFrame: 2});
    mark('idle orbit front, side and back');
    await page.evaluate(async () => {
        const from = ASHEN.rig.yaw, to = from + 2 * Math.PI, t0 = performance.now();
        for (;;) {
            const k = Math.min(1, (performance.now() - t0) / 5000);
            ASHEN.rig.yaw = from + (to - from) * k;
            if (k >= 1) break;
            await new Promise(requestAnimationFrame);
        }
    });
    mark('walk run jump land');
    await page.keyboard.down('KeyW'); await page.waitForTimeout(1400);
    await page.keyboard.down('ShiftLeft'); await page.waitForTimeout(1400);
    await page.keyboard.press('Space'); await page.waitForTimeout(1400);
    await page.keyboard.up('ShiftLeft'); await page.keyboard.up('KeyW');
    await page.waitForTimeout(900);
    recording = false;
    await cdp.send('Page.stopScreencast');
    await Promise.all(writes);
    const endCanvas = await page.evaluate(() => [document.getElementById('renderCanvas').width, document.getElementById('renderCanvas').height]);
    if (canvas.join('x') !== '1280x720' || endCanvas.join('x') !== canvas.join('x') || frames.length < 2) throw Error(`Canvas changed: ${canvas} -> ${endCanvas}`);
    if (frames.some(f => f.width !== 1280 || f.height !== 720 || !Number.isFinite(f.time))) throw Error('Frame dimensions or timestamps invalid');
    const byTime = frames.toSorted((a, b) => a.time - b.time);
    const ordered = byTime.filter((f, i) => i === 0 || f.time !== byTime[i - 1].time);
    let concat = 'ffconcat version 1.0\n';
    for (let i = 0; i < ordered.length; i++) {
        concat += `file 'frames/${ordered[i].name}'\n`;
        if (i + 1 < ordered.length) concat += `duration ${Math.max(.001, ordered[i + 1].time - ordered[i].time).toFixed(6)}\n`;
    }
    await fs.writeFile(path.join(dir, 'frames.ffconcat'), concat);
    await fs.writeFile(path.join(dir, 'capture-manifest.json'), JSON.stringify({
        sourceUrl: page.url(), variant, viewport: [1280, 720], canvas,
        frames: ordered.map(f => ({name: f.name, timestamp: f.time, width: f.width, height: f.height})),
    }, null, 2) + '\n');
    const report = {variant, file, sourceUrl: page.url(), viewport: [1280, 720], canvas,
        bodyRequests, frames: frames.length, encodedFrames: ordered.length,
        outOfOrderArrivals: frames.reduce((n, f, i) => n + Number(i > 0 && f.time < frames[i - 1].time), 0),
        firstTimestamp: ordered[0].time, lastTimestamp: ordered.at(-1).time,
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
