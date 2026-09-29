/** M006 creator: capability gating, validation, persistence, undo and reset.
 * The point of most of these is that an unverified capability cannot be reached, by any
 * route, including a hand-written saved record. */
import assert from 'node:assert/strict';
import test from 'node:test';
import {
    CREATOR_CONTROLS, CREATOR_SCHEMA_VERSION, CreatorError,
    creatorControlsForRace, creatorStateToQuery, creatorStateToShape,
    defaultCreatorState, validateCreatorState,
} from '../src/character/creator/contract.js';
import {
    CREATOR_STORAGE_KEY, clearCreatorState, createCreatorSession,
    loadCreatorState, saveCreatorState,
} from '../src/character/creator/store.js';
import {HUMAN_HEIGHT, HUMAN_SHAPE_TARGETS} from '../src/character/runtime/human-shape.js';

/** Minimal Storage stand-in; `fail` makes every operation throw, like a private window. */
function memoryStorage({fail = false} = {}) {
    const map = new Map();
    const guard = () => { if (fail) throw new Error('blocked'); };
    return {
        getItem: k => { guard(); return map.has(k) ? map.get(k) : null; },
        setItem: (k, v) => { guard(); map.set(k, String(v)); },
        removeItem: k => { guard(); map.delete(k); },
        get size() { return map.size; },
    };
}
const opts = storage => ({storage, key: CREATOR_STORAGE_KEY});

test('only the two M004-verified controls are offered on the Human', () => {
    const {available, unavailable} = creatorControlsForRace('human');
    assert.deepEqual(available.map(c => c.id), ['height', 'build']);
    assert.deepEqual(unavailable.map(c => c.id), ['age', 'skinColor', 'hair', 'hairColor']);
    for (const entry of unavailable) assert.match(entry.reason, /\S/, `${entry.id} needs a reason`);
});

test('every declared control is either offered or explained, never dropped', () => {
    for (const race of ['human', 'orc', 'undead']) {
        const {available, unavailable} = creatorControlsForRace(race);
        assert.equal(available.length + unavailable.length, CREATOR_CONTROLS.length, race);
    }
});

test('races without a verified body family offer nothing', () => {
    for (const race of ['orc', 'undead']) {
        const {available, unavailable} = creatorControlsForRace(race);
        assert.deepEqual(available, [], `${race} must offer no body control`);
        assert.equal(unavailable.length, CREATOR_CONTROLS.length);
        assert.deepEqual(defaultCreatorState(race).controls, {});
    }
});

test('an unknown race is an error, not an empty creator', () => {
    assert.throws(() => creatorControlsForRace('dwarf'), e => e instanceof CreatorError && e.code === 'UNKNOWN_RACE');
});

test('the default state is the shipped character', () => {
    const shape = creatorStateToShape(defaultCreatorState('human'));
    assert.deepEqual(shape.weights, HUMAN_SHAPE_TARGETS.map(() => 0));
    assert.equal(shape.heightScale, HUMAN_HEIGHT.default);
    assert.equal(shape.shapesDriven, false);
    assert.equal(creatorStateToQuery(defaultCreatorState('human')), '');
});

test('a saved record cannot smuggle in an unverified control', () => {
    const forged = {schemaVersion: CREATOR_SCHEMA_VERSION, race: 'human',
        controls: {height: 1, build: {slender: 0, stout: 0}, hair: 'long'}};
    assert.throws(() => validateCreatorState(forged, 'human'),
        e => e instanceof CreatorError && e.code === 'UNAVAILABLE_CONTROL');
});

test('a forged record is discarded on load rather than honoured', () => {
    const storage = memoryStorage();
    storage.setItem(CREATOR_STORAGE_KEY, JSON.stringify({schemaVersion: CREATOR_SCHEMA_VERSION,
        race: 'human', controls: {height: 1, build: {slender: 0, stout: 0}, hair: 'long'}}));
    const {state, restored, discarded} = loadCreatorState('human', opts(storage));
    assert.equal(restored, false);
    assert.equal(discarded, 'UNAVAILABLE_CONTROL');
    assert.deepEqual(state, defaultCreatorState('human'));
});

test('prototype pollution in a stored record is rejected', () => {
    const storage = memoryStorage();
    storage.setItem(CREATOR_STORAGE_KEY,
        '{"schemaVersion":1,"race":"human","controls":{"__proto__":{"polluted":true}}}');
    const {restored, discarded} = loadCreatorState('human', opts(storage));
    assert.equal(restored, false);
    assert.equal(discarded, 'FORBIDDEN_FIELD');
    assert.equal({}.polluted, undefined);
});

test('out-of-range values clamp; wrong-shaped values are errors', () => {
    const over = validateCreatorState({schemaVersion: 1, race: 'human',
        controls: {height: 99, build: {slender: 5, stout: -3}}}, 'human');
    assert.equal(over.controls.height, HUMAN_HEIGHT.max);
    assert.deepEqual(over.controls.build, {slender: 1, stout: 0});
    assert.throws(() => validateCreatorState({schemaVersion: 1, race: 'human',
        controls: {height: 'tall'}}, 'human'), e => e.code === 'INVALID_TYPE');
    assert.throws(() => validateCreatorState({schemaVersion: 1, race: 'human',
        controls: {build: {wide: 1}}}, 'human'), e => e.code === 'UNKNOWN_FIELD');
});

test('height never leaves the range the capsule accepts', () => {
    for (const raw of [-5, 0, 0.5, 0.89, 1.16, 4, 1e9]) {
        const {heightScale} = creatorStateToShape(validateCreatorState(
            {schemaVersion: 1, race: 'human', controls: {height: raw}}, 'human'));
        assert.ok(heightScale >= HUMAN_HEIGHT.min && heightScale <= HUMAN_HEIGHT.max, `${raw} -> ${heightScale}`);
    }
});

test('a record from another schema version is discarded, not reinterpreted', () => {
    const storage = memoryStorage();
    storage.setItem(CREATOR_STORAGE_KEY, JSON.stringify({schemaVersion: 99, race: 'human',
        controls: {height: 1.1}}));
    const {restored, discarded, state} = loadCreatorState('human', opts(storage));
    assert.equal(restored, false);
    assert.equal(discarded, 'unmigratable-v99');
    assert.deepEqual(state, defaultCreatorState('human'));
});

test('a record saved for another race does not load into this one', () => {
    const storage = memoryStorage();
    saveCreatorState(defaultCreatorState('orc'), opts(storage));
    const {restored, discarded} = loadCreatorState('human', opts(storage));
    assert.equal(restored, false);
    assert.equal(discarded, 'other-race');
});

test('malformed JSON and non-records fall back to the default', () => {
    for (const [text, code] of [['{not json', 'malformed-json'], ['[1,2,3]', 'not-a-record'], ['"hi"', 'not-a-record']]) {
        const storage = memoryStorage();
        storage.setItem(CREATOR_STORAGE_KEY, text);
        const {restored, discarded, state} = loadCreatorState('human', opts(storage));
        assert.equal(restored, false);
        assert.equal(discarded, code, text);
        assert.deepEqual(state, defaultCreatorState('human'));
    }
});

test('blocked storage never prevents a cold start', () => {
    const storage = memoryStorage({fail: true});
    const {state, restored, discarded} = loadCreatorState('human', opts(storage));
    assert.deepEqual(state, defaultCreatorState('human'));
    assert.equal(restored, false);
    assert.equal(discarded, 'storage-unreadable');
    assert.equal(saveCreatorState(defaultCreatorState('human'), opts(storage)), false);
    assert.equal(clearCreatorState(opts(storage)), false);
});

test('a session round-trips through storage', () => {
    const storage = memoryStorage();
    const a = createCreatorSession('human', opts(storage));
    a.set('height', 1.12);
    a.set('build', {stout: 0.6});
    assert.equal(a.save(), true);
    const b = createCreatorSession('human', opts(storage));
    assert.equal(b.restored, true);
    assert.equal(b.state.controls.height, 1.12);
    assert.deepEqual(b.state.controls.build, {slender: 0, stout: 0.6});
});

test('undo steps back only over real changes, and reset returns the shipped character', () => {
    const storage = memoryStorage();
    const s = createCreatorSession('human', opts(storage));
    assert.equal(s.canUndo, false);
    s.set('height', 1.1);
    s.set('height', 1.1);          // no change: must not record a step
    s.set('height', 1.1);
    assert.equal(s.state.controls.height, 1.1);
    s.undo();
    assert.equal(s.state.controls.height, HUMAN_HEIGHT.default);
    assert.equal(s.canUndo, false);
    s.set('build', {slender: 0.4});
    s.reset();
    assert.deepEqual(s.state, defaultCreatorState('human'));
    s.undo();
    assert.deepEqual(s.state.controls.build, {slender: 0.4, stout: 0});
});

test('undo history is bounded', () => {
    const s = createCreatorSession('human', opts(memoryStorage()));
    for (let i = 1; i <= 200; i++) s.set('height', 0.9 + (i % 25) * 0.01);
    let steps = 0;
    while (s.canUndo) { s.undo(); if (++steps > 100) break; }
    assert.ok(steps <= 32, `undo history should be bounded, took ${steps}`);
});

test('two distinct characters produce two distinct runtime shapes and queries', () => {
    const a = createCreatorSession('human', opts(memoryStorage()));
    a.set('height', 0.93); a.set('build', {slender: 0.8});
    const b = createCreatorSession('human', opts(memoryStorage()));
    b.set('height', 1.14); b.set('build', {stout: 0.9});
    const sa = creatorStateToShape(a.state), sb = creatorStateToShape(b.state);
    assert.notDeepEqual(sa.weights, sb.weights);
    assert.notEqual(sa.heightScale, sb.heightScale);
    assert.ok(sa.shapesDriven && sb.shapesDriven);
    // Both must ask for refitted garments, or M005's fit does not follow the body.
    for (const q of [creatorStateToQuery(a.state), creatorStateToQuery(b.state)]) {
        assert.match(q, /garmentFit=refit/);
        assert.match(q, /humanShape=/);
        assert.match(q, /humanHeight=/);
    }
});

test('a state that drives no target asks for no candidate asset', () => {
    const s = createCreatorSession('human', opts(memoryStorage()));
    s.set('height', 1.05);
    assert.equal(creatorStateToShape(s.state).shapesDriven, false);
    assert.equal(creatorStateToQuery(s.state), 'humanHeight=1.05');
});
