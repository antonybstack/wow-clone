import test from 'node:test';import assert from 'node:assert/strict';import {Batch} from '../src/ashen-reach/geometry.js';import {building} from '../src/ashen-reach/buildings.js';
test('Hollowmere chapel has a clear 2.4 metre doorway, floor and physical walls',()=>{
 const colliders=[],stone=new Batch('stone');building({stone,glow:new Batch('glow'),groundHeight:()=>7.108,colliders,lights:[]},{x:7.4,z:114,w:6.6,d:7.6,yaw:Math.PI,wallH:3.2,roofH:2.4,kind:'chapel',steeple:true,enterable:true});
 const occupied=([x,y,z])=>colliders.some(b=>{const yaw=b.rotation?.y||0,dx=x-b.position.x,dz=z-b.position.z,u=dx*Math.cos(yaw)-dz*Math.sin(yaw),v=dx*Math.sin(yaw)+dz*Math.cos(yaw);return Math.abs(u)<b.size.x/2&&Math.abs(y-b.position.y)<b.size.y/2&&Math.abs(v)<b.size.z/2;});
 for(const z of [112.91,114,115.09])for(const y of [7.5,8.2,9.65])assert(!occupied([4.15,y,z]),'Door opening blocked');
 assert(occupied([7.4,7.2,114]),'Floor missing');assert(occupied([7.4,8,110.2]),'Side wall missing');assert(occupied([10.62,8,114]),'Back wall missing');assert(!occupied([7.4,8.2,114]),'Interior must be open');
});
