import {rng} from './geometry.js';

/** The Citadel of Vaelmark and the mountain ridgeline behind it — Milestone 3's horizon. Backdrop
 *  only: not traversable, so it has no colliders and no pathing, and it is deliberately built for
 *  silhouette rather than geometry density (a handful of towers, a wall, a few lit windows and the
 *  existing distance fog will read as "a citadel on a crag" far better than close-up ornament that
 *  nobody will ever walk up to). Everything here sits at z>=170, well past the player's
 *  boundsRect maxZ:143 in main.js, and reuses the churchyard's own 'Distant black stone' material
 *  (the same one scene.js's tower() already uses for the three distant bell towers) so the town's
 *  own background masses and the citadel read as one consistent dark, atmospheric silhouette
 *  rather than two competing palettes. Lit windows use the warm Hollowmere lantern material so
 *  they read as firelight against the cool stone and fog, the same convention Hollowmere itself
 *  uses. No new material/draw call is introduced for the mountains: the second, further ridgeline
 *  layer reads hazier than the first purely because it is further from the camera and the
 *  existing per-fragment distance fog (`materials.js`'s FOG term) blends it more toward the fog
 *  colour — real aerial perspective from a single reused opaque material, not a second blend mode.
 */

/** A single fortress tower: a stone shaft, four corner corbel-and-cap turrets, a parapet disc and
 *  a spiked roof finial, in the same primitive vocabulary as scene.js's existing distant tower()
 *  helper but parameterised by absolute height/width so it scales up to citadel size. `windowRows`
 *  lit warm window nubs are added down one face so the tower reads as inhabited from the town. */
function spire(distant,warm,x,z,groundY,H,w,windowRows=2){
 const g=groundY;
 distant.box([x,g+H*.40,z],[w,H*.80,w],[1,1,1,0]);
 for(let k=0;k<4;k++){
  const a=k*Math.PI/2+Math.PI/4;
  distant.tube([x+Math.sin(a)*w*.69,g,z+Math.cos(a)*w*.69],[x+Math.sin(a)*w*.63,g+H*.87,z+Math.cos(a)*w*.63],w*.16,w*.10,[.85,.88,.85,0],5);
  distant.tube([x+Math.sin(a)*w*.63,g+H*.87,z+Math.cos(a)*w*.63],[x+Math.sin(a)*w*.63,g+H*1.13,z+Math.cos(a)*w*.63],w*.27,0,[.6,.68,.62,0],5);
 }
 distant.box([x,g+H*.74,z],[w*1.13,H*.03,w*1.13],[.85,.88,.85,0]);
 distant.tube([x,g+H*.82,z],[x-w*.06,g+H*1.30,z],w*.90,.03,[.85,.88,.85,0],6);
 for(let j=0;j<windowRows;j++)
  warm.box([x-w*.10,g+H*(.50+j*.13),z-w*.502],[w*.16,H*.05,.03],[1,1,1,0]);
}

/** A short crenellated wall span between two points, matching townGate's silhouette (a wall slab
 *  plus a row of merlon boxes) but without the stair-step ramps a traversable gatehouse needs. */
function wallSpan(distant,x1,z1,x2,z2,groundY,H,T=1.6){
 const mx=(x1+x2)/2,mz=(z1+z2)/2,len=Math.hypot(x2-x1,z2-z1),yaw=Math.atan2(x2-x1,z2-z1);
 const wy=(groundY+groundY)/2;
 distant.box([mx,wy+H/2,mz],[len,H,T],[.92,.94,.9,0],yaw);
 const n=Math.max(3,Math.round(len/6));
 for(let k=0;k<n;k+=2){
  const t=(k+.5)/n,px=x1+(x2-x1)*t,pz=z1+(z2-z1)*t;
  distant.box([px,wy+H+.7,pz],[1.7,1.3,T*.8],[.95,.95,.92,0],yaw);
 }
}

/** A jagged rock outcrop under the citadel so it reads as sitting on a crag rather than floating:
 *  a handful of large flat-shaded triangles fanned around the base, cheap (one triangle each). */
function crag(distant,cx,cz,groundY,baseY,seed){
 const rand=rng(seed);
 for(let i=0;i<10;i++){
  const a=(i/10)*Math.PI*2,r=18+rand()*14;
  const x0=cx+Math.cos(a)*r,z0=cz+Math.sin(a)*r*.6;
  const a2=a+Math.PI*2/10*(1+rand()*.3),r2=18+rand()*14;
  const x1=cx+Math.cos(a2)*r2,z1=cz+Math.sin(a2)*r2*.6;
  const peakH=groundY+2+rand()*6;
  const c=[.5+rand()*.08,.5+rand()*.08,.46+rand()*.08,0];
  distant.tri([x0,baseY,z0],[x1,baseY,z1],[cx+Math.cos((a+a2)/2)*r*.3,peakH,cz+Math.sin((a+a2)/2)*r*.3*.6],undefined,c);
 }
}

/** Two layers of a jagged mountain skyline behind the citadel, spanning the full horizon width so
 *  it reads from any approach angle in town, not just squarely behind the citadel. Each layer is a
 *  single ribbon of quads (peak-to-peak), no new material: the far layer looks hazier than the
 *  near one purely from being further away and catching more of the existing distance fog. */
function ridgeline(distant,cz,groundY,seed,spanX,segments,hMin,hMax,zJitter,tint){
 const rand=rng(seed);
 const pts=[];
 for(let k=0;k<=segments;k++){
  const x=-spanX+(2*spanX)*(k/segments);
  const shape=Math.sin(k*.9+seed*.001)*.5+.5; // smoother, less noisy silhouette than pure random
  const h=hMin+(hMax-hMin)*(shape*.6+rand()*.4);
  const z=cz+rand()*zJitter;
  pts.push({x,h,z});
 }
 // M3b fix (ridgeline-floats defect): a shallow, constant base (-14) left a hard straight
 // bottom edge with the lighter, non-fog-matched sky dome visible beneath it from any camera that
 // pitched even slightly upward toward the ridge -- the classic "floating cardboard slab" look.
 // The sky dome shader (materials.js's sky()) never applies the scene's distance-fog term, so no
 // colour choice at the seam can blend it away; the only zero-triangle-cost fix is geometric: drop
 // the base far enough below grade that the angular elevation needed to see under it, from any
 // in-bounds camera position/height/pitch, exceeds what the frustum can show. -320 gives a wide
 // safety margin over the ~-135 the closest reachable overlook camera actually needs.
 const baseY=groundY-320;
 for(let k=0;k<segments;k++){
  const a=pts[k],b=pts[k+1];
  distant.quad([a.x,baseY,a.z],[b.x,baseY,b.z],[b.x,groundY+b.h,b.z],[a.x,groundY+a.h,a.z],undefined,tint);
 }
}

/** Closed mountain ring. Cheap (2 tris per segment) and uses the existing distant batch. */
/** Closed mountain curtain. The silhouette is the top edge, so it is the only thing that
 *  matters: a viewer 300 m away sees an outline and a tone and nothing else.
 *
 *  The first version drew 36-48 segments with an independent random height at each, which
 *  is white noise on a 30-80 m chord -- a sawtooth with no summits, no saddles and no
 *  repeated silhouette anywhere, which is exactly the "flat cardboard" read. Ridged noise
 *  instead (1 - |sin|, so the octave cusps upward at its zeros) gives peaks that are sharp
 *  and troughs that are broad, which is the shape erosion actually makes. Three octaves
 *  set how many summits the ring carries; `sharp` decides how alpine they are.
 *
 *  The radius wobbles too, by up to 14%. A perfect ellipse puts every peak at the same
 *  distance, so they all haze identically and the range collapses into one painted band;
 *  staggering them lets the near spurs overlap and occlude the far ones, and occlusion is
 *  the depth cue that survives when there is no stereo and no parallax. */
function ridgeRing(distant,cx,cz,rx,rz,groundY,seed,segments,hMin,hMax,tint,sharp=1.5){
 const rand=rng(seed),ph=[rand()*7,rand()*7,rand()*7],spin=rand()*7;
 const oct=(a,f,p)=>1-Math.abs(Math.sin(a*f*.5+p));
 const n=Math.max(segments,96);
 const pts=[];
 for(let k=0;k<n;k++){
  const a=k*Math.PI*2/n;
  let t=.52*oct(a,3,ph[0])+.30*oct(a,7,ph[1])+.18*oct(a,17,ph[2]);
  t=Math.pow(t,sharp);
  const wob=1+.14*Math.sin(a*2.4+spin)*Math.sin(a*5.1-spin);
  pts.push({x:cx+Math.cos(a)*rx*wob,z:cz+Math.sin(a)*rz*wob,h:hMin+(hMax-hMin)*t,t});
 }
 const baseY=groundY-320;
 // Summits sit in thinner air than the saddles below them, so they read fractionally paler
 // and cooler. It is a few percent, and it is what stops the curtain being one flat fill.
 const shade=q=>{const g=1+.13*q.t;return [tint[0]*g,tint[1]*g,tint[2]*(g+.03*q.t),0];};
 for(let k=0;k<n;k++){
  const a=pts[k],b=pts[(k+1)%n];
  distant.quad([a.x,baseY,a.z],[b.x,baseY,b.z],[b.x,groundY+b.h,b.z],[a.x,groundY+a.h,a.z],
   undefined,[shade(a),shade(b),shade(b),shade(a)]);
 }
}

/** An outlying keep on its own butte. The butte used to be a `scarp` skirt of radius 28 -- a
 *  56 m ring of near-black curtain laid flat on the hillside, which from the south vista read
 *  as dark tape looping over the crest and crossing the other keep's. `crag` is the primitive
 *  that already works for the citadel: a fan of triangles from a buried base up to jagged
 *  peaks, so it is a solid mass with a broken top edge rather than a painted band. `rise`
 *  lifts the keep onto the butte instead of leaving it standing at its foot. */
function mesaKeep(distant,warm,cx,cz,groundHeight,H=30,w=6,rise=16){
 const g=groundHeight(cx,cz);
 crag(distant,cx,cz,g+rise,g-30,((cx*73856093)^(cz*19349663))>>>0);
 crag(distant,cx-7,cz+5,g+rise*.7,g-30,((cx*83492791)^(cz*29587121))>>>0);
 spire(distant,warm,cx,cz,g+rise,H,w,3);
 wallSpan(distant,cx-16,cz-10,cx+16,cz-10,g+rise,8);
}

/** Builds the Citadel of Vaelmark on a distant crag and the ridgeline behind it. `distant` is the
 *  churchyard's shared 'Distant black stone' batch and `warm` is Hollowmere's warm lantern batch;
 *  `groundHeight` is geometry.js's height(). Returns a rough triangle count for reporting. */
export function buildHorizon(distant,warm,groundHeight){
 const before=distant.idx.length+warm.idx.length;
 // cz=260 (not 185): the first pass put the citadel close enough that its tallest tower (76
 // units) subtended roughly 90 degrees of view from the north edge of the reachable terrain
 // (z=143, only ~42 units from the citadel's front wall) — it filled the whole sky as a jagged
 // black mass rather than reading as a distant fortress. Pushing the whole complex back to
 // z=260 puts it ~117 units from the north edge, and scaling the towers down a little on top of
 // that keeps the tallest spire under ~40 degrees of view from there, comfortably "large on the
 // horizon" instead of "standing at its foot."
 const cz=260,cx=0;
 const groundY=groundHeight(cx,cz)+13; // a crag rises above the plain terrain height here
 const baseY=groundHeight(cx,cz)-1;

 crag(distant,cx,cz,groundY,baseY,44201);
 crag(distant,cx-6,cz+10,groundY+3,baseY,44299);

 // Curtain wall: a front wall with a gate gap, two side walls sweeping back to the rear corner
 // towers, roughly enclosing the keep behind it.
 const wallH=12;
 wallSpan(distant,-26,cz-8,-5.5,cz-8,groundY,wallH);
 wallSpan(distant,5.5,cz-8,26,cz-8,groundY,wallH);
 wallSpan(distant,-26,cz-8,-22,cz+6,groundY,wallH);
 wallSpan(distant,26,cz-8,22,cz+6,groundY,wallH);

 // Five towers: two flanking the gate, two rear corner towers, one tall central keep set back.
 spire(distant,warm,-9,cz-8,groundY,32,5.6,2);
 spire(distant,warm,9,cz-8,groundY,32,5.6,2);
 spire(distant,warm,-22,cz+6,groundY,38,6.4,3);
 spire(distant,warm,22,cz+6,groundY,38,6.4,3);
 spire(distant,warm,0,cz+15,groundY,58,8.6,4);

 // Mountain ridgeline: a nearer, lower layer close behind the citadel and a further, taller layer
 // behind that, so distance reads as distance through fog density alone — both layers use the
 // same near-white vertex colour as the citadel walls; it is only the extra camera distance (and
 // the existing per-fragment fog term) that makes the far layer read hazier than the near one.
 // Heights and jitter are toned down from the first pass (which used hMax up to 78 with heavy
 // per-segment z-jitter) so the skyline reads as rolling ridgeline rather than shattered shards.
 ridgeline(distant,cz+70,groundY,7001,280,24,18,42,18,[.90,.92,.87,0]);
 ridgeline(distant,cz+150,groundY,7113,320,22,28,62,22,[.90,.92,.87,0]);
 const ringY=groundHeight(0,0)+2;
 // Closer, taller rings so a max-zoom aerial still sees a mountain skyline, not a disc rim.
 // Segment counts are now silhouette resolution, not peak count -- the ridged noise decides
 // where the summits are, so these only have to be fine enough that a 300 m chord does not
 // cut a peak flat. Sharpness rises with distance: the near ring is rounded foothills, the
 // far one is the alpine wall behind them.
 ridgeRing(distant,0,40,230,270,ringY,7204,150,34,86,[.90,.92,.87,0],1.35);
 ridgeRing(distant,0,40,320,380,ringY,7318,170,62,134,[.86,.88,.82,0],1.7);
 ridgeRing(distant,0,40,420,500,ringY,7440,190,84,172,[.82,.84,.78,0],2.1);

 // The three r=200 scarp curtains that used to stand here are gone. They failed twice: at
 // r=128 they were stranded on flat ground by a rim change and drew a hard black bar across
 // the south vista, and at r=200, sitting on the slope they were meant to be the face of,
 // they read as dark tape looping over the hillcrest and crossing each other. A cliff needs
 // the ground to actually drop behind it; painting a dark band on a smooth slope never
 // reads as one. Removing them left the north views pixel-identical and cleaned up
 // 12-wide-south-vista, where the hillside now shows its woodland instead of the arcs.

 // The two viaducts that used to stand here went with the scarps, for the same reason at a
 // different scale: a deck 1.5 m thick at 150 m is two pixels of dark line, and two pixels
 // of straight dark line across a hillside is a defect, not a landmark. Removing them moved
 // nothing in the other eleven vistas.
 //
 // The keeps move out past 190 m and roughly double in size. Close in they were skirt-tape
 // on the near slope; out there they are layered silhouettes standing between the woodland
 // and the first mountain ring, which is the one job a `Distant black stone` landmark can
 // do -- the material is tint .095/.115/.10 at light .35, so it is an outline and a tone and
 // nothing else, and an outline has to be big before it is worth drawing at all.
 mesaKeep(distant,warm,196,-38,groundHeight,62,11,22);
 mesaKeep(distant,warm,-186,112,groundHeight,54,9.5,18);
 mesaKeep(distant,warm,74,-214,groundHeight,68,12,26);
 spire(distant,warm,132,-55,groundHeight(132,-55),28,5.4,2);
 spire(distant,warm,-125,-80,groundHeight(-125,-80),24,5.0,2);
 spire(distant,warm,78,168,groundHeight(78,168),30,5.6,3);

 const after=distant.idx.length+warm.idx.length;
 return {triangles:(after-before)/3};
}
