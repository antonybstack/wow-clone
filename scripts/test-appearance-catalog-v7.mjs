/** Catalogue v7 (M8 bastionShoulders): explicit migration, frozen history, live-loader contract
 * and the generic Human shape-garment selection. Pure: no browser, Blender or asset writes.
 * https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#skins
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {
    APPEARANCE_REGISTRY, APPEARANCE_V1_REGISTRY, APPEARANCE_V2_REGISTRY, APPEARANCE_V3_REGISTRY, APPEARANCE_V4_REGISTRY,
    APPEARANCE_V5_REGISTRY, APPEARANCE_V6_REGISTRY, APPEARANCE_V7_REGISTRY, APPEARANCE_CATALOG_VERSION, DYEABLE_SLOTS,
    validateAppearance, migrateAppearance,
} from '../src/character/appearance/contract.js';
import {encodeAppearance, decodeAppearance, decodeMigratingAppearance, appearanceKey} from '../src/character/appearance/codec.js';
import {appearanceFromEquipment} from '../src/character/appearance/from-equipment.js';
import {loadAppearance, APPEARANCE_STORAGE_KEY} from '../src/character/appearance/store.js';
import {HUMAN_IDENTITY_PRESETS, IDENTITY_CATALOG_VERSION} from '../src/character/appearance/human-identity.js';
import {EQUIPMENT_ITEMS, EQUIPMENT_V6_ITEMS} from '../src/ashen-reach/equipment-catalog.js';
import {FITS_BY_RACE, declaredFitForRace, assertAssetFit} from '../src/ashen-reach/equipment-contract.js';
import {DYE_IDS} from '../src/ashen-reach/dye-palette.js';
import {selectShapeGarments, selectAuditionGarments} from './character-assets/build-garment-shape-family.mjs';

const RACES = Object.keys(FITS_BY_RACE);
const digest = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const v6Loadout = {torso: 'duskguardCuirass', legs: 'duskguardTassets', boots: 'duskguardGreaves', gloves: 'duskguardVambraces', shoulders: 'wardenPauldrons', mainHand: 'ironSword'};
const storage = (entries = {}) => { const data = new Map(Object.entries(entries)); return {getItem: (k) => data.get(k) ?? null, setItem: (k, v) => data.set(k, v)}; };

test('historical registries v1-v6 are byte-for-byte the pre-v7 registries', () => {
    // Digests taken from the v6 build before bastionShoulders existed (3312f62 + M8 catalogue).
    const frozen = {
        'appearance-catalog-v1': [APPEARANCE_V1_REGISTRY, '8352dca6d31394a4503dfd5f253502d6f64b4b736ddffe1cf6f504c6c40699cd'],
        'appearance-catalog-v2': [APPEARANCE_V2_REGISTRY, '27fec0bd66af529577d951c67ce40cd8c92caf9be329c8783448453a97011ac5'],
        'appearance-catalog-v3': [APPEARANCE_V3_REGISTRY, 'ae6266978eb3370c0e24d18a48ebe96f4c2d576db1ae0ad1614900883fd73545'],
        'appearance-catalog-v4': [APPEARANCE_V4_REGISTRY, '0fa368219773e703ce0b700ebbbe886ea7e2bd259b61b47ccb2c4a91a6175fbf'],
        'appearance-catalog-v5': [APPEARANCE_V5_REGISTRY, 'e9d88997dcdf9187f06f325b5185e3627c038a77c782fe38fd4d22f88a03b2db'],
        'appearance-catalog-v6': [APPEARANCE_V6_REGISTRY, 'c39c240514e8065660106b245d2411eb9cdbd88d687a24e603c5680c3500113a'],
    };
    for (const [version, [registry, expected]] of Object.entries(frozen)) {
        assert.equal(registry.catalogVersion, version);
        assert.equal(digest(registry), expected, `${version} changed`);
        assert.equal(Object.hasOwn(registry.items, 'bastionShoulders'), false, `${version} admits the v7 item`);
    }
    assert.equal(APPEARANCE_V7_REGISTRY.catalogVersion, 'appearance-catalog-v7');
    // The identity pack index is versioned by the catalogue that introduced identities.
    assert.equal(IDENTITY_CATALOG_VERSION, 'appearance-catalog-v6');
    // v7 changes only the item map: same schema, slots, profiles (identity, shape and dye domains).
    assert.equal(APPEARANCE_V7_REGISTRY.profiles, APPEARANCE_V6_REGISTRY.profiles);
    assert.equal(APPEARANCE_V7_REGISTRY.slots, APPEARANCE_V6_REGISTRY.slots);
    assert.deepEqual(Object.keys(APPEARANCE_V7_REGISTRY.items), [...Object.keys(EQUIPMENT_V6_ITEMS), 'bastionShoulders']);
    for (const id of Object.keys(EQUIPMENT_V6_ITEMS)) assert.equal(APPEARANCE_V7_REGISTRY.items[id], EQUIPMENT_V6_ITEMS[id]);
});

test('bastionShoulders is the declared rigid plate with every exact race fit', () => {
    const item = EQUIPMENT_ITEMS.bastionShoulders;
    assert.deepEqual({slot: item.slot, layer: item.layer, deformation: item.deformation, occupies: item.occupies, covers: item.covers, coverage: item.coverage, parts: item.parts},
        {slot: 'shoulders', layer: 'plate', deformation: 'rigid-bone', occupies: ['shoulders'], covers: [], coverage: [], parts: [{mesh: 'BastionShoulders'}]});
    for (const race of RACES) assert.deepEqual(declaredFitForRace(item, race), FITS_BY_RACE[race]);
    // The root factory descriptor and the catalogue agree on identity, mesh and policy.
    const d = JSON.parse(fs.readFileSync('blender/characters/wardrobe/bastion-shoulders.json', 'utf8'));
    assert.deepEqual([d.id, d.mesh, d.slot, d.layer, d.deformation, d.occupies], [item.id, item.parts[0].mesh, item.slot, item.layer, item.deformation, item.occupies]);
    for (const race of RACES) assert.deepEqual(d.fits[race].interface, item.fits[race]);
});

test('a v6 recipe or v6-declared profile cannot carry Bastion', () => {
    for (const race of RACES) {
        const v6 = appearanceFromEquipment({race, loadout: v6Loadout}, APPEARANCE_V6_REGISTRY);
        const smuggled = {...v6, equipment: {...v6.equipment, shoulders: 'bastionShoulders'}};
        assert.throws(() => validateAppearance(smuggled, APPEARANCE_V6_REGISTRY), {code: 'UNSUPPORTED_ITEM', path: '$.equipment.shoulders'});
        assert.throws(() => appearanceFromEquipment({race, loadout: {shoulders: 'bastionShoulders'}}, APPEARANCE_V6_REGISTRY), {code: 'UNSUPPORTED_ITEM'});
        // Migration validates against the OLD registry first, so the item is refused, not upgraded.
        assert.throws(() => decodeMigratingAppearance(JSON.stringify(smuggled)), {code: 'UNSUPPORTED_ITEM'});
        // A v6 record presented as current is refused, not silently re-labelled.
        assert.throws(() => decodeAppearance(JSON.stringify(smuggled)), {code: 'UNSUPPORTED_CATALOG'});
        for (const old of [APPEARANCE_V3_REGISTRY, APPEARANCE_V4_REGISTRY, APPEARANCE_V5_REGISTRY]) {
            const r = appearanceFromEquipment({race, loadout: {}}, old);
            assert.throws(() => validateAppearance({...r, equipment: {...r.equipment, shoulders: 'bastionShoulders'}}, old), {code: 'UNSUPPORTED_ITEM'});
        }
    }
});

test('a saved v6 recipe migrates to current keeping identity, gear, shape and dyes', () => {
    for (const preset of HUMAN_IDENTITY_PRESETS) {
        let v6 = appearanceFromEquipment({race: 'human', loadout: v6Loadout}, APPEARANCE_V6_REGISTRY);
        v6 = validateAppearance({...v6, components: preset.components, shape: {...v6.shape, height: 1.12, build: -0.6},
            dyes: {shoulders: 'oxblood', torso: 'moss'}}, APPEARANCE_V6_REGISTRY);
        const raw = encodeAppearance(v6, APPEARANCE_V6_REGISTRY), s = storage({[APPEARANCE_STORAGE_KEY]: raw});
        const loaded = loadAppearance({storage: s});
        assert.equal(loaded.restored, true); assert.equal(loaded.migrated, true); assert.equal(loaded.warning, null);
        assert.deepEqual(loaded.appearance, {...v6, catalogVersion: APPEARANCE_CATALOG_VERSION});
        assert.equal(s.getItem(APPEARANCE_STORAGE_KEY), raw, 'loading never rewrites the saved record');
    }
    for (const race of ['orc', 'undead']) {
        const v6 = validateAppearance({...appearanceFromEquipment({race, loadout: v6Loadout}, APPEARANCE_V6_REGISTRY), dyes: {gloves: 'ash'}}, APPEARANCE_V6_REGISTRY);
        assert.deepEqual(migrateAppearance(v6), {...v6, catalogVersion: APPEARANCE_CATALOG_VERSION});
    }
    assert.throws(() => migrateAppearance({...appearanceFromEquipment({race: 'human', loadout: {}}), catalogVersion: 'appearance-catalog-future'}), {code: 'UNSUPPORTED_CATALOG'});
});

test('v7 round-trips Bastion on every race with a dye, and differs in identity from Warden', () => {
    assert(DYEABLE_SLOTS.includes('shoulders'));
    const dye = DYE_IDS.find((id) => id !== 'undyed');
    for (const race of RACES) {
        const recipe = validateAppearance({...appearanceFromEquipment({race, loadout: {...v6Loadout, shoulders: 'bastionShoulders'}}), dyes: {shoulders: dye}});
        const text = encodeAppearance(recipe);
        assert.deepEqual(decodeAppearance(text), recipe);
        assert.deepEqual(decodeMigratingAppearance(text), recipe);
        assert.notEqual(appearanceKey(recipe), appearanceKey({...recipe, equipment: {...recipe.equipment, shoulders: 'wardenPauldrons'}}));
    }
});

test('a race without a declared Bastion fit is refused, never given the Human fit', () => {
    const item = EQUIPMENT_ITEMS.bastionShoulders;
    for (const missing of ['orc', 'undead']) {
        const fits = Object.fromEntries(Object.entries(item.fits).filter(([race]) => race !== missing));
        const registry = {...APPEARANCE_V7_REGISTRY, items: {...APPEARANCE_V7_REGISTRY.items, bastionShoulders: {...item, fits}}};
        const recipe = appearanceFromEquipment({race: missing, loadout: {}}, APPEARANCE_V7_REGISTRY);
        assert.throws(() => validateAppearance({...recipe, equipment: {...recipe.equipment, shoulders: 'bastionShoulders'}}, registry), {code: 'UNSUPPORTED_ITEM_FIT'});
    }
});

test('live-loader contract: each race manifest either lacks Bastion or carries its exact fit', () => {
    const item = EQUIPMENT_ITEMS.bastionShoulders;
    // The Armory lists `equipment.items` by slot, so the new plate appears without UI changes.
    assert.deepEqual(Object.values(EQUIPMENT_ITEMS).filter((i) => i.slot === 'shoulders').map((i) => i.id), ['wardenPauldrons', 'bastionShoulders']);
    for (const race of RACES) {
        const asset = {url: `/x/${race}.glb`, bytes: 1, sha256: '0'.repeat(64), meshes: ['BastionShoulders'], fit: {...FITS_BY_RACE[race]}};
        assertAssetFit(asset, item, race);
        for (const other of RACES.filter((r) => r !== race)) assert.throws(() => assertAssetFit({...asset, fit: {...FITS_BY_RACE[other]}}, item, race));
    }
    // Published packs today: absence makes equipment-stream refuse "No <race> fit"; once root
    // publishes, the entry must carry exactly that race's fit and the declared mesh.
    for (const [race, dir] of [['human', 'equipment'], ['orc', 'equipment-orc'], ['undead', 'equipment-undead'], ['human', 'human-shape-v1']]) {
        const entry = JSON.parse(fs.readFileSync(`public/ashen-reach/${dir}/manifest.json`, 'utf8')).items.bastionShoulders;
        if (!entry) continue;
        assertAssetFit(entry, item, race);
        assert.deepEqual(entry.meshes, ['BastionShoulders']);
    }
});

test('shape compiler selects catalogued shipped garments generically and keeps the released rows', () => {
    const current = JSON.parse(fs.readFileSync('public/ashen-reach/equipment/manifest.json', 'utf8'));
    const shipped = {...current,items:Object.fromEntries(Object.entries(current.items).filter(([id])=>id==='body'||Object.hasOwn(APPEARANCE_V7_REGISTRY.items,id)))};
    const items = APPEARANCE_V7_REGISTRY.items;
    const released = ['wayfarerTunic', 'wayfarerTrousers', 'wayfarerBoots', 'pilgrimTunic', 'graveweaverTop', 'graveweaverSkirt', 'graveweaverHood',
        'graveweaverGloves', 'lectorCoat', 'duskguardCuirass', 'duskguardTassets', 'duskguardGreaves', 'duskguardVambraces', 'wardenPauldrons'];
    const production = selectShapeGarments(shipped, items, {productionPlate: true});
    // Exactly the pre-M8 hardcoded production list: same order, files and rigidity.
    assert.deepEqual(production.garments.filter(g => released.includes(g.item)), released.map((item) => ({item, file: `public/ashen-reach/equipment/${item}.glb`, rigid: item === 'wardenPauldrons'})));
    if (!shipped.items.bastionShoulders) assert.deepEqual(production.awaiting, ['bastionShoulders']);
    const diagnostic = selectShapeGarments(shipped, EQUIPMENT_ITEMS).garments.find((g) => g.item === 'wardenPauldrons');
    assert.deepEqual(diagnostic, {item: 'wardenPauldrons', file: '.cache/character-mmo/m005/warden-pauldrons.glb', rigid: true,
        out: '.cache/character-mmo/m005/warden-pauldrons-shaped.glb', diagnostic: true});
    // Once root publishes Bastion into the Human manifest it is shaped as a rigid plate, appended.
    const withBastion = {...shipped, items: {...shipped.items, bastionShoulders: {url: '/x'}}};
    const next = selectShapeGarments(withBastion, items, {productionPlate: true});
    assert.deepEqual(next.garments.at(-1), {item: 'bastionShoulders', file: 'public/ashen-reach/equipment/bastionShoulders.glb', rigid: true});
    assert.deepEqual(next.garments.slice(0, -1), production.garments.filter(g => g.item !== 'bastionShoulders'));
    assert.deepEqual(next.awaiting, []);
    assert.throws(() => selectShapeGarments({items: {...shipped.items, mysteryCape: {}}}, EQUIPMENT_ITEMS), /not a catalogued garment/);
    assert.throws(() => selectShapeGarments({items: {...shipped.items, ironSword: {}}}, EQUIPMENT_ITEMS), /not a catalogued garment/);
    assert.deepEqual(selectAuditionGarments(EQUIPMENT_ITEMS, ['bastionShoulders'], '.cache/a/raw', '.cache/a/shaped'),
        [{item: 'bastionShoulders', rigid: true, file: '.cache/a/raw/bastionShoulders.glb', out: '.cache/a/shaped/bastionShoulders.glb'}]);
    assert.throws(() => selectAuditionGarments(EQUIPMENT_ITEMS, ['graveweaverStaff'], '.cache/a', '.cache/b'), /Invalid isolated/);
});
