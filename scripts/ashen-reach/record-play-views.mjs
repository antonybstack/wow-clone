/** Live V5 interaction clip from the active Lite page; encode frames.ffconcat afterward. */
import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import {CDP_URL} from '../lib/cdp.mjs';

const route = process.argv.includes('--touch') ? 'touch' : 'desktop';
const dir = `ve-capture/ashen-reach/play-views/video-v5-${route}-2026-09-23`;
await fs.mkdir(`${dir}/frames`, {recursive: true});
const browser = await chromium.connectOverCDP(CDP_URL);
const context = browser.contexts()[0];
const page = context.pages().find(p => p.url().includes('ashen-reach.html')) || await context.newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
await page.setViewportSize(route === 'touch' ? {width: 390, height: 844} : {width: 1280, height: 720});
await page.bringToFront();
await page.goto(`http://127.0.0.1:5173/ashen-reach.html?noEnemies&${route === 'touch' ? 'touch' : 'play'}`, {waitUntil: 'commit'});
await page.waitForFunction(() => globalThis.ASHEN?.ready, null, {timeout: 120000});
await page.waitForTimeout(1800);

const frames = [], writes = [];
const cdp = await context.newCDPSession(page);
cdp.on('Page.screencastFrame', event => {
  cdp.send('Page.screencastFrameAck', {sessionId: event.sessionId}).catch(() => {});
  const name = `frame-${String(frames.length).padStart(5, '0')}.jpg`;
  frames.push({name, ts: event.metadata.timestamp});
  writes.push(fs.writeFile(`${dir}/frames/${name}`, Buffer.from(event.data, 'base64')));
});
await cdp.send('Page.startScreencast', {format: 'jpeg', quality: 82, maxWidth: 1280, maxHeight: 844, everyNthFrame: 1});

if (route === 'desktop') {
  await page.waitForTimeout(1100);
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(1000);
  await page.keyboard.up('KeyW');
  await page.keyboard.press('Tab');
  await page.waitForTimeout(350);
  await page.keyboard.press('Digit1');
  await page.waitForTimeout(950);
  await page.keyboard.press('KeyT');
  await page.waitForTimeout(1500);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(800);
  await page.locator('[data-action="dev"]').click();
  await page.waitForTimeout(650);
  await page.locator('[data-action="resume"]').click();
  await page.keyboard.press('KeyF');
  await page.keyboard.down('KeyW');
  await page.keyboard.down('Space');
  await page.waitForTimeout(1500);
  await page.keyboard.up('Space');
  await page.keyboard.up('KeyW');
  await page.waitForTimeout(1100);
  await page.keyboard.press('KeyF');
  await page.waitForTimeout(750);
} else {
  await page.waitForTimeout(900);
  await page.locator('.touch-target').click();
  await page.waitForTimeout(500);
  await page.locator('[data-spell="1"]').click();
  await page.waitForTimeout(1000);
  const pad = await page.locator('.touch-stick').boundingBox();
  const cx = pad.x + pad.width / 2, cy = pad.y + pad.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx, cy - 42, {steps: 8});
  await page.waitForTimeout(900);
  await page.mouse.up();
  await page.locator('.touch-jump').click();
  await page.waitForTimeout(700);
  await page.locator('.touch-menu').click();
  await page.waitForTimeout(700);
  await page.locator('[data-action="keys"]').click();
  await page.waitForTimeout(900);
  await page.locator('[data-action="hub"]').click();
  await page.locator('[data-action="resume"]').click();
  await page.waitForTimeout(650);
}

await cdp.send('Page.stopScreencast');
await Promise.all(writes);
const lines = ['ffconcat version 1.0'];
for (let i = 0; i < frames.length; i++) {
  const duration = i + 1 < frames.length ? Math.max(0.008, frames[i + 1].ts - frames[i].ts) : 0.033;
  lines.push(`file 'frames/${frames[i].name}'`, `duration ${duration.toFixed(4)}`);
}
if (frames.length) lines.push(`file 'frames/${frames.at(-1).name}'`);
await fs.writeFile(`${dir}/frames.ffconcat`, lines.join('\n') + '\n');
const seconds = frames.length > 1 ? frames.at(-1).ts - frames[0].ts : 0;
await fs.writeFile(`${dir}/recording.json`, JSON.stringify({route, frames: frames.length, seconds, fps: frames.length / Math.max(seconds, .001), errors, viewport: route === 'touch' ? [390, 844] : [1280, 720]}, null, 2));
console.log(JSON.stringify({route, frames: frames.length, seconds: +seconds.toFixed(2), errors, dir}));
process.exit(errors.length ? 1 : 0);
