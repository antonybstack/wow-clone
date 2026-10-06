/** Keep the bounded visual input set honest when the wardrobe grows.
 * This checks pair coverage, not the quality of the screenshots or motion.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {EQUIPMENT_ITEMS, validateLoadout} from '../src/ashen-reach/equipment-catalog.js';
import {SLOT_SEAMS} from '../src/ashen-reach/coverage-contract.js';
import {MIXED_FIT_CASES,PRIOR_FIT_LOADOUTS} from './character-assets/mixed-fit-cases.mjs';
const slots=Object.keys(SLOT_SEAMS).filter(s=>SLOT_SEAMS[s].length);
const adjacent=slots.flatMap((a,i)=>slots.slice(i+1).filter(b=>SLOT_SEAMS[a].some(s=>SLOT_SEAMS[b].includes(s))).map(b=>[a,b]));
const values=s=>[null,...Object.values(EQUIPMENT_ITEMS).filter(i=>i.slot===s).map(i=>i.id)];
const keys=l=>adjacent.map(([a,b])=>JSON.stringify([a,l[a],b,l[b]]));
const required=adjacent.flatMap(([a,b])=>values(a).flatMap(x=>values(b).map(y=>JSON.stringify([a,x,b,y]))));
const missing=loadouts=>{const seen=new Set(loadouts.flatMap(keys));return required.filter(k=>!seen.has(k));};
const loadouts=[...PRIOR_FIT_LOADOUTS,...MIXED_FIT_CASES.map(c=>c.loadout)];
test('Current mixed cases plus prior reviewed presets cover every adjacent seam value, including empty',()=>{
 for(const loadout of loadouts)validateLoadout(loadout);
 assert.equal(new Set(MIXED_FIT_CASES.map(c=>c.id)).size,MIXED_FIT_CASES.length);
 assert.equal(required.length,84);assert.deepEqual(missing(loadouts),[]);
});
test('Removing hood/coat observations exposes the missing seam pair',()=>{
 const reduced=loadouts.filter(l=>!(l.helmet==='graveweaverHood'&&l.torso==='lectorCoat'));
 assert(missing(reduced).some(k=>k.includes('graveweaverHood')&&k.includes('lectorCoat')));
});
