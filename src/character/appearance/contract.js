/** Pure, versioned appearance vocabulary for the current playable catalogue.
 * `fitFamily` is the equipment fit ID, not a diagnostic BODY_PROFILES or asset profileId.
 * See the current glTF skinning contract for why bind/shape identity is explicit:
 * https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#skins
 */
import {EQUIPMENT_ITEMS, EQUIPMENT_SLOTS,LEGACY_EQUIPMENT_SLOTS,LEGACY_EQUIPMENT_ITEMS,EQUIPMENT_V3_ITEMS,EQUIPMENT_V6_ITEMS} from '../../ashen-reach/equipment-catalog.js';
import {declaredFitForRace, freezeEquipment, validateEquipmentSelection} from '../../ashen-reach/equipment-contract.js';
import {isDyeId} from '../../ashen-reach/dye-palette.js';
import {IDENTITY_CATALOG_VERSION,findHumanIdentityPreset} from './human-identity.js';

export const APPEARANCE_SCHEMA_VERSION=2;
/** v7 adds the M8 factory item `bastionShoulders`; every older catalogue keeps its exact item
 * domain. The wire handshake (`PRESENCE_CATALOG`) and the published remote-piece catalogue
 * compare against this value, so they refuse loudly until they are republished as v7. */
export const APPEARANCE_CATALOG_VERSION='appearance-catalog-v7';
export const MAX_APPEARANCE_BYTES=16*1024;
const TOP_FIELDS=['schemaVersion','catalogVersion','race','fitFamily','fit','shape','components','dyes','equipment'];
const FIT_FIELDS=['rig','bind','shape'];
const EMPTY_CAPABILITIES=Object.freeze({shape:Object.freeze([]),components:Object.freeze([]),dyes:Object.freeze([])});
/** Slots whose pieces pass through the loader's material-build window, which is the only place a
 * dye can be applied. The hand slots are excluded because a factory prop never reaches it, so
 * listing them would promise a colour the renderer cannot produce.
 * See results/m7-dye-mechanism-2026-10-03.md for why mutating a live material does nothing. */
const UNDYEABLE_SLOTS=Object.freeze(['mainHand','offHand']);
export const DYEABLE_SLOTS=Object.freeze(EQUIPMENT_SLOTS.filter(slot=>!UNDYEABLE_SLOTS.includes(slot)));
// M001's three playable fit identities are fixed for catalog v1. A later equipment-fit
// revision needs an explicit catalogue/version decision, not a silent recipe rewrite.
const V1_PROFILES=Object.freeze(Object.fromEntries([
  ['human','ashen-human'],['orc','ashen-orc'],['undead','ashen-undead'],
].map(([race,body])=>[race,Object.freeze({
  fit:Object.freeze({body,rig:'source-65',bind:1,shape:1}),capabilities:EMPTY_CAPABILITIES,
})])));
export const APPEARANCE_V1_REGISTRY=Object.freeze({
  schemaVersion:1, catalogVersion:'appearance-catalog-v1',
  profiles:V1_PROFILES, items:LEGACY_EQUIPMENT_ITEMS, slots:LEGACY_EQUIPMENT_SLOTS,
});
export const HUMAN_BUILD_LIMIT=0.95;
export const PRODUCTION_HUMAN_FAMILY='ashen-human-shape-v1';
export function neutralAppearanceShape(race,registry=APPEARANCE_REGISTRY) {
  return registry.schemaVersion===2 && race==='human'
    ? {family:PRODUCTION_HUMAN_FAMILY,height:1,build:0} : {};
}
export const APPEARANCE_V5_REGISTRY=Object.freeze({
  schemaVersion:APPEARANCE_SCHEMA_VERSION,
  catalogVersion:'appearance-catalog-v5',
  profiles:Object.freeze(Object.fromEntries(Object.entries(V1_PROFILES).map(([race,profile])=>[race,Object.freeze({...profile,
    capabilities:Object.freeze({
      shape:race==='human'?Object.freeze(['family','height','build']):Object.freeze([]),
      components:Object.freeze([]),
      // Every race can dye: the factor multiplies the piece's own texture and is independent of
      // the body it is fitted to.
      dyes:DYEABLE_SLOTS,
    })})]))),
  items:EQUIPMENT_V6_ITEMS,
  slots:EQUIPMENT_SLOTS,
});
/** The persisted v2 catalogue has exactly seven slots. It cannot accept future
 * item IDs or wider body domains merely because the current catalogue grows.
 */
export const APPEARANCE_V2_REGISTRY=Object.freeze({...APPEARANCE_V5_REGISTRY,catalogVersion:'appearance-catalog-v2',items:LEGACY_EQUIPMENT_ITEMS,slots:LEGACY_EQUIPMENT_SLOTS,
  profiles:Object.freeze(Object.fromEntries(Object.entries(APPEARANCE_V5_REGISTRY.profiles).map(([race,p])=>[race,Object.freeze({...p,
    capabilities:Object.freeze({...p.capabilities,dyes:Object.freeze([])})})])))});
export const APPEARANCE_V3_REGISTRY=Object.freeze({...APPEARANCE_V5_REGISTRY,catalogVersion:'appearance-catalog-v3',items:EQUIPMENT_V3_ITEMS,
  profiles:Object.freeze(Object.fromEntries(Object.entries(APPEARANCE_V5_REGISTRY.profiles).map(([race,p])=>[race,Object.freeze({...p,
    capabilities:Object.freeze({...p.capabilities,dyes:Object.freeze([])})})])))});
/** v4 is the last catalogue without dyes. It is kept whole, rather than reconstructed, so a saved
 * v4 recipe is read and upgraded instead of refused -- the same shape as the v1-v2-v3 chain. */
export const APPEARANCE_V4_REGISTRY=Object.freeze({...APPEARANCE_V5_REGISTRY,catalogVersion:'appearance-catalog-v4',
  profiles:APPEARANCE_V3_REGISTRY.profiles});
/** v6: authored Human identities share the released clothing bind and shape domain.
 * Historical registries remain independently closed to head/hair identifiers.
 * IDENTITY_CATALOG_VERSION stays 'appearance-catalog-v6' on purpose: it also stamps the
 * published identity pack index, and v7 is an equipment-only change that does not regenerate it.
 */
export const APPEARANCE_V6_REGISTRY=Object.freeze({...APPEARANCE_V5_REGISTRY,
 catalogVersion:IDENTITY_CATALOG_VERSION,
 profiles:Object.freeze(Object.fromEntries(Object.entries(APPEARANCE_V5_REGISTRY.profiles).map(([race,p])=>[race,Object.freeze({...p,
  capabilities:Object.freeze({...p.capabilities,components:race==='human'?Object.freeze(['head','hair']):Object.freeze([])}),
 })]))),
});
/** v7: v6 identities, shape and dye domains unchanged, plus the current item map. Profiles are
 * shared with v6 by identity, so no capability can drift between the two.
 */
export const APPEARANCE_V7_REGISTRY=Object.freeze({...APPEARANCE_V6_REGISTRY,
 catalogVersion:APPEARANCE_CATALOG_VERSION,items:EQUIPMENT_ITEMS});
/** v1–v6 never inherit identity capabilities or items when the current catalogue advances.
 * `APPEARANCE_IDENTITY_REGISTRY` remains the name existing importers use for "current".
 */
export const APPEARANCE_IDENTITY_REGISTRY=APPEARANCE_V7_REGISTRY;
export const APPEARANCE_REGISTRY=APPEARANCE_V7_REGISTRY;

export class AppearanceError extends Error {
  constructor(code,path,message){super(`${message} at ${path}`);this.name='AppearanceError';this.code=code;this.path=path;}
}
const error=(code,path,message)=>{throw new AppearanceError(code,path,message);};
const safePath=(path,key)=>typeof key==='string' && /^[A-Za-z_][A-Za-z0-9_]{0,63}$/.test(key)?`${path}.${key}`:path;

/** Reject prototype tricks and accessors before reading any untrusted property. */
export function assertPlainRecord(value,path) {
  if(value===null || typeof value!=='object' || Array.isArray(value) || Object.getPrototypeOf(value)!==Object.prototype) error('INVALID_TYPE',path,'Expected a plain object');
  for(const key of Reflect.ownKeys(value)) {
    if(typeof key!=='string') error('UNKNOWN_FIELD',path,'Symbol fields are unsupported');
    if(['__proto__','constructor','prototype'].includes(key)) error('FORBIDDEN_FIELD',safePath(path,key),'Forbidden field');
    const descriptor=Object.getOwnPropertyDescriptor(value,key);
    if(!descriptor?.enumerable || !Object.hasOwn(descriptor,'value')) error('INVALID_FIELD',safePath(path,key),'Accessor or hidden field is unsupported');
  }
}
export function assertFields(value,allowed,path,{complete=true,unknownCode='UNKNOWN_FIELD'}={}) {
  assertPlainRecord(value,path);
  for(const key of Object.keys(value)) if(!allowed.includes(key)) error(unknownCode,safePath(path,key),'Unsupported field');
  if(complete) for(const key of allowed) if(!Object.hasOwn(value,key)) error('MISSING_FIELD',`${path}.${key}`,'Required field is missing');
}
function validateEmptyParameters(value,path) {
  assertPlainRecord(value,path);
  for(const key of Object.keys(value)) {
    const field=safePath(path,key);
    if(typeof value[key]==='number' && !Number.isFinite(value[key])) error('INVALID_VALUE',field,'Non-finite number');
    error('UNSUPPORTED_PARAMETER',field,'Parameter is not supported by this catalogue');
  }
}
function validateComponents(value,profile) {
 const path='$.components';
 if(!profile.capabilities.components.length){validateEmptyParameters(value,path);return {};}
 assertFields(value,['head','hair'],path,{complete:false,unknownCode:'UNSUPPORTED_PARAMETER'});
 if(!Object.keys(value).length)return {};
 for(const key of ['head','hair']){
  if(!Object.hasOwn(value,key))error('MISSING_FIELD',`${path}.${key}`,'An authored identity needs both head and hair');
  if(typeof value[key]!=='string')error('INVALID_TYPE',`${path}.${key}`,'Component value must be an identifier');
 }
 const preset=findHumanIdentityPreset(value);
 if(!preset)error('UNSUPPORTED_IDENTITY',path,'Head and hair do not form a reviewed identity preset');
 // Preserve existing canonical recipe bytes and semantic cache keys for the
 // starter. Explicit selection and an absent selection have the same identity.
 return preset.id==='starter'?{}:{...preset.components};
}
/** Dyes are keyed by SLOT, not by item id.
 *
 * The recipe already states which item fills each slot, so keying by item would be a second
 * source of truth that could disagree with the first. An explicit `undyed` is dropped rather
 * than stored, so a neutral choice and an absent one cannot encode two different ways.
 */
function validateDyes(value,equipment,profile,registry) {
  const path='$.dyes';
  const allowed=profile.capabilities.dyes;
  if(allowed.length===0) { validateEmptyParameters(value,path); return {}; }
  assertFields(value,[...allowed],path,{complete:false,unknownCode:'UNSUPPORTED_PARAMETER'});
  const normalized={};
  for(const slot of Object.keys(value)) {
    const field=safePath(path,slot);
    const id=value[slot];
    if(typeof id!=='string') error('INVALID_TYPE',field,'Dye value must be a dye id');
    if(!isDyeId(id)) error('INVALID_VALUE',field,'Unknown dye');
    // A dye on an empty slot would survive a piece being removed and silently re-apply to
    // whatever is equipped next.
    if(!equipment[slot]) error('INVALID_VALUE',field,'Dye on an empty slot');
    if(id!=='undyed') normalized[slot]=id;
  }
  return normalized;
}
function validateEquipment(value,race,profile,registry) {
  const path='$.equipment';
  assertFields(value,registry.slots,path);
  const normalized={};
  for(const slot of registry.slots) {
    const id=value[slot];
    if(id!==null && typeof id!=='string') error('INVALID_TYPE',`${path}.${slot}`,'Equipment value must be an item ID or null');
    if(id!==null) {
      const item=Object.hasOwn(registry.items,id)?registry.items[id]:null;
      if(!item || item.slot!==slot) error('UNSUPPORTED_ITEM',`${path}.${slot}`,'Unknown item or wrong slot');
      let declared;
      try{declared=declaredFitForRace(item,race);}catch{error('UNSUPPORTED_ITEM_FIT',`${path}.${slot}`,'Item has no declared race fit');}
      const expected=profile.fit;
      if(['body','rig','bind','shape'].some(key=>declared[key]!==expected[key])) error('UNSUPPORTED_ITEM_FIT',`${path}.${slot}`,'Item fit differs from race profile');
    }
    normalized[slot]=id;
  }
  try{validateEquipmentSelection(normalized,registry.items,registry.slots);}
  catch(e){
    const occupied=/Equipment conflict in ([A-Za-z]+)/.exec(e.message)?.[1];
    error('EQUIPMENT_CONFLICT',occupied?`${path}.${occupied}`:path,'Equipment occupancy conflict');
  }
  return normalized;
}

/** Return a canonical immutable copy; never mutate or retain the caller's objects. */
export function validateAppearance(input,registry=APPEARANCE_REGISTRY) {
  assertFields(input,TOP_FIELDS,'$');
  if(input.schemaVersion!==registry.schemaVersion) error('UNSUPPORTED_SCHEMA','$.schemaVersion','Unsupported schema version');
  if(input.catalogVersion!==registry.catalogVersion) error('UNSUPPORTED_CATALOG','$.catalogVersion','Unsupported catalogue version');
  if(typeof input.race!=='string' || !Object.hasOwn(registry.profiles,input.race)) error('UNSUPPORTED_RACE','$.race','Unsupported race');
  const profile=registry.profiles[input.race];
  if(input.fitFamily!==profile.fit.body) error('FIT_MISMATCH','$.fitFamily','Fit family differs from race');
  assertFields(input.fit,FIT_FIELDS,'$.fit');
  for(const key of FIT_FIELDS) if(input.fit[key]!==profile.fit[key]) error('FIT_MISMATCH',`$.fit.${key}`,'Fit version differs from race');
  if(registry.schemaVersion===2 && input.race==='human') {
    assertFields(input.shape,['family','height','build'],'$.shape');
    if(input.shape.family!==PRODUCTION_HUMAN_FAMILY) error('FIT_MISMATCH','$.shape.family','Unsupported shape family');
    for(const [key,min,max] of [['height',0.9,1.15],['build',-HUMAN_BUILD_LIMIT,HUMAN_BUILD_LIMIT]]) {
      const value=input.shape[key];
      if(typeof value!=='number' || !Number.isFinite(value)) error('INVALID_VALUE',`$.shape.${key}`,'Expected a finite number');
      if(value<min || value>max) error('OUT_OF_RANGE',`$.shape.${key}`,'Value exceeds the reviewed domain');
    }
  } else validateEmptyParameters(input.shape,'$.shape');
  const components=validateComponents(input.components,profile);
  const equipment=validateEquipment(input.equipment,input.race,profile,registry);
  // Dyes are validated after equipment, because a dye is only meaningful against the slot it
  // sits on and the slot has to be known to be filled.
  const dyes=validateDyes(input.dyes,equipment,profile,registry);
  return freezeEquipment({
    schemaVersion:registry.schemaVersion,
    catalogVersion:registry.catalogVersion,
    race:input.race,
    fitFamily:profile.fit.body,
    fit:{rig:profile.fit.rig,bind:profile.fit.bind,shape:profile.fit.shape},
    shape:registry.schemaVersion===2 && input.race==='human'
      ? {family:input.shape.family,height:input.shape.height,build:input.shape.build} : {},
    components,dyes,equipment,
  });
}

/** Explicit migration; unknown versions/catalogues are never guessed or silently clamped. */
export function migrateAppearance(input,registry=APPEARANCE_REGISTRY) {
  assertPlainRecord(input,'$');
  if(![1,2].includes(input.schemaVersion))error('UNSUPPORTED_SCHEMA','$.schemaVersion','Unsupported schema version');
  if(input.schemaVersion===registry.schemaVersion && input.catalogVersion===registry.catalogVersion) return validateAppearance(input,registry);
  // One allowlist drives storage and direct migration. The previous decoder
  // duplicated it and omitted v4, turning a valid saved character into fallback.
  const legacy=[APPEARANCE_V1_REGISTRY,APPEARANCE_V2_REGISTRY,APPEARANCE_V3_REGISTRY,APPEARANCE_V4_REGISTRY,APPEARANCE_V5_REGISTRY,APPEARANCE_V6_REGISTRY]
    .find(r=>r.schemaVersion===input.schemaVersion&&r.catalogVersion===input.catalogVersion);
  if(!legacy)error('UNSUPPORTED_CATALOG','$.catalogVersion','No known migration for this schema and catalogue');
  if(registry!==APPEARANCE_REGISTRY&&registry!==APPEARANCE_IDENTITY_REGISTRY)
    error('UNSUPPORTED_CATALOG','$.catalogVersion','Only the production or candidate catalogue can receive migrations');
  const old=validateAppearance(input,legacy);
  return validateAppearance({...old,schemaVersion:registry.schemaVersion,catalogVersion:registry.catalogVersion,
    shape:old.schemaVersion===1?neutralAppearanceShape(old.race,registry):old.shape,
    equipment:legacy.slots.includes('shoulders')?old.equipment:{...old.equipment,shoulders:null},
  },registry);
}
/** glTF targets are additive; production uses exactly one signed axis, not two competing deltas.
 * https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#morph-targets
 */
export function appearanceShapeWeights(recipe) {
  const valid=validateAppearance(recipe),b=valid.shape.build || 0;
  return [Math.max(0,-b),Math.max(0,b)];
}
