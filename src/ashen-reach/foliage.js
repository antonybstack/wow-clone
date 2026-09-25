/**
 * GPU-instanced foliage (FromSoftware / UE Landscape Grass pattern on Lite).
 *
 * One atlas, a few clump prototypes, a density field, then 8 m tiles streamed
 * around the player (near clumps + far cards, thinned with distance).
 * Vertex wind and player displacement live in the shader.
 */
import {
  createShaderMaterial,loadTexture2D,setShaderTexture,setShaderUniform,
  setThinInstances,setThinInstanceColors,setThinInstanceCount,
  enableThinInstanceDynamicDrawCount,
} from '@babylonjs/lite';
import {Batch,height,terrainNormal,rng,bakeLamp,add,sub,TERRAIN_SLOPE_WGSL} from './geometry.js';
import {ATMOS} from './atmosphere.js';
import {SUN_SHADOW_UNIFORMS,SUN_SHADOW_SAMPLERS,SUN_SHADOW_WGSL,bindSunReceiver} from './sun-shadows.js';

import {LOCAL_LIGHT_UNIFORMS,LOCAL_LIGHT_SAMPLERS,LOCAL_LIGHT_WGSL} from './local-light-shared.js';
import {bindLocalReceiver} from './local-lights.js';
import {FOLIAGE_LOD_WGSL,NEAR_RADIUS,REPACK_DISTANCE,plantHash,removalRadius,packingRadius} from './foliage-lod.js';
import {pathX} from './geometry.js';
import {pathVegetation} from './world-composition.js';
import {nearestRegionRoute,regionSiteDistance} from './region-layout.js';
import {grassCardLayout} from './foliage-card-layout.js';

const ATLAS='/ashen-reach/foliage-atlas.png';
const cell=(cx,cy)=>{const s=.5,p=.014;return {u0:cx*s+p,v0:cy*s+p,u1:(cx+1)*s-p,v1:(cy+1)*s-p};};
const UV={meadow:cell(0,0),dry:cell(1,0),plant:cell(0,1),fern:cell(1,1)};

const OUT=`struct Out{@builtin(position) position:vec4<f32>,@location(0) p:vec3<f32>,@location(1) uv:vec2<f32>,@location(2) color:vec4<f32>,@location(3) normal:vec3<f32>,@location(4) lamp:f32};`;

/**
 * Shared by the foliage cards and the flowers below, so the wind gust, the flutter
 * and the player-push can never drift apart between the two materials -- a flower
 * standing still in grass that is bending is the kind of thing the eye catches
 * instantly, and it would be invisible in any diff of two separate shader strings.
 */
const CARD_VERTEX=`${OUT}
${FOLIAGE_LOD_WGSL}
@vertex fn mainVertex(i:VertexInput)->Out{
 var o:Out;
 let instanceWorld=mat4x4<f32>(i.world0,i.world1,i.world2,i.world3);
 let finalWorld=shaderSystem.world*instanceWorld;
 let root=finalWorld[3].xyz;
 let plantDistance=distance(root.xz,shaderUniforms.playerPosition.xz);
 let lod=shaderUniforms.foliageLod;
 let end=foliageRemovalRadius(foliagePlantHash(root.xz),lod.x,lod.y,lod.z);
 let detail=floor(i.color.a*.5);
 let scale=foliageScale(plantDistance,end)*mix(1.0,foliageDetailScale(plantDistance),detail);
 var wp=(finalWorld*vec4<f32>(i.position,1.0)).xyz;
 let h=i.color.a-detail*2.0;
 let gust=sin(shaderUniforms.time*1.12+wp.x*0.51+wp.z*0.39);
 let gust2=sin(shaderUniforms.time*0.34+wp.x*0.11-wp.z*0.17);
 let flutter=sin(shaderUniforms.time*6.8+root.x*2.7+root.z*2.1)*foliageFlutterAttenuation(distance(root,shaderSystem.cameraPosition));
 let h2=h*h;
 wp.x+=(gust*0.17+gust2*0.11+flutter*0.028)*h2;
 wp.z+=(cos(shaderUniforms.time*0.88+wp.x*0.37)*0.12+flutter*0.02)*h2;
 let toP=wp.xz-shaderUniforms.playerPosition.xz;
 let pDist=length(toP);
 let reach=shaderUniforms.playerRadius;
 let push=h*smoothstep(reach,reach*0.12,pDist)*1.25;
 let dir=toP/max(pDist,0.001);
 wp.x+=dir.x*push;
 wp.z+=dir.y*push;
 wp.y-=push*0.22;
 // Scale every displacement around its planted root, including wind/push.
 wp=root+(wp-root)*scale;
 o.position=shaderSystem.viewProjection*vec4<f32>(wp,1.0);
 o.p=wp;
 o.uv=i.uv;
 o.color=vec4<f32>(i.color.rgb*i.instanceColor.rgb,h);
 o.normal=normalize((finalWorld*vec4<f32>(i.normal,0.0)).xyz);
 o.lamp=i.instanceColor.a;
 return o;
}`;

async function createFoliageMaterial(engine,tex,lod=[28,.72,1,4]){
 const mat=createShaderMaterial({
  name:'Ashen foliage',
  attributes:['position','normal','uv','color','uv2'],
  uniforms:['viewProjection','world','cameraPosition','view',...SUN_SHADOW_UNIFORMS,...LOCAL_LIGHT_UNIFORMS,
   {name:'time',type:'f32',defaultValue:0},
   {name:'foliageLod',type:'vec4<f32>',defaultValue:lod},
   {name:'playerPosition',type:'vec3<f32>',defaultValue:[0,0,0]},
   {name:'playerRadius',type:'f32',defaultValue:1.2},
   {name:'firePosition',type:'vec3<f32>',defaultValue:[0,0,0]},
   {name:'fireStrength',type:'f32',defaultValue:0},
   {name:'handFirePosition',type:'vec3<f32>',defaultValue:[0,0,0]},
   {name:'handFireStrength',type:'f32',defaultValue:0},
   {name:'lavaPosition',type:'vec3<f32>',defaultValue:[0,0,0]},
   {name:'lavaStrength',type:'f32',defaultValue:0},
  ],
  samplers:['albedo',...SUN_SHADOW_SAMPLERS,...LOCAL_LIGHT_SAMPLERS],
  backFaceCulling:false,
  needAlphaTesting:true,
  vertexSource:CARD_VERTEX,
  fragmentSource:`${OUT}
${ATMOS} ${SUN_SHADOW_WGSL} ${LOCAL_LIGHT_WGSL}
${TERRAIN_SLOPE_WGSL}
@fragment fn mainFragment(i:Out)->@location(0) vec4<f32>{
 var t=textureSample(albedo,albedoSampler,i.uv);
 if(t.a<0.48 || (t.r>0.88 && t.g<0.16)){discard;}
 // Blades are alpha-cut cards, so their authored normal is the card's, not the
 // plant's. Bending it toward vertical before shading keeps a clump reading as a
 // soft rounded mass under the key instead of as a row of flat billboards, and
 // the transmission term fakes the light that passes *through* a backlit leaf --
 // which, with the sun buried at the horizon, is most of what a grass field does
 // in the reference stills.
 let raw=normalize(i.normal+vec3<f32>(0.00001));
 // Bend toward the *ground's* normal rather than a constant vertical, so a clump
 // on the north face of a swell reads differently from one on the south face. Flat
 // ground gives (0,1,0) and the original shading back exactly.
 let gn=terrainNormalWgsl(i.p.x,i.p.z);
 let nn=normalize(i.normal+gn*0.9+vec3<f32>(0.00001));
 let trans=pow(max(-dot(raw,SUN_DIR),0.0),2.2);
 let visibility=sunVisibility(i.p,gn);
 var light=shade(nn,i.p,shaderSystem.cameraPosition,0.92,visibility)+SUN_COLOR*trans*visibility*0.55;
 let lamp=i.lamp;
 var lampEff=lamp;
 if(lamp>1.4){lampEff=1.4+(1.0-exp(-(lamp-1.4)));}
 let lampColor=vec3<f32>(1.0,0.58,0.26);
 let fire=shaderUniforms.fireStrength/(1.0+pow(distance(i.p,shaderUniforms.firePosition)*0.85,2.0));
 let handFire=shaderUniforms.handFireStrength/(1.0+pow(distance(i.p,shaderUniforms.handFirePosition)*1.0,2.0));
 let lava=shaderUniforms.lavaStrength/(1.0+pow(distance(i.p,shaderUniforms.lavaPosition)*0.7,2.0));
 light=light+lampColor*lampEff+localIrradiance(i.p,nn)+vec3<f32>(1.0,0.28,0.045)*(fire+handFire+lava);
 var c=srgbToLinear(t.rgb)*i.color.rgb*light;
 let ng=smoothstep(40.0,55.0,i.p.z);
 c=mix(c,c*vec3<f32>(0.92,0.86,0.95),ng);
 c=aerial(c,i.p,shaderSystem.cameraPosition);
 return vec4<f32>(c,1.0);
}`,
 });
 bindSunReceiver(engine,mat);bindLocalReceiver(engine,mat);setShaderTexture(mat,'albedo',tex);
 return mat;
}

/**
 * Wildflowers, as geometry rather than atlas cards.
 *
 * `public/image-references/elden-cliff.jpg` settles what the grass field is missing.
 * Crop its foreground and the meadow is not green: it is a drift of white umbels with
 * violet spikes, orange clusters and pink through it, and those flowers are the only
 * saturated hue in an otherwise ash-grey frame. Our field has exactly one hue, and the
 * broadleaf atlas cell's pale pink flowers cannot supply another -- the instance tint
 * multiplies the whole card, so anything painted on it comes out the same green as the
 * leaves around it.
 *
 * The atlas cannot help and must not be touched. `foliage-atlas.png` is a symlink into
 * the main checkout, shared with every other worktree, and the plant and fern cells are
 * photographic: the builder only reproduces them when handed the original photos with
 * --photo, and running it without them would silently replace the shipped atlas with
 * the procedural fallback. So flowers get their own material with no sampler at all.
 *
 * That turns out to be the better shape anyway. A floret is a centimetre or two across;
 * at every distance it is worth a handful of pixels, so a texture buys nothing that the
 * silhouette does not already give, and dropping the alpha test lets these draw opaque.
 * Hue comes from the instance colour, which is what we wanted the atlas to allow.
 *
 * `uv.x` is free without a sampler, so it carries petal-ness: the stem reads a fixed
 * green and only the florets take the instance hue, which is why a violet spike does
 * not come with a violet stalk. `uv.y` carries a length gradient for shading.
 */
async function createFlowerMaterial(engine){
 const mat=createShaderMaterial({
  name:'Ashen flowers',samplers:[...SUN_SHADOW_SAMPLERS,...LOCAL_LIGHT_SAMPLERS],
  attributes:['position','normal','uv','color','uv2'],
  uniforms:['viewProjection','world','cameraPosition','view',...SUN_SHADOW_UNIFORMS,...LOCAL_LIGHT_UNIFORMS,
   {name:'time',type:'f32',defaultValue:0},
   {name:'foliageLod',type:'vec4<f32>',defaultValue:[28,.93,1,4]},
   {name:'playerPosition',type:'vec3<f32>',defaultValue:[0,0,0]},
   {name:'playerRadius',type:'f32',defaultValue:1.2},
   {name:'firePosition',type:'vec3<f32>',defaultValue:[0,0,0]},
   {name:'fireStrength',type:'f32',defaultValue:0},
   {name:'handFirePosition',type:'vec3<f32>',defaultValue:[0,0,0]},
   {name:'handFireStrength',type:'f32',defaultValue:0},
   {name:'lavaPosition',type:'vec3<f32>',defaultValue:[0,0,0]},
   {name:'lavaStrength',type:'f32',defaultValue:0},
  ],
  backFaceCulling:false,
  vertexSource:CARD_VERTEX,
  fragmentSource:`${OUT}
${ATMOS} ${SUN_SHADOW_WGSL} ${LOCAL_LIGHT_WGSL}
${TERRAIN_SLOPE_WGSL}
@fragment fn mainFragment(i:Out)->@location(0) vec4<f32>{
 let petal=i.uv.x;
 // The stem keeps its own green whatever hue the instance carries, so a violet
 // spike is not a violet stalk. petal=0 on stem vertices, 1 on florets.
 let stem=vec3<f32>(0.21,0.27,0.11);
 let base=mix(stem,i.color.rgb,petal);
 let gn=terrainNormalWgsl(i.p.x,i.p.z);
 let raw=normalize(i.normal+vec3<f32>(0.00001));
 let nn=normalize(i.normal+gn*0.7+vec3<f32>(0.00001));
 // A petal is one cell thick and the sun is on the horizon, so most of what reaches
 // the eye passed *through* it. The exponent is lower and the weight far higher than
 // the grass blade's -- that is the whole reason white flowers glow at dusk.
 let trans=pow(max(-dot(raw,SUN_DIR),0.0),1.5);
 // The stem barely gets this. At 0.35 it picked up enough warm sun to read as a bright
 // yellow-green stick hovering in dark grass, which is what the west-treeline shot was
 // actually showing rather than any flower.
 let visibility=sunVisibility(i.p,gn);
 var light=shade(nn,i.p,shaderSystem.cameraPosition,0.92,visibility)+SUN_COLOR*trans*visibility*(0.08+petal*0.62);
 var lampEff=i.lamp;
 if(i.lamp>1.4){lampEff=1.4+(1.0-exp(-(i.lamp-1.4)));}
 let fire=shaderUniforms.fireStrength/(1.0+pow(distance(i.p,shaderUniforms.firePosition)*0.85,2.0));
 let handFire=shaderUniforms.handFireStrength/(1.0+pow(distance(i.p,shaderUniforms.handFirePosition)*1.0,2.0));
 let lava=shaderUniforms.lavaStrength/(1.0+pow(distance(i.p,shaderUniforms.lavaPosition)*0.7,2.0));
 light=light+vec3<f32>(1.0,0.58,0.26)*lampEff+localIrradiance(i.p,nn)+vec3<f32>(1.0,0.28,0.045)*(fire+handFire+lava);
 var c=base*light;
 // The same northward cooling the grass takes, so the drifts belong to Hollowmere
 // rather than sitting on top of it.
 c=mix(c,c*vec3<f32>(0.92,0.86,0.95),smoothstep(40.0,55.0,i.p.z));
 c=aerial(c,i.p,shaderSystem.cameraPosition);
 return vec4<f32>(c,1.0);
}`,
 });
 bindLocalReceiver(engine,mat);return bindSunReceiver(engine,mat);
}

/**
 * A floret is a diamond, not a hexagon or a card. Two triangles is the whole budget
 * that survives multiplying by a thousand instances, and rotating the quad 45 degrees
 * costs nothing while removing the one thing a square silhouette gives away. Florets
 * overlap inside a head anyway, so what the eye reads is the cluster's outline.
 */
function floret(b,cx,cy,cz,r,ax,az,col,grad){
 const ux=ax*r, uz=az*r;
 b.quad(
  [cx-ux,cy,cz-uz],[cx,cy+r,cz],[cx+ux,cy,cz+uz],[cx,cy-r,cz],
  [[1,grad],[1,grad],[1,grad],[1,grad]],
  [col,col,col,col],
  [[-az,0.55,ax],[-az,0.55,ax],[-az,0.55,ax],[-az,0.55,ax]]);
}

/**
 * Two crossed quads, not one. A single-plane stem vanishes completely when the camera
 * catches it edge-on, and the west-treeline shot was full of flower heads apparently
 * floating unsupported in the grass. Two extra triangles per instance buys that back.
 */
function stalk(b,h,w,lean){
 const top=[lean*h,h,lean*h*0.4];
 // uv.x=0 marks this as stem, so the fragment shader keeps it green. color.a is the
 // wind weight: rooted at the bottom, full travel at the head.
 const uv=[[0,0],[0,0],[0,1],[0,1]];
 const col=[[1,1,1,0],[1,1,1,0],[1,1,1,0.92],[1,1,1,0.92]];
 b.quad([-w,0,0],[w,0,0],[top[0]+w*0.45,top[1],top[2]],[top[0]-w*0.45,top[1],top[2]],uv,col,[0,0,1]);
 b.quad([0,0,-w],[0,0,w],[top[0],top[1],top[2]+w*0.45],[top[0],top[1],top[2]-w*0.45],uv,col,[1,0,0]);
 return top;
}

/** Cow-parsley plate: florets spread on a shallow dome, read mostly from above. */
function flowerUmbel(name,lod){
 const b=new Batch(name);
 // A 17 cm plate is ~70 px at three metres, so seven 2 cm florets spread across it read
 // as specks, not as a flower. Fewer, wider florets over a tighter radius fill it.
 //
 // The radius then has to come back in. Florets are vertical diamonds -- the right
 // choice, since the gameplay camera looks down at the grass and a truly horizontal
 // plate would be edge-on -- but spread across 14 cm of width and only 7 cm of height
 // the head read as a white horizontal dash. Half the radius, with the ring lifted
 // into a dome, gives a rounded mass at the same floret count.
 // The far LOD was authored with a *bigger* floret than the near one -- the instinct
 // that a distant thing needs help to stay visible, applied to the one layer that did
 // not need it. It made distant flowers weigh more on screen than nearby ones.
 const n=lod?4:8, R=lod?0.030:0.040, RV=lod?0.050:0.070, r=lod?0.028:0.033;
 const top=stalk(b,lod?0.40:0.46,0.006,0.05);
 for(let k=0;k<n;k++){
  // Centres on a dome rather than a ring. A ring is horizontal, and the gameplay
  // camera looks down the slope at roughly 40 deg, which foreshortens the vertical
  // by a third -- so a head that measured 16 by 10 cm arrived on screen closer to
  // 3:1 and read as a white dash. The dome is authored *taller* than it is wide so
  // that it lands round after the foreshortening, not before it.
  const u=(k+0.5)/n, phi=Math.acos(1-u*0.9), a=k*2.399963;
  const sp=Math.sin(phi);
  floret(b,top[0]+sp*Math.cos(a)*R,top[1]+Math.cos(phi)*RV,top[2]+sp*Math.sin(a)*R,
   r,Math.cos(a),Math.sin(a),[1,1,1,0.95],0.85);
 }
 return b;
}

/** Spire: florets climbing the stalk, alternating planes so it reads from any yaw. */
function flowerSpike(name,lod){
 const b=new Batch(name);
 const n=lod?4:6, r=lod?0.026:0.030, h=lod?0.34:0.42;
 const top=stalk(b,h,0.006,-0.07);
 for(let k=0;k<n;k++){
  const t=0.38+0.62*(k/(n-1||1));
  const a=k*1.9+(k%2)*1.57;
  const side=((k%2)?1:-1)*0.022;
  floret(b,top[0]*t+Math.cos(a)*side,h*t,top[2]*t+Math.sin(a)*side,
   r*(1.15-t*0.4),Math.cos(a),Math.sin(a),[1,1,1,0.55+t*0.45],0.3+t*0.7);
 }
 return b;
}

/**
 * Drifts, not a sprinkle. A uniform roll over the whole meadow reads as noise; the
 * reference's flowers arrive in bands that thin to nothing between. Two low-frequency
 * sines beaten against each other give the bands, and the cut at 0.18 is what makes
 * the gaps actually empty rather than merely sparser.
 *
 * The periods matter more than the shape. The first pass used frequencies around 0.07,
 * which put the bands 45 m across -- wider than the 28 m the near pool reaches, so the
 * camera always stood inside a single band and the field came out even and thin, with
 * the drifts invisible. At 0.19 the bands are 15-20 m and a view contains two or three
 * of them, which is what actually reads as drifting.
 */
const drift=(x,z)=>{
 const v=Math.sin(x*0.19+z*0.13)*Math.sin(z*0.17-x*0.11)+0.55*Math.sin(x*0.33-z*0.29);
 // Cut, shape and gain were picked by measuring the mask over the whole meadow rather
 // than by eye. The first pass cut at 0.18 and squared, which left 34% of the ground
 // carrying anything and only 6% dense -- so a camera almost never stood in a drift and
 // the field read evenly thin, which is the exact opposite of the intent. Cutting at
 // -0.35 with a 1.5 power covers 60% and saturates 18%, keeping 40% genuinely empty.
 const t=Math.max(0,(v+0.35)/1.9);
 return Math.pow(t,1.5)*2.6;
};

function commitProto(engine,scene,batch,material){
 const mesh=batch.commit(engine,scene,material,[]);
 if(!mesh)return null;
 // Lite can release CPU vertex arrays after upload. Retain only the small
 // shared-card contract needed to verify the two grass LODs in a live build.
 if(/^(Grass|Moor) /.test(mesh.name))mesh.foliageLayout={positions:batch.p.slice(0,36),normals:batch.n.slice(0,36),uvs:batch.u.slice(0,24),colors:batch.c.slice(0,48),detailAlpha:batch.c.slice(48).filter((_,i)=>i%4===3)};
 mesh.pickable=false;
 return mesh;
}

function clumpCards(name,uvs,opt){
 const b=new Batch(name);
 const count=opt.cards,H=opt.height,W=opt.width,spread=opt.spread??0.12;
 for(let k=0;k<count;k++){
  const shared=opt.shared?grassCardLayout(k,H,W):null;
  const a=shared?.angle??(opt.cross?k*Math.PI/2:(k/count)*Math.PI+ (k%2)*0.13);
  const uv=uvs[k%uvs.length];
  const h=shared?.height??H*(opt.cross?1:0.78+(k%5)*0.05);
  const w=shared?.width??W*(opt.cross?1.05:0.84+(k%3)*0.07);
  const ox=shared?0:Math.cos(a*2)*spread*(opt.cross?0:0.55);
  const oz=shared?0:Math.sin(a*2)*spread*(opt.cross?0:0.55);
  const rootWeight=shared?.rootWeight??0,tipWeight=shared?.tipWeight??1;
  const ca=Math.cos(a),sa=Math.sin(a);
  b.quad(
   [-ca*w+ox,0,-sa*w+oz],[ca*w+ox,0,sa*w+oz],[ca*w+ox,h,sa*w+oz],[-ca*w+ox,h,-sa*w+oz],
   [[uv.u0,uv.v1],[uv.u1,uv.v1],[uv.u1,uv.v0],[uv.u0,uv.v0]],
   [[1,1,1,rootWeight],[1,1,1,rootWeight],[1,1,1,tipWeight],[1,1,1,tipWeight]],
   [0,1,0],
  );
 }
 return b;
}

function brackenTuft(name,uv,lod){
 const b=new Batch(name);
 const fronds=lod?3:6, segs=lod?2:3, size=lod?1.05:0.92;
 for(let f=0;f<fronds;f++){
  const a=f*(Math.PI*2/fronds)+f*0.11, L=size*(0.75+(f%3)*0.08);
  const point=t=>[Math.cos(a)*L*t, L*(1.72*t-1.22*t*t)+0.02, Math.sin(a)*L*t];
  const side=[-Math.sin(a)*L*0.22,0,Math.cos(a)*L*0.22];
  for(let k=0;k<segs;k++){
   const t=k/segs,t1=(k+1)/segs,p=point(t),q=point(t1);
   const v0=uv.v1-(uv.v1-uv.v0)*t, v1=uv.v1-(uv.v1-uv.v0)*t1;
   b.quad(sub(p,side),add(p,side),add(q,side),sub(q,side),
    [[uv.u0,v0],[uv.u1,v0],[uv.u1,v1],[uv.u0,v1]],
    [[1,1,1,t],[1,1,1,t],[1,1,1,t1],[1,1,1,t1]],
    [0,1,0]);
  }
 }
 return b;
}

function writeMatrix(out,o,x,y,z,yaw,sx,sy,sz){
 const c=Math.cos(yaw),s=Math.sin(yaw);
 out[o]=c*sx; out[o+1]=0; out[o+2]=-s*sx; out[o+3]=0;
 out[o+4]=0; out[o+5]=sy; out[o+6]=0; out[o+7]=0;
 out[o+8]=s*sz; out[o+9]=0; out[o+10]=c*sz; out[o+11]=0;
 out[o+12]=x; out[o+13]=y; out[o+14]=z; out[o+15]=1;
}

function place(density,lights,opt){
 const roll=rng(opt.seed);
 const mats=[],cols=[];
 const {minX,maxX,minZ,maxZ,spacing,scale,yScale,tint,slopeMin=0.58,densityScale=1,sink=0.035,skip,mask,palette,footprint=.6}=opt;
 for(let z=minZ;z<maxZ;z+=spacing){
  for(let x=minX;x<maxX;x+=spacing){
   const gx=x+roll()*spacing, gz=z+roll()*spacing;
   if(skip&&skip(gx,gz))continue;
   // `mask` gates on top of the density field, which is what turns an even sprinkle
   // into drifts. It multiplies rather than replaces, so a drift still cannot put
   // flowers where the ground already refuses to grow anything.
   const d=density(gx,gz)*densityScale*(mask?mask(gx,gz):1)*pathVegetation(gx-pathX(gz),gz,footprint);
   if(d<=0.02||roll()>d)continue;
   const n=terrainNormal(gx,gz);
   if(n[1]<slopeMin)continue;
   const y=height(gx,gz)-sink;
   const yaw=roll()*Math.PI*2;
   const sy=(yScale[0]+roll()*(yScale[1]-yScale[0]));
   const sx=scale[0]+roll()*(scale[1]-scale[0]);
   writeMatrix(mats,mats.length,gx,y,gz,yaw,sx,sy,sx);
   const shade=tint[0]+roll()*(tint[1]-tint[0]);
   const dry=roll();
   const lamp=Math.min(1.85,bakeLamp(gx,y+0.45,gz,lights));
   if(palette){
    // A hue straight from the palette rather than the green ramp. Weighted by
    // position in the list -- a cubed roll keeps white dominant, the way a real
    // meadow is mostly one species with the others scattered through it.
    const p=palette[Math.min(palette.length-1,Math.floor(Math.pow(roll(),1.9)*palette.length))];
    cols.push(p[0]*shade,p[1]*shade,p[2]*shade,lamp);
   }else{
    cols.push(shade*(0.88+dry*0.16), shade, shade*(0.72+dry*0.08), lamp);
   }
  }
 }
 return {
  count:mats.length/16,
  matrices:new Float32Array(mats),
  colors:new Float32Array(cols),
 };
}

const TILE=8, NEAR_R=NEAR_RADIUS, FAR_R=28;

function bucketTiles(data){
 const map=new Map();
 for(let i=0;i<data.count;i++){
  const x=data.matrices[i*16+12], z=data.matrices[i*16+14];
  const tx=Math.floor(x/TILE), tz=Math.floor(z/TILE);
  const k=tx+tz*1024;
  let t=map.get(k);
  if(!t){t={cx:tx*TILE+TILE/2,cz:tz*TILE+TILE/2,idx:[]};map.set(k,t);}
  t.idx.push(i);
 }
 const tiles=[];
 for(const t of map.values()){
  const m=new Float32Array(t.idx.length*16), c=new Float32Array(t.idx.length*4);
  for(let j=0;j<t.idx.length;j++){
   const i=t.idx[j];
   m.set(data.matrices.subarray(i*16,i*16+16),j*16);
   c.set(data.colors.subarray(i*4,i*4+4),j*4);
  }
  tiles.push({cx:t.cx,cz:t.cz,count:t.idx.length,matrices:m,colors:c});
 }
 return tiles;
}

function makePool(near,far,tiles,maxNear,maxFar,farThin=0.72,farRadius=FAR_R,farFalloff=1){
 const nM=new Float32Array(maxNear*16), nC=new Float32Array(maxNear*4);
 const fM=new Float32Array(maxFar*16), fC=new Float32Array(maxFar*4);
 setThinInstances(near,nM,maxNear);
 setThinInstances(far,fM,maxFar);
 setThinInstanceColors(near,nC);
 setThinInstanceColors(far,fC);
 setThinInstanceCount(near,0);
 setThinInstanceCount(far,0);
 enableThinInstanceDynamicDrawCount(near);
 enableThinInstanceDynamicDrawCount(far);
 return {near,far,tiles,nM,nC,fM,fC,maxNear,maxFar,farThin,farRadius,farFalloff,nearCount:0,farCount:0,totalDropped:0};
}

function packPool(pool,cx,cz){
 pool.nearDropped=0;pool.farDropped=0;
 const radius=pool.farRadius+REPACK_DISTANCE;
 const nearR2=NEAR_R*NEAR_R, farR2=radius*radius, tileR=(radius+TILE)*(radius+TILE);
 let ni=0, fi=0;
 for(const tile of pool.tiles){
  const tdx=tile.cx-cx, tdz=tile.cz-cz;
  if(tdx*tdx+tdz*tdz>tileR)continue;
  const m=tile.matrices, c=tile.colors;
  for(let i=0;i<tile.count;i++){
   const x=m[i*16+12], z=m[i*16+14];
   const d2=(x-cx)*(x-cx)+(z-cz)*(z-cz);
   if(d2>farR2)continue;
   const end=removalRadius(plantHash(x,z),pool.farRadius,pool.farThin,pool.farFalloff);
   if(d2>packingRadius(end)**2)continue;
   if(d2<nearR2){
    if(ni>=pool.maxNear){pool.nearDropped++;pool.totalDropped++;continue;}
    pool.nM.set(m.subarray(i*16,i*16+16),ni*16);
    pool.nC.set(c.subarray(i*4,i*4+4),ni*4);
    ni++;
   }else{
    if(fi>=pool.maxFar){pool.farDropped++;pool.totalDropped++;continue;}
    pool.fM.set(m.subarray(i*16,i*16+16),fi*16);
    pool.fC.set(c.subarray(i*4,i*4+4),fi*4);
    fi++;
   }
  }
 }
 setThinInstanceCount(pool.near,ni);
 setThinInstanceCount(pool.far,fi);
 setThinInstanceColors(pool.near,pool.nC);
 setThinInstanceColors(pool.far,pool.fC);
 pool.nearCount=ni; pool.farCount=fi;
}

export async function createFoliage(engine,scene,{lights=[],density=()=>0,landmarks=[]}={}){
 const atlas=await loadTexture2D(engine,ATLAS,{invertY:false,srgb:false,mipMaps:true,minFilter:'linear',magFilter:'linear'});
 const material=await createFoliageMaterial(engine,atlas);
 const moorMaterial=await createFoliageMaterial(engine,atlas,[185,.85,.9,4]);
 const grassNear=commitProto(engine,scene,clumpCards('Grass near',[UV.meadow,UV.dry,UV.meadow],{cards:3,height:0.74,width:0.26,shared:true}),material);
 const grassFar=commitProto(engine,scene,clumpCards('Grass far',[UV.meadow,UV.dry],{cards:2,height:0.74,width:0.26,shared:true}),material);
 const moorNear=commitProto(engine,scene,clumpCards('Moor near',[UV.meadow,UV.dry,UV.meadow],{cards:3,height:1.0,width:0.42,shared:true}),moorMaterial);
 const moorFar=commitProto(engine,scene,clumpCards('Moor far',[UV.meadow,UV.dry],{cards:2,height:1.0,width:0.42,shared:true}),moorMaterial);
 const plantNear=commitProto(engine,scene,clumpCards('Plant near',[UV.plant],{cards:3,height:0.55,width:0.36,spread:0.10}),material);
 const plantFar=commitProto(engine,scene,clumpCards('Plant far',[UV.plant],{cards:2,height:0.60,width:0.42,spread:0,cross:true}),material);
 const brackenNear=commitProto(engine,scene,brackenTuft('Bracken near',UV.fern,false),material);
 const brackenFar=commitProto(engine,scene,brackenTuft('Bracken far',UV.fern,true),material);
 const flowerMaterial=await createFlowerMaterial(engine);
 const umbelNear=commitProto(engine,scene,flowerUmbel('Umbel near',false),flowerMaterial);
 const umbelFar=commitProto(engine,scene,flowerUmbel('Umbel far',true),flowerMaterial);
 const spikeNear=commitProto(engine,scene,flowerSpike('Spike near',false),flowerMaterial);
 const spikeFar=commitProto(engine,scene,flowerSpike('Spike far',true),flowerMaterial);

 const grassCore=place(density,lights,{seed:83861,minX:-38,maxX:38,minZ:-16,maxZ:146,spacing:0.36,scale:[0.85,1.25],yScale:[0.72,1.28],tint:[0.78,1.12],densityScale:1});
 const grassShoulder=place(density,lights,{seed:91011,minX:-88,maxX:88,minZ:-90,maxZ:160,spacing:0.62,scale:[0.9,1.3],yScale:[0.7,1.15],tint:[0.74,1.05],densityScale:0.85,skip:(x,z)=>x>-38&&x<38&&z>-16&&z<146});
 // The shoulder stopped dead at x=+-88 / z=160, and 10-ridge-west stands the camera at
 // x=-80: eight metres from the edge of every blade of grass in the world. Everything west
 // of the player was bare ground, which is why that frame measured 0.19 saturation and read
 // as an empty plane with a glow on it. This outer band is four times the spacing, so it is
 // moor rather than meadow and costs a fraction of the instances per square metre, but it
 // carries texture out to where the scattered woodland starts and closes the gap between
 // the two.
 const grassMoor=place(density,lights,{seed:31573,minX:-150,maxX:150,minZ:-150,maxZ:215,spacing:1.32,scale:[1.0,1.5],yScale:[0.62,1.05],tint:[0.66,0.94],densityScale:0.62,skip:(x,z)=>x>-88&&x<88&&z>-90&&z<160});
 // Backdrop-only grass has a sparse source set so its long draw radius cannot
 // saturate the dense meadow pool. It remains outside the playable rectangle.
const outerDensity=(x,z)=>{
  if((nearestRegionRoute(x,z)?.distance??Infinity)<4||regionSiteDistance(x,z)<2)return 0;
  const edge=Math.max(Math.abs(x)-90,z-145,-95-z);
  if(edge<10||edge>220||Math.hypot(x,z-40)>330)return 0;
  if(Math.abs(x)<45&&z>255&&z<355)return 0;
  const drift=.5+.5*Math.sin(x*.036+z*.013)*Math.sin(z*.041-x*.019);
  const join=Math.min(1,Math.max(0,(edge-10)/28));
  const fade=Math.min(1,Math.max(0,(220-edge)/95));
  return (.23+.20*drift)*join*fade;
 };
 const moor=place(outerDensity,lights,{seed:290923,minX:-300,maxX:300,minZ:-310,maxZ:390,spacing:2.0,scale:[.9,1.4],yScale:[.75,1.2],tint:[.58,.80],sink:.05});
 const parts=[grassCore,grassShoulder,grassMoor];
 const grass={
  count:parts.reduce((a,p)=>a+p.count,0),
  matrices:new Float32Array(parts.reduce((a,p)=>a+p.matrices.length,0)),
  colors:new Float32Array(parts.reduce((a,p)=>a+p.colors.length,0)),
 };
 for(let i=0,m=0,c=0;i<parts.length;i++){
  grass.matrices.set(parts[i].matrices,m);m+=parts[i].matrices.length;
  grass.colors.set(parts[i].colors,c);c+=parts[i].colors.length;
 }

 const plants=place(density,lights,{seed:2711,minX:-40,maxX:40,minZ:-12,maxZ:144,spacing:1.55,scale:[0.9,1.45],yScale:[0.85,1.25],tint:[0.82,1.08],densityScale:0.22,sink:0.02,slopeMin:0.7});
 const bracken=place(density,lights,{seed:490,minX:-26,maxX:26,minZ:-12,maxZ:142,spacing:1.12,scale:[0.85,1.35],yScale:[0.8,1.2],tint:[0.85,1.12],densityScale:0.34,sink:0.02,footprint:1.5});

 // Flowers begin north of the lych-gate and never enter the churchyard. That is the
 // right read -- the churchyard is ash and graves, Hollowmere is the living side -- and
 // it also keeps the two southern vistas as a control: z<=40 is the region the terrain
 // swell was required to leave bit-for-bit alone, so 08 and 12 still must not move.
 // Values are well above 1 because a petal is the brightest thing in a frame whose
 // ground luminance is 0.46; a white that reads as white here has to be driven past it.
 // Driven above 1 because ground luminance here is 0.46, but only just. At 1.55 the
 // drifts stopped being the brightest thing in the frame and started being a separate
 // light source sitting on top of it -- obvious the moment the camera reached the
 // shaded west treeline, where the grass goes dark and the flowers did not.
 const WHITE=[1.18,1.16,1.05], CREAM=[1.22,1.10,0.82];
 const umbels=place(density,lights,{seed:60317,minX:-70,maxX:70,minZ:34,maxZ:152,spacing:0.60,scale:[0.8,1.35],yScale:[0.75,1.3],tint:[0.86,1.08],densityScale:0.78,sink:0.01,slopeMin:0.66,mask:drift,palette:[WHITE,WHITE,WHITE,CREAM,[1.10,0.88,0.96]]});
 // The spikes carry the colour the reference actually has and we have nowhere else:
 // violet, blue-violet and a hot orange. Sparser than the white by a factor of three,
 // because in the reference they punctuate the white rather than compete with it.
 const spikes=place(density,lights,{seed:74209,minX:-70,maxX:70,minZ:34,maxZ:152,spacing:1.05,scale:[0.8,1.3],yScale:[0.8,1.35],tint:[0.88,1.1],densityScale:0.52,sink:0.01,slopeMin:0.66,mask:drift,palette:[[0.78,0.56,1.16],[0.52,0.48,1.20],[1.22,0.54,0.20],[1.12,0.62,0.84],[0.64,0.78,1.16]]});

 if(landmarks.length){
  const extra=new Float32Array(landmarks.length*16);
  const extraC=new Float32Array(landmarks.length*4);
  for(let i=0;i<landmarks.length;i++){
   const L=landmarks[i];
   const y=height(L.x,L.z)-0.02;
   writeMatrix(extra,i*16,L.x,y,L.z,L.yaw??i*0.7,L.scale??1.2,L.scale??1.2,L.scale??1.2);
   extraC.set([1,1,1,Math.min(1.85,bakeLamp(L.x,y+0.5,L.z,lights))],i*4);
  }
  const mergedM=new Float32Array(bracken.matrices.length+extra.length);
  const mergedC=new Float32Array(bracken.colors.length+extraC.length);
  mergedM.set(bracken.matrices); mergedM.set(extra,bracken.matrices.length);
  mergedC.set(bracken.colors); mergedC.set(extraC,bracken.colors.length);
  bracken.matrices=mergedM; bracken.colors=mergedC; bracken.count+=landmarks.length;
 }

 // The dense meadow retains its short view distance. Only the sparse, separate
 // outer moor pool reaches the hills; flowers and bracken remain short-range.
 const grassPool=makePool(grassNear,grassFar,bucketTiles(grass),8192,24576);
 const moorPool=makePool(moorNear,moorFar,bucketTiles(moor),1024,8192,0.85,185,0.9);
 const plantPool=makePool(plantNear,plantFar,bucketTiles(plants),512,768);
 const brackenPool=makePool(brackenNear,brackenFar,bucketTiles(bracken),768,1024);
 // Flowers are the one layer worth spending near-pool slots on, because the whole point
 // is the colour at the player's feet. 20 tris for a near head and 10 for a far one puts
 // the full pool at about 25k triangles -- the same order as the ash motes, against a
 // 140k scene.
 // Flowers thin far harder than grass with distance. Grass merges into a continuous
 // mat, so dropping instances only costs coverage; a flower is a discrete bright point,
 // so keeping the same fraction at 28 m as at 5 m makes distance *increase* the white
 // in the frame. The west-shoulder vista, which sees a wide swath of meadow at once,
 // came out as an even whiteout at 0.72 while the lych-gate view at the same settings
 // read correctly.
 const umbelPool=makePool(umbelNear,umbelFar,bucketTiles(umbels),1024,1536,0.93);
 const spikePool=makePool(spikeNear,spikeFar,bucketTiles(spikes),512,768,0.93);
 const pools=[grassPool,moorPool,plantPool,brackenPool,umbelPool,spikePool];
 packPool(grassPool,0,0);
 packPool(moorPool,0,0);
 packPool(plantPool,0,0);
 packPool(brackenPool,0,0);
 packPool(umbelPool,0,0);
 packPool(spikePool,0,0);

 const meshes=[grassNear,grassFar,moorNear,moorFar,plantNear,plantFar,brackenNear,brackenFar,umbelNear,umbelFar,spikeNear,spikeFar].filter(Boolean);
 const protoTris=meshes.reduce((n,m)=>(m._gpu?.indexCount??0)/3+n,0);
 let packedX=0, packedZ=0;
 return {
  meshes,material,pools,
  async probe(roots){const {probeFoliageLod}=await import('./foliage-lod-probe.js');return probeFoliageLod(engine,roots);},
  stats:{
   grass:grass.count,moor:moor.count,plants:plants.count,bracken:bracken.count,
   umbels:umbels.count,spikes:spikes.count,
   instances:grass.count+moor.count+plants.count+bracken.count+umbels.count+spikes.count,
   drawnNear:pools.reduce((a,p)=>a+p.nearCount,0),
   drawnFar:pools.reduce((a,p)=>a+p.farCount,0),
   prototypeTriangles:protoTris,draws:meshes.length,
  },
  update(t,playerPos){
   // Both materials, every frame. They share CARD_VERTEX, so a missed uniform here
   // would leave the flowers standing rigid in grass that is bending.
   for(const m of [material,moorMaterial,flowerMaterial])setShaderUniform(m,'time',t);
   if(!playerPos)return;
   for(const m of [material,moorMaterial,flowerMaterial]){
    setShaderUniform(m,'playerPosition',[playerPos.x,playerPos.y,playerPos.z]);
    setShaderUniform(m,'playerRadius',1.55);
   }
   const x=playerPos.x, z=playerPos.z;
   if((x-packedX)*(x-packedX)+(z-packedZ)*(z-packedZ)<REPACK_DISTANCE**2)return;
   packedX=x; packedZ=z;
   for(const pool of pools)packPool(pool,x,z);
   const s=this.stats;
   s.drawnNear=pools.reduce((a,p)=>a+p.nearCount,0);
   s.drawnFar=pools.reduce((a,p)=>a+p.farCount,0);
  },
 };
}
