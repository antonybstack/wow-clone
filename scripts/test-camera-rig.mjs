import test from 'node:test';
import assert from 'node:assert/strict';
import { createArcRotateCamera, getCameraPosition } from '@babylonjs/lite';
import { CameraRig } from '../src/camera-rig.js';

const setup = () => {
    const camera = createArcRotateCamera(-Math.PI / 2, Math.PI / 2, 8, { x: 0, y: 0, z: 0 });
    return { camera, rig: new CameraRig(camera) };
};
const body = { x: 0, y: 1, z: 0 };

test('collision retracts immediately below requested zoom minimum and releases smoothly', () => {
    const { camera, rig } = setup();
    let blocked = true;
    rig.setCollisionSweep(() => ({ hasHit: blocked, fraction: .1 }));
    rig.update(1 / 60, body);
    assert(Math.abs(camera.radius - .78) < 1e-8);
    assert.equal(rig.distanceTarget, 8);
    blocked = false;
    rig.update(1 / 60, body);
    assert(camera.radius > .78 && camera.radius < 2);
    for (let i = 0; i < 120; i++) rig.update(1 / 60, body);
    assert(Math.abs(camera.radius - 8) < 1e-6);
});

test('native camera limits and position determine the sweep endpoint', () => {
    const { camera, rig } = setup();
    rig.pitch = -10;
    let endpoint;
    rig.setCollisionSweep((from, to) => { endpoint = { ...to }; return { hasHit: false }; });
    rig.update(0, body);
    assert.equal(camera.beta, camera.upperBetaLimit);
    assert.deepEqual(endpoint, getCameraPosition(camera));
    assert(Math.abs(Math.hypot(endpoint.x, endpoint.y - 1.55, endpoint.z) - 8) < 1e-6);
    rig.distance = 100;
    rig.setCollisionSweep(() => ({ hasHit: true, fraction: .5 }));
    rig.update(0, body);
    assert.equal(camera.radius, 42 * .5 - .02);
});

test('zoom damping preserves response and is independent of update frequency', () => {
    const run = (hz) => {
        const { rig } = setup();
        rig.distanceTarget = 16;
        for (let i = 0; i < hz; i++) rig.update(1 / hz, body);
        return rig.distance;
    };
    assert(Math.abs(run(30) - run(144)) < 1e-10);
    assert(Math.abs(run(60) - (16 - 8 * Math.exp(-14))) < 1e-10);
});

test('zero-time placement resolves obstruction and detached sweep returns safely', () => {
    const { camera, rig } = setup();
    rig.setCollisionSweep(() => ({ hasHit: true, fraction: 0 }));
    rig.update(0, body);
    assert.equal(camera.radius, .05);
    rig.setCollisionSweep(null);
    rig.update(0, body);
    assert.equal(camera.radius, 8);
});
