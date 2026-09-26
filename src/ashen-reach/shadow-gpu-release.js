import {waitForGpuIdle,waitForGpuResourceRetirements} from '@babylonjs/lite';

/** Scene disposal is synchronous, but a submitted shadow pass may still use
 * generator-owned depth textures and UBOs. Run their final releases after the
 * queue fence, then drain Lite's deferred releases. The caller stops its tasks
 * synchronously before scheduling this work.
 * https://github.com/BabylonJS/Babylon-Lite/blob/npm-lite-v1.31.1/docs/lite/architecture/50-device-lost-recovery.md
 * https://github.com/BabylonJS/Babylon-Lite/blob/npm-lite-v1.31.1/docs/lite/architecture/28-frame-graph.md
 */
export function scheduleShadowGpuRelease(engine,release){
 const completion=waitForGpuIdle(engine).then(()=>{
  release();
  return waitForGpuResourceRetirements(engine);
 });
 // Scene disposal has no async return value; diagnostic probes can await the
 // original promise without causing an unhandled rejection in normal teardown.
 completion.catch(()=>{});
 return completion;
}
