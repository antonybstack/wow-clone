/** Slice 1 Orc audition: load the source-compatible Orc candidate in the
 * authored-body preview, freeze matched phases, capture review stills.
 * Mirrors the Human bind-v2 visual evidence (matched screenshots, not proof
 * of finished art). Usage: node scripts/character-assets/review-orc-motion.mjs
 * [outDir] */
import {chromium} from 'playwright';
import { CDP_URL } from '../lib/cdp.mjs';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';

const dir = process.argv[2] || 've-capture/orc-motion/bind-v1';
await fs.mkdir(dir, {recursive: true});
const ORC = '/characters/candidates/orc-source-v1.glb';
const HUMAN = '/characters/candidates/human-source-v1.glb';

const browser = await chromium.connectOverCDP(CDP_URL);
const ctx = browser.contexts()[0];
const page = ctx.pages().find(p => p.url().includes('body-preview.html')) || await ctx.newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
try {
    await page.bringToFront();
    await page.goto('http://127.0.0.1:5173/body-preview.html?m2-motion', {waitUntil: 'commit'});
    await page.waitForFunction(() => window.BODY_PREVIEW?.ready, null, {timeout: 60000});
    const load = url => page.evaluate(async u => {
        const r = await BODY_PREVIEW.load(u);
        return {clips: BODY_PREVIEW.clipNames, extents: BODY_PREVIEW.diagnostics().extents ?? null, result: r ? 'ok' : 'stale'};
    }, url);
    for (const url of [ORC, HUMAN]) {
        const info = await load(url);
        assert.ok(info.clips.includes('Idle_Loop') && info.clips.includes('Walk_Loop') && info.clips.includes('Sprint_Loop'), url + ' missing core clips');
        console.log(url, info.clips.length + ' clips');
    }
    // Orc evidence set.
    await page.evaluate(u => BODY_PREVIEW.load(u), ORC);
    await page.waitForTimeout(800);
    // Hand target is the FK RightHand world at the frozen Idle phase
    // (offline: rest [-0.938,1.698,0.024] -> idle0.5 [-0.462,1.088,-0.044]).
    // The preview's extents-fallback assumes a hanging A-pose and misses.
    const HAND_TARGET = {x: -0.462, y: 1.088, z: -0.044};
    const shots = [
        ['Idle_Loop', 0.5, 'front', 'orc-idle-front'],
        ['Idle_Loop', 0.5, 'side', 'orc-idle-side'],
        ['Idle_Loop', 0.5, 'three-quarter', 'orc-idle-three-quarter'],
        ['Idle_Loop', 0.5, 'hands', 'orc-idle-hands', HAND_TARGET],
        ['Walk_Loop', 0.333333, 'side', 'orc-walk-side'],
        ['Walk_Loop', 0.333333, 'front', 'orc-walk-front'],
        ['Sprint_Loop', 0.166667, 'side', 'orc-sprint-side'],
    ];
    for (const [clip, time, view, name, hand] of shots) {
        await page.evaluate(([c, t, v, h]) => {
            BODY_PREVIEW.setClip(c, t, true); BODY_PREVIEW.view(v);
            if (h) { BODY_PREVIEW.camera.target.x = h.x; BODY_PREVIEW.camera.target.y = h.y; BODY_PREVIEW.camera.target.z = h.z; BODY_PREVIEW.camera.radius = 0.7; }
        }, [clip, time, view, hand ?? null]);
        await page.waitForTimeout(400);
        await page.screenshot({path: dir + '/' + name + '.png'});
    }
    // Human reference front for the report.
    await page.evaluate(u => BODY_PREVIEW.load(u), HUMAN);
    await page.waitForTimeout(800);
    await page.evaluate(() => { BODY_PREVIEW.setClip('Idle_Loop', 0.5, true); BODY_PREVIEW.view('front'); });
    await page.waitForTimeout(400);
    await page.screenshot({path: dir + '/human-idle-front.png'});
    console.log('captured', shots.length + 1, 'stills to', dir, '| errors:', errors.length);
    if (errors.length) console.log(errors.slice(0, 5));
} finally {
    await browser.close();
}
