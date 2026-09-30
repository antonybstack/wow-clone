/** Pure, versioned appearance vocabulary for the current playable catalogue.
 * `fitFamily` is the equipment fit ID, not a diagnostic BODY_PROFILES or asset profileId.
 * See the current glTF skinning contract for why bind/shape identity is explicit:
 * https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#skins
 */
import {EQUIPMENT_ITEMS, EQUIPMENT_SLOTS} from '../../ashen-reach/equipment-catalog.js';
import {declaredFitForRace, freezeEquipment, validateEquipmentSelection} from '../../ashen-reach/equipment-contract.js';

export const APPEARANCE_SCHEMA_VERSION=2;
export const APPEARANCE_CATALOG_VERSION='appearance-catalog-v2';
export const MAX_APPEARANCE_BYTES=16*1024;
const TOP_FIELDS=['schemaVersion','catalogVersion','race','fitFamily','fit','shape','components','dyes','equipment'];
const FIT_FIELDS=['rig','bind','shape'];
const EMPTY_CAPABILITIES=Object.freeze({shape:Object.freeze([]),components:Object.freeze([]),dyes:Object.freeze([])});
// M001's three playable fit identities are fixed for catalog v1. A later equipment-fit
// revision needs an explicit catalogue/version decision, not a silent recipe rewrite.
const V1_PROFILES=Object.freeze(Object.fromEntries([
  ['human','ashen-human'],['orc','ashen-orc'],['undead','ashen-undead'],
].map(([race,body])=>[race,Object.freeze({
  fit:Object.freeze({body,rig:'source-65',bind:1,shape:1}),capabilities:EMPTY_CAPABILITIES,
})])));
export const APPEARANCE_V1_REGISTRY=Object.freeze({
  schemaVersion:1, catalogVersion:'appearance-catalog-v1',
  profiles:V1_PROFILES, items:EQUIPMENT_ITEMS, slots:EQUIPMENT_SLOTS,
});
export const HUMAN_BUILD_LIMIT=0.95;
export const PRODUCTION_HUMAN_FAMILY='ashen-human-shape-v1';
export function neutralAppearanceShape(race,registry=APPEARANCE_REGISTRY) {
  return registry.schemaVersion===2 && race==='human'
    ? {family:PRODUCTION_HUMAN_FAMILY,height:1,build:0} : {};
}
export const APPEARANCE_REGISTRY=Object.freeze({
  schemaVersion:APPEARANCE_SCHEMA_VERSION,
  catalogVersion:APPEARANCE_CATALOG_VERSION,
  profiles:Object.freeze({...V1_PROFILES,human:Object.freeze({...V1_PROFILES.human,
    capabilities:Object.freeze({shape:Object.freeze(['family','height','build']),components:Object.freeze([]),dyes:Object.freeze([])})})}),
  items:EQUIPMENT_ITEMS,
  slots:EQUIPMENT_SLOTS,
});

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
  for(const field of ['components','dyes']) validateEmptyParameters(input[field],`$.${field}`);
  const equipment=validateEquipment(input.equipment,input.race,profile,registry);
  return freezeEquipment({
    schemaVersion:registry.schemaVersion,
    catalogVersion:registry.catalogVersion,
    race:input.race,
    fitFamily:profile.fit.body,
    fit:{rig:profile.fit.rig,bind:profile.fit.bind,shape:profile.fit.shape},
    shape:registry.schemaVersion===2 && input.race==='human'
      ? {family:input.shape.family,height:input.shape.height,build:input.shape.build} : {},
    components:{},dyes:{},equipment,
  });
}

/** Explicit migration; unknown versions/catalogues are never guessed or silently clamped. */
export function migrateAppearance(input) {
  assertPlainRecord(input,'$');
  if(input.schemaVersion===APPEARANCE_SCHEMA_VERSION) return validateAppearance(input);
  const old=validateAppearance(input,APPEARANCE_V1_REGISTRY);
  return validateAppearance({...old,schemaVersion:APPEARANCE_SCHEMA_VERSION,
    catalogVersion:APPEARANCE_CATALOG_VERSION,shape:neutralAppearanceShape(old.race)});
}
/** glTF targets are additive; production uses exactly one signed axis, not two competing deltas.
 * https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#morph-targets
 */
export function appearanceShapeWeights(recipe) {
  const valid=validateAppearance(recipe),b=valid.shape.build || 0;
  return [Math.max(0,-b),Math.max(0,b)];
}
