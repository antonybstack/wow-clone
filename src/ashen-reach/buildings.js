import {lanternGlow,radialGlow,groundGlow} from './geometry.js';

/**
 * A parameterised building: plinth + walls + gable roof + door + windows + optional chimney,
 * composed from primitive batches rather than hand-placed per structure. Sits on a flattened pad:
 * the floor is read once from `ctx.groundHeight(x,z)`, which is exactly level inside a pad
 * footprint (see geometry.js buildingPads), so no per-corner sampling is needed.
 *
 * `ctx`  = {wood, stone, glow, groundHeight, colliders, lights} — batches + world plumbing.
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
 const {wood,stone,groundHeight,colliders,lights,glow}=ctx;
 const {x,z,w,d,yaw=0,wallH=2.6,roofH=1.4,kind='house',windows=[],chimney=false,
  upper=false,upperH=null,leanTo=0,sign=false,steeple=false}=spec;
 const gy=groundHeight(x,z);
 const cos=Math.cos(yaw),sin=Math.sin(yaw);
 const toWorld=(lx,ly,lz)=>[x+lx*cos+lz*sin,gy+ly,z-lx*sin+lz*cos];
 const stoneWalled=kind==='chapel'||kind==='watchtower'||kind==='smithy';
 const wallMat=stoneWalled?stone:wood;
 const wallColor=kind==='chapel'?[.66,.64,.58,0]:kind==='watchtower'?[.60,.58,.52,0]:kind==='smithy'?[.52,.48,.42,0]:kind==='tavern'?[.50,.38,.27,0]:[.55,.44,.32,0];
 const roofColor=kind==='chapel'?[.26,.24,.27,0]:[.30,.22,.15,0];
 const plinthY=.22,lowerTopY=plinthY+wallH,wallT=.16;
 const upH=(upper&&kind!=='watchtower')?(upperH??wallH*.5):0;
 const wallTopY=lowerTopY+upH;

 stone.box(toWorld(0,plinthY/2,0),[w+.28,plinthY,d+.28],[.48,.48,.43,0],yaw);
 wallMat.box(toWorld(0,plinthY+wallH/2,-d/2),[w,wallH,wallT],wallColor,yaw);
 wallMat.box(toWorld(0,plinthY+wallH/2, d/2),[w,wallH,wallT],wallColor,yaw);
 wallMat.box(toWorld(-w/2+wallT/2,plinthY+wallH/2,0),[wallT,wallH,d],wallColor,yaw);
 wallMat.box(toWorld( w/2-wallT/2,plinthY+wallH/2,0),[wallT,wallH,d],wallColor,yaw);
 if(!stoneWalled)for(const cx of [-w/2,w/2])for(const cz of [-d/2,d/2])
  wood.box(toWorld(cx,plinthY+wallH/2,cz),[.10,wallH,.10],[.34,.25,.17,0],yaw);

 if(upH>0){
  // A second storey, inset a little for a jetty-style break in the silhouette, with a wood trim
  // course marking the floor division. Only reachable off the gable-roof path (watchtower excluded
  // above), so `wallTopY` below (used by the roof/gable/chimney code) already includes it.
  const uw=w-.5,ud=d-.5;
  wood.box(toWorld(0,lowerTopY+.03,0),[w+.22,.10,d+.22],[.30,.22,.15,0],yaw);
  wallMat.box(toWorld(0,lowerTopY+upH/2,-ud/2),[uw,upH,wallT],wallColor,yaw);
  wallMat.box(toWorld(0,lowerTopY+upH/2, ud/2),[uw,upH,wallT],wallColor,yaw);
  wallMat.box(toWorld(-uw/2+wallT/2,lowerTopY+upH/2,0),[wallT,upH,ud],wallColor,yaw);
  wallMat.box(toWorld( uw/2-wallT/2,lowerTopY+upH/2,0),[wallT,upH,ud],wallColor,yaw);
 }

 if(leanTo){
  // A small mono-pitch shed against one long wall (+d/2 for leanTo:1, -d/2 for leanTo:-1) — the
  // cheaper alternative to a full upper storey for breaking up an otherwise-identical box.
  const side=leanTo,lw=w*.55,ld=1.35,lh=wallH*.62,lx0=-w/2+lw/2+.35;
  const lz0=side*(d/2+ld/2);
  wood.box(toWorld(lx0,plinthY+lh/2,lz0),[lw,lh,ld],wallColor,yaw);
  const hiY=plinthY+lh+.05,loY=plinthY+wallH*.42;
  wood.quad(
   toWorld(lx0-lw/2-.12,hiY,side*d/2),toWorld(lx0+lw/2+.12,hiY,side*d/2),
   toWorld(lx0+lw/2+.12,loY,lz0+side*ld/2+.12),toWorld(lx0-lw/2-.12,loY,lz0+side*ld/2+.12),
   undefined,roofColor);
  colliders.push({type:'box',position:{x:toWorld(lx0,0,lz0)[0],y:gy+lh/2,z:toWorld(lx0,0,lz0)[2]},size:{x:lw+.2,y:lh,z:ld+.2},rotation:{y:yaw}});
 }

 if(kind==='watchtower'){
  // Flat battlement instead of a gable roof: a square parapet ring of merlons and a beacon.
  const topY=wallTopY+.12;
  stone.box(toWorld(0,topY,0),[w+.16,.14,d+.16],[.5,.5,.45,0],yaw);
  const n=10;
  for(let k=0;k<n;k++){const t=(k+.5)/n-.5,along=t*(k%2===0?w:d)*1.02;
   if(k<n/2)stone.box(toWorld(along,topY+.28,-d/2),[.42,.5,.16],[.52,.52,.47,0],yaw);
   else stone.box(toWorld(along,topY+.28,d/2),[.42,.5,.16],[.52,.52,.47,0],yaw);
  }
  for(const s of [-1,1]){stone.box(toWorld(-w/2,topY+.28,s*d/2*.55),[.16,.5,.42],[.52,.52,.47,0],yaw);stone.box(toWorld(w/2,topY+.28,s*d/2*.55),[.16,.5,.42],[.52,.52,.47,0],yaw);}
  lanternGlow(ctx.glow,toWorld(0,topY+.55,0),{r:.16,h:.38});
  lights.push({position:toWorld(0,topY+.55,0),strength:.85,falloff:.4});
  for(const win of windows){
   const p=toWorld(win.lx??0,win.ly??wallTopY*0.55,(win.wall??1)*(d/2+.02));
   lanternGlow(ctx.glow,p,{r:.045,h:.32});
   lights.push({position:p,strength:win.strength??.22,falloff:.7});
  }
 }else{
  const ridgeY=wallTopY+roofH,eaveY=wallTopY+.08,overhang=.45,halfD=d/2+overhang,halfW=w/2+.15;
  wood.quad(toWorld(-halfW,eaveY,-halfD),toWorld(halfW,eaveY,-halfD),toWorld(halfW,ridgeY,0),toWorld(-halfW,ridgeY,0),undefined,roofColor);
  wood.quad(toWorld(-halfW,ridgeY,0),toWorld(halfW,ridgeY,0),toWorld(halfW,eaveY,halfD),toWorld(-halfW,eaveY,halfD),undefined,roofColor);
  wood.tube(toWorld(-halfW,ridgeY,0),toWorld(halfW,ridgeY,0),.06,.06,[.24,.18,.12,0],4);
  wallMat.tri(toWorld(-w/2,wallTopY,-d/2),toWorld(-w/2,wallTopY,d/2),toWorld(-w/2,ridgeY,0),undefined,wallColor);
  wallMat.tri(toWorld(w/2,wallTopY,d/2),toWorld(w/2,wallTopY,-d/2),toWorld(w/2,ridgeY,0),undefined,wallColor);

  // Door on the local +x gable end (see yaw convention above).
  const doorW=.8,doorH=1.55;
  wood.box(toWorld(w/2+.02,plinthY+doorH/2,0),[.06,doorH,doorW],[.22,.15,.10,0],yaw);
  wood.box(toWorld(w/2+.06,plinthY+doorH+.06,0),[.06,.10,doorW+.15],[.30,.22,.15,0],yaw);

  for(const win of windows)windowGlow(ctx,toWorld(win.lx??0,win.ly??(plinthY+wallH*.62),(win.wall??1)*(d/2+.015)),yaw,win.w??.55,win.h??.6,win.wall??1,win.strength??.35,lights);

  if(chimney){
   const cx=w*.28,cz=0,cTop=ridgeY+.55;
   stone.box(toWorld(cx,(wallTopY+cTop)/2,cz),[.34,cTop-wallTopY,.34],[.42,.4,.38,0],yaw);
   stone.box(toWorld(cx,cTop+.06,cz),[.46,.10,.46],[.38,.36,.34,0],yaw);
   // Smoke wisp: a short chain of gradient tubes widening and fading toward the fog colour as
   // they rise, faked with vertex colour (this material system has no real alpha) rather than a
   // particle or blend-mode effect. Gives the roofline a lived-in, smoke-stack silhouette.
   let prevP=toWorld(cx,cTop+.16,cz),prevR=.05,prevC=[.40,.40,.38,0];
   const fog=[.11,.13,.11,0];
   for(let s=1;s<=3;s++){
    const t=s/3,drift=Math.sin(s*1.9)*.05*s;
    const p=toWorld(cx+drift,cTop+.16+t*1.0,cz+Math.cos(s*1.4)*.04*s);
    const r=.05+t*.16;
    const c=[prevC[0]+(fog[0]-prevC[0])*.45,prevC[1]+(fog[1]-prevC[1])*.45,prevC[2]+(fog[2]-prevC[2])*.45,0];
    stone.tube(prevP,p,prevR,r,prevC,5,c);
    prevP=p;prevR=r;prevC=c;
   }
  }

  if(steeple){
   // A small belfry stub above the ridge with a tapered cap, so the chapel's roofline reads as a
   // chapel at a glance rather than just a tall gable. `steepleTop` lets the caller seat a cross
   // finial precisely on the apex.
   const stH=1.3,sw=.85,stTopY=ridgeY+stH;
   stone.box(toWorld(0,(ridgeY+stTopY)/2,0),[sw,stH,sw],[.58,.56,.50,0],yaw);
   stone.tube(toWorld(0,stTopY,0),toWorld(0,stTopY+.6,0),sw*.72,.02,[.30,.28,.26,0],4);
   var steepleTop=toWorld(0,stTopY+.6,0)[1];
  }

  if(sign){
   // The hanging board-and-bracket sign plus a small lantern beneath it, generalised from the
   // tavern's original hand-placed geometry so any building can carry one.
   const sx=w/2+.5;
   wood.box(toWorld(sx,2.05,0),[.9,.5,.05],[.42,.28,.14,0],yaw);
   wood.tube(toWorld(sx,2.55,0),toWorld(sx,2.3,0),.02,.02,[.2,.15,.1,0],4);
   lanternGlow(glow,toWorld(sx,1.95,0),{r:.05,h:.12});
   lights.push({position:toWorld(sx,1.95,0),strength:.3,falloff:.65});
  }
 }
 colliders.push({type:'box',position:{x,y:gy+wallTopY/2,z},size:{x:w+.3,y:wallTopY,z:d+.3},rotation:{y:yaw}});
 return {gy,front:toWorld(w/2+.5,0,0),steepleTop:typeof steepleTop!=='undefined'?steepleTop:undefined};
}

/** A window: a warm bright pane, a larger and dimmer pane set back into the wall to fake a soft
 *  glow falloff (no real transparency available), and a timber sill/lintel/mullion frame so it
 *  reads as glass in a wall rather than a flat coloured rectangle. Registers a baked point light,
 *  plus a small forward-poking glow nub (so the window still has visible volume from a grazing or
 *  top-down angle, where a flat pane flush with the wall nearly disappears) and a wall-wash — a
 *  radial gradient decal on the wall around the frame — so lamplight visibly spills onto the wall
 *  itself rather than registering only as a small bright rectangle. */
function windowGlow(ctx,center,yaw,w,h,side,strength,lights){
 const {glow,wood}=ctx;
 const s=Math.sin(yaw),c=Math.cos(yaw);
 const out=[s*side,0,c*side],right=[c,0,-s],up=[0,1,0];
 const at=(rx,ry,off=0)=>[center[0]+right[0]*rx+out[0]*off,center[1]+ry,center[2]+right[2]*rx+out[2]*off];
 radialGlow(glow,at(0,0,-.02),right,up,Math.max(w,h)*1.35,[.55,.46,.30,0],[0,0,0,0],8);
 glow.quad(at(-w/2,-h/2,.02),at(w/2,-h/2,.02),at(w/2,h/2,.02),at(-w/2,h/2,.02),undefined,[1,.96,.9,0]);
 const hw=w*.7,hh=h*.65;
 glow.quad(at(-hw,-hh,-.01),at(hw,-hh,-.01),at(hw,hh,-.01),at(-hw,hh,-.01),undefined,[.36,.32,.27,0]);
 lanternGlow(glow,at(0,0,.10),{r:w*.22,h:h*.4,tint:[1,.9,.72],dim:.45,sides:5});
 wood.box(at(0,-h/2-.05,.03),[w+.12,.07,.10],[.26,.19,.13,0],yaw);
 wood.box(at(0,h/2+.05,.03),[w+.12,.07,.10],[.26,.19,.13,0],yaw);
 wood.box(at(0,0,.02),[.05,h,.06],[.24,.17,.12,0],yaw);
 lights.push({position:at(0,0,.15),strength,falloff:.65});
 lights.push({position:at(0,-h*.9,.5),strength:strength*.55,falloff:.5}); // spill onto the ground below
}

/** A single-slope market awning over a plank counter, on four thin posts. No walls, so no
 *  collider is strictly required to keep the player out, but a shallow box stops clipping the
 *  counter and posts. */
export function marketStall(ctx,x,z,yaw=0){
 const {wood,glow,groundHeight,colliders,lights}=ctx;
 const gy=groundHeight(x,z);
 const s=Math.sin(yaw),c=Math.cos(yaw);
 const P=(lx,ly,lz)=>[x+lx*c+lz*s,gy+ly,z-lx*s+lz*c];
 const w=1.7,d=1.15,postH=1.65,roofH=.55;
 for(const [px,pz] of [[-w/2,-d/2],[w/2,-d/2],[-w/2,d/2],[w/2,d/2]])
  wood.tube(P(px,0,pz),P(px,postH,pz),.045,.035,[.34,.26,.18,0],5);
 wood.quad(P(-w/2-.25,postH,-d/2-.25),P(w/2+.25,postH,-d/2-.25),P(w/2+.25,postH+roofH,d/2+.25),P(-w/2-.25,postH+roofH,d/2+.25),undefined,[.42,.28,.15,0]);
 wood.box(P(0,.55,0),[w*.82,.5,d*.8],[.40,.30,.20,0],yaw);
 for(const [dx,dz] of [[-w*.22,0],[w*.18,.1]])wood.box(P(dx,.85,dz),[.22,.14,.16],[.55,.32,.16,0],yaw);
 lanternGlow(glow,P(0,postH+.02,0),{r:.07,h:.18});
 groundGlow(glow,P(0,.02,0),[1,0,0],[0,0,1],.45,1.3,[1.0,.86,.55,0],[.24,.19,.11,0],8);
 lights.push({position:P(0,postH+.02,0),strength:.42,falloff:.55});
 colliders.push({type:'box',position:{x,y:gy+postH*.5,z},size:{x:w+.25,y:postH,z:d+.25},rotation:{y:yaw}});
}

/** The well square's centrepiece: a low stone ring, two posts, a peaked shelter roof, a rope and
 *  bucket, and a hanging lantern that lights the whole plaza (baked, so it costs nothing extra). */
export function well(ctx,x,z){
 const {stone,wood,glow,groundHeight,colliders,lights}=ctx;
 const gy=groundHeight(x,z);
 const r=.9,wallH=.6;
 stone.tube([x,gy,z],[x,gy+wallH,z],r,r,[.54,.54,.48,0],10);
 stone.tube([x,gy+wallH,z],[x,gy+wallH+.08,z],r+.08,r+.08,[.5,.5,.45,0],10);
 for(const [px,pz] of [[0,-r*.8],[0,r*.8]])
  wood.tube([x+px,gy+wallH,z+pz],[x+px,gy+wallH+1.6,z+pz],.06,.05,[.32,.24,.16,0],5);
 const ridgeY=gy+wallH+2.0;
 wood.quad([x-.9,gy+wallH+1.6,z-1.0],[x-.9,gy+wallH+1.6,z+1.0],[x,ridgeY,z+1.0],[x,ridgeY,z-1.0],undefined,[.34,.24,.16,0]);
 wood.quad([x,ridgeY,z-1.0],[x,ridgeY,z+1.0],[x+.9,gy+wallH+1.6,z+1.0],[x+.9,gy+wallH+1.6,z-1.0],undefined,[.34,.24,.16,0]);
 wood.tube([x,gy+wallH+1.55,z],[x,gy+wallH+.55,z],.014,.014,[.2,.2,.2,0],4);
 wood.tube([x,gy+wallH+.55,z],[x,gy+wallH+.35,z],.09,.09,[.30,.22,.15,0],6);
 lanternGlow(glow,[x,ridgeY-.18,z],{r:.12,h:.26});
 groundGlow(glow,[x,gy+.02,z],[1,0,0],[0,0,1],.9,2.6,[1.0,.86,.55,0],[.24,.19,.11,0],10);
 lights.push({position:[x,ridgeY-.18,z],strength:.95,falloff:.4});
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
 lights.push({position:P(0,.64,.20),strength:1.1,falloff:.4});
 lights.push({position:P(0,.05,.55),strength:.5,falloff:.55}); // spill onto the ground apron
 stone.box(P(.62,.26,-.28),[.28,.42,.28],[.22,.21,.20,0],yaw); // anvil silhouette
}

/** A small wooden cross finial for the chapel's ridge. */
export function crossFinial(ctx,center){
 const {wood}=ctx;
 wood.tube([center[0],center[1],center[2]],[center[0],center[1]+.5,center[2]],.03,.02,[.30,.28,.30,0],4);
 wood.tube([center[0]-.17,center[1]+.34,center[2]],[center[0]+.17,center[1]+.34,center[2]],.025,.025,[.30,.28,.30,0],4);
}
