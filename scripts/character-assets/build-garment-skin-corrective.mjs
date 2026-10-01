/** Isolated native Blender Data Transfer audition. Writes candidates only.
 * Copy weights into the original glTF; Blender never exports/reorders its UV splits.
 * https://docs.blender.org/manual/en/latest/modeling/modifiers/modify/data_transfer.html
 * https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#skinned-mesh-attributes
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {NodeIO,VertexLayout} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {MeshoptDecoder} from 'meshoptimizer';
import {EQUIPMENT_ITEMS} from '../../src/ashen-reach/equipment-catalog.js';
const sha=b=>createHash('sha256').update(b).digest('hex');
const arraySha=a=>sha(Buffer.from(a.buffer,a.byteOffset,a.byteLength));
const item=process.argv[2]||'pilgrimTunic';
const out=process.argv[3]||'.cache/character-mmo/wardrobe-v1/skin-corrective';
const mask=process.argv[4]||'full';
if(!['full','lower-torso','front-abdomen'].includes(mask))throw Error('Unknown native transfer mask');
const descriptorPath=process.argv[5];
const descriptor=descriptorPath?JSON.parse(await fs.readFile(descriptorPath,'utf8')):null;
const relativeOut=path.relative(path.resolve('.cache'),path.resolve(out));
if(!relativeOut||relativeOut.startsWith('..')||path.isAbsolute(relativeOut))throw Error('Audition output must remain under .cache/');
const directory='public/ashen-reach/equipment';
const manifest=JSON.parse(await fs.readFile(`${directory}/manifest.json`,'utf8'));
const entry=manifest.items[item];
if(!entry||entry.meshes.length!==1||EQUIPMENT_ITEMS[item]?.deformation==='rigid-bone')throw Error('Require one explicitly named cloth mesh; rigid items retain their authored bone');
if(descriptor&&(descriptor.schema!==1||descriptor.item!==item||descriptor.race!=='human'||descriptor.mesh!==entry.meshes[0]||descriptor.mask!==mask||descriptor.bodySha256!==manifest.items.body.sha256))throw Error('Unsupported or stale source corrective descriptor');
const body=descriptor?.body||`${directory}/body.glb`,garment=descriptor?.source||`${directory}/${item}.glb`;
const garmentSha=descriptor?.sourceSha256||entry.sha256;
for(const [file,expected]of [[body,manifest.items.body.sha256],[garment,garmentSha]])
 if(sha(await fs.readFile(file))!==expected)throw Error(`Unverified source: ${file}`);
await fs.mkdir(out,{recursive:true});
const transfer=`${out}/${item}-weights.json`;
execFileSync(process.env.ASHEN_BLENDER||'/Applications/Blender.app/Contents/MacOS/Blender',[
 '--background','--factory-startup','--python-exit-code','1','--python','scripts/character-assets/transfer-garment-skin.py','--',
 '--body',body,'--body-mesh','HumanV1Body','--garment',garment,'--garment-mesh',entry.meshes[0],'--out',transfer,'--mask',mask
],{stdio:'inherit'});
await MeshoptDecoder.ready;
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder}).setVertexLayout(VertexLayout.SEPARATE);
const doc=await io.read(garment),root=doc.getRoot(),skin=root.listSkins()[0];
const names=skin.listJoints().map(n=>n.getName());
const report=JSON.parse(await fs.readFile(transfer,'utf8'));
const key=p=>p.map(n=>Math.round(n*1e5)).join(',');
const buckets=new Map();
for(const row of report.rows){const k=key(row.position);if(!buckets.has(k))buckets.set(k,[]);buckets.get(k).push(row);}
const preserved=[];let vertices=0,changed=0,maxMatchDistance=0;
for(const mesh of root.listMeshes())for(const p of mesh.listPrimitives()){
 const pos=p.getAttribute('POSITION').getArray(),oldW=p.getAttribute('WEIGHTS_0').getArray(),oldJ=p.getAttribute('JOINTS_0').getArray();
 const weights=new Float32Array(oldW.length),joints=new Uint16Array(oldJ.length);
 for(let v=0;v<pos.length/3;v++){
  const point=Array.from(pos.slice(v*3,v*3+3));
  // Blender's imported vertex list may collapse identical UV seam vertices. Match
  // by position, then reject inconsistent duplicate weights rather than guessing.
  const q=point.map(n=>Math.round(n*1e5)),candidates=[];
  for(let x=-1;x<=1;x++)for(let y=-1;y<=1;y++)for(let z=-1;z<=1;z++)
   for(const row of buckets.get([q[0]+x,q[1]+y,q[2]+z].join(','))||[]){
    const distance=Math.hypot(...point.map((n,i)=>n-row.position[i]));if(distance<1e-5)candidates.push({row,distance});
   }
  candidates.sort((a,b)=>a.distance-b.distance);if(!candidates.length)throw Error(`No original-vertex correspondence ${v}: ${point}`);
  const best=candidates[0];maxMatchDistance=Math.max(maxMatchDistance,best.distance);
  if(best.row.transferFactor===0){joints.set(oldJ.slice(v*4,v*4+4),v*4);weights.set(oldW.slice(v*4,v*4+4),v*4);vertices++;continue;}
  const canonical=rows=>new Map(rows);
  for(const alternative of candidates){const a=canonical(best.row.weights),b=canonical(alternative.row.weights);
   if([...new Set([...a.keys(),...b.keys()])].some(n=>Math.abs((a.get(n)||0)-(b.get(n)||0))>1e-5))throw Error(`Ambiguous seam weights at ${v}`);
  }
  best.row.weights.forEach(([name,w],k)=>{const index=names.indexOf(name);if(index<0)throw Error(`Unknown joint ${name}`);joints[v*4+k]=index;weights[v*4+k]=w;});
  const before=new Map();for(let k=0;k<4;k++)before.set(names[oldJ[v*4+k]],(before.get(names[oldJ[v*4+k]])||0)+oldW[v*4+k]);
  if(best.row.weights.some(([name,w])=>Math.abs((before.get(name)||0)-w)>1e-5))changed++;
  vertices++;
 }
 for(const semantic of p.listSemantics().filter(n=>!['JOINTS_0','WEIGHTS_0'].includes(n)))preserved.push({accessor:p.getAttribute(semantic),hash:arraySha(p.getAttribute(semantic).getArray())});
 preserved.push({accessor:p.getIndices(),hash:arraySha(p.getIndices().getArray())});
 p.getAttribute('JOINTS_0').setArray(joints);p.getAttribute('WEIGHTS_0').setArray(weights);
}
for(const row of preserved)if(arraySha(row.accessor.getArray())!==row.hash)throw Error('Non-skin accessor changed');
for(const ext of root.listExtensionsUsed())if(ext.extensionName==='EXT_meshopt_compression')ext.dispose();
const bytes=await io.writeBinary(doc),destination=path.join(out,`${item}.glb`);await fs.writeFile(destination,bytes);
if(descriptor&&sha(bytes)!==descriptor.acceptedNeutralCandidateSha256)throw Error('Corrective differs from the reviewed neutral candidate');
const toolSources=[];
for(const file of ['scripts/character-assets/build-garment-skin-corrective.mjs','scripts/character-assets/transfer-garment-skin.py'])toolSources.push({path:file,sha256:sha(await fs.readFile(file))});
if(descriptorPath)toolSources.push({path:descriptorPath,sha256:sha(await fs.readFile(descriptorPath))});
const tails=report.rows.filter(r=>r.transferFactor>0).map(r=>r.discardedWeightFraction);
const influenceReduction={maxDiscardedFraction:Math.max(0,...tails),meanDiscardedFraction:tails.reduce((a,b)=>a+b,0)/Math.max(1,tails.length),verticesAboveOnePercent:tails.filter(n=>n>.01).length};
await fs.writeFile(`${out}/${item}-report.json`,JSON.stringify({schema:1,item,mask,maskLandmarksM:report.maskLandmarksM,influenceReduction,method:report.method,tool:report.tool,toolSources,source:{body,bodySha256:manifest.items.body.sha256,garment,garmentSha256:garmentSha},candidate:{path:destination,sha256:sha(bytes)},vertices,changed,maxMatchDistanceM:maxMatchDistance,preserved:'All original geometry, UV, material, topology, joint order and inverse bind; only JOINTS_0/WEIGHTS_0 replaced within the declared mask.'},null,2)+'\n');
console.log(JSON.stringify({vertices,changed,maxMatchDistanceM:maxMatchDistance,destination}));
