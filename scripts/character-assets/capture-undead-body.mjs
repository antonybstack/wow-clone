#!/usr/bin/env node
/**
 * Live body-preview capture for the Undead milestone.
 *
 * Two camera modes, because they answer different questions:
 *
 *  - `gameplay` reproduces src/ashen-reach/main.js exactly: fov 1.05 rad, radius 3.5 m,
 *    pivot at feet + CameraRig.pivotHeight (0.55). This is the only framing that says
 *    whether the skull reads while you are playing. A face that only works in a portrait
 *    has not passed.
 *  - `studio` uses the preview's own analytic presets (22 deg long lens) for the
 *    face close-up and for defect hunting.
 *
 * Usage:
 *   node scripts/character-assets/capture-undead-body.mjs \
 *     --url /characters/bodies/undead-animated-v1.glb --tag legacy \
 *     --clip idle --views front,side,back --mode gameplay
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { chromium } from 'playwright';
import { CDP_URL } from '../lib/cdp.mjs';

const VITE_PORT = process.env.ASHEN_VITE_PORT || 5173;

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : process.argv[i + 1];
}

const url = arg('url', '/characters/bodies/undead-animated-v1.glb');
const tag = arg('tag', 'undead');
const clip = arg('clip', null);
const time = Number(arg('time', '0'));
const mode = arg('mode', 'gameplay');
const views = arg('views', 'front,side,back').split(',').map((s) => s.trim()).filter(Boolean);
const outDir = path.resolve(arg('out', path.join('ve-capture', 'm11a', tag)));
const width = Number(arg('width', '1280'));
const height = Number(arg('height', '1600'));

/** Gameplay rig constants, mirrored from src/ashen-reach/main.js + src/camera-rig.js. */
const GAMEPLAY = { fov: 1.05, radius: 3.5, pitch: 0.04, pivotHeight: 0.55 };
/** alpha per named view, using CameraRig.alphaFromYaw(yaw) with the body facing +Z. */
const GAMEPLAY_ALPHA = {
  front: -Math.PI / 2,
  back: Math.PI / 2,
  side: 0,
  'side-left': Math.PI,
  'three-quarter': -Math.PI / 4,
};

await mkdir(outDir, { recursive: true });

const browser = await chromium.connectOverCDP(CDP_URL);
const context = browser.contexts()[0];
const pageUrl = `http://127.0.0.1:${VITE_PORT}/body-preview.html`;
const page = context.pages().find((p) => p.url().includes('body-preview')) || (await context.newPage());
const consoleErrors = [];
page.on('pageerror', (e) => consoleErrors.push(String(e.message)));
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });

if (!page.url().includes('body-preview')) await page.goto(pageUrl, { waitUntil: 'load' });
await page.setViewportSize({ width, height });
await page.waitForFunction(() => globalThis.BODY_PREVIEW?.ready === true, null, { timeout: 90000 });

const loadInfo = await page.evaluate(async (target) => {
  const p = globalThis.BODY_PREVIEW;
  await p.load(target);
  p.setChromeVisible(false);
  return { url: p.selectedUrl, clips: p.clipNames, diagnostics: p.diagnostics?.() ?? null };
}, url);

if (clip) {
  const has = loadInfo.clips.includes(clip);
  if (!has) console.warn(`! clip "${clip}" not in asset; available: ${loadInfo.clips.join(', ')}`);
  else await page.evaluate(([c, t]) => { globalThis.BODY_PREVIEW.setClip(c, t, true); globalThis.BODY_PREVIEW.pause(true); }, [clip, time]);
}

const canvas = page.locator('#renderCanvas');
const shots = [];
for (const view of views) {
  const framing = await page.evaluate(([v, m, g, alphas]) => {
    const p = globalThis.BODY_PREVIEW;
    if (m !== 'gameplay') {
      p.view(v);
      return { mode: 'studio', ...(p.viewParams(v) || {}) };
    }
    const cam = p.camera;
    const extents = p.diagnostics?.()?.extents ?? null;
    const footY = extents?.min?.[1] ?? 0;
    cam.fov = g.fov;
    cam.radius = g.radius;
    cam.alpha = alphas[v] ?? alphas.front;
    cam.beta = Math.PI / 2 - g.pitch;
    cam.target.x = 0;
    cam.target.y = footY + g.pivotHeight;
    cam.target.z = 0;
    cam.inertialAlphaOffset = 0; cam.inertialBetaOffset = 0; cam.inertialRadiusOffset = 0;
    return { mode: 'gameplay', alpha: cam.alpha, beta: cam.beta, radius: cam.radius, fov: cam.fov, target: { x: cam.target.x, y: cam.target.y, z: cam.target.z }, extents };
  }, [view, mode, GAMEPLAY, GAMEPLAY_ALPHA]);

  await page.waitForTimeout(450);
  const file = path.join(outDir, `${tag}-${mode}-${view}${clip ? `-${clip}` : ''}.png`);
  await canvas.screenshot({ path: file });
  shots.push({ view, file, framing });
  console.log(`captured ${file}`);
}

const report = { url: loadInfo.url, tag, mode, clip, clips: loadInfo.clips, shots, consoleErrors, diagnostics: loadInfo.diagnostics };
await writeFile(path.join(outDir, `report-${mode}${clip ? `-${clip}` : ''}.json`), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ ok: consoleErrors.length === 0, outDir, clips: loadInfo.clips.length, consoleErrors: consoleErrors.slice(0, 5) }, null, 2));
await browser.close();
