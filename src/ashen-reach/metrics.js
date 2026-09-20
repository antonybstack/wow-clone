/**
 * Ashen Reach performance instruments.
 *
 * `world.stats.triangles` (and the `triangles` key in summaries) is the
 * committed procedural world-batch count from scene.js. It does not include
 * GLB or skinned meshes. This module keeps that meaning and reports a live
 * scene count alongside it.
 *
 * Triangle counting reads `mesh._gpu.indexCount` — the same field Lite passes
 * to `drawIndexed` — so a summary() call is a walk of scene.meshes, not a
 * geometry copy. It runs only when asked, never on the render path.
 */

const KNOWN_CAP_HZ = [60, 75, 90, 120, 144, 165, 240];

export function meshIsDrawn(mesh) {
  for (let node = mesh; node; node = node.parent) {
    if (node.visible === false) return false;
  }
  return true;
}

/** Indexed triangles submitted for one mesh, including thin instances. */
export function meshTriangleCount(mesh) {
  const gpu = mesh._gpu;
  const indexCount = gpu?.indexCount ?? mesh._cpuIndices?.length ?? 0;
  if (!indexCount) return 0;
  const instances = mesh.thinInstances?.count > 0 ? mesh.thinInstances.count : 1;
  return (indexCount / 3) * instances;
}

export function countSceneTriangles(scene) {
  const started = performance.now();
  let sceneTriangles = 0;
  let drawnMeshes = 0;
  let hiddenMeshes = 0;
  const meshes = scene.meshes || [];
  for (const mesh of meshes) {
    if (!meshIsDrawn(mesh)) {
      hiddenMeshes++;
      continue;
    }
    const tris = meshTriangleCount(mesh);
    if (!tris) continue;
    sceneTriangles += tris;
    drawnMeshes++;
  }
  return {
    sceneTriangles,
    drawnMeshes,
    hiddenMeshes,
    totalMeshes: meshes.length,
    triangleCountMs: performance.now() - started,
  };
}

export function percentile(sorted, p) {
  if (!sorted.length) return 0;
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
}

export function summarizeDurations(values) {
  const a = [...values].sort((x, y) => x - y);
  const n = a.length;
  const mean = n ? a.reduce((s, x) => s + x, 0) / n : 0;
  return {
    samples: n,
    fps: n && mean ? 1000 / mean : 0,
    meanMs: mean,
    medianMs: percentile(a, 0.5),
    p95Ms: percentile(a, 0.95),
    p99Ms: percentile(a, 0.99),
    worstMs: n ? a[n - 1] : 0,
    minMs: n ? a[0] : 0,
    above8_333: a.filter((x) => x > 8.333).length,
    above16_667: a.filter((x) => x > 16.667).length,
  };
}

/**
 * A result sitting on a vsync (or compositor) ceiling must say so.
 * Known display intervals: 60 / 75 / 90 / 120 / 144 / 165 / 240 Hz.
 *
 * The mean and median are the strong signal: over hundreds of samples a real
 * cap's jitter averages out, so the mean sits within a fraction of a percent
 * of the true interval even when individual frames land far off it (a real
 * 144 Hz panel: mean 6.9438 ms against a 6.9444 ms interval, 0.009% off,
 * while individual samples range 5.10-8.80 ms). `min` and a per-sample
 * "how many are faster than 0.92x" gate are not reliable under that jitter -
 * they were tuned against headless Chrome's rigid compositor cap, where
 * every sample lands on the interval exactly, and false-negative on real
 * hardware. Keep a loose sanity bound on the full range instead, just to
 * reject a mean that coincidentally lands near an interval while the samples
 * are actually spread across multiple multiples of it.
 */
export function detectVsyncCap(values) {
  if (!values.length) {
    return { vsyncCapped: false, capHz: null, capMs: null, capReason: "no samples" };
  }
  const a = [...values].sort((x, y) => x - y);
  const mean = a.reduce((s, x) => s + x, 0) / a.length;
  const median = percentile(a, 0.5);
  const min = a[0];
  const worst = a[a.length - 1];
  for (const hz of KNOWN_CAP_HZ) {
    const capMs = 1000 / hz;
    const meanNear = Math.abs(mean - capMs) / capMs <= 0.02;
    const medianNear = Math.abs(median - capMs) / capMs <= 0.03;
    const spreadSane = min >= capMs * 0.6 && worst <= capMs * 1.5;
    if (meanNear && medianNear && spreadSane) {
      return {
        vsyncCapped: true,
        capHz: hz,
        capMs,
        capReason:
          `mean ${mean.toFixed(3)} ms and median ${median.toFixed(3)} ms sit on ${hz} Hz ` +
          `(${capMs.toFixed(3)} ms); range ${min.toFixed(3)}-${worst.toFixed(3)} ms`,
      };
    }
  }
  return {
    vsyncCapped: false,
    capHz: null,
    capMs: null,
    capReason: `mean ${mean.toFixed(3)} ms is not locked to a known display interval`,
  };
}

export function createAshenMetrics({ engine, scene, world, canvas, samples, lite }) {
  let gpuWanted = false;
  const gpuSamples = [];

  function sampleGpu() {
    if (!gpuWanted) return;
    const g = engine.gpuFrameTimeMs;
    if (g > 0) {
      gpuSamples.push(g);
      if (gpuSamples.length > 600) gpuSamples.shift();
    }
  }

  function setGpuTiming(enabled) {
    gpuWanted = !!enabled;
    lite.setGpuTimingEnabled(engine, gpuWanted);
    if (!gpuWanted) gpuSamples.length = 0;
    return {
      requested: gpuWanted,
      supported: lite.isGpuTimingSupported(engine),
    };
  }

  function setPixelRatio(ratio) {
    const next = Number(ratio);
    if (!Number.isFinite(next) || next <= 0) throw Error("pixelRatio must be > 0");
    engine.maxDevicePixelRatio = next;
    lite.resizeSurface(engine);
    return [canvas.width, canvas.height];
  }

  function setInternalResolution(width, height) {
    const w = Math.round(Number(width));
    const h = Math.round(Number(height));
    if (!(w > 0 && h > 0)) throw Error("internal resolution must be positive");
    // startEngine calls resizeSurface every frame from CSS × DPR. Disconnect the
    // observer and pin _w/_h so the requested backing store survives that path.
    engine._ro?.disconnect();
    engine._w = w;
    engine._h = h;
    engine.maxDevicePixelRatio = 1;
    lite.resizeSurface(engine);
    return [canvas.width, canvas.height];
  }

  function reset() {
    samples.length = 0;
    gpuSamples.length = 0;
  }

  function summary() {
    const frames = summarizeDurations(samples);
    const counts = countSceneTriangles(scene);
    const cap = detectVsyncCap(samples);
    const gpu = summarizeDurations(gpuSamples);
    const worldTriangles = world.stats.triangles;
    return {
      ...frames,
      drawCalls: engine.drawCallCount,
      resolution: [canvas.width, canvas.height],
      viewport: [
        typeof innerWidth === "number" ? innerWidth : canvas.clientWidth,
        typeof innerHeight === "number" ? innerHeight : canvas.clientHeight,
      ],
      dpr: typeof devicePixelRatio === "number" ? devicePixelRatio : 1,
      maxDevicePixelRatio: engine.maxDevicePixelRatio,
      ...world.stats,
      worldTriangles,
      sceneTriangles: counts.sceneTriangles,
      drawnMeshes: counts.drawnMeshes,
      hiddenMeshes: counts.hiddenMeshes,
      totalMeshes: counts.totalMeshes,
      triangleCountMs: counts.triangleCountMs,
      gpuTimingSupported: lite.isGpuTimingSupported(engine),
      gpuTimingEnabled: gpuWanted,
      gpuTimingReadback: !gpuWanted ? "disabled" : gpu.samples ? "ok" : "timestamp queries returned 0",
      gpuMs: engine.gpuFrameTimeMs || null,
      gpuMeanMs: gpu.samples ? gpu.meanMs : null,
      gpuP95Ms: gpu.samples ? gpu.p95Ms : null,
      gpuSamples: gpu.samples,
      vsyncCapped: cap.vsyncCapped,
      capHz: cap.capHz,
      capMs: cap.capMs,
      capReason: cap.capReason,
    };
  }

  return { summary, reset, sampleGpu, setGpuTiming, setPixelRatio, setInternalResolution, countSceneTriangles: () => countSceneTriangles(scene) };
}
