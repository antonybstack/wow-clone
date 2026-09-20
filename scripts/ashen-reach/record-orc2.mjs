/** CDP screencast of Orc (MakeHuman pack) vs Orc2 (sculpt pipeline) in the live armory. */
import {chromium} from 'playwright';
import { CDP_URL } from '../lib/cdp.mjs';
import fs from 'node:fs/promises';

const dir = process.env.ASHEN_CAPTURE_DIR || 've-capture/ashen-reach/orc2/video';
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
    await page.goto(process.env.ASHEN_URL || 'http://127.0.0.1:5173/ashen-reach.html?play&clean', {waitUntil: 'commit'});
    await page.waitForFunction(() => window.ASHEN?.ready, null, {timeout: 60000});
    await wait(800);
    let audioStart = Date.now() / 1000;
    try {
        audioStart = await page.evaluate(() => {
            const capture = ASHEN.combat.audio.capture(), recorder = new MediaRecorder(capture.stream, {mimeType: 'audio/webm;codecs=opus'}), chunks = [];
            const done = new Promise(resolve => recorder.onstop = resolve);
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
    const start = Date.now();
    recording = true;
    await cdp.send('Page.startScreencast', {format: 'jpeg', quality: 85, maxWidth: 1280, maxHeight: 720, everyNthFrame: 4});
    const mark = label => timeline.push({seconds: (Date.now() - start) / 1000, label});

    mark('Open armory');
    await key('KeyC');
    await page.locator('[data-light]').check();
    await wait(700);

    mark('Sculpt Orc');
    await page.locator('[data-race]').selectOption('orc');
    await page.waitForFunction(() => ASHEN.equipment.race === 'orc' && ASHEN.scene.meshes.some(m => m.name === 'OrcV1Body' && m.visible) && !ASHEN.equipment.getStatus?.().pending, null, {timeout: 60000});
    await settled();
    await page.locator('[data-view="front"]').click();
    await page.locator('[data-view="full"]').click();
    await wait(1600);
    await page.locator('[data-view="side"]').click();
    await wait(1200);
    await page.locator('[data-view="front"]').click();
    await page.evaluate(() => { ASHEN.armory.camera.alpha = Math.PI / 2 - ASHEN.player.getFacing() - 0.7; });
    await wait(900);
    await page.locator('[data-motion]').selectOption('idle');
    await wait(900);
    await page.locator('[data-motion]').selectOption('walk');
    await wait(1800);
    await page.locator('[data-motion]').selectOption('run');
    await wait(1600);

    mark('Gameplay walk on Orc2');
    await key('Escape');
    await wait(400);
    await page.keyboard.down('KeyA');
    await wait(500);
    await page.keyboard.up('KeyA');
    await page.keyboard.down('KeyW');
    await wait(1600);
    await page.keyboard.up('KeyW');
    await wait(400);

    recording = false;
    if (cdp) await cdp.send('Page.stopScreencast').catch(() => {});
    await Promise.all(writes);
    try {
        const audioData = await page.evaluate(async () => {
            const a = window.__spellAudio;
            if (!a?.recorder) return null;
            if (a.recorder.state !== 'inactive') a.recorder.stop();
            await a.done;
            const blob = new Blob(a.chunks, {type: 'audio/webm'});
            const reader = new FileReader();
            const data = await new Promise(resolve => { reader.onload = () => resolve(reader.result.split(',')[1]); reader.readAsDataURL(blob); });
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
        const dt = i + 1 < frames.length ? frames[i + 1].time - frames[i].time : 1 / 15;
        concat += `duration ${Math.max(.001, dt).toFixed(6)}\n`;
    }
    await fs.writeFile(dir + '/frames.ffconcat', concat);
    const seconds = frames.length > 1 ? frames.at(-1).time - frames[0].time : frames.length / 15;
    await fs.writeFile(dir + '/recording.json', JSON.stringify({
        frames: frames.length, seconds, timeline, errors,
        audioOffset: frames[0] ? frames[0].time - audioStart : 0,
    }, null, 2));
    console.log(JSON.stringify({frames: frames.length, seconds: +seconds.toFixed(2), errors}));
} finally {
    recording = false;
    await page.keyboard.up('KeyW');
    await page.keyboard.up('KeyA');
    await page.evaluate(() => {
        const a = window.__spellAudio;
        if (a) {
            if (a.recorder.state !== 'inactive') a.recorder.stop();
            a.capture.dispose();
            delete window.__spellAudio;
        }
    }).catch(() => {});
    if (cdp) await cdp.detach();
    await browser.close();
}
