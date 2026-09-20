/**
 * M9 live checks: town hostiles exist, churchyard four still clamp to the
 * climb, a walk toward the well aggros, townsfolk stay off the target list.
 *
 *   export ASHEN_VITE_PORT=5273 ASHEN_CDP_PORT=9437
 *   export ASHEN_URL="http://127.0.0.1:5273/ashen-reach.html?play&clean"
 *   node scripts/ashen-reach/check-m9.mjs
 */
import { chromium } from "playwright";
import { CDP_URL } from "../lib/cdp.mjs";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const url =
  process.env.ASHEN_URL ||
  "http://127.0.0.1:5273/ashen-reach.html?play&clean";
const dir = process.env.M9_CAPTURE_DIR || "ve-capture/ashen-reach/m9";
await fs.mkdir(dir, { recursive: true });

const browser = await chromium.connectOverCDP(CDP_URL);
const page = browser.contexts()[0].pages().find((p) =>
  p.url().includes("ashen-reach.html"),
);
if (!page) throw new Error("No ashen-reach.html tab on " + CDP_URL);
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
    const snap = ASHEN.combat.snapshot();
    return {
      enemies: snap.enemies,
      target: ASHEN.combat.targeting.current?.id || null,
      targetName: ASHEN.combat.targeting.current?.name || null,
      list: ASHEN.combat.targeting.list.map((t) => ({
        id: t.id,
        name: t.name,
        hostile: !!t.hostile,
      })),
      player: {
        x: ASHEN.player.body.position.x,
        z: ASHEN.player.body.position.z,
      },
    };
  });

try {
  await page.bringToFront();
  await page.goto(url, { waitUntil: "commit" });
  await page.waitForFunction(() => window.ASHEN?.ready, null, {
    timeout: 90000,
  });
  await page.waitForTimeout(700);
  await page.evaluate(() => ASHEN.setView("play"));

  const tuning = await page.evaluate(() => {
    // ENEMY_TUNING is not on ASHEN; read the churchyard shade's live box.
    const church = ASHEN.combat.enemies.filter((e) => e.zone === "churchyard");
    const town = ASHEN.combat.enemies.filter((e) => e.zone === "town");
    return {
      churchZMax: church[0]?.bounds?.zMax,
      churchZMin: church[0]?.bounds?.zMin,
      townZMin: town[0]?.bounds?.zMin,
      townZMax: town[0]?.bounds?.zMax,
      churchNames: church.map((e) => e.name),
      townNames: town.map((e) => e.name),
      churchIds: church.map((e) => e.id),
      townIds: town.map((e) => e.id),
    };
  });

  let s = await read();
  const churchyard = s.enemies.filter((e) => e.zone === "churchyard");
  const town = s.enemies.filter((e) => e.zone === "town");

  check("Churchyard four still loaded", churchyard.length === 4);
  check(
    "Churchyard names unchanged",
    JSON.stringify(tuning.churchNames) ===
      JSON.stringify(["Grave Shade", "Ash Wight", "Lych Stalker", "Barrow Shade"]),
  );
  check(
    "Churchyard roam box is still z=1..69",
    tuning.churchZMin === 1 && tuning.churchZMax === 69,
  );
  check(
    "Two to four town hostiles on the street / well",
    town.length >= 2 && town.length <= 4,
  );
  check(
    "Town hostiles have their own names",
    town.length > 0 &&
      town.every((e) => !tuning.churchNames.includes(e.name)) &&
      town.some((e) => /wraith|haunt|lane|street|well/i.test(e.name)),
  );
  check(
    "Town roam box stays north of the gate",
    tuning.townZMin >= 76 && tuning.townZMax <= 140,
  );
  check(
    "Town spawns sit on Hollowmere (z>75)",
    town.every((e) => e.spawn.z > 75 && e.position.z > 75),
  );

  check(
    "Townsfolk are not on the targeting list",
    s.list.every(
      (t) =>
        t.id === "ashen-training-dummy" ||
        tuning.churchIds.includes(t.id) ||
        tuning.townIds.includes(t.id),
    ) && s.list.length === 1 + churchyard.length + town.length,
  );

  const aggro = await page.evaluate(() => {
    const e = ASHEN.combat.enemies.find((x) => x.id === "town-wraith-1");
    const h = ASHEN.player.capsuleHeight;
    const y = ASHEN.world.groundHeight(e.position.x, e.position.z) + h / 2;
    ASHEN.player.setWorldPos(e.position.x, y, e.position.z + 3.2);
    ASHEN.player.setFacing(Math.PI);
    ASHEN.rig.yaw = Math.PI;
    ASHEN.combat.targeting.select(e.id);
    ASHEN.setView("play");
    return { id: e.id, name: e.name, z: e.position.z };
  });
  await page.waitForFunction(
    (id) => {
      const e = ASHEN.combat.enemies.find((x) => x.id === id);
      return e && (e.state === "chase" || e.state === "attack");
    },
    aggro.id,
    { timeout: 8000 },
  );
  s = await read();
  const chasing = s.enemies.find((e) => e.id === aggro.id);
  check(
    "Approach on the street aggros a town hostile",
    chasing.state === "chase" || chasing.state === "attack",
  );
  await page.screenshot({ path: `${dir}/check-town-aggro.png` });

  await page.evaluate(() => {
    for (const e of ASHEN.combat.enemies) {
      e.lockedState = null;
      if (e.state === "dead") continue;
      e.state = "idle";
      e.idleFor = 99;
      e.position.x = e.spawn.x;
      e.position.z = e.spawn.z;
    }
    const y = ASHEN.world.groundHeight(0, 70) + ASHEN.player.capsuleHeight / 2;
    ASHEN.player.setWorldPos(0, y, 70);
    ASHEN.player.setFacing(0);
    ASHEN.rig.yaw = 0;
    ASHEN.setView("play");
  });
  await page.waitForTimeout(200);
  await page.keyboard.down("KeyW");
  await page.waitForFunction(
    () =>
      ASHEN.combat.enemies.some(
        (e) => e.zone === "town" && (e.state === "chase" || e.state === "attack"),
      ),
    null,
    { timeout: 8000 },
  );
  await page.keyboard.up("KeyW");
  const walked = await read();
  const walkAggro = walked.enemies.filter(
    (e) => e.zone === "town" && (e.state === "chase" || e.state === "attack"),
  );
  check(
    "A walk from the gate toward the well aggros a town hostile",
    walkAggro.length > 0 && walked.player.z > 70,
  );
  await page.screenshot({ path: `${dir}/check-walk-aggro.png` });

  const tab = await page.evaluate(() => {
    for (const e of ASHEN.combat.enemies) {
      if (e.state === "dead") continue;
      e.lockedState = "idle";
      e.state = "idle";
      e.idleFor = 99;
    }
    const haunt = ASHEN.combat.enemies.find((x) => x.id === "town-wraith-3");
    const px = haunt.position.x + 2.4;
    const pz = haunt.position.z + 1.6;
    const y =
      ASHEN.world.groundHeight(px, pz) + ASHEN.player.capsuleHeight / 2;
    ASHEN.player.setWorldPos(px, y, pz);
    const yaw = Math.atan2(
      haunt.position.x - px,
      haunt.position.z - pz,
    );
    ASHEN.player.setFacing(yaw);
    ASHEN.rig.yaw = yaw;
    ASHEN.combat.targeting.clear();
    const eye = {
      x: ASHEN.player.body.position.x,
      y: ASHEN.player.body.position.y,
      z: ASHEN.player.body.position.z,
    };
    const forward = { x: Math.sin(yaw), z: Math.cos(yaw) };
    const picked = ASHEN.combat.targeting.tab(eye, forward);
    return {
      id: picked?.id || null,
      name: picked?.name || null,
      list: ASHEN.combat.targeting.list.map((t) => t.name),
    };
  });
  check(
    "Tab at the well picks a hostile, not a townsfolk",
    !!tab.id &&
      (tuning.townIds.includes(tab.id) || tuning.churchIds.includes(tab.id)) &&
      !/tend|patron|watchman|townsfolk/i.test(tab.name || ""),
  );

  const churchClamp = await page.evaluate(() => {
    const e = ASHEN.combat.enemies.find((x) => x.id === "grave-shade-4");
    e.lockedState = "chase";
    e.state = "chase";
    const y =
      ASHEN.world.groundHeight(0, 96) + ASHEN.player.capsuleHeight / 2;
    ASHEN.player.setWorldPos(0, y, 96);
    return e.id;
  });
  await page.waitForTimeout(2500);
  const afterChurch = await page.evaluate((id) => {
    const e = ASHEN.combat.enemies.find((x) => x.id === id);
    return { z: e.position.z, zMax: e.bounds.zMax };
  }, churchClamp);
  check(
    "Churchyard shade cannot chase into Hollowmere",
    afterChurch.z <= afterChurch.zMax && afterChurch.z <= 69,
  );

  const townClamp = await page.evaluate(() => {
    const e = ASHEN.combat.enemies.find((x) => x.id === "town-wraith-1");
    e.lockedState = "chase";
    e.state = "chase";
    const y =
      ASHEN.world.groundHeight(0, 50) + ASHEN.player.capsuleHeight / 2;
    ASHEN.player.setWorldPos(0, y, 50);
    return e.id;
  });
  await page.waitForTimeout(2500);
  const afterTown = await page.evaluate((id) => {
    const e = ASHEN.combat.enemies.find((x) => x.id === id);
    return { z: e.position.z, zMin: e.bounds.zMin };
  }, townClamp);
  check(
    "Town hostile cannot chase south of the gate",
    afterTown.z >= afterTown.zMin && afterTown.z >= 76,
  );

  await fs.writeFile(
    `${dir}/check-m9.json`,
    JSON.stringify({ checks, errors, tuning, aggro, tab, afterChurch, afterTown }, null, 2),
  );
  check("No runtime errors during M9 checks", errors.length === 0);
} finally {
  await browser.close();
}
