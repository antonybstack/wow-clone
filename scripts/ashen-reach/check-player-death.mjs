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
    const p = ASHEN.player.body.position;
    return {
      life: snap.life,
      veil: !document.querySelector(".death-veil")?.hidden,
      player: { x: p.x, y: p.y, z: p.z },
      inputForward: ASHEN.input.forward,
      enemies: snap.enemies,
      dummyHp: ASHEN.combat.dummy.hp,
    };
  });

try {
  await page.bringToFront();
  await page.goto(url, { waitUntil: "commit" });
  await page.waitForFunction(() => window.ASHEN?.ready, null, {
    timeout: 60000,
  });
  await page.waitForTimeout(700);
  await page.evaluate(() => ASHEN.setView("play"));

  await page.evaluate(() => {
    const e = ASHEN.combat.enemies[1];
    const y =
      ASHEN.world.groundHeight(e.position.x, e.position.z) +
      ASHEN.player.capsuleHeight / 2;
    ASHEN.player.setWorldPos(e.position.x, y, e.position.z + 1.6);
    ASHEN.combat.life.hp = 20;
    ASHEN.player.hp = 20;
  });

  await page.waitForFunction(() => ASHEN.combat.life.dead, null, {
    timeout: 12000,
  });
  let s = await read();
  check("Player dies at zero health", s.life.dead && s.life.hp === 0);
  check("Death veil is shown", s.veil);
  check("Dummy was not damaged by the death test", s.dummyHp === 2000);
  await page.screenshot({ path: `${dir}/player-death.png` });

  await page.keyboard.down("KeyW");
  await page.waitForTimeout(400);
  await page.keyboard.up("KeyW");
  const moved = await read();
  check(
    "Input is disabled while dead",
    Math.hypot(moved.player.x - s.player.x, moved.player.z - s.player.z) < 0.35,
  );

  await page.locator(".death-veil button").click();
  await page.waitForTimeout(500);
  s = await read();
  check("Release spirit clears the death state", !s.life.dead && !s.veil);
  check("Health is restored on resurrect", s.life.hp === s.life.hpMax);
  check(
    "Resurrect plants the player at the churchyard spawn",
    Math.hypot(s.player.x, s.player.z) < 1.25,
  );
  await page.screenshot({ path: `${dir}/player-resurrect.png` });

  await fs.writeFile(
    `${dir}/player-death.json`,
    JSON.stringify({ checks, errors, state: s }, null, 2),
  );
  check("No runtime errors during death/resurrect", errors.length === 0);
} finally {
  await page.keyboard.up("KeyW").catch(() => {});
  await browser.close();
}
