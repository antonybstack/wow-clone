import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {height,legacyHeight,buildingPads} from '../src/ashen-reach/geometry.js';
import {REGION_BOUNDS,REGIONAL_RIDGES,regionalRidgeCrest,applyRegionalTerrain,isProtectedTerrain} from '../src/ashen-reach/regional-terrain.js';

test('town, churchyard, pads and cathedral approach keep their exact pre-region elevations',()=>{
 const points=[];
 for(let x=-90;x<=90;x+=10)for(let z=-95;z<=145;z+=10)points.push([x,z]);
 for(let x=-45;x<=45;x+=9)for(let z=145;z<=370;z+=9)points.push([x,z]);
 assert.equal(createHash('sha256').update(JSON.stringify(points.map(([x,z])=>legacyHeight(x,z)))).digest('hex'),'1e0aa9b4fc3db57a257f798e15aa570439f6cc431e34a840c7a8f892df806cec');
 for(const [x,z] of [...points,...buildingPads.map(p=>[p.x,p.z])]){
  assert(isProtectedTerrain(x,z));
  assert.equal(height(x,z),legacyHeight(x,z));
  assert.equal(applyRegionalTerrain(x,z,123.45),123.45);
 }
});

test('three seeded crests retain the horizon radii and elevations as physical terrain',()=>{
 assert.deepEqual(REGIONAL_RIDGES.map(r=>[r.seed,r.rx,r.rz,r.minHeight,r.maxHeight]),[[7204,230,270,34,86],[7318,320,380,62,134],[7440,420,500,84,172]]);
 for(const ridge of REGIONAL_RIDGES){
  const crest=regionalRidgeCrest(ridge,0);
  assert(crest.height>=ridge.minHeight&&crest.height<=ridge.maxHeight);
  assert(Math.abs(applyRegionalTerrain(crest.x,crest.z,0)-crest.height)<1e-8);
  // Front and rear slopes are parts of the same surface, returning to the
  // underlying terrain beyond the outermost ridge instead of open shells.
  assert(applyRegionalTerrain(crest.x*.95,40,0)<crest.height);
  assert(applyRegionalTerrain(crest.x*1.05,40,0)<crest.height);
  const north=regionalRidgeCrest(ridge,Math.PI/2);
  if(ridge.seed===7204)assert(north.saddle>.99);
  if(ridge.seed===7318)assert(north.shift>69);
 }
 assert.equal(applyRegionalTerrain(800,40,27),27);
});

test('mountain surface stays finite and continuous across profile and protection seams',()=>{
 const points=[];
 for(let x=-600;x<=600;x+=12)for(let z=-620;z<=700;z+=12)points.push([x,z]);
 for(const ridge of REGIONAL_RIDGES)for(let a=-Math.PI;a<Math.PI;a+=.04){
  const crest=regionalRidgeCrest(ridge,a);
  for(const r of [.77,.89,1,1.18])points.push([crest.x*r,40+(crest.z-40-crest.shift)*r+crest.shift]);
 }
 for(const [x,z] of points){
  const base=legacyHeight(x,z),y=applyRegionalTerrain(x,z,base);
  assert(Number.isFinite(y));assert(y>=base);
  // A 1 mm displacement cannot create the metre-scale jumps that the previous
  // conditional northern shift or an angular-wrap discontinuity would cause.
  for(const [dx,dz] of [[.001,0],[0,.001]]){
   const next=applyRegionalTerrain(x+dx,z+dz,legacyHeight(x+dx,z+dz));
   assert(Math.abs(next-y)<.025,`terrain discontinuity at ${x},${z}`);
  }
 }
});

test('finite footprint stays explicit and terrain sampling introduces no coordinate clamp',()=>{
 assert.deepEqual(REGION_BOUNDS,{minX:-1626,maxX:1626,minZ:-1631,maxZ:1681});
 for(const x of [REGION_BOUNDS.minX,REGION_BOUNDS.maxX])for(const z of [REGION_BOUNDS.minZ,REGION_BOUNDS.maxZ])assert(Number.isFinite(height(x,z)));
 assert.equal(applyRegionalTerrain(1700,1700,12.3),12.3);
 assert.equal(applyRegionalTerrain(-1700,-1700,45.6),45.6);
});
