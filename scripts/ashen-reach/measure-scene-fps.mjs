/**
 * Honest Ashen Reach frame-cost measurement.
 *
 * Reports internal resolution, viewport, sample count, mean/p95/p99 frame
 * time, draw calls, worldTriangles (procedural batches) and sceneTriangles
 * (live visible meshes including GLB/skinned), GPU timestamps when enabled,
 * and whether the run is sitting on a vsync/compositor cap.
 *
 * Usage:
 *   node scripts/ashen-reach/measure-scene-fps.mjs [--no-enemies] [--gpu-timing]
 *     [--pixel-ratio N] [--internal WxH] [--seconds N] [--probe-enemies] [--label name]
 *
 * Chrome must already be up (scripts/harness/up.mjs --slot 4). Pass
 * --uncapped on that launch to request a vsync-free compositor; this
 * script still detects a cap from the numbers if the flags did not take.
 */
import { chromium } from "playwright";
import { CDP_URL } from "../lib/cdp.mjs";

function flag(name) {
  return process.argv.includes(`--${name}`);
}
function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : process.argv[i + 1];
}

const noEnemies = flag("no-enemies");
const gpuTiming = flag("gpu-timing");
const probeEnemies = flag("probe-enemies");
const pixelRatio = arg("pixel-ratio", null);
const internal = arg("internal", null);
const seconds = Number(arg("seconds", "6")) || 6;
const label = arg("label", noEnemies ? "no-enemies" : "with-enemies");
const uncappedLaunch = process.env.ASHEN_UNCAPPED === "1";

const base =
  process.env.ASHEN_URL ||
  "http://127.0.0.1:5173/ashen-reach.html?play&clean";
const url = new URL(base);
if (noEnemies) url.searchParams.set("noEnemies", "");
if (gpuTiming) url.searchParams.set("gpuTiming", "");
if (pixelRatio) url.searchParams.set("pixelRatio", pixelRatio);

const browser = await chromium.connectOverCDP(CDP_URL);
const page = browser.contexts()[0].pages().find((p) =>
  p.url().includes("ashen-reach.html"),
);
if (!page) throw new Error("No ashen-reach.html tab on " + CDP_URL);

function capVerdict(summary) {
  if (summary.vsyncCapped) {
    return `SITTING ON A ${summary.capHz} Hz CAP. ${summary.capReason}. Frame time is the compositor interval, not headroom.`;
  }
  return `Not locked to a known display interval. ${summary.capReason}.`;
}

try {
  await page.bringToFront();
  await page.goto(url.toString(), { waitUntil: "commit" });
  await page.waitForFunction(() => window.ASHEN?.ready, null, { timeout: 90000 });
  await page.waitForTimeout(800);
  await page.evaluate(() => ASHEN.setView("play"));
  if (gpuTiming) {
    await page.evaluate(() => ASHEN.metrics.setGpuTiming?.(true));
    await page.waitForTimeout(400);
  }
  if (pixelRatio) {
    await page.evaluate(
      (ratio) => ASHEN.metrics.setPixelRatio?.(Number(ratio)),
      pixelRatio,
    );
    await page.waitForTimeout(200);
  }
  if (internal) {
    const [w, h] = internal.split("x").map(Number);
    const size = await page.evaluate(
      ([width, height]) => ASHEN.metrics.setInternalResolution(width, height),
      [w, h],
    );
    if (!size || size[0] !== w || size[1] !== h) {
      console.error("internal resolution did not stick", { requested: [w, h], got: size });
    }
    await page.waitForTimeout(200);
  }

  await page.keyboard.down("KeyW");
  await page.waitForTimeout(1500);
  await page.evaluate(() => ASHEN.metrics.reset?.());
  await page.waitForTimeout(seconds * 1000);
  await page.keyboard.up("KeyW");

  const result = await page.evaluate((kind) => {
    const s = ASHEN.metrics.summary();
    return {
      label: kind,
      fps: s.fps,
      meanMs: s.meanMs,
      medianMs: s.medianMs,
      p95Ms: s.p95Ms,
      p99Ms: s.p99Ms,
      worstMs: s.worstMs,
      minMs: s.minMs,
      samples: s.samples,
      above8_333: s.above8_333,
      above16_667: s.above16_667,
      drawCalls: s.drawCalls,
      worldTriangles: s.worldTriangles,
      sceneTriangles: s.sceneTriangles,
      triangles: s.triangles,
      horizonTriangles: s.horizonTriangles,
      drawBatches: s.drawBatches,
      drawnMeshes: s.drawnMeshes,
      hiddenMeshes: s.hiddenMeshes,
      totalMeshes: s.totalMeshes,
      triangleCountMs: s.triangleCountMs,
      resolution: s.resolution,
      viewport: s.viewport,
      dpr: s.dpr,
      maxDevicePixelRatio: s.maxDevicePixelRatio,
      gpuTimingSupported: s.gpuTimingSupported,
      gpuTimingEnabled: s.gpuTimingEnabled,
      gpuTimingReadback: s.gpuTimingReadback,
      gpuMs: s.gpuMs,
      gpuMeanMs: s.gpuMeanMs,
      gpuP95Ms: s.gpuP95Ms,
      gpuSamples: s.gpuSamples,
      vsyncCapped: s.vsyncCapped,
      capHz: s.capHz,
      capMs: s.capMs,
      capReason: s.capReason,
      enemies: ASHEN.combat.enemies?.length ?? 0,
    };
  }, label);

  let probe = null;
  if (probeEnemies && result.enemies > 0) {
    probe = await page.evaluate(() => {
      const before = ASHEN.metrics.countSceneTriangles();
      const enemies = ASHEN.combat.enemies || [];
      const hidden = [];
      for (const enemy of enemies) {
        for (const mesh of enemy.meshes || []) {
          hidden.push([mesh, mesh.visible]);
          mesh.visible = false;
        }
      }
      const after = ASHEN.metrics.countSceneTriangles();
      for (const [mesh, visible] of hidden) mesh.visible = visible;
      const restored = ASHEN.metrics.countSceneTriangles();
      return {
        withEnemies: before.sceneTriangles,
        withoutEnemies: after.sceneTriangles,
        restored: restored.sceneTriangles,
        delta: before.sceneTriangles - after.sceneTriangles,
        drawnMeshesWith: before.drawnMeshes,
        drawnMeshesWithout: after.drawnMeshes,
      };
    });
  }

  const report = {
    label,
    url: url.toString(),
    uncappedLaunch,
    cap: capVerdict(result),
    ...result,
    probe,
    note:
      "worldTriangles = procedural world batches (same as historical `triangles`). " +
      "sceneTriangles = live visible meshes including GLB and skinned characters. " +
      "Do not add them together.",
  };
  console.log(JSON.stringify(report, null, 2));
} finally {
  await page.keyboard.up("KeyW").catch(() => {});
  await browser.close();
}
