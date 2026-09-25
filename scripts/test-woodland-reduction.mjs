import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import fs from 'node:fs/promises';
import {generateVariants} from './ashen-reach/generate-woodland.mjs';

// Frozen c67765b full-variant bytes: any RNG, shape, normal or bark UV drift
// fails even if the generator and checked-in output drift together.
const hashes={
 ash:'b159715810b8039b5107a3c21f8a4e5f19d1a6d58d98379adf0f9a4e169634bc',
 oak:'433de24b207aa6ab2430c6cd0a902353c5db6453ddbb6d6475c6fc3d927213cd',
 'wind-ash':'72c0b64dd62c302b02765cbf3002a6bb0d7e35eb0108b15a9fb0e604e0520e0b',
};
const variants=await generateVariants();

test('full seeded variants remain byte-identical to the released woodland',()=>{
 assert.deepEqual(variants.map(v=>v.name),Object.keys(hashes));
 for(const {reduced,...full} of variants){
  assert.equal(createHash('sha256').update(JSON.stringify(full)).digest('hex'),hashes[full.name]);
  assert.equal(full.idx.length/3,1240);
 }
});

test('reduced branches reuse exact source vertices, normals and bark coordinates',()=>{
 const vertex=(mesh,i)=>[...mesh.p.slice(i*3,i*3+3),...mesh.n.slice(i*3,i*3+3),...mesh.u.slice(i*2,i*2+2)].join(',');
 for(const full of variants){
  const source=new Set(Array.from({length:full.p.length/3},(_,i)=>vertex(full,i)));
  const reduced=full.reduced,count=reduced.p.length/3;
  assert(reduced.idx.length/3>=300&&reduced.idx.length/3<=400);
  assert.equal(reduced.n.length,count*3);assert.equal(reduced.u.length,count*2);
  for(const values of Object.values(reduced))assert(values.every(Number.isFinite));
  for(let i=0;i<count;i++)assert(source.has(vertex(reduced,i)),`${full.name}: invented vertex ${i}`);
  // All original root stem rings are retained at the front, without rescaling.
  for(const [key,length] of [['p',90],['n',90],['u',60]])assert.deepEqual(reduced[key].slice(0,length),full[key].slice(0,length));
  for(let i=0;i<reduced.idx.length;i+=3){
   const indices=reduced.idx.slice(i,i+3);
   assert(indices.every(index=>Number.isInteger(index)&&index>=0&&index<count));
   const [a,b,c]=indices.map(index=>reduced.p.slice(index*3,index*3+3));
   const ab=b.map((v,j)=>v-a[j]),ac=c.map((v,j)=>v-a[j]);
   const cross=[ab[1]*ac[2]-ab[2]*ac[1],ab[2]*ac[0]-ab[0]*ac[2],ab[0]*ac[1]-ab[1]*ac[0]];
   assert(Math.hypot(...cross)>1e-12,`${full.name}: degenerate triangle ${i/3}`);
   const normal=[0,1,2].map(j=>indices.reduce((sum,index)=>sum+reduced.n[index*3+j],0));
   assert(cross.reduce((dot,v,j)=>dot+v*normal[j],0)>0,`${full.name}: reversed reduced face ${i/3}`);
  }
 }
});

test('checked-in woodland is the reproducible generator output',async()=>{
 const saved=JSON.parse(await fs.readFile(new URL('../public/ashen-reach/woodland/trees.json',import.meta.url),'utf8'));
 // JSON canonicalizes signed zero; compare the artifact bytes, keeping failure
 // output compact instead of dumping thousands of geometry coordinates.
 const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
 assert.equal(hash(saved.variants),hash(variants));
 assert.equal(hash(await generateVariants()),hash(variants));
});
