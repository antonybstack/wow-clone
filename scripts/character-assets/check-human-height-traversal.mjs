/** M004 height-range safety: can a scaled character still traverse the region?
 *
 * `player.setHeightScale` clamps to [0.9, 1.15] and reshapes the Havok capsule, so the
 * visual can never outrun what physics accepts. That says nothing about whether the world
 * accepts it. This walks the execution contract's five route starts at the minimum, default
 * and maximum height and compares travel, grounding and the recovery counter against the
 * default. A recovery is the controller rescuing a character that ended up somewhere it
 * should not be; the milestone forbids clamps and rescue teleports, so any recovery above
 * the default run's count is a failed height, not a rounding difference.
 *
 * Run alone on an owned harness slot with nothing else rendering.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {chromium} from 'playwright';
import {browserOwnership} from '../lib/browser-ownership.mjs';
import {defaultAppearance} from '../../src/character/appearance/store.js';
import {validateAppearance} from '../../src/character/appearance/contract.js';

const port = Number(process.env.ASHEN_CDP_PORT), url = process.env.ASHEN_URL;
if (!port || !url) throw Error('ASHEN_CDP_PORT and ASHEN_URL required');
const base = url.split('?')[0];
const out = process.env.ASHEN_HEIGHT_REPORT || 'docs/baselines/character-mmo/m004/height-traversal.json';
const SECONDS = Number(process.env.ASHEN_HEIGHT_SECONDS || 6);

const ROUTES = [
    ['meadow', 0, -65, 0],
    ['town', 0, 80, 0],
    ['bridge-approach', 0, 142, 0],
    ['bridge', 0, 210, 0],
    ['cathedral', 0, 280, 0],
    ['forest', -80, 180, -Math.PI / 2],
];
const HEIGHTS = [
    {id: 'min', scale: 0.9, shape: 'slender'},
    {id: 'default', scale: 1, shape: 'neutral'},
    {id: 'max', scale: 1.15, shape: 'stout'},
];

const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
assert(browser.contexts().flatMap(c=>c.pages()).every(p=>p.url()==='about:blank'),'Another owned page is active');
const ownership=await browserOwnership(browser,{cdpPort:port,url:base,purpose:'Height-extreme physical traversal including bridge approach',renderingClients:1});
await fs.mkdir(path.dirname(out),{recursive:true});
await fs.writeFile(out+'.ownership.json',JSON.stringify(ownership,null,2));
let context,page;

const rows = [];
const errors = [];

try {
    for (const height of HEIGHTS) {
        await context?.close();
        context=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1});
        const baseRecipe=defaultAppearance();
        const recipe=validateAppearance({...baseRecipe,shape:{...baseRecipe.shape,height:height.scale,build:height.shape==='slender'?-.95:height.shape==='stout'?.95:0}});
        await context.addInitScript(recipe=>localStorage.setItem('ashen.appearance.v2',JSON.stringify(recipe)),recipe);
        page=await context.newPage();
        page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
        // Saved canonical appearance uses the actual Pages startup assets. The old
        // humanShape diagnostic query requested full source assets excluded from Pages.
        await page.goto(`${base}?play&clean&pixelRatio=1`);
        await page.waitForFunction(() => globalThis.ASHEN?.whenPlayable, null, {timeout: 90000});
        await page.evaluate(() => ASHEN.whenRest);
        await page.evaluate(()=>{ASHEN.dev.god=true;});
        const state = await page.evaluate(() => ({
            capsule: ASHEN.player.getDebugState().capsuleHeight,
            scale: ASHEN.player.heightScale,
            pivot: ASHEN.rig.pivotHeight,
        }));
        assert.ok(Math.abs(state.scale - height.scale) < 1e-3,
            `${height.id}: height scale ${state.scale} != ${height.scale}`);
        for (const [route, x, z, yaw] of ROUTES) {
            await page.evaluate(({x, z, yaw}) => {
                const a = ASHEN, k = a.world.cathedral;
                const y = x === 0 && z >= k.route.start[2] ? k.route.heightAt(z) : a.world.groundHeight(x, z);
                a.player.setFlying(false);
                a.player.setWorldPos(x, y + 1.7, z);
                a.player.setFacing(yaw);
                a.rig.yaw = yaw;
                a.rig.pitch = -0.16;
            }, {x, z, yaw});
            await page.waitForTimeout(1000);
            const before = await page.evaluate(() => ({
                x: ASHEN.player.body.position.x, z: ASHEN.player.body.position.z,
                recoveries: ASHEN.player.getDebugState().recoveries,
            }));
            await page.keyboard.down('KeyW');
            await page.waitForTimeout(SECONDS * 1000);
            const after = await page.evaluate(() => {
                const d = ASHEN.player.getDebugState();
                return {x: d.position.x, z: d.position.z, recoveries: d.recoveries, grounded: ASHEN.player.getGrounded(), physics: d.usingPhysics};
            });
            await page.keyboard.up('KeyW');
            await page.waitForTimeout(250);
            const row = {
                height: height.id, scale: height.scale, shape: height.shape, route,
                capsuleHeightM: Number(state.capsule.toFixed(4)),
                cameraPivotM: Number(state.pivot.toFixed(4)),
                travelM: Number(Math.hypot(after.x - before.x, after.z - before.z).toFixed(2)),
                recoveriesDelta: (after.recoveries ?? 0) - (before.recoveries ?? 0),
                grounded: after.grounded,
                physics: after.physics,
            };
            rows.push(row);
            console.log(`${height.id.padEnd(8)} ${route.padEnd(10)} capsule=${row.capsuleHeightM.toFixed(3)} `
                + `travel=${row.travelM.toFixed(1)}m recoveries=${row.recoveriesDelta} grounded=${row.grounded}`);
        }
    }

    const byRoute = new Map();
    for (const row of rows) {
        if (row.height === 'default') byRoute.set(row.route, row.travelM);
    }
    const failures = [];
    for (const row of rows) {
        if (row.recoveriesDelta > 0) failures.push(`${row.height}/${row.route}: ${row.recoveriesDelta} recoveries`);
        if (row.travelM < 10) failures.push(`${row.height}/${row.route}: only ${row.travelM} m travel`);
        if (!row.physics) failures.push(`${row.height}/${row.route}: physics off`);
        const reference = byRoute.get(row.route);
        // Ninety per cent of the default run's distance: a route the scaled character can
        // still walk, not one it inches along while snagging on the world.
        if (reference && row.travelM < reference * 0.9) {
            failures.push(`${row.height}/${row.route}: travelled ${row.travelM} m against ${reference} m at default height`);
        }
    }
    await fs.mkdir(path.dirname(out), {recursive: true});
    await fs.writeFile(out, `${JSON.stringify({
        schema: 1, url: base, seconds: SECONDS, heights: HEIGHTS, rows, failures, errors,
    }, null, 1)}\n`);
    console.log(failures.length ? `FAILURES:\n  ${failures.join('\n  ')}` : 'no recoveries, no stalls, physics on at every height');
    console.log(`wrote ${out}`);
    assert.deepEqual(errors, [], 'page errors');
    assert.deepEqual(failures, [], 'traversal failures');
} finally {
    await context?.close();
    await browser.close();
    await fs.writeFile(out+'.ownership.json',JSON.stringify({...ownership,active:false,renderingClients:0},null,2));
}
