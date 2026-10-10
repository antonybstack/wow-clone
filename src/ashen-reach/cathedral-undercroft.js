import {lanternGlow} from './geometry.js';

// Surface coordinates, shared by the slab aperture, stairs and traversal metadata.
// Kept on the low west side: the actual terrain continues beneath this chamber.
export const UNDERCROFT={
  depth:5.6, stairX:-14.5, stairStart:330, stairEnd:347, stairWidth:2.8,
  opening:[[-16,330],[-13,330],[-13,348],[-16,348]],
  bounds:{minX:-12,maxX:-2,minZ:323,maxZ:339},
};

/** Original low Gothic vault; appended once to the existing Lite material batches.
 * No independent scene, dynamic mesh rebuild or extra shadow-map allocation.
 * https://github.com/BabylonJS/Babylon-Lite/blob/npm-lite-v1.31.1/docs/lite/architecture/10-mesh-generators.md
 * Existing continuous Havok ramps separate walking support from visible treads:
 * https://github.com/BabylonJS/Babylon-Lite/blob/npm-lite-v1.31.1/docs/lite/architecture/42-physics.md
 */
export function buildCathedralUndercroft(ctx,{flight,rail}){
  const {stone,glow,collisionBatch,floorY,groundHeight,wall,box,beam,arch}=ctx;
  const {depth,stairX,stairStart,stairEnd,stairWidth,bounds}=UNDERCROFT;
  const y=floorY-depth,STONE=[.66,.69,.73,0],TRIM=[.91,.85,.72,0],DARK=[.40,.43,.47,0];
  const entry=[stairX,floorY,stairStart],bottom=[stairX,y,stairEnd];
  // Existing stair builder expects an ascending flight. Reversing the endpoints
  // gives this descent identical 16 cm treads, smooth collision and guard rails.
  flight([stairX,-depth,stairEnd],[stairX,0,stairStart],stairWidth);
  wall([stairX,y-.18,348],[3.2,.36,4.4],STONE);
  wall([-10.75,y-.18,348.5],[7.5,.36,3.2],STONE);
  wall([-7,y-.18,343],[3.2,.36,11],STONE);
  // Guard the opening at nave level; the south end is the intentional entrance.
  for(const x of [-16,-13])rail([x,floorY,330],[x,floorY,348]);
  rail([-16,floorY,348],[-13,floorY,348]);
  for(const x of [-16.22,-12.78])wall([x,floorY+1.45,329.65],[.38,2.9,.62],TRIM);
  arch(stone,1.45,2.9,4,.24,.65,(u,h,d)=>[stairX+u,floorY+h,329.65+d],TRIM);
  // The short bottom corridor is physically enclosed beneath the existing slab.
  wall([-10.85,y+2.25,346.9],[4.1,4.5,.4],DARK);
  wall([-10.75,y+2.25,350.1],[10.7,4.5,.4],DARK);
  for(const x of [-8.6,-5.4])wall([x,y+2.25,342.85],[.4,4.5,8],DARK);
  wall([-16.1,y+2.25,348],[.35,4.5,4.4],DARK);
  // Subdivided floor retains texel density and local-light gradients cheaply.
  for(let x=bounds.minX;x<bounds.maxX;x+=2)for(let z=bounds.minZ;z<bounds.maxZ;z+=2)
    box(stone,[x+1,y-.18,z+1],[2,.36,2],STONE);
  // The union of those tiles is one rectangular slab. Matching its exterior
  // with one collider avoids hundreds of redundant internal coplanar faces.
  box(collisionBatch,[-7,y-.18,331],[10,.36,16],STONE);
  for(const x of [bounds.minX,bounds.maxX])wall([x,y+2.35,331],[.5,4.7,16.5],DARK);
  wall([-7,y+2.35,323],[10.5,4.7,.5],DARK);
  // North end has a genuine pointed doorway, with recessed archivolts.
  for(const x of [-10.1,-3.9])wall([x,y+2.35,339],[3.8,4.7,.5],DARK);
  wall([-7,y+4.3,339],[2.4,.8,.5],DARK);
  for(const z of [338.55,339.4]){
    for(const x of [-8.35,-5.65])wall([x,y+1.25,z],[.28,2.5,.4],TRIM);
    for(const batch of [stone,collisionBatch])arch(batch,1.2,2.5,3.75,.2,.4,(u,h,d)=>[-7+u,y+h,z+d],TRIM);
  }
  // Three low ribbed bays frame the memorial. Low-profile overhead ribs sit
  // below the slab; no hidden full-width ceiling plane crosses the stair hole.
  for(const z of [324,331,338]){
    for(const x of [-11.45,-2.55]){
      wall([x,y+1.2,z],[.65,2.4,.7],DARK);
      box(stone,[x,y+.16,z],[.9,.32,1],TRIM);
      box(stone,[x,y+2.42,z],[.9,.24,.95],TRIM);
    }
    for(const batch of [stone,collisionBatch])arch(batch,4.45,.1,4.6,.24,.4,(u,h,d)=>[-7+u,y+h,z+d],TRIM);
  }
  // Reuse the pointed-arch builder for the continuous barrel vault. Its rise
  // must exceed its half-width: a shallow pointed profile overshoots the tip
  // and crosses the slab. Both the ribs and vault now stay below its underside.
  for(const batch of [stone,collisionBatch])arch(batch,4.45,.1,4.6,.14,14,(u,h,d)=>[-7+u,y+h,331+d],STONE);
  // A low memorial leaves 2 m clear passages around both sides and both ends.
  wall([-7,y+.32,329],[2.5,.64,4.4],DARK);
  box(stone,[-7,y+.71,329],[2.8,.14,4.7],TRIM);
  box(stone,[-7,y+.84,329],[2.1,.12,3.9],[.77,.76,.72,0]);
  for(const z of [326.8,331.2])box(stone,[-7,y+.98,z],[.45,.25,.4],TRIM);
  // Recessed memorial tablets and a stone cross give the terminal wall a focus.
  for(const x of [-10,-4]){
    box(stone,[x,y+1.55,323.31],[1.6,2.6,.16],TRIM);
    box(stone,[x,y+1.55,323.41],[1.22,2.16,.14],DARK);
    for(const h of [1.1,1.45,1.8])beam(stone,[x-.38,y+h,323.50],[x+.38,y+h,323.50],.06,TRIM);
  }
  beam(stone,[-7,y+1.4,323.44],[-7,y+3.8,323.44],.18,TRIM);
  beam(stone,[-7.7,y+3,323.44],[-6.3,y+3,323.44],.16,TRIM);
  const lamps=[];
  for(const [id,p] of [['descent',[-14.5,y+3.6,342]],['turn',[-10.75,y+3.5,348.5]],['memorial',[-7,y+3.5,325]],['door',[-7,y+3.5,337]]]){
    box(stone,[p[0],p[1]+.22,p[2]],[.42,.13,.42],DARK);
    lanternGlow(glow,p,{r:.12,h:.36,tint:[1,.64,.28],dim:.42});
    lamps.push({id:`cathedral-undercroft-${id}`,position:p,strength:4});
  }
  // Validate the real datum at authoring time. A buried chamber is not fixed by
  // recovery teleports or an independent floor-height approximation.
  let terrainClearance=Infinity;
  const checkFloor=(minX,maxX,minZ,maxZ,surface)=>{
    const nx=Math.ceil((maxX-minX)/.25),nz=Math.ceil((maxZ-minZ)/.25);
    for(let i=0;i<=nx;i++)for(let j=0;j<=nz;j++){
      const x=minX+(maxX-minX)*i/nx,z=minZ+(maxZ-minZ)*j/nz;
      const clearance=surface(z)-groundHeight(x,z);
      if(!Number.isFinite(clearance))throw Error('Vaelmark undercroft intersects terrain');
      terrainClearance=Math.min(terrainClearance,clearance);
    }
  };
  checkFloor(bounds.minX,bounds.maxX,bounds.minZ,bounds.maxZ,()=>y);
  checkFloor(stairX-stairWidth/2,stairX+stairWidth/2,stairStart,stairEnd,
    z=>floorY-depth*(z-stairStart)/(stairEnd-stairStart));
  checkFloor(-16.1,-12.9,345.8,350.2,()=>y);
  checkFloor(-14.5,-7,346.9,350.1,()=>y);
  checkFloor(-8.6,-5.4,337.5,348.5,()=>y);
  if(!Number.isFinite(terrainClearance)||terrainClearance<.5)throw Error('Vaelmark undercroft intersects terrain');
  return {
    id:'vaelmark-undercroft',name:'Vaelmark Undercroft',floorY:y,bounds,entry,bottom,
    stair:{width:stairWidth,gradeDegrees:Math.atan(depth/(stairEnd-stairStart))*180/Math.PI},
    opening:UNDERCROFT.opening,terrainClearance,lamps,
    // Standing datum and visible target are distinct: the overhead memorial lamp
    // and the tomb centroid are unsuitable interaction points. Native Havok
    // still validates the air path from the player at activation time.
    memorial:{standingSurfaceY:y,stand:[-9.6,y,329],interact:[-8.65,y+1.15,329]},
    route:[[0,floorY,328],[-12,floorY,328],[-14.5,floorY,328],entry,bottom,[-14.5,y,348.5],[-7,y,348.5],[-7,y,337],[-10,y,334],[-10,y,325],[-4,y,325],[-4,y,334],[-7,y,337],[-7,y,348.5],[-14.5,y,348.5],bottom,entry,[-14.5,floorY,328],[-12,floorY,328],[0,floorY,328]],
  };
}
