/** Resolve selected resources without importing the renderer. Hand props may be
 * authored immutable GLBs or procedural; only the latter have zero transfer cost.
 * Reuse this rule for early prefetch, transactions and payload enumeration.
 * https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#binary-gltf-layout
 */
export function equipmentAsset(item, manifest) {
  return item?.asset ?? (item?.factory ? undefined : manifest.items?.[item?.id]);
}

export function selectedEquipmentResources(manifest, loadout, items) {
  const resources = new Map([['body', manifest.items?.body]]);
  if (!resources.get('body')) throw Error('Missing selected body resource');
  for (const id of new Set(Object.values(loadout).filter(Boolean))) {
    const item = items[id];
    if (!item) throw Error(`Unknown selected item: ${id}`);
    const asset = equipmentAsset(item, manifest);
    if (!asset && !item.factory) throw Error(`Missing selected equipment resource: ${id}`);
    if (asset) resources.set(id, asset);
  }
  return resources;
}
