/** Isolated native Lite crowd experiment. No default-game module imports this page.
 * VAT requires a genuine glTF mixer binding for every mesh:
 * https://github.com/BabylonJS/Babylon-Lite/blob/npm-lite-v1.31.1/src/vat/vat-baker.ts
 * Thin-instance matrices/indices belong to each concrete mesh batch:
 * https://github.com/BabylonJS/Babylon-Lite/blob/npm-lite-v1.31.1/docs/lite/architecture/04-mesh.md
 */
import {
  addAnimationGroups,addToScene,attachVat,createAnimationManager,
  createArcRotateCamera,createCsmDirectionalShadowGenerator,createDirectionalLight,
  createEngine,createGround,createHemisphericLight,createPbrMaterial,
  createSceneContext,createVatBakeResults,disposeMeshGpu,disposeScene,
  enableBoneControl,enableErrorDecoding,enableSkeletonShadows,getContainerMeshes,
  getViewMatrix,getViewProjectionMatrix,projectWorldToScreen,
  isGpuTimingSupported,loadGltf,onBeforeRender,playAnimation,prepareVatMany,registerScene,
  registerSceneWithShadowSupport,removeFromScene,setAnimationWeight,setMeshVisible,
  setGpuTimingEnabled,setMeshoptBaseUrl,setShadowTaskCasterMeshes,setThinInstances,startEngine,
  stopAnimation,stopEngine,updateAnimationManager,
} from '@babylonjs/lite';
import {decodeAppearance} from '../appearance/codec.js';
import {animationPhase,planCrowdBatches} from './batches.js';

enableErrorDecoding();
enableBoneControl();
setMeshoptBaseUrl('/');
const canvas=document.getElementById('renderCanvas');
const ui=document.getElementById('crowd-ui');
const errorEl=document.getElementById('error');
const params=new URLSearchParams(location.search);
const shadowOn=params.has('shadows');
const reportError=e=>{errorEl.hidden=false;errorEl.textContent=e.stack||e.message||String(e);console.error(e);};
const assetCache=new Map();
async function asset(outfit) {
  if(!['wayfarer','warden'].includes(outfit)) throw Error(`Unsupported probe outfit ${outfit}`);
  if(!assetCache.has(outfit)) assetCache.set(outfit,fetch(`/__crowd_probe__/human-${outfit}.glb`).then(r=>{if(!r.ok)throw Error(`Probe GLB ${outfit}: HTTP ${r.status}`);return r.arrayBuffer();}));
  return assetCache.get(outfit);
}
function matrixAt(index,count,spacing=2.1) {
  const columns=Math.ceil(Math.sqrt(count));
  const row=Math.floor(index/columns),column=index%columns;
  const x=(column-(columns-1)/2)*spacing,z=(row-(Math.ceil(count/columns)-1)/2)*spacing;
  const yaw=((index*7919)%360)*Math.PI/180,c=Math.cos(yaw),s=Math.sin(yaw);
  return [c,0,-s,0,0,1,0,0,s,0,c,0,x,0,z,1];
}
function place(root,index,count) {
  const m=matrixAt(index,count);
  root.position.set(m[12],0,m[14]);
  root.rotation.y=((index*7919)%360)*Math.PI/180;
}
function clipFor(index,motion){return motion==='walk'?'Walk_Loop':'Idle_Loop';}
function releaseUnadded(container) {
  for(const mesh of getContainerMeshes(container)) disposeMeshGpu(mesh);
}
function addProbeContainer(scene,container) {
  // addToScene normally installs an automatic glTF-group tick. This probe drives
  // independent managers itself and freezes the source mixer after VAT prep;
  // letting both clocks tick the same binding can overwrite the tested pose.
  // https://github.com/BabylonJS/Babylon-Lite/blob/npm-lite-v1.31.1/src/scene/scene-core.ts
  const groups=container.animationGroups;
  container.animationGroups=[];
  try{addToScene(scene,container);}finally{container.animationGroups=groups;}
}

async function main() {
  const engine=await createEngine(canvas,{msaaSamples:1,maxDevicePixelRatio:1});
  const gpuTimingSupported=isGpuTimingSupported(engine);
  if(gpuTimingSupported)setGpuTimingEnabled(engine,true);
  const scene=createSceneContext(engine);
  scene.clearColor={r:.18,g:.20,b:.23,a:1};
  const camera=createArcRotateCamera(-Math.PI/2,1.22,9,{x:0,y:1,z:0});
  camera.fov=.75;camera.nearPlane=.08;camera.farPlane=350;scene.camera=camera;
  const sun=createDirectionalLight([.4,-.85,-.35],1.1);sun.diffuse=[1,.94,.84];addToScene(scene,sun);
  const hemi=createHemisphericLight([0,1,0],.62);hemi.diffuseColor=[.88,.91,1];hemi.groundColor=[.31,.3,.29];addToScene(scene,hemi);
  const floor=createGround(engine,{width:140,height:140,subdivisions:1});
  floor.name='Crowd probe floor';floor.material=createPbrMaterial({baseColorFactor:[.21,.25,.25,1],roughnessFactor:1});floor.receiveShadows=true;addToScene(scene,floor);
  let shadow=null;
  if(shadowOn) {
    shadow=createCsmDirectionalShadowGenerator(engine,sun,{mapSize:1024,numCascades:2,shadowMaxZ:120,stabilizeCascades:true});
    sun.shadowGenerator=shadow;enableSkeletonShadows(shadow);
  }
  const preparedResponse=await fetch('/__crowd_probe__/manifest.json');
  if(!preparedResponse.ok)throw Error('Prepare probe assets before opening this page');
  const preparedManifest=await preparedResponse.json();
  const recipes=Object.fromEntries(Object.entries(preparedManifest.variants).map(([id,variant])=>[id,decodeAppearance(variant.recipe)]));
  const state={generation:0,owners:[],path:null,count:0,outfits:[],motion:'idle',handles:[],loadMs:0,errors:[],frameMs:[],draws:[],gpuMs:[],batchPlan:null};
  let vatAttached=false;
  let lastUi=0;
  function clear() {
    state.generation++;
    for(const owner of state.owners) removeFromScene(scene,owner.container);
    state.owners=[];state.handles=[];state.count=0;state.path=null;state.outfits=[];state.batchPlan=null;
    if(shadow)setShadowTaskCasterMeshes(shadow,[]);
  }
  async function set({path='independent',count=1,appearance='repeat',motion='idle'}={}) {
    if(!['independent','vat'].includes(path)) throw Error(`Unknown path ${path}`);
    // Lite's live-skin palette is visually stale when reintroduced after a VAT
    // cohort on this already-registered diagnostic scene (even though clip
    // clocks advance). Force a fresh scene for this control comparison.
    if(path==='independent'&&vatAttached)throw Error('Independent control requires a fresh scene after VAT teardown');
    if(!Number.isInteger(count)||count<1||count>1000) throw Error('Count must be 1–1000');
    // 300 independent actors already crossed 27 ms mean intervals and 1,801
    // draw submissions on M1 Max. A 1,000-container build risks multi-GB
    // duplicate GPU ownership for a cell that is already beyond feasibility.
    if(path==='independent'&&count>300) throw RangeError('Independent path safety budget is 300 dressed actors; 1,000 is rejected after the measured 300-actor failure');
    if(!['repeat','mixed','quarter'].includes(appearance)||!['idle','walk'].includes(motion)) throw Error('Unsupported cohort');
    clear();
    const generation=state.generation,start=performance.now();
    const outfits=Array.from({length:count},(_,i)=>appearance==='mixed'&&i%2?'warden':appearance==='quarter'&&i%4===0?'warden':'wayfarer');
    const actors=outfits.map((outfit,i)=>({id:`actor-${String(i).padStart(4,'0')}`,outfit,recipe:recipes[outfit]}));
    const plan=planCrowdBatches(actors,preparedManifest);
    const pendingContainers=new Set();
    try {
      if(path==='independent') {
        for(let i=0;i<count;i++) {
          const bytes=await asset(outfits[i]);
          const container=await loadGltf(engine,bytes.slice(0));
          pendingContainers.add(container);
          if(generation!==state.generation)throw Error('Cancelled scene build');
          const root=container.entities?.[0];if(!root)throw Error('Missing glTF root');
          place(root,i,count);
          addProbeContainer(scene,container);
          pendingContainers.delete(container);
          const owner={container,index:i};state.owners.push(owner);
          const manager=createAnimationManager({engine}),clips=container.animationGroups||[];
          owner.manager=manager;
          addAnimationGroups(manager,clips);
          for(const clip of clips){stopAnimation(clip);setAnimationWeight(clip,0);}
          const active=clips.find(g=>g.name===clipFor(i,motion));
          if(!active)throw Error(`Missing independent clip ${clipFor(i,motion)}`);
          active.loopAnimation=true;setAnimationWeight(active,1);playAnimation(active);
          active.currentTime=animationPhase(i)%Math.max(.01,active.duration);
          owner.active=active;
        }
      } else {
        for(const outfit of [...new Set(outfits)]) {
          const bytes=await asset(outfit),container=await loadGltf(engine,bytes.slice(0));
          pendingContainers.add(container);
          if(generation!==state.generation)throw Error('Cancelled scene build');
          const meshes=getContainerMeshes(container).filter(m=>m.skeleton),clips=(container.animationGroups||[]).filter(g=>['Idle_Loop','Walk_Loop'].includes(g.name));
          if(meshes.length<4 || clips.length!==2)throw Error(`Incomplete ${outfit} VAT source: ${meshes.length} meshes/${clips.length} clips`);
          const prepared=prepareVatMany(meshes.map(mesh=>({mesh})),clips);
          const baked=createVatBakeResults(engine,prepared);
          const ownedBatches=plan.batches.filter(batch=>batch.sourceOutfit===outfit);
          for(let j=0;j<meshes.length;j++) {
            const mesh=meshes[j],handle=attachVat(engine,mesh,baked[j],'Idle_Loop');
            vatAttached=true;
            const batch=ownedBatches.find(entry=>entry.mesh===mesh.name);
            if(!batch){setMeshVisible(mesh,false);continue;}
            const indices=batch.actorIndices,matrices=new Float32Array(indices.length*16),params=new Float32Array(indices.length*4);
            for(let k=0;k<indices.length;k++) {
              const actorIndex=indices[k],clip=handle.clips[clipFor(actorIndex,motion)];
              matrices.set(matrixAt(actorIndex,count),k*16);
              params.set([clip.fromRow,clip.fromRow+clip.frameCount-1,animationPhase(actorIndex),clip.fps],k*4);
            }
            setThinInstances(mesh,matrices,indices.length);
            handle.setInstances(params);
            state.handles.push(handle);
          }
          addProbeContainer(scene,container);
          pendingContainers.delete(container);
          state.owners.push({container,outfit,batches:ownedBatches,meshes,preparedBytes:prepared.reduce((n,v)=>n+v.data.byteLength,0),vatTextures:new Set(baked.map(v=>v.texture)).size});
        }
      }
      state.path=path;state.count=count;state.outfits=outfits;state.motion=motion;state.loadMs=performance.now()-start;state.batchPlan=plan;
      camera.radius=Math.max(8,4+Math.ceil(Math.sqrt(count))*2.6);
      if(shadow)setShadowTaskCasterMeshes(shadow,state.owners.flatMap(owner=>getContainerMeshes(owner.container)));
      return status();
    } catch(error) {
      for(const container of pendingContainers)releaseUnadded(container);
      if(generation===state.generation)clear();
      state.errors.push(error.message);throw error;
    }
  }
  function status() {
    const view=getViewMatrix(camera),vp=getViewProjectionMatrix(camera,canvas.width/canvas.height);
    const projection={viewport:{x:0,y:0,width:canvas.width,height:canvas.height},backingWidth:canvas.width,backingHeight:canvas.height};
    let projectedActorCenters=0;
    for(let i=0;i<state.count;i++) {
      const m=matrixAt(i,state.count),p=projectWorldToScreen({x:m[12],y:1,z:m[14]},view,vp,projection);
      if(!p.offscreen)projectedActorCenters++;
    }
    return {ready:probe.ready,path:state.path,count:state.count,projectedActorCenters,submittedActorInstances:state.count,outfitCounts:Object.fromEntries([...new Set(state.outfits)].map(x=>[x,state.outfits.filter(y=>y===x).length])),motion:state.motion,shadows:shadowOn,sceneMeshes:scene.meshes.length,drawCalls:engine.drawCallCount,gpuTimingSupported,gpuFrameTimeMs:engine.gpuFrameTimeMs??null,loadMs:state.loadMs,ownedContainers:state.owners.length,batchCount:state.batchPlan?.batches.length??0,pieceInstances:state.batchPlan?.batches.reduce((n,b)=>n+b.actorIds.length,0)??0,vatTextures:state.owners.reduce((n,o)=>n+(o.vatTextures||0),0),preparedBytes:state.owners.reduce((n,o)=>n+(o.preparedBytes||0),0),canvas:[canvas.width,canvas.height],errors:[...state.errors]};
  }
  const probe={ready:false,engine,scene,camera,set,clear,status,errors:state.errors,frameMs:state.frameMs,draws:state.draws,gpuMs:state.gpuMs,
    debug(){return state.owners.map(o=>({index:o.index,outfit:o.outfit,clip:o.active&&{name:o.active.name,time:o.active.currentTime,weight:o.active.weight,playing:o.active.isPlaying,bindingCount:o.active._gltfMixer?.[2]?.length,hasBodyBinding:o.active._gltfMixer?.[2]?.some(b=>b.runtimeSkeleton===getContainerMeshes(o.container)[0]?.skeleton)},meshes:getContainerMeshes(o.container).map(m=>({name:m.name,hasSkeleton:!!m.skeleton,disposed:m.skeleton?._disposed,refCount:m.skeleton?._refCount,hasVat:!!m.vat}))}));},
    view(name){camera.alpha=name==='back'?Math.PI/2:name==='side'?0:-Math.PI/2;}};
  globalThis.CROWD_PROBE=probe;
  // The existing harness awaits ASHEN.ready; this is only the diagnostic page.
  globalThis.ASHEN={get ready(){return probe.ready;}};
  onBeforeRender(scene,ms=>{
    for(const owner of state.owners) if(owner.manager)updateAnimationManager(owner.manager,ms);
    for(const handle of state.handles)handle.update(ms/1000);
    state.frameMs.push(ms);state.draws.push(engine.drawCallCount);state.gpuMs.push(engine.gpuFrameTimeMs??null);
    if(state.frameMs.length>8000){state.frameMs.splice(0,2000);state.draws.splice(0,2000);state.gpuMs.splice(0,2000);}
    lastUi+=ms;if(lastUi>500){lastUi=0;ui.textContent=`M003 · ${state.path||'loading'} · ${state.count} dressed Human\n${state.motion} · ${shadowOn?'shadows on':'shadows off'}\n${engine.drawCallCount} draw submissions · ${canvas.width}×${canvas.height}`;}
  });
  await set({path:params.get('path')||'independent',count:Number(params.get('count'))||1,appearance:params.get('appearance')||'repeat',motion:params.get('motion')||'idle'});
  if(shadow) await registerSceneWithShadowSupport(scene);else await registerScene(scene);
  await startEngine(engine);
  probe.ready=true;
  probe.dispose=()=>{clear();stopEngine(engine);disposeScene(scene);};
}
main().catch(reportError);
