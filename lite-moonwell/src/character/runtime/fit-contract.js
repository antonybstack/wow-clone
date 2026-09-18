/**
 * Fit bind/geometry signatures. inspectBindContract(canonical body) is the bind
 * source of truth. A fit-only inspectBindContract hash is not guaranteed to match
 * that canonical signature because the hashed mesh-ancestry *set* can differ;
 * it is not categorically impossible (inspectBindContract deduplicates transform
 * chains). Policy: store and compare the canonical body signature, never treat a
 * garment inspectBindContract result as the body contract.
 */
import { parseGlb, readAccessor } from './glb.js';

export const FIT_SCHEMA_VERSION = 1;
export const FIT_ASSET_VERSION = 1;
export const SHAPE_IDENTITY = 'identity';

export const FIT_CODES = Object.freeze({
  MISSING_FIT: 'MISSING_FIT',
  BIND_MISMATCH: 'BIND_MISMATCH',
  GEOMETRY_MISMATCH: 'GEOMETRY_MISMATCH',
  COVERAGE_INVALID: 'COVERAGE_INVALID',
  UNKNOWN_ITEM: 'UNKNOWN_ITEM',
  TEXTURE_UNSUPPORTED: 'TEXTURE_UNSUPPORTED',
  INVALID_CONTRACT: 'INVALID_CONTRACT',
  INVALID_FIT: 'INVALID_FIT',
  ASSET_MISMATCH: 'ASSET_MISMATCH',
  INVALID_LOADOUT: 'INVALID_LOADOUT',
  UNSUPPORTED_FIT: 'UNSUPPORTED_FIT',
});

export function fitError(code, message) {
  const err = new Error(message);
  err.code = code;
  return err;
}

export async function sha256Hex(bytes) {
  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function fileSha256(buffer) {
  return `sha256:${await sha256Hex(buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer))}`;
}

export async function ibmHash(ibm) {
  const bytes = new Uint8Array(ibm.buffer, ibm.byteOffset, ibm.byteLength);
  return `ibm-v1:${await sha256Hex(bytes)}`;
}

export function meshNodeTRS(node) {
  if (node?.matrix) {
    return { matrix: [...node.matrix] };
  }
  return {
    translation: node?.translation ? [...node.translation] : [0, 0, 0],
    rotation: node?.rotation ? [...node.rotation] : [0, 0, 0, 1],
    scale: node?.scale ? [...node.scale] : [1, 1, 1],
  };
}

function accessorPayload(json, binary, index, label) {
  const a = json.accessors?.[index];
  if (!a) throw new Error(`Missing ${label} accessor`);
  const data = readAccessor(json, binary, index);
  const bytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  const header = `${label}|${a.componentType}|${a.type}|${a.count}|${a.normalized ? 1 : 0}|${bytes.byteLength}\n`;
  return { header, bytes };
}

export async function sourceGeometrySignature(json, binary, bodyNode) {
  const mesh = json.meshes[bodyNode.mesh];
  const prim = mesh?.primitives?.[0];
  if (!prim) throw new Error('Body mesh has no primitive');
  const chunks = [
    accessorPayload(json, binary, prim.attributes.POSITION, 'POSITION'),
    accessorPayload(json, binary, prim.indices, 'INDICES'),
    accessorPayload(json, binary, prim.attributes.JOINTS_0, 'JOINTS_0'),
    accessorPayload(json, binary, prim.attributes.WEIGHTS_0, 'WEIGHTS_0'),
  ];
  const basis = `BASIS|mesh=${mesh.name || ''}|node=${bodyNode.name || ''}|skin=${bodyNode.skin}|trs=${JSON.stringify(meshNodeTRS(bodyNode))}\n`;
  const enc = new TextEncoder();
  let length = enc.encode(basis).byteLength;
  for (const c of chunks) length += enc.encode(c.header).byteLength + c.bytes.byteLength;
  const packed = new Uint8Array(length);
  let offset = 0;
  for (const c of chunks) {
    const h = enc.encode(c.header);
    packed.set(h, offset); offset += h.byteLength;
    packed.set(c.bytes, offset); offset += c.bytes.byteLength;
  }
  packed.set(enc.encode(basis), offset);
  return `geom-v1:${await sha256Hex(packed)}`;
}

export function fitCacheKey({ profileId, bindSignature, sourceGeometrySignature: geom, shapeId, itemId, version }) {
  return `${profileId}|${bindSignature}|${geom}|${shapeId}|${itemId}@${version}`;
}

export function validateCoverageOffsets(offsets, indexCount) {
  if (!Array.isArray(offsets) || !offsets.length) {
    throw fitError(FIT_CODES.COVERAGE_INVALID, 'coverage.triangleOffsets must be a nonempty array');
  }
  const seen = new Set();
  for (const off of offsets) {
    if (!Number.isInteger(off) || off < 0 || off % 3 !== 0 || off + 2 >= indexCount) {
      throw fitError(FIT_CODES.COVERAGE_INVALID, `coverage offset out of range or not a triangle start: ${off}`);
    }
    if (seen.has(off)) {
      throw fitError(FIT_CODES.COVERAGE_INVALID, `duplicate coverage offset ${off}`);
    }
    seen.add(off);
  }
}

export function parentMap(nodes) {
  const parents = new Map();
  for (let i = 0; i < nodes.length; i++) {
    for (const child of nodes[i].children || []) {
      if (parents.has(child)) throw new Error('Invalid node hierarchy');
      parents.set(child, i);
    }
  }
  return parents;
}

export function nodeLocalMatrix(node) {
  if (node.matrix) {
    if (node.matrix.length !== 16 || node.matrix.some((v) => !Number.isFinite(v))) throw new Error('Non-finite matrix');
    return Float32Array.from(node.matrix);
  }
  const t = node.translation || [0, 0, 0];
  const r = node.rotation || [0, 0, 0, 1];
  const s = node.scale || [1, 1, 1];
  if ([...t, ...r, ...s].some((v) => !Number.isFinite(v))) throw new Error('Non-finite TRS');
  const [qx, qy, qz, qw] = r;
  const [sx, sy, sz] = s;
  return new Float32Array([
    (1 - 2 * (qy * qy + qz * qz)) * sx, (2 * (qx * qy + qz * qw)) * sx, (2 * (qx * qz - qy * qw)) * sx, 0,
    (2 * (qx * qy - qz * qw)) * sy, (1 - 2 * (qx * qx + qz * qz)) * sy, (2 * (qy * qz + qx * qw)) * sy, 0,
    (2 * (qx * qz + qy * qw)) * sz, (2 * (qy * qz - qx * qw)) * sz, (1 - 2 * (qx * qx + qy * qy)) * sz, 0,
    t[0], t[1], t[2], 1,
  ]);
}

function mat4Multiply(a, b) {
  const o = new Float32Array(16);
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
    }
  }
  return o;
}

export function jointRestWorld(json, jointNodeIndex) {
  const parents = parentMap(json.nodes);
  const chain = [];
  let index = jointNodeIndex;
  const seen = new Set();
  while (index !== undefined) {
    if (seen.has(index)) throw new Error('Cyclic joint hierarchy');
    seen.add(index);
    chain.unshift(index);
    index = parents.get(index);
  }
  let world = nodeLocalMatrix(json.nodes[chain[0]]);
  for (let i = 1; i < chain.length; i++) world = mat4Multiply(world, nodeLocalMatrix(json.nodes[chain[i]]));
  return { chain, world, local: chain.map((i) => ({ name: json.nodes[i].name || '', trs: meshNodeTRS(json.nodes[i]) })) };
}

/** Joint names, order, IBMs, and rest ancestry. Does not use inspectBindContract on the garment. */
export function assertCopiedSkinBind(sourceJson, sourceBinary, fitJson, fitBinary) {
  const srcSkin = sourceJson.skins[0];
  const fitSkin = fitJson.skins[0];
  if (!srcSkin || !fitSkin) throw new Error('Expected skins[0] on body and fit');
  const srcNames = srcSkin.joints.map((i) => sourceJson.nodes[i]?.name);
  const fitNames = fitSkin.joints.map((i) => fitJson.nodes[i]?.name);
  if (srcNames.length !== fitNames.length || srcNames.some((n, i) => n !== fitNames[i] || !n)) {
    throw new Error('Fit joint names/order do not match source skin');
  }
  const srcIbm = readAccessor(sourceJson, sourceBinary, srcSkin.inverseBindMatrices);
  const fitIbm = readAccessor(fitJson, fitBinary, fitSkin.inverseBindMatrices);
  if (srcIbm.length !== fitIbm.length || srcIbm.some((v, i) => v !== fitIbm[i])) {
    throw new Error('Fit IBMs do not match source skin');
  }
  for (let j = 0; j < srcSkin.joints.length; j++) {
    const srcRest = jointRestWorld(sourceJson, srcSkin.joints[j]);
    const fitRest = jointRestWorld(fitJson, fitSkin.joints[j]);
    if (JSON.stringify(srcRest.local) !== JSON.stringify(fitRest.local)) {
      throw new Error(`Fit rest ancestry mismatch at joint ${srcNames[j]}`);
    }
    for (let k = 0; k < 16; k++) {
      if (Math.abs(srcRest.world[k] - fitRest.world[k]) > 1e-6) {
        throw new Error(`Fit rest world mismatch at joint ${srcNames[j]}`);
      }
    }
  }
  return { jointNames: srcNames, jointCount: srcNames.length };
}

export function assertFactorMaterial(def) {
  const pbr = def?.pbrMetallicRoughness || {};
  if (
    pbr.baseColorTexture
    || pbr.metallicRoughnessTexture
    || def?.normalTexture
    || def?.occlusionTexture
    || def?.emissiveTexture
  ) {
    throw fitError(FIT_CODES.TEXTURE_UNSUPPORTED, 'TEXTURE_UNSUPPORTED: fit extract rejects texture-bearing materials');
  }
}
