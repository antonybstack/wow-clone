import {chromium} from 'playwright';
import { CDP_URL } from '../lib/cdp.mjs';

/*
 * M3b churchyard-invariant evidence: a single reset-to-spawn screenshot. Used twice per
 * before/after pair -- once against the pre-M3b code, once against the current code -- to prove
 * the churchyard (z=0..40) renders unchanged. Since this repo may not be branched/stashed/reset
 * per the task's working constraints, the "before" shot is produced by temporarily overwriting
 * the edited files with their pre-M3b content on the SAME already-running dev server (Vite HMR
 * picks it up), capturing, then restoring the edited files from a backup copy, e.g.:
 *
 *   BK=<scratch dir>
 *   for f in geometry.js scene.js buildings.js horizon.js; do
 *     cp src/ashen-reach/$f "$BK/$f"
 *     git show dddc2e5:src/ashen-reach/$f > src/ashen-reach/$f
 *   done
 *   node scripts/ashen-reach/capture-m3b-churchyard-spawn.mjs before.png
 *   for f in geometry.js scene.js buildings.js horizon.js; do cp "$BK/$f" src/ashen-reach/$f; done
 *   node scripts/ashen-reach/capture-m3b-churchyard-spawn.mjs after.png
 *   node scripts/ashen-reach/diff-images.mjs before.png after.png diff-heat.png
 */
const outPath = process.argv[2];
if (!outPath) { console.error('usage: node capture-m3b-churchyard-spawn.mjs out.png'); process.exit(1); }

const browser = await chromium.connectOverCDP(CDP_URL);
const page = browser.contexts()[0].pages().find(p => p.url().includes('ashen-reach.html'));
await page.setViewportSize({width:960,height:540});
await page.bringToFront();
await page.goto((process.env.ASHEN_URL||'http://127.0.0.1:5173/ashen-reach.html?play&clean')+'&noEnemies', {waitUntil:'commit'});
await page.waitForFunction(() => window.ASHEN?.ready, null, {timeout: 60000});
await page.waitForTimeout(1500);
await page.evaluate(() => { window.ASHEN.reset(); });
await page.waitForTimeout(500);
await page.evaluate(() => { window.ASHEN.setView('play'); });
await page.waitForTimeout(1200);
await page.screenshot({path: outPath});
await browser.close();
