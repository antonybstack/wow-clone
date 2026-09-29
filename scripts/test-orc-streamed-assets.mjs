import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {ORC_BASE_VISIBLE_MESHES, ORC_BODY_URL} from '../src/ashen-reach/equipment-catalog.js';
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
    assert.equal(manifest.items.body.url, ORC_BODY_URL);
    for (const [id, asset] of Object.entries(manifest.items)) {
        const bytes = await fs.readFile(`public${new URL(asset.url, 'https://play.sparkify.dev').pathname}`);
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
        if (id === 'graveweaverGloves') {
            const glove = doc.getRoot().listNodes().find(n => n.getName() === 'GraveweaverGloves').getMesh();
            assert.equal(glove.getExtras().orcWristCuff, 1);
            // The bridge stays in the original skinned primitive and material. A
            // second primitive would add a draw submission to every dressed Orc.
            assert.equal(glove.listPrimitives().length, 1);
            assert.equal(glove.listPrimitives()[0].getAttribute('POSITION').getCount(), 2740);
        }
        if (id === 'body') {
            assert.equal(doc.getRoot().listAnimations().length, 57);
            const triangles = Object.fromEntries(doc.getRoot().listNodes()
                .filter(n => n.getMesh()).map(n => [n.getName(), n.getMesh().listPrimitives()
                    .reduce((sum, p) => sum + p.getIndices().getCount() / 3, 0)]));
            assert.equal(triangles.BodyExposed, 9568);
            assert.equal(triangles.BodyUnderTunic, 10727);
            assert.equal(triangles.BodyHands, 2349);
            assert.equal(triangles.BodyExposed + triangles.BodyUnderTunic + triangles.BodyHands, 22644);
        } else {
            assert.equal(doc.getRoot().listAnimations().length, 0);
            assert.deepEqual(asset.fit, ORC_EQUIPMENT_FIT);
        }
    }
});
