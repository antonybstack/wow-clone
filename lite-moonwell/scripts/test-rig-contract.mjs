import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseGlb, glbWriter } from '../src/character/runtime/glb.js';
import { inspectBindContract, assertCompatibleBind } from '../src/character/runtime/bind-contract.js';
import { composeFixture } from '../src/character/runtime/compose-fixture.js';
import {
  ANIMATION_STATES,
  MIXAMO_IMPORT_MAP,
  SEMANTIC_JOINTS,
  SOCKETS,
  semanticSignature,
  resolveSemanticJoints,
} from '../src/character/runtime/rig.js';
import { BODY_PROFILES, getBodyProfile, profilesReadyForFit, productionProfiles } from '../src/character/runtime/body-profile.js';

const file = await readFile(new URL('../public/characters/base.glb', import.meta.url));
const source = file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength);
const { json } = parseGlb(source);
const nodeNames = json.nodes.map((n) => n.name).filter(Boolean);

test('Mixamo base.glb resolves every semantic joint', () => {
  const { resolved, missing, complete } = resolveSemanticJoints(nodeNames, MIXAMO_IMPORT_MAP);
  assert.equal(complete, true, `missing ${missing.join(',')}`);
  assert.equal(resolved.pelvis, 'mixamorig:Hips');
  assert.equal(resolved.handR, 'mixamorig:RightHand');
  assert.equal(resolved.handL, 'mixamorig:LeftHand');
  assert.ok(semanticSignature(resolved).includes('pelvis=mixamorig:Hips'));
  assert.equal(resolved.chest, 'mixamorig:Spine2', 'explicit alias preference must beat node order');
});

test('sockets point at semantic joints that exist on the rig', () => {
  for (const semantic of Object.values(SOCKETS)) {
    assert.ok(SEMANTIC_JOINTS.includes(semantic), semantic);
  }
});

test('animation vocabulary is the M4 state set, not a clip filename list', () => {
  for (const name of ['idleExplore', 'walkFwd', 'walkBack', 'strafeL', 'runFwd', 'jumpStart', 'castRelease']) {
    assert.ok(ANIMATION_STATES.includes(name), name);
  }
});

test('three race profiles exist; only Human Mixamo is inspectable, none are production-fit', () => {
  const human = getBodyProfile('human-male-v1');
  assert.equal(human.status, 'placeholder-mixamo');
  assert.equal(human.capabilities.productionFit, false);
  assert.equal(human.capabilities.inspection, true);
  assert.deepEqual(human.morphs, {});
  assert.equal(getBodyProfile('orc-male-v1').status, 'production-source');
  assert.equal(getBodyProfile('undead-male-v1').status, 'production-source');
  assert.equal(getBodyProfile('orc-male-v1').capabilities.productionFit, false);
  assert.equal(getBodyProfile('undead-male-v1').capabilities.productionFit, false);
  assert.deepEqual(getBodyProfile('orc-male-v1').morphs, {});
  assert.equal(profilesReadyForFit().length, 0, 'placeholders are not production-fit ready');
  assert.equal(profilesReadyForFit({ includePlaceholders: true }).map((p) => p.id).join(), 'human-male-v1');
  assert.equal(Object.keys(BODY_PROFILES).length, 3);
  assert.throws(() => getBodyProfile('elf-v1'), /Unknown body profile/);
  assert.throws(() => getBodyProfile('toString'), /Unknown body profile/);
  assert.equal(productionProfiles().length, 0, 'placeholder bodies are not production-ready');
});

function editedSource(edit) {
  const { json, binary } = parseGlb(source); edit(json, binary);
  return glbWriter(json, binary).finish();
}
test('bind signature accepts compatible mesh additions, but rejects proportion and joint-order changes', async () => {
  const base = await inspectBindContract(source);
  assertCompatibleBind(base, await inspectBindContract(composeFixture(source).buffer));
  const longerArm = editedSource(j => {
    const arm = j.nodes.find(n => n.name === 'mixamorig:RightForeArm'); arm.translation[0] += 5;
  });
  const reordered = editedSource(j => j.skins[0].joints.reverse());
  for (const other of [longerArm, reordered]) {
    const contract = await inspectBindContract(other);
    assert.notEqual(base.signature, contract.signature);
    assert.throws(() => assertCompatibleBind(base, contract), /Incompatible/);
  }
  assert.throws(() => assertCompatibleBind(base, { ...base, signature: 'wrong' }), /Incompatible/);
});
test('bind signature includes inverse bind values and import-root transforms', async () => {
  const base = await inspectBindContract(source);
  const scaled = editedSource(j => { j.nodes.find(n => n.name === 'RootNode').scale[0] *= 2; });
  assert.notEqual(base.signature, (await inspectBindContract(scaled)).signature);
  const { json: j, binary } = parseGlb(source);
  const bytes = binary.slice(), accessor = j.accessors[j.skins[0].inverseBindMatrices], bv = j.bufferViews[accessor.bufferView];
  const view = new DataView(bytes.buffer); view.setFloat32((bv.byteOffset || 0) + (accessor.byteOffset || 0), 2, true);
  assert.notEqual(base.signature, (await inspectBindContract(glbWriter(j, bytes).finish())).signature);
});
