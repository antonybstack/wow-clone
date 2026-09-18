import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  BODY_PROFILES,
  getBodyProfile,
  validateBodyProfileMeta,
} from '../src/character/runtime/body-profile.js';
import {
  BODY_PROFILE_META_CODES as C,
  BODY_PROFILE_META_FILES,
  BODY_PROFILE_META_IDS,
  BODY_PROFILE_META_SCHEMA_VERSION,
} from '../src/character/runtime/retarget-contract.js';

const META_KEYS = ['id', 'grip', 'sole', 'capsule', 'eyeHeight', 'cameraPivot'];

function pickMeta(profile) {
  const out = {};
  for (const key of META_KEYS) out[key] = profile[key];
  return out;
}

async function loadJson(rel) {
  const text = await readFile(new URL(`../${rel}`, import.meta.url), 'utf8');
  return JSON.parse(text);
}

test('body profile meta schema version and ids are stable', () => {
  assert.equal(BODY_PROFILE_META_SCHEMA_VERSION, 1);
  assert.deepEqual([...BODY_PROFILE_META_IDS], ['human-male-v1', 'orc-male-v1', 'undead-male-v1']);
});

test('JSON profiles parse, match BODY_PROFILES, and are finite', async () => {
  for (const id of BODY_PROFILE_META_IDS) {
    const json = await loadJson(BODY_PROFILE_META_FILES[id]);
    const profile = getBodyProfile(id);
    const report = validateBodyProfileMeta(json);
    assert.equal(report.valid, true, `${id}: ${report.errors.map((e) => e.path).join(',')}`);
    assert.equal(json.id, id);
    assert.deepEqual(pickMeta(profile), json);
    assert.equal(profile.capabilities.productionFit, false);
    const dump = JSON.stringify(json);
    assert.equal(dump.includes('mixamorig:'), false, `${id} must not use Mixamo-only names`);
    assert.match(json.sole.heelL.joint, /^(LeftFoot)$/);
    assert.match(json.grip.rightHand.translation.join(','), /[0-9]/);
  }
  assert.equal(getBodyProfile('human-male-v1').assets.body, '/characters/base.glb');
  assert.equal(getBodyProfile('human-male-v1').status, 'placeholder-mixamo');
});

test('missing field or non-finite number is rejected', async () => {
  const json = await loadJson(BODY_PROFILE_META_FILES['human-male-v1']);
  const missingLeft = structuredClone(json);
  delete missingLeft.grip.leftHand;
  const missingReport = validateBodyProfileMeta(missingLeft);
  assert.equal(missingReport.valid, false);
  assert.ok(missingReport.errors.some((e) => e.code === C.SCHEMA_INVALID && e.path.includes('leftHand')));

  const nan = structuredClone(json);
  nan.grip.rightHand.translation[1] = Number.NaN;
  const nanReport = validateBodyProfileMeta(nan);
  assert.equal(nanReport.valid, false);
  assert.ok(nanReport.errors.some((e) => e.code === C.NONFINITE));

  const inf = structuredClone(json);
  inf.sole.heelL.offsetY = Number.POSITIVE_INFINITY;
  assert.ok(validateBodyProfileMeta(inf).errors.some((e) => e.code === C.NONFINITE));

  const badId = structuredClone(json);
  badId.id = 'elf-v1';
  assert.ok(validateBodyProfileMeta(badId).errors.some((e) => e.code === C.ID_MISMATCH));

  assert.equal(validateBodyProfileMeta(null).valid, false);
});

test('capsule heights keep BODY_PROFILES unless bind height disagrees by > 0.03 m', () => {
  assert.equal(BODY_PROFILES['human-male-v1'].capsule.height, 1.748);
  assert.equal(BODY_PROFILES['human-male-v1'].capsule.radius, 0.28);
  assert.ok(Math.abs(1.7405 - 1.748) <= 0.03);
  assert.equal(BODY_PROFILES['orc-male-v1'].capsule.height, 2.1);
  assert.equal(BODY_PROFILES['orc-male-v1'].capsule.radius, 0.38);
  assert.ok(Math.abs(2.1 - 2.1) <= 0.03);
  assert.equal(BODY_PROFILES['undead-male-v1'].capsule.height, 1.66);
  assert.equal(BODY_PROFILES['undead-male-v1'].capsule.radius, 0.24);
  assert.ok(Math.abs(1.66 - 1.66) <= 0.03);
  assert.equal(BODY_PROFILES['orc-male-v1'].eyeHeight, 1.9353);
  assert.equal(BODY_PROFILES['undead-male-v1'].eyeHeight, 1.5521);
});
