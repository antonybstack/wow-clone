import {VERSION} from '@babylonjs/lite';

/** Pinned adapter around Lite's automatic post-registration material queue.
 * An owner can supply one awaited public family rebuild instead of leaving its
 * own meshes queued for later draws. Do not touch another owner's pending work.
 * No public batched runtime material-build API exists in Lite 1.31.1; fail closed
 * if its reviewed queue layout changes. Keep this adapter free of crowd assets.
 * https://github.com/BabylonJS/Babylon-Lite/blob/npm-lite-v1.31.1/packages/babylon-lite/src/scene/scene-material-swap.ts
 * https://github.com/BabylonJS/Babylon-Lite/blob/npm-lite-v1.31.1/packages/babylon-lite/src/scene/scene-runtime-mesh-build.ts
 */
export function claimQueuedBuilds(scene,meshes){
 if(VERSION!=='1.31.1'||!Array.isArray(scene._materialSwapQueue))throw Error('Native material staging requires the reviewed Lite 1.31.1 queue');
 const owned=new Set(meshes),queue=scene._materialSwapQueue;
 for(let i=queue.length-1;i>=0;i--)if(owned.has(queue[i]))queue.splice(i,1);
 for(const mesh of meshes)if(mesh.thinInstances)mesh._runtimeThinBuild=undefined;
}
