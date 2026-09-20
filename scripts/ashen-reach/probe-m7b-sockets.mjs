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

try {
  await page.goto(url, { waitUntil: "commit" });
  await page.waitForFunction(() => window.ASHEN?.ready, null, {
    timeout: 90000,
  });
  await page.waitForTimeout(500);

  const report = await page.evaluate(async () => {
    const e = ASHEN.combat.enemies[0];
    const greeter = ASHEN.scene.meshes.find((m) =>
      (m.name || "").startsWith("NpcGreeter"),
    );
    const skel = e.actor.skeleton;
    const bones = (skel?.bones || []).map((b) => b.name);
    const { attachSockets, resolveBone, SLOT_BONES } = await import(
      "/src/character/sockets.js"
    );
    const head = resolveBone(skel, SLOT_BONES.head);
    const back = resolveBone(skel, SLOT_BONES.back);
    const sockets = attachSockets(
      ASHEN.engine,
      ASHEN.scene,
      { body: e.actor.root, capsuleHeight: e.capsuleHeight || 1.68 },
      {
        skeleton: skel,
        root: e.actor.root,
        animationGroups: e.actor.container.animationGroups,
      },
    );
    sockets.sync();
    const pos = (node) =>
      node
        ? { x: node.position.x, y: node.position.y, z: node.position.z }
        : null;
    const metrics = ASHEN.metrics.summary();
    return {
      enemyId: e.id,
      boneCount: bones.length,
      sampleBones: bones.filter((n) =>
        /Head|Spine2|Hips|Neck|LeftArm|LeftLeg|LeftFoot/i.test(n),
      ),
      resolve: {
        head: head?.name || null,
        back: back?.name || null,
      },
      socketBones: Object.fromEntries(
        Object.entries(sockets.sockets).map(([k, s]) => [k, s.bone?.name || null]),
      ),
      headSocket: pos(sockets.sockets.head?.node),
      backSocket: pos(sockets.sockets.back?.node),
      bind: sockets.bind,
      skinned: sockets.skinned?.name || null,
      rootScale: {
        x: e.actor.root.scaling.x,
        y: e.actor.root.scaling.y,
        z: e.actor.root.scaling.z,
      },
      greeterName: greeter?.name || null,
      greeterVisible: greeter?.visible !== false,
      metrics: {
        sceneTriangles: metrics.sceneTriangles,
        worldTriangles: metrics.worldTriangles,
        drawCalls: metrics.drawCalls,
        drawnMeshes: metrics.drawnMeshes,
        totalMeshes: metrics.totalMeshes,
      },
      meshes: (e.meshes || []).map((m) => ({
        name: m.name,
        visible: m.visible !== false,
        tris: m._cpuIndices ? m._cpuIndices.length / 3 : (m._gpu?.indexCount || 0) / 3,
      })),
    };
  });

  await fs.writeFile(`${dir}/socket-probe.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
