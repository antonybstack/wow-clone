/** Feet meeting the ground, after the grounded capsule stopped keeping altitude.
 *
 * Framed low and close on the feet on purpose: the review that missed this defect was cropped
 * to torso and silhouette, where a 145 mm gap under a boot is simply not in shot.
 * https://chromedevtools.github.io/devtools-protocol/tot/Page/#event-screencastFrame
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const port = Number(process.env.ASHEN_CDP_PORT), url = process.env.ASHEN_URL;
if (!port || !url) throw Error('Owned CDP port and URL required');
const origin = `http://127.0.0.1:${new URL(url).port}`;
const dir = path.resolve(`ve-capture/character-mmo/m6/ground-contact-${process.env.ASHEN_TAG || 'v1'}`);
await fs.mkdir(path.join(dir, 'frames'), { recursive: true });
const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
const pages = browser.contexts()[0].pages();
const page = pages.find(p => p.url().includes('/ashen-reach.html')) ?? pages.find(p => p.url() === 'about:blank');
const errors = [], frames = [], writes = [], timeline = [], samples = [];
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
const gap = () => page.evaluate(async () => {
    const { height } = await import('/src/ashen-reach/geometry.js');
    const p = ASHEN.player.getDebugState();
    return +(p.position.y - ASHEN.player.capsuleHeight / 2 - height(p.position.x, p.position.z)).toFixed(4);
});
try {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto(`${origin}/ashen-reach.html?play&clean&pixelRatio=1`);
    await page.waitForFunction(() => globalThis.ASHEN?.whenPlayable, null, { timeout: 90000 });
    await page.evaluate(() => ASHEN.whenRest);
    await page.evaluate(() => {
        ASHEN.dev.god = true; ASHEN.setView('play');
        const s = document.createElement('style');
        s.textContent = 'body > *:not(#renderCanvas){display:none !important;}';
        document.head.appendChild(s);
    });
    await page.focus('#renderCanvas');
    await page.evaluate(() => { ASHEN.rig.pivotHeight = 0.12; ASHEN.rig.pitch = 0.12; ASHEN.rig.yaw = Math.PI * 0.85; });
    await page.waitForTimeout(700);
    const canvas = await page.evaluate(() => [renderCanvas.width, renderCanvas.height]);
    recording = true;
    await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 88, maxWidth: 1280, maxHeight: 720, everyNthFrame: 2 });

    mark('standing — soles on the ground');
    samples.push({ at: 'start', gap: await gap() });
    await page.waitForTimeout(2200);
    mark('walking, turning both ways — the gap used to ratchet up over exactly this route');
    for (let i = 0; i < 6; i++) {
        const turn = i % 2 ? 'KeyA' : 'KeyD';
        await page.keyboard.down(turn); await page.waitForTimeout(240); await page.keyboard.up(turn);
        await page.keyboard.down('KeyW'); await page.waitForTimeout(1300); await page.keyboard.up('KeyW');
        await page.waitForTimeout(600);
        samples.push({ at: `leg-${i + 1}`, gap: await gap() });
    }
    mark('jump and land');
    await page.keyboard.down('Space'); await page.waitForTimeout(60); await page.keyboard.up('Space');
    await page.waitForTimeout(2000);
    samples.push({ at: 'after-landing', gap: await gap() });
    await page.waitForTimeout(1200);

    recording = false;
    await cdp.send('Page.stopScreencast');
    await Promise.all(writes);
    const endCanvas = await page.evaluate(() => [renderCanvas.width, renderCanvas.height]);
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
    await fs.writeFile(path.join(dir, 'report.json'), JSON.stringify({
        sourceUrl: page.url(), viewport: [1280, 720], canvas, frames: ordered.length,
        seconds: +(ordered.at(-1).time - ordered[0].time).toFixed(2), timeline, samples, errors,
    }, null, 2));
    console.log(JSON.stringify({ dir, frames: ordered.length, samples, errors: errors.length }));
    if (errors.length) process.exitCode = 1;
} catch (e) {
    recording = false;
    await cdp.send('Page.stopScreencast').catch(() => {});
    console.error(e); process.exitCode = 1;
} finally { await browser.close(); }
