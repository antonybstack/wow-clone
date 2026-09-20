import { chromium } from "playwright";
import { CDP_URL } from "../lib/cdp.mjs";
import fs from "node:fs/promises";

const url =
  process.env.ASHEN_URL ||
  "http://127.0.0.1:5173/ashen-reach.html?play&clean";
const dir = process.env.M4_CAPTURE_DIR || "ve-capture/ashen-reach/m4-combat";
await fs.mkdir(dir, { recursive: true });

const browser = await chromium.connectOverCDP(CDP_URL);
const page = browser.contexts()[0].pages().find((p) =>
  p.url().includes("ashen-reach.html"),
);

async function frame(id, back = 4.4) {
  await page.evaluate(
    ({ id, back }) => {
      const e = ASHEN.combat.enemies.find((x) => x.id === id);
      const x = e.position.x;
      const z = e.position.z - back;
      const y =
        ASHEN.world.groundHeight(x, z) + ASHEN.player.capsuleHeight / 2;
      ASHEN.player.setWorldPos(x, y, z);
      ASHEN.player.setFacing(0);
      ASHEN.rig.yaw = 0;
      ASHEN.rig.pitch = 0.12;
      ASHEN.rig.distance = ASHEN.rig.distanceTarget = 4.1;
      ASHEN.combat.targeting.select(e.id);
      ASHEN.setView("play");
    },
    { id, back },
  );
  await page.waitForTimeout(350);
}

try {
  await page.bringToFront();
  await page.goto(url, { waitUntil: "commit" });
  await page.waitForFunction(() => window.ASHEN?.ready, null, {
    timeout: 60000,
  });
  await page.waitForTimeout(600);
  const id = await page.evaluate(() => ASHEN.combat.enemies[2].id);

  await frame(id, 4.6);
  await page.waitForFunction(
    (eid) => {
      const e = ASHEN.combat.enemies.find((x) => x.id === eid);
      return e && (e.state === "chase" || e.state === "attack");
    },
    id,
    { timeout: 8000 },
  );
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${dir}/aggro.png` });

  await page.waitForFunction(
    (eid) => ASHEN.combat.enemies.find((x) => x.id === eid)?.hitsLanded > 0,
    id,
    { timeout: 8000 },
  );
  await frame(id, 3.6);
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${dir}/melee.png` });
  await page.screenshot({ path: `${dir}/hud.png` });

  await page.evaluate((eid) => {
    const e = ASHEN.combat.enemies.find((x) => x.id === eid);
    e.hp = 40;
  }, id);
  await page.keyboard.press("Digit1");
  await page.waitForFunction(
    (eid) => ASHEN.combat.enemies.find((x) => x.id === eid)?.state === "dead",
    id,
    { timeout: 4000 },
  );
  await page.waitForTimeout(280);
  await page.screenshot({ path: `${dir}/enemy-death.png` });

  await page.waitForFunction(
    (eid) => {
      const e = ASHEN.combat.enemies.find((x) => x.id === eid);
      return e && e.state !== "dead" && e.hp === e.hpMax;
    },
    id,
    { timeout: 12000 },
  );
  await frame(id, 4.6);
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${dir}/respawn.png` });

  await page.evaluate(() => {
    const e = ASHEN.combat.enemies[2];
    const x = e.position.x;
    const z = e.position.z - 1.7;
    const y =
      ASHEN.world.groundHeight(x, z) + ASHEN.player.capsuleHeight / 2;
    ASHEN.player.setWorldPos(x, y, z);
    ASHEN.player.setFacing(0);
    ASHEN.rig.yaw = 0;
    ASHEN.combat.life.hp = 16;
    ASHEN.player.hp = 16;
  });
  await page.waitForFunction(() => ASHEN.combat.life.dead, null, {
    timeout: 10000,
  });
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${dir}/player-death.png` });

  await page.locator(".death-veil button").click();
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    ASHEN.player.setFacing(0);
    ASHEN.rig.yaw = 0;
    ASHEN.rig.pitch = 0.08;
    ASHEN.rig.distance = ASHEN.rig.distanceTarget = 3.6;
    ASHEN.setView("play");
  });
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${dir}/player-resurrect.png` });
  console.log("wrote screenshots to", dir);
} finally {
  await browser.close();
}
