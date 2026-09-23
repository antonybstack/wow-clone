import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {MeshoptDecoder} from 'meshoptimizer';
import {HUMAN_EQUIPMENT_FIT} from '../src/ashen-reach/equipment-contract.js';

await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder': MeshoptDecoder});
const dir = 'public/ashen-reach/equipment';
const manifest = JSON.parse(await fs.readFile(`${dir}/manifest.json`, 'utf8'));
const source = await io.read(`${dir}/body.glb`);
const rig = doc => {
    const skin = doc.getRoot().listSkins()[0];
    return {
        joints: skin.listJoints().map(n => [n.getName(), n.getWorldMatrix()]),
        inverseBind: Array.from(skin.getInverseBindMatrices().getArray()),
    };
};
const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

test('Tripo human pack streams the catalogue on the actor bind', async () => {
    assert.equal(manifest.profileId, 'human-tripo-v1');
    assert.equal(manifest.fitId, HUMAN_EQUIPMENT_FIT.body);
    assert.equal(manifest.garments, true);
    assert.deepEqual(manifest.items.body.meshes, ['HumanV1Body']);
    assert.equal(source.getRoot().listSkins()[0].listJoints().length, 65);
    for (const [id, asset] of Object.entries(manifest.items)) {
        const bytes = await fs.readFile(`public${asset.url}`);
        assert.equal(bytes.length, asset.bytes, id);
        assert.equal(createHash('sha256').update(bytes).digest('hex'), asset.sha256, id);
        const doc = await io.readBinary(bytes);
        assert.deepEqual(rig(doc), rig(source), id);
        assert.deepEqual(
            doc.getRoot().listNodes().filter(n => n.getMesh()).map(n => n.getName()).sort(),
            [...asset.meshes].sort(),
            id,
        );
        for (const node of doc.getRoot().listNodes().filter(n => n.getMesh())) {
            assert.deepEqual([...node.getWorldMatrix()], IDENTITY, node.getName());
            for (const prim of node.getMesh().listPrimitives()) {
                const weights = prim.getAttribute('WEIGHTS_0').getArray();
                const joints = prim.getAttribute('JOINTS_0').getArray();
                for (let i = 0; i < weights.length; i += 4) {
                    assert.ok(Math.abs(weights[i] + weights[i + 1] + weights[i + 2] + weights[i + 3] - 1) < 1e-3);
                    for (let k = 0; k < 4; k++) assert.ok(joints[i + k] >= 0 && joints[i + k] < 65);
                }
            }
        }
        if (id === 'body') assert.equal(doc.getRoot().listAnimations().length, 57);
        else {
            assert.equal(doc.getRoot().listAnimations().length, 0, id);
            assert.deepEqual(asset.fit, HUMAN_EQUIPMENT_FIT);
        }
    }
});
