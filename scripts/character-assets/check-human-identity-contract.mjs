/** Quantify source animation/palette and UV-split neck continuity in real poses.
 * Reuses the existing spec-based evaluator; live review remains a separate gate.
 * https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#skinning
 */
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {animationDuration,applyMorph,globalMatrices,jointMatrices,poseNodes,skinPositions} from './pose-skin.mjs';
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS);
const base=(await io.read('.cache/character-mmo/m004/human-shape-family-v1.glb')).getRoot();
const baseClips=new Map(base.listAnimations().map(c=>[c.getName(),c]));
const report={scope:'Offline source continuity and animation evidence; not live acceptance',rows:[]};
for(const label of process.argv.slice(2).length?process.argv.slice(2):['old','young-hair']){
 const root=(await io.read(`.cache/character-mmo/identity-v1/human-${label}-painted.glb`)).getRoot();
 const skin=root.listSkins()[0],prim=root.listMeshes().find(m=>m.getName()==='HumanV1Body').listPrimitives()[0];
 assert.equal(root.listAnimations().length,57);assert.equal(skin.listJoints().length,65);
 const body=root.listMeshes().find(m=>m.getName()==='HumanV1Body');
 assert.deepEqual(body.getWeights(),[0,0]);assert.deepEqual(body.getExtras().targetNames,['slender','stout']);
 assert.equal(prim.listTargets().length,2);
 const position=prim.getAttribute('POSITION').getArray(),normal=prim.getAttribute('NORMAL').getArray(),joints=prim.getAttribute('JOINTS_0').getArray(),weights=prim.getAttribute('WEIGHTS_0').getArray();
 const groups=new Map();
 for(let v=0;v<position.length/3;v++)if(position[v*3+1]>1.47&&position[v*3+1]<1.58){
  const key=Array.from(position.subarray(v*3,v*3+3),x=>x.toFixed(6)).join(',');
  if(!groups.has(key))groups.set(key,[]);groups.get(key).push(v);
 }
 const splitGroups=[...groups.values()].filter(g=>g.length>1);
 assert(splitGroups.length>20,'Require measurable render-vertex seam splits');
 let maxSplitM=0,maxNormalDifference=0,maxMorphNormalDifference=0,maxPaletteElementDifference=0,maxDurationDifference=0,samples=0;
 for(const group of splitGroups)for(const v of group.slice(1))for(let k=0;k<3;k++)maxNormalDifference=Math.max(maxNormalDifference,Math.abs(normal[v*3+k]-normal[group[0]*3+k]));
 for(const target of prim.listTargets()){
  const delta=target.getAttribute('NORMAL').getArray();
  for(const group of splitGroups)for(const v of group.slice(1))for(let k=0;k<3;k++)maxMorphNormalDifference=Math.max(maxMorphNormalDifference,Math.abs(delta[v*3+k]-delta[group[0]*3+k]));
 }
 for(let v=0;v<position.length/3;v++){
  const row=weights.subarray(v*4,v*4+4);
  assert(row.every(w=>Number.isFinite(w)&&w>=0),'Invalid source weight');
  assert(Math.abs(row.reduce((a,b)=>a+b,0)-1)<.00001,'Unnormalised source weights');
  assert(joints.subarray(v*4,v*4+4).every(j=>j<65),'Invalid source joint');
 }
 for(const clip of root.listAnimations()){
  const canonical=baseClips.get(clip.getName());assert(canonical,`Unknown clip ${clip.getName()}`);
  const duration=animationDuration(clip);maxDurationDifference=Math.max(maxDurationDifference,Math.abs(duration-animationDuration(canonical)));
  for(const phase of [0,.2,.5,.8,1]){
   const time=duration*phase,palette=jointMatrices(skin,globalMatrices(root,poseNodes(root,clip,time))),control=jointMatrices(base.listSkins()[0],globalMatrices(base,poseNodes(base,canonical,time)));
   for(let i=0;i<palette.length;i++)maxPaletteElementDifference=Math.max(maxPaletteElementDifference,Math.abs(palette[i]-control[i]));
   for(const morph of [[0,0],[.95,0],[0,.95]]){
    const posed=skinPositions(applyMorph(position,prim.listTargets(),morph),joints,weights,palette);
    for(const group of splitGroups)for(const v of group.slice(1)){
     const first=group[0];maxSplitM=Math.max(maxSplitM,Math.hypot(...[0,1,2].map(k=>posed[v*3+k]-posed[first*3+k])));
    }
    samples++;
   }
  }
 }
 const row={label,vertices:position.length/3,neckSplitGroups:splitGroups.length,samples,maxSplitM,maxNormalDifference,maxMorphNormalDifference,maxPaletteElementDifference,maxDurationDifference};
 report.rows.push(row);
}
await fs.writeFile('.cache/character-mmo/identity-v1/source-contract.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report));
for(const row of report.rows){
 assert(row.maxSplitM<.00001,`${row.label}: split neck vertices separate under pose/shape`);
 assert(row.maxNormalDifference<.00001,`${row.label}: separate neck shading normals`);
 assert(row.maxMorphNormalDifference<.00001,`${row.label}: separate shaped neck shading normals`);
 assert(row.maxDurationDifference<.001,`${row.label}: source action duration changed`);
 assert(row.maxPaletteElementDifference<.002,`${row.label}: source pose/palette changed`);
}
