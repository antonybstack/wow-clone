import test from 'node:test';
import assert from 'node:assert/strict';
import {createTerrainCornerCache,TERRAIN_X,TERRAIN_Z} from '../src/ashen-reach/terrain-grid.js';
import {height,legacyHeight,terrainNormal} from '../src/ashen-reach/geometry.js';

test('outer-grid corner cache retains exact surface, normal and mountain classification',()=>{
 const xs=TERRAIN_X,zs=TERRAIN_Z;
 const cache=createTerrainCornerCache(xs,zs,height,terrainNormal,legacyHeight);
 const sampled=new Set();
 // Full finite grid, including protected center, mountain crests, and cliff edge.
 for(let zi=0;zi<zs.length-1;zi++)for(let xi=0;xi<xs.length-1;xi++){
  const x=xs[xi],x1=xs[xi+1],z=zs[zi],z1=zs[zi+1];
  if(x>=-90&&x1<=90&&z>=-95&&z1<=145)continue;
  const cached=[cache.get(xi,zi),cache.get(xi+1,zi),cache.get(xi+1,zi+1),cache.get(xi,zi+1)];
  const direct=[[x,z],[x1,z],[x1,z1],[x,z1]].map(([a,b])=>[a,height(a,b),b]);
  for(let i=0;i<4;i++){
   const key=`${direct[i][0]},${direct[i][2]}`;
   if(!sampled.has(key)){
    assert.deepEqual(cached[i].position,direct[i]);
    assert.deepEqual(cached[i].normal,terrainNormal(direct[i][0],direct[i][2]));
    sampled.add(key);
   }
  }
  const old=direct.some(p=>p[1]-legacyHeight(p[0],p[2])>5)&&Math.hypot(x,z-40)>180;
  const next=cached.some(c=>c.position[1]-cache.legacy(c)>5)&&Math.hypot(x,z-40)>180;
  assert.equal(next,old);
 }
 assert(sampled.size>50000);
});

test('two-row cache evaluates each shared corner once and expires old rows',()=>{
 const xs=[-4,-2,0,2],zs=[0,2,4,6];let heights=0,normals=0,legacy=0;
 const cache=createTerrainCornerCache(xs,zs,(x,z)=>{heights++;return x+z;},(x,z)=>{normals++;return [x,1,z];},(x,z)=>{legacy++;return x-z;});
 for(let zi=0;zi<3;zi++)for(let xi=0;xi<3;xi++){
  const c=[cache.get(xi,zi),cache.get(xi+1,zi),cache.get(xi+1,zi+1),cache.get(xi,zi+1)];
  for(const p of c){assert.equal(cache.legacy(p),p.position[0]-p.position[2]);}
 }
 assert.equal(heights,16);assert.equal(normals,16);assert.equal(legacy,16);
 const last=cache.get(0,3);assert.strictEqual(last,cache.get(0,3));
 const oldRow=cache.get(0,1);assert.equal(heights,17);
 assert.notStrictEqual(oldRow,cache.get(0,3));assert.equal(heights,18);
});
