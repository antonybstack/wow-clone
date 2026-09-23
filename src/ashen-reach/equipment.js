import {installEquipmentGrips,spellStowsWeapon} from './equipment-grips.js';
import {advancePropTransition,beginPropTransition} from './prop-transition.js';
import {validateEquipmentCatalogue,resolveHandEquip} from './equipment-contract.js';
import {createMageProp} from './mage-props.js';
import {createArmingSword} from './arming-sword.js';
import {getContainerMeshes,setMeshVisible,setParent} from '@babylonjs/lite';

import {EQUIPMENT_ITEMS,EQUIPMENT_PRESETS,EQUIPMENT_SLOTS,BASE_VISIBLE_MESHES,resolveEquipmentVisibility,validateLoadout} from './equipment-catalog.js';
export {EQUIPMENT_ITEMS} from './equipment-catalog.js';
/** Prepared small catalogue; selection never reloads the actor or its pose. */
export function createEquipment(engine,scene,body,sockets){
    const meshes=getContainerMeshes(body.container),named=name=>meshes.filter(m=>m.name===name);
    validateEquipmentCatalogue(EQUIPMENT_ITEMS,{slots:EQUIPMENT_SLOTS,baseMeshes:BASE_VISIBLE_MESHES,meshNames:new Set(meshes.map(mesh=>mesh.name))});
    const names=[...BASE_VISIBLE_MESHES,...Object.values(EQUIPMENT_ITEMS).flatMap(item=>(item.parts||[]).map(part=>part.mesh))];
    const bindings=Object.fromEntries(names.map(name=>[name,named(name)]));
    for(const [name,meshes]of Object.entries(bindings))if(!meshes.length)throw Error('Missing equipment mesh/coverage: '+name);
    const props=Object.values(EQUIPMENT_ITEMS).filter(item=>item.factory).map(item=>{
        const prop=item.factory==='sword'?createArmingSword(engine,scene,sockets.sockets[item.slot].node,item.gripRotation):createMageProp(engine,scene,item.factory);
        setParent(prop.root,sockets.sockets[item.slot].node);prop.root.position.set(...(item.gripPosition||[0,0,0]));prop.root.rotationQuaternion.set(...item.gripRotation);prop.root.scaling.set(1,1,1);
        return{...prop,item,attachment:null,transition:null};
    });
    const holdTarget=(item,stow)=>stow?item.stow:{position:item.gripPosition||[0,0,0],rotation:item.gripRotation};
    const setAttachment=(prop,stow)=>{
        const where=stow?'back':'hand';if(prop.attachment===where)return;
        const item=prop.item,dest=sockets.sockets[stow?'back':item.slot].node,target=holdTarget(item,stow);
        const first=prop.attachment===null;
        setParent(prop.root,dest);
        const q=prop.root.rotationQuaternion,from={position:[prop.root.position.x,prop.root.position.y,prop.root.position.z],rotation:[q.x,q.y,q.z,q.w]};
        prop.attachment=where;
        prop.root.scaling.set(1,1,1);
        if(first){prop.root.position.set(...target.position);prop.root.rotationQuaternion.set(...target.rotation);prop.transition=null;}
        else beginPropTransition(prop,from.position,from.rotation,target);
    };
    const weaponSockets=[sockets.sockets.mainHand,sockets.sockets.offHand,sockets.sockets.back];
    let visible=true;const selected={helmet:null,torso:'wayfarerTunic',boots:'wayfarerBoots',legs:'wayfarerTrousers',gloves:null,mainHand:'ironSword',offHand:null};
    const apply=()=>{
        for(const prop of props)setMeshVisible(prop.root,visible&&selected[prop.item.slot]===prop.item.id);
        for(const [name,shown]of Object.entries(resolveEquipmentVisibility(selected)))for(const mesh of bindings[name])setMeshVisible(mesh,visible&&shown);
    };
    const setLoadout=patch=>{const next=resolveHandEquip(selected,patch,EQUIPMENT_ITEMS);validateLoadout(next);Object.assign(selected,next);apply();};
    apply();
    installEquipmentGrips(body,()=>selected);
    return {items:EQUIPMENT_ITEMS,presets:EQUIPMENT_PRESETS,setLoadout,
        equipPreset(id){if(!Object.hasOwn(EQUIPMENT_PRESETS,id))throw Error('Unknown outfit');setLoadout(EQUIPMENT_PRESETS[id].loadout);},
        equip(slot,id){setLoadout({[slot]:id});},
        setVisible(value){visible=!!value;apply();},
        update(dt=0){
            if(!visible)return;
            const casting=spellStowsWeapon(body);
            if(selected.mainHand||selected.offHand){sockets.sync(weaponSockets);for(const prop of props)if(selected[prop.item.slot]===prop.item.id)setAttachment(prop,casting);}
            for(const prop of props)if(selected[prop.item.slot]===prop.item.id)advancePropTransition(prop,dt);
        },
        get attachment(){return props.find(prop=>prop.item.id===selected.mainHand)?.attachment||'hand';},
        getState:()=>({...selected}),
    };
}
