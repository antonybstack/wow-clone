/** Live review sheet of the refactored Orc body with every garment slot cleared.
 * Offline renders are not acceptance (AGENTS.md) — this is the real renderer. */
import {chromium} from 'playwright';
import { CDP_URL } from '../lib/cdp.mjs';
import fs from 'node:fs/promises';
const dir = process.env.OUT || 've-capture/ashen-reach/orc-refactor';
await fs.mkdir(dir, {recursive: true});
const browser = await chromium.connectOverCDP(CDP_URL);
const context = browser.contexts()[0];
const page = context.pages().find(p => p.url().includes('ashen-reach.html')) || await context.newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message));
try {
    await page.bringToFront();
    await page.goto('http://127.0.0.1:5173/ashen-reach.html?play&clean', {waitUntil: 'commit'});
    await page.waitForFunction(() => globalThis.ASHEN?.ready, null, {timeout: 60000});
    await page.locator('#armory-launch').click();
    await page.waitForTimeout(300);
    await page.locator('[data-light]').check();
    await page.locator('[data-race]').selectOption('orc');
    await page.waitForFunction(() => ASHEN.equipment.race === 'orc' && !ASHEN.equipment.getStatus?.().pending, null, {timeout: 60000});
    for (const slot of ['helmet', 'torso', 'legs', 'boots', 'gloves', 'mainHand', 'offHand']) {
        await page.locator(`[data-equipment="${slot}"]`).selectOption('');
        await page.waitForFunction(() => !ASHEN.equipment.getStatus?.().pending, null, {timeout: 60000});
    }
    await page.waitForTimeout(500);
    for (const view of ['front', 'side', 'back', 'face', 'full']) {
        await page.locator(`[data-view="${view}"]`).click();
        await page.locator('[data-motion]').selectOption('idle');
        await page.locator('[data-time-slider]').fill('0');
        await page.waitForTimeout(400);
        await page.screenshot({path: `${dir}/nude-${view}.png`, clip: {x: 0, y: 0, width: 970, height: 813}});
    }
    console.log('captured', dir, '| errors:', errors.length, errors.slice(0, 3));
} finally {
    await browser.close();
}
