/**
 * Logical starter garment items. Variant URLs and signatures come from the
 * baked manifest — this module does not invent bind/geometry hashes.
 */
import { FIT_ASSET_VERSION, FIT_CODES, FIT_SCHEMA_VERSION, SHAPE_IDENTITY, fitCacheKey, fitError } from './fit-contract.js';

export const PLAYABLE_FIT_PROFILES = Object.freeze(['human-v1', 'orc-v1', 'undead-v1']);

export const STARTER_ITEM_IDS = Object.freeze(['starterShirt', 'starterTrousers', 'starterBoots']);

export const COMPONENT_TO_ITEM = Object.freeze({
  shirt: 'starterShirt',
  trousers: 'starterTrousers',
  boots: 'starterBoots',
});

export const ITEM_TO_COMPONENT = Object.freeze({
  starterShirt: 'shirt',
  starterTrousers: 'trousers',
  starterBoots: 'boots',
});

/** @type {Readonly<Record<string, object>>} */
export const STARTER_ITEMS = Object.freeze({
  mageCoat: Object.freeze({
    id: 'mageCoat', slot: 'chest', renderClass: 'skinned-garment', layer: 'clothing',
    covers: Object.freeze(['torso','upperArmL','upperArmR','lowerArmL','lowerArmR']),
    conflictsWith: Object.freeze(['starterShirt','mageCoat']), component: 'shirt', meshName: 'MageCoat', hideShorts: false,
  }),
  mageBoots: Object.freeze({
    id: 'mageBoots', slot: 'feet', renderClass: 'skinned-garment', layer: 'clothing',
    covers: Object.freeze(['footL','footR']), conflictsWith: Object.freeze(['starterBoots','mageBoots']),
    component: 'boots', meshName: 'MageBoots', hideShorts: false,
  }),
  starterShirt: Object.freeze({
    id: 'starterShirt',
    slot: 'chest',
    renderClass: 'skinned-garment',
    layer: 'clothing',
    covers: Object.freeze(['torso', 'upperArmL', 'upperArmR', 'lowerArmL', 'lowerArmR']),
    conflictsWith: Object.freeze(['starterShirt']),
    component: 'shirt',
    meshName: 'StarterShirt',
    hideShorts: false,
  }),
  starterTrousers: Object.freeze({
    id: 'starterTrousers',
    slot: 'legs',
    renderClass: 'skinned-garment',
    layer: 'clothing',
    covers: Object.freeze(['pelvis', 'thighL', 'thighR', 'calfL', 'calfR']),
    conflictsWith: Object.freeze(['starterTrousers']),
    component: 'trousers',
    meshName: 'StarterTrousers',
    hideShorts: true,
  }),
  starterBoots: Object.freeze({
    id: 'starterBoots',
    slot: 'feet',
    renderClass: 'skinned-garment',
    layer: 'clothing',
    covers: Object.freeze(['footL', 'footR']),
    conflictsWith: Object.freeze(['starterBoots']),
    component: 'boots',
    meshName: 'StarterBoots',
    hideShorts: false,
  }),
});

export function fitGlbRel(itemId, profileId, version = FIT_ASSET_VERSION) {
  return `${itemId}.${profileId}.v${version}.glb`;
}

export function fitGlbUrl(itemId, profileId, version = FIT_ASSET_VERSION) {
  return `/characters/garments/${fitGlbRel(itemId, profileId, version)}`;
}

export function parseFitManifest(json) {
  if (!json || json.schema !== FIT_SCHEMA_VERSION) {
    throw new Error(`Unsupported fit manifest schema ${json?.schema}`);
  }
  return json;
}

function nonemptyString(value) {
  return typeof value === 'string' && value.length > 0;
}

/**
 * Validating resolver: both bindSignature and sourceGeometrySignature are required
 * nonempty strings. Lookup without a contract is a separate API; this one fails closed.
 * @param {string} itemId
 * @param {string} profileId
 * @param {{ bindSignature?: string, sourceGeometrySignature?: string }} [contract]
 * @param {object} manifest baked starter-fits.v1.json
 */
export function resolveFit(itemId, profileId, contract = {}, manifest) {
  if (!Object.hasOwn(STARTER_ITEMS, itemId)) {
    throw fitError(FIT_CODES.UNKNOWN_ITEM, `UNKNOWN_ITEM: ${itemId}`);
  }
  if (!PLAYABLE_FIT_PROFILES.includes(profileId)) {
    throw fitError(FIT_CODES.MISSING_FIT, `MISSING_FIT: no variant for ${itemId} on ${profileId}`);
  }
  const variant = manifest?.items?.[itemId]?.variants?.[profileId];
  if (!variant) {
    throw fitError(FIT_CODES.MISSING_FIT, `MISSING_FIT: no variant for ${itemId} on ${profileId}`);
  }
  if (!nonemptyString(contract?.bindSignature) || !nonemptyString(contract?.sourceGeometrySignature)) {
    throw fitError(
      FIT_CODES.INVALID_CONTRACT,
      `INVALID_CONTRACT: resolveFit requires nonempty bindSignature and sourceGeometrySignature for ${itemId} on ${profileId}`,
    );
  }
  if (manifest.schema !== FIT_SCHEMA_VERSION) {
    throw fitError(FIT_CODES.INVALID_FIT, `INVALID_FIT: manifest schema ${manifest.schema} is not ${FIT_SCHEMA_VERSION}`);
  }
  if (
    variant.profileId !== profileId
    || variant.shapeId !== SHAPE_IDENTITY
    || variant.version !== FIT_ASSET_VERSION
    || !nonemptyString(variant.bindSignature)
    || !nonemptyString(variant.sourceGeometrySignature)
  ) {
    throw fitError(
      FIT_CODES.INVALID_FIT,
      `INVALID_FIT: ${itemId} ${profileId} variant metadata is malformed`,
    );
  }
  if (variant.bindSignature !== contract.bindSignature) {
    throw fitError(
      FIT_CODES.BIND_MISMATCH,
      `BIND_MISMATCH: ${itemId} ${profileId} expected ${variant.bindSignature} got ${contract.bindSignature}`,
    );
  }
  if (variant.sourceGeometrySignature !== contract.sourceGeometrySignature) {
    throw fitError(
      FIT_CODES.GEOMETRY_MISMATCH,
      `GEOMETRY_MISMATCH: ${itemId} ${profileId} source geometry does not match this body`,
    );
  }
  return { item: STARTER_ITEMS[itemId], variant };
}

export { FIT_ASSET_VERSION, FIT_SCHEMA_VERSION, SHAPE_IDENTITY, fitCacheKey };
