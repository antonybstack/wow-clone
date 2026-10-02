/** Stage all current production paths without advertising or mutating sources.
 * ASHEN_COVERAGE_OUT can point at a local staging root. Promotion is explicit.
 */
import fs from 'node:fs/promises';import path from 'node:path';import {createHash} from 'node:crypto';
import {NodeIO,VertexLayout} from '@gltf-transform/core';import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {MeshoptDecoder,MeshoptEncoder} from 'meshoptimizer';
import {compileCoverageManifest,writeCoverageCompilation,COVERAGE_REVISION} from './compile-coverage-manifest.mjs';
await Promise.all([MeshoptDecoder.ready,MeshoptEncoder.ready]);
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder,'meshopt.encoder':MeshoptEncoder}).setVertexLayout(VertexLayout.SEPARATE);
const output=process.env.ASHEN_COVERAGE_OUT||'.cache/character-mmo/coverage-release',reports=[];
const publish=process.argv.includes('--publish'),digest=b=>createHash('sha256').update(b).digest('hex');
if(path.resolve(output)===path.resolve('public'))throw Error('Coverage compilation must stage before publication');
for(const [race,directory]of [['human','equipment'],['human','human-shape-v1'],['human','startup/character'],['orc','equipment-orc'],['undead','equipment-undead']]){
 const relative=`ashen-reach/${directory}`,source=`public/${relative}/manifest.json`,manifest=JSON.parse(await fs.readFile(source,'utf8'));
 const compiled=await compileCoverageManifest({io,manifest,race,outDirectory:path.join(output,relative),urlRoot:`/${relative}`});
 await writeCoverageCompilation(compiled);const manifestName=directory.startsWith('equipment')?'manifest-coverage-v1.json':'manifest.json';
 await fs.writeFile(path.join(output,relative,manifestName),JSON.stringify(compiled.manifest,...(directory.startsWith('equipment')?[null,2]:[]))+'\n');
 reports.push({race,directory,manifestName,publicationManifest:`public/${relative}/${manifestName}`,sourceManifest:source,sourceManifestSha256:digest(await fs.readFile(source)),artifacts:compiled.writes.map(a=>path.basename(a.path)),rows:compiled.reports});
}
await fs.writeFile(path.join(output,'report.json'),JSON.stringify({schema:1,revision:COVERAGE_REVISION,candidateOnly:true,reports},null,2)+'\n');
if(publish){
 // All five manifests and every written artifact have passed before ANY
 // advertised entry changes. Preserve the old immutable/source artifacts.
 for(const row of reports)if(digest(await fs.readFile(row.sourceManifest))!==row.sourceManifestSha256)throw Error('Coverage source changed during publication');
 for(const row of reports){const dir=`ashen-reach/${row.directory}`;for(const name of row.artifacts)await fs.copyFile(path.join(output,dir,name),path.join('public',dir,name));}
 for(const row of reports){const temp=`${row.publicationManifest}.coverage-tmp`;await fs.copyFile(path.join(output,`ashen-reach/${row.directory}/${row.manifestName}`),temp);await fs.rename(temp,row.publicationManifest);}
 await fs.writeFile('public/ashen-reach/coverage-provenance.json',JSON.stringify({schema:1,revision:COVERAGE_REVISION,candidateOnly:false,generatedBy:'scripts/character-assets/prepare-coverage-release.mjs',reports},null,2)+'\n');
}
console.log(`${publish?'Published locally':'Staged'} ${reports.reduce((n,r)=>n+r.rows.length,0)} independently verified fits; production deployment is unchanged.`);
