/** Derive the heaviest saved Human asset set from current prepared descriptors.
 * Mirrors preloadHumanIdentityPack/preloadHumanShapePack's body + selected item
 * requests, deduplicated by URL like startupAssetBuffer's shared promise cache.
 * This is payload size, not a claim about the slowest GPU/animation workload.
 * https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map
 */
import assert from 'node:assert/strict';
import {EQUIPMENT_ITEMS,EQUIPMENT_SLOTS} from '../../src/ashen-reach/equipment-catalog.js';
import {validateEquipmentSelection} from '../../src/ashen-reach/equipment-contract.js';

export function compactAppearanceBytes(manifest,equipment){
 const ids=new Set(['body',...Object.values(equipment).filter(id=>manifest.items[id])]);
 const resources=new Map();
 for(const id of ids){
  const asset=manifest.compactItems?.[id];assert(asset,`Missing compact asset: ${id}`);
  const bytes=asset.compression==='gzip'?asset.encodedBytes:asset.bytes;
  assert(Number.isSafeInteger(bytes)&&bytes>0,`Missing encoded byte count: ${id}`);
  assert(typeof asset.url==='string'&&asset.url.length>0,`Missing asset URL: ${id}`);
  if(resources.has(asset.url))assert.equal(resources.get(asset.url).bytes,bytes,'Conflicting sizes for a shared URL');
  else resources.set(asset.url,{id,url:asset.url,bytes});
 }
 return {bytes:[...resources.values()].reduce((total,a)=>total+a.bytes,0),resources:[...resources.values()]};
}

export function maximumCompactAppearance(profiles,{items=EQUIPMENT_ITEMS,slots=EQUIPMENT_SLOTS}={}){
 assert(profiles.length>0,'No prepared Human profiles');
 const choices=Object.fromEntries(slots.map(slot=>[slot,[null]]));
 for(const [id,item]of Object.entries(items)){
  assert(choices[item.slot],`Unknown catalogue slot: ${item.slot}`);choices[item.slot].push(id);
  for(const profile of profiles)if(!item.factory)assert(profile.manifest.items[id],`Missing prepared piece: ${profile.id}/${id}`);
 }
 // Same finite slot-product enumeration used by the existing coverage matrix.
 // Validate actual occupancy rules instead of assuming per-slot maxima coexist.
 function* selections(index,current){
  if(index===slots.length){yield current;return;}
  const slot=slots[index];
  for(const id of choices[slot])yield* selections(index+1,{...current,[slot]:id});
 }
 let enumerated=0,valid=0,best=null;
 for(const equipment of selections(0,{})){
  enumerated++;
  try{validateEquipmentSelection(equipment,items,slots);}catch{continue;}
  valid++;
  const worn=Object.values(equipment).filter(Boolean).length;
  for(const profile of profiles){
   const cost=compactAppearanceBytes(profile.manifest,equipment);
   // Procedural held props add no GLB bytes. Prefer a fully equipped tie rather
   // than quietly removing them from the timing fixture.
   if(!best||cost.bytes>best.bytes||(cost.bytes===best.bytes&&worn>best.worn))
    best={profile:profile.id,components:profile.components,equipment,...cost,worn};
  }
 }
 assert(best,'No valid prepared appearance');
 return {schema:1,scope:'Unique compact body/clothing transfer bytes; excludes common code, world, manifests and procedural props',enumerated,valid,profiles:profiles.length,maximum:best};
}
