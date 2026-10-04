/** Independent emitted-mesh measurements against the released Human.
 * This catches the rejected oversized skull/age offset; it cannot judge taste.
 * Native glTF IO reads the actual source and the hash-pinned rejected pack.
 * https://gltf-transform.dev/modules/core/classes/NodeIO
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {MeshoptDecoder} from 'meshoptimizer';
await MeshoptDecoder.ready;
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder});
const sha=b=>createHash('sha256').update(b).digest('hex');
const out=process.env.ASHEN_IDENTITY_PROPORTIONS_OUT||'docs/baselines/character-mmo/m5/face-2026-10-04/proportions.json';
const bounds=points=>[0,1,2].map(k=>[Math.min(...points.map(p=>p[k])),Math.max(...points.map(p=>p[k]))]);
const points=mesh=>mesh.listPrimitives().flatMap(p=>{
 const a=p.getAttribute('POSITION');return Array.from({length:a.getCount()},(_,i)=>a.getElement(i,[]));
});
function measure(root){
 const body=root.listMeshes().find(m=>m.getName()==='HumanV1Body');assert(body);
 const head=points(body).filter(p=>p[1]>1.56),box=bounds(head);
 const eyes=root.listMeshes().find(m=>m.getName()==='HumanIdentityEyes');
 const e=eyes?points(eyes):null;
 return {headBoundsM:box,headWidthM:box[0][1]-box[0][0],crownM:box[1][1],
  eyeBoundsM:e?bounds(e):null,eyeCentroidM:e?[0,1,2].map(k=>e.reduce((s,p)=>s+p[k],0)/e.length):null};
}
const canonical=measure((await io.read('.cache/character-mmo/m004/human-shape-family-v1.glb')).getRoot());
function issues(m){
 const result=[];
 if(m.headWidthM>canonical.headWidthM*1.08)result.push('skull exceeds released head width by >8%');
 if(Math.abs(m.crownM-canonical.crownM)>.015)result.push('crown differs from released head by >15 mm');
 if(m.eyeCentroidM&&Math.abs(m.eyeCentroidM[1]-1.655)>.015)result.push('eyes differ from measured released face landmark by >15 mm');
 return result;
}
const current=[];
for(const label of ['old','young','young-hair']){
 const bytes=await fs.readFile(`.cache/character-mmo/identity-v1/human-${label}-painted.glb`);
 const m=measure((await io.readBinary(bytes)).getRoot());current.push({label,sha256:sha(bytes),...m,issues:issues(m)});
 assert.deepEqual(issues(m),[],`${label}: head proportions exceed the reviewed domain`);
}
assert(Math.abs(current[0].eyeCentroidM[1]-current[1].eyeCentroidM[1])<.005,'Whole-body age stature leaked into eye height');
// Negative control: inspect the ACTUAL rejected bytes retained by the immutable
// DEV cache, using the earlier committed preparation receipt as the hash pin.
// A fixture made by copying the new fit constants would not test this failure.
const rejectedPins=JSON.parse(await fs.readFile('docs/baselines/character-mmo/m5/head-2026-10-04/preparation.json','utf8'));
const rejected=[];
for(const label of ['old','young']){
 const pin=rejectedPins.find(r=>r.label===label);assert(pin);
 const dir=`.cache/character-mmo/identity-review-v1/${label}`;
 let bytes;
 for(const name of (await fs.readdir(dir)).filter(n=>/^body-.*\.bin$/.test(n))){
  const decoded=gunzipSync(await fs.readFile(`${dir}/${name}`));if(sha(decoded)===pin.bodySha256){bytes=decoded;break;}
 }
 assert(bytes,`Restore hash-pinned rejected ${label} cache to run the negative control`);
 const m=measure((await io.readBinary(bytes)).getRoot());rejected.push({label,sha256:sha(bytes),...m,issues:issues(m)});
 assert(issues(m).length>=2,`${label}: negative control failed to detect the rejected head`);
}
const report={scope:'Anatomical scale regression guard; live visual/motion acceptance remains required',canonical,current,rejected,passed:true};
await fs.mkdir(path.dirname(out),{recursive:true});
await fs.writeFile(out,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report));
