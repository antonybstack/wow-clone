import {
  onSceneDispose,
  getContainerMeshes,
  loadTexture2D,
  rebuildMaterial,
  acquireTexture, releaseTexture,
} from "@babylonjs/lite";
const pending = new Map();
/** Cache promises, not just completed HTTP responses, so prefetch and equipment
 * installation share one request and one decompression.
 * https://developer.mozilla.org/en-US/docs/Web/API/DecompressionStream
 */
export function startupAssetBuffer(asset) {
  if (!pending.has(asset.url)) {
    const task = fetch(asset.url, { priority: "high" })
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
export async function preloadStarterCharacter() {
  const response = await fetch("/ashen-reach/startup/character/manifest.json");
  if (!response.ok)
    throw Error(`Starter character manifest: HTTP ${response.status}`);
  const manifest = await response.json();
  const expected=import.meta.env.VITE_STARTER_CHARACTER_SOURCE;
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
  const response = await fetch('/ashen-reach/human-shape-v1/manifest.json');
  if (!response.ok) throw Error(`Human body family: HTTP ${response.status}`);
  const manifest = await response.json();
  const expected=import.meta.env.VITE_HUMAN_SHAPE_SOURCE;
  if(expected&&manifest.provenance?.sha256!==expected)throw Error('The character family has been updated. Reload to use matching assets.');
  if (manifest.shapeFamily !== 'ashen-human-shape-v1' || manifest.targetNames?.join('|') !== 'slender|stout')
    throw Error('The Human body family has an incompatible deformation layout.');
  const selected=compact?{...manifest,items:manifest.compactItems,fullManifest:manifest}:manifest;
  for (const id of new Set(['body', ...Object.values(loadout).filter(id => manifest.items[id])]))
    startupAssetBuffer(selected.items[id]).catch(() => {});
  return selected;
}
export async function upgradeStarterCharacter(engine, scene, container, manifest, shouldAbort = () => false) {
  let disposed = false;
  onSceneDispose(scene, () => {
    disposed = true;
  });
  for (const entry of manifest.startup.textures) {
    if (disposed || shouldAbort()) return false;
    const materials = new Set(
      getContainerMeshes(container)
        .map((m) => m.material)
        .filter((m) => entry.materials.includes(m?.name)),
    );
    if (!materials.size)
      throw Error("Starter body texture material was not found");
    const texture = await loadTexture2D(engine, entry.url, {
      invertY: false,
      srgb: true,
      mipMaps: true,
    });
    // Keep one temporary owner while an asynchronous bind refresh installs its
    // own references. Cancellation must release an otherwise unused upload.
    // https://github.com/BabylonJS/Babylon-Lite/blob/npm-lite-v1.31.1/packages/babylon-lite/src/resource/texture-release.ts
    acquireTexture(texture);
    try {
      if (disposed || shouldAbort()) return false;
      for (const material of materials) {
        if (disposed || shouldAbort()) return false;
        material.baseColorTexture = texture;
        // Public refresh preserves the source skeleton and current animation.
        await rebuildMaterial(scene, material);
      }
    } finally {releaseTexture(texture);}
  }
  pending.clear();
  return true;
}
