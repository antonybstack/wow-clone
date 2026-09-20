import { chromium } from "playwright";
import { CDP_URL } from "../lib/cdp.mjs";
import fs from "node:fs/promises";

const url =
  process.env.ASHEN_URL ||
  "http://127.0.0.1:5473/ashen-reach.html?play&clean";
const dir = process.env.M7B_CAPTURE_DIR || "ve-capture/ashen-reach/m7b";
await fs.mkdir(dir, { recursive: true });

const browser = await chromium.connectOverCDP(CDP_URL);
const page = browser.contexts()[0].pages().find((p) =>
  p.url().includes("ashen-reach.html"),
);

async function settle(ms = 400) {
  await page.waitForTimeout(ms);
}

function plant(x, z) {
  return page.evaluate(
    ({ x, z }) => {
      const e = ASHEN.combat.enemies[0];
      e.position.x = x;
      e.position.z = z;
      e.position.y = ASHEN.world.groundHeight(x, z);
      e.root.position.set(e.position.x, e.position.y, e.position.z);
      e.hidden = false;
      e.actor.setVisible(true);
    },
    { x, z },
  );
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
  await settle(700);

  const metrics = await page.evaluate(() => {
    const enemies = ASHEN.combat.enemies.map((e) => {
      const g = e.actor?.silhouette;
      return {
        id: e.id,
        clip: e.actor?.clipName,
        state: e.state,
        bound: g?.bound || null,
        triangles: g?.triangles ?? 0,
        hiddenBones: g?.hiddenBones || [],
        garmentMeshes: (g?.meshes || []).map((m) => ({
          name: m.name,
          visible: m.visible !== false,
          tris: m._cpuIndices
            ? m._cpuIndices.length / 3
            : (m._gpu?.indexCount || 0) / 3,
        })),
      };
    });
    const summary = ASHEN.metrics.summary();
    return {
      drawCalls: summary.drawCalls,
      sceneTriangles: summary.sceneTriangles,
      worldTriangles: summary.worldTriangles,
      drawnMeshes: summary.drawnMeshes,
      totalMeshes: summary.totalMeshes,
      enemies,
    };
  });
  await fs.writeFile(`${dir}/metrics.json`, JSON.stringify(metrics, null, 2));
  console.log(
    "metrics",
    metrics.drawCalls,
    "draws,",
    metrics.sceneTriangles,
    "scene tris, world",
    metrics.worldTriangles,
  );
  console.log("bind", JSON.stringify(metrics.enemies[0]?.bound));
  console.log("garment tris", metrics.enemies[0]?.triangles);

  await page.evaluate(() => {
    const e = ASHEN.combat.enemies[0];
    e.lockedState = "idle";
    e.state = "idle";
    e.idleFor = 99;
    e.actor.play("idle");
  });
  await plant(3.4, 16);
  await flank(2.3, 1.5, 4.1, -0.4);
  await settle(700);
  await page.screenshot({ path: `${dir}/front.png` });
  console.log("wrote front.png");

  await plant(3.4, 16);
  await flank(3.2, 0.6, 4.0, -0.85);
  await settle(500);
  await page.screenshot({ path: `${dir}/three-quarter.png` });
  console.log("wrote three-quarter.png");

  await page.evaluate(() => {
    const e = ASHEN.combat.enemies[0];
    e.lockedState = "idle";
    e.state = "idle";
    e.idleFor = 99;
    e.hidden = false;
    e.actor.setVisible(true);
    e.actor.play("idle");
    e.position.x = 3.4;
    e.position.z = 20;
    e.yaw = Math.PI;
    const px = 4.2;
    const pz = 5;
    const y = ASHEN.world.groundHeight(px, pz) + ASHEN.player.capsuleHeight / 2;
    ASHEN.player.setWorldPos(px, y, pz);
    ASHEN.player.setFacing(0);
    ASHEN.rig.yaw = -0.22;
    ASHEN.rig.pitch = 0.05;
    ASHEN.rig.distance = ASHEN.rig.distanceTarget = 3.5;
    ASHEN.combat.targeting.select(e.id);
    ASHEN.setView("play");
  });
  await settle(700);
  await page.screenshot({ path: `${dir}/play-15m.png` });
  console.log("wrote play-15m.png");

  await plant(3.4, 16);
  await flank(-0.2, -3.4, 4.2, 0.15);
  await settle(500);
  await page.screenshot({ path: `${dir}/behind.png` });
  console.log("wrote behind.png");

  await plant(3.4, 16);
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

  await plant(3.4, 16);
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
  console.log("wrote melee.png");

  await plant(3.4, 16);
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

  const greeter = await page.evaluate(async () => {
    const { attachGreeter } = await import("/src/character/npc.js");
    const human = await attachGreeter(ASHEN.engine, ASHEN.scene);
    const px = human.root.position.x + 2.4;
    const pz = human.root.position.z + 1.6;
    const y = ASHEN.world.groundHeight(px, pz) + ASHEN.player.capsuleHeight / 2;
    ASHEN.player.setWorldPos(px, y, pz);
    const yaw = Math.atan2(
      human.root.position.x - px,
      human.root.position.z - pz,
    );
    ASHEN.player.setFacing(yaw);
    ASHEN.rig.yaw = yaw - 0.35;
    ASHEN.rig.pitch = 0.08;
    ASHEN.rig.distance = ASHEN.rig.distanceTarget = 4.0;
    ASHEN.combat.targeting.clear();
    ASHEN.setView("play");
    for (let i = 0; i < 12; i++) human.update(1 / 30);
    return {
      name: human.root.name,
      hasSilhouette: !!human.silhouette,
      meshNames: (human.meshes || []).map((m) => m.name),
    };
  });
  await settle(700);
  await page.screenshot({ path: `${dir}/greeter.png` });
  console.log("wrote greeter.png", greeter);

  await fs.writeFile(`${dir}/greeter.json`, JSON.stringify(greeter, null, 2));
  console.log("wrote screenshots to", dir);
} finally {
  await browser.close();
}
