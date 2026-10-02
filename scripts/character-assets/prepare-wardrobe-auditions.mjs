/** Isolated legacy-slot aliases ONLY for live source auditions before catalogue release.
 * Every alias is labeled in the live view; it is not a production item identity.
 * Reuse the accepted shape/hem pass and per-primitive rigid fitting, then feed
 * bounded hashes to the normal streamed loader through the owned test context.
 */
import fs from 'node:fs/promises';import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {NodeIO,VertexLayout} from '@gltf-transform/core';import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {MeshoptDecoder,MeshoptEncoder} from 'meshoptimizer';
import {deriveUpperTrousers} from './derive-coverage-geosets.mjs';
import {verifyCoveragePartition} from './verify-coverage-partition.mjs';
const kind=process.argv[2];if(!['lector','duskguard'].includes(kind))throw Error('Expected known source design');
await Promise.all([MeshoptDecoder.ready,MeshoptEncoder.ready]);
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder,'meshopt.encoder':MeshoptEncoder}).setVertexLayout(VertexLayout.SEPARATE);
const sha=b=>createHash('sha256').update(b).digest('hex'),root=`.cache/character-mmo/wardrobe-v1/auditions/${kind}`;
const specs=kind==='lector'?[{source:'lectorCoat',id:'pilgrimTunic',rename:{LectorCoat:'PilgrimTunic'}}]:[
 {source:'duskguardCuirass',id:'graveweaverTop',rename:{DuskguardUndercoat:'GraveweaverTop',DuskguardGussets:'GraveweaverTop',DuskguardCuirass:'GraveweaverPendant'}},
 {source:'duskguardTassets',id:'graveweaverSkirt',rename:{DuskguardTrousers:'WayfarerTrousers',DuskguardTrouserCuffs:'WayfarerTrousersCuffs',DuskguardTassets:'GraveweaverSkirt'}},
 {source:'duskguardGreaves',id:'wayfarerBoots',rename:{DuskguardBootUnderlayer:'WayfarerBoots',DuskguardGreaves:'WayfarerBoots'}},
 {source:'duskguardVambraces',id:'graveweaverGloves',rename:{DuskguardGloveUnderlayer:'GraveweaverGloves',DuskguardVambraces:'GraveweaverGloves'}},
];
const rows=[];
for(const race of ['human','orc','undead']){
 const dir=`${root}/${race}`;await fs.mkdir(`${dir}/raw`,{recursive:true});
 for(const spec of specs){
  const doc=await io.read(`.cache/character-mmo/wardrobe-v1/${kind}/${race}/${spec.source}.glb`),r=doc.getRoot(),byName=new Map();
  for(const mesh of [...r.listMeshes()]){
   const name=spec.rename[mesh.getName()];if(!name)throw Error('Unexpected source mesh in audition');
   const previous=byName.get(name);
   if(previous){
    // These exact source frames are identical. Combine primitive lists, retaining
    // their native material, skin and explicit cloth/rigid metadata separately.
    const node=r.listNodes().find(n=>n.getMesh()===mesh),target=r.listNodes().find(n=>n.getMesh()===previous);
    if(node.getWorldMatrix().some((v,i)=>Math.abs(v-target.getWorldMatrix()[i])>1e-7)||node.getSkin()!==target.getSkin())throw Error('Cannot alias unlike mesh frames');
    for(const primitive of [...mesh.listPrimitives()]){mesh.removePrimitive(primitive);previous.addPrimitive(primitive);}
    node.dispose();mesh.dispose();
   }else{mesh.setName(name);byName.set(name,mesh);}
  }
  for(const node of r.listNodes())if(node.getMesh())node.setName(node.getMesh().getName());
  await io.write(`${dir}/raw/${spec.id}.glb`,doc);
 }
 if(race==='human')execFileSync(process.execPath,['scripts/character-assets/build-garment-shape-family.mjs'],{stdio:'inherit',env:{...process.env,ASHEN_GARMENT_SOURCE_DIR:`${dir}/raw`,ASHEN_GARMENT_ITEMS:specs.map(s=>s.id).join(','),ASHEN_GARMENT_OUT:`${dir}/shaped`,ASHEN_GARMENT_REPORT:`${dir}/shape-report.json`}});
 for(const spec of specs){
  let file=`${dir}/${race==='human'?'shaped':'raw'}/${spec.id}.glb`,bytes=await fs.readFile(file),coverage=null;
  if(kind==='duskguard'&&spec.id==='graveweaverSkirt'){
   const reference=(await io.readBinary(bytes)).getRoot(),doc=await io.readBinary(bytes);
   coverage=deriveUpperTrousers(doc);bytes=await io.writeBinary(doc);
   coverage.verification=verifyCoveragePartition(reference,(await io.readBinary(bytes)).getRoot(),coverage.partition.source,coverage.partition.covered);
   file=`${dir}/graveweaverSkirt-covered.glb`;await fs.writeFile(file,bytes);
  }
  rows.push({coverage,race,originalItem:spec.source,alias:spec.id,file,bytes:bytes.length,sha256:sha(bytes),url:`/__wardrobe_audition__/${kind}/${race}/${spec.id}.glb`});
 }
}
await fs.writeFile(`${root}/audition.json`,JSON.stringify({schema:1,kind,candidateOnly:true,temporaryAliases:true,rows},null,2)+'\n');
