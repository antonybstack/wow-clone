/** Share the existing migration/validation result with the early HTML entry.
 * No hand-written storage decoder and no asset URLs sourced from storage.
 * https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules#dynamic_module_loading
 */
let savedAppearanceTask;
export const DEFAULT_BOOT_GEAR=Object.freeze({helmet:null,torso:'wayfarerTunic',legs:'wayfarerTrousers',boots:'wayfarerBoots',gloves:null,mainHand:'ironSword',offHand:null,shoulders:null});
export function usesHumanShapeStarter(appearance) {
  return appearance?.race==='human' && (appearance.shape.build!==0 || appearance.shape.height!==1 || Object.entries(DEFAULT_BOOT_GEAR).some(([key,id])=>appearance.equipment[key]!==id));
}
export function permitsSavedAppearance(params) {
  return !['preloadedEquipment','humanShape','humanHeight','humanHair','humanHead','humanIdentity','plate','creator','garmentFit'].some(key=>params.has(key));
}
export function loadStartupAppearance(params) {
  if(!permitsSavedAppearance(params))return Promise.resolve(null);
  let saved=false;
  try{saved=['ashen.appearance.v2','ashen.appearance.v1','ashen.creator.v1'].some(key=>Boolean(localStorage.getItem(key)));}catch{}
  if(!saved)return Promise.resolve(null);
  return savedAppearanceTask ??= import('../character/appearance/store.js').then(api=>({api,loaded:api.loadAppearance()})).catch(error=>{savedAppearanceTask=null;throw error;});
}
