/** Current Human fits. Item identity is separate from authored mesh and coverage. */
export const BODY_REGIONS=['BodyExposed','BodyUnderTunic','BodyUnderBoots','BodyUnderLegs','BodyWaist','BodyHands'];
export const BASE_VISIBLE_MESHES=[...BODY_REGIONS,'HumanHair'];
export const EQUIPMENT_ITEMS=Object.freeze({
    graveweaverHood:{id:'graveweaverHood',slot:'helmet',name:'Graveweaver hood',parts:[{mesh:'GraveweaverHood'}],coverage:['HumanHair']},
    graveweaverTop:{id:'graveweaverTop',slot:'torso',name:'Graveweaver mail vestment',parts:[{mesh:'GraveweaverTop'},{mesh:'GraveweaverPendant'}],coverage:['BodyUnderTunic','BodyWaist']},
    graveweaverSkirt:{id:'graveweaverSkirt',slot:'legs',name:'Graveweaver robe skirt',parts:[{mesh:'GraveweaverSkirt'},{mesh:'WayfarerTrousers'},{mesh:'WayfarerTrousersCuffs',hideWhenSlots:['boots']}],coverage:['BodyUnderLegs','BodyWaist']},
    graveweaverGloves:{id:'graveweaverGloves',slot:'gloves',name:'Graveweaver gloves',parts:[{mesh:'GraveweaverGloves'}],coverage:['BodyHands']},
    graveweaverStaff:{id:'graveweaverStaff',factory:'staff',slot:'mainHand',name:'Graveweaver staff',gripRotation:[.096447,.716405,-.312674,.616196],stow:{position:[.05414,.30924,-.13681],rotation:[-.098894,.137577,-.976529,.132979]}},
    graveweaverBook:{id:'graveweaverBook',factory:'book',slot:'offHand',name:'Graveweaver grimoire',gripRotation:[.112408,-.840823,.272570,.453968],stow:{position:[.21018,.56617,.02915],rotation:[-.114652,.124749,-.985426,.015120]}},
    ironSword:{factory:'sword',id:'ironSword',slot:'mainHand',name:'Iron arming sword',gripRotation:[0,0,-Math.SQRT1_2,Math.SQRT1_2],stow:{position:[-.24881,-.08593,-.12746],rotation:[.102945,.134573,-.156227,.97308]},description:'Weathered steel with a leather grip.'},
    wayfarerTunic:{id:'wayfarerTunic',slot:'torso',name:'Wayfarer mail tunic',parts:[{mesh:'WayfarerTunic'}],coverage:['BodyUnderTunic','BodyWaist']},
    pilgrimTunic:{id:'pilgrimTunic',slot:'torso',name:'Pilgrim cloth tunic',parts:[{mesh:'PilgrimTunic'}],coverage:['BodyUnderTunic','BodyWaist']},
    wayfarerTrousers:{id:'wayfarerTrousers',slot:'legs',name:'Wayfarer trousers',parts:[{mesh:'WayfarerTrousers'},{mesh:'WayfarerTrousersCuffs',hideWhenSlots:['boots']}],coverage:['BodyUnderLegs','BodyWaist']},
    wayfarerBoots:{id:'wayfarerBoots',slot:'boots',name:'Wayfarer boots',parts:[{mesh:'WayfarerBoots'}],coverage:['BodyUnderBoots']},
});
/** Union coverage once: an unequipped item must never reveal another item's mask. */
export function resolveEquipmentVisibility(selected){
    const visibility=Object.fromEntries(BASE_VISIBLE_MESHES.map(name=>[name,true]));
    for(const item of Object.values(EQUIPMENT_ITEMS))for(const part of item.parts||[])visibility[part.mesh]=false;
    for(const [slot,id]of Object.entries(selected)){
        if(id===null)continue;
        const item=EQUIPMENT_ITEMS[id];if(!item||item.slot!==slot)throw Error('Item does not fit this slot');
        for(const name of item.coverage||[])visibility[name]=false;
        for(const part of item.parts||[])visibility[part.mesh]=!(part.hideWhenSlots||[]).some(other=>selected[other]);
    }
    return visibility;
}

export const EQUIPMENT_SLOTS=['helmet','torso','legs','boots','gloves','mainHand','offHand'];
const outfit=items=>({...Object.fromEntries(EQUIPMENT_SLOTS.map(slot=>[slot,null])),...items});
export const EQUIPMENT_PRESETS={
    wayfarer:{name:'Wayfarer',loadout:outfit({torso:'wayfarerTunic',legs:'wayfarerTrousers',boots:'wayfarerBoots',mainHand:'ironSword'})},
    pilgrim:{name:'Pilgrim',loadout:outfit({torso:'pilgrimTunic',legs:'wayfarerTrousers',boots:'wayfarerBoots'})},
    graveweaver:{name:'Graveweaver',loadout:outfit({helmet:'graveweaverHood',torso:'graveweaverTop',legs:'graveweaverSkirt',boots:'wayfarerBoots',gloves:'graveweaverGloves',mainHand:'graveweaverStaff',offHand:'graveweaverBook'})},
};
export function validateLoadout(loadout){
    for(const [slot,id]of Object.entries(loadout)){
        if(!EQUIPMENT_SLOTS.includes(slot))throw Error('Unsupported equipment slot: '+slot);
        if(id!==null&&(!Object.hasOwn(EQUIPMENT_ITEMS,id)||EQUIPMENT_ITEMS[id].slot!==slot))throw Error('Item does not fit this slot');
    }
}
