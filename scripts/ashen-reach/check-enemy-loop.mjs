import { chromium } from "playwright";
import { CDP_URL } from "../lib/cdp.mjs";
import assert from "node:assert/strict";
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
    const dummy = ASHEN.combat.dummy;
    return {
      ready: !!ASHEN.ready,
      dummyHp: dummy.hp,
      dummyMax: dummy.hpMax,
      dummyId: dummy.id,
      casts: ASHEN.combat.spell.casts,
      lavaCasts: ASHEN.combat.lava.casts,
      target: ASHEN.combat.targeting.current?.id || null,
      life: snap.life,
      enemies: snap.enemies,
      player: {
        x: ASHEN.player.body.position.x,
        y: ASHEN.player.body.position.y,
        z: ASHEN.player.body.position.z,
      },
    };
  });

try {
  await page.bringToFront();
  await page.goto(url, { waitUntil: "commit" });
  await page.waitForFunction(() => window.ASHEN?.ready, null, {
    timeout: 60000,
  });
  await page.waitForTimeout(800);
  await page.evaluate(() => ASHEN.setView("play"));

  let s = await read();
  const churchyard = s.enemies.filter((e) => e.zone === "churchyard");
  const town = s.enemies.filter((e) => e.zone === "town");
  check("Dummy still present at 2000 HP", s.dummyId === "ashen-training-dummy" && s.dummyHp === 2000);
  check(
    "Four churchyard shades and 2–4 town hostiles loaded",
    churchyard.length === 4 && town.length >= 2 && town.length <= 4 && s.enemies.length === churchyard.length + town.length,
  );
  check(
    "Churchyard shades stay in the churchyard / climb",
    churchyard.length === 4 &&
      churchyard.every(
        (e) =>
          e.position.z >= 0 &&
          e.position.z <= 70 &&
          e.spawn.z >= 0 &&
          e.spawn.z <= 70 &&
          e.bounds?.zMin === 1 &&
          e.bounds?.zMax === 69,
      ),
  );
  check(
    "Town hostiles stay in Hollowmere",
    town.length >= 2 &&
      town.every(
        (e) =>
          e.position.z > 75 &&
          e.spawn.z > 75 &&
          e.position.z <= 140 &&
          e.spawn.z <= 140 &&
          e.bounds?.zMin >= 76 &&
          e.bounds?.zMax <= 140,
      ),
  );
  check(
    "Enemies start idle or patrol with full health",
    s.enemies.every((e) => (e.state === "idle" || e.state === "patrol") && e.hp === e.hpMax),
  );

  const prey = await page.evaluate(() => {
    const e = ASHEN.combat.enemies[2];
    const h = ASHEN.player.capsuleHeight;
    const y = ASHEN.world.groundHeight(e.position.x, e.position.z) + h / 2;
    ASHEN.player.setWorldPos(e.position.x, y, e.position.z + 3.2);
    ASHEN.player.setFacing(Math.PI);
    ASHEN.rig.yaw = Math.PI;
    ASHEN.combat.targeting.select(e.id);
    return { id: e.id, name: e.name, z: e.position.z };
  });
  await page.waitForFunction(
    (id) => {
      const e = ASHEN.combat.enemies.find((x) => x.id === id);
      return e && (e.state === "chase" || e.state === "attack");
    },
    prey.id,
    { timeout: 8000 },
  );
  s = await read();
  const aggro = s.enemies.find((e) => e.id === prey.id);
  check("Approach aggros the selected enemy", aggro.state === "chase" || aggro.state === "attack");
  await page.screenshot({ path: `${dir}/aggro.png` });

  await page.waitForFunction(
    (id) => {
      const e = ASHEN.combat.enemies.find((x) => x.id === id);
      return e && (e.hitsLanded > 0 || ASHEN.combat.life.hp < ASHEN.combat.life.hpMax);
    },
    prey.id,
    { timeout: 10000 },
  );
  s = await read();
  check(
    "Enemy closes to melee and attacks",
    s.enemies.find((e) => e.id === prey.id).state === "attack" ||
      s.enemies.find((e) => e.id === prey.id).hitsLanded > 0,
  );
  check("Player took melee damage", s.life.hp < s.life.hpMax && !s.life.dead);
  await page.screenshot({ path: `${dir}/melee.png` });

  const startCasts = s.casts;
  const startHp = aggro.hp;
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press("Digit1");
    await page.waitForTimeout(1400);
  }
  s = await read();
  const after = s.enemies.find((e) => e.id === prey.id);
  check("Fire Blast still increments combat.spell.casts", s.casts >= startCasts + 3);
  check("Dummy HP unchanged while fighting a shade", s.dummyHp === 2000);
  check(
    "Enemy died from spells",
    after.hp === 0 && (after.state === "dead" || after.hidden),
  );
  await page.screenshot({ path: `${dir}/enemy-death.png` });
  await page.screenshot({ path: `${dir}/hud.png` });

  await page.waitForFunction(
    (id) => {
      const e = ASHEN.combat.enemies.find((x) => x.id === id);
      return e && e.state !== "dead" && e.hp === e.hpMax && !e.hidden;
    },
    prey.id,
    { timeout: 12000 },
  );
  s = await read();
  const back = s.enemies.find((e) => e.id === prey.id);
  check("Enemy respawned at full health", back.hp === back.hpMax && back.state !== "dead");
  check(
    "Respawn returned near the spawn anchor",
    Math.hypot(back.position.x - back.spawn.x, back.position.z - back.spawn.z) < 6,
  );
  await page.screenshot({ path: `${dir}/respawn.png` });

  await fs.writeFile(
    `${dir}/enemy-loop.json`,
    JSON.stringify({ checks, errors, prey, startHp, state: s }, null, 2),
  );
  check("No runtime errors during enemy loop", errors.length === 0);
} finally {
  await browser.close();
}
