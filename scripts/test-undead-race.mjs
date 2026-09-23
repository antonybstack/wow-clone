/**
 * Undead race integration.
 *
 * The requirement this file exists to defend, from docs/undead-race-plan.md step 4:
 * "Unsupported combinations must never silently receive a Human fit."
 *
 * A happy-path test proves nothing about that, so almost everything here is a refusal
 * test: a missing garment, a garment carrying another race's fit, a pack pointed at the
 * wrong directory, corrupted bytes, a deleted file, an unknown race, an incomplete body.
 * Each one must fail loudly, name the race, and leave the previous loadout intact.
 *
 * The streamed cases drive the real createStreamedEquipment against the real pack on
 * disk, so they exercise the actual guards rather than a restatement of them.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {
    EQUIPMENT_ITEMS, UNDEAD_BASE_VISIBLE_MESHES, ORC_BASE_VISIBLE_MESHES, BODY_REGIONS, gripHold,
} from '../src/ashen-reach/equipment-catalog.js';
import {
    HUMAN_EQUIPMENT_FIT, ORC_EQUIPMENT_FIT, UNDEAD_EQUIPMENT_FIT, FITS_BY_RACE, EQUIPMENT_RACES,
    raceForFit, declaredFitForRace, assertAssetFit,
} from '../src/ashen-reach/equipment-contract.js';
import {createStreamedEquipment} from '../src/ashen-reach/equipment-stream.js';

const DIR = 'public/ashen-reach/equipment-undead-provisional';
const MANIFEST_URL = `/ashen-reach/${DIR.split('/').pop()}/manifest.json`;
const manifest = JSON.parse(await fs.readFile(`${DIR}/manifest.json`, 'utf8'));
const PROVISIONAL_MESHES = [...BODY_REGIONS];
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);

// ---------------------------------------------------------------------------------------
// 1. The fit contract itself
// ---------------------------------------------------------------------------------------

test('the Undead fit is a distinct identity wired into the race map', () => {
    assert.deepEqual(UNDEAD_EQUIPMENT_FIT, {body: 'ashen-undead', rig: 'source-65', bind: 1, shape: 1});
    assert.deepEqual([...EQUIPMENT_RACES].sort(), ['human', 'orc', 'undead']);
    assert.equal(FITS_BY_RACE.undead, UNDEAD_EQUIPMENT_FIT);
    // Distinct from both existing races: a fit that compared equal to Human would make
    // every guard below pass while still dressing an Undead in Human geometry.
    assert.notDeepEqual(UNDEAD_EQUIPMENT_FIT, HUMAN_EQUIPMENT_FIT);
    assert.notDeepEqual(UNDEAD_EQUIPMENT_FIT, ORC_EQUIPMENT_FIT);
});

test('an unrecognised fit is an error, not a Human', () => {
    assert.equal(raceForFit(UNDEAD_EQUIPMENT_FIT), 'undead');
    assert.equal(raceForFit(HUMAN_EQUIPMENT_FIT), 'human');
    assert.equal(raceForFit(ORC_EQUIPMENT_FIT), 'orc');
    // The replaced inference was `fit.body === 'ashen-orc' ? 'orc' : 'human'`, which
    // answered "human" for every one of these.
    for (const fit of [{body: 'ashen-elf'}, {body: 'ashen-undead-v2'}, {}, null, undefined]) {
        assert.throws(() => raceForFit(fit), /Unsupported equipment fit/);
    }
});

test('an item with no fit for a race is refused, never given the Human one', () => {
    const tunic = EQUIPMENT_ITEMS.wayfarerTunic;
    assert.deepEqual(declaredFitForRace(tunic, 'undead'), UNDEAD_EQUIPMENT_FIT);

    // An item fitted for Human and Orc only -- the shape every catalogue item had before
    // this milestone, and the shape a partially-fitted Undead catalogue will have again.
    const unfitted = {id: 'ghostMantle', name: 'Ghost mantle', slot: 'torso',
        fit: {...HUMAN_EQUIPMENT_FIT}, fits: {human: {...HUMAN_EQUIPMENT_FIT}, orc: {...ORC_EQUIPMENT_FIT}}};

    // The exact regression. The old resolution was `item.fits?.[raceFit] || item.fit`,
    // and `item.fit` is the Human fit, so an Undead request used to come back Human and
    // load. Assert both halves: what the old expression produced, and that we now throw.
    const legacy = unfitted.fits?.undead || unfitted.fit;
    assert.deepEqual(legacy, HUMAN_EQUIPMENT_FIT, 'sanity: the old fallback really did yield Human');
    assert.throws(() => declaredFitForRace(unfitted, 'undead'), /No undead fit for Ghost mantle/);

    assert.throws(() => declaredFitForRace(tunic, 'elf'), /Unsupported equipment race/);
});

test('a manifest entry carrying another race fit is rejected for that race', () => {
    const tunic = EQUIPMENT_ITEMS.wayfarerTunic;
    assert.deepEqual(assertAssetFit({fit: {...UNDEAD_EQUIPMENT_FIT}}, tunic, 'undead'), UNDEAD_EQUIPMENT_FIT);

    // Human geometry offered to an Undead: the silent substitution, caught.
    assert.throws(() => assertAssetFit({fit: {...HUMAN_EQUIPMENT_FIT}}, tunic, 'undead'),
        /Incompatible undead body fit.*ashen-human is not ashen-undead/);
    assert.throws(() => assertAssetFit({fit: {...ORC_EQUIPMENT_FIT}}, tunic, 'undead'), /Incompatible undead body fit/);
    // ...and the reverse, so the Undead pack cannot leak into a Human.
    assert.throws(() => assertAssetFit({fit: {...UNDEAD_EQUIPMENT_FIT}}, tunic, 'human'), /Incompatible human body fit/);

    // A malformed or absent fit block is a refusal, not a default.
    for (const asset of [{}, {fit: null}, {fit: {body: 'ashen-undead'}}, null]) {
        assert.throws(() => assertAssetFit(asset, tunic, 'undead'), /undead/);
    }
});

test('every catalogue item declares a real Undead fit', () => {
    for (const [id, item] of Object.entries(EQUIPMENT_ITEMS)) {
        assert.deepEqual(item.fits.undead, UNDEAD_EQUIPMENT_FIT, id);
        assert.notDeepEqual(item.fits.undead, item.fits.human, id);
    }
});

test('Undead uses the authored grip until a correction is measured', () => {
    // Grip offsets are a pose correction on a procedural prop that binds to no body, so
    // an absent entry means "the authored hold is right" -- unlike a fit, which may not
    // default. Recorded so that flipping to the real body is a deliberate re-measure.
    const staff = EQUIPMENT_ITEMS.graveweaverStaff;
    assert.equal(staff.grips.undead, undefined);
    assert.deepEqual(gripHold(staff, 'undead'), gripHold(staff, 'human'));
    assert.notDeepEqual(gripHold(staff, 'orc'), gripHold(staff, 'human'));
});

// ---------------------------------------------------------------------------------------
// 2. The streamed load path, driven for real
// ---------------------------------------------------------------------------------------

const EMPTY = {helmet: null, torso: null, legs: null, boots: null, gloves: null, mainHand: null, offHand: null};

/**
 * Minimal stand-ins for the renderer-owned objects. Enough for createStreamedEquipment to
 * boot, validate a pack and run its guards; a real GPU engine is only needed once a load
 * gets as far as loadGltf, which is exactly the line these tests want to stop short of.
 */
const fakeMesh = name => ({
    name, _gpu: {}, children: [], parent: null,
    skeleton: {boneCount: 65, boneTexture: {}, boneMatrices: new Float32Array(16)},
    receiveShadows: false,
    position: {x: 0, y: 0, z: 0, set() {}},
    rotationQuaternion: {x: 0, y: 0, z: 0, w: 1, set() {}},
    scaling: {set() {}},
    worldMatrix: new Float32Array(16),
});
const fakeBody = names => ({
    container: {entities: names.map(fakeMesh)},
    root: {children: [], parent: null, worldMatrix: new Float32Array(16)},
    getState: () => ({castingShoot: false}),
    setHandGripProvider() {},
});
const socket = () => ({node: {children: [], parent: null, worldMatrix: new Float32Array(16)}});
const fakeSockets = () => ({
    sockets: Object.fromEntries(['mainHand', 'offHand', 'back', 'helmet', 'torso', 'legs', 'boots', 'gloves'].map(s => [s, socket()])),
    sync() {},
});

/** Serve public/ from disk, with per-URL overrides for the corruption cases. */
function installFetch(overrides = {}) {
    globalThis.fetch = async url => {
        if (Object.hasOwn(overrides, url)) {
            const value = overrides[url];
            if (value === null) return {ok: false, status: 404};
            // A string override is a raw response body, so it goes through a real JSON.parse and
            // can genuinely reject -- otherwise the stub would be kinder than the browser and the
            // malformed-manifest path would pass here while failing live.
            if (typeof value === 'string') return {ok: true, json: async () => JSON.parse(value), arrayBuffer: async () => value};
            return {ok: true, json: async () => value, arrayBuffer: async () => value};
        }
        const buf = await fs.readFile('public' + url).catch(() => null);
        if (!buf) return {ok: false, status: 404};
        return {
            ok: true,
            json: async () => JSON.parse(buf.toString('utf8')),
            arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
        };
    };
}

async function bootUndead({manifestUrl = MANIFEST_URL, fitId = UNDEAD_EQUIPMENT_FIT, race = 'undead',
    baseMeshes = [...PROVISIONAL_MESHES], bodyMeshes, overrides = {}} = {}) {
    installFetch(overrides);
    return createStreamedEquipment({}, {}, fakeBody(bodyMeshes || baseMeshes), fakeSockets(),
        {manifestUrl, fitId, race, baseMeshes, bootLoadout: EMPTY});
}

const GUARD = /fit|pack|coverage|race/i;

test('the provisional Undead pack boots and its garments clear every fit guard', async () => {
    const equipment = await bootUndead();
    assert.deepEqual(equipment.getState(), EMPTY);

    // A correct Undead garment must not be refused. It cannot finish here because
    // loadGltf needs a real engine, so assert it got past the manifest, the fit check,
    // the byte-length check and the SHA-256 check and died inside the loader instead.
    const result = await equipment.equip('torso', 'wayfarerTunic');
    assert.equal(result.status, 'failed');
    assert.doesNotMatch(result.error, GUARD,
        `a valid Undead garment was refused by a guard: ${result.error}`);
    equipment.dispose();
});

test('an Undead pack pointed at the Human directory is refused outright', async () => {
    // The likeliest real mistake: UNDEAD_PACK_DIR left pointing somewhere else. Without
    // the manifest fitId check this loads cleanly and draws a Human in Undead's place.
    await assert.rejects(
        bootUndead({manifestUrl: '/ashen-reach/equipment/manifest.json'}),
        /Equipment pack is ashen-human, not ashen-undead/);
    await assert.rejects(
        bootUndead({manifestUrl: '/ashen-reach/equipment-orc/manifest.json'}),
        /Equipment pack is ashen-orc, not ashen-undead/);
});

test('a pack whose declared race and fit disagree is refused', async () => {
    await assert.rejects(bootUndead({race: 'human'}), /Pack declares race human but carries the ashen-undead fit/);
    await assert.rejects(bootUndead({fitId: {body: 'ashen-elf', rig: 'source-65', bind: 1, shape: 1}, race: undefined}),
        /Unsupported equipment fit: ashen-elf/);
});

test('a Human-fit garment inside the Undead manifest fails loudly and changes nothing', async () => {
    const tampered = structuredClone(manifest);
    tampered.items.wayfarerTunic.fit = {...HUMAN_EQUIPMENT_FIT};
    const equipment = await bootUndead({overrides: {[MANIFEST_URL]: tampered}});

    const result = await equipment.equip('torso', 'wayfarerTunic');
    assert.equal(result.status, 'failed');
    assert.match(result.error, /Incompatible undead body fit.*ashen-human is not ashen-undead/);
    // The previous character is left coherent: nothing equipped, nothing half-applied.
    assert.equal(equipment.getState().torso, null);
    equipment.dispose();
});

test('a garment the Undead pack does not carry is refused by name', async () => {
    const thinned = structuredClone(manifest);
    delete thinned.items.wayfarerTunic;
    const equipment = await bootUndead({overrides: {[MANIFEST_URL]: thinned}});

    const result = await equipment.equip('torso', 'wayfarerTunic');
    assert.equal(result.status, 'failed');
    assert.match(result.error, /No undead fit for Wayfarer mail tunic/);
    assert.equal(equipment.getState().torso, null);

    // The rest of the pack still works, so a partial Undead catalogue degrades per item
    // rather than dropping the race.
    const other = await equipment.equip('boots', 'wayfarerBoots');
    assert.doesNotMatch(other.error ?? '', GUARD);
    equipment.dispose();
});

test('a deleted or corrupted Undead asset fails loudly and preserves the loadout', async () => {
    const url = `/ashen-reach/equipment-undead-provisional/wayfarerTunic.glb`;

    const gone = await bootUndead({overrides: {[url]: null}});
    const missing = await gone.equip('torso', 'wayfarerTunic');
    assert.equal(missing.status, 'failed');
    // The message has to name the race and the file, not just say something went wrong: a bare
    // "could not load" is what sent the reviewer hunting through the network tab last time.
    assert.match(missing.error, /Could not load the undead Wayfarer mail tunic/);
    assert.match(missing.error, new RegExp(url.replace(/\//g, '\\/')));
    assert.equal(gone.getState().torso, null);
    gone.dispose();

    // Right length, wrong bytes: caught by the digest rather than handed to the loader.
    const zeroed = new ArrayBuffer(manifest.items.wayfarerTunic.bytes);
    const corrupt = await bootUndead({overrides: {[url]: zeroed}});
    const bad = await corrupt.equip('torso', 'wayfarerTunic');
    assert.equal(bad.status, 'failed');
    assert.match(bad.error, /undead Wayfarer mail tunic .*does not match its manifest hash/);
    assert.equal(corrupt.getState().torso, null);
    corrupt.dispose();
});

test('an Undead body missing a coverage region names the region', async () => {
    // What a mis-split authored body will actually look like when UNDEAD_PACK_DIR flips.
    await assert.rejects(
        bootUndead({bodyMeshes: PROVISIONAL_MESHES.filter(n => n !== 'BodyHands')}),
        /Missing undead body coverage: BodyHands/);
});

test('a missing Undead manifest is named, not silently replaced', async () => {
    const url = '/ashen-reach/equipment-undead-provisional/manifest.json';
    // A 404 and a dev server's HTML fallback are the two shapes a deleted pack really takes.
    // Both must name the race and the URL, and neither may quietly boot the Human pack.
    await assert.rejects(bootUndead({overrides: {[url]: null}}),
        /No undead equipment manifest at .*equipment-undead-provisional/);
    await assert.rejects(bootUndead({overrides: {[url]: '<!doctype html><html></html>'}}),
        /undead equipment manifest at .*is not valid JSON/);
});

test('an invented race is stopped before it can inherit any Human mapping', async () => {
    // Defence in depth: the fit guard fires first, so an unknown race never reaches
    // packVisibility's alias table at all. Asserted at the layer that actually catches it.
    const fit = {body: 'ashen-wraith', rig: 'source-65', bind: 1, shape: 1};
    installFetch({[MANIFEST_URL]: {...structuredClone(manifest), fitId: 'ashen-wraith'}});
    await assert.rejects(
        createStreamedEquipment({}, {}, fakeBody([...PROVISIONAL_MESHES]), fakeSockets(),
            {manifestUrl: MANIFEST_URL, fitId: fit, race: 'wraith',
                baseMeshes: [...UNDEAD_BASE_VISIBLE_MESHES], bootLoadout: EMPTY}),
        /Unsupported equipment fit: ashen-wraith/);
});

test('every declared race boots through the same path with its own visibility mapping', async () => {
    // packVisibility throws for a race with no alias entry, and it runs on the first apply,
    // so booting each race is what proves the table covers EQUIPMENT_RACES. If a fourth
    // race is added to FITS_BY_RACE without an alias entry, this fails.
    const packs = {
        human: {manifest: '/ashen-reach/equipment/manifest.json', fit: HUMAN_EQUIPMENT_FIT, meshes: ['HumanV1Body']},
        orc: {manifest: '/ashen-reach/equipment-orc/manifest.json', fit: ORC_EQUIPMENT_FIT, meshes: ORC_BASE_VISIBLE_MESHES},
        undead: {manifest: MANIFEST_URL, fit: UNDEAD_EQUIPMENT_FIT, meshes: PROVISIONAL_MESHES},
    };
    assert.deepEqual(Object.keys(packs).sort(), [...EQUIPMENT_RACES].sort(),
        'a race gained a fit without gaining a pack in this test');

    for (const [race, pack] of Object.entries(packs)) {
        installFetch();
        const equipment = await createStreamedEquipment({}, {}, fakeBody([...pack.meshes]), fakeSockets(),
            {manifestUrl: pack.manifest, fitId: pack.fit, race, baseMeshes: [...pack.meshes], bootLoadout: EMPTY});
        assert.deepEqual(equipment.getState(), EMPTY, race);
        equipment.dispose();
    }
});

// ---------------------------------------------------------------------------------------
// 3. The provisional pack on disk
// ---------------------------------------------------------------------------------------

test('the provisional pack declares the Undead fit and never a Human one', async () => {
    assert.equal(manifest.fitId, 'ashen-undead');
    assert.equal(manifest.provisional, true, 'the stand-in must admit it is one');
    assert.deepEqual(manifest.items.body.meshes, [...PROVISIONAL_MESHES]);
    assert.deepEqual([...PROVISIONAL_MESHES], [...BODY_REGIONS]);
    assert.deepEqual([...UNDEAD_BASE_VISIBLE_MESHES], ['UndeadV1Body', 'UndeadV1Eyes']);

    const garments = Object.entries(manifest.items).filter(([id]) => id !== 'body');
    assert.equal(garments.length, 8);
    for (const [id, asset] of garments) {
        // The whole milestone turns on this line: a stand-in that declared a Human fit to
        // make itself load would make every refusal test above vacuous.
        assert.deepEqual(asset.fit, UNDEAD_EQUIPMENT_FIT, id);
        assert.deepEqual(asset.fit, EQUIPMENT_ITEMS[id].fits.undead, id);
    }
    // Belt and braces: no Human or Orc fit string anywhere in the manifest.
    const text = await fs.readFile(`${DIR}/manifest.json`, 'utf8');
    assert.doesNotMatch(text, /ashen-human|ashen-orc/);
});

test('provisional pack bytes, hashes and bind match what the manifest claims', async () => {
    const rig = doc => {
        const skin = doc.getRoot().listSkins()[0];
        return {
            joints: skin.listJoints().map(n => [n.getName(), n.getWorldMatrix()]),
            inverseBind: Array.from(skin.getInverseBindMatrices().getArray()),
        };
    };
    const source = await io.read(`${DIR}/body.glb`);
    assert.equal(source.getRoot().listSkins()[0].listJoints().length, 65);

    for (const [id, asset] of Object.entries(manifest.items)) {
        const bytes = await fs.readFile('public' + asset.url);
        assert.equal(bytes.length, asset.bytes, id);
        assert.equal(createHash('sha256').update(bytes).digest('hex'), asset.sha256, id);
        const doc = await io.readBinary(bytes);
        // Every garment borrows the actor palette at runtime, so the bind must be identical.
        assert.deepEqual(rig(doc), rig(source), id);
        assert.deepEqual(
            doc.getRoot().listNodes().filter(n => n.getMesh()).map(n => n.getName()).sort(),
            [...asset.meshes].sort(), id);
        if (id === 'body') assert.equal(doc.getRoot().listAnimations().length, 55);
        else assert.equal(doc.getRoot().listAnimations().length, 0, id);
    }
});

test('the provisional Undead body carries no hair geoset', async () => {
    // The approved Undead is a skull face. UNDEAD_BASE_VISIBLE_MESHES omits HumanHair, so a
    // body that still shipped one would leave it permanently visible and unhideable by the
    // hood, whose coverage names a mesh this race does not bind.
    const doc = await io.read(`${DIR}/body.glb`);
    const names = doc.getRoot().listNodes().filter(n => n.getMesh()).map(n => n.getName());
    assert.ok(!names.includes('HumanHair'), `hair survived: ${names}`);
    assert.ok(!UNDEAD_BASE_VISIBLE_MESHES.includes('HumanHair'));
});

test('the shipped Human and Orc packs still declare their own fit', async () => {
    // The pack-identity check is unconditional, so a regenerated manifest that dropped
    // fitId would break those races at runtime. Fail here instead.
    for (const [dir, fit] of [['equipment', 'ashen-human'], ['equipment-orc', 'ashen-orc']]) {
        const other = JSON.parse(await fs.readFile(`public/ashen-reach/${dir}/manifest.json`, 'utf8'));
        assert.equal(other.fitId, fit, dir);
    }
});
