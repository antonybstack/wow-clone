import { EQUIPMENT_ITEMS } from './equipment-catalog.js';
/** Grips belong to committed equipment, not a pending UI selection. Fire and
 * Lava stow both props and release these masks so source spell fingers can
 * play. Pyre Burst keeps the weapon in hand. */
export function spellStowsWeapon(body) {
    const preview = body.inspection?.getState();
    if (preview) return ['fire', 'lava'].includes(preview.id);
    const state = body.getState?.() ?? {};
    return !!state.castingShoot && !state.holdWeapon;
}
export function installEquipmentGrips(body,getLoadout) {
    body.setHandGripProvider(()=>{
        if(spellStowsWeapon(body))return null;
        const selected=getLoadout();
        const main=EQUIPMENT_ITEMS[selected.mainHand],off=EQUIPMENT_ITEMS[selected.offHand];
        const twoHanded=!!main?.twoHanded;
        // Pyre keeps the sword hand closed on the grip and the free hand in a
        // fist, so the slam does not play open spell fingers.
        if(body.getState?.().holdWeapon)return {right:main?.gripPose||'shaft',left:'shaft',twoHanded:false};
        return {right:main?.gripPose||'relaxed',left:(twoHanded?main:off)?.gripPose||'relaxed',twoHanded};
    });
}
