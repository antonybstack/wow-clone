/** Linear HDR surfaces -> contact/AO -> fog -> bloom -> one SDR display transform. */
import {addTask,addTaskAfter,createBloomPostProcessTask,createRenderTarget,createRenderTask} from '@babylonjs/lite';
import {createVolumetricFog} from './volumetric-fog.js';
import {createContactOcclusion} from './contact-occlusion.js';
import {createDisplayPass} from './display-pass.js';
import {HDR_FORMAT} from './color-management.js';
export const BLOOM_THRESHOLD=1.2;
export const BLOOM_WEIGHT=.12;
export const BLOOM_KERNEL=36;
export const BLOOM_SCALE=.5;
function sceneTarget(engine,scene){
 const sceneRT=createRenderTarget({lbl:'ashen-linear-scene',format:HDR_FORMAT,dFormat:'depth32float',samples:1,size:engine});
 const sceneTask=createRenderTask({name:'ashen-scene',rt:sceneRT},engine,scene);
 addTask(scene,sceneTask);return {sceneRT,sceneTask};
}
export function buildDirectPipeline(engine,scene){
 const {sceneRT,sceneTask}=sceneTarget(engine,scene);
 const display=createDisplayPass(engine,scene,sceneRT);addTaskAfter(scene,display.task,sceneTask);
 return {sceneTask,sceneRT,display,status:{hdr:true,format:HDR_FORMAT,bloom:false,display:display.state,notes:['effects skipped by ?noPost; display conversion retained']}};
}
export function buildPostPipeline(engine,scene,sun,world,shadows){
 const status={hdr:true,format:HDR_FORMAT,bloom:false,notes:[]};
 const {sceneRT,sceneTask}=sceneTarget(engine,scene);
 const grounding=createContactOcclusion(engine,scene,sceneRT);
 addTaskAfter(scene,grounding.contactTask,sceneTask);addTaskAfter(scene,grounding.aoTask,grounding.contactTask);addTaskAfter(scene,grounding.compositeTask,grounding.aoTask);
 const volume=createVolumetricFog(engine,scene,sceneRT,sun,world,shadows,grounding.output);
 addTaskAfter(scene,volume.fogTask,grounding.compositeTask);addTaskAfter(scene,volume.compositeTask,volume.fogTask);
 status.volumetric=volume.state;
 const bloomTask=createBloomPostProcessTask({name:'ashen-hdr-bloom',sourceTexture:volume.output,
  // Lite raises its threshold to 1/2.2; invert that API convention so this
  // constant denotes a linear radiance threshold.
  threshold:BLOOM_THRESHOLD**2.2,exposure:1,weight:BLOOM_WEIGHT,kernel:BLOOM_KERNEL,bloomScale:BLOOM_SCALE},engine,scene);
 // Let Lite own and dispose the merge target. It inherits the HDR source format.
 const bloomRT=bloomTask.outputTexture;
 addTaskAfter(scene,bloomTask,volume.compositeTask);status.bloom=true;
 const display=createDisplayPass(engine,scene,bloomRT);addTaskAfter(scene,display.task,bloomTask);status.display=display.state;
 return {status,sceneTask,sceneRT,volume,grounding,bloomTask,bloomRT,display};
}
