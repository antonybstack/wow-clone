/** Pure actor-to-concrete-piece plan for the two supported diagnostic outfits.
 * A shared item/bind/animation source can use one instance batch even when
 * another slot differs. This prevents whole-outfit grouping from multiplying
 * the unchanged body, boots and other shared pieces.
 * https://github.com/BabylonJS/Babylon-Lite/blob/npm-lite-v1.31.1/docs/lite/architecture/12-thin-instances.md
 */
import {EQUIPMENT_ITEMS} from '../../ashen-reach/equipment-catalog.js';
import {validateAppearance} from '../appearance/contract.js';
import {decodeMigratingAppearance} from '../appearance/codec.js';

const PROPS=Object.freeze({ironSword:'ProbeIronSword',graveweaverGreatstaff:'ProbeGreatstaff'});
const MAX_CROWD=1000;
/** Seconds, seeded by logical identity rather than a movable instance slot.
 * Native VAT params.z is a FRAME offset; multiply this by the clip FPS.
 * https://github.com/BabylonJS/Babylon-Lite/blob/npm-lite-v1.31.1/packages/babylon-lite/src/material/pbr/fragments/vat-fragment.ts
 */
export function actorPhaseSeconds(id) {
  if(typeof id!=='string'||!id)throw TypeError('Expected a nonempty actor ID');
  let seed=2166136261;
  for(let i=0;i<id.length;i++)seed=Math.imul(seed^id.charCodeAt(i),16777619);
  return (seed>>>0)/4294967296*1.7;
}
/** M003 manifests predate appearance v2. Reuse strict bounded decoding and the
 * existing explicit migration; unknown versions or catalogues still fail. */
export function decodePreparedCrowdAppearance(text) {
  return decodeMigratingAppearance(text);
}
export function planCrowdBatches(actors,prepared) {
  if(!Array.isArray(actors)||actors.length<1||actors.length>MAX_CROWD) throw RangeError(`Crowd must contain 1–${MAX_CROWD} actors`);
  if(!prepared?.sourceSha256||!prepared.variants)throw Error('Missing prepared asset manifest');
  const ids=new Set(),batches=new Map(),actorToBatches=new Map();
  for(let index=0;index<actors.length;index++) {
    const actor=actors[index];
    if(!actor||typeof actor.id!=='string'||!actor.id||ids.has(actor.id))throw Error('Actor IDs must be unique nonempty strings');
    ids.add(actor.id);
    const recipe=validateAppearance(actor.recipe);
    if(recipe.race!=='human')throw Error('M003 exact batch prototype supports Human only');
    if(recipe.shape.height!==1||recipe.shape.build!==0)throw Error('Prepared crowd assets support neutral Human shape only');
    const variant=prepared.variants[actor.outfit];
    if(!variant)throw Error(`Missing prepared outfit ${actor.outfit}`);
    const selected=[{mesh:'HumanV1Body',asset:prepared.sourceSha256,item:'body'}];
    for(const [slot,id] of Object.entries(recipe.equipment)) {
      if(!id)continue;
      const item=EQUIPMENT_ITEMS[id];
      if(item.slot!==slot)throw Error(`Wrong item slot ${id}`);
      if(item.parts) {
        const asset=variant.assetSha256?.[id];
        if(!asset)throw Error(`Missing prepared asset hash ${id}`);
        for(const part of item.parts) if(!(part.hideWhenSlots||[]).some(other=>recipe.equipment[other])) selected.push({mesh:part.mesh,asset,item:id});
      } else if(PROPS[id]) selected.push({mesh:PROPS[id],asset:`probe-rigid-v1:${id}:${prepared.sourceSha256}`,item:id});
      else throw Error(`No rigid probe prop for ${id}`);
    }
    const membership=[];
    for(const piece of selected) {
      if(!variant.meshes.includes(piece.mesh))throw Error(`${actor.outfit} lacks visible ${piece.mesh}`);
      const key=JSON.stringify([recipe.fitFamily,recipe.fit.rig,recipe.fit.bind,recipe.fit.shape,prepared.sourceSha256,piece.asset,piece.mesh]);
      let batch=batches.get(key);
      if(!batch){batch={key,mesh:piece.mesh,item:piece.item,sourceOutfit:actor.outfit,actorIds:[],actorIndices:[]};batches.set(key,batch);}
      batch.actorIds.push(actor.id);batch.actorIndices.push(index);membership.push(key);
    }
    actorToBatches.set(actor.id,membership);
  }
  return {batches:[...batches.values()],actorToBatches};
}
