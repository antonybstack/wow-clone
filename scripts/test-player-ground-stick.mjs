// Grounded altitude correction: pure decisions over Lite `ShapeCastResult`s, plus the native
// Havok behaviour that motivated replacing the foot ray with an owned sphere sweep.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import HavokPhysics from '@babylonjs/havok';
import {
    PhysicsShapeType, createHavokWorld, createPhysicsAggregate, createPhysicsCharacterController,
    createPhysicsShape, createTransformNode, physicsRaycast, shapeCast, releasePhysicsShape, disposePhysics,
} from '@babylonjs/lite';
import {
    createGroundStickQuery, createPhysicsOwnership, groundStickQuery, groundStickStep, shouldGroundStick,
} from '../src/player.js';

const WALKABLE = Math.cos(Math.PI * 0.27); // the controller's configured maxSlopeCosine
const dt = 1 / 60, UP = { x: 0, y: 1, z: 0 };
// A Lite ShapeCastResult: hitPoint is the contact on the hit BODY, not the sphere centre.
const cast = (y, { fraction = 0.5, normal = UP } = {}) => ({
    hasHit: true, fraction, hitPoint: { x: 0, y, z: 0 }, hitNormal: normal,
    inputHitPoint: { x: 0, y: -0.01, z: 0 }, inputHitNormal: { x: 0, y: -1, z: 0 },
});
const miss = { hasHit: false, fraction: 0, hitPoint: { x: 0, y: 0, z: 0 }, hitNormal: { x: 0, y: 0, z: 0 } };
// Sweep model over horizontal surfaces, as the native sphere sees them: the first surface its
// lowest point (centre - 0.01) meets on the way down. A closed slab exposes its top and, from
// inside, an underside Havok reports with an UPWARD normal (platform-ray-diagnostic.json).
function sweep(surfaces, query) {
    const from = query.startPosition.y - 0.01, to = query.endPosition.y - 0.01;
    const hit = surfaces.filter((y) => y <= from && y >= to).sort((a, b) => b - a)[0];
    return hit === undefined ? miss : cast(hit, { fraction: (from - hit) / (from - to) });
}
function settle(centerY, half, surfaces, steps = 600) {
    const query = createGroundStickQuery({}, {});
    let y = centerY;
    for (let i = 0; i < steps; i++) {
        const bottom = y - half;
        y -= groundStickStep(bottom, sweep(surfaces, groundStickQuery(0, 166.425, bottom, half, query)), dt, WALKABLE);
    }
    return y - half;
}

test('bridge near z 166: the deck under the feet is used, never the terrain below it', () => {
    // Native route and the reproduced stall coordinate (centre 13.56, capsule 1.748).
    const half = 1.748 / 2;
    const deck = 7.730587552994239 + (44.92268781190694 - 7.730587552994239) * ((166.425 - 145) / 125);
    const bottom = settle(deck + half + 0.016, half, [deck, deck - 1.1 /* deck underside */, 12.65]);
    assert(bottom >= deck + 0.008 - 1e-9 && bottom < deck + 0.0081, `settles on the deck (${bottom})`);
    assert.equal(groundStickStep(13.56 - half, cast(deck), dt, WALKABLE), 0, 'never moves an actor below the deck upward');
});

test('elevated slab, gallery floor and flat terrain settle at tolerance above the surface, not below', () => {
    for (const floor of [0.4, 31.25]) {
        const bottom = settle(floor + 0.06 + 0.87, 0.87, [floor, floor - 0.28, 0]);
        assert(Math.abs(bottom - (floor + 0.008)) < 1e-6, `floor ${floor}: ${bottom}`);
    }
    assert(Math.abs(settle(0.145 + 0.87, 0.87, [0], 60) - 0.008) < 1e-6, 'sheds the 145 mm ratchet');
});

test('a foot inside a closed 0.25/0.28 m slab sees the top, not the upward-normal underside', () => {
    // 0.273 m is the reproduced west-bell embedding; 0.10 m defeated a fixed 5 cm start.
    for (const thickness of [0.25, 0.28]) for (const inside of [0.001, 0.02, 0.10, Math.min(0.273, thickness - 0.005)]) {
        const top = 55.33935, bottom = top - inside;
        const query = groundStickQuery(-15.4, 309.2, bottom, 1.748 / 2, createGroundStickQuery({}, {}));
        const hit = sweep([top, top - thickness], query);
        assert.equal(hit.hitPoint.y, top, 'the sweep starts above the foot and meets the top first');
        assert.equal(groundStickStep(bottom, hit, dt, WALKABLE), 0, `${thickness}/${inside}: no lowering`);
        // The replaced foot ray started inside the slab; its first hit was the underside.
        if (thickness - inside > 0.008 + 1e-9) // the underside is still more than tolerance below the foot
            assert(groundStickStep(bottom, cast(top - thickness), dt, WALKABLE) > 0, 'that hit would have sunk it');
    }
});

test('initial overlap (fraction 0) never lowers, whatever point or normal accompanies it', () => {
    for (const normal of [UP, { x: 0, y: -1, z: 0 }, { x: 0, y: NaN, z: 0 }])
        assert.equal(groundStickStep(5, cast(4.8, { fraction: 0, normal }), dt, WALKABLE), 0);
    for (const fraction of [-0.1, NaN, Infinity]) assert.equal(groundStickStep(5, cast(4.8, { fraction }), dt, WALKABLE), 0);
});

test('no hit, invalid, non-walkable, above-foot or out-of-probe results never move the capsule', () => {
    const bottom = 5;
    for (const result of [miss, null, cast(NaN), cast(4.9, { normal: { x: 0, y: NaN, z: 0 } }),
        cast(4.9, { normal: { x: 0.87, y: 0.5, z: 0 } }), cast(4.9, { normal: { x: 0, y: -1, z: 0 } }),
        cast(5.02), cast(5), cast(4.6)]) assert.equal(groundStickStep(bottom, result, dt, WALKABLE), 0);
    const slope = { x: Math.sin(Math.PI / 9), y: Math.cos(Math.PI / 9), z: 0 }; // 20 degrees
    assert(groundStickStep(bottom, cast(4.9, { normal: slope }), dt, WALKABLE) > 0, 'walkable slope drift still sheds');
});

test('each step is bounded by speed x dt, never overshoots tolerance and needs a real dt', () => {
    assert.equal(groundStickStep(1.006, cast(1), dt, WALKABLE), 0, 'within tolerance');
    const far = groundStickStep(1.25, cast(1), 0.5, WALKABLE);
    assert(far > 0 && far <= 1.25 - 1 - 0.008 + 1e-12, 'large dt cannot overshoot the tolerance');
    const near = groundStickStep(1.2, cast(1), dt, WALKABLE);
    assert(near > 0 && Math.abs(groundStickStep(1.2, cast(1), 2 * dt, WALKABLE) - 2 * near) < 1e-12, 'a rate');
    for (const bad of [0, -dt, NaN, Infinity]) assert.equal(groundStickStep(1.2, cast(1), bad, WALKABLE), 0);
});

test('one reusable query: owned sphere, own body ignored, no triggers, midpoint start, fixed end', () => {
    const shape = {}, body = {}, query = createGroundStickQuery(shape, body);
    assert.equal(query.shape, shape); assert.equal(query.ignoreBody, body);
    assert.equal(query.shouldHitTriggers, false); assert.deepEqual(query.rotation, { x: 0, y: 0, z: 0, w: 1 });
    const { startPosition: start, endPosition: end } = query;
    // Default capsule and the tallest supported height: the start follows the current midpoint.
    for (const half of [1.748 / 2, 1.748 * 1.15 / 2]) {
        assert.equal(groundStickQuery(3, -4, 2.5, half, query), query);
        assert.equal(query.startPosition, start); assert.equal(query.endPosition, end);
        assert.deepEqual([start.x, start.z, end.x, end.z], [3, -4, 3, -4]);
        assert(Math.abs(start.y - (2.5 + half)) < 1e-12, `starts at the midpoint (${half})`);
        assert(Math.abs(end.y - 0.01 - (2.5 - 0.28)) < 1e-12, 'sphere bottom stops 0.28 m below the foot');
    }
});

test('only a grounded capsule outside an active jump is corrected', () => {
    assert.equal(shouldGroundStick({ grounded: true, jumpInFlight: false }), true);
    assert.equal(shouldGroundStick({ grounded: true, jumpInFlight: true }), false);
    assert.equal(shouldGroundStick({ grounded: false, jumpInFlight: false }), false);
    assert.equal(shouldGroundStick(null), false);
});

test('the probe sphere is released exactly once with the other owned shapes', () => {
    const released = [];
    const own = createPhysicsOwnership({ setCollisionSweep() {} }, {
        removeBody() {}, releaseShape: (world, shape) => released.push(shape), disposeWorld() {},
    });
    own.setWorld({});
    const probe = own.shape({ id: 'probe' });
    own.dispose(); own.dispose();
    assert.deepEqual(released, [probe]);
});

test('native Havok: foot ray hits a closed slab underside; the owned sphere sweep sees the top', async () => {
    const wasm = new URL('../node_modules/@babylonjs/havok/lib/esm/HavokPhysics.wasm', import.meta.url);
    const hknp = await HavokPhysics({ wasmBinary: await readFile(wasm) });
    const scene = { _beforeRender: [] }, world = createHavokWorld(scene, hknp, { x: 0, y: -9.8, z: 0 });
    const top = 1, under = top - 0.28;
    const corners = [[-1, under, -1], [1, under, -1], [1, under, 1], [-1, under, 1], [-1, top, -1], [1, top, -1], [1, top, 1], [-1, top, 1]];
    const mesh = { _gpu: null, _cpuPositions: new Float32Array(corners.flat()),
        _cpuIndices: new Uint32Array([0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 1, 2, 6, 1, 6, 5, 2, 3, 7, 2, 7, 6, 3, 0, 4, 3, 4, 7]),
        worldMatrix: new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]), scaling: { x: 1, y: 1, z: 1 }, children: [] };
    createPhysicsAggregate(world, createTransformNode('slab', 0, 0, 0), PhysicsShapeType.MESH,
        { mass: 0, friction: 0.9, restitution: 0, shape: createPhysicsShape(world, { type: PhysicsShapeType.MESH, mesh }) });
    // The player's controller stands IN the slab column; its body is the one the sweep ignores.
    const half = 1.748 / 2;
    const controller = createPhysicsCharacterController(world, { x: 0, y: top + half, z: 0 }, { capsuleHeight: 2 * half, capsuleRadius: 0.28 });
    const sphere = createPhysicsShape(world, { type: PhysicsShapeType.SPHERE, parameters: { radius: 0.01 } });
    const query = createGroundStickQuery(sphere, controller.getBody());
    const place = (bottom) => { controller.setPosition({ x: 0, y: bottom + half, z: 0 }); scene._beforeRender[0](16); };

    try {
    place(top - 0.001); // the broadphase and the animated body exist after a step
    const ray = physicsRaycast(world, { x: 0, y: top - 0.002, z: 0 }, { x: 0, y: top - 0.282, z: 0 });
    assert(ray.hasHit && Math.abs(ray.hitPoint.y - under) < 2e-3 && ray.hitNormal.y > 0.99, 'the defect: underside, normal up');
    // Foot just inside, 0.10 m (beat a fixed 5 cm start) and 0.273 m (reproduced west-bell depth).
    for (const depth of [0.001, 0.10, 0.273]) {
        const bottom = top - depth;
        place(bottom);
        const hit = shapeCast(world, groundStickQuery(0, 0, bottom, half, query));
        assert(hit.hasHit && Math.abs(hit.hitPoint.y - top) < 2e-3, `${depth}: the midpoint sweep meets the top (${hit.hitPoint.y})`);
        assert.equal(groundStickStep(bottom, hit, dt, WALKABLE), 0, `${depth}: no lowering`);
    }
    place(top + 0.05); // a real 50 mm gap still sheds, and only to tolerance above the top
    const above = shapeCast(world, groundStickQuery(0, 0, top + 0.05, half, query));
    const step = groundStickStep(top + 0.05, above, dt, WALKABLE);
    assert(above.fraction > 0 && Math.abs(above.hitPoint.y - top) < 2e-3 && step > 0 && top + 0.05 - step >= top + 0.008 - 2e-3);
    const overlap = shapeCast(world, { ...query, startPosition: { x: 0, y: top + 0.005, z: 0 }, endPosition: { x: 0, y: top - 0.2, z: 0 } });
    assert.equal(overlap.fraction, 0, 'native initial overlap reports fraction 0');
    assert.equal(groundStickStep(top + 0.01, overlap, dt, WALKABLE), 0);
    // Without ignoreBody the sweep starting at the midpoint would be reported against the player.
    const span = { startPosition: { x: 0, y: top + 2.2, z: 0 }, endPosition: { x: 0, y: top + 1.5, z: 0 } };
    assert(shapeCast(world, { ...query, ...span, ignoreBody: undefined }).hasHit, 'the capsule is in the way');
    assert.equal(shapeCast(world, { ...query, ...span }).hasHit, false, 'ignoreBody excludes it');
    } finally { controller.dispose(); releasePhysicsShape(world, sphere); disposePhysics(world); }
});
