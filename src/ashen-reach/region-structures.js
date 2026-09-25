import {Batch} from './geometry.js';
import {masonryBox} from './buildings.js';

const STONE=[.69,.73,.78,0],TRIM=[.84,.86,.88,0],DARK=[.46,.51,.58,0];
const SLATE=[.34,.39,.46,0],ROCK=[.46,.50,.55,0],LAMP=[.22,.14,.06,0];
const UV=1/8/.45/.20;
const sub=(a,b)=>a.map((v,i)=>v-b[i]);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const dot=(a,b)=>a.reduce((sum,v,i)=>sum+v*b[i],0);
const mean=points=>[0,1,2].map(i=>points.reduce((sum,p)=>sum+p[i],0)/points.length);
const unit=v=>{const length=Math.hypot(...v);return v.map(x=>x/length);};

function outwardBox(batch,center,size,color,yaw){
  const firstIndex=batch.idx.length,firstNormal=batch.n.length;
  masonryBox(batch,center,size,color,yaw);
  for(let i=firstNormal;i<batch.n.length;i++)batch.n[i]*=-1;
  for(let i=firstIndex;i<batch.idx.length;i+=3)[batch.idx[i+1],batch.idx[i+2]]=[batch.idx[i+2],batch.idx[i+1]];
}

// All faces are actual closed volumes, including inward-facing room surfaces.
function solid(batch,vertices,faces,color){
  const center=mean(vertices);
  for(const face of faces){
    const points=face.map(i=>vertices[i]);
    let faceNormal=[0,0,0];
    for(let i=1;i<points.length-1&&Math.hypot(...faceNormal)<1e-8;i++)faceNormal=cross(sub(points[i],points[0]),sub(points[i+1],points[0]));
    if(dot(faceNormal,sub(mean(points),center))<0)points.reverse();
    const tangent=unit(sub(points[1],points[0]));
    for(let i=1;i<points.length-1;i++){
      const triangle=[points[0],points[i],points[i+1]],normal=cross(sub(triangle[1],triangle[0]),sub(triangle[2],triangle[0]));
      if(Math.hypot(...normal)<1e-8)continue;
      const bitangent=unit(cross(unit(normal),tangent));
      batch.tri(...triangle,triangle.map(p=>{const d=sub(p,points[0]);return[dot(d,tangent)*UV,dot(d,bitangent)*UV];}),color);
    }
  }
}

function polygonPrism(batch,polygon,depth,map,color){
  const n=polygon.length,vertices=[-depth/2,depth/2].flatMap(d=>polygon.map(([u,y])=>map(u,y,d)));
  solid(batch,vertices,[Array.from({length:n},(_,i)=>i),Array.from({length:n},(_,i)=>i+n),
    ...Array.from({length:n},(_,i)=>[i,(i+1)%n,(i+1)%n+n,i+n])],color);
}

function archPoints(half,spring,tip,steps=6){
  const h=tip-spring,c=(h*h-half*half)/(2*half),radius=c+half,end=Math.acos(-c/radius),left=[];
  for(let i=0;i<=steps;i++){const a=Math.PI+(end-Math.PI)*i/steps;left.push([c+radius*Math.cos(a),spring+radius*Math.sin(a)]);}
  left[0]=[-half,spring];left[steps]=[0,tip];
  return [...left,...left.slice(0,-1).reverse().map(([x,y])=>[-x,y])];
}

/** Build grounded destinations; callers commit/register the one returned collision batch. */
export function buildRegionStructures({stone,roof,rock,glow,groundHeight,landmarks}){
  if(!stone||!roof||!rock||!glow||typeof groundHeight!=='function'||!Array.isArray(landmarks))
    throw new TypeError('Region structures require material batches, terrain and landmarks');
  const sites=landmarks.filter(site=>site.kind==='keep'||site.kind==='tower');
  // Validate all sites before appending anything to the caller-owned batches.
  for(const site of sites){
    for(const key of ['x','z','floorY','yaw','height','width'])if(!Number.isFinite(site[key]))throw new TypeError(`Landmark ${site.id}: ${key} must be finite`);
    if(site.height<12||site.width<=0)throw new RangeError(`Landmark ${site.id}: invalid dimensions`);
    const extent=site.kind==='keep'?30:8;
    for(const [dx,dz] of [[0,0],[-extent,-extent],[extent,extent],[-extent,extent],[extent,-extent]])
      if(!Number.isFinite(groundHeight(site.x+dx,site.z+dz)))throw new TypeError('Structure terrain heights must be finite');
  }
  const collisionBatch=new Batch('Region structure collision');
  const batches=[...new Set([stone,roof,rock,glow])],before=batches.reduce((sum,b)=>sum+b.idx.length/3,0),destinations=[];
  for(const site of sites){
    const {x,z,floorY,yaw,height:H}=site,c=Math.cos(yaw),s=Math.sin(yaw);
    const map=(u,y,d)=>[x+u*c+d*s,floorY+y,z-u*s+d*c];
    const box=(u,y,d,w,h,depth,color=STONE,batch=stone)=>{
      if(Math.min(w,h,depth)<=0)throw new RangeError('Structure box must have positive dimensions');
      outwardBox(batch,map(u,y,d),[w,h,depth],color,yaw);
      outwardBox(collisionBatch,map(u,y,d),[w,h,depth],color,yaw);
    };
    const prism=(polygon,depth,u=0,d=0,color=STONE,batch=stone)=>{
      const local=(a,y,b)=>map(u+a,y,d+b);
      polygonPrism(batch,polygon,depth,local,color);polygonPrism(collisionBatch,polygon,depth,local,color);
    };
    const pyramid=(u,y,d,rise,radius,sides=8)=>{
      const vertices=Array.from({length:sides},(_,i)=>map(u+Math.cos(i*Math.PI*2/sides)*radius,y,d+Math.sin(i*Math.PI*2/sides)*radius));
      vertices.push(map(u,y+rise,d));
      const faces=[Array.from({length:sides},(_,i)=>i),...Array.from({length:sides},(_,i)=>[i,(i+1)%sides,sides])];
      solid(roof,vertices,faces,SLATE);solid(collisionBatch,vertices,faces,SLATE);
    };
    const portal=(d,width,wallWidth,top,depth,spring,tip)=>{
      const half=width/2,jamb=(wallWidth-width)/2;
      for(const sign of [-1,1])box(sign*(half+jamb/2),top/2,d,jamb,top,depth);
      const inner=archPoints(half,spring,tip),outer=archPoints(half+.36,spring,tip+.36);
      for(let i=0;i<inner.length-1;i++){
        const a=inner[i],b=inner[i+1];
        prism([a,b,[b[0],top],[a[0],top]],depth,0,d);
        prism([a,b,outer[i+1],outer[i]],.42,0,d-depth/2-.15,TRIM);
      }
      for(const sign of [-1,1])box(sign*(half+.18),spring/2,d-depth/2-.15,.36,spring,.42,TRIM);
    };
    const crenels=(u,d,length,alongDepth=false,y=7)=>{
      const count=Math.floor(length/3);
      for(let i=0;i<count;i++){
        const t=(i+.5)*length/count-length/2;
        box(u+(alongDepth?0:t),y,d+(alongDepth?t:0),alongDepth?1.4:1.25,1.2,alongDepth?1.25:1.4,TRIM);
      }
    };
    const support=(w,depth)=>{
      // Small irregular battered supports meet the sampled terrain, below a flush
      // slab. The front centre is kept inside the threshold to leave routes open.
      const ring=[[-w/2,-depth/2],[-w*.18,-depth/2],[w*.19,-depth/2],[w/2,-depth/2],
        [w/2,depth*.13],[w/2,depth/2],[w*.05,depth/2],[-w/2,depth/2],[-w/2,-depth*.04]];
      const top=ring.map(([u,d])=>map(u,-.3,d));
      const bottom=ring.map(([u,d],i)=>{
        const spread=i===1||i===2?1:1.06,point=map(u*spread,0,d*spread),terrain=groundHeight(point[0],point[2]);
        if(!Number.isFinite(terrain))throw new TypeError('Structure support terrain must be finite');
        point[1]=Math.min(floorY-.65,terrain-.7);return point;
      });
      const n=ring.length,vertices=[...bottom,...top],faces=[Array.from({length:n},(_,i)=>i),Array.from({length:n},(_,i)=>n+i),
        ...Array.from({length:n},(_,i)=>[i,(i+1)%n,(i+1)%n+n,i+n])];
      solid(rock,vertices,faces,ROCK);solid(collisionBatch,vertices,faces,ROCK);
    };
    if(site.kind==='keep'){
      support(32,40);
      box(0,-.15,0,32,.3,40,TRIM);box(0,-.15,-20,6,.3,4,TRIM);
      portal(-19.4,5,32,7.2,1.2,4.5,6.3);
      for(const sign of [-1,1]){
        box(sign*15.4,3.25,0,1.2,6.5,40);box(sign*15.4,6.45,0,1.55,.4,40,TRIM);crenels(sign*15.4,0,38,true);
      }
      box(0,3.25,19.4,32,6.5,1.2);box(0,6.45,19.4,32,.4,1.55,TRIM);crenels(0,19.4,30);crenels(0,-19.4,30,false,7.8);
      // Twin gatehouse masses frame the clear central passage rather than filling it.
      for(const [u,towerHeight] of [[-11.4,11.5],[11.4,14]]){
        box(u,towerHeight/2,-16,5.5,towerHeight,6,DARK);
        box(u,towerHeight-.25,-16,6.05,.5,6.55,TRIM);
        pyramid(u,towerHeight,-16,5.5,4.25,4);
        for(const side of [-1,1])box(u+side*2.2,towerHeight*.43,-19.05,.55,towerHeight*.86,.35,TRIM);
        box(u,towerHeight*.62,-19.07,.7,1.7,.10,DARK,roof);
        box(u,towerHeight*.62,-19.14,.20,1.15,.04,LAMP,glow);
      }
      // Courtyard remains open; the hall has a separate three-metre portal.
      portal(-1.5,3,14,10,1,3.3,5.2);
      for(const sign of [-1,1])box(sign*6.5,5,7,1,10,18);
      box(0,5,15.5,14,10,1);
      prism([[-7.4,10],[0,15.4],[0,15.1],[-7.4,9.7]],18.8,0,7,SLATE,roof);
      prism([[0,15.4],[7.4,10],[7.4,9.7],[0,15.1]],18.8,0,7,SLATE,roof);
      for(const sign of [-1,1])for(const d of [0,6,12]){
        box(sign*7.15,3.5,d,1.3,7,1.4,DARK);
        box(sign*7.15,7.1,d,1.6,.4,1.7,TRIM);
      }
      // Tall keep body starts above the ground-floor hall's headroom.
      const bodyTop=H*.78,bodyBottom=10.2;
      box(0,(bodyTop+bodyBottom)/2,10,9,bodyTop-bodyBottom,9);
      for(const y of [Math.max(12,H*.31),H*.57,bodyTop])box(0,y,10,9.6,.5,9.6,TRIM);
      for(const sign of [-1,1])for(const d of [5.6,14.4])box(sign*4.4,(bodyTop+10.3)/2,d,.8,bodyTop-10.3,.8,DARK);
      pyramid(0,bodyTop,10,H*1.05-bodyTop,7,4);
      for(const y of [H*.43,H*.61]){
        box(0,y,5.45,1.4,2.5,.14,DARK,roof);box(0,y,5.35,.38,1.65,.05,LAMP,glow);
      }
      // Restrained furnishings leave the central approach and return unobstructed.
      for(const sign of [-1,1])box(sign*4.5,.4,7,1.1,.8,5,DARK);
      destinations.push({...site,entrance:map(0,0,-20),courtyard:map(0,0,-10),hall:map(0,0,7),
        interior:map(0,0,10),footprint:{width:32,depth:40},gateWidth:5,hallDoorWidth:3,topY:floorY+H*1.05});
    }else{
      support(6,6);box(0,-.15,0,6,.3,6,TRIM);box(0,-.15,-3,4,.3,2,TRIM);
      const top=H*.78;
      portal(-2.6,3,6,top,.8,3,4.7);
      for(const sign of [-1,1])box(sign*2.6,top/2,0,.8,top,6);
      box(0,top/2,2.6,6,top,.8);
      box(0,8.35,0,4.4,.3,4.4,DARK);
      for(const y of [H*.31,H*.57,top]){
        // A ring, not a full slab, preserves the entrance and chamber.
        for(const sign of [-1,1]){box(sign*2.8,y,0,.65,.45,6.25,TRIM);box(0,y,sign*2.8,6.25,.45,.65,TRIM);}
      }
      for(const u of [-2.65,2.65])for(const d of [-2.65,2.65]){
        box(u,top*.45,d,.6,top*.9,.6,DARK);pyramid(u,top,d,H*.25,.72,5);
      }
      pyramid(0,top,0,H*.45,4.15,6);
      for(const y of [H*.42,H*.60]){box(0,y,-3.025,.8,1.7,.1,DARK,roof);box(0,y,-3.09,.20,1.1,.035,LAMP,glow);}
      destinations.push({...site,entrance:map(0,0,-3),interior:map(0,0,.5),hall:map(0,0,.5),
        footprint:{width:6,depth:6},gateWidth:3,topY:floorY+H*1.23});
    }
  }
  return {collisionBatch,destinations,triangles:batches.reduce((sum,b)=>sum+b.idx.length/3,0)-before,
    collisionTriangles:collisionBatch.idx.length/3};
}
