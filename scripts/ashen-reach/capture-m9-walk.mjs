/**
 * Walk from the town gate toward the well under KeyW and capture the first
 * town aggro. Does not close the slot Chrome.
 */
import { chromium } from "playwright";
import { CDP_URL } from "../lib/cdp.mjs";
import fs from "node:fs/promises";

const url =
  process.env.ASHEN_URL ||
  "http://127.0.0.1:5273/ashen-reach.html?play&clean";
const dir = process.env.M9_CAPTURE_DIR || "ve-capture/ashen-reach/m9/walk";
await fs.mkdir(dir, { recursive: true });

const browser = await chromium.connectOverCDP(CDP_URL);
const context = browser.contexts()[0];
let page = context.pages().find((p) => p.url().includes("ashen-reach.html"));
if (!page) page = await context.newPage();
await page.setViewportSize({ width: 960, height: 540 });
await page.bringToFront();
await page.goto(url, { waitUntil: "commit" });
await page.waitForFunction(() => window.ASHEN?.ready, null, { timeout: 90000 });
await page.waitForTimeout(800);

await page.evaluate(() => {
  const A = window.ASHEN;
  A.setView("play");
  const z = 70;
  const x = 0;
  const y = A.world.groundHeight(x, z) + A.player.capsuleHeight / 2;
  A.player.setWorldPos(x, y, z);
  A.player.setFacing(0);
  A.rig.yaw = 0;
  A.rig.pitch = 0.06;
  A.rig.distance = A.rig.distanceTarget = 3.8;
});
await page.waitForTimeout(400);

const log = [];
await page.keyboard.down("KeyW");
let aggroShot = false;
for (let t = 1; t <= 18; t++) {
  await page.waitForTimeout(1000);
  const snap = await page.evaluate(() => {
    const p = ASHEN.player.body.position;
    const town = ASHEN.combat.enemies
      .filter((e) => e.zone === "town")
      .map((e) => ({
        id: e.id,
        name: e.name,
        state: e.state,
        z: +e.position.z.toFixed(2),
      }));
    return {
      x: +p.x.toFixed(2),
      y: +p.y.toFixed(2),
      z: +p.z.toFixed(2),
      town,
      aggro: town.filter((e) => e.state === "chase" || e.state === "attack"),
    };
  });
  log.push({ t, ...snap });
  await page.screenshot({
    path: `${dir}/t${String(t).padStart(2, "0")}-z${Math.round(snap.z)}.png`,
  });
  if (!aggroShot && snap.aggro.length) {
    aggroShot = true;
    await page.screenshot({ path: `${dir}/first-aggro.png` });
    console.log("first aggro at t", t, "z", snap.z, snap.aggro);
  }
  if (snap.z > 134) break;
}
await page.keyboard.up("KeyW");

await fs.writeFile(`${dir}/walk-log.json`, JSON.stringify({ log, aggroShot }, null, 2));
console.log(JSON.stringify({ final: log.at(-1), aggroShot, samples: log.length }, null, 2));
process.exit(0);
