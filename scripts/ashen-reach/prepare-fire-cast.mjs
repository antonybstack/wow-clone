/** Offline adaptation of existing CC0 authored motion; keeps every original clip and bind unchanged. */
import {NodeIO} from '@gltf-transform/core';import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {quat} from 'gl-matrix';import fs from 'node:fs/promises';import {createHash} from 'node:crypto';import {pathToFileURL} from 'node:url';
import {copyNamedClips} from './prepare-pyre-cast.mjs';
export const smooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);};
export const lower=name=>/mixamorig:(Hips|Left(UpLeg|Leg|Foot|ToeBase)|Right(UpLeg|Leg|Foot|ToeBase))$/.test(name);
export function sample(channel,time){const s=channel.getSampler(),ts=s.getInput().getArray(),vs=s.getOutput().getArray(),n=s.getOutput().getElementSize();let i=0;while(i<ts.length-2&&ts[i+1]<time)i++;const t=Math.max(0,Math.min(1,(time-ts[i])/(ts[i+1]-ts[i]||1)));const a=vs.slice(i*n,i*n+n),b=vs.slice((i+1)*n,(i+1)*n+n);if(ts.length===1)return Array.from(a);return n===4?Array.from(quat.slerp(quat.create(),a,b,t)):Array.from(a,(v,j)=>v+(b[j]-v)*t);}
const DURATION=1.4,RELEASE=.55;
// The cross is cocked at the start and reaches the shoulder around 0.42s.
// Hold that extended pose, then let the layer weight carry the arm home.
const sourceTime=t=>{const keys=[[0,.02],[.22,.12],[.4,.28],[RELEASE,.42],[.72,.58],[DURATION,.58]];for(let i=1;i<keys.length;i++)if(t<=keys[i][0]+1e-5){const [a,x]=keys[i-1],[b,y]=keys[i];return x+(y-x)*(t-a)/(b-a);}return .58;};
export async function prepareFireCast(path='public/ashen-reach/wanderer.glb'){
 const io=new NodeIO().registerExtensions(ALL_EXTENSIONS),d=await io.read(path),r=d.getRoot();
 const attack=r.listAnimations().find(a=>a.getName()==='Punch_Cross'),idle=r.listAnimations().find(a=>a.getName()==='Idle_Loop');if(!attack||!idle)throw Error('Required authored source motion missing');
 const baseline=new Map(idle.listChannels().map(c=>[c.getTargetNode().getName()+':'+c.getTargetPath(),c]));
 for(const a of r.listAnimations().filter(a=>['FireBlast_Upper','FireBlast_Lower'].includes(a.getName())))a.dispose();
 const upper=d.createAnimation('FireBlast_Upper'),legs=d.createAnimation('FireBlast_Lower'),times=Float32Array.from({length:Math.round(DURATION*60)+1},(_,i)=>i/60),input=d.createAccessor('Fire cast time').setType('SCALAR').setArray(times).setBuffer(r.listBuffers()[0]);
 for(const c of attack.listChannels()){
  const node=c.getTargetNode(),name=node.getName(),path=c.getTargetPath(),key=name+':'+path,base=baseline.get(key);if(!base)throw Error('Missing baseline '+key);
  const rest=sample(base,0),n=rest.length,values=new Float32Array(times.length*n),finger=/mixamorig:RightHand(Thumb|Index|Middle|Ring|Pinky)/.test(name);
  for(let i=0;i<times.length;i++){
   const t=times[i],weight=smooth(t/.16)*(1-smooth((t-.78)/(DURATION-.78)));let pose=sample(c,sourceTime(t));
   // Open the striking fingers using their authored bind pose, retaining the source wrist and arm.
   if(finger&&path==='rotation')pose=Array.from(node.getRotation());
   const value=n===4?quat.slerp(quat.create(),rest,pose,weight):rest.map((v,j)=>v+(pose[j]-v)*weight);values.set(value,i*n);
  }
  const output=d.createAccessor(name+' fire cast').setType(c.getSampler().getOutput().getType()).setArray(values).setBuffer(r.listBuffers()[0]);
  const sampler=d.createAnimationSampler().setInput(input).setOutput(output).setInterpolation('LINEAR'),a=lower(name)?legs:upper;
  a.addSampler(sampler).addChannel(d.createAnimationChannel().setTargetNode(node).setTargetPath(path).setSampler(sampler));
 }
 const bytes=await io.writeBinary(d);await fs.writeFile(path,bytes);const hash=createHash('sha256').update(bytes).digest('hex');
 const recipe={author:'Quaternius (source motion); project adaptation',license:'CC0-1.0',sourceClips:['Punch_Cross','Idle_Loop'],sourceAsset:'public/characters/candidates/human-source-v1.glb',changes:'Right-arm throw reaches the cross at 0.55s, holds through the release, then eases back to idle by 1.4s. Open striking fingers stay at bind so the live grip can return the weapon.',duration:DURATION,releaseTime:RELEASE,hand:'mainHand',outputSha256:hash,clips:[upper,legs].map(a=>({name:a.getName(),channels:a.listChannels().length}))};
 await fs.writeFile('public/ashen-reach/fire-cast-provenance.json',JSON.stringify(recipe,null,2)+'\n');
 const provenance=JSON.parse(await fs.readFile('public/ashen-reach/animation-provenance.json','utf8'));
 provenance.outputSha256=hash;provenance.derivedCast=recipe;
 await fs.writeFile('public/ashen-reach/animation-provenance.json',JSON.stringify(provenance,null,2)+'\n');
 for(const name of ['lava-cast-provenance','pyre-cast-provenance']){
  const file='public/ashen-reach/'+name+'.json';
  const doc=JSON.parse(await fs.readFile(file,'utf8'));
  doc.outputSha256=hash;
  await fs.writeFile(file,JSON.stringify(doc,null,2)+'\n');
 }
 const targets=[
  'public/ashen-reach/wanderer-equipment.glb',
  'public/ashen-reach/equipment/body.glb',
  'public/ashen-reach/equipment-orc/body.glb',
  'public/ashen-reach/equipment-undead/body.glb',
  'public/characters/candidates/orc-source-v1.glb',
  'public/characters/candidates/undead-source-v1.glb',
 ];
 for(const target of targets){
  try{await fs.access(target);}catch{continue;}
  await copyNamedClips(path,target,['FireBlast_Upper','FireBlast_Lower']);
  console.log('copied',target);
 }
 for(const manifestPath of ['public/ashen-reach/equipment/manifest.json','public/ashen-reach/equipment-orc/manifest.json','public/ashen-reach/equipment-undead/manifest.json']){
  const manifest=JSON.parse(await fs.readFile(manifestPath,'utf8'));
  const body=manifest.items?.body;
  if(!body?.url)continue;
  const bytes=await fs.readFile('public'+body.url);
  body.bytes=bytes.length;
  body.sha256=createHash('sha256').update(bytes).digest('hex');
  await fs.writeFile(manifestPath,JSON.stringify(manifest,null,2)+'\n');
 }
 console.log(recipe.clips,recipe.duration,recipe.releaseTime);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 prepareFireCast().then(()=>process.exit(0)).catch((error)=>{console.error(error);process.exit(1);});
}
