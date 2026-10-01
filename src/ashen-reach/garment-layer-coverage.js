/** Conditional garment geosets use the same visibility commit as body coverage.
 * Keep a region explicit: a cropped torso must never hide upper trousers merely
 * because it occupies the torso slot. Native glTF meshes remain the boundary.
 * https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#meshes
 */
export const GARMENT_REGIONS=Object.freeze(['trousers.upper']);
export function validateGarmentLayerCoverage(rules,items,bodyMeshes=[]){
 if(rules?.schema!==1||!rules.coversByItem||!rules.partsByItem)throw Error('Unsupported garment coverage rules');
 for(const [id,regions]of Object.entries(rules.coversByItem)){
  if(items[id]?.slot!=='torso'||!Array.isArray(regions)||!regions.length||regions.some(r=>!GARMENT_REGIONS.includes(r)))throw Error(`Invalid garment region cover: ${id}`);
 }
 for(const [id,parts]of Object.entries(rules.partsByItem)){
  if(items[id]?.slot!=='legs'||!Array.isArray(parts)||!parts.length)throw Error(`Invalid garment region source: ${id}`);
  const names=new Set();
  for(const part of parts){if(typeof part.mesh!=='string'||!part.mesh||bodyMeshes.includes(part.mesh)||names.has(part.mesh)||items[id].parts.some(p=>p.mesh===part.mesh)||!Array.isArray(part.hideWhenRegions)||!part.hideWhenRegions.length||part.hideWhenRegions.some(r=>!GARMENT_REGIONS.includes(r)))throw Error(`Invalid garment region part: ${id}`);names.add(part.mesh);}
 }
 return rules;
}
export function resolveGarmentLayerVisibility(selected,items,rules){
 const covered=new Set(Object.values(selected).filter(Boolean).flatMap(id=>rules.coversByItem[id]||[]));
 const visibility={};
 for(const [id,parts]of Object.entries(rules.partsByItem))for(const part of parts){
  const visible=selected[items[id].slot]===id&&!part.hideWhenRegions.some(region=>covered.has(region));
  // Shared names across alternative leg items are legal. Their union must not
  // let the inactive alternative override the selected piece's visibility.
  visibility[part.mesh]=(visibility[part.mesh]||false)||visible;
 }
 return visibility;
}
