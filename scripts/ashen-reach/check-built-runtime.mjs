/** Smoke-test the served production bundle through the game's runtime API. No Vite source imports. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {chromium} from 'playwright';
import {CDP_URL} from '../lib/cdp.mjs';

const url = process.env.ASHEN_TEST_URL;
const expectedBundle = process.env.ASHEN_EXPECT_BUNDLE;
const output = process.argv[2] || 've-capture/ashen-reach/lite1311/built-runtime/report.json';
assert(url, 'Set ASHEN_TEST_URL to the built site URL');
assert(expectedBundle && /^ashenReach-[\w-]+\.js$/.test(expectedBundle),
  'Set ASHEN_EXPECT_BUNDLE to the ashenReach-*.js filename from the build');
await fs.mkdir(path.dirname(output), {recursive: true});

const browser = await chromium.connectOverCDP(CDP_URL);
// The owned harness starts with a dev-game tab. Stop that renderer before
// measuring a second, built page in this browser (see docs/debug-view.md).
for (const page of browser.contexts()[0]?.pages() || []) {
  if (page.url().includes('/ashen-reach.html')) await page.goto('about:blank');
}
const context = await browser.newContext({viewport: {width: 1280, height: 720}, deviceScaleFactor: 1});
const page = await context.newPage();
const errors = [];
const failedRequests = [];
const report = {requestedUrl: url, expectedBundle, browser: browser.version(), errors, failedRequests};
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => {
  if (message.type() === 'error') errors.push(message.text());
});
page.on('requestfailed', request => failedRequests.push(`${request.method()} ${request.url()}: ${request.failure()?.errorText}`));
await page.addInitScript(() => {
  window.__builtSmokeGpuErrors = [];
  const requestDevice = GPUAdapter.prototype.requestDevice;
  GPUAdapter.prototype.requestDevice = async function (...args) {
    const device = await requestDevice.apply(this, args);
    device.addEventListener('uncapturederror', event => window.__builtSmokeGpuErrors.push(event.error.message));
    device.lost.then(info => window.__builtSmokeGpuErrors.push(`Device lost: ${info.reason}: ${info.message}`));
    return device;
  };
});

try {
  const response = await page.goto(url, {waitUntil: 'commit'});
  assert(response?.ok(), `Navigation failed: ${response?.status()}`);
  report.visitedUrl = page.url();
  assert.equal(new URL(report.visitedUrl).origin, new URL(url).origin,
    'Navigation reached a different server');
  await page.waitForFunction(() => window.ASHEN?.ready && ASHEN.hostilesReady, null, {timeout: 120000});
  report.loadedScripts = await page.evaluate(() => [...document.scripts].map(script => script.src).filter(Boolean));
  assert(report.loadedScripts.some(src => new URL(src).pathname.endsWith(`/assets/${expectedBundle}`)),
    `Expected built script ${expectedBundle} was not loaded`);
  assert(report.loadedScripts.every(src => !new URL(src).pathname.startsWith('/src/')),
    'Development source script loaded in built-runtime smoke');
  await page.evaluate(() => {
    const a = ASHEN;
    a.dev.god = true;
    a.metrics.setInternalResolution(1280, 720);
    a.player.setFlying(false);
    a.player.setWorldPos(0, a.world.groundHeight(0, 142) + 1.7, 142);
    a.player.setFacing(0);
    a.rig.yaw = 0;
  });
  await page.waitForTimeout(500);
  const state = () => page.evaluate(() => {
    const a = ASHEN, p = a.player.body.position, canvas = document.getElementById('renderCanvas');
    const debug = a.player.getDebugState();
    return {
      position: {x: p.x, y: p.y, z: p.z},
      physics: {usingPhysics: debug.usingPhysics, recoveries: debug.recoveries,
        grounded: debug.grounded},
      canvas: {width: canvas.width, height: canvas.height},
      enemies: a.combat.enemies.length,
      shadowEnabled: a.shadows.state.enabled,
      gpuErrors: window.__builtSmokeGpuErrors,
    };
  });
  report.before = await state();
  assert.equal(report.before.physics.usingPhysics, true, 'Havok must be active');
  assert.deepEqual(report.before.canvas, {width: 1280, height: 720});
  assert.equal(report.before.enemies, 7);
  assert.equal(report.before.shadowEnabled, true, 'Sun shadows must be enabled');
  await page.screenshot({path: path.join(path.dirname(output), 'before.png')});
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(2000);
  await page.keyboard.up('KeyW');
  report.after = await state();
  report.movementM = Math.hypot(report.after.position.x - report.before.position.x,
    report.after.position.z - report.before.position.z);
  assert(report.movementM > 3, `Normal controls moved only ${report.movementM.toFixed(2)} m`);
  assert.equal(report.after.physics.usingPhysics, true);
  assert.equal(report.after.physics.recoveries, report.before.physics.recoveries,
    'Recovery teleport during movement');
  assert.deepEqual(report.after.canvas, {width: 1280, height: 720});
  assert.deepEqual(report.after.gpuErrors, []);
  assert.deepEqual(errors, []);
  assert.deepEqual(failedRequests, []);
  await page.screenshot({path: path.join(path.dirname(output), 'after.png')});
  report.passed = true;
} catch (error) {
  report.failure = error.stack;
  await page.screenshot({path: path.join(path.dirname(output), 'failure.png')}).catch(() => {});
  throw error;
} finally {
  await page.keyboard.up('KeyW').catch(() => {});
  await fs.writeFile(output, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({output, url: report.visitedUrl, expectedBundle,
    movementM: report.movementM, passed: report.passed, failure: report.failure}));
  await context.close();
  await browser.close();
}
