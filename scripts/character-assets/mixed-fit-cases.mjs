/** Bounded visual regression cases, not exhaustive catalogue acceptance.
 * Slot adjacency comes from the existing semantic seam contract; deliberate
 * triples add hood/shoulder/hair and wrist/prop interactions it cannot express.
 * Native skins/morphs remain the deformation authority:
 * https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#skins
 */
import {EQUIPMENT_SLOTS, validateLoadout} from '../../src/ashen-reach/equipment-catalog.js';
const outfit = patch => Object.freeze({...Object.fromEntries(EQUIPMENT_SLOTS.map(s => [s, null])), ...patch});
export const MIXED_FIT_CASES = Object.freeze([
 ['cloth-plate', {torso:'pilgrimTunic',legs:'duskguardTassets',boots:'wayfarerBoots',gloves:'graveweaverGloves',shoulders:'bastionShoulders',mainHand:'ironSword',offHand:'graveweaverBook'}],
 ['plate-robe', {torso:'duskguardCuirass',legs:'graveweaverSkirt',boots:'duskguardGreaves',gloves:'graveweaverGloves',helmet:'graveweaverHood',shoulders:'bastionShoulders',mainHand:'graveweaverGreatstaff'}],
 ['coat-plate', {torso:'lectorCoat',legs:'duskguardTassets',boots:'duskguardGreaves',gloves:'duskguardVambraces',shoulders:'wardenPauldrons',mainHand:'graveweaverStaff',offHand:'graveweaverBook'}],
 ['mail-robe', {torso:'wayfarerTunic',legs:'graveweaverSkirt',boots:'duskguardGreaves',gloves:'duskguardVambraces',helmet:'graveweaverHood',shoulders:'wardenPauldrons',mainHand:'ironSword'}],
 ['vestment-trousers', {torso:'graveweaverTop',legs:'wayfarerTrousers',boots:'wayfarerBoots',gloves:'duskguardVambraces',shoulders:'bastionShoulders',mainHand:'graveweaverStaff',offHand:'graveweaverBook'}],
 ['open-cuffs', {torso:'pilgrimTunic',legs:'duskguardTassets',mainHand:'ironSword'}],
 ['exposed-upper', {legs:'wayfarerTrousers',boots:'duskguardGreaves',gloves:'graveweaverGloves',helmet:'graveweaverHood',shoulders:'bastionShoulders'}],
 ['exposed-lower', {torso:'lectorCoat',boots:'wayfarerBoots',gloves:'duskguardVambraces',mainHand:'graveweaverGreatstaff'}],
 // Gap cases supplement the eight risk cases and earlier reviewed presets.
 // They cover the remaining 22 adjacent seam pairs (including empty slots).
 ['hood-coat-robe', {helmet:'graveweaverHood',torso:'lectorCoat',legs:'graveweaverSkirt',boots:'wayfarerBoots',shoulders:'bastionShoulders'}],
 ['bare-plate', {legs:'duskguardTassets',boots:'duskguardGreaves',gloves:'duskguardVambraces',shoulders:'wardenPauldrons'}],
 ['bare-robe', {legs:'graveweaverSkirt'}],
 ['cuirass-bare', {torso:'duskguardCuirass',boots:'duskguardGreaves'}],
 ['cuirass-trousers', {torso:'duskguardCuirass',legs:'wayfarerTrousers',gloves:'graveweaverGloves',shoulders:'bastionShoulders'}],
 ['vestment-bare', {torso:'graveweaverTop',boots:'wayfarerBoots',gloves:'duskguardVambraces',shoulders:'wardenPauldrons'}],
 ['vestment-plate', {torso:'graveweaverTop',legs:'duskguardTassets',boots:'duskguardGreaves',gloves:'graveweaverGloves'}],
 ['mail-bare', {torso:'wayfarerTunic',boots:'duskguardGreaves',gloves:'graveweaverGloves',shoulders:'bastionShoulders'}],
 ['mail-plate', {torso:'wayfarerTunic',legs:'duskguardTassets',boots:'wayfarerBoots',gloves:'graveweaverGloves',shoulders:'wardenPauldrons'}],
 ['pilgrim-bare', {torso:'pilgrimTunic',boots:'wayfarerBoots',gloves:'duskguardVambraces'}],
].map(([id, patch]) => {const loadout=outfit(patch);validateLoadout(loadout);return Object.freeze({id,loadout});}));
export const MIXED_FIT_PROFILES = Object.freeze([
 {id:'original',race:'human',identity:'starter',height:1,build:0},
 {id:'prime-bald',race:'human',identity:'prime-bald',height:1,build:0},
 {id:'ponytail-tall-slender',race:'human',identity:'prime-ponytail',height:1.15,build:-.95},
 {id:'ponytail-short-stout',race:'human',identity:'prime-ponytail',height:.9,build:.95},
 {id:'weathered-tall-stout',race:'human',identity:'weathered-bald',height:1.15,build:.95},
 {id:'weathered-short-slender',race:'human',identity:'weathered-bald',height:.9,build:-.95},
 {id:'orc',race:'orc',height:1,build:0},
 {id:'undead',race:'undead',height:1,build:0},
].map(Object.freeze));

/** Earlier reviewed M5 presets/cases are reused as evidence, not recaptured.
 * docs/plans/character-mmo/results/m5-saved-fits-2026-10-04.md
 * Pair coverage describes test inputs only; it never accepts a rendered seam.
 */
export const PRIOR_FIT_LOADOUTS = Object.freeze([
 outfit({"torso":"lectorCoat","legs":"wayfarerTrousers","boots":"wayfarerBoots","mainHand":"graveweaverStaff","offHand":"graveweaverBook"}),
 outfit({"torso":"duskguardCuirass","legs":"duskguardTassets","boots":"duskguardGreaves","gloves":"duskguardVambraces","mainHand":"ironSword","shoulders":"wardenPauldrons"}),
 outfit({"torso":"wayfarerTunic","legs":"wayfarerTrousers","boots":"wayfarerBoots","mainHand":"ironSword"}),
 outfit({"torso":"pilgrimTunic","legs":"wayfarerTrousers","boots":"wayfarerBoots"}),
 outfit({"helmet":"graveweaverHood","torso":"graveweaverTop","legs":"graveweaverSkirt","boots":"wayfarerBoots","gloves":"graveweaverGloves","mainHand":"graveweaverStaff","offHand":"graveweaverBook"}),
 outfit({"helmet":"graveweaverHood","torso":"graveweaverTop","legs":"graveweaverSkirt","boots":"wayfarerBoots","gloves":"graveweaverGloves","mainHand":"graveweaverGreatstaff"}),
 outfit({"helmet":"graveweaverHood","torso":"graveweaverTop","legs":"graveweaverSkirt"}),
 outfit({}),
 outfit({"helmet":"graveweaverHood","torso":"pilgrimTunic","legs":"graveweaverSkirt","boots":"wayfarerBoots","gloves":"graveweaverGloves","mainHand":"graveweaverStaff","offHand":"graveweaverBook","shoulders":"wardenPauldrons"}),
 outfit({"torso":"lectorCoat","legs":"duskguardTassets","boots":"duskguardGreaves","gloves":"graveweaverGloves","mainHand":"ironSword","offHand":"graveweaverBook","shoulders":"wardenPauldrons"}),
]);
