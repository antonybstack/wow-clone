import test from 'node:test';
import assert from 'node:assert/strict';
import {Document,NodeIO} from '@gltf-transform/core';
import {deriveHumanFootCore,HUMAN_FOOT_COVERAGE_REVISION} from './character-assets/derive-coverage-geosets.mjs';
import {verifyCoveragePartition} from './character-assets/verify-coverage-partition.mjs';
import fs from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {MeshoptDecoder} from 'meshoptimizer';

function fixture(){
 const doc=new Document(),buffer=doc.createBuffer(),scene=doc.createScene(),parent=doc.createNode('Actor').setTranslation([3,4,5]);scene.addChild(parent);
 const rest={Hips:[0,1,0],Neck:[0,1.46,0],LeftFoot:[.18,.13,-.04],RightFoot:[-.18,.13,-.04],LeftToeBase:[.19,.02,.10],RightToeBase:[-.19,.02,.10],LeftLeg:[.18,.5,0]};
 const joints=Object.entries(rest).map(([name,position])=>doc.createNode(`mixamorig:${name}`).setTranslation(position));for(const joint of joints)parent.addChild(joint);
 const skin=doc.createSkin();for(const joint of joints)skin.addJoint(joint);
 const accessor=(type,array)=>doc.createAccessor().setType(type).setArray(array).setBuffer(buffer);
 skin.setInverseBindMatrices(accessor('MAT4',Float32Array.from(joints.flatMap(j=>[1,0,0,0,0,1,0,0,0,0,1,0,...j.getTranslation().map(v=>-v),1]))));
 const cells=[{x:.18,y:.03,mass:1,bone:'LeftFoot'},{x:-.18,y:.03,mass:1,bone:'RightToeBase'},{x:.18,y:.14,mass:1,bone:'LeftFoot'},{x:.18,y:.03,mass:.6,bone:'LeftFoot'},{x:0,y:1,mass:1,bone:'Hips'}];
 const positions=[],weights=[],indices=[],ids=[];
 for(const [i,cell]of cells.entries())for(const [dx,dy]of [[0,0],[.002,0],[0,.002]]){
  positions.push(cell.x+dx,cell.y+dy,.1);indices.push(i*3+indices.length%3);
  ids.push(Object.keys(rest).indexOf(cell.bone),Object.keys(rest).indexOf('LeftLeg'),0,0);weights.push(cell.mass,1-cell.mass,0,0);
 }
 const p=doc.createPrimitive().setAttribute('POSITION',accessor('VEC3',new Float32Array(positions))).setAttribute('JOINTS_0',accessor('VEC4',new Uint16Array(ids))).setAttribute('WEIGHTS_0',accessor('VEC4',new Float32Array(weights))).setIndices(accessor('SCALAR',new Uint16Array(indices)))
  .addTarget(doc.createPrimitiveTarget().setAttribute('POSITION',accessor('VEC3',new Float32Array(positions.length).fill(.01))));
 const mesh=doc.createMesh('HumanV1Body').addPrimitive(p).setWeights([.95]);parent.addChild(doc.createNode('HumanV1Body').setMesh(mesh).setSkin(skin).setWeights([.95]));
 const sampler=doc.createAnimationSampler().setInput(accessor('SCALAR',new Float32Array([0,1]))).setOutput(accessor('VEC3',new Float32Array([.18,.13,-.04,.18,.14,-.04])));
 doc.createAnimation('Source gait').addSampler(sampler).addChannel(doc.createAnimationChannel().setTargetNode(joints[2]).setTargetPath('translation').setSampler(sampler));
 return doc;
}

test('Human foot split preserves bare restoration and exact native morph, skin, frame and gait streams',async()=>{
 const doc=fixture(),io=new NodeIO(),source=(await io.readBinary(await io.writeBinary(doc))).getRoot();
 const result=deriveHumanFootCore(doc);assert.equal(result.revision,HUMAN_FOOT_COVERAGE_REVISION);assert.equal(result.partition.coveredTriangles,2);
 const actual=(await io.readBinary(await io.writeBinary(doc))).getRoot();
 assert.deepEqual(Array.from(actual.listMeshes().find(m=>m.getName()==='HumanFootCore').listPrimitives()[0].getIndices().getArray()),[0,1,2,3,4,5]);
 assert.deepEqual(Array.from(actual.listMeshes().find(m=>m.getName()==='HumanV1Body').listPrimitives()[0].getIndices().getArray()),[6,7,8,9,10,11,12,13,14]);
 assert.equal(verifyCoveragePartition(source,actual,'HumanV1Body','HumanFootCore').triangles,5);
});

test('missing native foot landmarks are refused before changing the body',()=>{
 const doc=fixture(),mesh=doc.getRoot().listMeshes()[0],indices=mesh.listPrimitives()[0].getIndices().getArray().slice();
 doc.getRoot().listNodes().find(n=>n.getName()==='mixamorig:RightToeBase').setName('Missing');
 assert.throws(()=>deriveHumanFootCore(doc),/Incomplete Human foot/);
 assert.equal(doc.getRoot().listMeshes().length,1);assert.deepEqual(mesh.listPrimitives()[0].getIndices().getArray(),indices);
});

test('every published Human body hides the toe faces independently picked in the native renderer',async()=>{
 await MeshoptDecoder.ready;
 const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder});
 const fixture=JSON.parse(await fs.readFile('docs/baselines/character-mmo/m5/shared-fit-2026-10-05/native-foot-faces.json'));
 assert.equal(fixture.faces.length,12,'The native control must identify real toe/instep faces');
 const shape=JSON.parse(await fs.readFile('public/ashen-reach/human-shape-v1/manifest.json'));
 const starter=JSON.parse(await fs.readFile('public/ashen-reach/startup/character/manifest.json'));
 const index=JSON.parse(await fs.readFile('public/ashen-reach/human-identity-v1/manifest.json'));
 const manifests=[shape,starter,...Object.values(index.presets).map(e=>e.manifest)];
 for(const manifest of manifests)for(const asset of [manifest.items.body,manifest.compactItems?.body].filter(Boolean)){
  const bytes=await fs.readFile('public'+asset.url),root=(await io.readBinary(asset.compression==='gzip'?gunzipSync(bytes):bytes)).getRoot();
  const foot=root.listMeshes().find(m=>m.getName()==='HumanFootCore');assert(foot,asset.url);
  const triangles=foot.listPrimitives().flatMap(p=>{const ids=p.getIndices().getArray(),pos=p.getAttribute('POSITION').getArray();return Array.from({length:ids.length/3},(_,i)=>Array.from(ids.slice(i*3,i*3+3),v=>Array.from(pos.slice(v*3,v*3+3))));});
  // Authored identity assembly introduces at most two float32 ulps in these
  // unchanged source coordinates. Match winding and a measured sub-micron
  // tolerance, rather than permitting an arbitrary sorted vertex set.
  const matches=(a,b)=>[0,1,2].some(k=>a.every((v,i)=>v.every((x,c)=>Math.abs(x-b[(i+k)%3][c])<=3e-7)));
  for(const face of fixture.faces)assert(triangles.some(t=>matches(face.base,t)),`${asset.url}: native toe face ${face.faceId} remains exposed`);
  const corrupted=fixture.faces[0].base.map(v=>v.map((x,c)=>c===1?x+.001:x));
  assert(!triangles.some(t=>matches(corrupted,t)),'The native-face control must reject a changed surface');
 }
});
