/** Camera obstruction and control checks in the real Lite/Havok scene. */
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { CDP_URL } from '../lib/cdp.mjs';

const dir = process.env.ASHEN_CAPTURE_DIR || 've-capture/ashen-reach/camera-native/check';
await fs.mkdir(dir, { recursive: true });
const browser = await chromium.connectOverCDP(CDP_URL);
const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await context.newPage(), errors = [], report = { errors, cases: [] };
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
await page.addInitScript(() => {
    window.__gpuErrors = [];
    const request = GPUAdapter.prototype.requestDevice;
    GPUAdapter.prototype.requestDevice = async function (...args) {
        const device = await request.apply(this, args);
        device.addEventListener('uncapturederror', e => __gpuErrors.push(e.error.message));
        return device;
    };
});
try {
    await page.goto(process.env.ASHEN_TEST_URL || 'http://127.0.0.1:5173/ashen-reach.html?play&clean');
    await page.waitForFunction(() => window.ASHEN?.ready && ASHEN.hostilesReady, null, { timeout: 120000 });
    await page.evaluate(async () => {
        const source = await (await fetch('/src/ashen-reach/main.js')).text();
        const url = source.match(/from\s*["']([^"']*\/@babylonjs_lite\.js[^"']*)["']/)?.[1];
        if (!url) throw Error('Active Lite module missing');
        window.cameraLite = await import(url);
        ASHEN.dev.god = true;
        ASHEN.metrics.setInternalResolution(1280, 720);
    });
    for (const id of ['open', 'ground', 'nave-wall', 'tower-turn']) {
        await page.evaluate(id => {
            const a = ASHEN, k = a.world.cathedral;
            const point = id === 'tower-turn' ? k.exploration.towers[0].route[20]
                : id === 'nave-wall' ? [0, k.floorY, 318] : [0, a.world.groundHeight(0, 80), 80];
            a.player.setWorldPos(point[0], point[1] + 1.7, point[2]);
            a.rig.yaw = id === 'nave-wall' ? Math.PI / 2 : 0;
            a.rig.pitch = id === 'ground' ? -.6 : .12;
            a.rig.distance = a.rig.distanceTarget = id === 'nave-wall' ? 20 : 8;
        }, id);
        await page.waitForTimeout(900);
        const samples = [];
        for (let i = 0; i < (id === 'tower-turn' ? 24 : 1); i++) {
            if (id === 'tower-turn') await page.evaluate(i => { ASHEN.rig.yaw = i * Math.PI / 12; }, i);
            await page.waitForTimeout(70);
            samples.push(await page.evaluate(() => {
                const a = ASHEN, c = a.rig.camera, position = cameraLite.getCameraPosition(c);
                return { radius: c.radius, desired: a.rig.distance, target: { ...c.target }, position: { ...position },
                    sweep: a.rig.collisionSweep(c.target, position), physics: a.player.getDebugState() };
            }));
        }
        report.cases.push({ id, samples });
        assert(samples.every(s => s.physics.usingPhysics && s.physics.recoveries === 0));
        assert(samples.every(s => !s.sweep.hasHit || s.sweep.fraction > .995), `${id}: lens intersects collider`);
        assert(samples.every(s => s.radius > .1), `${id}: collapsed arm`);
        if (id === 'open') assert(Math.abs(samples[0].radius - 8) < .05, 'Player capsule must be ignored');
        else assert(samples.some(s => s.radius < s.desired - .2), `${id}: no obstruction detected`);
        await page.screenshot({ path: `${dir}/${id}.png` });
    }
    // Exercise the real DOM controls: free orbit versus facing with RMB.
    const state = () => page.evaluate(() => ({ yaw: ASHEN.rig.yaw, facing: ASHEN.player.body.rotation.y }));
    for (const button of ['left', 'right']) {
        const before = await state();
        await page.mouse.move(640, 360);
        await page.mouse.down({ button });
        await page.mouse.move(660, 360);
        await page.waitForTimeout(150);
        await page.mouse.move(770, 380, { steps: 8 });
        await page.waitForTimeout(150);
        await page.mouse.up({ button });
        const after = await state();
        assert(Math.abs(after.yaw - before.yaw) > .03, `${button}: orbit did not move`);
        if (button === 'left') assert(Math.abs(after.facing - before.facing) < .01);
        else assert(Math.abs(after.facing - after.yaw) < .01);
        report[button] = { before, after };
        await page.keyboard.press('Escape');
    }
    report.gpuErrors = await page.evaluate(() => __gpuErrors);
    assert.deepEqual(errors, []);
    assert.deepEqual(report.gpuErrors, []);
    report.disposed = await page.evaluate(() => {
        cameraLite.unregisterScene(ASHEN.scene);
        cameraLite.disposeScene(ASHEN.scene);
        return ASHEN.rig.collisionSweep === null;
    });
    assert(report.disposed, 'Scene disposal must detach the sweep and release its shape');
    report.passed = true;
} catch (e) {
    report.failure = e.stack;
    throw e;
} finally {
    await fs.writeFile(`${dir}/report.json`, JSON.stringify(report, null, 2));
    await context.close();
    await browser.close();
}
