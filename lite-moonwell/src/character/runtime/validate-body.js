/**
 * Offline body-GLB validator (M2a). Pure data checks; no engine imports.
 * Does not complete M2. Does not certify production art, fit, or performance.
 */
import { parseGlb, readAccessor } from './glb.js';
import { inspectBindContract } from './bind-contract.js';
import { resolveSemanticJoints } from './rig.js';
import { getBodyProfile } from './body-profile.js';

export const BODY_VALIDATION_SCHEMA_VERSION = 1;
/** |sum(WEIGHTS_0) - 1| must be <= this. Source weights are never rewritten. */
export const WEIGHT_NORMALIZATION_TOLERANCE = 1e-4;
const TRANSFORM_EPS = 1e-5;
const ZERO_WEIGHT_EPS = 1e-8;
const MORPH_SEMANTICS = Object.freeze(['POSITION', 'NORMAL', 'TANGENT']);

export const BODY_VALIDATION_CODES = Object.freeze({
  GLB_MALFORMED: 'GLB_MALFORMED',
  GLTF_INVALID: 'GLTF_INVALID',
  ACCESSOR_MISSING: 'ACCESSOR_MISSING',
  ACCESSOR_UNSUPPORTED: 'ACCESSOR_UNSUPPORTED',
  ACCESSOR_UNSUPPORTED_SPARSE: 'ACCESSOR_UNSUPPORTED_SPARSE',
  ACCESSOR_UNSUPPORTED_NORMALIZED: 'ACCESSOR_UNSUPPORTED_NORMALIZED',
  ACCESSOR_UNSUPPORTED_MATRIX_LAYOUT: 'ACCESSOR_UNSUPPORTED_MATRIX_LAYOUT',
  SKIN_MISSING: 'SKIN_MISSING',
  SKIN_NODE_MISSING: 'SKIN_NODE_MISSING',
  SKIN_POSITION_INVALID: 'SKIN_POSITION_INVALID',
  SKIN_JOINTS_MISSING: 'SKIN_JOINTS_MISSING',
  SKIN_WEIGHTS_MISSING: 'SKIN_WEIGHTS_MISSING',
  SKIN_JOINTS_OUT_OF_RANGE: 'SKIN_JOINTS_OUT_OF_RANGE',
  SKIN_WEIGHTS_NEGATIVE: 'SKIN_WEIGHTS_NEGATIVE',
  SKIN_WEIGHTS_NONFINITE: 'SKIN_WEIGHTS_NONFINITE',
  SKIN_WEIGHTS_UNNORMALIZED: 'SKIN_WEIGHTS_UNNORMALIZED',
  SKIN_WEIGHTS_ZERO: 'SKIN_WEIGHTS_ZERO',
  SKIN_ATTRIBUTE_COUNT_MISMATCH: 'SKIN_ATTRIBUTE_COUNT_MISMATCH',
  SKIN_INFLUENCES_UNCHECKED: 'SKIN_INFLUENCES_UNCHECKED',
  JOINT_SEMANTIC_MISSING: 'JOINT_SEMANTIC_MISSING',
  BIND_CONTRACT_FAILED: 'BIND_CONTRACT_FAILED',
  MATERIAL_INDEX_INVALID: 'MATERIAL_INDEX_INVALID',
  MATERIAL_MISSING: 'MATERIAL_MISSING',
  MORPH_DECLARED_MISSING: 'MORPH_DECLARED_MISSING',
  MORPH_TARGET_INVALID: 'MORPH_TARGET_INVALID',
  MORPH_TARGET_COUNT_MISMATCH: 'MORPH_TARGET_COUNT_MISMATCH',
  TRANSFORM_NONFINITE: 'TRANSFORM_NONFINITE',
  TRANSFORM_MALFORMED: 'TRANSFORM_MALFORMED',
  TRANSFORM_MATRIX_AND_TRS: 'TRANSFORM_MATRIX_AND_TRS',
  TRANSFORM_NON_IDENTITY: 'TRANSFORM_NON_IDENTITY',
  UNITS_UNVERIFIED: 'UNITS_UNVERIFIED',
  PROFILE_UNKNOWN: 'PROFILE_UNKNOWN',
  PROFILE_PLACEHOLDER: 'PROFILE_PLACEHOLDER',
  PROFILE_NOT_PRODUCTION: 'PROFILE_NOT_PRODUCTION',
});

const C = BODY_VALIDATION_CODES;

const UNSUPPORTED_CHECKS = Object.freeze([
  'sparse accessors (rejected, not interpreted)',
  'normalized accessors (rejected, not denormalized)',
  'MAT2/MAT3 column-padded matrix layout (rejected)',
  'JOINTS_n/WEIGHTS_n for n>=1 (reported, not validated)',
  'world-space bounds (POSITION min/max are source-mesh-local)',
  'material quality (index presence is not an art grade)',
  'unit/scale compliance without declared profile metadata',
]);

function issue(code, path, message) {
  return { code, path, message };
}

function toArrayBuffer(bytes) {
  if (bytes instanceof ArrayBuffer) return bytes.slice(0);
  if (ArrayBuffer.isView(bytes)) return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  throw new TypeError('Expected GLB bytes as ArrayBuffer or typed array');
}

function isFiniteNumberArray(values, length) {
  return Array.isArray(values) && values.length === length && values.every((v) => Number.isFinite(v));
}

function arrayField(parent, key, path, report) {
  if (!parent || typeof parent !== 'object') return [];
  const value = parent[key];
  if (value == null) return [];
  if (!Array.isArray(value)) {
    report.error(C.GLTF_INVALID, path, `${key} must be an array`);
    return [];
  }
  return value;
}

function isObject(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function approxEqual(a, b, eps = TRANSFORM_EPS) {
  return Math.abs(a - b) <= eps;
}

function copyNumberArray(values, fallback) {
  return isFiniteNumberArray(values, fallback.length) ? [...values] : [...fallback];
}

function describeTransform(node) {
  if (!node) return null;
  if (node.matrix != null) return { matrix: copyNumberArray(node.matrix, new Array(16).fill(0)), identity: isIdentityTransform(node) };
  return {
    translation: copyNumberArray(node.translation, [0, 0, 0]),
    rotation: copyNumberArray(node.rotation, [0, 0, 0, 1]),
    scale: copyNumberArray(node.scale, [1, 1, 1]),
    identity: isIdentityTransform(node),
  };
}

function isIdentityTransform(node) {
  if (!node) return true;
  if (node.matrix != null) {
    const m = node.matrix;
    if (!isFiniteNumberArray(m, 16)) return false;
    for (let i = 0; i < 16; i++) {
      const expected = i % 5 === 0 ? 1 : 0;
      if (!approxEqual(m[i], expected)) return false;
    }
    return true;
  }
  const t = node.translation == null ? [0, 0, 0] : node.translation;
  const r = node.rotation == null ? [0, 0, 0, 1] : node.rotation;
  const s = node.scale == null ? [1, 1, 1] : node.scale;
  return isFiniteNumberArray(t, 3) && t.every((v) => approxEqual(v, 0))
    && isFiniteNumberArray(r, 4) && approxEqual(r[0], 0) && approxEqual(r[1], 0) && approxEqual(r[2], 0) && approxEqual(r[3], 1)
    && isFiniteNumberArray(s, 3) && s.every((v) => approxEqual(v, 1));
}

function checkTransformField(node, field, expectedLength, path, report) {
  const value = node[field];
  if (value == null) return true;
  if (!Array.isArray(value) || value.length !== expectedLength) {
    report.error(
      C.TRANSFORM_MALFORMED,
      `${path}.${field}`,
      `${field} must be an array of ${expectedLength} finite numbers`,
    );
    return false;
  }
  if (!value.every((v) => Number.isFinite(v))) {
    report.error(C.TRANSFORM_NONFINITE, `${path}.${field}`, `${node.name || path} has a non-finite ${field}`);
    return false;
  }
  return true;
}

function extraInfluenceKeys(attributes) {
  return Object.keys(attributes || {}).filter((k) => /^(JOINTS|WEIGHTS)_[1-9]\d*$/.test(k)).sort();
}

function declaredMorphs(profile) {
  if (!profile) return [];
  if (Array.isArray(profile.supportedMorphs)) return profile.supportedMorphs.map(String);
  if (profile.morphs && typeof profile.morphs === 'object') return Object.keys(profile.morphs);
  return [];
}

function morphTargetList(prim, path, report) {
  if (prim.targets == null) return [];
  if (!Array.isArray(prim.targets)) {
    report.error(C.GLTF_INVALID, `${path}.targets`, 'targets must be an array');
    return [];
  }
  return prim.targets;
}

function validateMorphDelta(json, binary, index, path, semantic, vertexCount, report) {
  if (!Number.isInteger(index) || index < 0) {
    report.error(C.MORPH_TARGET_INVALID, path, `${semantic} morph target accessor is invalid`);
    return false;
  }
  const acc = json.accessors?.[index];
  if (!acc) {
    report.error(C.MORPH_TARGET_INVALID, path, `Missing ${semantic} morph target accessor ${index}`);
    return false;
  }
  const support = accessorSupportError(json, index);
  if (support) {
    report.error(C.MORPH_TARGET_INVALID, path, `Unsupported ${semantic} morph target accessor ${index} (${support})`);
    return false;
  }
  if (acc.type !== 'VEC3' || acc.componentType !== 5126) {
    report.error(C.MORPH_TARGET_INVALID, path, `${semantic} morph deltas must be VEC3 float, got ${acc.type}/${acc.componentType}`);
    return false;
  }
  if (vertexCount != null && acc.count !== vertexCount) {
    report.error(C.MORPH_TARGET_COUNT_MISMATCH, path, `${semantic} morph count ${acc.count} != POSITION count ${vertexCount}`);
    return false;
  }
  let data;
  try {
    data = readAccessor(json, binary, index);
  } catch (err) {
    report.error(C.MORPH_TARGET_INVALID, path, err.message || `Unreadable ${semantic} morph accessor ${index}`);
    return false;
  }
  for (let i = 0; i < data.length; i++) {
    if (!Number.isFinite(data[i])) {
      report.error(C.MORPH_TARGET_INVALID, path, `Non-finite ${semantic} morph deltas`);
      return false;
    }
  }
  return true;
}

function validateMorphTarget(json, binary, target, path, vertexCount, report) {
  if (!isObject(target)) {
    report.error(C.MORPH_TARGET_INVALID, path, 'Morph target must be an object mapping POSITION/NORMAL/TANGENT to accessors');
    return false;
  }
  const keys = MORPH_SEMANTICS.filter((semantic) => target[semantic] != null);
  if (!keys.length) {
    report.error(C.MORPH_TARGET_INVALID, path, 'Morph target has no POSITION, NORMAL, or TANGENT accessor');
    return false;
  }
  let ok = true;
  for (const semantic of keys) {
    if (!validateMorphDelta(json, binary, target[semantic], `${path}.${semantic}`, semantic, vertexCount, report)) {
      ok = false;
    }
  }
  return ok;
}

/** Names from extras.targetNames only count when matching primitive.targets have real accessors. */
function morphNamesForMesh(json, binary, mesh, meshIndex, report) {
  const path = `meshes[${meshIndex}]`;
  const primitives = Array.isArray(mesh.primitives) ? mesh.primitives : [];
  const named = mesh?.extras?.targetNames;
  if (named != null && !Array.isArray(named)) {
    report.error(C.MORPH_TARGET_INVALID, `${path}.extras.targetNames`, 'targetNames must be an array');
  }
  const hasNames = Array.isArray(named) && named.length > 0;
  const targetLists = primitives.map((prim, pi) => (
    isObject(prim) ? morphTargetList(prim, `${path}.primitives[${pi}]`, report) : []
  ));
  const counts = targetLists.map((list) => list.length);
  const maxCount = counts.length ? Math.max(0, ...counts) : 0;
  if (counts.some((count) => count !== maxCount)) {
    report.error(C.MORPH_TARGET_COUNT_MISMATCH, `${path}.primitives`, `Primitive morph target counts differ (${counts.join(', ')})`);
  }
  if (hasNames && named.length !== maxCount) {
    report.error(
      C.MORPH_TARGET_COUNT_MISMATCH,
      `${path}.extras.targetNames`,
      `targetNames length ${named.length} != actual morph target count ${maxCount}`,
    );
  }

  const names = [];
  for (let ti = 0; ti < maxCount; ti++) {
    let slotValid = true;
    let sawSlot = false;
    for (let pi = 0; pi < primitives.length; pi++) {
      const prim = primitives[pi];
      const targets = targetLists[pi];
      if (!isObject(prim) || ti >= targets.length) {
        slotValid = false;
        continue;
      }
      sawSlot = true;
      const vertexCount = json.accessors?.[prim.attributes?.POSITION]?.count;
      if (!validateMorphTarget(json, binary, targets[ti], `${path}.primitives[${pi}].targets[${ti}]`, vertexCount, report)) {
        slotValid = false;
      }
    }
    if (!sawSlot || !slotValid) continue;
    if (hasNames && named[ti] != null && named[ti] !== '') names.push(String(named[ti]));
    else names.push(`${path}.targets[${ti}]`);
  }
  return names;
}

function resolveExpectedProfile(profile) {
  if (profile == null || profile === '') return { meta: null, error: null };
  if (typeof profile === 'string') {
    try {
      return { meta: getBodyProfile(profile), error: null };
    } catch {
      return { meta: null, error: issue(C.PROFILE_UNKNOWN, 'profile', `Unknown body profile: ${profile}`) };
    }
  }
  if (typeof profile === 'object') return { meta: profile, error: null };
  return { meta: null, error: issue(C.PROFILE_UNKNOWN, 'profile', 'Profile must be an id string or metadata object') };
}

function accessorSupportError(json, index) {
  const a = json.accessors?.[index];
  if (index == null || index === undefined) return C.ACCESSOR_MISSING;
  if (!a) return C.ACCESSOR_MISSING;
  if (a.sparse) return C.ACCESSOR_UNSUPPORTED_SPARSE;
  if (a.normalized) return C.ACCESSOR_UNSUPPORTED_NORMALIZED;
  if (a.type === 'MAT2' || a.type === 'MAT3') return C.ACCESSOR_UNSUPPORTED_MATRIX_LAYOUT;
  return null;
}

function readChecked(json, binary, index, path, report) {
  const support = accessorSupportError(json, index);
  if (support) {
    report.error(support, path, support === C.ACCESSOR_MISSING
      ? `Missing accessor ${index}`
      : `Unsupported accessor ${index} (${support})`);
    return null;
  }
  try {
    return readAccessor(json, binary, index);
  } catch (err) {
    report.error(C.ACCESSOR_UNSUPPORTED, path, err.message || `Unsupported accessor ${index}`);
    return null;
  }
}

function firstIndices(list, max = 8) {
  return list.slice(0, max).join(', ');
}

function emptySummary() {
  return {
    meshCount: 0,
    primitiveCount: 0,
    skinnedPrimitiveCount: 0,
    jointCount: 0,
    materialCount: 0,
    animationNames: [],
    morphNames: [],
    bindSignature: null,
    bounds: null,
    transforms: null,
    units: { verified: false, declared: null },
    profile: null,
    unsupportedChecks: UNSUPPORTED_CHECKS,
  };
}

function aabbFromPositions(positions) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < positions.length; i += 3) {
    for (let k = 0; k < 3; k++) {
      const v = positions[i + k];
      if (!Number.isFinite(v)) continue;
      if (v < min[k]) min[k] = v;
      if (v > max[k]) max[k] = v;
    }
  }
  if (!Number.isFinite(min[0])) return null;
  return { min, max };
}

function mergeAabb(a, b) {
  if (!a) return b;
  if (!b) return a;
  return {
    min: a.min.map((v, i) => Math.min(v, b.min[i])),
    max: a.max.map((v, i) => Math.max(v, b.max[i])),
  };
}

function skinForMesh(nodes, meshIndex) {
  const users = [];
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    if (isObject(n) && n.mesh === meshIndex) users.push({ index: i, node: n });
  }
  const skinIndices = [...new Set(users.map((u) => u.node.skin).filter((s) => s != null))];
  return { users, skinIndices };
}

function validateNodeTransforms(nodes, scenes, sceneIndex, report) {
  const scene = scenes[sceneIndex ?? 0];
  const rootSet = new Set(Array.isArray(scene?.nodes) ? scene.nodes : []);
  const meshNodeSet = new Set();
  const importRoots = [];
  const meshNodes = [];
  const nonfinite = [];
  const malformed = [];
  let nonIdentityCount = 0;

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    const path = `nodes[${i}]`;
    if (!isObject(node)) {
      report.error(C.GLTF_INVALID, path, 'Node is missing or not an object');
      malformed.push({ index: i, name: '' });
      continue;
    }
    const hasMatrix = node.matrix != null;
    const hasTrs = node.translation != null || node.rotation != null || node.scale != null;
    if (hasMatrix && hasTrs) {
      report.error(C.TRANSFORM_MATRIX_AND_TRS, path, `${node.name || path} defines both matrix and TRS`);
    }
    let shapeOk = true;
    if (hasMatrix && !checkTransformField(node, 'matrix', 16, path, report)) shapeOk = false;
    if (node.translation != null && !checkTransformField(node, 'translation', 3, path, report)) shapeOk = false;
    if (node.rotation != null && !checkTransformField(node, 'rotation', 4, path, report)) shapeOk = false;
    if (node.scale != null && !checkTransformField(node, 'scale', 3, path, report)) shapeOk = false;
    if (!shapeOk) {
      const wrongLength = (
        (node.matrix != null && (!Array.isArray(node.matrix) || node.matrix.length !== 16))
        || (node.translation != null && (!Array.isArray(node.translation) || node.translation.length !== 3))
        || (node.rotation != null && (!Array.isArray(node.rotation) || node.rotation.length !== 4))
        || (node.scale != null && (!Array.isArray(node.scale) || node.scale.length !== 3))
      );
      if (wrongLength) malformed.push({ index: i, name: node.name || '' });
      else nonfinite.push({ index: i, name: node.name || '' });
      continue;
    }
    const identity = isIdentityTransform(node);
    if (!identity) nonIdentityCount += 1;
    const entry = { index: i, name: node.name || '', ...describeTransform(node) };
    if (rootSet.has(i)) {
      importRoots.push(entry);
      if (!identity) {
        report.warn(C.TRANSFORM_NON_IDENTITY, path, `Import/scene root ${node.name || path} is not identity (not treated as malformed)`);
      }
    }
    if (node.mesh != null) {
      meshNodeSet.add(i);
      meshNodes.push(entry);
      if (!identity) {
        report.warn(C.TRANSFORM_NON_IDENTITY, path, `Mesh node ${node.name || path} is not identity (not treated as malformed)`);
      }
    }
  }

  return { importRoots, meshNodes, nonfinite, malformed, nonIdentityCount, meshNodeCount: meshNodeSet.size };
}

function validateSkinnedPrimitive(json, meshIndex, prim, primIndex, skin, skinIndex, report, read) {
  const path = `meshes[${meshIndex}].primitives[${primIndex}]`;
  const attrs = prim.attributes || {};
  const extras = extraInfluenceKeys(attrs);
  if (extras.length) {
    report.warn(
      C.SKIN_INFLUENCES_UNCHECKED,
      `${path}.attributes`,
      `Additional influence sets ${extras.join(', ')} were not validated; only JOINTS_0/WEIGHTS_0 are checked`,
    );
  }

  if (attrs.JOINTS_0 == null) report.error(C.SKIN_JOINTS_MISSING, `${path}.attributes.JOINTS_0`, 'Skinned primitive is missing JOINTS_0');
  if (attrs.WEIGHTS_0 == null) report.error(C.SKIN_WEIGHTS_MISSING, `${path}.attributes.WEIGHTS_0`, 'Skinned primitive is missing WEIGHTS_0');
  if (attrs.POSITION == null) {
    report.error(C.SKIN_POSITION_INVALID, `${path}.attributes.POSITION`, 'Skinned primitive is missing POSITION');
    return;
  }

  const posAcc = json.accessors?.[attrs.POSITION];
  if (posAcc && (posAcc.type !== 'VEC3' || posAcc.componentType !== 5126)) {
    report.error(C.SKIN_POSITION_INVALID, `${path}.attributes.POSITION`, `POSITION must be VEC3 float, got ${posAcc.type}/${posAcc.componentType}`);
  }

  const positions = read(attrs.POSITION, `${path}.attributes.POSITION`);
  if (positions) {
    const bad = [];
    for (let i = 0; i < positions.length; i++) if (!Number.isFinite(positions[i])) bad.push(Math.floor(i / 3));
    if (posAcc && posAcc.count * 3 !== positions.length) {
      report.error(C.SKIN_POSITION_INVALID, `${path}.attributes.POSITION`, 'POSITION component count is not 3 per vertex');
    }
    if (bad.length) {
      report.error(C.SKIN_POSITION_INVALID, `${path}.attributes.POSITION`, `Non-finite POSITION on ${[...new Set(bad)].length} vertex(es); first: ${firstIndices([...new Set(bad)])}`);
    }
    if (!posAcc?.count) report.error(C.SKIN_POSITION_INVALID, `${path}.attributes.POSITION`, 'POSITION accessor count is 0');
  }

  if (attrs.JOINTS_0 == null || attrs.WEIGHTS_0 == null) return;

  const jointAcc = json.accessors?.[attrs.JOINTS_0];
  if (jointAcc && (jointAcc.type !== 'VEC4' || (jointAcc.componentType !== 5121 && jointAcc.componentType !== 5123))) {
    report.error(C.ACCESSOR_UNSUPPORTED, `${path}.attributes.JOINTS_0`, `JOINTS_0 must be VEC4 unsigned byte or unsigned short, got ${jointAcc.type}/${jointAcc.componentType}`);
  }
  const weightAcc = json.accessors?.[attrs.WEIGHTS_0];
  if (weightAcc && (weightAcc.type !== 'VEC4' || weightAcc.componentType !== 5126)) {
    report.error(C.ACCESSOR_UNSUPPORTED, `${path}.attributes.WEIGHTS_0`, `WEIGHTS_0 must be VEC4 float (normalized integer weights are unsupported), got ${weightAcc.type}/${weightAcc.componentType}`);
  }

  const vertexCount = posAcc?.count;
  if (vertexCount != null) {
    if (jointAcc && jointAcc.count !== vertexCount) {
      report.error(C.SKIN_ATTRIBUTE_COUNT_MISMATCH, `${path}.attributes.JOINTS_0`, `JOINTS_0 count ${jointAcc.count} != POSITION count ${vertexCount}`);
    }
    if (weightAcc && weightAcc.count !== vertexCount) {
      report.error(C.SKIN_ATTRIBUTE_COUNT_MISMATCH, `${path}.attributes.WEIGHTS_0`, `WEIGHTS_0 count ${weightAcc.count} != POSITION count ${vertexCount}`);
    }
  }

  const joints = read(attrs.JOINTS_0, `${path}.attributes.JOINTS_0`);
  const weights = read(attrs.WEIGHTS_0, `${path}.attributes.WEIGHTS_0`);
  if (!joints || !weights) return;

  const jointCount = skin?.joints?.length || 0;
  const verts = Math.min(Math.floor(joints.length / 4), Math.floor(weights.length / 4));
  const outOfRange = [];
  const negative = [];
  const nonfinite = [];
  const zero = [];
  const unnormalized = [];

  for (let v = 0; v < verts; v++) {
    let sum = 0;
    let finite = true;
    let hasNegative = false;
    for (let k = 0; k < 4; k++) {
      const j = joints[v * 4 + k];
      if (skin) {
        if (!Number.isFinite(j) || j !== Math.trunc(j) || j < 0 || j >= jointCount) outOfRange.push(v);
      }
      const w = weights[v * 4 + k];
      if (!Number.isFinite(w)) {
        finite = false;
      } else {
        if (w < 0) hasNegative = true;
        sum += w;
      }
    }
    if (!finite) nonfinite.push(v);
    if (hasNegative) negative.push(v);
    if (finite) {
      if (sum === 0 || (sum > 0 && sum <= ZERO_WEIGHT_EPS)) zero.push(v);
      else if (Math.abs(sum - 1) > WEIGHT_NORMALIZATION_TOLERANCE) unnormalized.push(v);
    }
  }

  const emit = (code, attr, list, label) => {
    if (!list.length) return;
    const unique = [...new Set(list)];
    report.error(code, `${path}.attributes.${attr}`, `${label} on ${unique.length} vertex(es); first: ${firstIndices(unique)}`);
  };
  emit(C.SKIN_JOINTS_OUT_OF_RANGE, 'JOINTS_0', outOfRange, `Joint index outside skin[${skinIndex}] (0..${Math.max(0, jointCount - 1)})`);
  emit(C.SKIN_WEIGHTS_NEGATIVE, 'WEIGHTS_0', negative, 'Negative weight');
  emit(C.SKIN_WEIGHTS_NONFINITE, 'WEIGHTS_0', nonfinite, 'Non-finite weight');
  emit(C.SKIN_WEIGHTS_ZERO, 'WEIGHTS_0', zero, 'Zero total weight');
  emit(C.SKIN_WEIGHTS_UNNORMALIZED, 'WEIGHTS_0', unnormalized, `Weight sum outside 1 ± ${WEIGHT_NORMALIZATION_TOLERANCE}`);
}

/**
 * @param {ArrayBuffer|ArrayBufferView} bytes
 * @param {{ profile?: string | object }} [options]
 */
export async function validateBody(bytes, options = {}) {
  const errors = [];
  const warnings = [];
  const report = {
    error(code, path, message) { errors.push(issue(code, path, message)); },
    warn(code, path, message) { warnings.push(issue(code, path, message)); },
  };
  const summary = emptySummary();
  const finish = () => ({
    schemaVersion: BODY_VALIDATION_SCHEMA_VERSION,
    valid: errors.length === 0,
    errors,
    warnings,
    summary,
  });

  const { meta: profile, error: profileError } = resolveExpectedProfile(options.profile);
  if (profileError) report.error(profileError.code, profileError.path, profileError.message);
  if (profile) {
    summary.profile = {
      id: profile.id || null,
      status: profile.status || null,
      productionFit: profile.capabilities?.productionFit === true && profile.status === 'production',
      inspection: profile.capabilities?.inspection === true || profile.status === 'placeholder-mixamo',
    };
    if (profile.status === 'placeholder-mixamo') {
      report.warn(C.PROFILE_PLACEHOLDER, 'profile', `${profile.id || 'profile'} is a placeholder; inspection is not production fit readiness`);
    }
    if (profile.status && profile.status !== 'production') {
      report.warn(C.PROFILE_NOT_PRODUCTION, 'profile', `${profile.id || 'profile'} status is ${profile.status}, not production`);
    }
  }

  let buffer;
  try {
    buffer = toArrayBuffer(bytes);
  } catch (err) {
    report.error(C.GLB_MALFORMED, 'asset', err.message);
    return finish();
  }

  let json, binary;
  try {
    ({ json, binary } = parseGlb(buffer));
  } catch (err) {
    report.error(C.GLB_MALFORMED, 'asset', err.message);
    return finish();
  }
  if (!json || typeof json !== 'object' || Array.isArray(json)) {
    report.error(C.GLTF_INVALID, 'asset', 'GLB JSON chunk is not an object');
    return finish();
  }

  try {
    const meshes = arrayField(json, 'meshes', 'meshes', report);
    const skins = arrayField(json, 'skins', 'skins', report);
    const materials = arrayField(json, 'materials', 'materials', report);
    const nodes = arrayField(json, 'nodes', 'nodes', report);
    const animations = arrayField(json, 'animations', 'animations', report);
    arrayField(json, 'accessors', 'accessors', report);
    const scenes = arrayField(json, 'scenes', 'scenes', report);
    summary.meshCount = meshes.length;
    summary.materialCount = materials.length;
    summary.jointCount = Array.isArray(skins[0]?.joints) ? skins[0].joints.length : 0;
    summary.animationNames = animations.map((a) => (isObject(a) && a.name) || '');
    summary.primitiveCount = meshes.reduce((n, m) => n + (Array.isArray(m?.primitives) ? m.primitives.length : 0), 0);

    if (!skins.length) report.error(C.SKIN_MISSING, 'skins', 'Body GLB has no skins');

    const morphSet = [];
    let bounds = null;
    const meshBounds = [];
    const requiresMaterials = profile?.capabilities?.requiresMaterials === true || profile?.requiresMaterials === true;
    const accessorCache = new Map();
    const cachedRead = (index, path) => {
      if (accessorCache.has(index)) return accessorCache.get(index);
      const value = readChecked(json, binary, index, path, report);
      accessorCache.set(index, value);
      return value;
    };

    for (let mi = 0; mi < meshes.length; mi++) {
      const mesh = meshes[mi];
      const meshPath = `meshes[${mi}]`;
      if (!isObject(mesh)) {
        report.error(C.GLTF_INVALID, meshPath, 'Mesh is missing or not an object');
        continue;
      }
      for (const name of morphNamesForMesh(json, binary, mesh, mi, report)) {
        if (!morphSet.includes(name)) morphSet.push(name);
      }
      const { skinIndices } = skinForMesh(nodes, mi);
      const primitives = arrayField(mesh, 'primitives', `${meshPath}.primitives`, report);
      for (let pi = 0; pi < primitives.length; pi++) {
        const prim = primitives[pi];
        const path = `${meshPath}.primitives[${pi}]`;
        if (!isObject(prim)) {
          report.error(C.GLTF_INVALID, path, 'Primitive is missing or not an object');
          continue;
        }
        const attrs = isObject(prim.attributes) ? prim.attributes : {};
        const hasSkinAttrs = attrs.JOINTS_0 != null || attrs.WEIGHTS_0 != null || extraInfluenceKeys(attrs).length > 0;
        const skinned = skinIndices.length > 0 || hasSkinAttrs;
        if (prim.material == null) {
          const msg = 'Primitive has no material index';
          if (requiresMaterials) report.error(C.MATERIAL_MISSING, path, msg);
          else report.warn(C.MATERIAL_MISSING, path, `${msg} (allowed unless the profile requires materials)`);
        } else if (!Number.isInteger(prim.material) || prim.material < 0 || prim.material >= materials.length) {
          report.error(C.MATERIAL_INDEX_INVALID, `${path}.material`, `Material index ${prim.material} is not in materials[0..${Math.max(0, materials.length - 1)}]`);
        }

        if (attrs.POSITION != null) {
          const positions = cachedRead(attrs.POSITION, `${path}.attributes.POSITION`);
          if (positions) {
            const box = aabbFromPositions(positions);
            if (box) {
              meshBounds.push({ name: mesh.name || meshPath, space: 'source-mesh-local', min: box.min, max: box.max });
              bounds = mergeAabb(bounds, box);
            }
          }
        }

        if (!skinned) continue;
        summary.skinnedPrimitiveCount += 1;
        if (!skinIndices.length) {
          report.error(C.SKIN_NODE_MISSING, path, 'Primitive has skin attributes but no instantiating node with a skin');
          validateSkinnedPrimitive(json, mi, prim, pi, null, -1, report, cachedRead);
          continue;
        }
        for (const skinIndex of skinIndices) {
          const skin = skins[skinIndex];
          if (!isObject(skin)) {
            report.error(C.SKIN_MISSING, `nodes skin=${skinIndex}`, `Skin index ${skinIndex} is not defined`);
            continue;
          }
          validateSkinnedPrimitive(json, mi, prim, pi, skin, skinIndex, report, cachedRead);
        }
      }
    }

    summary.morphNames = morphSet;
    if (bounds) {
      summary.bounds = {
        space: 'source-mesh-local',
        min: bounds.min,
        max: bounds.max,
        meshes: meshBounds,
        note: 'Axis-aligned POSITION bounds. Node/world transforms are not applied; these are not world dimensions.',
      };
    }

    const expectedMorphs = declaredMorphs(profile);
    const morphLookup = new Set(morphSet);
    for (const name of expectedMorphs) {
      if (!morphLookup.has(name)) {
        report.error(C.MORPH_DECLARED_MISSING, 'profile.morphs', `Declared morph "${name}" is not present on the GLB`);
      }
    }

    const jointList = Array.isArray(skins[0]?.joints) ? skins[0].joints : null;
    if (skins[0] && skins[0].joints != null && !jointList) {
      report.error(C.GLTF_INVALID, 'skins[0].joints', 'skins[0].joints must be an array');
    }
    if (jointList) {
      const names = jointList.map((i) => (isObject(nodes[i]) && nodes[i].name) || undefined);
      const semantics = resolveSemanticJoints(names.filter(Boolean));
      if (!semantics.complete) {
        report.error(C.JOINT_SEMANTIC_MISSING, 'skins[0]', `Missing semantic joints: ${semantics.missing.join(', ')}`);
      }
    }

    if (skins.length) {
      try {
        const bind = await inspectBindContract(buffer);
        summary.bindSignature = bind.signature;
        summary.jointCount = bind.jointCount;
      } catch (err) {
        report.error(C.BIND_CONTRACT_FAILED, 'skins[0]', err.message || 'Bind contract inspection failed');
      }
    }

    summary.transforms = validateNodeTransforms(nodes, scenes, json.scene, report);

    const unitsDeclared = profile?.capabilities?.unitsDeclared === true || profile?.units != null;
    summary.units = {
      verified: false,
      declared: unitsDeclared ? (profile.units || true) : null,
    };
    if (!unitsDeclared) {
      report.warn(
        C.UNITS_UNVERIFIED,
        'asset',
        'Units are unverified: no profile unit metadata. Local mesh bounds are not world meters and RootNode scale is not applied.',
      );
    }
  } catch (err) {
    report.error(C.GLTF_INVALID, 'asset', err?.message || 'Malformed glTF data');
  }

  return finish();
}
