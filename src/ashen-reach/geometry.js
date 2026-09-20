import {createMeshFromData,addToScene} from '@babylonjs/lite';

export const add=(a,b)=>a.map((x,i)=>x+b[i]);
export const mul=(a,s)=>a.map(x=>x*s);
export const sub=(a,b)=>a.map((x,i)=>x-b[i]);
export const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
export const norm=a=>mul(a,1/(Math.hypot(...a)||1));
export function rng(seed=7321){return()=>{seed=(Math.imul(1664525,seed)+1013904223)|0;return(seed>>>0)/4294967296;};}

// The churchyard (z<=40) keeps the exact original formula: climb(z) is 0 there by construction,
// so height(x,z) is bit-for-bit unchanged south of the lych-gate. North of it the ground rises
// gradually toward Hollowmere on a smoothstep ease.
const RISE_START=40,RISE_END=140,RISE_HEIGHT=7.5;
const climb=z=>{if(z<=RISE_START)return 0;const t=Math.min(1,(z-RISE_START)/(RISE_END-RISE_START));return t*t*(3-2*t)*RISE_HEIGHT;};
const terrainRaw=(x,z)=>.30*Math.sin(x*.19+z*.13)+.16*Math.sin(z*.45+x*.11)+.006*z+1.6*Math.exp(-((x+20)**2+(z-30)**2)/260)+climb(z);

/** Flat pads for Milestone 2's Hollowmere buildings: {x,z,w,d} in world space. height() blends
 *  each pad into the sloped terrain, so a builder can read groundHeight(x,z) inside a pad and get
 *  a level floor. All pads sit north of the lych-gate and never touch the churchyard invariant. */
export const buildingPads=[
 {x:-9,z:82,w:8,d:8},{x:9,z:82,w:8,d:8},
 {x:-12,z:98,w:9,d:8},{x:12,z:98,w:9,d:8},
 {x:-9,z:114,w:8,d:8},{x:9,z:114,w:8,d:8},
 {x:-13,z:128,w:11,d:9},{x:13,z:128,w:11,d:9},
 {x:0,z:136,w:16,d:11},
];
const PAD_MARGIN=3;
export function height(x,z){
 let h=terrainRaw(x,z);
 for(const p of buildingPads){
  const dx=Math.max(Math.abs(x-p.x)-p.w/2,0),dz=Math.max(Math.abs(z-p.z)-p.d/2,0);
  const dist=Math.hypot(dx,dz);
  if(dist<PAD_MARGIN){const t=1-dist/PAD_MARGIN,s=t*t*(3-2*t);h=h*(1-s)+terrainRaw(p.x,p.z)*s;}
 }
 return h;
}
export const pathX=z=>Math.sin(z*.14)*1.25;

/** Analytic heightfield normal via central differences, for smooth (non-faceted) ground shading
 *  without adding a single extra triangle. Only used north of the churchyard boundary (z>=40),
 *  by construction never touching the invariant south of it. */
export function terrainNormal(x,z,e=.5){
 const hx1=height(x-e,z),hx2=height(x+e,z),hz1=height(x,z-e),hz2=height(x,z+e);
 return norm(cross([0,hz2-hz1,2*e],[2*e,hx2-hx1,0]));
}

/** Static geometry is packed by surface, so thousands of plants remain a handful of draws. */
export class Batch{
 constructor(name){this.name=name;this.p=[];this.n=[];this.u=[];this.c=[];this.idx=[];}
 tri(a,b,c,uv=[[0,0],[1,0],[.5,1]],color=[1,1,1,0],normal=null){const perVertex=Array.isArray(normal)&&Array.isArray(normal[0]);const flat=perVertex?null:(normal||norm(cross(sub(b,a),sub(c,a))));const base=this.p.length/3;for(let j=0;j<3;j++){this.p.push(...[a,b,c][j]);this.n.push(...(perVertex?normal[j]:flat));this.u.push(...uv[j]);this.c.push(...(Array.isArray(color[0])?color[j]:color));}this.idx.push(base,base+1,base+2);}
 quad(a,b,c,d,uv=[[0,1],[1,1],[1,0],[0,0]],color=[1,1,1,0],normal=null){const cs=Array.isArray(color[0])?color:[color,color,color,color];const perVertex=Array.isArray(normal)&&Array.isArray(normal[0]);this.tri(a,b,c,[uv[0],uv[1],uv[2]],[cs[0],cs[1],cs[2]],perVertex?[normal[0],normal[1],normal[2]]:normal);this.tri(a,c,d,[uv[0],uv[2],uv[3]],[cs[0],cs[2],cs[3]],perVertex?[normal[0],normal[2],normal[3]]:normal);}
 box(center,size,color=[1,1,1,0],yaw=0,lean=0){const [x,y,z]=center,[w,h,d]=size;const P=(a,b,c)=>[x+a*Math.cos(yaw)+c*Math.sin(yaw)+b*lean,y+b,z-a*Math.sin(yaw)+c*Math.cos(yaw)];const v=[P(-w/2,-h/2,-d/2),P(w/2,-h/2,-d/2),P(w/2,h/2,-d/2),P(-w/2,h/2,-d/2),P(-w/2,-h/2,d/2),P(w/2,-h/2,d/2),P(w/2,h/2,d/2),P(-w/2,h/2,d/2)];for(const f of [[0,1,2,3],[5,4,7,6],[4,0,3,7],[1,5,6,2],[3,2,6,7],[4,5,1,0]])this.quad(...f.map(i=>v[i]),undefined,color);}
 tube(a,b,r1,r2,color=[1,1,1,0],sides=5){const d=norm(sub(b,a));const u=norm(cross(d,Math.abs(d[1])>.95?[1,0,0]:[0,1,0])),v=cross(d,u);for(let j=0;j<sides;j++){const at=(p,r,k)=>add(p,add(mul(u,Math.cos(k*Math.PI*2/sides)*r),mul(v,Math.sin(k*Math.PI*2/sides)*r)));this.quad(at(a,r1,j),at(a,r1,j+1),at(b,r2,j+1),at(b,r2,j),[[j/sides,1],[(j+1)/sides,1],[(j+1)/sides,0],[j/sides,0]],color);}}
 /** Bakes static lamp irradiance into a uv2 vertex attribute so the fragment shader adds a flat
  *  O(1) term regardless of how many lamps are registered, instead of looping lamps per-fragment.
  *  `lights` is [{position:[x,y,z],strength,falloff=.5}]; the sum uses the same inverse-square
  *  falloff the shader used to compute per-fragment for the two original hardcoded lamps. */
 commit(engine,scene,material,lights=[]){if(!this.idx.length)return null;const vcount=this.p.length/3;const uv2=new Float32Array(vcount*2);if(lights.length)for(let i=0;i<vcount;i++){const x=this.p[i*3],y=this.p[i*3+1],z=this.p[i*3+2];let lamp=0;for(const L of lights){const dx=x-L.position[0],dy=y-L.position[1],dz=z-L.position[2],f=(L.falloff??.5),d=Math.sqrt(dx*dx+dy*dy+dz*dz)*f;lamp+=L.strength/(1+d*d);}uv2[i*2]=lamp;}const m=createMeshFromData(engine,this.name,new Float32Array(this.p),new Float32Array(this.n),new Uint32Array(this.idx),new Float32Array(this.u),uv2,undefined,new Float32Array(this.c));m.material=material;m.pickable=false;addToScene(scene,m);return m;}
}

/** A warm lantern-glass glow: a tapered hex "flame" core plus a larger, dimmer hex "glass" shell
 *  that fakes a soft brightness falloff without real transparency. Replaces a flat emissive box,
 *  which reads as an acid-green rectangle up close, with something that reads as a lit globe. Used
 *  only for Hollowmere content (never for the churchyard's original two lamps or bell towers, so
 *  the churchyard invariant is untouched). */
export function lanternGlow(batch,p,{r=.09,h=.22,tint=[1,.92,.8],dim=.4,sides=6}={}){
 batch.tube([p[0],p[1]-h/2,p[2]],[p[0],p[1]+h/2,p[2]],r*.62,r*.92,[tint[0],tint[1],tint[2],0],sides);
 batch.tube([p[0],p[1]-h*.6,p[2]],[p[0],p[1]+h*.62,p[2]],r*1.5,r*1.8,[tint[0]*dim,tint[1]*dim,tint[2]*dim,0],sides);
}
