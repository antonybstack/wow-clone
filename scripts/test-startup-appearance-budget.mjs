import test from 'node:test';
import assert from 'node:assert/strict';
import {compactAppearanceBytes,maximumCompactAppearance} from './character-assets/startup-appearance-budget.mjs';
const asset=(url,encodedBytes)=>({url,encodedBytes,bytes:10000,compression:'gzip'});
const manifest=compactItems=>({items:Object.fromEntries(Object.keys(compactItems).map(id=>[id,{}])),compactItems});

test('authored off-hand transfer enters the maximum even without race garment entries',()=>{
 const shared={url:'/shield.glb',bytes:67352};
 const items={sword:{slot:'mainHand',factory:'sword',occupies:['mainHand']},
  shield:{slot:'offHand',factory:'authored',asset:shared,occupies:['offHand']},
  book:{slot:'offHand',factory:'book',occupies:['offHand']}};
 const m=manifest({body:asset('/body',100)});
 const cost=compactAppearanceBytes(m,{mainHand:'sword',offHand:'shield'},{items});
 assert.equal(cost.bytes,67452);assert.equal(cost.resources[1].url,shared.url);
 const report=maximumCompactAppearance([{id:'body',manifest:m}],{items,slots:['mainHand','offHand']});
 assert.deepEqual(report.maximum.equipment,{mainHand:'sword',offHand:'shield'});
 assert.equal(report.maximum.bytes,67452);
});

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

test('coverage-dependent body cost can make an uncovered outfit the maximum',()=>{
 const m=manifest({body:asset('/hair-body',100),hood:asset('/hood',20),coat:asset('/coat',40)});
 const profiles=[{id:'selected-hair',manifest:m}];
 const options={items:{hood:{slot:'helmet',occupies:['helmet']},coat:{slot:'torso',occupies:['torso']}},slots:['helmet','torso']};
 assert.equal(maximumCompactAppearance(profiles,options).maximum.bytes,160);
 const report=maximumCompactAppearance(profiles,{...options,resolveCompactItems:(profile,equipment)=>({
  ...profile.manifest.compactItems,body:equipment.helmet?asset('/covered-body',50):profile.manifest.compactItems.body,
 })});
 assert.equal(report.maximum.bytes,140);
 assert.deepEqual(report.maximum.equipment,{helmet:null,torso:'coat'});
 assert.equal(report.maximum.resources[0].url,'/hair-body');
});
