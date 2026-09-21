#!/usr/bin/env node
/**
 * Sweep Idle_Loop time (13 samples over the 2.5s duration) and report the
 * global grounded-sole minY for Undead vs Orc at each, to find the point in
 * the clip where they diverge -- t=0 alone does not (see measure-foot-gap.mjs
 * header). NOT YET RUN as of 2026-09-20; written and syntax-checked
 * (`node --check`) but the sweep itself was not executed before handoff.
 * Next step for whoever picks this up: run it, find the time where Undead's
 * minY visibly exceeds Orc's, then re-capture both at that --time with
 * capture-undead-body.mjs and diff against the existing
 * ve-capture/m11a/verify vs ve-capture/m11a/orcctl stills to confirm it
 * reproduces the reviewed pose before reporting a final metres number.
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
const DURATION = 2.5;
const SAMPLES = 13;

async function loadTarget(target, warmup) {
  await page.evaluate(async ([targetUrl, warmupUrl]) => {
    const p = globalThis.BODY_PREVIEW;
    await p.load(warmupUrl);
    await new Promise((r) => setTimeout(r, 300));
    await p.load(targetUrl);
    p.setChromeVisible(false);
  }, [target, warmup]);
}

async function sampleAt(time) {
  return page.evaluate(async ([clip, t]) => {
    const p = globalThis.BODY_PREVIEW;
    p.setClip(clip, t, true);
    p.pause(true);
    await new Promise((r) => setTimeout(r, 120));
    return p.measureGroundedSole();
  }, [CLIP, time]);
}

async function sweep(target, warmup) {
  await loadTarget(target, warmup);
  const rows = [];
  for (let i = 0; i < SAMPLES; i++) {
    const t = (i / (SAMPLES - 1)) * DURATION;
    const sole = await sampleAt(t);
    rows.push({ t: Number(t.toFixed(3)), minY: sole.minY });
  }
  return rows;
}

const undead = await sweep('/characters/candidates/undead-source-v1.glb', '/characters/candidates/orc-source-v1.glb');
const orc = await sweep('/characters/candidates/orc-source-v1.glb', '/characters/candidates/undead-source-v1.glb');

console.log('t       undead_minY   orc_minY');
for (let i = 0; i < SAMPLES; i++) {
  console.log(`${undead[i].t.toFixed(3).padStart(6)}  ${undead[i].minY.toFixed(4).padStart(10)}   ${orc[i].minY.toFixed(4).padStart(10)}`);
}
// leave the shared harness browser context alive for later captures
