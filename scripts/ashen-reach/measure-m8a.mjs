/**
 * M8a populated-scene cost. Pair with measure-m8a-naive.mjs's `before` row
 * for the delta of the townsfolk representation.
 *
 * Does not close the slot Chrome.
 */
import { chromium } from "playwright";
import { CDP_URL } from "../lib/cdp.mjs";
import fs from "node:fs/promises";

const seconds = Number(process.argv.find((a, i, all) => all[i - 1] === "--seconds") ?? "6") || 6;
const outDir = "ve-capture/ashen-reach/m8a";
const base =
  process.env.ASHEN_URL ||
  "http://127.0.0.1:5173/ashen-reach.html?play&clean";
const url = new URL(base);

const browser = await chromium.connectOverCDP(CDP_URL);
const context = browser.contexts()[0];
let page = context.pages().find((p) => p.url().includes("ashen-reach.html"));
if (!page) page = await context.newPage();
await page.setViewportSize({ width: 960, height: 540 });
await page.bringToFront();
await page.goto(url.toString(), { waitUntil: "commit" });
await page.waitForFunction(() => window.ASHEN?.ready, null, { timeout: 90000 });
await page.waitForTimeout(800);

await page.evaluate(() => {
  const A = window.ASHEN;
  const x = 0, z = 131;
  const y = A.world.groundHeight(x, z) + 1.7;
  A.player.setWorldPos(x, y, z);
  A.player.setFacing(0);
  A.rig.yaw = 0;
  A.rig.pitch = 0.1;
  A.rig.distance = A.rig.distanceTarget = 3.5;
  A.setView("play");
});
await page.waitForTimeout(4500);
await page.evaluate(() => ASHEN.metrics.reset?.());
await page.waitForTimeout(seconds * 1000);

const report = await page.evaluate(() => {
  const s = ASHEN.metrics.summary();
  const folk = (ASHEN.scene.meshes || []).filter((m) =>
    (m.name || "").startsWith("Townsfolk"),
  );
  const folkTris = folk.reduce((a, m) => {
    const n = m._gpu?.indexCount ?? m._cpuIndices?.length ?? 0;
    return a + n / 3;
  }, 0);
  return {
    fps: s.fps,
    meanMs: s.meanMs,
    medianMs: s.medianMs,
    p95Ms: s.p95Ms,
    p99Ms: s.p99Ms,
    worstMs: s.worstMs,
    minMs: s.minMs,
    samples: s.samples,
    drawCalls: s.drawCalls,
    worldTriangles: s.worldTriangles,
    sceneTriangles: s.sceneTriangles,
    drawnMeshes: s.drawnMeshes,
    hiddenMeshes: s.hiddenMeshes,
    totalMeshes: s.totalMeshes,
    resolution: s.resolution,
    viewport: s.viewport,
    dpr: s.dpr,
    vsyncCapped: s.vsyncCapped,
    capHz: s.capHz,
    capReason: s.capReason,
    enemies: ASHEN.combat.enemies?.length ?? 0,
    townsfolkMeshes: folk.map((m) => ({
      name: m.name,
      triangles: (m._gpu?.indexCount ?? 0) / 3,
      visible: m.visible !== false,
    })),
    townsfolkTriangles: folkTris,
  };
});

report.url = url.toString();
report.uncappedLaunch = process.env.ASHEN_UNCAPPED === "1";

await fs.mkdir(outDir, { recursive: true });
await fs.writeFile(`${outDir}/populated.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
process.exit(0);
