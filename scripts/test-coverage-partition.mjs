import test from 'node:test';import assert from 'node:assert/strict';
import {Document,NodeIO} from '@gltf-transform/core';
import {partitionCoverageMesh} from './character-assets/partition-coverage-mesh.mjs';
import {verifyCoveragePartition} from './character-assets/verify-coverage-partition.mjs';
function fixture(){
 const doc=new Document(),buffer=doc.createBuffer(),positions=doc.createAccessor().setType('VEC3').setArray(new Float32Array([0,0,0,1,0,0,0,1,0,1,1,0])).setBuffer(buffer),indices=doc.createAccessor().setType('SCALAR').setArray(new Uint16Array([0,1,2,1,3,2])).setBuffer(buffer);
 const target=doc.createPrimitiveTarget().setAttribute('POSITION',doc.createAccessor().setType('VEC3').setArray(new Float32Array(12).fill(.01)).setBuffer(buffer));
 const p=doc.createPrimitive().setAttribute('POSITION',positions).setIndices(indices).addTarget(target),mesh=doc.createMesh('Body').addPrimitive(p).setWeights([.25]),node=doc.createNode('Body').setMesh(mesh).setTranslation([1,2,3]).setWeights([.25]),scene=doc.createScene().addChild(node);return {doc,p,node,scene,positions,target};
}
test('coverage index partition preserves exact triangle union, shared attributes, morphs and node frame',async()=>{
 const {doc,positions,target,node,scene}=fixture(),r=partitionCoverageMesh(doc,'Body','Core',(_,v)=>v!==0);
 assert.equal(r.coveredTriangles,1);assert.equal(r.exposedTriangles,1);const root=doc.getRoot(),body=root.listMeshes().find(m=>m.getName()==='Body').listPrimitives()[0],core=root.listMeshes().find(m=>m.getName()==='Core').listPrimitives()[0];
 assert.deepEqual(Array.from(body.getIndices().getArray()),[0,1,2]);assert.deepEqual(Array.from(core.getIndices().getArray()),[1,3,2]);
 for(const p of [body,core]){assert.equal(p.getAttribute('POSITION'),positions);assert.equal(p.listTargets()[0],target);}const sibling=scene.listChildren().find(n=>n!==node);assert.deepEqual(sibling.getMatrix(),node.getMatrix());assert.deepEqual(sibling.getWeights(),[.25]);
 const written=await new NodeIO().readBinary(await new NodeIO().writeBinary(doc));assert.equal(written.getRoot().listMeshes().length,2);assert.equal(written.getRoot().listMeshes()[0].listPrimitives()[0].getAttribute('POSITION').getCount(),4);
});
test('coverage rejects all/none masks before mutating the document',()=>{
 for(const flag of [true,false]){const{doc,p}=fixture();assert.throws(()=>partitionCoverageMesh(doc,'Body','Core',()=>flag),/nonempty/);assert.equal(doc.getRoot().listMeshes().length,1);assert.equal(doc.getRoot().listMeshes()[0].listPrimitives()[0],p);}
});
test('coverage rejects nonboolean classifiers, invalid source indices and reused instances',()=>{
 let {doc}=fixture();assert.throws(()=>partitionCoverageMesh(doc,'Body','Core',()=>undefined),/booleans/);
 let f=fixture();f.p.getIndices().setArray(new Uint16Array([0,1,99,1,3,2]));assert.throws(()=>partitionCoverageMesh(f.doc,'Body','Core',()=>true),/Invalid source/);
 f=fixture();f.scene.addChild(f.doc.createNode().setMesh(f.node.getMesh()));assert.throws(()=>partitionCoverageMesh(f.doc,'Body','Core',()=>true),/one explicit/);
});
test('coverage refuses node morph animation that needs explicit duplicated channels',()=>{
 const{doc,node}=fixture(),channel=doc.createAnimationChannel().setTargetNode(node).setTargetPath('weights');doc.createAnimation().addChannel(channel);assert.throws(()=>partitionCoverageMesh(doc,'Body','Core',(_,v)=>v!==0),/morph weights/);
});
async function written(){const{doc}=fixture(),io=new NodeIO(),reference=(await io.readBinary(await io.writeBinary(doc))).getRoot();partitionCoverageMesh(doc,'Body','Core',(_,v)=>v!==0);return {reference,actual:(await io.readBinary(await io.writeBinary(doc))).getRoot()};}
test('independent written-file gate accepts exact union and rejects reversed or duplicated triangles',async()=>{
 let{reference,actual}=await written();assert.equal(verifyCoveragePartition(reference,actual,'Body','Core').triangles,2);
 let accessor=actual.listMeshes()[0].listPrimitives()[0].getIndices(),indices=accessor.getArray().slice();[indices[0],indices[1]]=[indices[1],indices[0]];accessor.setArray(indices);assert.throws(()=>verifyCoveragePartition(reference,actual,'Body','Core'),/Triangle union/);
 ({reference,actual}=await written());accessor=actual.listMeshes()[0].listPrimitives()[0].getIndices();accessor.setArray(new Uint16Array([...accessor.getArray(),0,1,2]));assert.throws(()=>verifyCoveragePartition(reference,actual,'Body','Core'),/Triangle union/);
});
test('written gate rejects changed morph attributes, frames and ownership metadata',async()=>{
 let{reference,actual}=await written();let a=actual.listMeshes()[0].listPrimitives()[0].listTargets()[0].getAttribute('POSITION'),values=a.getArray().slice();values[0]+=.1;a.setArray(values);assert.throws(()=>verifyCoveragePartition(reference,actual,'Body','Core'),/morph/);
 ({reference,actual}=await written());actual.listNodes().find(n=>n.getMesh()?.getName()==='Core').setTranslation([9,2,3]);assert.throws(()=>verifyCoveragePartition(reference,actual,'Body','Core'),/world frame/);
 ({reference,actual}=await written());actual.listMeshes()[1].listPrimitives()[0].setExtras({coveragePartition:{sourceMesh:'Body',sourcePrimitive:99}});assert.throws(()=>verifyCoveragePartition(reference,actual,'Body','Core'),/Unexpected/);
});
