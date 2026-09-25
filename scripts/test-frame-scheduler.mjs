import test from 'node:test';
import assert from 'node:assert/strict';
import {createFrameScheduler} from '../src/ashen-reach/frame-scheduler.js';
const flush = async () => { await Promise.resolve(); await Promise.resolve(); };
function rig(options = {}) {
 let time = 0, id = 0;
 const frames = new Map(), completions = [], deltas = [], errors = [];
 const deps = {render: dt => deltas.push(dt), now: () => time,
  requestFrame: cb => { frames.set(++id, cb); return id; }, cancelFrame: key => frames.delete(key),
  waitForCompletion: () => new Promise((resolve, reject) => completions.push({resolve, reject})),
  onError: e => errors.push(e), ...options};
 const scheduler = createFrameScheduler(deps);
 return {scheduler, frames, completions, deltas, errors, setTime: t => { time = t; },
  tick(t) { time = t; const [key, cb] = frames.entries().next().value; frames.delete(key); cb(-999); }};
}
test('first-frame promise is stable and resolves only after render; timestamps use now', async () => {
 const r = rig(); let ready = false;
 const first = r.scheduler.start(); assert.equal(r.scheduler.start(), first);
 first.then(() => { ready = true; }); await flush(); assert.equal(ready, false);
 assert.equal(r.frames.size, 1); r.tick(100); await first; assert.equal(ready, true);
 r.tick(107); assert.deepEqual(r.deltas, [0, 7]); assert.equal(r.scheduler.state.maxPending, 8);
 r.scheduler.stop();
});
test('full budget stops RAF polling; completion wakes immediately only when starved', async () => {
 const r = rig({maxPending: 2}); r.scheduler.start(); r.tick(0); r.tick(5);
 assert.equal(r.frames.size, 0); assert.equal(r.scheduler.state.pending, 2);
 assert.equal(r.scheduler.state.waits, 1);
 r.setTime(12); r.completions[0].resolve(); await flush();
 assert.deepEqual(r.deltas, [0, 5, 7]); assert.equal(r.frames.size, 0);
 assert.equal(r.scheduler.state.pending, 2); r.scheduler.dispose();
 r.completions[1].resolve(); r.completions[2].resolve(); await flush();
 assert.equal(r.scheduler.state.pending, 0); assert.equal(r.scheduler.state.rendered, 3);
});
test('completion below budget retains the normal single RAF', async () => {
 const r = rig(); r.scheduler.start(); r.tick(0); r.completions[0].resolve(); await flush();
 assert.equal(r.deltas.length, 1); assert.equal(r.frames.size, 1); r.scheduler.stop();
});
test('hidden pauses full queue; resume resets delta and respects remaining budget', async () => {
 const r = rig({maxPending: 1}); r.scheduler.start(); r.tick(20); r.scheduler.setHidden(true);
 r.completions[0].resolve(); await flush(); assert.equal(r.deltas.length, 1);
 r.scheduler.setHidden(false); r.tick(1000); assert.deepEqual(r.deltas, [0, 0]);
 r.scheduler.setHidden(true); r.scheduler.setHidden(false); assert.equal(r.frames.size, 0);
 r.setTime(2000); r.completions[1].resolve(); await flush();
 assert.deepEqual(r.deltas, [0, 0, 0]); r.scheduler.stop();
});
test('initial hidden start waits; hide cancels scheduled RAF', async () => {
 const r = rig({hidden: true}); const first = r.scheduler.start(); assert.equal(r.frames.size, 0);
 r.scheduler.setHidden(false); assert.equal(r.frames.size, 1);
 r.scheduler.setHidden(true); assert.equal(r.frames.size, 0);
 r.scheduler.setHidden(false); r.tick(100); await first; r.scheduler.stop();
});
test('terminal disposal cancels first frame, rejects readiness and ignores stale callbacks', async () => {
 const r = rig(); const first = r.scheduler.start(), stale = [...r.frames.values()][0];
 r.scheduler.dispose(); r.scheduler.stop(); stale();
 await assert.rejects(first, {name: 'AbortError'}); await assert.rejects(r.scheduler.start(), /terminal/);
 r.scheduler.setHidden(false); assert.equal(r.frames.size, 0); assert.equal(r.deltas.length, 0);
});
test('rejected completion reports once and terminates without an unhandled rejection', async () => {
 const r = rig(); r.scheduler.start(); r.tick(0); r.tick(2);
 const error = new Error('device lost'); r.completions[0].reject(error); await flush();
 r.completions[1].reject(new Error('also lost')); await flush();
 assert.equal(r.scheduler.state.error, error); assert.deepEqual(r.errors, [error]);
 assert.equal(r.frames.size, 0); assert.equal(r.scheduler.state.pending, 0);
});
test('render and synchronous completion-registration failures terminate cleanly', async () => {
 for (const key of ['render', 'waitForCompletion']) {
  const error = new Error(key), r = rig({[key]: () => { throw error; }});
  const first = r.scheduler.start(); r.tick(0);
  if (key === 'render') await assert.rejects(first, error); else await first;
  assert.equal(r.scheduler.state.pending, 0); assert.deepEqual(r.errors, [error]);
  assert.equal(r.frames.size, 0);
 }
});
test('render reentrancy through start/visibility never double schedules', () => {
 let r, calls = 0;
 r = rig({render: () => { calls++; r.scheduler.setHidden(true); r.scheduler.setHidden(false); r.scheduler.start(); }});
 r.scheduler.start(); r.tick(10); assert.equal(calls, 1); assert.equal(r.frames.size, 1); r.scheduler.stop();
});
test('invalid budgets rejected', () => {
 for (const maxPending of [0, -1, 1.5, Infinity, NaN]) assert.throws(() => rig({maxPending}), RangeError);
});
test('out-of-order completions each release one slot without exceeding budget four', async () => {
 const r = rig({maxPending: 4}); r.scheduler.start(); for (let i = 0; i < 4; i++) r.tick(i);
 r.setTime(10); r.completions[3].resolve(); r.completions[0].resolve(); await flush();
 assert.equal(r.scheduler.state.pending, 4); assert.equal(r.scheduler.state.rendered, 6);
 assert.equal(r.frames.size, 0); r.scheduler.stop();
});
test('stop inside render registers no new completion or frame', async () => {
 let r; r = rig({render: () => r.scheduler.stop()}); const first = r.scheduler.start(); r.tick(0);
 await assert.rejects(first, {name: 'AbortError'});
 assert.equal(r.completions.length, 0); assert.equal(r.frames.size, 0); assert.equal(r.scheduler.state.pending, 0);
});
test('request scheduling and throwing error handlers cannot leak promise rejections', async () => {
 const error = new Error('RAF failed'), r = rig({requestFrame: () => { throw error; }, onError: () => { throw error; }});
 await assert.rejects(r.scheduler.start(), error); assert.equal(r.scheduler.state.error, error);
});
