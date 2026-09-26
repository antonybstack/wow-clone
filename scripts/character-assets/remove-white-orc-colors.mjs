/** Remove only neutral vertex colors from the prepared Orc actor meshes.
 * Skin cavity shading is already baked into their albedo. glTF Transform owns
 * the accessor graph when an attribute is detached; keep this in asset prep
 * instead of mutating Lite's private GPU buffer after load.
 * https://gltf-transform.dev/modules/core/classes/Primitive
 */
export function removeWhiteOrcColors(document) {
  const bindings = [];
  for (const mesh of document.getRoot().listMeshes()) {
    for (const primitive of mesh.listPrimitives()) {
      const color = primitive.getAttribute('COLOR_0');
      if (!color) continue;
      const values = color.getArray();
      const white = color.getComponentType() === 5121 ? 255 : 1;
      if (color.getElementSize() !== 4 || !values.every(value => value === white)) {
        throw new Error(`${mesh.getName()}: COLOR_0 contains appearance data; keep it and review the Orc material`);
      }
      bindings.push({primitive, color});
    }
  }
  const removed = new Set();
  for (const {primitive, color} of bindings) {
    primitive.setAttribute('COLOR_0', null);
    removed.add(color);
  }
  for (const color of removed) {
    if (color.listParents().length !== 1) throw new Error('Orc COLOR_0 accessor still has a consumer');
    color.dispose();
  }
  return {primitives: bindings.length, accessors: removed.size};
}
