/** Read-only adapter for `ASHEN.equipment.getState()`, the committed selection.
 * The loader's `getStatus().desired` may be pending or fail and is never used here.
 * No live actor, ASHEN global, network or Lite dependency enters this module.
 */
import {APPEARANCE_REGISTRY, assertFields, validateAppearance} from './contract.js';

export function appearanceFromEquipment(state,registry=APPEARANCE_REGISTRY) {
  assertFields(state,['race','loadout'],'$',{complete:true});
  assertFields(state.loadout,registry.slots,'$.loadout',{complete:false});
  const profile=typeof state.race==='string' && Object.hasOwn(registry.profiles,state.race)?registry.profiles[state.race]:null;
  // Let the validator issue the stable unsupported-race error after constructing a safe value.
  const fit=profile?.fit || {body:null,rig:null,bind:null,shape:null};
  const equipment=Object.fromEntries(registry.slots.map(slot=>[slot,Object.hasOwn(state.loadout,slot)?state.loadout[slot]:null]));
  return validateAppearance({
    schemaVersion:registry.schemaVersion,catalogVersion:registry.catalogVersion,
    race:state.race,fitFamily:fit.body,fit:{rig:fit.rig,bind:fit.bind,shape:fit.shape},
    shape:{},components:{},dyes:{},equipment,
  },registry);
}
