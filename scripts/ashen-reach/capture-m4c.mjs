import { chromium } from "playwright";
import { CDP_URL } from "../lib/cdp.mjs";
import fs from "node:fs/promises";

const url =
  process.env.ASHEN_URL ||
  "http://127.0.0.1:5173/ashen-reach.html?play&clean";
const dir = process.env.M4C_CAPTURE_DIR || "ve-capture/ashen-reach/m4c";
await fs.mkdir(dir, { recursive: true });

const browser = await chromium.connectOverCDP(CDP_URL);
const page = browser.contexts()[0].pages().find((p) =>
  p.url().includes("ashen-reach.html"),
);

async function settle(ms = 400) {
  await page.waitForTimeout(ms);
}

function flank(pxOff, pzOff, dist = 4.1, yawBias = -0.35) {
  return page.evaluate(
    ({ pxOff, pzOff, dist, yawBias }) => {
      const e = ASHEN.combat.enemies[0];
      const x = e.position.x;
      const z = e.position.z;
      const px = x + pxOff;
      const pz = z + pzOff;
      const y = ASHEN.world.groundHeight(px, pz) + ASHEN.player.capsuleHeight / 2;
      ASHEN.player.setWorldPos(px, y, pz);
      const yaw = Math.atan2(x - px, z - pz);
      ASHEN.player.setFacing(yaw);
      e.yaw = yaw + Math.PI;
      ASHEN.rig.yaw = yaw + yawBias;
      ASHEN.rig.pitch = 0.08;
      ASHEN.rig.distance = ASHEN.rig.distanceTarget = dist;
      ASHEN.combat.targeting.select(e.id);
      ASHEN.setView("play");
    },
    { pxOff, pzOff, dist, yawBias },
  );
}

try {
  await page.goto(url, { waitUntil: "commit" });
  await page.waitForFunction(() => window.ASHEN?.ready, null, {
    timeout: 90000,
  });
  await settle(600);

  const metrics = await page.evaluate(() => {
    const enemyMeshes = [];
    let meshTris = 0;
    for (const e of ASHEN.combat.enemies) {
      for (const m of e.meshes || []) {
        const idx = m._cpuIndices;
        const tris = idx ? idx.length / 3 : 0;
        const mat = m.material || {};
        enemyMeshes.push({
          name: m.name,
          visible: m.visible !== false,
          tris,
          alpha: mat.alpha,
          alphaBlend: !!mat.alphaBlend,
          baseColor: mat.baseColorFactor,
          emissive: mat._emissiveColor,
          receiveShadows: !!m.receiveShadows,
        });
        if (m.visible !== false) meshTris += tris;
      }
    }
    return {
      drawCalls: ASHEN.engine.drawCallCount,
      worldTriangles: ASHEN.world.stats.triangles,
      visibleEnemyTris: meshTris,
      enemyMeshes,
      meshCount: (ASHEN.scene.meshes || []).length,
      clips: ASHEN.combat.enemies.map((e) => ({
        id: e.id,
        clip: e.actor?.clipName,
        state: e.state,
      })),
    };
  });
  await fs.writeFile(`${dir}/metrics.json`, JSON.stringify(metrics, null, 2));
  console.log(
    "metrics",
    metrics.drawCalls,
    "draws, visible enemy tris",
    metrics.visibleEnemyTris,
  );

  // Front: flank so the shade is not hidden behind the player.
  await page.evaluate(() => {
    const e = ASHEN.combat.enemies[0];
    e.lockedState = "idle";
    e.state = "idle";
    e.idleFor = 99;
    e.actor.play("idle");
  });
  await flank(2.3, 1.5, 4.1, -0.4);
  await settle(700);
  await page.screenshot({ path: `${dir}/front.png` });
  console.log("wrote front.png");

  // Near/far pair: same material, two distances in one frame.
  await page.evaluate(() => {
    const a = ASHEN.combat.enemies[0];
    const b = ASHEN.combat.enemies[1];
    for (const e of [a, b]) {
      e.lockedState = "idle";
      e.state = "idle";
      e.idleFor = 99;
      e.hidden = false;
      e.actor.setVisible(true);
      e.actor.play("idle");
    }
    a.position.x = 0.6;
    a.position.z = 18.2;
    b.position.x = -1.4;
    b.position.z = 31.5;
    a.yaw = Math.PI;
    b.yaw = Math.PI;
    const px = 2.4;
    const pz = 16.4;
    const y = ASHEN.world.groundHeight(px, pz) + ASHEN.player.capsuleHeight / 2;
    ASHEN.player.setWorldPos(px, y, pz);
    ASHEN.player.setFacing(-0.15);
    ASHEN.rig.yaw = -0.08;
    ASHEN.rig.pitch = 0.05;
    ASHEN.rig.distance = ASHEN.rig.distanceTarget = 5.2;
    ASHEN.combat.targeting.select(a.id);
    ASHEN.setView("play");
  });
  await settle(700);
  await page.screenshot({ path: `${dir}/near-far.png` });
  console.log("wrote near-far.png");

  // Mid-chase.
  await page.evaluate(() => {
    const e = ASHEN.combat.enemies[0];
    e.lockedState = null;
    const x = e.position.x;
    const z = e.position.z;
    const y =
      ASHEN.world.groundHeight(x + 3.2, z + 0.4) + ASHEN.player.capsuleHeight / 2;
    ASHEN.player.setWorldPos(x + 3.2, y, z + 0.4);
    ASHEN.player.setFacing(-1.2);
    ASHEN.rig.yaw = -1.05;
    ASHEN.rig.pitch = 0.08;
    ASHEN.rig.distance = ASHEN.rig.distanceTarget = 5.0;
    ASHEN.combat.targeting.select(e.id);
    ASHEN.setView("play");
  });
  await page.waitForFunction(
    () => {
      const e = ASHEN.combat.enemies[0];
      return e && (e.state === "chase" || e.state === "attack");
    },
    null,
    { timeout: 8000 },
  );
  await settle(450);
  await page.screenshot({ path: `${dir}/chase.png` });
  console.log("wrote chase.png");

  // Melee mid-punch from a 3/4 flank so the striking arm is not behind the player.
  await page.evaluate(() => {
    const e = ASHEN.combat.enemies[0];
    e.lockedState = "attack";
    e.state = "attack";
    e.hidden = false;
    e.actor.setVisible(true);
    e.actor.play("punch", { loop: true, speed: 0.45 });
    const x = e.position.x;
    const z = e.position.z;
    const px = x - 2.5;
    const pz = z + 1.1;
    const y = ASHEN.world.groundHeight(px, pz) + ASHEN.player.capsuleHeight / 2;
    ASHEN.player.setWorldPos(px, y, pz);
    e.yaw = Math.atan2(px - x, pz - z);
    const yaw = Math.atan2(x - px, z - pz);
    ASHEN.player.setFacing(yaw);
    ASHEN.rig.yaw = yaw - 0.55;
    ASHEN.rig.pitch = 0.12;
    ASHEN.rig.distance = ASHEN.rig.distanceTarget = 3.7;
    ASHEN.combat.targeting.select(e.id);
    ASHEN.setView("play");
  });
  await page.waitForFunction(
    () => {
      const punch = ASHEN.combat.enemies[0]?.actor?.clips?.punch;
      if (!punch || !punch.isPlaying) return false;
      const t = punch.currentTime / (punch.duration || 1);
      return t > 0.32 && t < 0.62;
    },
    null,
    { timeout: 5000 },
  );
  await settle(80);
  await page.screenshot({ path: `${dir}/melee.png` });
  console.log("wrote melee.png (3/4, striking arm visible)");

  // Death: kill the shade and catch the fall before it hides.
  await page.evaluate(() => {
    const e = ASHEN.combat.enemies[0];
    e.lockedState = "dead";
    e.hp = 0;
    e.state = "dead";
    e.deadAge = 0;
    e.hidden = false;
    e.hostile = false;
    e.actor.setVisible(true);
    e.actor.play("death", { oneshot: true, loop: false, speed: 1 });
    const death = e.actor.clips.death;
    if (death) death.currentTime = 0.55;
    e.setColliderEnabled?.(false);
  });
  await flank(2.4, 1.2, 4.0, -0.38);
  await settle(280);
  await page.screenshot({ path: `${dir}/death.png` });
  console.log("wrote death.png");

  console.log("wrote screenshots to", dir);
} finally {
  await browser.close();
}
