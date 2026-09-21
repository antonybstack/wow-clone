#!/usr/bin/env node
/**
 * Sweep Idle_Loop time (13 samples over the 2.5s duration) and report the
 * global grounded-sole minY for Undead vs Orc at each.
 *
 * RESULT, run 2026-09-20: there is no divergent frame. The Undead's lowest
 * vertex is lower than the Orc's at all 13 samples (Undead 0.0142-0.0178 m,
 * Orc 0.0231-0.0287 m), same curve shape, never crossing. So the visible
 * floating-feet defect was not a root-height problem -- see the header of
 * measure-foot-gap.mjs for what it actually was.
 *
 * Rows print as they are taken rather than only at the end. The first version
 * buffered everything to a final console.log, which made a slow run
 * indistinguishable from a hung one and cost two abandoned attempts.
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
    process.stderr.write(`  ${target.split('/').pop()} t=${t.toFixed(3)} minY=${sole.minY?.toFixed(4)}\n`);
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
// browser.close() on a connectOverCDP() connection tears down the shared browser
// context and leaves the slot's Chrome with zero pages. Disconnect instead.
process.exit(0);
