/**
 * M006 character creator: the declared control surface, as pure data and pure functions.
 *
 * Nothing here imports the engine, touches the DOM, fetches an asset or reads storage, so
 * it is testable without a browser and cannot become a startup dependency.
 *
 * The rule this module exists to enforce: **a control is offered only when the capability
 * behind it has actually been verified.** M004 verified two things on the Human — a
 * two-target shape family over the shipped body, and a uniform height that the gameplay
 * capsule already accepts. Everything else the creator is eventually meant to offer (adult
 * age, skin and hair colour, bald vs long hair) is still an open M006 art gate:
 * `HUMAN_SHAPE_CAPABILITIES` reports `faceOrAge: false`, `dyes: false`, `hair: false`, and
 * those flags are read here rather than restated.
 *
 * Unverified controls are therefore **declared and marked unavailable with a reason**, not
 * quietly dropped and not offered anyway. A caller can render them disabled with an honest
 * explanation; it can never obtain a value for one. When an art gate closes, the capability
 * flag flips and the control becomes available with no change to this file.
 *
 * Race filtering works the same way. The shape family and its measured girth field are
 * Human-only; the Orc rides a print sculpt and the Undead streams its own pack, and neither
 * has a verified family. So for those races every body control reports unavailable.
 *
 * Height authority stays with the gameplay capsule: the range comes from
 * `HUMAN_HEIGHT`, which mirrors what `player.setHeightScale` clamps to, so a creator value
 * can never outrun what physics accepts.
 */
import {
    HUMAN_HEIGHT,
    HUMAN_SHAPE_CAPABILITIES,
    HUMAN_SHAPE_TARGETS,
    clampHeightScale,
    humanShapeWeights,
} from '../runtime/human-shape.js';

export const CREATOR_SCHEMA_VERSION = 1;

export class CreatorError extends Error {
    constructor(code, path, message) {
        super(`${message} at ${path}`);
        this.name = 'CreatorError';
        this.code = code;
        this.path = path;
    }
}

/** Capabilities per race. Only the Human has a verified body family. */
const NO_BODY_FAMILY = Object.freeze({
    fit: null, bodyShapes: Object.freeze(['neutral']), blendable: false,
    uniformHeight: null, faceOrAge: false, hair: false, dyes: false,
});
export const RACE_CREATOR_CAPABILITIES = Object.freeze({
    human: HUMAN_SHAPE_CAPABILITIES,
    orc: NO_BODY_FAMILY,
    undead: NO_BODY_FAMILY,
});

/**
 * Every control the creator knows about, verified or not.
 *
 * `requires(capabilities)` answers null when the control is offered, or a reason string when
 * it is not. The reason is shown to the person, so it says what is missing, not "disabled".
 */
export const CREATOR_CONTROLS = Object.freeze([
    Object.freeze({
        id: 'height', label: 'Height', kind: 'range',
        min: HUMAN_HEIGHT.min, max: HUMAN_HEIGHT.max, step: 0.01, default: HUMAN_HEIGHT.default,
        unit: 'scale',
        requires: caps => (caps.uniformHeight ? null : 'This race has no verified body family yet.'),
    }),
    Object.freeze({
        id: 'build', label: 'Build', kind: 'blend', axes: HUMAN_SHAPE_TARGETS,
        min: 0, max: 1, step: 0.01, default: Object.freeze({slender: 0, stout: 0}),
        requires: caps => (caps.blendable ? null : 'This race has no verified body family yet.'),
    }),
    Object.freeze({
        id: 'age', label: 'Adult age', kind: 'choice', options: Object.freeze(['prime', 'weathered']),
        default: 'prime',
        requires: caps => (caps.faceOrAge ? null : 'Adult age is not distinct enough on the candidate head to offer yet.'),
    }),
    Object.freeze({
        id: 'skinColor', label: 'Skin tone', kind: 'choice', options: Object.freeze(['fair', 'olive', 'brown', 'deep']),
        default: 'fair',
        requires: caps => (caps.dyes ? null : 'Skin tone has no accepted dye channel yet.'),
    }),
    Object.freeze({
        id: 'hair', label: 'Hair', kind: 'choice', options: Object.freeze(['bald', 'long']),
        default: 'bald',
        requires: caps => (caps.hair ? null : 'The long-hair candidate is fused to the scalp and has no accepted tie or colour policy.'),
    }),
    Object.freeze({
        id: 'hairColor', label: 'Hair colour', kind: 'choice', options: Object.freeze(['ash', 'auburn', 'black', 'grey']),
        default: 'grey',
        requires: caps => (caps.hair && caps.dyes ? null : 'Hair colour needs both an accepted hair mesh and a dye channel.'),
    }),
]);

const controlById = Object.fromEntries(CREATOR_CONTROLS.map(c => [c.id, c]));

export function creatorCapabilities(race) {
    const caps = RACE_CREATOR_CAPABILITIES[race];
    if (!caps) throw new CreatorError('UNKNOWN_RACE', '$.race', `No creator capabilities for race "${race}"`);
    return caps;
}

/**
 * Split the control list for one race into what may be offered and what may not.
 * @returns {{available: object[], unavailable: {id: string, label: string, reason: string}[]}}
 */
export function creatorControlsForRace(race) {
    const caps = creatorCapabilities(race);
    const available = [], unavailable = [];
    for (const control of CREATOR_CONTROLS) {
        const reason = control.requires(caps);
        if (reason) unavailable.push({id: control.id, label: control.label, reason});
        else available.push(control);
    }
    return {available, unavailable};
}

/** The state a fresh character starts from. Only available controls appear. */
export function defaultCreatorState(race) {
    const {available} = creatorControlsForRace(race);
    const controls = {};
    for (const control of available) {
        controls[control.id] = control.kind === 'blend' ? {...control.default} : control.default;
    }
    return {schemaVersion: CREATOR_SCHEMA_VERSION, race, controls};
}

function assertPlainRecord(value, path) {
    if (value === null || typeof value !== 'object' || Array.isArray(value)
        || Object.getPrototypeOf(value) !== Object.prototype) {
        throw new CreatorError('INVALID_TYPE', path, 'Expected a plain object');
    }
    for (const key of Reflect.ownKeys(value)) {
        if (typeof key !== 'string') throw new CreatorError('UNKNOWN_FIELD', path, 'Symbol fields are unsupported');
        if (['__proto__', 'constructor', 'prototype'].includes(key)) {
            throw new CreatorError('FORBIDDEN_FIELD', path, `Forbidden field "${key}"`);
        }
        const d = Object.getOwnPropertyDescriptor(value, key);
        if (!d?.enumerable || !Object.hasOwn(d, 'value')) {
            throw new CreatorError('INVALID_FIELD', `${path}.${key}`, 'Accessor or hidden field is unsupported');
        }
    }
}

// Snap to the step, then drop the float error the multiply reintroduces: at step 0.01,
// Math.round(1.15 / 0.01) * 0.01 is 1.1500000000000001, which then serialises into storage
// and comes back as a value that is not equal to the one that was set.
const quantise = (n, step) => {
    const decimals = (String(step).split('.')[1] ?? '').length;
    return Number((Math.round(n / step) * step).toFixed(decimals));
};

/**
 * Validate and normalise a creator state against one race's verified capabilities.
 *
 * Out-of-range numbers are **clamped**, not rejected: a slider that was saved when the range
 * was wider should still load. A control that is not available for this race, or a value of
 * the wrong shape, is an error — that is the case where silently accepting would mean
 * offering an unverified capability.
 */
export function validateCreatorState(state, race = state?.race) {
    assertPlainRecord(state, '$');
    for (const key of Object.keys(state)) {
        if (!['schemaVersion', 'race', 'controls'].includes(key)) {
            throw new CreatorError('UNKNOWN_FIELD', `$.${key}`, 'Unsupported field');
        }
    }
    if (state.schemaVersion !== CREATOR_SCHEMA_VERSION) {
        throw new CreatorError('WRONG_VERSION', '$.schemaVersion',
            `Expected schema ${CREATOR_SCHEMA_VERSION}, have ${state.schemaVersion}`);
    }
    if (state.race !== race) throw new CreatorError('RACE_MISMATCH', '$.race', `State is for "${state.race}", not "${race}"`);
    const {available} = creatorControlsForRace(race);
    const allowed = new Set(available.map(c => c.id));
    assertPlainRecord(state.controls, '$.controls');
    const controls = {};
    for (const key of Object.keys(state.controls)) {
        if (!allowed.has(key)) {
            throw new CreatorError('UNAVAILABLE_CONTROL', `$.controls.${key}`,
                controlById[key] ? 'Control is not available for this race' : 'Unknown control');
        }
    }
    for (const control of available) {
        const raw = state.controls[control.id];
        if (raw === undefined) {
            controls[control.id] = control.kind === 'blend' ? {...control.default} : control.default;
            continue;
        }
        if (control.kind === 'range') {
            const n = Number(raw);
            if (!Number.isFinite(n)) throw new CreatorError('INVALID_TYPE', `$.controls.${control.id}`, 'Expected a number');
            controls[control.id] = quantise(Math.min(control.max, Math.max(control.min, n)), control.step);
        } else if (control.kind === 'choice') {
            if (!control.options.includes(raw)) {
                throw new CreatorError('INVALID_VALUE', `$.controls.${control.id}`,
                    `Expected one of ${control.options.join(', ')}`);
            }
            controls[control.id] = raw;
        } else {
            assertPlainRecord(raw, `$.controls.${control.id}`);
            const blend = {};
            for (const key of Object.keys(raw)) {
                if (!control.axes.includes(key)) {
                    throw new CreatorError('UNKNOWN_FIELD', `$.controls.${control.id}.${key}`, 'Unknown blend axis');
                }
            }
            for (const axis of control.axes) {
                const n = Number(raw[axis] ?? 0);
                if (!Number.isFinite(n)) throw new CreatorError('INVALID_TYPE', `$.controls.${control.id}.${axis}`, 'Expected a number');
                blend[axis] = quantise(Math.min(control.max, Math.max(control.min, n)), control.step);
            }
            controls[control.id] = blend;
        }
    }
    return {schemaVersion: CREATOR_SCHEMA_VERSION, race, controls};
}

/**
 * Turn a validated state into what the runtime already understands: a morph weight vector in
 * the candidate GLB's target order and a height scale the capsule accepts. This is the only
 * bridge between the creator and the body, and it produces nothing the M004 route did not
 * already take, so the creator adds no new runtime capability.
 */
export function creatorStateToShape(state) {
    const valid = validateCreatorState(state);
    const build = valid.controls.build ?? {};
    const weights = valid.controls.build ? humanShapeWeights(build) : HUMAN_SHAPE_TARGETS.map(() => 0);
    const heightScale = clampHeightScale(valid.controls.height ?? HUMAN_HEIGHT.default);
    return {race: valid.race, weights, heightScale, shapesDriven: weights.some(w => w > 0)};
}

/** The query a state corresponds to on the existing developer route, for parity checks. */
export function creatorStateToQuery(state) {
    const {weights, heightScale, shapesDriven} = creatorStateToShape(state);
    const params = new URLSearchParams();
    if (shapesDriven) {
        params.set('humanShape', HUMAN_SHAPE_TARGETS.map((n, i) => `${n}:${weights[i]}`).join(','));
        params.set('garmentFit', 'refit');
    }
    if (heightScale !== HUMAN_HEIGHT.default) params.set('humanHeight', String(heightScale));
    return params.toString();
}
