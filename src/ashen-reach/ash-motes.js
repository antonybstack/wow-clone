import {createShaderMaterial,setShaderUniform} from '@babylonjs/lite';
import {Batch,height,bakeLamp,rng} from './geometry.js';
import {ATMOS} from './atmosphere.js';

/**
 * Drifting ash and embers: the warm motes suspended through the whole air volume.
 *
 * This is the one thing the Elden Ring references have at every depth that we had
 * nowhere. In `public/image-references/elden-cliff.jpg` the motes are the densest
 * single element in the frame -- a haze of small warm points from the foreground
 * flowers to the far cliff -- and they do most of the work of making the air read
 * as a *volume* rather than as a gap between a foreground and a backdrop. Haze
 * alone cannot do that, because haze has no parallax: it tints distance but gives
 * the eye nothing to measure distance *against*. A field of small points does,
 * and it costs one draw.
 *
 * Billboarding without a view matrix. Each mote is a quad whose four vertices all
 * carry the *same* world anchor in `position`, with the corner offset in `uv`. The
 * vertex shader rebuilds a camera-facing basis from `cameraPosition` alone --
 * `right = cross(up, viewDir)`, `up = cross(viewDir, right)` -- so no separate view
 * matrix is needed, only the `viewProjection` the batch already wants. `normal` is
 * otherwise dead on a billboard, so its three floats carry per-mote phase, rate and
 * rise span instead.
 *
 * Rise and wrap, rather than bob. The first instinct is a sine bob, but a field of
 * sines reads as a single organism breathing. Instead each mote rises through its
 * own span and wraps: `f = fract(t*rate + phase)`. The wrap would pop, so alpha is
 * `sin(f*PI)` -- zero at birth and zero at the top -- which fades each mote in from
 * nothing and out again, and as a side effect means the population is never all
 * visible at once, so the field looks denser than its triangle count.
 *
 * Additive, depth-tested, no depth write -- the same contract as light-shafts.js
 * and for the same reasons: a mote is lit air, so it may only ever add, and it must
 * still be correctly hidden behind a wall. And as that module's comment warns, this
 * one inlines ATMOS wholesale, so `time` has to be declared or the whole scene
 * blacks out while the stats keep printing correct counts.
 */
/**
 * `count` is the *population*, not the number on screen. The fades cut it hard: only
 * anchors inside the 55 m far fade contribute at all, which is about a fifth of the
 * play rectangle, and `sin(f*PI)` averages 0.64 over the wrap. At 3400 that left
 * roughly 250 motes in frame and the air read empty next to the reference, where the
 * motes are the densest element in the image. 12000 is the same fraction of a bigger
 * population and costs 24000 triangles against the scene's 140799.
 */
export async function createAshMotes(engine,scene,{lights=[],count=12000}={}){
 const batch=new Batch('Ash motes');
 const r=rng(20260921);

 // Anchors fill the play rectangle. Height is biased low with a cubed roll, because
 // the reference's motes crowd the grass line and thin out upward rather than
 // filling a slab evenly -- a uniform roll looked like falling snow.
 for(let i=0;i<count;i++){
  const x=-90+r()*180,z=-95+r()*240;
  const g=height(x,z);
  const lift=0.35+Math.pow(r(),3)*5.4;
  const span=1.1+r()*2.6;
  const anchor=[x,g+lift,z];

  // Lamp irradiance at the anchor rides the brightness, so motes catch fire near a
  // lantern and nearly vanish in the open field. This is what stops the layer from
  // reading as a uniform screen-space overlay: it belongs to the lighting.
  const lamp=lights.length?bakeLamp(x,g+lift,z,lights):0;
  const warm=0.55+Math.min(1.6,lamp)*0.75;

  // Mostly ember, a minority of cold ash. All-warm read as sparks from a fire that
  // is not there; the cold minority makes the warm ones look lit rather than emissive.
  const cold=r()<0.18;
  const tint=cold?[0.56,0.60,0.72]:[1.0,0.58+r()*0.14,0.24+r()*0.14];
  const bright=(cold?0.30:0.62)*(0.45+r()*0.55)*(0.5+warm);

  const size=0.030+Math.pow(r(),2)*0.062;
  const phase=r();
  const rate=0.020+r()*0.055;

  // All four corners share the anchor; the corner offset and the size ride together
  // in uv. Every vertex channel is spoken for -- position is the anchor, normal is
  // phase/rate/span, color is tint and brightness -- so size is packed as the uv's
  // *magnitude* and the corner recovered from its *sign*. Both survive interpolation
  // the way they need to: |uv| is constant across a quad whose corners are all
  // +-size, and sign() at the vertices gives exactly the (+-1,+-1) unit corner the
  // round falloff wants.
  const n=[phase,rate,span];
  const col=[tint[0],tint[1],tint[2],bright];
  batch.quad(anchor,anchor,anchor,anchor,
   [[-size,-size],[size,-size],[size,size],[-size,size]],
   [col,col,col,col],
   [n,n,n,n]);
 }

 const OUT=`struct Out{@builtin(position) position:vec4<f32>,@location(0) p:vec3<f32>,@location(1) color:vec4<f32>,@location(2) corner:vec2<f32>,@location(3) fade:f32};`;
 const mat=createShaderMaterial({name:'Ash motes',
  attributes:['position','normal','uv','color'],
  uniforms:['viewProjection','world','cameraPosition',{name:'time',type:'f32',defaultValue:0}],
  needAlphaBlending:true,blendMode:'additive',backFaceCulling:false,
  vertexSource:`${OUT}
@vertex fn mainVertex(i:VertexInput)->Out{
 var o:Out;
 let anchor=(shaderSystem.world*vec4<f32>(i.position,1.0)).xyz;
 let phase=i.normal.x; let rate=i.normal.y; let span=i.normal.z;
 let t=shaderUniforms.time;
 // Rise and wrap. sin(f*PI) fades the mote in at the bottom and out at the top, so
 // the wrap is invisible and the population is never all on screen at once.
 let f=fract(t*rate+phase);
 var wp=anchor;
 wp.y=wp.y+f*span;
 // Lateral sway at a different, slower rate, so motes do not travel in columns.
 wp.x=wp.x+sin(t*rate*2.3+phase*39.0)*0.32;
 wp.z=wp.z+cos(t*rate*1.9+phase*27.0)*0.32;

 let toCam=shaderSystem.cameraPosition-wp;
 let d=length(toCam);
 let vd=toCam/max(d,0.0001);
 // Degenerates only when looking straight down the world up-axis, which the
 // gameplay camera never does; the epsilon keeps it finite if a free camera tries.
 var right=cross(vec3<f32>(0.0,1.0,0.0),vd);
 let rl=length(right);
 right=select(vec3<f32>(1.0,0.0,0.0),right/max(rl,0.0001),rl>0.001);
 let up=cross(vd,right);

 // Size is |uv|, corner is sign(uv) -- see the packing note on the CPU side.
 let size=abs(i.uv.x);
 let c=vec2<f32>(sign(i.uv.x),sign(i.uv.y));
 // A mote is a fixed world size, but below a pixel it stops being visible at all
 // rather than getting dimmer, which makes the far field flicker as the camera
 // turns. Growing it with distance past 18 m holds a minimum screen footprint.
 let grow=1.0+smoothstep(18.0,90.0,d)*2.2;
 let world=wp+(right*c.x+up*c.y)*size*grow;
 o.position=shaderSystem.viewProjection*vec4<f32>(world,1.0);
 o.p=wp;
 o.color=i.color;
 o.corner=c;
 o.fade=sin(f*3.14159265);
 return o;}`,
  fragmentSource:`${OUT}
${ATMOS}
@fragment fn mainFragment(i:Out)->@location(0) vec4<f32>{
 let rr=dot(i.corner,i.corner);
 if(rr>1.0){discard;}
 // Soft round falloff. Squared rather than linear so each mote has a core and a
 // halo instead of reading as a flat disc.
 let core=(1.0-rr)*(1.0-rr);
 let d=distance(shaderSystem.cameraPosition,i.p);
 var a=i.color.a*core*i.fade;
 // The player walks through these; fade them out before they reach the lens.
 a=a*smoothstep(0.6,3.0,d);
 // And out again at range, so the north overlook does not read as static over the
 // whole basin. The far mesh keeps its own silhouette.
 a=a*(1.0-smoothstep(55.0,120.0,d));
 return vec4<f32>(i.color.rgb,clamp(a,0.0,1.0));
}`});

 const mesh=batch.commit(engine,scene,mat,[]);
 if(mesh)mesh.renderOrder=51;
 return {mesh,mat,triangles:batch.idx.length/3,count,update(t){setShaderUniform(mat,'time',t);}};
}
