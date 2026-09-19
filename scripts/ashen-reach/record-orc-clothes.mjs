/** Live Orc catalogue walkthrough: CDP screencast (DOM HUD) + engine audio. */
import {chromium} from 'playwright';
import fs from 'node:fs/promises';

const dir = process.env.ASHEN_CAPTURE_DIR || 've-capture/ashen-reach/orc-clothes/video';
await fs.mkdir(dir + '/frames', {recursive: true});
const browser = await chromium.connectOverCDP('http://127.0.0.1:9337');
const page = browser.contexts()[0].pages().find(p => p.url().includes('ashen-reach.html'))
    || await browser.contexts()[0].newPage();
let cdp, recording = false;
const frames = [], writes = [], errors = [], timeline = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
const wait = ms => page.waitForTimeout(ms);
const key = k => page.keyboard.press(k);
const settled = () => page.waitForFunction(() => !ASHEN.equipment.getStatus?.().pending, null, {timeout: 60000});

try {
    await page.bringToFront();
    await page.goto(process.env.ASHEN_URL || 'http://127.0.0.1:5173/ashen-reach.html?play&clean', {waitUntil: 'commit'});
    await page.waitForFunction(() => window.ASHEN?.ready, null, {timeout: 60000});
    await wait(900);
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
    const start = Date.now();
    recording = true;
    await cdp.send('Page.startScreencast', {format: 'jpeg', quality: 85, maxWidth: 1280, maxHeight: 720, everyNthFrame: 4});
    const mark = label => timeline.push({seconds: (Date.now() - start) / 1000, label});

    mark('Open armory, switch to Orc');
    await key('KeyC');
    await page.locator('[data-light]').check();
    await page.locator('[data-race]').selectOption('orc');
    await page.waitForFunction(() => ASHEN.equipment.race === 'orc' && ASHEN.body.parked && !ASHEN.equipment.getStatus?.().pending, null, {timeout: 60000});

    mark('Wayfarer walk and run');
    await page.locator('[data-outfit="wayfarer"]').click();
    await settled();
    await page.locator('[data-view="front"]').click();
    await page.locator('[data-view="full"]').click();
    await page.locator('[data-motion]').selectOption('walk');
    await wait(2200);
    await page.locator('[data-motion]').selectOption('run');
    await wait(1600);

    mark('Graveweaver walk, then side');
    await page.locator('[data-outfit="graveweaver"]').click();
    await settled();
    await page.locator('[data-view="front"]').click();
    await page.locator('[data-view="full"]').click();
    await page.locator('[data-motion]').selectOption('walk');
    await wait(2200);
    await page.locator('[data-view="side"]').click();
    await wait(1400);
    await page.locator('[data-view="front"]').click();
    await wait(600);

    mark('Gameplay walk, Fire Blast, recover');
    await key('Escape');
    await wait(400);
    await page.keyboard.down('KeyW');
    await wait(1800);
    await page.keyboard.up('KeyW');
    await key('Tab');
    await key('Digit1');
    await wait(2200);
    await page.keyboard.down('KeyW');
    await wait(1400);
    await page.keyboard.up('KeyW');

    mark('Reopen armory on Orc Graveweaver');
    await key('KeyC');
    await wait(1000);

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
    console.log(JSON.stringify({frames: frames.length, seconds: frames.length ? Math.round(frames.at(-1).time - frames[0].time) : 0, errors}));
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
