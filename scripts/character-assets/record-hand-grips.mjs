/** The hands, after the finger override stopped being all-or-nothing.
 *
 * Framed close on purpose: the defect is a canned finger pose, and at ordinary gameplay framing
 * a hand is a dozen pixels. Rendered at 2560x1440 so what is reviewed is geometry rather than
 * an upscaled crop.
 * https://chromedevtools.github.io/devtools-protocol/tot/Page/#event-screencastFrame
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const port = Number(process.env.ASHEN_CDP_PORT), url = process.env.ASHEN_URL;
if (!port || !url) throw Error('Owned CDP port and URL required');
const origin = `http://127.0.0.1:${new URL(url).port}`;
const dir = path.resolve(`ve-capture/character-mmo/m6/hand-grips-${process.env.ASHEN_TAG || 'v1'}`);
await fs.mkdir(path.join(dir, 'frames'), { recursive: true });
const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
const pages = browser.contexts()[0].pages();
const page = pages.find(p => p.url().includes('/ashen-reach.html')) ?? pages.find(p => p.url() === 'about:blank');
const errors = [], frames = [], writes = [], timeline = [];
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
try {
    // Recorded large and cropped to the hands afterwards. Fighting the camera closer does not
    // work -- the rig restores its own distance every frame -- and a hand at gameplay framing is
    // a dozen pixels, which is not enough to review a finger pose.
    await page.setViewportSize({ width: 2560, height: 1440 });
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
    await page.evaluate(() => { ASHEN.rig.pivotHeight = 1.0; ASHEN.rig.pitch = 0.1; ASHEN.rig.yaw = Math.PI * 1.35; });
    await page.evaluate(() => ASHEN.equipment.equip('mainHand', null));
    await page.waitForTimeout(900);
    const canvas = await page.evaluate(() => [renderCanvas.width, renderCanvas.height]);
    recording = true;
    await page.evaluate(() => ASHEN.metrics.setInternalResolution(2560, 1440));
    await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 90, maxWidth: 2560, maxHeight: 1440, everyNthFrame: 2 });

    mark('empty hands — the fingers follow the clip, not a canned pose');
    await page.waitForTimeout(3000);
    mark('sword drawn — the gripping hand closes, the free hand keeps its own fingers');
    await page.evaluate(() => ASHEN.equipment.equip('mainHand', 'ironSword'));
    await page.waitForTimeout(3000);
    mark('two-handed greatstaff — both hands grip');
    await page.evaluate(() => ASHEN.equipment.equip('mainHand', 'graveweaverGreatstaff'));
    await page.waitForTimeout(3000);
    mark('back to empty');
    await page.evaluate(() => ASHEN.equipment.equip('mainHand', null));
    await page.waitForTimeout(3000);

    recording = false;
    await cdp.send('Page.stopScreencast');
    await Promise.all(writes);
    const endCanvas = await page.evaluate(() => [renderCanvas.width, renderCanvas.height]);
    const gpu = await page.evaluate(() => ASHEN.gpu.errors);
    if (canvas.join('x') !== '2560x1440' || endCanvas.join('x') !== canvas.join('x')) throw Error(`Canvas changed: ${canvas} -> ${endCanvas}`);
    if (frames.some(f => f.width !== 2560 || f.height !== 1440 || !Number.isFinite(f.time))) throw Error('Frame metadata invalid');
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
        sourceUrl: page.url(), viewport: [2560, 1440], canvas, frames: ordered.length,
        seconds: +(ordered.at(-1).time - ordered[0].time).toFixed(2), timeline, errors,
    }, null, 2));
    console.log(JSON.stringify({ dir, frames: ordered.length, errors: errors.length }));
    if (errors.length) process.exitCode = 1;
} catch (e) {
    recording = false;
    await cdp.send('Page.stopScreencast').catch(() => {});
    console.error(e); process.exitCode = 1;
} finally { await browser.close(); }
