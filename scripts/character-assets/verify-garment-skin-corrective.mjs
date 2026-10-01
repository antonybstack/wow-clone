/** Offline invariants for a weight-only audition, independent of visual fit.
 * https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#skins
 */
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {MeshoptDecoder} from 'meshoptimizer';
const directory=process.argv[2];assert(directory?.startsWith('.cache/'));
const report=JSON.parse(await fs.readFile(`${directory}/pilgrimTunic-report.json`,'utf8'));
const sha=b=>createHash('sha256').update(b).digest('hex');
assert.equal(sha(await fs.readFile(report.source.garment)),report.source.garmentSha256);
assert.equal(sha(await fs.readFile(report.source.body)),report.source.bodySha256);
assert.equal(sha(await fs.readFile(report.candidate.path)),report.candidate.sha256);
await MeshoptDecoder.ready;
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder});
const a=(await io.read(report.source.garment)).getRoot(),b=(await io.read(report.candidate.path)).getRoot();
const arrayBytes=acc=>{const x=acc.getArray();return Buffer.from(x.buffer,x.byteOffset,x.byteLength);};
assert.equal(a.listMeshes().length,b.listMeshes().length);let vertices=0,untouched=0,maxWeightSumError=0;
const transfer=JSON.parse(await fs.readFile(`${directory}/pilgrimTunic-weights.json`,'utf8'));
// Independent correspondence check: the native importer float roundtrip can put
// a point on the other side of a quantization boundary. Search adjacent cells.
const masks=new Map();for(const r of transfer.rows){const key=r.position.map(n=>Math.round(n*1e5)).join(',');if(!masks.has(key))masks.set(key,[]);masks.get(key).push(r);}
function nativeMask(point){const cell=point.map(n=>Math.round(n*1e5));let distance=1e-5,factor;
 for(let x=-1;x<=1;x++)for(let y=-1;y<=1;y++)for(let z=-1;z<=1;z++)for(const r of masks.get([cell[0]+x,cell[1]+y,cell[2]+z].join(','))||[]){const d=Math.hypot(...point.map((n,i)=>n-r.position[i]));if(d<distance){distance=d;factor=r.transferFactor;}}
 return factor;
}
for(const [mi,mesh]of a.listMeshes().entries()){
 const next=b.listMeshes()[mi];assert.equal(mesh.getName(),next.getName());assert.equal(mesh.listPrimitives().length,next.listPrimitives().length);
 for(const [pi,p]of mesh.listPrimitives().entries()){
  const q=next.listPrimitives()[pi];assert.deepEqual(p.listSemantics(),q.listSemantics());assert.deepEqual(arrayBytes(p.getIndices()),arrayBytes(q.getIndices()));
  for(const name of p.listSemantics().filter(n=>!['JOINTS_0','WEIGHTS_0'].includes(n)))assert.deepEqual(arrayBytes(p.getAttribute(name)),arrayBytes(q.getAttribute(name)),name);
  assert.equal(q.listTargets().length,0);const pos=p.getAttribute('POSITION').getArray(),w=q.getAttribute('WEIGHTS_0').getArray(),j=q.getAttribute('JOINTS_0').getArray();
  const oldW=p.getAttribute('WEIGHTS_0').getArray(),oldJ=p.getAttribute('JOINTS_0').getArray();
  for(let v=0;v<pos.length/3;v++){
   const values=Array.from(w.slice(v*4,v*4+4));assert(values.every(n=>Number.isFinite(n)&&n>=0&&n<=1));const residual=Math.abs(values.reduce((a,b)=>a+b,0)-1);assert(residual<1e-6);maxWeightSumError=Math.max(maxWeightSumError,residual);
   assert(Array.from(j.slice(v*4,v*4+4)).every(n=>n>=0&&n<65));
   const factor=nativeMask(Array.from(pos.slice(v*3,v*3+3)));assert(factor!==undefined,'Missing native mask correspondence');
   if(factor===0){assert.deepEqual(Array.from(w.slice(v*4,v*4+4)),Array.from(oldW.slice(v*4,v*4+4)));assert.deepEqual(Array.from(j.slice(v*4,v*4+4)),Array.from(oldJ.slice(v*4,v*4+4)));untouched++;}vertices++;
  }
 }
}
assert.equal(a.listSkins().length,b.listSkins().length);
for(const [i,skin]of a.listSkins().entries()){
 const next=b.listSkins()[i];assert.equal(next.listJoints().length,65);assert.deepEqual(skin.listJoints().map(n=>n.getName()),next.listJoints().map(n=>n.getName()));assert.deepEqual(arrayBytes(skin.getInverseBindMatrices()),arrayBytes(next.getInverseBindMatrices()));
}
assert.equal(a.listNodes().length,b.listNodes().length);
for(const [i,n]of a.listNodes().entries()){const m=b.listNodes()[i];assert.equal(n.getName(),m.getName());assert.deepEqual(n.getMatrix(),m.getMatrix());}
assert.equal(a.listAnimations().length,0);assert.equal(b.listAnimations().length,0);
assert.deepEqual(a.listMaterials().map(m=>[m.getName(),m.getBaseColorFactor(),m.getMetallicFactor(),m.getRoughnessFactor()]),b.listMaterials().map(m=>[m.getName(),m.getBaseColorFactor(),m.getMetallicFactor(),m.getRoughnessFactor()]));
assert.deepEqual(a.listTextures().map(t=>sha(Buffer.from(t.getImage()))),b.listTextures().map(t=>sha(Buffer.from(t.getImage()))));
const result={passed:true,vertices,untouchedVertexRows:untouched,maxWeightSumError,geometryUvIndicesBindTransformsMaterialsTextures:'identical',sourceBodySha256:report.source.bodySha256,candidateSha256:report.candidate.sha256};
await fs.writeFile(`${directory}/verification.json`,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
