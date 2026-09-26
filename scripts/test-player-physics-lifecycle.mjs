import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import HavokPhysics from '@babylonjs/havok';
import {
    PhysicsMotionType, PhysicsShapeType, createHavokWorld,
    createPhysicsAggregate, createPhysicsBody, createPhysicsCharacterController, createPhysicsShape,
    createTransformNode, onPhysicsAfterStep, setPhysicsBodyShape,
} from '@babylonjs/lite';
import { createPhysicsOwnership } from '../src/player.js';

const wasmUrl = new URL('../node_modules/@babylonjs/havok/lib/esm/HavokPhysics.wasm', import.meta.url);

test('real Havok controller, caller bodies, camera query and world release once in order', async () => {
    const hknp = await HavokPhysics({ wasmBinary: await readFile(wasmUrl) });
    const releases = [];
    for (const name of ['HP_Body_Release', 'HP_Shape_Release', 'HP_QueryCollector_Release', 'HP_World_Release']) {
        const original = hknp[name];
        hknp[name] = (...args) => { releases.push(name); return original(...args); };
    }
    const scene = { _beforeRender: [] };
    const world = createHavokWorld(scene, hknp, { x: 0, y: -9.8, z: 0 });
    let sweep = null;
    const rig = { setCollisionSweep(callback) { sweep = callback; releases.push(callback ? 'sweep-on' : 'sweep-off'); } };
    const owner = createPhysicsOwnership(rig);
    owner.setWorld(world);
    const node = createTransformNode('owned-box', 0, 0, 0);
    const aggregate = createPhysicsAggregate(world, node, PhysicsShapeType.BOX, {
        mass: 0, friction: 0.8, restitution: 0, extents: { x: 2, y: 2, z: 2 },
    });
    owner.shape(aggregate.shape);
    owner.body(aggregate.body);
    const controller = createPhysicsCharacterController(world, { x: 0, y: 2, z: 0 }, {
        capsuleHeight: 1.6, capsuleRadius: 0.3,
    });
    owner.setController(controller);
    controller.setShapeOptions({ capsuleHeight: 1.4, capsuleRadius: 0.3 });
    const camera = owner.setCameraShape(createPhysicsShape(world, {
        type: PhysicsShapeType.SPHERE, parameters: { radius: 0.2 },
    }));
    rig.setCollisionSweep(() => camera);
    let stepped = 0;
    onPhysicsAfterStep(world, () => { stepped++; });
    assert.equal(scene._beforeRender.length, 1);
    scene._beforeRender[0](16);
    assert.equal(stepped, 1);
    owner.dispose();
    owner.dispose();
    assert.equal(sweep, null);
    assert.equal(scene._beforeRender.length, 0);
    assert.equal(world._afterStep, undefined);
    assert.equal(releases.filter((name) => name === 'HP_World_Release').length, 1);
    assert.equal(releases.filter((name) => name === 'HP_Body_Release').length, 2);
    assert.equal(releases.filter((name) => name === 'HP_Shape_Release').length, 4);
    assert.equal(releases.filter((name) => name === 'HP_QueryCollector_Release').length, 2);
    const worldRelease = releases.indexOf('HP_World_Release');
    assert(worldRelease > releases.indexOf('sweep-off'));
    assert(releases.slice(worldRelease + 1).every((name) => name !== 'HP_Shape_Release'));
});

test('zero-collider world stops stepping and releases without a controller', async () => {
    const hknp = await HavokPhysics({ wasmBinary: await readFile(wasmUrl) });
    const scene = { _beforeRender: [] };
    const world = createHavokWorld(scene, hknp);
    const owner = createPhysicsOwnership({ setCollisionSweep() {} });
    owner.setWorld(world);
    let steps = 0;
    onPhysicsAfterStep(world, () => { steps++; });
    scene._beforeRender[0](16);
    assert.equal(steps, 1);
    owner.dispose();
    assert.equal(scene._beforeRender.length, 0);
    assert.equal(world._afterStep, undefined);
    owner.dispose();
});

test('partial animated registration releases shape and body before the world', async () => {
    const hknp = await HavokPhysics({ wasmBinary: await readFile(wasmUrl) });
    const releases = [];
    for (const name of ['HP_Body_Release', 'HP_Shape_Release', 'HP_World_Release']) {
        const original = hknp[name];
        hknp[name] = (...args) => { releases.push(name); return original(...args); };
    }
    const scene = { _beforeRender: [] };
    const world = createHavokWorld(scene, hknp);
    const owner = createPhysicsOwnership({ setCollisionSweep() {} });
    owner.setWorld(world);
    const node = createTransformNode('partial-enemy', 0, 1, 0);
    const shape = owner.shape(createPhysicsShape(world, {
        type: PhysicsShapeType.CAPSULE,
        parameters: { pointA: { x: 0, y: 0.5, z: 0 }, pointB: { x: 0, y: -0.5, z: 0 }, radius: 0.25 },
    }));
    const body = owner.body(createPhysicsBody(world, node, PhysicsMotionType.STATIC));
    // The next setPhysicsBodyShape call can fail; both returned handles are
    // already in the application ledger at that point.
    owner.removeBody(body);
    owner.releaseShape(shape);
    owner.dispose();
    assert.deepEqual(releases, ['HP_Body_Release', 'HP_Shape_Release', 'HP_World_Release']);
    assert.equal(scene._beforeRender.length, 0);
});

test('cleanup continues after a release failure and late world creation is rejected', () => {
    const calls = [];
    const owner = createPhysicsOwnership({ setCollisionSweep: () => calls.push('sweep') }, {
        removeBody: (_, body) => { calls.push(`body:${body}`); if (body === 1) throw Error('fault'); },
        releaseShape: (_, shape) => calls.push(`shape:${shape}`),
        disposeWorld: (world) => calls.push(`world:${world}`),
    });
    owner.setWorld('first');
    owner.body(1);
    owner.body(2);
    owner.shape('static');
    owner.setCameraShape('camera');
    const originalWarn = console.warn;
    console.warn = () => {};
    try { owner.dispose(); owner.dispose(); } finally { console.warn = originalWarn; }
    assert.deepEqual(calls, ['sweep', 'shape:camera', 'body:1', 'body:2', 'shape:static', 'world:first']);
    assert.throws(() => owner.setWorld('late'), /disposed/);
    assert.equal(calls.at(-1), 'world:late');
});
