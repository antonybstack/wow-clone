import {HUMAN_EQUIPMENT_FIT, ORC_EQUIPMENT_FIT, freezeEquipment, validateEquipmentCatalogue, validateEquipmentSelection} from './equipment-contract.js';
/** Current Human fits. Item identity is separate from authored mesh and coverage. */
export const BODY_REGIONS=['BodyExposed','BodyUnderTunic','BodyUnderBoots','BodyUnderLegs','BodyWaist','BodyHands'];
export const BASE_VISIBLE_MESHES=[...BODY_REGIONS,'HumanHair'];
/** Sculpt-pipeline Orc: Human coverage names plus print extras. */
export const ORC_BASE_VISIBLE_MESHES=[...BODY_REGIONS,'OrcV1Hair','OrcV1Brows','OrcV1Eyes','OrcV1Shorts'];
const authoredItems={
    graveweaverHood:{id:'graveweaverHood',slot:'helmet',name:'Graveweaver hood',parts:[{mesh:'GraveweaverHood'}],coverage:['HumanHair']},
    graveweaverTop:{id:'graveweaverTop',slot:'torso',name:'Graveweaver mail vestment',parts:[{mesh:'GraveweaverTop'},{mesh:'GraveweaverPendant'}],coverage:['BodyUnderTunic','BodyWaist']},
    graveweaverSkirt:{id:'graveweaverSkirt',slot:'legs',name:'Graveweaver robe skirt',parts:[{mesh:'GraveweaverSkirt'},{mesh:'WayfarerTrousers'},{mesh:'WayfarerTrousersCuffs',hideWhenSlots:['boots']}],coverage:['BodyUnderLegs','BodyWaist']},
    graveweaverGloves:{id:'graveweaverGloves',slot:'gloves',name:'Graveweaver gloves',parts:[{mesh:'GraveweaverGloves'}],coverage:['BodyHands']},
    graveweaverStaff:{id:'graveweaverStaff',factory:'staff',slot:'mainHand',name:'Graveweaver staff',gripPose:'shaft',gripPosition:[-.005,-.080,.020],gripRotation:[0,0,-Math.SQRT1_2,Math.SQRT1_2],stow:{position:[.05414,.30924,-.13681],rotation:[-.098894,.137577,-.976529,.132979]},grips:{orc:{position:[-.005,-.092,.028],scale:1.16}}},
    graveweaverGreatstaff:{id:'graveweaverGreatstaff',factory:'greatstaff',slot:'mainHand',name:'Graveweaver greatstaff',gripPose:'shaft',twoHanded:true,occupies:['mainHand','offHand'],gripPosition:[.00572,.02636,-.01291],gripRotation:[-.353791,0,-.362037,.862416],stow:{position:[.08126,.02175,-.27471],rotation:[-.098894,.137577,-.976529,.132979]},grips:{orc:{position:[.00572,.02636,-.022],scale:1.16}}},
    graveweaverBook:{id:'graveweaverBook',factory:'book',slot:'offHand',name:'Graveweaver grimoire',gripPose:'shaft',gripPosition:[-.100,.050,.135],gripRotation:[0,0,0,1],stow:{position:[.21018,.56617,.02915],rotation:[-.114652,.124749,-.985426,.015120]},grips:{orc:{position:[-.100,.050,.148],scale:1.12}}},
    ironSword:{factory:'sword',id:'ironSword',slot:'mainHand',name:'Iron arming sword',gripPose:'shaft',gripPosition:[-.005,-.080,.020],gripRotation:[0,0,-Math.SQRT1_2,Math.SQRT1_2],stow:{position:[-.24881,-.08593,-.12746],rotation:[.102945,.134573,-.156227,.97308]},grips:{orc:{position:[-.005,-.092,.028],scale:1.16}},description:'Weathered steel with a leather grip.'},
    wayfarerTunic:{id:'wayfarerTunic',slot:'torso',name:'Wayfarer mail tunic',parts:[{mesh:'WayfarerTunic'}],coverage:['BodyUnderTunic','BodyWaist']},
    pilgrimTunic:{id:'pilgrimTunic',slot:'torso',name:'Pilgrim cloth tunic',parts:[{mesh:'PilgrimTunic'}],coverage:['BodyUnderTunic','BodyWaist']},
    wayfarerTrousers:{id:'wayfarerTrousers',slot:'legs',name:'Wayfarer trousers',parts:[{mesh:'WayfarerTrousers'},{mesh:'WayfarerTrousersCuffs',hideWhenSlots:['boots']}],coverage:['BodyUnderLegs','BodyWaist']},
    wayfarerBoots:{id:'wayfarerBoots',slot:'boots',name:'Wayfarer boots',parts:[{mesh:'WayfarerBoots'}],coverage:['BodyUnderBoots']},
};
const seamsBySlot={helmet:['neck'],torso:['neck','waist','wrists'],legs:['waist','ankles'],boots:['ankles'],gloves:['wrists'],mainHand:[],offHand:[]};
export const EQUIPMENT_ITEMS=freezeEquipment(Object.fromEntries(Object.entries(authoredItems).map(([id,item])=>[id,{...item,fit:{...HUMAN_EQUIPMENT_FIT},fits:{human:{...HUMAN_EQUIPMENT_FIT},orc:{...ORC_EQUIPMENT_FIT}},seams:seamsBySlot[item.slot],occupies:item.occupies||[item.slot]}])));
/** Socket-local hold for a race. Human values stay on the item; Orc is an optional correction. */
export function gripHold(item, race='human'){
    const hold={position:item.gripPosition||[0,0,0],rotation:item.gripRotation,scale:1};
    const extra=item.grips?.[race];
    if(!extra)return hold;
    return {position:extra.position||hold.position,rotation:extra.rotation||hold.rotation,scale:extra.scale??hold.scale};
}
/** Union coverage once: an unequipped item must never reveal another item's mask. */
export function resolveEquipmentVisibility(selected){
    validateLoadout(selected);
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
    warden:{name:'Warden',loadout:outfit({helmet:'graveweaverHood',torso:'graveweaverTop',legs:'graveweaverSkirt',boots:'wayfarerBoots',gloves:'graveweaverGloves',mainHand:'graveweaverGreatstaff',offHand:null})},
};
export function validateLoadout(loadout){
    validateEquipmentSelection(loadout,EQUIPMENT_ITEMS,EQUIPMENT_SLOTS);
}
validateEquipmentCatalogue(EQUIPMENT_ITEMS,{slots:EQUIPMENT_SLOTS,baseMeshes:BASE_VISIBLE_MESHES});
