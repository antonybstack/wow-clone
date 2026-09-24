/** Actual page startup -> dressed player -> native touch travel. No staged progress. */
import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {CDP_URL} from '../lib/cdp.mjs';

const dir = 've-capture/ashen-reach/loading-v1/motion';
await fs.mkdir(`${dir}/frames`, {recursive: true});
const browser = await chromium.connectOverCDP(CDP_URL);
const context = await browser.newContext({viewport: {width: 430, height: 734}, isMobile: true, hasTouch: true, deviceScaleFactor: 1});
const page = await context.newPage(), cdp = await context.newCDPSession(page);
const errors = [], frames = [], writes = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
cdp.on('Page.screencastFrame', event => {
  cdp.send('Page.screencastFrameAck', {sessionId: event.sessionId}).catch(() => {});
  const name = `frame-${String(frames.length).padStart(5, '0')}.jpg`;
  frames.push({name, ts: event.metadata.timestamp});
  writes.push(fs.writeFile(`${dir}/frames/${name}`, Buffer.from(event.data, 'base64')));
});
try {
  await page.goto('http://127.0.0.1:5173/ashen-reach.html?play&clean', {waitUntil: 'commit'});
  await cdp.send('Page.startScreencast', {format: 'jpeg', quality: 88, maxWidth: 430, maxHeight: 734, everyNthFrame: 1});
  await page.waitForFunction(() => globalThis.ASHEN?.ready, null, {timeout: 120000});
  await page.waitForTimeout(800);
  const start = await page.evaluate(() => ({x: ASHEN.player.body.position.x, z: ASHEN.player.body.position.z}));
  const r = await page.locator('.touch-stick').boundingBox();
  const finger = {id: 1, x: r.x + r.width / 2, y: r.y + r.height / 2, radiusX: 4, radiusY: 4, force: 1};
  await cdp.send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [finger]});
  await cdp.send('Input.dispatchTouchEvent', {type: 'touchMove', touchPoints: [{...finger, y: finger.y - 43}]});
  await page.waitForTimeout(1500);
  await cdp.send('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []});
  await page.touchscreen.tap(380, 680);
  await page.waitForTimeout(1400);
  await page.screenshot({path: `${dir}/ready.png`, scale: 'css'});
  const report = await page.evaluate(start => ({presentMs: ASHEN.presentMs, readyMs: ASHEN.loadMs,
    physics: ASHEN.player.getDebugState().usingPhysics, gpu: ASHEN.gpu,
    movement: Math.hypot(ASHEN.player.body.position.x - start.x, ASHEN.player.body.position.z - start.z),
    loaderRemoved: !document.getElementById('loading'), inputEnabled: !document.body.classList.contains('is-loading')}), start);
  assert(report.loaderRemoved && report.inputEnabled && report.physics && report.movement > 3);
  assert.deepEqual(errors, []);
  await fs.writeFile(`${dir}/report.json`, JSON.stringify({...report, errors}, null, 2));
  console.log(JSON.stringify({...report, errors}));
} finally {
  await cdp.send('Page.stopScreencast').catch(() => {});
  await Promise.all(writes);
  const concat = ['ffconcat version 1.0'];
  frames.forEach((f, i) => concat.push(`file 'frames/${f.name}'`, `duration ${Math.max(.008, (frames[i + 1]?.ts ?? f.ts + .033) - f.ts)}`));
  if (frames.length) concat.push(`file 'frames/${frames.at(-1).name}'`);
  await fs.writeFile(`${dir}/frames.ffconcat`, `${concat.join('\n')}\n`);
  await context.close(); await browser.close();
}
