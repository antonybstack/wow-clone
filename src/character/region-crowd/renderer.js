/** Region actor renderer. Exact and VAT resources are distinct; attachVat drops
 * the live skeleton, so representation changes never mutate the player's asset.
 * Uses native fixed-capacity thin instances and swap-removal, not a second pool.
 * https://github.com/BabylonJS/Babylon-Lite/blob/npm-lite-v1.31.1/docs/lite/architecture/15-vertex-animation-texture.md
 * https://github.com/BabylonJS/Babylon-Lite/blob/npm-lite-v1.31.1/packages/babylon-lite/src/mesh/thin-instance.ts
 */
import {VERSION,addToScene,attachVat,createVatBakeResults,disposeMeshGpu,
 enableThinInstanceWorldBounds,getContainerMeshes,
 goToFrame,loadGltf,onBeforeRender,rebuildScenePbrPipelines,removeFromScene,
 removeThinInstance,setMeshVisible,setMorphTargetWeights,
 setThinInstanceMatrix,setThinInstances,setVatTime} from '@babylonjs/lite';
import {sceneLifetime} from '../../ashen-reach/scene-lifetime.js';
import {prepareLinearMaterial} from '../../ashen-reach/linear-materials.js';
import {claimQueuedBuilds} from '../crowd-probe/town.js';
import {decodePreparedCrowdAppearance,planCrowdBatches} from '../crowd-probe/batches.js';
import {APPEARANCE_SCHEMA_VERSION,appearanceShapeWeights,validateAppearance} from '../appearance/contract.js';
import {createRegionActor,actorVatParams,sampleActorMotion} from './actor-state.js';
import {setDirectInstanceCount} from './direct-count.js';

const updates=new WeakMap();
function enroll(scene,update){
 let live=updates.get(scene);
 if(!live){live=new Set();updates.set(scene,live);onBeforeRender(scene,()=>{for(const fn of live)fn();});sceneLifetime(scene).addEventListener('abort',()=>live.clear(),{once:true});}
 live.add(update);return ()=>live.delete(update);
}
const equalEquipment=(a,b)=>Object.keys(a).every(k=>a[k]===b[k]);
const matrixFor=actor=>{
 const {x,y,z,yaw}=actor.transform,h=actor.recipe.shape.height||1,c=Math.cos(yaw)*h,s=Math.sin(yaw)*h;
 return new Float32Array([c,0,-s,0,0,h,0,0,s,0,c,0,x,y,z,1]);
};
function validateBounds(mesh,bounds){
 if(bounds?.name!==mesh.name||bounds.minimum?.length!==3||bounds.maximum?.length!==3||bounds.minimum.some((v,i)=>!Number.isFinite(v)||!Number.isFinite(bounds.maximum[i])||v>bounds.maximum[i]))throw Error('Invalid prepared animated bounds');
}
async function checkedFetch(url,signal,hash){
 const response=await fetch(url,{signal});if(!response.ok)throw Error(`Crowd asset HTTP ${response.status}: ${url}`);
 const bytes=await response.arrayBuffer();signal.throwIfAborted();
 if(hash){const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');if(digest!==hash)throw Error(`Crowd asset hash mismatch: ${url}`);}
 return bytes;
}
/** Developer-only assets until the streaming/presence milestone publishes them.
 * Native conservative bounds were prepared before attachVat, from every baked
 * pose plus the single-axis morph range. GPU culling stays off for this first
 * correctness tier; visibility never drops an offscreen shadow caster.
 * https://github.com/BabylonJS/Babylon-Lite/blob/npm-lite-v1.31.1/packages/babylon-lite/src/mesh/compute-max-extents.ts
 */
export async function createRegionCrowd(game,{capacity=100,assetRoot='/__region_crowd__',signal:requestSignal,clock}={}){
 if(VERSION!=='1.31.1'||!Array.isArray(game.scene._materialSwapQueue))throw Error('Region staging requires reviewed Lite 1.31.1');
 if(!Number.isInteger(capacity)||capacity<1||capacity>1000)throw RangeError('Crowd capacity must be 1–1000');
 const controller=new AbortController(),signal=AbortSignal.any([controller.signal,sceneLifetime(game.scene),...(requestSignal?[requestSignal]:[])]);
 const epoch=performance.now(),now=clock||(()=> (performance.now()-epoch)/1000);
 const prepared=JSON.parse(new TextDecoder().decode(await checkedFetch(`${assetRoot}/prepared.json`,signal)));
 if(prepared.schema!==1||prepared.lite!==VERSION||prepared.recipeVersion!==APPEARANCE_SCHEMA_VERSION)throw Error('Region bake recipe/runtime mismatch; prepare the assets again');
 const variantCache=new WeakMap();
 const owned=new Set(),builds=new Set();
 const manifest=prepared.manifest,variants=new Map(),sources=[],pools=new Map(),actors=new Map(),desired=new Map();
 let disposal,disposed=false,leave=()=>{},chain=Promise.resolve();
 function disposeResource(resource){
  if(!resource||resource.retiring)return resource?.retirement;
  resource.retiring=true;hide(resource);
  const retire=()=>{
   if(resource.disposed)return;resource.disposed=true;
   const unattached=resource.meshes.filter(m=>!game.scene.meshes.includes(m));
   if(resource.added)removeFromScene(game.scene,resource.container);
   for(const m of unattached)disposeMeshGpu(m);owned.delete(resource);
  };
  // Native removal fences submitted GPU work, not asynchronous shader building.
  // Keep hidden resource owners alive until scene builds have settled as well.
  // https://github.com/BabylonJS/Babylon-Lite/blob/npm-lite-v1.31.1/packages/babylon-lite/src/scene/scene-rebuild.ts
  resource.retirement=resource.added&&builds.size?Promise.allSettled([...builds]).then(retire):Promise.resolve(retire());
  return resource.retirement;
 }

 function hide(resource){for(const mesh of resource.meshes)setMeshVisible(mesh,false);}
 function dispose(){
  if(disposed)return disposal;disposed=true;leave();signal.removeEventListener('abort',dispose);controller.abort();desired.clear();
  actors.clear();pools.clear();
  // A native decode can still be producing a container that is not in owned
  // yet. Drain the serialized preparation chain as well as existing owners;
  // its post-decode abort boundary disposes that final unregistered resource.
  disposal=Promise.all([...owned].map(disposeResource).concat(chain));return disposal;
 }
 async function stage(resource){
  signal.throwIfAborted();hide(resource);
  for(const mesh of resource.meshes)prepareLinearMaterial(game.scene,mesh.material);
  const groups=resource.container.animationGroups;resource.container.animationGroups=[];
  try{resource.added=true;addToScene(game.scene,resource.container);}finally{resource.container.animationGroups=groups;claimQueuedBuilds(game.scene,resource.meshes);}
  const build=rebuildScenePbrPipelines(game.scene,true);builds.add(build);
  try{await build;}finally{builds.delete(build);}
  signal.throwIfAborted();
 }
 function variantFor(recipe){
  const cached=variantCache.get(recipe);if(cached)return cached;
  const valid=validateAppearance(recipe);
  if(valid.race!=='human')throw Error('Region crowd currently supports Human fits only');
  const match=[...variants.values()].find(v=>equalEquipment(v.recipe.equipment,valid.equipment));
  if(!match)throw Error('Appearance has no prepared region fit');variantCache.set(recipe,match);return match;
 }
 function actorPools(actor){
  const variant=variantFor(actor.recipe);
  const neutral={...actor.recipe,shape:{...actor.recipe.shape,height:1,build:0}};
  return planCrowdBatches([{id:actor.id,outfit:variant.name,recipe:neutral}],manifest).batches.map(b=>pools.get(b.key));
 }
 function packParams(pool){
  pool.params.fill(0);const t=now();
  for(let slot=0;slot<pool.ids.length;slot++){
   const entry=actors.get(pool.ids[slot]),p=actorVatParams(entry.actor,t,prepared.variants[pool.variant].clips);
   pool.params.set([p.from,p.end,p.frameOffset,p.fps],slot*4);
  }
  // Full capacity from first attachment keeps the native instance texture stable.
  // https://github.com/BabylonJS/Babylon-Lite/blob/npm-lite-v1.31.1/packages/babylon-lite/src/vat/vat-baker.ts
  for(const handle of pool.handles)handle.setInstances(pool.params);
 }
 function addVat(entry){
  const matrix=matrixFor(entry.actor);entry.pools=actorPools(entry.actor);
  for(const pool of entry.pools){
   if(pool.ids.length>=capacity)throw RangeError('Region batch capacity exceeded');
   const slot=pool.ids.length;pool.ids.push(entry.actor.id);pool.slots.set(entry.actor.id,slot);
   for(const mesh of pool.meshes){setDirectInstanceCount(game.engine,mesh,slot+1);setThinInstanceMatrix(mesh,slot,matrix);setMeshVisible(mesh,true);}
   packParams(pool);
  }
 }
 function removeVat(entry){
  for(const pool of entry.pools||[]){
   const slot=pool.slots.get(entry.actor.id);if(slot===undefined)continue;
   const last=pool.ids.pop();pool.slots.delete(entry.actor.id);
   if(slot<pool.ids.length){pool.ids[slot]=last;pool.slots.set(last,slot);}
   for(const mesh of pool.meshes){removeThinInstance(mesh,slot);setDirectInstanceCount(game.engine,mesh,pool.ids.length);if(!pool.ids.length)setMeshVisible(mesh,false);}
   packParams(pool);
  }
  entry.pools=[];
 }
 function writeExactTransform(resource,actor){
  const {x,y,z,yaw}=actor.transform,h=actor.recipe.shape.height||1;
  // Match the existing body/NPC glTF mirror. VAT already carries the
  // prototype root's X reflection; exact uses the same frame explicitly.
  resource.root.position.set(x,y,z);resource.root.scaling.set(-h,h,h);
  resource.root.rotationQuaternion.set(0,Math.sin(yaw/2),0,Math.cos(yaw/2));
 }
 function exactPose(entry,t){
  const variant=variantFor(entry.actor.recipe),sample=sampleActorMotion(entry.actor,t,prepared.variants[variant.name].clips);
  const group=entry.exact.container.animationGroups.find(g=>g.name===sample.clip);
  // Seek the exact resource to the same sampled source row. Continuous exact
  // interpolation is deferred; this deliberate quantization makes switches
  // pose-identical to the 60 Hz VAT tier, including a non-loop terminal hold.
  // https://github.com/BabylonJS/Babylon-Lite/blob/npm-lite-v1.31.1/packages/babylon-lite/src/animation/animation-group.ts
  goToFrame(group,sample.frame,game.engine);entry.sample=sample;
 }
 async function prepareExact(actor){
  const variant=variantFor(actor.recipe),container=await loadGltf(game.engine,variant.bytes),resource={actorId:actor.id,container,root:container.entities[0],meshes:getContainerMeshes(container),added:false,disposed:false};
  owned.add(resource);
  try{
   signal.throwIfAborted();const weights=appearanceShapeWeights(actor.recipe);
   // A live skeleton uses a normal glTF hierarchy. Lite 1.31.1's generic thin
   // fragment replaces finalWorld after the skeleton fragment, discarding the
   // skinning influence. VAT supplies its own combined instanced projection;
   // exact actors must instead transform the native synthetic container root.
   // https://github.com/BabylonJS/Babylon-Lite/blob/npm-lite-v1.31.1/packages/babylon-lite/src/shader/fragments/thin-instance-fragment.ts
   // https://github.com/BabylonJS/Babylon-Lite/blob/npm-lite-v1.31.1/packages/babylon-lite/src/shader/fragments/skeleton-fragment.ts
   if(!resource.root?.position?.set||!resource.root?.scaling?.set||!resource.root?.rotationQuaternion?.set)throw Error('Exact actor requires a native glTF transform root');
   writeExactTransform(resource,actor);
   for(let i=0;i<resource.meshes.length;i++){
    const mesh=resource.meshes[i],bounds=prepared.variants[variant.name].bounds[i];
    validateBounds(mesh,bounds);
    mesh.boundMin=[...bounds.minimum];mesh.boundMax=[...bounds.maximum];
    if(mesh.morphTargets)setMorphTargetWeights(game.engine,mesh.morphTargets,weights);
    mesh.receiveShadows=true;
   }
   for(const group of container.animationGroups)group.loopAnimation=false;
   await stage(resource);return resource;
  }catch(error){disposeResource(resource);throw error;}
 }
 function writeTransform(entry){
  entry.paramKey=null;entry.started=false;const matrix=matrixFor(entry.actor);
  if(entry.exact)writeExactTransform(entry.exact,entry.actor);
  else for(const pool of entry.pools){const slot=pool.slots.get(entry.actor.id);for(const mesh of pool.meshes)setThinInstanceMatrix(mesh,slot,matrix);packParams(pool);}
  update();
 }
 function update(){
  if(disposed)return;const t=now(),dirty=new Set();
  for(const entry of actors.values())if(entry.tier==='vat'){
   const m=entry.actor.motion;
   if(!entry.paramKey||!m.loop||t<m.startedAt||!entry.started){
    const variant=variantFor(entry.actor.recipe),p=actorVatParams(entry.actor,t,prepared.variants[variant.name].clips);
    const key=`${p.from}:${p.end}:${p.frameOffset}:${p.fps}`;
    if(key!==entry.paramKey){entry.paramKey=key;for(const pool of entry.pools)dirty.add(pool);}
    entry.started=t>=m.startedAt;
   }
  }
  for(const pool of pools.values())if(pool.ids.length){
   for(const mesh of pool.meshes)setVatTime(game.engine,mesh,t);
   if(dirty.has(pool))packParams(pool);
  }
  for(const entry of actors.values())if(entry.exact)exactPose(entry,t);
 }

 try{
  signal.throwIfAborted();
  for(const [name,entry] of Object.entries(manifest.variants)){
   const bytes=await checkedFetch(`${assetRoot}/${entry.file}`,signal,entry.sha256);
   variants.set(name,{name,entry,bytes,recipe:decodePreparedCrowdAppearance(entry.recipe)});
  }
  const seeds=[...variants.values()].map(v=>({id:`seed-${v.name}`,outfit:v.name,recipe:v.recipe})),plan=planCrowdBatches(seeds,manifest);
  const upload=[],targets=[],payloadCache=new Map();
  for(const variant of variants.values()){
   const container=await loadGltf(game.engine,variant.bytes),meshes=getContainerMeshes(container),source={container,meshes,added:false,disposed:false};sources.push(source);owned.add(source);
   const metadata=prepared.variants[variant.name];if(metadata.sha256!==variant.entry.sha256||metadata.bounds.length!==meshes.length)throw Error('Stale region preparation');
   for(const batch of plan.batches.filter(b=>b.sourceOutfit===variant.name)){
    const pool={...batch,variant:variant.name,ids:[],slots:new Map(),meshes:[],handles:[],params:new Float32Array(capacity*4)};pools.set(batch.key,pool);
    for(let i=0;i<meshes.length;i++)if(meshes[i].name===batch.mesh){
     const mesh=meshes[i],payload=metadata.payloads[i],bounds=metadata.bounds[i];
     validateBounds(mesh,bounds);
     let data=payloadCache.get(payload.file);if(!data){data=new Float32Array(await checkedFetch(`${assetRoot}/${payload.file}`,signal,payload.sha256));payloadCache.set(payload.file,data);}
     upload.push({...payload,data});targets.push({mesh,pool});pool.meshes.push(mesh);
     mesh.boundMin=[...bounds.minimum];mesh.boundMax=[...bounds.maximum];mesh.receiveShadows=true;
    }
   }
  }
  const baked=createVatBakeResults(game.engine,upload);
  try{
   for(let i=0;i<targets.length;i++){
    const {mesh,pool}=targets[i],handle=attachVat(game.engine,mesh,baked[i],'Idle_Loop');pool.handles.push(handle);
    setThinInstances(mesh,new Float32Array(capacity*16),capacity);enableThinInstanceWorldBounds(mesh);
    handle.setInstances(pool.params);setDirectInstanceCount(game.engine,mesh,0);
   }
  }catch(error){const claimed=new Set(targets.map(t=>t.mesh.vat?.texture));for(const texture of new Set(baked.map(b=>b.texture)))if(!claimed.has(texture))texture.destroy();throw error;}
  for(const source of sources)await stage(source);
  leave=enroll(game.scene,update);signal.addEventListener('abort',dispose,{once:true});
 }catch(error){dispose();throw error;}
 return {
  now,dispose,
  async set(actor,tier){
   if(disposed)return {status:'disposed'};
   actor=createRegionActor(actor);
   variantFor(actor.recipe);sampleActorMotion(actor,now(),prepared.variants[variantFor(actor.recipe).name].clips);
   if(tier!==undefined&&!['vat','exact'].includes(tier))throw Error('Unknown actor tier');
   const old=actors.get(actor.id),latest=desired.get(actor.id)?.actor||old?.actor;
   if(latest&&actor.appearanceRevision<latest.appearanceRevision)throw Error('Stale actor appearance');
   if(latest&&actor.appearanceRevision===latest.appearanceRevision&&JSON.stringify(actor.recipe)!==JSON.stringify(latest.recipe))throw Error('Appearance changes require a new revision');
   const selected=actor.recipe.shape.build===0?(tier||desired.get(actor.id)?.tier||old?.tier||'vat'):'exact'; // Preserve unsupported bucket identity with exact morphs.
   if(!old&&actors.size>=capacity)throw RangeError('Region actor capacity exceeded');
   const pending=desired.get(actor.id);
   if(pending?.pending&&pending.tier===selected&&pending.actor.appearanceRevision===actor.appearanceRevision){
    pending.actor=actor;
    if(old){old.actor=createRegionActor({...old.actor,transform:actor.transform,motion:actor.motion});writeTransform(old);}
    return pending.pending;
   }
   const token={actor,tier:selected};desired.set(actor.id,token);
   if(old&&old.tier===selected&&old.actor.appearanceRevision===actor.appearanceRevision){
    old.actor=actor;writeTransform(old);return {status:'applied',tier:selected,revision:actor.appearanceRevision};
   }
   const run=async()=>{
    if(disposed||desired.get(actor.id)!==token)return {status:'superseded'};
    let exact=null;
    try{
     if(!actors.has(actor.id)&&actors.size>=capacity)throw RangeError('Region actor capacity exceeded');
     if(selected==='exact')exact=await prepareExact(token.actor);
     if(disposed||desired.get(actor.id)!==token){disposeResource(exact);return {status:'superseded'};}
     const previous=actors.get(actor.id),entry={actor:token.actor,tier:selected,exact,pools:[],ended:false};
     if(exact)writeExactTransform(exact,token.actor);
     if(exact)exactPose(entry,now());
     if(previous){removeVat(previous);disposeResource(previous.exact);}
     actors.set(actor.id,entry);
     if(exact){for(const mesh of exact.meshes)setMeshVisible(mesh,true);}else addVat(entry);
     update();return {status:'applied',tier:selected,revision:actor.appearanceRevision};
    }catch(error){disposeResource(exact);if(disposed||desired.get(actor.id)!==token)return {status:'superseded'};const kept=actors.get(actor.id);if(kept)desired.set(actor.id,{actor:kept.actor,tier:kept.tier});else desired.delete(actor.id);throw error;}
    finally{token.pending=null;}
   };
   const result=chain.then(run);token.pending=result;chain=result.catch(()=>{});return result;
  },
  remove(id){const pending=desired.delete(id);for(const resource of owned)if(resource.actorId===id&&!resource.retiring)disposeResource(resource);const entry=actors.get(id);if(!entry)return pending;removeVat(entry);disposeResource(entry.exact);actors.delete(id);return true;},
  get(id){return actors.get(id)?.actor;},
  snapshot(){return {count:actors.size,clock:now(),actors:[...actors.values()].map(e=>({id:e.actor.id,revision:e.actor.appearanceRevision,tier:e.tier,shape:e.actor.recipe.shape,sample:sampleActorMotion(e.actor,now(),prepared.variants[variantFor(e.actor.recipe).name].clips)})),batches:[...pools.values()].map(p=>({mesh:p.mesh,ids:[...p.ids],slots:[...p.slots],primitives:p.meshes.length}))};},
  resources(){return {sources,pools,actors,prepared,pendingBuilds:builds,owned};},
 };
}
