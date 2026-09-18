/** Live Lite LBS sample at walk t=0.3. Own tab only. No runtime edits. */
import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const ROOT = path.resolve(".");
const OUT = path.resolve("ve-capture/m2-deformation-diagnosis");
const GLB = path.join(ROOT, "public/characters/bodies/human-animated-v1.glb");
const URL = "http://127.0.0.1:5180/body-preview.html?m2-deform-diag=1";
const WALK_T = 0.3;

function sha256(buf) {
  return createHash("sha256").update(buf).digest("hex");
}

function lbs(skeleton, vertex, lx, ly, lz) {
  const out = [0, 0, 0];
  const apply = (joints, weights) => {
    if (!joints || !weights) return;
    const base = vertex * 4;
    for (let k = 0; k < 4; k++) {
      const w = weights[base + k];
      if (!(w > 0)) continue;
      const bone = joints[base + k];
      const mo = bone * 16;
      const m = skeleton.boneMatrices;
      out[0] += w * (m[mo] * lx + m[mo + 4] * ly + m[mo + 8] * lz + m[mo + 12]);
      out[1] += w * (m[mo + 1] * lx + m[mo + 5] * ly + m[mo + 9] * lz + m[mo + 13]);
      out[2] += w * (m[mo + 2] * lx + m[mo + 6] * ly + m[mo + 10] * lz + m[mo + 14]);
    }
  };
  apply(skeleton.joints, skeleton.weights);
  apply(skeleton.joints1, skeleton.weights1);
  return out;
}

function xform(world, p) {
  return [
    world[0] * p[0] + world[4] * p[1] + world[8] * p[2] + world[12],
    world[1] * p[0] + world[5] * p[1] + world[9] * p[2] + world[13],
    world[2] * p[0] + world[6] * p[1] + world[10] * p[2] + world[14],
  ];
}

await mkdir(OUT, { recursive: true });
const glbBuf = await readFile(GLB);
const glbHash = sha256(glbBuf);

const browser = await chromium.connectOverCDP("http://127.0.0.1:9222");
const context = browser.contexts()[0];
const page = await context.newPage();
const created = page;
try {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForFunction(
    () => globalThis.BODY_PREVIEW?.ready === true && typeof BODY_PREVIEW.setClip === "function",
    null,
    { timeout: 120000 },
  );
  await page.evaluate(async () => {
    await BODY_PREVIEW.load("/characters/bodies/human-animated-v1.glb");
  });
  await page.waitForFunction(
    () => BODY_PREVIEW.selectedUrl?.includes("human-animated-v1.glb") && BODY_PREVIEW.clipNames.includes("walk"),
    null,
    { timeout: 60000 },
  );
  await page.evaluate((t) => {
    BODY_PREVIEW.setChromeVisible(false);
    BODY_PREVIEW.setClip("walk", t, true);
    BODY_PREVIEW.seek(t);
    BODY_PREVIEW.view("front");
    BODY_PREVIEW.pause(true);
  }, WALK_T);
  await page.waitForTimeout(600);

  const live = await page.evaluate(() => {
    const d = BODY_PREVIEW.diagnostics();
    const meshes = BODY_PREVIEW.getMeshes ? BODY_PREVIEW.getMeshes() : [];
    const pal = BODY_PREVIEW.samplePalette();
    const samples = [];
    for (const mesh of meshes) {
      const name = mesh.name || "";
      const pos = mesh._cpuPositions;
      const sk = mesh.skeleton;
      const world = mesh.worldMatrix;
      if (!pos || !sk?.boneMatrices || !sk.joints || !sk.weights || !world) continue;
      const n = (pos.length / 3) | 0;
      const isBody = /body/i.test(name) && !/short/i.test(name);
      const isShorts = /short/i.test(name);
      if (!isBody && !isShorts) continue;
      const picked = [];
      for (let v = 0; v < n; v++) {
        const lx = pos[v * 3], ly = pos[v * 3 + 1], lz = pos[v * 3 + 2];
        const front = lz > 0.02;
        const abdomen = isBody && Math.abs(lx) < 0.07 && ly > 0.88 && ly < 1.08 && front;
        const waist = isShorts && Math.abs(lx) < 0.09 && ly > 0.90 && ly < 1.02 && front;
        if (!abdomen && !waist) continue;
        const joints = [];
        const weights = [];
        let sum = 0;
        for (let k = 0; k < 4; k++) {
          const w = sk.weights[v * 4 + k];
          const j = sk.joints[v * 4 + k];
          joints.push(j);
          weights.push(w);
          sum += w || 0;
        }
        const local = [0, 0, 0];
        const m = sk.boneMatrices;
        for (let k = 0; k < 4; k++) {
          const w = weights[k];
          if (!(w > 0)) continue;
          const mo = joints[k] * 16;
          local[0] += w * (m[mo] * lx + m[mo + 4] * ly + m[mo + 8] * lz + m[mo + 12]);
          local[1] += w * (m[mo + 1] * lx + m[mo + 5] * ly + m[mo + 9] * lz + m[mo + 13]);
          local[2] += w * (m[mo + 2] * lx + m[mo + 6] * ly + m[mo + 10] * lz + m[mo + 14]);
        }
        const worldP = [
          world[0] * local[0] + world[4] * local[1] + world[8] * local[2] + world[12],
          world[1] * local[0] + world[5] * local[1] + world[9] * local[2] + world[13],
          world[2] * local[0] + world[6] * local[1] + world[10] * local[2] + world[14],
        ];
        picked.push({
          mesh: name,
          vertexId: v,
          bindGltfYup: [lx, ly, lz],
          posedGltfYup: worldP,
          jointIndices: joints,
          weights,
          weightSum: sum,
          units: "meters",
        });
      }
      picked.sort((a, b) => Math.abs(a.bindGltfYup[0]) - Math.abs(b.bindGltfYup[0]));
      samples.push({
        mesh: name,
        vertexCount: n,
        paletteFirst16: Array.from(sk.boneMatrices.subarray(0, 16)),
        patch: picked.slice(0, 10),
      });
    }
    return {
      url: d.url,
      clip: d.clip,
      time: d.time,
      meshCount: d.meshCount,
      skinBindings: d.skinBindings,
      uniqueSkeletons: d.uniqueSkeletons,
      paletteMeshCount: pal.length,
      palette0len: pal[0]?.length ?? 0,
      samples,
    };
  });

  const still = path.join(OUT, "lite-walk-0.3s.png");
  await page.locator("#viewport").screenshot({ path: still });

  const report = {
    liveRuntimeEvidence: true,
    glb: "public/characters/bodies/human-animated-v1.glb",
    sha256: glbHash,
    clip: "walk",
    timeSecRequested: WALK_T,
    timeSecObserved: live.time,
    clipObserved: live.clip,
    url: live.url,
    still,
    diagnostics: {
      meshCount: live.meshCount,
      skinBindings: live.skinBindings,
      uniqueSkeletons: live.uniqueSkeletons,
      paletteMeshCount: live.paletteMeshCount,
      palette0len: live.palette0len,
    },
    samples: live.samples,
    note: "glTF import triangulates; Lite vertex ids are not HumanBody blend ids (13380 vs ~14517).",
  };
  await writeFile(path.join(OUT, "diagnosis-live.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ok: true, still, clip: live.clip, time: live.time, hash: glbHash, meshes: live.samples.map((s) => [s.mesh, s.vertexCount, s.patch.length]) }, null, 2));
} finally {
  await created.close();
}
