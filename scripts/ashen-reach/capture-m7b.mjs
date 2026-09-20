import { chromium } from "playwright";
import { CDP_URL } from "../lib/cdp.mjs";
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const url =
  process.env.ASHEN_URL ||
  "http://127.0.0.1:5473/ashen-reach.html?play&clean";
const dir = process.env.M7B_CAPTURE_DIR || "ve-capture/ashen-reach/m7b-r2";
await fs.mkdir(dir, { recursive: true });

const browser = await chromium.connectOverCDP(CDP_URL);
const page = browser.contexts()[0].pages().find((p) =>
  p.url().includes("ashen-reach.html"),
);

async function settle(ms = 400) {
  await page.waitForTimeout(ms);
}

async function metrics() {
  return page.evaluate(() => {
    const report = (m) => {
      const parent = m.parent;
      return {
        name: m.name,
        hasVisibleFlag: Object.prototype.hasOwnProperty.call(m, "visible"),
        parented: !!parent,
        parentName: parent?.name || null,
        local: m.position
          ? { x: m.position.x, y: m.position.y, z: m.position.z }
          : null,
        tris: m._cpuIndices
          ? m._cpuIndices.length / 3
          : (m._gpu?.indexCount || 0) / 3,
      };
    };
    const enemies = ASHEN.combat.enemies.map((e) => {
      const g = e.actor?.silhouette;
      const hidden = g?.hiddenBones || [];
      return {
        id: e.id,
        clip: e.actor?.clipName,
        state: e.state,
        bound: g?.bound || null,
        triangles: g?.triangles ?? 0,
        hiddenBones: hidden,
        hiddenUnique: [...new Set(hidden)],
        garmentMeshes: (g?.meshes || []).map(report),
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
}

/** Plant the subject on the path, park the other three shades, lock idle. */
async function plantSubject(z = 10) {
  return page.evaluate(({ z }) => {
    const pathX = (zz) => Math.sin(zz * 0.14) * 1.25;
    const x = pathX(z);
    const yGround = ASHEN.world.groundHeight;
    for (let i = 1; i < ASHEN.combat.enemies.length; i++) {
      const o = ASHEN.combat.enemies[i];
      o.lockedState = "idle";
      o.state = "idle";
      o.idleFor = 99;
      o.position.x = 0;
      o.position.z = -40;
      o.position.y = yGround(0, -40);
      o.root.position.set(o.position.x, o.position.y, o.position.z);
    }
    const e = ASHEN.combat.enemies[0];
    e.lockedState = "idle";
    e.state = "idle";
    e.idleFor = 99;
    e.hidden = false;
    e.hp = e.hpMax;
    e.actor.setVisible(true);
    e.actor.play("idle");
    e.position.x = x;
    e.position.z = z;
    e.position.y = yGround(x, z);
    e.root.position.set(e.position.x, e.position.y, e.position.z);
    return { x, z, y: e.position.y };
  }, { z });
}

/**
 * Camera looks north at the player. Shade stands on the path in front of the
 * player (between camera and player) and a little to the right, so the player
 * does not sit inside the shade's silhouette.
 *
 * dist is camera-to-shade. playerBack is how far north of the shade the player
 * stands, so camera radius = dist + playerBack.
 */
async function frame({ dist, pitch, shadeYaw, playerRight = 0.45, playerBack = 0.35 }) {
  return page.evaluate(
    ({ dist, pitch, shadeYaw, playerRight, playerBack }) => {
      const e = ASHEN.combat.enemies[0];
      const x = e.position.x;
      const z = e.position.z;
      const px = x - playerRight;
      const pz = z + playerBack;
      const y = ASHEN.world.groundHeight(px, pz) + ASHEN.player.capsuleHeight / 2;
      ASHEN.player.setWorldPos(px, y, pz);
      ASHEN.player.setFacing(0);
      e.yaw = shadeYaw;
      if (e.root.rotationQuaternion) {
        e.root.rotationQuaternion.set(0, Math.sin(shadeYaw / 2), 0, Math.cos(shadeYaw / 2));
      }
      if (e.root.rotation) e.root.rotation.y = shadeYaw;
      ASHEN.rig.yaw = 0;
      ASHEN.rig.pitch = pitch;
      ASHEN.rig.distance = ASHEN.rig.distanceTarget = dist + playerBack;
      ASHEN.combat.targeting.select(e.id);
      ASHEN.setView("play");
    },
    { dist, pitch, shadeYaw, playerRight, playerBack },
  );
}

/** Move garment meshes out of the frustum by unparenting and parking them. */
async function setGarmentInFrustum(on) {
  return page.evaluate((on) => {
    const e = ASHEN.combat.enemies[0];
    const meshes = e.actor?.silhouette?.meshes || [];
    if (!on) {
      window.__m7bGarmentHome = meshes.map((m) => ({
        parent: m.parent,
        x: m.position.x,
        y: m.position.y,
        z: m.position.z,
      }));
      for (const m of meshes) {
        m.parent = null;
        m.position.set(0, 80, -80);
      }
    } else {
      const home = window.__m7bGarmentHome || [];
      meshes.forEach((m, i) => {
        const h = home[i];
        if (!h) return;
        m.parent = h.parent;
        m.position.set(h.x, h.y, h.z);
      });
    }
    e.actor?.silhouette?.sync();
    const summary = ASHEN.metrics.summary();
    return {
      on,
      sceneTriangles: summary.sceneTriangles,
      drawCalls: summary.drawCalls,
      parked: meshes.map((m) => ({
        name: m.name,
        parented: !!m.parent,
        y: m.position.y,
        z: m.position.z,
      })),
    };
  }, on);
}

async function shadeScreenBox() {
  return page.evaluate(() => {
    const cam = ASHEN.camera;
    const canvas = ASHEN.engine?.canvas || document.querySelector("canvas");
    const w = canvas?.width || 1280;
    const h = canvas?.height || 720;
    const e = ASHEN.combat.enemies[0];
    const pts = [];
    const push = (x, y, z) => pts.push([x, y, z]);
    const root = e.root.position;
    for (const dx of [-0.45, 0, 0.45]) {
      for (const dy of [0.05, 0.7, 1.15, 1.65]) {
        for (const dz of [-0.35, 0, 0.35]) push(root.x + dx, root.y + dy, root.z + dz);
      }
    }
    for (const m of e.actor?.silhouette?.meshes || []) {
      const wm = m.worldMatrix;
      if (wm) push(wm[12], wm[13], wm[14]);
    }
    const wm = cam.worldMatrix;
    if (!wm) return { w, h, found: false };
    const inv = invert(wm);
    const fov = cam.fov || 1.05;
    const aspect = w / h;
    const near = cam.nearPlane || 0.1;
    const f = 1 / Math.tan(fov / 2);
    let minX = w, minY = h, maxX = 0, maxY = 0, hits = 0;
    for (const [x, y, z] of pts) {
      const cx = inv[0] * x + inv[4] * y + inv[8] * z + inv[12];
      const cy = inv[1] * x + inv[5] * y + inv[9] * z + inv[13];
      const cz = inv[2] * x + inv[6] * y + inv[10] * z + inv[14];
      if (cz < near) continue;
      const ndcX = (cx * f / aspect) / cz;
      const ndcY = (cy * f) / cz;
      const sx = (ndcX * 0.5 + 0.5) * w;
      const sy = (-ndcY * 0.5 + 0.5) * h;
      if (!Number.isFinite(sx) || !Number.isFinite(sy)) continue;
      hits++;
      if (sx < minX) minX = sx;
      if (sy < minY) minY = sy;
      if (sx > maxX) maxX = sx;
      if (sy > maxY) maxY = sy;
    }
    const pad = 24;
    const box = {
      x: Math.max(0, Math.floor(minX - pad)),
      y: Math.max(0, Math.floor(minY - pad)),
      w: 0,
      h: 0,
    };
    box.w = Math.min(w, Math.ceil(maxX + pad)) - box.x;
    box.h = Math.min(h, Math.ceil(maxY + pad)) - box.y;
    return { canvasW: w, canvasH: h, hits, found: hits > 4 && box.w > 8 && box.h > 8, box };

    function invert(m) {
      const out = new Float32Array(16);
      const a00 = m[0], a01 = m[1], a02 = m[2], a03 = m[3];
      const a10 = m[4], a11 = m[5], a12 = m[6], a13 = m[7];
      const a20 = m[8], a21 = m[9], a22 = m[10], a23 = m[11];
      const a30 = m[12], a31 = m[13], a32 = m[14], a33 = m[15];
      const b00 = a00 * a11 - a01 * a10;
      const b01 = a00 * a12 - a02 * a10;
      const b02 = a00 * a13 - a03 * a10;
      const b03 = a01 * a12 - a02 * a11;
      const b04 = a01 * a13 - a03 * a11;
      const b05 = a02 * a13 - a03 * a12;
      const b06 = a20 * a31 - a21 * a30;
      const b07 = a20 * a32 - a22 * a30;
      const b08 = a20 * a33 - a23 * a30;
      const b09 = a21 * a32 - a22 * a31;
      const b10 = a21 * a33 - a23 * a31;
      const b11 = a22 * a33 - a23 * a32;
      let det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
      if (!det) return m;
      det = 1 / det;
      out[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det;
      out[1] = (a02 * b10 - a01 * b11 - a03 * b09) * det;
      out[2] = (a31 * b05 - a32 * b04 + a33 * b03) * det;
      out[3] = (a22 * b04 - a21 * b05 - a23 * b03) * det;
      out[4] = (a12 * b08 - a10 * b11 - a13 * b07) * det;
      out[5] = (a00 * b11 - a02 * b08 + a03 * b07) * det;
      out[6] = (a32 * b02 - a30 * b05 - a33 * b01) * det;
      out[7] = (a20 * b05 - a22 * b02 + a23 * b01) * det;
      out[8] = (a10 * b10 - a11 * b08 + a13 * b06) * det;
      out[9] = (a01 * b08 - a00 * b10 - a03 * b06) * det;
      out[10] = (a30 * b04 - a31 * b02 + a33 * b00) * det;
      out[11] = (a21 * b02 - a20 * b04 - a23 * b00) * det;
      out[12] = (a11 * b07 - a10 * b09 - a12 * b06) * det;
      out[13] = (a00 * b09 - a01 * b07 + a02 * b06) * det;
      out[14] = (a31 * b01 - a30 * b03 - a32 * b00) * det;
      out[15] = (a20 * b03 - a21 * b01 + a22 * b00) * det;
      return out;
    }
  });
}

async function shot(name) {
  const file = path.join(dir, `${name}.png`);
  await page.screenshot({ path: file });
  return file;
}

async function diffPair(aPath, bPath, outPath, box) {
  const [a, b] = await Promise.all([
    sharp(aPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
    sharp(bPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
  ]);
  if (a.info.width !== b.info.width || a.info.height !== b.info.height) {
    return { error: "size mismatch", before: a.info, after: b.info };
  }
  const { width, height } = a.info;
  const x0 = box ? Math.max(0, box.x) : 0;
  const y0 = box ? Math.max(0, box.y) : 0;
  const x1 = box ? Math.min(width, box.x + box.w) : width;
  const y1 = box ? Math.min(height, box.y + box.h) : height;
  const cw = Math.max(1, x1 - x0);
  const ch = Math.max(1, y1 - y0);
  const heat = Buffer.alloc(cw * ch * 3);
  let maxDiff = 0, sumDiff = 0, changedPixels = 0, sumLumaA = 0, sumLumaB = 0;
  let sumSqA = 0, sumSqB = 0;
  const n = cw * ch;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (y * width + x) * 4;
      const ox = x - x0;
      const oy = y - y0;
      const o = (oy * cw + ox) * 3;
      const dr = Math.abs(a.data[i] - b.data[i]);
      const dg = Math.abs(a.data[i + 1] - b.data[i + 1]);
      const db = Math.abs(a.data[i + 2] - b.data[i + 2]);
      const d = Math.max(dr, dg, db);
      const la = 0.2126 * a.data[i] + 0.7152 * a.data[i + 1] + 0.0722 * a.data[i + 2];
      const lb = 0.2126 * b.data[i] + 0.7152 * b.data[i + 1] + 0.0722 * b.data[i + 2];
      sumLumaA += la;
      sumLumaB += lb;
      sumSqA += la * la;
      sumSqB += lb * lb;
      if (d > 2) changedPixels++;
      sumDiff += d;
      if (d > maxDiff) maxDiff = d;
      heat[o] = d;
      heat[o + 1] = d > 2 ? 255 - d : 0;
      heat[o + 2] = 0;
    }
  }
  if (outPath) {
    await sharp(heat, { raw: { width: cw, height: ch, channels: 3 } }).png().toFile(outPath);
  }
  const meanA = sumLumaA / n;
  const meanB = sumLumaB / n;
  const stdA = Math.sqrt(Math.max(0, sumSqA / n - meanA * meanA));
  const stdB = Math.sqrt(Math.max(0, sumSqB / n - meanB * meanB));
  return {
    width: cw,
    height: ch,
    pixels: n,
    maxChannelDiff: maxDiff,
    meanChannelDiff: +(sumDiff / n).toFixed(4),
    changedPixels,
    changedPct: +((changedPixels / n) * 100).toFixed(4),
    lumaStdOff: +stdA.toFixed(2),
    lumaStdOn: +stdB.toFixed(2),
  };
}

async function pair(stem, { dist, pitch, shadeYaw }) {
  await plantSubject(10);
  await frame({ dist, pitch, shadeYaw });
  await settle(500);

  const offState = await setGarmentInFrustum(false);
  await settle(180);
  const offPath = await shot(`${stem}-off`);
  const box = await shadeScreenBox();

  const onState = await setGarmentInFrustum(true);
  await settle(180);
  const onPath = await shot(`${stem}-on`);
  const boxOn = await shadeScreenBox();

  const crop = boxOn.found ? boxOn.box : box.found ? box.box : null;
  const bboxDiff = await diffPair(offPath, onPath, path.join(dir, `${stem}-diff.png`), crop);
  const fullDiff = await diffPair(offPath, onPath, null, null);
  return {
    stem,
    dist,
    pitch,
    shadeYaw,
    offMetrics: offState,
    onMetrics: onState,
    box,
    boxOn,
    bboxDiff,
    fullDiff,
  };
}

try {
  await page.goto(url, { waitUntil: "commit" });
  await page.waitForFunction(() => window.ASHEN?.ready, null, {
    timeout: 90000,
  });
  await settle(800);

  const before = await metrics();
  await fs.writeFile(`${dir}/metrics.json`, JSON.stringify(before, null, 2));
  console.log(
    "metrics",
    before.drawCalls,
    "draws,",
    before.sceneTriangles,
    "scene tris, world",
    before.worldTriangles,
  );
  const g0 = before.enemies[0];
  console.log("bind", JSON.stringify(g0?.bound));
  console.log("garment tris", g0?.triangles);
  console.log("hiddenBones", g0?.hiddenBones?.length, "unique", g0?.hiddenUnique?.length);
  console.log("garmentMeshes", JSON.stringify(g0?.garmentMeshes));

  const assertions = [];
  const check = (name, ok) => {
    assertions.push({ name, ok: !!ok });
    console.log(ok ? "PASS" : "FAIL", name);
  };
  check("four shades", before.enemies.length === 4);
  check("world triangles unchanged", before.worldTriangles === 191846);
  for (const e of before.enemies) {
    check(`${e.id} head+back bound`, e.bound?.head === "mixamorig:Head" && e.bound?.back === "mixamorig:Spine2");
    check(`${e.id} 3 garment meshes parented`, e.garmentMeshes.length === 3 && e.garmentMeshes.every((m) => m.parented));
    check(`${e.id} named hood/void/cloak`, e.garmentMeshes.map((m) => m.name).join(",") === "ShadeHood,ShadeHoodVoid,ShadeCloak");
    check(`${e.id} hiddenBones unique`, e.hiddenBones.length === e.hiddenUnique.length);
    check(`${e.id} arms hidden`, e.hiddenUnique.includes("mixamorig:LeftArm") && e.hiddenUnique.includes("mixamorig:RightArm"));
    check(`${e.id} legs hidden`, e.hiddenUnique.includes("mixamorig:LeftLeg"));
  }

  const views = [
    { stem: "front-2.5m", dist: 2.5, pitch: 0.18, shadeYaw: Math.PI },
    { stem: "profile-2.5m", dist: 2.5, pitch: 0.16, shadeYaw: Math.PI / 2 },
    { stem: "play-8m", dist: 8.0, pitch: 0.10, shadeYaw: Math.PI },
  ];
  const pairs = [];
  for (const view of views) {
    const result = await pair(view.stem, view);
    pairs.push(result);
    console.log(
      result.stem,
      "bbox",
      result.bboxDiff.changedPct + "%",
      "mean",
      result.bboxDiff.meanChannelDiff,
      "full",
      result.fullDiff.changedPct + "%",
      "tris off/on",
      result.offMetrics.sceneTriangles,
      result.onMetrics.sceneTriangles,
    );
  }

  // Same-code control: two garment-on captures of the front framing, no move.
  await plantSubject(10);
  await frame({ dist: 2.5, pitch: 0.18, shadeYaw: Math.PI });
  await settle(400);
  const controlA = await shot("control-a");
  await settle(80);
  const controlB = await shot("control-b");
  const controlBox = await shadeScreenBox();
  const controlDiff = await diffPair(
    controlA,
    controlB,
    path.join(dir, "control-diff.png"),
    controlBox.found ? controlBox.box : null,
  );
  console.log("control noise", controlDiff.changedPct + "%", "mean", controlDiff.meanChannelDiff);

  // Death pose: seek near the end of Death01 and frame from the profile so
  // a crumple is readable. Keep deadAge below deathHideAfter.
  await plantSubject(10);
  const deathInfo = await page.evaluate(() => {
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
    const duration = death?.duration || 0;
    if (death) death.currentTime = Math.max(0, duration * 0.9);
    e.setColliderEnabled?.(false);
    for (let i = 0; i < 8; i++) e.actor.update(1 / 30);
    return {
      clip: e.actor.clipName,
      duration,
      currentTime: death?.currentTime ?? null,
      playing: !!death?.isPlaying,
    };
  });
  await frame({ dist: 2.8, pitch: 0.22, shadeYaw: Math.PI / 2, playerRight: 0.7, playerBack: 0.2 });
  await settle(250);
  await shot("death");
  console.log("death", JSON.stringify(deathInfo));

  const greeter = await page.evaluate(async () => {
    const { attachGreeter } = await import("/src/character/npc.js");
    const human = await attachGreeter(ASHEN.engine, ASHEN.scene);
    return {
      name: human.root.name,
      hasSilhouette: !!human.silhouette,
      meshNames: (human.meshes || []).map((m) => m.name),
    };
  });
  console.log("greeter", greeter);

  const after = await metrics();
  const report = {
    assertions,
    metrics: before,
    afterReloadMetrics: after,
    pairs: pairs.map((p) => ({
      stem: p.stem,
      dist: p.dist,
      shadeYaw: p.shadeYaw,
      sceneTrianglesOff: p.offMetrics.sceneTriangles,
      sceneTrianglesOn: p.onMetrics.sceneTriangles,
      drawCallsOff: p.offMetrics.drawCalls,
      drawCallsOn: p.onMetrics.drawCalls,
      parkedOff: p.offMetrics.parked,
      box: p.boxOn,
      bboxDiff: p.bboxDiff,
      fullDiff: p.fullDiff,
    })),
    controlDiff,
    death: deathInfo,
    greeter,
  };
  await fs.writeFile(`${dir}/report.json`, JSON.stringify(report, null, 2));
  await fs.writeFile(`${dir}/greeter.json`, JSON.stringify(greeter, null, 2));
  console.log("wrote screenshots to", dir);
  const failed = assertions.filter((a) => !a.ok);
  if (failed.length) {
    console.error("failed assertions", failed.map((f) => f.name).join("; "));
    process.exitCode = 1;
  }
} finally {
  await browser.close();
}
