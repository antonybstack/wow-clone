import test from 'node:test';
import assert from 'node:assert/strict';
import {compactAppearanceBytes,maximumCompactAppearance} from './character-assets/startup-appearance-budget.mjs';
const asset=(url,encodedBytes)=>({url,encodedBytes,bytes:10000,compression:'gzip'});
const manifest=compactItems=>({items:Object.fromEntries(Object.keys(compactItems).map(id=>[id,{}])),compactItems});

test('payload cost uses encoded bytes and the runtime shared URL cache',()=>{
 const m=manifest({body:asset('/body',100),a:asset('/shared',50),b:asset('/shared',50)});
 assert.equal(compactAppearanceBytes(m,{torso:'a',legs:'b',mainHand:'procedural'}).bytes,150);
 m.compactItems.b.encodedBytes=51;
 assert.throws(()=>compactAppearanceBytes(m,{torso:'a',legs:'b'}),/Conflicting sizes/);
});

test('maximum obeys occupancy and chooses the largest current body plus valid gear',()=>{
 const items={great:{slot:'mainHand',occupies:['mainHand','offHand']},sword:{slot:'mainHand',occupies:['mainHand']},book:{slot:'offHand',occupies:['offHand']}};
 const pack=body=>manifest({body:asset('/body'+body,body),great:asset('/great',90),sword:asset('/sword',60),book:asset('/book',50)});
 const report=maximumCompactAppearance([{id:'small',manifest:pack(10)},{id:'large',manifest:pack(100)}],{items,slots:['mainHand','offHand']});
 assert.equal(report.enumerated,6);assert.equal(report.valid,5);assert.equal(report.maximum.profile,'large');
 assert.deepEqual(report.maximum.equipment,{mainHand:'sword',offHand:'book'});assert.equal(report.maximum.bytes,210);
 // Catalogue/asset growth automatically changes the fixture, unlike a frozen label.
 const grown=pack(100);grown.compactItems.great.encodedBytes=200;
 assert.deepEqual(maximumCompactAppearance([{id:'large',manifest:grown}],{items,slots:['mainHand','offHand']}).maximum.equipment,{mainHand:'great',offHand:null});
});

test('missing or invalid cost metadata cannot silently understate a release fixture',()=>{
 const m=manifest({body:asset('/body',100),armor:asset('/armor',20)});
 for(const value of [undefined,NaN,Infinity,-1,1.5]){
  m.compactItems.armor.encodedBytes=value;
  assert.throws(()=>compactAppearanceBytes(m,{torso:'armor'}),/encoded byte count/);
 }
 delete m.compactItems.armor;
 assert.throws(()=>compactAppearanceBytes(m,{torso:'armor'}),/Missing compact/);
 assert.throws(()=>maximumCompactAppearance([{id:'x',manifest:m}],{items:{missing:{slot:'torso'}},slots:['torso']}),/Missing prepared piece/);
});
