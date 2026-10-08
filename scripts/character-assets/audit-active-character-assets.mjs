/** Read-only census of the packs selected by src/ashen-reach/main.js.
 * glTF Transform's NodeIO handles GLB/extensions instead of duplicating a parser:
 * https://gltf-transform.dev/modules/core/classes/NodeIO
 * Skin joint order, inverse binds and vertex indices follow glTF 2.0 skinning:
 * https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#skins
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {MeshoptDecoder} from 'meshoptimizer';
import {EQUIPMENT_ITEMS} from '../../src/ashen-reach/equipment-catalog.js';
import {HUMAN_EQUIPMENT_FIT,ORC_EQUIPMENT_FIT,UNDEAD_EQUIPMENT_FIT} from '../../src/ashen-reach/equipment-contract.js';
import {verifyPublishedAuthoredProps} from './publish-authored-prop.mjs';

export const sha = bytes => createHash('sha256').update(bytes).digest('hex');
export const matrixTolerance = 1e-5; // Existing streamed-asset validator uses exact generated matrices; this permits float serialization noise.
export function nearArray(a, b, tolerance = matrixTolerance) {
  return !!a && !!b && a.length === b.length && a.every((v, i) => Number.isFinite(v) && Number.isFinite(b[i]) && Math.abs(v - b[i]) <= tolerance);
}
export function validateWeights(weights, indices, jointCount, tolerance = 1e-3) {
  const problems = [];
  if (!weights || !indices || weights.length !== indices.length || weights.length % 4) return ['missing or unequal four-component weights/joints'];
  for (let i = 0; i < weights.length; i += 4) {
    const sum = weights[i] + weights[i + 1] + weights[i + 2] + weights[i + 3];
    if (!Number.isFinite(sum) || Math.abs(sum - 1) >= tolerance) problems.push(`vertex ${i / 4}: weight sum ${sum}`);
    for (let j = 0; j < 4; j++) if (!Number.isFinite(weights[i + j]) || weights[i + j] < 0 || weights[i + j] > 1 || !Number.isInteger(indices[i + j]) || indices[i + j] < 0 || indices[i + j] >= jointCount) problems.push(`vertex ${i / 4}: invalid influence ${j}`);
  }
  return problems.slice(0, 12);
}
export function compareRig(body, item) {
  // A corrupt or missing body is reported as an invalid asset by audit(). Its
  // garment rows still need a compatibility result without pretending that a
  // manifest entry alone supplied a glTF skin for comparison.
  // https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#skins
  if (!Array.isArray(body?.joints) || !Array.isArray(body?.meshFrames)
      || !Array.isArray(item?.joints) || !Array.isArray(item?.meshFrames)) {
    return {status:'unsupported', reasons:['skin absent or body asset invalid']};
  }
  const reasons = [];
  const bodyByName = new Map(body.joints.map((j, i) => [j.name, {joint:j, index:i}]));
  if (bodyByName.size !== body.joints.length || item.joints.length !== body.joints.length) reasons.push('joint count/uniqueness differs');
  const remap = item.joints.map(j => bodyByName.get(j.name)?.index ?? -1);
  let maxRestDelta=0,maxInverseBindDelta=0;
  if (remap.some(i => i < 0) || new Set(remap).size !== item.joints.length) reasons.push('joint mapping incomplete');
  // The current Lite loader borrows the body palette without changing JOINTS_0.
  // A mathematically possible remap still needs an offline asset rewrite before it can run.
  if(remap.some((index,i)=>index!==i)) reasons.push('joint order differs; runtime palette borrowing has no vertex remap');
  for (let i = 0; i < item.joints.length; i++) {
    const b = bodyByName.get(item.joints[i].name)?.joint;
    if (!b) continue;
    maxRestDelta=Math.max(maxRestDelta,...b.world.map((v,k)=>Math.abs(v-item.joints[i].world[k])));
    maxInverseBindDelta=Math.max(maxInverseBindDelta,...b.inverseBind.map((v,k)=>Math.abs(v-item.joints[i].inverseBind[k])));
    if (b.parent !== item.joints[i].parent || !nearArray(b.world, item.joints[i].world)) reasons.push(`joint hierarchy/rest differs: ${b.name}`);
    if (!nearArray(b.inverseBind, item.joints[i].inverseBind)) reasons.push(`inverse bind differs: ${b.name}`);
  }
  if (item.meshFrames.some(frame => !nearArray(frame, body.meshFrames[0]))) reasons.push('mesh frame differs');
  return {status:reasons.length ? 'incompatible' : 'valid', jointOrderSame:remap.every((v,i)=>v===i), jointIndexRemap:remap, maxRestDelta, maxInverseBindDelta, reasonCount:reasons.length, reasons:[...new Set(reasons)].slice(0,8)};
}
export function decodeEntry(bytes, entry) {
  if (entry.compression && entry.compression !== 'gzip') throw Error(`unsupported compression ${entry.compression}`);
  if (entry.encodedBytes !== undefined && bytes.length !== entry.encodedBytes) throw Error('encoded byte count mismatch');
  const decoded = entry.compression === 'gzip' ? gunzipSync(bytes) : bytes;
  if (decoded.length !== entry.bytes) throw Error('decoded byte count mismatch');
  if (sha(decoded) !== entry.sha256) throw Error('decoded SHA-256 mismatch');
  return decoded;
}
const identity = [1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
const typedHash = array => array ? sha(Buffer.from(array.buffer, array.byteOffset, array.byteLength)) : null;
function inspect(doc) {
  const root = doc.getRoot(), skin = root.listSkins()[0];
  const joints = skin?.listJoints().map((node, i) => ({
    name:node.getName(), parent:node.getParentNode()?.getName() || null,
    world:Array.from(node.getWorldMatrix()),
    inverseBind:Array.from(skin.getInverseBindMatrices().getArray().slice(i*16,(i+1)*16)),
  })) || [];
  const meshNodes = root.listNodes().filter(n=>n.getMesh());
  const meshFrames = meshNodes.map(n=>Array.from(n.getWorldMatrix()));
  const meshes = [], errors = [];
  if(!skin) errors.push('missing skin');
  for (const node of meshNodes) {
    let triangles=0, vertices=0, morphTargets=0, influences=0;
    const hashes=[];
    for (const primitive of node.getMesh().listPrimitives()) {
      const pos=primitive.getAttribute('POSITION')?.getArray();
      const weights=primitive.getAttribute('WEIGHTS_0')?.getArray();
      const indices=primitive.getAttribute('JOINTS_0')?.getArray();
      const meshIndices=primitive.getIndices()?.getArray();
      if (!pos) errors.push(`${node.getName()}: missing POSITION`);
      errors.push(...validateWeights(weights,indices,joints.length).map(p=>`${node.getName()}: ${p}`));
      triangles+=(meshIndices?.length || (pos?.length || 0)/3)/3;
      vertices+=(pos?.length || 0)/3;
      morphTargets+=primitive.listTargets().length;
      influences+=weights?.length || 0;
      for(const key of ['POSITION','NORMAL','TEXCOORD_0','JOINTS_0','WEIGHTS_0']) hashes.push([key,typedHash(primitive.getAttribute(key)?.getArray())]);
      hashes.push(['indices',typedHash(meshIndices)]);
    }
    if (!nearArray(node.getWorldMatrix(),identity)) errors.push(`${node.getName()}: non-identity mesh frame`);
    meshes.push({name:node.getName(),primitives:node.getMesh().listPrimitives().length,triangles,vertices,morphTargets,morphNames:[],influences,semanticSha256:sha(JSON.stringify(hashes))});
  }
  const animations=root.listAnimations().map(a=>{
    const inputs=a.listSamplers().map(s=>s.getInput()?.getArray()).filter(Boolean);
    return {name:a.getName(),durationSeconds:Math.max(0,...inputs.map(x=>x[x.length-1]||0)),samplerCount:a.listSamplers().length,semanticSha256:sha(JSON.stringify(a.listSamplers().map(s=>[typedHash(s.getInput()?.getArray()),typedHash(s.getOutput()?.getArray())])))};
  });
  return {meshes,materials:root.listMaterials().map(m=>m.getName()),textures:root.listTextures().map(t=>({name:t.getName(),size:t.getSize(),mime:t.getMimeType()})),joints,meshFrames,animations,errors,totals:{triangles:meshes.reduce((n,m)=>n+m.triangles,0),vertices:meshes.reduce((n,m)=>n+m.vertices,0)}};
}
const packs={human:'equipment',orc:'equipment-orc',undead:'equipment-undead',startupHuman:'startup/character'};
export async function audit(repo=path.resolve(fileURLToPath(new URL('../..', import.meta.url))), readFile=fs.readFile) {
  await MeshoptDecoder.ready;
  const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder});
  const main=await readFile(path.join(repo,'src/ashen-reach/main.js'),'utf8');
  if (!main.includes("const UNDEAD_PACK_DIR='equipment-undead'")) throw Error('Active Undead pack route changed; review census roots');
  const report={schema:1,source:'src/ashen-reach/main.js packs',packs:{},proceduralProps:Object.entries(EQUIPMENT_ITEMS).filter(([,v])=>v.factory&&!v.asset).map(([id,v])=>({id,factory:v.factory,slot:v.slot,occupies:v.occupies})),authoredProps:[],errors:[],warnings:[]};
  try{report.authoredProps=await verifyPublishedAuthoredProps({readFile:(file,...args)=>readFile(path.join(repo,file),...args)});}
  catch(error){report.errors.push(`authored props: ${error.message}`);}
  for(const [race,dir] of Object.entries(packs)) {
    const manifestPath=`public/ashen-reach/${dir}/manifest.json`;
    const raw=await readFile(path.join(repo,manifestPath));
    const manifest=JSON.parse(raw);
    const out={manifestPath,manifestSha256:sha(raw),fitId:manifest.fitId,profileId:manifest.profileId,bindSha256:manifest.bindSha256,sourceSha256:manifest.sourceSha256,items:{}};
    report.packs[race]=out;
    for(const [id,entry] of Object.entries(manifest.items)) {
      // HTTP version keys belong to the request URL, never to the local file.
      // URL.pathname preserves the asset identity used by the manifest while
      // dropping its cache query: https://developer.mozilla.org/en-US/docs/Web/API/URL/pathname
      const relative=`public${new URL(entry.url,'https://play.sparkify.dev').pathname}`;
      const row={url:entry.url,path:relative,fit:entry.fit || null,declaredMeshes:entry.meshes,status:'valid'};
      out.items[id]=row;
      try {
        const encoded=await readFile(path.join(repo,relative));
        const decoded=decodeEntry(encoded,entry);
        Object.assign(row,{encodedBytes:encoded.length,encodedSha256:sha(encoded),decodedBytes:decoded.length,decodedSha256:sha(decoded),compression:entry.compression || null});
        const parsed=inspect(await io.readBinary(decoded));
        Object.assign(row,parsed);
        if (parsed.errors.length) throw Error(parsed.errors.join('; '));
        if (JSON.stringify(parsed.meshes.map(m=>m.name).sort())!==JSON.stringify([...entry.meshes].sort())) throw Error('declared mesh list mismatch');
        if (id!=='body' && parsed.animations.length) throw Error('garment unexpectedly contains animations');
        const expected={human:HUMAN_EQUIPMENT_FIT,orc:ORC_EQUIPMENT_FIT,undead:UNDEAD_EQUIPMENT_FIT,startupHuman:HUMAN_EQUIPMENT_FIT}[race];
        if (id!=='body' && JSON.stringify(entry.fit)!==JSON.stringify(expected)) throw Error('fit family/version mismatch');
      } catch(e) {row.status='invalid';row.error=e.message;report.errors.push(`${race}/${id}: ${e.message}`);}
    }
    const body=out.items.body;
    for(const [id,row] of Object.entries(out.items)) if(id!=='body' && row.status==='valid') {
      row.compatibility=compareRig(body,row);
      if(row.compatibility.status!=='valid') {row.status='incompatible';report.errors.push(`${race}/${id}: ${row.compatibility.reasons.join('; ')}`);}
      const item=EQUIPMENT_ITEMS[id];
      row.coverage={declared:item?.coverage||[],resolved:(item?.coverage||[]).map(name=>({name,actualBodyMesh:body.declaredMeshes.includes(name)?name:null})),note:race==='undead' && id==='graveweaverHood'?'HumanHair has no Undead mesh; hood mask is a no-op':undefined};
    }
  }
  const start=report.packs.startupHuman.items,full=report.packs.human.items;
  report.startupComparison={};
  for(const id of Object.keys(start)) {
    const a=start[id],b=full[id];
    report.startupComparison[id]={rig:compareRig(b,a),geometrySemanticSame:JSON.stringify(a.meshes?.map(m=>m.semanticSha256))===JSON.stringify(b?.meshes?.map(m=>m.semanticSha256)),animationNamesSame:JSON.stringify(a.animations?.map(x=>x.name))===JSON.stringify(b?.animations?.map(x=>x.name)),animationSemanticSame:JSON.stringify(a.animations?.map(x=>x.semanticSha256))===JSON.stringify(b?.animations?.map(x=>x.semanticSha256)),fileHashSame:a.decodedSha256===b?.decodedSha256};
  }
  // Keep numeric matrices long enough for compatibility checks; the report carries compact
  // binary semantic identity and joint labels instead of megabytes of repeated float JSON.
  for(const pack of Object.values(report.packs)) for(const row of Object.values(pack.items)) {
    if(!row.joints) continue;
    row.restSha256=sha(JSON.stringify(row.joints.map(j=>j.world)));
    row.inverseBindSha256=sha(JSON.stringify(row.joints.map(j=>j.inverseBind)));
    row.joints=row.joints.map(j=>({name:j.name,parent:j.parent}));
  }
  return report;
}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const out=process.argv.indexOf('--out');
  if(out<0 || !process.argv[out+1]) throw Error('usage: audit-active-character-assets.mjs --out report.json');
  const report=await audit();
  await fs.mkdir(path.dirname(process.argv[out+1]),{recursive:true});
  await fs.writeFile(process.argv[out+1],JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({packs:Object.keys(report.packs),assets:Object.values(report.packs).reduce((n,p)=>n+Object.keys(p.items).length,0),errors:report.errors.length}));
  if(report.errors.length) process.exitCode=1;
}
