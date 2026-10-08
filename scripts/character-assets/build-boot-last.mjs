/** Grade the authored leather boot onto an accepted source-65 foot and calf.
 * Body registration folded the original ankle/vamp. Measured cross-sections
 * resize the source last without smoothing away its leather volume or details.
 * Offline POSITION/NORMAL bake only; native Lite retains the original skin.
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
import {globalMatricesByName,poseNodes} from './pose-skin.mjs';
import {vertexNormals} from './garment-coverage.mjs';
import {verifyFactoryEquipmentBind} from './verify-factory-equipment-bind.mjs';
import {canonicalizeFactoryTriangles} from './equipment-factory-contract.mjs';
import {assertTriangleRotations} from './triangle-index-contract.mjs';

const descriptorPath=process.argv[3]||'blender/characters/wardrobe/boot-last.json';
assert(['blender/characters/wardrobe/boot-last.json','blender/characters/wardrobe/boot-forefoot.json'].includes(descriptorPath),'Use a reviewed boot descriptor');
const descriptorBytes=await fs.readFile(descriptorPath),d=JSON.parse(descriptorBytes);
const forefoot=descriptorPath.endsWith('/boot-forefoot.json');
const out=process.argv[2]||'.cache/character-mmo/boot-last';
const relative=path.relative(path.resolve('.cache'),path.resolve(out));
assert(relative&&!relative.startsWith('..')&&!path.isAbsolute(relative),'Only isolated .cache candidates');
assert.equal(d.schema,1);assert.equal(d.id,forefoot?'wayfarer-forefoot':'wayfarer-last');assert.equal(d.revision,1);
assert.deepEqual(Object.keys(d.fits),forefoot?['human','undead']:['orc']);
assert.equal(d.sections.length,forefoot?4:5);assert.equal(d.heightKnots.length,forefoot?5:6);
if(forefoot){
 assert.deepEqual(Object.keys(d.forefootBlend).sort(),['fadeEndM','fullBelowM']);
 const {fullBelowM,fadeEndM}=d.forefootBlend;
 assert(Number.isFinite(fullBelowM)&&Number.isFinite(fadeEndM)&&fullBelowM>0&&fullBelowM<fadeEndM&&fadeEndM<=.16);
}
assert(d.strapClearanceM>0&&d.strapClearanceM<=.01);
for(const [i,row] of d.sections.entries()){
 assert.equal(row.length,3);assert(row.every(Number.isFinite));assert(row[2]>0&&row[2]<=.05);
 if(i)assert(row[0]>d.sections[i-1][0]&&row[1]>d.sections[i-1][1]);
}
for(const [i,row] of d.heightKnots.entries()){
 assert.equal(row.length,2);assert(row.every(Number.isFinite));
 if(i)assert(row[0]>d.heightKnots[i-1][0]&&row[1]>d.heightKnots[i-1][1]);
}
const sha=b=>createHash('sha256').update(b).digest('hex');
async function pinned(file,expected){const bytes=await fs.readFile(file);assert.equal(sha(bytes),expected,`Unreviewed source ${file}`);return bytes;}
await Promise.all([MeshoptDecoder.ready,MeshoptEncoder.ready]);
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder,'meshopt.encoder':MeshoptEncoder}).setVertexLayout(VertexLayout.SEPARATE);
const authored=(await io.readBinary(await pinned(d.authored.source,d.authored.sha256))).getRoot();
const sourceBody=(await io.readBinary(await pinned(d.authored.body,d.authored.bodySha256))).getRoot();
const a=authored.listMeshes()[0].listPrimitives()[0],S=a.getAttribute('POSITION').getArray();
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
function frame(g,side){
 const f=Array.from(g.get(`mixamorig:${side}Foot`)).slice(12,15),t=Array.from(g.get(`mixamorig:${side}ToeBase`)).slice(12,15);
 const delta=[t[0]-f[0],0,t[2]-f[2]],length=Math.hypot(...delta);assert(length>.01);
 const forward=delta.map(v=>v/length),right=[forward[2],0,-forward[0]];return{f,forward,right};
}
function points(root,frame,sign,mesh){
 const result=[];
 for(const m of root.listMeshes())if(!mesh||m.getName()===mesh)for(const p of m.listPrimitives()){
  const a=p.getAttribute('POSITION').getArray();
  // Published body geosets share the complete source POSITION array and split
  // only indices. Use that complete array for the last's anatomical sections.
  for(let v=0;v<a.length/3;v++)if(a[v*3]*sign>0&&a[v*3+1]<.55){
   const xyz=Array.from(a.subarray(v*3,v*3+3)),delta=xyz.map((x,k)=>x-frame.f[k]);
   result.push([dot(delta,frame.right),xyz[1],dot(delta,frame.forward)]);
  }
 }
 return result;
}
function section(points,y,window){
 const slice=points.filter(p=>Math.abs(p[1]-y)<=window);assert(slice.length>8);
 const min=[0,2].map(k=>Math.min(...slice.map(p=>p[k]))),max=[0,2].map(k=>Math.max(...slice.map(p=>p[k])));
 const half=min.map((v,i)=>(max[i]-v)/2);assert(half.every(v=>v>.005));
 return{count:slice.length,center:min.map((v,i)=>(v+max[i])/2),half};
}
function interpolate(stations,y,key){
 if(y<=stations[0].sy)return stations[0][key];if(y>=stations.at(-1).sy)return stations.at(-1)[key];
 let i=0;while(stations[i+1].sy<y)i++;
 let t=(y-stations[i].sy)/(stations[i+1].sy-stations[i].sy);t=t*t*(3-2*t);
 return stations[i][key].map((v,k)=>v+(stations[i+1][key][k]-v)*t);
}
function height(y,knots=d.heightKnots){
 let i=0;if(y<=knots[0][0])return knots[0][1];
 while(i<knots.length-2&&knots[i+1][0]<y)i++;
 const [a,b]=knots[i],[c,e]=knots[i+1];return b+(e-b)*(y-a)/(c-a);
}
const sg=globalMatricesByName(authored,poseNodes(authored,null,0)),rows=[];
for(const [race,fit]of Object.entries(d.fits)){
 const sections=d.sections,knots=d.heightKnots;
 const input=await pinned(fit.source,fit.sha256),body=(await io.readBinary(await pinned(fit.body,fit.bodySha256))).getRoot();
 const doc=await io.readBinary(input),root=doc.getRoot();assert.equal(root.listMeshes().length,1);assert.equal(root.listAnimations().length,0);
 assert.equal(root.listMeshes()[0].getName(),'WayfarerBoots');assert.equal(root.listMeshes()[0].listPrimitives().length,1);
 const p=root.listMeshes()[0].listPrimitives()[0],P=p.getAttribute('POSITION').getArray(),Q=Float32Array.from(P);
 assert.equal(P.length,3530*3);assert.equal(P.length,S.length);
 assert.deepEqual(p.getAttribute('TEXCOORD_0').getArray(),a.getAttribute('TEXCOORD_0').getArray());
 const topology=(await io.readBinary(input)).getRoot();canonicalizeFactoryTriangles(topology);
 const authoredTopology=(await io.readBinary(await pinned(d.authored.source,d.authored.sha256))).getRoot();canonicalizeFactoryTriangles(authoredTopology);
 assert.deepEqual(topology.listMeshes()[0].listPrimitives()[0].getIndices().getArray(),authoredTopology.listMeshes()[0].listPrimitives()[0].getIndices().getArray());
 p.setExtras({...p.getExtras(),deformation:'soft-skin'});const verificationBefore=verifyFactoryEquipmentBind(root,body,fit.bodyMesh);
 const tg=globalMatricesByName(body,poseNodes(body,null,0)),feet=[];
 for(const [side,sign]of [['Left',1],['Right',-1]]){
  const sf=frame(sg,side),tf=frame(tg,side),sb=points(sourceBody,sf,sign),tb=points(body,tf,sign,fit.bodyMesh);
  const stations=sections.map(([sy,ty,w])=>{const s=section(sb,sy,w),t=section(tb,ty,w);return{sy,ty,source:s,target:t,sc:s.center,tc:t.center,ratio:s.half.map((x,k)=>t.half[k]/x)};});
  assert(stations.every(s=>s.ratio.every(v=>v>.5&&v<4)),'Implausible last grading');
  let maxMoveM=0,vertices=0;
  for(let v=0;v<S.length/3;v++){
   if(S[v*3]*sign<=0)continue;
   const xyz=Array.from(S.subarray(v*3,v*3+3)),delta=xyz.map((x,k)=>x-sf.f[k]);
   const local=[dot(delta,sf.right),dot(delta,sf.forward)],sc=interpolate(stations,xyz[1],'sc'),tc=interpolate(stations,xyz[1],'tc'),ratio=interpolate(stations,xyz[1],'ratio');
   const mapped=local.map((x,k)=>tc[k]+(x-sc[k])*ratio[k]);
   if((v>=1337&&v<=1764)||(v>=3102&&v<=3529)){
    const radius=Math.hypot(...mapped);assert(radius>1e-4);
    for(let k=0;k<2;k++)mapped[k]+=d.strapClearanceM*mapped[k]/radius;
   }
   const target=[tf.f[0]+mapped[0]*tf.right[0]+mapped[1]*tf.forward[0],height(xyz[1],knots),tf.f[2]+mapped[0]*tf.right[2]+mapped[1]*tf.forward[2]];
   if(forefoot){
    // Restore authored toe/vamp form rather than lifting an already folded
    // body-wrapped surface. Blend into the accepted ankle; the source skin,
    // UVs and cuff stay intact. Reuse offline accessor/native skin contracts:
    // https://gltf-transform.dev/modules/core/classes/Accessor
    // https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#skinning
    let blend=Math.max(0,Math.min(1,(d.forefootBlend.fadeEndM-xyz[1])/(d.forefootBlend.fadeEndM-d.forefootBlend.fullBelowM)));
    blend=blend*blend*(3-2*blend);
    for(let k=0;k<3;k++)if(blend>0)Q[v*3+k]=P[v*3+k]+blend*(target[k]-P[v*3+k]);
   }else{Q[v*3]=target[0];Q[v*3+1]=target[1];Q[v*3+2]=target[2];}
   maxMoveM=Math.max(maxMoveM,Math.hypot(...Array.from(Q.subarray(v*3,v*3+3),(x,k)=>x-P[v*3+k])));vertices++;
  }
  assert.equal(vertices,1765);assert(maxMoveM<.15);feet.push({side,stations,vertices,maxMoveM});
 }
 p.getAttribute('POSITION').setArray(Q);p.getAttribute('NORMAL').setArray(vertexNormals(Q,p.getIndices().getArray()));
 const bytes=await io.writeBinary(doc),written=(await io.readBinary(bytes)).getRoot(),check=written.listMeshes()[0].listPrimitives()[0];
 assertTriangleRotations(check.getIndices().getArray(),p.getIndices().getArray(),'Authored boot triangles');
 for(const sem of p.listSemantics())assert.deepEqual(check.getAttribute(sem).getArray(),p.getAttribute(sem).getArray(),`Readback ${sem}`);
 const before=(await io.readBinary(input)).getRoot().listMeshes()[0].listPrimitives()[0];
 for(const sem of before.listSemantics().filter(s=>!['POSITION','NORMAL'].includes(s)))assert.deepEqual(check.getAttribute(sem).getArray(),before.getAttribute(sem).getArray(),`Source ${sem}`);
 if(forefoot)for(let v=0;v<S.length/3;v++)if(S[v*3+1]>=d.forefootBlend.fadeEndM)
  assert.deepEqual(check.getAttribute('POSITION').getArray().subarray(v*3,v*3+3),P.subarray(v*3,v*3+3),'Accepted ankle/cuff changed');
 const directory=path.join(out,race);await fs.mkdir(directory,{recursive:true});const file=path.join(directory,'wayfarerBoots.glb');await fs.writeFile(file,bytes);
 rows.push({race,source:fit,artifact:{file,bytes:bytes.length,sha256:sha(bytes)},feet,verificationBefore,verification:verifyFactoryEquipmentBind(written,body,fit.bodyMesh),skinAndUvExact:true,orderedWoundTrianglesExact:true});
}
await fs.writeFile(path.join(out,'report.json'),JSON.stringify({candidateOnly:true,descriptor:{path:descriptorPath,sha256:sha(descriptorBytes)},rows},null,2)+'\n');
console.log(JSON.stringify(rows.map(({race,artifact,feet})=>({race,artifact,feet})),null,2));
