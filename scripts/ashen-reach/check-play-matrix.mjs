/** Live matrix for races, outfits, spells, and hostiles.
 *  Needs Vite and the shared Chrome. Does not close the browser.
 *
 *    node scripts/ashen-reach/check-play-matrix.mjs
 */
import { chromium } from "playwright";
import { CDP_URL } from "../lib/cdp.mjs";
import fs from "node:fs/promises";

const dir = "ve-capture/ashen-reach/play-matrix";
await fs.mkdir(dir, { recursive: true });
const browser = await chromium.connectOverCDP(CDP_URL);
const page = browser.contexts()[0].pages().find((p) => p.url().includes("127.0.0.1:5173/ashen-reach"))
  || await browser.contexts()[0].newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e).slice(0, 240)));
const fail = [];
const check = (name, ok, detail = "") => {
  if (!ok) fail.push(detail ? `${name}: ${detail}` : name);
};

await page.goto("http://127.0.0.1:5173/ashen-reach.html?play&clean", { waitUntil: "commit" });
await page.waitForFunction(() => window.ASHEN?.ready && ASHEN.hostilesReady, null, { timeout: 90000 });
await page.waitForFunction(() => ASHEN.player.getGrounded(), null, { timeout: 8000 }).catch(() => {});

const boot = await page.evaluate(() => {
  const overlay = document.getElementById("metrics-overlay");
  const foes = ASHEN.combat.enemies;
  const town = foes.filter((e) => e.zone === "town");
  const yard = foes.filter((e) => e.zone === "churchyard");
  const idle = (ASHEN.body.animationGroups || []).find((g) => g.name === "Idle_Loop");
  const names = new Set((ASHEN.body.animationGroups || []).map((g) => g.name));
  return {
    deferred: ASHEN.scene._deferredBuilders?.length ?? -1,
    metricsHidden: overlay?.hidden ?? true,
    muted: ASHEN.combat.audio?.muted ?? null,
    foliage: ASHEN.world.stats.foliageInstances,
    townColors: [...new Set(town.map((e) => e.nameColor))],
    yardColors: [...new Set(yard.map((e) => e.nameColor))],
    town: town.length,
    yard: yard.length,
    idle: !!(idle && (idle.isPlaying || idle.weight > 0)),
    clips: ["FireBlast_Upper", "FireBlast_Lower", "LavaBall_Upper", "LavaBall_Lower", "PyreBurst_Upper", "PyreBurst_Lower"].filter((n) => !names.has(n)),
    revenantMeshes: ASHEN.scene.meshes.filter((m) => /Revenant/i.test(m.name || "")).map((m) => m.name),
    visible: ASHEN.body.root.isVisible !== false,
    phase: ASHEN.combat.objective.snapshot().phase,
  };
});
check("deferred builders flushed", boot.deferred === 0, String(boot.deferred));
check("metrics on", boot.metricsHidden === false);
check("audio muted", boot.muted === true, String(boot.muted));
check("foliage", boot.foliage > 0, String(boot.foliage));
check("four churchyard shades", boot.yard === 4, String(boot.yard));
check("three town shades", boot.town === 3, String(boot.town));
check("town cloaks differ", boot.townColors.length === 3, boot.townColors.join(","));
check("churchyard cloaks match", boot.yardColors.length === 1, boot.yardColors.join(","));
check("idle playing", boot.idle);
check("cast clips present", boot.clips.length === 0, boot.clips.join(","));
check("no wooden revenant meshes", boot.revenantMeshes.length === 0, boot.revenantMeshes.join(","));
check("body visible", boot.visible);
check("objective armed", boot.phase === "idle" || boot.phase === "active", boot.phase);

const races = ["human", "orc", "undead"];
const presets = ["wayfarer", "pilgrim", "graveweaver", "warden", "revenant"];
for (const race of races) {
  const swapped = await page.evaluate(async (race) => {
    try {
      await ASHEN.equipment.switchRace(race);
    } catch (error) {
      return { error: error.message || String(error), race: ASHEN.equipment.race, idle: false };
    }
    const idle = (ASHEN.body.animationGroups || []).find((g) => g.name === "Idle_Loop");
    return { race: ASHEN.equipment.race, idle: !!(idle && (idle.isPlaying || idle.weight > 0)) };
  }, race);
  check(`${race} swap`, swapped.race === race, swapped.error || swapped.race);
  check(`${race} idle`, swapped.idle);
  await page.screenshot({ path: `${dir}/${race}-idle.png` });
  for (const preset of presets) {
    const applied = await page.evaluate(async (preset) => {
      const result = await ASHEN.equipment.equipPreset(preset);
      const state = ASHEN.equipment.getState();
      const want = ASHEN.equipment.presets[preset].loadout;
      const mismatch = Object.keys(want).filter((slot) => state[slot] !== want[slot]);
      return { status: result?.status, error: result?.error || "", mismatch };
    }, preset);
    check(`${race} ${preset}`, applied.status === "applied" && applied.mismatch.length === 0, applied.error || applied.mismatch.join(","));
  }
  await page.evaluate(() => {
    ASHEN.setView("play");
    ASHEN.rig.yaw = Math.PI * 0.85;
    ASHEN.rig.pitch = 0.2;
    ASHEN.rig.distance = ASHEN.rig.distanceTarget = 3.2;
  });
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${dir}/${race}-graveweaver.png` });
}

await page.evaluate(async () => {
  await ASHEN.equipment.switchRace("human");
  await ASHEN.equipment.equipPreset("wayfarer");
  const A = ASHEN;
  const d = A.combat.dummy.position;
  const x = d.x, z = d.z - 2.6;
  A.setView("play");
  A.player.setWorldPos(x, A.world.groundHeight(x, z) + A.player.capsuleHeight * 0.5, z);
  A.player.setFacing(0);
  A.rig.yaw = 0.6;
  A.rig.pitch = 0.25;
  A.rig.distance = A.rig.distanceTarget = 6;
});
await page.waitForFunction(() => ASHEN.player.getGrounded(), null, { timeout: 6000 }).catch(() => {});
const before = await page.evaluate(() => ({ casts: ASHEN.combat.spell.casts, hp: ASHEN.combat.dummy.hp, pulse: ASHEN.combat.pulse.casts }));
await page.keyboard.press("Tab");
await page.keyboard.press("Digit1");
await page.waitForTimeout(1600);
const blast = await page.evaluate(() => ({ casts: ASHEN.combat.spell.casts, hp: ASHEN.combat.dummy.hp }));
check("fire blast cast", blast.casts > before.casts, `${before.casts} -> ${blast.casts}`);
check("fire blast damage", blast.hp < before.hp, `${before.hp} -> ${blast.hp}`);

await page.keyboard.press("Digit2");
await page.waitForTimeout(200);
const lava = await page.evaluate(() => ASHEN.body.getState().castingShoot);
check("lava ball windup", lava === true);
await page.waitForTimeout(1800);

await page.waitForFunction(() => ASHEN.combat.pulse.cooldown < 0.05, null, { timeout: 8000 }).catch(() => {});
const pulseBefore = await page.evaluate(() => ASHEN.combat.pulse.casts);
await page.keyboard.press("Digit3");
await page.waitForTimeout(1400);
await page.screenshot({ path: `${dir}/pyre-peak.png` });
const pulse = await page.evaluate(() => {
  const shock = ASHEN.scene.meshes.find((m) => m.name === "Pyre shock");
  return {
    casts: ASHEN.combat.pulse.casts,
    hp: ASHEN.combat.dummy.hp,
    scale: shock?.scaling?.x ?? 0,
  };
});
check("pyre cast", pulse.casts > pulseBefore, `${pulseBefore} -> ${pulse.casts}`);
check("pyre damage", pulse.hp < blast.hp, `${blast.hp} -> ${pulse.hp}`);
check("pyre disc", pulse.scale > 1, String(pulse.scale));
const blocked = await page.evaluate(() => ASHEN.combat.pulse.casts);
await page.keyboard.press("Digit3");
await page.waitForTimeout(300);
const blockedAfter = await page.evaluate(() => ({
  casts: ASHEN.combat.pulse.casts,
  msg: document.querySelector(".combat-error")?.textContent || "",
}));
check("pyre cooldown blocks a second cast", blockedAfter.casts === blocked, `${blocked} -> ${blockedAfter.casts} ${blockedAfter.msg}`);

const walked = await page.evaluate(() => {
  const z = ASHEN.player.body.position.z;
  return z;
});
await page.keyboard.down("KeyW");
await page.waitForTimeout(600);
await page.keyboard.up("KeyW");
const walk = await page.evaluate((z0) => {
  const playing = (ASHEN.body.animationGroups || []).filter((g) => g.isPlaying || g.weight > 0).map((g) => g.name);
  return { dz: ASHEN.player.body.position.z - z0, playing };
}, walked);
check("walk moves", Math.abs(walk.dz) > 0.2, String(walk.dz));
check("walk clip", walk.playing.some((n) => /Walk|Jog|Sprint/.test(n)), walk.playing.join(","));

await page.evaluate(() => {
  const A = ASHEN;
  const w = A.combat.objective.snapshot().watchman;
  const x = w.x, z = w.z - 4;
  A.player.setWorldPos(x, A.world.groundHeight(x, z) + A.player.capsuleHeight * 0.5, z);
  A.player.setFacing(0);
  A.rig.yaw = 0.2;
  A.rig.pitch = 0.16;
  A.rig.distance = A.rig.distanceTarget = 6;
});
await page.waitForTimeout(500);
await page.screenshot({ path: `${dir}/gate.png` });
const gate = await page.evaluate(() => {
  const labels = [...document.querySelectorAll(".world-name")].filter((el) => !el.hidden).map((el) => el.textContent);
  return { labels, phase: ASHEN.combat.objective.snapshot().phase };
});
check("watchman label", gate.labels.includes("Watchman"), gate.labels.join("|"));

if (errors.length) fail.push("pageerror: " + errors.join(" | "));
if (fail.length) {
  console.error(fail.join("\n"));
  process.exit(1);
}
console.log("play matrix ok");
process.exit(0);
