/** Apply reviewed coverage AFTER fitting/simplification. Keep the unsplit source
 * asset available for reproducible fitting and independent preservation checks.
 * glTF sharing prevents file duplication; runtime allocation cost still needs
 * measurement. https://gltf-transform.dev/modules/core/classes/Accessor
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {gzipSync,gunzipSync} from 'node:zlib';
import {deriveTorsoCore,deriveUpperTrousers,deriveHumanFootCore,HUMAN_BACK_COVERAGE_REVISION} from './derive-coverage-geosets.mjs';
import {verifyCoveragePartition} from './verify-coverage-partition.mjs';
import {RACE_BODY_SEGMENTS} from '../../src/ashen-reach/coverage-contract.js';
import {pilotCoverageForRace} from '../../src/ashen-reach/coverage-pilot.js';

export const COVERAGE_REVISION='conservative-geosets-v1';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
export async function compileCoverageManifest({io,manifest,race,sourceRoot='public',outDirectory,urlRoot}){
 if(!['human','orc','undead'].includes(race))throw Error('Unsupported coverage race');
 const next=structuredClone(manifest),writes=[],reports=[],compiled=new Map();
 const rules=structuredClone(pilotCoverageForRace(race));
 const segments=structuredClone(RACE_BODY_SEGMENTS[race]);
 if(race!=='orc')segments[race==='human'?'HumanTorsoCore':'UndeadTorsoCore']=['torso.upper','torso.lower','waist'];
 if(race==='human'){
  segments.HumanV1Body=segments.HumanV1Body.filter(segment=>segment!=='foot');
  segments.HumanFootCore=['foot'];
 }
 for(const [detail,items]of [['full',next.items],['startup',next.compactItems]]){
  if(!items)continue;
  for(const id of Object.keys(items)){
   const original=items[id].coverageSource||items[id];
   const body=id==='body'&&race!=='orc',trousers=id==='wayfarerTrousers'||id==='graveweaverSkirt'&&race!=='human';
   // New articulated trousers have their own source mesh and full upper section.
   const dusk=id==='duskguardTassets';
   if(!body&&!trousers&&!dusk)continue;
   const key=`${id}:${original.url}:${original.sha256}`;
   if(compiled.has(key)){items[id]=structuredClone(compiled.get(key));continue;}
   const encoded=await fs.readFile(path.join(sourceRoot,original.url.replace(/^\//,''))),bytes=original.compression==='gzip'?gunzipSync(encoded):encoded;
   if(bytes.length!==original.bytes||sha(bytes)!==original.sha256)throw Error(`Coverage source mismatch: ${race}/${id}/${detail}`);
   const reference=(await io.readBinary(bytes)).getRoot(),doc=await io.readBinary(bytes);
   const derived=body?deriveTorsoCore(doc,race,race==='human'?{revision:HUMAN_BACK_COVERAGE_REVISION}:undefined):deriveUpperTrousers(doc,dusk?'DuskguardTrousers':'WayfarerTrousers',dusk?'DuskguardTrousersUnderTorso':'WayfarerTrousersUnderTorso');
   if(body&&race==='human')derived.footCoverage=deriveHumanFootCore(doc);
   const written=await io.writeBinary(doc),actual=(await io.readBinary(written)).getRoot();
   const verification=verifyCoveragePartition(reference,actual,derived.partition.source,derived.footCoverage?[derived.partition.covered,derived.footCoverage.partition.covered]:derived.partition.covered);
   const packed=original.compression==='gzip'?gzipSync(written,{level:9}):written,ext=original.compression==='gzip'?'bin':'glb';
   const name=`${id}${original.detail==='startup'?'-compact':''}-coverage-${sha(packed).slice(0,12)}.${ext}`;
   const sourceAsset={...original};delete sourceAsset.coverageSource;delete sourceAsset.coverageRevision;
   const entry={...original,url:`${urlRoot}/${name}`,bytes:written.length,sha256:sha(written),meshes:actual.listMeshes().map(m=>m.getName()),coverageRevision:COVERAGE_REVISION,coverageSource:sourceAsset};
   if(original.compression==='gzip')entry.encodedBytes=packed.length;
   writes.push({path:path.join(outDirectory,name),bytes:packed});items[id]=entry;compiled.set(key,entry);
   reports.push({race,id,detail,source:sourceAsset,output:{url:entry.url,sha256:entry.sha256,bytes:entry.bytes,encodedBytes:entry.encodedBytes},...derived,verification});
   if(dusk)rules.partsByItem[id]=[{mesh:derived.partition.covered,hideWhenRegions:['trousers.upper']}];
  }
 }
 if(next.items.lectorCoat)rules.coversByItem.lectorCoat=['trousers.upper'];
 if(next.items.duskguardCuirass)rules.coversByItem.duskguardCuirass=['trousers.upper'];
 next.coverage={schema:1,revision:COVERAGE_REVISION,race,bodySegments:segments};
 next.garmentLayerCoverage=rules;
 return {manifest:next,writes,reports};
}

export async function writeCoverageCompilation(compiled){
 // Immutable artifacts first. The caller publishes its complete manifest last.
 for(const row of compiled.writes){await fs.mkdir(path.dirname(row.path),{recursive:true});await fs.writeFile(row.path,row.bytes);}
}
