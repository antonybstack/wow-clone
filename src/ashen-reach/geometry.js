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
/**
 * Mid-scale swells, north of the lych-gate only.
 *
 * Four passes of lighting work on the mid-distance -- a baked sun shadow, a macro
 * albedo term on the fine earth, a tighter octave on the far mesh at two amplitudes --
 * all measured at or below the noise on the band they were meant to fix. The cause
 * turned out to be in the heightfield rather than in any shader: terrainRaw's own
 * relief is 0.46 m at 14 to 33 m, and distantRelief's is 12 m at 224 to 286 m. There
 * was nothing at all between one metre and two hundred, which is exactly the range a
 * camera standing on the ground reads as landscape.
 *
 * So the ground had no form to light, and that is why every shading fix measured
 * nothing. 4 m peak to trough at 70 to 80 m fixes it at the source: the silhouette
 * varies, and terrainNormal starts to move, so farShade's slope term and shade()'s
 * own cosine come alive. A maximum grade of 1 in 6 is a gentle hill to walk over, and
 * it costs no triangles. Measured on 07-north-overlook the mid-field bands gain 35,
 * 77 and 69 percent of spread; on 10-ridge-west, 16, 80 and 63.
 *
 * The churchyard invariant above is kept intact: the same smoothstep ease climb() uses
 * holds this at exactly zero for z<=40, so height(x,z) south of the lych-gate is still
 * bit-for-bit the original. Building pads read terrainRaw at their own centre, so they
 * stay level at whatever height the swell puts them.
 */
const SWELL_A=2.0;
const swell=(x,z)=>{if(z<=RISE_START)return 0;
 const t=Math.min(1,(z-RISE_START)/(RISE_END-RISE_START));
 return t*t*(3-2*t)*SWELL_A*Math.sin(x*.0742+z*.0513)*Math.sin(z*.0681-x*.0394);};
/**
 * The same mid-scale form as climb()+swell(), as WGSL, for shaders that need the
 * landscape's slope at a fragment rather than at a vertex.
 *
 * The foliage pass bends each alpha-cut blade card toward vertical before shading
 * it, which is what makes a clump read as a rounded mass. But a *constant* vertical
 * meant every blade on the field shared one shading normal, so once the swell gave
 * the ground crests, grass was still lit identically on both of their faces. Feeding
 * this slope in instead costs four trig calls and no memory at all -- no vertex
 * channel (instanceColor is full: rgb tint, a lamp) and no shadow texture, because
 * the caster here is the terrain itself and the terrain is a closed-form function.
 *
 * Only the mid-scale terms are included. terrainRaw's 0.30/0.16 octaves live at 14
 * to 33 m, which is below a grass clump and would read as noise rather than form.
 * Derivatives are of climb()+swell() exactly, so this is (0,1,0) wherever they are
 * flat -- in particular for z<=40, leaving the churchyard bit-for-bit unchanged.
 *
 * This does NOT cast: trees and buildings still drop no shadow on grass. That needs
 * a texture and is a separate pass.
 */
const SHADE_RELIEF=2.2;
export const TERRAIN_SLOPE_WGSL=`
fn terrainSlope(x:f32,z:f32)->vec2<f32>{
 if(z<=${RISE_START}.0){return vec2<f32>(0.0,0.0);}
 let t=min(1.0,(z-${RISE_START}.0)/${RISE_END-RISE_START}.0);
 let e=t*t*(3.0-2.0*t);
 let de=6.0*t*(1.0-t)/${RISE_END-RISE_START}.0;
 let a=x*0.0742+z*0.0513;
 let b=z*0.0681-x*0.0394;
 let sa=sin(a);let ca=cos(a);let sb=sin(b);let cb=cos(b);
 let dx=e*${SWELL_A.toFixed(1)}*(0.0742*ca*sb-0.0394*sa*cb);
 let dz=de*${SWELL_A.toFixed(1)}*sa*sb+e*${SWELL_A.toFixed(1)}*(0.0513*ca*sb+0.0681*sa*cb)+de*${RISE_HEIGHT.toFixed(1)};
 return vec2<f32>(dx,dz);
}
fn terrainNormalWgsl(x:f32,z:f32)->vec3<f32>{
 // Slope is exaggerated for shading only. The true grade tops out at 1 in 4.7, which
 // tilts the normal 12 deg -- real, but a gentle read across a hundred metres of
 // haze. SHADE_RELIEF opens that to 25 deg, the way a normal-map intensity does,
 // without touching the geometry or the blade-shape bend the weight below controls.
 let g=terrainSlope(x,z)*${SHADE_RELIEF.toFixed(1)};
 return normalize(vec3<f32>(-g.x,1.0,-g.y));
}
`;

const terrainRaw=(x,z)=>.30*Math.sin(x*.19+z*.13)+.16*Math.sin(z*.45+x*.11)+.006*z+1.6*Math.exp(-((x+20)**2+(z-30)**2)/260)+climb(z)+swell(x,z);

/** Flat pads for Milestone 2's Hollowmere buildings: {x,z,w,d} in world space. height() blends
 *  each pad into the sloped terrain, so a builder can read groundHeight(x,z) inside a pad and get
 *  a level floor. All pads sit north of the lych-gate and never touch the churchyard invariant. */
export const buildingPads=[
 {x:-7.4,z:82,w:8,d:8},{x:7.4,z:82,w:8,d:8},
 {x:-8.2,z:98,w:9,d:8},{x:8.2,z:98,w:9,d:8},
 {x:-7.4,z:114,w:8,d:8},{x:7.4,z:114,w:8,d:8},
 {x:-9.0,z:128,w:10,d:9},{x:9.0,z:128,w:10,d:8},
 {x:0,z:136,w:16,d:11},
 // Infill sheds (appended so existing [0..8] indices stay valid for townsfolk).
 {x:-7.3,z:90,w:6.2,d:6.4},{x:7.3,z:90,w:6.2,d:6.4},
 {x:-7.3,z:106,w:6.2,d:6.4},{x:7.3,z:106,w:6.2,d:6.4},
];
const PAD_MARGIN=3;
/** Basin + rim only outside the playable rectangle. Zero inside x∈[-90,90], z∈[-95,145]
 *  (and therefore on the whole churchyard) so height() stays bit-identical in-bounds.
 *  A shallow dip just past the clamp, then a rise, so high-zoom cameras see a
 *  skyline of hills rather than the rim of a tiled disc.
 *
 *  The rim is deliberately *lower than the mountain rings* horizon.js draws. The
 *  first pass used 92 m arriving by d≈120, which measured out to a 25.3° silhouette
 *  from the north-overlook camera against 24.5° for the tallest ring and a 17.5°
 *  top-of-frame: the bowl wall swallowed the whole skyline and every pixel of sky,
 *  so the northward vistas read as a featureless fogged basin. Half the height
 *  arriving twice as far out puts the earth silhouette under 8°, which leaves the
 *  ridgelines and the sky above it in the order the references layer them:
 *  ground, foothills, ridge, sky. */
function distantRelief(x,z){
 const dx=Math.max(0,Math.abs(x)-90),dz=Math.max(0,z>145?z-145:z<-95?-95-z:0);
 if(dx===0&&dz===0)return 0;
 const d=Math.hypot(dx,dz);
 const t=Math.min(1,d/32),s=t*t*(3-2*t);
 const rim=46/(1+Math.exp(-(d-210)/60));
 const valley=-7*Math.exp(-((d-48)/24)*((d-48)/24));
 const peak=(px,pz,h,w)=>h*Math.exp(-((x-px)**2+(z-pz)**2)/w);
 // Unequal foothill spurs and intervening cuts give the newly continuous
 // outer ground readable form between the playable edge and the distant
 // mountain curtain. Their centres and widths are deliberately irregular;
 // an even sinusoidal ring reads as another cardboard band from above.
 const foothills=
   peak(-139,-29,9,1600)+peak(-170,91,7,2200)
  +peak(119,-52,7,1300)+peak(151,73,11,2100)
  +peak(-40,-159,8,1700)+peak(51,205,10,2300)
  -peak(-104,23,6,900)-peak(89,114,5,1050)
  -peak(12,-132,5,850);
 // The first outer slope otherwise rises as a single smooth lit ramp between
 // the playable edge and the trees. Small, crossing swells put light and shade
 // on the ground itself. Fade them in past the seam and out before coarse far
 // cells, so no playable height or distant ridge silhouette changes.
 const roughIn=Math.min(1,Math.max(0,(d-8)/24));
 const roughOut=Math.min(1,Math.max(0,(230-d)/55));
 const rough=roughIn*roughIn*(3-2*roughIn)*roughOut*roughOut*(3-2*roughOut)*(
   1.5*Math.sin(x*.095+z*.048)*Math.sin(z*.089-x*.029)
  +.7*Math.sin(x*.053-z*.105));
 return s*(valley+rim
  +peak(210,24,42,5200)+peak(-200,58,36,4600)
  +peak(28,-215,34,5800)+peak(-36,235,26,4800)
  +peak(160,-90,22,3600)
  +foothills+rough
  +7*Math.sin(x*.028)+5*Math.sin(z*.022+x*.018));
}
export function height(x,z){
 let h=terrainRaw(x,z);
 for(const p of buildingPads){
  const dx=Math.max(Math.abs(x-p.x)-p.w/2,0),dz=Math.max(Math.abs(z-p.z)-p.d/2,0);
  const dist=Math.hypot(dx,dz);
  if(dist<PAD_MARGIN){const t=1-dist/PAD_MARGIN,s=t*t*(3-2*t);h=h*(1-s)+terrainRaw(p.x,p.z)*s;}
 }
 return h+distantRelief(x,z);
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
 /** `color2`, when given, is the colour at the `b` end, so a tube can fade along its own length
  *  (e.g. a flame lick bright at its base and dark at its tip) via per-vertex colour rather than
  *  a blend mode. Omitting it reproduces the old single-colour tube exactly. */
 tube(a,b,r1,r2,color=[1,1,1,0],sides=5,color2=null){const c2=color2||color;const d=norm(sub(b,a));const u=norm(cross(d,Math.abs(d[1])>.95?[1,0,0]:[0,1,0])),v=cross(d,u);for(let j=0;j<sides;j++){const at=(p,r,k)=>add(p,add(mul(u,Math.cos(k*Math.PI*2/sides)*r),mul(v,Math.sin(k*Math.PI*2/sides)*r)));this.quad(at(a,r1,j),at(a,r1,j+1),at(b,r2,j+1),at(b,r2,j),[[j/sides,1],[(j+1)/sides,1],[(j+1)/sides,0],[j/sides,0]],[color,color,c2,c2]);}}
 /** Bakes static lamp irradiance into a uv2 vertex attribute so the fragment shader adds a flat
  *  O(1) term regardless of how many lamps are registered, instead of looping lamps per-fragment.
  *  `lights` is [{position:[x,y,z],strength,falloff=.5,radius}]; the sum uses the same inverse-square
  *  falloff the shader used to compute per-fragment for the two original hardcoded lamps.
  *
  *  M7a: `radius`, when given, multiplies that light's term by a windowing function that reaches
  *  exactly 0 at `radius` world units, instead of the bare inverse-square term trailing off forever.
  *  Without this, Hollowmere's many lamps (plus the gate-tower halos) each contribute everywhere,
  *  and their tails sum into a pedestal -- a floor of light between lamps that never goes dark --
  *  which is why the baked profile along the street measured a fixture-to-fixture peak:trough
  *  ratio of only 1.0-1.4x (see scripts/ashen-reach/measure-lamp-profile.mjs). The window is
  *  `(1-(dist/radius)^2)^2` for dist<radius, 0 beyond it: derivative is 0 at both dist=0 and
  *  dist=radius, so it introduces no visible ring or hard edge when Gouraud-interpolated across
  *  the subdivided corridor ground (the standard "smooth windowing" punctual-light falloff, e.g.
  *  Lagarde & de Rousiers, "Moving Frostbite to PBR").
  *
  *  Gated by the vertex's own world z, not by light position: for z<=40 (the churchyard boundary
  *  already used throughout this file and materials.js) the loop below is byte-for-byte the
  *  original unwindowed formula, regardless of which lights are in range or whether they carry a
  *  radius, so the churchyard's baked values cannot move. Only z>40 vertices (Hollowmere) ever see
  *  the window applied. This is required because the bake runs before the shader's own
  *  `lampGate=smoothstep(40,55,z)` ever executes -- that gate protects the shader-side knee/colour,
  *  not values baked here. */
 commit(engine,scene,material,lights=[]){if(!this.idx.length)return null;const vcount=this.p.length/3;const uv2=new Float32Array(vcount*2);if(lights.length)for(let i=0;i<vcount;i++){const x=this.p[i*3],y=this.p[i*3+1],z=this.p[i*3+2];uv2[i*2]=bakeLamp(x,y,z,lights);}const m=createMeshFromData(engine,this.name,new Float32Array(this.p),new Float32Array(this.n),new Uint32Array(this.idx),new Float32Array(this.u),uv2,undefined,new Float32Array(this.c));m.material=material;m.pickable=false;addToScene(scene,m);return m;}
}

/** One vertex of the M1/M7a baked lamp term. `Batch.commit` writes this into uv2.x; the
 *  measure-lamp-profile script imports it so a bake change cannot silently diverge from the
 *  printed profile. `applyWindow:false` reproduces the pre-M7a unwindowed sum (used only by
 *  that script's before-column). Default matches commit(): window when the vertex is z>40. */
export function bakeLamp(x,y,z,lights,applyWindow){
 const windowed=applyWindow??(z>40);
 let lamp=0;
 for(const L of lights){
  const dx=x-L.position[0],dy=y-L.position[1],dz=z-L.position[2],f=(L.falloff??.5),dist=Math.sqrt(dx*dx+dy*dy+dz*dz),d=dist*f;
  let term=L.strength/(1+d*d);
  if(windowed&&L.radius!=null){const t=Math.min(1,dist/L.radius),w=(1-t*t)*(1-t*t);term*=w;}
  lamp+=term;
 }
 return lamp;
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

/** A soft radial gradient fan: bright at `center`, fading to `colorRim` by radius `r` in the plane
 *  spanned by `axis1`/`axis2`. No real transparency exists in this material system, so this fakes a
 *  glow puddle (light spilled on a wall or the ground near a fixture) with per-vertex colour falloff
 *  on ordinary opaque triangles instead of a blend mode. Cheap: `sides` triangles, no quads. */
export function radialGlow(batch,center,axis1,axis2,r,colorCenter,colorRim,sides=8){
 for(let k=0;k<sides;k++){
  const a=k*Math.PI*2/sides,b=(k+1)*Math.PI*2/sides;
  const p=add(center,add(mul(axis1,Math.cos(a)*r),mul(axis2,Math.sin(a)*r)));
  const q=add(center,add(mul(axis1,Math.cos(b)*r),mul(axis2,Math.sin(b)*r)));
  batch.tri(center,p,q,undefined,[colorCenter,colorRim,colorRim]);
 }
}

// `groundGlow` (M3's ground-plane decal: a bright core disc tapering to a dim warm edge) was
// removed in M3b. It fixed M2b's black-rim "mud puddle" defect but replaced it with a new one:
// an opaque decal with no alpha blending always has a visible hard edge against the ground it
// sits on, however the colours at that edge are chosen — M3's version read as hard-edged orange
// lava splotches (see the M3 status-log entry). Ground-level lamp pools are now produced by the
// mechanism that already existed for exactly this: `Batch.commit`'s baked per-vertex lamp
// irradiance (the `uv2`/`lamp` term materials.js already samples), applied to a ground mesh
// subdivided finely enough under Hollowmere's street to resolve a smooth radial pool with no
// decal geometry at all (see scene.js's ground loop and its `CORRIDOR_SUB` subdivision).
