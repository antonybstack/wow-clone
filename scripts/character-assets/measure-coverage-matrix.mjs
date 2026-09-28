/**
 * M007: resolve every catalogue combination against every race and record the exceptions.
 *
 * The milestone asks for exhaustive rule tests plus pairwise and three-way conflicts, with
 * each exception recorded as data and a reason. The catalogue is small enough that
 * "exhaustive" is literal: every slot takes every item it accepts or nothing, which is 768
 * loadouts, resolved against three races.
 *
 * What comes out is not a pass/fail. Coverage exceptions are mostly *facts about the
 * bodies*: a race whose body is one mesh cannot have part of it hidden, so every garment on
 * Human and Undead raises the same exception and the Orc raises none. Reporting that per
 * combination is what turns M001's observation into something later milestones can act on.
 *
 * Occupancy is a rule, and those are pass/fail: a two-handed item claims both hands, so any
 * loadout pairing one with an off-hand item must be rejected by the catalogue validator.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import {EQUIPMENT_ITEMS, EQUIPMENT_SLOTS, validateLoadout} from '../../src/ashen-reach/equipment-catalog.js';
import {
    BODY_SEGMENTS,
    RACE_BODY_SEGMENTS,
    itemSegments,
    loadoutSeams,
    resolveCoverage,
} from '../../src/ashen-reach/coverage-contract.js';

const OUT = process.env.ASHEN_COVERAGE_REPORT || 'docs/baselines/character-mmo/m007/coverage-matrix.json';
const RACES = ['human', 'orc', 'undead'];

const bySlot = Object.fromEntries(EQUIPMENT_SLOTS.map(slot => [slot, [null]]));
for (const item of Object.values(EQUIPMENT_ITEMS)) bySlot[item.slot].push(item.id);

function* loadouts() {
    const slots = EQUIPMENT_SLOTS;
    const walk = function* (index, current) {
        if (index === slots.length) { yield {...current}; return; }
        const slot = slots[index];
        for (const id of bySlot[slot]) yield* walk(index + 1, {...current, [slot]: id});
    };
    yield* walk(0, {});
}

const rows = [];
const exceptionIndex = new Map();
let valid = 0, rejected = 0;
const occupancyFailures = [];

for (const loadout of loadouts()) {
    let accepted = true;
    let rejection = null;
    try {
        validateLoadout(loadout);
    } catch (error) {
        accepted = false;
        rejection = error.message;
    }

    // The occupancy rule, checked independently of the validator so the two must agree.
    const main = loadout.mainHand ? EQUIPMENT_ITEMS[loadout.mainHand] : null;
    const twoHandedConflict = !!(main?.twoHanded && loadout.offHand);
    if (twoHandedConflict === accepted) {
        occupancyFailures.push({
            loadout, accepted, twoHandedConflict,
            reason: twoHandedConflict
                ? 'a two-handed main hand was accepted alongside an off-hand item'
                : 'a loadout with no occupancy conflict was rejected',
            rejection,
        });
    }
    if (!accepted) { rejected++; continue; }
    valid++;

    const seams = loadoutSeams(loadout);
    const perRace = {};
    for (const race of RACES) {
        const resolved = resolveCoverage(loadout, EQUIPMENT_ITEMS, race);
        perRace[race] = {
            coveredSegments: resolved.coveredSegments,
            hiddenMeshes: resolved.hiddenMeshes,
            exceptions: resolved.exceptions.map(e => e.code),
        };
        for (const exception of resolved.exceptions) {
            const key = `${exception.code}|${race}|${exception.mesh ?? exception.segment}|${exception.requestedBy.join(',')}`;
            if (!exceptionIndex.has(key)) {
                exceptionIndex.set(key, {...exception, loadouts: 0, example: loadout});
            }
            exceptionIndex.get(key).loadouts++;
        }
    }
    rows.push({
        loadout: Object.fromEntries(Object.entries(loadout).filter(([, id]) => id != null)),
        seams: seams.map(s => `${s.seam}:${s.slots.join('+')}`),
        races: perRace,
    });
}

// Pairwise and three-way garment combinations actually exercised by the matrix.
const garmentSlots = ['helmet', 'torso', 'legs', 'boots', 'gloves'];
const pairs = new Set(), triples = new Set();
for (const row of rows) {
    const worn = garmentSlots.filter(slot => row.loadout[slot]);
    for (let i = 0; i < worn.length; i++) {
        for (let j = i + 1; j < worn.length; j++) {
            pairs.add(`${row.loadout[worn[i]]}+${row.loadout[worn[j]]}`);
            for (let k = j + 1; k < worn.length; k++) {
                triples.add(`${row.loadout[worn[i]]}+${row.loadout[worn[j]]}+${row.loadout[worn[k]]}`);
            }
        }
    }
}

const coverageBySlotItem = {};
for (const item of Object.values(EQUIPMENT_ITEMS)) {
    if (item.factory) continue;
    coverageBySlotItem[item.id] = {slot: item.slot, segments: itemSegments(item)};
}

const report = {
    schema: 1,
    generatedBy: 'scripts/character-assets/measure-coverage-matrix.mjs',
    vocabulary: {segments: BODY_SEGMENTS, races: RACES},
    raceBodies: Object.fromEntries(RACES.map(r => [r, Object.fromEntries(
        Object.entries(RACE_BODY_SEGMENTS[r]).map(([mesh, segs]) => [mesh, [...segs]]),
    )])),
    itemCoverage: coverageBySlotItem,
    totals: {
        enumerated: valid + rejected,
        valid,
        rejectedByValidator: rejected,
        distinctPairs: pairs.size,
        distinctTriples: triples.size,
        occupancyDisagreements: occupancyFailures.length,
    },
    occupancyFailures,
    exceptions: [...exceptionIndex.values()].sort((a, b) => b.loadouts - a.loadouts),
    rows,
};
await fs.mkdir(path.dirname(OUT), {recursive: true});
await fs.writeFile(OUT, `${JSON.stringify(report, null, 1)}\n`);

console.log(`enumerated ${report.totals.enumerated}, valid ${valid}, rejected ${rejected}`);
console.log(`distinct garment pairs ${pairs.size}, three-way ${triples.size}`);
console.log(`occupancy disagreements: ${occupancyFailures.length}`);
for (const e of report.exceptions) {
    console.log(`  ${e.code} ${e.race} ${e.mesh ?? e.segment} x${e.loadouts} <- ${e.requestedBy.join(',')}`);
}
console.log(`wrote ${OUT}`);
