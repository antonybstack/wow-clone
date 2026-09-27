/** Fresh-process playable/input measurement; no settled FPS claim.
 * CDP throttling: https://chromedevtools.github.io/devtools-protocol/tot/Network/#method-emulateNetworkConditions
 * Each run starts with an empty browser cache. OS/CDN/driver caches are not cleared.
 */
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import assert from "node:assert/strict";
import { chromium } from "playwright";
const destination = process.argv[2];
assert(destination, "Specify report.json");
const runs = Number(process.env.ASHEN_PROBE_RUNS || 5),
  profile = process.env.ASHEN_PROBE_PROFILE || "50mbps";
assert(Number.isInteger(runs) && runs > 0 && runs <= 30);
const conditions = {
  native: { latency: 0, downloadThroughput: -1, uploadThroughput: -1 },
  "50mbps": {
    latency: 40,
    downloadThroughput: 50e6 / 8,
    uploadThroughput: 10e6 / 8,
  },
  "10mbps": {
    latency: 80,
    downloadThroughput: 10e6 / 8,
    uploadThroughput: 2e6 / 8,
  },
};
assert(conditions[profile]);
const target = new URL(process.env.ASHEN_TEST_URL || "http://127.0.0.1:7074/");
target.searchParams.set("play", "");
target.searchParams.set("pixelRatio", "1");
const report = {
  conditions: {
    profile,
    network: conditions[profile],
    cpu: os.cpus()[0]?.model,
    viewport: [1280, 720],
    cache:
      "Fresh browser process/profile each run; OS and GPU-driver caches uncontrolled",
    timing:
      "Navigation start to grounded, dressed, GPU-completed frame with overlay removed and input enabled",
  },
  rows: [],
};
await fs.mkdir(path.dirname(destination), { recursive: true });
for (let run = 1; run <= runs; run++) {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    const context = await browser.newContext({
        viewport: { width: 1280, height: 720 },
        deviceScaleFactor: 1,
        serviceWorkers: "block",
      }),
      page = await context.newPage(),
      errors = [],
      requests = new Map();
    const cdp = await context.newCDPSession(page);
    await cdp.send("Network.enable");
    await cdp.send("Network.emulateNetworkConditions", {
      offline: false,
      ...conditions[profile],
    });
    await page.addInitScript(() => {
      window.__loadGpuErrors = [];
      window.__loadTasks = [];
      new PerformanceObserver((list) =>
        window.__loadTasks.push(
          ...list
            .getEntries()
            .map((e) => ({ start: e.startTime, duration: e.duration })),
        ),
      ).observe({ type: "longtask", buffered: true });
      const original = GPUAdapter.prototype.requestDevice;
      GPUAdapter.prototype.requestDevice = async function (...args) {
        const device = await original.apply(this, args);
        device.addEventListener("uncapturederror", (e) =>
          window.__loadGpuErrors.push(e.error.message),
        );
        return device;
      };
      addEventListener("keydown", (e) => {
        if (e.code === "KeyW") window.__loadKeyAt = performance.now();
      });
    });
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    let clockOffset;
    cdp.on("Network.requestWillBeSent", (e) => {
      clockOffset ??= e.wallTime - e.timestamp;
      requests.set(e.requestId, {
        url: e.request.url,
        start: e.timestamp,
        chunks: [],
      });
    });
    cdp.on("Network.dataReceived", (e) =>
      requests
        .get(e.requestId)
        ?.chunks.push({ at: e.timestamp, bytes: e.encodedDataLength }),
    );
    cdp.on("Network.loadingFinished", (e) => {
      const r = requests.get(e.requestId);
      if (r) Object.assign(r, { end: e.timestamp, bytes: e.encodedDataLength });
    });
    await page.goto(target.href, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => globalThis.ASHEN?.playableReady, null, {
      timeout: 30000,
    });
    const row = await page.evaluate(() => ({
      origin: performance.timeOrigin,
      marks: ASHEN.startup.timings(),
      playableMs: ASHEN.startup.timings().playable,
      grounded: ASHEN.player.getGrounded(),
      physics: ASHEN.player.getDebugState().usingPhysics,
      loader: !!document.getElementById("loading"),
      canvas: [
        document.getElementById("renderCanvas").width,
        document.getElementById("renderCanvas").height,
      ],
      position: {
        x: ASHEN.player.body.position.x,
        z: ASHEN.player.body.position.z,
      },
      frame: ASHEN.gpu.frames,
      gpuErrors: window.__loadGpuErrors,
      tasks: window.__loadTasks,
    }));
    const boundary = row.origin / 1000 - clockOffset + row.playableMs / 1000;
    row.requests = [...requests.values()]
      .filter((r) => r.start <= boundary)
      .map((r) => ({
        url: r.url,
        complete: r.end <= boundary,
        encodedBytesAtBoundary:
          r.end <= boundary
            ? r.bytes
            : r.chunks
                .filter((c) => c.at <= boundary)
                .reduce((n, c) => n + c.bytes, 0),
      }));
    row.encodedBytesAtBoundary = row.requests.reduce(
      (n, r) => n + r.encodedBytesAtBoundary,
      0,
    );
    await page.screenshot({
      path: destination.replace(/\.json$/, `-${run}.png`),
    });
    await page.keyboard.down("KeyW");
    await page.waitForFunction(
      ({ position, frame }) =>
        Math.hypot(
          ASHEN.player.body.position.x - position.x,
          ASHEN.player.body.position.z - position.z,
        ) > 0.03 && ASHEN.gpu.frames > frame + 1,
      row,
      { timeout: 2000 },
    );
    // Fence the frame that follows observed displacement, not just submission.
    await page.evaluate(async () => {
      await ASHEN.whenNextGpuFrame();
    });
    row.input = await page.evaluate(() => ({
      keyAt: window.__loadKeyAt,
      observedAt: performance.now(),
      position: {
        x: ASHEN.player.body.position.x,
        z: ASHEN.player.body.position.z,
      },
      frames: ASHEN.gpu.frames,
      gpuErrors: window.__loadGpuErrors,
    }));
    await page.keyboard.up("KeyW");
    row.input.responseUpperBoundMs = row.input.observedAt - row.input.keyAt;
    row.errors = errors;
    row.run = run;
    report.rows.push(row);
    await fs.writeFile(destination, JSON.stringify(report, null, 2));
    assert(row.grounded && row.physics && !row.loader);
    assert(row.marks['supported-frame-submitted'] >= row.marks['equipment-end']);
    assert(row.marks['supported-frame-completed'] >= row.marks['supported-frame-submitted']);
    assert(row.playableMs >= row.marks['supported-frame-completed']);
    assert.deepEqual(row.canvas, [1280, 720]);
    assert.deepEqual(errors, []);
    assert.deepEqual(row.input.gpuErrors, []);
    console.log(
      JSON.stringify({
        run,
        playableMs: row.playableMs,
        inputMs: row.input.responseUpperBoundMs,
        bytes: row.encodedBytesAtBoundary,
      }),
    );
  } finally {
    await browser.close();
  }
}
