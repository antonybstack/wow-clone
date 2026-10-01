/** Reproduce the reviewed Human-only weight correction from its frozen source.
 * Publish an immutable per-piece artifact before advertising it. Existing race
 * fits, source curves, body geometry and runtime animation stay unchanged.
 * https://gltf-transform.dev/modules/extensions/classes/EXTMeshoptCompression
 * https://docs.blender.org/manual/en/latest/modeling/modifiers/modify/data_transfer.html
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {NodeIO,VertexLayout} from '@gltf-transform/core';
import {ALL_EXTENSIONS,EXTMeshoptCompression} from '@gltf-transform/extensions';
import {MeshoptDecoder,MeshoptEncoder} from 'meshoptimizer';
const descriptorPath='blender/characters/wardrobe/pilgrim-front-corrective.json';
const descriptor=JSON.parse(await fs.readFile(descriptorPath,'utf8'));
if(descriptor.blenderVersion!=='5.2.1')throw Error('Unsupported corrective tool version');
const sha=b=>createHash('sha256').update(b).digest('hex'),started=performance.now();
const parent='.cache/character-mmo/wardrobe-v1';await fs.mkdir(parent,{recursive:true});
const work=await fs.mkdtemp(path.join(parent,'pilgrim-publish-'));
const run=(script,args=[])=>execFileSync(process.execPath,[script,...args],{stdio:'inherit'});
run('scripts/character-assets/build-garment-skin-corrective.mjs',[descriptor.item,work,descriptor.mask,descriptorPath]);
run('scripts/character-assets/verify-garment-skin-corrective.mjs',[work]);
await Promise.all([MeshoptDecoder.ready,MeshoptEncoder.ready]);
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder,'meshopt.encoder':MeshoptEncoder}).setVertexLayout(VertexLayout.SEPARATE);
const doc=await io.read(`${work}/pilgrimTunic.glb`);doc.createExtension(EXTMeshoptCompression).setRequired(true);
const bytes=await io.writeBinary(doc),digest=sha(bytes),directory='public/ashen-reach/equipment';
const filename=`pilgrimTunic-${digest.slice(0,12)}.glb`,file=path.join(directory,filename);
const manifestFile=path.join(directory,'manifest.json');
const manifest=JSON.parse(await fs.readFile(manifestFile,'utf8'));
if(manifest.items.body.sha256!==descriptor.bodySha256)throw Error('Accepted body changed during compilation');
const audit=JSON.parse(await fs.readFile(`${work}/pilgrimTunic-report.json`,'utf8'));
const verification=JSON.parse(await fs.readFile(`${work}/verification.json`,'utf8'));
audit.candidate={path:file,sha256:digest,bytes:bytes.length,neutralSemanticSha256:descriptor.acceptedNeutralCandidateSha256};
audit.verification=verification;audit.corrective={id:descriptor.id,revision:descriptor.revision};audit.rights=descriptor.rights;
audit.authoringSeconds=(performance.now()-started)/1000;
audit.toolSources.push({path:'scripts/character-assets/prepare-pilgrim-front-corrective.mjs',sha256:sha(await fs.readFile('scripts/character-assets/prepare-pilgrim-front-corrective.mjs'))});
await fs.writeFile(file,bytes);
await fs.writeFile('public/ashen-reach/pilgrim-front-corrective-provenance.json',JSON.stringify(audit,null,2)+'\n');
manifest.items.pilgrimTunic={...manifest.items.pilgrimTunic,url:`/ashen-reach/equipment/${filename}`,bytes:bytes.length,sha256:digest,corrective:audit.corrective};
await fs.writeFile(`${manifestFile}.tmp`,JSON.stringify(manifest,null,2)+'\n');await fs.rename(`${manifestFile}.tmp`,manifestFile);
await fs.writeFile(`${directory}/pilgrimTunic.glb`,bytes);
console.log(JSON.stringify({artifact:file,bytes:bytes.length,sha256:digest,authoringSeconds:audit.authoringSeconds}));
