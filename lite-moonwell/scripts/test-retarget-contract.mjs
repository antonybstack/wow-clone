import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  RETARGET_SCHEMA_VERSION,
  RETARGET_SEMANTIC_STATES,
  RETARGET_MODE_OFFLINE,
  RETARGET_CODES,
  REQUIRED_CORE_JOINTS,
  OPTIONAL_FINGER_JOINTS,
  createHumanV1RetargetProfile,
  mapHumanV1Semantics,
  validateRetargetProfile,
} from '../src/character/runtime/retarget-contract.js';
import { RIG_HUMANOID_V1, SEMANTIC_JOINTS } from '../src/character/runtime/rig.js';
import { parseGlb } from '../src/character/runtime/glb.js';

const destVocab = { rigFamily: RIG_HUMANOID_V1, joints: SEMANTIC_JOINTS };

function synthInventory(overrides = {}) {
  const joints = {
    pelvis: 'Hips',
    spine: 'Spine',
    chest: 'Spine2',
    neck: 'Neck',
    head: 'Head',
    shoulderL: 'LeftShoulder',
    upperArmL: 'LeftArm',
    lowerArmL: 'LeftForeArm',
    handL: 'LeftHand',
    shoulderR: 'RightShoulder',
    upperArmR: 'RightArm',
    lowerArmR: 'RightForeArm',
    handR: 'RightHand',
    upperLegL: 'LeftUpLeg',
    lowerLegL: 'LeftLeg',
    footL: 'LeftFoot',
    toeL: 'LeftToeBase',
    upperLegR: 'RightUpLeg',
    lowerLegR: 'RightLeg',
    footR: 'RightFoot',
    toeR: 'RightToeBase',
    thumbL: 'finger1-1.L',
    indexL: 'finger2-1.L',
    middleL: 'finger3-1.L',
    ringL: 'finger4-1.L',
    pinkyL: 'finger5-1.L',
    thumbR: 'finger1-1.R',
    indexR: 'finger2-1.R',
    middleR: 'finger3-1.R',
    ringR: 'finger4-1.R',
    pinkyR: 'finger5-1.R',
  };
  const nodeNames = Object.values(joints);
  const mapping = { resolved: joints, requiredMissing: [], optionalMissing: [], unmappedNodes: [], completeRequired: true };
  const profile = createHumanV1RetargetProfile(mapping);
  const inventory = { nodeNames, animationNames: [], ...overrides };
  return { profile, inventory, joints };
}

test('schema version and semantic states are clip-independent', () => {
  assert.equal(RETARGET_SCHEMA_VERSION, 1);
  assert.deepEqual([...RETARGET_SEMANTIC_STATES], ['idle', 'walk', 'run', 'jumpStart', 'jumpLoop', 'jumpLand', 'cast']);
  assert.equal(RETARGET_MODE_OFFLINE, 'offline');
});

test('valid synthetic mapping is accepted with absent-clip warning', () => {
  const { profile, inventory } = synthInventory();
  const r = validateRetargetProfile(profile, inventory, destVocab);
  assert.equal(r.valid, true);
  assert.equal(r.errors.length, 0);
  assert.ok(r.warnings.some((w) => w.code === RETARGET_CODES.SOURCE_CLIPS_ABSENT));
  assert.equal(profile.clipFiles && Object.keys(profile.clipFiles).length, 0);
});

test('missing required joint is an error', () => {
  const { profile, inventory } = synthInventory();
  delete profile.sourceSemanticJoints.head;
  const r = validateRetargetProfile(profile, inventory, destVocab);
  assert.equal(r.valid, false);
  assert.ok(r.errors.some((e) => e.code === RETARGET_CODES.REQUIRED_JOINT_MISSING && e.path.includes('head')));
});

test('duplicate semantic mapping is an error', () => {
  const { profile, inventory } = synthInventory();
  profile.sourceSemanticJoints.handR = profile.sourceSemanticJoints.handL;
  const r = validateRetargetProfile(profile, inventory, destVocab);
  assert.equal(r.valid, false);
  assert.ok(r.errors.some((e) => e.code === RETARGET_CODES.DUPLICATE_SEMANTIC_MAPPING));
});

test('nonfinite or non-positive unit scale is an error', () => {
  const { profile, inventory } = synthInventory();
  profile.unitScale = Number.NaN;
  assert.equal(validateRetargetProfile(profile, inventory, destVocab).valid, false);
  profile.unitScale = -1;
  assert.ok(validateRetargetProfile(profile, inventory, destVocab).errors.some((e) => e.code === RETARGET_CODES.UNIT_SCALE_INVALID));
});

test('absent optional fingers warn; mapping still valid', () => {
  const { profile, inventory, joints } = synthInventory();
  for (const f of OPTIONAL_FINGER_JOINTS) delete profile.sourceSemanticJoints[f];
  inventory.nodeNames = Object.values(joints).filter((n) => !n.startsWith('finger'));
  const r = validateRetargetProfile(profile, inventory, destVocab);
  assert.equal(r.valid, true);
  assert.ok(r.warnings.some((w) => w.code === RETARGET_CODES.OPTIONAL_JOINT_MISSING));
});

test('runtime/live retarget mode is forbidden', () => {
  const { profile, inventory } = synthInventory();
  profile.mode = 'runtime';
  const r = validateRetargetProfile(profile, inventory, destVocab);
  assert.equal(r.valid, false);
  assert.ok(r.errors.some((e) => e.code === RETARGET_CODES.RUNTIME_RETARGET_FORBIDDEN));
  profile.mode = 'live';
  assert.ok(validateRetargetProfile(profile, inventory, destVocab).errors.some((e) => e.code === RETARGET_CODES.RUNTIME_RETARGET_FORBIDDEN));
});

test('Human inventory integration maps required joints and reports zero clips', async () => {
  const file = await readFile(new URL('../public/characters/bodies/human-v1.glb', import.meta.url));
  const { json } = parseGlb(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength));
  const jointNames = json.skins[0].joints.map((i) => json.nodes[i]?.name);
  const mapping = mapHumanV1Semantics(jointNames);
  assert.equal(mapping.completeRequired, true, mapping.requiredMissing.join(','));
  for (const j of REQUIRED_CORE_JOINTS) assert.ok(mapping.resolved[j], j);
  assert.equal(mapping.resolved.pelvis, 'Hips');
  assert.equal(mapping.resolved.chest, 'Spine2');
  assert.equal(mapping.resolved.thumbL, 'finger1-1.L');
  const anims = json.animations || [];
  assert.equal(anims.length, 0, 'human-v1 has no exported clips');
  const profile = createHumanV1RetargetProfile(mapping);
  const r = validateRetargetProfile(profile, { nodeNames: jointNames, animationNames: [] }, destVocab);
  assert.equal(r.valid, true);
  assert.ok(r.warnings.some((w) => w.code === RETARGET_CODES.SOURCE_CLIPS_ABSENT));
});
