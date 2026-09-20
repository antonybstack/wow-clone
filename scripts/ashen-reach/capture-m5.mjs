import { chromium } from "playwright";
import { CDP_URL } from "../lib/cdp.mjs";
import fs from "node:fs/promises";

const url =
  process.env.ASHEN_URL ||
  "http://127.0.0.1:5173/ashen-reach.html?play&clean";
const dir = process.env.M5_CAPTURE_DIR || "ve-capture/ashen-reach/m5-progression";
await fs.mkdir(dir, { recursive: true });

const browser = await chromium.connectOverCDP(CDP_URL);
const page = browser.contexts()[0].pages().find((p) =>
  p.url().includes("ashen-reach.html"),
);
if (!page) throw new Error("No ashen-reach.html tab on " + CDP_URL);

async function clip(selector, file, pad = 12) {
  const box = await page.locator(selector).boundingBox();
  if (!box) throw new Error("missing " + selector);
  const clip = {
    x: Math.max(0, box.x - pad),
    y: Math.max(0, box.y - pad),
    width: box.width + pad * 2,
    height: box.height + pad * 2,
  };
  await page.screenshot({ path: `${dir}/${file}`, clip });
}

async function settle(ms = 400) {
  await page.waitForTimeout(ms);
}

try {
  await page.goto(url, { waitUntil: "commit" });
  await page.waitForFunction(() => window.ASHEN?.ready, null, {
    timeout: 90000,
  });
  await settle(500);

  const metrics = await page.evaluate(() => {
    ASHEN.setView("play");
    const s = ASHEN.metrics.summary();
    return {
      drawCalls: ASHEN.engine.drawCallCount,
      summaryDraws: s.drawCalls,
      triangles: s.triangles,
      resolution: s.resolution,
      batches: s.batches,
      note: "triangles count committed procedural batches, not GLB/skinned meshes",
    };
  });
  await fs.writeFile(`${dir}/metrics.json`, JSON.stringify(metrics, null, 2));
  console.log("draw calls", metrics.drawCalls, "tris", metrics.triangles);

  await page.evaluate(() => {
    const y = ASHEN.world.groundHeight(0, 0) + ASHEN.player.capsuleHeight / 2;
    ASHEN.player.setWorldPos(0, y, 0);
    ASHEN.player.setFacing(0);
    ASHEN.rig.yaw = 0.15;
    ASHEN.rig.pitch = 0.18;
    ASHEN.rig.distance = ASHEN.rig.distanceTarget = 5.4;
    ASHEN.combat.life.hp = 62;
    ASHEN.player.hp = 62;
    ASHEN.combat.progress.mana = 55;
    ASHEN.combat.progress.xp = 40;
    ASHEN.combat.life.inCombat = true;
    ASHEN.combat.life.combatUntil = ASHEN.combat.life.time + 30;
    for (const e of ASHEN.combat.enemies) {
      e.lockedState = "idle";
      e.state = "idle";
      e.idleFor = 99;
    }
    ASHEN.setView("play");
  });
  await settle(700);
  await page.screenshot({ path: `${dir}/hud.png` });
  await clip(".player-plate", "hud-plate.png", 16);
  await clip(".xp-plate", "hud-xp.png", 12);
  await clip(".minimap", "minimap-churchyard-clip.png", 10);
  console.log("wrote hud.png");

  await page.evaluate(() => {
    const e = ASHEN.combat.enemies[0];
    const y =
      ASHEN.world.groundHeight(e.position.x, e.position.z) +
      ASHEN.player.capsuleHeight / 2;
    ASHEN.player.setWorldPos(e.position.x, y, e.position.z + 3);
    ASHEN.player.setFacing(Math.PI);
    ASHEN.rig.yaw = Math.PI;
    ASHEN.rig.pitch = 0.12;
    ASHEN.rig.distance = ASHEN.rig.distanceTarget = 4.8;
    ASHEN.combat.targeting.select(e.id);
    ASHEN.combat.progress.xp = ASHEN.combat.progress.xpToNext - 1;
    ASHEN.combat.progress.mana = ASHEN.combat.progress.manaMax;
    e.hp = 30;
    ASHEN.setView("play");
  });
  await settle(200);
  await page.keyboard.press("Digit1");
  await page.waitForFunction(() => ASHEN.combat.progress.level >= 2, null, {
    timeout: 6000,
  });
  await settle(250);
  await page.screenshot({ path: `${dir}/level-up-live.png` });
  await clip(".level-up", "level-up-banner.png", 24);
  await clip(".player-plate", "level-up-plate.png", 16);
  console.log("wrote level-up-live.png");

  await page.evaluate(() => {
    const y = ASHEN.world.groundHeight(0, 0) + ASHEN.player.capsuleHeight / 2;
    ASHEN.player.setWorldPos(0, y, 0);
    ASHEN.player.setFacing(0.4);
    ASHEN.rig.yaw = 0.4;
    ASHEN.rig.pitch = 0.22;
    ASHEN.rig.distance = ASHEN.rig.distanceTarget = 6;
    ASHEN.setView("play");
  });
  await settle(400);
  await page.screenshot({ path: `${dir}/minimap-churchyard.png` });
  await clip(".minimap", "minimap-churchyard-close.png", 8);

  await page.evaluate(() => {
    const z = 110;
    const y = ASHEN.world.groundHeight(0, z) + ASHEN.player.capsuleHeight / 2;
    ASHEN.player.setWorldPos(0, y, z);
    ASHEN.player.setFacing(0);
    ASHEN.rig.yaw = 0;
    ASHEN.rig.pitch = 0.2;
    ASHEN.rig.distance = ASHEN.rig.distanceTarget = 8;
    ASHEN.setView("play");
  });
  await settle(500);
  await page.screenshot({ path: `${dir}/minimap-town.png` });
  await clip(".minimap", "minimap-town-close.png", 8);
  console.log("wrote minimap-town.png");
} finally {
  await browser.close();
}
