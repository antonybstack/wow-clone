import {chromium} from 'playwright';
import { CDP_URL } from '../lib/cdp.mjs';
import fs from 'node:fs/promises';

// M3c required evidence: live-walk proof that the road stays walkable to z>=134 after both defect
// fixes (unchanged from M3b's own walk pattern, just re-run against the m3c build).
const outDir = 've-capture/ashen-reach/world-expansion-m3c/walk';
await fs.mkdir(outDir, {recursive:true});

const browser = await chromium.connectOverCDP(CDP_URL);
const context = browser.contexts()[0];
let page = context.pages().find(p => p.url().includes('ashen-reach.html')) || await context.newPage();
await page.setViewportSize({width:960,height:540});
await page.bringToFront();
await page.goto((process.env.ASHEN_URL||'http://127.0.0.1:5173/ashen-reach.html?play&clean')+'&noEnemies', {waitUntil:'commit'});
await page.waitForFunction(() => window.ASHEN?.ready, null, {timeout: 60000});
await page.waitForTimeout(1000);

await page.evaluate(() => { window.ASHEN.reset(); window.ASHEN.setView('play'); });
await page.waitForTimeout(300);

await page.keyboard.down('KeyW');
const samples = [];
for (let i = 0; i < 45; i++) {
 await page.waitForTimeout(500);
 const z = await page.evaluate(() => window.ASHEN.player.getDebugState().position.z);
 samples.push(z);
}
await page.keyboard.up('KeyW');
await page.waitForTimeout(300);
await page.screenshot({path: `${outDir}/walked-to-north-edge.png`});

console.log(JSON.stringify({samples, maxZ: Math.max(...samples.filter(z=>z!=null))}, null, 2));
await fs.writeFile(`${outDir}/walk-samples.json`, JSON.stringify(samples, null, 2));
await browser.close();
