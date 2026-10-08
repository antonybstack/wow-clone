/** M6/1: every equipment slot swapped during every source motion, on every published race.
 *
 * One owned renderer, functional only, no FPS acceptance. The milestone's claim is that a
 * player can change any piece at any moment; what was actually evidenced before this was
 * torso swaps while walking, so this walks the whole slot x motion x race matrix instead.
 *
 * Pose continuity is the interesting measurement. A swap that restarts the character's
 * animation is invisible to a before/after comparison of currentTime, because an idle clip
 * that looped once reads lower afterwards than it did before. So each swap records the wall
 * clock across it and asserts every clip that was playing on both sides advanced by that
 * elapsed time times its speed ratio, modulo its own duration. A pose reset then shows up as
 * a clip sitting near zero while the clock says it should be most of the way round.
 *
 * Route: the default production path. The ?creator=1 route serves the DEV garment-fit
 * candidate manifest, which carries nine items and no shoulders, Lector or Duskguard fit, so
 * it cannot exercise five of the eighteen catalogue items at all.
 */
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { browserOwnership } from '../lib/browser-ownership.mjs';
import { EQUIPMENT_ITEMS, EQUIPMENT_SLOTS } from '../../src/ashen-reach/equipment-catalog.js';

const url = process.env.ASHEN_TEST_URL, port = process.env.ASHEN_CDP_PORT, out = process.argv[2];
assert(url && port && out, 'ASHEN_TEST_URL, ASHEN_CDP_PORT and an output path are required');
const only = name => {
    const raw = process.env[`ASHEN_ONLY_${name}`];
    return raw ? new Set(raw.split(',')) : null;
};
const onlyRaces = only('RACES'), onlyMotions = only('MOTIONS'), onlySlots = only('SLOTS');

// Every catalogue item for each slot, then the empty slot last where the resolver allows it.
// Removing a piece is a swap a player makes as often as replacing one, so it is in the matrix
// rather than assumed equivalent.
const UNEQUIPPABLE = new Set(['helmet', 'gloves', 'boots', 'shoulders', 'offHand', 'mainHand']);
const ROTATION = Object.fromEntries(EQUIPMENT_SLOTS.map(slot => {
    const ids = Object.entries(EQUIPMENT_ITEMS).filter(([, item]) => item.slot === slot).map(([id]) => id);
    return [slot, UNEQUIPPABLE.has(slot) ? [...ids, null] : ids];
}));

/** The mesh names a piece owns. A garment declares its parts; a factory prop's meshes are
 * named with the factory as their prefix, and `startsWith` keeps greatstaffWood out of the
 * staff's set. Guessing the id as a mesh name instead makes every swap look like a failure. */
const meshNamesFor = (id, sceneNames) => {
    const item = id ? EQUIPMENT_ITEMS[id] : null;
    if (!item) return [];
    if (item.parts?.length) return item.parts.map(part => part.mesh);
    if (item.asset) return [...item.asset.meshes];
    if (!item.factory) return [];
    const prefix = item.factory.toLowerCase();
    return sceneNames.filter(name => name.toLowerCase().startsWith(prefix));
};

const MOTIONS = ['idle', 'walk', 'sprint', 'air', 'land', 'cast', 'melee'];
const RACES = ['human', 'orc', 'undead'];
// A swap costs 67-182 ms, so it can legally straddle a phase boundary; the air window is
// about 550 ms and the landing about 350 ms. What must never happen is the swap putting the
// character back on the ground: loco while ungrounded is the failure, not air -> land.
const LEGAL_PHASE = { idle: ['loco'], walk: ['loco'], sprint: ['loco'], air: ['air', 'land'], land: ['land', 'loco'], cast: ['loco'], melee: ['loco'] };

const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
assert(browser.contexts().flatMap(c => c.pages()).every(p => p.url() === 'about:blank'), 'Another owned page is active');
const ownership = await browserOwnership(browser, { cdpPort: port, url, purpose: 'M6/1 per-slot hot swap under motion; functional only', renderingClients: 1 });
await fs.writeFile(out + '.ownership.json', JSON.stringify(ownership, null, 2));
const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 }),
    page = await context.newPage();
const rows = [], failures = [], errors = [];
const report = {
    url,
    conditions: 'Default production route, one owned rendering client, functional swap correctness only. No FPS or capacity claim.',
    matrix: { races: RACES, motions: MOTIONS, slots: EQUIPMENT_SLOTS, rotation: ROTATION },
    rows, failures, errors,
};
page.on('pageerror', e => errors.push(e.stack));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 400)); });

/** Everything observable about the character in one evaluate, so before/after share a frame. */
const sample = () => page.evaluate(() => {
    const body = ASHEN.body, sockets = ASHEN.sockets;
    const socket = slot => {
        const bone = sockets.sockets[slot]?.bone;
        const p = bone ? sockets.toCapsule(bone) : null;
        return p ? { x: +p.x.toFixed(5), y: +p.y.toFixed(5), z: +p.z.toFixed(5) } : null;
    };
    const named = new Set(ASHEN.scene.meshes.map(m => m.name));
    return {
        clock: performance.now(),
        state: body.getState(),
        label: body.getClipLabel(),
        grounded: ASHEN.player.getGrounded?.() ?? null,
        playing: body.animationGroups.filter(g => g.isPlaying && g.weight > 0.01)
            .map(g => ({ name: g.name, weight: +g.weight.toFixed(4), time: g.currentTime, duration: g.duration, rate: g.speedRatio })),
        equip: ASHEN.equipment.getState(),
        status: ASHEN.equipment.getStatus?.() ?? null,
        // scene.meshes membership rather than the visible flag: an evicted mesh keeps
        // visible:true, so the flag alone is not proof anything renders.
        sceneMeshes: named.size,
        sceneNames: [...named],
        visibleMeshes: ASHEN.scene.meshes.filter(m => m.visible !== false && m.isEnabled?.() !== false).map(m => m.name).sort(),
        triangles: ASHEN.metrics.summary().sceneTriangles,
        gpuErrors: ASHEN.gpu.errors.slice(),
    };
});

const ready = async () => {
    await page.waitForFunction(() => globalThis.ASHEN?.whenRest, null, { timeout: 120000 });
    await page.evaluate(() => ASHEN.whenRest);
};
const settle = async ms => { await page.waitForTimeout(ms); };

/** Hold the motion this phase needs and prove it is actually established. */
const enter = async motion => {
    // Back to spawn first. Without this the matrix walks and sprints the character away over
    // 168 rows until no hostile is in range at all, and every cast row then fails for a reason
    // that is not a swap defect. reset() also switches to the reference camera, so the play
    // view goes back on behind it.
    await page.evaluate(() => { ASHEN.reset(); ASHEN.setView('play'); });
    await settle(250);
    if (motion === 'walk') { await page.keyboard.down('ShiftLeft'); await page.keyboard.down('KeyW'); await settle(900); }
    else if (motion === 'sprint') { await page.keyboard.down('KeyW'); await settle(900); }
    else if (motion === 'air' || motion === 'land') {
        await page.focus('#renderCanvas');
        await page.keyboard.down('Space'); await settle(60); await page.keyboard.up('Space');
        await settle(motion === 'air' ? 120 : 620);
    } else if (motion === 'cast') {
        // Tab cycles every hostile and the ability refuses one that is out of range, behind
        // cover or on cooldown, so neither naming a target nor pressing once holds across a
        // run that walks the character around the region. Cycle and try until a cast is
        // actually in progress: this seeks the precondition, it never retries a measurement.
        for (let attempt = 0; attempt < 24 && !await page.evaluate(() => ASHEN.body.getState().castingShoot); attempt++) {
            await page.keyboard.press('Digit1'); await settle(140);
            if (await page.evaluate(() => ASHEN.body.getState().castingShoot)) break;
            await page.keyboard.press('Tab'); await settle(160);
        }
    } else if (motion === 'melee') {
        const started = await page.evaluate(() => ASHEN.body.playMelee());
        assert.equal(started, true, 'playMelee refused; the melee phase was never entered');
        await settle(60);
    } else await settle(200);
    const s = await sample();
    // Refuse to measure a phase that did not happen. A skipped phase reported as a pass is
    // the failure mode this whole matrix exists to rule out.
    if (motion === 'walk' || motion === 'sprint') assert.equal(s.state.locoName, motion === 'walk' ? 'Walk_Loop' : 'Sprint_Loop', `${motion} did not establish: ${s.label}`);
    if (motion === 'air') assert.equal(s.state.phase, 'air', `air did not establish: ${s.label}`);
    if (motion === 'land') assert.equal(s.state.phase, 'land', `land did not establish: ${s.label}`);
    if (motion === 'cast') assert.equal(s.state.castingShoot, true, `cast did not establish: ${s.label}`);
    if (motion === 'melee') assert.equal(s.state.melee, true, `melee did not establish: ${s.label}`);
    if (motion === 'idle') assert.equal(s.state.locoName, 'Idle_Loop', `idle did not establish: ${s.label}`);
    return s;
};
const leave = async motion => {
    if (motion === 'walk') { await page.keyboard.up('KeyW'); await page.keyboard.up('ShiftLeft'); }
    if (motion === 'sprint') await page.keyboard.up('KeyW');
    if (motion === 'air' || motion === 'land') await page.waitForFunction(() => ASHEN.body.getState().phase === 'loco', null, { timeout: 8000 });
    if (motion === 'cast') { await page.waitForFunction(() => !ASHEN.body.getState().castingShoot, null, { timeout: 8000 }); await settle(1100); }
    if (motion === 'melee') { await page.evaluate(() => ASHEN.body.cancelMelee()); await settle(200); }
    await settle(motion === 'idle' ? 100 : 400);
};

/** Expected clip advance, modulo its own duration: this is the pose-reset detector.
 *
 * The wrap-aware distance alone is not enough. A control that restarted the clips mid-window
 * was caught on Walk_Carry_Loop (0.893 off) but missed on Sprint_Loop, whose 0.667 s duration
 * let the restart land within 1.4 ms of where the loop would legitimately have wrapped to. So
 * each clip also reports whether a wrap was possible at all in the window; when it was not,
 * the clip time must not have gone backwards, and that case cannot alias.
 */
const poseDrift = (before, after, elapsedMs) => {
    const drift = [];
    for (const b of before.playing) {
        const a = after.playing.find(p => p.name === b.name);
        if (!a || !b.duration) continue;
        const advance = (elapsedMs / 1000) * (b.rate || 1);
        const expected = (b.time + advance) % b.duration;
        const raw = Math.abs(a.time - expected);
        drift.push({
            name: b.name, before: +b.time.toFixed(4), after: +a.time.toFixed(4), expected: +expected.toFixed(4),
            offBy: +Math.min(raw, b.duration - raw).toFixed(4),
            // False when the clip could not have reached its end in this window, which makes a
            // backwards clip time a restart with no other reading.
            couldWrap: b.time + advance >= b.duration,
            wentBack: a.time < b.time - 1e-6,
        });
    }
    return drift;
};

const cursor = Object.fromEntries(EQUIPMENT_SLOTS.map(slot => [slot, 0]));
try {
    await page.goto(url);
    await ready();
    await page.evaluate(() => { ASHEN.dev.god = true; });
    await page.focus('#renderCanvas');

    for (const race of RACES) {
        if (onlyRaces && !onlyRaces.has(race)) continue;
        if (await page.evaluate(() => ASHEN.equipment.race) !== race) {
            const result = await page.evaluate(r => ASHEN.equipment.switchRace(r), race);
            assert.notEqual(result?.status, 'failed', `switchRace(${race}) failed: ${result?.error}`);
            await ready();
        }
        for (const motion of MOTIONS) {
            if (onlyMotions && !onlyMotions.has(motion)) continue;
            for (const slot of EQUIPMENT_SLOTS) {
                if (onlySlots && !onlySlots.has(slot)) continue;
                const rotation = ROTATION[slot];
                const current = await page.evaluate(s => ASHEN.equipment.getState()[s] ?? null, slot);
                // Advance to the next entry that is not already worn, so every row is a real change.
                let target = null;
                for (let i = 0; i < rotation.length; i++) {
                    const candidate = rotation[(cursor[slot] + i) % rotation.length];
                    if (candidate !== current) { target = candidate; cursor[slot] = (cursor[slot] + i + 1) % rotation.length; break; }
                }
                const row = { race, motion, slot, from: current, to: target };
                try {
                    const before = await enter(motion);
                    await page.evaluate(() => ASHEN.renderLoop.beginMeasurement());
                    const result = await page.evaluate(([s, id]) => ASHEN.equipment.equip(s, id), [slot, target]);
                    const after = await sample();
                    // A resident swap can finish inside one frame, which leaves no interval to
                    // judge; keep measuring briefly past it so the frame it lands on is sampled.
                    // The second sample also widens the pose window: twenty milliseconds is
                    // barely a frame, and a reset that lands on the material build a frame or
                    // two later would otherwise fall outside the comparison entirely.
                    await settle(220);
                    const settled = await sample();
                    const intervals = await page.evaluate(() => ASHEN.renderLoop.endMeasurement());
                    const elapsedMs = after.clock - before.clock;
                    Object.assign(row, {
                        result, elapsedMs: +elapsedMs.toFixed(1),
                        phase: { before: before.state.phase, after: after.state.phase, grounded: after.grounded },
                        label: { before: before.label, after: after.label },
                        drift: poseDrift(before, after, elapsedMs),
                        driftSettled: poseDrift(before, settled, settled.clock - before.clock),
                        worstFrameMs: intervals.length ? +Math.max(...intervals).toFixed(2) : null,
                        frames: intervals.length,
                        triangles: { before: before.triangles, after: after.triangles },
                        sockets: { mainHand: after.state.holdWeapon, cached: after.status?.cached?.length ?? null },
                        // The streamed pack caches a piece after its first load, so a warm swap
                        // is a different measurement from a cold one and the budget needs both.
                        // `cached` is a bounded residency cache that disposes idle pieces, so
                        // this says whether the piece was still resident -- not whether its bytes
                        // were ever downloaded. No first-download cost is measured here.
                        residentBefore: target ? (before.status?.cached?.includes(target) ?? null) : null,
                        meshes: { target: meshNamesFor(target, settled.sceneNames), previous: meshNamesFor(current, before.sceneNames) },
                        // A two-handed main hand occupies the off hand, so the resolver may
                        // legitimately change a slot this row did not ask for. Record it.
                        alsoChanged: Object.fromEntries(Object.entries(after.equip).filter(([k, v]) => k !== slot && (before.equip[k] ?? null) !== (v ?? null))),
                        equip: after.equip,
                    });

                    assert.equal(result.status, 'applied', `${race}/${motion}/${slot} -> ${target}: ${result.error}`);
                    assert.equal(after.equip[slot] ?? null, target, `${slot} did not take ${target}`);
                    assert(LEGAL_PHASE[motion].includes(after.state.phase), `${motion} swap left phase ${after.state.phase}`);
                    // Sprinting over uneven ground legitimately leaves the character briefly
                    // ungrounded while still in loco, so this is only a failure when the swap
                    // collapsed an actual jump: airborne before, grounded loco after.
                    if (before.state.phase === 'air') assert(after.state.phase !== 'loco' || after.grounded !== false, 'The swap ended the jump while the character was still airborne');
                    // A reset snaps a clip to zero; a tenth of a second of tolerance covers the
                    // frame the swap lands on without admitting a restart.
                    for (const d of [...row.drift, ...row.driftSettled]) {
                        assert(d.offBy < 0.1, `${d.name} pose discontinuity: ${d.after} against an expected ${d.expected}`);
                        assert(!(d.wentBack && !d.couldWrap), `${d.name} restarted: ${d.before} -> ${d.after} with no wrap available`);
                    }
                    // Render proof, not a visible flag: the piece now worn must be a scene
                    // member and actually shown, and the piece taken off must not still be
                    // drawn. Hand props are cached rather than disposed, so they stay in
                    // scene.meshes after being unequipped and only the visibility tells.
                    const shown = new Set(settled.visibleMeshes);
                    if (target) {
                        assert(row.meshes.target.length, `${target} resolves to no mesh name, so nothing was proved`);
                        assert(row.meshes.target.every(m => settled.sceneNames.includes(m)), `${target} is not a scene member after the swap`);
                        assert(row.meshes.target.some(m => shown.has(m)), `${target} is equipped but nothing of it renders`);
                    }
                    if (current && current !== target) {
                        // Pieces share part meshes on purpose: the Graveweaver skirt is worn over
                        // the Wayfarer trousers and declares that mesh as one of its own parts, so
                        // only the meshes the new piece does not also claim must stop rendering.
                        const shared = new Set(row.meshes.target);
                        const stale = row.meshes.previous.filter(m => !shared.has(m) && shown.has(m));
                        assert.deepEqual(stale, [], `${current} still renders after being replaced by ${target}`);
                    }
                    assert.deepEqual(settled.gpuErrors, [], 'GPU errors during the swap');
                    assert(row.worstFrameMs === null || row.worstFrameMs <= 33.33, `A single swap cost a ${row.worstFrameMs} ms frame`);
                    row.passed = true;
                } catch (error) {
                    row.passed = false; row.error = error.message;
                    failures.push({ race, motion, slot, to: target, error: error.message });
                } finally {
                    await leave(motion).catch(e => { row.leaveError = e.message; });
                    rows.push(row);
                    await fs.writeFile(out, JSON.stringify(report, null, 2));
                    console.log(JSON.stringify({ race, motion, slot, to: target, passed: row.passed, ms: row.elapsedMs, worst: row.worstFrameMs, err: row.error }));
                }
            }
        }
    }
    report.passed = failures.length === 0 && errors.length === 0;
} catch (e) {
    report.failure = e.stack;
    console.error(e);
} finally {
    if (!report.passed) process.exitCode = 1;
    report.summary = { rows: rows.length, failed: failures.length, consoleErrors: errors.length };
    await fs.writeFile(out, JSON.stringify(report, null, 2));
    await context.close();
    await browser.close();
    await fs.writeFile(out + '.ownership.json', JSON.stringify({ ...ownership, active: false, renderingClients: 0 }, null, 2));
    console.log(JSON.stringify(report.summary));
}
