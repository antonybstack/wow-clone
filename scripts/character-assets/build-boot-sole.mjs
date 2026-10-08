/** Restore authored sole and collapsed forefoot height after the body fit.
 * Candidate-only: source masters are pinned; the existing garment compiler owns
 * Human morphs and the Duskguard builder owns its copied boot underlayer.
 * No runtime fitter, animation edits, normal-only proof exceptions or skin edits.
 * Native glTF accessors retain topology/UVs/weights while POSITION is authored:
 * https://gltf-transform.dev/modules/core/classes/Accessor
 * https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#skins
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {NodeIO,VertexLayout} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {MeshoptDecoder,MeshoptEncoder} from 'meshoptimizer';
import {vertexNormals} from './garment-coverage.mjs';
import {verifyFactoryEquipmentBind} from './verify-factory-equipment-bind.mjs';

const descriptorPath='blender/characters/wardrobe/boot-sole.json';
const descriptor=JSON.parse(await fs.readFile(descriptorPath,'utf8'));
const out=process.argv[2]||'.cache/character-mmo/boot-sole';
const relative=path.relative(path.resolve('.cache'),path.resolve(out));
assert(relative&&!relative.startsWith('..')&&!path.isAbsolute(relative),'Write an isolated candidate under .cache');
assert.equal(descriptor.schema,1);assert.equal(descriptor.id,'wayfarer-sole');
assert.deepEqual(Object.keys(descriptor.fits).sort(),['human','undead']);
const {fullBelowM,fadeEndM,belowFootM,authoredHeightScale}=descriptor.sole;
assert([fullBelowM,fadeEndM,belowFootM,authoredHeightScale].every(Number.isFinite));
assert(fullBelowM>0&&fadeEndM>fullBelowM&&fadeEndM<=.05&&belowFootM>=0&&belowFootM<=.01&&authoredHeightScale>0&&authoredHeightScale<=2);
const forefoot=descriptor.forefoot;
assert.equal(descriptor.revision,2);
assert(forefoot&&Object.values(forefoot).every(Number.isFinite),'Invalid forefoot region');
assert.deepEqual(Object.keys(forefoot).sort(),['fullFromY','fullFromZ','fullToY','maxY','minY','minZ']);
assert(forefoot.minY===fullBelowM&&forefoot.fullFromY===fadeEndM&&forefoot.fullFromY<forefoot.fullToY&&forefoot.fullToY<forefoot.maxY&&forefoot.maxY<=.1&&forefoot.minZ>=0&&forefoot.minZ<forefoot.fullFromZ);
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
async function pinned(file,expected){const bytes=await fs.readFile(file);assert.equal(sha(bytes),expected,`Unreviewed input ${file}`);return bytes;}
await Promise.all([MeshoptDecoder.ready,MeshoptEncoder.ready]);
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder,'meshopt.encoder':MeshoptEncoder}).setVertexLayout(VertexLayout.SEPARATE);
const authored=(await io.readBinary(await pinned(descriptor.authored.source,descriptor.authored.sha256))).getRoot();
assert.equal(authored.listMeshes().length,1);
const sourcePrimitive=authored.listMeshes()[0].listPrimitives()[0];
const S=sourcePrimitive.getAttribute('POSITION').getArray();
const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
const forefootBlend=(y,z)=>smooth((y-forefoot.minY)/(forefoot.fullFromY-forefoot.minY))*(1-smooth((y-forefoot.fullToY)/(forefoot.maxY-forefoot.fullToY)))*smooth((z-forefoot.minZ)/(forefoot.fullFromZ-forefoot.minZ));
const rows=[];
for(const [race,fit]of Object.entries(descriptor.fits)){
 const input=await pinned(fit.source,fit.sha256),body=(await io.readBinary(await pinned(fit.body,fit.bodySha256))).getRoot();
 const doc=await io.readBinary(input),root=doc.getRoot();
 assert.equal(root.listMeshes().length,1);assert.equal(root.listMeshes()[0].getName(),'WayfarerBoots');
 assert.equal(root.listMeshes()[0].listPrimitives().length,1);assert.equal(root.listAnimations().length,0);
 const p=root.listMeshes()[0].listPrimitives()[0],P=p.getAttribute('POSITION').getArray();
 assert.equal(P.length,S.length);assert.deepEqual(p.getIndices().getArray(),sourcePrimitive.getIndices().getArray());
 assert.deepEqual(p.getAttribute('TEXCOORD_0').getArray(),sourcePrimitive.getAttribute('TEXCOORD_0').getArray());
 const bodyPrimitive=body.listMeshes().find(m=>m.getName()===fit.bodyMesh)?.listPrimitives()[0];assert(bodyPrimitive);
 const B=bodyPrimitive.getAttribute('POSITION').getArray(),output=Float32Array.from(P),feet=[];
 for(const sign of [1,-1]){
  let authoredFloor=Infinity,bodyFloor=Infinity;
  for(let v=0;v<S.length/3;v++)if(S[v*3]*sign>0)authoredFloor=Math.min(authoredFloor,S[v*3+1]);
  for(let v=0;v<B.length/3;v++)if(B[v*3]*sign>0&&B[v*3+1]<.12)bodyFloor=Math.min(bodyFloor,B[v*3+1]);
  assert(Number.isFinite(authoredFloor)&&Number.isFinite(bodyFloor));
  let changed=0,maxDisplacementM=0;
  for(let v=0;v<S.length/3;v++){
   if(S[v*3]*sign<=0)continue;
   const blend=1-smooth((S[v*3+1]-fullBelowM)/(fadeEndM-fullBelowM));
   if(blend<=0)continue;
   const height=bodyFloor-belowFootM+(S[v*3+1]-authoredFloor)*authoredHeightScale;
   output[v*3+1]=P[v*3+1]+blend*(height-P[v*3+1]);
   if(output[v*3+1]!==P[v*3+1])changed++;
   maxDisplacementM=Math.max(maxDisplacementM,Math.abs(output[v*3+1]-P[v*3+1]));
  }
  let forefootChanged=0,forefootMaxDisplacementM=0;
  // The native audition shows a collapsed vamp above the repaired sole. Lift
  // that authored-coordinate window only; keep an already-higher roof intact.
  // Run after the sole pass so its Float32 result is the blend's exact baseline.
  // Reuse native accessor arrays and normal reconstruction, preserving skin/UVs:
  // https://gltf-transform.dev/modules/core/classes/Accessor
  // https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#skinned-mesh-attributes
  for(let v=0;v<S.length/3;v++){
   if(S[v*3]*sign<=0)continue;
   const blend=forefootBlend(S[v*3+1],S[v*3+2]);
   if(blend<=0)continue;
   const height=bodyFloor-belowFootM+(S[v*3+1]-authoredFloor)*authoredHeightScale;
   const before=output[v*3+1];
   if(height<=before)continue;
   output[v*3+1]=before+blend*(height-before);
   if(output[v*3+1]!==before)forefootChanged++;
   forefootMaxDisplacementM=Math.max(forefootMaxDisplacementM,output[v*3+1]-before);
  }
  feet.push({side:sign===1?'left':'right',authoredFloor,bodyFloor,changed,maxDisplacementM,forefootChanged,forefootMaxDisplacementM});
 }
 p.getAttribute('POSITION').setArray(output);
 p.getAttribute('NORMAL').setArray(vertexNormals(output,p.getIndices().getArray()));
 // Declare this authored derivative's existing soft skin explicitly so the
 // independent factory bind checker can verify it without relaxed exceptions.
 p.setExtras({...p.getExtras(),deformation:'soft-skin'});
 const bytes=await io.writeBinary(doc),written=(await io.readBinary(bytes)).getRoot();
 const check=written.listMeshes()[0].listPrimitives()[0],before=(await io.readBinary(input)).getRoot().listMeshes()[0].listPrimitives()[0];
 assert.deepEqual(check.getIndices().getArray(),before.getIndices().getArray());
 for(const semantic of before.listSemantics().filter(s=>!['POSITION','NORMAL'].includes(s)))assert.deepEqual(check.getAttribute(semantic).getArray(),before.getAttribute(semantic).getArray(),`${race}/${semantic}`);
 const actual=check.getAttribute('POSITION').getArray();
 assert.deepEqual(actual,output,'Authored positions changed during glTF readback');
 for(let v=0;v<P.length/3;v++){
  assert.equal(actual[v*3],P[v*3]);assert.equal(actual[v*3+2],P[v*3+2]);
  if(S[v*3+1]>=fadeEndM){
   if(forefootBlend(S[v*3+1],S[v*3+2])===0)assert.equal(actual[v*3+1],P[v*3+1],'Upper boot changed outside the reviewed forefoot');
   else assert(actual[v*3+1]>=P[v*3+1],'Already-higher forefoot lowered');
  }
 }
 const verification=verifyFactoryEquipmentBind(written,body,fit.bodyMesh);
 const directory=path.join(out,race);await fs.mkdir(directory,{recursive:true});
 const file=path.join(directory,'wayfarerBoots.glb');await fs.writeFile(file,bytes);
 rows.push({race,source:fit,artifact:{file,bytes:bytes.length,sha256:sha(bytes)},feet,verification});
}
await fs.writeFile(path.join(out,'report.json'),JSON.stringify({candidateOnly:true,descriptor:{path:descriptorPath,sha256:sha(await fs.readFile(descriptorPath))},rows},null,2)+'\n');
console.log(JSON.stringify(rows.map(({race,artifact,feet})=>({race,artifact,feet})),null,2));
