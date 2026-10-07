/** V2 refusal tests use the actual accepted skinned cloth and exact body bind.
 * Blender compilation/repeat and live tailoring review are separate evidence.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {NodeIO, VertexLayout} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {MeshoptDecoder} from 'meshoptimizer';
import {validateDescriptor, verifyPinnedInputs, restoreSourceFrame, assertEquipmentPolicy, canonicalizeFactoryTriangles,
    verifyWrittenPlate, readPinnedShapeBody, addHumanShapeTargets} from './character-assets/equipment-factory-contract.mjs';

await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder': MeshoptDecoder}).setVertexLayout(VertexLayout.SEPARATE);
const descriptor = JSON.parse(await fs.readFile('blender/characters/wardrobe/fieldcoat.json', 'utf8'));
const body = async () => (await io.read(descriptor.fits.human.source)).getRoot();
async function cloth() {
    const doc = await io.read(descriptor.fits.human.garment.source), root = doc.getRoot();
    for (const extension of root.listExtensionsUsed()) if (extension.extensionName === 'EXT_meshopt_compression') extension.dispose();
    root.listMeshes()[0].setName(descriptor.mesh);
    restoreSourceFrame(root, await body(), descriptor, 'HumanV1Body');
    return doc;
}

test('soft policy is versioned separately; v1 rigid rules and shape method remain closed', () => {
    validateDescriptor(descriptor);
    assert.throws(() => validateDescriptor({...descriptor,schema:1}), /v1 supports rigid-bone/);
    assert.throws(() => validateDescriptor({...descriptor,rigidBones:['Spine']}), /without rigid policy/);
    assert.throws(() => validateDescriptor({...descriptor,humanShape:{...descriptor.humanShape,mode:'trackBodyRigid'}}), /trackBodyShape/);
    const d = structuredClone(descriptor); delete d.fits.orc.garment;
    assert.throws(() => validateDescriptor(d), /orc soft fit.*garment master/);
    d.fits.orc.garment = {...descriptor.fits.orc.garment,source:'.cache/unaccepted.glb'};
    assert.throws(() => validateDescriptor(d), /garment master/);
});

test('body and garment master are pinned independently before a soft build', async () => {
    await verifyPinnedInputs(descriptor);
    const target = descriptor.fits.human.garment.source;
    await assert.rejects(verifyPinnedInputs(descriptor, ['human'], async file => {
        const bytes = await fs.readFile(file);
        return file === target ? Buffer.concat([bytes,Buffer.from('changed')]) : bytes;
    }), /input changed: human garment/);
});

test('accepted soft cloth retains blended weights and exact bind through independent written read-back', async () => {
    const doc = await cloth(), policy = assertEquipmentPolicy(doc.getRoot(),descriptor);
    assert(policy.blendedVertices > 100);
    const result = await verifyWrittenPlate(io,Buffer.from(await io.writeBinary(doc)),await body(),descriptor,'HumanV1Body');
    assert.equal(result.bind.inverseBindExact,true); assert.equal(result.bind.worstPaletteDelta,0);
    await assert.rejects(verifyWrittenPlate(io,Buffer.from((await io.writeBinary(doc)).slice(0,-20)),await body(),descriptor,'HumanV1Body'), /Unreadable/);
});

test('soft written policy rejects texture, culling, skin and animation drift', async () => {
    let doc = await cloth(), root = doc.getRoot();
    const texture = root.listMaterials().find(m=>m.getBaseColorTexture()).getBaseColorTexture();
    const image = texture.getImage().slice(); image[image.length-1] ^= 1; texture.setImage(image);
    assert.throws(()=>assertEquipmentPolicy(root,descriptor), /material\/texture/);
    doc = await cloth(); root = doc.getRoot(); root.listMaterials()[0].setDoubleSided(false);
    assert.throws(()=>assertEquipmentPolicy(root,descriptor), /material\/texture/);
    doc = await cloth(); root = doc.getRoot();
    const w = root.listMeshes()[0].listPrimitives()[0].getAttribute('WEIGHTS_0'), values = w.getArray().slice(); values[0] += .01; w.setArray(values);
    assert.throws(()=>assertEquipmentPolicy(root,descriptor), /Unnormalized/);
    doc = await cloth(); root = doc.getRoot(); doc.createAnimation('stray');
    assert.throws(()=>assertEquipmentPolicy(root,descriptor), /animation/);
});

test('canonical triangle order handles native export permutations without losing winding or duplicates', async () => {
    const first = await cloth(), second = await cloth();
    const p = second.getRoot().listMeshes()[0].listPrimitives()[0], indices = p.getIndices(), values = indices.getArray();
    const shuffled = [];
    for (let i = values.length-3; i >= 0; i -= 3) shuffled.push(values[i+1],values[i+2],values[i]);
    indices.setArray(new values.constructor(shuffled));
    canonicalizeFactoryTriangles(first.getRoot()); canonicalizeFactoryTriangles(second.getRoot());
    const canonical = first.getRoot().listMeshes()[0].listPrimitives()[0].getIndices().getArray();
    assert.deepEqual(indices.getArray(),canonical,'triangle permutation/cyclic rotation must serialize identically');
    const reversed = indices.getArray().slice(); [reversed[0],reversed[1]]=[reversed[1],reversed[0]];
    indices.setArray(reversed); canonicalizeFactoryTriangles(second.getRoot());
    assert.notDeepEqual(indices.getArray(),canonical,'opposite winding must remain a different surface');
    const duplicate = new values.constructor([...canonical,...canonical.subarray(0,3)]);
    indices.setArray(duplicate); canonicalizeFactoryTriangles(second.getRoot());
    assert.equal(indices.getArray().length,canonical.length+3,'coincident duplicate triangle must survive');
});

test('soft Human targets reconstruct normals and preserve base skin/frame in written artifacts', async () => {
    const doc = await cloth(), root = doc.getRoot();
    const weights = root.listMeshes()[0].listPrimitives().map(p=>p.getAttribute('WEIGHTS_0').getArray().slice());
    const shape = (await io.readBinary(await readPinnedShapeBody(descriptor))).getRoot();
    addHumanShapeTargets(doc,shape,descriptor.humanShape.body.bodyMesh,{deformation:'soft-skin'});
    const written = (await io.readBinary(await io.writeBinary(doc))).getRoot();
    assertEquipmentPolicy(written,descriptor,{allowShapeTargets:true});
    assert.throws(()=>assertEquipmentPolicy(written,descriptor), /morph targets/);
    let moved = false, normalsChanged = false;
    for (const [i,p] of written.listMeshes()[0].listPrimitives().entries()) {
        assert.deepEqual(p.getAttribute('WEIGHTS_0').getArray(),weights[i]);
        for (const target of p.listTargets()) {
            moved ||= target.getAttribute('POSITION').getArray().some(v=>Math.abs(v)>1e-5);
            normalsChanged ||= target.getAttribute('NORMAL').getArray().some(v=>Math.abs(v)>1e-4);
        }
    }
    assert(moved && normalsChanged,'soft cloth requires real shape/normal deformation');
});
