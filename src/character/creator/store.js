/**
 * M006 creator state: versioned local persistence, undo and reset.
 *
 * Pure except for the storage object handed in, which defaults to `localStorage` when one
 * exists. Every read and write is wrapped: storage throws in a private window, when site
 * data is blocked, and when a quota is hit, and a creator that cannot save must still let
 * someone play. A failed load is not an error the person has to clear — it falls back to the
 * race default, which is the shipped character, so a corrupted or foreign record can never
 * stop a cold start.
 *
 * Persistence is versioned by `CREATOR_SCHEMA_VERSION` and the stored record carries its own
 * `schemaVersion`. A record from a different version is not guessed at: `MIGRATIONS` either
 * names a function that can carry it forward, or the record is discarded. Silently reading a
 * v1 field out of a v2 record is how a saved character quietly becomes a different one.
 *
 * Storage is per-origin and per-browser. It never reaches another device, another player or
 * the server, so nothing here is authoritative for anything but this person's convenience.
 */
import {
    CREATOR_SCHEMA_VERSION,
    CreatorError,
    defaultCreatorState,
    validateCreatorState,
} from './contract.js';

export const CREATOR_STORAGE_KEY = 'ashen.creator.v1';
const MAX_UNDO = 32;

/** Version upgrades, keyed by the version being read. None exist yet; schema 1 is the first. */
const MIGRATIONS = Object.freeze({});

function defaultStorage() {
    try {
        return typeof localStorage === 'undefined' ? null : localStorage;
    } catch {
        return null; // Blocked site data throws on property access, not on use.
    }
}

/**
 * Read a saved state for one race.
 * @returns {{state: object, restored: boolean, discarded: string|null}}
 */
export function loadCreatorState(race, {storage = defaultStorage(), key = CREATOR_STORAGE_KEY} = {}) {
    const fallback = () => defaultCreatorState(race);
    let text = null;
    try {
        text = storage?.getItem(key) ?? null;
    } catch {
        return {state: fallback(), restored: false, discarded: 'storage-unreadable'};
    }
    if (text == null) return {state: fallback(), restored: false, discarded: null};
    let record;
    try {
        record = JSON.parse(text);
    } catch {
        return {state: fallback(), restored: false, discarded: 'malformed-json'};
    }
    if (record === null || typeof record !== 'object' || Array.isArray(record)) {
        return {state: fallback(), restored: false, discarded: 'not-a-record'};
    }
    let candidate = record;
    if (record.schemaVersion !== CREATOR_SCHEMA_VERSION) {
        const migrate = MIGRATIONS[record.schemaVersion];
        if (!migrate) return {state: fallback(), restored: false, discarded: `unmigratable-v${record.schemaVersion}`};
        try {
            candidate = migrate(record);
        } catch {
            return {state: fallback(), restored: false, discarded: 'migration-failed'};
        }
    }
    // A record saved for another race is not this race's character; keep it, use the default.
    if (candidate?.race !== race) return {state: fallback(), restored: false, discarded: 'other-race'};
    try {
        return {state: validateCreatorState(candidate, race), restored: true, discarded: null};
    } catch (error) {
        return {state: fallback(), restored: false, discarded: error instanceof CreatorError ? error.code : 'invalid'};
    }
}

/** Write a state. Answers whether it was actually stored. */
export function saveCreatorState(state, {storage = defaultStorage(), key = CREATOR_STORAGE_KEY} = {}) {
    const valid = validateCreatorState(state);
    try {
        storage?.setItem(key, JSON.stringify(valid));
        return storage != null;
    } catch {
        return false; // Private window or quota. The character still plays.
    }
}

export function clearCreatorState({storage = defaultStorage(), key = CREATOR_STORAGE_KEY} = {}) {
    try {
        storage?.removeItem(key);
        return storage != null;
    } catch {
        return false;
    }
}

/**
 * Editing session over one race's state: set, undo, reset, persist.
 *
 * Undo records a step only when the state actually changed, so holding a slider at its
 * current value does not fill the history with identical entries and make undo look broken.
 */
export function createCreatorSession(race, options = {}) {
    const loaded = loadCreatorState(race, options);
    let current = loaded.state;
    const undo = [];
    const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

    const commit = next => {
        const valid = validateCreatorState(next, race);
        if (same(valid, current)) return current;
        undo.push(current);
        if (undo.length > MAX_UNDO) undo.shift();
        current = valid;
        return current;
    };

    return {
        race,
        restored: loaded.restored,
        discarded: loaded.discarded,
        get state() { return current; },
        get canUndo() { return undo.length > 0; },
        /** Set one control. Blend axes may be set individually. */
        set(id, value) {
            const controls = {...current.controls};
            if (value !== null && typeof value === 'object' && !Array.isArray(value)
                && current.controls[id] && typeof current.controls[id] === 'object') {
                controls[id] = {...current.controls[id], ...value};
            } else {
                controls[id] = value;
            }
            return commit({...current, controls});
        },
        replace(next) { return commit(next); },
        undo() {
            if (!undo.length) return current;
            current = undo.pop();
            return current;
        },
        reset() { return commit(defaultCreatorState(race)); },
        save(o = options) { return saveCreatorState(current, o); },
        clear(o = options) { return clearCreatorState(o); },
    };
}
