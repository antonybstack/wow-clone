/** Compact clothing may use native meshopt simplification. Rigid factory pieces
 * retain their exact geometry, including mixed cloth+plate items; a metal material
 * alone never implies rigidity. Conservative first-play cost is measured later.
 * https://gltf-transform.dev/modules/functions/functions/simplify
 */
export function retainFullStartupGeometry(root,item){
 return item?.deformation==='rigid-bone'||root.listMeshes().some(mesh=>
  mesh.listPrimitives().some(primitive=>primitive.getExtras().deformation==='rigid-bone'));
}
