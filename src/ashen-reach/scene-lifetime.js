import {onSceneDispose} from '@babylonjs/lite';
const lifetimes=new WeakMap();
/** Native scene disposal cancels app-owned async installation continuations.
 * Native loaders may finish after cancellation; callers retire uninstalled
 * mesh claims before throwing. Textures remain under Lite's engine cache.
 * https://github.com/BabylonJS/Babylon-Lite/blob/npm-lite-v1.31.1/docs/lite/architecture/01-scene.md
 */
export function sceneLifetime(scene){
 let signal=lifetimes.get(scene);
 if(!signal){const controller=new AbortController();signal=controller.signal;lifetimes.set(scene,signal);onSceneDispose(scene,()=>controller.abort(Error('Scene disposed during asynchronous loading')));}
 return signal;
}
