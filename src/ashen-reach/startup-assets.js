import {
  onSceneDispose,
  getContainerMeshes,
  loadTexture2D,
  rebuildMaterial,
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
export async function upgradeStarterCharacter(engine, scene, container, manifest) {
  let disposed = false;
  onSceneDispose(scene, () => {
    disposed = true;
  });
  for (const entry of manifest.startup.textures) {
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
    if (disposed) throw Error("Scene disposed during character texture load");
    for (const material of materials) {
      material.baseColorTexture = texture;
      // Public Lite material refresh updates bindings, retaining the skeleton,
      // current animation phase, equipment and sockets throughout the upgrade.
      // https://github.com/BabylonJS/Babylon-Lite/blob/npm-lite-v1.31.1/packages/babylon-lite/src/index.ts
      await rebuildMaterial(scene, material);
    }
  }
  pending.clear();
}
