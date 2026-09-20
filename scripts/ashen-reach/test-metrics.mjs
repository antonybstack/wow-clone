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

test("summarizeDurations reports p95/p99 and the 8.333 ms budget", () => {
  const values = Array.from({ length: 100 }, (_, i) => 5 + i * 0.05);
  const s = summarizeDurations(values);
  assert.equal(s.samples, 100);
  assert.ok(s.p95Ms >= s.medianMs);
  assert.ok(s.p99Ms >= s.p95Ms);
  assert.equal(s.above8_333, values.filter((x) => x > 8.333).length);
});
