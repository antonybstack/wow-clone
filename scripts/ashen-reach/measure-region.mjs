/** Three 12-second walking runs per region route. Run in an isolated --uncapped harness. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {chromium} from 'playwright';
import {summarizeDurations, detectVsyncCap} from '../../src/ashen-reach/metrics.js';
import {CDP_URL} from '../lib/cdp.mjs';

const destination = process.argv[2];
assert(destination, 'Usage: node scripts/ashen-reach/measure-region.mjs <report.json>');
const url = process.env.ASHEN_TEST_URL || 'http://127.0.0.1:5173/ashen-reach.html?play&clean';
const routes = [['town', 0, 80, 0], ['bridge', 0, 190, 0], ['cathedral', 0, 265, 0], ['forest', 130, -50, 0]];
const browser = await chromium.connectOverCDP(CDP_URL);
const page = browser.contexts()[0]?.pages()[0];
assert(page, `No browser page at ${CDP_URL}`);
const errors = [];
page.on('pageerror', error => errors.push({type: 'page', message: error.message}));
page.on('console', message => {
  if (message.type() === 'error') errors.push({type: 'console', message: message.text()});
});
await page.addInitScript(() => {
  window.__baselineGpuErrors = [];
  const requestDevice = GPUAdapter.prototype.requestDevice;
  GPUAdapter.prototype.requestDevice = async function (...args) {
    const device = await requestDevice.apply(this, args);
    device.addEventListener('uncapturederror', event => window.__baselineGpuErrors.push(event.error.message));
    device.lost.then(info => window.__baselineGpuErrors.push(`Device lost: ${info.reason}: ${info.message}`));
    return device;
  };
});

const report = {
  gitCommit: process.env.ASHEN_BASELINE_COMMIT || null,
  url, capturedAt: new Date().toISOString(),
  conditions: {
    host: os.hostname(), cpu: os.cpus()[0]?.model,
    platform: `${os.platform()} ${os.release()} ${os.arch()}`,
    browser: browser.version(), cdp: CDP_URL,
    viewport: {width: 1280, height: 720},
    requestedCanvas: {width: 1280, height: 720},
    enemyCount: 7, runSeconds: 12, warmupSeconds: 1.5, recording: false,
  },
  rows: [], errors,
};
await fs.mkdir(path.dirname(destination), {recursive: true});

async function gameState() {
  return page.evaluate(() => {
    const a = window.ASHEN, position = a.player.body.position;
    const canvas = document.getElementById('renderCanvas');
    return {
      position: {x: position.x, y: position.y, z: position.z},
      physics: a.player.getDebugState(),
      enemies: a.combat.enemies.length,
      canvas: {width: canvas.width, height: canvas.height},
      resolution: a.metrics.summary().resolution,
    };
  });
}

function spikes(durations) {
  let elapsed = 0;
  return durations.map((ms, index) => {
    elapsed += ms;
    return {index, offsetMs: elapsed, durationMs: ms};
  }).filter(frame => frame.durationMs > 16.667)
    .sort((a, b) => b.durationMs - a.durationMs).slice(0, 20);
}

try {
  await page.goto(url, {waitUntil: 'commit'});
  await page.waitForFunction(() => window.ASHEN?.ready && ASHEN.hostilesReady, null, {timeout: 120000});
  await page.setViewportSize({width: 1280, height: 720});
  await page.evaluate(() => { ASHEN.metrics.setInternalResolution(1280, 720); ASHEN.dev.god = true; });
  report.conditions.userAgent = await page.evaluate(() => navigator.userAgent);
  report.conditions.gpu = await page.evaluate(async () => {
    try {
      const adapter = await navigator.gpu.requestAdapter();
      return adapter?.info?.description || adapter?.info?.device || null;
    } catch { return null; }
  });

  for (const [name, x, z, yaw] of routes) for (let run = 1; run <= 3; run++) {
    await page.evaluate(({x, z, yaw}) => {
      const a = ASHEN, c = a.world.cathedral;
      const ground = x === 0 && z >= c.route.start[2] && z <= c.terrace.maxZ
        ? c.route.heightAt(z) : a.world.groundHeight(x, z);
      a.player.setFlying(false);
      a.player.setWorldPos(x, ground + 1.7, z);
      a.player.setFacing(yaw);
      a.rig.yaw = yaw;
    }, {x, z, yaw});
    await page.waitForTimeout(1000);
    await page.keyboard.down('KeyW');
    await page.waitForTimeout(1500);
    const before = await gameState();
    await page.evaluate(() => ASHEN.renderLoop.beginMeasurement());
    await page.waitForTimeout(12000);
    const durations = await page.evaluate(() => ASHEN.renderLoop.endMeasurement());
    await page.keyboard.up('KeyW');
    const after = await gameState();
    const distance = Math.hypot(after.position.x - before.position.x, after.position.z - before.position.z);
    const row = {name, run, ...summarizeDurations(durations), ...detectVsyncCap(durations),
      distanceM: distance, before, after, spikes: spikes(durations)};
    report.rows.push(row);
    await fs.writeFile(path.join(path.dirname(destination), `${name}-${run}-frames.json`), JSON.stringify(durations));
    await fs.writeFile(destination, JSON.stringify(report, null, 2));
    console.log(JSON.stringify({name, run, fps: row.fps, p95Ms: row.p95Ms, p99Ms: row.p99Ms,
      worstMs: row.worstMs, above16_667: row.above16_667, distanceM: distance,
      usingPhysics: after.physics.usingPhysics,
      recoveries: after.physics.recoveries - before.physics.recoveries,
      canvas: after.canvas, vsyncCapped: row.vsyncCapped}));
    assert.equal(after.canvas.width, 1280, `${name} canvas width`);
    assert.equal(after.canvas.height, 720, `${name} canvas height`);
    assert.equal(after.enemies, 7, `${name} enemy count`);
    assert.equal(after.physics.usingPhysics, true, `${name} Havok movement`);
    assert.equal(after.physics.recoveries, before.physics.recoveries, `${name} recovery teleport`);
    assert(distance > 2, `${name} walked only ${distance.toFixed(2)} m`);
    assert(!row.vsyncCapped, `${name} browser is frame capped`);
    assert(durations.length > 100, `${name} insufficient frame samples`);
  }
  report.gpuErrors = await page.evaluate(() => window.__baselineGpuErrors);
  assert.deepEqual(errors, [], 'Runtime errors in baseline');
  assert.deepEqual(report.gpuErrors, [], 'GPU errors in baseline');
  await fs.writeFile(destination, JSON.stringify(report, null, 2));
} finally {
  await page.keyboard.up('KeyW').catch(() => {});
  await page.goto('about:blank').catch(() => {});
  await browser.close();
}
