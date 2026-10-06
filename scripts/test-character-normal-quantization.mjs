import {verifyCompactNormalPolicy,compactNormalPolicy} from './character-assets/compact-normal-policy.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {Document} from '@gltf-transform/core';
import {quantizeCharacterNormals, characterNormalProof, assertCharacterNormalProof} from './character-assets/quantize-character-normals.mjs';

function fixture() {
    const document = new Document(), buffer = document.createBuffer();
    const accessor = (type, data) => document.createAccessor().setType(type).setArray(data).setBuffer(buffer);
    const count = 9;
    const position = accessor('VEC3', new Float32Array(Array.from({length: count}, (_, i) => [i % 3, Math.floor(i / 3), 0]).flat()));
    const normals = accessor('VEC3', new Float32Array(Array.from({length: count}, () => [0.123456, 0.54321, 0.83046]).flat()));
    const weights = accessor('VEC4', new Float32Array(Array.from({length: count}, () => [0.25, 0.75, 0, 0]).flat()));
    const joints = accessor('VEC4', new Uint16Array(Array.from({length: count}, () => [0, 1, 0, 0]).flat()));
    const uv = accessor('VEC2', new Float32Array(Array.from({length: count}, (_, i) => [i / count, 0.7]).flat()));
    const target = document.createPrimitiveTarget('slender')
        .setAttribute('POSITION', accessor('VEC3', new Float32Array(Array.from({length: count}, () => [0.125, 0, 0]).flat())))
        .setAttribute('NORMAL', accessor('VEC3', new Float32Array(Array.from({length: count}, () => [0.003456, 0.004321, 0]).flat())));
    const primitive = document.createPrimitive().setAttribute('POSITION', position).setAttribute('NORMAL', normals)
        .setAttribute('TEXCOORD_0', uv).setAttribute('JOINTS_0', joints).setAttribute('WEIGHTS_0', weights)
        .setIndices(accessor('SCALAR', new Uint16Array([0, 1, 2]))).addTarget(target);
    const mesh = document.createMesh('BodyCoverage').addPrimitive(primitive).setWeights([0.3]);
    const hip = document.createNode('Hip'), child = document.createNode('Child');
    hip.addChild(child);
    const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
    const skin = document.createSkin('Rig').addJoint(hip).addJoint(child)
        .setInverseBindMatrices(accessor('MAT4', new Float32Array([...identity, ...identity])));
    const actor = document.createNode('Actor').setMesh(mesh).setSkin(skin);
    document.createScene().addChild(actor).addChild(hip);
    const sampler = document.createAnimationSampler().setInterpolation('LINEAR')
        .setInput(accessor('SCALAR', new Float32Array([0, 1])))
        .setOutput(accessor('VEC4', new Float32Array([0, 0, 0, 1, 0, 0.6, 0, 0.8])));
    document.createAnimation('Idle').addSampler(sampler)
        .addChannel(document.createAnimationChannel().setSampler(sampler).setTargetNode(child).setTargetPath('rotation'));
    return {document, primitive, skin, sampler};
}

test('native quantization compacts unused coverage vertices while preserving the rendered surface and motion', async () => {
    const {document, primitive} = fixture();
    const {before, measured} = await quantizeCharacterNormals(document);
    assert.equal(primitive.getAttribute('POSITION').getCount(), 3, 'exercise the real native compaction path');
    assert.equal(primitive.getAttribute('NORMAL').getComponentType(), 5122);
    assert.equal(primitive.getAttribute('NORMAL').getNormalized(), true);
    assert(measured.maxComponentError > 0 && measured.maxComponentError <= 0.00002);
    assert.equal(measured.renderedCorners, 3);
    const after = characterNormalProof(document.getRoot());
    assertCharacterNormalProof(before, after);
    // Lossless meshopt is permitted to cyclically rotate a triangle's corners.
    primitive.getIndices().setArray(new Uint16Array([1, 2, 0]));
    assertCharacterNormalProof(before, characterNormalProof(document.getRoot()));
    primitive.getIndices().setArray(new Uint16Array([0, 2, 1]));
    assert.throws(() => assertCharacterNormalProof(before, characterNormalProof(document.getRoot())), /surface changed/);
});

test('position, morph, UV and skin-weight changes cannot pass the normal-only proof', async () => {
    for (const semantic of ['POSITION', 'TEXCOORD_0', 'WEIGHTS_0', 'morph']) {
        const {document, primitive} = fixture(), {before} = await quantizeCharacterNormals(document);
        const attribute = semantic === 'morph' ? primitive.listTargets()[0].getAttribute('POSITION') : primitive.getAttribute(semantic);
        const value = attribute.getElement(0, []); value[0] += 0.001; attribute.setElement(0, value);
        assert.throws(() => assertCharacterNormalProof(before, characterNormalProof(document.getRoot())), /surface changed/, semantic);
    }
});

test('source curves and inverse binds are checked independently of visible geometry', async () => {
    for (const kind of ['curve', 'bind']) {
        const {document, sampler, skin} = fixture(), {before} = await quantizeCharacterNormals(document);
        const attribute = kind === 'curve' ? sampler.getOutput() : skin.getInverseBindMatrices();
        const value = attribute.getElement(0, []); value[0] += 0.001; attribute.setElement(0, value);
        assert.throws(() => assertCharacterNormalProof(before, characterNormalProof(document.getRoot())), /animation|rig/);
    }
});

test('unrepresentable morph normals fail before the native transform can clamp them', async () => {
    const {document, primitive} = fixture();
    const attribute = primitive.listTargets()[0].getAttribute('NORMAL');
    attribute.setElement(0, [1.2, 0, 0]);
    await assert.rejects(quantizeCharacterNormals(document), /outside quantized range/);
    assert.equal(attribute.getComponentType(), 5126);
    assert.equal(primitive.getAttribute('POSITION').getCount(), 9);
});

test('native exponential rounding handles morph deltas beyond unit range without compaction or clipping', async () => {
    const {document, primitive} = fixture();
    primitive.listTargets()[0].getAttribute('NORMAL').setElement(0, [1.234567, -1.765432, 0.012345]);
    const {before, measured, maxError} = await quantizeCharacterNormals(document, {method: 'exp16'});
    assert.equal(primitive.getAttribute('POSITION').getCount(), 9);
    assert.equal(primitive.getAttribute('NORMAL').getComponentType(), 5126);
    assert(primitive.listTargets()[0].getAttribute('NORMAL').getElement(0, [])[0] > 1);
    assert(measured.maxComponentError > 0 && measured.maxComponentError <= 0.0001);
    assertCharacterNormalProof(before, characterNormalProof(document.getRoot()), maxError);
    assert(!document.getRoot().listExtensionsUsed().some(e => e.extensionName === 'KHR_mesh_quantization'));
});

test('rounding a shared normal accessor cannot mutate a position stream', async () => {
    const {document, primitive} = fixture();
    primitive.setAttribute('NORMAL', primitive.getAttribute('POSITION'));
    const position = primitive.getAttribute('POSITION');
    const {before, maxError} = await quantizeCharacterNormals(document, {method: 'exp16'});
    assert.equal(primitive.getAttribute('POSITION'), position);
    assert.notEqual(primitive.getAttribute('NORMAL'), position);
    assertCharacterNormalProof(before, characterNormalProof(document.getRoot()), maxError);
});


test('release policy fixes the source fingerprint and tolerance, rejecting relaxed or non-finite evidence', async () => {
    const {document} = fixture();
    const result = await quantizeCharacterNormals(document, {method: 'exp16'});
    const policy = compactNormalPolicy(result);
    verifyCompactNormalPolicy(policy, result.sourceGeometrySha256);
    assert.throws(() => verifyCompactNormalPolicy(policy, '0'.repeat(64)), /source differs/);
    for (const patch of [{tolerance: 0.001}, {method: 'fixed16'}, {measuredMaxComponentError: NaN},
        {measuredMaxComponentError: Infinity}, {measuredMaxComponentError: -1}, {measuredMaxComponentError: 0.00011},
        {sourceGeometrySha256: ''}, {unreviewedOption: true}]) {
        assert.throws(() => verifyCompactNormalPolicy({...policy, ...patch}));
    }
    assert.throws(() => compactNormalPolicy({...result, method: 'fixed16'}), /not a release policy/);
});


test('detached authoring targets cannot retain old normal buffers after rounding', async () => {
    const {document, primitive} = fixture();
    const original = primitive.listTargets()[0].getAttribute('NORMAL');
    const orphan = document.createPrimitiveTarget('detached authoring target').setAttribute('NORMAL', original);
    const detachedPrimitive = document.createPrimitive().addTarget(orphan);
    const {before, maxError} = await quantizeCharacterNormals(document, {method: 'exp16'});
    assert(detachedPrimitive.isDisposed());
    assert(orphan.isDisposed());
    assert(!document.getRoot().listAccessors().includes(original), 'unused original normal must not be serialized');
    assertCharacterNormalProof(before, characterNormalProof(document.getRoot()), maxError);
});
