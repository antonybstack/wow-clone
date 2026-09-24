/** Scene color/depth -> shadowed volumetric fog -> depth-aware composite -> bloom.
 * The fog pass reverses the shared material grade for its light integration.
 * Bloom failure still falls back to presenting the composed atmosphere.
 */
import {addTask,addTaskAfter,createBloomPostProcessTask,createCopyToTextureTask,createRenderTarget,createRenderTask} from '@babylonjs/lite';
import {createVolumetricFog} from './volumetric-fog.js';

export const BLOOM_THRESHOLD=0.78;
export const BLOOM_WEIGHT=0.24;
export const BLOOM_KERNEL=36;
export const BLOOM_SCALE=0.5;

export function buildDirectPipeline(engine,scene){
 const depth=createRenderTarget({lbl:'ashen-direct-depth',dFormat:'depth32float',samples:1,size:engine});
 const sceneTask=createRenderTask({name:'ashen-direct',rt:engine.scRT,depth},engine,scene);
 addTask(scene,sceneTask);
 return {sceneTask,status:{bloom:false,notes:['skipped by ?noPost']}};
}

export function buildPostPipeline(engine,scene,sun,world,shadows){
 const status={bloom:false,notes:[]};
 const sceneRT=createRenderTarget({lbl:'ashen-scene',format:engine.format,dFormat:'depth32float',samples:1,size:engine});
 const sceneTask=createRenderTask({name:'ashen-scene',rt:sceneRT},engine,scene);
 addTask(scene,sceneTask);
 const volume=createVolumetricFog(engine,scene,sceneRT,sun,world,shadows);
 addTaskAfter(scene,volume.fogTask,sceneTask);
 addTaskAfter(scene,volume.compositeTask,volume.fogTask);
 status.volumetric=volume.state;

 try{
  const bloomTask=createBloomPostProcessTask({
   name:'ashen-bloom',
   sourceTexture:volume.output,
   targetTexture:engine.scRT,
   threshold:BLOOM_THRESHOLD,
   weight:BLOOM_WEIGHT,
   kernel:BLOOM_KERNEL,
   bloomScale:BLOOM_SCALE,
  },engine,scene);
  addTaskAfter(scene,bloomTask,volume.compositeTask);
  status.bloom=true;
 }catch(error){
  status.notes.push(`bloom disabled: ${error.message||error}`);
  addTaskAfter(scene,createCopyToTextureTask({name:'ashen-present',sourceTexture:volume.output,targetTexture:engine.scRT},engine,scene),volume.compositeTask);
 }
 return {status,sceneTask,sceneRT,volume};
}
