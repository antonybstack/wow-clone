/** Restore an existing index-only foot partition before reclassifying it.
 * Authored identity bytes already contain their own eyes/hair/source curves;
 * reuse them rather than rebuilding unrelated art from an ignored audition.
 * This follows repair-identity-torso-coverage and the shared partition compiler.
 * https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#meshes
 * https://gltf-transform.dev/modules/core/classes/Primitive
 */
import assert from 'node:assert/strict';
import {deriveFootCore} from './derive-coverage-geosets.mjs';

export function restoreFootCoverageUnion(doc,race){
 assert(['human','undead'].includes(race),'Unsupported foot coverage race');
 const label=race==='human'?'Human':'Undead',root=doc.getRoot();
 const body=root.listMeshes().find(m=>m.getName()===`${label}V1Body`);
 const core=root.listMeshes().find(m=>m.getName()===`${label}FootCore`);
 assert(body&&core,'Expected existing foot partition');
 assert.equal(body.listPrimitives().length,1);assert.equal(core.listPrimitives().length,1);
 const exposed=body.listPrimitives()[0],covered=core.listPrimitives()[0];
 assert.deepEqual(exposed.listSemantics(),covered.listSemantics());
 for(const semantic of exposed.listSemantics())assert.equal(exposed.getAttribute(semantic),covered.getAttribute(semantic),'Foot attributes must be shared');
 assert.deepEqual(exposed.listTargets(),covered.listTargets(),'Foot morphs must be shared');
 assert.equal(exposed.getMaterial(),covered.getMaterial());
 const bodyNodes=root.listNodes().filter(n=>n.getMesh()===body),coreNodes=root.listNodes().filter(n=>n.getMesh()===core);
 assert.equal(bodyNodes.length,1);assert.equal(coreNodes.length,1);
 assert.equal(bodyNodes[0].getSkin(),coreNodes[0].getSkin());
 assert.equal(bodyNodes[0].getParentNode(),coreNodes[0].getParentNode());
 assert.deepEqual(bodyNodes[0].getWorldMatrix(),coreNodes[0].getWorldMatrix());
 assert.deepEqual(bodyNodes[0].getWeights(),coreNodes[0].getWeights());
 assert.deepEqual(body.getWeights(),core.getWeights());
 const oldIndex=exposed.getIndices(),a=oldIndex.getArray(),b=covered.getIndices().getArray();
 const indices=new a.constructor(a.length+b.length);indices.set(a);indices.set(b,a.length);
 exposed.setIndices(doc.createAccessor('FootCoverageUnion',oldIndex.getBuffer()).setType('SCALAR').setArray(indices));
 const discarded=[oldIndex,covered.getIndices()];
 coreNodes[0].dispose();covered.dispose();core.dispose();
 for(const accessor of discarded)if(!accessor.listParents().some(p=>p.propertyType!=='Root'))accessor.dispose();
 return {originalCoreTriangles:b.length/3};
}

export function repairFootCoverage(doc,race){
 const name=race==='human'?'HumanFootCore':'UndeadFootCore';
 const core=doc.getRoot().listMeshes().find(m=>m.getName()===name);
 assert(core,'Expected existing foot partition');
 const previous=Array.from(core.listPrimitives()[0].getIndices().getArray());
 const {originalCoreTriangles}=restoreFootCoverageUnion(doc,race);
 const result=deriveFootCore(doc,race);
 // A larger face count is insufficient: every previously covered wound face,
 // including its multiplicity, must remain covered. Cyclic corner rotation is
 // the native codec's allowed representation change, not a winding reversal.
 // https://github.com/zeux/meshoptimizer#index-compression
 const key=t=>[t,t.slice(1).concat(t[0]),t.slice(2).concat(t.slice(0,2))].map(r=>r.join(',')).sort()[0];
 const actual=doc.getRoot().listMeshes().find(m=>m.getName()===name).listPrimitives()[0].getIndices().getArray(),counts=new Map();
 for(let i=0;i<actual.length;i+=3){const k=key(Array.from(actual.subarray(i,i+3)));counts.set(k,(counts.get(k)||0)+1);}
 for(let i=0;i<previous.length;i+=3){const k=key(previous.slice(i,i+3)),count=counts.get(k)||0;assert(count>0,'Foot repair revealed previously covered anatomy');counts.set(k,count-1);}
 return {...result,originalCoreTriangles,addedTriangles:result.partition.coveredTriangles-originalCoreTriangles,previousCoveredFacesRetained:true};
}
