/**
 * M005: what live shape editing costs against a committed, cached shape.
 *
 * Two ways to wear a shape. **Live** keeps the morph deltas resident and writes a weights
 * buffer, so a slider is a small uniform update and the GPU does the blend in the vertex
 * stage. **Cached** bakes the shaped positions once the appearance is committed and keeps
 * no deltas, so the steady state is an ordinary unmorphed mesh.
 *
 * This measures both ends of that trade on the actual scene: the resident cost of the
 * deltas, and the frame cost of sweeping weights every frame the way an editor would. The
 * static rows are the control; a sweep that measures the same as the control means the
 * weights path is free at this scale, not that the measurement failed.
 *
 * Lite stores morph deltas as one read-only storage buffer of 6 floats per (target, vertex)
 * -- position xyz then normal xyz -- and a separate weights buffer of one float per target
 * (`lib/morph/create-morph-targets.js`). Those are the numbers the resident cost is
 * computed from, not an estimate.
 *
 * Run alone on an owned harness slot with nothing else rendering.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {chromium} from 'playwright';

const port = Number(process.env.ASHEN_CDP_PORT), url = process.env.ASHEN_URL;
if (!port || !url) throw Error('ASHEN_CDP_PORT and ASHEN_URL required');
const base = url.split('?')[0];
const out = process.env.ASHEN_PREP_REPORT || 'docs/baselines/character-mmo/m005/shape-preparation.json';
const FRAMES = Number(process.env.ASHEN_PREP_FRAMES || 900);

const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
const pages = browser.contexts().flatMap(c => c.pages());
const page = pages.find(p => p.url().startsWith(base)) ?? pages[0];
if (!page) throw Error('No owned page in this harness slot');

const errors = [];
page.on('pageerror', e => errors.push(String(e.message ?? e)));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

try {
    await page.setViewportSize({width: 1280, height: 720});
    await page.goto(`${base}?play&clean&pixelRatio=1&humanShape=stout&garmentFit=refit`);
    await page.waitForFunction(() => globalThis.ASHEN?.whenPlayable, null, {timeout: 90000});
    await page.evaluate(() => ASHEN.whenRest);

    const resident = await page.evaluate(() => {
        const rows = [];
        for (const mesh of ASHEN.scene.meshes || []) {
            const morph = mesh.morphTargets;
            if (!morph) continue;
            // 6 floats per (target, vertex): position xyz then normal xyz.
            const vertexCount = morph.targets[0]?.positions.length / 3;
            rows.push({
                mesh: mesh.name ?? null,
                targets: morph.count,
                vertices: vertexCount,
                deltaBytes: morph.count * vertexCount * 6 * 4,
                weightsBytes: 16 + morph.count * 4,
            });
        }
        return rows;
    });

    const measure = (mode) => page.evaluate(async ({mode, frames}) => {
        const meshes = (ASHEN.scene.meshes || []).filter(m => m.morphTargets);
        const intervals = [];
        const updateMs = [];
        let last = performance.now();
        for (let i = 0; i < frames; i++) {
            await new Promise(requestAnimationFrame);
            if (mode === 'sweep') {
                // An editor dragging a slider: a new blend every single frame.
                const t = (i % 120) / 120;
                const weights = [t, 1 - t];
                const t0 = performance.now();
                ASHEN.setShapeWeights(weights);
                updateMs.push(performance.now() - t0);
            }
            const now = performance.now();
            intervals.push(now - last);
            last = now;
        }
        const sorted = [...intervals].sort((a, b) => a - b);
        const at = q => sorted[Math.min(sorted.length - 1, Math.ceil(q * sorted.length) - 1)];
        const mean = xs => xs.reduce((a, b) => a + b, 0) / xs.length;
        return {
            mode, frames: intervals.length, meshes: meshes.length,
            meanMs: Number(mean(intervals).toFixed(4)),
            p95Ms: Number(at(0.95).toFixed(4)),
            p99Ms: Number(at(0.99).toFixed(4)),
            worstMs: Number(sorted.at(-1).toFixed(4)),
            fps: Number((1000 / mean(intervals)).toFixed(1)),
            weightUpdateMeanMs: updateMs.length ? Number(mean(updateMs).toFixed(5)) : null,
            weightUpdateWorstMs: updateMs.length ? Number(Math.max(...updateMs).toFixed(5)) : null,
        };
    }, {mode, frames: FRAMES});

    // Warm up, then alternate so drift shows up as disagreement between the pairs.
    await measure('static');
    const runs = [];
    for (let i = 0; i < 2; i++) {
        runs.push(await measure('static'));
        runs.push(await measure('sweep'));
    }
    await page.evaluate(() => ASHEN.setShapeWeights(ASHEN.humanShape.weights));

    // The other end of the trade: what a committed shape costs to bake. This is the CPU
    // work a cached path does on every commit - apply the weighted deltas to positions and
    // normals - measured on the same arrays the live path keeps resident.
    const bake = await page.evaluate(({repeats}) => {
        const meshes = (ASHEN.scene.meshes || []).filter(m => m.morphTargets);
        let vertices = 0;
        for (const mesh of meshes) vertices += mesh.morphTargets.targets[0].positions.length / 3;
        const samples = [];
        for (let r = 0; r < repeats; r++) {
            const t0 = performance.now();
            let sink = 0;
            for (const mesh of meshes) {
                const morph = mesh.morphTargets;
                const weights = morph.weights;
                const n = morph.targets[0].positions.length;
                const positions = new Float32Array(n);
                const normals = new Float32Array(n);
                for (let t = 0; t < morph.count; t++) {
                    const w = weights[t];
                    if (!w) continue;
                    const dp = morph.targets[t].positions, dn = morph.targets[t].normals;
                    for (let i = 0; i < n; i++) {
                        positions[i] += w * dp[i];
                        if (dn) normals[i] += w * dn[i];
                    }
                }
                sink += positions[0] + normals[0];
            }
            samples.push(performance.now() - t0);
            if (!Number.isFinite(sink)) throw new Error('bake produced non-finite data');
        }
        samples.sort((a, b) => a - b);
        return {
            meshes: meshes.length,
            vertices,
            uploadBytes: vertices * 6 * 4,
            medianMs: Number(samples[Math.floor(samples.length / 2)].toFixed(4)),
            worstMs: Number(samples.at(-1).toFixed(4)),
            repeats: samples.length,
        };
    }, {repeats: 25});

    const totalDelta = resident.reduce((a, r) => a + r.deltaBytes, 0);
    const report = {
        schema: 1,
        generatedBy: 'scripts/character-assets/measure-shape-preparation.mjs',
        url: `${base}?play&clean&humanShape=stout&garmentFit=refit`,
        viewport: [1280, 720],
        framesPerRun: FRAMES,
        resident,
        residentTotals: {
            meshes: resident.length,
            deltaBytes: totalDelta,
            deltaMiB: Number((totalDelta / 1048576).toFixed(3)),
            weightsBytes: resident.reduce((a, r) => a + r.weightsBytes, 0),
        },
        runs,
        bake,
        errors,
    };
    await fs.mkdir(path.dirname(out), {recursive: true});
    await fs.writeFile(out, `${JSON.stringify(report, null, 1)}\n`);
    for (const row of resident) console.log(`${String(row.mesh).padEnd(26)} targets=${row.targets} verts=${row.vertices} deltas=${(row.deltaBytes / 1024).toFixed(1)} KiB`);
    console.log(`resident deltas total ${report.residentTotals.deltaMiB} MiB across ${resident.length} meshes`);
    for (const run of runs) {
        console.log(`${run.mode.padEnd(7)} ${run.fps} FPS mean=${run.meanMs}ms p95=${run.p95Ms}ms worst=${run.worstMs}ms`
            + (run.weightUpdateMeanMs != null ? ` weightUpdate mean=${run.weightUpdateMeanMs}ms worst=${run.weightUpdateWorstMs}ms` : ''));
    }
    assert.deepEqual(errors, [], 'page errors');
    console.log(`bake ${bake.vertices} vertices across ${bake.meshes} meshes: median ${bake.medianMs} ms, `
        + `worst ${bake.worstMs} ms, ${(bake.uploadBytes / 1024).toFixed(1)} KiB to re-upload`);
    console.log(`wrote ${out}`);
} finally {
    await page.goto('about:blank').catch(() => {});
    await browser.close();
}
