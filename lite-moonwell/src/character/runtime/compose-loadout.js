/**
 * Pure skinned loadout composition: canonical body + selected fit payloads.
 * No scene, fetch, or animation manager. Staff/socket items are out of scope.
 */
import { inspectBindContract } from './bind-contract.js';
import { STARTER_PROFILES } from './compose-starter-outfit.js';
import {
  FIT_ASSET_VERSION,
  FIT_CODES,
  FIT_SCHEMA_VERSION,
  SHAPE_IDENTITY,
  assertCopiedSkinBind,
  fileSha256,
  fitError,
  meshNodeTRS,
  parentMap,
  sourceGeometrySignature,
  validateCoverageOffsets,
} from './fit-contract.js';
import {
  PLAYABLE_FIT_PROFILES,
  STARTER_ITEMS,
  parseFitManifest,
  resolveFit,
} from './garment-catalog.js';
import { glbWriter, parseGlb, readAccessor } from './glb.js';
import { copyFitMaterial } from './fit-material.js';

export const LOADOUT_SLOTS = Object.freeze(['chest', 'legs', 'feet']);

const ATTRS = Object.freeze(['POSITION', 'NORMAL', 'TEXCOORD_0', 'JOINTS_0', 'WEIGHTS_0']);
const ATTR_TYPES = Object.freeze({
  POSITION: 'VEC3',
  NORMAL: 'VEC3',
  TEXCOORD_0: 'VEC2',
  JOINTS_0: 'VEC4',
  WEIGHTS_0: 'VEC4',
});

function asArrayBuffer(source) {
  if (source instanceof ArrayBuffer) return source.slice(0);
  if (ArrayBuffer.isView(source)) {
    return source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength);
  }
  throw fitError(FIT_CODES.INVALID_FIT, 'Expected ArrayBuffer');
}

function trsEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function hideNodeKeepIndex(json, name) {
  const idx = json.nodes.findIndex((n) => n.name === name);
  if (idx < 0) return false;
  for (const node of json.nodes) {
    if (!node.children?.includes(idx)) continue;
    node.children = node.children.filter((c) => c !== idx);
    return true;
  }
  return false;
}

function materialKey(def) {
  return JSON.stringify(def);
}

function copyLocalTransform(node) {
  const out = {};
  if (node.matrix) out.matrix = [...node.matrix];
  else {
    if (node.translation) out.translation = [...node.translation];
    if (node.rotation) out.rotation = [...node.rotation];
    if (node.scale) out.scale = [...node.scale];
  }
  return out;
}

function appendFrom(writer, json, srcJson, srcBinary, accessorIndex, expectedType, bounds) {
  const a = srcJson.accessors[accessorIndex];
  if (!a || a.type !== expectedType || a.sparse) {
    throw fitError(FIT_CODES.UNSUPPORTED_FIT, `UNSUPPORTED_FIT: accessor ${accessorIndex} type/sparse`);
  }
  const data = readAccessor(srcJson, srcBinary, accessorIndex);
  const index = writer.append(data, expectedType, bounds);
  if (a.normalized) json.accessors[index].normalized = true;
  return index;
}

function normalizeLoadout(loadout = {}) {
  for (const key of Object.keys(loadout)) {
    if (!LOADOUT_SLOTS.includes(key)) {
      throw fitError(FIT_CODES.INVALID_LOADOUT, `INVALID_LOADOUT: unknown slot ${key}`);
    }
  }
  const selected = [];
  for (const slot of LOADOUT_SLOTS) {
    const itemId = loadout[slot];
    if (itemId == null || itemId === '') continue;
    const item = STARTER_ITEMS[itemId];
    if (!item) throw fitError(FIT_CODES.UNKNOWN_ITEM, `UNKNOWN_ITEM: ${itemId}`);
    if (item.slot !== slot) {
      throw fitError(FIT_CODES.INVALID_LOADOUT, `INVALID_LOADOUT: ${itemId} occupies ${item.slot}, not ${slot}`);
    }
    selected.push({ slot, itemId, item });
  }
  return selected;
}

function findGarmentNode(fitJson) {
  const hits = [];
  for (let i = 0; i < fitJson.nodes.length; i++) {
    if (fitJson.nodes[i].mesh != null) hits.push(i);
  }
  if (hits.length !== 1) {
    throw fitError(FIT_CODES.INVALID_FIT, 'INVALID_FIT: expected exactly one garment mesh node');
  }
  return hits[0];
}

function rejectUnsupportedFitMesh(mesh) {
  if (mesh.weights?.length || mesh.primitives?.some((p) => p.targets?.length)) {
    throw fitError(FIT_CODES.UNSUPPORTED_FIT, 'UNSUPPORTED_FIT: morph targets are not supported');
  }
  for (const prim of mesh.primitives || []) {
    if (prim.mode != null && prim.mode !== 4) {
      throw fitError(FIT_CODES.UNSUPPORTED_FIT, `UNSUPPORTED_FIT: primitive mode ${prim.mode}`);
    }
    const keys = Object.keys(prim.attributes || {});
    if (keys.length !== ATTRS.length || ATTRS.some((k) => !keys.includes(k))) {
      throw fitError(FIT_CODES.UNSUPPORTED_FIT, 'UNSUPPORTED_FIT: unexpected mesh attributes');
    }
  }
}

function validateFitExtras(extras, { item, profileId, bindSignature, sourceGeometrySignature, sourceMesh, sourceSkin, bodyTRS }) {
  if (!extras || extras.schema !== FIT_SCHEMA_VERSION) {
    throw fitError(FIT_CODES.INVALID_FIT, 'INVALID_FIT: extras.fit schema');
  }
  if (
    extras.itemId !== item.id
    || extras.slot !== item.slot
    || extras.profileId !== profileId
    || extras.version !== FIT_ASSET_VERSION
    || extras.shapeId !== SHAPE_IDENTITY
  ) {
    throw fitError(FIT_CODES.INVALID_FIT, `INVALID_FIT: ${item.id} extras identity does not match descriptor`);
  }
  if (extras.bindSignature !== bindSignature || extras.sourceGeometrySignature !== sourceGeometrySignature) {
    throw fitError(FIT_CODES.INVALID_FIT, `INVALID_FIT: ${item.id} extras signatures do not match canonical body`);
  }
  if (extras.sourceMesh !== sourceMesh || extras.sourceSkin !== sourceSkin) {
    throw fitError(FIT_CODES.INVALID_FIT, `INVALID_FIT: ${item.id} extras source mesh/skin do not match canonical body`);
  }
  if (!trsEqual(extras.meshNodeTRS, bodyTRS)) {
    throw fitError(FIT_CODES.INVALID_FIT, `INVALID_FIT: ${item.id} extras meshNodeTRS does not match body basis`);
  }
}

/**
 * @param {ArrayBuffer|Uint8Array} canonicalBodyBuffer
 * @param {Record<string, ArrayBuffer|Uint8Array>} fitsByItemId
 * @param {{ profileId: string, manifest: object, loadout?: { chest?: string|null, legs?: string|null, feet?: string|null } }} opts
 */
export async function composeLoadout(canonicalBodyBuffer, fitsByItemId, { profileId, manifest, loadout = {} } = {}) {
  const sourceBefore = canonicalBodyBuffer instanceof Uint8Array
    ? canonicalBodyBuffer.slice()
    : new Uint8Array(canonicalBodyBuffer).slice();
  try {
    return await composeLoadoutInner(canonicalBodyBuffer, fitsByItemId, { profileId, manifest, loadout });
  } finally {
    const after = canonicalBodyBuffer instanceof Uint8Array
      ? canonicalBodyBuffer
      : new Uint8Array(canonicalBodyBuffer);
    if (sourceBefore.length !== after.length || sourceBefore.some((b, i) => b !== after[i])) {
      throw new Error('composeLoadout mutated the canonical source buffer');
    }
  }
}

async function composeLoadoutInner(canonicalBodyBuffer, fitsByItemId, { profileId, manifest, loadout }) {
  if (!PLAYABLE_FIT_PROFILES.includes(profileId) || !STARTER_PROFILES[profileId]) {
    throw fitError(FIT_CODES.MISSING_FIT, `MISSING_FIT: unknown profile ${profileId}`);
  }
  parseFitManifest(manifest);
  const selected = normalizeLoadout(loadout);
  const canonicalCopy = asArrayBuffer(canonicalBodyBuffer);
  const bodySha = await fileSha256(canonicalCopy);
  const parsed = parseGlb(canonicalCopy);
  const profile = STARTER_PROFILES[profileId];
  const bodyNodeIndex = parsed.json.nodes.findIndex((n) => n.name === profile.bodyMesh);
  const bodyNode = bodyNodeIndex >= 0 ? parsed.json.nodes[bodyNodeIndex] : null;
  if (!bodyNode || bodyNode.mesh == null) {
    throw fitError(FIT_CODES.INVALID_FIT, `INVALID_FIT: missing body mesh ${profile.bodyMesh}`);
  }
  const bodyMesh = parsed.json.meshes[bodyNode.mesh];
  if (!bodyMesh?.primitives || bodyMesh.primitives.length !== 1) {
    throw fitError(FIT_CODES.UNSUPPORTED_FIT, 'UNSUPPORTED_FIT: schema1 coverage requires a single body primitive');
  }
  const bodyPrim = bodyMesh.primitives[0];
  const bind = await inspectBindContract(canonicalCopy);
  const geom = await sourceGeometrySignature(parsed.json, parsed.binary, bodyNode);
  const bodyTRS = meshNodeTRS(bodyNode);
  const indexCount = parsed.json.accessors[bodyPrim.indices].count;
  const parents = parentMap(parsed.json.nodes);
  const parentIndex = parents.get(bodyNodeIndex);
  if (parentIndex == null) throw fitError(FIT_CODES.INVALID_FIT, `INVALID_FIT: ${profile.bodyMesh} has no parent`);

  const prepared = [];
  for (const sel of selected) {
    const raw = fitsByItemId?.[sel.itemId];
    if (raw == null) {
      throw fitError(FIT_CODES.ASSET_MISMATCH, `ASSET_MISMATCH: no payload for ${sel.itemId}`);
    }
    const fitBuf = asArrayBuffer(raw);
    const { item, variant } = resolveFit(sel.itemId, profileId, {
      bindSignature: bind.signature,
      sourceGeometrySignature: geom,
    }, manifest);
    const sha = await fileSha256(fitBuf);
    if (sha !== variant.sha256) {
      throw fitError(FIT_CODES.ASSET_MISMATCH, `ASSET_MISMATCH: ${sel.itemId} payload hash ${sha} != ${variant.sha256}`);
    }
    const fit = parseGlb(fitBuf);
    const extras = fit.json.asset?.extras?.fit;
    validateFitExtras(extras, {
      item,
      profileId,
      bindSignature: bind.signature,
      sourceGeometrySignature: geom,
      sourceMesh: profile.bodyMesh,
      sourceSkin: bodyNode.skin,
      bodyTRS,
    });
    if (fit.json.skins?.length !== 1) {
      throw fitError(FIT_CODES.INVALID_FIT, 'INVALID_FIT: fit must have exactly one skin');
    }
    try {
      assertCopiedSkinBind(parsed.json, parsed.binary, fit.json, fit.binary);
    } catch (err) {
      throw fitError(FIT_CODES.INVALID_FIT, err.message || String(err));
    }
    const garmentNodeIndex = findGarmentNode(fit.json);
    const garmentNode = fit.json.nodes[garmentNodeIndex];
    if (garmentNode.skin !== 0) {
      throw fitError(FIT_CODES.INVALID_FIT, 'INVALID_FIT: garment node must use skins[0]');
    }
    if (!trsEqual(meshNodeTRS(garmentNode), bodyTRS)) {
      throw fitError(FIT_CODES.INVALID_FIT, `INVALID_FIT: ${item.id} garment local TRS does not match body basis`);
    }
    const mesh = fit.json.meshes[garmentNode.mesh];
    rejectUnsupportedFitMesh(mesh);
    for (const prim of mesh.primitives) {
      if (!fit.json.materials?.[prim.material]) throw fitError(FIT_CODES.INVALID_FIT, 'Missing fit material');
    }
    if (extras.coverage?.sourceMesh !== profile.bodyMesh) {
      throw fitError(FIT_CODES.INVALID_FIT, 'INVALID_FIT: coverage.sourceMesh mismatch');
    }
    validateCoverageOffsets(extras.coverage.triangleOffsets, indexCount);
    const jointsAttr = readAccessor(fit.json, fit.binary, mesh.primitives[0].attributes.JOINTS_0);
    const jointCount = fit.json.skins[0].joints.length;
    for (let i = 0; i < jointsAttr.length; i++) {
      if (jointsAttr[i] >= jointCount) {
        throw fitError(FIT_CODES.INVALID_FIT, 'INVALID_FIT: JOINTS_0 exceeds skin palette');
      }
    }
    prepared.push({ sel, item, extras, fit, mesh, garmentNode });
  }

  const worn = { chest: null, legs: null, feet: null };
  const resultManifest = {
    profile: profileId,
    loadout: worn,
    bindSignature: bind.signature,
    sourceGeometrySignature: geom,
    sourceBodySha256: bodySha,
    sourceMesh: profile.bodyMesh,
    sourceSkin: bodyNode.skin,
    components: [],
    coveredCount: 0,
    remainingCount: indexCount / 3,
    shortsHidden: false,
  };

  if (!prepared.length) {
    return { buffer: canonicalCopy, manifest: resultManifest };
  }

  const { json, binary } = parsed;
  const writer = glbWriter(json, binary);
  const covered = new Set();
  const materialIndex = new Map();
  const hideNames = new Set();

  for (const prep of prepared) {
    const { sel, item, extras, fit, mesh } = prep;
    worn[sel.slot] = item.id;
    const attributes = {};
    const srcAttrs = mesh.primitives[0].attributes;
    attributes.POSITION = appendFrom(writer, json, fit.json, fit.binary, srcAttrs.POSITION, ATTR_TYPES.POSITION, true);
    attributes.NORMAL = appendFrom(writer, json, fit.json, fit.binary, srcAttrs.NORMAL, ATTR_TYPES.NORMAL, false);
    attributes.TEXCOORD_0 = appendFrom(writer, json, fit.json, fit.binary, srcAttrs.TEXCOORD_0, ATTR_TYPES.TEXCOORD_0, false);
    attributes.JOINTS_0 = appendFrom(writer, json, fit.json, fit.binary, srcAttrs.JOINTS_0, ATTR_TYPES.JOINTS_0, false);
    attributes.WEIGHTS_0 = appendFrom(writer, json, fit.json, fit.binary, srcAttrs.WEIGHTS_0, ATTR_TYPES.WEIGHTS_0, false);

    const primitives = mesh.primitives.map((prim) => {
      const def = copyFitMaterial(fit.json.materials[prim.material], fit, writer, json);
      const key = materialKey(def);
      let material = materialIndex.get(key);
      if (material == null) {
        material = json.materials.length;
        json.materials.push(def);
        materialIndex.set(key, material);
      }
      return {
        attributes,
        indices: appendFrom(writer, json, fit.json, fit.binary, prim.indices, 'SCALAR', false),
        material,
      };
    });

    const meshIndex = json.meshes.length;
    const nodeName = `Fit_${item.id}`;
    json.meshes.push({ name: nodeName, primitives });
    const node = { ...copyLocalTransform(bodyNode), name: nodeName, mesh: meshIndex, skin: bodyNode.skin };
    const nodeIndex = json.nodes.length;
    json.nodes.push(node);
    const parent = json.nodes[parentIndex];
    parent.children = parent.children || [];
    parent.children.push(nodeIndex);

    for (const off of extras.coverage.triangleOffsets) covered.add(off);
    if (item.hideShorts) hideNames.add(profile.shortsNode);
    for (const name of extras.hideNodes || []) hideNames.add(name);

    const triCount = primitives.reduce((n, p) => n + json.accessors[p.indices].count / 3, 0);
    resultManifest.components.push({
      itemId: item.id,
      slot: item.slot,
      mesh: nodeName,
      node: nodeIndex,
      triangles: triCount,
      sourceTriangles: extras.coverage.triangleOffsets.length,
      hideNodes: [...(extras.hideNodes || [])],
    });
  }

  const srcIndices = readAccessor(json, binary, bodyPrim.indices);
  const remaining = [];
  for (let i = 0; i < srcIndices.length; i += 3) {
    if (!covered.has(i)) remaining.push(srcIndices[i], srcIndices[i + 1], srcIndices[i + 2]);
  }
  if (!remaining.length) throw fitError(FIT_CODES.COVERAGE_INVALID, `Coverage hid ${profile.bodyMesh}`);
  const Typed = srcIndices.constructor;
  bodyPrim.indices = writer.append(new Typed(remaining), 'SCALAR');

  let shortsHidden = false;
  for (const name of hideNames) {
    if (!hideNodeKeepIndex(json, name)) {
      throw fitError(FIT_CODES.INVALID_FIT, `INVALID_FIT: hideNodes target missing ${name}`);
    }
    if (name === profile.shortsNode) shortsHidden = true;
  }

  json.asset = json.asset || {};
  json.asset.extras = {
    ...(json.asset.extras || {}),
    loadout: { profile: profileId, items: resultManifest.components.map((c) => c.itemId) },
  };

  resultManifest.coveredCount = covered.size;
  resultManifest.remainingCount = remaining.length / 3;
  resultManifest.shortsHidden = shortsHidden;
  resultManifest.loadout = worn;

  return { buffer: writer.finish(), manifest: resultManifest };
}
