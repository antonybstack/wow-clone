import { chromium } from "playwright";
import { CDP_URL } from "../lib/cdp.mjs";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const url =
  process.env.ASHEN_URL ||
  "http://127.0.0.1:5173/ashen-reach.html?play&clean";
const dir = process.env.M4B_CAPTURE_DIR || "ve-capture/ashen-reach/m4b";
await fs.mkdir(dir, { recursive: true });

const browser = await chromium.connectOverCDP(CDP_URL);
const page = browser.contexts()[0].pages().find((p) =>
  p.url().includes("ashen-reach.html"),
);
const errors = [];
const checks = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
const check = (name, ok) => {
  assert.ok(ok, name);
  checks.push(name);
  console.log("PASS", name);
};

const read = () =>
  page.evaluate(() => {
    const e = ASHEN.combat.enemies.find((x) => x.id === "grave-shade-2")
      || ASHEN.combat.enemies[1];
    return {
      dummyHp: ASHEN.combat.dummy.hp,
      lavaCasts: ASHEN.combat.lava.casts,
      fireCasts: ASHEN.combat.spell.casts,
      lastLava: ASHEN.combat.lava.lastResult,
      lastFire: ASHEN.combat.spell.lastResult,
      flight: !!ASHEN.combat.lava.flight,
      pending: ASHEN.combat.pendingSpell,
      enemy: {
        id: e.id,
        hp: e.hp,
        state: e.state,
        x: e.position.x,
        z: e.position.z,
      },
    };
  });

try {
  await page.goto(url, { waitUntil: "commit" });
  await page.waitForFunction(() => window.ASHEN?.ready, null, {
    timeout: 60000,
  });
  await page.waitForTimeout(500);
  await page.evaluate(() => ASHEN.setView("play"));

  await page.evaluate(() => {
    const e = ASHEN.combat.enemies.find((x) => x.id === "grave-shade-2")
      || ASHEN.combat.enemies[1];
    e.lockedState = "idle";
    e.state = "idle";
    e.idleFor = 99;
    e.position.x = 0;
    e.position.z = 22;
    const y = ASHEN.world.groundHeight(0, 12) + ASHEN.player.capsuleHeight / 2;
    ASHEN.player.setWorldPos(0, y, 12);
    ASHEN.player.setFacing(0);
    ASHEN.rig.yaw = 0;
    ASHEN.rig.pitch = 0.1;
    ASHEN.rig.distance = ASHEN.rig.distanceTarget = 5.2;
    ASHEN.combat.targeting.select(e.id);
  });
  await page.waitForTimeout(300);

  const beforeFire = await read();
  await page.evaluate((id) => {
    const e = ASHEN.combat.enemies.find((x) => x.id === id) || ASHEN.combat.enemies[1];
    e.position.z = 20;
  }, beforeFire.enemy.id);
  await page.keyboard.press("Digit1");
  await page.waitForTimeout(500);
  const afterFire = await read();
  check(
    "Fire Blast damages a shade that moved before the cast",
    afterFire.enemy.hp < beforeFire.enemy.hp && afterFire.fireCasts >= 1,
  );
  check("Dummy HP unchanged by the moving-shade Fire Blast", afterFire.dummyHp === 2000);

  await page.waitForTimeout(800);
  const beforeLava = await read();
  await page.keyboard.press("Digit2");
  await page.waitForFunction(() => ASHEN.combat.pendingSpell === 2, null, {
    timeout: 3000,
  });
  await page.waitForFunction(() => !!ASHEN.combat.lava.flight, null, {
    timeout: 4000,
  });
  // Slide the shade along the projectile path so a stationary aim-point test would miss.
  await page.evaluate(() => {
    const e = ASHEN.combat.targeting.current;
    if (e) e.position.z -= 4;
  });
  await page.waitForFunction(() => !ASHEN.combat.lava.flight, null, {
    timeout: 4000,
  });
  const afterLava = await read();
  check("Lava Ball still increments combat.lava.casts", afterLava.lavaCasts >= beforeLava.lavaCasts + 1);
  check(
    "Lava Ball hits a shade that moved during flight",
    afterLava.enemy.hp < beforeLava.enemy.hp,
  );
  check("Dummy HP unchanged by the moving-shade Lava Ball", afterLava.dummyHp === 2000);
  await page.screenshot({ path: `${dir}/lava-moving.png` });

  await fs.writeFile(
    `${dir}/lava-moving.json`,
    JSON.stringify({ checks, errors, beforeFire, afterFire, beforeLava, afterLava }, null, 2),
  );
  check("No runtime errors during moving-target spells", errors.length === 0);
} finally {
  await browser.close();
}
