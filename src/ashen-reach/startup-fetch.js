/** Shared Web API fetch/decompression cache. No renderer import: the optional early
 * saved-character entry can start the same requests while Lite is downloading.
 * https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules#dynamic_module_loading
 */
const pending = new Map();
/** Cache promises, not just completed HTTP responses, so prefetch and equipment
 * installation share one request and one decompression.
 * https://developer.mozilla.org/en-US/docs/Web/API/DecompressionStream
 */
export function startupAssetBuffer(asset, {priority = 'high'} = {}) {
  if (!pending.has(asset.url)) {
    const task = fetch(asset.url, { priority })
      .then(async (response) => {
        if (!response.ok) throw Error(`${asset.url}: HTTP ${response.status}`);
        const bytes =
          asset.compression === "gzip"
            ? await new Response(
                response.body.pipeThrough(new DecompressionStream("gzip")),
              ).arrayBuffer()
            : await response.arrayBuffer();
        if (bytes.byteLength !== asset.bytes)
          throw Error(`Unexpected size for ${asset.url}`);
        return bytes;
      })
      .catch((error) => {
        pending.delete(asset.url);
        throw error;
      });
    pending.set(asset.url, task);
  }
  return pending.get(asset.url);
}
let starterManifestTask, shapeManifestTask, identityCatalogueTask;
/** Start the fixed catalogue request before the optional identity module arrives.
 * This reuses the same promise; storage never supplies a URL or bypasses validation.
 * https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch
 */
export function preloadHumanIdentityCatalogue(){
 return identityCatalogueTask??=fetch('/ashen-reach/human-identity-v1/manifest.json',{priority:'high'}).then(async response=>{
  if(!response.ok)throw Error(`Human identity catalogue: HTTP ${response.status}`);
  return response.json();
 }).catch(error=>{identityCatalogueTask=null;throw error;});
}
export function invalidateHumanIdentityCatalogue(){identityCatalogueTask=null;}
export function clearStartupBuffers() {pending.clear();}
export function preloadStarterCharacter() {
  return starterManifestTask ??= loadStarterCharacter().catch(error => {starterManifestTask=null;throw error;});
}
async function loadStarterCharacter() {
  const response = await fetch("/ashen-reach/startup/character/manifest.json");
  if (!response.ok)
    throw Error(`Starter character manifest: HTTP ${response.status}`);
  const manifest = await response.json();
  const expected=import.meta.env?.VITE_STARTER_CHARACTER_SOURCE;
  if(expected&&manifest.provenance?.sha256!==expected)throw Error('The character has been updated. Reload to use the matching starting assets.');
  for (const id of [
    "body",
    "wayfarerTunic",
    "wayfarerTrousers",
    "wayfarerBoots",
  ])
    startupAssetBuffer(manifest.items[id]).catch(() => {});
  return manifest;
}
/** Only saved customized characters fetch this family before play. Neutral boots retain
 * the existing starter; opening the Armory loads the family transactionally later.
 */
export async function preloadHumanShapePack(loadout = {}, {compact = false} = {}) {
  const manifest = await (shapeManifestTask ??= loadHumanShapeManifest().catch(error => {shapeManifestTask=null;throw error;}));
  const selected=compact?{...manifest,items:manifest.compactItems,fullManifest:manifest}:manifest;
  const ids=new Set(['body', ...Object.values(loadout).filter(id => manifest.items[id])]);
  for(const id of ids)if(!selected.items?.[id])throw Error(`Missing ${compact?'compact':'full'} Human piece: ${id}`);
  for(const id of ids)startupAssetBuffer(selected.items[id]).catch(() => {});
  return selected;
}
export function preloadSavedHumanPack(appearance,options={}){
 if(!appearance.components?.head)return preloadHumanShapePack(appearance.equipment,options);
 // The validated saved recipe selects this fixed optional catalogue. Main owns
 // error reporting and the loader checks its sealed version/preset/coverage.
 preloadHumanIdentityCatalogue().catch(()=>{});
 return import('./human-identity-assets.js').then(api=>api.preloadHumanIdentityPack(appearance.components,appearance.equipment,options));
}
async function loadHumanShapeManifest() {
  const response = await fetch('/ashen-reach/human-shape-v1/manifest.json');
  if (!response.ok) throw Error(`Human body family: HTTP ${response.status}`);
  const manifest = await response.json();
  const expected=import.meta.env?.VITE_HUMAN_SHAPE_SOURCE;
  if(expected&&manifest.provenance?.sha256!==expected)throw Error('The character family has been updated. Reload to use matching assets.');
  if (manifest.shapeFamily !== 'ashen-human-shape-v1' || manifest.targetNames?.join('|') !== 'slender|stout')
    throw Error('The Human body family has an incompatible deformation layout.');
  return manifest;
}
