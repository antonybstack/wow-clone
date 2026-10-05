import test from 'node:test';
import assert from 'node:assert/strict';
import {Document,NodeIO} from '@gltf-transform/core';
import {deriveTorsoCore} from './character-assets/derive-coverage-geosets.mjs';
import {repairIdentityTorsoCoverage} from './character-assets/repair-identity-torso-coverage.mjs';
import {verifyCoveragePartition} from './character-assets/verify-coverage-partition.mjs';

function fixture(){
 const doc=new Document(),buffer=doc.createBuffer(),scene=doc.createScene();
 const names=['Hips','Spine','Spine1','Spine2','LeftUpLeg','RightUpLeg','Neck','LeftFoot','LeftArm','RightArm'];
 const rest={Hips:[0,1,0],Neck:[0,1.46,0],LeftFoot:[0,.13,0],LeftArm:[.175,1.39,0],RightArm:[-.175,1.39,0]};
 const joints=names.map(name=>doc.createNode(`mixamorig:${name}`).setTranslation(rest[name]||[0,1.2,0]));
 for(const joint of joints)scene.addChild(joint);
 const skin=doc.createSkin();for(const joint of joints)skin.addJoint(joint);
 skin.setInverseBindMatrices(doc.createAccessor().setType('MAT4').setArray(Float32Array.from(joints.flatMap(j=>{
  const m=[1,0,0,0,0,1,0,0,0,0,1,0,...j.getTranslation().map(v=>-v),1];return m;
 }))).setBuffer(buffer));
 // The reproduced medial-back cell has substantial arm influence despite
 // lying in the trunk. The neck and upper arm remain exposed; a spatially
 // distant cell with mixed torso weights also stays out of the new core.
 const cells=[{x:0,y:1.05,mass:1},{x:-.08,y:1.25,mass:.6},{x:0,y:1.43,mass:1},{x:.08,y:1.25,mass:.2},{x:.4,y:1.25,mass:.6},{x:-.08,y:1.25,mass:.6,z:.1}];
 const positions=[],indices=[],jointIds=[],weights=[];
 for(const [i,cell]of cells.entries())for(const [dx,dy]of [[0,0],[.005,0],[0,.005]]){
  positions.push(cell.x+dx,cell.y+dy,cell.z??-.1);indices.push(i*3+indices.length%3);
  jointIds.push(names.indexOf('Spine1'),names.indexOf('RightArm'),0,0);weights.push(cell.mass,1-cell.mass,0,0);
 }
 const accessor=(type,array)=>doc.createAccessor().setType(type).setArray(array).setBuffer(buffer);
 const p=doc.createPrimitive().setAttribute('POSITION',accessor('VEC3',new Float32Array(positions))).setAttribute('NORMAL',accessor('VEC3',new Float32Array(positions.length).fill(.25)))
  .setAttribute('JOINTS_0',accessor('VEC4',new Uint16Array(jointIds))).setAttribute('WEIGHTS_0',accessor('VEC4',new Float32Array(weights))).setIndices(accessor('SCALAR',new Uint16Array(indices)))
  .addTarget(doc.createPrimitiveTarget().setAttribute('POSITION',accessor('VEC3',new Float32Array(positions.length).fill(.01))));
 const mesh=doc.createMesh('HumanV1Body').addPrimitive(p).setWeights([.95]);scene.addChild(doc.createNode('HumanV1Body').setMesh(mesh).setSkin(skin).setWeights([.95]));
 return doc;
}

test('medial back becomes covered without hiding neck, arm or distant mixed-weight skin',async()=>{
 const doc=fixture(),io=new NodeIO(),source=(await io.readBinary(await io.writeBinary(doc))).getRoot();
 const old=deriveTorsoCore(doc,'human');assert.equal(old.partition.coveredTriangles,1);
 const repair=repairIdentityTorsoCoverage(doc);assert.equal(repair.addedTriangles,1);
 const actual=(await io.readBinary(await io.writeBinary(doc))).getRoot();
 const indices=name=>Array.from(actual.listMeshes().find(m=>m.getName()===name).listPrimitives()[0].getIndices().getArray());
 assert.deepEqual(indices('HumanTorsoCore'),[3,4,5,0,1,2]);
 assert.deepEqual(indices('HumanV1Body'),[6,7,8,9,10,11,12,13,14,15,16,17]);
 assert.equal(verifyCoveragePartition(source,actual,'HumanV1Body','HumanTorsoCore').triangles,6);
});

test('repair rejects an unsplit body before changing its geometry',()=>{
 const doc=fixture(),body=doc.getRoot().listMeshes()[0],p=body.listPrimitives()[0],indices=p.getIndices().getArray().slice();
 assert.throws(()=>repairIdentityTorsoCoverage(doc),/accepted Human torso partition/);
 assert.equal(body.listPrimitives()[0],p);assert.deepEqual(p.getIndices().getArray(),indices);
});
