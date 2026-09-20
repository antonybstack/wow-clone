/**
 * M8a evidence stills. Does not close the slot Chrome.
 *
 *   export ASHEN_VITE_PORT=5273 ASHEN_CDP_PORT=9437
 *   export ASHEN_URL="http://127.0.0.1:5273/ashen-reach.html?play&clean"
 *   node scripts/ashen-reach/capture-m8a.mjs [tag]
 */
import { chromium } from "playwright";
import { CDP_URL } from "../lib/cdp.mjs";
import fs from "node:fs/promises";

const tag = process.argv[2] || "after";
const outDir = `ve-capture/ashen-reach/m8a/${tag}`;
await fs.mkdir(outDir, { recursive: true });

const browser = await chromium.connectOverCDP(CDP_URL);
const context = browser.contexts()[0];
let page = context.pages().find((p) => p.url().includes("ashen-reach.html"));
if (!page) page = await context.newPage();
await page.setViewportSize({ width: 960, height: 540 });
await page.bringToFront();
const base =
  process.env.ASHEN_URL || "http://127.0.0.1:5173/ashen-reach.html?play&clean";
const url = new URL(base);
url.searchParams.set("noEnemies", "");
if (tag === "before") url.searchParams.set("noTownsfolk", "");
await page.goto(url.toString(), { waitUntil: "commit" });
await page.waitForFunction(() => window.ASHEN?.ready, null, { timeout: 60000 });
await page.waitForTimeout(1500);

async function shootAt({ name, x, z, yaw, pitch, dist }) {
  await page.evaluate(
    ({ x, z, yaw, pitch, dist }) => {
      const A = window.ASHEN;
      const y = A.world.groundHeight(x, z) + 1.7;
      A.player.setWorldPos(x, y, z);
      A.player.setFacing(yaw);
      A.rig.yaw = yaw;
      A.rig.pitch = pitch;
      A.rig.distance = A.rig.distanceTarget = dist;
      A.setView("play");
    },
    { x, z, yaw, pitch, dist },
  );
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${outDir}/${name}.png` });
}

const shots = [
  {
    name: "churchyard-spawn",
    x: 0,
    z: 0,
    yaw: 0,
    pitch: 0.04,
    dist: 3.5,
  },
  {
    name: "well-square",
    x: 0,
    z: 131,
    yaw: 0,
    pitch: 0.1,
    dist: 3.5,
  },
  {
    name: "stall-close",
    x: 0.4,
    z: 133.3,
    yaw: -1.32,
    pitch: 0.05,
    dist: 3.2,
  },
  {
    name: "tavern-front",
    x: -4.2,
    z: 96.5,
    yaw: -1.15,
    pitch: 0.06,
    dist: 3.4,
  },
  {
    name: "street-people",
    x: 0,
    z: 86,
    yaw: 0.08,
    pitch: 0.04,
    dist: 3.5,
  },
  {
    name: "watchman-gate",
    x: 0,
    z: 72.2,
    yaw: 0.22,
    pitch: 0.08,
    dist: 3.8,
  },
  {
    name: "wide-town",
    x: 0,
    z: 100,
    yaw: 0.35,
    pitch: 0.85,
    dist: 24,
  },
];

for (const s of shots) await shootAt(s);

if (tag !== "before") {
  await page.reload({ waitUntil: "commit" });
  await page.waitForFunction(() => window.ASHEN?.ready, null, { timeout: 60000 });
  await page.waitForTimeout(1500);
  await shootAt({
    name: "churchyard-spawn-reload",
    x: 0,
    z: 0,
    yaw: 0,
    pitch: 0.04,
    dist: 3.5,
  });
}

console.log("done:", tag, outDir);
process.exit(0);
