/** M8 equipment factory: refusal controls on real tracked assets. The Blender stage is not run
 * here; these tests prove what happens to its output: THAT body's bind is restored, policy and
 * independent read-back refuse bad bytes, Human shape targets stay rigid, and publication is
 * deterministic with manifests last.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import zlib from 'node:zlib';
import {NodeIO, VertexLayout} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {MeshoptDecoder} from 'meshoptimizer';
import {FITS_BY_RACE} from '../src/ashen-reach/equipment-contract.js';
import {
    validateDescriptor, verifyPinnedInputs, readPinnedShapeBody, restoreSourceFrame, assertPlatePolicy, verifyWrittenPlate,
    addHumanShapeTargets, planPublication, executePublication, sha256,
} from './character-assets/equipment-factory-contract.mjs';
import {parseArguments} from './character-assets/equipment-factory.mjs';

await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder': MeshoptDecoder}).setVertexLayout(VertexLayout.SEPARATE);
const HEX = 'a'.repeat(64);
const descriptor = (patch = {}) => ({
    schema: 1, id: 'testShoulders', mesh: 'WardenPauldrons', slot: 'shoulders', layer: 'plate', occupies: ['shoulders'],
    deformation: 'rigid-bone', rigidBones: ['LeftArm', 'RightArm'], blenderVersion: '5.2.1',
    builder: {path: 'scripts/character-assets/build_bastion_shoulders.py', sha256: HEX, dependencies: [{path: 'scripts/character-assets/build_warden_pauldrons.py', sha256: HEX}]},
    sourceRights: 'Original project-authored geometry; test fixture only.',
    material: {revision: 1, baseColor: [0.32, 0.33, 0.36, 1], metallic: 0.9, roughness: 0.38},
    detail: {full: 'authored-shell', compact: 'same-rigid-geometry'},
    fits: Object.fromEntries(Object.entries({human: ['equipment', 'HumanV1Body'], orc: ['equipment-orc', 'BodyExposed'], undead: ['equipment-undead', 'UndeadV1Body']})
        .map(([race, [directory, bodyMesh]]) => [race, {directory, bodyMesh, source: `public/ashen-reach/${directory}/body.glb`, sha256: HEX, interface: {...FITS_BY_RACE[race]}}])),
    ...patch,
});
const base = async () => (await io.read('public/ashen-reach/equipment/body.glb')).getRoot();
/** A Warden plate as Blender would hand it back: un-normalized frame and a disturbed joint. */
async function authored() {
    const doc = await io.read('public/ashen-reach/equipment/wardenPauldrons.glb'), root = doc.getRoot();
    for (const n of root.listNodes()) if (n.getMesh()) n.setMatrix([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
    const joint = root.listSkins()[0].listJoints()[3], t = joint.getTranslation();
    joint.setTranslation([t[0] + 0.05, t[1], t[2]]);
    return doc;
}
async function restored(d = descriptor()) {
    const doc = await authored();
    restoreSourceFrame(doc.getRoot(), await base(), d, 'HumanV1Body');
    return doc;
}

test('descriptor refuses a missing race fit instead of falling back', () => {
    const d = descriptor(); delete d.fits.orc;
    assert.throws(() => validateDescriptor(d), /missing orc fit; refusing to fall back/);
    assert.throws(() => validateDescriptor(descriptor({fits: {...descriptor().fits, elf: descriptor().fits.human}})), /unknown race elf/);
});

test('descriptor refuses a drifted fit interface, simplified compact policy, unpinned Blender and escaping paths', () => {
    const d = descriptor(); d.fits.undead.interface.bind = 2;
    assert.throws(() => validateDescriptor(d), /undead interface bind/);
    assert.throws(() => validateDescriptor(descriptor({detail: {full: 'authored-shell', compact: 'simplified'}})), /detail policy/);
    assert.throws(() => validateDescriptor(descriptor({blenderVersion: '4.2.0'})), /pinned/);
    assert.throws(() => validateDescriptor(descriptor({builder: {path: '../outside.py', sha256: HEX}})), /builder/);
    assert.throws(() => validateDescriptor(descriptor({occupies: ['chest']})), /occupancy/);
    const material = descriptor().material;
    assert.throws(() => validateDescriptor(descriptor({material: {...material, revision: 0}})), /material/);
    assert.throws(() => validateDescriptor(descriptor({material: {...material, roughness: 1.2}})), /material/);
    assert.throws(() => validateDescriptor(descriptor({material: {...material, baseColor: [0.2, NaN, 0.2, 1]}})), /material/);
    const shape = {family: 'ashen-human-shape-v1', mode: 'trackBodyRigid', body: {source: '.cache/character-mmo/m004/human-shape-family-v1.glb', sha256: HEX, decodedSha256: HEX, compression: 'gzip', bodyMesh: 'HumanV1Body'}};
    assert.throws(() => validateDescriptor(descriptor({humanShape: shape})), /tracked gzip shape body/);
    assert.throws(() => validateDescriptor(descriptor({humanShape: {...shape, body: {...shape.body, source: 'public/x.bin', decodedSha256: undefined}}})), /tracked gzip shape body/);
    const dependency = descriptor().builder;
    assert.throws(() => validateDescriptor(descriptor({builder: {...dependency, dependencies: [{path: dependency.path, sha256: HEX}]}})), /dependencies/);
    assert.equal(validateDescriptor(descriptor()).id, 'testShoulders');
});

test('pinned inputs are hashed before any work: a changed or missing source refuses', async () => {
    const files = {'builder.py': Buffer.from('builder'), 'library.py': Buffer.from('library')};
    const d = descriptor({builder: {path: 'builder.py', sha256: sha256(files['builder.py']), dependencies: [{path: 'library.py', sha256: sha256(files['library.py'])}]}});
    for (const race of Object.keys(d.fits)) { files[d.fits[race].source] = Buffer.from(race); d.fits[race].sha256 = sha256(Buffer.from(race)); }
    const read = async (p) => { if (!files[p]) throw Error('ENOENT'); return files[p]; };
    await verifyPinnedInputs(d, undefined, read);
    files[d.fits.orc.source] = Buffer.from('orc, re-exported');
    await assert.rejects(verifyPinnedInputs(d, undefined, read), /input changed: orc source/);
    delete files[d.fits.orc.source];
    await assert.rejects(verifyPinnedInputs(d, undefined, read), /input missing: orc source/);
    await verifyPinnedInputs(d, ['human', 'undead'], read); // an isolated subset build does not need the orc source
    files['library.py'] = Buffer.from('library, edited');
    await assert.rejects(verifyPinnedInputs(d, ['human'], read), /input changed: builder dependency library\.py/);
});

test('gzip shape body is pinned twice: encoded file and decoded GLB', async () => {
    const glb = Buffer.from('decoded glb'), gz = zlib.gzipSync(glb), files = {'shape.bin': gz};
    const d = descriptor({humanShape: {family: 'ashen-human-shape-v1', mode: 'trackBodyRigid',
        body: {source: 'shape.bin', sha256: sha256(gz), decodedSha256: sha256(glb), compression: 'gzip', bodyMesh: 'HumanV1Body'}}});
    validateDescriptor(d);
    const read = async (p) => files[p];
    assert.equal(sha256(await readPinnedShapeBody(d, read)), sha256(glb));
    d.humanShape.body.decodedSha256 = HEX;
    await assert.rejects(readPinnedShapeBody(d, read), /decoded human shape body/);
    files['shape.bin'] = glb; d.humanShape.body.sha256 = sha256(glb);
    await assert.rejects(readPinnedShapeBody(d, read), /undecodable/);
});

test("root's Bastion descriptor satisfies the contract and every pin matches the files on disk", async () => {
    const d = validateDescriptor(JSON.parse(fs.readFileSync('blender/characters/wardrobe/bastion-shoulders.json', 'utf8')));
    await verifyPinnedInputs(d);
    const shape = (await io.readBinary(await readPinnedShapeBody(d))).getRoot();
    assert(shape.listMeshes().some((m) => m.getName() === d.humanShape.body.bodyMesh));
});

test('restored plate matches THAT body exactly, passes independent read-back and writes deterministically', async () => {
    const d = descriptor(), doc = await restored(d);
    const policy = assertPlatePolicy(doc.getRoot(), d);
    assert.deepEqual(policy.bones, ['mixamorig:LeftArm', 'mixamorig:RightArm']);
    const bytes = Buffer.from(await io.writeBinary(doc));
    assert.equal(sha256(Buffer.from(await io.writeBinary(doc))), sha256(bytes));
    const result = await verifyWrittenPlate(io, bytes, await base(), d, 'HumanV1Body');
    assert.equal(result.bind.inverseBindExact, true);
    assert.equal(result.bind.worstPaletteDelta, 0);
});

test('restoring against a different body bind refuses', async () => {
    const orc = (await io.read('public/ashen-reach/equipment-orc/body.glb')).getRoot();
    const doc = await authored();
    assert.throws(() => restoreSourceFrame(doc.getRoot(), orc, descriptor(), 'BodyExposed'), /inverse bind changed/);
});

test('policy refuses animation, morphs, material drift, bending and undeclared or unused bones', async () => {
    const d = descriptor();
    let doc = await restored(d); doc.createAnimation('Idle');
    assert.throws(() => assertPlatePolicy(doc.getRoot(), d), /animation/);
    doc = await restored(d);
    const p = doc.getRoot().listMeshes()[0].listPrimitives()[0], n = p.getAttribute('POSITION').getCount();
    p.addTarget(doc.createPrimitiveTarget('stray').setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(new Float32Array(n * 3))));
    assert.throws(() => assertPlatePolicy(doc.getRoot(), d), /morph targets/);
    doc = await restored(d); doc.getRoot().listMaterials()[0].setRoughnessFactor(0.6);
    assert.throws(() => assertPlatePolicy(doc.getRoot(), d), /Material differs/);
    doc = await restored(d);
    const weights = doc.getRoot().listMeshes()[0].listPrimitives()[0].getAttribute('WEIGHTS_0'), w = weights.getArray().slice();
    w[0] = 0.9; w[1] = 0.1; weights.setArray(w);
    assert.throws(() => assertPlatePolicy(doc.getRoot(), d), /single-bone rigid/);
    doc = await restored(d);
    assert.throws(() => assertPlatePolicy(doc.getRoot(), {...d, rigidBones: ['LeftArm']}), /single-bone rigid/);
    assert.throws(() => assertPlatePolicy(doc.getRoot(), {...d, rigidBones: ['LeftArm', 'RightArm', 'Head']}), /carries no geometry/);
    doc = await restored(d); doc.getRoot().listMeshes()[0].listPrimitives()[0].setExtras({});
    assert.throws(() => assertPlatePolicy(doc.getRoot(), d), /rigid deformation/);
});

test('read-back refuses corrupt bytes and a written bind that drifted from the body', async () => {
    const d = descriptor(), doc = await restored(d), bytes = Buffer.from(await io.writeBinary(doc));
    await assert.rejects(verifyWrittenPlate(io, bytes.subarray(0, bytes.length - 97), await base(), d, 'HumanV1Body'), /Unreadable factory artifact/);
    const badMagic = Buffer.from(bytes); badMagic.write('XXXX', 0);
    await assert.rejects(verifyWrittenPlate(io, badMagic, await base(), d, 'HumanV1Body'), /Unreadable factory artifact/);
    const ibm = doc.getRoot().listSkins()[0].getInverseBindMatrices(), m = ibm.getArray().slice(); m[13] += 0.01; ibm.setArray(m);
    await assert.rejects(verifyWrittenPlate(io, Buffer.from(await io.writeBinary(doc)), await base(), d, 'HumanV1Body'), /inverse bind/);
});

test('Human slender/stout targets move each arm plate as one rigid similarity with unchanged normals', async () => {
    const shape = (await io.readBinary(zlib.gunzipSync(fs.readFileSync('public/ashen-reach/human-shape-v1/body-e69a14d75176.bin')))).getRoot(); // tracked coverage source
    const d = descriptor(), doc = await restored(d);
    addHumanShapeTargets(doc, shape, 'HumanV1Body');
    const root = (await io.readBinary(await io.writeBinary(doc))).getRoot();
    assert.throws(() => assertPlatePolicy(root, d), /morph targets/); // a shaped artifact never passes as neutral
    assertPlatePolicy(root, d, {allowShapeTargets: true});
    const mesh = root.listMeshes()[0], p = mesh.listPrimitives()[0];
    assert.deepEqual(mesh.getExtras().targetNames, ['slender', 'stout']);
    const pos = p.getAttribute('POSITION').getArray(), joints = p.getAttribute('JOINTS_0').getArray();
    for (const target of p.listTargets()) {
        assert(target.getAttribute('NORMAL').getArray().every((v) => v === 0));
        const delta = target.getAttribute('POSITION').getArray();
        assert(delta.some((v) => Math.abs(v) > 1e-5), `${target.getName()} moved nothing`);
        for (const bone of new Set(Array.from({length: pos.length / 3}, (_, v) => joints[v * 4]))) {
            const vs = Array.from({length: pos.length / 3}, (_, v) => v).filter((v) => joints[v * 4] === bone);
            const dist = (a, b, s) => Math.hypot(...[0, 1, 2].map((k) => (pos[a * 3 + k] + s * delta[a * 3 + k]) - (pos[b * 3 + k] + s * delta[b * 3 + k])));
            const ratios = vs.slice(1, 40).map((v) => dist(vs[0], v, 1) / dist(vs[0], v, 0));
            assert(Math.max(...ratios) - Math.min(...ratios) < 1e-3, `${target.getName()} bends the plate on joint ${bone}`);
        }
    }
});

test('shaped read-back refuses wrong target order, invalid streams and deforming rigid normals', async () => {
    const shape = (await io.readBinary(zlib.gunzipSync(fs.readFileSync('public/ashen-reach/human-shape-v1/body-e69a14d75176.bin')))).getRoot();
    const d = descriptor(), doc = await restored(d);
    addHumanShapeTargets(doc, shape, 'HumanV1Body');
    const root = doc.getRoot(), mesh = root.listMeshes()[0], target = mesh.listPrimitives()[0].listTargets()[0];
    mesh.setExtras({targetNames: ['stout', 'slender']});
    assert.throws(() => assertPlatePolicy(root, d, {allowShapeTargets: true}), /names\/order/);
    mesh.setExtras({targetNames: ['slender', 'stout']});
    const delta = target.getAttribute('POSITION'), values = delta.getArray().slice();
    delta.setArray(Float32Array.from([NaN, 0, 0]));
    assert.throws(() => assertPlatePolicy(root, d, {allowShapeTargets: true}), /Invalid Human shape/);
    delta.setArray(values);
    const normal = target.getAttribute('NORMAL'), normals = normal.getArray().slice(); normals[0] = 0.1; normal.setArray(normals);
    assert.throws(() => assertPlatePolicy(root, d, {allowShapeTargets: true}), /normals must not deform/);
});

test('publication is deterministic, content-addressed, keeps other items and writes manifests last', async () => {
    const d = descriptor(), bytes = Buffer.from('plate'), builds = {}, manifests = {};
    for (const race of Object.keys(d.fits)) { builds[race] = {bytes, sha256: sha256(bytes)}; manifests[race] = {schema: 1, items: {body: {url: 'kept'}}}; }
    const a = planPublication(d, builds, manifests, {item: d.id}), b = planPublication(d, builds, manifests, {item: d.id});
    assert.deepEqual(a.files.map((f) => [f.path, sha256(f.bytes)]), b.files.map((f) => [f.path, sha256(f.bytes)]));
    assert.deepEqual(a.manifests.map((f) => sha256(f.bytes)), b.manifests.map((f) => sha256(f.bytes)));
    const human = JSON.parse(a.manifests[0].bytes);
    assert.equal(human.items.body.url, 'kept');
    assert.equal(human.items.testShoulders.url, `/ashen-reach/equipment/testShoulders-${sha256(bytes).slice(0, 12)}.glb`);
    assert.deepEqual(human.items.testShoulders.fit, FITS_BY_RACE.human);
    assert.equal(manifests.human.items.testShoulders, undefined); // the caller's manifest is not mutated

    const log = [];
    await executePublication(a, {write: async (p) => log.push(`write ${p}`), rename: async (x, y) => log.push(`rename ${y}`)});
    const firstManifest = log.findIndex((l) => l.includes('manifest.json'));
    assert(log.slice(0, firstManifest).every((l) => !l.includes('manifest')) && firstManifest === a.files.length);
    assert(log.slice(firstManifest).every((l) => l.includes('manifest.json')));

    const touched = [];
    await assert.rejects(executePublication(a, {
        write: async (p) => { if (p.endsWith('/testShoulders.glb') && p.includes('-orc')) throw Error('disk full'); touched.push(p); },
        rename: async (x, y) => touched.push(y),
    }), /disk full/);
    assert(touched.every((p) => !p.includes('manifest')), 'a failed file write must leave every manifest untouched');
});

test('CLI refuses non-isolated output, unknown races and partial publication', () => {
    assert.throws(() => parseArguments(['d.json', '--out', 'public/ashen-reach/equipment']), /under \.cache/);
    assert.throws(() => parseArguments(['d.json', '--out', '.cache']), /under \.cache/);
    assert.throws(() => parseArguments(['d.json', '--out', '.cache/x', '--races', 'human,elf']), /Unknown or empty/);
    assert.throws(() => parseArguments(['d.json', '--out', '.cache/x', '--races', 'human', '--publish']), /every race/);
    assert.throws(() => parseArguments(['d.json', '--out', '.cache/x', '--races', 'human,human,human', '--publish']), /Duplicate/);
    assert.equal(parseArguments(['d.json', '--out', '.cache/x', '--publish']).repeat, true);
});
