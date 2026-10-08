/** Give the existing ankle straps a small authored clearance from their shell.
 * Offline pinned derivative only; body shape transfer and native Lite skinning
 * remain the existing pipeline. No runtime fitting or source rig/weight edits.
 * Keep accessor arrays and the glTF skin contract through native readback:
 * https://gltf-transform.dev/modules/core/classes/Accessor
 * https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#skinning
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {NodeIO,VertexLayout} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {MeshoptDecoder,MeshoptEncoder} from 'meshoptimizer';
import {vertexNormals} from './garment-coverage.mjs';
import {globalMatricesByName,poseNodes} from './pose-skin.mjs';
import {verifyFactoryEquipmentBind} from './verify-factory-equipment-bind.mjs';
import {canonicalizeFactoryTriangles} from './equipment-factory-contract.mjs';

const descriptorPath='blender/characters/wardrobe/boot-straps.json';
const descriptorBytes=await fs.readFile(descriptorPath),descriptor=JSON.parse(descriptorBytes);
const out=process.argv[2]||'.cache/character-mmo/boot-straps';
const relative=path.relative(path.resolve('.cache'),path.resolve(out));
assert(relative&&!relative.startsWith('..')&&!path.isAbsolute(relative),'Write an isolated candidate under .cache');
assert.equal(descriptor.schema,1);assert.equal(descriptor.id,'wayfarer-straps');assert.equal(descriptor.revision,1);
assert.deepEqual(Object.keys(descriptor.fits).sort(),['human','orc','undead']);
assert(Number.isFinite(descriptor.clearanceM)&&descriptor.clearanceM>0&&descriptor.clearanceM<=.01);
// These are the four disjoint components in the pinned authored mesh. Naming
// them explicitly avoids changing the leather shells or finding new runtime
// regions when UV seam duplication makes vertex proximity ambiguous.
assert.deepEqual(descriptor.straps,[
 {first:1337,last:1550,bone:'mixamorig:RightFoot'},
 {first:1551,last:1764,bone:'mixamorig:RightFoot'},
 {first:3102,last:3315,bone:'mixamorig:LeftFoot'},
 {first:3316,last:3529,bone:'mixamorig:LeftFoot'},
]);
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
async function pinned(file,expected){const bytes=await fs.readFile(file);assert.equal(sha(bytes),expected,`Unreviewed input ${file}`);return bytes;}
await Promise.all([MeshoptDecoder.ready,MeshoptEncoder.ready]);
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder,'meshopt.encoder':MeshoptEncoder}).setVertexLayout(VertexLayout.SEPARATE);
const authoredRoot=(await io.readBinary(await pinned(descriptor.authored.source,descriptor.authored.sha256))).getRoot();
canonicalizeFactoryTriangles(authoredRoot);
const authored=authoredRoot.listMeshes()[0].listPrimitives()[0];
const selected=new Set(descriptor.straps.flatMap(({first,last})=>Array.from({length:last-first+1},(_,i)=>first+i)));
assert.equal(selected.size,856);
for(const fit of Object.values(descriptor.fits))await Promise.all([pinned(fit.source,fit.sha256),pinned(fit.body,fit.bodySha256)]);
const rows=[];
for(const [race,fit]of Object.entries(descriptor.fits)){
 const input=await pinned(fit.source,fit.sha256),body=(await io.readBinary(await pinned(fit.body,fit.bodySha256))).getRoot();
 const doc=await io.readBinary(input),root=doc.getRoot();
 assert.equal(root.listMeshes().length,1);assert.equal(root.listMeshes()[0].getName(),'WayfarerBoots');
 assert.equal(root.listMeshes()[0].listPrimitives().length,1);assert.equal(root.listAnimations().length,0);
 const p=root.listMeshes()[0].listPrimitives()[0],P=p.getAttribute('POSITION').getArray(),N=p.getAttribute('NORMAL').getArray();
 // The older accepted Orc pack predates explicit factory deformation extras.
 // Declare its existing blended skin before the same strict independent check;
 // no palette or geometry exception is added to the checker.
 p.setExtras({...p.getExtras(),deformation:'soft-skin'});
 const verificationBefore=verifyFactoryEquipmentBind(root,body,fit.bodyMesh);
 assert.equal(P.length,3530*3);
 // The older Orc encoding cyclically rotates some triangles. Compare on an
 // independent canonical copy with the existing winding/duplicate-preserving
 // helper; the actual derivative keeps its own input indices exactly.
 const topology=(await io.readBinary(input)).getRoot();canonicalizeFactoryTriangles(topology);
 assert.deepEqual(topology.listMeshes()[0].listPrimitives()[0].getIndices().getArray(),authored.getIndices().getArray());
 assert.deepEqual(p.getAttribute('TEXCOORD_0').getArray(),authored.getAttribute('TEXCOORD_0').getArray());
 for(let i=0;i<p.getIndices().getCount();i+=3){
  const ids=p.getIndices().getArray().subarray(i,i+3),count=Array.from(ids).filter(v=>selected.has(v)).length;
  assert(count===0||count===3,'Strap selection cuts a connected shell triangle');
 }
 const output=Float32Array.from(P),normals=Float32Array.from(N),rest=globalMatricesByName(root,poseNodes(root,null,0));
 const straps=[];
 for(const {first,last,bone}of descriptor.straps){
  const m=rest.get(bone);assert(m,`Missing native ankle joint ${bone}`);
  const center=[m[12],m[14]];let maxDisplacementM=0;
  // Move the whole ring radially around its native rest ankle. Pushing each
  // surface along its normal would push the inner faces into the shell.
  // Source joint matrices are evaluated by the existing glTF pose helper:
  // https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#transformations
  for(let v=first;v<=last;v++){
   const dx=P[v*3]-center[0],dz=P[v*3+2]-center[1],radius=Math.hypot(dx,dz);assert(radius>1e-4,'Undefined strap radius');
   output[v*3]+=descriptor.clearanceM*dx/radius;output[v*3+2]+=descriptor.clearanceM*dz/radius;
   maxDisplacementM=Math.max(maxDisplacementM,Math.hypot(output[v*3]-P[v*3],output[v*3+2]-P[v*3+2]));
  }
  straps.push({first,last,bone,center,vertices:last-first+1,maxDisplacementM});
 }
 const rebuilt=vertexNormals(output,p.getIndices().getArray());
 for(const v of selected)normals.set(rebuilt.subarray(v*3,v*3+3),v*3);
 p.getAttribute('POSITION').setArray(output);p.getAttribute('NORMAL').setArray(normals);
 p.setExtras({...p.getExtras(),deformation:'soft-skin'});
 const bytes=await io.writeBinary(doc),written=(await io.readBinary(bytes)).getRoot(),check=written.listMeshes()[0].listPrimitives()[0];
 assert.deepEqual(check.getAttribute('POSITION').getArray(),output);assert.deepEqual(check.getAttribute('NORMAL').getArray(),normals);
 assert.deepEqual(check.getIndices().getArray(),p.getIndices().getArray());
 const before=(await io.readBinary(input)).getRoot().listMeshes()[0].listPrimitives()[0];
 for(const semantic of before.listSemantics().filter(s=>!['POSITION','NORMAL'].includes(s)))assert.deepEqual(check.getAttribute(semantic).getArray(),before.getAttribute(semantic).getArray(),`${race}/${semantic}`);
 for(let v=0;v<P.length/3;v++){
  assert.equal(output[v*3+1],P[v*3+1],'Strap height changed');
  if(!selected.has(v))for(let c=0;c<3;c++){assert.equal(output[v*3+c],P[v*3+c],'Leather shell changed');assert.equal(normals[v*3+c],N[v*3+c],'Leather shell normal changed');}
 }
 const verification=verifyFactoryEquipmentBind(written,body,fit.bodyMesh);
 const directory=path.join(out,race);await fs.mkdir(directory,{recursive:true});
 const file=path.join(directory,'wayfarerBoots.glb');await fs.writeFile(file,bytes);
 rows.push({race,source:fit,artifact:{file,bytes:bytes.length,sha256:sha(bytes)},straps,verificationBefore,verification,shellArraysExact:true,skinAndUvArraysExact:true});
}
await fs.writeFile(path.join(out,'report.json'),JSON.stringify({candidateOnly:true,descriptor:{path:descriptorPath,sha256:sha(descriptorBytes)},rows},null,2)+'\n');
console.log(JSON.stringify(rows.map(({race,artifact,straps})=>({race,artifact,straps})),null,2));
