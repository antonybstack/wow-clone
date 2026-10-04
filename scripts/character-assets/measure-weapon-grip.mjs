/** How close the posed fingers come to the weapon they are supposed to be holding.
 *
 * The hand does not animate: `hand-grip.js` blends each finger bone a fixed fraction from its
 * rest sample toward its closed sample (`shaft: [.58, .72, .60]`, thumb `[.8, .5, .3]`), while
 * the prop is placed at a fixed `gripPosition` / `gripRotation` offset from the hand bone. The
 * two are set independently, so nothing guarantees the fingers close onto the grip.
 *
 * This measures the perpendicular distance from each finger joint to the grip's own axis and
 * compares it with the grip radius. A joint wrapping the grip sits at roughly the grip radius
 * plus a finger's half-thickness; a joint far outside that is not holding anything.
 */
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { browserOwnership } from '../lib/browser-ownership.mjs';
import { EQUIPMENT_ITEMS } from '../../src/ashen-reach/equipment-catalog.js';

const url = process.env.ASHEN_TEST_URL, port = process.env.ASHEN_CDP_PORT, out = process.argv[2];
assert(url && port && out, 'ASHEN_TEST_URL, ASHEN_CDP_PORT and an output path are required');
const WEAPONS = (process.env.ASHEN_WEAPONS || 'ironSword,graveweaverStaff,graveweaverGreatstaff').split(',');
const RACES = (process.env.ASHEN_RACES || 'human,orc,undead').split(',');

const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
assert(browser.contexts().flatMap(c => c.pages()).every(p => p.url() === 'about:blank'), 'Another owned page is active');
const ownership = await browserOwnership(browser, { cdpPort: port, url, purpose: 'Weapon grip: finger joints against the grip axis', renderingClients: 1 });
await fs.writeFile(out + '.ownership.json', JSON.stringify(ownership, null, 2));
const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 }), page = await context.newPage();
const rows = [], errors = [];
page.on('pageerror', e => errors.push(e.stack));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 300)); });

try {
    await page.goto(url);
    await page.waitForFunction(() => globalThis.ASHEN?.whenRest, null, { timeout: 120000 });
    await page.evaluate(() => ASHEN.whenRest);
    await page.evaluate(() => { ASHEN.dev.god = true; });

    for (const race of RACES) {
        if (await page.evaluate(() => ASHEN.equipment.race) !== race) {
            const r = await page.evaluate(x => ASHEN.equipment.switchRace(x), race);
            assert.notEqual(r?.status, 'failed', `switchRace(${race}): ${r?.error}`);
            await page.evaluate(() => ASHEN.whenRest);
        }
        for (const weapon of WEAPONS) {
            const applied = await page.evaluate(w => ASHEN.equipment.equip('mainHand', w), weapon);
            assert.equal(applied.status, 'applied', `${race}/${weapon}: ${applied.error}`);
            await page.waitForTimeout(700);
            // One frozen pose, so the measurement is not the frame the gait happened to be on.
            await page.evaluate(() => { for (const g of ASHEN.body.animationGroups) if (g.isPlaying && g.weight > 0.01) { g.currentTime = 0; g.speedRatio = 0; } });
            await page.waitForTimeout(400);
            const factory = EQUIPMENT_ITEMS[weapon].factory;
            const row = await page.evaluate(async ([w, prefix]) => {
                const samples = (await import('/src/character/runtime/source-hand-poses.json', { with: { type: 'json' } })).default;
                const sockets = ASHEN.sockets, skeleton = sockets.skeleton;
                const centre = ASHEN.player.getDebugState().position;
                const bone = name => (skeleton?.bones ?? []).find(b => b.name === name);
                const inCapsule = name => { const b = bone(name); return b ? sockets.toCapsule(b) : null; };
                // The grip mesh's own axis, from its world matrix. Lite world matrices are
                // array-like with translation at 12/13/14 and the basis in the first 12.
                //
                // Selected by the equipped item's factory prefix AND visibility: a prop is
                // cached rather than disposed when unequipped, so a loose name match returned
                // the stale sword for every weapon and produced three identical rows.
                const owned = ASHEN.scene.meshes.filter(m =>
                    m.name.toLowerCase().startsWith(prefix) && m.visible !== false);
                if (!owned.length) return { error: `no visible ${prefix} mesh` };
                // The handle is the part with the smallest cross-section: picking the longest
                // part instead selected a sword's blade, whose half-width is reported as a
                // 117 mm "grip radius". Blade and hilt share an axis, so only the radius was
                // wrong, but a wrong radius is what the comparison is against.
                const cross = m => {
                    const spans = [0, 1, 2].map(i => m.boundMax[i] - m.boundMin[i]);
                    const axis = spans.indexOf(Math.max(...spans));
                    return Math.max(...spans.filter((_, i) => i !== axis));
                };
                const mesh = owned.reduce((a, m) => (cross(m) < cross(a) ? m : a));
                const M = mesh.worldMatrix;
                const toCapsulePoint = p => ({ x: p.x - centre.x, y: p.y - centre.y, z: p.z - centre.z });
                const local = (x, y, z) => toCapsulePoint({
                    x: x * M[0] + y * M[4] + z * M[8] + M[12],
                    y: x * M[1] + y * M[5] + z * M[9] + M[13],
                    z: x * M[2] + y * M[6] + z * M[10] + M[14],
                });
                const min = mesh.boundMin, max = mesh.boundMax;
                // Longest local extent is the grip's length; the other two give the radius.
                const spans = [max[0] - min[0], max[1] - min[1], max[2] - min[2]];
                const axisIndex = spans.indexOf(Math.max(...spans));
                const mid = [0, 1, 2].map(i => (min[i] + max[i]) / 2);
                const endA = mid.slice(), endB = mid.slice();
                endA[axisIndex] = min[axisIndex]; endB[axisIndex] = max[axisIndex];
                const A = local(...endA), B = local(...endB);
                const radius = Math.max(...spans.filter((_, i) => i !== axisIndex)) / 2;
                const d = { x: B.x - A.x, y: B.y - A.y, z: B.z - A.z };
                const len2 = d.x * d.x + d.y * d.y + d.z * d.z;
                const perpendicular = p => {
                    const t = Math.max(0, Math.min(1, ((p.x - A.x) * d.x + (p.y - A.y) * d.y + (p.z - A.z) * d.z) / len2));
                    const q = { x: A.x + d.x * t, y: A.y + d.y * t, z: A.z + d.z * t };
                    return Math.hypot(p.x - q.x, p.y - q.y, p.z - q.z);
                };
                const side = ASHEN.equipment.getState().mainHand ? 'Right' : 'Right';
                const joints = {};
                for (const s of samples) {
                    if (!s.name.includes(side)) continue;
                    const p = inCapsule(s.name);
                    if (p) joints[s.name.replace(`mixamorig:${side}`, '')] = +perpendicular(p).toFixed(4);
                }
                return { mesh: mesh.name, gripRadius: +radius.toFixed(4), gripLength: +Math.sqrt(len2).toFixed(4), joints };
            }, [weapon, factory]);
            assert(!row.error, `${race}/${weapon}: ${row.error}`);
            assert(row.mesh.toLowerCase().startsWith(factory), `${race}/${weapon} measured ${row.mesh}, which is not a ${factory}`);
            rows.push({ race, weapon, ...row });
            console.log(JSON.stringify({ race, weapon, mesh: row.mesh, radius: row.gripRadius, joints: row.joints }));
        }
    }
    await fs.writeFile(out, JSON.stringify({
        url,
        note: 'Perpendicular distance in metres from each finger joint to the grip mesh\'s long axis, in capsule space, at a frozen idle pose. A joint wrapping a grip of radius r sits near r plus a finger half-thickness (about 8 mm); much larger means the joint is not on the grip.',
        rows, errors,
    }, null, 2));
} catch (e) {
    console.error(e); process.exitCode = 1;
} finally {
    await context.close();
    await browser.close();
    await fs.writeFile(out + '.ownership.json', JSON.stringify({ ...ownership, active: false, renderingClients: 0 }, null, 2));
}
