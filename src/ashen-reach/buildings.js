import {lanternGlow} from './geometry.js';

/**
 * A parameterised building: plinth + walls + gable roof + door + windows + optional chimney,
 * composed from primitive batches rather than hand-placed per structure. Sits on a flattened pad:
 * the floor is read once from `ctx.groundHeight(x,z)`, which is exactly level inside a pad
 * footprint (see geometry.js buildingPads), so no per-corner sampling is needed.
 *
 * `ctx`  = {wood, stone, glow, groundHeight, colliders, lights} — batches + world plumbing.
 * `spec` = {x,z,w,d,yaw=0,wallH=2.6,roofH=1.4,kind='house',windows=[],chimney=false}
 *   - yaw=0 puts the door on the local +x gable end; yaw=Math.PI flips it to face local -x.
 *     Hollowmere's pads sit either side of the street (x<0 / x>0), so west-side buildings use
 *     yaw=0 (door faces +x, toward the street) and east-side buildings use yaw=PI (door faces -x).
 *   - windows: [{wall: 1|-1 (which long wall, +d/2 or -d/2), lx=0, ly, w=.55, h=.6, strength=.35}]
 * Returns {gy, front:[x,y,z]} — the floor height and a world point just outside the door, for
 * placing forges, signs and other kind-specific dressing next to the entrance.
 */
export function building(ctx,spec){
 const {wood,stone,groundHeight,colliders,lights}=ctx;
 const {x,z,w,d,yaw=0,wallH=2.6,roofH=1.4,kind='house',windows=[],chimney=false}=spec;
 const gy=groundHeight(x,z);
 const cos=Math.cos(yaw),sin=Math.sin(yaw);
 const toWorld=(lx,ly,lz)=>[x+lx*cos+lz*sin,gy+ly,z-lx*sin+lz*cos];
 const stoneWalled=kind==='chapel'||kind==='watchtower'||kind==='smithy';
 const wallMat=stoneWalled?stone:wood;
 const wallColor=kind==='chapel'?[.66,.64,.58,0]:kind==='watchtower'?[.60,.58,.52,0]:kind==='smithy'?[.52,.48,.42,0]:kind==='tavern'?[.50,.38,.27,0]:[.55,.44,.32,0];
 const roofColor=kind==='chapel'?[.26,.24,.27,0]:[.30,.22,.15,0];
 const plinthY=.22,wallTopY=plinthY+wallH,wallT=.16;

 stone.box(toWorld(0,plinthY/2,0),[w+.28,plinthY,d+.28],[.48,.48,.43,0],yaw);
 wallMat.box(toWorld(0,plinthY+wallH/2,-d/2),[w,wallH,wallT],wallColor,yaw);
 wallMat.box(toWorld(0,plinthY+wallH/2, d/2),[w,wallH,wallT],wallColor,yaw);
 wallMat.box(toWorld(-w/2+wallT/2,plinthY+wallH/2,0),[wallT,wallH,d],wallColor,yaw);
 wallMat.box(toWorld( w/2-wallT/2,plinthY+wallH/2,0),[wallT,wallH,d],wallColor,yaw);
 if(!stoneWalled)for(const cx of [-w/2,w/2])for(const cz of [-d/2,d/2])
  wood.box(toWorld(cx,plinthY+wallH/2,cz),[.10,wallH,.10],[.34,.25,.17,0],yaw);

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
  }
 }
 colliders.push({type:'box',position:{x,y:gy+(plinthY+wallH)/2,z},size:{x:w+.3,y:plinthY+wallH,z:d+.3},rotation:{y:yaw}});
 return {gy,front:toWorld(w/2+.5,0,0)};
}

/** A window: a warm bright pane, a larger and dimmer pane set back into the wall to fake a soft
 *  glow falloff (no real transparency available), and a timber sill/lintel/mullion frame so it
 *  reads as glass in a wall rather than a flat coloured rectangle. Registers a baked point light. */
function windowGlow(ctx,center,yaw,w,h,side,strength,lights){
 const {glow,wood}=ctx;
 const s=Math.sin(yaw),c=Math.cos(yaw);
 const out=[s*side,0,c*side],right=[c,0,-s];
 const at=(rx,ry,off=0)=>[center[0]+right[0]*rx+out[0]*off,center[1]+ry,center[2]+right[2]*rx+out[2]*off];
 glow.quad(at(-w/2,-h/2,.02),at(w/2,-h/2,.02),at(w/2,h/2,.02),at(-w/2,h/2,.02),undefined,[1,.96,.9,0]);
 const hw=w*.7,hh=h*.65;
 glow.quad(at(-hw,-hh,-.01),at(hw,-hh,-.01),at(hw,hh,-.01),at(-hw,hh,-.01),undefined,[.36,.32,.27,0]);
 wood.box(at(0,-h/2-.05,.03),[w+.12,.07,.10],[.26,.19,.13,0],yaw);
 wood.box(at(0,h/2+.05,.03),[w+.12,.07,.10],[.26,.19,.13,0],yaw);
 wood.box(at(0,0,.02),[.05,h,.06],[.24,.17,.12,0],yaw);
 lights.push({position:at(0,0,.15),strength,falloff:.65});
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
 lanternGlow(glow,P(0,postH+.02,0),{r:.06,h:.16});
 lights.push({position:P(0,postH+.02,0),strength:.3,falloff:.6});
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
 lanternGlow(glow,[x,ridgeY-.18,z],{r:.10,h:.22});
 lights.push({position:[x,ridgeY-.18,z],strength:.6,falloff:.48});
 colliders.push({type:'box',position:{x,y:gy+wallH/2,z},size:{x:r*2,y:wallH,z:r*2},rotation:{y:0}});
}

/** Smithy dressing: a hearth block and a bright red-orange forge glow beside the door, plus an
 *  anvil silhouette. Uses the same lanternGlow shape as lamps and windows but a hotter tint, so it
 *  reads as fire rather than another lantern. */
export function forgeGlow(ctx,x,z,yaw){
 const {glow,stone,groundHeight,lights}=ctx;
 const gy=groundHeight(x,z);
 const s=Math.sin(yaw),c=Math.cos(yaw);
 const P=(lx,ly,lz)=>[x+lx*c+lz*s,gy+ly,z-lx*s+lz*c];
 stone.box(P(0,.35,0),[1.0,.7,.85],[.35,.33,.30,0],yaw);
 lanternGlow(glow,P(0,.6,.42),{r:.24,h:.4,tint:[1.5,.55,.16],dim:.5});
 lights.push({position:P(0,.62,.35),strength:.95,falloff:.42});
 stone.box(P(.55,.28,-.15),[.3,.46,.3],[.24,.23,.22,0],yaw);
}

/** A small wooden cross finial for the chapel's ridge. */
export function crossFinial(ctx,center){
 const {wood}=ctx;
 wood.tube([center[0],center[1],center[2]],[center[0],center[1]+.5,center[2]],.03,.02,[.30,.28,.30,0],4);
 wood.tube([center[0]-.17,center[1]+.34,center[2]],[center[0]+.17,center[1]+.34,center[2]],.025,.025,[.30,.28,.30,0],4);
}
