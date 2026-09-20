/** Live Orc grip walkthrough: CDP screencast + engine audio. Does not close Chrome. */
import {chromium} from 'playwright';
import { CDP_URL } from '../lib/cdp.mjs';
import fs from 'node:fs/promises';

const dir = process.env.ASHEN_CAPTURE_DIR || 've-capture/ashen-reach/orc-grips/video';
await fs.mkdir(dir + '/frames', {recursive: true});
const browser = await chromium.connectOverCDP(CDP_URL);
const page = browser.contexts()[0].pages().find(p => p.url().includes('ashen-reach.html'))
    || await browser.contexts()[0].newPage();
let cdp, recording = false;
const frames = [], writes = [], errors = [], timeline = [];
page.on('pageerror', e => errors.push(e.message));
const wait = ms => page.waitForTimeout(ms);
const key = k => page.keyboard.press(k);
const settled = () => page.waitForFunction(() => !ASHEN.equipment.getStatus?.().pending, null, {timeout: 60000});

try {
    await page.bringToFront();
    await page.goto('http://127.0.0.1:5173/ashen-reach.html?play&clean', {waitUntil: 'commit', timeout: 60000});
    await page.waitForFunction(() => window.ASHEN?.ready, null, {timeout: 60000});
    await wait(800);
    let audioStart = Date.now() / 1000;
    try {
        audioStart = await page.evaluate(() => {
            const capture = ASHEN.combat.audio.capture();
            const recorder = new MediaRecorder(capture.stream, {mimeType: 'audio/webm;codecs=opus'});
            const chunks = [];
            const done = new Promise(resolve => { recorder.onstop = resolve; });
            recorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
            window.__spellAudio = {capture, recorder, chunks, done};
            recorder.start(250);
            return Date.now() / 1000;
        });
    } catch (error) {
        errors.push('audio start: ' + error.message);
    }
    cdp = await page.context().newCDPSession(page);
    cdp.on('Page.screencastFrame', event => {
        cdp.send('Page.screencastFrameAck', {sessionId: event.sessionId}).catch(() => {});
        if (!recording) return;
        const name = `frame-${String(frames.length).padStart(5, '0')}.jpg`;
        frames.push({name, time: event.metadata.timestamp});
        writes.push(fs.writeFile(dir + '/frames/' + name, Buffer.from(event.data, 'base64')));
    });
    recording = true;
    await cdp.send('Page.startScreencast', {format: 'jpeg', quality: 85, maxWidth: 1280, maxHeight: 720, everyNthFrame: 4});
    const start = Date.now();
    const mark = label => timeline.push({seconds: (Date.now() - start) / 1000, label});

    mark('Armory Orc Wayfarer sword');
    await key('KeyC');
    await page.locator('[data-light]').check();
    await page.locator('[data-race]').selectOption('orc');
    await page.waitForFunction(() => ASHEN.equipment.race === 'orc' && !ASHEN.equipment.getStatus?.().pending, null, {timeout: 60000});
    await page.locator('[data-outfit="wayfarer"]').click();
    await settled();
    await page.locator('[data-view="front"]').click();
    await page.locator('[data-view="full"]').click();
    await page.locator('[data-motion]').selectOption('walk');
    await wait(1800);
    await page.locator('[data-motion]').selectOption('idle');
    await wait(900);

    mark('Graveweaver staff and book');
    await page.locator('[data-outfit="graveweaver"]').click();
    await settled();
    await page.locator('[data-view="front"]').click();
    await page.locator('[data-motion]').selectOption('walk');
    await wait(1800);

    mark('Warden greatstaff carry');
    await page.locator('[data-outfit="warden"]').click();
    await settled();
    await page.locator('[data-view="front"]').click();
    await page.locator('[data-motion]').selectOption('carry');
    await wait(1600);
    await page.locator('[data-view="side"]').click();
    await wait(1200);
    await page.locator('[data-view="front"]').click();

    mark('Gameplay walk and Fire Blast');
    await key('Escape');
    await wait(400);
    await page.keyboard.down('KeyW');
    await wait(1600);
    await page.keyboard.up('KeyW');
    await key('Tab');
    await key('Digit1');
    await wait(2200);
    await page.keyboard.down('KeyW');
    await wait(1200);
    await page.keyboard.up('KeyW');

    recording = false;
    await cdp.send('Page.stopScreencast');
    await Promise.all(writes);
    try {
        const audioData = await page.evaluate(async () => {
            const a = window.__spellAudio;
            if (!a) return null;
            a.recorder.stop();
            await a.done;
            const blob = new Blob(a.chunks, {type: 'audio/webm'});
            const reader = new FileReader();
            const data = await new Promise(resolve => {
                reader.onload = () => resolve(reader.result.split(',')[1]);
                reader.readAsDataURL(blob);
            });
            a.capture.dispose();
            delete window.__spellAudio;
            return data;
        });
        if (audioData) await fs.writeFile(dir + '/audio.webm', Buffer.from(audioData, 'base64'));
    } catch (error) {
        errors.push('audio stop: ' + error.message);
    }
    let concat = 'ffconcat version 1.0\n';
    for (let i = 0; i < frames.length; i++) {
        concat += `file 'frames/${frames[i].name}'\n`;
        if (i + 1 < frames.length) concat += `duration ${Math.max(0.001, frames[i + 1].time - frames[i].time).toFixed(6)}\n`;
    }
    await fs.writeFile(dir + '/frames.ffconcat', concat);
    await fs.writeFile(dir + '/recording.json', JSON.stringify({
        frames: frames.length,
        seconds: frames.length ? frames.at(-1).time - frames[0].time : 0,
        timeline,
        errors,
        audioOffset: frames.length ? frames[0].time - audioStart : 0,
    }, null, 2));
    const contact = await page.evaluate(() => {
        const s = ASHEN.combat.fx.sockets, bw = ASHEN.player.body.worldMatrix;
        const xf = (m, x, y, z) => [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]];
        const hw = n => { const b = ASHEN.body.skeleton.bones.find(x => x.name === n); const c = s.toCapsule(b); return xf(bw, c.x, c.y, c.z); };
        const root = ASHEN.scene.meshes.find(m => m.name === 'greatstaffWood')?.parent;
        if (!root) return null;
        const w = root.worldMatrix, o = [w[12], w[13], w[14]], ax = [w[4], w[5], w[6]], n = Math.hypot(...ax), u = ax.map(v => v / n);
        const d = p => { const v = [p[0] - o[0], p[1] - o[1], p[2] - o[2]]; const t = v[0] * u[0] + v[1] * u[1] + v[2] * u[2]; return Math.hypot(p[0] - (o[0] + u[0] * t), p[1] - (o[1] + u[1] * t), p[2] - (o[2] + u[2] * t)); };
        return {left: d(hw('mixamorig:LeftHand')), right: d(hw('mixamorig:RightHand')), scale: [root.scaling.x, root.scaling.y, root.scaling.z]};
    });
    console.log(JSON.stringify({frames: frames.length, seconds: frames.length ? Math.round(frames.at(-1).time - frames[0].time) : 0, errors, contact}));
} finally {
    recording = false;
    await page.keyboard.up('KeyW').catch(() => {});
    await page.evaluate(() => {
        const a = window.__spellAudio;
        if (a) {
            if (a.recorder.state !== 'inactive') a.recorder.stop();
            a.capture.dispose();
            delete window.__spellAudio;
        }
    }).catch(() => {});
    if (cdp) await cdp.detach();
    process.exit(errors.length ? 1 : 0);
}
