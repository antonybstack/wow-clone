/** Shared solar visibility for custom receivers, native PBR, and participating fog. */
import {
 createCsmDirectionalShadowGenerator,createPcfDirectionalShadowGenerator,createDirectionalLight,
 createShaderMaterial,addTask,onSceneDispose,setShadowCasterMaterial,setShadowTaskCasterMeshes,
 getCsmReceiverTexture,onCsmReceiverUpdate,setShaderTexture,setShaderUniform,
 enableSkeletonShadows,getViewMatrix,acquireTexture,releaseTexture,setShadowGeneratorEnabled,
 VERSION as LITE_VERSION,
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

export function createSunShadows(engine,scene,sun,{depthOnlyFragment=false}={}){
 if(LITE_VERSION!=='1.28.0'&&LITE_VERSION!=='1.31.1')
  throw new Error(`Unsupported Lite shadow bridge version ${LITE_VERSION}`);
 // Lite 1.28.0 and 1.31.1 have no public PCF generator disposer or texture reader.
 // https://github.com/BabylonJS/Babylon-Lite/blob/npm-lite-v1.31.1/docs/lite/architecture/17-cascaded-shadow.md
 // https://github.com/BabylonJS/Babylon-Lite/blob/npm-lite-v1.31.1/docs/lite/architecture/28-frame-graph.md
 // Ownership: CSM creates depth/UBOs and getCsmReceiverTexture acquires its
 // cached wrapper's generator reference; far PCF creates depth/UBOs and this
 // module acquires its wrapper once. Materials and frame-graph tasks borrow both.
 // Scene disposal retires frame-graph tasks before this callback releases the
 // two final owner references and destroys generator UBOs. The documented CSM
 // wrapper is borrowed by receivers; our final release is the generator-owner
 // exception while Lite exposes no public generator disposal API.
 const previousShadowGenerator=sun.shadowGenerator;
 let csm=null,far=null,farTexture=null,csmTexture=null,farTextureAcquired=false;
 let unsubscribe=null,farTask=null,controller=null,disposed=false;
 const receivers=new Set(),retiredTasks=new WeakSet();
 const disposeTask=task=>{if(!task||retiredTasks.has(task))return;retiredTasks.add(task);task.dispose();};
 const cleanup=()=>{
  if(disposed)return;
  disposed=true;
  unsubscribe?.();receivers.clear();
  if(controllers.get(engine)===controller)controllers.delete(engine);
  if(sun.shadowGenerator===csm)sun.shadowGenerator=previousShadowGenerator;
  // On setup failure, the frame graph may not own farTask yet. Its dispose is
  // guarded because scene disposal calls it independently when registered.
  farTask?.dispose();
  if(farTextureAcquired)releaseTexture(farTexture);else far?._depthTexture?.destroy?.();
  if(csmTexture)releaseTexture(csmTexture);else csm?._depthTexture?.destroy?.();
  far?._shadowUBO?.destroy?.();far?._shadowParamsUBO?.destroy?.();
  csm?._shadowUBO?.destroy?.();csm?._shadowParamsUBO?.destroy?.();
 };
 onSceneDispose(scene,cleanup);
 try{
 csm=createCsmDirectionalShadowGenerator(engine,sun,{
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
 far=createPcfDirectionalShadowGenerator(engine,farLight,{mapSize:2048,bias:.00002,orthoMinZ:1,orthoMaxZ:2400});
 // Lite has no public PCF texture/matrix accessors yet. Guard this narrow bridge.
 if(typeof far._depthTexture?.createView!=='function'||!far._depthSampler||far._lightMatrix?.length!==16||
    typeof far._preloadShadowTask!=='function'||typeof far._ensureShadowTaskState!=='function'||
    typeof far._renderShadowMap!=='function'||typeof far._shadowUBO?.destroy!=='function'||
    typeof far._shadowParamsUBO?.destroy!=='function')throw new Error('Lite 1.28/1.31 far PCF bridge unavailable');
 farTexture={texture:far._depthTexture,view:far._depthTexture.createView(),sampler:far._depthSampler,depth:true,_sampleType:'depth',width:2048,height:2048};
 acquireTexture(farTexture);
 farTextureAcquired=true;
 csmTexture=getCsmReceiverTexture(csm);
 if(typeof csm._shadowUBO?.destroy!=='function'||typeof csm._shadowParamsUBO?.destroy!=='function'||
    typeof csm._depthTexture?.createView!=='function')
  throw new Error('Lite 1.28/1.31 CSM bridge unavailable');
 const data=new Float32Array(80);
 const state={enabled:true,characters:true,cascades:3,mapSize:2048,range:SUN_SHADOW_RANGE,staticCasters:0,dynamicCasters:0,receivers:0,version:0,depthOnlyFragment};
 let worldCasters=[],farCasters=[],dynamic=[];
 const updateMaterial=mat=>{
  for(let i=0;i<3;i++)setShaderUniform(mat,`sunCascade${i}`,data.subarray(i*16,i*16+16));
  setShaderUniform(mat,'sunFarMatrix',far._lightMatrix);
  setShaderUniform(mat,'sunSplits',data.subarray(64,68));setShaderUniform(mat,'sunLengths',data.subarray(68,72));
  setShaderUniform(mat,'sunShadowParams',[+state.enabled,1/state.mapSize,state.range,.1]);
 };
 unsubscribe=onCsmReceiverUpdate(csm,next=>{if(disposed)return;data.set(next);for(const mat of receivers)updateMaterial(mat);state.version=csm._version;});
 // A capability probe selects this for WebKit builds that reject fragmentless
 // depth bundles (319980). Keep shadow geometry/bias/bundles unchanged.
 const caster=createShaderMaterial({name:'Sun opaque world caster',attributes:['position'],uniforms:['worldViewProjection'],backFaceCulling:false,depthOnlyFragment,
  vertexSource:'@vertex fn mainVertex(i:VertexInput)->@builtin(position) vec4<f32>{return shaderSystem.worldViewProjection*vec4<f32>(i.position,1.0);}',
  fragmentSource:'@fragment fn mainFragment() {}'});
 controller={state,csm,far,csmTexture,farTexture,data,
  addReceiver(mat){if(disposed)return;receivers.add(mat);setShaderTexture(mat,'sunCascades',csmTexture);setShaderTexture(mat,'sunFar',farTexture);updateMaterial(mat);state.receivers=receivers.size;},
  setWorld(world){if(disposed)return;worldCasters=world.meshes.filter(m=>!['Ash motes','Lamp light shafts'].includes(m.name));for(const mesh of worldCasters)setShadowCasterMaterial(mesh.material,caster);farCasters=worldCasters;state.staticCasters=worldCasters.length;dynamic=[];controller.update(true);},
  setFarCasters(meshes){farCasters=meshes;},
  update(force=false){
   if(disposed)return;
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
     if(typeof previous._task?.dispose!=='function'||typeof engine._device?.queue?.onSubmittedWorkDone!=='function')
      throw new Error('Lite 1.28/1.31 CSM task retirement bridge unavailable');
     csm._shadowTaskState=undefined;
     // 1.28.0 needs this fenced retirement when skeleton/gear changes replace
     // wrappers. Preserve it through the 1.31.1 migration; remove only after a
     // separate native membership trial proves there are no ghost casters.
     queueMicrotask(()=>{void engine._device.queue.onSubmittedWorkDone().then(
      ()=>disposeTask(previous._task),()=>disposeTask(previous._task));});
    }
    setShadowTaskCasterMeshes(csm,[...worldCasters,...dynamic]);state.dynamicCasters=dynamic.length;
   }
  },
  setEnabled(enabled){if(disposed)return;state.enabled=!!enabled;
   // Public Lite toggle retains receiver bindings while suspending map draws.
   // Our custom receivers also read state.enabled to bypass a stale depth map.
   // https://github.com/BabylonJS/Babylon-Lite/blob/npm-lite-v1.31.1/docs/lite/architecture/17-cascaded-shadow.md
   setShadowGeneratorEnabled(csm,state.enabled);},
  get view(){return getViewMatrix(scene.camera);},
  get casters(){return worldCasters;},get dynamicCasters(){return dynamic;},
  async probeSun(points){const {probeSun}=await import('./sun-shadow-probe.js');return probeSun(engine,controller,points);},
 };
 let recordedFar=null;
 farTask={name:'sun-far-static-shadow',engine,scene,_passes:[],
  _preload:()=>disposed?Promise.resolve():far._preloadShadowTask(farCasters),
  record(){if(disposed)return;recordedFar=far._ensureShadowTaskState(engine,scene,farCasters);recordedFar._task.record();},
  execute(){
   if(disposed)return 0;
   const next=far._ensureShadowTaskState(engine,scene,farCasters);
   if(next!==recordedFar){recordedFar=next;next._task.record();}
   const draws=far._renderShadowMap(engine,next);
   for(const mat of receivers)updateMaterial(mat);
   return draws;
  },
  dispose(){disposeTask(recordedFar?._task);recordedFar=null;},
 };
 addTask(scene,farTask);
 controllers.set(engine,controller);
 return controller;
 }catch(error){cleanup();throw error;}
}
