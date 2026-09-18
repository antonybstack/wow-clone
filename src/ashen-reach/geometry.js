import {createMeshFromData,addToScene} from '@babylonjs/lite';

export const add=(a,b)=>a.map((x,i)=>x+b[i]);
export const mul=(a,s)=>a.map(x=>x*s);
export const sub=(a,b)=>a.map((x,i)=>x-b[i]);
export const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
export const norm=a=>mul(a,1/(Math.hypot(...a)||1));
export function rng(seed=7321){return()=>{seed=(Math.imul(1664525,seed)+1013904223)|0;return(seed>>>0)/4294967296;};}
export const height=(x,z)=>.30*Math.sin(x*.19+z*.13)+.16*Math.sin(z*.45+x*.11)+.006*z+1.6*Math.exp(-((x+20)**2+(z-30)**2)/260);
export const pathX=z=>Math.sin(z*.14)*1.25;

/** Static geometry is packed by surface, so thousands of plants remain a handful of draws. */
export class Batch{
 constructor(name){this.name=name;this.p=[];this.n=[];this.u=[];this.c=[];this.idx=[];}
 tri(a,b,c,uv=[[0,0],[1,0],[.5,1]],color=[1,1,1,0],normal=null){const n=normal||norm(cross(sub(b,a),sub(c,a))),base=this.p.length/3;for(let j=0;j<3;j++){this.p.push(...[a,b,c][j]);this.n.push(...n);this.u.push(...uv[j]);this.c.push(...(Array.isArray(color[0])?color[j]:color));}this.idx.push(base,base+1,base+2);}
 quad(a,b,c,d,uv=[[0,1],[1,1],[1,0],[0,0]],color=[1,1,1,0],normal=null){const cs=Array.isArray(color[0])?color:[color,color,color,color];this.tri(a,b,c,[uv[0],uv[1],uv[2]],[cs[0],cs[1],cs[2]],normal);this.tri(a,c,d,[uv[0],uv[2],uv[3]],[cs[0],cs[2],cs[3]],normal);}
 box(center,size,color=[1,1,1,0],yaw=0,lean=0){const [x,y,z]=center,[w,h,d]=size;const P=(a,b,c)=>[x+a*Math.cos(yaw)+c*Math.sin(yaw)+b*lean,y+b,z-a*Math.sin(yaw)+c*Math.cos(yaw)];const v=[P(-w/2,-h/2,-d/2),P(w/2,-h/2,-d/2),P(w/2,h/2,-d/2),P(-w/2,h/2,-d/2),P(-w/2,-h/2,d/2),P(w/2,-h/2,d/2),P(w/2,h/2,d/2),P(-w/2,h/2,d/2)];for(const f of [[0,1,2,3],[5,4,7,6],[4,0,3,7],[1,5,6,2],[3,2,6,7],[4,5,1,0]])this.quad(...f.map(i=>v[i]),undefined,color);}
 tube(a,b,r1,r2,color=[1,1,1,0],sides=5){const d=norm(sub(b,a));const u=norm(cross(d,Math.abs(d[1])>.95?[1,0,0]:[0,1,0])),v=cross(d,u);for(let j=0;j<sides;j++){const at=(p,r,k)=>add(p,add(mul(u,Math.cos(k*Math.PI*2/sides)*r),mul(v,Math.sin(k*Math.PI*2/sides)*r)));this.quad(at(a,r1,j),at(a,r1,j+1),at(b,r2,j+1),at(b,r2,j),[[j/sides,1],[(j+1)/sides,1],[(j+1)/sides,0],[j/sides,0]],color);}}
 commit(engine,scene,material){if(!this.idx.length)return null;const m=createMeshFromData(engine,this.name,new Float32Array(this.p),new Float32Array(this.n),new Uint32Array(this.idx),new Float32Array(this.u),undefined,undefined,new Float32Array(this.c));m.material=material;m.pickable=false;addToScene(scene,m);return m;}
}
