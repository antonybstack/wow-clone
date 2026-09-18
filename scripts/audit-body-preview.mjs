/** Live Lite body-preview evidence. Not Mixamo lab. Not art acceptance. */
import assert from "node:assert/strict";
import { copyFile, mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const out = path.resolve("ve-capture", "m2f-body-preview");
await mkdir(out, { recursive: true });
const errors = [];
const report = { ok: false, liveRuntimeEvidence: true, views: [] };
try {
  const animated = await stat(path.resolve("public/characters/bodies/human-animated-v1.glb"));
  report.candidateSnapshot = { mtimeMs: animated.mtimeMs, size: animated.size };
} catch {
  report.candidateSnapshot = null;
}

let phase = "startup";
function recordError(text) {
  errors.push({ phase, text });
}

function unexpectedErrors() {
  return errors.filter((e) => {
    if (
      e.phase === "failedLoad" &&
      report.failedLoad?.message &&
      (e.text.includes(report.failedLoad.message) || e.text.includes("blob:"))
    ) {
      return false;
    }
    return true;
  });
}

let browser;
try {
  browser = await chromium.connectOverCDP("http://127.0.0.1:9222");
} catch (error) {
  report.failure = `CDP unavailable: ${error.message}`;
  await writeFile(path.join(out, "report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ok: false, out, failure: report.failure }, null, 2));
  process.exit(1);
}

const context = browser.contexts()[0];
const page =
  context.pages().find((p) => p.url().includes("body-preview")) || (await context.newPage());
page.on("pageerror", (e) => recordError(e.message));
page.on("console", (m) => {
  if (m.type() === "error") recordError(m.text());
});

try {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.bringToFront();
  await page.goto("http://127.0.0.1:5173/body-preview.html?m2f-audit=1", {
    waitUntil: "domcontentloaded",
    timeout: 30000,
  });
  await page.waitForFunction(
    () => {
      const preview = globalThis.BODY_PREVIEW;
      const status = document.getElementById("status")?.textContent || "";
      const err = document.getElementById("error");
      if (err && !err.hidden && err.textContent) return false;
      return (
        preview?.ready === true &&
        typeof preview.selectedUrl === "string" &&
        status.includes(preview.selectedUrl) &&
        !status.startsWith("Loading")
      );
    },
    null,
    { timeout: 90000 },
  );
  report.baseline = await page.evaluate(() => BODY_PREVIEW.diagnostics());
  assert.equal(report.baseline.selectedUrl, "/characters/bodies/human-v1.glb");
  assert.ok(report.baseline.meshCount > 0, "body meshes missing");
  assert.ok(report.baseline.skinBindings > 0, "no skinned meshes");
  assert.equal(report.baseline.animationManagers, 1);
  assert.deepEqual(report.baseline.clipNames, []);
  assert.equal(report.baseline.clip, null);
  assert.equal(report.baseline.time, null);
  assert.ok(report.baseline.resolution?.[0] > 0);
  assert.ok("dpr" in report.baseline);
  assert.ok(report.baseline.gpuMs === null || Number.isFinite(report.baseline.gpuMs));
  report.sourceSceneMeshes = report.baseline.sceneMeshes;

  phase = "studioViews";
  const STUDIO_VIEWS = ["front", "back", "side", "three-quarter", "face", "hands", "feet"];
  const r4Live = path.resolve(".dream-loop", "character", "rounds", "r4-live");
  await mkdir(r4Live, { recursive: true });
  await page.evaluate(() => BODY_PREVIEW.setChromeVisible(false));
  const viewport = page.locator("#viewport");
  for (const view of STUDIO_VIEWS) {
    await page.evaluate((name) => BODY_PREVIEW.view(name), view);
    await page.waitForFunction(() => {
      const status = document.getElementById("status")?.textContent || "";
      return BODY_PREVIEW?.ready && status.includes(BODY_PREVIEW.selectedUrl) && !status.startsWith("Loading");
    });
    // Let SMAA/shadow/contact-shadow temporal state settle before capturing.
    await page.waitForTimeout(700);
    const file = path.join(out, `${view}.png`);
    await viewport.screenshot({ path: file });
    await copyFile(file, path.join(r4Live, `${view}.png`));
    const viewParams = await page.evaluate((name) => BODY_PREVIEW.viewParams(name), view);
    const fillMeasure = ["front", "back", "side", "three-quarter", "hands"].includes(view)
      ? await page.evaluate(async () => {
          const shot = await BODY_PREVIEW.capture();
          const { width, height, data } = shot;
          let wr = 0;
          let wg = 0;
          let wb = 0;
          let n = 0;
          for (let y = 4; y < 24; y++) {
            for (let x = 4; x < 24; x++) {
              const i = (y * width + x) * 4;
              wr += data[i];
              wg += data[i + 1];
              wb += data[i + 2];
              n++;
            }
          }
          wr /= n;
          wg /= n;
          wb /= n;
          const wallY = 0.2126 * wr + 0.7152 * wg + 0.0722 * wb;
          let fr = 0;
          let fg = 0;
          let fb = 0;
          let fn = 0;
          for (let y = height - 24; y < height - 4; y++) {
            for (let x = 4; x < 24; x++) {
              const i = (y * width + x) * 4;
              fr += data[i];
              fg += data[i + 1];
              fb += data[i + 2];
              fn++;
            }
          }
          fr /= fn;
          fg /= fn;
          fb /= fn;
          const floorY = 0.2126 * fr + 0.7152 * fg + 0.0722 * fb;
          const dist3 = (r, g, b, cr, cg, cb) => Math.abs(r - cr) + Math.abs(g - cg) + Math.abs(b - cb);
          const isShorts = (r, g, b) => b > r + 8 && b > g && r < wr - 16 && b > 70 && b < 190;
          const isSkin = (r, g, b) => {
            const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
            if (y < Math.min(wallY, floorY) - 4) return false;
            if (dist3(r, g, b, wr, wg, wb) < 28) return false;
            if (dist3(r, g, b, fr, fg, fb) < 28) return false;
            return y > 140 && r > b + 2 && r > 140;
          };
          const isBody = (r, g, b) => isSkin(r, g, b) || isShorts(r, g, b);
          let first = -1;
          let last = -1;
          let bodyPixels = 0;
          const x0 = Math.floor(width * 0.22);
          const x1 = Math.ceil(width * 0.78);
          for (let y = 0; y < height; y++) {
            let hit = false;
            for (let x = x0; x < x1; x++) {
              const i = (y * width + x) * 4;
              if (isBody(data[i], data[i + 1], data[i + 2])) {
                hit = true;
                bodyPixels++;
              }
            }
            if (hit) {
              if (first < 0) first = y;
              last = y;
            }
          }
          const span = first >= 0 ? last - first + 1 : 0;
          return {
            canvas: [width, height],
            firstRow: first,
            lastRow: last,
            fillPercent: height ? (span / height) * 100 : 0,
            bottomMarginPercent: height && last >= 0 ? ((height - 1 - last) / height) * 100 : 0,
            bodyPixelPercent: (x1 - x0) * height ? (bodyPixels / ((x1 - x0) * height)) * 100 : 0,
            wallSample: [wr, wg, wb],
            floorSample: [fr, fg, fb],
          };
        })
      : null;
    report.views.push({ view, file, liveRuntimeEvidence: true, viewParams, fillMeasure, clip: "viewport" });
  }

  phase = "studioMeasurements";
  await page.evaluate(() => BODY_PREVIEW.view("front"));
  await page.waitForFunction(() => BODY_PREVIEW.metrics.count >= 300, null, { timeout: 20000 });
  report.studio = await page.evaluate(() => {
    const diagnostics = BODY_PREVIEW.diagnostics();
    return { fpsMetrics: diagnostics.metrics, studio: diagnostics.studio };
  });
  report.skinLuminanceFront = await page.evaluate(() => BODY_PREVIEW.measureSkinLuminance());

  if (report.baseline.animatedAvailable) {
    phase = "animated";
    report.animated = await page.evaluate(async () => {
      await BODY_PREVIEW.load("/characters/bodies/human-animated-v1.glb");
      const before = BODY_PREVIEW.diagnostics();
      if (!before.clipNames.length) {
        return { loaded: true, clipNames: [], note: "candidate has no clips", clockAdvanced: false, animationMotionVerified: false };
      }
      const finiteDurations = before.clips.every((c) => Number.isFinite(c.duration) && c.duration > 0);
      const motionClips = ["walk", "run", "cast"].filter((n) => before.clipNames.includes(n));
      const motion = [];
      for (const name of motionClips) {
        BODY_PREVIEW.setClip(name, 0, true);
        BODY_PREVIEW.seek(0);
        const t0 = BODY_PREVIEW.samplePalette();
        const dur = before.clips.find((c) => c.name === name)?.duration || 1;
        const t1Time = Math.min(dur * 0.35, dur);
        BODY_PREVIEW.seek(t1Time);
        const t1 = BODY_PREVIEW.samplePalette();
        motion.push({ clip: name, times: [0, t1Time], paletteChanged: JSON.stringify(t0) !== JSON.stringify(t1) });
      }
      BODY_PREVIEW.setClip(before.clipNames[0], 0, false);
      BODY_PREVIEW.pause(false);
      await new Promise((r) => setTimeout(r, 250));
      const after = BODY_PREVIEW.diagnostics();
      BODY_PREVIEW.pause(true);
      const clockAdvanced = (after.time ?? 0) > 0;
      const animationMotionVerified = motion.some((m) => m.paletteChanged);
      return {
        loaded: true,
        clipNames: after.clipNames,
        clips: before.clips,
        time: after.time,
        clockAdvanced,
        animationMotionVerified,
        finiteDurations,
        motion,
        sceneMeshes: after.sceneMeshes,
        reason: animationMotionVerified ? null : "palette unchanged at frozen clip times (asset finding)",
      };
    });
    report.clockAdvanced = report.animated.clockAdvanced;
    report.animationMotionVerified = report.animated.animationMotionVerified;
  } else {
    report.animated = { loaded: false, note: "human-animated-v1.glb unavailable", animationMotionVerified: false };
    report.clockAdvanced = false;
    report.animationMotionVerified = false;
  }

  phase = "roundtrip";
  if (report.animated?.loaded) {
    report.roundtrip = await page.evaluate(async () => {
      const before = BODY_PREVIEW.diagnostics().sceneMeshes;
      await BODY_PREVIEW.load("/characters/bodies/human-v1.glb");
      const mid = BODY_PREVIEW.diagnostics();
      const candidate = "/characters/bodies/human-animated-v1.glb";
      await BODY_PREVIEW.load(candidate);
      await BODY_PREVIEW.load("/characters/bodies/human-v1.glb");
      const after = BODY_PREVIEW.diagnostics();
      return {
        before,
        afterSource: after.sceneMeshes,
        clipNames: after.clipNames,
        clip: after.clip,
        time: after.time,
        url: after.selectedUrl,
        midUrl: mid.selectedUrl,
      };
    });
    assert.equal(report.roundtrip.url, "/characters/bodies/human-v1.glb");
    assert.deepEqual(report.roundtrip.clipNames, []);
    assert.equal(report.roundtrip.clip, null);
    assert.equal(report.roundtrip.afterSource, report.sourceSceneMeshes);
  }

  phase = "latestWins";
  report.latestWins = await page.evaluate(async () => {
    const source = "/characters/bodies/human-v1.glb";
    const candidate = BODY_PREVIEW.diagnostics().animatedAvailable
      ? "/characters/bodies/human-animated-v1.glb"
      : source;
    const a = BODY_PREVIEW.load(candidate);
    const b = BODY_PREVIEW.load(source);
    await Promise.allSettled([a, b]);
    const d = BODY_PREVIEW.diagnostics();
    return { url: d.selectedUrl, clipNames: d.clipNames, sceneMeshes: d.sceneMeshes };
  });
  assert.equal(report.latestWins.url, "/characters/bodies/human-v1.glb");
  assert.deepEqual(report.latestWins.clipNames, []);

  phase = "failedLoad";
  const previous = await page.evaluate(() => {
    BODY_PREVIEW.setYaw(2.2);
    return BODY_PREVIEW.diagnostics();
  });
  report.failedLoad = await page.evaluate(async () => {
    const blob = new Blob([new Uint8Array([0, 1, 2, 3])], { type: "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    const before = BODY_PREVIEW.diagnostics();
    try {
      await BODY_PREVIEW.load(url);
      return { rejected: false, url: BODY_PREVIEW.diagnostics().selectedUrl };
    } catch (error) {
      const after = BODY_PREVIEW.diagnostics();
      return {
        rejected: true,
        message: error.message,
        url: after.selectedUrl,
        meshCount: after.meshCount,
        previousUrl: before.selectedUrl,
        clip: after.clip,
        time: after.time,
        yaw: after.yaw,
        clipNames: after.clipNames,
        paletteEqual: JSON.stringify(before.palette) === JSON.stringify(after.palette),
      };
    } finally {
      URL.revokeObjectURL(url);
    }
  });
  assert.equal(report.failedLoad.rejected, true);
  assert.equal(report.failedLoad.url, previous.selectedUrl);
  assert.ok(report.failedLoad.meshCount > 0);
  assert.equal(report.failedLoad.clip, previous.clip);
  assert.equal(report.failedLoad.yaw, previous.yaw);
  assert.deepEqual(report.failedLoad.clipNames, previous.clipNames);
  assert.equal(report.failedLoad.paletteEqual, true);

  phase = "final";
  await page.evaluate(() => {
    BODY_PREVIEW.setYaw(0);
    BODY_PREVIEW.view("front");
  });
  await page.waitForFunction(() => {
    const status = document.getElementById("status")?.textContent || "";
    return BODY_PREVIEW?.ready && status.includes(BODY_PREVIEW.selectedUrl) && !status.startsWith("Loading");
  });
  report.after = await page.evaluate(() => BODY_PREVIEW.diagnostics());
  report.statusText = await page.evaluate(() => document.getElementById("status")?.textContent);
  assert.ok(!report.statusText.includes("Loading"), report.statusText);
  const unexpected = unexpectedErrors();
  assert.equal(unexpected.length, 0, unexpected.map((e) => `[${e.phase}] ${e.text}`).join("\n"));
  report.consoleErrors = errors;
  report.ok = true;
} catch (error) {
  report.failure = error.stack;
  process.exitCode = 1;
} finally {
  report.errors = errors;
  await writeFile(path.join(out, "report.json"), JSON.stringify(report, null, 2));
  console.log(
      JSON.stringify(
        {
          ok: report.ok,
          out,
          failure: report.failure,
          animated: report.animated,
          animationMotionVerified: report.animationMotionVerified,
          clockAdvanced: report.clockAdvanced,
          fovDegrees: report.studio?.studio?.fovDegrees,
          canvas: report.studio?.studio?.canvas,
          skinLuminancePercent: report.skinLuminanceFront?.luminancePercent,
          fps: report.studio?.fpsMetrics?.fps,
          fpsSamples: report.studio?.fpsMetrics?.samples,
          lights: report.studio?.studio?.lights,
          keyElevationDeg: report.studio?.studio?.lights?.keyElevationDeg,
          fillFractions: report.views
            .filter((v) => v.viewParams?.fillFraction != null)
            .map((v) => ({ view: v.view, fillFraction: v.viewParams.fillFraction, measured: v.fillMeasure })),
          handsJointResolved: report.studio?.studio?.hands?.resolved,
          handsRadius: report.studio?.studio?.hands?.radius,
          handsMissingApi: report.studio?.studio?.hands?.missingApi,
          postPipeline: report.studio?.studio?.postPipeline,
        },
        null,
        2,
      ),
  );
  process.exit(process.exitCode || 0);
}
