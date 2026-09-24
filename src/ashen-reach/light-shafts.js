import {createShaderMaterial,setShaderUniform} from '@babylonjs/lite';
import {Batch} from './geometry.js';
import {ATMOS} from './atmosphere.js';

/**
 * Lamp light shafts: the cone of lit air hanging under each lantern.
 *
 * Every other glow in this world is faked on opaque triangles with per-vertex
 * colour falloff, because `surface()` has no blending (see geometry.js's
 * `radialGlow`). That works for a puddle painted flat on a wall or the ground,
 * where "opaque" is the truth. It cannot work for a shaft, which is a volume you
 * see the street *through* -- an opaque cone would punch a lantern-coloured hole
 * in the road behind it.
 *
 * So this is the one thing in the scene that gets its own additive material.
 * `needAlphaBlending` with `blendMode:'additive'` means the cone only ever adds
 * light, never occludes, which is also physically what a shaft does. Depth
 * *testing* stays on, so a shaft is correctly hidden behind a wall or a house;
 * depth *writing* is off (the blended default), so overlapping shafts from
 * adjacent lamps sum instead of fighting over who drew first.
 *
 * Faking thickness: a hollow cone has no thickness, so alpha is weighted by
 * |dot(normal,view)|. Face-on fragments -- the middle of the cone, where a real
 * ray would travel through the most lit air -- stay bright, and grazing
 * fragments at the silhouette fade to nothing, which is what dissolves the hard
 * outline that gives cheap god-ray cones away. Back-face culling is off, so the
 * far wall of the cone draws too and the two additively sum toward the centre,
 * reproducing the thickness profile rather than approximating it with one skin.
 */
export async function createLightShafts(engine,scene,shafts){
 if(!shafts.length)return null;
 const batch=new Batch('Lamp light shafts');
 for(const s of shafts)cone(batch,s);

 const OUT=`struct Out{@builtin(position) position:vec4<f32>,@location(0) p:vec3<f32>,@location(1) color:vec4<f32>,@location(2) normal:vec3<f32>};`;
 const mat=createShaderMaterial({name:'Lamp light shafts',attributes:['position','normal','color'],
  // The cone shader never calls aerial(), but it inlines ATMOS wholesale and WGSL
  // validates a module as a whole, so every uniform aerial() reads has to be
  // declared here or the pipeline fails to compile -- and because the world is
  // submitted in one render bundle, that blacks out the entire scene while the
  // CPU-side stats still print correct counts. Declaring time unconditionally is
  // what lets the haze in atmosphere.js animate at all.
  uniforms:['worldViewProjection','world','cameraPosition',{name:'time',type:'f32',defaultValue:0}],
  needAlphaBlending:true,blendMode:'additive',backFaceCulling:false,
  vertexSource:`${OUT}
  @vertex fn mainVertex(i:VertexInput)->Out{var o:Out;
   o.position=shaderSystem.worldViewProjection*vec4<f32>(i.position,1);
   o.p=(shaderSystem.world*vec4<f32>(i.position,1)).xyz;
   o.color=i.color;o.normal=i.normal;return o;}`,
  fragmentSource:`${OUT}
  ${ATMOS}
  @fragment fn mainFragment(i:Out)->@location(0) vec4<f32>{
   let v=normalize(shaderSystem.cameraPosition-i.p);
   let n=normalize(i.normal+vec3<f32>(0.00001));
   // Thickness fake, see the module docstring. The exponent is low on purpose:
   // at 2.0 the cone collapsed to a thin bright spine, at 0.5 the silhouette
   // came back as a hard edge.
   var a=i.color.a*pow(abs(dot(n,v)),0.85);
   let d=distance(shaderSystem.cameraPosition,i.p);
   // The player walks straight through these. Without a near fade you cross the
   // cone wall and the screen flashes; this dissolves it before you reach it.
   a=a*smoothstep(0.5,2.8,d);
   // And they stop existing well before the far ridge, so the town does not read
   // as a bank of floodlights from the north overlook.
   a=a*(1.0-smoothstep(34.0,78.0,d));
   return vec4<f32>(i.color.rgb,clamp(a,0.0,1.0));
  }`});
 const mesh=batch.commit(engine,scene,mat,[]);
 if(mesh)mesh.renderOrder=50;
 return {mesh,mat,triangles:batch.idx.length/3,update(t){setShaderUniform(mat,'time',t);}};
}

/** One lamp's cone: a bright narrow core inside a wide soft skirt. Two shells
 *  rather than one because a single cone has to choose between a tight hot
 *  centre and a wide soft spill, and the lanterns want both. */
function cone(batch,{p,groundY,radius=2.2,strength=1,tint=[1.0,0.62,0.30]}){
 const drop=Math.max(p[1]-groundY,0.8);
 const shell=(topR,botR,topA,sides)=>{
  const top=[p[0],p[1]-0.10,p[2]],bot=[p[0],groundY+0.05,p[2]];
  const c1=[tint[0]*strength,tint[1]*strength,tint[2]*strength,topA];
  // Alpha reaches zero at the ground: light that has travelled the full drop has
  // scattered away, and a cone that still had opacity where it meets the earth
  // would terminate in a visible ring.
  const c0=[tint[0]*strength,tint[1]*strength,tint[2]*strength,0];
  for(let j=0;j<sides;j++){
   const a0=j*Math.PI*2/sides,a1=(j+1)*Math.PI*2/sides;
   const at=(c,r,a)=>[c[0]+Math.cos(a)*r,c[1],c[2]+Math.sin(a)*r];
   // Split each wall vertically so the alpha ramp is quadratic-ish rather than a
   // straight Gouraud line from head to ground.
   const mid=[p[0],p[1]-0.10-drop*0.45,p[2]],midR=topR+(botR-topR)*0.45;
   const cm=[tint[0]*strength,tint[1]*strength,tint[2]*strength,topA*0.42];
   batch.quad(at(top,topR,a0),at(top,topR,a1),at(mid,midR,a1),at(mid,midR,a0),undefined,[c1,c1,cm,cm]);
   batch.quad(at(mid,midR,a0),at(mid,midR,a1),at(bot,botR,a1),at(bot,botR,a0),undefined,[cm,cm,c0,c0]);
  }
 };
 // Alphas are low because they stack four deep at the cone's centre line: two
 // shells, each drawing its front and its back wall. At 0.52/0.21 the lych-gate
 // lantern summed past white and read as a floodlight in fog rather than as a
 // shaft (p22-shafts 03-lych-gate).
 shell(0.10,radius*0.46,0.30,7);
 shell(0.20,radius,0.12,9);
}
