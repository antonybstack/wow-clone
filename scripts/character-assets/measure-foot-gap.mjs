#!/usr/bin/env node
/**
 * Per-foot ground-gap measurement: clusters low-Y skinned vertices by their
 * world-Z (front/back stride separation, body faces +Z) into two feet and
 * reports minY per foot, plus the global minY, using the same
 * BODY_PREVIEW.measureGroundedSole() instrument the codebase already exposes
 * (src/character/preview/sole.js), which reads live skinned CPU vertex
 * positions -- not the bind-pose "extents" the capture report's framing
 * field stores.
 *
 * CAUTION, measured 2026-09-20: at Idle_Loop t=0 this reports the Undead and
 * Orc source-bind bodies as nearly IDENTICAL (Undead footA 0.030 m / footB
 * 0.015 m; Orc footA 0.029 m / footB 0.024 m -- both within noise of each
 * other), which does not match the visibly larger gap on the Undead in
 * ve-capture/m11a/verify/*.png versus ve-capture/m11a/orcctl/*.png. That
 * means t=0 is NOT the pose those PNGs were captured at (the capture
 * invocation's exact --time flag, if any, was not recorded in the report
 * JSON -- a real gap in capture-undead-body.mjs's own reporting). Sweep
 * across the clip with sweep-foot-gap.mjs to find the time that reproduces
 * the visible divergence before trusting a single-time reading from this
 * script.
 */
import { chromium } from 'playwright';

const VITE_PORT = process.env.ASHEN_VITE_PORT || '5273';
const CDP_URL = process.env.ASHEN_CDP_URL || 'http://127.0.0.1:9437';

const browser = await chromium.connectOverCDP(CDP_URL);
const context = browser.contexts()[0];
const pageUrl = `http://127.0.0.1:${VITE_PORT}/body-preview.html`;
const page = context.pages().find((p) => p.url().includes('body-preview')) || (await context.newPage());
await page.goto(pageUrl, { waitUntil: 'load' });
await page.setViewportSize({ width: 1280, height: 1600 });
await page.waitForFunction(() => globalThis.BODY_PREVIEW?.ready === true, null, { timeout: 90000 });

const CLIP = 'Idle_Loop';
const TIME = 0;

async function measure(target, warmup) {
  return page.evaluate(async ([targetUrl, warmupUrl, clip, time]) => {
    const p = globalThis.BODY_PREVIEW;
    await p.load(warmupUrl);
    await new Promise((r) => setTimeout(r, 300));
    await p.load(targetUrl);
    p.setChromeVisible(false);
    p.setClip(clip, time, true);
    p.pause(true);
    await new Promise((r) => setTimeout(r, 500));

    function transformPoint(m, x, y, z) {
      return [
        m[0] * x + m[4] * y + m[8] * z + m[12],
        m[1] * x + m[5] * y + m[9] * z + m[13],
        m[2] * x + m[6] * y + m[10] * z + m[14],
      ];
    }
    function accumulateSkinned(skeleton, vertex, lx, ly, lz, out) {
      const bm = skeleton.boneMatrices;
      if (!bm) return false;
      const apply = (joints, weights) => {
        if (!joints || !weights) return;
        const base = vertex * 4;
        for (let k = 0; k < 4; k++) {
          const w = weights[base + k];
          if (!(w > 0)) continue;
          const bone = joints[base + k];
          const mo = bone * 16;
          out[0] += w * (bm[mo] * lx + bm[mo + 4] * ly + bm[mo + 8] * lz + bm[mo + 12]);
          out[1] += w * (bm[mo + 1] * lx + bm[mo + 5] * ly + bm[mo + 9] * lz + bm[mo + 13]);
          out[2] += w * (bm[mo + 2] * lx + bm[mo + 6] * ly + bm[mo + 10] * lz + bm[mo + 14]);
        }
      };
      apply(skeleton.joints, skeleton.weights);
      apply(skeleton.joints1, skeleton.weights1);
      return true;
    }

    const meshes = p.scene.meshes.filter((m) => m.skeleton);
    const low = []; // {x,y,z}
    let globalMinY = Infinity;
    let globalMinPt = null;
    const local = [0, 0, 0];
    for (const mesh of meshes) {
      const positions = mesh._cpuPositions;
      const skeleton = mesh.skeleton;
      const world = mesh.worldMatrix;
      if (!positions || !world) continue;
      const vcount = (positions.length / 3) | 0;
      const canSkin = skeleton && skeleton.boneMatrices && skeleton.joints && skeleton.weights;
      for (let v = 0; v < vcount; v++) {
        const o = v * 3;
        const lx = positions[o], ly = positions[o + 1], lz = positions[o + 2];
        let x, y, z;
        if (canSkin) {
          local[0] = 0; local[1] = 0; local[2] = 0;
          if (!accumulateSkinned(skeleton, v, lx, ly, lz, local)) continue;
          [x, y, z] = transformPoint(world, local[0], local[1], local[2]);
        } else {
          [x, y, z] = transformPoint(world, lx, ly, lz);
        }
        if (!Number.isFinite(y)) continue;
        if (y < globalMinY) { globalMinY = y; globalMinPt = [x, y, z]; }
        if (y < 0.35) low.push([x, y, z]);
      }
    }
    // cluster low vertices into two feet by world Z (stride separation)
    low.sort((a, b) => a[2] - b[2]);
    const mid = low.length ? low[Math.floor(low.length / 2)][2] : 0;
    let backMinY = Infinity, backMinPt = null, frontMinY = Infinity, frontMinPt = null;
    let backCount = 0, frontCount = 0;
    for (const [x, y, z] of low) {
      if (z < mid) { backCount++; if (y < backMinY) { backMinY = y; backMinPt = [x, y, z]; } }
      else { frontCount++; if (y < frontMinY) { frontMinY = y; frontMinPt = [x, y, z]; } }
    }

    return {
      url: p.selectedUrl,
      globalMinY, globalMinPt,
      lowVertexCount: low.length,
      splitZ: mid,
      footA: { count: backCount, minY: backMinY === Infinity ? null : backMinY, pt: backMinPt },
      footB: { count: frontCount, minY: frontMinY === Infinity ? null : frontMinY, pt: frontMinPt },
    };
  }, [target, warmup, CLIP, TIME]);
}

const undead = await measure('/characters/candidates/undead-source-v1.glb', '/characters/candidates/orc-source-v1.glb');
const orc = await measure('/characters/candidates/orc-source-v1.glb', '/characters/candidates/undead-source-v1.glb');

console.log('UNDEAD', JSON.stringify(undead, null, 2));
console.log('ORC', JSON.stringify(orc, null, 2));
// leave the shared harness browser context alive for later captures
