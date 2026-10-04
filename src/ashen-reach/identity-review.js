/** Explicit DEV audition of the connected source, through the existing loader.
 * No new animation, skinning or material system; the native compact/full pack
 * owns meshes and their semantic coverage exactly as the released family does.
 * https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#skins
 */
import {startupAssetBuffer} from './startup-fetch.js';
import {DEFAULT_BOOT_GEAR} from './startup-appearance.js';
export async function loadIdentityReview(params) {
 const label=params.get('humanIdentity');
 if(!['old','young','young-hair'].includes(label))throw Error('Unknown Human identity audition');
 if(['preloadedEquipment','humanShape','humanHeight','humanHair','humanHead','creator','garmentFit','coveragePilot','plate'].some(key=>params.has(key)))
  throw Error('Use humanIdentity alone; adjust the body in the Armory.');
 const manifestUrl=`/__identity_review__/${label}/manifest.json`;
 const response=await fetch(manifestUrl);
 if(!response.ok)throw Error('Prepare the connected identity audition assets first.');
 const fullManifest=await response.json();
 if(fullManifest.identityReview?.label!==label||fullManifest.identityReview?.productionAcceptance!==false||!fullManifest.identityHoodReview||fullManifest.shapeFamily!=='ashen-human-shape-v1'||fullManifest.targetNames?.join('|')!=='slender|stout')
  throw Error('Unprepared or incompatible Human identity audition.');
 const manifest={...fullManifest,items:fullManifest.compactItems,fullManifest};
 for(const id of new Set(['body',...Object.values(DEFAULT_BOOT_GEAR).filter(id=>manifest.items[id])]))startupAssetBuffer(manifest.items[id]).catch(()=>{});
 return {label,manifest,manifestUrl,warning:'Identity audition: changes are temporary. Saved age and hair are still in development.'};
}
