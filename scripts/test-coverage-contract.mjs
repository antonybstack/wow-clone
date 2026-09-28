/** M007 semantic coverage and seams: the rules, exhaustively.
 *
 * The catalogue is small enough that "exhaustive" is literal -- every slot takes every item
 * it accepts or nothing, 768 loadouts -- so these tests enumerate rather than sample.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {MeshoptDecoder} from 'meshoptimizer';
import {EQUIPMENT_ITEMS, EQUIPMENT_SLOTS, resolveEquipmentVisibility, validateLoadout} from '../src/ashen-reach/equipment-catalog.js';
import {
    BODY_SEGMENTS,
    LEGACY_REGION_SEGMENTS,
    RACE_BODY_SEGMENTS,
    SLOT_SEAMS,
    itemSegments,
    loadoutSeams,
    resolveCoverage,
    sharedSeams,
} from '../src/ashen-reach/coverage-contract.js';

const RACES = ['human', 'orc', 'undead'];
const bySlot = Object.fromEntries(EQUIPMENT_SLOTS.map(slot => [slot, [null]]));
for (const item of Object.values(EQUIPMENT_ITEMS)) bySlot[item.slot].push(item.id);

function* allLoadouts() {
    const walk = function* (index, current) {
        if (index === EQUIPMENT_SLOTS.length) { yield {...current}; return; }
        const slot = EQUIPMENT_SLOTS[index];
        for (const id of bySlot[slot]) yield* walk(index + 1, {...current, [slot]: id});
    };
    yield* walk(0, {});
}
const valid = [...allLoadouts()].filter((loadout) => {
    try { validateLoadout(loadout); return true; } catch { return false; }
});

test('every catalogue coverage declaration maps to a known segment', () => {
    for (const item of Object.values(EQUIPMENT_ITEMS)) {
        const segments = itemSegments(item);
        for (const segment of segments) assert.ok(BODY_SEGMENTS.includes(segment), `${item.id} -> ${segment}`);
        // A skinned garment that covers nothing would be a declaration someone forgot.
        if (item.parts && !item.factory) assert.ok(segments.length > 0, `${item.id} covers nothing`);
    }
});

test('the migrated proof outfits mean the same thing in both vocabularies', () => {
    // Every item that declares semantic `covers` must resolve to exactly what its legacy
    // `coverage` maps to. That is the whole point of carrying both through the migration:
    // a disagreement here is a migration bug, and it cannot hide behind a coverage bug.
    let migrated = 0;
    for (const item of Object.values(EQUIPMENT_ITEMS)) {
        if (!item.covers) continue;
        migrated++;
        const legacy = [...new Set((item.coverage || []).flatMap(r => LEGACY_REGION_SEGMENTS[r]))].sort();
        assert.deepEqual([...item.covers].sort(), legacy, `${item.id} declares a different meaning in each vocabulary`);
    }
    // Both proof outfits, every piece: Wayfarer tunic/trousers/boots and the four Graveweaver pieces.
    assert.equal(migrated, 7);
});

test('the legacy region adapter is total over what the catalogue uses', () => {
    for (const item of Object.values(EQUIPMENT_ITEMS)) {
        for (const region of item.coverage || []) {
            assert.ok(Object.hasOwn(LEGACY_REGION_SEGMENTS, region), `no mapping for ${region} on ${item.id}`);
        }
    }
});

test('unknown segments and regions are rejected rather than ignored', () => {
    assert.throws(() => itemSegments({id: 'x', covers: ['torso.middle']}), /Unknown body segment/);
    assert.throws(() => itemSegments({id: 'x', coverage: ['BodyElbow']}), /Unknown legacy coverage region/);
    assert.throws(() => resolveCoverage({torso: 'wayfarerTunic'}, EQUIPMENT_ITEMS, 'elf'), /No body segment map/);
    assert.throws(() => resolveCoverage({torso: 'nope'}, EQUIPMENT_ITEMS, 'human'), /Unknown item/);
    assert.throws(() => resolveCoverage({legs: 'wayfarerTunic'}, EQUIPMENT_ITEMS, 'human'), /occupies torso/);
});

test('separate Human ponytail follows hood coverage while the fused face stays visible', () => {
    const withTail = {...RACE_BODY_SEGMENTS.human, HumanPonytail01: ['head.scalp']};
    const withoutHood = resolveCoverage({helmet: null}, EQUIPMENT_ITEMS, 'human', withTail);
    const withHood = resolveCoverage({helmet: 'graveweaverHood'}, EQUIPMENT_ITEMS, 'human', withTail);
    assert.ok(!withoutHood.hiddenMeshes.includes('HumanPonytail01'));
    assert.ok(withHood.hiddenMeshes.includes('HumanPonytail01'));
    assert.ok(!withHood.hiddenMeshes.includes('HumanV1Body'));
});

test('two-handed occupancy agrees with the catalogue validator on every combination', () => {
    let checked = 0;
    for (const loadout of allLoadouts()) {
        const main = loadout.mainHand ? EQUIPMENT_ITEMS[loadout.mainHand] : null;
        const conflict = !!(main?.twoHanded && loadout.offHand);
        let accepted = true;
        try { validateLoadout(loadout); } catch { accepted = false; }
        assert.equal(accepted, !conflict, `${JSON.stringify(loadout)} accepted=${accepted} conflict=${conflict}`);
        checked++;
    }
    assert.equal(checked, 768);
});

test('the Orc adapter retains shipped visibility for every valid loadout', () => {
    // M007 moves the streamed runtime from named Human regions to semantic segments. The
    // Orc shorts span waist and upper leg, so a torso-only outfit must leave them visible.
    // Compare all combinations to the previous, shipped visibility rule before accepting
    // the migration. docs/plans/character-mmo/m007-mixed-equipment.md
    for (const loadout of valid) {
        const legacy = resolveEquipmentVisibility(loadout);
        const resolved = resolveCoverage(loadout, EQUIPMENT_ITEMS, 'orc');
        const hidden = new Set(resolved.hiddenMeshes);
        for (const name of ['BodyExposed', 'BodyUnderTunic', 'BodyUnderLegs', 'BodyUnderBoots', 'BodyWaist', 'BodyHands']) {
            assert.equal(hidden.has(name), legacy[name] === false, `${name} on ${JSON.stringify(loadout)}`);
        }
        assert.equal(hidden.has('OrcV1Hair'), legacy.HumanHair === false);
        assert.equal(hidden.has('OrcV1Shorts'), legacy.BodyUnderLegs === false,
            `shorts on ${JSON.stringify(loadout)}`);
        for (const name of ['OrcV1Brows', 'OrcV1Eyes']) assert.ok(!hidden.has(name));
        assert.ok(!resolved.exceptions.some(e => e.code === 'SEGMENT_ABSENT_ON_RACE'));
    }
});

test('a one-mesh body can only be hidden when everything it carries is covered', () => {
    // Human and Undead each carry the whole body on one mesh, so a tunic cannot hide any of
    // it. This is the mechanism behind M001's observation and behind M005 having to keep
    // the body inside the cloth rather than switch it off.
    for (const race of ['human', 'undead']) {
        const body = race === 'human' ? 'HumanV1Body' : 'UndeadV1Body';
        const dressed = {helmet: null, torso: 'wayfarerTunic', legs: 'wayfarerTrousers', boots: 'wayfarerBoots', gloves: 'graveweaverGloves', mainHand: null, offHand: null};
        const resolved = resolveCoverage(dressed, EQUIPMENT_ITEMS, race);
        assert.ok(!resolved.hiddenMeshes.includes(body), `${race} hid its whole body`);
        const exception = resolved.exceptions.find(e => e.mesh === body);
        assert.ok(exception, `${race} raised no exception for ${body}`);
        assert.equal(exception.code, 'MESH_CARRIES_UNCOVERED_SEGMENTS');
        assert.ok(exception.uncoveredSegments.includes('head.face'), 'the face is what keeps it visible');
        assert.ok(exception.reason.includes(body));
    }
});

test('hair under headwear: the hood covers the scalp only where a scalp geoset exists', () => {
    const hooded = {helmet: 'graveweaverHood', torso: null, legs: null, boots: null, gloves: null, mainHand: null, offHand: null};
    assert.ok(itemSegments(EQUIPMENT_ITEMS.graveweaverHood).includes('head.scalp'));
    // Only the Orc has hair as its own mesh, so it is the only race the hood can uncover.
    assert.deepEqual(resolveCoverage(hooded, EQUIPMENT_ITEMS, 'orc').hiddenMeshes, ['OrcV1Hair']);

    // The Human's hair is fused into the body mesh -- M006 measured that -- so the hood
    // covers a scalp that cannot be switched off independently of the face.
    const human = resolveCoverage(hooded, EQUIPMENT_ITEMS, 'human');
    assert.deepEqual(human.hiddenMeshes, []);
    const fused = human.exceptions.find(e => e.code === 'MESH_CARRIES_UNCOVERED_SEGMENTS');
    assert.ok(fused, 'the Human hood coverage must be reported, not silently dropped');
    assert.equal(fused.mesh, 'HumanV1Body');
    assert.ok(fused.coveredSegments.includes('head.scalp'));

    // The Undead is a skull: no scalp geoset at all, so the declaration names nothing.
    const undead = resolveCoverage(hooded, EQUIPMENT_ITEMS, 'undead');
    assert.deepEqual(undead.hiddenMeshes, []);
    const absent = undead.exceptions.find(e => e.code === 'SEGMENT_ABSENT_ON_RACE');
    assert.ok(absent, 'the Undead hood coverage must be reported, not silently dropped');
    assert.equal(absent.segment, 'head.scalp');
    assert.deepEqual(absent.requestedBy, ['graveweaverHood']);
});

test('the adapter names only meshes the shipped packs actually contain', async () => {
    // Read out of each pack's body.glb, not taken from BASE_VISIBLE_MESHES, which lists
    // names from the older preloaded path that the streamed route never loads.
    const packs = {
        human: 'public/ashen-reach/equipment/body.glb',
        orc: 'public/ashen-reach/equipment-orc/body.glb',
        undead: 'public/ashen-reach/equipment-undead/body.glb',
    };
    await MeshoptDecoder.ready;
    const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder': MeshoptDecoder});
    for (const [race, path] of Object.entries(packs)) {
        const doc = await io.read(path);
        const names = doc.getRoot().listNodes().filter(n => n.getMesh()).map(n => n.getName());
        assert.deepEqual(Object.keys(RACE_BODY_SEGMENTS[race]).sort(), names.sort(), `${race} adapter does not match ${path}`);
    }
});

test('bare states resolve: no helmet, no gloves, nothing at all', () => {
    const empty = Object.fromEntries(EQUIPMENT_SLOTS.map(slot => [slot, null]));
    for (const race of RACES) {
        const bare = resolveCoverage(empty, EQUIPMENT_ITEMS, race);
        assert.deepEqual(bare.coveredSegments, []);
        assert.deepEqual(bare.hiddenMeshes, []);
        assert.deepEqual(bare.exceptions, []);
        const noGloves = resolveCoverage({...empty, torso: 'wayfarerTunic'}, EQUIPMENT_ITEMS, race);
        assert.ok(!noGloves.coveredSegments.includes('hand'), `${race} covered hands with no gloves`);
        const noHelmet = resolveCoverage({...empty, torso: 'wayfarerTunic', legs: 'wayfarerTrousers'}, EQUIPMENT_ITEMS, race);
        assert.ok(!noHelmet.coveredSegments.includes('head.scalp'), `${race} covered the scalp with no helmet`);
    }
});

test('seams name the boundary two garments actually share', () => {
    assert.deepEqual(sharedSeams('torso', 'legs'), ['waist']);
    assert.deepEqual(sharedSeams('legs', 'boots'), ['ankle']);
    assert.deepEqual(sharedSeams('torso', 'gloves'), ['wrist']);
    assert.deepEqual(sharedSeams('helmet', 'torso'), ['neck']);
    assert.deepEqual(sharedSeams('boots', 'gloves'), []);
    assert.deepEqual(sharedSeams('mainHand', 'offHand'), []);
    for (const slot of EQUIPMENT_SLOTS) assert.ok(Object.hasOwn(SLOT_SEAMS, slot), `no seams declared for ${slot}`);
    const full = {helmet: 'graveweaverHood', torso: 'wayfarerTunic', legs: 'wayfarerTrousers', boots: 'wayfarerBoots', gloves: 'graveweaverGloves', mainHand: null, offHand: null};
    const seams = loadoutSeams(full).map(s => `${s.seam}:${s.slots.join('+')}`);
    assert.deepEqual(seams, ['ankle:boots+legs', 'neck:helmet+torso', 'waist:legs+torso', 'wrist:gloves+torso']);
});

test('every valid combination resolves on every race without throwing', () => {
    let pairs = new Set(), triples = new Set();
    const garmentSlots = ['helmet', 'torso', 'legs', 'boots', 'gloves'];
    for (const loadout of valid) {
        for (const race of RACES) {
            const resolved = resolveCoverage(loadout, EQUIPMENT_ITEMS, race);
            // An exception must always carry the reason it happened.
            for (const exception of resolved.exceptions) {
                assert.ok(exception.reason && exception.code, `exception without a reason on ${race}`);
                assert.ok(exception.requestedBy.length, 'an exception must name what asked for it');
            }
            // A hidden mesh must be one this race actually has.
            for (const mesh of resolved.hiddenMeshes) {
                assert.ok(Object.hasOwn(RACE_BODY_SEGMENTS[race], mesh), `${race} hid unknown mesh ${mesh}`);
            }
        }
        const worn = garmentSlots.filter(slot => loadout[slot]);
        for (let i = 0; i < worn.length; i++) {
            for (let j = i + 1; j < worn.length; j++) {
                pairs.add(`${loadout[worn[i]]}+${loadout[worn[j]]}`);
                for (let k = j + 1; k < worn.length; k++) {
                    triples.add(`${loadout[worn[i]]}+${loadout[worn[j]]}+${loadout[worn[k]]}`);
                }
            }
        }
    }
    assert.equal(valid.length, 672);
    assert.equal(pairs.size, 24, 'cross-set pair coverage');
    assert.equal(triples.size, 34, 'three-way coverage');
});
