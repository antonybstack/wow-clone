/** Capture per-outfit Orc garment stills in body-preview. */
import {chromium} from 'playwright';
import fs from 'node:fs/promises';

const root = process.argv[2] || 've-capture/orc-motion/orc-fits-v3';
const outfits = [
    ['wayfarer', '/characters/candidates/orc-wayfarer-preview.glb'],
    ['pilgrim', '/characters/candidates/orc-pilgrim-preview.glb'],
    ['graveweaver', '/characters/candidates/orc-graveweaver-preview.glb'],
];
const shots = [
    ['Idle_Loop', 0.5, 'front', 'idle-front'],
    ['Idle_Loop', 0.5, 'side', 'idle-side'],
    ['Idle_Loop', 0.5, 'three-quarter', 'idle-three-quarter'],
    ['Walk_Loop', 0.333333, 'side', 'walk-side'],
    ['Walk_Loop', 0.333333, 'front', 'walk-front'],
    ['Sprint_Loop', 0.166667, 'side', 'sprint-side'],
];
const browser = await chromium.connectOverCDP('http://127.0.0.1:9337');
const ctx = browser.contexts()[0];
const page = ctx.pages().find(p => p.url().includes('body-preview.html')) || await ctx.newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
try {
    await page.bringToFront();
    await page.goto('http://127.0.0.1:5173/body-preview.html?m2-motion', {waitUntil: 'commit'});
    await page.waitForFunction(() => window.BODY_PREVIEW?.ready, null, {timeout: 60000});
    for (const [outfit, url] of outfits) {
        const dir = root + '/' + outfit;
        await fs.mkdir(dir, {recursive: true});
        const info = await page.evaluate(async u => {
            const r = await BODY_PREVIEW.load(u);
            return {clips: BODY_PREVIEW.clipNames?.length ?? 0, result: r ? 'ok' : 'stale'};
        }, url);
        console.log(outfit, url, info.clips, 'clips', info.result);
        for (const [clip, time, view, name] of shots) {
            await page.evaluate(([c, t, v]) => {
                BODY_PREVIEW.setClip(c, t, true);
                BODY_PREVIEW.view(v);
            }, [clip, time, view]);
            await page.waitForTimeout(350);
            await page.screenshot({path: dir + '/' + name + '.png'});
        }
    }
    console.log('captured', outfits.length * shots.length, 'stills to', root, '| errors:', errors.length);
    if (errors.length) console.log(errors.slice(0, 8));
} finally {
    await browser.close();
}
