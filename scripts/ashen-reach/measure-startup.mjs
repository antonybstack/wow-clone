/** Repeatable startup timings in an already running, owned Chromium CDP browser.
 *
 * Example:
 *   ASHEN_CDP_PORT=10437 ASHEN_TEST_URL='http://127.0.0.1:6273/ashen-reach.html?play&clean' \
 *     node scripts/ashen-reach/measure-startup.mjs /tmp/ashen-startup.json
 *
 * The first navigation uses a fresh browser context. Later navigations reuse
 * that context; resource byte counters show whether HTTP caching actually took
 * effect. Browser process, OS, and driver shader caches are never called cold.
 */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {chromium} from 'playwright';
import {CDP_URL} from '../lib/cdp.mjs';

const destination = process.argv[2];
assert(destination, 'Usage: node scripts/ashen-reach/measure-startup.mjs <report.json>');
const runs = Number(process.env.ASHEN_STARTUP_RUNS || 4);
assert(Number.isInteger(runs) && runs >= 1 && runs <= 30, 'ASHEN_STARTUP_RUNS must be 1–30');
const target = new URL(process.env.ASHEN_TEST_URL || 'http://127.0.0.1:5173/ashen-reach.html?play&clean');
target.searchParams.set('startupMarks', '');
target.searchParams.set('pixelRatio', '1');
const commit = process.env.ASHEN_BASELINE_COMMIT || execFileSync('git', ['rev-parse', '--short', 'HEAD'], {encoding: 'utf8'}).trim();
const browser = await chromium.connectOverCDP(CDP_URL);
const context = await browser.newContext({viewport: {width: 1280, height: 720}, deviceScaleFactor: 1});
const page = await context.newPage();
const cdp = await context.newCDPSession(page);
await cdp.send('Network.enable');
await cdp.send('Network.setCacheDisabled', {cacheDisabled: false});
await page.addInitScript(() => {
  window.__startupLongTasks = [];
  window.__startupGpuErrors = [];
  new PerformanceObserver(list => {
    for (const entry of list.getEntries()) {
      window.__startupLongTasks.push({startMs: entry.startTime, durationMs: entry.duration});
    }
  }).observe({type: 'longtask', buffered: true});
  if (globalThis.GPUAdapter) {
    const original = GPUAdapter.prototype.requestDevice;
    GPUAdapter.prototype.requestDevice = async function (...args) {
      const device = await original.apply(this, args);
      device.addEventListener('uncapturederror', event => window.__startupGpuErrors.push(event.error?.message || String(event.error)));
      device.lost.then(info => window.__startupGpuErrors.push(`Device ${info.reason}: ${info.message}`));
      return device;
    };
  }
});

const report = {
  version: 1,
  conditions: {
    commit, url: target.toString(), cdp: CDP_URL,
    browser: browser.version(), userAgent: null,
    host: `${os.platform()} ${os.release()} ${os.arch()}`,
    cpu: os.cpus()[0]?.model, viewport: {width: 1280, height: 720},
    cachePolicy: 'First run: new browser context with empty HTTP cache. Later runs: same context, HTTP cache allowed. Browser process, OS, and GPU driver caches are uncontrolled; Network encoded bytes and cache flags are recorded.',
    recording: false,
  },
  rows: [],
};
const save = async () => {
  await fs.mkdir(path.dirname(destination), {recursive: true});
  await fs.writeFile(destination, JSON.stringify(report, null, 2));
};

try {
  for (let run = 1; run <= runs; run++) {
    const pageErrors = [];
    const consoleErrors = [];
    const requestErrors = [];
    const network = {encodedBytes: 0, completedRequests: 0, fromDiskCache: 0, fromServiceWorker: 0};
    const pending = new Map();
    const onPageError = error => pageErrors.push(error.message);
    const onConsole = message => { if (message.type() === 'error') consoleErrors.push(message.text()); };
    const onRequestFailed = request => requestErrors.push(`${request.method()} ${request.url()}: ${request.failure()?.errorText}`);
    const onResponse = event => {
      pending.set(event.requestId, {
        disk: Boolean(event.response.fromDiskCache),
        worker: Boolean(event.response.fromServiceWorker),
      });
    };
    const onFinished = event => {
      network.encodedBytes += event.encodedDataLength || 0;
      network.completedRequests++;
      const flags = pending.get(event.requestId);
      if (flags?.disk) network.fromDiskCache++;
      if (flags?.worker) network.fromServiceWorker++;
      pending.delete(event.requestId);
    };
    page.on('pageerror', onPageError);
    page.on('console', onConsole);
    page.on('requestfailed', onRequestFailed);
    cdp.on('Network.responseReceived', onResponse);
    cdp.on('Network.loadingFinished', onFinished);
    let row;
    try {
      await page.goto(target.toString(), {waitUntil: 'domcontentloaded', timeout: 120000});
      await page.waitForFunction(() => globalThis.ASHEN?.ready && ASHEN.hostilesReady, null, {timeout: 120000});
      // Public Lite waitForGpuIdle in main marks completion after first render.
      await page.waitForFunction(() => performance.getEntriesByName('ashen-startup-first-gpu-completed').length > 0, null, {timeout: 30000});
      row = await page.evaluate(() => {
        const game = globalThis.ASHEN;
        const canvas = document.getElementById('renderCanvas');
        const marks = Object.fromEntries(performance.getEntriesByType('mark')
          .filter(entry => entry.name.startsWith('ashen-startup-'))
          .map(entry => [entry.name.slice('ashen-startup-'.length), entry.startTime]));
        const tasks = window.__startupLongTasks;
        return {
          marks,
          playableReadyMs: marks.playable ?? null,
          regionReadyMs: marks['region-ready'] ?? null,
          fullReadyMs: Math.max(marks.ready ?? 0, marks['hostiles-ready'] ?? 0),
          firstGpuCompletedMs: marks['first-gpu-completed'] ?? null,
          presentMs: game.presentMs, loadMs: game.loadMs,
          longTasks: {count: tasks.length, totalMs: tasks.reduce((sum, task) => sum + task.durationMs, 0),
            worstMs: Math.max(0, ...tasks.map(task => task.durationMs)), entries: tasks},
          canvas: {width: canvas.width, height: canvas.height, cssWidth: canvas.clientWidth, cssHeight: canvas.clientHeight},
          enemies: game.combat?.enemies?.length ?? null,
          physics: game.player?.getDebugState?.() ?? null,
          gpuErrors: window.__startupGpuErrors,
          loadingVisible: Boolean(document.getElementById('loading')),
          errorVisible: Boolean(document.getElementById('error') && getComputedStyle(document.getElementById('error')).display !== 'none'),
          userAgent: navigator.userAgent,
        };
      });
      row.run = run;
      row.cacheLabel = run === 1 ? 'fresh context HTTP cache' : 'same context reload';
      const mark = row.marks;
      const span = (start, end) => Number.isFinite(mark[start]) && Number.isFinite(mark[end])
        ? mark[end] - mark[start] : null;
      row.stagesMs = {
        engine: span('begin', 'engine-created'),
        world: span('world-start', 'world-end'),
        havok: span('havok-start', 'havok-end'),
        body: span('body-start', 'body-end'),
        initialRegistration: span('register-start', 'register-end'),
        lateRegistration: span('late-register-start', 'late-register-end'),
        firstRenderToGpuCompletion: span('first-render-return', 'first-gpu-completed'),
      };
      row.network = network;
      row.errors = {page: pageErrors, console: consoleErrors, requests: requestErrors};
      report.rows.push(row);
      report.conditions.userAgent = row.userAgent;
      await save();
      assert(Object.values(row.stagesMs).every(Number.isFinite), 'A startup stage mark is missing');
      assert(Number.isFinite(row.firstGpuCompletedMs) && Number.isFinite(row.playableReadyMs), 'GPU or playable ready mark missing');
      console.log(JSON.stringify({run, cache: row.cacheLabel, worldMs: row.stagesMs.world.toFixed(1),
        gpuMs: row.firstGpuCompletedMs.toFixed(1), readyMs: row.playableReadyMs.toFixed(1), worstLongTaskMs: row.longTasks.worstMs,
        enemies: row.enemies, canvas: row.canvas, network: row.network}));
      assert.equal(row.enemies, 7, 'Expected seven enemies');
      assert.equal(row.physics?.usingPhysics, true, 'Havok inactive');
      assert.equal(row.canvas.width, 1280, 'Unexpected canvas width');
      assert.equal(row.canvas.height, 720, 'Unexpected canvas height');
      assert.equal(row.loadingVisible, false, 'Loading overlay still visible');
      assert.equal(row.errorVisible, false, 'Error display visible');
      assert.deepEqual(row.gpuErrors, [], 'GPU errors');
      assert.deepEqual(row.errors, {page: [], console: [], requests: []}, 'Runtime or request errors');
    } catch (error) {
      report.failure = {run, message: error.message, pageErrors, consoleErrors, requestErrors};
      await save();
      throw error;
    } finally {
      page.off('pageerror', onPageError);
      page.off('console', onConsole);
      page.off('requestfailed', onRequestFailed);
      cdp.off('Network.responseReceived', onResponse);
      cdp.off('Network.loadingFinished', onFinished);
    }
  }
} finally {
  await page.goto('about:blank').catch(() => {});
  await context.close();
  await browser.close();
}
