import test from 'node:test';
import assert from 'node:assert/strict';
import {createFreeCamera, createTransformNode} from '@babylonjs/lite';
import {createBakedWoodland} from '../src/ashen-reach/baked-woodland.js';

test('late full/reduced records inherit distance selection and shadow visibility, then retain hysteresis', () => {
    // Public Lite transforms/camera/visibility; no GPU or alternate LOD code.
    const scene = {camera: createFreeCamera({x: 300, y: 0, z: 64}, {x: 0, y: 0, z: 0}), _disposables: []};
    const byName = new Map(), shadows = new Map();
    const api = createBakedWoodland(scene, [{key: '0,0', full: 'full', reduced: 'reduced',
        bounds: {min: [0, 0, 0], max: [128, 20, 128]}}], byName, shadows);
    assert.equal(api.tiles.get('0,0').detail, 'reduced');
    assert.deepEqual(api.meshes, []);
    assert.equal(api.state.triangles, 0);
    api.update(); // Both records still absent.
    const full = createTransformNode('full'), fullShadow = createTransformNode('full shadow');
    byName.set('full', full); shadows.set('full', fullShadow); api.meshArrived('full');
    assert.equal(full.visible, false); assert.equal(fullShadow.visible, false);
    const reduced = createTransformNode('reduced'), reducedShadow = createTransformNode('reduced shadow');
    byName.set('reduced', reduced); shadows.set('reduced', reducedShadow); api.meshArrived('reduced');
    assert.equal(reduced.visible, true); assert.equal(reducedShadow.visible, true);
    assert.deepEqual(api.meshes, [full, reduced]);
    assert.equal(api.state.transitions, 0, 'arrival must not consume distance transitions');
    scene.camera.position.set(250, 0, 64); api.update(); // 122 m retains reduced.
    assert.equal(api.tiles.get('0,0').detail, 'reduced');
    scene.camera.position.set(220, 0, 64); api.update(); // 92 m selects full.
    assert.equal(full.visible, true); assert.equal(fullShadow.visible, true);
    assert.equal(reduced.visible, false); assert.equal(reducedShadow.visible, false);
    assert.equal(api.state.transitions, 1);
    scene.camera.position.set(250, 0, 64); api.update(); // 122 m retains full.
    assert.equal(api.tiles.get('0,0').detail, 'full');
    scene.camera.position.set(300, 0, 64); api.update();
    assert.equal(api.tiles.get('0,0').detail, 'reduced');
    assert.equal(api.state.transitions, 2);
    for (const dispose of scene._disposables) dispose();
    api.update(); api.meshArrived('full'); assert.equal(api.state.disposed, true); assert.deepEqual(api.meshes, []);
});
