/** Offline MIT EZ-Tree geometry export. No Three.js or generator in the game bundle.
 * Uses existing licensed bark at runtime; generator textures are not copied.
 */
import fs from 'node:fs/promises';
import * as THREE from 'three';
// Geometry-only export: texture loading has no DOM/network role in this process.
THREE.TextureLoader.prototype.load=function(){return new THREE.Texture();};
const {Tree}=await import('@dgreenheck/ez-tree');
const variants=[];
for(const [name,seed,preset] of [['ash',2711,'ash_medium'],['oak',60013,'oak_medium'],['wind-ash',83861,'ash_medium']]){
 const options=JSON.parse(await fs.readFile(`node_modules/@dgreenheck/ez-tree/src/lib/presets/${preset}.json`,'utf8'));
 options.seed=seed;options.bark.textured=false;options.leaves.count=0;
 options.branch.levels=3;options.branch.children={0:5,1:3,2:2};
 options.branch.sections={0:4,1:3,2:2,3:1};options.branch.segments={0:5,1:4,2:3,3:3};
 if(name==='wind-ash')options.branch.force={direction:{x:.5,y:1,z:.15},strength:.09};
 const tree=new Tree();tree.loadFromJson(options);
 const geometry=tree.branchesMesh.geometry,positions=geometry.attributes.position.array,normals=geometry.attributes.normal.array,uv=geometry.attributes.uv.array;
 let min=Infinity,max=-Infinity;for(let i=1;i<positions.length;i+=3){min=Math.min(min,positions[i]);max=Math.max(max,positions[i]);}
 const span=max-min;
 const p=Array.from(positions,(v,i)=>+((v-(i%3===1?min:0))/span).toFixed(6));
 variants.push({name,seed,p,n:Array.from(normals,v=>+v.toFixed(5)),u:Array.from(uv,v=>+v.toFixed(5)),idx:Array.from(geometry.index.array)});
 console.log(name,geometry.index.count/3,'triangles');
}
await fs.mkdir('public/ashen-reach/woodland',{recursive:true});
await fs.writeFile('public/ashen-reach/woodland/trees.json',JSON.stringify({generator:'@dgreenheck/ez-tree 1.1.0',license:'MIT',variants}));
await fs.copyFile('node_modules/@dgreenheck/ez-tree/LICENSE','public/ashen-reach/woodland/LICENSE-EZ-TREE.txt');
