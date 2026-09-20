/**
 * M9 evidence stills. Does not close the slot Chrome.
 *
 *   export ASHEN_VITE_PORT=5273 ASHEN_CDP_PORT=9437
 *   export ASHEN_URL="http://127.0.0.1:5273/ashen-reach.html?play&clean"
 *   node scripts/ashen-reach/capture-m9.mjs
 */
import { chromium } from "playwright";
import { CDP_URL } from "../lib/cdp.mjs";
import fs from "node:fs/promises";

const url =
  process.env.ASHEN_URL ||
  "http://127.0.0.1:5273/ashen-reach.html?play&clean";
const dir = process.env.M9_CAPTURE_DIR || "ve-capture/ashen-reach/m9";
await fs.mkdir(dir, { recursive: true });

const browser = await chromium.connectOverCDP(CDP_URL);
const context = browser.contexts()[0];
let page = context.pages().find((p) => p.url().includes("ashen-reach.html"));
if (!page) page = await context.newPage();
await page.setViewportSize({ width: 1280, height: 720 });
await page.bringToFront();
await page.goto(url, { waitUntil: "commit" });
await page.waitForFunction(() => window.ASHEN?.ready, null, { timeout: 90000 });
await page.waitForTimeout(800);
await page.evaluate(() => ASHEN.setView("play"));

async function settle(ms = 500) {
  await page.waitForTimeout(ms);
}

function parkOthers(keepId) {
  return page.evaluate((id) => {
    for (const e of ASHEN.combat.enemies) {
      e.lockedState = "idle";
      e.state = "idle";
      e.idleFor = 99;
      e.hidden = false;
      e.actor?.setVisible(true);
      e.actor?.play("idle");
      if (e.id === id) continue;
      const z = e.zone === "town" ? 138 : 1;
      const x = e.zone === "town" ? -5 : -15;
      e.position.x = x;
      e.position.z = z;
      e.position.y = ASHEN.world.groundHeight(x, z);
      e.root.position.set(e.position.x, e.position.y, e.position.z);
    }
  }, keepId);
}

function flank(id, pxOff, pzOff, dist = 4.1, yawBias = -0.35) {
  return page.evaluate(
    ({ id, pxOff, pzOff, dist, yawBias }) => {
      const e = ASHEN.combat.enemies.find((x) => x.id === id);
      const x = e.position.x;
      const z = e.position.z;
      const px = x + pxOff;
      const pz = z + pzOff;
      const y =
        ASHEN.world.groundHeight(px, pz) + ASHEN.player.capsuleHeight / 2;
      ASHEN.player.setWorldPos(px, y, pz);
      const yaw = Math.atan2(x - px, z - pz);
      ASHEN.player.setFacing(yaw);
      e.yaw = yaw + Math.PI;
      ASHEN.rig.yaw = yaw + yawBias;
      ASHEN.rig.pitch = 0.08;
      ASHEN.rig.distance = ASHEN.rig.distanceTarget = dist;
      ASHEN.combat.targeting.select(e.id);
      ASHEN.setView("play");
    },
    { id, pxOff, pzOff, dist, yawBias },
  );
}

const metrics = await page.evaluate(() => {
  const s = ASHEN.metrics.summary();
  return {
    drawCalls: s.drawCalls,
    sceneTriangles: s.sceneTriangles,
    worldTriangles: s.worldTriangles,
    enemies: ASHEN.combat.enemies.map((e) => ({
      id: e.id,
      name: e.name,
      zone: e.zone,
      state: e.state,
      x: +e.position.x.toFixed(2),
      z: +e.position.z.toFixed(2),
      spawnZ: +e.spawn.z.toFixed(2),
      tint: e.actor ? undefined : null,
      bounds: e.bounds
        ? { zMin: e.bounds.zMin, zMax: e.bounds.zMax, xMin: e.bounds.xMin, xMax: e.bounds.xMax }
        : null,
    })),
    targeting: ASHEN.combat.targeting.list.map((t) => t.id),
    resolution: s.resolution,
    viewport: s.viewport,
  };
});
await fs.writeFile(`${dir}/metrics.json`, JSON.stringify(metrics, null, 2));
console.log(
  "metrics",
  metrics.drawCalls,
  "draws",
  metrics.sceneTriangles,
  "scene tris",
  metrics.enemies.length,
  "enemies",
);

// 1. Churchyard spawn — pixel comparison subject.
await page.evaluate(() => {
  for (const e of ASHEN.combat.enemies) {
    e.lockedState = "idle";
    e.state = "idle";
    e.idleFor = 99;
  }
  const y = ASHEN.world.groundHeight(0, 0) + ASHEN.player.capsuleHeight / 2;
  ASHEN.player.setWorldPos(0, y, 0);
  ASHEN.player.setFacing(0);
  ASHEN.rig.yaw = 0;
  ASHEN.rig.pitch = 0.04;
  ASHEN.rig.distance = ASHEN.rig.distanceTarget = 3.5;
  ASHEN.combat.targeting.clear();
  ASHEN.setView("play");
});
await settle(700);
await page.screenshot({ path: `${dir}/churchyard-spawn.png` });
console.log("wrote churchyard-spawn.png");

await page.reload({ waitUntil: "commit" });
await page.waitForFunction(() => window.ASHEN?.ready, null, { timeout: 90000 });
await settle(1500);
await page.evaluate(() => {
  for (const e of ASHEN.combat.enemies) {
    e.lockedState = "idle";
    e.state = "idle";
    e.idleFor = 99;
  }
  const y = ASHEN.world.groundHeight(0, 0) + ASHEN.player.capsuleHeight / 2;
  ASHEN.player.setWorldPos(0, y, 0);
  ASHEN.player.setFacing(0);
  ASHEN.rig.yaw = 0;
  ASHEN.rig.pitch = 0.04;
  ASHEN.rig.distance = ASHEN.rig.distanceTarget = 3.5;
  ASHEN.setView("play");
});
await settle(700);
await page.screenshot({ path: `${dir}/churchyard-spawn-reload.png` });
console.log("wrote churchyard-spawn-reload.png (same-code control)");

// 2. Churchyard shade still there, framed from a 3/4 flank.
await parkOthers("grave-shade-1");
await page.evaluate(() => {
  const e = ASHEN.combat.enemies.find((x) => x.id === "grave-shade-1");
  e.position.x = e.spawn.x;
  e.position.z = e.spawn.z;
  e.position.y = ASHEN.world.groundHeight(e.spawn.x, e.spawn.z);
  e.root.position.set(e.position.x, e.position.y, e.position.z);
  e.actor.play("idle");
});
await flank("grave-shade-1", 2.3, 1.5, 4.1, -0.4);
await settle(700);
await page.screenshot({ path: `${dir}/churchyard-shade.png` });
console.log("wrote churchyard-shade.png");

// 3. Town hostile on the street.
await parkOthers("town-wraith-1");
await page.evaluate(() => {
  const e = ASHEN.combat.enemies.find((x) => x.id === "town-wraith-1");
  e.position.x = e.spawn.x;
  e.position.z = e.spawn.z;
  e.position.y = ASHEN.world.groundHeight(e.spawn.x, e.spawn.z);
  e.root.position.set(e.position.x, e.position.y, e.position.z);
  e.actor.play("idle");
});
await flank("town-wraith-1", 2.4, 1.4, 4.2, -0.38);
await settle(700);
await page.screenshot({ path: `${dir}/town-street.png` });
console.log("wrote town-street.png");

// 4. Aggro on the walk to the well: stand south of the street wraith, let it chase, then flank.
await page.evaluate(() => {
  for (const e of ASHEN.combat.enemies) {
    e.lockedState = null;
    if (e.id !== "town-wraith-1") {
      e.lockedState = "idle";
      e.state = "idle";
      e.idleFor = 99;
    }
  }
  const e = ASHEN.combat.enemies.find((x) => x.id === "town-wraith-1");
  e.position.x = e.spawn.x;
  e.position.z = e.spawn.z;
  const px = e.position.x;
  const pz = e.position.z - 4.5;
  const y = ASHEN.world.groundHeight(px, pz) + ASHEN.player.capsuleHeight / 2;
  ASHEN.player.setWorldPos(px, y, pz);
  ASHEN.player.setFacing(0);
  ASHEN.rig.yaw = 0;
  ASHEN.rig.pitch = 0.08;
  ASHEN.rig.distance = ASHEN.rig.distanceTarget = 4.4;
  ASHEN.combat.targeting.select(e.id);
  ASHEN.setView("play");
});
await page.waitForFunction(
  () => {
    const e = ASHEN.combat.enemies.find((x) => x.id === "town-wraith-1");
    return e && (e.state === "chase" || e.state === "attack");
  },
  null,
  { timeout: 8000 },
);
await flank("town-wraith-1", -2.6, 1.2, 4.6, -0.5);
await settle(450);
await page.screenshot({ path: `${dir}/town-aggro.png` });
console.log("wrote town-aggro.png");

// 5. Townsfolk in frame, Tab selects the well haunt — not a market figure.
await parkOthers("town-wraith-3");
await page.evaluate(() => {
  const e = ASHEN.combat.enemies.find((x) => x.id === "town-wraith-3");
  e.position.x = e.spawn.x;
  e.position.z = e.spawn.z;
  e.position.y = ASHEN.world.groundHeight(e.spawn.x, e.spawn.z);
  e.root.position.set(e.position.x, e.position.y, e.position.z);
  e.actor.play("idle");
  const px = e.position.x + 2.6;
  const pz = e.position.z + 2.8;
  const y = ASHEN.world.groundHeight(px, pz) + ASHEN.player.capsuleHeight / 2;
  ASHEN.player.setWorldPos(px, y, pz);
  const yaw = Math.atan2(e.position.x - px, e.position.z - pz);
  ASHEN.player.setFacing(yaw);
  e.yaw = yaw + Math.PI;
  ASHEN.rig.yaw = yaw - 0.42;
  ASHEN.rig.pitch = 0.1;
  ASHEN.rig.distance = ASHEN.rig.distanceTarget = 5.4;
  ASHEN.combat.targeting.select(e.id);
  ASHEN.setView("play");
});
await settle(700);
await page.screenshot({ path: `${dir}/townsfolk-not-targeted.png` });
console.log("wrote townsfolk-not-targeted.png");

// 6. Well approach wide enough to read the haunt on the road.
await page.evaluate(() => {
  const e = ASHEN.combat.enemies.find((x) => x.id === "town-wraith-3");
  const px = 0.4;
  const pz = 118;
  const y = ASHEN.world.groundHeight(px, pz) + ASHEN.player.capsuleHeight / 2;
  ASHEN.player.setWorldPos(px, y, pz);
  ASHEN.player.setFacing(0.05);
  ASHEN.rig.yaw = 0.08;
  ASHEN.rig.pitch = 0.06;
  ASHEN.rig.distance = ASHEN.rig.distanceTarget = 5.2;
  ASHEN.combat.targeting.select(e.id);
  ASHEN.setView("play");
});
await settle(700);
await page.screenshot({ path: `${dir}/well-approach.png` });
console.log("wrote well-approach.png");

console.log("wrote screenshots to", dir);
process.exit(0);
