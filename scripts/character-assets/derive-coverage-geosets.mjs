/** Compile from the actual fitted mesh, including its morph targets. Skin joints
 * give landmarks in the mesh's own frame; a world-space threshold is invalid for
 * nonidentity glTF nodes. Only all-covered triangles move to a sibling geoset.
 * https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#skins
 */
import {mat4,vec3} from 'gl-matrix';
import {partitionCoverageMesh} from './partition-coverage-mesh.mjs';

export function coverageLandmarks(doc,meshName){
 const node=doc.getRoot().listNodes().find(n=>n.getMesh()?.getName()===meshName);
 if(!node?.getSkin())throw Error(`Missing coverage skin: ${meshName}`);
 const inverse=mat4.invert(mat4.create(),node.getWorldMatrix());
 if(!inverse)throw Error('Singular coverage mesh frame');
 const joints=node.getSkin().listJoints();
 const origin=name=>{
  const joint=joints.find(j=>j.getName()===`mixamorig:${name}`);
  if(!joint)throw Error(`Missing coverage landmark: ${name}`);
  return Array.from(vec3.transformMat4(vec3.create(),[0,0,0],mat4.multiply(mat4.create(),inverse,joint.getWorldMatrix())));
 };
 const hips=origin('Hips'),neck=origin('Neck'),foot=origin('LeftFoot'),unit=(neck[1]-foot[1])/1.33;
 if(!Number.isFinite(unit)||unit<=0)throw Error('Invalid coverage landmark scale');
 return {hips,neck,unit,joints};
}

export const HUMAN_BACK_COVERAGE_REVISION='human-medial-back-v1';
export const HUMAN_FOOT_COVERAGE_REVISION='human-ankle-foot-v1';

// Keep the strict classifier available for reproducing pinned historical source
// auditions. Production Human compilation explicitly selects the reviewed back
// policy; Undead retains its separately reviewed anatomy and influence threshold.
// Skin weights are deformation influences, not anatomical coverage labels.
// https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#skins
export function torsoCoverageClassifier(doc,race,{revision='conservative-geosets-v1'}={}){
 if(!['human','undead'].includes(race))throw Error('This torso compiler supports actual Human/Undead topology only');
 if(!['conservative-geosets-v1',HUMAN_BACK_COVERAGE_REVISION].includes(revision))throw Error('Unknown torso coverage policy');
 if(revision===HUMAN_BACK_COVERAGE_REVISION&&race!=='human')throw Error('Medial back coverage is reviewed for Human only');
 const source=race==='human'?'HumanV1Body':'UndeadV1Body';
 const {hips,neck,unit,joints}=coverageLandmarks(doc,source);
 const landmarks={hips,neck,unit};
 if(revision===HUMAN_BACK_COVERAGE_REVISION){
  const node=doc.getRoot().listNodes().find(n=>n.getMesh()?.getName()===source);
  const inverse=mat4.invert(mat4.create(),node.getWorldMatrix());
  const armX=name=>{
   const joint=joints.find(j=>j.getName()===`mixamorig:${name}`);
   if(!joint)throw Error(`Missing ${name}`);
   return vec3.transformMat4(vec3.create(),[0,0,0],mat4.multiply(mat4.create(),inverse,joint.getWorldMatrix()))[0];
  };
  landmarks.halfWidth=Math.min(Math.abs(armX('LeftArm')-hips[0]),Math.abs(armX('RightArm')-hips[0]))-.025*unit;
  if(!Number.isFinite(landmarks.halfWidth)||landmarks.halfWidth<=0)throw Error('Invalid medial torso width');
  landmarks.backLimitZ=hips[2]-.02*unit;
 }
 // Actual Human abdomen weights include UpLegs. Weights are influences, not
 // anatomy labels; strict measured height bounds also constrain the partition.
 const names=['Hips','Spine','Spine1','Spine2','LeftUpLeg','RightUpLeg'];
 const allowed=new Set(names.map(name=>joints.findIndex(j=>j.getName()===`mixamorig:${name}`)));
 if(allowed.has(-1))throw Error('Incomplete torso coverage rig');
 const classify=(p,v)=>{
  const position=p.getAttribute('POSITION').getArray(),y=position[v*3+1];
  if(y<=hips[1]-.15*unit||y>=neck[1]-.095*unit)return false;
  const weights=p.getAttribute('WEIGHTS_0').getArray(),indices=p.getAttribute('JOINTS_0').getArray();
  let mass=0;for(let k=0;k<4;k++)if(allowed.has(indices[v*4+k]))mass+=weights[v*4+k];
  return mass>.98||(revision===HUMAN_BACK_COVERAGE_REVISION&&mass>.5&&Math.abs(position[v*3]-hips[0])<landmarks.halfWidth&&position[v*3+2]<landmarks.backLimitZ);
 };
 return {classify,landmarks,revision};
}

export function deriveTorsoCore(doc,race,options){
 const policy=torsoCoverageClassifier(doc,race,options);
 const source=race==='human'?'HumanV1Body':'UndeadV1Body',covered=race==='human'?'HumanTorsoCore':'UndeadTorsoCore';
 const partition=partitionCoverageMesh(doc,source,covered,policy.classify);
 return {partition,landmarks:policy.landmarks,partitionPolicy:policy.revision};
}

/** Boots already cover the semantic `foot` segment. Give the actual Human foot
 * an index-only visibility boundary, as Orc already has, instead of inflating
 * footwear or changing skinning. All three corners must lie below the source
 * ankle and have >98% native foot/toe influence; the calf stays exposed.
 * This is a mesh partition, not a new coverage schema or runtime deformation.
 * https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#meshes
 * https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#skins
 */
export function deriveHumanFootCore(doc){
 const source='HumanV1Body',covered='HumanFootCore';
 const {unit,joints}=coverageLandmarks(doc,source);
 const node=doc.getRoot().listNodes().find(n=>n.getMesh()?.getName()===source);
 const inverse=mat4.invert(mat4.create(),node.getWorldMatrix());
 const footIndices=['LeftFoot','RightFoot','LeftToeBase','RightToeBase'].map(name=>joints.findIndex(j=>j.getName()===`mixamorig:${name}`));
 if(footIndices.includes(-1))throw Error('Incomplete Human foot coverage rig');
 const footY=footIndices.slice(0,2).map(i=>vec3.transformMat4(vec3.create(),[0,0,0],mat4.multiply(mat4.create(),inverse,joints[i].getWorldMatrix()))[1]);
 const ankleLimitY=Math.max(...footY)+.01*unit,allowed=new Set(footIndices);
 const partition=partitionCoverageMesh(doc,source,covered,(p,v)=>{
  if(p.getAttribute('POSITION').getArray()[v*3+1]>=ankleLimitY)return false;
  const weights=p.getAttribute('WEIGHTS_0').getArray(),indices=p.getAttribute('JOINTS_0').getArray();
  let mass=0;for(let k=0;k<4;k++)if(allowed.has(indices[v*4+k]))mass+=weights[v*4+k];
  return mass>.98;
 });
 return {revision:HUMAN_FOOT_COVERAGE_REVISION,partition,landmarks:{unit,footY,ankleLimitY}};
}

export function deriveUpperTrousers(doc,source='WayfarerTrousers',covered='WayfarerTrousersUnderTorso'){
 const {hips,neck,unit}=coverageLandmarks(doc,source);
 const partition=partitionCoverageMesh(doc,source,covered,(p,v)=>{
  const a=p.getAttribute('POSITION').getArray();
  return a[v*3+1]>hips[1]-.13*unit&&a[v*3+2]<hips[2]-.015*unit;
 });
 return {partition,landmarks:{hips,neck,unit}};
}
