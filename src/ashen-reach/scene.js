import {setShaderUniform} from '@babylonjs/lite';
import {Batch,rng,height,pathX,buildingPads,add,mul,sub,norm,terrainNormal,lanternGlow} from './geometry.js';
import {surface,sky} from './materials.js';
import {building,collapsedStall,well,forgeGlow,crossFinial,stoneArch,rubble,flagstone,masonryBox} from './buildings.js';
import {buildHorizon} from './horizon.js';
import {createFoliage} from './foliage.js';
import {createLightShafts} from './light-shafts.js';
import {createAshMotes} from './ash-motes.js';

/** A new scene layout. No Moonwell world builders, architecture or vegetation placement. */
export async function buildChurchyard(engine,scene){
 const random=rng(83861),r=(a,b)=>a+random()*(b-a);
 // Static lamps are baked per-vertex (see Batch.commit) instead of hardcoded in the shader, so the
 // town's street lamps and the two original churchyard lamps share one scalable list. These two
 // entries reproduce materials.js's former hardcoded lamp1/lamp2 exactly (same position, strength,
 // falloff) so the churchyard's illumination is unchanged.
 const lights=[{position:[-3.4,2.5,12.0],strength:.45,falloff:.5},{position:[3.6,2.7,14.0],strength:.4,falloff:.5}];
 const mats=await Promise.all([
  // nightGrade is a fragment-shader-side eased darken/desaturate that is exactly 0 for
  // i.p.z<=40 by construction (see materials.js), so it can never move a churchyard pixel even
  // though the churchyard's own grass/earth share these materials with Hollowmere's.
  // forrest_ground_01 averages 145/135/94, so it is already 1.00/0.93/0.65 warm. The old
  // tint took that to 0.81/0.77/0.40 -- blue at barely half of red -- and the warm key
  // pushed it further, which is most of why 04-town-gate-vista and 05-main-street came out
  // as sodium-yellow rooms. Cooling the tint alone fixed the walls and left the ground
  // doing it; lifting blue here is what actually moves those two frames.
  surface(engine,'Moss and burial earth','/tex/forrest_ground_01/diff.jpg',{tint:[.78,.83,.78],light:.80,pixels:128,ground:true,nightGrade:true}),
  // rock_wall_08 averages 81/75/67 -- warm tan before anything touches it. A near-neutral
  // tint left the albedo at roughly 1.00/0.92/0.81, and then the warm key (SUN_COLOR
  // 1.00/0.70/0.45) multiplied that again, so lit limestone landed near 1.02/0.66/0.36.
  // That is why 04-town-gate-vista measured 0.59 mean saturation with 85% of its chromatic
  // pixels inside a single 30-degree hue bin, the most monochrome frame in the set by a
  // wide margin: walls, ground and light were all one orange. This tint cancels the
  // texture's own warmth and pushes a little past neutral, so the stone reads cool grey and
  // the lantern pools become the warm accent against it rather than one more yellow thing
  // in a yellow room -- the complementary split atmosphere.js is built around.
  surface(engine,'Timeworn limestone','/tex/rock_wall_08/diff.jpg',{tint:[.90,.99,1.17],light:.78,pixels:512,uvScale:.20}),
  surface(engine,'Rotten oak','/tex/wood_planks_grey/diff.jpg',{tint:[.57,.43,.31],light:.62,pixels:64}),
  // light .40 on a .28 tint meant a near trunk against the hazy glow clipped to pure black
  // with no internal value at all -- 09-west-treeline had a quarter of its frame taken by one
  // flat cutout. A silhouette is wanted here; a silhouette with no form in it is not. .56 keeps
  // the trunk far darker than anything behind it while letting shade()'s rim term register on
  // the lit side.
  surface(engine,'Dead bark','/tex/bark_brown_02/diff.jpg',{tint:[.44,.44,.38],light:.56,pixels:64}),
  surface(engine,'Distant black stone','/tex/rock_wall_08/diff.jpg',{tint:[.095,.115,.10],light:.35,pixels:64}),
  surface(engine,'Candlelight','/tex/rock_wall_08/diff.jpg',{tint:[.95,1.10,.32],light:1,emission:1.4,pixels:16}),
  surface(engine,'Weathered memorial face','/ashen-reach/grave-face.jpg',{tint:[1,.99,.94],light:.72,pixels:160}),
  // Hollowmere's own warm lantern material, separate from the churchyard's Candlelight above: the
  // two original churchyard lamps and the distant bell towers keep using Candlelight untouched, so
  // retinting the town's lamp glow can never move a churchyard pixel.
  surface(engine,'Hollowmere lantern','/tex/rock_wall_08/diff.jpg',{tint:[1.30,.86,.46],light:1,emission:1.25,pixels:24}),
 ]);
 const names=['Earth','Grave stonework','Rotten fence','Bare woodland','Bell towers','Lantern glass','Carved epitaphs','Warm lantern'];
 const B=names.map(n=>new Batch(n));const [earth,stone,wood,bark,distant,glow,carve,warm]=B;
 // Shadowed fixtures keep luminous glass independent of their removed baked pool.
 const localGlass=new Batch('Shadowed lantern glass');
 B.push(localGlass);mats.push(await surface(engine,'Shadowed lantern glass','/tex/rock_wall_08/diff.jpg',{tint:[1,.68,.32],light:0,emission:24,pixels:16}));
 const colliders=[];
 // A continuous uneven floor, not a tiled slab floating on a flat plane. Every earth
 // quad uses analytic per-vertex normals (zero extra triangles) so the 2 m grid does
 // not facet. height() and the lamp bake still read world position only.
 //
 // M3b: the 2m grid is also too coarse for the baked per-vertex lamp irradiance (Batch.commit's
 // `uv2`/`lamp` term) to resolve a smooth pool under a street lamp — with only one triangle
 // spanning a lamp's whole falloff radius, Gouraud interpolation of a curved (inverse-square)
 // falloff across a handful of huge triangles reads as a faceted polygon, which is what the
 // deleted `groundGlow`/`radialGlow` ground decals were reached for (and both failed: an opaque
 // decal with no alpha blending always shows a hard edge, however its colours are chosen — see
 // geometry.js). Fixed geometrically instead, with no decal at all: the lamp-lit corridor
 // (the street/well width, and the lit stretch of road from the lych-gate through Hollowmere) is
 // subdivided into 0.5m sub-quads so the baked irradiance's curve is resolved by many small,
 // nearly-planar triangles instead of a few large ones. This is an unconditional +/-0-random()-call
 // change: `random()` is still called exactly once per original 2m cell, in the same loop order,
 // whether or not that cell is subdivided. `randomGround()` still runs once per sub-quad so
 // this stream stays consumed; shade now comes from earthShade(xz). Tombs, trees and grass
 // later in `random` stay bit-identical to before.
 const randomGround=rng(60013);
 const CORRIDOR_SUB=4; // 2m / 4 = 0.5m sub-quads
 const inLampCorridor=(x,z)=>z>=40&&z<143&&x>=-16&&x<16;
 // World-space UVs (~4.3 m/cycle, slow warp) and a continuous xz shade so
 // adjacent 2 m cells no longer share one colour or one UV phase. random()
 // still runs once per original 2 m cell, same loop order.
 const earthUV=p=>[p[0]*.23+.09*Math.sin(p[2]*.173+p[0]*.041),p[2]*.23+.09*Math.sin(p[0]*.161-p[2]*.037)];
 const earthShade=p=>{const n=.5+.28*Math.sin(p[0]*.29+p[2]*.21)+.22*Math.sin(p[0]*.11-p[2]*.17);const s=.94+.06*n;return [s,s,s,0];};
 for(let z=-95;z<145;z+=2)for(let x=-90;x<90;x+=2){
  random(); // one random() per cell (stream unchanged)
  if(inLampCorridor(x,z)){
   const step=2/CORRIDOR_SUB;
   for(let sz=0;sz<CORRIDOR_SUB;sz++)for(let sx=0;sx<CORRIDOR_SUB;sx++){
    const x0=x+sx*step,x1=x0+step,z0=z+sz*step,z1=z0+step;
    const v=[[x0,z0],[x1,z0],[x1,z1],[x0,z1]].map(([a,b])=>[a,height(a,b),b]);
    randomGround();
    earth.quad(...v,v.map(earthUV),v.map(earthShade),v.map(p=>terrainNormal(p[0],p[2])));
   }
  } else {
   const v=[[x,z],[x+2,z],[x+2,z+2],[x,z+2]].map(([a,b])=>[a,height(a,b),b]);
   earth.quad(...v,v.map(earthUV),v.map(earthShade),v.map(p=>terrainNormal(p[0],p[2])));
  }
 }

 // Path albedo is blended directly into the terrain material to avoid coplanar decals.

 function tomb(x,z,w,h,yaw=0,lean=0,kind=0){const gy=height(x,z),c=[r(.72,1),r(.73,.90),r(.66,.79),0];
  const P=(a,b,d=0)=>[x+a*Math.cos(yaw)+d*Math.sin(yaw)+b*lean,gy+b,z-a*Math.sin(yaw)+d*Math.cos(yaw)];
  const profile=kind%3===0?[[-.5,0],[.5,0],[.46,.70],[.25,.82],[0,1],[-.25,.82],[-.46,.70]]:kind%3===1?[[-.5,0],[.5,0],[.48,.86],[.30,.96],[-.22,1],[-.52,.84]]:[[-.5,0],[.5,0],[.5,.89],[.28,.89],[.22,1],[-.25,1],[-.31,.89],[-.5,.89]];
  for(let i=1;i<profile.length-1;i++)for(const d of [-.14,.14])(d<0?carve:stone).tri(P(profile[0][0]*w,profile[0][1]*h,d),P(profile[i][0]*w,profile[i][1]*h,d),P(profile[i+1][0]*w,profile[i+1][1]*h,d),[[profile[0][0]+.5,1-profile[0][1]],[profile[i][0]+.5,1-profile[i][1]],[profile[i+1][0]+.5,1-profile[i+1][1]]],c);
  for(let i=0;i<profile.length;i++){const a=profile[i],b=profile[(i+1)%profile.length];stone.quad(P(a[0]*w,a[1]*h,-.14),P(b[0]*w,b[1]*h,-.14),P(b[0]*w,b[1]*h,.14),P(a[0]*w,a[1]*h,.14),undefined,mul(c,.7).map((v,i)=>i===3?0:v));}
  stone.box([x,gy+.08,z],[w*1.22,.16,.52],c,yaw);
  colliders.push({type:'box',position:{x,y:gy+h/2,z},size:{x:w,y:h,z:.35},rotation:{y:yaw}});
 }
 // Deliberately asymmetric hero graves frame the path.
 tomb(3.2,1.3,1.1,1.45,-.28,-.13,0);tomb(4.8,2.8,.78,1.07,.12,.17,1);tomb(2.9,5.0,.80,1.32,.25,-.22,0);tomb(-3.8,7,.76,.9,-.3,.11,2);
 for(let i=0;i<42;i++){const z=r(4,36),x=(random()<.5?-1:1)*r(2.8,15);tomb(x,z,r(.48,.9),r(.65,1.37),r(-.8,.8),r(-.20,.20),i);}
 // Left foreground stone chest tomb, layered plinth, inset and eroded lid.
 const tx=-4.1,tz=-.8,ty=height(tx,tz);
 wood.box([tx,ty+.40,tz],[2.8,.55,1.65],[1,1,1,0],-.10);stone.box([tx,ty+.72,tz],[3.1,.18,1.82],[.49,.48,.36,0],-.10);stone.box([tx,ty+.08,tz],[3.25,.16,1.95],[.40,.39,.30,0],-.10);
 tomb(tx-.20,tz+.65,1.35,2.55,-.10,-.04,2);
 colliders.push({type:'box',position:{x:tx,y:ty+.5,z:tz},size:{x:3.1,y:1,z:1.8},rotation:{y:-.1}});

 // Broken wheel memorial: independently displaced stone voussoirs and angled arms.
 const center=[-.3,height(0,23)+4.10,23],R=1.95;
 for(let k=0;k<22;k++){if(k===4||k===15)continue;const a=k*Math.PI*2/22+.11,b=a+.25;const p=(rad,t,depth)=>[center[0]+Math.sin(t)*rad,center[1]+Math.cos(t)*rad,center[2]+depth];const col=[r(.85,1.16),r(.9,1.14),r(.75,.99),0];const a0=p(R-.16,a,-.23),b0=p(R+.16,a,-.23),c0=p(R+.16,b,-.23),d0=p(R-.16,b,-.23);stone.quad(a0,b0,c0,d0,undefined,col);stone.quad(p(R+.16,a,.23),p(R+.16,b,.23),c0,b0,undefined,col);stone.quad(p(R-.16,a,.23),p(R-.16,b,.23),d0,a0,undefined,col);}
 stone.tube(add(center,[-.35,-3.45,0]),add(center,[.40,2.55,0]),.15,.23,[1,1,.83,0],4);stone.tube(add(center,[-2.5,.37,0]),add(center,[2.5,-.37,0]),.18,.18,[1,1,.83,0],4);
 stone.box([center[0],height(0,23)+.35,23],[1.8,.65,1.35],[.66,.70,.57,0]);stone.box([center[0],height(0,23)+.05,23],[2.7,.17,2],[.56,.59,.47,0]);

 function tree(x,z,H,seed,back=false){const rand=rng(seed),g=height(x,z),base=[x,g,z];// Trunk value is carried on the vertex colour rather than on the `Dead bark`
  // material, because that material is shared with the 565 scatter trees on the far
  // moor, which want to stay near-black silhouettes. At .56 a `back` tree standing 3 m
  // from the 09-west-treeline camera clipped to a flat detail-free black mass -- the
  // bark texture was multiplied to nothing -- while the same value read correctly at
  // 80 m. Lifting it here lets the texture survive up close; aerial() still carries the
  // far ones back down toward the haze.
  const color=back?[.76,.82,.70,0]:[.88,.92,.80,0];
  let p=base,dir=[rand()*.14-.07,1,rand()*.10-.05];const nodes=[base];
  for(let k=0;k<6;k++){dir=norm(add(dir,[rand()*.34-.17,.05,rand()*.25-.125]));const q=add(p,mul(dir,H/6));bark.tube(p,q,H*.044*(1-k/6)+.025,H*.044*(1-(k+1)/6)+.025,color,6);p=q;nodes.push(p);}
  const branch=(p,dir,len,rad,depth)=>{const q=add(p,mul(dir,len));bark.tube(p,q,rad,Math.max(.005,rad*.55),color,depth>1?4:3);if(depth<=0)return;const t=norm(add(dir,[rand()*.6-.3,.15,rand()*.6-.3]));branch(q,t,len*.7,rad*.56,depth-1);if(depth>1||rand()>.32){const yaw=rand()*6.28;branch(add(p,mul(sub(q,p),.73)),norm(add(dir,[Math.cos(yaw)*.8,.35,Math.sin(yaw)*.8])),len*.55,rad*.45,depth-1);}};
  for(let k=2;k<7;k++)for(let j=0;j<2;j++){const a=k*2.4+j*3.1+rand()*.7;branch(nodes[k],norm([Math.cos(a),.35+rand()*.5,Math.sin(a)]),H*(.23+rand()*.11)*(1-(k-2)*.075),H*.012*(1-(k-2)*.1),back?3:4);}
  // Root flare. The old version put every tip at `g+.04` -- the terrain height at the
  // *trunk centre* -- so on any slope the downhill roots ended in mid-air, which is what
  // made the near trunk at 09-west-treeline read as a black wedge floating over the
  // grass. Each tip now samples the ground under itself and sinks .14 below it, so the
  // flare is buried rather than merely nearby. Seven irregular roots instead of five
  // evenly spaced ones, because five at exactly 72 degrees read as a fixed prop.
  for(let k=0;k<7;k++){
   // Reach is short relative to the drop on purpose: at H*.082-.144 the roots ran out
   // almost flat and read as spikes lying on the grass rather than as buttresses
   // holding the trunk up. Leaving from higher on the trunk and reaching less puts
   // them near 45 degrees.
   const a=k*(Math.PI*2/7)+rand()*.34,rr=H*(.054+rand()*.034);
   const qx=x+Math.cos(a)*rr,qz=z+Math.sin(a)*rr;
   bark.tube([x,g+1.15*(H/14),z],[qx,height(qx,qz)-.14,qz],H*.034,H*.010,color,5);
  }
 }
 tree(-6,16,12,1983);tree(4.5,24,17,293);tree(-10,15,12,25);tree(14,19,13,181);
 for(let i=0;i<38;i++){const x=r(-48,48),z=r(32,95);if(Math.abs(x)<4&&z<40)continue;if(z>74&&Math.abs(x-pathX(z))<11)continue;tree(x,z,r(8,17),i*101+58,true);}

 function tower(x,z,H,w){const g=height(x,z);distant.box([x,g+H*.40,z],[w,H*.80,w],[1,1,1,0]);
  for(let k=0;k<4;k++){const a=k*Math.PI/2+Math.PI/4;distant.tube([x+Math.sin(a)*w*.69,g,z+Math.cos(a)*w*.69],[x+Math.sin(a)*w*.63,g+H*.87,z+Math.cos(a)*w*.63],w*.16,w*.10,[.7,.75,.7,0],5);distant.tube([x+Math.sin(a)*w*.63,g+H*.87,z+Math.cos(a)*w*.63],[x+Math.sin(a)*w*.63,g+H*1.13,z+Math.cos(a)*w*.63],w*.27,0,[.5,.6,.5,0],5);}
  distant.box([x,g+H*.74,z],[w*1.13,.65,w*1.13],[.7,.8,.7,0]);distant.tube([x,g+H*.82,z],[x-.5,g+H*1.30,z],w*.90,.03,[.7,.8,.7,0],6);
  for(let j=0;j<2;j++)glow.box([x-w*.10,g+H*(.68+j*.085),z-w*.502],[w*.07,H*.03,.03],[1,1,1,0]);
 }
 tower(23,37,28,5.5);tower(-41,92,30,5);tower(46,99,53,8);
 tower(168,32,38,6.4);tower(-162,78,32,5.6);tower(150,-55,26,5.2);tower(-130,-70,24,4.8);
 for(let side of [-1,1])for(let z=4;z<39;z+=3.2){const x=side*(12+Math.sin(z*.12)*1.5),y=height(x,z);wood.tube([x,y,z],[x+r(-.15,.15),y+1.18,z+.12],.085,.055,[.7,.65,.55,0],4);if(random()<.82){for(const h of [.42,.86])wood.tube([x,y+h,z],[side*(12+Math.sin((z+3.2)*.12)*1.5),height(x,z+3.2)+h,z+3.2],.06,.05,[.7,.65,.55,0],4);}}
 // Leaning wooden lantern posts around the monument approach.
 for(const [x,z] of [[-3.4,12],[3.6,14],[-2.8,25]]){const y=height(x,z);wood.tube([x,y,z],[x-.18,y+2.8,z],.085,.045,[.8,.8,.7,0],5);const p=[x-.18,y+2.52,z];glow.box(p,[.22,.31,.22],[1,1,1,0]);for(let j=0;j<4;j++){const dx=j<2?-.14:.14,dz=j%2?-.14:.14;wood.box([p[0]+dx,p[1],p[2]+dz],[.034,.46,.034],[.3,.3,.3,0]);}wood.box([p[0],p[1]-.22,p[2]],[.35,.055,.35],[.3,.3,.3,0]);wood.tube([p[0],p[1]+.18,p[2]],[p[0],p[1]+.42,p[2]],.25,0,[.3,.3,.3,0],4);}

 const smooth=t=>{t=Math.min(1,Math.max(0,t));return t*t*(3-2*t);};
 const meadow=(x,z)=>{
  const rad=Math.hypot(x,z);
  let d=1-.58*smooth((rad-28)/36);
  d=Math.max(d,.40);
  d*=.80+.20*(.5+.5*Math.sin(x*.093+z*.077)*Math.cos(x*.061-z*.118));
  const path=Math.abs(x-pathX(z));
  if(path<1.15&&z<26)return 0;
  if(path<2)d*=.22+.78*smooth((path-1.15)/.85);
  return d;
 };

 // --- Milestone 1, north of the churchyard: everything below is new and uses its own rng so the
 // churchyard's random sequence above (tombs/trees/grass colour) is untouched. Placed only at
 // z>40, so height()'s climb/pad terms and this content never affect the z<=40 invariant.
 const randomNorth=rng(50021),rn=(a,b)=>a+randomNorth()*(b-a);
 // Freestanding fixtures use shadowed surface light and integrated fog.
 // The legacy shaft list stays empty; its diagnostic count remains available.
 // All local fixtures are z>=44, beyond the original churchyard.
 const shafts=[],localLights=[];

 function streetLamp(x,z,strength=.82){
  const y=height(x,z);
  masonryBox(stone,[x,y+1.45,z],[.28,2.9,.28],[.52,.50,.46,0]);
  masonryBox(stone,[x,y+.08,z],[.42,.16,.42],[.46,.44,.40,0]);
  const p=[x+(pathX(z)-x)*.30,y+2.62,z];
  wood.tube([x,y+2.85,z],[p[0],y+2.85,z],.055,.055,[.4,.33,.25,0],5);
  lanternGlow(localGlass,p,{r:.13,h:.28});
  for(let j=0;j<4;j++){const dx=j<2?-.15:.15,dz=j%2?-.15:.15;stone.box([p[0]+dx,p[1],p[2]+dz],[.036,.48,.036],[.38,.36,.32,0]);}
  masonryBox(stone,[p[0],p[1]-.23,p[2]],[.37,.06,.37],[.38,.36,.32,0]);
  stone.tube([p[0],p[1]+.19,p[2]],[p[0],p[1]+.44,p[2]],.26,0,[.38,.36,.32,0],4);
  // Every freestanding street fixture now gets surface and fog visibility.
  lights.push({position:p,strength,falloff:.42,radius:9,shadowed:true});
  localLights.push({id:`street-${z}`,position:[p[0],p[1]-.30,p[2]],strength:4.2});
  // Fixture-sized ground pool. The 1.70 pass blew out the gate approach;
  // 1.10 keeps the pool visible without turning nearby grass solid yellow.
  lights.push({position:[x,y+.18,z],strength:1.10,falloff:.62,radius:5,shadowed:true});
 }

 // Lych-gate: the road leaves the burial ground through a timber roof on two posts.
 function lychGate(z){
  const x=pathX(z),y=height(x,z),gap=1.9,postH=2.3,ridgeY=y+postH+.85,eaveOut=gap+.35,half=.62;
  for(const px of [x-gap,x+gap]){
   wood.tube([px,y,z],[px,y+postH,z],.12,.09,[.5,.42,.32,0],6);
   colliders.push({type:'box',position:{x:px,y:y+postH/2,z},size:{x:.30,y:postH,z:.55},rotation:{y:0}});
  }
  wood.box([x,y+postH+.02,z],[gap*2+.4,.12,.5],[.44,.38,.29,0]);
  const roofCol=[.40,.34,.25,0];
  wood.quad([x-eaveOut,y+postH,z-half],[x-eaveOut,y+postH,z+half],[x,ridgeY,z+half],[x,ridgeY,z-half],undefined,roofCol);
  wood.quad([x,ridgeY,z-half],[x,ridgeY,z+half],[x+eaveOut,y+postH,z+half],[x+eaveOut,y+postH,z-half],undefined,roofCol);
  wood.tube([x,ridgeY,z-half],[x,ridgeY,z+half],.045,.045,[.36,.30,.22,0],4);
  stone.box([x,y+.05,z],[gap*2+.7,.10,.7],[.55,.55,.47,0]);
  lanternGlow(localGlass,[x,ridgeY-.1,z],{r:.11,h:.24});
  // Keep the authored entries for diagnostics; shadowed excludes both from baking.
  lights.push({position:[x,ridgeY-.1,z],strength:.80,falloff:.42,radius:9,shadowed:true});
  // Real timber occlusion replaces the gate's former cone shell.
  localLights.push({id:'lych-gate',position:[x,ridgeY-.28,z],strength:5});
  // Dedicated near-ground pool. M8b: 1.1 -> 1.49, same window as M7a (radius 6.5).
  lights.push({position:[x,y+.18,z],strength:1.49,falloff:.55,radius:6.5,shadowed:true});
 }
 lychGate(44);
 for(const [z,side] of [[50,-1],[58,1],[66,-1]])streetLamp(pathX(z)+side*2.8+rn(-.2,.2),z,.82);

 // Town outer wall and gatehouse: two flanking towers with crenellations, a lintel over the road.
 function townGate(z){
  const x=pathX(z),gateHalf=2.6,wallHalf=40,wallH=4.2,wallT=1.2,towerW=3.6,towerH=9;
  for(const side of [-1,1]){
   const innerX=x+side*(gateHalf+towerW/2),outerX=x+side*wallHalf,midX=(innerX+outerX)/2,len=Math.abs(outerX-innerX),wy=height(midX,z);
   masonryBox(stone,[midX,wy+wallH/2,z],[len,wallH,wallT],[.62,.63,.56,0]);
   const steps=Math.max(4,Math.round(len/2.4));
   for(let k=0;k<steps;k+=2){const t=(k+.5)/steps,mx=innerX+(outerX-innerX)*t;masonryBox(stone,[mx,wy+wallH+.30,z],[1.0,.55,wallT*.85],[.58,.60,.52,0]);}
   colliders.push({type:'box',position:{x:midX,y:wy+wallH/2,z},size:{x:len,y:wallH,z:wallT},rotation:{y:0}});
  }
  for(const side of [-1,1]){
   const tx=x+side*(gateHalf+towerW/2),ty=height(tx,z);
   masonryBox(stone,[tx,ty+towerH/2,z],[towerW,towerH,towerW],[.58,.60,.53,0]);
   for(let k=0;k<4;k++){const a=k*Math.PI/2+Math.PI/4;masonryBox(stone,[tx+Math.sin(a)*towerW*.42,ty+towerH+.35,z+Math.cos(a)*towerW*.42],[.5,.7,.5],[.5,.52,.46,0]);}
   lanternGlow(warm,[tx-side*towerW*.28,ty+towerH*.55,z-towerW*.51],{r:.16,h:.34});
   colliders.push({type:'box',position:{x:tx,y:ty+towerH/2,z},size:{x:towerW,y:towerH,z:towerW},rotation:{y:0}});
   // M7a: radius:14 keeps this a real fixture-scale light, not a town-wide wash, but still noticeably
   // wider than a streetLamp's radius:9 ambient since these towers are meant to read from further off.
   lights.push({position:[tx,ty+towerH*.55,z],strength:1.20,falloff:.32,radius:14});
   // wide, dim halo so the gatehouse registers as a warm mass from the approach -- M7a: radius:30
   // keeps this the widest light in the scene (per the brief: this one must stay a broad warm mass,
   // not be windowed down to fixture scale like the lamps), while still finite so its tail does not
   // reach all the way to z=134 the way the unbounded version did. Its restrained
   // strength keeps the gate broad and warm while leaving masonry readable.
   lights.push({position:[tx,ty+towerH*.55,z],strength:.46,falloff:.15,radius:30});
  }
  // M3c defect 2: the plan's M3 gate ("a reviewed vista of the citadel from the town gate")
  // was still unmet -- at ORDINARY play framing (pitch=.04, dist=3.5, not the contrived pitch=.25
  // M3b judged it at) the citadel's base/lower mass was hidden directly behind this header, which
  // sat only 3.15-4.05 units above ground at 5m range: close enough that its own angular height
  // (~17-24 degrees elevation from the gate) covered exactly the band where the citadel's walls and
  // spire bases sit from that distance, leaving only spire tips visible above it ("window dots
  // above the lintel", per review). A camera pitch change can't fix an object physically in the
  // way. Fix: raise the header well above eye-level sightlines (still under towerH=9 so it reads
  // as an architectural element near the tower tops, not a floating slab) so the gate opens into a
  // tall archway with a clear sightline through to the citadel at ordinary play pitch. Pure
  // vertex-Y change: no new triangles, no collider (the header never had one).
  const gy=height(x,z);
  masonryBox(stone,[x,gy+7.4,z],[gateHalf*2+towerW*.6,.9,wallT*1.1],[.56,.58,.5,0]);
 }
 townGate(75);
 for(const [z,side] of [[84,1],[94,-1],[104,1],[114,-1],[124,1],[134,-1]])streetLamp(pathX(z)+side*3.4+rn(-.2,.2),z,.82);

 // --- Hollowmere: a parameterised building() call per pad instead of hand-placed vertices. Pads
 // west of the street (x<0) use yaw=0 so their door faces +x/east toward the road; pads east of it
 // (x>0) use yaw=PI so their door faces -x/west toward the road. Off-pad props (stalls) get their
 // own footprint recorded so the ground-cover pass below can thin around them too. ---
 const ctx={wood,stone,glow:warm,groundHeight:height,colliders,lights};
 const WEST=0,EAST=Math.PI,pads=buildingPads,extraFootprints=[];
 // House silhouettes are varied deliberately (footprint proportions, a lean-to on one, an upper
 // storey on another, chimneys on all of them) rather than repeating the same gabled box nine
 // times — see the M2b status-log defect 5.
 building(ctx,{x:pads[0].x,z:pads[0].z,w:6.6,d:6.2,yaw:WEST,wallH:2.4,roofH:1.2,kind:'house',chimney:true,leanTo:-1,
  windows:[{wall:1,w:.55,h:.6},{wall:-1,w:.55,h:.6}]});
 building(ctx,{x:pads[1].x,z:pads[1].z,w:6.0,d:6.4,yaw:EAST,wallH:2.6,roofH:1.35,kind:'house',chimney:true,upper:true,ruin:true,
  windows:[{wall:1,w:.55,h:.6},{wall:-1,w:.55,h:.6},{wall:1,ly:3.97,w:.42,h:.5},{wall:-1,ly:3.97,w:.42,h:.5}]});

 const tavern=building(ctx,{x:pads[2].x,z:pads[2].z,w:7.6,d:6.6,yaw:WEST,wallH:3.0,roofH:1.6,kind:'tavern',chimney:true,upper:true,sign:true,
  windows:[{wall:1,lx:-1.7,w:.5,h:.58},{wall:1,lx:1.7,w:.5,h:.58},{wall:-1,lx:-1.7,w:.5,h:.58},{wall:-1,lx:1.7,w:.5,h:.58},
   {wall:1,lx:-1.7,ly:3.97,w:.42,h:.5},{wall:1,lx:1.7,ly:3.97,w:.42,h:.5}]});

 const smithy=building(ctx,{x:pads[3].x,z:pads[3].z,w:7.2,d:6.4,yaw:EAST,wallH:2.7,roofH:1.3,kind:'smithy',chimney:true,
  windows:[{wall:1,w:.5,h:.5}]});
 forgeGlow(ctx,smithy.front[0],smithy.front[2],EAST);

 building(ctx,{x:pads[4].x,z:pads[4].z,w:5.6,d:6.8,yaw:WEST,wallH:2.8,roofH:1.5,kind:'house',chimney:true,ruin:true,
  windows:[{wall:1,w:.5,h:.58},{wall:-1,w:.5,h:.58}]});

 const chapelWallH=3.2,chapelRoofH=2.4;
 const chapel=building(ctx,{x:pads[5].x,z:pads[5].z,w:6.6,d:7.6,yaw:EAST,wallH:chapelWallH,roofH:chapelRoofH,kind:'chapel',steeple:true,
  windows:[{wall:1,w:.8,h:1.05},{wall:-1,w:.8,h:1.05}]});
 crossFinial(ctx,[pads[5].x,(chapel.steepleTop??(chapel.gy+.22+chapelWallH+chapelRoofH))+.05,pads[5].z]);

 building(ctx,{x:pads[6].x,z:pads[6].z,w:6.8,d:5.0,yaw:WEST,wallH:2.3,roofH:1.15,kind:'house',chimney:true,leanTo:1,ruin:true,
  windows:[{wall:1,w:.5,h:.58},{wall:-1,w:.5,h:.58}]});

 building(ctx,{x:pads[7].x,z:pads[7].z,w:4.4,d:4.4,yaw:EAST,wallH:6.2,kind:'watchtower',
  windows:[{wall:1,ly:2.6},{wall:-1,ly:2.6},{wall:1,ly:4.6},{wall:-1,ly:4.6},{wall:1,ly:5.6},{wall:-1,ly:5.6}]});

 building(ctx,{x:pads[9].x,z:pads[9].z,w:5.2,d:5.4,yaw:WEST,wallH:2.15,roofH:1.05,kind:'house',ruin:true,
  windows:[{wall:1,w:.46,h:.5},{wall:-1,w:.46,h:.5}]});
 building(ctx,{x:pads[10].x,z:pads[10].z,w:5.0,d:5.6,yaw:EAST,wallH:2.35,roofH:1.2,kind:'house',chimney:true,ruin:true,
  windows:[{wall:1,w:.46,h:.5},{wall:-1,w:.46,h:.5}]});
 building(ctx,{x:pads[11].x,z:pads[11].z,w:5.4,d:5.2,yaw:WEST,wallH:2.2,roofH:1.1,kind:'house',ruin:true,leanTo:1,
  windows:[{wall:1,w:.48,h:.52},{wall:-1,w:.48,h:.52}]});
 building(ctx,{x:pads[12].x,z:pads[12].z,w:5.1,d:5.5,yaw:EAST,wallH:2.5,roofH:1.25,kind:'house',chimney:true,ruin:true,
  windows:[{wall:1,w:.46,h:.5},{wall:-1,w:.46,h:.5}]});
 stoneArch(ctx,91,9.2);

 const cobbleColor=()=>{
  const roll=rn(0,1);
  if(roll>.9)return [.74+rn(0,.04),.76+rn(0,.04),.64+rn(0,.03),0];
  if(roll>.62)return [.88+rn(0,.06),.86+rn(0,.05),.80+rn(0,.04),0];
  if(roll>.32)return [.80+rn(0,.05),.78+rn(0,.04),.72+rn(0,.04),0];
  return [.70+rn(0,.05),.68+rn(0,.04),.64+rn(0,.03),0];
 };
 // Fitted cobbles: spacing matches stone size so joints stay tight, like the well plaza.
 let cobbleRow=0;
 for(let z=76;z<137;){
  const stepZ=.60+rn(0,.10);
  const px=pathX(z+stepZ/2);
  const stagger=(cobbleRow%2)*.34;
  for(let x=px-3.15+stagger;x<px+3.15;){
   const stepX=.62+rn(0,.12);
   const tw=stepX*.94+rn(0,.06),td=stepZ*.92+rn(0,.06);
   const edge=Math.abs((x+tw/2)-px)/3.15;
   if(edge<0.93||rn(0,1)>.3){
    const cx=x+tw/2,cz=z+stepZ*.5+rn(-.03,.03);
    const sink=rn(0,1)>.9?-.012:0;
    const y=height(cx,cz)+.012+rn(0,.008)+sink;
    flagstone(stone,cx,y,cz,tw,td,rn(-.1,.1),cobbleColor(),randomNorth);
   }
   x+=stepX;
  }
  z+=stepZ;
  cobbleRow++;
 }
 for(let iz=-6;iz<=6;iz++){
  for(let ix=-6;ix<=6;ix++){
   const x=pads[8].x+ix*.82+rn(-.16,.16),z=pads[8].z+iz*.78+rn(-.14,.14);
   const dist=Math.hypot(x-pads[8].x,z-pads[8].z);
   if(dist<1.2||dist>5.7)continue;
   if(rn(0,1)<.07)continue;
   const tw=.48+rn(0,.7),td=.42+rn(0,.55);
   const y=height(x,z)+.012+rn(0,.012);
   flagstone(stone,x,y,z,tw,td,rn(-.25,.25),cobbleColor(),randomNorth);
  }
 }

 well(ctx,pads[8].x,pads[8].z);
 collapsedStall(ctx,pads[8].x+4.6,pads[8].z-1.4,EAST);

 rubble(ctx,-3.2,84,6);
 rubble(ctx,3.1,88,5);
 rubble(ctx,-3.0,98,7);
 rubble(ctx,1.15,91.7,4);
 rubble(ctx,-2.8,107,5);
 rubble(ctx,3.2,115,6);
 rubble(ctx,-3.4,128,5);
 rubble(ctx,2.6,133,4);
 rubble(ctx,4.2,136.5,5);
 extraFootprints.push({x:-3.2,z:84,r:1.1},{x:3.1,z:88,r:1.0},{x:-3.0,z:98,r:1.2},{x:1.15,z:91.7,r:.9});

 for(const [x,z,H,seed] of [[-15,84,11,801],[-16,99,13,914],[16,92,12,722],[15.5,116,14,633],[-15.5,124,12,540],[16,130,11,411]])
  tree(x,z,H,seed,true);

 // --- Ground cover continues north through Hollowmere, but a town has trodden ground: it thins
 // out gradually approaching the street, every building/stall apron and the well plaza, rather
 // than stopping abruptly at a fixed radius the way the old insideFootprint() boolean did.
 // clearance(x,z) returns 0 (bare ground, nothing grows) to 1 (full meadow density); callers roll
 // against it per-candidate so the transition is a gradient, not a cliff. Independent rng from the
 // churchyard's grass/fern sequence above, and entirely north of z=40 so it cannot touch the
 // invariant.
 const ease=(x,lo,hi)=>smooth((x-lo)/(hi-lo));
 function clearance(x,z){
  let c=1;
  for(const pd of pads){
   const dx=Math.max(Math.abs(x-pd.x)-pd.w/2,0),dz=Math.max(Math.abs(z-pd.z)-pd.d/2,0);
   c=Math.min(c,ease(Math.hypot(dx,dz),0.35,3.6));
  }
  for(const f of extraFootprints)c=Math.min(c,ease(Math.hypot(x-f.x,z-f.z),f.r*.4,f.r+2.6));
  // Well square: a proper open plaza, cleared well past the well pad's own footprint.
  c=Math.min(c,ease(Math.hypot(x-pads[8].x,z-pads[8].z),2.4,7.2));
  // Walking line stays mostly stone; grass returns in the verge joints.
  c=Math.min(c,0.12+0.88*ease(Math.abs(x-pathX(z)),0.9,3.1));
  if(z>71&&z<79)c=0; // town gatehouse wall and towers
  return c;
 }

 // Visual-only far terrain, separate from the Havok ground mesh. It uses the same
 // earth material and reaches beyond the camera's 1200 m far plane from the playable bounds.
 const farEarth=new Batch('Far earth');
 const randomFar=rng(81107),rf=()=>randomFar();

 // The far field is over half of every vista frame -- material-tag coverage measures it at
 // 76% of 10-ridge-west and 52% of 07-north-overlook, against ~0% sky -- and it was drawing
 // as one bare olive ramp from the foliage line to the mountains, with nothing in it to
 // measure distance against. That, and not the ridge rings, is why those cameras read flat.
 // `earthShade` varies +-6% at a 21 m wavelength, which is invisible once 16 m quads and
 // aerial perspective have had it; these vary +-30% at 100-500 m, the scale the eye reads as
 // terrain rather than as noise, and they cost no triangles and no draw call.
 //
 // Slope is the term that matters, because it is the only one that follows the actual land,
 // so it is what turns the bowl wall from a gradient into a surface with form: steep goes
 // darker and cooler toward bare rock, high goes paler toward scree, low flats stay warm
 // heath.
 const farShade=(p,n)=>{
  const [x,y,z]=p;
  const patch=.5+.31*Math.sin(x*.0121+z*.0093)*Math.sin(z*.0107-x*.0068)
                 +.17*Math.sin(x*.0287-z*.0231)*Math.sin(z*.0199+x*.0163);
  const slope=Math.min(1,Math.max(0,(1-n[1])*3.2));
  const alt=Math.min(1,Math.max(0,(y-3)/36));
  const heath=.5+.5*Math.sin(x*.055+z*.033)*Math.sin(z*.067-x*.019);
  const s=(.63+.29*patch)*(1-.34*slope)*(1-.09*alt)*(1.15-.60*heath);
  return [s*(.90-.09*heath+.05*alt-.02*slope),s*(1+.04*heath+.02*alt),s*(1.05-.08*heath-.06*slope*slope+.11*alt),0];
 };
 const farColor=(p,n)=>{
  const [x,,z]=p;
  const dx=Math.max(0,Math.abs(x)-90),dz=Math.max(0,z>145?z-145:-95-z);
  const t=Math.min(1,Math.hypot(dx,dz)/48),mix=t*t*(3-2*t);
  if(mix===0)return earthShade(p);
  if(mix===1)return farShade(p,n);
  const near=earthShade(p),far=farShade(p,n);
  return near.map((c,i)=>c*(1-mix)+far[i]*mix);
 };
 // Shared axis coordinates keep the grid watertight at every change in cell size.
 // The inner edge includes every 2 m terrain vertex; the first 48 m resolves the basin.
 const offsets=[];
 for(let d=8;d<=48;d+=8)offsets.push(d);
 for(let d=64;d<=160;d+=16)offsets.push(d);
 for(let d=192;d<=320;d+=32)offsets.push(d);
 for(let d=384;d<=640;d+=64)offsets.push(d);
 for(let d=768;d<=1536;d+=128)offsets.push(d);
 const axis=(min,max)=>[
  ...offsets.map(d=>min-d).reverse(),
  ...Array.from({length:(max-min)/2+1},(_,i)=>min+i*2),
  ...offsets.map(d=>max+d)
 ];
 const xs=axis(-90,90),zs=axis(-95,145);
 for(let zi=0;zi<zs.length-1;zi++)for(let xi=0;xi<xs.length-1;xi++){
  const x=xs[xi],x1=xs[xi+1],z=zs[zi],z1=zs[zi+1];
  if(x>=-90&&x1<=90&&z>=-95&&z1<=145)continue;
  const v=[[x,z],[x1,z],[x1,z1],[x,z1]].map(([a,b])=>[a,height(a,b),b]);
  const normals=v.map(p=>terrainNormal(p[0],p[2]));
  farEarth.quad(...v,v.map(earthUV),v.map((p,i)=>farColor(p,normals[i])),normals);
 }
 // Preserve far-tree and boulder placement after changing the ground topology.
 const oldHalo=48,oldFine=6,oldCoarse=16;
 for(let z=-420;z<540;z+=oldCoarse)for(let x=-420;x<420;x+=oldCoarse){
  const inHalo=x<90+oldHalo&&x+oldCoarse>-90-oldHalo&&z<145+oldHalo&&z+oldCoarse>-95-oldHalo;
  const inPlay=x<90&&x+oldCoarse>-90&&z<145&&z+oldCoarse>-95;
  if(!inHalo&&!inPlay)rf();
 }
 for(let z=-95;z<145;z+=oldFine)for(let x=-90-oldHalo;x<90+oldHalo;x+=oldFine){
  if(x<-90||x>=90)rf();
 }
 for(let x=-90-oldHalo;x<90+oldHalo;x+=oldFine)for(let z=-95-oldHalo;z<145+oldHalo;z+=oldFine){
  if(z<-95||z>=145)rf();
 }
 // Crown sections share the bark batch. Their offsets make a crooked fir, a swept fir,
 // a broad old tree, and an occasional dead snag read differently against the sky.
 const farTree=(x,z,H,sides,kind,lean)=>{
  const g=height(x,z),tx=x+lean[0]*H,tz=z+lean[1]*H;
  const lerp=(t,a,b)=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t];
  const foot=[x,g,z],mid=p=>lerp(p,foot,[tx,g+H,tz]);
  if(kind<.39){                                  // uneven, wide-skirted fir
   bark.tube(foot,mid(.82),H*.036,H*.012,[.42,.45,.37,0],sides);
   bark.tube(mid(.28),mid(.75),H*.22,H*.065,[.31,.39,.29,0],sides+1);
   bark.tube(mid(.61),[tx+lean[0]*H*.35,g+H,tz+lean[1]*H*.35],H*.13,0,[.35,.41,.30,0],sides+1);
  }else if(kind<.68){                            // swept, high-crowned fir
   const sweep=[lean[0]*H*.7,0,lean[1]*H*.7];
   const crown=p=>{const q=mid(p);return [q[0]+sweep[0],q[1],q[2]+sweep[2]];};
   bark.tube(foot,mid(.91),H*.034,H*.009,[.40,.44,.36,0],sides);
   bark.tube(crown(.43),crown(.83),H*.19,H*.07,[.30,.37,.28,0],sides+1);
   bark.tube(crown(.72),crown(1),H*.12,0,[.34,.39,.29,0],sides+1);
  }else if(kind<.88){                            // squat, broken broadleaf crown
   bark.tube(foot,mid(.56),H*.052,H*.027,[.44,.43,.36,0],sides);
   bark.tube(mid(.36),mid(.75),H*.25,H*.23,[.32,.38,.29,0],sides+1);
   bark.tube(mid(.69),mid(.92),H*.22,0,[.35,.40,.30,0],sides+1);
  }else{                                         // bare fork above low scrub
   bark.tube(foot,mid(.91),H*.043,H*.008,[.44,.44,.37,0],sides);
   bark.tube(mid(.53),[tx+H*.14,g+H*.81,tz-H*.11],H*.022,0,[.43,.42,.35,0],3);
  }
 };

 // A lichened lump: a jittered base ring, a smaller jittered shoulder ring, and a cap. The
 // two rings matter -- a single apex made a pale pyramid that read as a tent on the slope at
 // 10-ridge-west. It goes in `farEarth` rather than `distant`, whose tint is .095/.115/.10 at
 // light .35: right for a mountain silhouette, wrong for a tor standing on lit moor. The
 // vertex colour is well under the ground's own so it stays a dark cool mass against warm
 // heath instead of catching the key light and glowing tan.
 const boulder=(x,z,r,h,seed)=>{
  const rand=rng(seed),g=height(x,z),n=6;
  const px=x+(rand()-.5)*r*.4,pz=z+(rand()-.5)*r*.4;
  const ring=k=>{const o=[];for(let m=0;m<n;m++){const a=m*Math.PI*2/n+.31,rr=r*k*(.74+rand()*.5);
   o.push([px+Math.cos(a)*rr,g+(k<1?h*.62:-r*.14)+(rand()-.5)*h*.12,pz+Math.sin(a)*rr]);}return o;};
  const lo=ring(1),hi=ring(.46),cap=[px,g+h,pz];
  const tint=t=>{const c=.29+rand()*.09;return [c*.97,c,c*1.10+t,0];};
  for(let m=0;m<n;m++){
   farEarth.quad(lo[m],lo[(m+1)%n],hi[(m+1)%n],hi[m],[[0,0],[.3,0],[.3,.3],[0,.3]],tint(0));
   farEarth.tri(hi[m],hi[(m+1)%n],cap,[[0,0],[.3,0],[.15,.3]],tint(.03));
  }
 };

 // Jittered grove centres give broad empty runs between irregular thickets. A local
 // three-by-three lookup keeps distant placement deterministic without a new mesh.
 const groveHash=(x,z,s)=>{const v=Math.sin(x*127.1+z*311.7+s*74.7)*43758.5453;return v-Math.floor(v);};
 const grove=(x,z)=>{
  const cell=78,cx=Math.floor(x/cell),cz=Math.floor(z/cell);
  let cover=0;
  for(let iz=cz-1;iz<=cz+1;iz++)for(let ix=cx-1;ix<=cx+1;ix++){
   if(groveHash(ix,iz,0)<.24)continue;
   const px=(ix+.15+.7*groveHash(ix,iz,1))*cell;
   const pz=(iz+.15+.7*groveHash(ix,iz,2))*cell;
   const rx=25+22*groveHash(ix,iz,3),rz=23+27*groveHash(ix,iz,4);
   const d=Math.hypot((x-px)/rx,(z-pz)/rz);
   cover=Math.max(cover,1-smooth((d-.22)/.95));
  }
  return cover;
 };
 const SCAT=8;
 const edgeOf=(x,z)=>Math.max(Math.abs(x)-90,z-145,-95-z);
 let scatterTrees=0,scatterRocks=0;
 for(let z=-330;z<430;z+=SCAT)for(let x=-330;x<330;x+=SCAT){
  const jx=x+(rf()-.5)*SCAT*.98,jz=z+(rf()-.5)*SCAT*.98;
  const edge=edgeOf(jx,jz);
  const setback=28+8*Math.sin(jx*.032+jz*.011)+6*Math.sin(jz*.029-jx*.017);
  if(edge<setback)continue;
  const d=Math.hypot(jx,jz-40);
  if(d>325)continue;                             // stay inside the innermost mountain ring
  if(Math.abs(jx)<42&&jz>264&&jz<354)continue;   // the citadel keeps its own bare crag
  // Two uneven woods frame the keep from Hollowmere without filling the road.
  const northWoods=Math.max(
   .84*Math.exp(-((jx+61)**2+(jz-186)**2)/2100),
   .80*Math.exp(-((jx-72)**2+(jz-194)**2)/2600));
  const g=Math.max(grove(jx,jz),northWoods),roll=rf();
  const sides=edge<80?6:edge<160?4:3;
  const approach=smooth((edge-setback)/30);
  if(roll<(.045+.70*g*g)*approach){
   const H=(7+rf()*13)*(.60+.40*smooth((edge-setback)/72));
   farTree(jx,jz,H,sides,rf(),[(rf()-.5)*.18,(rf()-.5)*.18]);scatterTrees++;
  }else if(g<.30&&roll<.11){
   boulder(jx,jz,1.4+rf()*3.0,.9+rf()*1.7,81107+scatterRocks*7919);scatterRocks++;
  }
 }


 // --- Milestone 3, the horizon: the Citadel of Vaelmark on a distant crag beyond z=140, plus the
 // mountain ridgeline behind it. Backdrop only (no colliders, no pathing), added last and entirely
 // north of the playable boundsRect (maxZ:143 in main.js), so it cannot move a churchyard or
 // Hollowmere pixel — it only appends triangles to the existing 'distant'/'warm' batches.
 const citadelStone=new Batch('Vaelmark masonry'),horizonRock=new Batch('Horizon rock'),ridgeRock=new Batch('Distant mauve ridges');
 const horizonMaterials=await Promise.all([
  surface(engine,'Vaelmark weathered stone','/tex/rock_wall_08/diff.jpg',{tint:[.72,.73,.76],light:.62,skyFill:.40,pixels:256,uvScale:.20}),
  surface(engine,'Horizon slate','/ashen-reach/horizon-rock.jpg',{tint:[.37,.45,.54],light:.66,skyFill:.16,pixels:128}),
  surface(engine,'Sunlit distant ridges','/ashen-reach/horizon-rock.jpg',{tint:[1.05,.89,.96],light:.82,skyFill:.48,emission:.16,pixels:128}),
 ]);
 const horizonStats=buildHorizon(distant,warm,height,{stone:citadelStone,rock:horizonRock,ridge:ridgeRock});
 B.push(citadelStone,horizonRock,ridgeRock);mats.push(...horizonMaterials);

 function foliageDensity(x,z){
  if(z<=48)return meadow(x,z);
  if(z<76){
   const t=smooth((z-48)/28);
   return meadow(x,z)*(1-t)+clearance(x,z)*t;
  }
  if(z<=145&&Math.abs(x)<44)return clearance(x,z);
  // The hard zero at radius 108 is what starved the new outer moor band: 10-ridge-west puts
  // the camera at x=-80, just inside it, so everything west of the player was bare ground.
  // The cutoff moves to 190 and the falloff stretches over the whole run, so the meadow
  // thins into moor and then into the scattered woodland instead of stopping at a circle.
  const rad=Math.hypot(x,z-20);
  if(rad>190)return 0;
  return 0.38*(1-smooth((rad-52)/138));
 }
 const farTris=farEarth.idx.length/3;
 const meshes=B.map((b,i)=>b.commit(engine,scene,mats[i],lights)).filter(Boolean);
 const farMesh=farEarth.commit(engine,scene,mats[0],lights);
 if(farMesh)meshes.push(farMesh);
 const shaftPass=await createLightShafts(engine,scene,shafts);
 if(shaftPass?.mesh)meshes.push(shaftPass.mesh);
 const motePass=await createAshMotes(engine,scene,{lights});
 if(motePass?.mesh)meshes.push(motePass.mesh);
 colliders.unshift({type:'mesh',mesh:meshes[0]});const clouds=await sky(engine,scene);
 const stats={triangles:B.reduce((a,b)=>a+b.idx.length/3,0)+farTris,drawBatches:B.length+(farMesh?1:0)+(shaftPass?.mesh?1:0)+(motePass?.mesh?1:0),horizonTriangles:horizonStats.triangles,farTriangles:farTris,foliageInstances:0,scatterTrees,scatterRocks,shafts:shafts.length,shaftTriangles:shaftPass?.triangles??0,motes:motePass?.count??0,moteTriangles:motePass?.triangles??0};
 let foliage=null;
 const api={localLights,meshes,colliders,groundHeight:height,spawn:{x:0,z:0},buildingPads,lights,foliage:null,stats,whenFoliage:null,update(t,playerPos){
  foliage?.update(t,playerPos);clouds.update(t);shaftPass?.update(t);motePass?.update(t);
  // surface() materials declare a time uniform. Nothing else writes it, so the
  // haze drift stays at zero unless this loop runs.
  for(const m of mats)setShaderUniform(m,'time',t);
 }};
 // Grass and wildflowers stay off the first-frame download. Call startFoliage
 // once the player body is on screen; the meshes then join the fire-light list.
 api.startFoliage=()=>{
  api.whenFoliage??=createFoliage(engine,scene,{
   lights,density:foliageDensity,
   landmarks:[[-2,-2,1.45],[2.8,-2.1,1.5],[-2.5,4,1.3],[2.7,9,1.15],[-4,12,1.55]].map(([x,z,scale])=>({x,z,scale})),
  }).then((created)=>{
   foliage=created;
   api.foliage=created;
   meshes.push(...created.meshes);
   stats.drawBatches+=created.stats.draws;
   stats.foliageInstances=created.stats.instances;
   return created;
  });
  return api.whenFoliage;
 };
 return api;
}
