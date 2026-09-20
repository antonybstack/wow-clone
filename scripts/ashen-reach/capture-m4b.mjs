import { chromium } from "playwright";
import { CDP_URL } from "../lib/cdp.mjs";
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

async function settle(ms = 400) {
  await page.waitForTimeout(ms);
}

try {
  await page.goto(url, { waitUntil: "commit" });
  await page.waitForFunction(() => window.ASHEN?.ready, null, {
    timeout: 90000,
  });
  await settle(500);

  const metrics = await page.evaluate(() => {
    const meshes = ASHEN.scene.meshes || [];
    let meshTris = 0;
    const enemyMeshes = [];
    for (const e of ASHEN.combat.enemies) {
      for (const m of e.meshes || []) {
        const idx = m._cpuIndices;
        const tris = idx ? idx.length / 3 : 0;
        enemyMeshes.push({ name: m.name, visible: m.visible !== false, tris });
        if (m.visible !== false) meshTris += tris;
      }
    }
    return {
      drawCalls: ASHEN.engine.drawCallCount,
      worldTriangles: ASHEN.world.stats.triangles,
      visibleEnemyTris: meshTris,
      enemyMeshes,
      meshCount: meshes.length,
      clips: ASHEN.combat.enemies.map((e) => ({ id: e.id, clip: e.actor?.clipName, state: e.state })),
    };
  });
  await fs.writeFile(`${dir}/metrics.json`, JSON.stringify(metrics, null, 2));
  console.log("metrics", metrics.drawCalls, "draws, world", metrics.worldTriangles, "enemy tris", metrics.visibleEnemyTris);

  // Front: flank so the shade is not hidden behind the player.
  await page.evaluate(() => {
    const e = ASHEN.combat.enemies[0];
    e.lockedState = "idle";
    e.state = "idle";
    e.idleFor = 99;
    e.actor.play("idle");
    const x = e.position.x;
    const z = e.position.z;
    const px = x + 2.2, pz = z + 1.4;
    const y = ASHEN.world.groundHeight(px, pz) + ASHEN.player.capsuleHeight / 2;
    ASHEN.player.setWorldPos(px, y, pz);
    const yaw = Math.atan2(x - px, z - pz);
    ASHEN.player.setFacing(yaw);
    e.yaw = yaw + Math.PI;
    ASHEN.rig.yaw = yaw - 0.4;
    ASHEN.rig.pitch = 0.06;
    ASHEN.rig.distance = ASHEN.rig.distanceTarget = 4.1;
    ASHEN.combat.targeting.select(e.id);
    ASHEN.setView("play");
  });
  await settle(700);
  await page.screenshot({ path: `${dir}/front.png` });
  console.log("wrote front.png");

  // Mid-chase: let the shade jog, camera off to the side looking at them.
  await page.evaluate(() => {
    const e = ASHEN.combat.enemies[0];
    e.lockedState = null;
    const x = e.position.x;
    const z = e.position.z;
    const y = ASHEN.world.groundHeight(x + 3.2, z + 0.4) + ASHEN.player.capsuleHeight / 2;
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

  // Melee: wait for a punch, then frame from the opposite flank.
  await page.waitForFunction(
    () => ASHEN.combat.enemies[0]?.hitsLanded > 0 || ASHEN.combat.enemies[0]?.state === "attack",
    null,
    { timeout: 10000 },
  );
  await page.evaluate(() => {
    const e = ASHEN.combat.enemies[0];
    const x = e.position.x;
    const z = e.position.z;
    const px = x + 2.0, pz = z + 0.6;
    const y = ASHEN.world.groundHeight(px, pz) + ASHEN.player.capsuleHeight / 2;
    ASHEN.player.setWorldPos(px, y, pz);
    const yaw = Math.atan2(x - px, z - pz);
    ASHEN.player.setFacing(yaw);
    e.yaw = yaw + Math.PI;
    ASHEN.rig.yaw = yaw - 0.35;
    ASHEN.rig.pitch = 0.08;
    ASHEN.rig.distance = ASHEN.rig.distanceTarget = 4.0;
    ASHEN.combat.targeting.select(e.id);
    ASHEN.setView("play");
  });
  await settle(350);
  await page.screenshot({ path: `${dir}/melee.png` });
  console.log("wrote melee.png");

  console.log("wrote screenshots to", dir);
} finally {
  await browser.close();
}
