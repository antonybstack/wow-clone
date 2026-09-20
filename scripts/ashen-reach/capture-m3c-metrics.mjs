import {chromium} from 'playwright';
import { CDP_URL } from '../lib/cdp.mjs';

// M3c required evidence: triangles (procedural batches) and live draw calls after both defect
// fixes, for direct comparison against the pre-fix baseline recorded in the session.
const browser = await chromium.connectOverCDP(CDP_URL);
const context = browser.contexts()[0];
let page = context.pages().find(p => p.url().includes('ashen-reach.html')) || await context.newPage();
await page.bringToFront();
await page.goto((process.env.ASHEN_URL||'http://127.0.0.1:5173/ashen-reach.html?play&clean'), {waitUntil:'commit'});
await page.waitForFunction(() => window.ASHEN?.ready, null, {timeout: 60000});
await page.waitForTimeout(1500);
const stats = await page.evaluate(() => ({
 worldStats: window.ASHEN.world.stats,
 drawCalls: window.ASHEN.engine.drawCallCount,
 summary: window.ASHEN.metrics.summary(),
}));
console.log(JSON.stringify(stats, null, 2));
await browser.close();
