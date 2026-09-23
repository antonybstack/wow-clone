import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {quat} from 'gl-matrix';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {sample,smooth,lower} from './prepare-fire-cast.mjs';
import {copyNamedClips} from './prepare-pyre-cast.mjs';
const duration=2.3;
function sourceTime(t){
 // Hold the chamber through the charge. The cross arrives at the 1.5s release.
 const keys=[[0,.04],[.45,.12],[1.15,.16],[1.5,.45],[1.72,.58],[duration,.58]];
 for(let i=1;i<keys.length;i++)if(t<=keys[i][0]){const [a,x]=keys[i-1],[b,y]=keys[i];return x+(y-x)*(t-a)/(b-a);}
 return .58;
}
export async function prepareLavaCast(){
 const path='public/ashen-reach/wanderer.glb',io=new NodeIO().registerExtensions(ALL_EXTENSIONS),d=await io.read(path),root=d.getRoot();
 const source=root.listAnimations().find(a=>a.getName()==='Punch_Cross'),idle=root.listAnimations().find(a=>a.getName()==='Idle_Loop');
 if(!source||!idle)throw Error('Lava cast requires original CC0 source clips');
 const baseline=new Map(idle.listChannels().map(c=>[c.getTargetNode().getName()+':'+c.getTargetPath(),c]));
 for(const a of root.listAnimations().filter(a=>a.getName().startsWith('LavaBall_')))a.dispose();
 const upper=d.createAnimation('LavaBall_Upper'),legs=d.createAnimation('LavaBall_Lower'),times=Float32Array.from({length:139},(_,i)=>i/60),buffer=root.listBuffers()[0];
 const input=d.createAccessor('Lava cast time').setType('SCALAR').setArray(times).setBuffer(buffer);
 for(const c of source.listChannels()){
  const node=c.getTargetNode(),name=node.getName(),path=c.getTargetPath(),rest=sample(baseline.get(name+':'+path),0),n=rest.length,values=new Float32Array(times.length*n);
  for(let i=0;i<times.length;i++){
   const t=times[i],weight=smooth(t/.32)*(1-smooth((t-1.7)/(duration-1.7)));
   let pose=sample(c,sourceTime(t));
   if(/mixamorig:RightHand(Thumb|Index|Middle|Ring|Pinky)/.test(name)&&path==='rotation')pose=Array.from(node.getRotation());
   values.set(n===4?quat.slerp(quat.create(),rest,pose,weight):rest.map((v,j)=>v+(pose[j]-v)*weight),i*n);
  }
  const output=d.createAccessor(name+' lava cast').setType(c.getSampler().getOutput().getType()).setArray(values).setBuffer(buffer);
  const sampler=d.createAnimationSampler().setInput(input).setOutput(output).setInterpolation('LINEAR'),a=lower(name)?legs:upper;
  a.addSampler(sampler).addChannel(d.createAnimationChannel().setTargetNode(node).setTargetPath(path).setSampler(sampler));
 }
 const bytes=await io.writeBinary(d),hash=createHash('sha256').update(bytes).digest('hex');await fs.writeFile(path,bytes);
 const recipe={license:'CC0-1.0',sourceClips:['Punch_Cross','Idle_Loop'],changes:'Chamber through the 1.5s charge, throw on the release, then ease the arm home by 2.3s. Open right fingers stay at bind.',duration,releaseTime:1.5,outputSha256:hash};
 await fs.writeFile('public/ashen-reach/lava-cast-provenance.json',JSON.stringify(recipe,null,2)+'\n');
 for(const name of ['animation-provenance','fire-cast-provenance','pyre-cast-provenance']){
  const p='public/ashen-reach/'+name+'.json',v=JSON.parse(await fs.readFile(p,'utf8'));
  v.outputSha256=hash;
  if(name==='animation-provenance'){v.derivedLavaCast=recipe;if(v.derivedCast)v.derivedCast.outputSha256=hash;if(v.derivedPyreCast)v.derivedPyreCast.outputSha256=hash;}
  if(name==='fire-cast-provenance')v.outputSha256=hash;
  await fs.writeFile(p,JSON.stringify(v,null,2)+'\n');
 }
 for(const target of [
  'public/ashen-reach/wanderer-equipment.glb',
  'public/ashen-reach/equipment/body.glb',
  'public/ashen-reach/equipment-orc/body.glb',
  'public/ashen-reach/equipment-undead/body.glb',
  'public/characters/candidates/orc-source-v1.glb',
  'public/characters/candidates/undead-source-v1.glb',
 ]){
  try{await fs.access(target);}catch{continue;}
  await copyNamedClips(path,target,['LavaBall_Upper','LavaBall_Lower']);
  console.log('copied',target);
 }
 for(const manifestPath of ['public/ashen-reach/equipment/manifest.json','public/ashen-reach/equipment-orc/manifest.json','public/ashen-reach/equipment-undead/manifest.json']){
  const manifest=JSON.parse(await fs.readFile(manifestPath,'utf8'));
  const body=manifest.items?.body;if(!body?.url)continue;
  const file=await fs.readFile('public'+body.url);
  body.bytes=file.length;body.sha256=createHash('sha256').update(file).digest('hex');
  await fs.writeFile(manifestPath,JSON.stringify(manifest,null,2)+'\n');
 }
 console.log('Lava Ball authored motion prepared: 1.5s charge, 2.3s total');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 prepareLavaCast().then(()=>process.exit(0)).catch((error)=>{console.error(error);process.exit(1);});
}
