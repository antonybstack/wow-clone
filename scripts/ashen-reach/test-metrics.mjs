import assert from "node:assert/strict";
import test from "node:test";
import {
  countSceneTriangles,
  detectVsyncCap,
  meshTriangleCount,
  summarizeDurations,
} from "../../src/ashen-reach/metrics.js";

function mesh({ indexCount = 0, visible, parent, instances } = {}) {
  return {
    visible,
    parent: parent || null,
    _gpu: indexCount ? { indexCount } : null,
    thinInstances: instances ? { count: instances } : null,
  };
}

test("meshTriangleCount uses GPU indexCount and thin-instance multiplier", () => {
  assert.equal(meshTriangleCount(mesh()), 0);
  assert.equal(meshTriangleCount(mesh({ indexCount: 9 })), 3);
  assert.equal(meshTriangleCount(mesh({ indexCount: 9, instances: 4 })), 12);
  assert.equal(meshTriangleCount({ _cpuIndices: { length: 6 } }), 2);
});

test("countSceneTriangles skips hidden meshes including parent cascade", () => {
  const parent = mesh({ indexCount: 300, visible: false });
  const scene = {
    meshes: [
      mesh({ indexCount: 300 }),
      mesh({ indexCount: 90, visible: false }),
      mesh({ indexCount: 60, parent }),
      mesh({ indexCount: 12, instances: 2 }),
    ],
  };
  const result = countSceneTriangles(scene);
  assert.equal(result.sceneTriangles, 100 + 8);
  assert.equal(result.drawnMeshes, 2);
  assert.equal(result.hiddenMeshes, 2);
  assert.equal(result.totalMeshes, 4);
  assert.ok(result.triangleCountMs >= 0);
});

test("detectVsyncCap flags a 144 Hz ceiling and a 60 Hz headless ceiling", () => {
  const locked144 = Array.from({ length: 200 }, (_, i) => 6.94 + (i % 5) * 0.002);
  const cap144 = detectVsyncCap(locked144);
  assert.equal(cap144.vsyncCapped, true);
  assert.equal(cap144.capHz, 144);

  const locked60 = Array.from({ length: 200 }, (_, i) => 16.66 + (i % 5) * 0.004);
  const cap60 = detectVsyncCap(locked60);
  assert.equal(cap60.vsyncCapped, true);
  assert.equal(cap60.capHz, 60);

  const free = Array.from({ length: 200 }, (_, i) => 2.2 + (i % 10) * 0.08);
  const uncapped = detectVsyncCap(free);
  assert.equal(uncapped.vsyncCapped, false);
  assert.equal(uncapped.capHz, null);
});

// --- M6b: the three recorded distributions the cap detector must get right ---
//
// A monotone ramp raised to a fractional power biases its mass toward the
// high end while staying sorted; picking the exponent by bisection lets a
// tiny handful of control points (min, median, p95, p99, worst) reproduce a
// full 600-sample array whose aggregate stats match a recorded run exactly,
// without hand-typing 600 numbers. `skewedRamp` is that building block.
function skewedRamp(count, lo, hi, exponent) {
  const out = new Array(count);
  for (let j = 0; j < count; j++) {
    const frac = count === 1 ? 0 : j / (count - 1);
    out[j] = lo + (hi - lo) * Math.pow(frac, exponent);
  }
  return out;
}

/**
 * Real display, visible Chrome, 600 samples (measured by hand on real
 * hardware for M6b): mean 6.9438 ms, median 6.900, min 5.10, p95 8.40,
 * p99 8.70, worst 8.80, above8_333 32 - a textbook 144 Hz cap with rAF
 * jitter either side of the interval. Exponent found by bisection to hit
 * the recorded mean exactly; every other control point (min/median/p95/
 * p99/worst/above8_333) is exact by construction.
 */
function realDisplay144Hz() {
  const below = skewedRamp(300, 5.1, 6.898, 1); // indices 0-299, up to just under the median
  const median = [6.9]; // index 300
  const mid = skewedRamp(267, 6.902, 8.33, 0.5702529683955218); // indices 301-567, below the 8.333 ms budget line
  const tail = new Array(32); // indices 568-599: the 32 samples slower than 8.333 ms
  tail[0] = 8.34;
  tail[1] = 8.37;
  tail[2] = 8.4; // p95 (index 570)
  for (let k = 1; k <= 24; k++) tail[2 + k] = 8.4 + 0.0125 * k; // tail[26] = 8.70 (p99, index 594)
  for (let k = 1; k <= 5; k++) tail[26 + k] = 8.7 + 0.02 * k; // tail[31] = 8.80 (worst, index 599)
  return [...below, ...median, ...mid, ...tail];
}

/** Headless Chrome's default compositor cap: perfectly rigid 60 Hz, every sample exactly 16.667 ms. */
function headlessDefault60Hz() {
  return new Array(600).fill(16.667);
}

/**
 * Headless Chrome launched `--uncapped`, 600 samples: mean 1.334 ms,
 * median ~1.3, min ~1.0, p95 1.60, p99 1.70, worst 2.0 - no known display
 * interval is anywhere near this (240 Hz, the closest, is 4.167 ms).
 */
function headlessUncapped() {
  const below = skewedRamp(300, 1.0, 1.298, 1); // indices 0-299
  const median = [1.3]; // index 300
  const mid = skewedRamp(269, 1.302, 1.598, 0.4864308409841289); // indices 301-569
  const p95 = [1.6]; // index 570
  const upper = skewedRamp(23, 1.602, 1.698, 1); // indices 571-593
  const p99 = [1.7]; // index 594
  const nearWorst = skewedRamp(4, 1.72, 1.98, 1); // indices 595-598
  const worst = [2.0]; // index 599
  return [...below, ...median, ...mid, ...p95, ...upper, ...p99, ...nearWorst, ...worst];
}

test("detectVsyncCap: real 144 Hz distribution reproduces the recorded stats and is flagged capped", () => {
  const samples = realDisplay144Hz();
  const s = summarizeDurations(samples);
  assert.equal(s.samples, 600);
  assert.ok(Math.abs(s.meanMs - 6.943833) < 1e-5, `meanMs ${s.meanMs}`);
  assert.equal(Number(s.medianMs.toFixed(3)), 6.9);
  assert.equal(Number(s.minMs.toFixed(3)), 5.1);
  assert.equal(Number(s.p95Ms.toFixed(3)), 8.4);
  assert.equal(Number(s.p99Ms.toFixed(3)), 8.7);
  assert.equal(Number(s.worstMs.toFixed(3)), 8.8);
  assert.equal(s.above8_333, 32);

  const cap = detectVsyncCap(samples);
  assert.equal(cap.vsyncCapped, true, cap.capReason);
  assert.equal(cap.capHz, 144);
});

test("detectVsyncCap: headless default 60 Hz distribution is flagged capped", () => {
  const samples = headlessDefault60Hz();
  const cap = detectVsyncCap(samples);
  assert.equal(cap.vsyncCapped, true, cap.capReason);
  assert.equal(cap.capHz, 60);
});

test("detectVsyncCap: headless --uncapped distribution reproduces the recorded stats and is not flagged capped", () => {
  const samples = headlessUncapped();
  const s = summarizeDurations(samples);
  assert.equal(s.samples, 600);
  assert.ok(Math.abs(s.meanMs - 1.334) < 1e-9, `meanMs ${s.meanMs}`);
  assert.equal(Number(s.medianMs.toFixed(3)), 1.3);
  assert.equal(Number(s.minMs.toFixed(3)), 1.0);
  assert.equal(Number(s.p95Ms.toFixed(3)), 1.6);
  assert.equal(Number(s.p99Ms.toFixed(3)), 1.7);
  assert.equal(Number(s.worstMs.toFixed(3)), 2.0);

  const cap = detectVsyncCap(samples);
  assert.equal(cap.vsyncCapped, false, cap.capReason);
  assert.equal(cap.capHz, null);
});

test("summarizeDurations reports p95/p99 and the 8.333 ms budget", () => {
  const values = Array.from({ length: 100 }, (_, i) => 5 + i * 0.05);
  const s = summarizeDurations(values);
  assert.equal(s.samples, 100);
  assert.ok(s.p95Ms >= s.medianMs);
  assert.ok(s.p99Ms >= s.p95Ms);
  assert.equal(s.above8_333, values.filter((x) => x > 8.333).length);
});
