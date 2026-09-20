/** Canvas-only palm shots. Replaces armory.update so the hand stays framed. */
import {chromium} from 'playwright';
import { CDP_URL } from '../lib/cdp.mjs';
import fs from 'node:fs/promises';

const dir = 've-capture/ashen-reach/orc-grips';
await fs.mkdir(dir, {recursive: true});
const browser = await chromium.connectOverCDP(CDP_URL);
const page = browser.contexts()[0].pages().find(p => p.url().includes('ashen-reach.html'))
    || await browser.contexts()[0].newPage();

const settled = () => page.waitForFunction(() => !ASHEN.equipment.getStatus?.().pending, null, {timeout: 60000});

try {
    await page.bringToFront();
    await page.goto('http://127.0.0.1:5173/ashen-reach.html?play&clean', {waitUntil: 'commit', timeout: 60000});
    await page.waitForFunction(() => globalThis.ASHEN?.ready, null, {timeout: 60000});
    await page.waitForTimeout(500);
    await page.locator('#armory-launch').click();
    await page.locator('[data-light]').check();

    const shoot = async (name, slot, preset, motion, alpha) => {
        await page.locator(`[data-outfit="${preset}"]`).click();
        await settled();
        await page.evaluate(({slot, motion, alpha}) => {
            const p = ASHEN.body.inspection;
            p.select(motion);
            p.setPaused(true);
            p.seek(motion === 'carry' ? 0.9 : 0.12);
            const c = ASHEN.armory.camera;
            ASHEN.armory.update = () => {
                const m = ASHEN.combat.fx.sockets.sockets[slot].node.worldMatrix;
                c.target.set(m[12], m[13] - 0.02, m[14]);
                c.radius = 0.52;
                c.alpha = alpha;
                c.beta = 1.42;
            };
        }, {slot, motion, alpha});
        await page.waitForTimeout(280);
        await page.locator('#renderCanvas').screenshot({path: `${dir}/${name}.png`});
    };

    for (const race of ['human', 'orc']) {
        await page.locator('[data-race]').selectOption(race);
        await page.waitForFunction(want => ASHEN.equipment.race === want && !ASHEN.equipment.getStatus?.().pending, race, {timeout: 60000});
        await shoot(`${race}-sword-canvas`, 'mainHand', 'wayfarer', 'idle', 0.85);
        await shoot(`${race}-sword-canvas-side`, 'mainHand', 'wayfarer', 'idle', 2.15);
        await shoot(`${race}-staff-canvas`, 'mainHand', 'graveweaver', 'idle', 0.85);
        await shoot(`${race}-book-canvas`, 'offHand', 'graveweaver', 'idle', 3.6);
        await shoot(`${race}-greatstaff-canvas`, 'mainHand', 'warden', 'carry', 0.7);
    }
} finally {
    process.exit(0);
}
