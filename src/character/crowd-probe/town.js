/** Developer-only actual-region VAT candidate. Never imported by the shipped
 * route. Native material rebuilding is staged before caster enrollment; the
 * reproduced original M003 failure is avoided by the staged native rebuild.
 * This remains a diagnostic, not an accepted crowd capacity/transition system.
 * https://github.com/BabylonJS/Babylon-Lite/blob/npm-lite-v1.31.1/packages/babylon-lite/src/vat/vat-baker.ts
 */
import {addToScene,attachVat,createVatBakeResults,disposeMeshGpu,getContainerMeshes,
  getViewMatrix,getViewProjectionMatrix,projectWorldToScreen,loadGltf,onBeforeRender,
  prepareVatMany,rebuildScenePbrPipelines,removeFromScene,setMeshVisible,setThinInstances,VERSION} from '@babylonjs/lite';
import {sceneLifetime} from '../../ashen-reach/scene-lifetime.js';
import {actorPhaseSeconds,decodePreparedCrowdAppearance,planCrowdBatches} from './batches.js';

// Native onBeforeRender has no unsubscribe. One scene-owned callback holds only
// currently live handles, so repeated mount/remove does not retain old cohorts.
// https://github.com/BabylonJS/Babylon-Lite/blob/npm-lite-v1.31.1/packages/babylon-lite/src/scene/scene-core.ts
const playbackByScene=new WeakMap();
/** Lite 1.31.1 enqueues one full-family runtime rebuild per new thin mesh.
 * This diagnostic supplies one awaited public family rebuild instead. Remove
 * ONLY our newly enqueued meshes synchronously, before the first await/frame;
 * hidden meshes still participate in the normal native material-swap drain.
 * No public batched post-registration material-build API exists in 1.31.1.
 * Fail closed on migration; never change an unrelated queued material swap.
 * https://github.com/BabylonJS/Babylon-Lite/blob/npm-lite-v1.31.1/packages/babylon-lite/src/scene/scene-material-swap.ts
 * https://github.com/BabylonJS/Babylon-Lite/blob/npm-lite-v1.31.1/packages/babylon-lite/src/scene/scene-runtime-mesh-build.ts
 */
function claimQueuedBuilds(scene,meshes) {
  const owned=new Set(meshes),queue=scene._materialSwapQueue;
  for(let i=queue.length-1;i>=0;i--)if(owned.has(queue[i]))queue.splice(i,1);
  for(const mesh of meshes)if(mesh.thinInstances)mesh._runtimeThinBuild=undefined;
}
function enrollPlayback(scene,handles) {
  let live=playbackByScene.get(scene);
  if(!live) {
    live=new Set();playbackByScene.set(scene,live);
    onBeforeRender(scene,ms=>{for(const handle of live)handle.update(ms/1000);});
    sceneLifetime(scene).addEventListener('abort',()=>live.clear(),{once:true});
  }
  for(const handle of handles)live.add(handle);
  return ()=>{for(const handle of handles)live.delete(handle);};
}

export async function mountTownCrowd(game,{count=1,outfit='wayfarer',motion='walk',centerZ=120,signal:requestSignal}={}) {
  if(!game?.engine||!game?.scene||!game?.world)throw Error('Expected a ready Ashen Reach game');
  if(!Number.isInteger(count)||count<1||count>300)throw RangeError('Town probe count must be 1–300');
  if(!['walk','idle'].includes(motion))throw RangeError('Town probe motion must be walk or idle');
  if(!Number.isFinite(centerZ))throw RangeError('Town probe centerZ must be finite');
  if(VERSION!=='1.31.1'||!Array.isArray(game.scene._materialSwapQueue))throw Error('Town VAT batch staging requires the reviewed Lite 1.31.1 queue layout');
  const signal=requestSignal?AbortSignal.any([sceneLifetime(game.scene),requestSignal]):sceneLifetime(game.scene);
  signal.throwIfAborted();
  const manifestResponse=await fetch('/__crowd_probe__/manifest.json',{signal});
  if(!manifestResponse.ok)throw Error('Prepare the developer-only crowd assets first');
  const manifest=await manifestResponse.json(),variant=manifest.variants[outfit];
  if(!variant)throw Error(`Unknown town outfit ${outfit}`);
  const recipe=decodePreparedCrowdAppearance(variant.recipe);
  const actors=Array.from({length:count},(_,i)=>({id:`town-${String(i).padStart(4,'0')}`,outfit,recipe}));
  const plan=planCrowdBatches(actors,manifest);
  const response=await fetch(`/__crowd_probe__/${variant.file}`,{signal});
  if(!response.ok)throw Error(`Town GLB HTTP ${response.status}`);
  const bytes=await response.arrayBuffer();signal.throwIfAborted();
  const container=await loadGltf(game.engine,bytes);
  const allMeshes=getContainerMeshes(container);
  let added=false,disposed=false,leavePlayback=()=>{},baked=[];
  function dispose() {
    if(disposed)return;disposed=true;
    signal.removeEventListener('abort',dispose);leavePlayback();
    // removeFromScene owns deferred retirement of registered meshes. A failed
    // partial add can leave other meshes unregistered; only those dispose here.
    // https://github.com/BabylonJS/Babylon-Lite/blob/npm-lite-v1.31.1/packages/babylon-lite/src/scene/scene-remove.ts
    const unattached=added?allMeshes.filter(mesh=>!game.scene.meshes.includes(mesh)):allMeshes;
    if(added)removeFromScene(game.scene,container);
    for(const mesh of unattached)disposeMeshGpu(mesh);
  }
  try {
    signal.throwIfAborted();
    const meshes=allMeshes.filter(mesh=>mesh.skeleton&&plan.batches.some(b=>b.mesh===mesh.name));
    // A named glTF piece can have multiple material primitives (the sword has
    // two). All of them belong to the same logical batch and need playback.
    if(!plan.batches.every(batch=>meshes.some(mesh=>mesh.name===batch.mesh)))throw Error('Town asset does not contain every planned skinned piece');
    const clips=(container.animationGroups||[]).filter(g=>['Idle_Loop','Walk_Loop'].includes(g.name));
    if(clips.length!==2)throw Error('Town asset must supply Idle_Loop and Walk_Loop');
    const prepared=prepareVatMany(meshes.map(mesh=>({mesh})),clips);
    baked=createVatBakeResults(game.engine,prepared);
    const handles=[];
    let submittedPieces=0;
    const centers=[];
    for(let j=0;j<meshes.length;j++) {
      const mesh=meshes[j],handle=attachVat(game.engine,mesh,baked[j],'Idle_Loop');
      handles.push(handle);
      const matrices=new Float32Array(count*16),params=new Float32Array(count*4);
      for(let i=0;i<count;i++) {
        const columns=Math.ceil(Math.sqrt(count)),row=Math.floor(i/columns),column=i%columns;
        const x=(column-(columns-1)/2)*1.8,z=centerZ+(row-(Math.ceil(count/columns)-1)/2)*1.8;
        const y=game.world.groundHeight(x,z),yaw=(i%7-3)*.13,c=Math.cos(yaw),s=Math.sin(yaw);
        if(!Number.isFinite(y))throw Error('Town actor must stand on finite terrain');
        if(j===0)centers.push({x,y:y+1,z});
        matrices.set([c,0,-s,0,0,1,0,0,s,0,c,0,x,y,z,1],i*16);
        const clip=handle.clips[motion==='walk'?'Walk_Loop':'Idle_Loop'];
        params.set([clip.fromRow,clip.fromRow+clip.frameCount-1,actorPhaseSeconds(actors[i].id)*clip.fps,clip.fps],i*4);
      }
      setThinInstances(mesh,matrices,count);handle.setInstances(params);submittedPieces+=count;
      mesh.receiveShadows=true;
    }
    // Keep new actors hidden while the native PBR group rescans thin-instance
    // dependencies. Shadow material views reuse this completed group composer;
    // enrolling a VAT caster earlier can reference a composer lacking the
    // 'thin-instance' fragment required by VAT. Do not exclude visible casters.
    // https://github.com/BabylonJS/Babylon-Lite/blob/npm-lite-v1.31.1/packages/babylon-lite/src/scene/scene-rebuild.ts
    // https://github.com/BabylonJS/Babylon-Lite/blob/npm-lite-v1.31.1/packages/babylon-lite/src/material/pbr/pbr-compose.ts
    for(const mesh of allMeshes)setMeshVisible(mesh,false);
    // Suppress Lite's automatic glTF-group tick. VAT owns playback here.
    const groups=container.animationGroups;container.animationGroups=[];
    try {added=true;addToScene(game.scene,container);}finally{
      container.animationGroups=groups;claimQueuedBuilds(game.scene,allMeshes);
    }
    await rebuildScenePbrPipelines(game.scene,true);
    // Cancellation during rebuilding waits for that native work to settle,
    // then retires the still-hidden container. Never free an in-flight build.
    signal.throwIfAborted();
    leavePlayback=enrollPlayback(game.scene,handles);
    signal.addEventListener('abort',dispose,{once:true});
    for(const mesh of meshes)setMeshVisible(mesh,true);
    return {count,outfit,motion,submittedPieces,container,projectedActorCenters(){
      if(disposed)return 0;
      const canvas=game.engine._canvas||document.querySelector('canvas');
      const view=getViewMatrix(game.scene.camera),vp=getViewProjectionMatrix(game.scene.camera,canvas.width/canvas.height);
      const projection={viewport:{x:0,y:0,width:canvas.width,height:canvas.height},backingWidth:canvas.width,backingHeight:canvas.height};
      return centers.filter(p=>!projectWorldToScreen(p,view,vp,projection).offscreen).length;
    },dispose};
  } catch(error) {
    // Bake results start with no owning mesh. If attachment fails halfway,
    // release textures no attached mesh can retire (sibling bakes may share).
    const claimed=new Set(allMeshes.map(mesh=>mesh.vat?.texture).filter(Boolean));
    for(const texture of new Set(baked.map(bake=>bake.texture)))if(!claimed.has(texture))texture.destroy();
    dispose();throw error;
  }
}
