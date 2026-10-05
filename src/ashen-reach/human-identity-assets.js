/** Optional selected-identity descriptors; default startup never imports this graph.
 * All identifiers originate in the validated recipe, all URLs in the sealed pack.
 * Share native fetch/decompression promises with equipment and early preload.
 * https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules#dynamic_module_loading
 */
import {startupAssetBuffer,preloadHumanShapePack} from './startup-fetch.js';
import {findHumanIdentityPreset} from '../character/appearance/human-identity.js';
import {manifestBodyCoverage} from './coverage-manifest.js';
let indexTask;
async function loadIndex(){
 const response=await fetch('/ashen-reach/human-identity-v1/manifest.json',{priority:'high'});
 if(!response.ok)throw Error(`Human identity catalogue: HTTP ${response.status}`);
 const index=await response.json(),expected=import.meta.env?.VITE_HUMAN_IDENTITY_SOURCE;
 if(expected&&index.provenance?.sha256!==expected)throw Error('Human identities have changed. Reload to use matching assets.');
 if(index.schema!==1||index.catalogVersion!=='appearance-catalog-v6'||index.shapeFamily!=='ashen-human-shape-v1'||index.targetNames?.join('|')!=='slender|stout')throw Error('Incompatible Human identity catalogue');
 return index;
}
export async function preloadHumanIdentityPack(components,loadout={}, {compact=false}={}){
 const preset=findHumanIdentityPreset(components);
 if(!preset)throw Error('Unsupported Human identity');
 if(!preset.sourceLabel)return preloadHumanShapePack(loadout,{compact});
 const index=await(indexTask??=loadIndex().catch(error=>{indexTask=null;throw error;}));
 const entry=index.presets[preset.id],full=entry?.manifest;
 if(full?.identity?.preset!==preset.id||full.fitId!=='ashen-human'||full.shapeFamily!==index.shapeFamily||full.targetNames?.join('|')!=='slender|stout'||JSON.stringify(full.identity.components)!==JSON.stringify(preset.components))throw Error('Identity descriptor differs from the saved preset');
 manifestBodyCoverage(full,'human');
 const selected=compact?{...full,items:full.compactItems,fullManifest:full}:full;
 const ids=new Set(['body',...Object.values(loadout).filter(id=>full.items[id])]);
 for(const id of ids)if(!selected.items?.[id])throw Error(`Missing selected Human piece ${id}`);
 for(const id of ids)startupAssetBuffer(selected.items[id]).catch(()=>{});
 return selected;
}
