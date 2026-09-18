import test from 'node:test';
import assert from 'node:assert/strict';
import {EQUIPMENT_ITEMS as items, EQUIPMENT_SLOTS as slots, BASE_VISIBLE_MESHES as baseMeshes, EQUIPMENT_PRESETS, validateLoadout} from '../src/ashen-reach/equipment-catalog.js';
import {validateEquipmentCatalogue, validateEquipmentSelection, resolveHandEquip} from '../src/ashen-reach/equipment-contract.js';
const options={slots,baseMeshes};
const clone=()=>structuredClone(items);
test('all current Human presets satisfy declared fits and occupancy',()=>{
    validateEquipmentCatalogue(items,options);
    for(const preset of Object.values(EQUIPMENT_PRESETS))validateLoadout(preset.loadout);
});
test('different race, rig, bind or shape cannot reuse these fits silently',()=>{
    for(const key of ['body','rig','bind','shape']){
        const candidate=clone();candidate.wayfarerTunic.fit[key]='wrong';
        assert.throws(()=>validateEquipmentCatalogue(candidate,options),/Incompatible/);
    }
});
test('coverage typos, missing meshes and invalid cuff precedence fail before rendering',()=>{
    let candidate=clone();candidate.graveweaverHood.coverage=['UnknownHair'];
    assert.throws(()=>validateEquipmentCatalogue(candidate,options),/coverage/);
    assert.throws(()=>validateEquipmentCatalogue(items,{...options,meshNames:new Set()}),/Missing fit mesh/);
    candidate=clone();candidate.wayfarerTrousers.parts[1].hideWhenSlots=['feet'];
    assert.throws(()=>validateEquipmentCatalogue(candidate,options),/precedence/);
});
test('two-hand occupancy rejects a book in either selection order without modifying selection',()=>{
    const candidate=clone();candidate.graveweaverStaff.occupies=['mainHand','offHand'];
    validateEquipmentCatalogue(candidate,options);
    for(const selection of [{mainHand:'graveweaverStaff',offHand:'graveweaverBook'},{offHand:'graveweaverBook',mainHand:'graveweaverStaff'}]){
        const before=structuredClone(selection);
        assert.throws(()=>validateEquipmentSelection(selection,candidate,slots),/conflict/);
        assert.deepEqual(selection,before);
    }
    validateEquipmentSelection({mainHand:'graveweaverStaff',offHand:null},candidate,slots);
    validateLoadout(EQUIPMENT_PRESETS.graveweaver.loadout); // Current staff stays one-handed.
});
test('catalogue nested declarations cannot mutate after validation',()=>{
    assert.throws(()=>items.graveweaverHood.coverage.push('BodyHands'),TypeError);
    assert.throws(()=>{items.graveweaverStaff.fit.bind=999;},TypeError);
});
test('invalid grip transforms and malformed requests are rejected',()=>{
    const candidate=clone();candidate.ironSword.gripRotation=[0,0,0,0];
    assert.throws(()=>validateEquipmentCatalogue(candidate,options),/Unnormalized/);
    for(const selection of [null,[],{mainHand:'constructor'},{torso:undefined}])assert.throws(()=>validateLoadout(selection));
});
test('the two-handed greatstaff occupies both hands and stays catalogue-valid',()=>{
    const greatstaff=items.graveweaverGreatstaff;
    assert.deepEqual([...greatstaff.occupies],['mainHand','offHand']);
    assert.equal(greatstaff.twoHanded,true);
    assert.throws(()=>validateLoadout({mainHand:'graveweaverGreatstaff',offHand:'graveweaverBook'}),/conflict/);
    validateLoadout({mainHand:'graveweaverGreatstaff',offHand:null});
});
test('interactive hand selection resolves conflict in the most recent direction',()=>{
    const armed={...EQUIPMENT_PRESETS.graveweaver.loadout};
    const greatstaff=resolveHandEquip(armed,{mainHand:'graveweaverGreatstaff'},items);
    assert.equal(greatstaff.mainHand,'graveweaverGreatstaff');
    assert.equal(greatstaff.offHand,null);
    const book=resolveHandEquip(greatstaff,{offHand:'graveweaverBook'},items);
    assert.equal(book.mainHand,null);
    assert.equal(book.offHand,'graveweaverBook');
    // A one-handed main hand and an off-hand still coexist.
    const sword=resolveHandEquip({mainHand:null,offHand:'graveweaverBook'},{mainHand:'ironSword'},items);
    assert.equal(sword.mainHand,'ironSword');
    assert.equal(sword.offHand,'graveweaverBook');
    // Setting both hands at once keeps the explicit one-handed main hand.
    const both=resolveHandEquip({...book,torso:'wayfarerTunic'},{mainHand:'graveweaverStaff',offHand:'graveweaverBook'},items);
    assert.equal(both.mainHand,'graveweaverStaff');
    assert.equal(both.offHand,'graveweaverBook');
});
