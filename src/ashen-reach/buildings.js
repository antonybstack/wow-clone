import {lanternGlow,radialGlow} from './geometry.js';

/** Limestone uses uvScale 0.20, so a 0–1 UV shows only ~1.6 texture stones and
 *  stretches them into planks on a house wall. Scale UVs so one atlas cobble is
 *  about 0.45 m on town masonry. Churchyard never calls these. */
const COBBLE_UV_SCALE=0.20;
const MASONRY_UV_PER_M=(1/8/0.45)/COBBLE_UV_SCALE;
function masonryUV(fw,fh){
 const u=Math.max(.08,fw)*MASONRY_UV_PER_M,v=Math.max(.08,fh)*MASONRY_UV_PER_M;
 return [[0,v],[u,v],[u,0],[0,0]];
}
export function masonryBox(stone,center,size,color,yaw=0){
 const [x,y,z]=center,[w,h,d]=size;
 const c=Math.cos(yaw),s=Math.sin(yaw);
 const P=(a,b,cz)=>[x+a*c+cz*s,y+b,z-a*s+cz*c];
 const v=[P(-w/2,-h/2,-d/2),P(w/2,-h/2,-d/2),P(w/2,h/2,-d/2),P(-w/2,h/2,-d/2),
          P(-w/2,-h/2, d/2),P(w/2,-h/2, d/2),P(w/2,h/2, d/2),P(-w/2,h/2, d/2)];
 stone.quad(v[0],v[1],v[2],v[3],masonryUV(w,h),color);
 stone.quad(v[5],v[4],v[7],v[6],masonryUV(w,h),color);
 stone.quad(v[4],v[0],v[3],v[7],masonryUV(d,h),color);
 stone.quad(v[1],v[5],v[6],v[2],masonryUV(d,h),color);
 stone.quad(v[3],v[2],v[6],v[7],masonryUV(w,d),color);
 stone.quad(v[4],v[5],v[1],v[0],masonryUV(w,d),color);
}
function masonryQuad(stone,a,b,c,d,color){
 const w=Math.hypot(b[0]-a[0],b[1]-a[1],b[2]-a[2]);
 const h=Math.hypot(d[0]-a[0],d[1]-a[1],d[2]-a[2]);
 stone.quad(a,b,c,d,masonryUV(w,h),color);
}
function masonryTri(stone,a,b,c,color){
 const w=Math.hypot(b[0]-a[0],b[1]-a[1],b[2]-a[2]);
 const h=Math.hypot(c[0]-a[0],c[1]-a[1],c[2]-a[2]);
 const u=Math.max(.08,w)*MASONRY_UV_PER_M,v=Math.max(.08,h)*MASONRY_UV_PER_M;
 stone.tri(a,b,c,[[0,0],[u,0],[u*.5,v]],color);
}

/**
 * A parameterised building: plinth + walls + gable roof + door + windows + optional chimney,
 * composed from primitive batches rather than hand-placed per structure. Sits on a flattened pad:
 * the floor is read once from `ctx.groundHeight(x,z)`, which is exactly level inside a pad
 * footprint (see geometry.js buildingPads), so no per-corner sampling is needed.
 *
 * `ctx`  = {stone, glow, groundHeight, colliders, lights} — batches + world plumbing.
 * `spec` = {x,z,w,d,yaw=0,wallH=2.6,roofH=1.4,kind='house',windows=[],chimney=false,
 *           upper=false,upperH,leanTo=0,sign=false,steeple=false}
 *   - yaw=0 puts the door on the local +x gable end; yaw=Math.PI flips it to face local -x.
 *     Hollowmere's pads sit either side of the street (x<0 / x>0), so west-side buildings use
 *     yaw=0 (door faces +x, toward the street) and east-side buildings use yaw=PI (door faces -x).
 *   - windows: [{wall: 1|-1 (which long wall, +d/2 or -d/2), lx=0, ly, w=.55, h=.6, strength=.35}]
 *   - upper: adds an inset second-storey band (height `upperH`, default wallH*.5) with a jetty
 *     trim course, for silhouette variety. Only meaningful on the gable-roof (non-watchtower) path.
 *   - leanTo: -1|1|0. When non-zero, attaches a small mono-pitch shed to that long wall (+d/2 for
 *     1, -d/2 for -1) — the other silhouette-variety option, cheaper than a full upper storey.
 *   - sign: adds a hanging board-and-bracket sign just outside the door with a small lantern under
 *     it (this is the tavern-sign geometry, generalised so any building can carry one).
 *   - steeple: adds a small belfry stub with a tapered cap above the ridge; returns `steepleTop`
 *     (world Y of its apex) so a cross or finial can be seated on it precisely.
 * Returns {gy, front:[x,y,z], steepleTop?} — the floor height and a world point just outside the
 * door, for placing forges, signs and other kind-specific dressing next to the entrance.
 */
export function building(ctx,spec){
 const {stone,groundHeight,colliders,lights,glow}=ctx;
 const {x,z,w,d,yaw=0,wallH=2.6,roofH=1.4,kind='house',windows=[],chimney=false,
  upper=false,upperH=null,leanTo=0,sign=false,steeple=false}=spec;
 const gy=groundHeight(x,z);
 const cos=Math.cos(yaw),sin=Math.sin(yaw);
 const toWorld=(lx,ly,lz)=>[x+lx*cos+lz*sin,gy+ly,z-lx*sin+lz*cos];
 const ruin=!!spec.ruin;
 const wallColor=kind==='chapel'?[.62,.60,.56,0]:kind==='watchtower'?[.58,.56,.52,0]:kind==='smithy'?[.52,.50,.46,0]:kind==='tavern'?[.56,.54,.50,0]:[.54,.52,.48,0];
 const lift=(c,s)=>[Math.min(1,c[0]*s),Math.min(1,c[1]*s),Math.min(1,c[2]*s),0];
 // Street gable (door wall) is the elevation you see from the road; lift it so wall/roof/door
 // still separate at ~15 m. Sides stay closer to the authored colour; the back gable is darker.
 const gableColor=lift(wallColor,1.38);
 const sideColor=lift(wallColor,1.16);
 const backColor=lift(wallColor,0.86);
 const roofColor=kind==='chapel'?[.28,.26,.28,0]:[.34,.32,.30,0];
 const plinthY=.22,lowerTopY=plinthY+wallH,wallT=.16;
 const upH=(upper&&kind!=='watchtower')?(upperH??wallH*.5):0;
 const wallTopY=lowerTopY+upH;

 masonryBox(stone,toWorld(0,plinthY/2,0),[w+.28,plinthY,d+.28],[.48,.48,.43,0],yaw);
 masonryBox(stone,toWorld(0,plinthY+wallH/2,-d/2),[w,wallH,wallT],sideColor,yaw);
 masonryBox(stone,toWorld(0,plinthY+wallH/2, d/2),[w,wallH,wallT],sideColor,yaw);
 masonryBox(stone,toWorld(-w/2+wallT/2,plinthY+wallH/2,0),[wallT,wallH,d],backColor,yaw);
 masonryBox(stone,toWorld( w/2-wallT/2,plinthY+wallH/2,0),[wallT,wallH,d],gableColor,yaw);
 for(const cx of [-w/2,w/2])for(const cz of [-d/2,d/2])
  masonryBox(stone,toWorld(cx,plinthY+wallH/2,cz),[.12,wallH,.12],[.40,.38,.34,0],yaw);

 if(upH>0){
  const uw=w-.5,ud=d-.5;
  masonryBox(stone,toWorld(0,lowerTopY+.03,0),[w+.22,.10,d+.22],[.42,.40,.36,0],yaw);
  masonryBox(stone,toWorld(0,lowerTopY+upH/2,-ud/2),[uw,upH,wallT],sideColor,yaw);
  masonryBox(stone,toWorld(0,lowerTopY+upH/2, ud/2),[uw,upH,wallT],sideColor,yaw);
  masonryBox(stone,toWorld(-uw/2+wallT/2,lowerTopY+upH/2,0),[wallT,upH,ud],backColor,yaw);
  masonryBox(stone,toWorld( uw/2-wallT/2,lowerTopY+upH/2,0),[wallT,upH,ud],gableColor,yaw);
 }

 if(leanTo){
  const side=leanTo,lw=w*.55,ld=1.35,lh=wallH*.62,lx0=-w/2+lw/2+.35;
  const lz0=side*(d/2+ld/2);
  masonryBox(stone,toWorld(lx0,plinthY+lh/2,lz0),[lw,lh,ld],sideColor,yaw);
  const hiY=plinthY+lh+.05,loY=plinthY+wallH*.42;
  masonryQuad(stone,
   toWorld(lx0-lw/2-.12,hiY,side*d/2),toWorld(lx0+lw/2+.12,hiY,side*d/2),
   toWorld(lx0+lw/2+.12,loY,lz0+side*ld/2+.12),toWorld(lx0-lw/2-.12,loY,lz0+side*ld/2+.12),
   roofColor);
  colliders.push({type:'box',position:{x:toWorld(lx0,0,lz0)[0],y:gy+lh/2,z:toWorld(lx0,0,lz0)[2]},size:{x:lw+.2,y:lh,z:ld+.2},rotation:{y:yaw}});
 }

 if(kind==='watchtower'){
  // Flat battlement instead of a gable roof: a square parapet ring of merlons and a beacon.
  const topY=wallTopY+.12;
  masonryBox(stone,toWorld(0,topY,0),[w+.16,.14,d+.16],[.5,.5,.45,0],yaw);
  const n=10;
  for(let k=0;k<n;k++){const t=(k+.5)/n-.5,along=t*(k%2===0?w:d)*1.02;
   if(k<n/2)masonryBox(stone,toWorld(along,topY+.28,-d/2),[.42,.5,.16],[.52,.52,.47,0],yaw);
   else masonryBox(stone,toWorld(along,topY+.28,d/2),[.42,.5,.16],[.52,.52,.47,0],yaw);
  }
  for(const s of [-1,1]){masonryBox(stone,toWorld(-w/2,topY+.28,s*d/2*.55),[.16,.5,.42],[.52,.52,.47,0],yaw);masonryBox(stone,toWorld(w/2,topY+.28,s*d/2*.55),[.16,.5,.42],[.52,.52,.47,0],yaw);}
  lanternGlow(ctx.glow,toWorld(0,topY+.55,0),{r:.16,h:.38});
  lights.push({position:toWorld(0,topY+.55,0),strength:.85,falloff:.4,radius:10});
  for(const win of windows){
   const p=toWorld(win.lx??0,win.ly??wallTopY*0.55,(win.wall??1)*(d/2+.02));
   lanternGlow(ctx.glow,p,{r:.045,h:.32});
   lights.push({position:p,strength:win.strength??.22,falloff:.7,radius:4});
  }
 }else{
  const ridgeY=wallTopY+roofH,eaveY=wallTopY+.08,overhang=.45,halfD=d/2+overhang,halfW=w/2+.15;
  if(!ruin){
   masonryQuad(stone,toWorld(-halfW,eaveY,-halfD),toWorld(halfW,eaveY,-halfD),toWorld(halfW,ridgeY,0),toWorld(-halfW,ridgeY,0),roofColor);
   masonryQuad(stone,toWorld(-halfW,ridgeY,0),toWorld(halfW,ridgeY,0),toWorld(halfW,eaveY,halfD),toWorld(-halfW,eaveY,halfD),roofColor);
   stone.tube(toWorld(-halfW,ridgeY,0),toWorld(halfW,ridgeY,0),.05,.05,[.30,.28,.26,0],4);
  }else{
   masonryQuad(stone,toWorld(-halfW,eaveY,-halfD),toWorld(halfW*.2,eaveY,-halfD),toWorld(-halfW*.1,ridgeY*.7,0),toWorld(-halfW,ridgeY*.9,0),roofColor);
  }
  masonryTri(stone,toWorld(-w/2,wallTopY,-d/2),toWorld(-w/2,wallTopY,d/2),toWorld(-w/2,ridgeY,0),backColor);
  if(!ruin)masonryTri(stone,toWorld(w/2,wallTopY,d/2),toWorld(w/2,wallTopY,-d/2),toWorld(w/2,ridgeY,0),gableColor);
  else masonryBox(stone,toWorld(w/2-wallT/2,wallTopY*.55,0),[wallT,wallTopY*.4,d*.55],[.40,.38,.34,0],yaw);

  const doorW=.8,doorH=1.55;
  if(ruin){
   masonryBox(stone,toWorld(w/2+.02,plinthY+doorH*.38,0),[.10,doorH*.76,doorW+.12],[.34,.32,.30,0],yaw);
  }else{
   masonryBox(stone,toWorld(w/2+.02,plinthY+doorH/2,0),[.08,doorH,doorW],[.30,.28,.26,0],yaw);
   masonryBox(stone,toWorld(w/2+.06,plinthY+doorH+.08,0),[.12,.16,doorW+.30],[.46,.44,.40,0],yaw);
  }

  const winStrength=ruin?.1:.2;
  for(const win of windows){
   if(ruin) darkWindow(ctx,toWorld(win.lx??0,win.ly??(plinthY+wallH*.62),(win.wall??1)*(d/2+.015)),yaw,win.w??.55,win.h??.6,win.wall??1);
   else windowGlow(ctx,toWorld(win.lx??0,win.ly??(plinthY+wallH*.62),(win.wall??1)*(d/2+.015)),yaw,win.w??.55,win.h??.6,win.wall??1,win.strength??winStrength,lights);
  }
  for(const lz of [-.95,.95]){
   if(ruin) darkWindow(ctx,toWorld(w/2+.015,plinthY+wallH*.58,lz),yaw,.40,.50,0);
   else windowGlow(ctx,toWorld(w/2+.015,plinthY+wallH*.58,lz),yaw,.40,.50,0,winStrength,lights);
  }
  if(!ruin){
   lanternGlow(glow,toWorld(w/2+.16,plinthY+doorH+.14,0),{r:.045,h:.11});
   lights.push({position:toWorld(w/2+.16,plinthY+doorH+.14,0),strength:.28,falloff:.6,radius:3.5});
  }

  if(chimney){
   const cx=w*.28,cz=0,cTop=ridgeY+.55;
   masonryBox(stone,toWorld(cx,(wallTopY+cTop)/2,cz),[.34,cTop-wallTopY,.34],[.42,.4,.38,0],yaw);
   masonryBox(stone,toWorld(cx,cTop+.06,cz),[.46,.10,.46],[.38,.36,.34,0],yaw);
  }

  if(steeple){
   const stH=1.3,sw=.85,stTopY=ridgeY+stH;
   masonryBox(stone,toWorld(0,(ridgeY+stTopY)/2,0),[sw,stH,sw],[.58,.56,.50,0],yaw);
   stone.tube(toWorld(0,stTopY,0),toWorld(0,stTopY+.6,0),sw*.72,.02,[.30,.28,.26,0],4);
   var steepleTop=toWorld(0,stTopY+.6,0)[1];
  }
 }
 colliders.push({type:'box',position:{x,y:gy+wallTopY/2,z},size:{x:w+.3,y:wallTopY,z:d+.3},rotation:{y:yaw}});
 return {gy,front:toWorld(w/2+.5,0,0),steepleTop:typeof steepleTop!=='undefined'?steepleTop:undefined};
}

/** A window: a warm bright pane, a larger and dimmer pane set back into the wall to fake a soft
 *  glow falloff (no real transparency available), and a timber sill/lintel/mullion frame so it
 *  reads as glass in a wall rather than a flat coloured rectangle. Registers a baked point light,
 *  plus a small forward-poking glow nub (so the window still has visible volume from a grazing or
 *  top-down angle, where a flat pane flush with the wall nearly disappears). A radial wall-wash
 *  was tried and rejected: opaque discs on this material read as hard orange blots. */
function darkWindow(ctx,center,yaw,w,h,side){
 const {stone}=ctx;
 const s=Math.sin(yaw),c=Math.cos(yaw);
 const out=side===0?[c,0,-s]:[s*side,0,c*side];
 const right=side===0?[s,0,c]:[c,0,-s];
 const at=(rx,ry,off=0)=>[center[0]+right[0]*rx+out[0]*off,center[1]+ry,center[2]+right[2]*rx+out[2]*off];
 stone.quad(at(-w/2,-h/2,.02),at(w/2,-h/2,.02),at(w/2,h/2,.02),at(-w/2,h/2,.02),undefined,[.16,.15,.13,0]);
 stone.box(at(0,-h/2-.04,.03),[w+.1,.06,.08],[.38,.36,.32,0],yaw);
}

function windowGlow(ctx,center,yaw,w,h,side,strength,lights){
 const {glow,stone}=ctx;
 const s=Math.sin(yaw),c=Math.cos(yaw);
 // side ±1: long walls (local ±z). side 0: door gable (local +x).
 const out=side===0?[c,0,-s]:[s*side,0,c*side];
 const right=side===0?[s,0,c]:[c,0,-s];
 const at=(rx,ry,off=0)=>[center[0]+right[0]*rx+out[0]*off,center[1]+ry,center[2]+right[2]*rx+out[2]*off];
 // No radial wall-wash: an opaque disc on this material always reads as a hard orange blot
 // (M2b/M3/M3b ground-decal failure, now on the wall). Spill is the pane, the frame, and the
 // radius-windowed point light; the wall box itself has only corner vertices so a baked hot
 // spot in the face centre cannot exist without tessellating the wall.
 glow.quad(at(-w/2,-h/2,.02),at(w/2,-h/2,.02),at(w/2,h/2,.02),at(-w/2,h/2,.02),undefined,[1,.96,.9,0]);
 const hw=w*.7,hh=h*.65;
 glow.quad(at(-hw,-hh,-.01),at(hw,-hh,-.01),at(hw,hh,-.01),at(-hw,hh,-.01),undefined,[.36,.32,.27,0]);
 lanternGlow(glow,at(0,0,.10),{r:w*.22,h:h*.4,tint:[1,.9,.72],dim:.45,sides:5});
 stone.box(at(0,-h/2-.05,.03),[w+.12,.07,.10],[.38,.36,.32,0],yaw);
 stone.box(at(0,h/2+.05,.03),[w+.12,.07,.10],[.38,.36,.32,0],yaw);
 stone.box(at(0,0,.02),[.05,h,.06],[.34,.32,.28,0],yaw);
 lights.push({position:at(0,0,.15),strength,falloff:.55,radius:4.5});
 lights.push({position:at(0,-h*.9,.5),strength:strength*.7,falloff:.5,radius:3.5});
}

/** Collapsed masonry counter — the timber stall is gone, the stone plinth remains. */
export function collapsedStall(ctx,x,z,yaw=0){
 const {stone,groundHeight,colliders}=ctx;
 const gy=groundHeight(x,z);
 const s=Math.sin(yaw),c=Math.cos(yaw);
 const P=(lx,ly,lz)=>[x+lx*c+lz*s,gy+ly,z-lx*s+lz*c];
 masonryBox(stone,P(0,.28,0),[1.45,.46,.72],[.48,.46,.42,0],yaw);
 masonryBox(stone,P(.35,.12,.42),[.55,.16,.38],[.42,.40,.36,0],yaw+.55);
 masonryBox(stone,P(-.4,.08,-.38),[.62,.14,.32],[.40,.38,.34,0],yaw-.4);
 colliders.push({type:'box',position:{x,y:gy+.28,z},size:{x:1.55,y:.5,z:.9},rotation:{y:yaw}});
}

/** Well square: stone ring, one standing pier, a stub lintel, fallen blocks. Lantern hangs
 *  from the surviving masonry so the plaza pool stays a baked fixture. */
export function well(ctx,x,z){
 const {stone,glow,groundHeight,colliders,lights}=ctx;
 const gy=groundHeight(x,z);
 const r=.9,wallH=.6;
 stone.tube([x,gy,z],[x,gy+wallH,z],r,r,[.54,.54,.48,0],10);
 stone.tube([x,gy+wallH,z],[x,gy+wallH+.08,z],r+.08,r+.08,[.5,.5,.45,0],10);
 masonryBox(stone,[x,gy+wallH+.85,z-r*.78],[.48,1.7,.52],[.50,.48,.44,0]);
 masonryBox(stone,[x,gy+wallH+.28,z+r*.78],[.44,.56,.48],[.46,.44,.40,0]);
 masonryBox(stone,[x+.05,gy+wallH+1.72,z-.18],[.56,.30,1.25],[.48,.46,.42,0],.07);
 masonryBox(stone,[x+1.2,gy+.13,z+.4],[.50,.22,1.2],[.44,.42,.38,0],.72);
 masonryBox(stone,[x+.5,gy+.09,z+1.2],[.76,.16,.46],[.42,.40,.36,0],-.32);
 stone.tube([x,gy+wallH+1.78,z-.18],[x,gy+wallH+.48,z],.012,.012,[.22,.22,.22,0],4);
 stone.tube([x,gy+wallH+.48,z],[x,gy+wallH+.32,z],.08,.07,[.46,.44,.40,0],6);
 const lampY=gy+wallH+1.86;
 lanternGlow(glow,[x,lampY,z-.18],{r:.12,h:.26});
 lights.push({position:[x,lampY,z-.18],strength:.95,falloff:.4,radius:8});
 lights.push({position:[x,gy+.18,z],strength:1.3,falloff:.55,radius:6});
 colliders.push({type:'box',position:{x,y:gy+wallH/2,z},size:{x:r*2,y:wallH,z:r*2},rotation:{y:0}});
}

/** Smithy dressing: a stone hearth with a recessed coal bed and rising flame licks, plus an anvil
 *  silhouette. Same defect class as M1's flat emissive boxes: a single saturated tube reads as a
 *  hard-edged card, not fire. Fixed with shaped geometry and per-vertex colour falloff rather than
 *  a blend mode — a radial gradient ember bed (bright core fading to near-black rim) recessed into
 *  the hearth mouth, and several gradient-tube flame licks that taper from a bright base to a dark
 *  tip, unlike lanternGlow's uniform-colour tube. */
export function forgeGlow(ctx,x,z,yaw){
 const {glow,stone,groundHeight,lights}=ctx;
 const gy=groundHeight(x,z);
 const s=Math.sin(yaw),c=Math.cos(yaw);
 const P=(lx,ly,lz)=>[x+lx*c+lz*s,gy+ly,z-lx*s+lz*c];
 const out=[s,0,c],right=[c,0,-s],up=[0,1,0];
 const ember=[1.05,.40,.13,0],base=[.85,.30,.09,0],tip=[.09,.04,.02,0];
 stone.box(P(0,.34,0),[1.05,.62,.85],[.30,.28,.26,0],yaw);
 stone.box(P(0,.66,-.28),[1.05,.46,.22],[.34,.32,.30,0],yaw);
 // Coal bed: a bright radial gradient disc facing outward, recessed into the hearth's mouth
 // instead of floating in front of it, so it reads as embers rather than a hovering gem.
 radialGlow(glow,P(0,.60,.24),right,up,.30,ember,tip,8);
 // Flame licks: gradient tubes tapering from a saturated base to a dark tip.
 for(const [dx,h,r0,seedOff] of [[-.14,.30,.085,0],[.03,.42,.072,1],[.17,.26,.078,2]]){
  const bx=P(dx,.60,.12),tx=P(dx*.35+seedOff*.02,.60+h,.08);
  glow.tube(bx,tx,r0,.010,base,3,tip);
 }
 lanternGlow(glow,P(0,.70,.10),{r:.06,h:.14,tint:[1.0,.46,.16],dim:.4});
 lights.push({position:P(0,.64,.20),strength:1.3,falloff:.4,radius:6});
 lights.push({position:P(0,.05,.55),strength:.65,falloff:.55,radius:4.5}); // spill onto the ground apron
 stone.box(P(.62,.26,-.28),[.28,.42,.28],[.22,.21,.20,0],yaw); // anvil silhouette
}

/** Stone cross on the chapel steeple. */
export function crossFinial(ctx,center){
 const {stone}=ctx;
 stone.tube([center[0],center[1],center[2]],[center[0],center[1]+.5,center[2]],.03,.02,[.50,.48,.46,0],4);
 stone.tube([center[0]-.17,center[1]+.34,center[2]],[center[0]+.17,center[1]+.34,center[2]],.025,.025,[.50,.48,.46,0],4);
}

/** Coopered barrel. Collider is a short box so the player cannot walk through it. */
export function barrel(ctx,x,z){
 const {wood,groundHeight,colliders}=ctx;
 const gy=groundHeight(x,z);
 wood.tube([x,gy,z],[x,gy+.70,z],.26,.26,[.38,.26,.16,0],8);
 wood.tube([x,gy+.18,z],[x,gy+.22,z],.28,.28,[.28,.18,.11,0],8);
 wood.tube([x,gy+.48,z],[x,gy+.52,z],.28,.28,[.28,.18,.11,0],8);
 wood.tube([x,gy+.70,z],[x,gy+.76,z],.27,.18,[.32,.22,.14,0],8);
 colliders.push({type:'box',position:{x,y:gy+.35,z},size:{x:.52,y:.7,z:.52},rotation:{y:0}});
}

export function crate(ctx,x,z,yaw=0){
 const {wood,groundHeight,colliders}=ctx;
 const gy=groundHeight(x,z);
 wood.box([x,gy+.22,z],[.44,.44,.40],[.42,.32,.20,0],yaw);
 colliders.push({type:'box',position:{x,y:gy+.22,z},size:{x:.5,y:.44,z:.46},rotation:{y:yaw}});
}

/** Broken stone crossing: two piers, a stub lintel, the rest on the cobbles. */
export function stoneArch(ctx,z,span=8.0){
 const {stone,groundHeight}=ctx;
 const gy=groundHeight(0,z);
 const pierW=.78,pierH=2.7,half=span/2-.12;
 masonryBox(stone,[-half,gy+pierH/2,z],[pierW,pierH,1.1],[.50,.48,.44,0]);
 masonryBox(stone,[ half,gy+pierH*.38,z],[pierW,pierH*.76,1.1],[.46,.44,.40,0]);
 masonryBox(stone,[-half+1.35,gy+pierH+.2,z],[2.6,.42,1.2],[.48,.46,.42,0],.06);
 masonryBox(stone,[.4,gy+.2,z+.9],[1.15,.4,.7],[.42,.40,.36,0],.55);
 masonryBox(stone,[1.6,gy+.12,z+.35],[.7,.24,.5],[.40,.38,.34,0],-.3);
}

export function rubble(ctx,x,z,n=5){
 const {stone,groundHeight}=ctx;
 const gy=groundHeight(x,z);
 for(let i=0;i<n;i++){
  const a=i*1.37,r=.18+i*.07;
  stone.box([x+Math.cos(a)*r,gy+.08+i*.02,z+Math.sin(a)*r],[.28+i*.05,.12+i*.04,.22+i*.04],[.40+i*.02,.38,.34,0],a*.3);
 }
}

/** One fitted cobble. Top face samples a single stone from rock_wall_08. Irregular
 *  quad with a slightly larger base so the edge reads as a worn block, not a paper slab. */
function cobbleAtlasUV(rnd){
 const cols=8,rows=12,pad=0.006;
 const col=Math.floor(rnd()*cols),row=Math.floor(rnd()*rows);
 const u0=(col/cols+pad)/COBBLE_UV_SCALE,v0=(row/rows+pad)/COBBLE_UV_SCALE;
 const u1=((col+1)/cols-pad)/COBBLE_UV_SCALE,v1=((row+1)/rows-pad)/COBBLE_UV_SCALE;
 return [u0,v0,u1,v1];
}
export function flagstone(stone,cx,y,cz,w,d,yaw,color,rnd){
 const c=Math.cos(yaw),s=Math.sin(yaw);
 const W=(lx,ly,lz)=>[cx+lx*c+lz*s,ly,cz-lx*s+lz*c];
 const j=(a)=>(rnd()-.5)*a;
 const t=.038+rnd()*.028;
 const hw=w/2,hd=d/2;
 const p=[[-hw+j(w*.08),-hd+j(d*.08)],[hw+j(w*.08),-hd+j(d*.08)],[hw+j(w*.08),hd+j(d*.08)],[-hw+j(w*.08),hd+j(d*.08)]];
 const top=p.map(([lx,lz])=>W(lx,y+t,lz));
 const bot=p.map(([lx,lz])=>W(lx*1.07,y,lz*1.07));
 const [u0,v0,u1,v1]=cobbleAtlasUV(rnd);
 stone.quad(top[0],top[1],top[2],top[3],[[u0,v1],[u1,v1],[u1,v0],[u0,v0]],color,[0,1,0]);
 const side=[color[0]*.62,color[1]*.60,color[2]*.56,0];
 for(let i=0;i<4;i++){
  const n=(i+1)%4;
  stone.quad(bot[i],bot[n],top[n],top[i],undefined,side);
 }
}
