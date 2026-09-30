import {
  onSceneDispose,
  getContainerMeshes,
  loadTexture2D,
  rebuildMaterial,
  acquireTexture, releaseTexture,
} from "@babylonjs/lite";
import {clearStartupBuffers} from './startup-fetch.js';
export {preloadStarterCharacter,preloadHumanShapePack,startupAssetBuffer} from './startup-fetch.js';
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
  clearStartupBuffers();
  return true;
}
