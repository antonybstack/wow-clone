/** Shared solar visibility for custom receivers, native PBR, and participating fog. */
import {
 createCsmDirectionalShadowGenerator,createPcfDirectionalShadowGenerator,createDirectionalLight,
 createShaderMaterial,addTask,onSceneDispose,setShadowCasterMaterial,setShadowTaskCasterMeshes,
 getCsmReceiverTexture,onCsmReceiverUpdate,setShaderTexture,setShaderUniform,
 enableSkeletonShadows,getViewMatrix,acquireTexture,releaseTexture,
} from '@babylonjs/lite';
import {SUN_DIR} from './atmosphere.js';

export const SUN_SHADOW_RANGE=180;
const controllers=new WeakMap();
export const SUN_SHADOW_UNIFORMS=[
 ...[0,1,2].map(i=>({name:`sunCascade${i}`,type:'mat4x4<f32>'})),
 {name:'sunFarMatrix',type:'mat4x4<f32>'},
 {name:'sunSplits',type:'vec4<f32>'},
 {name:'sunLengths',type:'vec4<f32>'},
 {name:'sunShadowParams',type:'vec4<f32>',defaultValue:[0,1/2048,180,0.1]},
];
export const SUN_SHADOW_SAMPLERS=[
 {name:'sunCascades',sampleType:'depth',viewDimension:'2d-array',comparison:true},
 {name:'sunFar',sampleType:'depth',comparison:true},
];

// Directional maps have standard depth (clear 1); camera depth is reverse Z.
// Both surface and fog consume this function. Fog passes a zero normal.
export const SUN_SHADOW_WGSL=`
fn sunFarVisibility(p:vec3<f32>)->f32{
 let q=shaderUniforms.sunFarMatrix*vec4<f32>(p,1.0);
 let uv=vec2<f32>(q.x*.5+.5,.5-q.y*.5);
 if(q.z<0.0){return 1.0;}
 if(q.z>1.0 || any(uv<vec2<f32>(0.0)) || any(uv>vec2<f32>(1.0))){return 1.0;}
 return textureSampleCompareLevel(sunFar,sunFarSampler,uv,q.z-.00008);
}
fn sunCascadeVisibility(p:vec3<f32>,layer:i32)->f32{
 var m=shaderUniforms.sunCascade0;
 if(layer==1){m=shaderUniforms.sunCascade1;}if(layer==2){m=shaderUniforms.sunCascade2;}
 let q=m*vec4<f32>(p,1.0);let uv=vec2<f32>(q.x*.5+.5,.5-q.y*.5);
 if(q.z<0.0 || q.z>1.0 || any(uv<vec2<f32>(0.001)) || any(uv>vec2<f32>(.999))){return sunFarVisibility(p);}
 var light=0.0;
 for(var y=-1;y<=1;y++){for(var x=-1;x<=1;x++){
  light+=textureSampleCompareLevel(sunCascades,sunCascadesSampler,uv+vec2<f32>(f32(x),f32(y))*shaderUniforms.sunShadowParams.y,layer,q.z);
 }}
 return light/9.0;
}
fn sunVisibility(p:vec3<f32>,normal:vec3<f32>)->f32{
 if(shaderUniforms.sunShadowParams.x<.5){return 1.0;}
 let viewZ=(shaderSystem.view*vec4<f32>(p,1.0)).z;
 let limit=shaderUniforms.sunShadowParams.z;
 if(viewZ>limit){return sunFarVisibility(p);}
 var layer=0;
 if(viewZ>shaderUniforms.sunSplits.x){layer=1;}
 if(viewZ>shaderUniforms.sunSplits.y){layer=2;}
 let wp=p+normal*.004;
 let light=sunCascadeVisibility(wp,layer);
 let remaining=shaderUniforms.sunSplits[layer]-viewZ;
 let blend=1.0-smoothstep(0.0,shaderUniforms.sunLengths[layer]*shaderUniforms.sunShadowParams.w,remaining);
 if(blend>0.0){
  if(layer<2){return mix(light,sunCascadeVisibility(wp,layer+1),blend);}
  return mix(light,sunFarVisibility(p),blend);
 }
 return light;
}`;

export function bindSunReceiver(engine,material){
 const controller=controllers.get(engine);
 if(!controller)throw new Error('Create sun shadows before world materials');
 controller.addReceiver(material);
 return material;
}

export function createSunShadows(engine,scene,sun){
 const csm=createCsmDirectionalShadowGenerator(engine,sun,{
  mapSize:2048,numCascades:3,lambda:.75,shadowMaxZ:SUN_SHADOW_RANGE,
  stabilizeCascades:true,cascadeBlendPercentage:.1,worldSpaceBias:.006,forceRefreshEveryFrame:true,
 });
 enableSkeletonShadows(csm);
 sun.shadowGenerator=csm;
 // A separate frame-graph pass retains the distant map. Lite 1.28 native PBR
 // cannot bind a mixture of PCF and CSM generators in the same scene light list.
 // This light is only the far camera's transform, never a second scene light.
 const farLight=createDirectionalLight([-SUN_DIR[0],-SUN_DIR[1],-SUN_DIR[2]],0);
 farLight.position.x=SUN_DIR[0]*1100;farLight.position.y=SUN_DIR[1]*1100;farLight.position.z=80+SUN_DIR[2]*1100;
 const far=createPcfDirectionalShadowGenerator(engine,farLight,{mapSize:2048,bias:.00002,orthoMinZ:1,orthoMaxZ:2400});
 // Lite has no public PCF texture/matrix accessors yet. Guard this narrow bridge.
 if(!far._depthTexture||!far._lightMatrix)throw new Error('Lite PCF bridge unavailable');
 const farTexture={texture:far._depthTexture,view:far._depthTexture.createView(),sampler:far._depthSampler,depth:true,_sampleType:'depth',width:2048,height:2048};
 acquireTexture(farTexture);
 const csmTexture=getCsmReceiverTexture(csm),receivers=new Set(),data=new Float32Array(80);
 const state={enabled:true,characters:true,cascades:3,mapSize:2048,range:SUN_SHADOW_RANGE,staticCasters:0,dynamicCasters:0,receivers:0,version:0};
 let worldCasters=[],farCasters=[],dynamic=[];
 const updateMaterial=mat=>{
  for(let i=0;i<3;i++)setShaderUniform(mat,`sunCascade${i}`,data.subarray(i*16,i*16+16));
  setShaderUniform(mat,'sunFarMatrix',far._lightMatrix);
  setShaderUniform(mat,'sunSplits',data.subarray(64,68));setShaderUniform(mat,'sunLengths',data.subarray(68,72));
  setShaderUniform(mat,'sunShadowParams',[+state.enabled,1/state.mapSize,state.range,.1]);
 };
 const unsubscribe=onCsmReceiverUpdate(csm,next=>{data.set(next);for(const mat of receivers)updateMaterial(mat);state.version=csm._version;});
 const caster=createShaderMaterial({name:'Sun opaque world caster',attributes:['position'],uniforms:['worldViewProjection'],backFaceCulling:false,
  vertexSource:'@vertex fn mainVertex(i:VertexInput)->@builtin(position) vec4<f32>{return shaderSystem.worldViewProjection*vec4<f32>(i.position,1.0);}',
  fragmentSource:'@fragment fn mainFragment()->@location(0) vec4<f32>{return vec4<f32>(0.0);}'});
 const controller={state,csm,far,csmTexture,farTexture,data,
  addReceiver(mat){receivers.add(mat);setShaderTexture(mat,'sunCascades',csmTexture);setShaderTexture(mat,'sunFar',farTexture);updateMaterial(mat);state.receivers=receivers.size;},
  setWorld(world){worldCasters=world.meshes.filter(m=>!['Ash motes','Lamp light shafts'].includes(m.name));for(const mesh of worldCasters)setShadowCasterMaterial(mesh.material,caster);farCasters=worldCasters;state.staticCasters=worldCasters.length;dynamic=[];controller.update(true);},
  setFarCasters(meshes){farCasters=meshes;},
  update(force=false){
   // Reconcile loaded/swapped equipment and actors; hidden parked bodies are
   // omitted by Lite's visibility check, preserving source skeletons/materials.
   const next=state.characters?scene.meshes.filter(m=>m.visible!==false&&m.material&&['pbr','standard'].includes(m.material._buildGroup?._materialFamily)&&!worldCasters.includes(m)):[];
   if(force||next.length!==dynamic.length||next.some((mesh,i)=>mesh!==dynamic[i])){
    dynamic=next;
    for(const mesh of dynamic)mesh.receiveShadows=true;
    // Lite 1.28's skeleton preloader replaces its mesh wrappers before the
    // incremental CSM removal pass sees the old wrappers. Retire the old tasks
    // on membership changes, otherwise an unequipped/removed actor can continue
    // casting. Ordinary pose updates reuse the existing tasks every frame.
    const previous=csm._shadowTaskState;
    if(previous){
     csm._shadowTaskState=undefined;
     queueMicrotask(()=>{void engine._device.queue.onSubmittedWorkDone().then(()=>previous._task.dispose(),()=>previous._task.dispose());});
    }
    setShadowTaskCasterMeshes(csm,[...worldCasters,...dynamic]);state.dynamicCasters=dynamic.length;
   }
  },
  setEnabled(enabled){state.enabled=!!enabled;csm._config._darkness=enabled?0:1;csm._config._forceRefreshEveryFrame=true;},
  get view(){return getViewMatrix(scene.camera);},
  get casters(){return worldCasters;},get dynamicCasters(){return dynamic;},
  async probeSun(points){const {probeSun}=await import('./sun-shadow-probe.js');return probeSun(engine,controller,points);},
 };
 let recordedFar=null;
 const farTask={name:'sun-far-static-shadow',engine,scene,_passes:[],
  _preload:()=>far._preloadShadowTask(farCasters),
  record(){recordedFar=far._ensureShadowTaskState(engine,scene,farCasters);recordedFar._task.record();},
  execute(){
   const next=far._ensureShadowTaskState(engine,scene,farCasters);
   if(next!==recordedFar){recordedFar=next;next._task.record();}
   const draws=far._renderShadowMap(engine,next);
   for(const mat of receivers)updateMaterial(mat);
   return draws;
  },
  dispose(){recordedFar?._task.dispose();recordedFar=null;},
 };
 addTask(scene,farTask);
 // Scene teardown first retires frame-graph tasks and renderable references.
 // Release our owner references and generator buffers once consumers retire.
 onSceneDispose(scene,()=>{
  unsubscribe();receivers.clear();controllers.delete(engine);
  releaseTexture(farTexture);releaseTexture(csmTexture);
  far._shadowUBO.destroy();far._shadowParamsUBO.destroy();
  csm._shadowUBO.destroy();csm._shadowParamsUBO.destroy();
 });
 controllers.set(engine,controller);
 return controller;
}
