import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import sharp from 'sharp';
import {SURFACE_DETAIL_WGSL} from '../src/ashen-reach/surface-detail.js';
test('packed detail contains normalized GL normals and nonconstant roughness',async()=>{
 const {data,info}=await sharp('public/ashen-reach/stone-detail.png').raw().toBuffer({resolveWithObject:true});
 assert.equal(info.width,512);assert.equal(info.height,512);assert.equal(info.channels,4);
 let low=255,high=0;
 for(let i=0;i<data.length;i+=4*101){const n=[0,1,2].map(c=>data[i+c]/127.5-1);assert(Math.abs(Math.hypot(...n)-1)<.014);assert(n[2]>0);low=Math.min(low,data[i+3]);high=Math.max(high,data[i+3]);}
 assert(high-low>30);
});
test('world data uses continuous derivative frame, linear sampling and distance fade',async()=>{
 const s=await fs.readFile('src/ashen-reach/materials.js','utf8');
 assert.match(SURFACE_DETAIL_WGSL,/dpdx\(uv\)/);assert.match(SURFACE_DETAIL_WGSL,/max\(max\(dot/);
 assert.match(s,/srgb:false,mipMaps:true,minFilter:'linear',magFilter:'linear'/);
 assert.match(s,/smoothstep\(10.0,38.0/);assert.match(s,/packedDetail.a/);assert.match(s,/localSpecular\(i.p,materialN/);
});
test('positive GL green points upward on a masonry face with downward image V',()=>{
 assert.match(SURFACE_DETAIL_WGSL,/let bitangent=-\(perpendicular2\*duv1.y\+perpendicular1\*duv2.y\)/);
 // Front masonry face N=(0,0,-1), screen dpdx=(1,0,0), image duvdy=(0,1).
 const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
 const n=[0,0,-1],dpdx=[1,0,0],perpendicular1=cross(n,dpdx);
 const bitangent=perpendicular1.map(v=>-v);assert(bitangent[1]>0,'positive GL green must tilt the face normal upward');
});
