import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import HavokPhysics from '@babylonjs/havok';
import {createFreeCamera, createHavokWorld, createPhysicsAggregate, createTransformNode, PhysicsShapeType, physicsRaycast, disposePhysics} from '@babylonjs/lite';
import {pickTeleportSurface, teleportSurfacePosition} from '../src/ashen-reach/dev-surface-pick.js';

test('native Havok ray stops on the elevated deck before terrain, with CSS-sized picking', async () => {
  const hknp=await HavokPhysics({wasmBinary:await readFile(new URL('../node_modules/@babylonjs/havok/lib/esm/HavokPhysics.wasm',import.meta.url))});
  const scene={_beforeRender:[]},world=createHavokWorld(scene,hknp,{x:0,y:-9.8,z:0});
  const slab=(name,y,size)=>createPhysicsAggregate(world,createTransformNode(name,0,y,0),PhysicsShapeType.BOX,{mass:0,extents:size});
  slab('terrain',-.5,{x:200,y:1,z:200});
  slab('castle deck',19.5,{x:20,y:1,z:20});
  scene._beforeRender[0](16);
  const camera=createFreeCamera({x:0,y:30,z:-10},{x:0,y:20,z:0});
  camera.nearPlane=.1; camera.farPlane=500;
  const player={raycast:(from,to)=>physicsRaycast(world,from,to)};
  // Canvas backing size/DPR must not change the screen ray's CSS coordinates.
  const canvas={width:1280,height:720,getBoundingClientRect:()=>({left:50,top:30,width:640,height:360})};
  try {
    const hit=pickTeleportSurface(camera,canvas,player,370,210);
    assert(hit && Math.abs(hit.hitPoint.y-20)<1e-4 && hit.hitNormal.y>.99);
    const placement=teleportSurfacePosition(hit,1.748,.28);
    assert(placement.y-1.748/2>20,'feet stay above the deck, not the ground underneath');
    assert.equal(pickTeleportSurface(camera,canvas,player,49,210),null,'outside canvas is not a ray');
    const sky=createFreeCamera({x:0,y:30,z:-10},{x:0,y:40,z:0});
    assert.equal(pickTeleportSurface(sky,canvas,player,370,210),null,'sky miss cannot fall back to terrain');
  } finally {disposePhysics(world);}
});

test('upright capsule clearance remains outside walls, undersides and sloped roofs',()=>{
  const height=1.748,radius=.28;
  for(const n of [{x:1,y:0,z:0},{x:0,y:-1,z:0},{x:.6,y:.8,z:0}]){
    const p=teleportSurfacePosition({hitPoint:{x:0,y:30,z:0},hitNormal:n},height,radius);
    const separation=p.x*n.x+(p.y-30)*n.y+p.z*n.z;
    assert(separation>radius+(height/2-radius)*Math.abs(n.y),'capsule is outside contacted plane');
    if(n.y<=0)assert(p.y<=30,'do not lift through undersides');
  }
  assert.equal(teleportSurfacePosition({hitPoint:{x:0,y:30,z:0},hitNormal:{x:0,y:0,z:0}},height,radius),null);
});
