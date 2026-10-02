/** Candidate only: derive conservative cores from the actual source rig AFTER
 * Human morph baking. Original source masters, attributes and curves stay intact.
 * https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#morph-targets
 */
import fs from 'node:fs/promises';import{createHash}from'node:crypto';import{gunzipSync}from'node:zlib';
import{NodeIO,VertexLayout}from'@gltf-transform/core';import{ALL_EXTENSIONS}from'@gltf-transform/extensions';import{MeshoptDecoder,MeshoptEncoder}from'meshoptimizer';
import{deriveTorsoCore,deriveUpperTrousers}from'./derive-coverage-geosets.mjs';
import{verifyCoveragePartition}from'./verify-coverage-partition.mjs';
await Promise.all([MeshoptDecoder.ready,MeshoptEncoder.ready]);
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder,'meshopt.encoder':MeshoptEncoder}).setVertexLayout(VertexLayout.SEPARATE);
const directory='.cache/character-mmo/coverage-pilot',sha=b=>createHash('sha256').update(b).digest('hex');await fs.mkdir(directory,{recursive:true});
const humanManifest=JSON.parse(await fs.readFile('public/ashen-reach/human-shape-v1/manifest.json','utf8')),rows=[];
for(const race of ['human','undead']){
 const humanBody=humanManifest.items.body.coverageSource||humanManifest.items.body;
 const source=race==='human'?'public'+humanBody.url:'public/ashen-reach/equipment-undead/body.glb',encoded=await fs.readFile(source),bytes=race==='human'?gunzipSync(encoded):encoded;
 if(race==='human'&&sha(bytes)!==humanBody.sha256)throw Error('Body source manifest changed');
 const reference=(await io.readBinary(bytes)).getRoot(),doc=await io.readBinary(bytes),root=doc.getRoot();
 const {partition:report,landmarks}=deriveTorsoCore(doc,race),meshName=report.source,joints=root.listSkins()[0].listJoints();
 const output=`${directory}/${race}.glb`,written=await io.writeBinary(doc);await fs.writeFile(output,written);
 // Read-back: indices are distinct, while all base and morph accessors remain
 // identical and shared. This verifies preservation, not motion coverage.
 const actual=(await io.readBinary(written)).getRoot(),exposed=actual.listMeshes().find(m=>m.getName()===meshName),covered=actual.listMeshes().find(m=>m.getName()===report.covered);
 for(const p of covered.listPrimitives())if(!exposed.listPrimitives().some(q=>p.listSemantics().every(s=>q.getAttribute(s)===p.getAttribute(s))&&q.listTargets().length===p.listTargets().length&&q.listTargets().every((t,i)=>t.listSemantics().every(s=>t.getAttribute(s)===p.listTargets()[i].getAttribute(s)))))throw Error('Coverage attributes were duplicated or morphed differently');
 const verification=verifyCoveragePartition(reference,actual,meshName,report.covered);
 rows.push({race,source,sourceSha256:sha(encoded),output,url:`/__coverage_pilot__/${race}.glb`,bytes:written.length,sha256:sha(written),landmarks,partition:report,verification,joints:joints.length,clips:root.listAnimations().length,candidateOnly:true});
}
for(const race of ['human','orc','undead'])for(const id of ['wayfarerTrousers','graveweaverSkirt']){
 // The shipped Human robe already omits these upper trouser triangles. Do not
 // synthesize an empty geoset or claim this body uses the Orc/Undead split.
 if(race==='human'&&id==='graveweaverSkirt')continue;
 const pack=race==='human'?'equipment':`equipment-${race}`;
 const humanItem=humanManifest.items[id].coverageSource||humanManifest.items[id];
 const source=race==='human'?'public'+humanItem.url:`public/ashen-reach/${pack}/${id}.glb`,encoded=await fs.readFile(source),bytes=race==='human'?gunzipSync(encoded):encoded,doc=await io.readBinary(bytes);
 const reference=(await io.readBinary(bytes)).getRoot(),{partition,landmarks}=deriveUpperTrousers(doc);
 const output=`${directory}/${race}-${id}.glb`,written=await io.writeBinary(doc);await fs.writeFile(output,written);
 const verification=verifyCoveragePartition(reference,(await io.readBinary(written)).getRoot(),'WayfarerTrousers',partition.covered);
 rows.push({race,item:id,source,sourceSha256:sha(encoded),output,bytes:written.length,sha256:sha(written),url:`/__coverage_pilot__/${race}-${id}.glb`,partition,landmarks,verification,candidateOnly:true});
}
for(const race of ['human','orc','undead']){
 const manifest=race==='human'?structuredClone(humanManifest):JSON.parse(await fs.readFile(`public/ashen-reach/equipment-${race}/manifest.json`,'utf8'));
 for(const row of rows.filter(r=>r.race===race)){const id=row.item||'body';const entry={...manifest.items[id],url:row.url,bytes:row.bytes,sha256:row.sha256};delete entry.compression;delete entry.encodedBytes;if(!row.item)entry.meshes=[row.partition.source,row.partition.covered];manifest.items[id]=entry;if(manifest.compactItems)manifest.compactItems[id]=entry;}
 manifest.coveragePilot={schema:1,revision:'body-and-layers-v1-candidate',candidateOnly:true};
 await fs.writeFile(`${directory}/${race}-manifest.json`,JSON.stringify(manifest,null,2)+'\n');
}
await fs.writeFile(`${directory}/report.json`,JSON.stringify({schema:1,coverageRevision:'body-and-layers-v1-candidate',rows,visualAccepted:false},null,2)+'\n');console.log(JSON.stringify(rows));
