/**
 * M10 evidence stills. Does not close the slot Chrome.
 *
 *   export ASHEN_VITE_PORT=5373 ASHEN_CDP_PORT=9537
 *   export ASHEN_URL="http://127.0.0.1:5373/ashen-reach.html?play&clean"
 *   node scripts/ashen-reach/capture-m10.mjs
 */
import { chromium } from "playwright";
import { CDP_URL } from "../lib/cdp.mjs";
import fs from "node:fs/promises";

const dir = process.env.M10_CAPTURE_DIR || "ve-capture/ashen-reach/m10-objective";
await fs.mkdir(dir, { recursive: true });

const browser = await chromium.connectOverCDP(CDP_URL);
const context = browser.contexts()[0];
let page = context.pages().find((p) => p.url().includes("ashen-reach.html"));
if (!page) page = await context.newPage();
await page.setViewportSize({ width: 960, height: 540 });
await page.bringToFront();
const url =
  process.env.ASHEN_URL || "http://127.0.0.1:5373/ashen-reach.html?play&clean";
await page.goto(url, { waitUntil: "commit" });
await page.waitForFunction(() => window.ASHEN?.ready, null, { timeout: 90000 });
await page.waitForTimeout(700);

const IDS = [
  "grave-shade-1",
  "grave-shade-2",
  "grave-shade-3",
  "grave-shade-4",
];

async function clip(selector, file, pad = 12) {
  const loc = page.locator(selector);
  const box = await loc.boundingBox();
  if (!box) throw new Error("missing " + selector);
  await page.screenshot({
    path: `${dir}/${file}`,
    clip: {
      x: Math.max(0, box.x - pad),
      y: Math.max(0, box.y - pad),
      width: box.width + pad * 2,
      height: Math.max(28, box.height + pad * 2),
    },
  });
}

async function plant(x, z, yaw, pitch = 0.08, dist = 3.8) {
  await page.evaluate(
    ({ x, z, yaw, pitch, dist }) => {
      const y =
        ASHEN.world.groundHeight(x, z) + ASHEN.player.capsuleHeight / 2;
      ASHEN.player.setWorldPos(x, y, z);
      ASHEN.player.setFacing(yaw);
      ASHEN.rig.yaw = yaw;
      ASHEN.rig.pitch = pitch;
      ASHEN.rig.distance = ASHEN.rig.distanceTarget = dist;
      ASHEN.setView("play");
    },
    { x, z, yaw, pitch, dist },
  );
  await page.waitForTimeout(280);
}

const metrics = await page.evaluate(() => {
  ASHEN.setView("play");
  const s = ASHEN.metrics.summary();
  return {
    drawCalls: ASHEN.engine.drawCallCount,
    summaryDraws: s.drawCalls,
    worldTriangles: s.worldTriangles ?? s.triangles,
    sceneTriangles: s.sceneTriangles,
    resolution: s.resolution,
    batches: s.batches,
  };
});
await fs.writeFile(`${dir}/metrics.json`, JSON.stringify(metrics, null, 2));
console.log(
  "draws",
  metrics.drawCalls,
  "worldTris",
  metrics.worldTriangles,
  "sceneTris",
  metrics.sceneTriangles,
);

const watchman = await page.evaluate(
  () => ASHEN.combat.objective.snapshot().watchman,
);
await plant(watchman.x - 1.8, watchman.z - 4.2, Math.atan2(1.8, 4.2), 0.08, 3.8);
await page.waitForFunction(
  () => ASHEN.combat.objective.snapshot().phase === "active",
  null,
  { timeout: 4000 },
);
await page.waitForTimeout(200);
await page.screenshot({ path: `${dir}/prompt-gate.png` });
await clip(".combat-error", "prompt-hud.png", 18);
console.log("wrote prompt-gate.png");

await page.evaluate((ids) => {
  for (const e of ASHEN.combat.enemies) {
    if (ids.includes(e.id)) {
      e.lockedState = "idle";
      e.state = "idle";
      e.idleFor = 99;
    }
  }
  const a = ASHEN.combat.enemies.find((e) => e.id === ids[0]);
  const b = ASHEN.combat.enemies.find((e) => e.id === ids[1]);
  if (a) a.hp = 0;
  if (b) b.hp = 0;
}, IDS);
await page.waitForFunction(
  () => ASHEN.combat.objective.snapshot().killed.length >= 2,
  null,
  { timeout: 4000 },
);

await page.evaluate(() => {
  const e = ASHEN.combat.enemies.find((x) => x.id === "grave-shade-3");
  if (!e) return;
  const x = e.position.x + 2.2;
  const z = e.position.z + 0.5;
  const y = ASHEN.world.groundHeight(x, z) + ASHEN.player.capsuleHeight / 2;
  ASHEN.player.setWorldPos(x, y, z);
  const yaw = Math.atan2(e.position.x - x, e.position.z - z);
  ASHEN.player.setFacing(yaw);
  e.yaw = yaw + Math.PI;
  e.lockedState = "idle";
  e.state = "idle";
  e.idleFor = 99;
  ASHEN.rig.yaw = yaw - 0.35;
  ASHEN.rig.pitch = 0.08;
  ASHEN.rig.distance = ASHEN.rig.distanceTarget = 4.1;
  ASHEN.combat.targeting.select(e.id);
  ASHEN.setView("play");
});
await page.waitForFunction(
  () => document.querySelector(".level-up")?.hidden !== false,
  null,
  { timeout: 4000 },
).catch(() => {});
await page.waitForTimeout(200);
await page.screenshot({ path: `${dir}/mid-clear.png` });
await clip(".combat-error", "mid-clear-hud.png", 18);
console.log("wrote mid-clear.png");

await page.evaluate((ids) => {
  for (const e of ASHEN.combat.enemies) {
    if (ids.includes(e.id)) e.hp = 0;
  }
}, IDS.slice(2));
await page.waitForFunction(
  () => ASHEN.combat.objective.snapshot().phase === "done",
  null,
  { timeout: 4000 },
);
await page.waitForTimeout(220);
await page.screenshot({ path: `${dir}/complete.png` });
await clip(".combat-error", "complete-hud.png", 18);
console.log("wrote complete.png");

const state = await page.evaluate(() => ({
  objective: ASHEN.combat.objective.snapshot(),
  message: document.querySelector(".combat-error")?.textContent || "",
  progress: ASHEN.combat.snapshot().progress,
  enemies: ASHEN.combat.snapshot().enemies.map((e) => ({
    id: e.id,
    hp: e.hp,
    state: e.state,
  })),
  metrics: ASHEN.metrics.summary(),
}));
await fs.writeFile(`${dir}/capture.json`, JSON.stringify(state, null, 2));
console.log("capture state", state.objective.phase, state.message);
await browser.close();
