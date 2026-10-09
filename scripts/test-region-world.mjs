import test from 'node:test';import assert from 'node:assert/strict';import {Batch,height} from '../src/ashen-reach/geometry.js';import {buildRegionWorld} from '../src/ashen-reach/region-world.js';
test('road miters face upward individually and every visible surface has matching collision',()=>{const stone=new Batch('roads'),rock=new Batch('cliffs'),world=buildRegionWorld({stone,rock,groundHeight:height});assert(world.roadTriangles>100);assert.equal(world.boundarySegments,512);assert.equal(world.collisionBatch.idx.length,stone.idx.length+rock.idx.length);for(const v of stone.n)assert(Number.isFinite(v));for(let i=1;i<stone.n.length;i+=3)assert(stone.n[i]>=-.00001,'Inverted road face can drop a Havok capsule through a corner');assert(rock.p.every(Number.isFinite));});

for(const [name,x0,x1,z0,z1] of [['east',108,135,91,121],['west',-130,-78,125,156]])test(`the shared ${name} fork has one physical road height across overlapping branches`,()=>{
 const stone=new Batch('roads'),rock=new Batch('cliffs');buildRegionWorld({stone,rock,groundHeight:height});
 const triangles=[];
 for(let i=0;i<stone.idx.length;i+=3){
  const ids=stone.idx.slice(i,i+3);if(stone.n[ids[0]*3+1]>.5)triangles.push(ids.map(j=>stone.p.slice(j*3,j*3+3)));
 }
 const sub=(a,b)=>a.map((v,i)=>v-b[i]),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
 let overlaps=0;
 for(let x=x0;x<=x1;x+=.5)for(let z=z0;z<=z1;z+=.5){
  const origin=[x,60,z],direction=[0,-60,0],ys=[];
  for(const [a,b,c] of triangles){
   const ab=sub(b,a),ac=sub(c,a),p=cross(direction,ac),det=dot(ab,p);if(Math.abs(det)<1e-9)continue;
   const t=sub(origin,a),u=dot(t,p)/det;if(u< -1e-7||u>1+1e-7)continue;
   const q=cross(t,ab),v=dot(direction,q)/det;if(v< -1e-7||u+v>1+1e-7)continue;
   const fraction=dot(ac,q)/det;if(fraction>=0&&fraction<=1)ys.push(60-fraction*60);
  }
  if(ys.length>1){overlaps++;assert(Math.max(...ys)-Math.min(...ys)<.001,`Shared road ledge at ${x},${z}: ${ys}`);}
 }
 assert(overlaps>50,'Sample actual overlapping road faces, not only a route centreline');
});
