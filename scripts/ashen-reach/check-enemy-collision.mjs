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
    const p = ASHEN.player.body.position;
    const e = ASHEN.combat.enemies[0];
    return {
      player: { x: p.x, y: p.y, z: p.z },
      enemy: { x: e.position.x, y: e.position.y, z: e.position.z, id: e.id },
      dummyHp: ASHEN.combat.dummy.hp,
      colliders: ASHEN.player.getDebugState().colliders,
    };
  });

try {
  await page.goto(url, { waitUntil: "commit" });
  await page.waitForFunction(() => window.ASHEN?.ready, null, {
    timeout: 60000,
  });
  await page.waitForTimeout(500);
  await page.evaluate(() => ASHEN.setView("play"));

  const planted = await page.evaluate(() => {
    const e = ASHEN.combat.enemies[0];
    e.lockedState = "idle";
    e.state = "idle";
    e.idleFor = 99;
    e.position.x = 0;
    e.position.z = 18;
    const ground = ASHEN.world.groundHeight;
    const y = ground(0, 14) + ASHEN.player.capsuleHeight / 2;
    ASHEN.player.setWorldPos(0, y, 14);
    ASHEN.player.setFacing(0);
    ASHEN.rig.yaw = 0;
    ASHEN.rig.pitch = 0.08;
    ASHEN.rig.distance = ASHEN.rig.distanceTarget = 4.2;
    return {
      animated: ASHEN.player.getDebugState().colliders.animatedCount,
      usingPhysics: ASHEN.player.getDebugState().usingPhysics,
    };
  });
  check("Havok character controller is active", planted.usingPhysics === true);
  check("Enemy capsules were registered as animated colliders", planted.animated >= 4);

  await page.waitForTimeout(250);
  const before = await read();
  await page.keyboard.down("KeyW");
  await page.waitForTimeout(1500);
  await page.keyboard.up("KeyW");
  const after = await read();
  const dz = after.player.z - before.player.z;
  const gap = after.enemy.z - after.player.z;
  check("Player moved forward toward the enemy", dz > 0.4);
  check(
    "Player did not walk through the enemy",
    after.player.z < after.enemy.z - 0.35,
  );
  check("Player stopped at a collision gap, not inside the shade", gap > 0.45 && gap < 3.2);
  check("Dummy HP unchanged during the collision probe", after.dummyHp === 2000);
  await page.screenshot({ path: `${dir}/collision-block.png` });

  await fs.writeFile(
    `${dir}/enemy-collision.json`,
    JSON.stringify({ checks, errors, planted, before, after, dz, gap }, null, 2),
  );
  check("No runtime errors during collision probe", errors.length === 0);
} finally {
  await page.keyboard.up("KeyW").catch(() => {});
  await browser.close();
}
