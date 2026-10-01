/** One committed body/race/equipment recipe. Storage failures never prevent play.
 * Invalid legacy data is retained; supported single-axis v1 creator states migrate exactly.
 * https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage
 */
import {APPEARANCE_V1_REGISTRY,migrateAppearance,validateAppearance,assertFields,AppearanceError,HUMAN_BUILD_LIMIT} from './contract.js';
import {appearanceFromEquipment} from './from-equipment.js';
import {encodeAppearance,decodeAppearance,decodeMigratingAppearance} from './codec.js';
import {EQUIPMENT_PRESETS} from '../../ashen-reach/equipment-catalog.js';
export const APPEARANCE_STORAGE_KEY='ashen.appearance.v2';
export const APPEARANCE_RECOVERY_KEY='ashen.appearance.recovery';
export const LEGACY_CREATOR_KEY='ashen.creator.v1';
export const LEGACY_APPEARANCE_KEY='ashen.appearance.v1';
export function appearanceStorage() {try{return globalThis.localStorage || null;}catch{return null;}}
export const defaultAppearance=(race='human')=>appearanceFromEquipment({race,loadout:EQUIPMENT_PRESETS.wayfarer.loadout});
export function migrateLegacyCreator(record,base=defaultAppearance()) {
  assertFields(record,['schemaVersion','race','controls'],'$');
  if(record.schemaVersion!==1)throw new AppearanceError('UNSUPPORTED_SCHEMA','$.schemaVersion','Unsupported creator schema');
  if(record.race!==base.race)throw new AppearanceError('RACE_MISMATCH','$.race','Creator and appearance races differ');
  if(record.race!=='human') {assertFields(record.controls,[],'$.controls');return base;}
  assertFields(record.controls,['height','build'],'$.controls');
  assertFields(record.controls.build,['slender','stout'],'$.controls.build');
  const {slender,stout}=record.controls.build;
  for(const n of [slender,stout])if(typeof n!=='number'||!Number.isFinite(n)||n<0||n>HUMAN_BUILD_LIMIT)throw new AppearanceError('OUT_OF_RANGE','$.controls.build','Legacy build is outside the reviewed domain');
  if(slender>0&&stout>0)throw new AppearanceError('UNSUPPORTED_BLEND','$.controls.build','Two-axis legacy blends need review; the original record is retained');
  return validateAppearance({...base,shape:{...base.shape,height:record.controls.height,build:stout || -slender || 0}});
}
export function loadAppearance({storage=appearanceStorage()}={}) {
  const fallback=defaultAppearance();
  try {
    const text=storage?.getItem(APPEARANCE_STORAGE_KEY);
    if(text!==null && text!==undefined) {
      // Reuse bounded decoding. Migration also validates schema/catalogue and plain records.
      const old=decodeMigratingAppearance(text);
      return {appearance:old,restored:true,migrated:text!==encodeAppearance(old),warning:null};
    }
    const oldRecipe=storage?.getItem(LEGACY_APPEARANCE_KEY);
    if(oldRecipe!==null && oldRecipe!==undefined) {
      return {appearance:migrateAppearance(decodeAppearance(oldRecipe,APPEARANCE_V1_REGISTRY)),restored:true,migrated:true,warning:null};
    }
    const legacy=storage?.getItem(LEGACY_CREATOR_KEY);
    if(legacy!==null && legacy!==undefined) {
      if(legacy.length>16384)throw Error('Legacy record is too large');
      const record=JSON.parse(legacy);
      return {appearance:migrateLegacyCreator(record,defaultAppearance(record.race)),restored:true,migrated:true,warning:null};
    }
    return {appearance:fallback,restored:false,migrated:false,warning:storage?null:'Saving is unavailable; changes last for this session.'};
  } catch(error) {return {appearance:fallback,restored:false,migrated:false,warning:`Saved appearance could not be restored (${error.code || error.message}). The original record is retained.`};}
}
export function saveAppearance(recipe,{storage=appearanceStorage()}={}) {
  const text=encodeAppearance(recipe);
  if(!storage)return false;
  try {
    const old=storage.getItem(APPEARANCE_STORAGE_KEY);
    if(old!==null)try{decodeMigratingAppearance(old);}catch{
      // Back up before overwriting a corrupt/unknown current record. If recovery cannot be
      // stored, retain it and keep this session playable without claiming persistence.
      storage.setItem(APPEARANCE_RECOVERY_KEY,old);
    }
    storage.setItem(APPEARANCE_STORAGE_KEY,text);return true;
  }catch{return false;}
}
export function appearanceFromLegacyRecipe(input) {return migrateAppearance(input);}
