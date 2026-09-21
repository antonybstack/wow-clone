import { installEquipmentGrips } from './equipment-grips.js';
import {loadGltf,getContainerMeshes,setMeshVisible,setParent,addToScene,removeFromScene} from '@babylonjs/lite';
import {EQUIPMENT_ITEMS,BASE_VISIBLE_MESHES,validateLoadout,resolveEquipmentVisibility,EQUIPMENT_PRESETS,gripHold} from './equipment-catalog.js';
import {HUMAN_EQUIPMENT_FIT, assertAssetFit, raceForFit} from './equipment-contract.js';
import {resolveHandEquip} from './equipment-contract.js';
import {createEquipmentLoader} from './equipment-loader.js';
import {createArmingSword} from './arming-sword.js';
import {createMageProp} from './mage-props.js';
import {advancePropTransition,beginPropTransition} from './prop-transition.js';

/**
 * Body-visibility aliases, per race, keyed explicitly rather than sniffed from mesh names.
 *
 * The catalogue authors coverage in Human geoset names, so a race whose body splits those
 * regions differently declares the translation here. Every playable race needs an entry:
 * a race with no entry is rejected by packVisibility instead of inheriting Human's mapping.
 */
const RACE_BODY_ALIASES = Object.freeze({
    human: () => ({}),
    orc: (vis, baseMeshes) => ({
        OrcV1Hair: vis.HumanHair,
        OrcV1Shorts: vis.BodyUnderLegs,
        OrcV1Brows: true,
        OrcV1Eyes: true,
        ...(baseMeshes.includes('BodyExposed') ? {} : {OrcV1Body: true}),
    }),
    // Skull face: no hair geoset exists to alias, so the hood's HumanHair coverage is inert
    // and the six shared regions carry the whole mapping.
    undead: () => ({}),
});

function packVisibility(selected, baseMeshes, race) {
    const alias = RACE_BODY_ALIASES[race];
    if (!alias) throw Error(`No body visibility mapping for race: ${race}`);
    const vis = resolveEquipmentVisibility(selected);
    const out = {...vis};
    for (const [name, value] of Object.entries(alias(vis, baseMeshes))) {
        if (baseMeshes.includes(name)) out[name] = value;
    }
    return out;
}

export async function createStreamedEquipment(engine,scene,body,sockets,options={}){
    const manifestUrl=options.manifestUrl||'/ashen-reach/equipment/manifest.json';
    const baseMeshes=options.baseMeshes||BASE_VISIBLE_MESHES;
    const expectedFit=options.fitId||HUMAN_EQUIPMENT_FIT;
    const bootLoadout=options.bootLoadout||{torso:'wayfarerTunic',legs:'wayfarerTrousers',boots:'wayfarerBoots'};
    // Explicit race selection. The pack names the race it is; the fit must agree. Nothing here
    // infers "human" from "not orc", so a third race cannot arrive wearing Human assumptions.
    const race=options.race??raceForFit(expectedFit);
    if(raceForFit(expectedFit)!==race)throw Error(`Pack declares race ${race} but carries the ${expectedFit.body} fit`);
    const response=await fetch(manifestUrl);
    if(!response.ok)throw Error(`No ${race} equipment manifest at ${manifestUrl}`);
    // A dev server answers a missing file with its SPA fallback, so a 200 full of HTML is the
    // shape a deleted pack actually takes. Name the URL rather than surfacing a JSON parse error.
    let manifest;
    try{manifest=await response.json();}
    catch{throw Error(`The ${race} equipment manifest at ${manifestUrl} is not valid JSON`);}
    // A pack that declares its fit must be the pack we asked for: this catches a packs-table
    // entry left pointing at another race's directory, which would otherwise load and look fine.
    if(manifest.fitId!==expectedFit.body)throw Error(`Equipment pack is ${manifest.fitId||'unlabelled'}, not ${expectedFit.body}`);
    const base=getContainerMeshes(body.container),donor=base.find(m=>m.skeleton);
    if(!donor||donor.skeleton.boneCount!==65)throw Error('Unsupported equipment rig');
    const entries=new Map();let visible=true,stopped=false;
    const bindings=Object.fromEntries(baseMeshes.map(name=>[name,base.filter(m=>m.name===name)]));
    const uncovered=Object.entries(bindings).filter(([,meshes])=>!meshes.length).map(([name])=>name);
    if(uncovered.length)throw Error(`Missing ${race} body coverage: ${uncovered.join(', ')}`);
    const initial={helmet:null,torso:null,legs:null,boots:null,gloves:null,mainHand:null,offHand:null};
    function setAttachment(entry,stow){
        const item=entry.item;if(!item.factory)return;
        const where=stow?'back':'hand';if(entry.attachment===where)return;
        const hold=gripHold(item,race);
        const target=stow?item.stow:{position:hold.position,rotation:hold.rotation};
        const first=entry.attachment===null;
        setParent(entry.root,sockets.sockets[stow?'back':item.slot].node);
        const q=entry.root.rotationQuaternion,from={position:[entry.root.position.x,entry.root.position.y,entry.root.position.z],rotation:[q.x,q.y,q.z,q.w]};
        entry.attachment=where;entry.root.scaling.set(hold.scale,hold.scale,hold.scale);
        if(first){entry.root.position.set(...target.position);entry.root.rotationQuaternion.set(...target.rotation);entry.transition=null;}
        else beginPropTransition(entry,from.position,from.rotation,target);
    }
    async function prepare(id,requestSignal){
        const signal=AbortSignal.any([requestSignal,AbortSignal.timeout(15000)]);signal.throwIfAborted();
        const item=EQUIPMENT_ITEMS[id];let root,container,meshes,owned=[];
        try{
            if(item.factory){
                const prop=item.factory==='sword'?createArmingSword(engine,scene,sockets.sockets[item.slot].node,item.gripRotation):createMageProp(engine,scene,item.factory);
                ({root,meshes}=prop);
            }else{
                const asset=manifest.items[id];
                // An item this pack does not carry is an unsupported combination, not a cue to
                // reach for the Human asset. Say which race is missing it.
                if(!asset)throw Error(`No ${race} fit for ${item.name}`);
                if(asset.bytes>16*1024*1024)throw Error('Equipment asset exceeds supported size');
                // Throws unless the manifest entry's fit is the one this item declares for this
                // race. No Human default: see declaredFitForRace in equipment-contract.js.
                assertAssetFit(asset,item,race);
                const response=await fetch(asset.url,{signal});if(!response.ok)throw Error(`Could not load the ${race} ${item.name} from ${asset.url}`);
                const bytes=await response.arrayBuffer();if(bytes.byteLength!==asset.bytes)throw Error(`The ${race} ${item.name} is ${bytes.byteLength} bytes, not the ${asset.bytes} its manifest declares`);
                const verify=import.meta.env?.DEV!==false||new URLSearchParams(globalThis.location?.search||'').has('verifyAssets');
                if(verify){
                 const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),n=>n.toString(16).padStart(2,'0')).join('');
                 if(digest!==asset.sha256)throw Error(`The ${race} ${item.name} at ${asset.url} does not match its manifest hash`);
                }
                signal.throwIfAborted();container=await loadGltf(engine,bytes);root=container.entities[0];meshes=getContainerMeshes(container);signal.throwIfAborted();
                for(const part of item.parts)if(!meshes.some(m=>m.name===part.mesh))throw Error('Missing garment part: '+part.mesh);
                for(const mesh of meshes){
                    if(!mesh.skeleton||mesh.skeleton.boneCount!==65)throw Error('Garment skin mismatch');
                    // Splitter proves identical joint order, inverse binds and identity mesh bind.
                    // Borrow only the live palette, retaining this mesh's own vertex skin buffers.
                    // Restore its owned skeleton BEFORE disposal so the actor palette is never freed.
                    owned.push([mesh,mesh.skeleton]);
                    mesh.skeleton={...mesh.skeleton,boneTexture:donor.skeleton.boneTexture,boneMatrices:donor.skeleton.boneMatrices};
                    mesh.receiveShadows=true;
                }
                setParent(root,body.root);root.position.set(0,0,0);root.rotationQuaternion.set(0,0,0,1);root.scaling.set(1,1,1);
                setMeshVisible(root,false);addToScene(scene,container);
            }
            setMeshVisible(root,false);
            let dead=false;
            const entry={item,root,meshes,attachment:null,dispose(){
                if(dead)return;dead=true;for(const [mesh,skeleton]of owned)mesh.skeleton=skeleton;
                removeFromScene(scene,container||root);entries.delete(id);
            }};
            if(stopped){entry.dispose();throw Error('Equipment disposed');}
            entries.set(id,entry);return entry;
        }catch(error){
            for(const [mesh,skeleton]of owned)mesh.skeleton=skeleton;
            if(root)removeFromScene(scene,container||root);
            throw error;
        }
    }
    function apply(next){
        const mask=packVisibility(next, baseMeshes, race);
        for(const [name,meshes]of Object.entries(bindings))for(const mesh of meshes)setMeshVisible(mesh,visible&&mask[name]);
        const preview=body.inspection?.getState(),casting=preview?['fire','lava'].includes(preview.id):body.getState().castingShoot;
        sockets.sync([sockets.sockets.mainHand,sockets.sockets.offHand,sockets.sockets.back]);
        for(const entry of entries.values()){
            const equipped=next[entry.item.slot]===entry.item.id;
            if(equipped)setAttachment(entry,casting);
            setMeshVisible(entry.root,visible&&equipped);
            if(equipped&&entry.item.parts)for(const mesh of entry.meshes)setMeshVisible(mesh,visible&&!!mask[mesh.name]);
        }
    }
    const loader=createEquipmentLoader({initial,validate:validateLoadout,prepare,commit(next){try{apply(next);}catch(error){apply(loader.getState());throw error;}},maxIdle:2});
    const equipment={items:EQUIPMENT_ITEMS,presets:EQUIPMENT_PRESETS,
        setLoadout:patch=>loader.request(resolveHandEquip(loader.getState(),patch,EQUIPMENT_ITEMS)),
        equip:(slot,id)=>loader.request(resolveHandEquip(loader.getState(),{[slot]:id},EQUIPMENT_ITEMS)),
        equipPreset(id){if(!Object.hasOwn(EQUIPMENT_PRESETS,id))return Promise.resolve({status:'failed',error:'Unknown outfit'});return loader.request(EQUIPMENT_PRESETS[id].loadout);},
        getState:loader.getState,getStatus:loader.getStatus,
        setVisible(value){visible=value;apply(loader.getState());},
        update(dt=0){
            const selected=loader.getState();const preview=body.inspection?.getState(),casting=preview?['fire','lava'].includes(preview.id):body.getState().castingShoot;
            if(!visible)return;
            sockets.sync([sockets.sockets.mainHand,sockets.sockets.offHand,sockets.sockets.back]);
            for(const entry of entries.values())if(selected[entry.item.slot]===entry.item.id)setAttachment(entry,casting);
            for(const entry of entries.values())if(selected[entry.item.slot]===entry.item.id)advancePropTransition(entry,dt);
        },
        get attachment(){return entries.get(loader.getState().mainHand)?.attachment||'hand';},
        dispose(){stopped=true;loader.dispose();},
    };
    installEquipmentGrips(body,loader.getState);
    const boot=await equipment.setLoadout(bootLoadout);
    if(boot.status!=='applied'){equipment.dispose();throw Error(boot.error||'Equipment boot failed');}
    return equipment;
}
