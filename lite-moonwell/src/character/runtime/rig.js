/**
 * Humanoid rig family (north star §3.1, §4).
 * Semantic joints are the contract. Mixamo names are one import map, not the identity.
 */

export const RIG_HUMANOID_V1 = 'humanoid-v1';

export const SEMANTIC_JOINTS = Object.freeze([
  'pelvis',
  'spine',
  'chest',
  'neck',
  'head',
  'shoulderL',
  'upperArmL',
  'lowerArmL',
  'handL',
  'shoulderR',
  'upperArmR',
  'lowerArmR',
  'handR',
  'upperLegL',
  'lowerLegL',
  'footL',
  'toeL',
  'upperLegR',
  'lowerLegR',
  'footR',
  'toeR',
]);

export const SOCKETS = Object.freeze({
  head: 'head',
  back: 'chest',
  torso: 'spine',
  mainHand: 'handR',
  offHand: 'handL',
  leftArm: 'upperArmL',
  rightArm: 'upperArmR',
  leftForeArm: 'lowerArmL',
  rightForeArm: 'lowerArmR',
  leftFoot: 'footL',
  rightFoot: 'footR',
});

/** Mixamo → semantic. First hit wins. */
export const MIXAMO_IMPORT_MAP = Object.freeze({
  pelvis: ['mixamorig:Hips', 'Hips'],
  spine: ['mixamorig:Spine', 'Spine'],
  chest: ['mixamorig:Spine2', 'mixamorig:Spine1', 'Spine2'],
  neck: ['mixamorig:Neck', 'Neck'],
  head: ['mixamorig:Head', 'Head'],
  shoulderL: ['mixamorig:LeftShoulder', 'LeftShoulder'],
  upperArmL: ['mixamorig:LeftArm', 'LeftArm'],
  lowerArmL: ['mixamorig:LeftForeArm', 'LeftForeArm'],
  handL: ['mixamorig:LeftHand', 'LeftHand'],
  shoulderR: ['mixamorig:RightShoulder', 'RightShoulder'],
  upperArmR: ['mixamorig:RightArm', 'RightArm'],
  lowerArmR: ['mixamorig:RightForeArm', 'RightForeArm'],
  handR: ['mixamorig:RightHand', 'RightHand'],
  upperLegL: ['mixamorig:LeftUpLeg', 'LeftUpLeg'],
  lowerLegL: ['mixamorig:LeftLeg', 'LeftLeg'],
  footL: ['mixamorig:LeftFoot', 'LeftFoot'],
  toeL: ['mixamorig:LeftToeBase', 'LeftToeBase'],
  upperLegR: ['mixamorig:RightUpLeg', 'RightUpLeg'],
  lowerLegR: ['mixamorig:RightLeg', 'RightLeg'],
  footR: ['mixamorig:RightFoot', 'RightFoot'],
  toeR: ['mixamorig:RightToeBase', 'RightToeBase'],
});

export const ANIMATION_STATES = Object.freeze([
  'idleExplore',
  'idleCombat',
  'walkFwd',
  'walkBack',
  'strafeL',
  'strafeR',
  'runFwd',
  'turnInPlace',
  'jumpStart',
  'jumpLoop',
  'jumpLand',
  'crouch',
  'castEnter',
  'castIdle',
  'castRelease',
  'castExit',
]);

export function shortJointName(name) {
  return (name || '').replace(/^mixamorig:/, '');
}

/**
 * Map a loaded skeleton's node names onto semantic joints.
 * @param {string[]} nodeNames
 * @param {Record<string, string[]>} importMap
 */
export function resolveSemanticJoints(nodeNames, importMap = MIXAMO_IMPORT_MAP) {
  const names = nodeNames.filter(Boolean);
  const resolved = {};
  const missing = [];
  for (const semantic of SEMANTIC_JOINTS) {
    const aliases = importMap[semantic] || [];
    const hit = aliases.map(alias => names.find(n => n === alias || shortJointName(n) === alias)).find(Boolean);
    if (hit) resolved[semantic] = hit;
    else missing.push(semantic);
  }
  return { resolved, missing, complete: missing.length === 0 };
}

/** Mapping identity only. This is NOT a skeletal bind compatibility signature. */
export function semanticSignature(resolved) {
  return SEMANTIC_JOINTS.map((j) => `${j}=${resolved[j] || ''}`).join('|');
}
