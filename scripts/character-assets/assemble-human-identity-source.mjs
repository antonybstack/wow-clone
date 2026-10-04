/** Prepare the grey continuous-surface proof for the existing Lite runtime.
 * Morph accessors must remain non-interleaved on pinned Lite 1.31.1.
 * https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#morph-targets
 */
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {NodeIO, VertexLayout, PropertyType} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {compressTexture,copyToDocument,prune,unpartition} from '@gltf-transform/functions';
import sharp from 'sharp';
import {normalizeHumanBind} from './normalize-human-bind.mjs';
import {buildSegments,restWorld,softShape,recomputeNormals} from './girth-field.mjs';

const age=process.argv[2]||'old';
assert(['young','old','young-hair','old-hair'].includes(age));
const kind=process.argv[3]||'grey';assert(['grey','painted'].includes(kind));
const dir='.cache/character-mmo/identity-v1';
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).setVertexLayout(VertexLayout.SEPARATE);
const doc=await io.read(`${dir}/human-${age}-${kind}-raw.glb`),root=doc.getRoot();
const baseDoc=await io.read('.cache/character-mmo/m004/human-shape-family-v1.glb'),base=baseDoc.getRoot();
const adapter=normalizeHumanBind(root,base,'HumanIdentityBody');
const mesh=root.listMeshes().find(m=>m.getName()==='HumanIdentityBody');
assert(mesh&&mesh.listPrimitives().length===1);
mesh.setName('HumanV1Body');
for(const node of root.listNodes().filter(n=>n.getMesh()===mesh))node.setName('HumanV1Body');
assert.equal(root.listAnimations().length,57);
assert.equal(mesh.listPrimitives()[0].listTargets().length,2);
mesh.setWeights([0,0]);
mesh.setExtras({...mesh.getExtras(),targetNames:['slender','stout']});
const girth=JSON.parse(await fs.readFile('docs/baselines/character-mmo/m004/makehuman-girth.json','utf8'));
const {segments}=buildSegments(root.listSkins()[0].listJoints(),restWorld(root),girth);
// Retain torso/rim correspondence, then ease into the same measured Head field.
// Its accepted width change is only ~0.26%, not a new skull-size slider.
// Hair and eyeballs use this field too. A rigid Head attachment follows pose,
// but does not follow the socket width change driven by a native morph target.
// https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#morph-targets
for(const candidate of root.listMeshes().filter(m=>['HumanV1Body','HumanPonytail01','HumanIdentityEyes','HumanIdentityBrows'].includes(m.getName()))){
 const body=candidate.getName()==='HumanV1Body';
 for(const prim of candidate.listPrimitives()){
  const position=prim.getAttribute('POSITION').getArray(),baseNormals=prim.getAttribute('NORMAL').getArray();
  const joints=prim.getAttribute('JOINTS_0').getArray(),weights=prim.getAttribute('WEIGHTS_0').getArray();
  const original=prim.listTargets();
  for(const [index,name]of ['slender','stout'].entries()){
   const field=softShape(position,joints,weights,segments,name).shaped;
   const delta=body?Float32Array.from(original[index].getAttribute('POSITION').getArray()):new Float32Array(position.length);
   for(let v=0;v<position.length/3;v++){
    const t=body?Math.max(0,Math.min(1,(position[v*3+1]-1.57)/.03)):1,fade=t*t*(3-2*t);
    for(let k=0;k<3;k++){const c=v*3+k;delta[c]=delta[c]*(1-fade)+(field[c]-position[c])*fade;}
   }
   const shaped=Float32Array.from(position,(value,c)=>value+delta[c]);
   // UV splits are render vertices. Reuse the normal evaluator on their common
   // logical positions while retaining authored hard-normal boundaries.
   const keys=new Map(),logical=[],mapping=[];
   for(let v=0;v<position.length/3;v++){
    const key=[...shaped.subarray(v*3,v*3+3),...baseNormals.subarray(v*3,v*3+3)].map(x=>x.toFixed(7)).join(',');
    if(!keys.has(key)){keys.set(key,logical.length/3);logical.push(...shaped.subarray(v*3,v*3+3));}
    mapping.push(keys.get(key));
   }
   const indices=Uint32Array.from(prim.getIndices().getArray(),i=>mapping[i]);
   const normals=recomputeNormals(Float32Array.from(logical),indices,logical.length/3);
   const normalDelta=Float32Array.from(baseNormals,(value,c)=>normals[mapping[Math.floor(c/3)]*3+c%3]-value);
   if(body){
    original[index].getAttribute('POSITION').setArray(delta);
    original[index].getAttribute('NORMAL').setArray(normalDelta);
   }else{
    const buffer=root.listBuffers()[0];
    prim.addTarget(doc.createPrimitiveTarget(name)
     .setAttribute('POSITION',doc.createAccessor().setType('VEC3').setArray(delta).setBuffer(buffer))
     .setAttribute('NORMAL',doc.createAccessor().setType('VEC3').setArray(normalDelta).setBuffer(buffer)));
   }
  }
 }
 candidate.setWeights([0,0]);candidate.setExtras({...candidate.getExtras(),targetNames:['slender','stout']});
}
// Blender's action export rounded source durations to frames and resampled
// curves. Keep exact compatible source accessors, remapping only target nodes.
// copyToDocument owns accessor/extension copying; prune removes its orphaned
// source-node dependencies once channels address the existing accepted rig.
// https://gltf-transform.dev/modules/functions/functions/copyToDocument
const existingNodes=new Map(root.listNodes().map(node=>[node.getName(),node]));
for(const animation of root.listAnimations()){
 // Property.dispose detaches the animation, but is deliberately non-recursive.
 // Dispose its owned channels/samplers too: their otherwise orphaned references
 // keep the discarded Blender curves and duplicate bones alive through prune.
 // https://gltf-transform.dev/modules/core/classes/Property#dispose
 for(const channel of animation.listChannels())channel.dispose();
 for(const sampler of animation.listSamplers())sampler.dispose();
 animation.dispose();
}
const sourceAnimations=base.listAnimations();
const copies=copyToDocument(doc,baseDoc,sourceAnimations);
for(const source of sourceAnimations){
 const animation=copies.get(source);
 for(const channel of animation.listChannels()){
  assert.notEqual(channel.getTargetPath(),'weights','Do not copy geometry-dependent weights');
  const target=existingNodes.get(channel.getTargetNode().getName());
  assert(target,`Missing source animation target ${channel.getTargetNode().getName()}`);
  channel.setTargetNode(target);
 }
}
// copyToDocument includes target-node dependencies. All channels now address
// the accepted rig, so release the copied node hierarchy explicitly; pruning
// alone does not remove an entire disconnected hierarchy of empty bone nodes.
// https://gltf-transform.dev/modules/core/classes/Property#dispose
const retainedNodes=new Set(existingNodes.values());
for(const copied of copies.values())if(copied.propertyType===PropertyType.NODE){
 assert(!retainedNodes.has(copied),'Do not dispose the accepted actor rig');
 copied.dispose();
}
await doc.transform(unpartition(),prune());
assert.equal(root.listAnimations().length,57);
assert.equal(root.listSkins().length,1);
// Identify eye textures by their actual owner. "eyebrow001" contains "eye";
// matching its name silently capped the licensed brow strands at 256 pixels.
// Native material ownership is also the basis of the runtime texture upgrades.
const eyeTextures=new Set(root.listMeshes().filter(m=>m.getName()==='HumanIdentityEyes')
 .flatMap(m=>m.listPrimitives().map(p=>p.getMaterial()?.getBaseColorTexture())).filter(Boolean));
for(const texture of root.listTextures()){
 const size=texture.getSize();if(size&&Math.max(...size)>1024)await compressTexture(texture,{encoder:sharp,targetFormat:'png',resize:[1024,1024],effort:8});
 if(eyeTextures.has(texture)&&Math.max(...texture.getSize())>256)await compressTexture(texture,{encoder:sharp,targetFormat:'png',resize:[256,256],effort:8});
}
const bytes=await io.writeBinary(doc);
const json=JSON.parse(Buffer.from(bytes).subarray(20,20+Buffer.from(bytes).readUInt32LE(12)).toString());
for(const mesh of json.meshes)for(const prim of mesh.primitives)for(const target of prim.targets||[])for(const id of Object.values(target)){
 const accessor=json.accessors[id],view=json.bufferViews?.[accessor.bufferView];
 assert(!view?.byteStride||view.byteStride===12,`${age}: interleaved morph data on pinned Lite`);
}
await fs.writeFile(`${dir}/human-${age}-${kind}.glb`,bytes);
console.log(JSON.stringify({age,bytes:bytes.length,...adapter}));
