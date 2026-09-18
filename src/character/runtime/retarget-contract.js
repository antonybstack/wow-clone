/**
 * Offline animation retarget contract (M2c). Pure data; no engine imports.
 * Does not bake clips, mutate GLBs, or claim M2 complete.
 */
import { MIXAMO_IMPORT_MAP, RIG_HUMANOID_V1, resolveSemanticJoints, SEMANTIC_JOINTS } from './rig.js';

export const RETARGET_SCHEMA_VERSION = 1;

/** Clip-independent locomotion/combat states. Filenames live in clipFiles, never here. */
export const RETARGET_SEMANTIC_STATES = Object.freeze([
  'idle',
  'walk',
  'run',
  'jumpStart',
  'jumpLoop',
  'jumpLand',
  'cast',
]);

export const RETARGET_MODE_OFFLINE = 'offline';

export const REQUIRED_CORE_JOINTS = Object.freeze(
  SEMANTIC_JOINTS.filter((j) => j !== 'toeL' && j !== 'toeR'),
);

export const OPTIONAL_TOE_JOINTS = Object.freeze(['toeL', 'toeR']);

export const OPTIONAL_FINGER_JOINTS = Object.freeze([
  'thumbL', 'indexL', 'middleL', 'ringL', 'pinkyL',
  'thumbR', 'indexR', 'middleR', 'ringR', 'pinkyR',
]);

export const OPTIONAL_JOINTS = Object.freeze([...OPTIONAL_TOE_JOINTS, ...OPTIONAL_FINGER_JOINTS]);

const AXES = new Set(['+X', '-X', '+Y', '-Y', '+Z', '-Z']);

export const RETARGET_CODES = Object.freeze({
  DUPLICATE_SEMANTIC_MAPPING: 'DUPLICATE_SEMANTIC_MAPPING',
  REQUIRED_JOINT_MISSING: 'REQUIRED_JOINT_MISSING',
  UNIT_SCALE_INVALID: 'UNIT_SCALE_INVALID',
  AXIS_INVALID: 'AXIS_INVALID',
  RUNTIME_RETARGET_FORBIDDEN: 'RUNTIME_RETARGET_FORBIDDEN',
  SCHEMA_INVALID: 'SCHEMA_INVALID',
  DESTINATION_RIG_MISMATCH: 'DESTINATION_RIG_MISMATCH',
  OPTIONAL_JOINT_MISSING: 'OPTIONAL_JOINT_MISSING',
  SOURCE_CLIPS_ABSENT: 'SOURCE_CLIPS_ABSENT',
  BIND_COMPAT_NOT_REQUIRED_OFFLINE: 'BIND_COMPAT_NOT_REQUIRED_OFFLINE',
});

/** MakeHuman / Mixamo-stripped aliases on authored Human v1 (not a rig.js mutation). */
export const HUMAN_V1_IMPORT_MAP = Object.freeze({
  ...MIXAMO_IMPORT_MAP,
  thumbL: ['finger1-1.L', 'mixamorig:LeftHandThumb1', 'LeftHandThumb1'],
  indexL: ['finger2-1.L', 'mixamorig:LeftHandIndex1', 'LeftHandIndex1'],
  middleL: ['finger3-1.L', 'mixamorig:LeftHandMiddle1', 'LeftHandMiddle1'],
  ringL: ['finger4-1.L', 'mixamorig:LeftHandRing1', 'LeftHandRing1'],
  pinkyL: ['finger5-1.L', 'mixamorig:LeftHandPinky1', 'LeftHandPinky1'],
  thumbR: ['finger1-1.R', 'mixamorig:RightHandThumb1', 'RightHandThumb1'],
  indexR: ['finger2-1.R', 'mixamorig:RightHandIndex1', 'RightHandIndex1'],
  middleR: ['finger3-1.R', 'mixamorig:RightHandMiddle1', 'RightHandMiddle1'],
  ringR: ['finger4-1.R', 'mixamorig:RightHandRing1', 'RightHandRing1'],
  pinkyR: ['finger5-1.R', 'mixamorig:RightHandPinky1', 'RightHandPinky1'],
});

export const HUMAN_V1_SOURCE_PROFILE_ID = 'human-v1-source';

/** Authored body runtime metadata (WP-2.5). Schema/constants only; not a retarget bake. */
export const BODY_PROFILE_META_SCHEMA_VERSION = 1;
export const BODY_PROFILE_META_IDS = Object.freeze(['human-male-v1', 'orc-male-v1', 'undead-male-v1']);
export const BODY_PROFILE_META_FILES = Object.freeze({
  'human-male-v1': 'public/characters/bodies/human-v1.profile.json',
  'orc-male-v1': 'public/characters/bodies/orc-v1.profile.json',
  'undead-male-v1': 'public/characters/bodies/undead-v1.profile.json',
});
export const IDENTITY_GRIP_TRS = Object.freeze({
  translation: Object.freeze([0, 0, 0]),
  rotation: Object.freeze([0, 0, 0, 1]),
  scale: Object.freeze([1, 1, 1]),
});
export const BODY_PROFILE_META_CODES = Object.freeze({
  SCHEMA_INVALID: 'BODY_PROFILE_META_SCHEMA_INVALID',
  NONFINITE: 'BODY_PROFILE_META_NONFINITE',
  ID_MISMATCH: 'BODY_PROFILE_META_ID_MISMATCH',
});

function issue(code, path, message) {
  return { code, path, message };
}

function resolveExtended(nodeNames, importMap) {
  const core = resolveSemanticJoints(nodeNames, importMap);
  const resolved = { ...core.resolved };
  const missing = [...core.missing];
  const names = (nodeNames || []).filter(Boolean);
  for (const semantic of OPTIONAL_FINGER_JOINTS) {
    const aliases = importMap[semantic] || [];
    const hit = aliases.map((alias) => names.find((n) => n === alias)).find(Boolean);
    if (hit) resolved[semantic] = hit;
    else missing.push(semantic);
  }
  return { resolved, missing };
}

/**
 * Deterministic Human v1 semantic map from exported node names.
 * Does not require 163-joint equality or bind-signature equality.
 */
export function mapHumanV1Semantics(nodeNames) {
  const { resolved, missing } = resolveExtended(nodeNames, HUMAN_V1_IMPORT_MAP);
  const requiredMissing = REQUIRED_CORE_JOINTS.filter((j) => !resolved[j]);
  const optionalMissing = OPTIONAL_JOINTS.filter((j) => !resolved[j]);
  const mappedNames = new Set(Object.values(resolved));
  const unmappedNodes = [...new Set((nodeNames || []).filter(Boolean))].filter((n) => !mappedNames.has(n)).sort();
  return {
    sourceProfileId: HUMAN_V1_SOURCE_PROFILE_ID,
    destinationRigFamily: RIG_HUMANOID_V1,
    resolved,
    requiredMissing,
    optionalMissing,
    unmappedNodes,
    completeRequired: requiredMissing.length === 0,
  };
}

export function destinationIdentityMap() {
  const map = {};
  for (const j of [...REQUIRED_CORE_JOINTS, ...OPTIONAL_JOINTS]) map[j] = j;
  return map;
}

export function createHumanV1RetargetProfile(sourceMap) {
  return {
    schemaVersion: RETARGET_SCHEMA_VERSION,
    mode: RETARGET_MODE_OFFLINE,
    sourceProfileId: HUMAN_V1_SOURCE_PROFILE_ID,
    destinationRigFamily: RIG_HUMANOID_V1,
    sourceSemanticJoints: { ...sourceMap.resolved },
    destinationSemanticJoints: destinationIdentityMap(),
    requiredJoints: [...REQUIRED_CORE_JOINTS],
    optionalJoints: [...OPTIONAL_JOINTS],
    axes: { forward: '+Z', up: '+Y' },
    unitScale: 1,
    rootMotionPolicy: 'preserve-source-root-then-validate',
    bindCompatibilityRequired: false,
    semanticStates: [...RETARGET_SEMANTIC_STATES],
    clipFiles: Object.freeze({}),
  };
}

export function validateRetargetProfile(profile, sourceInventory, destinationVocabulary) {
  const errors = [];
  const warnings = [];
  if (!profile || typeof profile !== 'object') {
    return { valid: false, errors: [issue(RETARGET_CODES.SCHEMA_INVALID, 'profile', 'Profile is missing')], warnings };
  }
  if (profile.schemaVersion !== RETARGET_SCHEMA_VERSION) {
    errors.push(issue(RETARGET_CODES.SCHEMA_INVALID, 'schemaVersion', `Expected schema ${RETARGET_SCHEMA_VERSION}`));
  }
  if (profile.mode !== RETARGET_MODE_OFFLINE) {
    errors.push(issue(
      RETARGET_CODES.RUNTIME_RETARGET_FORBIDDEN,
      'mode',
      'Live/runtime retarget is unsupported; bake offline and load the result',
    ));
  }
  const destRig = destinationVocabulary?.rigFamily || destinationVocabulary?.rig;
  if (destRig && profile.destinationRigFamily !== destRig) {
    errors.push(issue(RETARGET_CODES.DESTINATION_RIG_MISMATCH, 'destinationRigFamily', 'Destination rig family mismatch'));
  }
  const scale = profile.unitScale;
  if (!Number.isFinite(scale) || scale <= 0) {
    errors.push(issue(RETARGET_CODES.UNIT_SCALE_INVALID, 'unitScale', 'unitScale must be a finite positive number'));
  }
  const axes = profile.axes || {};
  for (const key of ['forward', 'up']) {
    if (!AXES.has(axes[key])) {
      errors.push(issue(RETARGET_CODES.AXIS_INVALID, `axes.${key}`, `Invalid axis ${axes[key]}`));
    }
  }
  if (axes.forward && axes.up && axes.forward.replace(/^[+-]/, '') === axes.up.replace(/^[+-]/, '')) {
    errors.push(issue(RETARGET_CODES.AXIS_INVALID, 'axes', 'forward and up must be independent axes'));
  }

  const sourceMap = profile.sourceSemanticJoints || {};
  const seenSource = new Map();
  for (const [semantic, node] of Object.entries(sourceMap)) {
    if (!node) continue;
    if (seenSource.has(node)) {
      errors.push(issue(
        RETARGET_CODES.DUPLICATE_SEMANTIC_MAPPING,
        `sourceSemanticJoints.${semantic}`,
        `Node ${node} already maps ${seenSource.get(node)}`,
      ));
    } else seenSource.set(node, semantic);
  }

  const destMap = profile.destinationSemanticJoints || {};
  const seenDest = new Map();
  for (const [semantic, dest] of Object.entries(destMap)) {
    if (!dest) continue;
    if (seenDest.has(dest) && seenDest.get(dest) !== semantic) {
      errors.push(issue(
        RETARGET_CODES.DUPLICATE_SEMANTIC_MAPPING,
        `destinationSemanticJoints.${semantic}`,
        `Destination ${dest} already maps ${seenDest.get(dest)}`,
      ));
    } else seenDest.set(dest, semantic);
  }

  const inventoryNames = new Set(sourceInventory?.nodeNames || sourceInventory?.jointNames || []);
  const required = profile.requiredJoints || REQUIRED_CORE_JOINTS;
  for (const joint of required) {
    const node = sourceMap[joint];
    if (!node || (inventoryNames.size && !inventoryNames.has(node))) {
      errors.push(issue(RETARGET_CODES.REQUIRED_JOINT_MISSING, `sourceSemanticJoints.${joint}`, `Required joint ${joint} is unmapped`));
    }
  }

  const optional = profile.optionalJoints || OPTIONAL_JOINTS;
  for (const joint of optional) {
    const node = sourceMap[joint];
    if (!node || (inventoryNames.size && !inventoryNames.has(node))) {
      warnings.push(issue(RETARGET_CODES.OPTIONAL_JOINT_MISSING, `sourceSemanticJoints.${joint}`, `Optional joint ${joint} is absent`));
    }
  }

  const clips = sourceInventory?.animationNames;
  const clipCount = Array.isArray(clips) ? clips.length : (sourceInventory?.clipCount ?? 0);
  if (!clipCount) {
    warnings.push(issue(
      RETARGET_CODES.SOURCE_CLIPS_ABSENT,
      'sourceInventory.animationNames',
      'Source has no animation clips; retarget is not complete',
    ));
  }

  if (profile.bindCompatibilityRequired === true && profile.mode === RETARGET_MODE_OFFLINE) {
    warnings.push(issue(
      RETARGET_CODES.BIND_COMPAT_NOT_REQUIRED_OFFLINE,
      'bindCompatibilityRequired',
      'Offline retarget may cross bind signatures; runtime must consume baked output',
    ));
  }

  return { valid: errors.length === 0, errors, warnings };
}
