/**
 * Body profiles (north star §3.1, §4, M2).
 * Mixamo `base.glb` is a placeholder Human bind until an authored body ships.
 * Orc and Undead are declared so fit work cannot assume Human-only IDs.
 *
 * Morph keys are asset-backed capabilities. The diagnostic fixture synthesizes
 * a `fullness` target; raw `base.glb` does not, so profiles must not advertise it.
 */

import { RIG_HUMANOID_V1 } from './rig.js';
import {
  BODY_PROFILE_META_CODES,
  BODY_PROFILE_META_IDS,
  IDENTITY_GRIP_TRS,
} from './retarget-contract.js';

const CAP_PLACEHOLDER = Object.freeze({
  productionFit: false,
  inspection: true,
  requiresMaterials: false,
  unitsDeclared: false,
});

const CAP_PLANNED = Object.freeze({
  productionFit: false,
  inspection: false,
  requiresMaterials: false,
  unitsDeclared: false,
});

const CAP_PRODUCTION_SOURCE = Object.freeze({
  productionFit: false,
  inspection: true,
  requiresMaterials: false,
  unitsDeclared: true,
});

const IDENTITY_ROTATION = IDENTITY_GRIP_TRS.rotation;
const IDENTITY_SCALE = IDENTITY_GRIP_TRS.scale;

function gripTrs(tx, ty, tz) {
  return Object.freeze({
    translation: Object.freeze([tx, ty, tz]),
    rotation: IDENTITY_ROTATION,
    scale: IDENTITY_SCALE,
  });
}

function soleRef(joint, offsetY) {
  return Object.freeze({ joint, offsetY });
}

/** Bind measurements from authored GLBs (human-v1 / orc-v1 / undead-v1). Not Mixamo production-fit. */
const HUMAN_META = Object.freeze({
  grip: Object.freeze({
    rightHand: gripTrs(0.0051, 0.0696, 0.0011),
    leftHand: gripTrs(-0.0044, 0.0697, 0.0006),
  }),
  sole: Object.freeze({
    heelL: soleRef('LeftFoot', -0.0723),
    heelR: soleRef('RightFoot', -0.0723),
    toeL: soleRef('LeftToeBase', -0.0314),
    toeR: soleRef('RightToeBase', -0.0314),
  }),
  capsule: Object.freeze({ height: 1.748, radius: 0.28 }),
  eyeHeight: 1.6385,
  cameraPivot: Object.freeze({ x: 0, y: 1.6385, z: 0 }),
});

const ORC_META = Object.freeze({
  grip: Object.freeze({
    rightHand: gripTrs(-0.0008, 0.0952, 0.0057),
    leftHand: gripTrs(0.0023, 0.0952, 0.0055),
  }),
  sole: Object.freeze({
    heelL: soleRef('LeftFoot', -0.0985),
    heelR: soleRef('RightFoot', -0.0985),
    toeL: soleRef('LeftToeBase', -0.0369),
    toeR: soleRef('RightToeBase', -0.0369),
  }),
  capsule: Object.freeze({ height: 2.10, radius: 0.38 }),
  eyeHeight: 1.9353,
  cameraPivot: Object.freeze({ x: 0, y: 1.9353, z: 0 }),
});

const UNDEAD_META = Object.freeze({
  grip: Object.freeze({
    rightHand: gripTrs(0.0024, 0.0582, 0.0028),
    leftHand: gripTrs(-0.0032, 0.0578, 0.0031),
  }),
  sole: Object.freeze({
    heelL: soleRef('LeftFoot', -0.0625),
    heelR: soleRef('RightFoot', -0.0625),
    toeL: soleRef('LeftToeBase', -0.0319),
    toeR: soleRef('RightToeBase', -0.0319),
  }),
  capsule: Object.freeze({ height: 1.66, radius: 0.24 }),
  eyeHeight: 1.5521,
  cameraPivot: Object.freeze({ x: 0, y: 1.5521, z: 0 }),
});

export const BODY_PROFILES = Object.freeze({
  'human-male-v1': {
    id: 'human-male-v1',
    race: 'human',
    bodyType: 'male',
    rig: RIG_HUMANOID_V1,
    importMap: 'mixamo',
    fitProfile: 'human-male-v1',
    status: 'placeholder-mixamo',
    assets: {
      body: '/characters/base.glb',
    },
    morphs: Object.freeze({}),
    capabilities: CAP_PLACEHOLDER,
    ...HUMAN_META,
    notes: 'Temporary Mixamo mannequin. Inspection only. M2 requires an authored Human with hands, feet, and face. Diagnostic-fixture fullness is not present on raw base.glb. Grip/sole/eyeHeight/capsule from authored human-v1.glb bind, not Mixamo; not production-fit.',
  },
  'orc-male-v1': {
    id: 'orc-male-v1',
    race: 'orc',
    bodyType: 'male',
    rig: RIG_HUMANOID_V1,
    importMap: 'mixamo',
    fitProfile: 'orc-male-v1',
    status: 'production-source',
    assets: { body: '/characters/bodies/orc-v1.glb' },
    morphs: Object.freeze({}),
    capabilities: CAP_PRODUCTION_SOURCE,
    ...ORC_META,
    notes: 'Authored MakeHuman CC0 source ~2.10 m. Broad shoulder girdle, thick limbs, large hands. Inspection source only. Not production-fit. Zero morphs/clips.',
  },
  'undead-male-v1': {
    id: 'undead-male-v1',
    race: 'undead',
    bodyType: 'male',
    rig: RIG_HUMANOID_V1,
    importMap: 'mixamo',
    fitProfile: 'undead-male-v1',
    status: 'production-source',
    assets: { body: '/characters/bodies/undead-v1.glb' },
    morphs: Object.freeze({}),
    capabilities: CAP_PRODUCTION_SOURCE,
    ...UNDEAD_META,
    notes: 'Authored MakeHuman CC0 source ~1.66 m posed with rest hunch. Narrow continuous torso, angular limbs. Inspection source only. Not production-fit. Zero morphs/clips.',
  },
});

export function getBodyProfile(id) {
  const profile = Object.hasOwn(BODY_PROFILES, id) ? BODY_PROFILES[id] : null;
  if (!profile) throw new Error(`Unknown body profile: ${id}`);
  return profile;
}

function issue(code, path, message) {
  return { code, path, message };
}

function requireObject(value, path, errors) {
  if (value == null || typeof value !== 'object' || Array.isArray(value)) {
    errors.push(issue(BODY_PROFILE_META_CODES.SCHEMA_INVALID, path, `${path} is missing`));
    return null;
  }
  return value;
}

function requireFiniteArray(value, length, path, errors) {
  if (!Array.isArray(value) || value.length !== length) {
    errors.push(issue(BODY_PROFILE_META_CODES.SCHEMA_INVALID, path, `${path} must be length ${length}`));
    return false;
  }
  if (!value.every((v) => Number.isFinite(v))) {
    errors.push(issue(BODY_PROFILE_META_CODES.NONFINITE, path, `${path} must be finite`));
    return false;
  }
  return true;
}

function requireFiniteNumber(value, path, errors) {
  if (value == null || Array.isArray(value) || typeof value === 'object') {
    errors.push(issue(BODY_PROFILE_META_CODES.SCHEMA_INVALID, path, `${path} is missing`));
    return false;
  }
  if (!Number.isFinite(value)) {
    errors.push(issue(BODY_PROFILE_META_CODES.NONFINITE, path, `${path} must be finite`));
    return false;
  }
  return true;
}

function requireGripTrs(value, path, errors) {
  const trs = requireObject(value, path, errors);
  if (!trs) return;
  requireFiniteArray(trs.translation, 3, `${path}.translation`, errors);
  requireFiniteArray(trs.rotation, 4, `${path}.rotation`, errors);
  requireFiniteArray(trs.scale, 3, `${path}.scale`, errors);
}

function requireSoleRef(value, path, errors) {
  const ref = requireObject(value, path, errors);
  if (!ref) return;
  if (typeof ref.joint !== 'string' || !ref.joint) {
    errors.push(issue(BODY_PROFILE_META_CODES.SCHEMA_INVALID, `${path}.joint`, `${path}.joint is missing`));
  }
  requireFiniteNumber(ref.offsetY, `${path}.offsetY`, errors);
}

/**
 * Reject if any required grip/sole/capsule/eye/pivot field is missing or non-finite.
 * Does not load GLBs or claim the 1 cm palm visual gate.
 */
export function validateBodyProfileMeta(meta) {
  const errors = [];
  const root = requireObject(meta, 'profile', errors);
  if (!root) return { valid: false, errors };
  if (typeof root.id !== 'string' || !BODY_PROFILE_META_IDS.includes(root.id)) {
    errors.push(issue(BODY_PROFILE_META_CODES.ID_MISMATCH, 'id', `id must be one of ${BODY_PROFILE_META_IDS.join(', ')}`));
  }
  const grip = requireObject(root.grip, 'grip', errors);
  if (grip) {
    requireGripTrs(grip.rightHand, 'grip.rightHand', errors);
    requireGripTrs(grip.leftHand, 'grip.leftHand', errors);
  }
  const sole = requireObject(root.sole, 'sole', errors);
  if (sole) {
    requireSoleRef(sole.heelL, 'sole.heelL', errors);
    requireSoleRef(sole.heelR, 'sole.heelR', errors);
    requireSoleRef(sole.toeL, 'sole.toeL', errors);
    requireSoleRef(sole.toeR, 'sole.toeR', errors);
  }
  const capsule = requireObject(root.capsule, 'capsule', errors);
  if (capsule) {
    requireFiniteNumber(capsule.height, 'capsule.height', errors);
    requireFiniteNumber(capsule.radius, 'capsule.radius', errors);
  }
  requireFiniteNumber(root.eyeHeight, 'eyeHeight', errors);
  const pivot = requireObject(root.cameraPivot, 'cameraPivot', errors);
  if (pivot) {
    requireFiniteNumber(pivot.x, 'cameraPivot.x', errors);
    requireFiniteNumber(pivot.y, 'cameraPivot.y', errors);
    requireFiniteNumber(pivot.z, 'cameraPivot.z', errors);
  }
  return { valid: errors.length === 0, errors };
}

export function productionProfiles() {
  return Object.values(BODY_PROFILES).filter((p) => p.status === 'production' && p.assets.body);
}

/**
 * Profiles approved for production garment fit.
 * Placeholders are excluded by default; they are inspection assets, not fit-ready.
 * Pass `{ includePlaceholders: true }` only for diagnostic inspection. This is
 * not a race-selection list.
 */
export function profilesReadyForFit({ includePlaceholders = false } = {}) {
  return Object.values(BODY_PROFILES).filter((p) => {
    if (!p.assets?.body) return false;
    if (p.status === 'production' && p.capabilities?.productionFit !== false) return true;
    if (includePlaceholders && p.status === 'placeholder-mixamo') return true;
    return false;
  });
}
