import {chromium} from 'playwright';
import { CDP_URL } from '../lib/cdp.mjs';
import fs from 'node:fs/promises';

const label = process.argv[2]; // 'before' | 'after'
const outDir = process.argv[3];
await fs.mkdir(outDir, {recursive:true});

const browser = await chromium.connectOverCDP(CDP_URL);
const context = browser.contexts()[0];
let page = context.pages().find(p => p.url().includes('ashen-reach.html')) || await context.newPage();
await page.setViewportSize({width:960,height:540});
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

await page.bringToFront();
await page.goto(process.env.ASHEN_URL||'http://127.0.0.1:5173/ashen-reach.html?play&clean', {waitUntil:'commit'});
await page.waitForFunction(() => window.ASHEN?.ready, null, {timeout: 60000});
await page.waitForTimeout(2500);

// Spawn view screenshot: reset to spawn but keep the gameplay camera (reset() itself flips to
// the reference-pose camera, which is not the world view we want to compare).
await page.evaluate(() => { window.ASHEN.reset(); window.ASHEN.setView('play'); });
await page.waitForTimeout(800);
await page.screenshot({path: `${outDir}/${label}-spawn.png`});

// Measure FPS: reset to spawn again, walk forward for a few seconds so it's gameplay not a static frame.
await page.evaluate(() => { window.ASHEN.reset(); window.ASHEN.setView('play'); });
await page.waitForTimeout(300);
await page.keyboard.down('KeyW');
await page.waitForTimeout(600);
await page.keyboard.up('KeyW');
// give the frame-time ring buffer time to fill with post-warmup samples (main.js gates on elapsed>4s)
await page.waitForTimeout(5000);
const metrics = await page.evaluate(() => window.ASHEN.metrics.summary());

const result = {label, errors, metrics};
console.log(JSON.stringify(result, null, 2));
await fs.writeFile(`${outDir}/${label}-metrics.json`, JSON.stringify(result, null, 2));
await browser.close();
