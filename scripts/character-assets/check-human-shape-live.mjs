/** M004 live check for the Human shape family in the actual Ashen Reach scene.
 *
 * Runs each of neutral / slender / stout, and the two height endpoints, through a real
 * page load in an owned harness slot. It asserts the things an offline render cannot:
 * that the morph weights reach the GPU mesh, that a morphed *skinned* body still enrolls
 * in the town's custom cascaded-shadow caster path without a shader-composition failure
 * (M003 hit exactly that with the native baked-animation path), that Havok is driving the
 * character, that the hand socket still holds the weapon after a height change, and that
 * the character actually moves under keyboard input.
 *
 * Stills are for review; motion is captured separately by record-m004-motion.mjs.
 * This script closes only its own tab state and leaves the slot's browser running.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {chromium} from 'playwright';

const port = Number(process.env.ASHEN_CDP_PORT), url = process.env.ASHEN_URL;
if (!port || !url) throw Error('ASHEN_CDP_PORT and ASHEN_URL required');
const base = url.split('?')[0];
const out = process.env.ASHEN_CAPTURE_DIR || 've-capture/character-mmo/m004/live';
const report = process.env.ASHEN_SHAPE_REPORT || 'docs/baselines/character-mmo/m004/live-shape-check.json';

const CASES = [
    {id: 'neutral', query: 'humanShape=neutral'},
    {id: 'slender', query: 'humanShape=slender'},
    {id: 'stout', query: 'humanShape=stout'},
    {id: 'blend', query: 'humanShape=slender:0.5,stout:0.5'},
    {id: 'short', query: 'humanShape=slender&humanHeight=0.9'},
    {id: 'tall', query: 'humanShape=stout&humanHeight=1.15'},
];

await fs.mkdir(out, {recursive: true});
const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
// Reuse the slot's own tab. It may already be parked on about:blank from a previous
// check, so match the game URL first and fall back to the single owned page rather
// than opening a second renderer in the same browser.
const pages = browser.contexts().flatMap(c => c.pages());
const page = pages.find(p => p.url().startsWith(base)) ?? pages[0];
if (!page) throw Error('No owned page in this harness slot');

const rows = [];
try {
    await page.setViewportSize({width: 1280, height: 720});
    for (const test of CASES) {
        const errors = [];
        const onError = e => errors.push(String(e.message ?? e));
        const onConsole = m => { if (m.type() === 'error') errors.push(m.text()); };
        page.on('pageerror', onError);
        page.on('console', onConsole);
        const target = `${base}?play&clean&pixelRatio=1&${test.query}`;
        await page.goto(target);
        await page.waitForFunction(() => globalThis.ASHEN?.whenPlayable, null, {timeout: 90000});
        await page.evaluate(() => ASHEN.whenPlayable);
        await page.evaluate(() => ASHEN.whenRest);

        const state = await page.evaluate(async () => {
            const meshes = [];
            const visit = node => {
                if (node?.morphTargets) {
                    meshes.push({
                        name: node.name ?? null,
                        targets: node.morphTargets.count,
                        weights: Array.from(node.morphTargets.weights),
                        skinned: !!(node.skeleton || node.boneMatrices),
                    });
                }
                for (const child of node?.children || []) visit(child);
            };
            visit(ASHEN.body.root);
            const debug = ASHEN.player.getDebugState();
            const socket = ASHEN.sockets?.mainHand?.node ?? null;
            return {
                request: ASHEN.humanShape,
                morphMeshes: meshes,
                usingPhysics: debug.usingPhysics,
                capsuleHeight: debug.capsuleHeight,
                heightScale: ASHEN.player.heightScale,
                rootScale: {x: ASHEN.body.root.scaling.x, y: ASHEN.body.root.scaling.y, z: ASHEN.body.root.scaling.z},
                pivotHeight: ASHEN.rig.pivotHeight,
                enemies: ASHEN.combat?.enemies?.length ?? null,
                canvas: [document.getElementById('renderCanvas').width, document.getElementById('renderCanvas').height],
                // Sockets are parented to the player capsule, so a socket that follows the
                // visual height proves hand and weapon placement moved with the body rather
                // than staying at the unscaled skeleton's height.
                socketY: socket ? Number(socket.position.y.toFixed(4)) : null,
                socketBone: ASHEN.sockets?.mainHand?.bone?.name ?? null,
                shadowCasters: ASHEN.world?.shadows?.casterCount ?? null,
            };
        });

        assert.equal(state.usingPhysics, true, `${test.id}: Havok is not driving the character`);
        assert.deepEqual(state.canvas, [1280, 720], `${test.id}: unexpected render buffer`);
        const wantsMorph = !test.query.includes('neutral') || test.query.includes(':');
        if (wantsMorph && test.id !== 'neutral') {
            assert.equal(state.morphMeshes.length, 1, `${test.id}: expected exactly one morphed mesh`);
            assert.equal(state.morphMeshes[0].targets, 2, `${test.id}: expected 2 morph targets`);
            assert.deepEqual(state.morphMeshes[0].weights, state.request.weights,
                `${test.id}: GPU weights do not match the request`);
        }
        const expectedCapsule = Number((1.748 * state.request.heightScale).toFixed(4));
        assert.ok(Math.abs(state.capsuleHeight - expectedCapsule) < 0.005,
            `${test.id}: capsule ${state.capsuleHeight} != ${expectedCapsule}`);
        assert.ok(Math.abs(Math.abs(state.rootScale.y) - state.request.heightScale) < 1e-4,
            `${test.id}: visual root scale ${state.rootScale.y} does not follow the height`);
        assert.ok(state.socketY != null, `${test.id}: main-hand socket not exposed`);
        assert.ok(Math.abs(state.pivotHeight - 0.55 * state.request.heightScale) < 1e-4,
            `${test.id}: camera pivot ${state.pivotHeight} does not follow the height`);

        // Real input, real frames: hold W and check the character travelled.
        const moved = await page.evaluate(async () => {
            const start = {...ASHEN.player.getDebugState().position};
            const frame = () => new Promise(requestAnimationFrame);
            window.dispatchEvent(new KeyboardEvent('keydown', {code: 'KeyW', bubbles: true}));
            document.dispatchEvent(new KeyboardEvent('keydown', {code: 'KeyW', bubbles: true}));
            for (let i = 0; i < 90; i++) await frame();
            window.dispatchEvent(new KeyboardEvent('keyup', {code: 'KeyW', bubbles: true}));
            document.dispatchEvent(new KeyboardEvent('keyup', {code: 'KeyW', bubbles: true}));
            const end = {...ASHEN.player.getDebugState().position};
            return {start, end, travelM: Math.hypot(end.x - start.x, end.z - start.z), grounded: ASHEN.player.getGrounded()};
        });
        assert.ok(moved.travelM > 1, `${test.id}: character travelled only ${moved.travelM.toFixed(3)} m under W`);

        await page.screenshot({path: path.join(out, `${test.id}.png`)});
        assert.deepEqual(errors, [], `${test.id}: page errors`);
        page.off('pageerror', onError);
        page.off('console', onConsole);
        rows.push({...test, ...state, movement: moved, errors});
        console.log(`${test.id.padEnd(8)} weights=${JSON.stringify(state.request.weights)} `
            + `capsule=${state.capsuleHeight.toFixed(3)} rootY=${state.rootScale.y.toFixed(3)} `
            + `pivot=${state.pivotHeight.toFixed(3)} socketY=${state.socketY} `
            + `travel=${moved.travelM.toFixed(2)}m enemies=${state.enemies}`);
    }
    await fs.mkdir(path.dirname(report), {recursive: true});
    await fs.writeFile(report, `${JSON.stringify({schema: 1, url: base, cases: rows}, null, 1)}\n`);
    console.log(`wrote ${report}`);
} finally {
    await page.goto('about:blank').catch(() => {});
    await browser.close();
}
