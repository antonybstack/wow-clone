import {test} from 'node:test';import assert from 'node:assert/strict';
import {TERRAIN_X,TERRAIN_Z,sampleTerrainSurface} from '../src/ashen-reach/terrain-grid.js';
import {height} from '../src/ashen-reach/geometry.js';
test('sampled floor follows rendered triangles across coarse-grid boundaries',()=>{
 for(const x of [TERRAIN_X[1],TERRAIN_X.at(-2),610,730,-610,-730])for(const z of [-1500,-95,0,145,785,1553]){
  const a=sampleTerrainSurface(x-1e-6,z,height),b=sampleTerrainSurface(x+1e-6,z,height);assert(Math.abs(a-b)<.001);
 }
 for(const [x,z] of [[1594,0],[-1594,0],[0,1649],[0,-1599]])assert(Number.isFinite(sampleTerrainSurface(x,z,height)));
 // A nonlinear source verifies the grid's exact diagonal, not bilinear blending.
 const f=(x,z)=>x*x+z*z+x*z,x=1594,z=0,x0=1498,x1=1626,z0=-1,z1=1,u=(x-x0)/(x1-x0),v=.5;
 const expected=f(x0,z0)*(1-u)+f(x1,z0)*(u-v)+f(x1,z1)*v;
 assert(Math.abs(sampleTerrainSurface(x,z,f)-expected)<1e-6);
});
