/** Reclassify the accepted Human torso without changing any vertex data.
 * Source skin weights are influences, not anatomical labels: the medial back
 * includes shoulder/arm weights and can escape the old 98% spine-only core.
 * Keep its measured collar/waist limits, and bound the added back region inside
 * the upper-arm roots and behind the hips. Leave open-front skin unchanged.
 * Native glTF primitives share the original skin/morph streams.
 * https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#meshes
 * https://gltf-transform.dev/modules/core/classes/Primitive
 */
import assert from 'node:assert/strict';
import {mat4,vec3} from 'gl-matrix';
import {coverageLandmarks} from './derive-coverage-geosets.mjs';
import {partitionCoverageMesh} from './partition-coverage-mesh.mjs';

export function repairIdentityTorsoCoverage(doc) {
 const root=doc.getRoot(),body=root.listMeshes().find(m=>m.getName()==='HumanV1Body'),core=root.listMeshes().find(m=>m.getName()==='HumanTorsoCore');
 assert(body&&core,'Expected the accepted Human torso partition');
 assert.equal(body.listPrimitives().length,1);assert.equal(core.listPrimitives().length,1);
 const exposed=body.listPrimitives()[0],covered=core.listPrimitives()[0];
 assert.deepEqual(exposed.listSemantics(),covered.listSemantics());
 for(const semantic of exposed.listSemantics())assert.equal(exposed.getAttribute(semantic),covered.getAttribute(semantic),'Torso attributes must be shared');
 assert.deepEqual(exposed.listTargets(),covered.listTargets(),'Torso morphs must be shared');
 assert.equal(exposed.getMaterial(),covered.getMaterial());
 const bodyNodes=root.listNodes().filter(n=>n.getMesh()===body),coreNodes=root.listNodes().filter(n=>n.getMesh()===core);
 assert.equal(bodyNodes.length,1);assert.equal(coreNodes.length,1);
 assert.equal(bodyNodes[0].getSkin(),coreNodes[0].getSkin());
 assert.deepEqual(bodyNodes[0].getWorldMatrix(),coreNodes[0].getWorldMatrix());
 assert.deepEqual(bodyNodes[0].getWeights(),coreNodes[0].getWeights());
 const {hips,neck,unit,joints}=coverageLandmarks(doc,'HumanV1Body');
 const inverse=mat4.invert(mat4.create(),bodyNodes[0].getWorldMatrix());assert(inverse);
 const armX=name=>{
  const joint=joints.find(j=>j.getName()===`mixamorig:${name}`);assert(joint,`Missing ${name}`);
  return vec3.transformMat4(vec3.create(),[0,0,0],mat4.multiply(mat4.create(),inverse,joint.getWorldMatrix()))[0];
 };
 const halfWidth=Math.min(Math.abs(armX('LeftArm')-hips[0]),Math.abs(armX('RightArm')-hips[0]))-.025*unit;
 assert(Number.isFinite(halfWidth)&&halfWidth>0,'Invalid medial torso width');
 const backLimitZ=hips[2]-.02*unit;
 const allowed=new Set(['Hips','Spine','Spine1','Spine2','LeftUpLeg','RightUpLeg'].map(name=>joints.findIndex(j=>j.getName()===`mixamorig:${name}`)));
 assert(!allowed.has(-1),'Incomplete torso rig');
 const originalCoreTriangles=covered.getIndices().getCount()/3;
 // Restore only the index union. Do not weld, simplify, transfer weights or
 // resample the accepted body. The independent written-file verifier checks
 // original winding, every attribute, native skin and exact source curves.
 const oldIndex=exposed.getIndices(),a=oldIndex.getArray(),b=covered.getIndices().getArray();
 exposed.setIndices(doc.createAccessor('IdentityTorsoUnion',oldIndex.getBuffer()).setType('SCALAR').setArray(new a.constructor([...a,...b])));
 const discarded=[oldIndex,covered.getIndices()];
 coreNodes[0].dispose();covered.dispose();core.dispose();
 for(const accessor of discarded)if(!accessor.listParents().some(p=>p.propertyType!=='Root'))accessor.dispose();
 const partition=partitionCoverageMesh(doc,'HumanV1Body','HumanTorsoCore',(p,v)=>{
  const position=p.getAttribute('POSITION').getArray(),y=position[v*3+1];
  if(y<=hips[1]-.15*unit||y>=neck[1]-.095*unit)return false;
  const weights=p.getAttribute('WEIGHTS_0').getArray(),indices=p.getAttribute('JOINTS_0').getArray();
  let mass=0;for(let k=0;k<4;k++)if(allowed.has(indices[v*4+k]))mass+=weights[v*4+k];
  return mass>.98||(mass>.5&&Math.abs(position[v*3]-hips[0])<halfWidth&&position[v*3+2]<backLimitZ);
 });
 assert(partition.coveredTriangles>originalCoreTriangles,'Repair must cover the reproduced medial-back gap');
 return {revision:'human-medial-back-v1',partition,originalCoreTriangles,addedTriangles:partition.coveredTriangles-originalCoreTriangles,landmarks:{hips,neck,unit,halfWidth,backLimitZ}};
}
