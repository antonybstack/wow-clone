import { EQUIPMENT_ITEMS } from './equipment-catalog.js';
/** Grips belong to committed equipment, not a pending UI selection. Casting
 * stows both props and releases these masks so source spell fingers can play. */
export function installEquipmentGrips(body,getLoadout) {
    body.setHandGripProvider(()=>{
        const preview=body.inspection?.getState();
        if(preview?['fire','lava'].includes(preview.id):body.getState().castingShoot)return null;
        const selected=getLoadout();
        const main=EQUIPMENT_ITEMS[selected.mainHand],off=EQUIPMENT_ITEMS[selected.offHand];
        const twoHanded=!!main?.twoHanded;
        return {right:main?.gripPose||'relaxed',left:(twoHanded?main:off)?.gripPose||'relaxed',twoHanded};
    });
}
