/** Read actual written bytes against an independently parsed source, rather than
 * accepting a producer's triangle counts as proof. Shared attributes preserve
 * the complete body union, including when both parts are visible and morphed.
 * https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#meshes
 * https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#skins
 */
import assert from 'node:assert/strict';
const arrays=(a,b,label)=>{assert.equal(a?.getType(),b?.getType(),label);assert.equal(a?.getNormalized(),b?.getNormalized(),label);assert.deepEqual(a?.getArray(),b?.getArray(),label);};
// Meshopt index encoding may cyclically rotate a triangle. Compare its original
// winding, never a sorted vertex set (which would accept a reversed triangle).
// https://github.com/zeux/meshoptimizer#index-compression
const triangleKeys=indices=>{const keys=[];for(let i=0;i<indices.length;i+=3){const t=Array.from(indices.slice(i,i+3)),n=t.indexOf(Math.min(...t));keys.push(t.slice(n).concat(t.slice(0,n)).join(','));}return keys.sort();};
export function verifyCoveragePartition(source,actual,meshName,coveredName){
 const names=[meshName,...(Array.isArray(coveredName)?coveredName:[coveredName])];
 assert(names.length>=2&&new Set(names).size===names.length,'Invalid coverage mesh names');
 const original=source.listMeshes().find(m=>m.getName()===meshName),parts=actual.listMeshes().filter(m=>names.includes(m.getName()));assert(original&&parts.length===names.length,'Missing coverage meshes');
 let triangles=0;
 for(const q of parts.flatMap(m=>m.listPrimitives())){const meta=q.getExtras().coveragePartition;assert(meta?.sourceMesh===meshName&&Number.isInteger(meta.sourcePrimitive)&&meta.sourcePrimitive>=0&&meta.sourcePrimitive<original.listPrimitives().length,'Unexpected coverage primitive');}
 for(const [ordinal,p]of original.listPrimitives().entries()){
  const members=parts.flatMap(m=>m.listPrimitives()).filter(q=>q.getExtras().coveragePartition?.sourceMesh===meshName&&q.getExtras().coveragePartition?.sourcePrimitive===ordinal);
  assert(members.length>=1&&members.length<=parts.length,'Invalid coverage primitive ownership');const union=[];
  for(const q of members){
   assert.equal(q.getMode(),p.getMode(),'Primitive mode');assert.deepEqual(q.listSemantics(),p.listSemantics(),'Attribute semantics');
   for(const semantic of p.listSemantics())arrays(p.getAttribute(semantic),q.getAttribute(semantic),semantic);
   assert.equal(q.getMaterial()?.getName(),p.getMaterial()?.getName(),'Material');assert.equal(q.listTargets().length,p.listTargets().length,'Morph count');
   for(const [i,t]of p.listTargets().entries()){const a=q.listTargets()[i];assert.deepEqual(a.listSemantics(),t.listSemantics(),'Morph semantics');for(const semantic of t.listSemantics())arrays(t.getAttribute(semantic),a.getAttribute(semantic),`morph ${i}/${semantic}`);}
   for(const member of members.slice(1)){for(const semantic of p.listSemantics())assert.equal(members[0].getAttribute(semantic),member.getAttribute(semantic),'Written attributes must be shared');for(const [i,t]of members[0].listTargets().entries())for(const semantic of t.listSemantics())assert.equal(t.getAttribute(semantic),member.listTargets()[i].getAttribute(semantic),'Written morph accessors must be shared');}
   union.push(...q.getIndices().getArray());
  }
  assert.deepEqual(triangleKeys(union),triangleKeys(p.getIndices().getArray()),'Triangle union or winding differs');triangles+=union.length/3;
 }
 const sourceNode=source.listNodes().find(n=>n.getMesh()===original),nodes=actual.listNodes().filter(n=>parts.includes(n.getMesh()));assert.equal(nodes.length,parts.length,'Coverage instances');
 for(const node of nodes){assert.deepEqual(node.getWorldMatrix(),sourceNode.getWorldMatrix(),'Coverage world frame');assert.equal(node.getParentNode()?.getName(),sourceNode.getParentNode()?.getName(),'Coverage parent');assert.deepEqual(node.getWeights(),sourceNode.getWeights(),'Node morph weights');assert.deepEqual(node.getMesh().getWeights(),original.getWeights(),'Mesh morph weights');}
 for(const node of nodes.slice(1))assert.equal(nodes[0].getSkin(),node.getSkin(),'Coverage skin must be shared');
 const expected=sourceNode.getSkin(),skin=nodes[0].getSkin();
 if(expected){assert(skin,'Missing coverage skin');assert.deepEqual(skin.listJoints().map(j=>j.getName()),expected.listJoints().map(j=>j.getName()),'Joint order');arrays(skin.getInverseBindMatrices(),expected.getInverseBindMatrices(),'Inverse binds');for(const [i,j]of expected.listJoints().entries())assert.deepEqual(skin.listJoints()[i].getWorldMatrix(),j.getWorldMatrix(),'Joint rest frame');}
 const signatures=root=>root.listAnimations().map(a=>({name:a.getName(),channels:a.listChannels().map(c=>({node:c.getTargetNode()?.getName(),path:c.getTargetPath(),interpolation:c.getSampler()?.getInterpolation(),input:Array.from(c.getSampler()?.getInput()?.getArray()||[]),output:Array.from(c.getSampler()?.getOutput()?.getArray()||[])}))}));
 assert.deepEqual(signatures(actual),signatures(source),'Animation curve/target ownership');
 return {triangles,attributesExact:true,morphsExact:true,skinExact:true,framesExact:true,sourceAnimationExact:true};
}
