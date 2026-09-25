import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Batch} from '../src/ashen-reach/geometry.js';
import {appendWoodlandTree} from '../src/ashen-reach/woodland.js';

const library=JSON.parse(fs.readFileSync(new URL('../public/ashen-reach/woodland/trees.json',import.meta.url),'utf8'));
test('seeded woodland library has finite normalized geometry within budget',()=>{
 assert.equal(library.license,'MIT');assert.equal(library.variants.length,3);
 assert.equal(new Set(library.variants.map(v=>v.seed)).size,3);
 for(const v of library.variants){
  const count=v.p.length/3;
  assert.equal(v.n.length,count*3);assert.equal(v.u.length,count*2);
  for(const key of ['p','n','u'])assert(v[key].every(Number.isFinite));
  assert(v.idx.every(i=>Number.isInteger(i)&&i>=0&&i<count));
  assert(v.idx.length/3<=1300);assert(v.idx.length/3>=500);
  const ys=v.p.filter((_,i)=>i%3===1);
  assert.equal(Math.min(...ys),0);assert.equal(Math.max(...ys),1);
 }
});
test('append preserves prior geometry and produces normalized transformed normals',()=>{
 const b=new Batch('test');b.tri([0,0,0],[1,0,0],[0,1,0]);
 const first=b.p.slice(),indices=b.idx.slice();
 for(const kind of [.01,.5,.99])appendWoodlandTree(b,library.variants,{x:100,z:200,y:30,height:14,kind,lean:[.3,-.2]});
 assert.deepEqual(b.p.slice(0,first.length),first);assert.deepEqual(b.idx.slice(0,indices.length),indices);
 assert(b.idx.slice(3).every(i=>i>=3&&i<b.p.length/3));
 for(let i=9;i<b.n.length;i+=3)assert(Math.abs(Math.hypot(...b.n.slice(i,i+3))-1)<1e-6);
 const ys=b.p.slice(9).filter((_,i)=>i%3===1);
 assert.equal(Math.min(...ys),30);assert.equal(Math.max(...ys),44);
 assert(b.p.every(Number.isFinite));
});
