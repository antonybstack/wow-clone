/** Does pressing a key actually move the player, in frames the GPU rendered?
 *
 * Example:
 *   ASHEN_CDP_PORT=10137 ASHEN_TEST_URL='http://127.0.0.1:5973/ashen-reach.html?play&clean' \
 *     node scripts/ashen-reach/measure-input-response.mjs /tmp/ashen-input.json
 *
 * The startup target is a *playable* first second, and every cheap way to fake that --
 * moving a ready flag earlier, revealing a still frame, enabling input while the world is
 * frozen -- leaves `ASHEN.ready` looking identical. So this probe never reads a flag. It
 * holds a real key down, samples the player's world position once per animation frame, and
 * reports the first frame in which the player has actually travelled. The frame counter
 * comes from the scene's own onBeforeRender hook (`ASHEN.gpu.frames`), so a displacement
 * that shows up with a frame delta of at least one was displayed, not merely computed.
 *
 * Both input paths are measured, because they fail independently: keyboard through
 * `initInput`, and the on-screen stick through `installTouchControls` (?touch=1 forces it
 * on a desktop pointer). A recovery teleport or a coordinate clamp would also show up
 * here, as a jump in the samples or a rising `recoveries` count, both of which are
 * recorded rather than smoothed away.
 */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {chromium} from 'playwright';
import {CDP_URL} from '../lib/cdp.mjs';

const destination = process.argv[2];
assert(destination, 'Usage: node scripts/ashen-reach/measure-input-response.mjs <report.json>');
const base = process.env.ASHEN_TEST_URL || 'http://127.0.0.1:5173/ashen-reach.html?play&clean';
/** Movement worth calling movement. Havok's controller settles by a few mm on spawn. */
const MOVED_M = 0.05;
const HOLD_MS = 1200;
const commit = process.env.ASHEN_BASELINE_COMMIT || execFileSync('git', ['rev-parse', '--short', 'HEAD'], {encoding: 'utf8'}).trim();

/** Sample the player's position every animation frame until told to stop. */
const RECORDER = (limit) => {
  const game = globalThis.ASHEN;
  const p0 = game.player.body.position;
  const origin = {x: p0.x, y: p0.y, z: p0.z};
  const trace = {t0: performance.now(), frame0: game.gpu.frames, origin, samples: [], stop: false};
  globalThis.__inputTrace = trace;
  const tick = () => {
    const p = game.player.body.position;
    trace.samples.push({ms: performance.now() - trace.t0, frames: game.gpu.frames - trace.frame0, x: p.x, y: p.y, z: p.z});
    if (!trace.stop && trace.samples.length < limit) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
};

/** First sample whose horizontal travel clears the noise floor. */
function firstMove(trace, threshold) {
  for (const sample of trace.samples) {
    const travel = Math.hypot(sample.x - trace.origin.x, sample.z - trace.origin.z);
    if (travel >= threshold) return {...sample, travel};
  }
  return null;
}

/** Largest single-frame hop: a recovery teleport or a clamp shows up as an outlier here. */
function worstHop(trace) {
  let worst = 0;
  for (let i = 1; i < trace.samples.length; i++) {
    const a = trace.samples[i - 1], b = trace.samples[i];
    worst = Math.max(worst, Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z));
  }
  return worst;
}

const browser = await chromium.connectOverCDP(CDP_URL);
const report = {
  version: 1,
  conditions: {
    commit, cdp: CDP_URL, browser: browser.version(), base,
    host: `${os.platform()} ${os.release()} ${os.arch()}`, cpu: os.cpus()[0]?.model,
    viewport: {width: 1280, height: 720}, movedMetres: MOVED_M, holdMs: HOLD_MS,
  },
  cases: [],
};

/** One navigation, one input gesture, one honest answer about whether the player moved. */
async function probe(name, {url, drive}) {
  const context = await browser.newContext({viewport: {width: 1280, height: 720}, deviceScaleFactor: 1, hasTouch: name === 'touch-stick'});
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('pageerror', error => consoleErrors.push(String(error)));
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  try {
    await page.goto(url, {waitUntil: 'domcontentloaded', timeout: 120000});
    // whenPlayable is the boundary this whole milestone is about; awaiting the promise
    // rather than polling a flag means the timestamp is the game's own, not the poll's.
    // The wait is for the object to exist at all -- main() publishes it partway through
    // boot, so evaluating any earlier reads undefined.
    await page.waitForFunction(() => globalThis.ASHEN?.whenPlayable, null, {timeout: 120000});
    const playable = await page.evaluate(() => globalThis.ASHEN.whenPlayable);
    const before = await page.evaluate(() => {
      const game = globalThis.ASHEN;
      return {
        playableMs: game.playableMs ?? null, presentMs: game.presentMs, loadMs: game.loadMs,
        usingPhysics: game.player?.usingPhysics ?? null,
        physics: game.player?.getDebugState?.() ?? null,
        dressed: !!game.body, equipment: game.equipment?.getState?.() ?? null,
        // A loading overlay still intercepting input would invalidate the whole
        // measurement, so record what it is doing rather than assuming it is gone. It is
        // expected to still be in the document here: finishLoading hands back control at
        // the start of its fade, and `#loading.leaving` is pointer-events:none.
        overlayPresent: !!document.getElementById('loading'),
        overlayLeaving: document.getElementById('loading')?.classList.contains('leaving') ?? null,
        canvasInert: document.getElementById('renderCanvas')?.hasAttribute('inert') ?? null,
      };
    });
    await page.evaluate(RECORDER, Math.ceil((HOLD_MS + 400) / 4));
    const pressedAt = Date.now();
    await drive(page);
    await page.waitForTimeout(HOLD_MS);
    const trace = await page.evaluate(() => { globalThis.__inputTrace.stop = true; return globalThis.__inputTrace; });
    const after = await page.evaluate(() => ({
      physics: globalThis.ASHEN.player?.getDebugState?.() ?? null,
      position: (p => ({x: p.x, y: p.y, z: p.z}))(globalThis.ASHEN.player.body.position),
      frames: globalThis.ASHEN.gpu.frames,
    }));
    const moved = firstMove(trace, MOVED_M);
    const last = trace.samples.at(-1);
    const travel = last ? Math.hypot(last.x - trace.origin.x, last.z - trace.origin.z) : 0;
    report.cases.push({
      name, url, playableMs: playable, before, after,
      firstMove: moved && {ms: moved.ms, frames: moved.frames, travelM: Number(moved.travel.toFixed(3))},
      travelM: Number(travel.toFixed(3)),
      framesSampled: last?.frames ?? 0,
      worstHopM: Number(worstHop(trace).toFixed(3)),
      recoveriesDelta: (after.physics?.recoveries ?? 0) - (before.physics?.recoveries ?? 0),
      wallClockToGestureMs: pressedAt - (await page.evaluate(() => performance.timeOrigin)) | 0,
      consoleErrors,
      samples: trace.samples,
    });
  } finally {
    await context.close();
  }
}

const url = (extra) => {
  const target = new URL(base);
  for (const [key, value] of Object.entries(extra)) target.searchParams.set(key, value);
  target.searchParams.set('pixelRatio', '1');
  return target.toString();
};

await probe('keyboard-forward', {
  url: url({}),
  drive: async (page) => {
    await page.locator('#renderCanvas').focus().catch(() => {});
    await page.keyboard.down('w');
  },
});

await probe('touch-stick', {
  url: url({touch: '1'}),
  drive: async (page) => {
    const stick = page.locator('.touch-stick');
    await stick.waitFor({state: 'visible', timeout: 15000});
    const box = await stick.boundingBox();
    assert(box, 'touch stick has no layout box');
    const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
    // Past stickAxes' 16% dead zone, straight up: forward on the stick is -Y.
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx, cy - box.height * 0.42, {steps: 4});
  },
});

// connectOverCDP keeps a live WebSocket, so the process hangs after the last probe
// unless the connection is released explicitly.
await browser.close();

await fs.mkdir(path.dirname(path.resolve(destination)), {recursive: true});
await fs.writeFile(destination, JSON.stringify(report, null, 2));

const summary = report.cases.map(one => ({
  case: one.name,
  playableMs: Math.round(one.playableMs ?? 0),
  firstMoveMs: one.firstMove ? Math.round(one.firstMove.ms) : null,
  framesToMove: one.firstMove?.frames ?? null,
  travelM: one.travelM,
  worstHopM: one.worstHopM,
  recoveries: one.recoveriesDelta,
  usingPhysics: one.before.usingPhysics,
  overlay: one.before.overlayPresent ? (one.before.overlayLeaving ? 'fading' : 'BLOCKING') : 'gone',
  canvasInert: one.before.canvasInert,
  errors: one.consoleErrors.length,
}));
console.log(JSON.stringify(summary, null, 1));

const failures = [];
for (const one of report.cases) {
  if (!one.firstMove) failures.push(`${one.name}: player never travelled ${MOVED_M} m while input was held`);
  if (!one.firstMove?.frames) failures.push(`${one.name}: movement appeared without a rendered frame`);
  if (one.before.usingPhysics !== true) failures.push(`${one.name}: Havok was not driving the player`);
  if (one.before.overlayPresent && !one.before.overlayLeaving) failures.push(`${one.name}: the loading overlay was still blocking input`);
  if (one.before.canvasInert) failures.push(`${one.name}: the canvas was still inert`);
  if (one.recoveriesDelta > 0) failures.push(`${one.name}: ${one.recoveriesDelta} recovery teleport(s) during the gesture`);
  if (one.consoleErrors.length) failures.push(`${one.name}: ${one.consoleErrors.length} console error(s)`);
}
if (failures.length) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
}
