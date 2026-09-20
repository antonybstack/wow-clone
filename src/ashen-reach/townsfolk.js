/**
 * Hollowmere background people. Mixamo attachCrowd is 55,320 visible triangles
 * per body (Alpha_Surface 34,480 + Alpha_Joints 20,840) and a unique loadGltf
 * GPU upload per instance, so eight of them blow the 25,000 / 15-draw budget
 * by an order of magnitude. These figures are packed into one world Batch and
 * committed with the existing wood material, so they share the town's lamp bake
 * and cost one draw.
 */
import {Batch, height, pathX, buildingPads} from './geometry.js';
import {surface} from './materials.js';

const CLOAK = {
 peat:[.48,.46,.36,0],
 rust:[.62,.32,.22,0],
 soot:[.40,.38,.36,0],
 moss:[.42,.50,.32,0],
 wine:[.56,.28,.30,0],
};
const TUNIC = {
 linen:[.72,.60,.46,0],
 grey:[.58,.56,.50,0],
 hide:[.58,.40,.26,0],
};
const SKIN = [.78,.58,.44,0];
const BOOT = [.32,.22,.16,0];
const WOOD = [.52,.36,.22,0];
const IRON = [.50,.50,.46,0];

function cloakBand(batch,P,y0,y1,r0,r1,n,skip,color){
 for(let i=0;i<n;i++){
  if(skip.has(i))continue;
  const a0=i*Math.PI*2/n,a1=(i+1)*Math.PI*2/n;
  batch.quad(
   P(Math.sin(a0)*r0,y0,Math.cos(a0)*r0),
   P(Math.sin(a1)*r0,y0,Math.cos(a1)*r0),
   P(Math.sin(a1)*r1,y1,Math.cos(a1)*r1),
   P(Math.sin(a0)*r1,y1,Math.cos(a0)*r1),
   undefined,color);
 }
}

function person(batch,x,z,yaw,spec={}){
 const gy=height(x,z);
 const s=spec.scale||1;
 const cloak=spec.cloak||CLOAK.peat;
 const tunic=spec.tunic||TUNIC.linen;
 const hoodCol=spec.hoodColor||[Math.min(1,cloak[0]*1.18),Math.min(1,cloak[1]*1.16),Math.min(1,cloak[2]*1.12),0];
 const hoodUp=spec.hood!==false;
 const pose=spec.pose||'idle';
 const P=(lx,ly,lz)=>[
  x+(lx*s)*Math.cos(yaw)+(lz*s)*Math.sin(yaw),
  gy+ly*s,
  z-(lx*s)*Math.sin(yaw)+(lz*s)*Math.cos(yaw),
 ];
 const box=(lx,ly,lz,w,h,d,color)=>batch.box(P(lx,ly,lz),[w*s,h*s,d*s],color,yaw);

 // Legs and boots sit under the cloak hem so the figure has a stance, not a floating cone.
 const step=pose==='step'?1:pose==='lean'?-1:0;
 box(-.09,.46,.01,.13,.90,.14,tunic);
 box(.09,.44,.04+.02*step,.13,.86,.14,tunic);
 box(-.09,.10,.02,.15,.20,.18,BOOT);
 box(.09,.10,.05+.02*step,.15,.20,.18,BOOT);

 box(0,1.16,.02,.30,.50,.20,tunic);
 box(0,1.40,.00,.38,.12,.22,cloak);

 const n=8,front=new Set([0,1,n-1]);
 cloakBand(batch,P,1.40,1.08,.22,.28,n,front,cloak);
 cloakBand(batch,P,1.08,.14,.28,.34,n,front,cloak);
 // Cloak edges at the opening, so the garment reads as two flaps rather than a tube.
 batch.quad(P(-.09,1.40,.21),P(-.14,1.08,.27),P(-.16,.14,.32),P(-.05,1.40,.20),undefined,cloak);
 batch.quad(P(.09,1.40,.21),P(.14,1.08,.27),P(.16,.14,.32),P(.05,1.40,.20),undefined,cloak);

 const arm=(side,ax,ay,az,bx,by,bz,cx,cy,cz)=>{
  batch.tube(P(ax,ay,az),P(bx,by,bz),.055*s,.045*s,cloak,5);
  batch.tube(P(bx,by,bz),P(cx,cy,cz),.045*s,.038*s,tunic,5);
  box(cx,cy-.02,cz,.07,.08,.08,SKIN);
 };
 if(pose==='tend'){
  arm(-1,-.22,1.36,.04,-.26,1.10,.12,-.18,.92,.22);
  arm(1,.22,1.36,.04,.20,1.14,.22,.12,.98,.34);
 }else if(pose==='draw'){
  arm(-1,-.20,1.36,.06,-.16,1.12,.20,-.08,.96,.30);
  arm(1,.20,1.36,.06,.16,1.12,.20,.08,.96,.30);
 }else if(pose==='spear'){
  arm(-1,-.22,1.36,.02,-.26,1.06,.00,-.24,.82,-.04);
  arm(1,.22,1.36,.06,.18,1.18,.10,.16,1.08,.12);
 }else if(pose==='lean'){
  arm(-1,-.22,1.36,.00,-.28,1.08,-.02,-.30,.78,.02);
  arm(1,.22,1.36,.06,.26,1.12,.16,.22,.90,.22);
 }else{
  arm(-1,-.22,1.36,.04,-.26,1.08,.08,-.24,.80,.10);
  arm(1,.22,1.36,.02,.24,1.10,.00,.22,.82,.04);
 }

 box(0,1.60,.03,.16,.20,.16,SKIN);
 box(0,1.61,.14,.12,.14,.08,SKIN);
 if(hoodUp){
  const skip=new Set([0,1,n-1]);
  cloakBand(batch,P,1.50,1.68,.15,.17,n,skip,hoodCol);
  cloakBand(batch,P,1.68,1.80,.17,.03,n,skip,hoodCol);
  batch.quad(P(-.08,1.52,.12),P(.08,1.52,.12),P(.07,1.70,.14),P(-.07,1.70,.14),undefined,hoodCol);
 }else{
  box(0,1.72,.01,.18,.06,.18,hoodCol);
 }

 if(pose==='tend'){
  box(.10,.95,.36,.18,.10,.14,WOOD);
 }else if(pose==='spear'){
  batch.tube(P(.20,.08,.10),P(.22,2.05,.12),.028*s,.022*s,IRON,4);
  batch.tube(P(.22,2.05,.12),P(.22,2.28,.12),.055*s,.002*s,IRON,4);
 }else if(pose==='draw'){
  box(0,.88,.28,.12,.08,.12,WOOD);
 }
}

function woodMaterial(world){
 const mesh=(world.meshes||[]).find(m=>m&&m.name==='Rotten fence');
 return mesh?.material||null;
}

/**
 * @param {import('@babylonjs/lite').EngineContext} engine
 * @param {import('@babylonjs/lite').SceneContext} scene
 * @param {{meshes?: any[]}} world
 */
export async function attachTownsfolk(engine,scene,world){
 if(typeof location!=='undefined'&&new URLSearchParams(location.search).has('noTownsfolk'))return {mesh:null,triangles:0,draws:0,count:0};
 const batch=new Batch('Townsfolk');
 const well=buildingPads[8];
 const stall90=pathX(90)-3.0;
 const stall106=pathX(106)+3.0;
 const gateX=pathX(75);

 person(batch,well.x-3.15,well.z-2.55,-0.55,{cloak:CLOAK.rust,tunic:TUNIC.hide,pose:'tend',scale:1.00});
 person(batch,well.x+3.20,well.z-2.15,0.70,{cloak:CLOAK.peat,tunic:TUNIC.linen,pose:'tend',scale:.97});
 person(batch,well.x-2.15,well.z+2.35,2.45,{cloak:CLOAK.wine,tunic:TUNIC.grey,pose:'tend',scale:1.02,hood:false});
 person(batch,well.x+1.55,well.z-0.85,2.9,{cloak:CLOAK.moss,tunic:TUNIC.linen,pose:'draw',scale:.98});
 person(batch,well.x-1.35,well.z-0.70,-2.7,{cloak:CLOAK.soot,tunic:TUNIC.grey,pose:'draw',scale:1.04});
 person(batch,stall90+1.15,90,1.35,{cloak:CLOAK.peat,tunic:TUNIC.hide,pose:'tend',scale:1.01});
 person(batch,stall106-1.15,106,-1.45,{cloak:CLOAK.rust,tunic:TUNIC.linen,pose:'tend',scale:.96,hood:false});
 person(batch,-6.85,96.35,-1.05,{cloak:CLOAK.soot,tunic:TUNIC.linen,pose:'lean',scale:1.03});
 person(batch,gateX+1.45,77.4,Math.PI,{cloak:CLOAK.rust,tunic:TUNIC.hide,pose:'spear',scale:1.08,hood:false});
 person(batch,7.55,97.15,-1.55,{cloak:CLOAK.moss,tunic:TUNIC.hide,pose:'tend',scale:1.00});

 const lights=world.lights||[];
 let material=woodMaterial(world);
 if(!material)material=await surface(engine,'Townsfolk cloth','/tex/wood_planks_grey/diff.jpg',{tint:[.57,.43,.31],light:.62,pixels:64});
 const mesh=batch.commit(engine,scene,material,lights);
 const triangles=batch.idx.length/3;
 return {mesh,triangles,draws:mesh?1:0,count:10};
}
