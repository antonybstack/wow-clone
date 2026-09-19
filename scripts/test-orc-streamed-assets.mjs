import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {ORC_BASE_VISIBLE_MESHES} from '../src/ashen-reach/equipment-catalog.js';
import {ORC_EQUIPMENT_FIT} from '../src/ashen-reach/equipment-contract.js';

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const dir = 'public/ashen-reach/equipment-orc';
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

test('Orc sculpt pack streams eight catalogue garments on the actor bind', async () => {
    assert.equal(manifest.profileId, 'orc-sculpt-v1');
    assert.equal(manifest.garments, true);
    assert.deepEqual(manifest.items.body.meshes, [...ORC_BASE_VISIBLE_MESHES]);
    for (const [id, asset] of Object.entries(manifest.items)) {
        const bytes = await fs.readFile(`public${asset.url}`);
        assert.equal(bytes.length, asset.bytes);
        assert.equal(createHash('sha256').update(bytes).digest('hex'), asset.sha256);
        const doc = await io.readBinary(bytes);
        assert.deepEqual(rig(doc), rig(source), id);
        assert.deepEqual(
            doc.getRoot().listNodes().filter(n => n.getMesh()).map(n => n.getName()).sort(),
            [...asset.meshes].sort(),
            id,
        );
        for (const node of doc.getRoot().listNodes().filter(n => n.getMesh())) {
            assert.deepEqual(node.getWorldMatrix(), IDENTITY, node.getName());
        }
        if (id === 'body') {
            assert.equal(doc.getRoot().listAnimations().length, 55);
        } else {
            assert.equal(doc.getRoot().listAnimations().length, 0);
            assert.deepEqual(asset.fit, ORC_EQUIPMENT_FIT);
        }
    }
});
