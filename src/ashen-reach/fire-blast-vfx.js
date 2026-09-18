import {loadTexture2D,createGridSpriteAtlas,createFacingBillboardSystem,addFacingBillboardSystem,addBillboardSprite,updateBillboardSprite,billboardBlendAdditive,billboardBlendAlpha,createPointLight,addToScene,setShaderUniform} from '@babylonjs/lite';
import {attachSockets} from '../character/sockets.js';
import {rng} from './geometry.js';

const EFFECT_DURATION=1.65;
/** Three fixed Lite billboard pools. Emitted particles keep their birth position when the caster moves. */
export async function createFireBlastVfx(engine,scene,player,body,world){
 const random=rng(419),systems=await Promise.all([
  ['fire_01.png',billboardBlendAdditive,42],['smoke_01.png',billboardBlendAlpha,8],['spark_05.png',billboardBlendAdditive,50]
 ].map(async([file,blendMode,capacity])=>{
  const texture=await loadTexture2D(engine,'/ashen-reach/fire-blast/'+file,{invertY:false,srgb:false,mipMaps:true,magFilter:'nearest',minFilter:'nearest'});
  const atlas=createGridSpriteAtlas(texture,{cellWidthPx:512,cellHeightPx:512});
  const system=createFacingBillboardSystem(atlas,{capacity,blendMode});addFacingBillboardSystem(scene,system);
  return Array.from({length:capacity},()=>({handle:addBillboardSprite(system,{position:[0,-50,0],sizeWorld:[1,1],visible:false}),seed:random(),angle:random()*Math.PI*2,birth:null,direction:null}));
 }));
 const sockets=attachSockets(engine,scene,player,body);
 const lights=Array.from({length:2},()=>{const light=createPointLight([0,0,0],0);light.diffuse=[1,.25,.035];light.range=5;addToScene(scene,light);return light;});
 let priming=false,primeAge=0;
 let age=10,point=[0,0,0],wasActive=false;
 const lightMaterials=world.meshes.map(m=>m.material);
 const handPosition=()=>{
  const hand=sockets.toCapsule(sockets.sockets[body.definition.castMotion?.hand||'offHand'].bone),p=player.body.position,f=player.getFacing(),c=Math.cos(f),s=Math.sin(f);
  return hand?[p.x+c*hand.x+s*hand.z,p.y+hand.y,p.z-s*hand.x+c*hand.z]:[p.x,p.y+.3,p.z];
 };
 function emit(q,hand){
  if(q.birth)return;
  q.birth=[...hand];const d=point.map((v,i)=>v-hand[i]),length=Math.hypot(...d)||1;
  q.direction=d.map(v=>v/length);q.distance=length;
 }
 function update(dt){
  if(priming){
   primeAge+=dt;const hand=handPosition(),power=Math.min(1,primeAge/.28);
   for(const q of systems[0].slice(0,5))updateBillboardSprite(q.handle,{position:hand,sizeWorld:[.18+power*.18,.18+power*.18],rotation:q.angle+primeAge,color:[1.8,.45,.025,.12+power*.13],visible:true});
   lights[1].position.set(...hand);lights[1].intensity=power*.35;
   for(const material of lightMaterials){setShaderUniform(material,'handFirePosition',hand);setShaderUniform(material,'handFireStrength',power*.35);}
   return;
  }
  age+=dt;if(age>EFFECT_DURATION&&!wasActive)return;wasActive=age<=EFFECT_DURATION;
  const [fire,smoke,sparks]=systems,hand=handPosition();
  for(let i=0;i<fire.length;i++){
   const q=fire[i];let position,size,t;
   if(i<10){ // Attached ignition: bright palm core and ragged flames around the wrist.
    t=(age-q.seed*.045)/(.42+q.seed*.14);const spread=.10+Math.max(t,0)*.22;
    position=[hand[0]+Math.cos(q.angle)*spread,hand[1]+Math.sin(q.angle)*spread+age*.2,hand[2]+(q.seed-.5)*spread];size=(.36+q.seed*.30)*(1+Math.max(t,0)*.4);
   }else if(i<26){ // Short forward flame cone; not a slow projectile or a sustained beam.
    const life=.23+q.seed*.15,local=age-(i-10)/16*.18;t=local/life;if(local>=0)emit(q,hand);
    const travel=Math.min(Math.max(local,0)*(8+q.seed*7),Math.max(0,(q.distance||1)-.3));
    const spread=travel*.09,side=[q.direction?.[2]||1,0,-(q.direction?.[0]||0)];
    position=(q.birth||hand).map((v,j)=>v+(q.direction?.[j]||0)*travel+side[j]*Math.cos(q.angle)*spread+(j===1?Math.sin(q.angle)*spread:0));
    size=(.36+q.seed*.40)*(1+Math.max(t,0)*.65);
   }else{
    t=age/(.52+q.seed*.14);const radius=Math.sin(Math.min(t,1)*Math.PI*.5)*(.25+q.seed*.65);
    position=[point[0]+Math.cos(q.angle)*radius,point[1]+Math.sin(q.angle)*radius+age*.55,point[2]+(q.seed-.5)*.45];size=(.48+q.seed*.62)*(1+t*1.3);
   }
   updateBillboardSprite(q.handle,{position,sizeWorld:[size,size],rotation:q.angle+age*(q.seed-.5),color:[2.5,Math.max(.12,1-t)*1.1,.065,Math.max(0,1-t)],visible:t>=0&&t<1});
  }
  for(let i=0;i<smoke.length;i++){
   const q=smoke[i],caster=i<3,t=(age-.15)/(1.0+q.seed*.35);if(age>=.15&&caster)emit(q,hand);const origin=caster?(q.birth||hand):point,size=(caster?.35:.7)+Math.max(t,0)*(caster?.7:1.4);
   updateBillboardSprite(q.handle,{position:[origin[0]+Math.cos(q.angle)*age*.35,origin[1]+age*.75,origin[2]+Math.sin(q.angle)*age*.35],sizeWorld:[size,size],rotation:q.angle+age*.15,color:[.12,.105,.085,Math.max(0,Math.sin(t*Math.PI))*(caster?.24:.45)],visible:t>=0&&t<1});
  }
  for(let i=0;i<sparks.length;i++){
   const q=sparks[i],caster=i<30,local=age-(caster?q.seed*.16:0),t=local/(.50+q.seed*.55);let position;
   if(caster){
    if(local>=0)emit(q,hand);const travel=Math.min(Math.max(local,0)*(3+q.seed*5),Math.max(0,(q.distance||1)-.2));
    position=(q.birth||hand).map((v,j)=>v+(q.direction?.[j]||0)*travel+(j===1?(1+q.seed)*local-2*local*local:Math.cos(q.angle+j)*local*.8));
   }else{const v=1.4+q.seed*2.4;position=[point[0]+Math.cos(q.angle)*v*age,point[1]+(.5+q.seed*2)*age-2*age*age,point[2]+Math.sin(q.angle)*v*age*.6];}
   const size=.055+q.seed*.065;updateBillboardSprite(q.handle,{position,sizeWorld:[size,size*(1+q.seed)],rotation:q.angle,color:[2.4,.8,.08,Math.max(0,1-t)],visible:t>=0&&t<1});
  }
  const power=Math.max(0,1-age/.65)**2,handPower=Math.max(0,1-age/.58)**1.4;
  lights[0].position.set(...point);lights[0].intensity=power*3.5;lights[1].position.set(...hand);lights[1].intensity=handPower*2.4;
  for(const material of lightMaterials){setShaderUniform(material,'firePosition',point);setShaderUniform(material,'fireStrength',power*4.5);setShaderUniform(material,'handFirePosition',hand);setShaderUniform(material,'handFireStrength',handPower*2.2);}
 }
 return {
  beginWindup(){priming=true;primeAge=0;},
  cancelWindup(){priming=false;for(const q of systems[0].slice(0,5))updateBillboardSprite(q.handle,{visible:false});lights[1].intensity=0;for(const m of lightMaterials)setShaderUniform(m,'handFireStrength',0);},
  trigger(target){priming=false;point=[target.position.x,target.position.y+1.1,target.position.z];age=0;wasActive=true;for(const pool of systems)for(const q of pool){q.birth=null;q.direction=null;}},
  sockets,update,get age(){return age;},get active(){return priming||age<=EFFECT_DURATION;},handPosition,
  stats:{sprites:100,systems:3,lights:2},
 };
}
