// Close views of the fitted Orc garments, for judging clipping rather than silhouette.
import {chromium} from 'playwright';
import fs from 'node:fs/promises';
const race = process.env.ORC_RACE || 'orc';
const dir = `ve-capture/ashen-reach/${race}-fit`;
await fs.mkdir(dir, {recursive: true});
const browser = await chromium.connectOverCDP('http://127.0.0.1:9337');
const context = browser.contexts()[0];
const page = context.pages().find(p => p.url().includes('ashen-reach.html')) || await context.newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message));
const preset = process.env.ORC_PRESET || 'Wayfarer';
try {
    await page.bringToFront();
    await page.setViewportSize({width: 1440, height: 900});
    await page.goto(process.env.ASHEN_URL || 'http://127.0.0.1:5173/ashen-reach.html?play&clean', {waitUntil: 'commit'});
    await page.waitForFunction(() => globalThis.ASHEN?.ready, null, {timeout: 60000});
    await page.locator('#armory-launch').click();
    await page.waitForTimeout(300);
    await page.locator('[data-light]').check();
    await page.locator('[data-race]').selectOption(race);
    await page.waitForTimeout(1200);
    await page.getByRole('button', {name: preset, exact: true}).click();
    await page.waitForTimeout(1400);
    await page.locator('[data-motion]').selectOption(process.env.ORC_MOTION || 'idle');
    await page.locator('[data-time-slider]').fill(process.env.ORC_TIME || '0');
    await page.waitForTimeout(400);
    const stage = page.locator('.armory-stage canvas').first();
    const box = await page.locator('.armory-stage').boundingBox();
    const clip = box ? {x: box.x, y: box.y, width: box.width, height: box.height} : undefined;
    // The armory stage is lit for the churchyard at night; a fit review needs to see
    // the seams, so lift the exposure for the capture only.
    const lift = +(process.env.ORC_LIFT || 3);
    await page.evaluate(k => {
        for (const l of globalThis.ASHEN.scene.lights || []) l.intensity *= k;
    }, lift);
    /* Frame each region on the joint that drives it rather than on a height above the
       feet. The Orc is a fifth taller than the Human and its hands hang further out, so a
       fixed height and a fixed lateral offset put the camera inside a forearm on one race
       and past the shoulder on the other. Driving the camera from the joint's own world
       position frames the same anatomy on both. */
    const shots = [
        ['boots', 'mixamorig:LeftFoot', 1.25, 1.5, [0, Math.PI, Math.PI / 2]],
        ['legs', 'mixamorig:LeftLeg', 1.15, 1.45, [0, Math.PI, Math.PI / 2]],
        ['waist', 'mixamorig:Hips', 1.25, 1.45, [0, Math.PI, Math.PI / 2]],
        ['torso', 'mixamorig:Spine2', 1.35, 1.45, [0, Math.PI, Math.PI / 2]],
        ['hands', 'mixamorig:LeftHand', 0.70, 1.45, [Math.PI / 2, -Math.PI / 2, 0]],
        ['grip', 'mixamorig:LeftHand', 0.55, 1.45, [Math.PI / 2, -Math.PI / 2]],
        ['full', 'mixamorig:Spine1', 5.6, 1.36, [0, Math.PI, Math.PI / 2]],
        ['head', 'mixamorig:Head', 0.95, 1.5, [0, Math.PI, Math.PI / 2]],
    ];
    let n = 0;
    for (const [name, bone, radius, beta, angles] of shots) {
        for (const alpha of angles) {
            await page.evaluate(([bone, radius, beta, alpha]) => {
                const A = globalThis.ASHEN;
                const c = A.armory.camera;
                const j = A.body.skeleton.bones.find(x => x.name === bone);
                const cap = A.combat.fx.sockets.toCapsule(j);
                const m = A.player.body.worldMatrix;
                const x = cap.x, y = cap.y, z = cap.z;
                A.armory.update = () => {
                    c.target.set(m[0] * x + m[4] * y + m[8] * z + m[12],
                        m[1] * x + m[5] * y + m[9] * z + m[13],
                        m[2] * x + m[6] * y + m[10] * z + m[14]);
                    c.radius = radius;
                    c.alpha = alpha - A.player.getFacing();
                    c.beta = beta;
                };
            }, [bone, radius, beta, alpha]);
            await page.waitForTimeout(280);
            await page.screenshot({path: `${dir}/${preset.toLowerCase()}-${name}-${Math.round(alpha * 180 / Math.PI)}.png`});
            n++;
        }
    }
    console.log('captured', n, '| errors:', errors.length, errors.slice(0, 3));
} finally {await browser.close();}
