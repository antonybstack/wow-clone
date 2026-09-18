import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {parseGlb,readAccessor} from '../src/character/runtime/glb.js';
await mkdir('.cache',{recursive:true});
const out={};
for(const[id,file]of Object.entries({body:'bodies/human-animated-v1.glb',shirt:'garments/starterShirt.human-v1.v1.glb',boots:'garments/starterBoots.human-v1.v1.glb'})){
 const b=await readFile('public/characters/'+file);
 const{json:j,binary:v}=parseGlb(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength));
 const n=j.nodes.find(n=>n.mesh!==undefined),m=j.meshes[n.mesh];
 out[id]={primitives:m.primitives.map(p=>({attributes:Object.fromEntries(Object.entries(p.attributes).map(([k,i])=>[k,Array.from(readAccessor(j,v,i))])),indices:Array.from(readAccessor(j,v,p.indices)),material:j.materials[p.material]})),joints:j.skins[0].joints.map(i=>j.nodes[i].name),inverseBinds:Array.from(readAccessor(j,v,j.skins[0].inverseBindMatrices))};
}
await writeFile('.cache/mage-source.json',JSON.stringify(out));
