import {emptyExploration,validateExploration} from './exploration-state.js';
export const EXPLORATION_STORAGE_KEY='ashen.exploration.v1';
export const EXPLORATION_RECOVERY_KEY='ashen.exploration.recovery';
const MAX_CHARS=16384;
export function explorationStorage(){try{return globalThis.localStorage??null;}catch{return null;}}
export function decodeExploration(text){
 if(typeof text!=='string'||text.length>MAX_CHARS)throw Error('Journal exceeds its supported size');
 return validateExploration(JSON.parse(text));
}
export function loadExploration({storage=explorationStorage()}={}){
 try{
  const text=storage?.getItem(EXPLORATION_STORAGE_KEY);
  return {record:text==null?emptyExploration():decodeExploration(text),restored:text!=null,
   warning:storage?null:'Saving is unavailable; discoveries last for this session.'};
 }catch{return {record:emptyExploration(),restored:false,warning:'Saved journal could not be restored. Its original record is retained; discoveries may last only for this session.'};}
}
/** Backup an unsupported/corrupt record before replacement; quota failure never
 * erases it. Browser storage may throw even when the getter succeeds.
 * https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage */
export function saveExploration(record,{storage=explorationStorage()}={}){
 const text=JSON.stringify(validateExploration(record));
 if(!storage)return false;
 try{
  const old=storage.getItem(EXPLORATION_STORAGE_KEY);
  if(old!=null)try{decodeExploration(old);}catch{storage.setItem(EXPLORATION_RECOVERY_KEY,old);}
  storage.setItem(EXPLORATION_STORAGE_KEY,text);return true;
 }catch{return false;}
}
