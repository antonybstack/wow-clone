import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {composeLoadout} from '../src/character/runtime/compose-loadout.js';
import {parseGlb,readAccessor,emptyGlbJson,glbWriter} from '../src/character/runtime/glb.js';
import {fileSha256} from '../src/character/runtime/fit-contract.js';
import {copyFitMaterial} from '../src/character/runtime/fit-material.js';
const buf=async p=>{const b=await readFile(p);return b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);};
test('mage composition preserves canonical skeleton, animation data and embedded wool/leather images',async()=>{
 const source=await buf('public/characters/bodies/human-animated-v1.glb');
 const sha=await fileSha256(source);
 const manifest=JSON.parse(await readFile('public/characters/garments/starter-fits.v1.json'));
 const fits={};for(const id of ['mageCoat','starterTrousers','mageBoots'])fits[id]=await buf(`public/characters/garments/${id}.human-v1.v1.glb`);
 const composed=await composeLoadout(source,fits,{profileId:'human-v1',manifest,loadout:{chest:'mageCoat',legs:'starterTrousers',feet:'mageBoots'}});
 const before=parseGlb(source),after=parseGlb(composed.buffer);
 assert.equal(await fileSha256(source),sha);
 assert.deepEqual(after.json.skins,before.json.skins);
 assert.deepEqual(after.json.animations,before.json.animations);
 for(const anim of before.json.animations)for(const sampler of anim.samplers)for(const key of ['input','output'])assert.deepEqual(readAccessor(after.json,after.binary,sampler[key]),readAccessor(before.json,before.binary,sampler[key]));
 const material=after.json.materials.find(m=>m.name==='MageWool');
 assert.equal(material.doubleSided,true);
 const texture=after.json.textures[material.pbrMetallicRoughness.baseColorTexture.index];
 const image=after.json.images[texture.source],view=after.json.bufferViews[image.bufferView];
 assert.equal(image.mimeType,'image/png');
 assert.deepEqual(after.binary.slice(view.byteOffset,view.byteOffset+view.byteLength),new Uint8Array(await readFile('public/characters/garments/mage-wool.png')));
 const leatherBytes=new Uint8Array(await readFile('public/characters/garments/mage-leather.png'));
 const leatherMaterials=after.json.materials.filter(m=>m.name==='MageLeather');
 assert.equal(leatherMaterials.length,2,'coat and boots each retain their embedded leather resource');
 for(const leather of leatherMaterials){
  const tex=after.json.textures[leather.pbrMetallicRoughness.baseColorTexture.index];
  const img=after.json.images[tex.source],bv=after.json.bufferViews[img.bufferView];
  assert.equal(img.mimeType,'image/png');
  assert.deepEqual(after.binary.slice(bv.byteOffset,bv.byteOffset+bv.byteLength),leatherBytes);
 }
 for(const node of after.json.nodes.filter(n=>/^Fit_mage/.test(n.name))){
  const mesh=after.json.meshes[node.mesh],attrs=mesh.primitives[0].attributes;
  const weights=readAccessor(after.json,after.binary,attrs.WEIGHTS_0),joints=readAccessor(after.json,after.binary,attrs.JOINTS_0);
  for(let i=0;i<weights.length;i+=4){assert.ok(Math.abs(weights[i]+weights[i+1]+weights[i+2]+weights[i+3]-1)<1e-5);for(let k=0;k<4;k++)assert.ok(joints[i+k]<after.json.skins[0].joints.length);}
 }
});
test('fit material rejects external images and invalid embedded ranges',()=>{
 const def={pbrMetallicRoughness:{baseColorTexture:{index:0}}};
 const source={json:{textures:[{source:0}],images:[{uri:'https://example.invalid/texture.png'}]},binary:new Uint8Array(8)};
 const dst=emptyGlbJson(),writer=glbWriter(dst,new Uint8Array());
 assert.throws(()=>copyFitMaterial(def,source,writer,dst),/TEXTURE_UNSUPPORTED/);
 source.json.images=[{bufferView:0,mimeType:'image/png'}];source.json.bufferViews=[{buffer:0,byteOffset:4,byteLength:100}];
 assert.throws(()=>copyFitMaterial(def,source,writer,dst),/Invalid fit image buffer/);
});
