import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {brotliCompressSync} from 'node:zlib';
import {verifyStarterGeometry} from './ashen-reach/verify-starter-geometry.mjs';

// Small real Brotli packets exercise validation without rebuilding the region.
function fixture(change=()=>{}){
 const files=new Map();
 const encode=(prefix,raw)=>{
  const bytes=brotliCompressSync(raw),sha256=createHash('sha256').update(bytes).digest('hex');
  const file=`${prefix}-${sha256.slice(0,12)}.br`;files.set(file,bytes);
  return {compression:'http-br',file,sha256,encodedBytes:bytes.length,rawBytes:raw.length};
 };
 const pack=(prefix,blocks)=>{
  const bytes=[];let offset=0;
  const descriptors=blocks.map(({buffers,...block})=>({
   ...block,attributes:Object.fromEntries(Object.entries(buffers).map(([name,array])=>{
    const item={offset,length:array.length};const raw=Buffer.from(array.buffer,array.byteOffset,array.byteLength);bytes.push(raw);offset+=raw.length;return [name,item];
   })),
  }));
  return {...encode(prefix,Buffer.concat(bytes)),blocks:descriptors};
 };
 const triangle=(x)=>({positions:new Float32Array([x,0,0,x+1,0,0,x,0,1]),normals:new Float32Array([0,1,0,0,1,0,0,1,0]),uvs:new Float32Array(6),uv2:new Float32Array(6),colors:new Float32Array(12),indices:new Uint32Array([0,1,2])});
 const far={meshId:0,vertexOffset:3,indexOffset:3,buffers:triangle(5)};
 const near=pack('near',[{meshId:0,vertexOffset:0,indexOffset:0,buffers:triangle(0)}]);
 const manifest={meshes:[{name:'Earth',world:true,collision:true,material:0,vertices:6,indices:6}],foliage:{grass:{count:0,attributes:{matrices:{offset:near.rawBytes,length:0},colors:{offset:near.rawBytes,length:0}}}},geometry:near};
 const tile={cx:4,cz:4,count:1,buffers:{matrices:new Float32Array(16),colors:new Float32Array(4)}};
 const edits={far,tile,mesh:manifest.meshes[0]};change(edits);
 const full={meshId:1,vertexOffset:0,indexOffset:0,buffers:triangle(10)};
 if(edits.experimental)manifest.meshes.push({name:'Woodland 0,0 full',world:true,collision:false,material:0,vertices:3,indices:3});
 const geometry=pack('region',edits.experimental?[far,full]:[far]),foliageRaw=pack('foliage',[tile]);
 const foliage={...foliageRaw,pools:{grass:{count:edits.poolCount??1,tiles:foliageRaw.blocks}}};delete foliage.blocks;
 const index={schema:1,meshes:edits.indexMeshes??manifest.meshes,geometry,foliage};
 if(edits.experimental){
  const detail=structuredClone(full);edits.changeDetail?.(detail);
  index.experimentalCore={schema:1,core:pack('region-core',[far]),detail:pack('region-detail',[detail])};
 }
 if(edits.changeIndex)edits.changeIndex(index);
 manifest.geometry.region=encode('region-index',Buffer.from(JSON.stringify(index)));
 manifest.geometry.region.files=[geometry.file,foliage.file,...(index.experimentalCore?[index.experimentalCore.core.file,index.experimentalCore.detail.file]:[])];
 if(edits.experimental)manifest.geometry.region.experimentalCore=true;
 if(edits.changeManifest)edits.changeManifest(manifest);
 return {manifest,files,read:async file=>files.get(file)};
}

test('native Brotli region/index/foliage preserve complete storage coverage',async()=>{
 const f=fixture(),result=await verifyStarterGeometry(f.manifest,f.read);
 assert(result.region>0&&result.regionFoliage===80);
});

for(const [name,change,message]of [
 ['mismatched header',e=>{e.indexMeshes=[{name:'wrong'}];},/header differs/],
 ['unsupported schema',e=>{e.changeIndex=index=>{index.schema=2;};},/header differs/],
 ['wrong dependency list',e=>{e.changeManifest=m=>{m.geometry.region.files=['unrelated.br'];};},/files|dependenc/],
 ['missing range',e=>{e.changeIndex=index=>{index.geometry.blocks=[];};},/packet/],
 ['storage gap',e=>{e.far.vertexOffset=4;},/gap or overlap/],
 ['duplicate storage range',e=>{e.changeIndex=index=>{index.geometry.blocks.push(index.geometry.blocks[0]);};},/packet layout|geometry block/],
 ['attribute shape',e=>{e.far.buffers.normals=new Float32Array(6);},/attribute lengths/],
 ['index beyond local vertices',e=>{e.far.buffers.indices[2]=3;},/vertex range/],
 ['nonfinite geometry',e=>{e.far.buffers.positions[0]=NaN;},/nonfinite/],
 ['foliage total mismatch',e=>{e.poolCount=2;},/foliage count/],
 ['foliage matrix shape',e=>{e.tile.buffers.matrices=new Float32Array(12);},/foliage tile/],
])test(`prepared region refuses ${name}`,async()=>{const f=fixture(change);await assert.rejects(verifyStarterGeometry(f.manifest,f.read),message);});

test('prepared region refuses corrupt immutable packet bytes',async()=>{
 const f=fixture(),name=f.manifest.geometry.region.file,bytes=Buffer.from(f.files.get(name));bytes[bytes.length-1]^=1;f.files.set(name,bytes);
 await assert.rejects(verifyStarterGeometry(f.manifest,f.read),/Corrupt prepared region index/);
});

test('experimental core/detail reproduce every existing block byte with exact aggregate coverage',async()=>{
 const f=fixture(e=>{e.experimental=true;});await verifyStarterGeometry(f.manifest,f.read);
});
for(const [name,change,message]of [
 ['missing core range',e=>{e.changeIndex=i=>{i.experimentalCore.core.blocks=[];};},/omits/],
 ['duplicate range',e=>{e.changeIndex=i=>{i.experimentalCore.detail.blocks.push(i.experimentalCore.detail.blocks[0]);};},/changes or misclassifies/],
 ['collision in detail',e=>{e.changeIndex=i=>{i.experimentalCore.detail.blocks.push(i.experimentalCore.core.blocks.pop());};},/misclassifies/],
 ['full trees in core',e=>{e.changeIndex=i=>{i.experimentalCore.core.blocks.push(i.experimentalCore.detail.blocks.pop());};},/misclassifies/],
 ['changed detail bytes',e=>{e.changeDetail=b=>{b.buffers.positions[0]+=1;};},/bytes differ/],
 ['unsupported package schema',e=>{e.changeIndex=i=>{i.experimentalCore.schema=2;};},/Unsupported/],
 ['missing candidate declaration',e=>{e.changeManifest=m=>{delete m.geometry.region.experimentalCore;};},/declaration differs/],
])test(`experimental region refuses ${name}`,async()=>{
 const f=fixture(e=>{e.experimental=true;change(e);});await assert.rejects(verifyStarterGeometry(f.manifest,f.read),message);
});
