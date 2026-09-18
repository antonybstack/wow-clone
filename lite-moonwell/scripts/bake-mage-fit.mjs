/** Preserve canonical bind/coverage; append the authored Blender garment payload. */
import {readFile,writeFile} from 'node:fs/promises';
import {parseGlb,glbWriter} from '../src/character/runtime/glb.js';
import {fileSha256} from '../src/character/runtime/fit-contract.js';
import {STARTER_ITEMS} from '../src/character/runtime/garment-catalog.js';
const dir='public/characters/garments';
const geometry=JSON.parse(await readFile('.cache/mage-geometry.json','utf8'));
const manifest=JSON.parse(await readFile(`${dir}/starter-fits.v1.json`,'utf8'));
const wool=await readFile(`${dir}/mage-wool.png`);
const leather=await readFile(`${dir}/mage-leather.png`);
for(const [itemId,template]of [['mageCoat','starterShirt'],['mageBoots','starterBoots']]){
 const b=await readFile(`${dir}/${template}.human-v1.v1.glb`);
 const{json,binary}=parseGlb(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength));
 const writer=glbWriter(json,binary);
 const parts=geometry.parts.filter(p=> /boot/i.test(p.name)===(itemId==='mageBoots'));
 const attrs={positions:[],normals:[],uv:[],joints:[],weights:[]};
 const byMat=new Map();
 const vertices=new Map();
 const widths={positions:3,normals:3,uv:2,joints:4,weights:4};
 for(const p of parts){
   if(!byMat.has(p.material))byMat.set(p.material,[]);
   for(const i of p.indices){
     const values=Object.entries(widths).flatMap(([k,w])=>p[k].slice(i*w,(i+1)*w));
     const key=values.map(v=>Math.round(v*1e6)).join(',');
     let index=vertices.get(key);
     if(index==null){
       index=attrs.positions.length/3;vertices.set(key,index);
       for(const[k,w]of Object.entries(widths)) attrs[k].push(...p[k].slice(i*w,(i+1)*w));
     }
     byMat.get(p.material).push(index);
   }
 }
 const attributes={};
 for(const[name,key,type,Type]of [['POSITION','positions','VEC3',Float32Array],['NORMAL','normals','VEC3',Float32Array],['TEXCOORD_0','uv','VEC2',Float32Array],['JOINTS_0','joints','VEC4',Uint16Array],['WEIGHTS_0','weights','VEC4',Float32Array]]) attributes[name]=writer.append(new Type(attrs[key]),type,name==='POSITION');
 json.materials=[
  {name:'MageWool',doubleSided:true,pbrMetallicRoughness:{baseColorFactor:[1,1,1,1],metallicFactor:0,roughnessFactor:.85,baseColorTexture:{index:0}}},
  {name:'MageLining',doubleSided:true,pbrMetallicRoughness:{baseColorFactor:[.019,.022,.04,1],metallicFactor:0,roughnessFactor:.94}},
  {name:'MageLeather',pbrMetallicRoughness:{baseColorFactor:[.65,.55,.45,1],metallicFactor:0,roughnessFactor:.72}},
  {name:'MageBrass',pbrMetallicRoughness:{baseColorFactor:[.34,.225,.095,1],metallicFactor:.74,roughnessFactor:.48}},
  {name:'MageLinen',pbrMetallicRoughness:{baseColorFactor:[.13,.115,.087,1],metallicFactor:0,roughnessFactor:.93}},
 ];
 if(byMat.has(0)){
   const imageAcc=writer.append(wool,'SCALAR');
   json.images=[{bufferView:json.accessors[imageAcc].bufferView,mimeType:'image/png'}];
   json.samplers=[{magFilter:9729,minFilter:9987,wrapS:10497,wrapT:10497}];json.textures=[{source:0,sampler:0}];
 }else delete json.materials[0].pbrMetallicRoughness.baseColorTexture;
 if(byMat.has(2)){
   const imageAcc=writer.append(leather,'SCALAR');
   json.images??=[];json.samplers??=[];json.textures??=[];
   const source=json.images.push({bufferView:json.accessors[imageAcc].bufferView,mimeType:'image/png'})-1;
   const sampler=json.samplers.push({magFilter:9729,minFilter:9987,wrapS:10497,wrapT:10497})-1;
   json.materials[2].pbrMetallicRoughness.baseColorTexture={index:json.textures.push({source,sampler})-1};
 }
 json.meshes=[{name:itemId,primitives:[...byMat].map(([material,inds])=>({attributes,indices:writer.append(new Uint32Array(inds),'SCALAR'),material}))}];
 json.nodes.find(n=>n.mesh!=null).name=itemId;
 const extras=json.asset.extras.fit;extras.itemId=itemId;extras.cacheKey=extras.cacheKey.replace(template,itemId);
 const buffer=writer.finish();const file=`${itemId}.human-v1.v1.glb`;
 await writeFile(`${dir}/${file}`,new Uint8Array(buffer));
 const original=manifest.items[template].variants['human-v1'];
 manifest.items[itemId]={...STARTER_ITEMS[itemId],variants:{'human-v1':{...original,glb:`/characters/garments/${file}`,file,byteLength:buffer.byteLength,sha256:await fileSha256(buffer),cacheKey:extras.cacheKey,hideNodes:extras.hideNodes}}};
 console.log(itemId,attrs.positions.length/3,'vertices',buffer.byteLength,'bytes');
}
await writeFile(`${dir}/starter-fits.v1.json`,JSON.stringify(manifest,null,2)+'\n');
