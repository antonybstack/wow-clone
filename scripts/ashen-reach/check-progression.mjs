import { chromium } from "playwright";
import { CDP_URL } from "../lib/cdp.mjs";
import assert from "node:assert/strict";
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
    const p = ASHEN.combat.progress;
    const snap = ASHEN.combat.snapshot();
    return {
      level: p.level,
      xp: p.xp,
      xpToNext: p.xpToNext,
      mana: p.mana,
      manaMax: p.manaMax,
      hp: snap.life.hp,
      hpMax: snap.life.hpMax,
      dummyHp: snap.dummy.hp,
      dummyMax: snap.dummy.hpMax,
      casts: ASHEN.combat.spell.casts,
      enemies: snap.enemies,
      lastResult: ASHEN.combat.spell.lastResult,
    };
  });

const plantOn = async (index) => {
  await page.evaluate((i) => {
    for (const e of ASHEN.combat.enemies) {
      // Do not resurrect a dead enemy: forcing state="idle" on one whose hp
      // is still 0 makes the death transition (hp<=0 && state!=="dead") run
      // again on the next tick and award its XP a second time. Leave dead
      // enemies alone; they respawn (hp reset first) on their own timer.
      if (e.state === "dead") continue;
      e.lockedState = "idle";
      e.state = "idle";
      e.idleFor = 99;
    }
    const e = ASHEN.combat.enemies[i];
    const y =
      ASHEN.world.groundHeight(e.position.x, e.position.z) +
      ASHEN.player.capsuleHeight / 2;
    ASHEN.player.setWorldPos(e.position.x, y, e.position.z + 3.1);
    ASHEN.player.setFacing(Math.PI);
    ASHEN.rig.yaw = Math.PI;
    ASHEN.combat.targeting.select(e.id);
    ASHEN.combat.progress.mana = ASHEN.combat.progress.manaMax;
    ASHEN.setView("play");
    return e.id;
  }, index);
  // FireBlast.validate() refuses to cast until the player is grounded
  // (`Land before casting`); a teleport via setWorldPos does not clear that
  // synchronously; the physics step needs a frame to confirm ground contact.
  // Without this wait, a cast attempted right after plantOn can be silently
  // rejected instead of landing on the enemy.
  await page.waitForFunction(
    () => ASHEN.player.getGrounded() && ASHEN.body.getState().phase !== "air",
    null,
    { timeout: 3000 },
  );
};

try {
  await page.goto(url, { waitUntil: "commit" });
  await page.waitForFunction(() => window.ASHEN?.ready, null, {
    timeout: 60000,
  });
  await page.waitForTimeout(600);
  await page.evaluate(() => ASHEN.setView("play"));

  let s = await read();
  check("Starts at level 1 with empty XP", s.level === 1 && s.xp === 0);
  check("XP to next at level 1 is 100", s.xpToNext === 100);
  check("Progress is on ASHEN.combat.progress", Number.isFinite(s.mana) && s.manaMax >= 100);
  check("Dummy still sits at 2000 HP", s.dummyHp === 2000 && s.dummyMax === 2000);

  await plantOn(0);
  const beforeKill = await read();
  const preyHpStart = beforeKill.enemies[0].hp;
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press("Digit1");
    await page.waitForTimeout(1300);
    const live = await read();
    if (live.enemies[0].hp <= 0) break;
  }
  await page.waitForFunction(
    () => {
      const e = ASHEN.combat.enemies[0];
      return e && (e.state === "dead" || e.hp <= 0);
    },
    null,
    { timeout: 8000 },
  );
  s = await read();
  check("Shade died from Fire Blast", s.enemies[0].hp === 0);
  check("XP increased after a real kill", s.xp > beforeKill.xp);
  check(
    "First shade awards 50 XP",
    s.xp === beforeKill.xp + 50 || s.level > beforeKill.level,
  );
  check("Dummy HP unchanged by the shade kill", s.dummyHp === 2000);
  await page.screenshot({ path: `${dir}/xp-after-kill.png` });

  const xpAfterShade = s.xp;
  await page.evaluate(() => {
    const y = ASHEN.world.groundHeight(0, 2) + ASHEN.player.capsuleHeight / 2;
    ASHEN.player.setWorldPos(0, y, 2);
    ASHEN.player.setFacing(0);
    ASHEN.rig.yaw = 0;
    ASHEN.combat.targeting.select("ashen-training-dummy");
    ASHEN.combat.progress.mana = ASHEN.combat.progress.manaMax;
    ASHEN.combat.life.inCombat = true;
    ASHEN.combat.life.combatUntil = ASHEN.combat.life.time + 30;
  });
  await page.waitForTimeout(200);
  await page.keyboard.press("Digit1");
  await page.waitForFunction(
    (n) => ASHEN.combat.spell.casts >= n,
    s.casts + 1,
    { timeout: 4000 },
  );
  s = await read();
  check("Dummy took Fire Blast damage", s.dummyHp < 2000);
  check("Training dummy awards no XP", s.xp === xpAfterShade && s.level === 1);

  await plantOn(1);
  await page.evaluate(() => {
    ASHEN.combat.progress.xp = ASHEN.combat.progress.xpToNext - 1;
    ASHEN.combat.enemies[1].hp = 40;
    ASHEN.combat.progress.mana = ASHEN.combat.progress.manaMax;
  });
  const beforeLevel = await read();
  check(
    "Threshold is armed one XP below the level-up",
    beforeLevel.xp === beforeLevel.xpToNext - 1 && beforeLevel.level === 1,
  );
  // Fire Blast has a 1s cooldown from the dummy cast a moment ago; without
  // this wait the keypress below is silently dropped ("Fire Blast is not
  // ready") and the enemy is never actually hit.
  await page.waitForFunction(() => ASHEN.combat.spell.cooldown <= 0, null, {
    timeout: 3000,
  });
  await page.keyboard.press("Digit1");
  await page.waitForFunction(
    () => ASHEN.combat.progress.level >= 2,
    null,
    { timeout: 6000 },
  );
  s = await read();
  check("Level-up occurs at the XP threshold", s.level === 2);
  check("Level 2 raises max health", s.hpMax === 115 && s.hp === 115);
  check("Level 2 raises max mana", s.manaMax === 115);
  check(
    "XP wraps past the threshold",
    s.xp === beforeLevel.xp + 50 - beforeLevel.xpToNext,
  );
  await page.screenshot({ path: `${dir}/level-up.png` });

  await fs.writeFile(
    `${dir}/progression.json`,
    JSON.stringify({ checks, errors, preyHpStart, beforeKill, beforeLevel, state: s }, null, 2),
  );
  check("No runtime errors during progression", errors.length === 0);
} finally {
  await browser.close();
}

console.log(`OK ${checks.length} progression checks`);
