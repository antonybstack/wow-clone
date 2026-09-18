import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {quat} from 'gl-matrix';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {sample,smooth,lower} from './prepare-fire-cast.mjs';
const duration=2.3;
function sourceTime(t){
 const keys=[[0,0],[.32,.085],[1.22,.13],[1.5,.33],[1.76,.6],[2,1],[duration,1]];
 for(let i=1;i<keys.length;i++)if(t<=keys[i][0]){const [a,x]=keys[i-1],[b,y]=keys[i];return x+(y-x)*(t-a)/(b-a);}
 return 1;
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
   const t=times[i],weight=smooth(t/.25)*(1-smooth((t-1.85)/.45));
   let pose=sample(c,sourceTime(t));
   if(/mixamorig:RightHand(Thumb|Index|Middle|Ring|Pinky)/.test(name)&&path==='rotation')pose=Array.from(node.getRotation());
   values.set(n===4?quat.slerp(quat.create(),rest,pose,weight):rest.map((v,j)=>v+(pose[j]-v)*weight),i*n);
  }
  const output=d.createAccessor(name+' lava cast').setType(c.getSampler().getOutput().getType()).setArray(values).setBuffer(buffer);
  const sampler=d.createAnimationSampler().setInput(input).setOutput(output).setInterpolation('LINEAR'),a=lower(name)?legs:upper;
  a.addSampler(sampler).addChannel(d.createAnimationChannel().setTargetNode(node).setTargetPath(path).setSampler(sampler));
 }
 const bytes=await io.writeBinary(d),hash=createHash('sha256').update(bytes).digest('hex');await fs.writeFile(path,bytes);
 const recipe={license:'CC0-1.0',sourceClips:['Punch_Cross','Idle_Loop'],changes:'Extended anticipation, open right fingers, sharp release at 1.5 seconds, eased recovery; disjoint native additive layers.',duration,releaseTime:1.5,outputSha256:hash};
 await fs.writeFile('public/ashen-reach/lava-cast-provenance.json',JSON.stringify(recipe,null,2)+'\n');
 for(const name of ['animation-provenance','fire-cast-provenance']){const p='public/ashen-reach/'+name+'.json',v=JSON.parse(await fs.readFile(p,'utf8'));v.outputSha256=hash;if(name==='animation-provenance'){v.derivedLavaCast=recipe;if(v.derivedCast)v.derivedCast.outputSha256=hash;}await fs.writeFile(p,JSON.stringify(v,null,2)+'\n');}
 console.log('Lava Ball authored motion prepared: 1.5s charge, 2.3s total');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await prepareLavaCast();
