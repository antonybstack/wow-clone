import { chromium } from "playwright";
import { CDP_URL } from "../lib/cdp.mjs";
import fs from 'node:fs/promises';

// M3b evidence: FPS/draws/triangles after the ground-mesh subdivision (defect-1 fix) and
// ridgeline base change (defect-2 fix), for comparison against the M3 baseline
// (143.97-144.01 FPS, 36 draws, 167,816 triangles, p95 ~8.3ms).
const url = (process.env.ASHEN_URL || "http://127.0.0.1:5173/ashen-reach.html?play&clean") + "&noEnemies";

const browser = await chromium.connectOverCDP(CDP_URL);
const page = browser.contexts()[0].pages().find((p) => p.url().includes("ashen-reach.html"))
  || await browser.contexts()[0].newPage();
await page.setViewportSize({width:960,height:540});
await page.bringToFront();
await page.goto(url, { waitUntil: "commit" });
await page.waitForFunction(() => window.ASHEN?.ready, null, { timeout: 60000 });
await page.waitForTimeout(1200);
await page.evaluate(() => ASHEN.setView("play"));
await page.evaluate(() => ASHEN.metrics.reset?.());
await page.waitForTimeout(9000);
const result = await page.evaluate(() => {
  const s = ASHEN.metrics.summary();
  return {
    ...s,
    viewport: { w: innerWidth, h: innerHeight },
    dpr: devicePixelRatio,
  };
});
console.log(JSON.stringify(result, null, 2));
await fs.mkdir('ve-capture/ashen-reach/world-expansion-m3b', {recursive:true});
await fs.writeFile('ve-capture/ashen-reach/world-expansion-m3b/fps-after.json', JSON.stringify(result, null, 2));
await browser.close();
