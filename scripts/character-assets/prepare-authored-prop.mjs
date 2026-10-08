/** Isolated rigid hand-prop authoring. It does not publish a catalogue item.
 * Reuse native Blender export and NodeIO rather than constructing runtime meshes.
 * https://docs.blender.org/manual/en/latest/advanced/command_line/arguments.html
 * https://gltf-transform.dev/modules/core/classes/NodeIO
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn,execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {NodeIO,VertexLayout} from '@gltf-transform/core';
import {assertGlbContainer,canonicalizeFactoryTriangles,PINNED_BLENDER,sha256} from './equipment-factory-contract.mjs';

const identity=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
export function validatePropDescriptor(d){
 if(d?.schema!==1||d.deformation!=='rigid-prop'||d.slot!=='offHand')throw Error('Unsupported rigid prop descriptor');
 for(const key of ['id','mesh'])if(typeof d[key]!=='string'||!/^B?[A-Za-z][A-Za-z0-9]{1,63}$/.test(d[key]))throw Error('Invalid prop identity');
 if(d.blenderVersion!==PINNED_BLENDER)throw Error('Unpinned Blender prop authoring');
 if(!d.builder?.path?.startsWith('scripts/character-assets/')||!/^[a-f0-9]{64}$/.test(d.builder.sha256))throw Error('Unpinned prop builder');
 if(d.sourceRights?.kind!=='original-project-geometry')throw Error('Missing authored prop rights');
 if(d.grip?.origin?.length!==3||d.grip.origin.some(x=>x!==0)||d.grip.axis!=='X'||d.grip.front!=='+Z'||d.grip.up!=='+Y')throw Error('Unsupported grip frame');
 if(!Array.isArray(d.materials)||d.materials.length!==3||new Set(d.materials.map(x=>x.name)).size!==3)throw Error('Prop needs three distinct declared material groups');
 for(const m of d.materials){
  if(typeof m.name!=='string'||!Array.isArray(m.baseColor)||m.baseColor.length!==4||m.baseColor.some(x=>!Number.isFinite(x)||x<0||x>1)||m.baseColor[3]!==1
   ||![m.metallic,m.roughness].every(x=>Number.isFinite(x)&&x>=0&&x<=1))throw Error('Invalid prop material policy');
 }
 if(!Number.isSafeInteger(d.detail?.triangles)||d.detail.triangles<1||d.detail.triangles>2200||!Number.isSafeInteger(d.detail.bytes)||d.detail.bytes<1||d.detail.bytes>98304)throw Error('Invalid prop cost budget');
 if(!Array.isArray(d.detail.minSize)||!Array.isArray(d.detail.maxSize)||d.detail.minSize.length!==3||d.detail.maxSize.length!==3
  ||d.detail.minSize.some((v,i)=>!Number.isFinite(v)||v<=0||!Number.isFinite(d.detail.maxSize[i])||v>d.detail.maxSize[i]))throw Error('Invalid prop dimension budget');
 return d;
}

/** Re-read the written artifact. A rigid prop must never borrow the actor palette.
 * https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#meshes
 */
export async function verifyAuthoredProp(io,bytes,d){
 validatePropDescriptor(d);assertGlbContainer(bytes);
 if(bytes.length>d.detail.bytes)throw Error('Prop exceeds byte budget');
 const json=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());
 if(json.extensionsUsed?.length||json.extensionsRequired?.length||json.buffers?.some(b=>b.uri)||json.images?.length)throw Error('Prop contains undeclared external resource or extension');
 const root=(await io.readBinary(bytes)).getRoot();
 if(root.listSkins().length||root.listAnimations().length||root.listTextures().length||root.listExtensionsUsed().length)throw Error('Prop contains undeclared rig, motion, texture or extension');
 if(root.listMeshes().length!==1||root.listMeshes()[0].getName()!==d.mesh||root.listScenes().length!==1)throw Error('Unexpected prop mesh/scene');
 const mesh=root.listMeshes()[0],nodes=root.listNodes();
 if(nodes.length!==1||root.getDefaultScene()!==root.listScenes()[0]||root.listScenes()[0].listChildren().length!==1||root.listScenes()[0].listChildren()[0]!==nodes[0]||nodes[0].getMesh()!==mesh||nodes[0].getMatrix().some((v,i)=>Math.abs(v-identity[i])>1e-7))throw Error('Prop grip frame is not an identity mesh');
 const materials=root.listMaterials();
 if(materials.length!==d.materials.length)throw Error('Prop material group mismatch');
 for(const m of materials){
  const policy=d.materials.find(x=>x.name===m.getName());
  if(!policy||m.getBaseColorFactor().some((v,i)=>Math.abs(v-policy.baseColor[i])>2e-6)||Math.abs(m.getMetallicFactor()-policy.metallic)>2e-6||Math.abs(m.getRoughnessFactor()-policy.roughness)>2e-6
   ||m.getAlphaMode()!=='OPAQUE'||m.getDoubleSided())throw Error('Prop material differs from authored policy');
 }
 const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];let vertices=0,triangles=0;
 const groupNames=[];
 for(const p of mesh.listPrimitives()){
  if(p.getMode()!==4||p.listTargets().length||p.listSemantics().some(s=>!['POSITION','NORMAL'].includes(s)))throw Error('Unexpected prop vertex policy');
  const positions=p.getAttribute('POSITION')?.getArray(),normals=p.getAttribute('NORMAL')?.getArray(),indices=p.getIndices()?.getArray();
  if(!positions?.length||positions.length%3||normals?.length!==positions.length||!indices?.length||indices.length%3
   ||p.getAttribute('POSITION').getType()!=='VEC3'||p.getAttribute('NORMAL').getType()!=='VEC3'
   ||Array.from(positions).some(v=>!Number.isFinite(v))||Array.from(normals).some(v=>!Number.isFinite(v))
   ||Array.from(indices).some(v=>!Number.isSafeInteger(v)||v<0||v>=positions.length/3))throw Error('Malformed prop geometry');
  for(let i=0;i<positions.length;i+=3){
   for(let k=0;k<3;k++){min[k]=Math.min(min[k],positions[i+k]);max[k]=Math.max(max[k],positions[i+k]);}
   if(Math.abs(Math.hypot(...normals.slice(i,i+3))-1)>2e-4)throw Error('Invalid prop normal');
  }
  const edges=new Map();let signedVolume=0;
  const vertexKey=i=>positions.slice(i*3,i*3+3).join(',');
  for(let i=0;i<indices.length;i+=3){
   const a=indices[i]*3,b=indices[i+1]*3,c=indices[i+2]*3;
   const u=[0,1,2].map(k=>positions[b+k]-positions[a+k]),v=[0,1,2].map(k=>positions[c+k]-positions[a+k]);
   const cross=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
   if(Math.hypot(...cross)<1e-10)throw Error('Degenerate prop triangle');
   if(cross.reduce((sum,v,k)=>sum+v*normals[a+k],0)<=0)throw Error('Prop normal disagrees with triangle winding');
   signedVolume+=(positions[a]*cross[0]+positions[a+1]*cross[1]+positions[a+2]*cross[2])/6;
   for(let e=0;e<3;e++){
    const from=vertexKey(indices[i+e]),to=vertexKey(indices[i+(e+1)%3]),key=[from,to].sort().join('|');
    const edge=edges.get(key)||{count:0,direction:0};edge.count++;edge.direction+=from<to?1:-1;edges.set(key,edge);
   }
  }
  // Native exporters split vertices at hard normals. Match exact positions to
  // verify the visible closed surface independently of those attribute splits.
  // A watertight board cannot be accepted from nondegenerate triangles alone.
  // https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#meshes
  if([...edges.values()].some(e=>e.count!==2||e.direction!==0)||signedVolume<=0)throw Error('Prop surface is open or inward-facing');
  groupNames.push(p.getMaterial()?.getName());vertices+=positions.length/3;triangles+=indices.length/3;
 }
 if(groupNames.length!==3||new Set(groupNames).size!==3||groupNames.some(n=>!d.materials.some(m=>m.name===n)))throw Error('Prop draw/material group budget exceeded');
 const size=max.map((v,i)=>v-min[i]);
 if(size.some((v,i)=>v<d.detail.minSize[i]||v>d.detail.maxSize[i])||triangles>d.detail.triangles)throw Error('Prop dimensions/triangle budget exceeded');
 return {mesh:d.mesh,vertices,triangles,materialGroups:groupNames,bounds:{min,max,size},skins:0,animations:0,textures:0,bytes:bytes.length,sha256:sha256(bytes)};
}

export async function prepareAuthoredProp(descriptorPath,out,{repeat=false}={}){
 const descriptorBytes=await fs.readFile(descriptorPath),d=validatePropDescriptor(JSON.parse(descriptorBytes));
 const rel=path.relative(path.resolve('.cache'),path.resolve(out));
 if(!rel||rel.startsWith('..')||path.isAbsolute(rel))throw Error('Prop output must be isolated under .cache');
 const builderBytes=await fs.readFile(d.builder.path);
 if(sha256(builderBytes)!==d.builder.sha256)throw Error('Prop builder hash mismatch');
 const blender=process.env.ASHEN_BLENDER||'/Applications/Blender.app/Contents/MacOS/Blender';
 const version=execFileSync(blender,['--version'],{encoding:'utf8'}).trim();
 if(!version.startsWith(`Blender ${PINNED_BLENDER} `))throw Error('Wrong native Blender version');
 const io=new NodeIO().setVertexLayout(VertexLayout.SEPARATE),artifacts=[];
 await fs.mkdir(out,{recursive:true});
 for(let i=1;i<=(repeat?2:1);i++){
  const dir=path.join(out,`build-${i}`);await fs.mkdir(dir);
  const raw=path.join(dir,'raw.glb'),blend=path.join(dir,'source.blend');
  const log=await fs.open(path.join(dir,'blender.log'),'w');
  try{
   const child=spawn(blender,['--background','--factory-startup','--python-exit-code','1','--python',d.builder.path],{
    env:{PATH:process.env.PATH,HOME:process.env.HOME,TMPDIR:process.env.TMPDIR,ASHEN_PROP_DESCRIPTOR:JSON.stringify(d),ASHEN_PROP_OUT:raw,ASHEN_PROP_BLEND:blend},
    stdio:['ignore',log.fd,log.fd],timeout:120000});
   await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',(code,signal)=>code===0?resolve():reject(Error(`Native prop authoring failed: ${signal||code}`)));});
  }finally{await log.close();}
  const doc=await io.read(raw);canonicalizeFactoryTriangles(doc.getRoot());
  const bytes=Buffer.from(await io.writeBinary(doc)),verification=await verifyAuthoredProp(io,bytes,d);
  const artifact=path.join(dir,`${d.id}.glb`);await fs.writeFile(artifact,bytes);artifacts.push({path:artifact,...verification});
 }
 if(repeat&&artifacts[0].sha256!==artifacts[1].sha256)throw Error('Native prop rebuild differs');
 if(sha256(await fs.readFile(d.builder.path))!==d.builder.sha256)throw Error('Prop builder changed during authoring');
 const report={schema:1,item:d.id,candidateOnly:true,published:false,descriptor:{path:descriptorPath,sha256:sha256(descriptorBytes)},sourceRights:d.sourceRights,builder:d.builder,
  tool:{path:'scripts/character-assets/prepare-authored-prop.mjs',sha256:sha256(await fs.readFile(fileURLToPath(import.meta.url)))},host:{platform:process.platform,arch:process.arch,blenderVersion:version},byteIdenticalRebuild:repeat,artifacts,
  remaining:['Native fit/grip/stow motion','Canonical catalogue/streaming/startup integration','Failure/cancellation/save/reload/disposal','Separate performance and sealed release gates']};
 await fs.writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');return report;
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const [descriptor,flag,out,repeat]=process.argv.slice(2);
 if(!descriptor||flag!=='--out'||!out||(repeat&&repeat!=='--repeat')||process.argv.length>6)throw Error('Usage: prepare-authored-prop.mjs descriptor --out .cache/path [--repeat]');
 prepareAuthoredProp(descriptor,out,{repeat:repeat==='--repeat'}).then(r=>console.log(JSON.stringify(r))).catch(e=>{console.error(e.message);process.exitCode=1;});
}
