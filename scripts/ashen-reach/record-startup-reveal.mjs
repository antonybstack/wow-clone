/** The reveal itself: navigation -> loader fade -> keyboard travel, in one unbroken screencast.
 *
 * Example:
 *   ASHEN_CDP_PORT=10137 ASHEN_URL='http://127.0.0.1:5973/' \
 *     node scripts/ashen-reach/record-startup-reveal.mjs --tag p0
 *
 * The thing worth looking at is the handover. `finishLoading()` now returns at the start of the
 * 350 ms CSS fade instead of after it, so the overlay dissolves over frames the player is already
 * steering. A clip is the only way to confirm that reads as a reveal rather than as a stutter, and
 * it is also the only way to catch the failure this change could cause: input arriving while the
 * overlay still visually covers the canvas would look like the character moving behind a curtain.
 *
 * The keypress is issued the moment ASHEN.whenPlayable resolves, deliberately -- if anything is
 * still frozen at that boundary, this recording is where it shows.
 */
import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {CDP_URL} from '../lib/cdp.mjs';

const tagIndex = process.argv.indexOf('--tag');
const tag = tagIndex === -1 ? 'v1' : process.argv[tagIndex + 1];
const url = process.env.ASHEN_URL || 'http://127.0.0.1:5173/ashen-reach.html?play&clean';
const dir = `ve-capture/ashen-reach/startup-reveal-${tag}/motion`;
await fs.mkdir(`${dir}/frames`, {recursive: true});
const browser = await chromium.connectOverCDP(CDP_URL);
const context = await browser.newContext({viewport: {width: 1280, height: 720}, deviceScaleFactor: 1});
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
  await page.goto(url, {waitUntil: 'commit'});
  await cdp.send('Page.startScreencast', {format: 'jpeg', quality: 90, maxWidth: 1280, maxHeight: 720, everyNthFrame: 1});
  await page.waitForFunction(() => globalThis.ASHEN?.whenPlayable, null, {timeout: 120000});
  await page.evaluate(() => globalThis.ASHEN.whenPlayable);
  const start = await page.evaluate(() => {
    const p = globalThis.ASHEN.player.body.position;
    return {x: p.x, z: p.z, overlayPresent: !!document.getElementById('loading')};
  });
  // No settling pause: the first keypress lands at the playable boundary on purpose.
  await page.locator('#renderCanvas').focus().catch(() => {});
  await page.keyboard.down('w');
  await page.waitForTimeout(2600);
  await page.keyboard.up('w');
  await page.waitForTimeout(900);
  await page.screenshot({path: `${dir}/after-travel.png`, scale: 'css'});
  const report = await page.evaluate(start => {
    const game = globalThis.ASHEN;
    const p = game.player.body.position;
    return {
      playableMs: game.playableMs, presentMs: game.presentMs, readyMs: game.loadMs,
      overlayPresentAtPlayable: start.overlayPresent,
      usingPhysics: game.player.getDebugState().usingPhysics,
      recoveries: game.player.getDebugState().recoveries,
      frames: game.gpu.frames, enemies: game.combat?.enemies?.length ?? null,
      travelM: Math.hypot(p.x - start.x, p.z - start.z),
      loaderRemoved: !document.getElementById('loading'),
      inputEnabled: !document.body.classList.contains('is-loading'),
      dressed: !!game.body, equipment: game.equipment?.getState?.() ?? null,
    };
  }, start);
  assert(report.loaderRemoved, 'the loading overlay never left the document');
  assert(report.inputEnabled, 'input was never enabled');
  assert(report.usingPhysics, 'Havok was not driving the player');
  assert(report.travelM > 3, `player travelled only ${report.travelM.toFixed(2)} m`);
  assert.equal(report.recoveries, 0, 'a recovery teleport happened during the reveal');
  assert.deepEqual(errors, []);
  await fs.writeFile(`${dir}/report.json`, JSON.stringify({...report, url, errors}, null, 2));
  console.log(JSON.stringify({...report, frameCount: frames.length}));
} finally {
  await cdp.send('Page.stopScreencast').catch(() => {});
  await Promise.all(writes);
  const concat = ['ffconcat version 1.0'];
  frames.forEach((f, i) => concat.push(`file 'frames/${f.name}'`, `duration ${Math.max(.008, (frames[i + 1]?.ts ?? f.ts + .033) - f.ts)}`));
  if (frames.length) concat.push(`file 'frames/${frames.at(-1).name}'`);
  await fs.writeFile(`${dir}/frames.ffconcat`, `${concat.join('\n')}\n`);
  await context.close(); await browser.close();
}
