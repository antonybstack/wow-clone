/** M007 live motion: cross-set combinations worn through gameplay.
 *
 * Every pass is one page load. The point of this milestone is pieces from different outfits
 * mixed on one character, so the loadout changes while the game runs rather than between
 * navigations: that also shows the swap itself, which is where a fit breaks if it is going
 * to. Each combination gets an orbit for front, side and back, then walk into run into jump
 * and land, so the seams are seen moving rather than standing still.
 *
 * Page.startScreencast: https://chromedevtools.github.io/devtools-protocol/tot/Page/#method-startScreencast
 * Only run against an owned harness slot.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import {chromium} from 'playwright';

const port = Number(process.env.ASHEN_CDP_PORT), url = process.env.ASHEN_URL;
if (!port || !url) throw Error('ASHEN_CDP_PORT and ASHEN_URL required');
const base = url.split('?')[0];
const requestedRace = process.env.ASHEN_RACE || 'human';
if (!['human', 'orc', 'undead'].includes(requestedRace)) throw Error(`Unknown race ${requestedRace}`);
const dir = process.env.ASHEN_CAPTURE_DIR || `ve-capture/character-mmo/m007/motion-${requestedRace}`;

const EMPTY = {helmet: null, torso: null, legs: null, boots: null, gloves: null, mainHand: null, offHand: null};
const ALL_PASSES = [
    {id: 'wayfarer', label: 'Wayfarer, the shipped set', loadout: {...EMPTY, torso: 'wayfarerTunic', legs: 'wayfarerTrousers', boots: 'wayfarerBoots', mainHand: 'ironSword'}},
    {id: 'cross-hood', label: 'Graveweaver hood on the Wayfarer set', loadout: {...EMPTY, helmet: 'graveweaverHood', torso: 'wayfarerTunic', legs: 'wayfarerTrousers', boots: 'wayfarerBoots', mainHand: 'ironSword'}},
    {id: 'cross-pilgrim', label: 'Pilgrim tunic, Graveweaver skirt and gloves', loadout: {...EMPTY, torso: 'pilgrimTunic', legs: 'graveweaverSkirt', boots: 'wayfarerBoots', gloves: 'graveweaverGloves'}},
    {id: 'cuffs-no-boots', label: 'trousers with no boots: the cuff part appears', loadout: {...EMPTY, torso: 'wayfarerTunic', legs: 'wayfarerTrousers'}},
    {id: 'two-handed', label: 'two-handed greatstaff claims both hands', loadout: {...EMPTY, helmet: 'graveweaverHood', torso: 'graveweaverTop', legs: 'graveweaverSkirt', boots: 'wayfarerBoots', gloves: 'graveweaverGloves', mainHand: 'graveweaverGreatstaff'}},
];
const requestedPasses = process.env.ASHEN_M007_PASSES?.split(',').filter(Boolean);
const PASSES = requestedPasses ? ALL_PASSES.filter(pass => requestedPasses.includes(pass.id)) : ALL_PASSES;
if (!PASSES.length || requestedPasses?.some(id => !ALL_PASSES.some(pass => pass.id === id))) {
    throw Error('ASHEN_M007_PASSES has no valid matching pass');
}
const captureQuery = process.env.ASHEN_CAPTURE_QUERY ?? '';
const skirtTrimMm = process.env.ASHEN_SKIRT_TRIM_MM ?? '';
if (skirtTrimMm && skirtTrimMm !== '800') throw Error('Unsupported diagnostic skirt trim');
const orcBodyDir = process.env.ASHEN_ORC_BODY_DIR ?? '';
if (orcBodyDir && requestedRace !== 'orc') throw Error('Orc body candidate requires ASHEN_RACE=orc');

await fs.mkdir(path.join(dir, 'frames'), {recursive: true});
const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
const pages = browser.contexts().flatMap(c => c.pages());
const page = pages.find(p => p.url().startsWith(base)) ?? pages[0];
if (!page) throw Error('No owned page in this harness slot');

const errors = [], frames = [], writes = [], timeline = [];
page.on('pageerror', e => errors.push(String(e.message ?? e)));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
let skirtRequests = 0, manifestRequests = 0;
let orcBodyRequests = 0, orcManifestRequests = 0;
if (orcBodyDir) {
    // Route the candidate and its matching manifest together. The runtime's
    // normal byte/hash validation must pass before any visual comparison.
    await page.route('**/equipment-orc/manifest.json', async route => {
        orcManifestRequests++;
        await route.fulfill({status: 200, contentType: 'application/json', body:
            await fs.readFile(path.join(orcBodyDir, 'manifest.json'))});
    });
    await page.route('**/equipment-orc/body.glb*', async route => {
        orcBodyRequests++;
        await route.fulfill({status: 200, contentType: 'model/gltf-binary', body:
            await fs.readFile(path.join(orcBodyDir, 'body.glb'))});
    });
}
if (skirtTrimMm) {
    // Route both the asset and manifest so the normal streamed loader checks
    // the candidate's bytes/hash before showing the trimmed undertrousers.
    await page.route('**/__garment_fit__/manifest.json', async route => {
        manifestRequests++;
        await route.fulfill({status: 200, contentType: 'application/json', body:
            await fs.readFile(`.cache/character-mmo/m007/graveweaverSkirt-undertrousers-${skirtTrimMm}mm.json`)});
    });
    await page.route('**/__garment_fit__/graveweaverSkirt.glb', async route => {
        skirtRequests++;
        await route.fulfill({status: 200, contentType: 'model/gltf-binary', body:
            await fs.readFile(`.cache/character-mmo/m007/graveweaverSkirt-undertrousers-${skirtTrimMm}mm.glb`)});
    });
}
const cdp = await page.context().newCDPSession(page);
let recording = false;
cdp.on('Page.screencastFrame', e => {
    cdp.send('Page.screencastFrameAck', {sessionId: e.sessionId}).catch(() => {});
    if (!recording) return;
    const name = `frame-${String(frames.length).padStart(5, '0')}.jpg`;
    frames.push({name, time: e.metadata.timestamp, width: e.metadata.deviceWidth, height: e.metadata.deviceHeight});
    writes.push(fs.writeFile(path.join(dir, 'frames', name), Buffer.from(e.data, 'base64')));
});
const pause = ms => page.waitForTimeout(ms);
const mark = label => timeline.push({frame: frames.length, label});

async function orbit(page, degrees, ms) {
    await page.evaluate(async ([deg, duration]) => {
        const from = ASHEN.rig.yaw, to = from + deg * Math.PI / 180;
        const t0 = performance.now();
        for (;;) {
            const k = Math.min(1, (performance.now() - t0) / duration);
            ASHEN.rig.yaw = from + (to - from) * k;
            if (k >= 1) return;
            await new Promise(requestAnimationFrame);
        }
    }, [degrees, ms]);
}

let canvas = null;
try {
    await page.setViewportSize({width: 1280, height: 720});
    await page.goto(`${base}?play&clean&pixelRatio=1${captureQuery ? `&${captureQuery}` : ''}`);
    await page.waitForFunction(() => globalThis.ASHEN?.whenPlayable, null, {timeout: 90000});
    await page.evaluate(() => ASHEN.whenRest);
    if (requestedRace !== 'human') await page.evaluate(race => ASHEN.equipment.switchRace(race), requestedRace);
    if (await page.evaluate(() => ASHEN.equipment.race) !== requestedRace) throw Error(`Failed to switch to ${requestedRace}`);
    // A wardrobe demo walks through a churchyard full of hostiles. The first capture ran
    // without this and the character was killed a third of the way in, so two thirds of the
    // clip was a death screen rather than a garment.
    await page.evaluate(() => {
        ASHEN.dev.god = true;
        ASHEN.setView('play');
        ASHEN.rig.pitch = 0.08;
        ASHEN.rig.distance = ASHEN.rig.distanceTarget = 3.4;
    });
    canvas = await page.evaluate(() => [document.getElementById('renderCanvas').width, document.getElementById('renderCanvas').height]);
    recording = true;
    await cdp.send('Page.startScreencast', {format: 'jpeg', quality: 84, maxWidth: 1280, maxHeight: 720, everyNthFrame: 2});

    for (const pass of PASSES) {
        const applied = await page.evaluate(l => ASHEN.equipment.setLoadout(l), pass.loadout);
        if (applied.status !== 'applied') errors.push(`${pass.id}: loadout ${applied.status}`);
        await page.waitForFunction(() => !ASHEN.equipment.getStatus?.()?.pending, null, {timeout: 30000});
        await pause(400);
        mark(`${pass.label} — orbit`);
        await orbit(page, 360, 2800);
        mark(`${pass.label} — walk, run, jump and land`);
        await page.keyboard.down('KeyW'); await pause(900);
        await page.keyboard.down('ShiftLeft'); await pause(800); await page.keyboard.up('ShiftLeft');
        await page.keyboard.press('Space'); await pause(900);
        await page.keyboard.up('KeyW'); await pause(350);
        await page.screenshot({path: path.join(dir, `${pass.id}.png`)});
        if (await page.evaluate(() => ASHEN.combat.snapshot().life.dead)) {
            throw Error(`${pass.id}: the character died during the capture`);
        }
    }

    // Rapid swaps, on camera: five torso requests in flight at once.
    mark('five torso swaps in flight at once, settling on the last request');
    const swapped = await page.evaluate(async () => {
        const requests = ['wayfarerTunic', 'pilgrimTunic', 'graveweaverTop', 'wayfarerTunic', 'pilgrimTunic'];
        const results = await Promise.all(requests.map(id => ASHEN.equipment.equip('torso', id)));
        return {requests, statuses: results.map(r => r.status), final: ASHEN.equipment.getState().torso};
    });
    if (swapped.final !== swapped.requests.at(-1)) errors.push(`rapid swap settled on ${swapped.final}`);
    await pause(700);
    await orbit(page, 200, 1300);
    if (skirtTrimMm && (skirtRequests !== 1 || manifestRequests !== 1)) {
        throw Error(`Diagnostic skirt/manifest requests: ${skirtRequests}/${manifestRequests}`);
    }
    if (orcBodyDir && (orcBodyRequests !== 1 || orcManifestRequests !== 1)) {
        throw Error(`Orc body/manifest requests: ${orcBodyRequests}/${orcManifestRequests}`);
    }

    recording = false;
    await cdp.send('Page.stopScreencast');
    await Promise.all(writes);
    // CDP frame metadata is the source of elapsed time. CDP can deliver completed frames out
    // of order, so sort by capture timestamp and discard exact duplicates before encoding.
    // See https://chromedevtools.github.io/devtools-protocol/tot/Page/#event-screencastFrame
    const endCanvas = await page.evaluate(() => [document.getElementById('renderCanvas').width, document.getElementById('renderCanvas').height]);
    if (frames.length < 2 || canvas.join('x') !== '1280x720' || endCanvas.join('x') !== canvas.join('x'))
        throw Error(`Capture canvas changed: ${canvas} -> ${endCanvas}`);
    if (frames.some(f => f.width !== 1280 || f.height !== 720))
        throw Error(`Capture frame dimensions changed: ${[...new Set(frames.map(f => `${f.width}x${f.height}`))]}`);
    if (frames.some(f => !Number.isFinite(f.time))) throw Error('Capture timestamp missing');
    const outOfOrder = frames.reduce((n, f, i) => n + (i > 0 && f.time < frames[i - 1].time ? 1 : 0), 0);
    const byTime = frames.toSorted((a, b) => a.time - b.time);
    const ordered = byTime.filter((f, i) => i === 0 || f.time !== byTime[i - 1].time);
    if (ordered.length < 2) throw Error('Capture contains fewer than two unique timestamps');
    let concat = 'ffconcat version 1.0\n';
    for (let i = 0; i < ordered.length; i++) {
        concat += `file 'frames/${ordered[i].name}'\n`;
        if (i + 1 < ordered.length) concat += `duration ${Math.max(0.001, ordered[i + 1].time - ordered[i].time).toFixed(6)}\n`;
    }
    await fs.writeFile(path.join(dir, 'frames.ffconcat'), concat);
    await fs.writeFile(path.join(dir, 'capture-manifest.json'), JSON.stringify({
        sourceUrl: page.url(), race: requestedRace, captureQuery, skirtTrimMm, orcBodyDir,
        viewport: [1280, 720], canvas,
        frames: ordered.map(f => ({name: f.name, timestamp: f.time, width: f.width, height: f.height})),
    }, null, 2) + '\n');
    await fs.writeFile(path.join(dir, 'recording.json'), `${JSON.stringify({
        sourceUrl: base, race: requestedRace, passes: PASSES, captureQuery, skirtTrimMm, orcBodyDir,
        skirtRequests, manifestRequests, orcBodyRequests, orcManifestRequests,
        viewport: [1280, 720], canvas, rapidSwap: swapped,
        frames: frames.length, encodedFrames: ordered.length,
        outOfOrderArrivals: outOfOrder, discardedDuplicateTimestamps: frames.length - ordered.length,
        frameDimensions: [...new Set(frames.map(f => `${f.width}x${f.height}`))],
        firstTimestamp: ordered[0].time, lastTimestamp: ordered.at(-1).time, timeline, errors,
    }, null, 2)}\n`);
    console.log(JSON.stringify({frames: frames.length, canvas, seconds: Number((frames.at(-1)?.time - frames[0]?.time).toFixed(3)), rapidSwap: swapped.final, errors}));
} finally {
    recording = false;
    await cdp.send('Page.stopScreencast').catch(() => {});
    await cdp.detach().catch(() => {});
    await page.goto('about:blank').catch(() => {});
    await browser.close();
}
