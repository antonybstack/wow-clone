/** Quantify source animation/palette and UV-split neck continuity in real poses.
 * Reuses the existing spec-based evaluator; live review remains a separate gate.
 * https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#skinning
 */
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import sharp from 'sharp';
import {animationDuration,applyMorph,globalMatrices,jointMatrices,poseNodes,skinPositions} from './pose-skin.mjs';
import {buildSegments,restWorld,softShape} from './girth-field.mjs';
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS);
const base=(await io.read('.cache/character-mmo/m004/human-shape-family-v1.glb')).getRoot();
const baseClips=new Map(base.listAnimations().map(c=>[c.getName(),c]));
const girth=JSON.parse(await fs.readFile('docs/baselines/character-mmo/m004/makehuman-girth.json','utf8'));
const report={scope:'Offline source continuity and animation evidence; not live acceptance',rows:[]};
const sourceBrowSize=await sharp('blender/characters/sources/eyebrow001.png').metadata();
for(const label of process.argv.slice(2).length?process.argv.slice(2):['old','young','young-hair']){
 const root=(await io.read(`.cache/character-mmo/identity-v1/human-${label}-painted.glb`)).getRoot();
 const skin=root.listSkins()[0],prim=root.listMeshes().find(m=>m.getName()==='HumanV1Body').listPrimitives()[0];
 assert.equal(root.listAnimations().length,57);assert.equal(skin.listJoints().length,65);
 const body=root.listMeshes().find(m=>m.getName()==='HumanV1Body');
 assert.deepEqual(body.getWeights(),[0,0]);assert.deepEqual(body.getExtras().targetNames,['slender','stout']);
 assert.equal(prim.listTargets().length,2);
 // A green pose sample does not detect unused Blender curves wasting download
 // bytes. Census the actual exported owners and compare every retained curve.
 // https://gltf-transform.dev/modules/core/classes/Property#dispose
 const used=new Set();
 for(const mesh of root.listMeshes())for(const p of mesh.listPrimitives()){
  if(p.getIndices())used.add(p.getIndices());
  for(const semantic of p.listSemantics())used.add(p.getAttribute(semantic));
  for(const t of p.listTargets())for(const semantic of t.listSemantics())used.add(t.getAttribute(semantic));
 }
 for(const s of root.listSkins())used.add(s.getInverseBindMatrices());
 for(const clip of root.listAnimations()){
  const canonical=baseClips.get(clip.getName());assert(canonical);
  const signature=a=>a.listChannels().map(c=>({node:c.getTargetNode().getName(),path:c.getTargetPath(),interpolation:c.getSampler().getInterpolation(),input:Array.from(c.getSampler().getInput().getArray()),output:Array.from(c.getSampler().getOutput().getArray())}));
  assert.deepEqual(signature(clip),signature(canonical),`${label}: source animation accessor changed`);
  for(const sampler of clip.listSamplers()){used.add(sampler.getInput());used.add(sampler.getOutput());}
 }
 const unusedAccessors=root.listAccessors().filter(a=>!used.has(a));
 assert.equal(unusedAccessors.length,0,`${label}: discarded curves still own exported bytes`);
 assert.equal(root.listNodes().length,65+root.listMeshes().length+1,`${label}: duplicated dependency rig remains`);
 const eyes=root.listMeshes().find(m=>m.getName()==='HumanIdentityEyes');assert(eyes);
 assert.deepEqual(eyes.getExtras().targetNames,['slender','stout']);assert.deepEqual(eyes.getWeights(),[0,0]);
 const {segments}=buildSegments(skin.listJoints(),restWorld(root),girth);
 let maxEyeFieldDifferenceM=0;
 let maxBrowFieldDifferenceM=0;
 const brows=root.listMeshes().find(m=>m.getName()==='HumanIdentityBrows');assert(brows,'Fitted brows absent');
 const browMaterial=brows.listPrimitives()[0].getMaterial();
 const browTextureSizePx=browMaterial.getBaseColorTexture().getSize();
 assert.deepEqual(browTextureSizePx,[sourceBrowSize.width,sourceBrowSize.height],`${label}: brow texture was mistaken for an eye texture`);
 assert.equal(browMaterial.getAlphaMode(),'MASK','Brow strands require authored alpha coverage');
 assert.deepEqual(brows.getExtras().targetNames,['slender','stout']);assert.deepEqual(brows.getWeights(),[0,0]);
 for(const attachment of [eyes,brows])for(const p of attachment.listPrimitives()){
  assert.equal(p.listTargets().length,2);
  const pos=p.getAttribute('POSITION').getArray();
  for(const [index,name]of ['slender','stout'].entries()){
   const expected=softShape(pos,p.getAttribute('JOINTS_0').getArray(),p.getAttribute('WEIGHTS_0').getArray(),segments,name).shaped;
   const delta=p.listTargets()[index].getAttribute('POSITION').getArray();
   for(let k=0;k<pos.length;k++){
    const error=Math.abs(pos[k]+delta[k]-expected[k]);
    if(attachment===eyes)maxEyeFieldDifferenceM=Math.max(maxEyeFieldDifferenceM,error);
    else maxBrowFieldDifferenceM=Math.max(maxBrowFieldDifferenceM,error);
   }
  }
 }
 assert(maxEyeFieldDifferenceM<1e-7,`${label}: eyeball morph differs from the Head field`);
 assert(maxBrowFieldDifferenceM<1e-7,`${label}: brow morph differs from the Head field`);
 const position=prim.getAttribute('POSITION').getArray(),normal=prim.getAttribute('NORMAL').getArray(),joints=prim.getAttribute('JOINTS_0').getArray(),weights=prim.getAttribute('WEIGHTS_0').getArray();
 // The head changes topology. Prove clothing correspondence by retained
 // physical positions, morph displacement and named joint weights, never by
 // comparing vertex counts. UV splits may have several render indices.
 const basePrim=base.listMeshes().find(m=>m.getName()==='HumanV1Body').listPrimitives()[0];
 const basePositions=basePrim.getAttribute('POSITION').getArray(),pointKey=(a,v)=>Array.from(a.subarray(v*3,v*3+3),x=>x.toFixed(4)).join(',');
 const candidates=new Map();
 for(let v=0;v<position.length/3;v++){const key=pointKey(position,v);if(!candidates.has(key))candidates.set(key,[]);candidates.get(key).push(v);}
 const jointRow=(p,v)=>{const row=new Float32Array(65),j=p.getAttribute('JOINTS_0').getArray(),w=p.getAttribute('WEIGHTS_0').getArray();for(let k=0;k<4;k++)row[j[v*4+k]]+=w[v*4+k];return row;};
 let retainedSamples=0,maxRetainedPositionM=0,maxRetainedMorphM=0,maxRetainedWeightDifference=0;
 for(let v=0;v<basePositions.length/3;v++){
  if(basePositions[v*3+1]>1.46)continue;
  const distance=i=>Math.hypot(...[0,1,2].map(k=>position[i*3+k]-basePositions[v*3+k]));
  // Float32 export rounding can cross a spatial bucket boundary. Fall back to
  // the exact physical nearest point for that rare case, rather than skip it.
  const ids=candidates.get(pointKey(basePositions,v))||Array.from({length:position.length/3},(_,i)=>i);
  let match=ids[0];for(const i of ids)if(distance(i)<distance(match))match=i;
  maxRetainedPositionM=Math.max(maxRetainedPositionM,distance(match));
  for(let target=0;target<2;target++){
   const a=basePrim.listTargets()[target].getAttribute('POSITION').getArray(),b=prim.listTargets()[target].getAttribute('POSITION').getArray();
   for(let k=0;k<3;k++)maxRetainedMorphM=Math.max(maxRetainedMorphM,Math.abs(a[v*3+k]-b[match*3+k]));
  }
  const a=jointRow(basePrim,v),b=jointRow(prim,match);
  for(let k=0;k<65;k++)maxRetainedWeightDifference=Math.max(maxRetainedWeightDifference,Math.abs(a[k]-b[k]));
  retainedSamples++;
 }
 assert(retainedSamples>2500);assert(maxRetainedPositionM<1e-5);assert(maxRetainedMorphM<1e-5);assert(maxRetainedWeightDifference<1e-5,'Retained clothing surface skin changed');
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
 const row={label,vertices:position.length/3,neckSplitGroups:splitGroups.length,samples,maxSplitM,maxNormalDifference,maxMorphNormalDifference,maxPaletteElementDifference,maxDurationDifference,sourceCurvesExact:true,unusedAccessors:unusedAccessors.length,maxEyeFieldDifferenceM,maxBrowFieldDifferenceM,browTextureSizePx,nodes:root.listNodes().length,retainedClothingSurface:{belowM:1.46,samples:retainedSamples,maxPositionM:maxRetainedPositionM,maxMorphM:maxRetainedMorphM,maxWeightDifference:maxRetainedWeightDifference}};
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
