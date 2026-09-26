/** Capture a short built/production gameplay reference before changing Babylon Lite.
 * Diagnostic placement selects each shot; walking, targeting and casting use normal keys.
 * The timestamped JPEG manifest is encoded with scripts/encode-capture.py.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium} from 'playwright';
import {CDP_URL} from '../lib/cdp.mjs';
import {appendFrame, captureSurface, writeCaptureManifest} from '../lib/capture-manifest.mjs';

const url = process.env.ASHEN_TEST_URL;
const expectedBundle = process.env.ASHEN_EXPECT_BUNDLE;
const dir = process.env.ASHEN_CAPTURE_DIR || 've-capture/ashen-reach/lite1311/baseline/live-motion';
assert(url, 'Set ASHEN_TEST_URL to the current production or built preview URL');
assert(expectedBundle && /^ashenReach-[\w-]+\.js$/.test(expectedBundle),
  'Set ASHEN_EXPECT_BUNDLE to the exact deployed/built ashenReach-*.js filename');
await fs.mkdir(`${dir}/frames`, {recursive: true});
const browser = await chromium.connectOverCDP(CDP_URL);
// The owned harness opens a dev game by default; stop it before capturing the
// built site so a second renderer cannot contend with this recording.
for (const page of browser.contexts()[0]?.pages() || []) {
  if (page.url().includes('/ashen-reach.html')) await page.goto('about:blank');
}
const context = await browser.newContext({viewport: {width: 1280, height: 720}, deviceScaleFactor: 1});
const page = await context.newPage();
const report = {requestedUrl: url, expectedBundle, browser: browser.version(),
  scenes: [], errors: [], failedRequests: []};
page.on('pageerror', error => report.errors.push(error.message));
page.on('console', message => {
  if (message.type() === 'error') report.errors.push(message.text());
});
page.on('requestfailed', request => report.failedRequests.push(`${request.url()}: ${request.failure()?.errorText}`));
await page.addInitScript(() => {
  window.__captureGpuErrors = [];
  const requestDevice = GPUAdapter.prototype.requestDevice;
  GPUAdapter.prototype.requestDevice = async function (...args) {
    const device = await requestDevice.apply(this, args);
    device.addEventListener('uncapturederror', event => window.__captureGpuErrors.push(event.error.message));
    device.lost.then(info => window.__captureGpuErrors.push(`Device lost: ${info.reason}: ${info.message}`));
    return device;
  };
});

let cdp, manifest, captureError;
const writes = [];
const wait = ms => page.waitForTimeout(ms);
const state = () => page.evaluate(() => {
  const a = ASHEN, p = a.player.body.position, physics = a.player.getDebugState();
  return {position: {x: p.x, y: p.y, z: p.z},
    physics: {usingPhysics: physics.usingPhysics, recoveries: physics.recoveries},
    canvas: {width: a.engine.canvas.width, height: a.engine.canvas.height},
    enemies: a.combat.enemies.length};
});
async function mark(name, note) {
  report.scenes.push({name, note, frame: manifest.frames.length,
    atMs: Date.now(), state: await state()});
}
async function place(x, z, {yaw = 0, pitch = -.12, distance = 4, floorY} = {}) {
  await page.evaluate(({x, z, yaw, pitch, distance, floorY}) => {
    const a = ASHEN;
    a.setView('play');
    a.player.setFlying(false);
    a.player.setWorldPos(x, (floorY ?? a.world.groundHeight(x, z)) + 1.7, z);
    a.player.setFacing(yaw);
    a.rig.yaw = yaw;
    a.rig.pitch = pitch;
    a.rig.distance = a.rig.distanceTarget = distance;
  }, {x, z, yaw, pitch, distance, floorY});
  await wait(550);
}
async function walk(name, ms) {
  const before = await state();
  await page.keyboard.down('KeyW');
  await wait(ms);
  await page.keyboard.up('KeyW');
  const after = await state();
  const distanceM = Math.hypot(after.position.x - before.position.x,
    after.position.z - before.position.z);
  assert(after.physics.usingPhysics, `${name}: Havok inactive`);
  assert.equal(after.physics.recoveries, before.physics.recoveries, `${name}: recovery teleport`);
  assert(distanceM > 2, `${name}: normal input moved only ${distanceM.toFixed(2)} m`);
  report.scenes.at(-1).walk = {before, after, distanceM};
}

try {
  const response = await page.goto(url, {waitUntil: 'commit'});
  assert(response?.ok(), `Navigation failed: ${response?.status()}`);
  report.visitedUrl = page.url();
  assert.equal(new URL(report.visitedUrl).origin, new URL(url).origin);
  await page.waitForFunction(() => window.ASHEN?.ready && ASHEN.hostilesReady, null, {timeout: 120000});
  report.loadedScripts = await page.evaluate(() => [...document.scripts].map(s => s.src).filter(Boolean));
  assert(report.loadedScripts.some(src => new URL(src).pathname.endsWith(`/assets/${expectedBundle}`)),
    `Expected built bundle ${expectedBundle} was not loaded`);
  assert(report.loadedScripts.every(src => !new URL(src).pathname.startsWith('/src/')),
    'Vite source script loaded; capture must use a built bundle');
  await page.evaluate(() => { ASHEN.metrics.setInternalResolution(1280, 720); ASHEN.dev.god = true; });
  const initial = await state();
  assert.deepEqual(initial.canvas, {width: 1280, height: 720});
  assert.equal(initial.enemies, 7);
  assert(initial.physics.usingPhysics, 'Baseline requires Havok');

  manifest = {version: 1, ...await captureSurface(page), url: report.visitedUrl,
    expectedBundle, frames: []};
  cdp = await context.newCDPSession(page);
  cdp.on('Page.screencastFrame', event => {
    cdp.send('Page.screencastFrameAck', {sessionId: event.sessionId}).catch(() => {});
    if (captureError) return;
    try {
      const bytes = Buffer.from(event.data, 'base64');
      const name = `frame-${String(manifest.frames.length).padStart(5, '0')}.jpg`;
      appendFrame(manifest, {name, timestamp: event.metadata.timestamp, bytes});
      writes.push(fs.writeFile(`${dir}/frames/${name}`, bytes).catch(error => { captureError ||= error; }));
    } catch (error) { captureError = error; }
  });
  await cdp.send('Page.startScreencast', {format: 'jpeg', quality: 90,
    maxWidth: 1280, maxHeight: 720, everyNthFrame: 1});

  await place(0, 40);
  await mark('town-lamps-walk', 'Warm local lamps, normal W travel');
  await walk('town lamps', 1800);
  await wait(300);

  await page.evaluate(() => ASHEN.equipment.equipPreset('graveweaver'));
  await page.waitForFunction(() => !ASHEN.equipment.getStatus?.().pending);
  report.equipment = await page.evaluate(() => ASHEN.equipment.getState());
  assert.equal(report.equipment.mainHand, 'graveweaverStaff');
  assert.equal(report.equipment.offHand, 'graveweaverBook');
  await mark('equipment', 'Graveweaver preset on the live actor');
  await wait(1000);
  const hitPlayed = await page.evaluate(() => ASHEN.body.playHit());
  assert(hitPlayed, 'Chest-hit clip did not play');
  await mark('chest-hit', 'Diagnostic Hit_Chest playback on live actor');
  await wait(700);
  const castsBefore = await page.evaluate(() => ASHEN.combat.spell.casts);
  await page.keyboard.press('Tab');
  await page.keyboard.press('Digit1');
  await mark('cast', 'Tab target and Digit1 Fire Blast input');
  await wait(1300);
  report.casts = await page.evaluate(() => ASHEN.combat.spell.casts);
  assert(report.casts > castsBefore, 'Fire Blast did not cast');

  const floorY = await page.evaluate(() => ASHEN.world.cathedral.floorY);
  await place(0, 318, {yaw: Math.PI / 2, pitch: .12, distance: 20, floorY});
  await mark('camera-obstruction', 'Nave wall limits third-person camera radius');
  await wait(700);
  report.camera = await page.evaluate(() => ({radius: ASHEN.rig.camera.radius,
    desired: ASHEN.rig.distanceTarget}));
  assert(report.camera.radius < report.camera.desired - .2,
    'Camera obstruction did not reduce radius');

  await place(0, 285, {pitch: -.08, distance: 3});
  await mark('cathedral-entry', 'Diagnostic start at approach; normal W entry');
  await walk('cathedral entry', 3500);
  await wait(400);

  await place(72, 190, {pitch: -.16, distance: 4});
  await mark('woodland', 'Northern tree-detail route and shadow transition');
  await walk('woodland', 2200);
  await wait(400);

  report.gpuErrors = await page.evaluate(() => window.__captureGpuErrors);
  assert.deepEqual(report.errors, []);
  assert.deepEqual(report.failedRequests, []);
  assert.deepEqual(report.gpuErrors, []);
  report.passed = true;
} catch (error) {
  report.failure = error.stack;
  throw error;
} finally {
  await page.keyboard.up('KeyW').catch(() => {});
  if (cdp) await cdp.send('Page.stopScreencast').catch(() => {});
  await Promise.all(writes);
  if (captureError) report.captureFailure = String(captureError);
  if (manifest && !captureError) {
    try {
      await writeCaptureManifest(dir, manifest, await captureSurface(page));
      report.recording = {frames: manifest.frames.length,
        seconds: manifest.elapsedSeconds, sourceFrame: manifest.sourceFrame};
    } catch (error) {
      report.captureFailure = error.stack;
    }
  }
  await fs.writeFile(`${dir}/report.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({dir, url: report.visitedUrl, bundle: expectedBundle,
    recording: report.recording, passed: report.passed,
    failure: report.failure, captureFailure: report.captureFailure}));
  await context.close();
  await browser.close();
  if (report.captureFailure) process.exitCode = 1;
}
