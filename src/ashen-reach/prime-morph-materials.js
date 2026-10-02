/** Reuse the accepted body editor's Lite 1.31.1 morph/PBR initialization.
 * This non-rendering scene registers the lazy native feature before a live
 * scene rebuild/CSM encounters morphed meshes. It is not another game renderer
 * or an asynchronous-shader experiment. One promise per engine; failure retries.
 * https://github.com/BabylonJS/Babylon-Lite/blob/npm-lite-v1.31.1/docs/lite/architecture/01-scene.md
 * https://github.com/BabylonJS/Babylon-Lite/blob/npm-lite-v1.31.1/packages/babylon-lite/src/shader/fragments/morph-fragment-core.ts
 */
import {createSceneContext,createPlane,createMorphTargets,createPbrMaterial,
 addToScene,setMeshVisible,rebuildScenePbrPipelines,disposeScene} from '@babylonjs/lite';
const pending=new WeakMap();
export function primeMorphMaterialSupport(engine){
 let promise=pending.get(engine);if(promise)return promise;
 promise=(async()=>{
  const scene=createSceneContext(engine,{defaultRenderTask:false});
  try{
   const warm=createPlane(engine);warm.material=createPbrMaterial();
   warm.morphTargets=createMorphTargets(engine,[{positions:new Float32Array(12),normals:new Float32Array(12)}],4,[0]);
   setMeshVisible(warm,false);addToScene(scene,warm);await rebuildScenePbrPipelines(scene,true);
  }finally{disposeScene(scene);}
 })();pending.set(engine,promise);promise.catch(()=>{if(pending.get(engine)===promise)pending.delete(engine);});return promise;
}
