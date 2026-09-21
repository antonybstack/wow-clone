/**
 * Ashen Reach's post chain: scene -> bloom -> swapchain.
 *
 * The world's shader materials tonemap and grade themselves (atmosphere.js), so
 * by the time a pixel reaches this render target it is already in display range.
 * That is exactly why bloom belongs here and not in the material: the thing worth
 * blooming is the *composited* image -- the sun glow behind the citadel, a lantern
 * flame read through haze, a rim light on the player's shoulder -- and no single
 * material can see any of those. It is also what sells haze as light rather than
 * as grey paint, which is the one reference trait the shader work could not buy.
 *
 * Threshold is deliberately high. Almost nothing in a blue-hour scene should
 * bloom; if the grass starts glowing the picture reads as a bad HDR photo rather
 * than as dusk. Only the sun lobe and the flames clear 0.78.
 *
 * Failure here is non-fatal by design: if the task cannot be created the scene
 * still has to present, so the catch falls back to a straight copy and the caller
 * reports it rather than the page going black.
 */
import {addTask,addTaskAfter,createBloomPostProcessTask,createCopyToTextureTask,createRenderTarget,createRenderTask} from '@babylonjs/lite';

export const BLOOM_THRESHOLD=0.55;
export const BLOOM_WEIGHT=0.65;
export const BLOOM_KERNEL=64;
export const BLOOM_SCALE=0.5;

export function buildPostPipeline(engine,scene){
 const status={bloom:false,notes:[]};
 const sceneRT=createRenderTarget({lbl:'ashen-scene',format:engine.format,dFormat:'depth24plus-stencil8',samples:1,size:engine});
 const sceneTask=createRenderTask({name:'ashen-scene',rt:sceneRT},engine,scene);
 addTask(scene,sceneTask);

 try{
  const bloomTask=createBloomPostProcessTask({
   name:'ashen-bloom',
   sourceTexture:sceneRT,
   targetTexture:engine.scRT,
   threshold:BLOOM_THRESHOLD,
   weight:BLOOM_WEIGHT,
   kernel:BLOOM_KERNEL,
   bloomScale:BLOOM_SCALE,
  },engine,scene);
  addTaskAfter(scene,bloomTask,sceneTask);
  status.bloom=true;
 }catch(error){
  status.notes.push(`bloom disabled: ${error.message||error}`);
  addTaskAfter(scene,createCopyToTextureTask({name:'ashen-present',sourceTexture:sceneRT,targetTexture:engine.scRT},engine,scene),sceneTask);
 }
 return {status,sceneTask,sceneRT};
}
