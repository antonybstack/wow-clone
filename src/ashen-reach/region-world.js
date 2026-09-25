import {Batch,cross,sub} from './geometry.js';
import {REGION_ROUTES} from './region-layout.js';
import {REGION_BOUNDS} from './regional-terrain.js';
const ROCK=[.48,.44,.50,0],ROAD=[.55,.55,.54,0];
function quad(batch,points,color,up=false){
 if(up){
  // A tight miter can invert one triangle without inverting its neighbour.
  // Validate each surface triangle rather than reversing the whole quad.
  for(const ids of [[0,1,2],[0,2,3]]){const tri=ids.map(i=>points[i]);if(cross(sub(tri[1],tri[0]),sub(tri[2],tri[0]))[1]<0)[tri[1],tri[2]]=[tri[2],tri[1]];batch.tri(...tri,tri.map(p=>[p[0]*.65,p[2]*.65+p[1]*.12]),color);}
 }else batch.quad(...points,points.map(p=>[p[0]*.65,p[2]*.65+p[1]*.12]),color);
}
export function buildRegionWorld({stone,rock,groundHeight}){
 const collisionBatch=new Batch('Region routes and perimeter collision');let roadTriangles=0;
 const surface=(points,color,batch,up=false)=>{quad(batch,points,color,up);quad(collisionBatch,points,color,up);};
 const seen=new Set();
 for(const route of REGION_ROUTES){
  const points=route.points,edges=points.map((p,i)=>{
   const a=points[Math.max(0,i-1)],b=points[Math.min(points.length-1,i+1)],dx=b[0]-a[0],dz=b[2]-a[2],len=Math.hypot(dx,dz),nx=-dz/len,nz=dx/len;
   const previous=i?points[i-1]:points[Math.min(1,points.length-1)],px=p[0]-previous[0],pz=p[2]-previous[2],pl=Math.hypot(px,pz)||1;
   const miter=route.width/2/Math.max(.15,Math.abs(nx*(-pz/pl)+nz*(px/pl)));
   return [-1,1].map(sign=>{const x=p[0]+sign*nx*miter,z=p[2]+sign*nz*miter;
    const protectedCore=(x>=-90&&x<=90&&z>=-95&&z<=145)||(Math.abs(x)<=45&&z>=145&&z<=370);
    return [x,protectedCore&&route.id!=='hollowmere-chapel'?groundHeight(x,z)+.055:p[1],z];});
  });
  for(let i=1;i<points.length;i++){
   const key=[points[i-1],points[i]].map(p=>p.map(n=>n.toFixed(3)).join(',')).sort().join('|');if(seen.has(key))continue;seen.add(key);
   const [al,ar]=edges[i-1],[bl,br]=edges[i];surface([al,bl,br,ar],ROAD,stone,true);roadTriangles+=2;
   for(const [a,b] of [[al,bl],[br,ar]])surface([a,b,[b[0],b[1]-1,b[2]],[a[0],a[1]-1,a[2]]],ROAD,stone);
  }
 }
 // The finite heightfield ends behind a continuous inward-facing cliff. Its top,
 // outer face and base are real mesh surfaces as well; there is no coordinate clamp.
 const {minX,maxX,minZ,maxZ}=REGION_BOUNDS,ring=[];
 const span=(a,b,n)=>Array.from({length:n},(_,i)=>a+(b-a)*i/n);
 for(const x of span(minX,maxX,128))ring.push([x,minZ]);
 for(const z of span(minZ,maxZ,128))ring.push([maxX,z]);
 for(const x of span(maxX,minX,128))ring.push([x,maxZ]);
 for(const z of span(maxZ,minZ,128))ring.push([minX,z]);
 const rows=ring.map(([x,z],i)=>{
  const nx=x===minX?1:x===maxX?-1:0,nz=z===minZ?1:z===maxZ?-1:0;
  const ix=x+nx*22,iz=z+nz*22,base=groundHeight(ix,iz)-2,top=Math.max(base,groundHeight(x,z))+65+12*Math.sin(i*.43)+7*Math.sin(i*1.27);
  return [[ix,base,iz],[ix+nx*2,top,iz+nz*2],[x,top+6,z],[x,groundHeight(x,z)-8,z]];
 });
 for(let i=0;i<rows.length;i++){const a=rows[i],b=rows[(i+1)%rows.length];for(let j=0;j<3;j++)surface([a[j],b[j],b[j+1],a[j+1]],ROCK,rock);surface([a[3],b[3],b[0],a[0]],ROCK,rock);}
 return {collisionBatch,roadTriangles,boundarySegments:rows.length,bounds:REGION_BOUNDS};
}
