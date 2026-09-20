/**
 * M8a step 1: cost of naive attachCrowd(engine, scene, 8) on the live scene,
 * plus whether loadGltf shares GPU buffers across those eight bodies.
 *
 * Usage (slot 1, headless uncapped):
 *   node scripts/harness/up.mjs --slot 1 --headless --uncapped
 *   export ASHEN_VITE_PORT=5273 ASHEN_CDP_PORT=9437
 *   export ASHEN_URL="http://127.0.0.1:5273/ashen-reach.html?play&clean"
 *   export ASHEN_UNCAPPED=1
 *   node scripts/ashen-reach/measure-m8a-naive.mjs
 *
 * Does not call browser.close() — this script did not launch Chrome.
 */
import { chromium } from "playwright";
import { CDP_URL } from "../lib/cdp.mjs";
import fs from "node:fs/promises";

const seconds = Number(process.argv.find((a, i, all) => all[i - 1] === "--seconds") ?? "6") || 6;
const outDir = "ve-capture/ashen-reach/m8a";
const base =
  process.env.ASHEN_URL ||
  "http://127.0.0.1:5173/ashen-reach.html?play&clean";
const url = new URL(base);
url.searchParams.set("play", "");
url.searchParams.set("clean", "");

const browser = await chromium.connectOverCDP(CDP_URL);
const context = browser.contexts()[0];
let page = context.pages().find((p) => p.url().includes("ashen-reach.html"));
if (!page) page = await context.newPage();
await page.setViewportSize({ width: 960, height: 540 });
await page.bringToFront();
await page.goto(url.toString(), { waitUntil: "commit" });
await page.waitForFunction(() => window.ASHEN?.ready, null, { timeout: 90000 });
await page.waitForTimeout(800);

await page.evaluate(() => {
  const A = window.ASHEN;
  const x = 0, z = 131;
  const y = A.world.groundHeight(x, z) + 1.7;
  A.player.setWorldPos(x, y, z);
  A.player.setFacing(0);
  A.rig.yaw = 0;
  A.rig.pitch = 0.1;
  A.rig.distance = A.rig.distanceTarget = 3.5;
  A.setView("play");
});
await page.waitForTimeout(4500);

async function sample(label) {
  await page.evaluate(() => ASHEN.metrics.reset?.());
  await page.waitForTimeout(seconds * 1000);
  return page.evaluate((kind) => {
    const s = ASHEN.metrics.summary();
    return {
      label: kind,
      fps: s.fps,
      meanMs: s.meanMs,
      medianMs: s.medianMs,
      p95Ms: s.p95Ms,
      p99Ms: s.p99Ms,
      worstMs: s.worstMs,
      minMs: s.minMs,
      samples: s.samples,
      drawCalls: s.drawCalls,
      worldTriangles: s.worldTriangles,
      sceneTriangles: s.sceneTriangles,
      drawnMeshes: s.drawnMeshes,
      hiddenMeshes: s.hiddenMeshes,
      totalMeshes: s.totalMeshes,
      resolution: s.resolution,
      viewport: s.viewport,
      dpr: s.dpr,
      vsyncCapped: s.vsyncCapped,
      capHz: s.capHz,
      capReason: s.capReason,
      enemies: ASHEN.combat.enemies?.length ?? 0,
    };
  }, label);
}

const before = await sample("before-crowd");

const crowd = await page.evaluate(async () => {
  const npc = await import("/src/character/npc.js");
  const wellX = 0, wellZ = 136;
  const gy = ASHEN.world.groundHeight(wellX, wellZ);
  const humans = await npc.attachCrowd(ASHEN.engine, ASHEN.scene, 8, 6.4);
  for (const h of humans) {
    h.root.position.x += wellX;
    h.root.position.z += wellZ;
    h.root.position.y = gy;
  }

  const ids = new Map();
  let next = 0;
  const idOf = (obj) => {
    if (!obj) return null;
    if (!ids.has(obj)) ids.set(obj, ++next);
    return ids.get(obj);
  };

  const crowdMeshes = [];
  for (const mesh of ASHEN.scene.meshes || []) {
    let node = mesh;
    let rootName = null;
    while (node) {
      if ((node.name || "").startsWith("Crowd_")) {
        rootName = node.name;
        break;
      }
      node = node.parent;
    }
    if (!rootName) continue;
    const gpu = mesh._gpu || {};
    crowdMeshes.push({
      root: rootName,
      name: mesh.name,
      visible: mesh.visible !== false,
      indexCount: gpu.indexCount || 0,
      triangles: (gpu.indexCount || 0) / 3,
      positionBuffer: idOf(gpu.positionBuffer),
      normalBuffer: idOf(gpu.normalBuffer),
      uvBuffer: idOf(gpu.uvBuffer),
      indexBuffer: idOf(gpu.indexBuffer),
      positionSize: gpu.positionBuffer?.size ?? null,
      indexSize: gpu.indexBuffer?.size ?? null,
      material: idOf(mesh.material),
      skeleton: idOf(mesh.skeleton || mesh._skeleton),
    });
  }

  const uniquePosition = new Set(crowdMeshes.map((m) => m.positionBuffer)).size;
  const uniqueIndex = new Set(crowdMeshes.map((m) => m.indexBuffer)).size;
  const uniqueMaterial = new Set(crowdMeshes.map((m) => m.material)).size;
  const uniqueSkeleton = new Set(humans.map((h) => idOf(h.skeleton))).size;
  const uniqueContainer = new Set(humans.map((h) => idOf(h.container))).size;

  const surface = crowdMeshes.filter((m) => /surface/i.test(m.name));
  const joints = crowdMeshes.filter((m) => /joint/i.test(m.name));
  const visibleTris = crowdMeshes
    .filter((m) => m.visible)
    .reduce((a, m) => a + m.triangles, 0);

  return {
    count: humans.length,
    meshCount: crowdMeshes.length,
    uniquePositionBuffers: uniquePosition,
    uniqueIndexBuffers: uniqueIndex,
    uniqueMaterials: uniqueMaterial,
    uniqueSkeletons: uniqueSkeleton,
    uniqueContainers: uniqueContainer,
    gpuObjectIdsAssigned: next,
    buffersShared: uniquePosition < crowdMeshes.length,
    surfaceMeshes: surface.length,
    jointMeshes: joints.length,
    surfaceTrianglesEach: surface[0]?.triangles ?? null,
    jointTrianglesEach: joints[0]?.triangles ?? null,
    visibleCrowdTriangles: visibleTris,
    meshes: crowdMeshes,
  };
});

const after = await sample("after-crowd");

const report = {
  url: url.toString(),
  uncappedLaunch: process.env.ASHEN_UNCAPPED === "1",
  before,
  after,
  delta: {
    sceneTriangles: after.sceneTriangles - before.sceneTriangles,
    drawCalls: after.drawCalls - before.drawCalls,
    drawnMeshes: after.drawnMeshes - before.drawnMeshes,
    meanMs: after.meanMs - before.meanMs,
    p95Ms: after.p95Ms - before.p95Ms,
    p99Ms: after.p99Ms - before.p99Ms,
  },
  crowd,
  note:
    "attachCrowd is eight independent loadGltf calls. buffersShared is true only if " +
    "positionBuffer object identity is reused across those bodies. sceneTriangles " +
    "includes GLB/skinned meshes; worldTriangles does not.",
};

await fs.mkdir(outDir, { recursive: true });
await fs.writeFile(`${outDir}/naive-crowd.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
process.exit(0);
