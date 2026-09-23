import {createSphere,createShaderMaterial,setShaderUniform,setMeshVisible,addToScene,createPointLight,loadTexture2D,createGridSpriteAtlas,createFacingBillboardSystem,addFacingBillboardSystem,addBillboardSprite,updateBillboardSprite,billboardBlendAdditive,billboardBlendAlpha} from '@babylonjs/lite';
import {rng} from './geometry.js';
import {paintLitUniform} from './materials.js';
const clamp=x=>Math.max(0,Math.min(1,x));
const xyz=p=>[p.x,p.y,p.z];
/** One molten mesh and three fixed sprite pools; no GPU allocations at cast time. */
export async function createLavaBallVfx(engine,scene,world,handPosition,player){
 const random=rng(9017),pools=await Promise.all([
  ['fire_01.png',64,billboardBlendAdditive],['smoke_01.png',14,billboardBlendAlpha],['spark_05.png',96,billboardBlendAdditive],
 ].map(async([name,count,blendMode])=>{
  const texture=await loadTexture2D(engine,'/ashen-reach/fire-blast/'+name,{invertY:false,srgb:false,mipMaps:true,minFilter:'nearest',magFilter:'nearest'});
  const atlas=createGridSpriteAtlas(texture,{cellWidthPx:512,cellHeightPx:512});
  const system=createFacingBillboardSystem(atlas,{capacity:count,blendMode});addFacingBillboardSystem(scene,system);
  return Array.from({length:count},()=>({handle:addBillboardSprite(system,{position:[0,-50,0],visible:false,sizeWorld:[1,1]}),seed:random(),angle:random()*Math.PI*2}));
 }));
 const OUT='struct LavaOut{@builtin(position) position:vec4<f32>,@location(0) p:vec3<f32>,@location(1) normal:vec3<f32>};';
 const material=createShaderMaterial({name:'Molten basalt',attributes:['position','normal'],uniforms:['worldViewProjection',{name:'time',type:'f32',defaultValue:0},{name:'heat',type:'f32',defaultValue:0}],
  vertexSource:`${OUT} @vertex fn mainVertex(i:VertexInput)->LavaOut{var o:LavaOut;o.position=shaderSystem.worldViewProjection*vec4<f32>(i.position,1);o.p=i.position;o.normal=i.normal;return o;}`,
  fragmentSource:`${OUT}
  fn hash(p:vec3<f32>)->f32{return fract(sin(dot(p,vec3<f32>(127.1,311.7,74.7)))*43758.5453);}
  @fragment fn mainFragment(i:LavaOut)->@location(0)vec4<f32>{
   let p=floor(i.p*70.0)/70.0;let t=shaderUniforms.time;
   let cell=floor(p*8.0);let f=fract(p*8.0);var first=20.0;var second=20.0;
   for(var x=-1;x<=1;x++){for(var y=-1;y<=1;y++){for(var z=-1;z<=1;z++){
    let offset=vec3<f32>(f32(x),f32(y),f32(z));let seed=cell+offset;
    let point=offset+vec3<f32>(hash(seed),hash(seed+vec3<f32>(31.0)),hash(seed+vec3<f32>(79.0)))-f;
    let d=dot(point,point);if(d<first){second=first;first=d;}else{second=min(second,d);}
   }}}
   let gap=sqrt(second)-sqrt(first);
   let cracks=1.0-smoothstep(.022,.095,gap+sin(t*.9+p.y*9.0)*.007);
   let hot=cracks*(.65+shaderUniforms.heat*.8);
   let crust=vec3<f32>(.07,.025,.009)*(1.0+hash(floor(p*35.0))*.9);
   let lava=vec3<f32>(2.7,.32,.012)*hot+vec3<f32>(.5,.5,.13)*pow(hot*.65,4.0);
   let rim=pow(1.0-abs(i.normal.z),3.0)*.035;
   return vec4<f32>(crust+lava+vec3<f32>(rim,0,0),1);
  }`});
 const core=createSphere(engine,{diameter:1,segments:12});core.name='Lava Ball core';core.material=material;addToScene(scene,core);setMeshVisible(core,false);
 const light=createPointLight([0,0,0],0);light.diffuse=[1,.20,.018];light.range=8;addToScene(scene,light);
 const materials=[...new Set(world.meshes.map(m=>m.material))];
 const trail=Array.from({length:40},()=>({p:[0,0,0],age:10}));let cursor=0,emitTime=0;
 let stage='idle',age=0,time=0,position=[0,0,0],charge=0,ground=0;
 const hide=()=>{for(const pool of pools)for(const q of pool)updateBillboardSprite(q.handle,{visible:false});setMeshVisible(core,false);};
 const draw=(q,p,size,color,rotation=0)=>updateBillboardSprite(q.handle,{position:p,sizeWorld:[size,size],color,rotation,visible:true});
 const illuminate=power=>{light.position.set(...position);light.intensity=power;for(const m of materials){paintLitUniform(m,'lavaPosition',position);paintLitUniform(m,'lavaStrength',power);}};
 const center=()=>{const p=handPosition(),f=player.getFacing();return [p[0]+Math.sin(f)*.24,p[1]+.03,p[2]+Math.cos(f)*.24];};
 return {
  begin(){stage='charge';age=0;charge=0;for(const t of trail)t.age=10;},
  cancel(){stage='idle';hide();illuminate(0);},
  origin(){return center();},
  launch(p){stage='flight';age=0;position=xyz(p);emitTime=0;},
  explode(p){stage='impact';age=0;position=xyz(p);ground=world.groundHeight(p.x,p.z)+.06;},
  update(dt,elapsed,flight){
   time+=dt;age+=dt;if(stage==='idle')return;
   hide();const [fire,smoke,sparks]=pools;
   if(stage==='charge'||stage==='flight'){
    if(stage==='charge'){charge=clamp(elapsed/1.5);position=center();}else if(flight)position=xyz(flight.position);
    const size=stage==='charge'?.13+.72*charge**.7:.86;
    core.position.set(...position);core.scaling.set(size,size,size);core.rotation.set(time*.8,time*1.8,time*.3);setMeshVisible(core,true);
    setShaderUniform(material,'time',time);setShaderUniform(material,'heat',stage==='charge'?charge:1);
    // Small broken flame licks leave the opaque cracked core readable.
    for(let i=0;i<14;i++){const q=fire[i],a=q.angle+time*(1.3+q.seed),r=size*(.50+q.seed*.15);draw(q,[position[0]+Math.cos(a)*r,position[1]+Math.sin(a)*r,position[2]+Math.sin(a*1.3)*r],size*(.30+q.seed*.30),[2.1,.35,.01,.35+q.seed*.18],-a);}
    if(stage==='charge'){
     const feet=player.body.position;
     for(let i=0;i<64;i++){const q=sparks[i],t=(time*(.7+q.seed*.4)+q.seed)%1,r=(1-t)*(.5+charge*.55),a=q.angle+time*4.2;
      const p=[position[0]+Math.cos(a)*r,feet.y-.8+(position[1]-feet.y+.8)*t,position[2]+Math.sin(a)*r];
      draw(q,p,.035+q.seed*.045,[2.0,.44,.015,Math.sin(t*Math.PI)*(.3+charge*.7)],a);
     }
     illuminate(.3+charge*2.8+Math.sin(time*25)*charge*.16);
    }else{
     emitTime+=dt;for(const t of trail)t.age+=dt;
     if(emitTime>.018){emitTime%=.018;const t=trail[cursor++%trail.length];t.p=[...position];t.age=0;}
     for(let i=0;i<trail.length;i++){const t=trail[i],q=fire[14+i],v=clamp(t.age/.7);if(v>=1)continue;draw(q,[t.p[0],t.p[1]+v*.22,t.p[2]],.72*(1-v)+.15,[2.1,.28,.008,(1-v)*.25],q.angle+time);}
     for(let i=0;i<64;i++){const q=sparks[i],t=trail[i%trail.length],v=t.age;if(v>.65)continue;draw(q,[t.p[0]+Math.cos(q.angle)*v,t.p[1]+v*(q.seed-.3),t.p[2]+Math.sin(q.angle)*v],.055+q.seed*.045,[2.7,.75,.03,1-v/.65],q.angle);}
     illuminate(3.2);
    }
   }else if(stage==='impact'){
    const life=age/2.1;if(life>=1){stage='idle';illuminate(0);return;}
    for(let i=0;i<32;i++){const q=fire[i],t=age/(.72+q.seed*.25);if(t>1)continue;const r=(.25+q.seed*2.0)*Math.sin(t*Math.PI*.5);
     draw(q,[position[0]+Math.cos(q.angle)*r,Math.max(ground+.2,position[1]+Math.sin(q.angle)*r*.8+age*.9),position[2]+Math.sin(q.angle)*r],(.85+q.seed*1.0)*(1+t),[2.8,.55*(1-t)+.08,.015,(1-t)*.8],q.angle+age);
    }
    // A brief spreading skirt distinguishes the heavy impact from Fire Blast.
    for(let i=32;i<56;i++){const q=fire[i],t=age/.8;if(t>=1)continue;const a=(i-32)/24*Math.PI*2,r=.3+age*4.0;
     draw(q,[position[0]+Math.cos(a)*r,ground+.12+q.seed*.13,position[2]+Math.sin(a)*r],.42+q.seed*.38,[2.2,.28,.008,(1-t)*.65],a);
    }
    for(let i=0;i<sparks.length;i++){const q=sparks[i],ring=i<32,t=age/(ring?.75:1.1+q.seed*.65);if(t>1)continue;const r=ring?age*5.2:(1.2+q.seed*3.8)*age;
     draw(q,[position[0]+Math.cos(q.angle)*r,ring?ground:Math.max(ground,position[1]+(1+q.seed*3)*age-3.9*age*age),position[2]+Math.sin(q.angle)*r],ring?.10+q.seed*.13:.07+q.seed*.13,[2.6,.6,.016,(1-t)*.9],q.angle);
    }
    for(const q of smoke){const t=(age-.12)/(1.5+q.seed*.4);if(t<0||t>1)continue;draw(q,[position[0]+Math.cos(q.angle)*age*.8,position[1]+age*.85,position[2]+Math.sin(q.angle)*age*.8],.9+t*2,[.095,.075,.055,Math.sin(t*Math.PI)*.45],q.angle+age*.1);}
    illuminate(6.5*Math.max(0,1-age/.9)**1.5);
   }
  },
  get stage(){return stage;},get position(){return [...position];},get active(){return stage!=='idle';},
  stats:{sprites:174,systems:3,meshes:1,lights:1},
 };
}
