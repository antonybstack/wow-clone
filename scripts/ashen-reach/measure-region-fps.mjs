/** Run alone on an uncapped harness. No capture/profiling during frame sampling. */
import { chromium } from "playwright";
import fs from "node:fs/promises";
import os from "node:os";
import assert from "node:assert/strict";
import { CDP_URL } from "../lib/cdp.mjs";
import { summarizeDurations } from "../../src/ashen-reach/metrics.js";
const file = process.argv[2];
assert(file, "Specify report.json");
const url = new URL(
  process.env.ASHEN_TEST_URL || "http://127.0.0.1:7074/?play&clean",
);
for (const [k, v] of [
  ["pixelRatio", "1"],
  ["gpuTiming", ""],
])
  url.searchParams.set(k, v);
const runs = Number(process.env.ASHEN_FPS_RUNS || 3),
  seconds = 12;
const browser = await chromium.connectOverCDP(CDP_URL),
  context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 1,
  }),
  page = await context.newPage();
const report = {
  conditions: {
    cpu: os.cpus()[0].model,
    url: url.href,
    viewport: [1280, 720],
    seconds,
    runs,
    uncappedRequired: true,
    recording: false,
  },
  rows: [],
  errors: [],
};
page.on("pageerror", (e) => report.errors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") report.errors.push(m.text());
});
try {
  await page.goto(url.href);
  await page.waitForFunction(() => globalThis.ASHEN?.ready, null, {
    timeout: 90000,
  });
  await page.evaluate(() => {
    ASHEN.dev.god = true;
    ASHEN.setView("play");
  });
  for (const [route, x, z, yaw] of [
    ["meadow", 0, -65, 0],
    ["town", 0, 80, 0],
    ["bridge", 0, 210, 0],
    ["cathedral", 0, 280, 0],
    ["forest", -80, 180, -Math.PI / 2],
  ])
    for (let run = 1; run <= runs; run++) {
      await page.evaluate(
        ({ x, z, yaw }) => {
          const a = ASHEN,
            k = a.world.cathedral,
            y =
              x === 0 && z >= k.route.start[2]
                ? k.route.heightAt(z)
                : a.world.groundHeight(x, z);
          a.player.setFlying(false);
          a.player.setWorldPos(x, y + 1.7, z);
          a.player.setFacing(yaw);
          a.rig.yaw = yaw;
          a.rig.pitch = -0.16;
          a.rig.distance = a.rig.distanceTarget = 4;
        },
        { x, z, yaw },
      );
      await page.waitForTimeout(1200);
      await page.keyboard.down("KeyW");
      await page.waitForTimeout(800);
      const before = await page.evaluate(() => {
        ASHEN.metrics.reset();
        ASHEN.renderLoop.beginMeasurement();
        return {
          x: ASHEN.player.body.position.x,
          z: ASHEN.player.body.position.z,
          recoveries: ASHEN.player.getDebugState().recoveries,
        };
      });
      await page.waitForTimeout(seconds * 1000);
      const row = await page.evaluate(() => ({
        frames: ASHEN.renderLoop.endMeasurement(),
        summary: ASHEN.metrics.summary(),
        x: ASHEN.player.body.position.x,
        z: ASHEN.player.body.position.z,
        recoveries: ASHEN.player.getDebugState().recoveries,
        enemies: ASHEN.combat.enemies.length,
        physics: ASHEN.player.getDebugState().usingPhysics,
      }));
      await page.keyboard.up("KeyW");
      Object.assign(row, {
        route,
        run,
        before,
        fullWindow: summarizeDurations(row.frames),
      });
      delete row.frames;
      report.rows.push(row);
      await fs.writeFile(file, JSON.stringify(report, null, 2));
      assert(row.physics);
      assert.equal(row.enemies, 7);
      assert.equal(row.recoveries, before.recoveries);
      assert.deepEqual(row.summary.resolution, [1280, 720]);
      assert(!row.summary.vsyncCapped);
      assert(Math.hypot(row.x - before.x, row.z - before.z) > 10);
      console.log(
        JSON.stringify({
          route,
          run,
          ...row.fullWindow,
          gpuMeanMs: row.summary.gpuMeanMs,
        }),
      );
    }
  assert.deepEqual(report.errors, []);
} finally {
  await page.keyboard.up("KeyW").catch(() => {});
  await fs.writeFile(file, JSON.stringify(report, null, 2));
  await context.close();
  await browser.close();
}
