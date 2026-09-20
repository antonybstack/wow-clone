/** Judge-ready live review sheet of the Orc body.
 *
 * Offline renders are not acceptance (AGENTS.md) — every frame here comes out of
 * the real Ashen Reach renderer. The armory chrome is hidden for the shot so a
 * reviewer sees the character rather than the developer panel, and the camera is
 * pulled to a fixed distance per view so passes are comparable frame to frame.
 *
 *   node scripts/ashen-reach/review-orc-live.mjs [--nude] [--out DIR]
 */
import {chromium} from 'playwright';
import { CDP_URL } from '../lib/cdp.mjs';
import fs from 'node:fs/promises';

const argv = process.argv.slice(2);
const arg = (flag, fallback) => {
    const i = argv.indexOf(flag);
    return i >= 0 ? argv[i + 1] : fallback;
};
const dir = arg('--out', 've-capture/ashen-reach/orc-review');
const nude = argv.includes('--nude');
await fs.mkdir(dir, {recursive: true});

const browser = await chromium.connectOverCDP(CDP_URL);
const context = browser.contexts()[0];
const page = context.pages().find(p => p.url().includes('ashen-reach.html')) || await context.newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message));

// alpha is relative to the armory's default front framing; beta/radius are absolute.
const VIEWS = {
    front: {alpha: 0, beta: 1.42, radius: 3.5, height: 1.02},
    threequarter: {alpha: 0.85, beta: 1.40, radius: 3.5, height: 1.02},
    // Orbit to the character's LEFT for the profile. The churchyard has a fence
    // post about 4 m to the right of the spawn point, and at radius 3.5 it filled
    // the whole right-side frame — a reviewer got a wall instead of a silhouette.
    side: {alpha: -Math.PI / 2, beta: 1.44, radius: 3.5, height: 1.02},
    back: {alpha: Math.PI, beta: 1.42, radius: 3.5, height: 1.02},
    torso: {alpha: 0.40, beta: 1.36, radius: 1.9, height: 1.45},
    // beta 1.42 at height 1.72 looked DOWN on the crown from behind the ear —
    // the reviewer got a bald patch instead of a face and could not score the
    // skull or the muzzle at all. Near-level, and framed on the eyes.
    // Framed off the measured eye position rather than by eye: OrcV1Eyes bounds
    // run world y 1.963-2.002, and setFocus multiplies height by raceScale
    // 1.22 (measured 1.207 against the live camera target), so 1.65 puts the
    // target on the pupils. Everything before this was guessing, and at 1.58
    // the reviewer got the underside of the jaw.
    head: {alpha: 0.28, beta: 1.55, radius: 0.88, height: 1.65},
    // The muzzle has led the defect list in every single review, and it is a
    // projection error — only a profile can show it. There was no such frame.
    headside: {alpha: -Math.PI / 2, beta: 1.55, radius: 0.88, height: 1.65},
    legs: {alpha: 0.25, beta: 1.50, radius: 2.2, height: 0.55},
};

try {
    await page.bringToFront();
    // armory.update() slides the orbit target sideways to clear the equipment
    // panel whenever innerWidth > 760. Under that width the subject is centred,
    // which is what a review frame needs.
    await page.setViewportSize({width: 760, height: 940});
    await page.goto('http://127.0.0.1:5173/ashen-reach.html?play&clean', {waitUntil: 'commit'});
    await page.waitForFunction(() => globalThis.ASHEN?.ready, null, {timeout: 60000});
    await page.locator('#armory-launch').click();
    await page.waitForTimeout(300);
    await page.locator('[data-light]').check();
    await page.locator('[data-race]').selectOption('orc');
    await page.waitForFunction(() => ASHEN.equipment.race === 'orc' && !ASHEN.equipment.getStatus?.().pending,
        null, {timeout: 60000});
    if (nude) {
        for (const slot of ['helmet', 'torso', 'legs', 'boots', 'gloves', 'mainHand', 'offHand']) {
            await page.locator(`[data-equipment="${slot}"]`).selectOption('');
            await page.waitForFunction(() => !ASHEN.equipment.getStatus?.().pending, null, {timeout: 60000});
        }
    }
    await page.locator('[data-motion]').selectOption('idle');
    await page.locator('[data-time-slider]').fill('0');
    // Hide the panel/heading/footer: a reviewer should not be judging chrome, and
    // the right-hand panel is what forces the character off-centre.
    await page.addStyleTag({content: '.armory-heading,.armory-panel,.armory-tools{opacity:0 !important;pointer-events:none}'});

    for (const [view, v] of Object.entries(VIEWS)) {
        await page.evaluate(v => ASHEN.armory.setFocus({...v, alpha: Math.PI / 2 + v.alpha}), v);
        await page.waitForTimeout(450);
        await page.screenshot({path: `${dir}/${nude ? 'nude-' : 'kit-'}${view}.png`});
    }
    console.log('captured', dir, '| errors:', errors.length, errors.slice(0, 3));
} finally {
    await browser.close();
}
