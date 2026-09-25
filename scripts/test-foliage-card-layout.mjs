import {test} from 'node:test';
import assert from 'node:assert/strict';
import {grassCardLayout} from '../src/ashen-reach/foliage-card-layout.js';
test('near and far grass share their first two cards exactly',()=>{
 for(const [h,w] of [[.74,.26],[1,.42]]){
  const near=Array.from({length:3},(_,i)=>grassCardLayout(i,h,w));
  const far=Array.from({length:2},(_,i)=>grassCardLayout(i,h,w));
  assert.deepEqual(near.slice(0,2),far);
  assert.equal(near[2].rootWeight,2);assert.equal(near[2].tipWeight,3);
  assert.equal(near[0].rootWeight,0);assert.equal(near[0].tipWeight,1);
 }
});
