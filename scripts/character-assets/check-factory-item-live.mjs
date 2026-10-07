/** Actual Armory integration of a descriptor-built shoulder or torso item. Run one owned
 * native Lite game at a time. Optional timestamped motion is not an FPS sample.
 * https://chromedevtools.github.io/devtools-protocol/tot/Page/#method-startScreencast
 * https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal
 */
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {inspect} from 'node:util';
import {chromium} from 'playwright';
import {browserOwnership} from '../lib/browser-ownership.mjs';
import {captureSurface, appendFrame, writeCaptureManifest} from '../lib/capture-manifest.mjs';
import {EQUIPMENT_ITEMS} from '../../src/ashen-reach/equipment-catalog.js';
import {APPEARANCE_V6_REGISTRY, APPEARANCE_CATALOG_VERSION, migrateAppearance} from '../../src/character/appearance/contract.js';
import {appearanceFromEquipment} from '../../src/character/appearance/from-equipment.js';
const [descriptorPath, out] = process.argv.slice(2), url = process.env.ASHEN_TEST_URL, port = process.env.ASHEN_CDP_PORT;
assert(descriptorPath && out && url && port, 'Descriptor, output, owned CDP and game URL required');
// ?creator selects the historical developer garment pack; current content must
// be checked through the ordinary Armory and its published manifests.
assert(!new URL(url).searchParams.has('creator'), 'Factory acceptance needs the ordinary game route, without the legacy ?creator diagnostic');
const descriptor = JSON.parse(await fs.readFile(descriptorPath, 'utf8')), item = EQUIPMENT_ITEMS[descriptor.id];
assert(['shoulders','torso'].includes(item?.slot));
const slot = item.slot, adjacentSlot = slot === 'shoulders' ? 'torso' : 'shoulders';
const expectedParts = descriptor.schema === 2 ? descriptor.materials.length : 1;
const targetIntent = {slot, id: item.id};
async function uiEquip(page, id) {
    await page.locator(`#armory [data-equipment="${slot}"]`).selectOption(id || '');
    await page.waitForFunction(({slot,id}) => {
        const status = ASHEN.equipment.getStatus();
        return !status.pending && (status.error || (ASHEN.equipment.getState()[slot] || null) === (id || null));
    }, {slot,id});
    const result = await page.evaluate(slot => ({id: ASHEN.equipment.getState()[slot] || null, ...ASHEN.equipment.getStatus()}),slot);
    assert.equal(result.id,id || null,result.error || `Armory did not equip ${id || 'nothing'}`);
}
function assertParts(state) {
    assert.equal(state.parts.length, expectedParts);
    for (const part of state.parts) assert.equal(part.bones,65);
}
const record = process.env.ASHEN_FACTORY_CAPTURE === '1';
await fs.mkdir(out, {recursive: true});
const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
assert(browser.contexts().flatMap(c => c.pages()).every(p => p.url() === 'about:blank'), 'Another owned renderer is active');
const ownership = await browserOwnership(browser, {cdpPort: port, url, purpose: `${descriptor.id} Armory fit/transaction checks; not FPS`, renderingClients: 1});
await fs.writeFile(`${out}/ownership.json`, JSON.stringify(ownership, null, 2));
const report = {item: descriptor.id, url, recording: record, rows: [], errors: [], passed: false};
const ready = page => page.waitForFunction(() => globalThis.ASHEN?.ready && ASHEN.hostilesReady, null, {timeout: 120000});
const state = page => page.evaluate(meshName => {
    // Lite render visibility belongs to each mesh. The invisible Havok Player
    // capsule may parent visible children; Classic-style ancestor checks are wrong.
    // https://github.com/BabylonJS/Babylon-Lite/blob/npm-lite-v1.31.1/packages/babylon-lite/src/scene/visibility.ts
    const visible = mesh => mesh.visible !== false;
    return {appearance: ASHEN.getAppearance(), equipment: ASHEN.equipment.getState(), dyes: ASHEN.equipment.getDyes(),
        physics: ASHEN.player.getDebugState().usingPhysics, recoveries: ASHEN.player.getDebugState().recoveries,
        parts: ASHEN.scene.meshes.filter(m => m.name === meshName && visible(m)).map(m => ({bones: m.skeleton?.boneCount, morphs: !!m.morphTargets, weights: m.morphTargets ? Array.from(m.morphTargets.weights) : []})),
        upperTrousers: ASHEN.scene.meshes.filter(m => m.name === 'WayfarerTrousersUnderTorso').map(m => ({visible:visible(m)})),
        lowerTrousersVisible: ASHEN.scene.meshes.some(m => m.name === 'WayfarerTrousers' && visible(m)),
        partOwners: ASHEN.scene.meshes.filter(m => m.name.includes(meshName)).map(m => {
            const ancestors = []; for (let n = m; n; n = n.parent) ancestors.push({name: String(n.name), visible: n.visible !== false});
            return {name: m.name, ancestors};
        }),
        storage: localStorage.getItem('ashen.appearance.v2'), gpuErrors: ASHEN.gpu.errors.slice()};
}, descriptor.mesh);
async function ownedCheck(job, {expectedFailure = false} = {}) {
    const context = await browser.newContext({viewport: {width: 1280, height: 720}, deviceScaleFactor: 1}), page = await context.newPage();
    page.on('pageerror', e => report.errors.push(e.message));
    page.on('console', m => {if (m.type() === 'error' && !(expectedFailure && /500 \(Internal Server Error\)/.test(m.text()))) report.errors.push(m.text());});
    try {await job(context, page);} finally {await context.close(); await fs.writeFile(`${out}/report.json`, JSON.stringify(report, null, 2));}
}
try {
    await ownedCheck(async (context, page) => {
        const legacy = appearanceFromEquipment({race: 'human', loadout: {torso: 'wayfarerTunic', legs: 'wayfarerTrousers', boots: 'wayfarerBoots', mainHand: 'ironSword'}}, APPEARANCE_V6_REGISTRY);
        await context.addInitScript(seed => {if (!localStorage.getItem('ashen.appearance.v2')) localStorage.setItem('ashen.appearance.v2', JSON.stringify(seed));}, legacy);
        await page.goto(url); await ready(page);
        assert.deepEqual((await state(page)).appearance, migrateAppearance(legacy));
        report.rows.push({case: 'actual-v6-first-play-migration', state: await state(page)});
        await page.evaluate(() => {ASHEN.dev.god = true; ASHEN.armory.open();});
        let cdp, manifest, recording = false; const writes = [], timeline = [];
        if (record) {
            await fs.mkdir(`${out}/frames`, {recursive: true}); manifest = {...await captureSurface(page), frames: [], timeline};
            assert.deepEqual([manifest.canvas.width, manifest.canvas.height], [1280, 720]);
            cdp = await context.newCDPSession(page);
            cdp.on('Page.screencastFrame', event => {
                void cdp.send('Page.screencastFrameAck', {sessionId: event.sessionId}).catch(() => {});
                if (!recording) return;
                try {
                    const name = `frame-${String(manifest.frames.length).padStart(6, '0')}.jpg`, bytes = Buffer.from(event.data, 'base64');
                    appendFrame(manifest, {name, timestamp: event.metadata.timestamp, bytes}); writes.push(fs.writeFile(`${out}/frames/${name}`, bytes));
                } catch (error) {report.errors.push(error.message); recording = false;}
            });
            recording = true;
            await cdp.send('Page.startScreencast', {format: 'jpeg', quality: 88, maxWidth: 1280, maxHeight: 720, everyNthFrame: 4});
        }
        const mark = name => timeline.push({name, timestamp: Date.now() / 1000});
        try {
            if (slot === 'torso') {
                await uiEquip(page,'lectorCoat'); await page.check('#armory [data-light]');
                await page.evaluate(()=>ASHEN.armory.setFocus({height:1.05,radius:3.3,beta:1.36}));
                for (const view of ['front','back']) {
                    await page.locator(`#armory [data-view="${view}"]`).click();
                    mark(`Lector source control ${view}`); await page.waitForTimeout(record ? 1200 : 180);
                    await page.screenshot({path:`${out}/source-lector-${view}.png`});
                }
            }
            const cases = [['human-neutral', 'human', 0, 1], ['human-short-stout', 'human', .95, .9],
                ['human-tall-slender', 'human', -.95, 1.15], ['human-short-slender', 'human', -.95, .9],
                ['human-tall-stout', 'human', .95, 1.15], ['orc-neutral', 'orc', 0, 1], ['undead-neutral', 'undead', 0, 1]];
            for (const [name, race, build, height] of cases) {
                await uiEquip(page,null);
                if (await page.evaluate(() => ASHEN.equipment.race) !== race) {
                    await page.locator('#armory [data-race]').selectOption(race);
                    await page.waitForFunction(r => ASHEN.equipment.race === r && !!ASHEN.creator, race, {timeout: 120000});
                }
                if (race === 'human') {
                    if (name !== 'human-neutral') {
                        await page.getByLabel('Face and hair', {exact: true}).selectOption('prime-ponytail');
                        await page.waitForFunction(() => ASHEN.creator.identity.selected === 'prime-ponytail');
                    }
                    await page.evaluate(async ({build, height}) => {await ASHEN.creator.set('build', build); await ASHEN.creator.set('height', height);}, {build, height});
                }
                if (slot === 'torso') {
                    await page.locator('#armory [data-equipment="legs"]').selectOption('wayfarerTrousers');
                    await page.waitForFunction(() => ASHEN.equipment.getState().legs === 'wayfarerTrousers' && !ASHEN.equipment.getStatus().pending);
                }
                await uiEquip(page,item.id);
                await page.evaluate(() => ASHEN.creator.settled());
                await page.check('#armory [data-light]');
                await page.evaluate(slot => ASHEN.armory.setFocus({height: (slot === 'torso' ? 1.05 : 1.4) * ASHEN.player.heightScale,
                    radius: (slot === 'torso' ? 3.3 : 2.05) * ASHEN.player.heightScale, beta: 1.38}),slot);
                const fitted = await state(page); await fs.writeFile(`${out}/${name}-state.json`, JSON.stringify(fitted, null, 2));
                assert.equal(fitted.appearance.race, race); assert(fitted.physics); assert.equal(fitted.recoveries, 0);
                assertParts(fitted); assert.deepEqual(fitted.gpuErrors, []);
                if (slot === 'torso') {
                    assert(fitted.upperTrousers.length > 0, 'The actual upper-trouser geoset was not loaded');
                    assert(fitted.upperTrousers.every(part => !part.visible), 'Fieldcoat left upper trousers protruding through its waist');
                    assert(fitted.lowerTrousersVisible, 'The vent must retain the visible lower trousers');
                }
                if (race === 'human') {assert.equal(fitted.appearance.shape.height, height); assert.equal(fitted.appearance.shape.build, build); if (build) {assert(fitted.parts[0].morphs); assert.deepEqual(fitted.parts[0].weights, [Math.fround(Math.max(0, -build)), Math.fround(Math.max(0, build))]);}}
                mark(name);
                for (const view of ['front', 'side', 'back']) {
                    await page.locator(`#armory [data-view="${view}"]`).click();
                    await page.selectOption('#armory [data-motion]', view === 'back' ? 'walk' : 'idle');
                    await page.waitForTimeout(record ? 750 : 180); await page.screenshot({path: `${out}/${name}-${view}.png`});
                }
                await page.selectOption('#armory [data-motion]', 'jump'); await page.waitForTimeout(record ? 1400 : 300);
                report.rows.push({case: 'native-fit-ui-equip', name, state: fitted});
            }
            await page.locator('#armory [data-race]').selectOption('human');
            await page.waitForFunction(() => ASHEN.equipment.race === 'human' && !!ASHEN.creator, null, {timeout: 120000});
            await page.getByLabel('Face and hair', {exact: true}).selectOption('prime-ponytail');
            await page.waitForFunction(() => ASHEN.creator.identity.selected === 'prime-ponytail');
            await uiEquip(page,item.id);
            // Adjacent plate/cloth collars, hair/hood and both hand occupancies.
            for (const adjacent of (slot === 'shoulders' ? ['lectorCoat', 'duskguardCuirass', 'graveweaverTop'] : ['wardenPauldrons','bastionShoulders'])) {
                await page.locator(`#armory [data-equipment="${adjacentSlot}"]`).selectOption(adjacent);
                await page.waitForFunction(({slot,id}) => ASHEN.equipment.getState()[slot] === id && !ASHEN.equipment.getStatus().pending, {slot:adjacentSlot,id:adjacent});
                await page.selectOption('#armory [data-motion]', 'pulse'); await page.waitForTimeout(record ? 1000 : 200);
                mark(`Adjacent collar ${adjacent}`); await page.screenshot({path: `${out}/collar-${adjacent}.png`});
            }
            if (slot === 'torso') for (const preset of ['duskguard','graveweaver']) {
                await page.evaluate(async ({preset,id}) => {const result=await ASHEN.equipment.setLoadout({...ASHEN.equipment.presets[preset].loadout,torso:id});
                    if(result.status!=='applied')throw Error(`Mixed coat failed: ${result.status}`);}, {preset,id:item.id});
                await page.selectOption('#armory [data-motion]','run'); mark(`Fieldcoat mixed ${preset}`);
                await page.waitForTimeout(record ? 1800 : 180); await page.screenshot({path:`${out}/mixed-${preset}.png`});
                const mixed = await state(page); assertParts(mixed); assert.equal(mixed.equipment.torso,item.id);
                report.rows.push({case:'mixed-cloth-plate-boundaries',preset,state:mixed});
            }
            for (const helmet of ['graveweaverHood', '']) {
                await page.locator('#armory [data-equipment="helmet"]').selectOption(helmet);
                await page.waitForFunction(id => ASHEN.equipment.getState().helmet === (id || null) && !ASHEN.equipment.getStatus().pending, helmet);
                assert.equal(await page.evaluate(() => ASHEN.scene.meshes.find(m => m.name === 'HumanPonytail01')?.visible !== false), !helmet);
                await page.screenshot({path: `${out}/${helmet ? 'hood' : 'hair'}-shoulders.png`});
            }
            await page.getByLabel(`${slot[0].toUpperCase()+slot.slice(1)} colour`, {exact: true}).selectOption('oxblood');
            await page.waitForFunction(slot => ASHEN.equipment.getDyes()[slot] === 'oxblood',slot);
            mark(`${slot} dye preserves identity and shape`);
            for (const hand of ['ironSword', 'graveweaverGreatstaff']) {
                await page.locator('#armory [data-equipment="mainHand"]').selectOption(hand);
                await page.waitForFunction(id => ASHEN.equipment.getState().mainHand === id && !ASHEN.equipment.getStatus().pending, hand);
                for (const motion of ['idle', 'walk', 'run', 'jump', 'land', 'fire', 'lava', 'pulse', 'carry']) {
                    await page.selectOption('#armory [data-motion]', motion); mark(`${hand} ${motion}`);
                    await page.waitForTimeout(record ? 850 : 180);
                }
            }
            await page.getByRole('button', {name: 'Close armory', exact: true}).click();
            await page.evaluate(() => {ASHEN.setView('play'); ASHEN.rig.distance = ASHEN.rig.distanceTarget = 3.3;});
            const before = await page.evaluate(() => [ASHEN.player.body.position.x, ASHEN.player.body.position.z]);
            mark('Normal Havok run, turn, jump and cast');
            // Existing controls use Shift to WALK. Normal W exercises the run gait;
            // actual UI close also returns focus rather than leaving a hidden select.
            await page.keyboard.down('KeyW'); await page.waitForTimeout(900);
            await page.keyboard.down('KeyD'); await page.waitForTimeout(400); await page.keyboard.up('KeyD');
            // Jump is sampled as a held key by the existing input update; a
            // zero-duration automation press may miss every native frame.
            await page.keyboard.down('Space'); await page.waitForTimeout(120); await page.keyboard.up('Space');
            await page.waitForTimeout(1500); await page.keyboard.up('KeyW');
            const castsBefore = await page.evaluate(() => ASHEN.combat.spell.casts);
            await page.keyboard.down('KeyA'); await page.waitForTimeout(700); await page.keyboard.up('KeyA');
            let targetReady = false;
            for (let i = 0; i < 36 && !targetReady; i++) {
                if (i && i % 9 === 0) {await page.keyboard.down('KeyA'); await page.waitForTimeout(600); await page.keyboard.up('KeyA');}
                await page.keyboard.press('Tab'); await page.waitForTimeout(80);
                targetReady = await page.evaluate(() => {
                    const target = ASHEN.combat.targeting.current;
                    return target && ASHEN.combat.spell.validate({target, position: ASHEN.player.body.position,
                        grounded: ASHEN.player.getGrounded(), hasLineOfSight: () => ASHEN.combat.lineOfSight(target).clear}) === '';
                });
            }
            assert(targetReady, 'Normal Tab cycling found no castable target');
            await page.keyboard.press('Digit1'); await page.waitForTimeout(1400);
            assert((await page.evaluate(() => ASHEN.combat.spell.casts)) > castsBefore, 'Actual Fire Blast release was not observed');
            const after = await page.evaluate(() => [ASHEN.player.body.position.x, ASHEN.player.body.position.z]);
            await fs.writeFile(`${out}/movement.json`, JSON.stringify({before, after, distance: Math.hypot(after[0] - before[0], after[1] - before[1]), debug: await page.evaluate(() => ASHEN.player.getDebugState())}, null, 2));
            assert(Math.hypot(after[0] - before[0], after[1] - before[1]) > 10);
            assert((await page.evaluate(() => ASHEN.player.getDebugState().jumps)) > 0, 'Actual Havok jump was not observed');
            const saved = await state(page); assert.equal(saved.appearance.equipment[slot], item.id); assert.deepEqual(saved.gpuErrors, []); assert.equal(saved.recoveries, 0);
            assert.equal(JSON.parse(saved.storage).catalogVersion, APPEARANCE_CATALOG_VERSION);
            // The initial seed only fills empty storage. Reload must read the actual
            // Armory save; no second recipe injection manufactures persistence.
            if (record) {recording = false; await cdp.send('Page.stopScreencast'); await Promise.all(writes); await writeCaptureManifest(out, manifest, await captureSurface(page));}
            await page.reload(); await ready(page);
            const restored = await state(page); assert.deepEqual(restored.appearance, saved.appearance); assertParts(restored);
            report.rows.push({case: 'dye-motion-havok-save-reload', saved, restored, distance: Math.hypot(after[0] - before[0], after[1] - before[1])});
        } finally {
            if (record && cdp) {
                recording = false; await cdp.send('Page.stopScreencast').catch(() => {}); await Promise.all(writes);
                if (manifest.frames.length > 1) await writeCaptureManifest(out, manifest, await captureSurface(page));
            }
        }
    });
    for (const failure of ['http', 'corrupt', 'superseded', 'disposed', 'independent-slots', 'admission-refused']) await ownedCheck(async (context, page) => {
        await page.goto(url); await ready(page); await page.evaluate(() => {ASHEN.dev.god = true;});
        const cdp = await context.newCDPSession(page); await cdp.send('Network.setCacheDisabled', {cacheDisabled: true});
        let hits = 0, release, admissionRefusal = null; const held = new Promise(resolve => release = resolve);
        await page.route(`**/*${item.id}*`, async route => {
            hits++;
            if (failure === 'http' || failure === 'corrupt') return route.fulfill({status: failure === 'http' ? 500 : 200, body: Buffer.alloc(32), contentType: 'model/gltf-binary'});
            await held; await route.continue().catch(() => {});
        });
        const before = await state(page);
        try {
            await page.evaluate(({slot,id}) => {globalThis.__factoryPending = ASHEN.equipment.equip(slot, id);}, targetIntent);
            for (let i = 0; i < 100 && !hits; i++) await page.waitForTimeout(30); assert(hits > 0);
            if (failure === 'superseded') await page.evaluate(slot => {
                globalThis.__factorySkipped = ASHEN.equipment.equip(slot, slot === 'shoulders' ? 'wardenPauldrons' : 'lectorCoat');
                globalThis.__factoryLatest = ASHEN.equipment.equip(slot, null);
            },slot);
            if (failure === 'independent-slots') await page.evaluate(slot => {globalThis.__factoryLatest = ASHEN.equipment.equip(slot, slot === 'torso' ? 'lectorCoat' : 'bastionShoulders');},adjacentSlot);
            if (failure === 'disposed') await page.evaluate(() => {ASHEN.equipment.dispose();});
            if (failure === 'admission-refused') {
                // Isolated admission-bit injection, no multiplayer server or join.
                const refused = await page.evaluate(async slot => {
                    const previous = ASHEN.presence; ASHEN.presence = {closed: false, appearanceApplying: false};
                    try {await ASHEN.equipment.equip(slot, null); return null;}
                    catch (error) {return error.message;}
                    finally {ASHEN.presence = previous;}
                },slot);
                assert.match(refused, /Use Shared region/);
                admissionRefusal = refused;
                assert.equal(await page.evaluate(() => ASHEN.equipment.getStatus().pending), true, 'Refused intent cancelled an admitted fetch');
            }
            release(); const result = await page.evaluate(async () => {const result = await globalThis.__factoryPending; return {status: result.status, error: result.error ? String(result.error) : null};});
            if (failure === 'disposed') assert(['disposed', 'superseded'].includes(result.status), JSON.stringify(result));
            else assert.equal(result.status, failure === 'http' || failure === 'corrupt' ? 'failed' : ['independent-slots', 'admission-refused'].includes(failure) ? 'applied' : 'superseded');
            if (failure === 'superseded' || failure === 'independent-slots') assert.equal((await page.evaluate(() => globalThis.__factoryLatest)).status, 'applied');
            if (failure === 'superseded') assert.equal((await page.evaluate(() => globalThis.__factorySkipped)).status, 'superseded');
            const after = await state(page); assert.deepEqual(after.gpuErrors, []);
            if (failure === 'independent-slots') {
                assert.equal(after.equipment[slot], item.id); assert.equal(after.equipment[adjacentSlot], adjacentSlot === 'torso' ? 'lectorCoat' : 'bastionShoulders'); assertParts(after);
            } else if (failure === 'admission-refused') {
                assert.equal(after.equipment[slot], item.id); assertParts(after);
            } else {
                assert.equal(after.equipment[slot] ?? null, failure === 'superseded' ? null : before.equipment[slot] ?? null); assert.equal(after.parts.length, 0);
                assert.equal(after.partOwners.length, 0, 'Refused item left a native scene mesh');
            }
            report.rows.push({case: failure === 'independent-slots' ? 'independent-slot-intents' : failure === 'admission-refused' ? 'admission-refusal-preserves-pending' : 'transaction-refusal', failure, hits, result, admissionRefusal});
            if (failure === 'http' || failure === 'corrupt') {
                await page.unroute(`**/*${item.id}*`);
                const retry = await page.evaluate(({slot,id}) => ASHEN.equipment.equip(slot, id), targetIntent);
                assert.equal(retry.status, 'applied'); assertParts(await state(page));
                report.rows.push({case: 'transaction-retry', failure, status: retry.status});
            }
        } finally {release(); await page.unroute(`**/*${item.id}*`);}
    }, {expectedFailure: true});
    assert.deepEqual(report.errors, []); report.passed = true;
} catch (error) {
    report.failure = error.stack;
    console.error(error.stack);
    throw error;
} finally {
    try {await fs.writeFile(`${out}/report.json`, JSON.stringify(report, null, 2));}
    catch (error) {await fs.writeFile(`${out}/report-diagnostic.txt`, inspect(report, {depth: null})); throw error;}
    finally {await browser.close();}
    await fs.writeFile(`${out}/ownership.json`, JSON.stringify({...ownership, active: false, renderingClients: 0}, null, 2));
}
console.log(JSON.stringify({item: item.id, passed: report.passed, cases: report.rows.length, recording: record}));
