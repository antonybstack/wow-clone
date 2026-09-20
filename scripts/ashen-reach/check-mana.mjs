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
  page.evaluate(() => ({
    mana: ASHEN.combat.progress.mana,
    manaMax: ASHEN.combat.progress.manaMax,
    casts: ASHEN.combat.spell.casts,
    lavaCasts: ASHEN.combat.lava.casts,
    lastFire: ASHEN.combat.spell.lastResult,
    lastLava: ASHEN.combat.lava.lastResult,
    pending: ASHEN.combat.pendingSpell,
    message: document.querySelector(".combat-error")?.textContent || "",
    dummyHp: ASHEN.combat.dummy.hp,
  }));

try {
  await page.goto(url, { waitUntil: "commit" });
  await page.waitForFunction(() => window.ASHEN?.ready, null, {
    timeout: 60000,
  });
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    ASHEN.setView("play");
    const y = ASHEN.world.groundHeight(0, 2) + ASHEN.player.capsuleHeight / 2;
    ASHEN.player.setWorldPos(0, y, 2);
    ASHEN.player.setFacing(0);
    ASHEN.rig.yaw = 0;
    ASHEN.combat.targeting.select("ashen-training-dummy");
    ASHEN.combat.life.inCombat = true;
    ASHEN.combat.life.combatUntil = ASHEN.combat.life.time + 60;
    for (const e of ASHEN.combat.enemies) {
      e.lockedState = "idle";
      e.state = "idle";
      e.idleFor = 99;
    }
  });
  await page.waitForTimeout(200);

  const start = await read();
  check("Dummy is targeted at full health", start.dummyHp === 2000);
  await page.evaluate(() => {
    ASHEN.combat.progress.mana = 5;
  });
  const starved = await read();
  check("Mana was dropped below the Fire Blast cost", starved.mana === 5);

  await page.keyboard.press("Digit1");
  await page.waitForTimeout(500);
  const refused = await read();
  check("Fire Blast did not increment casts without mana", refused.casts === start.casts);
  check(
    "Insufficient mana reuses the HUD message line",
    refused.lastFire === "Not enough mana" && refused.message === "Not enough mana",
  );
  check("Dummy was not damaged by the refused blast", refused.dummyHp === 2000);
  await page.screenshot({ path: `${dir}/mana-refused.png` });

  await page.evaluate(() => {
    ASHEN.combat.progress.mana = 100;
  });
  await page.keyboard.press("Digit1");
  await page.waitForFunction(
    (n) => ASHEN.combat.spell.casts >= n && ASHEN.combat.spell.lastResult === "hit",
    start.casts + 1,
    { timeout: 4000 },
  );
  const spent = await read();
  check("Fire Blast succeeds when mana is available", spent.casts === start.casts + 1);
  check("Fire Blast spends 20 mana", Math.abs(spent.mana - 80) < 0.01);
  check("Dummy took damage once mana was available", spent.dummyHp < 2000);

  await page.waitForTimeout(1100);
  await page.evaluate(() => {
    ASHEN.combat.progress.mana = 10;
  });
  const lavaStart = await read();
  await page.keyboard.press("Digit2");
  await page.waitForTimeout(500);
  const lavaRefused = await read();
  check(
    "Lava Ball did not start without mana",
    lavaRefused.lavaCasts === lavaStart.lavaCasts && lavaRefused.pending !== 2,
  );
  check(
    "Lava Ball reuses the same insufficient-mana reason",
    lavaRefused.lastLava === "Not enough mana" &&
      lavaRefused.message === "Not enough mana",
  );

  await fs.writeFile(
    `${dir}/mana.json`,
    JSON.stringify({ checks, errors, start, refused, spent, lavaRefused }, null, 2),
  );
  check("No runtime errors during mana checks", errors.length === 0);
} finally {
  await browser.close();
}

console.log(`OK ${checks.length} mana checks`);
