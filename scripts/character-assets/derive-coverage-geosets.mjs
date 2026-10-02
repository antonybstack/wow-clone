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

export function deriveTorsoCore(doc,race){
 if(!['human','undead'].includes(race))throw Error('This torso compiler supports actual Human/Undead topology only');
 const source=race==='human'?'HumanV1Body':'UndeadV1Body',covered=race==='human'?'HumanTorsoCore':'UndeadTorsoCore';
 const {hips,neck,unit,joints}=coverageLandmarks(doc,source);
 // Actual Human abdomen weights include UpLegs. Weights are influences, not
 // anatomy labels; strict measured height bounds also constrain the partition.
 const names=['Hips','Spine','Spine1','Spine2','LeftUpLeg','RightUpLeg'];
 const allowed=new Set(names.map(name=>joints.findIndex(j=>j.getName()===`mixamorig:${name}`)));
 if(allowed.has(-1))throw Error('Incomplete torso coverage rig');
 const partition=partitionCoverageMesh(doc,source,covered,(p,v)=>{
  const y=p.getAttribute('POSITION').getArray()[v*3+1],weights=p.getAttribute('WEIGHTS_0').getArray(),indices=p.getAttribute('JOINTS_0').getArray();
  let mass=0;for(let k=0;k<4;k++)if(allowed.has(indices[v*4+k]))mass+=weights[v*4+k];
  return y>hips[1]-.15*unit&&y<neck[1]-.095*unit&&mass>.98;
 });
 return {partition,landmarks:{hips,neck,unit}};
}

export function deriveUpperTrousers(doc,source='WayfarerTrousers',covered='WayfarerTrousersUnderTorso'){
 const {hips,neck,unit}=coverageLandmarks(doc,source);
 const partition=partitionCoverageMesh(doc,source,covered,(p,v)=>{
  const a=p.getAttribute('POSITION').getArray();
  return a[v*3+1]>hips[1]-.13*unit&&a[v*3+2]<hips[2]-.015*unit;
 });
 return {partition,landmarks:{hips,neck,unit}};
}
