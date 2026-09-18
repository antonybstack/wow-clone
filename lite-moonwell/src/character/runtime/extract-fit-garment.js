/**
 * Extract one starter component into a compact standalone skinned GLB.
 * Joint palette order stays the source skin order; only node indices remap.
 */
import { inspectBindContract } from './bind-contract.js';
import { selectStarterComponents } from './compose-starter-outfit.js';
import { emptyGlbJson, glbWriter, parseGlb } from './glb.js';
import {
  COMPONENT_TO_ITEM,
  ITEM_TO_COMPONENT,
  STARTER_ITEMS,
  fitGlbUrl,
} from './garment-catalog.js';
import {
  FIT_ASSET_VERSION,
  FIT_SCHEMA_VERSION,
  SHAPE_IDENTITY,
  assertCopiedSkinBind,
  assertFactorMaterial,
  fileSha256,
  fitCacheKey,
  ibmHash,
  meshNodeTRS,
  sourceGeometrySignature,
  validateCoverageOffsets,
} from './fit-contract.js';

function asArrayBuffer(source) {
  if (source instanceof ArrayBuffer) return source;
  if (ArrayBuffer.isView(source)) return source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength);
  throw new Error('Expected ArrayBuffer');
}

function copyTransformNode(src) {
  const node = {};
  if (src.name != null) node.name = src.name;
  if (src.matrix) node.matrix = [...src.matrix];
  else {
    if (src.translation) node.translation = [...src.translation];
    if (src.rotation) node.rotation = [...src.rotation];
    if (src.scale) node.scale = [...src.scale];
  }
  return node;
}

function buildNeeded(json, skin, parentIndex) {
  const parents = new Map();
  for (let i = 0; i < json.nodes.length; i++) {
    for (const child of json.nodes[i].children || []) {
      if (parents.has(child)) throw new Error('Invalid node hierarchy');
      parents.set(child, i);
    }
  }
  const needed = new Set();
  const addChain = (index) => {
    let i = index;
    const seen = new Set();
    while (i !== undefined) {
      if (seen.has(i)) throw new Error('Cyclic node hierarchy');
      seen.add(i);
      needed.add(i);
      i = parents.get(i);
    }
  };
  for (const joint of skin.joints) addChain(joint);
  addChain(parentIndex);
  const scene = json.scenes[json.scene ?? 0];
  for (const root of scene?.nodes || []) addChain(root);
  return { needed, parents, scene };
}

/**
 * @param {ArrayBuffer|Uint8Array} source
 * @param {{ profileId: string, itemId?: string, componentId?: string }} opts
 */
export async function extractFitGarment(source, { profileId, itemId, componentId } = {}) {
  const resolvedItemId = itemId || COMPONENT_TO_ITEM[componentId];
  const item = STARTER_ITEMS[resolvedItemId];
  if (!item) throw new Error(`Unknown fit item ${resolvedItemId || componentId}`);
  const componentKey = ITEM_TO_COMPONENT[item.id];
  const sourceBuf = asArrayBuffer(source);
  const before = new Uint8Array(sourceBuf).slice();
  const bodyBind = await inspectBindContract(sourceBuf);
  const selected = selectStarterComponents(sourceBuf, { profile: profileId });
  const after = new Uint8Array(sourceBuf);
  if (before.length !== after.length || before.some((b, i) => b !== after[i])) {
    throw new Error('extractFitGarment mutated the source buffer');
  }
  const component = selected.components[componentKey];
  if (!component) throw new Error(`Missing component ${componentKey}`);
  for (const mat of component.materials) assertFactorMaterial(mat.def);
  validateCoverageOffsets(component.coverageOffsets, selected.indexCount);

  const { json, binary, skin, parentIndex, bodyNode, jointNames, ibm } = selected;
  const geomSig = await sourceGeometrySignature(json, binary, bodyNode);
  const bodySha = await fileSha256(sourceBuf);
  const ibmSig = await ibmHash(ibm);

  const { needed, scene } = buildNeeded(json, skin, parentIndex);
  if (needed.has(selected.bodyNodeIndex)) needed.delete(selected.bodyNodeIndex);

  const origIndices = [...needed].sort((a, b) => a - b);
  const origToNew = new Map(origIndices.map((orig, next) => [orig, next]));
  const out = emptyGlbJson();
  const writer = glbWriter(out, new Uint8Array(0));

  for (const orig of origIndices) {
    const node = copyTransformNode(json.nodes[orig]);
    const children = (json.nodes[orig].children || []).filter((c) => origToNew.has(c)).map((c) => origToNew.get(c));
    if (children.length) node.children = children;
    out.nodes.push(node);
  }

  const attributes = {
    POSITION: writer.append(component.tube.positions, 'VEC3', true),
    NORMAL: writer.append(component.tube.normals, 'VEC3'),
    TEXCOORD_0: writer.append(component.tube.uvs, 'VEC2'),
    JOINTS_0: writer.append(component.tube.joints, 'VEC4'),
    WEIGHTS_0: writer.append(component.tube.weights, 'VEC4'),
  };
  const primitives = component.materials.map((mat) => {
    assertFactorMaterial(mat.def);
    const material = out.materials.length;
    out.materials.push({
      name: mat.def.name,
      pbrMetallicRoughness: {
        baseColorFactor: [...mat.def.pbrMetallicRoughness.baseColorFactor],
        metallicFactor: mat.def.pbrMetallicRoughness.metallicFactor,
        roughnessFactor: mat.def.pbrMetallicRoughness.roughnessFactor,
      },
    });
    return { attributes, indices: writer.append(mat.indices, 'SCALAR'), material };
  });
  out.meshes.push({ name: component.meshName, primitives });

  const garment = copyTransformNode(bodyNode);
  garment.name = component.meshName;
  garment.mesh = 0;
  garment.skin = 0;
  const garmentIndex = out.nodes.length;
  const remappedParent = origToNew.get(parentIndex);
  if (remappedParent == null) throw new Error('Body parent was not copied into the fit GLB');
  const parentNode = out.nodes[remappedParent];
  parentNode.children = parentNode.children || [];
  parentNode.children.push(garmentIndex);
  out.nodes.push(garment);

  out.skins.push({
    name: skin.name,
    joints: skin.joints.map((i) => {
      const next = origToNew.get(i);
      if (next == null) throw new Error(`Skin joint ${i} missing from fit nodes`);
      return next;
    }),
    inverseBindMatrices: writer.append(ibm, 'MAT4'),
  });

  const sceneNodes = (scene?.nodes || []).filter((i) => origToNew.has(i)).map((i) => origToNew.get(i));
  if (!sceneNodes.length) throw new Error('Fit GLB has no scene root');
  out.scenes = [{ name: scene?.name, nodes: sceneNodes }];
  out.scene = 0;

  const hideNodes = item.hideShorts ? [selected.fit.shortsNode] : [];
  const extrasFit = {
    schema: FIT_SCHEMA_VERSION,
    itemId: item.id,
    slot: item.slot,
    profileId,
    version: FIT_ASSET_VERSION,
    shapeId: SHAPE_IDENTITY,
    bindSignature: bodyBind.signature,
    sourceGeometrySignature: geomSig,
    sourceBodySha256: bodySha,
    sourceMesh: selected.fit.bodyMesh,
    sourceSkin: selected.skinIndex,
    jointNames: [...jointNames],
    ibmHash: ibmSig,
    meshNodeTRS: meshNodeTRS(bodyNode),
    coverage: { sourceMesh: selected.fit.bodyMesh, triangleOffsets: [...component.coverageOffsets] },
    hideNodes,
    materials: out.materials.map((m) => ({
      name: m.name,
      baseColorFactor: m.pbrMetallicRoughness.baseColorFactor,
      roughness: m.pbrMetallicRoughness.roughnessFactor,
    })),
  };
  extrasFit.cacheKey = fitCacheKey({
    profileId,
    bindSignature: extrasFit.bindSignature,
    sourceGeometrySignature: extrasFit.sourceGeometrySignature,
    shapeId: extrasFit.shapeId,
    itemId: extrasFit.itemId,
    version: extrasFit.version,
  });
  out.asset.extras = { fit: extrasFit };

  const buffer = writer.finish();
  const parsed = parseGlb(buffer);
  if (parsed.json.animations?.length || parsed.json.images?.length || parsed.json.textures?.length || parsed.json.samplers?.length) {
    throw new Error('Fit GLB must not contain animations, images, textures, or samplers');
  }
  assertCopiedSkinBind(json, binary, parsed.json, parsed.binary);
  if (parsed.json.meshes.some((m) => /Body|Brows|Eyes|Hair|Shorts/i.test(m.name) && m.name !== component.meshName)) {
    throw new Error('Fit GLB contains an unrelated body mesh');
  }
  return {
    buffer,
    extras: extrasFit,
    item,
    glb: fitGlbUrl(item.id, profileId, FIT_ASSET_VERSION),
  };
}

export async function extractProfileFits(source, profileId) {
  const shirt = await extractFitGarment(source, { profileId, itemId: 'starterShirt' });
  const trousers = await extractFitGarment(source, { profileId, itemId: 'starterTrousers' });
  const boots = await extractFitGarment(source, { profileId, itemId: 'starterBoots' });
  return { starterShirt: shirt, starterTrousers: trousers, starterBoots: boots };
}
