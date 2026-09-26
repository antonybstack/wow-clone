import {createEffectWrapper,createEffectRenderTask,setEffectTexture,setEffectUniforms,disposeEffectWrapper} from '@babylonjs/lite';
import {DISPLAY_WGSL,DEFAULT_EXPOSURE,DEFAULT_SATURATION} from './color-management.js';
export function createDisplayPass(engine,scene,source,sourceTexture=null){
 const state={exposure:DEFAULT_EXPOSURE,saturation:DEFAULT_SATURATION,output:'srgb',toneMap:'ACES fitted',resolution:[]};
 const effect=createEffectWrapper(engine,{name:'Ashen final display transform',fragmentWGSL:`
 @group(0) @binding(0) var source:texture_2d<f32>;
 @group(0) @binding(1) var<uniform> settings:vec4<f32>;
 ${DISPLAY_WGSL}
 @fragment fn effectFragment(@builtin(position) p:vec4<f32>)->@location(0) vec4<f32>{
  let pixel=clamp(vec2<i32>(p.xy),vec2<i32>(0),vec2<i32>(textureDimensions(source))-1);
  return vec4<f32>(displayColor(textureLoad(source,pixel,0).rgb,settings.x,settings.y),1.0);
 }`,bindings:[{name:'source',binding:0,kind:'texture'},{name:'settings',binding:1,kind:'uniform',uniformByteLength:16}]});
 const task=createEffectRenderTask({name:'ashen-display',effect,target:engine.scRT},engine,scene);
 const record=task.record.bind(task),execute=task.execute.bind(task),dispose=task.dispose.bind(task);
 task.record=()=>{setEffectTexture(effect,'source',sourceTexture??{view:source._colorView});state.resolution=sourceTexture?[sourceTexture.width,sourceTexture.height]:[source._width,source._height];return record();};
 task.execute=()=>{
  const finite=(v,fallback,min,max)=>Number.isFinite(v)?Math.min(max,Math.max(min,v)):fallback;
  state.exposure=finite(state.exposure,DEFAULT_EXPOSURE,.05,4);
  state.saturation=finite(state.saturation,DEFAULT_SATURATION,0,1.5);
  setEffectUniforms(effect,{settings:new Float32Array([state.exposure,state.saturation,0,0])});return execute();
 };
 task.dispose=()=>{dispose();disposeEffectWrapper(effect);};return {task,state,source};
}
