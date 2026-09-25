import {rng,cross,sub,norm} from './geometry.js';
import {masonryBox} from './buildings.js';

function rockFace(rock,a,b,c,d,color,normals=null){
 const points=[a,b,c,d];
 const span=axis=>Math.max(...points.map(p=>p[axis]))-Math.min(...points.map(p=>p[axis]));
 const axis=span(0)>span(2)?0:2;
 rock.quad(a,b,c,d,points.map(p=>[p[axis]*.09,p[1]*.09]),color,normals);
}

// Backdrop only. Masonry, roofs and rock have separate values so wall faces
// remain readable in haze while the fortress keeps its Gothic silhouette.
function spire(stone,roof,warm,x,z,g,H,w,rows=2,crown='spire'){
 masonryBox(stone,[x,g+H*.39,z],[w,H*.78,w],[.82,.85,.88,0]);
 masonryBox(stone,[x,g+.9,z],[w*1.28,1.8,w*1.28],[.64,.68,.73,0]);
 for(const dx of [-1,1])for(const dz of [-1,1]){
  masonryBox(stone,[x+dx*w*.46,g+H*.32,z+dz*w*.46],[w*.18,H*.64,w*.18],[.65,.70,.76,0]);
  if(crown==='spire')roof.tube([x+dx*w*.46,g+H*.81,z+dz*w*.46],[x+dx*w*.46,g+H*1.03,z+dz*w*.46],w*.17,0,[1,1,1,0],5);
  else masonryBox(stone,[x+dx*w*.44,g+H*.82,z+dz*w*.44],[w*.26,H*.10,w*.26],[.82,.85,.88,0]);
 }
 for(const h of [.31,.57,.77])masonryBox(stone,[x,g+H*h,z],[w*1.08,.55,w*1.08],[.95,.96,.98,0]);
 if(crown!=='parapet')roof.tube([x,g+H*.775,z],[x-w*.05,g+H*(crown==='spire'?1.23:1.05),z],w*.77,.04,[1,1,1,0],6);
 for(let j=0;j<rows;j++){
  const y=g+H*(.39+j*.12),wh=H*.038;
  roof.box([x,y,z-w*.505],[w*.25,wh*1.65,.12],[1,1,1,0]);
  warm.box([x,y,z-w*.52],[w*.10,wh,.04],[.65,.60,.48,0]);
 }
}

function wallSpan(stone,x1,z1,x2,z2,g,H,T=2.4){
 const dx=x2-x1,dz=z2-z1,len=Math.hypot(dx,dz),yaw=Math.atan2(-dz,dx);
 masonryBox(stone,[(x1+x2)/2,g+H/2,(z1+z2)/2],[len,H,T],[.70,.75,.80,0],yaw);
 masonryBox(stone,[(x1+x2)/2,g+H-.35,(z1+z2)/2],[len,.7,T*1.18],[.90,.92,.94,0],yaw);
 const n=Math.ceil(len/3.4);
 for(let k=0;k<n;k++){
  const t=(k+.5)/n;
  masonryBox(stone,[x1+dx*t,g+H+.5,z1+dz*t],[1.3,1,T],[.78,.82,.86,0],yaw);
 }
}

// Closed terraced rock. Its irregular skirt is buried in the local heightfield;
// its flat upper ring supports the complete wall footprint from every angle.
function crag(rock,cx,cz,topY,rx,rz,groundHeight,seed){
 const rand=rng(seed),n=14,rings=[[],[],[]];
 for(let k=0;k<n;k++){
  const a=k*Math.PI*2/n,w=.93+rand()*.14,x=Math.cos(a)*rx*w,z=Math.sin(a)*rz*w;
  rings[0].push([cx+x*1.55,groundHeight(cx+x*1.55,cz+z*1.55)-3,cz+z*1.55]);
  rings[1].push([cx+x*1.18,topY-5-rand()*4,cz+z*1.18]);
  rings[2].push([cx+x,topY,cz+z]);
 }
 for(let k=0;k<n;k++){
  const next=(k+1)%n,c=.65+rand()*.24;
  for(let layer=0;layer<2;layer++){
   const a=rings[layer][k],b=rings[layer][next],u=rings[layer+1][k],v=rings[layer+1][next];
   rockFace(rock,a,u,v,b,[c*.92,c,c*1.08,0]);
  }
  rock.tri(rings[2][k],[cx,topY,cz],rings[2][next],undefined,[.64,.70,.73,0]);
 }
}

// Slopes and secondary shoulders give the ridges depth during camera motion.
// The inner foot intersects the terrain and the far face closes each crest.
function ridgeRing(rock,cx,cz,rx,rz,groundHeight,seed,n,hMin,hMax,tint,sharp){
 const rand=rng(seed),ph=[rand()*7,rand()*7,rand()*7],spin=rand()*7,pts=[];
 const oct=(a,f,p)=>1-Math.abs(Math.sin(a*f*.5+p));
 for(let k=0;k<n;k++){
  const a=k*Math.PI*2/n;
  const t=Math.pow(.52*oct(a,3,ph[0])+.30*oct(a,7,ph[1])+.18*oct(a,17,ph[2]),sharp);
  const wob=1+.14*Math.sin(a*2+spin)*Math.sin(a*5-spin);
  const x=Math.cos(a)*rx*wob,z=Math.sin(a)*rz*wob;
  const rawHeight=hMin+(hMax-hMin)*t;
  // The northern saddle opens a sightline to Vaelmark beyond the first ridge.
  const saddle=seed===7204&&z>150?Math.exp(-(x*x)/5000):0;
  // Push the next northern range behind the fortress footprint; lowering only
  // the first ring otherwise leaves the second ring's slope inside its rear wall.
  const shift=seed===7318&&z>150?70*Math.exp(-(x*x)/10000):0;
  const ground=groundHeight(cx+x,cz+z+shift);
  const h=Math.max(ground+3,rawHeight)*(1-saddle)+ground*saddle;
  const foot=[cx+x*.77,groundHeight(cx+x*.77,cz+z*.77+shift)-8,cz+z*.77+shift];
  const shoulder=[cx+x*.89,foot[1]+(h-foot[1])*.58,cz+z*.89+shift];
  pts.push([foot,shoulder,[cx+x,h,cz+z+shift],[cx+x*1.18,groundHeight(cx+x*1.18,cz+z*1.18+shift)-12,cz+z*1.18+shift]]);
 }
 const normals=pts.map((row,k)=>row.map((p,level)=>norm(cross(
  sub(pts[(k+1)%n][level],pts[(k+n-1)%n][level]),
  sub(row[Math.min(3,level+1)],row[Math.max(0,level-1)])
 ))));
 for(let k=0;k<n;k++)for(let level=0;level<3;level++){
  const next=(k+1)%n,a=pts[k],b=pts[next],s=.96+.04*Math.sin(k*.69+seed);
  const color=[tint[0]*s,tint[1]*s,tint[2]*s,0];
  rockFace(rock,a[level],b[level],b[level+1],a[level+1],color,
   [normals[k][level],normals[next][level],normals[next][level+1],normals[k][level+1]]);
 }
}

function mesaKeep(stone,rock,roof,warm,x,z,groundHeight,H,w,rise){
 const g=groundHeight(x,z)+rise;
 crag(rock,x,z,g,22,18,groundHeight,((x*73856093)^(z*19349663))>>>0);
 spire(stone,roof,warm,x,z,g,H,w,3,'roof');
 wallSpan(stone,x-13,z-7,x+13,z-7,g,6);
}

export function buildHorizon(distant,warm,groundHeight,{stone,rock,ridge=rock}){
 const batches=[...new Set([distant,warm,stone,rock,ridge])];
 const count=()=>batches.reduce((sum,b)=>sum+b.idx.length/3,0),before=count();
 const stoneNormalStart=stone.n.length;
 // Vaelmark is built as an explorable cathedral by gothic-cathedral.js.
 ridgeRing(ridge,0,40,230,270,groundHeight,7204,150,34,86,[.82,.72,.78],1.35);
 ridgeRing(ridge,0,40,320,380,groundHeight,7318,170,62,134,[.94,.80,.86],1.7);
 ridgeRing(ridge,0,40,420,500,groundHeight,7440,190,84,172,[1.0,.87,.94],2.1);
 mesaKeep(stone,rock,distant,warm,196,-38,groundHeight,39,10,14);
 mesaKeep(stone,rock,distant,warm,-186,112,groundHeight,35,9,13);
 mesaKeep(stone,rock,distant,warm,74,-214,groundHeight,43,11,16);
 spire(stone,distant,warm,132,-55,groundHeight(132,-55),24,5.4,2);
 spire(stone,distant,warm,-125,-80,groundHeight(-125,-80),22,5,2);
 spire(stone,distant,warm,78,168,groundHeight(78,168),26,5.6,3);
 // masonryBox uses inward face winding. These solid backdrop walls need outward
 // lighting normals; leave the shared helper's existing town consumers untouched.
 for(let i=stoneNormalStart;i<stone.n.length;i++)stone.n[i]*=-1;
 return {triangles:count()-before};
}
