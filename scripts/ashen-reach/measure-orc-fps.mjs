import {chromium} from 'playwright';
import { CDP_URL } from '../lib/cdp.mjs';
const browser = await chromium.connectOverCDP(CDP_URL);
const context = browser.contexts()[0];
const page = context.pages().find(p => p.url().includes('ashen-reach.html')) || await context.newPage();
try {
    await page.bringToFront();
    await page.goto('http://127.0.0.1:5173/ashen-reach.html?play&clean', {waitUntil: 'commit'});
    await page.waitForFunction(() => globalThis.ASHEN?.ready, null, {timeout: 60000});
    await page.locator('#armory-launch').click();
    await page.waitForTimeout(300);
    await page.locator('[data-race]').selectOption('orc');
    await page.waitForFunction(() => ASHEN.equipment.race === 'orc' && !ASHEN.equipment.getStatus?.().pending, null, {timeout: 60000});
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1200);
    // Move around so the measurement is gameplay, not a static frame.
    for (const key of ['KeyW', 'KeyA', 'KeyD']) {
        await page.keyboard.down(key); await page.waitForTimeout(900); await page.keyboard.up(key);
    }
    await page.evaluate(() => ASHEN.metrics.reset?.());
    await page.keyboard.down('KeyW');
    await page.waitForTimeout(6000);
    await page.keyboard.up('KeyW');
    console.log(JSON.stringify(await page.evaluate(() => ASHEN.metrics.summary()), null, 1));
} finally { await browser.close(); }
