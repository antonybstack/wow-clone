/** Physical ridge profiles replacing the three former horizon shells. Geometry
 * and Havok sample this one heightfield; there are no detached backs or clamps. */
export const REGION_BOUNDS=Object.freeze({minX:-1626,maxX:1626,minZ:-1631,maxZ:1681});
const smooth=value=>{const t=Math.max(0,Math.min(1,value));return t*t*(3-2*t);};
const rectangleDistance=(x,z,minX,maxX,minZ,maxZ)=>Math.hypot(Math.max(minX-x,0,x-maxX),Math.max(minZ-z,0,z-maxZ));
export function protectedTerrainDistance(x,z){
 return Math.min(rectangleDistance(x,z,-90,90,-95,145),rectangleDistance(x,z,-45,45,145,370));
}
export const isProtectedTerrain=(x,z)=>protectedTerrainDistance(x,z)===0;

function ridge(seed,rx,rz,minHeight,maxHeight,sharp){
 let value=seed;
 const random=()=>{value=(Math.imul(1664525,value)+1013904223)|0;return(value>>>0)/4294967296;};
 return Object.freeze({seed,rx,rz,minHeight,maxHeight,sharp,phases:Object.freeze([random()*7,random()*7,random()*7]),spin:random()*7});
}
export const REGIONAL_RIDGES=Object.freeze([
 ridge(7204,230,270,34,86,1.35),ridge(7318,320,380,62,134,1.7),ridge(7440,420,500,84,172,2.1),
]);

/** The original seeded crest, with a continuous onset for the northern saddle
 * and rearward shift. Both former shells abruptly switched these at z=150. */
export function regionalRidgeCrest(ridge,angle){
 const wobble=1+.14*Math.sin(angle*2+ridge.spin)*Math.sin(angle*5-ridge.spin);
 const x=Math.cos(angle)*ridge.rx*wobble,z=Math.sin(angle)*ridge.rz*wobble;
 const oct=(frequency,phase)=>1-Math.abs(Math.sin(angle*frequency*.5+phase));
 const peak=Math.pow(.52*oct(3,ridge.phases[0])+.30*oct(7,ridge.phases[1])+.18*oct(17,ridge.phases[2]),ridge.sharp);
 const north=smooth((z-120)/60);
 const shift=ridge.seed===7318?70*Math.exp(-x*x/10000)*north:0;
 const saddle=ridge.seed===7204?Math.exp(-x*x/5000)*north:0;
 return {x,z:40+z+shift,shift,wobble,saddle,height:ridge.minHeight+(ridge.maxHeight-ridge.minHeight)*peak};
}

function ridgeWeight(radius){
 if(radius<=.77||radius>=1.18)return 0;
 if(radius<.89)return .58*smooth((radius-.77)/.12);
 if(radius<1)return .58+.42*smooth((radius-.89)/.11);
 return 1-smooth((radius-1)/.18);
}

export function applyRegionalTerrain(x,z,terrainY){
 const clearance=protectedTerrainDistance(x,z);
 if(clearance===0)return terrainY;
 // Short smooth blend beside the retained town and cathedral surfaces prevents
 // a new slope seam, including where the protected rectangles meet.
 const protection=smooth(clearance/40);
 let raised=terrainY;
 for(const ridge of REGIONAL_RIDGES){
  // The second ridge bends behind Vaelmark. Invert that small displacement to
  // keep its crest at the original authored XZ positions, not a second shell.
  let angle=Math.atan2((z-40)/ridge.rz,x/ridge.rx),crest=regionalRidgeCrest(ridge,angle);
  if(ridge.seed===7318)for(let i=0;i<3;i++){
   angle=Math.atan2((z-40-crest.shift)/ridge.rz,x/ridge.rx);crest=regionalRidgeCrest(ridge,angle);
  }
  const radius=Math.hypot(x/ridge.rx,(z-40-crest.shift)/ridge.rz)/crest.wobble;
  const weight=ridgeWeight(radius)*protection*(1-crest.saddle);
  if(weight>0)raised=Math.max(raised,terrainY+(Math.max(terrainY+3,crest.height)-terrainY)*weight);
 }
 return raised;
}
