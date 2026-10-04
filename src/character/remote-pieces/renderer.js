/** Bounded native exact composition of independent race/body/garment pieces.
 * This candidate is not imported by normal startup and has no VAT/capacity claim.
 * Animation, skinning, sockets, coverage and transaction/cache owners are reused.
 * https://github.com/BabylonJS/Babylon-Lite/blob/npm-lite-v1.31.1/docs/lite/architecture/07-animation.md
 * https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#skins
 */
import {VERSION,addToScene,createTransformNode,getContainerMeshes,loadGltf,
 onBeforeRender,rebuildScenePbrPipelines,removeFromScene,setMorphTargetWeights,disposeMeshGpu,
 setParent,waitForGpuIdle} from '@babylonjs/lite';
import {APPEARANCE_CATALOG_VERSION,appearanceShapeWeights} from '../appearance/contract.js';
import {createRegionActor,setActorMotion,setActorTransform,sampleActorMotion} from '../region-crowd/actor-state.js';
import {acquireRegionAsset,regionAssetCacheSnapshot} from '../region-crowd/asset-cache.js';
import {createRequestQueue} from '../region-crowd/request-queue.js';
import {accountRegionResources} from '../region-crowd/resource-accounting.js';
import {REGION_STREAMING_LIMITS,REGION_IMMUTABLE_BYTES} from '../region-crowd/streaming-policy.js';
import {assembleBodyVisual,retireVisual,setVisualVisible} from '../runtime/body-visual.js';
import {createInspectionPreview} from '../runtime/inspection-preview.js';
import {attachSockets} from '../sockets.js';
import {createStreamedEquipment} from '../../ashen-reach/equipment-stream.js';
import {EQUIPMENT_ITEMS} from '../../ashen-reach/equipment-catalog.js';
import {FITS_BY_RACE,assertAssetFit} from '../../ashen-reach/equipment-contract.js';
import {manifestBodyCoverage} from '../../ashen-reach/coverage-manifest.js';
import {validateGarmentLayerCoverage} from '../../ashen-reach/garment-layer-coverage.js';
import {sceneLifetime} from '../../ashen-reach/scene-lifetime.js';
import {yieldToFrame} from '../../ashen-reach/frame-budget.js';
import {claimQueuedBuilds} from '../../ashen-reach/native-material-staging.js';
import {primeMorphMaterialSupport} from '../../ashen-reach/prime-morph-materials.js';

const liveByScene=new WeakMap();
function enroll(scene,update){
 let live=liveByScene.get(scene);
 if(!live){live=new Set();liveByScene.set(scene,live);onBeforeRender(scene,()=>{for(const fn of live)fn();});sceneLifetime(scene).addEventListener('abort',()=>live.clear(),{once:true});}
 live.add(update);return ()=>live.delete(update);
}
// The same source-backed composition used by the Armory/player, with one native
// manager and evaluated finger/carry masks. Source time stays actor-owned; this
// exact tier samples at 60 Hz. VAT equivalence remains a separate M8 gate.
// Source clip -> composed player pose. These are compositions, not raw clips: the upper and
// lower layers, the carry/finger policy and the ease in/out are the player's own, so an
// action endpoint returns the overlay to idle rather than holding a raw final frame.
// Spell_Simple_Enter is the simple cast, which *is* the fire composition, so it maps
// faithfully rather than approximately.
const POSES=Object.freeze({Idle_Loop:'idle',Walk_Loop:'walk',Sprint_Loop:'run',Jump_Start:'jump',Jump_Loop:'air',Jump_Land:'land',FireBlast_Upper:'fire',LavaBall_Upper:'lava',PyreBurst_Upper:'pulse',Walk_Carry_Loop:'carry',Spell_Simple_Enter:'fire'});
/**
 * Clips a seat may legitimately send that have no composed pose yet.
 *
 * The composition vocabulary is idle/walk/run/jump/land/air/fire/lava/pulse/carry; there is no
 * sword-attack composition. Rejecting the actor would make a remote player stop updating
 * entirely for the duration of a swing, which is worse than showing them in locomotion, and
 * inventing a pose would be claiming a capability the player composition does not have. So
 * these fall back and are counted, which keeps the gap visible in telemetry instead of
 * hidden. Giving them a real composed pose is M8's matching bake/pose work.
 */
const UNCOMPOSED=Object.freeze({Sword_Attack:'idle'});
export const REMOTE_PIECE_MOTIONS=Object.freeze([...Object.keys(POSES),...Object.keys(UNCOMPOSED)]);
const sameShape=(a,b)=>JSON.stringify(a.shape)===JSON.stringify(b.shape)&&a.race===b.race;

/** Published descriptor contract. Bump only with a matching publisher change. */
export const REMOTE_PIECES_PUBLISH_VERSION=1;

export async function createRemotePieceActors(game,{root='/__remote_pieces__',capacity=8,clock,signal:requestSignal}={}){
 if(VERSION!=='1.31.1'||!Array.isArray(game.scene._materialSwapQueue))throw Error('Remote staging requires reviewed Lite 1.31.1');
 if(!Number.isSafeInteger(capacity)||capacity<1||capacity>REGION_STREAMING_LIMITS.exact)throw RangeError('Remote exact capacity must be 1–8');
 const controller=new AbortController(),signal=AbortSignal.any([controller.signal,sceneLifetime(game.scene),...(requestSignal?[requestSignal]:[])]);
 const response=await fetch(`${root}/prepared.json`,{signal});if(!response.ok)throw Error('Prepare native remote bounds first');
 const bytes=await response.arrayBuffer();if(bytes.byteLength>512*1024)throw Error('Remote descriptor exceeds budget');
 const prepared=JSON.parse(new TextDecoder().decode(bytes)),source=prepared.manifest;
 // Two descriptors are acceptable and nothing between them: the DEV candidate set, and a
 // published set carrying a version and the hash of the compiler that produced it. A
 // descriptor that is neither -- candidateOnly cleared without a published block, or the two
 // flags disagreeing between descriptor and manifest -- is refused rather than guessed at.
 // Each piece is separately hash-sealed below and re-verified on fetch; the descriptor
 // itself is trusted by origin, which is why its provenance is checked here.
 const candidate=prepared.candidateOnly===true&&source.candidateOnly===true;
 const release=prepared.candidateOnly===false&&source.candidateOnly===false
  &&prepared.published?.version===REMOTE_PIECES_PUBLISH_VERSION
  &&/^[0-9a-f]{64}$/.test(prepared.published?.sourceCompilerSha256||'')
  &&prepared.published?.lite===VERSION&&prepared.published?.catalogVersion===APPEARANCE_CATALOG_VERSION;
 if(prepared.schema!==1||prepared.lite!==VERSION||prepared.catalogVersion!==APPEARANCE_CATALOG_VERSION||prepared.escaped!==0||source?.schema!==1||source.catalogVersion!==APPEARANCE_CATALOG_VERSION||source.lite!==VERSION||!(candidate||release))throw Error('Remote piece contract mismatch');
 const manifests=new Map();
 for(const [race,data]of Object.entries(source.races)){
  if(!FITS_BY_RACE[race]||data.manifest.fitId!==FITS_BY_RACE[race].body||!prepared.races[race]?.clips)throw Error('Unsupported remote race fit');
  const manifest={...data.manifest,items:{}};
  for(const [id,entry]of Object.entries(data.manifest.items)){
   if(id!=='body'&&!EQUIPMENT_ITEMS[id])throw Error('Unknown remote piece');
   if(!/^[0-9a-f]{64}$/.test(entry.sha256)||entry.file!==`${id}-${entry.sha256}.glb`||!Number.isSafeInteger(entry.bytes)||entry.bytes<1||entry.bytes>REGION_IMMUTABLE_BYTES||!entry.verification?.geometryExact||!entry.verification?.bindAndFramesExact||!entry.verification?.morphsExact||!entry.verification?.sourceCurvesExact)throw Error('Unverified remote piece descriptor');
   if(id!=='body')assertAssetFit(entry,EQUIPMENT_ITEMS[id],race);
   const bound=prepared.races[race].pieces[id];if(bound?.sha256!==entry.sha256||bound.escaped!==0||!Array.isArray(bound.bounds)||!bound.bounds.length||bound.bounds.some(b=>typeof b.name!=='string'||b.minimum?.length!==3||b.maximum?.length!==3||b.minimum.some((v,i)=>!Number.isFinite(v)||!Number.isFinite(b.maximum[i])||v>b.maximum[i])))throw Error('Remote piece lacks verified swept bounds');
   // Embedded accepted texture tier needs no player texture-upgrade requests.
   const asset={...entry,url:`${root}/${entry.file}`};delete asset.textures;manifest.items[id]=asset;
  }
  const coverage=manifestBodyCoverage(manifest,race);if(!coverage)throw Error('Remote body lacks explicit coverage');
  validateGarmentLayerCoverage(manifest.garmentLayerCoverage,EQUIPMENT_ITEMS,coverage.baseMeshes);manifests.set(race,manifest);
 }
 signal.throwIfAborted();
 const actors=new Map(),desired=new Map(),owned=new Set(),builds=new Set();
 const queue=createRequestQueue({limit:REGION_STREAMING_LIMITS.pending,between:()=>yieldToFrame()}),epoch=performance.now(),now=clock||(()=> (performance.now()-epoch)/1000);
 const stats={bodyLoads:0,liveEquipmentChanges:0,peakOwned:0,uncomposedMotions:0,preparations:[]};let disposed=false,disposal,leave=()=>{};
 const current=token=>!disposed&&desired.get(token.actor.id)===token;
 function checkActor(input){
  const actor=createRegionActor(input),manifest=manifests.get(actor.recipe.race);
  if(!manifest||!(POSES[actor.motion.clip]||UNCOMPOSED[actor.motion.clip])||!prepared.races[actor.recipe.race].clips[actor.motion.clip])throw Error('Unsupported remote source motion or race');
  for(const id of Object.values(actor.recipe.equipment))if(id&&!EQUIPMENT_ITEMS[id].factory&&!manifest.items[id])throw Error('Remote item has no race-specific fit');
  return actor;
 }
 function setBounds(resource,id,meshes){
  const bounds=prepared.races[resource.race].pieces[id].bounds;
  if(bounds.length!==meshes.length)throw Error('Remote written bounds mesh count mismatch');
  for(let i=0;i<meshes.length;i++){const m=meshes[i],b=bounds[i];if(m.name!==b.name)throw Error('Remote written bounds mesh order mismatch');m.boundMin=[...b.minimum];m.boundMax=[...b.maximum];}
 }
 function transform(resource,actor){
  const {x,y,z,yaw}=actor.transform,h=actor.recipe.shape.height||1;resource.origin.position.set(x,y,z);resource.origin.scaling.set(h,h,h);resource.origin.rotationQuaternion.set(0,Math.sin(yaw/2),0,Math.cos(yaw/2));
 }
 function pose(resource,actor,force=false){
  const time=now(),sample=sampleActorMotion(actor,time,prepared.races[actor.recipe.race].clips);
  let id=POSES[sample.clip];
  if(!id){id=UNCOMPOSED[sample.clip];stats.uncomposedMotions=(stats.uncomposedMotions||0)+1;}
  if(resource.poseId!==id){resource.preview.select(id);resource.poseId=id;}
  // Source sampling and the existing hand/back easing have separate jobs:
  // seeking the skeleton must still advance an in-flight prop transition.
  const dt=resource.lastPoseTime==null?0:Math.max(0,Math.min(.1,time-resource.lastPoseTime));resource.lastPoseTime=time;
  const poseKey=`${id}:${sample.frame}`;
  // The source contract already samples at its native frame rate. Re-evaluating
  // that identical mixer/grip row on every uncapped RAF adds no pose detail.
  // Equipment changes force evaluation because their carry/finger masks differ.
  if(force||resource.poseKey!==poseKey){resource.preview.seek(sample.frame/prepared.races[actor.recipe.race].clips[sample.clip].fps);resource.poseKey=poseKey;}
  resource.sample=sample;resource.equipment?.update(dt);return sample;
 }
 function hide(resource){if(!resource)return;setVisualVisible(resource.visual,false);resource.equipment?.setVisible(false);}
 async function retire(resource){
  if(!resource||resource.retirement)return resource?.retirement;
  resource.retiring=true;resource.controller.abort();
  // Keep the entire native preparation owner, including an uninterruptible
  // decoder and a not-yet-returned equipment boot. GPU idle alone does not
  // fence future allocations or garments still borrowing this body palette.
  // https://github.com/BabylonJS/Babylon-Lite/blob/npm-lite-v1.31.1/packages/babylon-lite/src/loaders/gltf/gltf-loader.ts
  resource.retirement=Promise.resolve().then(async()=>{
   let failure;try{hide(resource);}catch(error){failure=error;}
   await resource.preparation?.catch(()=>{});
   try{resource.equipment?.dispose();}catch(error){failure||=error;}finally{await resource.equipment?.drain();}
   // Native shader work owns borrowed palettes until it settles; native removal
   // separately fences already submitted GPU work. Neither fence replaces the other.
   // https://github.com/BabylonJS/Babylon-Lite/blob/npm-lite-v1.31.1/packages/babylon-lite/src/scene/scene-rebuild.ts
   await Promise.allSettled([...builds]);resource.preview?.dispose();
   if(resource.visual){setParent(resource.visual.root,null);retireVisual(game.scene,resource.visual);}
   else if(resource.container)for(const mesh of getContainerMeshes(resource.container))disposeMeshGpu(mesh);
   if(resource.origin)removeFromScene(game.scene,resource.origin);
   await waitForGpuIdle(game.engine);resource.disposed=true;owned.delete(resource);if(failure)throw failure;
  });return resource.retirement;
 }
 async function rebuild(resource,entries,buildSignal){
  const meshes=[...resource.visual.meshes,...entries.flatMap(e=>e.meshes)];
  for(const e of entries)if(!e.item.factory)setBounds(resource,e.item.id,e.meshes);
  claimQueuedBuilds(game.scene,meshes);const build=rebuildScenePbrPipelines(game.scene,true);builds.add(build);
  try{await build;}finally{builds.delete(build);}buildSignal.throwIfAborted();if(!resource.canCommit())throw Error('Remote material owner superseded');
 }
 async function stage(token){
  if(owned.size>=capacity+1)throw RangeError('Remote staging owner ceiling exceeded');
  const started=performance.now(),race=token.actor.recipe.race,manifest=manifests.get(race),ownController=new AbortController();
  const resource={actorId:token.actor.id,race,controller:ownController,requestSignal:token.controller.signal,container:null,visual:null,equipment:null,meshes:[],disposed:false,canCommit:()=>current(token)};owned.add(resource);stats.peakOwned=Math.max(stats.peakOwned,owned.size);
  const stageSignal=AbortSignal.any([signal,ownController.signal]);
  resource.preparation=(async()=>{
   if(race==='human')await primeMorphMaterialSupport(game.engine);
   const requestSignal=AbortSignal.any([stageSignal,resource.requestSignal]);requestSignal.throwIfAborted();
   const entry=manifest.items.body,lease=acquireRegionAsset(entry.url,entry.sha256,entry.bytes,requestSignal);
   try{resource.container=await loadGltf(game.engine,await lease.promise);}finally{lease.release();}
   stageSignal.throwIfAborted();if(!current(token))throw Error('Remote body owner superseded');
   resource.origin=createTransformNode(`RemoteActor:${token.actor.id}`);addToScene(game.scene,resource.origin);transform(resource,token.actor);
   const {buffer,...definition}=game.body.definition;
   resource.visual=assembleBodyVisual({engine:game.engine,scene:game.scene,player:{body:resource.origin},capsuleHeight:0,definition:{...definition,assetURL:entry.url},container:resource.container,mode:'stage'});
   setBounds(resource,'body',resource.visual.meshes);
   const weights=appearanceShapeWeights(token.actor.recipe);for(const m of resource.visual.meshes)if(m.morphTargets)setMorphTargetWeights(game.engine,m.morphTargets,weights);
   resource.body={...resource.visual,animationGroups:resource.visual.groups,
    setHandGripProvider(fn){resource.visual.handGrips=fn;},
    getState(){return {castingShoot:['fire','lava','pulse'].includes(resource.poseId),holdWeapon:resource.poseId==='pulse'};}};
   resource.sockets=attachSockets(game.engine,game.scene,{body:resource.origin,capsuleHeight:0},resource.body);
   resource.preview=createInspectionPreview(resource.visual,{includeAirborne:true,terminalHold:true});resource.body.inspection=resource.preview;
   pose(resource,token.actor);
   resource.equipment=await createStreamedEquipment(game.engine,game.scene,resource.body,resource.sockets,{
    manifest,race,fitId:FITS_BY_RACE[race],bootLoadout:token.actor.recipe.equipment,dyes:token.actor.recipe.dyes,visible:false,maxIdle:0,
    shapeFamily:manifest.shapeFamily,getShapeWeights:()=>weights,
    acquireBuffer:(asset,request)=>acquireRegionAsset(asset.url,asset.sha256,asset.bytes,AbortSignal.any([stageSignal,resource.requestSignal,request])),
    beforeCommit:(next,entries,request)=>rebuild(resource,entries,AbortSignal.any([stageSignal,resource.requestSignal,request])),canCommit:()=>resource.canCommit(),
   });
   stageSignal.throwIfAborted();pose(resource,token.actor,true);resource.meshes=resource.equipment.getOwnedMeshes();stats.bodyLoads++;return resource;
  })();
  try{return await resource.preparation;}catch(error){await retire(resource);throw error;}
  finally{stats.preparations.push(performance.now()-started);if(stats.preparations.length>256)stats.preparations.shift();}
 }
 function update(){if(disposed)return;for(const entry of actors.values()){transform(entry.resource,entry.actor);pose(entry.resource,entry.actor);}}
 async function dispose(){
  if(disposed)return disposal;disposed=true;leave();signal.removeEventListener('abort',dispose);controller.abort();desired.clear();queue.close();actors.clear();
  disposal=(async()=>{await Promise.all([...owned].map(retire));await queue.drain();await Promise.all([...owned].map(retire));})();return disposal;
 }
 signal.addEventListener('abort',dispose,{once:true});leave=enroll(game.scene,update);
 return {
  async upsert(input,{priority=2}={}){
   signal.throwIfAborted();const actor=checkActor(input),old=actors.get(actor.id),existing=desired.get(actor.id),wanted=existing?.actor;
   const previous=wanted||old?.actor;
   if(previous&&(actor.appearanceRevision<previous.appearanceRevision||actor.appearanceRevision===previous.appearanceRevision&&JSON.stringify(actor.recipe)!==JSON.stringify(previous.recipe)))throw Error('Remote appearance revision is stale or conflicts');
   if(existing?.pending&&actor.appearanceRevision===wanted.appearanceRevision){
    existing.actor=actor;queue.reprioritize(actor.id,priority);
    if(old){old.actor=createRegionActor({...old.actor,transform:actor.transform,motion:actor.motion});transform(old.resource,old.actor);pose(old.resource,old.actor);}
    return existing.pending;
   }
   if(old&&actor.appearanceRevision===old.actor.appearanceRevision&&JSON.stringify(actor.recipe)===JSON.stringify(old.actor.recipe)){old.actor=actor;update();return {status:'applied',revision:actor.appearanceRevision};}
   const token={actor,controller:new AbortController()};
   const pending=queue.submit(actor.id,priority,async valid=>{
    if(!valid()||!current(token))return {status:'superseded'};let staged;
    try{
     const previous=actors.get(actor.id);
     if(!previous&&actors.size>=capacity)throw RangeError('Remote exact actor capacity exceeded');
     if(previous&&sameShape(previous.actor.recipe,token.actor.recipe)){
      const resource=previous.resource;resource.canCommit=()=>valid()&&current(token);resource.requestSignal=token.controller.signal;
      const result=await resource.equipment.setLoadout(token.actor.recipe.equipment,{dyes:token.actor.recipe.dyes});
      if(!valid()||!current(token))return {status:'superseded'};
      if(result.status!=='applied')throw Error(result.error||'Remote equipment transaction failed');
      previous.actor=token.actor;resource.meshes=resource.equipment.getOwnedMeshes();pose(resource,previous.actor,true);stats.liveEquipmentChanges++;
     }else{
      staged=await stage(token);if(!valid()||!current(token)){await retire(staged);return {status:'superseded'};}
      transform(staged,token.actor);pose(staged,token.actor);actors.set(actor.id,{actor:token.actor,resource:staged});
      setVisualVisible(staged.visual,true);staged.equipment.setVisible(true);if(previous)await retire(previous.resource);
     }
     return {status:'applied',revision:token.actor.appearanceRevision};
    }catch(error){if(staged)await retire(staged);if(!valid()||!current(token))return {status:'superseded'};const kept=actors.get(actor.id);if(kept){const restored={actor:kept.actor,controller:new AbortController()};desired.set(actor.id,restored);kept.resource.requestSignal=restored.controller.signal;kept.resource.canCommit=()=>current(restored);}else desired.delete(actor.id);throw error;}
   });token.pending=pending;desired.set(actor.id,token);existing?.controller?.abort();
   if(old){old.actor=createRegionActor({...old.actor,transform:actor.transform,motion:actor.motion});transform(old.resource,old.actor);pose(old.resource,old.actor);}
   try{return await pending;}finally{token.pending=null;}
  },
  setTransform(id,value){const entry=actors.get(id),token=desired.get(id);if(entry)entry.actor=setActorTransform(entry.actor,value);if(token)token.actor=setActorTransform(token.actor,value);if(entry)transform(entry.resource,entry.actor);return Boolean(entry||token);},
  setMotion(id,value){const entry=actors.get(id),token=desired.get(id);const base=token?.actor||entry?.actor;if(!base)return false;const changed=checkActor(setActorMotion(base,value));if(token)token.actor=changed;if(entry){entry.actor=setActorMotion(entry.actor,value);pose(entry.resource,entry.actor);}return true;},
  async remove(id){desired.get(id)?.controller?.abort();desired.delete(id);queue.cancel(id);const entry=actors.get(id);actors.delete(id);await Promise.all([...owned].filter(r=>r.actorId===id).map(retire));return Boolean(entry);},
  get:id=>actors.get(id)?.actor,
  snapshot:()=>({count:actors.size,actors:[...actors.values()].map(e=>({id:e.actor.id,revision:e.actor.appearanceRevision,race:e.actor.recipe.race,sample:e.resource.sample,shape:e.actor.recipe.shape}))}),
  streaming:()=>{for(const r of owned)r.meshes=r.equipment?.getOwnedMeshes()||r.visual?.meshes||(r.container?getContainerMeshes(r.container):[]);return {limits:{pending:32,exact:capacity,idleExact:0,idleGarments:0},queue:queue.snapshot(),immutable:regionAssetCacheSnapshot(),owned:owned.size,activeExact:actors.size,pendingBuilds:builds.size,allocation:accountRegionResources(owned),stats:{...stats,preparations:[...stats.preparations]}};},
  resources:()=>({actors,owned,prepared,builds}),dispose,
 };
}
