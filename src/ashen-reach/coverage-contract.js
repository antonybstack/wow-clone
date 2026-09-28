/**
 * M007 semantic coverage and seams.
 *
 * Until now "coverage" was a list of Human mesh names that an item promised to hide, and
 * every race resolved those names through aliases. That works only where a body happens to
 * be split the way the Human catalogue was written, and M001 recorded what it costs:
 * `BASE_VISIBLE_MESHES` lists six body regions, the shipped Human body is the single mesh
 * `HumanV1Body`, and so every Human coverage declaration in the catalogue hides nothing at
 * all. The declarations looked satisfied and were inert.
 *
 * This replaces the vocabulary with one that is about the *body*, not about anyone's mesh
 * names. An item covers semantic segments. A race declares which segments each of its body
 * meshes carries. A mesh may be hidden only when every segment it carries is covered by
 * something -- which is the rule that makes the Human case fall out correctly rather than
 * silently: one mesh carrying the face and the hands cannot be hidden by a tunic, and the
 * resolver says so instead of pretending.
 *
 * Seams are the boundaries where two garments meet on the body. They are declared per slot
 * and used to detect which pairs of equipped items actually abut, so a combination test can
 * name the seam it is checking instead of eyeballing a join.
 *
 * Pure data and pure functions: no engine import, no asset load, no mesh.
 */

/** Race-independent body segments. Ordered head to foot; `.l`/`.r` are not distinguished
 *  because no catalogue item covers one side only. */
export const BODY_SEGMENTS = Object.freeze([
    'head.scalp',
    'head.face',
    'neck',
    'torso.upper',
    'torso.lower',
    'waist',
    'arm.upper',
    'arm.lower',
    'hand',
    'leg.upper',
    'leg.lower',
    'foot',
]);

/** Boundaries where garments meet. A seam belongs to the pair of slots that share it. */
export const SEAMS = Object.freeze(['neck', 'waist', 'wrist', 'ankle']);

/** Which seams each slot can present. Two items abut when they share one. */
export const SLOT_SEAMS = Object.freeze({
    helmet: Object.freeze(['neck']),
    torso: Object.freeze(['neck', 'waist', 'wrist']),
    legs: Object.freeze(['waist', 'ankle']),
    boots: Object.freeze(['ankle']),
    gloves: Object.freeze(['wrist']),
    mainHand: Object.freeze([]),
    offHand: Object.freeze([]),
});

/**
 * What each race's body meshes actually carry.
 *
 * This is the adapter the milestone asks for, and it is a statement about the asset, not a
 * wish. Every mesh named here was read out of the shipped pack's `body.glb`, not taken from
 * the catalogue's `BASE_VISIBLE_MESHES`, which turned out to describe something else: it
 * lists six body regions plus `HumanHair` and `HumanEyes`, and the streamed Human body is
 * the single mesh `HumanV1Body`. Those names belong to the older preloaded
 * `wanderer-equipment.glb` path, and on the route the game actually runs they name nothing.
 *
 * Asset evidence: docs/baselines/character-mmo/m001/asset-census.json and
 * docs/plans/character-mmo/results/m006-gate.md. glTF mesh primitives are the renderable
 * visibility boundary: https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#meshes
 * The Human carries everything on one mesh -- including the scalp, because M006 measured
 * the hair as fused into the skull surface rather than a separate geoset -- which is
 * exactly why nothing hides it. The Orc is split six ways plus print extras. The Undead is
 * a body and eyes, with no hair geoset at all, so nothing can cover `head.scalp` on it.
 */
export const RACE_BODY_SEGMENTS = Object.freeze({
    human: Object.freeze({
        HumanV1Body: Object.freeze([...BODY_SEGMENTS]),
    }),
    orc: Object.freeze({
        BodyExposed: Object.freeze(['head.face', 'neck', 'arm.upper', 'arm.lower']),
        BodyUnderTunic: Object.freeze(['torso.upper', 'torso.lower']),
        BodyUnderLegs: Object.freeze(['leg.upper', 'leg.lower']),
        BodyUnderBoots: Object.freeze(['foot']),
        BodyWaist: Object.freeze(['waist']),
        BodyHands: Object.freeze(['hand']),
        OrcV1Hair: Object.freeze(['head.scalp']),
        OrcV1Brows: Object.freeze(['head.face']),
        OrcV1Eyes: Object.freeze(['head.face']),
        // The shorts run from the waist down the upper leg in the shipped mesh. Treating
        // them as waist-only would remove them when a tunic is worn without trousers.
        OrcV1Shorts: Object.freeze(['waist', 'leg.upper']),
    }),
    undead: Object.freeze({
        UndeadV1Body: Object.freeze([...BODY_SEGMENTS.filter(s => s !== 'head.scalp')]),
        UndeadV1Eyes: Object.freeze(['head.face']),
    }),
});

/**
 * Legacy Human region names to semantic segments.
 *
 * The catalogue authors coverage in these names today. Migrating the data outright would
 * change every item in one commit with no way to tell a migration bug from a coverage bug,
 * so items may declare either and this adapter normalises. `BodyExposed` deliberately maps
 * to nothing: it named the skin an item does *not* cover, and nothing ever covered it.
 */
export const LEGACY_REGION_SEGMENTS = Object.freeze({
    BodyExposed: Object.freeze([]),
    BodyUnderTunic: Object.freeze(['torso.upper', 'torso.lower']),
    BodyUnderLegs: Object.freeze(['leg.upper', 'leg.lower']),
    BodyUnderBoots: Object.freeze(['foot']),
    BodyWaist: Object.freeze(['waist']),
    BodyHands: Object.freeze(['hand']),
    HumanHair: Object.freeze(['head.scalp']),
    HumanEyes: Object.freeze([]),
});

export class CoverageError extends Error {
    constructor(code, message) {
        super(message);
        this.name = 'CoverageError';
        this.code = code;
    }
}

/** Semantic segments an item covers, accepting either vocabulary. */
export function itemSegments(item) {
    const out = new Set();
    for (const name of item?.covers || []) {
        if (!BODY_SEGMENTS.includes(name)) {
            throw new CoverageError('UNKNOWN_SEGMENT', `Unknown body segment "${name}" on ${item.id}`);
        }
        out.add(name);
    }
    for (const name of item?.coverage || []) {
        const mapped = LEGACY_REGION_SEGMENTS[name];
        if (!mapped) {
            throw new CoverageError('UNKNOWN_REGION', `Unknown legacy coverage region "${name}" on ${item.id}`);
        }
        for (const segment of mapped) out.add(segment);
    }
    return [...out].sort();
}

/**
 * Resolve a loadout against one race's body.
 *
 * Returns which segments end up covered, which body meshes may therefore be hidden, and the
 * exceptions: every declaration that cannot take effect, each with the reason it cannot.
 * An exception is data, not a warning to be swallowed -- M007 requires them recorded.
 *
 * @param {Record<string,string|null>} loadout slot -> item id
 * @param {Record<string,object>} items catalogue
 * @param {string} race
 */
export function resolveCoverage(loadout, items, race, bodySegments = RACE_BODY_SEGMENTS[race]) {
    if (!RACE_BODY_SEGMENTS[race]) throw new CoverageError('UNKNOWN_RACE', `No body segment map for race "${race}"`);
    const bodies = bodySegments;

    const covered = new Set();
    const bySegment = new Map();
    const equipped = [];
    for (const [slot, id] of Object.entries(loadout)) {
        if (id == null) continue;
        const item = items[id];
        if (!item) throw new CoverageError('UNKNOWN_ITEM', `Unknown item "${id}"`);
        if (item.slot !== slot) throw new CoverageError('WRONG_SLOT', `${id} occupies ${item.slot}, not ${slot}`);
        equipped.push({slot, item});
        for (const segment of itemSegments(item)) {
            covered.add(segment);
            if (!bySegment.has(segment)) bySegment.set(segment, []);
            bySegment.get(segment).push(id);
        }
    }

    const hiddenMeshes = [];
    const exceptions = [];
    for (const [mesh, segments] of Object.entries(bodies)) {
        const uncovered = segments.filter(s => !covered.has(s));
        if (!uncovered.length) { hiddenMeshes.push(mesh); continue; }
        const wanted = segments.filter(s => covered.has(s));
        if (!wanted.length) continue;   // nothing asked for this mesh at all
        // Something covered part of this mesh and it still cannot be hidden. On a body that
        // is one mesh this is every garment, every time, and it is the reason the M005
        // refit had to keep the body inside the cloth rather than hide it.
        exceptions.push({
            code: 'MESH_CARRIES_UNCOVERED_SEGMENTS',
            race,
            mesh,
            coveredSegments: wanted,
            uncoveredSegments: uncovered,
            requestedBy: [...new Set(wanted.flatMap(s => bySegment.get(s) || []))].sort(),
            reason: `${mesh} also carries ${uncovered.join(', ')}, so hiding it would remove body that nothing covers`,
        });
    }

    // A segment no mesh on this race carries can never be hidden, however it is declared.
    const carried = new Set(Object.values(bodies).flat());
    for (const segment of covered) {
        if (carried.has(segment)) continue;
        exceptions.push({
            code: 'SEGMENT_ABSENT_ON_RACE',
            race,
            segment,
            requestedBy: [...(bySegment.get(segment) || [])].sort(),
            reason: `no ${race} body mesh carries ${segment}`,
        });
    }

    return {
        race,
        coveredSegments: [...covered].sort(),
        hiddenMeshes: hiddenMeshes.sort(),
        exceptions,
        equippedSlots: equipped.map(e => e.slot).sort(),
    };
}

/** Seams shared by two equipped slots: where those two garments meet on the body. */
export function sharedSeams(slotA, slotB) {
    const a = SLOT_SEAMS[slotA] || [];
    const b = SLOT_SEAMS[slotB] || [];
    return a.filter(seam => b.includes(seam));
}

/** Every seam presented by a loadout, with the slot pair that meets there. */
export function loadoutSeams(loadout) {
    const slots = Object.entries(loadout).filter(([, id]) => id != null).map(([slot]) => slot);
    const out = [];
    for (let i = 0; i < slots.length; i++) {
        for (let j = i + 1; j < slots.length; j++) {
            for (const seam of sharedSeams(slots[i], slots[j])) {
                out.push({seam, slots: [slots[i], slots[j]].sort()});
            }
        }
    }
    return out.sort((x, y) => (x.seam + x.slots.join()).localeCompare(y.seam + y.slots.join()));
}
