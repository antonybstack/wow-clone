/** Reuse the decoded covered-hair comparison before changing pinned starter hashes.
 * Only the named, completely covered ponytail may differ; all visible native
 * geometry, morphs, bind, curves, scene roots and material pixels must match.
 * https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#meshes
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {MeshoptDecoder} from 'meshoptimizer';
import {identityGeometryHash,identityAnimationHash} from './human-identity-proof.mjs';
const directory=path.resolve(process.argv[2]||'.cache/character-mmo/covered-hair-proof');
const relative=path.relative(path.resolve('.cache'),directory);
assert(relative&&!relative.startsWith('..')&&!path.isAbsolute(relative),'Proof output must be under .cache');
await fs.mkdir(directory,{recursive:true});
const output=name=>path.join(directory,name),sha=x=>createHash('sha256').update(x).digest('hex');
const index=JSON.parse(await fs.readFile('public/ashen-reach/human-identity-v1/manifest.json','utf8'));
await MeshoptDecoder.ready;
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder});
const records=[];
for(const id of ['prime-bald','prime-ponytail']){
 const manifest=index.presets[id].manifest,item=manifest.compactItems.body,encoded=await fs.readFile('public'+item.url),decoded=gunzipSync(encoded);
 assert.equal(sha(decoded),item.sha256);assert.equal(encoded.length,item.encodedBytes);
 const document=await io.readBinary(new Uint8Array(decoded)),root=document.getRoot(),json=JSON.parse(new TextDecoder().decode(decoded.subarray(20,20+decoded.readUInt32LE(12))));
 const materialNames=new Set(root.listMeshes().filter(m=>m.getName()!=='HumanPonytail01').flatMap(m=>m.listPrimitives().map(p=>p.getMaterial()?.getName())));
 const node=n=>({name:n.getName(),translation:n.getTranslation(),rotation:n.getRotation(),scale:n.getScale(),weights:n.getWeights(),mesh:n.getMesh()?.getName(),skin:n.getSkin()?.getName(),parents:n.listParents().filter(p=>p.propertyType==='Node').map(p=>p.getName()).sort()});
 const material=m=>({name:m.getName(),decl:json.materials.find(x=>x.name===m.getName()),textures:[m.getBaseColorTexture(),m.getMetallicRoughnessTexture(),m.getNormalTexture(),m.getOcclusionTexture(),m.getEmissiveTexture()].map(t=>t?{mime:t.getMimeType(),sha:sha(t.getImage()),sampler:json.samplers?.[json.textures?.[root.listTextures().indexOf(t)]?.sampler]??{}}:null)});
 records.push({id,item,meshes:root.listMeshes().map(m=>m.getName()),geometry:identityGeometryHash({listMeshes:()=>root.listMeshes().filter(m=>m.getName()!=='HumanPonytail01')}),animation:identityAnimationHash(root),textureAuthoringNames:root.listTextures().map(t=>t.getName()),scenes:root.listScenes().map(scene=>({name:scene.getName(),default:scene===root.getDefaultScene(),roots:scene.listChildren().filter(n=>n.getMesh()?.getName()!=='HumanPonytail01').map(n=>n.getName())})),nodes:root.listNodes().filter(n=>n.getMesh()?.getName()!=='HumanPonytail01').map(node),skins:root.listSkins().map(s=>({name:s.getName(),joints:s.listJoints().map(n=>n.getName()),bind:Array.from(s.getInverseBindMatrices().getArray())})),materials:root.listMaterials().filter(m=>materialNames.has(m.getName())).map(material)});
}
const [bald,pony]=records,checks={geometry:bald.geometry===pony.geometry,animation:bald.animation===pony.animation};
for(const key of ['nodes','skins','materials','scenes']){try{assert.deepEqual(bald[key],pony[key]);checks[key]=true;}catch(error){checks[key]=false;await fs.writeFile(output(key+'-difference.txt'),error.message);}}
const report={purpose:'Independent decoded comparison of existing compact variants; no asset mutation or runtime acceptance',sourceCatalogueSha:sha(JSON.stringify(index)),bald:{url:bald.item.url,encodedBytes:bald.item.encodedBytes,decodedSha:bald.item.sha256,meshes:bald.meshes},ponytail:{url:pony.item.url,encodedBytes:pony.item.encodedBytes,decodedSha:pony.item.sha256,meshes:pony.meshes},savedBytes:pony.item.encodedBytes-bald.item.encodedBytes,ignoredTextureAuthoringNames:{bald:bald.textureAuthoringNames,ponytail:pony.textureAuthoringNames},checks};
await fs.writeFile(output('variant-proof.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
assert(Object.values(checks).every(Boolean),'Visible body, rig, source curves or materials differ; stop rather than substituting this variant');
