/** Fieldcoat migration keeps the exact released v7 domain and appearance values. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {APPEARANCE_REGISTRY,APPEARANCE_CATALOG_VERSION,APPEARANCE_V7_REGISTRY,APPEARANCE_V8_REGISTRY,migrateAppearance,validateAppearance} from '../src/character/appearance/contract.js';
import {appearanceFromEquipment} from '../src/character/appearance/from-equipment.js';
import {encodeAppearance,decodeAppearance,decodeMigratingAppearance} from '../src/character/appearance/codec.js';
import {HUMAN_IDENTITY_PRESETS} from '../src/character/appearance/human-identity.js';
import {EQUIPMENT_PRESETS} from '../src/ashen-reach/equipment-catalog.js';

test('v7 registry is exactly the released domain before Fieldcoat was added',()=>{
    assert.equal(createHash('sha256').update(JSON.stringify(APPEARANCE_V7_REGISTRY)).digest('hex'),'bde9c39c883f4a8edfcf9f83b9ef6dcebc55009a55c6d4f8f19265c5b5e25653');
    assert.equal(APPEARANCE_V8_REGISTRY.profiles,APPEARANCE_V7_REGISTRY.profiles);
    assert.deepEqual(Object.keys(APPEARANCE_V8_REGISTRY.items),[...Object.keys(APPEARANCE_V7_REGISTRY.items),'fieldcoat']);
});
test('v7 cannot smuggle a Fieldcoat into storage migration',()=>{
    const old=appearanceFromEquipment({race:'human',loadout:{}},APPEARANCE_V7_REGISTRY);
    assert.throws(()=>decodeMigratingAppearance(JSON.stringify({...old,equipment:{...old.equipment,torso:'fieldcoat'}})),{code:'UNSUPPORTED_ITEM'});
});
test('saved v7 identity, shape, dye and Bastion migrate unchanged to current',()=>{
    for(const preset of HUMAN_IDENTITY_PRESETS){
        const base=appearanceFromEquipment({race:'human',loadout:{...EQUIPMENT_PRESETS.lector.loadout,shoulders:'bastionShoulders'}},APPEARANCE_V7_REGISTRY);
        const old=validateAppearance({...base,components:preset.components,shape:{...base.shape,height:1.15,build:-.95},dyes:{torso:'moss',shoulders:'oxblood'}},APPEARANCE_V7_REGISTRY);
        assert.deepEqual(migrateAppearance(old),{...old,catalogVersion:APPEARANCE_CATALOG_VERSION});
    }
});
test('Fieldcoat round-trips with dyes and mixed armour on all supported races',()=>{
    for(const race of ['human','orc','undead']){
        const base=appearanceFromEquipment({race,loadout:{...EQUIPMENT_PRESETS.fieldcoat.loadout,shoulders:'bastionShoulders',gloves:'duskguardVambraces'}});
        const recipe=validateAppearance({...base,dyes:{torso:'indigo'}});
        assert.deepEqual(decodeAppearance(encodeAppearance(recipe)),recipe);
        assert.deepEqual(decodeMigratingAppearance(JSON.stringify(recipe)),recipe);
    }
});
