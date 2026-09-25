import {buildCathedralFoundation,buildCathedralExploration} from './cathedral-exploration.js';
import {Batch} from './geometry.js';
import {masonryBox} from './buildings.js';

const STONE=[.67,.71,.76,0], TRIM=[.79,.81,.83,0], SHADE=[.44,.49,.55,0];
const SLATE=[.29,.34,.42,0], ROCK=[.42,.46,.51,0], AMBER=[.24,.14,.055,0];
// Match buildings.js masonry texel density, including the material's .20 UV scale.
const UV_PER_M=(1/8/.45)/.20;
const sub=(a,b)=>a.map((v,i)=>v-b[i]);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
const unit=a=>{const d=Math.hypot(...a);return a.map(v=>v/d);};
const mean=points=>[0,1,2].map(i=>points.reduce((s,p)=>s+p[i],0)/points.length);

/** Correct only newly appended masonry; shared batches may contain unrelated work. */
function box(batch,center,size,color=STONE,yaw=0){
  const firstIndex=batch.idx.length,firstNormal=batch.n.length;
  masonryBox(batch,center,size,color,yaw);
  for(let i=firstNormal;i<batch.n.length;i++)batch.n[i]*=-1;
  for(let i=firstIndex;i<batch.idx.length;i+=3){
    const b=batch.idx[i+1];batch.idx[i+1]=batch.idx[i+2];batch.idx[i+2]=b;
  }
}

/** Closed convex polyhedron, outward winding AND normals; no double-sided shortcut. */
function solid(batch,vertices,faces,color){
  const center=mean(vertices);
  for(const face of faces){
    const p=face.map(i=>vertices[i]);
    if(dot(cross(sub(p[1],p[0]),sub(p[2],p[0])),sub(mean(p),center))<0)p.reverse();
    const tangent=unit(sub(p[1],p[0]));
    for(let i=1;i<p.length-1;i++){
      const tri=[p[0],p[i],p[i+1]],normal=cross(sub(tri[1],tri[0]),sub(tri[2],tri[0]));
      if(Math.hypot(...normal)<1e-8)continue;
      const bitangent=unit(cross(unit(normal),tangent));
      const uv=tri.map(v=>{const d=sub(v,p[0]);return [dot(d,tangent)*UV_PER_M,dot(d,bitangent)*UV_PER_M];});
      batch.tri(...tri,uv,color);
    }
  }
}

// A convex polygon in local (u,y), extruded along local depth through a world mapping.
function prism(batch,polygon,depth,map,color=STONE){
  const n=polygon.length,vertices=[-depth/2,depth/2].flatMap(d=>polygon.map(([u,y])=>map(u,y,d)));
  const faces=[Array.from({length:n},(_,i)=>i),Array.from({length:n},(_,i)=>i+n)];
  for(let i=0;i<n;i++){const j=(i+1)%n;faces.push([i,j,j+n,i+n]);}
  solid(batch,vertices,faces,color);
}

function beam(batch,a,b,width,color=TRIM){
  const direction=unit(sub(b,a));
  const side=unit(cross(direction,Math.abs(direction[1])>.9?[1,0,0]:[0,1,0]));
  const up=unit(cross(direction,side));
  const vertices=[a,b].flatMap(p=>[[-1,-1],[1,-1],[1,1],[-1,1]].map(([s,t])=>
    p.map((v,i)=>v+(side[i]*s+up[i]*t)*width/2)));
  solid(batch,vertices,[[0,1,2,3],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]],color);
}

function pointed(halfWidth,spring,tip,steps=10){
  const h=tip-spring,c=(h*h-halfWidth*halfWidth)/(2*halfWidth),r=c+halfWidth;
  const end=Math.acos(-c/r),left=[];
  for(let i=0;i<=steps;i++){
    const angle=Math.PI+(end-Math.PI)*i/steps;
    left.push([c+r*Math.cos(angle),spring+r*Math.sin(angle)]);
  }
  left[0]=[-halfWidth,spring];left[steps]=[0,tip];
  return [...left,...left.slice(0,-1).reverse().map(([x,y])=>[-x,y])];
}

function arch(batch,halfWidth,spring,tip,thickness,depth,map,color=TRIM){
  const inner=pointed(halfWidth,spring,tip),outer=pointed(halfWidth+thickness,spring,tip+thickness);
  for(let i=0;i<inner.length-1;i++)prism(batch,[inner[i],inner[i+1],outer[i+1],outer[i]],depth,map,color);
}

/** Fill above an arch up to a level wall top, leaving the opening genuinely empty. */
function spandrel(batch,halfWidth,spring,tip,top,depth,map,color=STONE){
  const points=pointed(halfWidth,spring,tip);
  for(let i=0;i<points.length-1;i++){
    const a=points[i],b=points[i+1];
    if(top-Math.max(a[1],b[1])<1e-7){
      const low=a[1]<b[1]?a:b,high=a[1]<b[1]?b:a;
      if(top-low[1]>1e-7)prism(batch,[low,high,[low[0],top]],depth,map,color);
    }else prism(batch,[a,b,[b[0],top],[a[0],top]],depth,map,color);
  }
}

function pinnacle(batch,x,y,z,rise,radius,color=SLATE,sides=8){
  const v=Array.from({length:sides},(_,i)=>[x+Math.cos(i*Math.PI*2/sides)*radius,y,z+Math.sin(i*Math.PI*2/sides)*radius]);
  v.push([x,y+rise,z]);
  solid(batch,v,[Array.from({length:sides},(_,i)=>i),...Array.from({length:sides},(_,i)=>[i,(i+1)%sides,sides])],color);
}

/**
 * Appends original Vaelmark architecture to the supplied material batches.
 * collisionBatch contains floors, ramp, walls, piers, parapets and roof shells.
 * Commit it once as a hidden, non-rendering mesh and register {type:'mesh',mesh}.
 * The supplied colliders list is deliberately NOT mutated: no duplicate physics.
 * Metadata positions are surface heights, not player capsule centers.
 */
export function buildGothicCathedral({stone,roof,glow,rock,groundHeight,colliders}){
  if(!stone||!roof||!glow||!rock||typeof groundHeight!=='function')throw new TypeError('Cathedral requires four batches and groundHeight');
  const floorY=groundHeight(0,310)+12,startY=groundHeight(0,145)+.05;
  if(!Number.isFinite(floorY)||!Number.isFinite(startY))throw new TypeError('Cathedral terrain heights must be finite');
  const collisionBatch=new Batch('Vaelmark collision');
  const batches=[...new Set([stone,roof,glow,rock])],before=batches.reduce((s,b)=>s+b.idx.length/3,0);
  const heightAt=z=>startY+(floorY-startY)*Math.max(0,Math.min(1,(z-145)/125));
  const wall=(center,size,color=STONE,batch=stone)=>{
    box(batch,center,size,color);box(collisionBatch,center,size,STONE);
  };
  const faceMap=(x,z,yaw=0)=>(u,y,d)=>[x+u*Math.cos(yaw)+d*Math.sin(yaw),floorY+y,z-u*Math.sin(yaw)+d*Math.cos(yaw)];
  const bridgeMap=(u,y,d)=>[d,y,u];
  const rampPolygon=(z0,z1,offset=0,thickness=1.1)=>[
    [z0,heightAt(z0)+offset-thickness],[z1,heightAt(z1)+offset-thickness],
    [z1,heightAt(z1)+offset],[z0,heightAt(z0)+offset]];
  // Subdivide visible bridge for illumination; a single planar collider has no step seams.
  for(let z=145;z<270;z+=5)prism(stone,rampPolygon(z,z+5),8,bridgeMap,STONE);
  prism(collisionBatch,rampPolygon(145,270),8,bridgeMap,STONE);
  for(const side of [-1,1]){
    const railMap=(u,y,d)=>[side*4.45+d,y,u];
    for(let z=145;z<270;z+=5){
      prism(stone,rampPolygon(z,z+5,1.15,1.15),.65,railMap,SHADE);
      prism(stone,rampPolygon(z,z+5,1.3,.15),.85,railMap,TRIM);
    }
    prism(collisionBatch,rampPolygon(145,270,1.3,1.3),.85,railMap,STONE);
    for(let z=150;z<270;z+=10)box(stone,[side*4.45,heightAt(z)+.78,z],[1,1.65,1],TRIM);
  }
  // Structural arcade under the deck. Roots sit below actual terrain, not a flat datum.
  for(let z=170;z<=250;z+=20){
    for(const side of [-1,1]){
      const ground=groundHeight(side*3.45,z)-.6,top=heightAt(z)-1;
      if(!Number.isFinite(ground))throw new TypeError('Nonfinite bridge pier terrain');
      if(top>ground)wall([side*3.45,(ground+top)/2,z],[2.15,top-ground,2.4],ROCK,rock);
      box(stone,[side*3.45,top-.35,z],[2.8,.7,3.1],TRIM);
      if(z<250){
        const middle=z+10,tip=heightAt(middle)-1.3;
        const map=(u,y,d)=>[side*3.65+d,y,middle+u];
        arch(stone,8.7,tip-6,tip,.85,1.1,map,SHADE);
        arch(collisionBatch,8.7,tip-6,tip,.85,1.1,map,STONE);
      }
    }
  }

  const helpers={stone,roof,glow,rock,collisionBatch,floorY,groundHeight,solid,wall,beam,box,prism,arch,faceMap};
  const foundation=buildCathedralFoundation(helpers);
  // Two paving borders lead to the portal without raised obstacles on the centerline.
  for(const side of [-1,1])box(stone,[side*4.5,floorY+.018,287],[.3,.036,32],TRIM);

  // Nave side walls: real clerestory voids, framed on all four sides.
  const windowCenters=[309,317,325,333,341,349];
  for(const side of [-1,1]){
    const x=side*12;
    // Ground-level side-chapel doorway, clear from z=326 to z=330.
    wall([x,floorY+4.25,315],[1.3,8.5,22]);
    wall([x,floorY+4.25,342],[1.3,8.5,24]);
    wall([x,floorY+6.75,328],[1.3,3.5,4]);
    for(const batch of [stone,collisionBatch])arch(batch,2,3,5,.3,1.4,(u,y,d)=>[x+d,floorY+y,328+u],TRIM);
    wall([x,floorY+23.35,329],[1.3,1.3,50]);
    let cursor=304;
    for(const z of windowCenters){
      const left=z-2.3,right=z+2.3;
      const chapelWindow=z>=325&&z<=341;
      if(chapelWindow)wall([x,floorY+11.05,z],[1.3,5.1,4.6],STONE);
      if(left>cursor){
        if(z===349){
          wall([x,floorY+17.35,(cursor+left)/2],[1.3,10.7,left-cursor]);
          wall([x,floorY+10.25,(cursor+345.5)/2],[1.3,3.5,345.5-cursor]);
        }else wall([x,floorY+15.6,(cursor+left)/2],[1.3,14.2,left-cursor]);
      }
      const map=(u,y,d)=>[x+d,floorY+y,z+u];
      spandrel(stone,2.3,18.5,22.7,22.7,1.3,map);
      spandrel(collisionBatch,2.3,18.5,22.7,22.7,1.3,map);
      for(const inset of [-.83,.83]){
        const frame=(u,y,d)=>map(u,y,d+inset);
        arch(stone,2.3,18.5,22.7,.28,.28,frame,TRIM);
        for(const u of [-2.45,2.45])box(stone,map(u,chapelWindow?16.05:z===349?15.25:13.5,inset),[.3,chapelWindow?4.9:z===349?6.5:10,.3],TRIM);
      }
      for(const u of [-.78,.78]){
        beam(stone,map(u,chapelWindow?13.6:z===349?12:8.5,0),map(u,18.6,0),.18);
        arch(stone,.71,17.1,19.1,.13,.2,(v,y,d)=>map(v+u,y,d),TRIM);
      }
      beam(stone,map(-2.3,14,0),map(2.3,14,0),.18);
      // Thin colored accents within tracery; the aperture itself remains open.
      if(!chapelWindow)for(const u of [-1.6,0,1.6])beam(glow,map(u,z===349?12:10,.02),map(u,13.6,.02),.075,AMBER);
      cursor=right;
    }
    if(cursor<354)wall([x,floorY+15.6,(cursor+354)/2],[1.3,14.2,354-cursor]);
    for(const y of [2.3,8.3,23.7]){
      if(y===2.3){box(stone,[x,floorY+y,314.25],[1.75,.35,21.5],TRIM);box(stone,[x,floorY+y,342.75],[1.75,.35,23.5],TRIM);}
      else box(stone,[x,floorY+y,329],[1.75,.35,51],TRIM);
    }
    for(let z=313;z<=353;z+=8){
      if(z>=321&&z<=345)continue;
      wall([side*14.8,floorY+6,z],[2.3,12,2],SHADE);
      box(stone,[side*14.8,floorY+12.25,z],[2.7,.5,2.4],TRIM);
      beam(stone,[side*14.8,floorY+11.7,z],[side*12,floorY+19.5,z],.8);
      beam(stone,[side*14.8,floorY+12.8,z],[side*12,floorY+21.3,z],.35);
      pinnacle(roof,side*14.8,floorY+12.5,z,4,.85);
    }
  }

  // Deep pointed western portal (south-facing): eight metres clear at its spring.
  for(const side of [-1,1])wall([side*8,floorY+12,304],[8,24,1.8]);
  spandrel(stone,4,4,8,24,1.8,faceMap(0,304));
  spandrel(collisionBatch,4,4,8,24,1.8,faceMap(0,304));
  for(let ring=0;ring<5;ring++){
    const w=4+ring*.45,z=302.8-ring*.36;
    arch(stone,w,4,8+ring*.45,.32,.5,faceMap(0,z),ring===1?SHADE:TRIM);
    for(const side of [-1,1])box(stone,[side*(w+.16),floorY+2,z],[.32,4,.5],TRIM);
  }
  // Rose tracery recessed behind a projecting ring: deep cool stone, restrained amber.
  const rose=[0,floorY+16.4,302.95],radius=3.15;
  for(let i=0;i<16;i++){
    const a=i*Math.PI/8,b=(i+1)*Math.PI/8;
    const p=t=>[rose[0]+Math.cos(t)*radius,rose[1]+Math.sin(t)*radius,rose[2]];
    beam(stone,p(a),p(b),.36);
    beam(stone,rose,p(a),.12,SHADE);
    beam(glow,[Math.cos(a)*1.2,rose[1]+Math.sin(a)*1.2,303.02],p(a),.075,AMBER);
  }
  // Tall altar window: the wall has an actual aperture, not an emissive decal.
  // Raised sill prevents accidental exits; recessed stone tracery casts real shadows.
  wall([0,floorY+2.25,354],[24,4.5,1.4]);
  for(const side of [-1,1])wall([side*8.25,floorY+14.25,354],[7.5,19.5,1.4]);
  spandrel(stone,4.5,16,22,24,1.4,faceMap(0,354));
  spandrel(collisionBatch,4.5,16,22,24,1.4,faceMap(0,354));
  for(const z of [352.98,355.02]){
    for(const batch of [stone,collisionBatch])arch(batch,4.5,16,22,.35,.38,faceMap(0,z),TRIM);
    for(const side of [-1,1])wall([side*4.68,floorY+10.25,z],[.36,11.5,.38],TRIM);
    wall([0,floorY+4.5,z],[10,.35,.65],TRIM);
  }
  // Mullions sit inside the 1.4m wall depth, behind the projecting archivolts.
  const apseMap=faceMap(0,354.12);
  const windowBeam=(a,b,width=.18)=>{
    beam(stone,apseMap(...a),apseMap(...b),width,TRIM);
    beam(collisionBatch,apseMap(...a),apseMap(...b),width,STONE);
  };
  for(const x of [-1.5,1.5])windowBeam([x,4.5,0],[x,15,0],.24);
  windowBeam([-4.5,10.5,0],[4.5,10.5,0],.22);
  for(const x of [-3,0,3])for(const batch of [stone,collisionBatch])
    arch(batch,1.32,14,17,.17,.3,(u,y,d)=>apseMap(u+x,y,d),TRIM);
  for(let i=0;i<12;i++){
    const a=i*Math.PI/6,b=(i+1)*Math.PI/6,r=1.45;
    windowBeam([Math.cos(a)*r,19.2+Math.sin(a)*r,0],[Math.cos(b)*r,19.2+Math.sin(b)*r,0]);
  }
  windowBeam([0,17,0],[0,17.75,0]);
  windowBeam([0,20.65,0],[0,22,0]);
  // Narrow facade shafts interrupt the plain gable without changing its footprint.
  for(const side of [-1,1]){
    wall([side*8.8,floorY+13.2,302.6],[.65,26.4,.65],TRIM);
    box(stone,[side*8.8,floorY+26.45,302.6],[1,.35,1],TRIM);
    pinnacle(roof,side*8.8,floorY+26.65,302.6,2.2,.55);
  }
  for(const z of [304,354]){
    const map=faceMap(0,z);
    prism(stone,[[-12,24],[12,24],[0,36]],1.35,map);
    prism(collisionBatch,[[-12,24],[12,24],[0,36]],1.35,map);
    for(const side of [-1,1])beam(stone,[side*12.2,floorY+24,z],[0,floorY+36.3,z],.45);
  }
  for(const side of [-1,1]){
    const p=[[0,36],[side*13.1,23.8],[side*13.1,23.25],[0,35.45]];
    const map=(u,y,d)=>[u,floorY+y,329+d];
    prism(roof,p,53,map,SLATE);prism(collisionBatch,p,53,map,STONE);
    for(let z=305;z<=353;z+=8)beam(roof,[0,floorY+36.08,z],[side*13.1,floorY+23.88,z],.16,SHADE);
  }
  beam(stone,[0,floorY+36.1,302.5],[0,floorY+36.1,355.5],.4,TRIM);
  for(const z of [304,329,354])pinnacle(roof,0,floorY+36.25,z,3.6,.6);

  // Clustered interior piers, transverse pointed ribs and diagonal vault webs.
  for(let z=309;z<=349;z+=8){
    for(const side of [-1,1]){
      wall([side*9.8,floorY+6,z],[1.3,12,1.3],SHADE);
      box(stone,[side*9.8,floorY+.3,z],[1.9,.6,1.9],TRIM);
      box(stone,[side*9.8,floorY+12,z],[1.95,.65,1.95],TRIM);
      for(const dx of [-.53,.53])box(stone,[side*9.8+dx,floorY+6,z-.62],[.25,11.8,.25],TRIM);
    }
    arch(stone,9.8,12.3,23.2,.35,.45,faceMap(0,z));
    if(z<349)for(const side of [-1,1]){
      beam(stone,[side*9.8,floorY+12.3,z],[0,floorY+23.2,z+4],.25,SHADE);
      beam(stone,[0,floorY+23.2,z+4],[side*9.8,floorY+12.3,z+8],.25,SHADE);
    }
  }
  // Altar lies beyond the returned standing point, with a clear central processional aisle.
  wall([0,floorY+.65,350.7],[4.4,1.3,1.7],SHADE);
  box(stone,[0,floorY+1.4,350.7],[4.8,.2,2],TRIM);
  beam(stone,[0,floorY+2,353.1],[0,floorY+8,353.1],.28,TRIM);
  beam(stone,[-1.6,floorY+6,353.1],[1.6,floorY+6,353.1],.24,TRIM);
  for(const x of [-1.7,1.7])box(glow,[x,floorY+1.8,350.7],[.12,.55,.12],AMBER);

  // Unequal bell towers. Hollow bases have actual south doorways; upper stages are open.
  for(const [x,shaft,spire] of [[-17,32,12],[17,42,14]]){
    const z=306,bellBase=shaft-7;
    for(const dx of [-4,4])wall([x+dx,floorY+bellBase/2,z],[1.2,bellBase,10]);
    wall([x,floorY+bellBase/2,z+5],[8,bellBase,1.2]);
    for(const dx of [-2.75,2.75])wall([x+dx,floorY+bellBase/2,z-5],[2.5,bellBase,1.2]);
    spandrel(stone,1.5,3,5,bellBase,1.2,faceMap(x,z-5));
    spandrel(collisionBatch,1.5,3,5,bellBase,1.2,faceMap(x,z-5));
    arch(stone,1.5,3,5,.35,.55,faceMap(x,z-5.8));
    for(const dx of [-4,4])for(const dz of [-5,5]){
      wall([x+dx,floorY+(bellBase+shaft)/2,z+dz],[1.35,7,1.35]);
      box(stone,[x+dx,floorY+bellBase/2,z+dz],[1.6,bellBase,1.6],SHADE);
      pinnacle(roof,x+dx,floorY+shaft,z+dz,4,.7);
    }
    for(const y of [1.2,10,20,bellBase,shaft]){
      for(const dz of [-5,5])box(stone,[x,floorY+y,z+dz],[9.7,.5,1.5],TRIM);
      for(const dx of [-4,4])box(stone,[x+dx,floorY+y,z],[1.5,.5,10.6],TRIM);
    }
    for(const dz of [-5,5])arch(stone,3.3,bellBase+1,shaft-.5,.4,1.15,faceMap(x,z+dz));
    for(const dx of [-4,4])arch(stone,4.3,bellBase+1,shaft-.5,.4,1.15,(u,y,d)=>[x+dx+d,floorY+y,z+u]);
    wall([x,floorY+shaft-.2,z],[9,.4,11],SHADE);
    pinnacle(roof,x,floorY+shaft,z,spire,6.4,SLATE);
    pinnacle(collisionBatch,x,floorY+shaft,z,spire,6.4,STONE);
    for(let y=7;y<bellBase-2;y+=6){
      for(const dx of [-2.5,2.5])arch(stone,.65,y,y+2.8,.16,.22,faceMap(x+dx,z-5.73),SHADE);
    }
  }
  const exploration=buildCathedralExploration(helpers);
  return {
    foundation,exploration,
    floorY,entry:[0,floorY,304],altar:[0,floorY,345],collisionBatch,
    route:{start:[0,startY,145],end:[0,floorY,270],width:8,heightAt,
      waypoints:[[0,startY,145],[0,heightAt(210),210],[0,floorY,270],[0,floorY,298],[0,floorY,310],[0,floorY,345]]},
    terrace:{minX:-38,maxX:38,minZ:270,maxZ:365},
    nave:{minX:-12,maxX:12,minZ:304,maxZ:354,height:24,roofPeak:36},
    triangles:batches.reduce((s,b)=>s+b.idx.length/3,0)-before,
    collisionTriangles:collisionBatch.idx.length/3,
  };
}
