/** Semantic fit identity: adding animation clips does not change a garment bind. */
export const HUMAN_EQUIPMENT_FIT = Object.freeze({
    body: 'ashen-human', rig: 'source-65', bind: 1, shape: 1,
});
export const ORC_EQUIPMENT_FIT = Object.freeze({
    body: 'ashen-orc', rig: 'source-65', bind: 1, shape: 1,
});
export const UNDEAD_EQUIPMENT_FIT = Object.freeze({
    body: 'ashen-undead', rig: 'source-65', bind: 1, shape: 1,
});
export const FITS_BY_RACE = Object.freeze({
    human: HUMAN_EQUIPMENT_FIT, orc: ORC_EQUIPMENT_FIT, undead: UNDEAD_EQUIPMENT_FIT,
});
export const EQUIPMENT_RACES = Object.freeze(Object.keys(FITS_BY_RACE));
export const SEAM_NAMES = Object.freeze(['neck', 'waist', 'wrists', 'ankles']);
const FIT_KEYS = ['body', 'rig', 'bind', 'shape'];
const HANDS = ['mainHand', 'offHand'];
const own = (object, key) => Object.hasOwn(object, key);
const label = item => item?.name || item?.id || 'this item';

/**
 * Which race a pack's fit identity belongs to. Callers used to infer this with
 * `fit.body === 'ashen-orc' ? 'orc' : 'human'`, which quietly answered "human" for
 * every race that was not Orc. An unrecognised fit is an error, not a Human.
 */
export function raceForFit(fit) {
    const race = EQUIPMENT_RACES.find(name => FITS_BY_RACE[name].body === fit?.body);
    if (!race) throw Error(`Unsupported equipment fit: ${fit?.body ?? typeof fit}`);
    return race;
}

/**
 * The fit this item actually declares for this race.
 *
 * There is deliberately no `|| item.fit` fallback here. `item.fit` is the Human fit, so
 * falling back to it would dress a non-Human body in Human-bound geometry and report
 * success -- the exact silent substitution the Undead milestone exists to prevent. An
 * item with no fit for this race is an unsupported combination and must say so.
 */
export function declaredFitForRace(item, race) {
    if (!own(FITS_BY_RACE, race)) throw Error(`Unsupported equipment race: ${race}`);
    const declared = item?.fits?.[race];
    if (!declared) throw Error(`No ${race} fit for ${label(item)}`);
    return declared;
}

/**
 * Guard between a streamed manifest entry and the race being dressed. Every garment load
 * passes through here, so a pack that serves another race's geometry -- or an asset with
 * no fit block at all -- fails loudly instead of binding to the wrong body.
 */
export function assertAssetFit(asset, item, race) {
    const declared = declaredFitForRace(item, race);
    if (!asset?.fit) throw Error(`No ${race} fit declared for ${label(item)}`);
    for (const key of FIT_KEYS) {
        if (asset.fit[key] !== declared[key]) {
            throw Error(`Incompatible ${race} ${key} fit for ${label(item)}: ${asset.fit[key]} is not ${declared[key]}`);
        }
    }
    return declared;
}

export function validateEquipmentCatalogue(items, {slots, baseMeshes, fit = HUMAN_EQUIPMENT_FIT, meshNames} = {}) {
    const masks = new Set(baseMeshes);
    for (const [id, item] of Object.entries(items)) {
        if (item.id !== id || !slots.includes(item.slot)) throw Error(`Invalid item identity/slot: ${id}`);
        for (const key of ['body', 'rig', 'bind', 'shape']) {
            if (item.fit?.[key] !== fit[key]) throw Error(`Incompatible ${key} fit: ${id}`);
        }
        if (item.fits) {
            for (const [race, raceFit] of Object.entries(item.fits)) {
                const expected = FITS_BY_RACE[race];
                if (!expected) throw Error(`Unknown fit race: ${id}/${race}`);
                for (const key of ['body', 'rig', 'bind', 'shape']) {
                    if (raceFit?.[key] !== expected[key]) throw Error(`Incompatible ${key} fit: ${id}/${race}`);
                }
            }
        }
        if (Boolean(item.factory) === Boolean(item.parts?.length)) throw Error(`Item needs one attachment type: ${id}`);
        if (item.factory && !HANDS.includes(item.slot)) throw Error(`Invalid prop slot: ${id}`);
        for (const mask of item.coverage || []) {
            if (!masks.has(mask)) throw Error(`Unknown coverage mask: ${id}/${mask}`);
        }
        for (const part of item.parts || []) {
            if (!part.mesh || masks.has(part.mesh)) throw Error(`Invalid garment mesh: ${id}`);
            if (meshNames && !meshNames.has(part.mesh)) throw Error(`Missing fit mesh: ${id}/${part.mesh}`);
            for (const slot of part.hideWhenSlots || []) {
                if (!slots.includes(slot) || slot === item.slot) throw Error(`Invalid seam precedence: ${id}/${slot}`);
            }
        }
        if (!Array.isArray(item.seams) || item.seams.some(seam => !SEAM_NAMES.includes(seam))) {
            throw Error(`Invalid seam declaration: ${id}`);
        }
        const occupied = item.occupies;
        if (!Array.isArray(occupied) || !occupied.includes(item.slot) || new Set(occupied).size !== occupied.length) {
            throw Error(`Invalid occupancy: ${id}`);
        }
        for (const slot of occupied) {
            if (!slots.includes(slot) || (slot !== item.slot && !(HANDS.includes(slot) && HANDS.includes(item.slot)))) {
                throw Error(`Invalid occupied slot: ${id}/${slot}`);
            }
        }
        if (item.factory) {
            if (item.gripPose !== 'shaft') throw Error(`Unsupported grip pose: ${id}`);
            for (const [label, values, size] of [['grip position', item.gripPosition, 3], ['grip', item.gripRotation, 4], ['stow position', item.stow?.position, 3], ['stow rotation', item.stow?.rotation, 4]]) {
                if (!Array.isArray(values) || values.length !== size || !values.every(Number.isFinite)) throw Error(`Invalid ${label}: ${id}`);
                if (size === 4 && Math.abs(Math.hypot(...values) - 1) > .01) throw Error(`Unnormalized ${label}: ${id}`);
            }
        }
    }
}

/** Validate the whole candidate before touching the current actor or selection. */
export function validateEquipmentSelection(loadout, items, slots) {
    if (!loadout || typeof loadout !== 'object' || Array.isArray(loadout)) throw Error('Invalid loadout');
    const occupied = new Map();
    for (const [slot, id] of Object.entries(loadout)) {
        if (!slots.includes(slot)) throw Error('Unsupported equipment slot: ' + slot);
        if (id === null) continue;
        if (!own(items, id) || items[id].slot !== slot) throw Error('Item does not fit this slot');
        for (const claimed of items[id].occupies) {
            if (occupied.has(claimed)) throw Error(`Equipment conflict in ${claimed}: ${occupied.get(claimed)} / ${id}`);
            occupied.set(claimed, id);
        }
    }
}

/**
 * Hand exclusivity helper for interactive selection: a two-handed item occupies
 * both hands, so the most recent hand change wins instead of erroring. Direct
 * loadout validation (validateEquipmentSelection) still rejects real conflicts.
 */
export function resolveHandEquip(current, patch, items) {
    const next = { ...current, ...patch };
    const changedOff = Object.hasOwn(patch, 'offHand');
    const changedMain = Object.hasOwn(patch, 'mainHand');
    const currentMain = current.mainHand ? items[current.mainHand] : null;
    if (changedOff && !changedMain && patch.offHand && currentMain?.occupies?.includes('offHand')) {
        next.mainHand = null;
    } else if (next.mainHand && items[next.mainHand]?.occupies?.includes('offHand')) {
        next.offHand = null;
    }
    return next;
}

export function freezeEquipment(value) {
    if (value && typeof value === 'object' && !Object.isFrozen(value)) {
        for (const child of Object.values(value)) freezeEquipment(child);
        Object.freeze(value);
    }
    return value;
}
