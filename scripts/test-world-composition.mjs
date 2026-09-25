import test from 'node:test';
import assert from 'node:assert/strict';
import {pathVegetation} from '../src/ashen-reach/world-composition.js';
test('walk line stays clear through churchyard, transition, gateway and town',()=>{
 for(const z of [-95,0,25,28,32,40,48,76,100,145]){
  for(const d of [-1,-.5,0,.5,1])assert.equal(pathVegetation(d,z),0);
  assert.equal(pathVegetation(5,z),1);
 }
});
test('plant footprint is protected and verge grows smoothly and symmetrically',()=>{
 for(const z of [0,32,90]){
  assert.equal(pathVegetation(1.5,z,.6),0);
  let previous=0;
  for(let d=0;d<5;d+=.05){const v=pathVegetation(d,z,.6);assert(v>=previous&&v<=1);assert.equal(v,pathVegetation(-d,z,.6));previous=v;}
 }
 assert.equal(pathVegetation(0,200),1);
});
