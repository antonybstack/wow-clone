import {test} from 'node:test';import assert from 'node:assert/strict';
import {terrainArmDistance} from '../src/camera-rig.js';
test('a low orbit stops above terrain while an unobstructed orbit keeps its zoom',()=>{
 const target={x:0,y:1.5,z:0},pitch=-.3,d=terrainArmDistance(target,0,pitch,8,()=>0);
 assert(d<8&&d>4);assert(target.y+Math.sin(pitch)*d>=.22);assert.equal(terrainArmDistance(target,0,.2,8,()=>0),8);
});
test('a ridge between camera and player shortens the arm even with a clear endpoint',()=>{
 const ground=(x,z)=>Math.abs(z+4)<1?2:0,d=terrainArmDistance({x:0,y:1.5,z:0},0,0,8,ground);
 assert(d<3.1&&d>2.9);assert.equal(terrainArmDistance({x:0,y:1.5,z:0},0,0,8,null),8);
});
