import { chromium } from "playwright";
import { CDP_URL } from "../lib/cdp.mjs";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const url =
  process.env.ASHEN_URL ||
  "http://127.0.0.1:5173/ashen-reach.html?play&clean";
const dir = process.env.M10_CAPTURE_DIR || "ve-capture/ashen-reach/m10-objective";
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

const IDS = [
  "grave-shade-1",
  "grave-shade-2",
  "grave-shade-3",
  "grave-shade-4",
];

const read = () =>
  page.evaluate(() => {
    const snap = ASHEN.combat.snapshot();
    const p = ASHEN.player.body.position;
    return {
      objective: snap.objective,
      progress: snap.progress,
      dummy: snap.dummy,
      enemies: snap.enemies,
      message: document.querySelector(".combat-error")?.textContent || "",
      player: { x: p.x, y: p.y, z: p.z },
    };
  });

const plant = async (x, z, yaw = 0) => {
  await page.evaluate(
    ({ x, z, yaw }) => {
      const y =
        ASHEN.world.groundHeight(x, z) + ASHEN.player.capsuleHeight / 2;
      ASHEN.player.setWorldPos(x, y, z);
      ASHEN.player.setFacing(yaw);
      ASHEN.rig.yaw = yaw;
      ASHEN.rig.pitch = 0.08;
      ASHEN.rig.distance = ASHEN.rig.distanceTarget = 3.8;
      ASHEN.setView("play");
    },
    { x, z, yaw },
  );
  await page.waitForFunction(
    () => ASHEN.player.getGrounded() && ASHEN.body.getState().phase !== "air",
    null,
    { timeout: 3000 },
  );
};

const killIds = async (ids) => {
  await page.evaluate((list) => {
    for (const e of ASHEN.combat.enemies) {
      if (list.includes(e.id)) e.hp = 0;
    }
  }, ids);
};

try {
  await page.goto(url, { waitUntil: "commit" });
  await page.waitForFunction(() => window.ASHEN?.ready, null, {
    timeout: 60000,
  });
  await page.waitForFunction(() => window.ASHEN?.hostilesReady, null, {
    timeout: 30000,
  });
  await page.waitForTimeout(600);
  await page.evaluate(() => ASHEN.setView("play"));

  let s = await read();
  check("Objective is on ASHEN.combat.snapshot", !!s.objective);
  check(
    "Starts idle away from the gate",
    s.objective.phase === "idle" &&
      s.objective.inside === false &&
      s.objective.promptCount === 0,
  );
  check(
    "Four churchyard shade ids are loaded",
    IDS.every((id) => s.enemies.some((e) => e.id === id)),
  );
  check(
    "Spawn does not show the watchman prompt",
    s.message !== "The watchman asks you to clear the churchyard shades.",
  );
  check(
    "Dummy is not a churchyard shade",
    !IDS.includes("ashen-training-dummy") && s.dummy.hp === 2000,
  );

  await page.evaluate(() => {
    ASHEN.combat.targeting.select("ashen-training-dummy");
    ASHEN.combat.progress.mana = ASHEN.combat.progress.manaMax;
    ASHEN.combat.life.inCombat = true;
    ASHEN.combat.life.combatUntil = ASHEN.combat.life.time + 30;
    const y = ASHEN.world.groundHeight(0, 2) + ASHEN.player.capsuleHeight / 2;
    ASHEN.player.setWorldPos(0, y, 2);
    ASHEN.player.setFacing(0);
    ASHEN.rig.yaw = 0;
  });
  await page.waitForFunction(
    () => ASHEN.player.getGrounded() && ASHEN.body.getState().phase !== "air",
    null,
    { timeout: 3000 },
  );
  await page.keyboard.press("Digit1");
  await page.waitForFunction(
    () => ASHEN.combat.dummy.hp < 2000,
    null,
    { timeout: 4000 },
  );
  s = await read();
  check(
    "Dummy damage does not start or advance the objective",
    s.objective.phase === "idle" &&
      s.objective.killed.length === 0 &&
      s.dummy.hp < 2000,
  );

  const watchman = s.objective.watchman;
  const approach = { x: watchman.x - 1.8, z: watchman.z - 4.2 };
  const yaw = Math.atan2(watchman.x - approach.x, watchman.z - approach.z);
  await plant(approach.x, approach.z, yaw);
  await page.waitForFunction(
    () => ASHEN.combat.objective.snapshot().phase === "active",
    null,
    { timeout: 4000 },
  );
  s = await read();
  check("Gate proximity offers the objective", s.objective.phase === "active");
  check("Prompt fires once at the watchman", s.objective.promptCount === 1);
  check(
    "HUD message line carries the watchman prompt",
    s.message === "The watchman asks you to clear the churchyard shades." &&
      s.objective.lastMessage === s.message,
  );
  check(
    "Player is inside the trigger radius",
    s.objective.inside === true &&
      Math.hypot(s.player.x - watchman.x, s.player.z - watchman.z) <=
        s.objective.triggerRadius,
  );
  await page.screenshot({ path: `${dir}/prompt.png` });

  await plant(0, 0, 0);
  await page.waitForFunction(
    () => ASHEN.combat.objective.snapshot().inside === false,
    null,
    { timeout: 4000 },
  );
  s = await read();
  check(
    "Leaving the gate does not drop an active objective",
    s.objective.phase === "active" && s.objective.promptCount === 1,
  );

  await killIds(IDS.slice(0, 2));
  await page.waitForFunction(
    () => ASHEN.combat.objective.snapshot().killed.length >= 2,
    null,
    { timeout: 4000 },
  );
  s = await read();
  check(
    "Two churchyard kills are tracked without completing",
    s.objective.phase === "active" &&
      s.objective.killed.length === 2 &&
      s.objective.remaining.length === 2,
  );
  check(
    "Tracked kills are grave-shade ids",
    s.objective.killed.every((id) => IDS.includes(id)),
  );

  const extras = s.enemies
    .filter((e) => !IDS.includes(e.id))
    .map((e) => e.id);
  if (extras.length) {
    const before = s.objective.killed.length;
    await killIds(extras);
    await page.waitForTimeout(400);
    s = await read();
    check(
      "Non-churchyard hostiles do not count toward completion",
      s.objective.killed.length === before && s.objective.phase === "active",
    );
  } else {
    check(
      "Non-churchyard hostiles do not count toward completion",
      s.objective.remaining.length === 2,
    );
  }

  await page.screenshot({ path: `${dir}/mid-clear.png` });

  await killIds(IDS.slice(2));
  await page.waitForFunction(
    () => ASHEN.combat.objective.snapshot().phase === "done",
    null,
    { timeout: 4000 },
  );
  s = await read();
  check("Clearing the four churchyard shades completes the beat", s.objective.phase === "done");
  check("Completion count increments once", s.objective.completeCount === 1);
  check(
    "Completion message and bonus XP share the HUD line",
    s.message === "Churchyard cleared. +100 experience" &&
      s.objective.lastMessage === s.message &&
      s.objective.bonusXp === 100,
  );
  await page.screenshot({ path: `${dir}/complete.png` });

  await plant(approach.x, approach.z, yaw);
  await page.waitForTimeout(400);
  s = await read();
  check(
    "Standing at the gate after completion does not re-prompt",
    s.objective.phase === "done" && s.objective.promptCount === 1,
  );

  await page.waitForFunction(
    () => {
      const ids = [
        "grave-shade-1",
        "grave-shade-2",
        "grave-shade-3",
        "grave-shade-4",
      ];
      return ids.every((id) => {
        const e = ASHEN.combat.enemies.find((x) => x.id === id);
        return e && e.hp > 0 && e.state !== "dead";
      });
    },
    null,
    { timeout: 15000 },
  );
  await plant(0, 0, 0);
  await page.waitForFunction(
    () => {
      const o = ASHEN.combat.objective.snapshot();
      return o.phase === "idle" && o.inside === false;
    },
    null,
    { timeout: 4000 },
  );
  await plant(approach.x, approach.z, yaw);
  await page.waitForFunction(
    () => ASHEN.combat.objective.snapshot().promptCount >= 2,
    null,
    { timeout: 4000 },
  );
  s = await read();
  check(
    "Beat re-arms at the gate after the four shades respawn",
    s.objective.phase === "active" &&
      s.objective.promptCount === 2 &&
      s.objective.completeCount === 1 &&
      s.message === "The watchman asks you to clear the churchyard shades.",
  );

  await fs.writeFile(
    `${dir}/objective.json`,
    JSON.stringify({ checks, errors, state: s }, null, 2),
  );
  check("No runtime errors during the objective", errors.length === 0);
} finally {
  // Drop this Playwright session so node can exit. Chrome stays with the harness.
  await browser.close();
}

console.log(`OK ${checks.length} objective checks`);
