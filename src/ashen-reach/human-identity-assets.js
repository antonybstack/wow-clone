/** Optional selected-identity descriptors; default startup never imports this graph.
 * All identifiers originate in the validated recipe, all URLs in the sealed pack.
 * Share native fetch/decompression promises with equipment and early preload.
 * https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules#dynamic_module_loading
 */
import {startupAssetBuffer,preloadHumanShapePack,preloadHumanIdentityCatalogue,invalidateHumanIdentityCatalogue} from './startup-fetch.js';
import {findHumanIdentityPreset} from '../character/appearance/human-identity.js';
import {manifestBodyCoverage} from './coverage-manifest.js';
import {compactStarterIdentity} from './starter-identity-policy.js';
import {EQUIPMENT_ITEMS} from './equipment-catalog.js';
import {selectedEquipmentResources} from './equipment-resources.js';
let indexTask;
async function loadIndex(){
 const index=await preloadHumanIdentityCatalogue(),expected=import.meta.env?.VITE_HUMAN_IDENTITY_SOURCE;
 if(expected&&index.provenance?.sha256!==expected)throw Error('Human identities have changed. Reload to use matching assets.');
 if(index.schema!==1||index.catalogVersion!=='appearance-catalog-v6'||index.shapeFamily!=='ashen-human-shape-v1'||index.targetNames?.join('|')!=='slender|stout')throw Error('Incompatible Human identity catalogue');
 return index;
}
export async function preloadHumanIdentityPack(components,loadout={}, {compact=false,deferCoveredHair=import.meta.env?.VITE_DEFER_COVERED_HAIR==='1'}={}){
 const preset=findHumanIdentityPreset(components);
 if(!preset)throw Error('Unsupported Human identity');
 if(!preset.sourceLabel)return preloadHumanShapePack(loadout,{compact});
 const index=await(indexTask??=loadIndex().catch(error=>{indexTask=null;invalidateHumanIdentityCatalogue();throw error;}));
 const entry=index.presets[preset.id],full=entry?.manifest;
 if(full?.identity?.preset!==preset.id||full.fitId!=='ashen-human'||full.shapeFamily!==index.shapeFamily||full.targetNames?.join('|')!=='slender|stout'||JSON.stringify(full.identity.components)!==JSON.stringify(preset.components))throw Error('Identity descriptor differs from the saved preset');
 manifestBodyCoverage(full,'human');
 const selected=compact?compactStarterIdentity(full,index.presets['prime-bald']?.manifest,loadout,deferCoveredHair):full;
 const resources=selectedEquipmentResources(selected,loadout,EQUIPMENT_ITEMS);
 // The body gates skinning and collision attachment; independent gear transfers
 // can overlap at lower priority. All pieces still gate the dressed first frame,
 // and equipment installation reuses these exact fetch/decompression promises.
 // https://developer.mozilla.org/en-US/docs/Web/API/RequestInit#priority
 for(const [id,asset]of resources)startupAssetBuffer(asset,{priority:id==='body'?'high':'low'}).catch(()=>{});
 return selected;
}
