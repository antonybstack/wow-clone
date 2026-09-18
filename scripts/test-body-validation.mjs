import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { parseGlb, glbWriter } from '../src/character/runtime/glb.js';
import { MIXAMO_IMPORT_MAP, SEMANTIC_JOINTS } from '../src/character/runtime/rig.js';
import {
  BODY_VALIDATION_CODES as C,
  BODY_VALIDATION_SCHEMA_VERSION,
  WEIGHT_NORMALIZATION_TOLERANCE,
  validateBody,
} from '../src/character/runtime/validate-body.js';
import { getBodyProfile, productionProfiles, profilesReadyForFit } from '../src/character/runtime/body-profile.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const file = await readFile(new URL('../public/characters/base.glb', import.meta.url));
const baseGlb = file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength);

function codes(report, key = 'errors') {
  return report[key].map((i) => i.code);
}

function hasCode(report, code, key = 'errors') {
  return codes(report, key).includes(code);
}

function mixamoJoints() {
  return SEMANTIC_JOINTS.map((s) => MIXAMO_IMPORT_MAP[s][0]);
}

function identityMat4() {
  return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
}

function buildBody(opts = {}) {
  const names = (opts.jointNames || mixamoJoints()).filter((n) => n !== opts.omitJoint);
  const json = {
    asset: { version: '2.0' },
    buffers: [{ byteLength: 0 }],
    bufferViews: [],
    accessors: [],
    materials: opts.noMaterials ? [] : [{ name: 'body' }],
    meshes: [],
    nodes: [],
    skins: [],
    scenes: [{ nodes: [0] }],
    scene: 0,
  };
  const writer = glbWriter(json, new Uint8Array(0));
  const positions = opts.positions || new Float32Array([0, 0, 0, 1, 0, 0, 0, 1.8, 0]);
  const vertexCount = positions.length / 3;
  const joints = opts.joints || new Uint8Array(vertexCount * 4);
  const weights = opts.weights || Float32Array.from({ length: vertexCount * 4 }, (_, i) => (i % 4 === 0 ? 1 : 0));
  const ibm = new Float32Array(names.length * 16);
  for (let j = 0; j < names.length; j++) ibm.set(identityMat4(), j * 16);

  const attributes = { POSITION: writer.append(positions, 'VEC3', true) };
  if (!opts.omitJoints) attributes.JOINTS_0 = writer.append(joints, 'VEC4');
  if (!opts.omitWeights) attributes.WEIGHTS_0 = writer.append(weights, 'VEC4');
  if (opts.extraInfluences) {
    attributes.JOINTS_1 = writer.append(joints, 'VEC4');
    attributes.WEIGHTS_1 = writer.append(weights, 'VEC4');
  }
  const prim = { attributes };
  if (!opts.omitMaterial) prim.material = opts.material === undefined ? 0 : opts.material;
  if (opts.morphNames) {
    prim.targets = opts.morphNames.map(() => ({ POSITION: writer.append(new Float32Array(positions.length), 'VEC3', true) }));
  }
  const mesh = { name: 'Body', primitives: [prim] };
  if (opts.morphNames) {
    mesh.weights = opts.morphNames.map(() => 0);
    mesh.extras = { targetNames: opts.morphNames };
  }
  json.meshes.push(mesh);

  const rootNode = { name: 'RootNode', children: [] };
  if (opts.rootScale) rootNode.scale = opts.rootScale;
  json.nodes.push(rootNode);
  const jointIndices = [];
  for (const name of names) {
    const idx = json.nodes.length;
    json.nodes.push({ name });
    rootNode.children.push(idx);
    jointIndices.push(idx);
  }
  json.nodes.push({ name: 'Body', mesh: 0, skin: opts.unboundSkin ? undefined : 0 });
  rootNode.children.push(json.nodes.length - 1);
  if (!opts.noSkin) json.skins.push({ joints: jointIndices, inverseBindMatrices: writer.append(ibm, 'MAT4') });
  return writer.finish();
}

function patchJson(buffer, edit) {
  const { json, binary } = parseGlb(buffer);
  edit(json);
  return glbWriter(json, binary).finish();
}

function runCli(args) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ['scripts/validate-character-body.mjs', ...args], {
      cwd: root,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => { stdout += d; });
    child.stderr.on('data', (d) => { stderr += d; });
    child.on('close', (code) => resolve({ code, stdout, stderr }));
  });
}

test('valid normalized skin data produces a schema report and bind signature', async () => {
  const bytes = buildBody();
  const report = await validateBody(bytes);
  assert.equal(report.schemaVersion, BODY_VALIDATION_SCHEMA_VERSION);
  assert.equal(report.valid, true);
  assert.equal(report.errors.length, 0);
  assert.ok(hasCode(report, C.UNITS_UNVERIFIED, 'warnings'));
  assert.equal(report.summary.jointCount, 21);
  assert.equal(report.summary.skinnedPrimitiveCount, 1);
  assert.ok(report.summary.bindSignature.startsWith('bind-v1:'));
  assert.equal(report.summary.bounds.space, 'source-mesh-local');
  assert.equal(report.summary.morphNames.length, 0);
  assert.ok(report.summary.unsupportedChecks.length > 0);
});

test('negative, NaN, and infinite weights are distinct errors', async () => {
  const negative = await validateBody(buildBody({
    weights: new Float32Array([-1, 2, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0]),
  }));
  assert.equal(negative.valid, false);
  assert.ok(hasCode(negative, C.SKIN_WEIGHTS_NEGATIVE));
  assert.equal(hasCode(negative, C.SKIN_WEIGHTS_UNNORMALIZED), false);

  const nanWeights = new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0]);
  nanWeights[0] = Number.NaN;
  const nan = await validateBody(buildBody({ weights: nanWeights }));
  assert.ok(hasCode(nan, C.SKIN_WEIGHTS_NONFINITE));

  const infWeights = new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0]);
  infWeights[0] = Number.POSITIVE_INFINITY;
  const inf = await validateBody(buildBody({ weights: infWeights }));
  assert.ok(hasCode(inf, C.SKIN_WEIGHTS_NONFINITE));
});

test('zero-weight vertex is an error and source weights are not rewritten', async () => {
  const weights = new Float32Array([0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0]);
  const before = Array.from(weights);
  const report = await validateBody(buildBody({ weights }));
  assert.ok(hasCode(report, C.SKIN_WEIGHTS_ZERO));
  assert.deepEqual(Array.from(weights), before);
});

test('out-of-range joint index is an error', async () => {
  const joints = new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  joints[0] = 99;
  const report = await validateBody(buildBody({ joints }));
  assert.ok(hasCode(report, C.SKIN_JOINTS_OUT_OF_RANGE));
});

test('attribute count mismatch is an error', async () => {
  const report = await validateBody(buildBody({
    positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1]),
    joints: new Uint8Array(12),
    weights: new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0]),
  }));
  assert.ok(hasCode(report, C.SKIN_ATTRIBUTE_COUNT_MISMATCH));
});

test('missing JOINTS_0/WEIGHTS_0 pair is an error', async () => {
  const missingWeights = await validateBody(buildBody({ omitWeights: true }));
  const missingJoints = await validateBody(buildBody({ omitJoints: true }));
  assert.ok(hasCode(missingWeights, C.SKIN_WEIGHTS_MISSING));
  assert.ok(hasCode(missingJoints, C.SKIN_JOINTS_MISSING));
});

test('invalid material reference is an error; missing material is a warning unless required', async () => {
  const invalid = await validateBody(buildBody({ material: 99 }));
  assert.ok(hasCode(invalid, C.MATERIAL_INDEX_INVALID));
  const missing = await validateBody(buildBody({ omitMaterial: true }));
  assert.equal(missing.valid, true);
  assert.ok(hasCode(missing, C.MATERIAL_MISSING, 'warnings'));
  const required = await validateBody(buildBody({ omitMaterial: true }), { profile: { requiresMaterials: true } });
  assert.ok(hasCode(required, C.MATERIAL_MISSING));
});

test('declared morph must exist; empty morph support is valid', async () => {
  const missing = await validateBody(buildBody(), { profile: { morphs: { fullness: { min: -1, max: 1 } } } });
  assert.ok(hasCode(missing, C.MORPH_DECLARED_MISSING));
  const present = await validateBody(buildBody({ morphNames: ['fullness'] }), { profile: { morphs: { fullness: {} } } });
  assert.equal(hasCode(present, C.MORPH_DECLARED_MISSING), false);
  assert.deepEqual(present.summary.morphNames, ['fullness']);
  const empty = await validateBody(buildBody(), { profile: { morphs: {} } });
  assert.equal(hasCode(empty, C.MORPH_DECLARED_MISSING), false);
});

test('phantom extras.targetNames do not establish morph support', async () => {
  const phantom = await validateBody(patchJson(buildBody(), (json) => {
    json.meshes[0].extras = { targetNames: ['fullness'] };
  }), { profile: { morphs: { fullness: {} } } });
  assert.equal(phantom.valid, false);
  assert.equal(phantom.summary.morphNames.includes('fullness'), false);
  assert.ok(hasCode(phantom, C.MORPH_TARGET_COUNT_MISMATCH));
  assert.ok(hasCode(phantom, C.MORPH_DECLARED_MISSING));
});

test('invalid morph target accessor is rejected and does not satisfy the profile', async () => {
  const report = await validateBody(patchJson(buildBody({ morphNames: ['fullness'] }), (json) => {
    json.meshes[0].primitives[0].targets[0].POSITION = 9999;
  }), { profile: { morphs: { fullness: {} } } });
  assert.equal(report.valid, false);
  assert.ok(hasCode(report, C.MORPH_TARGET_INVALID));
  assert.equal(report.summary.morphNames.includes('fullness'), false);
  assert.ok(hasCode(report, C.MORPH_DECLARED_MISSING));
});

test('morph target count mismatch is an error', async () => {
  const names = await validateBody(patchJson(buildBody({ morphNames: ['fullness'] }), (json) => {
    json.meshes[0].extras.targetNames = ['fullness', 'other'];
  }));
  assert.ok(hasCode(names, C.MORPH_TARGET_COUNT_MISMATCH));

  const vertices = await validateBody(patchJson(buildBody({ morphNames: ['fullness'] }), (json) => {
    json.accessors[json.meshes[0].primitives[0].targets[0].POSITION].count = 1;
  }));
  assert.ok(hasCode(vertices, C.MORPH_TARGET_COUNT_MISMATCH));
  assert.equal(vertices.summary.morphNames.includes('fullness'), false);
});

test('valid morph data satisfies the profile; unrelated meshes need not share morphs', async () => {
  const present = await validateBody(buildBody({ morphNames: ['fullness'] }), { profile: { morphs: { fullness: {} } } });
  assert.equal(present.valid, true);
  assert.deepEqual(present.summary.morphNames, ['fullness']);
  assert.equal(hasCode(present, C.MORPH_DECLARED_MISSING), false);

  const mixed = await validateBody(patchJson(buildBody({ morphNames: ['fullness'] }), (json) => {
    json.meshes.push({
      name: 'Prop',
      primitives: [{ attributes: { POSITION: json.meshes[0].primitives[0].attributes.POSITION }, material: 0 }],
    });
  }), { profile: { morphs: { fullness: {} } } });
  assert.equal(hasCode(mixed, C.MORPH_DECLARED_MISSING), false);
  assert.ok(mixed.summary.morphNames.includes('fullness'));
  assert.equal(hasCode(mixed, C.MORPH_TARGET_COUNT_MISMATCH), false);
});

test('malformed GLB returns GLB_MALFORMED instead of throwing', async () => {
  const report = await validateBody(new Uint8Array([1, 2, 3, 4]).buffer);
  assert.equal(report.valid, false);
  assert.ok(hasCode(report, C.GLB_MALFORMED));
});

test('validator does not mutate source bytes', async () => {
  const bytes = buildBody();
  const before = new Uint8Array(bytes).slice();
  await validateBody(bytes);
  assert.deepEqual(new Uint8Array(bytes), before);
});

test('sparse and normalized accessors are rejected, extra influences are unchecked', async () => {
  const sparse = await validateBody(patchJson(buildBody(), (json) => {
    json.accessors[json.meshes[0].primitives[0].attributes.POSITION].sparse = {
      count: 1,
      indices: { bufferView: 0, componentType: 5123 },
      values: { bufferView: 0 },
    };
  }));
  assert.ok(hasCode(sparse, C.ACCESSOR_UNSUPPORTED_SPARSE));

  const normalized = await validateBody(patchJson(buildBody(), (json) => {
    json.accessors[json.meshes[0].primitives[0].attributes.WEIGHTS_0].normalized = true;
  }));
  assert.ok(hasCode(normalized, C.ACCESSOR_UNSUPPORTED_NORMALIZED));

  const extra = await validateBody(buildBody({ extraInfluences: true }));
  assert.equal(extra.valid, true);
  assert.ok(hasCode(extra, C.SKIN_INFLUENCES_UNCHECKED, 'warnings'));
});

test('missing semantic joint is a structured error; bind hashes are not compared across races', async () => {
  const report = await validateBody(buildBody({ omitJoint: 'mixamorig:Head' }));
  assert.ok(hasCode(report, C.JOINT_SEMANTIC_MISSING));
  assert.ok(hasCode(report, C.BIND_CONTRACT_FAILED));
  assert.equal(report.summary.bindSignature, null);
});

test('weight tolerance is 1e-4 and weights are not normalized by the validator', async () => {
  assert.equal(WEIGHT_NORMALIZATION_TOLERANCE, 1e-4);
  const ok = await validateBody(buildBody({
    weights: new Float32Array([1 - 1e-5, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0]),
  }));
  assert.equal(hasCode(ok, C.SKIN_WEIGHTS_UNNORMALIZED), false);
  const bad = await validateBody(buildBody({
    weights: new Float32Array([1 - 5e-4, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0]),
  }));
  assert.ok(hasCode(bad, C.SKIN_WEIGHTS_UNNORMALIZED));
});

test('non-identity import root is a warning, nonfinite transform is an error', async () => {
  const scaled = await validateBody(buildBody({ rootScale: [0.01, 0.01, 0.01] }));
  assert.equal(scaled.valid, true);
  assert.ok(hasCode(scaled, C.TRANSFORM_NON_IDENTITY, 'warnings'));
  const broken = await validateBody(patchJson(buildBody(), (json) => {
    json.nodes[0].scale = [null, 1, 1];
  }));
  assert.ok(hasCode(broken, C.TRANSFORM_NONFINITE));
});

test('malformed top-level collections return GLTF_INVALID instead of throwing', async () => {
  const meshesObj = await validateBody(patchJson(buildBody(), (json) => { json.meshes = {}; }));
  assert.equal(meshesObj.valid, false);
  assert.ok(hasCode(meshesObj, C.GLTF_INVALID));

  const nullNodes = await validateBody(patchJson(buildBody(), (json) => { json.nodes = [null]; }));
  assert.equal(nullNodes.valid, false);
  assert.ok(hasCode(nullNodes, C.GLTF_INVALID));
});

test('malformed node TRS/matrix shape is TRANSFORM_MALFORMED, not a non-identity warning', async () => {
  const shortT = await validateBody(patchJson(buildBody(), (json) => { json.nodes[0].translation = [0, 0]; }));
  assert.ok(hasCode(shortT, C.TRANSFORM_MALFORMED));
  assert.equal(hasCode(shortT, C.TRANSFORM_NON_IDENTITY, 'warnings'), false);

  const rot3 = await validateBody(patchJson(buildBody(), (json) => { json.nodes[0].rotation = [0, 0, 1]; }));
  assert.ok(hasCode(rot3, C.TRANSFORM_MALFORMED));
  assert.equal(hasCode(rot3, C.TRANSFORM_NON_IDENTITY, 'warnings'), false);

  const mat15 = await validateBody(patchJson(buildBody(), (json) => { json.nodes[0].matrix = new Array(15).fill(0); }));
  assert.ok(hasCode(mat15, C.TRANSFORM_MALFORMED));
  assert.equal(hasCode(mat15, C.TRANSFORM_NON_IDENTITY, 'warnings'), false);

  const scalar = await validateBody(patchJson(buildBody(), (json) => { json.nodes[0].translation = 4; }));
  assert.ok(hasCode(scalar, C.TRANSFORM_MALFORMED));
  assert.equal(hasCode(scalar, C.TRANSFORM_NON_IDENTITY, 'warnings'), false);

  const scaled = await validateBody(buildBody({ rootScale: [0.01, 0.01, 0.01] }));
  assert.equal(scaled.valid, true);
  assert.ok(hasCode(scaled, C.TRANSFORM_NON_IDENTITY, 'warnings'));
  assert.equal(hasCode(scaled, C.TRANSFORM_MALFORMED), false);
});

test('placeholder profile does not advertise fullness and is not production-fit', async () => {
  const human = getBodyProfile('human-male-v1');
  assert.equal(Object.keys(human.morphs).includes('fullness'), false);
  assert.equal(productionProfiles().length, 0);
  assert.equal(profilesReadyForFit().length, 0);
  assert.equal(profilesReadyForFit({ includePlaceholders: true })[0].id, 'human-male-v1');
});

test('base.glb inspects as a Mixamo placeholder without a fullness morph', async () => {
  const before = new Uint8Array(baseGlb).slice();
  const report = await validateBody(baseGlb);
  const withProfile = await validateBody(baseGlb, { profile: 'human-male-v1' });
  assert.deepEqual(new Uint8Array(baseGlb), before);
  assert.equal(report.valid, true, `base.glb errors: ${codes(report).join(', ')}`);
  assert.equal(report.summary.morphNames.includes('fullness'), false);
  assert.ok(report.summary.bindSignature.startsWith('bind-v1:'));
  assert.equal(report.summary.bounds.space, 'source-mesh-local');
  assert.ok(hasCode(report, C.UNITS_UNVERIFIED, 'warnings'));
  assert.ok(hasCode(report, C.TRANSFORM_NON_IDENTITY, 'warnings'));
  assert.equal(hasCode(report, C.MORPH_DECLARED_MISSING), false);
  assert.equal(withProfile.valid, true, `profile errors: ${codes(withProfile).join(', ')}`);
  assert.ok(hasCode(withProfile, C.PROFILE_PLACEHOLDER, 'warnings'));
  assert.ok(hasCode(withProfile, C.PROFILE_NOT_PRODUCTION, 'warnings'));
  assert.equal(hasCode(withProfile, C.MORPH_DECLARED_MISSING), false);
  const unknown = await validateBody(baseGlb, { profile: 'elf-v1' });
  assert.ok(hasCode(unknown, C.PROFILE_UNKNOWN));
});

test('CLI: missing path, unknown flag, and unknown profile fail; base.glb exits 0', async () => {
  const missing = await runCli([]);
  assert.equal(missing.code, 2);
  const flag = await runCli(['public/characters/base.glb', '--nope']);
  assert.equal(flag.code, 2);
  const profile = await runCli(['public/characters/base.glb', '--profile', 'elf-v1']);
  assert.equal(profile.code, 2);
  const missingFile = await runCli(['public/characters/does-not-exist.glb']);
  assert.equal(missingFile.code, 2);
  const ok = await runCli(['public/characters/base.glb']);
  assert.equal(ok.code, 0, ok.stdout + ok.stderr);
  const placeholder = await runCli(['public/characters/base.glb', '--profile', 'human-male-v1']);
  assert.equal(placeholder.code, 0, placeholder.stdout + placeholder.stderr);
});
