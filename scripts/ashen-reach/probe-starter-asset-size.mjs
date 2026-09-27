/** Size-only experiment. Reads shipped assets; never writes replacement GLBs.
 * Outputs byte estimates, NOT animation/visual acceptance.
 * Uses the existing source rig and Meshopt tooling, without vertex reorder or
 * quantization (shared skinned accessors must remain compatible).
 * https://gltf-transform.dev/modules/functions/functions/prune
 * https://gltf-transform.dev/modules/functions/functions/textureCompress
 * Usage: node scripts/ashen-reach/probe-starter-asset-size.mjs <report.json>
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {brotliCompressSync,constants} from 'node:zlib';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS, EXTMeshoptCompression} from '@gltf-transform/extensions';
import {prune} from '@gltf-transform/functions';
import {MeshoptDecoder,MeshoptEncoder} from 'meshoptimizer';
import sharp from 'sharp';

const destination=process.argv[2];
if(!destination)throw Error('Specify report.json');
await Promise.all([MeshoptDecoder.ready,MeshoptEncoder.ready]);
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.encoder':MeshoptEncoder,'meshopt.decoder':MeshoptDecoder});
const input=await fs.readFile('public/ashen-reach/equipment/body.glb');
const keep=new Set(['Idle_Loop','Walk_Loop','Sprint_Loop','Jog_Bwd_Loop','Jog_Left_Loop','Jog_Right_Loop','Turn90_L','Turn90_R','Jump_Start','Jump_Loop','Jump_Land']);
const geometryHashes=doc=>doc.getRoot().listMeshes().flatMap(m=>m.listPrimitives().map(p=>Object.fromEntries(
  [...p.listSemantics().map(s=>[s,p.getAttribute(s)]),['indices',p.getIndices()]].filter(([,a])=>a).map(([s,a])=>[s,createHash('sha256').update(Buffer.from(a.getArray().buffer,a.getArray().byteOffset,a.getArray().byteLength)).digest('hex')])
)));
const size=buffer=>({bytes:buffer.byteLength,brotliQuality6Bytes:brotliCompressSync(buffer,{params:{[constants.BROTLI_PARAM_QUALITY]:6}}).byteLength});
const report={purpose:'Offline size feasibility only; no GLB deployed, no visual/animation acceptance. Clothing remains separate and is included only as current byte cost.',sourceSha256:createHash('sha256').update(input).digest('hex'),source:size(input),variants:[]};
for(const maxTextureSize of [null,512,256]){
  const doc=await io.readBinary(input),before=geometryHashes(doc);
  for(const animation of doc.getRoot().listAnimations())if(!keep.has(animation.getName()))animation.dispose();
  await doc.transform(prune({keepLeaves:true,keepAttributes:true}));
  if(maxTextureSize)for(const texture of doc.getRoot().listTextures()){
    const source=Buffer.from(texture.getImage());
    const pipeline=sharp(source).resize({width:maxTextureSize,height:maxTextureSize,fit:'inside',withoutEnlargement:true});
    const mime=texture.getMimeType();
    const encoded=await (mime==='image/webp'?pipeline.webp({quality:75,alphaQuality:90}):mime==='image/jpeg'?pipeline.jpeg({quality:72,mozjpeg:true}):pipeline.png({compressionLevel:9})).toBuffer();
    if(encoded.length<source.length)texture.setImage(encoded);
  }
  doc.createExtension(EXTMeshoptCompression).setRequired(true);
  const output=await io.writeBinary(doc);
  const reloaded=await io.readBinary(output);
  const exactGeometry=JSON.stringify(before)===JSON.stringify(geometryHashes(reloaded));
  if(!exactGeometry)throw Error('Geometry changed in size experiment');
  report.variants.push({maxTextureSize,animations:reloaded.getRoot().listAnimations().map(a=>a.getName()),skins:reloaded.getRoot().listSkins().length,exactGeometry,...size(output)});
}
report.clothing=[];
for(const name of ['wayfarerTunic','wayfarerTrousers','wayfarerBoots'])report.clothing.push({name,...size(await fs.readFile(`public/ashen-reach/equipment/${name}.glb`))});
await fs.mkdir(path.dirname(destination),{recursive:true});
await fs.writeFile(destination,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
