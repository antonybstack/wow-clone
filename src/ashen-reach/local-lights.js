/** Two bounded spot shadow maps shared by native/custom surfaces and fog. */
import {createSpotLight,createPcfSpotlightShadowGenerator,enableSkeletonShadows,addTask,onSceneDispose,setShaderTexture,setShaderUniform,acquireTexture,releaseTexture} from '@babylonjs/lite';
import {LOCAL_LIGHT_UNIFORMS,LOCAL_MAP_SIZE,desiredLocalLights,advanceLocalSlots} from './local-light-shared.js';
import {configureLocalLightMaterials} from './local-light-materials.js';
import {createLocalLightBoundsCache} from './local-light-bounds.js';
const controllers=new WeakMap();
export function bindLocalReceiver(engine,material){controllers.get(engine)?.addReceiver(material);return material;}

export function createLocalLights(engine,scene,shadows){
 const bounds=createLocalLightBoundsCache();
 const values=Object.fromEntries(LOCAL_LIGHT_UNIFORMS.map(u=>[u.name,new Float32Array(u.type.startsWith('mat')?16:4)]));
 const state={enabled:true,shadows:true,characters:true,specular:true,details:true,mapSize:LOCAL_MAP_SIZE,budget:2,candidates:0,active:[],draws:0,version:0,cacheHits:0,mapRenders:0};
 const receivers=new Set();let candidates=[],casters=[],requested=[],disposed=false,revision=0,preload=Promise.resolve(),preloadError=null;
 const slots=[0,1].map(i=>{
  const spot=createSpotLight([0,3,44],[0,-1,0],Math.PI*.73,1,1);spot.range=8;
  const generator=createPcfSpotlightShadowGenerator(engine,spot,{mapSize:LOCAL_MAP_SIZE,near:.08,far:8,bias:.0001,forceRefreshEveryFrame:false});
  enableSkeletonShadows(generator);
  if(!generator._depthTexture||!generator._lightMatrix||!generator._preloadShadowTask)throw Error('Lite local PCF bridge unavailable');
  const texture={texture:generator._depthTexture,view:generator._depthTexture.createView(),sampler:generator._depthSampler,depth:true,_sampleType:'depth',width:LOCAL_MAP_SIZE,height:LOCAL_MAP_SIZE};acquireTexture(texture);
  return {index:i,spot,generator,texture,light:null,weight:0,recorded:null,casters:[],nearby:[],renders:0,cacheHits:0};
 });
 function sync(){
  for(const s of slots){
   const i=s.index,l=s.light;
   values[`localMatrix${i}`].set(s.generator._lightMatrix);
   values[`localPosition${i}`].set([...(l?.position??[0,3,0]),8]);
   values[`localDirection${i}`].set([0,-1,0,Math.cos(Math.PI*.73/2)]);
   values[`localColor${i}`].set([1,.58,.26,state.enabled&&l?s.weight*l.strength:0]);
   values[`localParams${i}`].set([Math.cos(Math.PI*.48/2),.00018,1/LOCAL_MAP_SIZE,+state.shadows]);
  }
  for(const m of receivers)for(const [name,value] of Object.entries(values))setShaderUniform(m,name,value);
  for(const m of receivers){
   if(m._uniformValues.has('localSpecularStrength'))setShaderUniform(m,'localSpecularStrength',+state.specular);
   if(m._uniformValues.has('surfaceDetailStrength'))setShaderUniform(m,'surfaceDetailStrength',+state.details);
  }
  state.active=slots.map(s=>({id:s.light?.id??null,weight:s.weight,version:s.generator._version,casters:s.casters.length,nearby:s.nearby.length,renders:s.renders,cacheHits:s.cacheHits}));
 }
 function slotCasters(s){
  const staticSet=new Set(shadows.casters),p=s.light?.position??[0,3,44];
  const nearby=casters.filter(m=>!staticSet.has(m)&&m.visible!==false&&bounds.canAffect(m,p,s.nearby.includes(m)?9:8));
  const next=[...casters.filter(m=>staticSet.has(m)&&m.visible!==false),...nearby];
  if(!next.length)throw Error('Local shadows require an explicit caster list');
  s.nearby=nearby;
  if(next.length!==s.casters.length||next.some((m,i)=>m!==s.casters[i]))s.casters=next;
  // A stationary actor can animate without changing worldMatrixVersion.
  // Keep native depth geometry current whenever a deforming mesh is in range.
  s.generator._config._forceRefreshEveryFrame=nearby.some(m=>m.skeleton||m.morphTargets||m.morphTargetManager);
  return s.casters;
 }
 const controller={slots,values,state,boundsStats:bounds.stats,
  setWorld(world){candidates=world.localLights;state.candidates=candidates.length;controller.update(1,{x:0,z:0});},
  addReceiver(mat){receivers.add(mat);for(const s of slots)setShaderTexture(mat,`localShadow${s.index}`,s.texture);for(const [name,value] of Object.entries(values))setShaderUniform(mat,name,value);},
  update(dt,position){
   if(disposed)return;
   if(preloadError)throw preloadError;
   // main.js calls this after body, combat and equipment animation updates.
   bounds.beginFrame();
   advanceLocalSlots(slots,desiredLocalLights(candidates,slots,position??{x:0,z:0}),dt);
   for(const s of slots){if(!s.light)continue;const p=s.light.position;s.spot.position.x=p[0];s.spot.position.y=p[1];s.spot.position.z=p[2];}
   // Keep the identity stable while membership is unchanged so Lite reuses tasks.
   const next=[...shadows.casters,...(state.characters?shadows.dynamicCasters:[])];
   if(next.length!==requested.length||next.some((m,i)=>m!==requested[i])){
    requested=next;const request=++revision;
    // New Standard/PBR families can arrive after startup. Await Lite's depth
    // builders before presenting new membership to its synchronous task path.
    preload=Promise.all(slots.map(s=>s.generator._preloadShadowTask(next))).then(()=>{
     if(!disposed&&request===revision)casters=next;
    }).catch(error=>{preloadError=error;});
   }
   sync();
  },
  get casters(){return casters;},
  async probe(points){const {probeLocalLights}=await import('./local-light-probe.js');return probeLocalLights(engine,controller,points);},
 };
 controllers.set(engine,controller);configureLocalLightMaterials(scene,controller);
 for(const s of slots){
  const task={name:`local-spot-shadow-${s.index}`,engine,scene,_passes:[],
   _preload:async()=>{await preload;if(preloadError)throw preloadError;},
   record(){s.recorded=s.generator._ensureShadowTaskState(engine,scene,slotCasters(s));s.recorded._task.record();},
   execute(){
    // Even disabled fixtures receive an initialized map, keeping bindings valid.
    const next=s.generator._ensureShadowTaskState(engine,scene,slotCasters(s));
    if(next!==s.recorded){s.recorded=next;next._task.record();}
    const draws=s.generator._renderShadowMap(engine,next);
    if(draws){s.renders++;state.mapRenders++;state.version++;}else{s.cacheHits++;state.cacheHits++;}
    s.draws=draws;state.draws=slots.reduce((n,slot)=>n+(slot.draws??0),0);sync();return draws;
   },
   dispose(){s.recorded?._task.dispose();s.recorded=null;},
  };addTask(scene,task);s.task=task;
 }
 onSceneDispose(scene,()=>{disposed=true;receivers.clear();controllers.delete(engine);for(const s of slots){releaseTexture(s.texture);s.generator._shadowUBO.destroy();s.generator._shadowParamsUBO.destroy();}});
 return controller;
}
