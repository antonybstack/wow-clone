/** Offline MIT EZ-Tree geometry export. No Three.js or generator in the game bundle.
 * Uses existing licensed bark at runtime; generator textures are not copied.
 */
import fs from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import * as THREE from 'three';
// Geometry-only export: texture loading has no DOM/network role in this process.
THREE.TextureLoader.prototype.load=function(){return new THREE.Texture();};
const {Tree}=await import('@dgreenheck/ez-tree');
function keepsBranchOrientation(full,branch,sectionCount){
 const stride=branch.segments+1;
 const positive=(a,b,c)=>{
  const ab=[0,1,2].map(j=>full.p[b*3+j]-full.p[a*3+j]);
  const ac=[0,1,2].map(j=>full.p[c*3+j]-full.p[a*3+j]);
  const cross=[ab[1]*ac[2]-ab[2]*ac[1],ab[2]*ac[0]-ab[0]*ac[2],ab[0]*ac[1]-ab[1]*ac[0]];
  return cross.reduce((dot,v,j)=>dot+v*(full.n[a*3+j]+full.n[b*3+j]+full.n[c*3+j]),0)>0;
 };
 for(let i=0;i<sectionCount;i++)for(let j=0;j<branch.segments;j++){
  const a=branch.start+Math.round(i*branch.sections/sectionCount)*stride+j;
  const c=branch.start+Math.round((i+1)*branch.sections/sectionCount)*stride+j;
  if(!positive(a,c,a+1)||!positive(a+1,c,c+1))return false;
 }
 return true;
}
/** Select existing rings only: generation/RNG, branch origins, bark coordinates,
 * and the full mesh's height normalization stay untouched. */
export function reduceBranches(full,branches){
 const reduced={p:[],n:[],u:[],idx:[]};
 for(const branch of branches){
  const {start,level,sections,segments}=branch;
  // EZ-Tree terminal continuations inherit the root's five-sided ring. The
  // complete four-piece stem is retained, including its highest terminal tip.
  const stem=segments===5;
  if(!stem&&level>2)continue;
  let sectionCount=stem?sections:level===1?2:1;
  // Some gnarly branches fold if their bend is replaced by one long section.
  // Keep an extra source ring only when collapsing it reverses a face.
  while(sectionCount<sections&&!keepsBranchOrientation(full,branch,sectionCount))sectionCount++;
  // Preserve complete ring cross-sections. Selecting three corners from a
  // four-sided source ring would collapse half its section through the centre.
  const sideCount=segments;
  const base=reduced.p.length/3;
  for(let i=0;i<=sectionCount;i++){
   const ring=Math.round(i*sections/sectionCount);
   for(let j=0;j<=sideCount;j++){
    // Keep the UV seam's duplicate vertex rather than interpolating through it.
    const side=j===sideCount?segments:Math.floor(j*segments/sideCount);
    const source=start+ring*(segments+1)+side;
    reduced.p.push(...full.p.slice(source*3,source*3+3));
    reduced.n.push(...full.n.slice(source*3,source*3+3));
    reduced.u.push(...full.u.slice(source*2,source*2+2));
   }
  }
  for(let i=0;i<sectionCount;i++)for(let j=0;j<sideCount;j++){
   const a=base+i*(sideCount+1)+j,b=a+1,c=a+sideCount+1,d=c+1;
   reduced.idx.push(a,c,b,b,c,d);
  }
 }
 return reduced;
}
export async function generateVariants(){
const variants=[];
for(const [name,seed,preset] of [['ash',2711,'ash_medium'],['oak',60013,'oak_medium'],['wind-ash',83861,'ash_medium']]){
 const options=JSON.parse(await fs.readFile(`node_modules/@dgreenheck/ez-tree/src/lib/presets/${preset}.json`,'utf8'));
 options.seed=seed;options.bark.textured=false;options.leaves.count=0;
 options.branch.levels=3;options.branch.children={0:5,1:3,2:2};
 options.branch.sections={0:4,1:3,2:2,3:1};options.branch.segments={0:5,1:4,2:3,3:3};
 if(name==='wind-ash')options.branch.force={direction:{x:.5,y:1,z:.15},strength:.09};
 const tree=new Tree(),branches=[],generateBranch=tree.generateBranch;
 tree.generateBranch=function(branch){
  branches.push({start:this.branches.verts.length/3,level:branch.level,sections:branch.sectionCount,segments:branch.segmentCount});
  return generateBranch.call(this,branch);
 };
 tree.loadFromJson(options);
 const geometry=tree.branchesMesh.geometry,positions=geometry.attributes.position.array,normals=geometry.attributes.normal.array,uv=geometry.attributes.uv.array;
 let min=Infinity,max=-Infinity;for(let i=1;i<positions.length;i+=3){min=Math.min(min,positions[i]);max=Math.max(max,positions[i]);}
 const span=max-min;
 const p=Array.from(positions,(v,i)=>+((v-(i%3===1?min:0))/span).toFixed(6));
 const full={name,seed,p,n:Array.from(normals,v=>+v.toFixed(5)),u:Array.from(uv,v=>+v.toFixed(5)),idx:Array.from(geometry.index.array)};
 variants.push({...full,reduced:reduceBranches(full,branches)});
 tree.traverse(mesh=>{mesh.geometry?.dispose();mesh.material?.dispose();});
}
return variants;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
const variants=await generateVariants();
for(const v of variants)console.log(v.name,v.idx.length/3,'full triangles,',v.reduced.idx.length/3,'reduced triangles');
await fs.mkdir('public/ashen-reach/woodland',{recursive:true});
await fs.writeFile('public/ashen-reach/woodland/trees.json',JSON.stringify({generator:'@dgreenheck/ez-tree 1.1.0',license:'MIT',variants}));
await fs.copyFile('node_modules/@dgreenheck/ez-tree/LICENSE','public/ashen-reach/woodland/LICENSE-EZ-TREE.txt');
}
