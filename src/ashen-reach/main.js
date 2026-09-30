import {sceneLifetime} from './scene-lifetime.js';
import {BASE_VISIBLE_MESHES, ORC_BASE_VISIBLE_MESHES, ORC_BODY_URL, UNDEAD_BASE_VISIBLE_MESHES, EQUIPMENT_ITEMS} from './equipment-catalog.js';
import {HUMAN_EQUIPMENT_FIT, ORC_EQUIPMENT_FIT, UNDEAD_EQUIPMENT_FIT} from './equipment-contract.js';
import {RACE_BODY_SEGMENTS} from './coverage-contract.js';
import {createEngine,createSceneContext,disposeScene,createArcRotateCamera,createFreeCamera,createHemisphericLight,createDirectionalLight,addToScene,registerScene,onSceneDispose,onBeforeRender,enableBoneControl,setFog,captureScreenshot,setMeshVisible,isGpuTimingSupported,setGpuTimingEnabled,resizeSurface,setEngineSize,setMeshoptBaseUrl,waitForGpuIdle} from '@babylonjs/lite';
import {createAshenMetrics} from './metrics.js';
import {createRenderLoop} from './render-loop.js';
import {createObjective} from './objective.js';
import {createStarterWorld,preloadStarterWorld} from './starter-world.js';
import {createStreamedEquipment} from './equipment-stream.js';
import {preloadStarterCharacter,startupAssetBuffer,upgradeStarterCharacter} from './startup-assets.js';
import {showBackgroundLoading} from './background-loading.js';
import {height} from './geometry.js';
import {SKY_HORIZON,SUN_DIR,SUN_COLOR,SKY_AMBIENT,GROUND_BOUNCE} from './atmosphere.js';
import {CameraRig} from '../camera-rig.js';
import {initInput,input,setInputEnabled,lockInputUntilReload} from '../input.js';
import {installTouchControls,touchControlsWanted} from './touch-controls.js';
import {setupPlayer,loadHavok,plantSpawnOnTerrain,resolveCapsule} from '../player.js';
import {attachBody} from '../character/body.js';
import {attachSockets} from '../character/sockets.js';
import {resolvePlayableBody} from '../character/runtime/playable-body.js';
import {attachDevTools,dev} from './dev-tools.js';
import {createLocalLights} from './local-lights.js';
import {buildPostPipeline,buildDirectPipeline} from './post.js';
import {createSunShadows} from './sun-shadows.js';
import {registerSceneWithShadowSupport,unregisterScene} from '@babylonjs/lite';
import {registerLateFeatures} from './register-late-features.js';
import {createGameMenu} from './menu.js';
import {configureGpuCompatibility,showGpuDiagnostics} from './gpu-compatibility.js';
import {beginLoading,setLoadingStage,finishLoading,failLoading,showDeviceLoss} from './loading-screen.js';
import {configureLinearMaterials} from './linear-materials.js';
import {formatGameError} from './error-display.js';
import {startupMark,startupMarks,startupTimings,startupSpanMs} from './startup-trace.js';

/**
 * A readiness boundary other code and every probe can await.
 *
 * Three of these exist because "loaded" is three different questions. Movement
 * needs a dressed body on solid ground with input live; combat needs hostiles and
 * the spell systems; the region is everything. Collapsing them into one boolean
 * is what made the old `ready` mean "all of it", and so made the startup target
 * unmeasurable: there was no name for the moment the player can actually walk.
 */
function boundary(){
 let resolve,reject;
 const promise=new Promise((r,j)=>{resolve=r;reject=j;});
 promise.catch(()=>{});
 return {promise,reached:false,reach(value){if(this.reached)return;this.reached=true;resolve(value);},fail(error){if(this.reached)return;this.reached=true;reject(error);}};
}

setMeshoptBaseUrl('/');
function fetchBuffer(url,priority='high'){
 return fetch(url,{priority}).then((response)=>{
  if(!response.ok)throw Error(`fetch ${url} ${response.status}`);
  return response.arrayBuffer();
 });
}
let failStartup=null;
async function main(){
 beginLoading();
 const boot=performance.now();
 const canvas=document.getElementById('renderCanvas');
 const params=new URLSearchParams(location.search);
 // `/` now serves this document directly instead of redirecting through a stub page.
 // That stub sent a bare `/` to `?play&clean` and forwarded any query it was given
 // verbatim, so the same two rules apply here: a root URL with no query of its own
 // gets the play defaults, and a root URL with a query is taken at its word.
 if(!location.search&&(location.pathname==='/'||location.pathname.endsWith('/index.html'))){
  params.set('play','');params.set('clean','');
 }
 const markStartup=startupMark;
 markStartup('begin');
 const pixelRatio=Number(params.get('pixelRatio'));
 const preloadedEquipment=params.has('preloadedEquipment');
 const fastStart=!preloadedEquipment&&!params.has('legacyStart')&&(params.has('fastStart')||import.meta.env.VITE_FAST_START==='1');
 const starterWorldP=fastStart?preloadStarterWorld():null;
 const starterCharacterP=fastStart?preloadStarterCharacter():null;
 starterWorldP?.catch(()=>{});starterCharacterP?.catch(()=>{});
 // M004 developer shape family. `resolveHumanShape` answers null for every URL that does
 // not name `humanShape` or `humanHeight`, so the default route below is untouched. When a
 // morph target is actually driven the character comes from the candidate GLB instead of the
 // compressed startup pack -- same body, same bind, same clips, plus two shape targets -- so
 // the character half of the fast start is bypassed while the fast world is kept.
 const humanShape=params.has('humanShape')||params.has('humanHeight')
  ?(await import('../character/runtime/human-shape.js')).resolveHumanShape(params)
  :null;
 // Diagnostic M006 tail on the M004 shape family. This explicit route has its
 // own mesh/coverage adapter; the starter body and startup path stay identical.
 // The candidate is served by Vite from .cache and is not a released asset.
 const humanHair=params.get('humanHair');
 if(humanHair&&humanHair!=='ponytail')throw Error(`Unknown Human hair candidate ${humanHair}`);
 if(humanHair&&preloadedEquipment)throw Error('The Human hair candidate needs streamed equipment');
 if(humanHair&&humanShape?.weights.some(weight=>weight>0)&&humanShape.garmentFit!=='refit')
  throw Error('A shaped Human hair candidate needs garmentFit=refit');
 // M006 old/bald head diagnostic. The candidate is the same M004 shape body cut at the
 // y=1.5 neck with a separate head and eyes mesh, so it carries the same 65 joints, the
 // same 57 clips and the same slender/stout targets and loads through this one route.
 // Its head and body use two different atlases; `match-old-head-atlas.mjs` is what makes
 // them agree at the join. Not a released asset.
 const humanHead=params.get('humanHead');
 if(humanHead&&humanHead!=='old-bald')throw Error(`Unknown Human head candidate ${humanHead}`);
 if(humanHead&&humanHair)throw Error('The head and hair candidates are two different bodies');
 if(humanHead&&preloadedEquipment)throw Error('The Human head candidate needs streamed equipment');
 if(humanHead&&humanShape?.weights.some(weight=>weight>0)&&humanShape.garmentFit!=='refit')
  throw Error('A shaped Human head candidate needs garmentFit=refit');
 // M006 creator. It drives the M004 morph targets live, so the candidate body has to be
 // loaded even at weight 0 -- the default route loads the shipped body, which has no targets
 // and cannot be reshaped afterwards. Refitted garments come with it so M005's fit follows.
 // Lazily imported below; nothing about the creator is in the startup graph.
 const creatorWanted=params.has('creator');
 if(creatorWanted&&preloadedEquipment)throw Error('The creator needs streamed equipment');
 if(creatorWanted&&(humanHair||humanHead))throw Error('The creator and the head/hair candidates are different bodies');
 // One dynamic import for the whole creator route; the module is pure data and stays out of
 // the default startup graph, as the M004 route already keeps it.
 const shapeModule=creatorWanted?await import('../character/runtime/human-shape.js'):null;
 const shapeCandidate=humanHair
  ?'/__human_hair__/human-ponytail01-tail-shape-family-candidate.glb'
  :humanHead
  ?'/__human_head__/human-old-bald-atlas-matched.glb'
  :humanShape?.assetURL
  ||(creatorWanted?shapeModule.HUMAN_SHAPE_ASSET:null);
 const fastCharacter=fastStart&&!shapeCandidate;
 const bodyUrl=shapeCandidate||(preloadedEquipment?'/ashen-reach/wanderer-equipment.glb':'/ashen-reach/equipment/body.glb');
 const bodyBufP=fastCharacter?starterCharacterP.then(m=>startupAssetBuffer(m.items.body)):fetchBuffer(bodyUrl,'high');
 bodyBufP.catch(()=>{});
 // Havok's 650 KB WASM gates grounded movement and needs nothing from the scene, so it
 // downloads and compiles alongside the body instead of starting inside setupPlayer once
 // the world is already built. loadHavok() memoises, so setupPlayer's own call is free.
 const havokP=loadHavok();
 havokP.then(()=>markStartup('havok-runtime-available')).catch(()=>{});
 // Starter clothes wait until the body bytes have arrived, then warm the
 // cache at low priority. They used to race the body on the first connection.
 if(!preloadedEquipment&&!fastCharacter){
  bodyBufP.then(()=>{
   for(const url of ['/ashen-reach/equipment/manifest.json','/ashen-reach/equipment/wayfarerTunic.glb','/ashen-reach/equipment/wayfarerTrousers.glb','/ashen-reach/equipment/wayfarerBoots.glb']){
    fetch(url,{priority:'low'}).catch(()=>{});
   }
  }).catch(()=>{});
 }
 setLoadingStage(0,'Lighting the lamps.');
 const engine=await createEngine(canvas,{msaaSamples:1,maxDevicePixelRatio:pixelRatio>0?pixelRatio:.75});
 markStartup('engine-created');
 const gpu=await configureGpuCompatibility(engine._device);
 markStartup('gpu-probe-end');
 if(params.has('gpuDiagnostics'))showGpuDiagnostics(gpu);
 if(gpu.depthBundle==='unsupported')throw new Error(gpu.errors.join('\n'));
 setLoadingStage(1,'Raising the churchyard.');
 // All scene materials write linear radiance; presentation owns display conversion.
 const scene=createSceneContext(engine,{defaultRenderTask:false}),lifetime=sceneLifetime(scene);scene.clearColor={r:SKY_HORIZON[0],g:SKY_HORIZON[1],b:SKY_HORIZON[2],a:1};
 const attachLinearMaterials=configureLinearMaterials(scene);
 setFog(scene,{mode:0,density:0,color:SKY_HORIZON});
 const light=createHemisphericLight([0,1,0],.62);light.diffuseColor=SKY_AMBIENT.map(v=>v*3.1);light.groundColor=GROUND_BOUNCE.map(v=>v*3.1);addToScene(scene,light);
 // Direction light travels = away from the sun. Low and northward, so the player
 // walking toward Hollowmere is backlit and rims out against the haze.
 const sun=createDirectionalLight([-SUN_DIR[0],-SUN_DIR[1],-SUN_DIR[2]],.95);sun.diffuse=SUN_COLOR;addToScene(scene,sun);
 const camera=createArcRotateCamera(-Math.PI/2,1.46,3.5,{x:0,y:1.5,z:0});camera.fov=1.05;camera.nearPlane=.1;camera.farPlane=1200;
 const rig=new CameraRig(camera);rig.yaw=0;rig.pitch=.04;rig.distance=rig.distanceTarget=3.5;
 const reference=createFreeCamera({x:0,y:height(0,-5)+1.65,z:-5},{x:.0,y:4.0,z:25});reference.fov=1.06;reference.nearPlane=.1;reference.farPlane=1200;
 scene.camera=reference;
 const shadows=createSunShadows(engine,scene,sun,{depthOnlyFragment:gpu.depthBundle==='empty-fragment'});
 const localLights=createLocalLights(engine,scene,shadows);
 markStartup('world-start');
 // Keep procedural authoring off the prepared starting area's module graph.
 // The worker and diagnostic legacy path still use the same generator.
 const world=fastStart?await createStarterWorld(engine,scene,starterWorldP):await (await import('./scene.js')).buildChurchyard(engine,scene);
 markStartup('world-end');
 initInput(canvas);setInputEnabled(false);installTouchControls();
 setLoadingStage(2,'Calling the wanderer.');
 enableBoneControl();
 const noEnemies=params.has('noEnemies');
 let player=null;
 let body=null;
 let capsule=null;
 let combat=null;
 let equipment=null;
 let armory=null;
 let creator=null;
 let tools={tick(){}};
 let dressed=false;
 let readyForPlay=false;
 let deviceLost=false;
 const playableBoundary=boundary(),combatBoundary=boundary(),regionBoundary=boundary(),hostilesBoundary=boundary(),firstGpuCompleted=boundary(),supportedGpuCompleted=boundary();
 let supportedFramePending=false;
 failStartup=error=>{for(const b of [playableBoundary,combatBoundary,regionBoundary,hostilesBoundary,firstGpuCompleted,supportedGpuCompleted])b.fail(error);};
 let view='reference',elapsed=0;const samples=[];
 const setView=v=>{
  view=v;scene.camera=v==='reference'?reference:camera;
  const show=v==='play'&&dressed&&body;
  if(body){setMeshVisible(body.root,show);body.hideParked?.();}
  equipment?.setVisible(show);
  combat?.setVisible(v==='play');
 };
 const reset=()=>{if(!player||!capsule)return;player.setWorldPos(0,height(0,0)+capsule.height/2,0);player.setFacing(0);rig.yaw=0;rig.pitch=.04;combat?.releaseSpirit?.(true);setView('reference');};
 /**
  * M004 developer shape family, applied to the one body this route owns.
  *
  * Morph weights go straight onto the loaded mesh. Lite composes morph deltas into
  * `morphedPos`/`morphedNorm` in the vertex stage *before* skinning, so a shaped body
  * still deforms with the same 65-joint palette and the same clips
  * (`@babylonjs/lite/lib/shader/fragments/morph-fragment-core.js`, `MORPH_PRE_SKINNING`).
  *
  * Height is a uniform scale on the visual root, which already carries the -1 X mirror
  * `mountBodyRoot` installs; the sockets read that same root scale, so hand and weapon
  * placement follows without a second height path. The camera pivot is the one value
  * that is not derived from the body, so it is scaled here.
  */
 // Set once a shape is applied, so equipment loaded later can be given the same weights.
 let applyMorphWeights=null,reshapeEquipment=null;
 // The creator drives these live from weight 0, so the writers have to exist before a
 // target is driven; the one-shot M004 route only needed them once a weight was non-zero.
 let writeShapeWeights=null,basePivotHeight=null;
 const applyHumanShape=async request=>{
  if(request.weights.some(w=>w>0)||request.installWriters){
   const {setMorphTargetWeights}=await import('@babylonjs/lite');
   // Every mesh under a root that declares morph targets takes the same weights: the body
   // and, under ?garmentFit=refit, each garment piece. Their targets are built from one
   // girth field and share a name and an order, so one weight vector drives the outfit.
   applyMorphWeights=root=>{
    let applied=0;
    const visit=node=>{
     if(node?.morphTargets){setMorphTargetWeights(engine,node.morphTargets,request.weights);applied++;}
     for(const child of node?.children||[])visit(child);
    };
    visit(root);
    return applied;
   };
   if(!applyMorphWeights(body.root))throw Error(`No morph targets on the loaded body; ${bodyUrl} is not the shape-family candidate`);
   // A garment arrives at its own pace, and it arrives at weight 0, which is the shipped
   // shape. Re-applying over the whole scene after every change is what keeps a newly
   // equipped piece from being the only thing still wearing the neutral body's shape.
   const writeWeights=weights=>{let n=0;for(const mesh of scene.meshes||[])if(mesh.morphTargets){setMorphTargetWeights(engine,mesh.morphTargets,weights);n++;}return n;};
   reshapeEquipment=()=>writeWeights(request.weights);
   reshapeEquipment();
   // A probe cannot import '@babylonjs/lite' by bare specifier inside the page, and
   // re-importing the package raw would build a second registry. Expose the bound writer
   // instead, so a weight sweep measures the same call the game itself makes.
   ashen.setShapeWeights=writeWeights;
   writeShapeWeights=writeWeights;
  }
  if(request.heightScale!==1){
   const s=request.heightScale,root=body.root;
   if(root?.scaling){root.scaling.x=Math.sign(root.scaling.x||-1)*s;root.scaling.y=s;root.scaling.z=s;}
   rig.pivotHeight*=s;
  }
  ashen.humanShape={...request,applied:true};
 };
 /**
  * Absolute live shape, for the creator's sliders.
  *
  * `applyHumanShape` is a one-shot: it multiplies the camera pivot by the height scale,
  * which is correct once and compounds if it is called again. This sets every value from
  * the neutral baseline instead, so dragging a slider back and forth lands exactly where it
  * started. The capsule follows through `player.setHeightScale`, which owns the clamp and
  * reshapes the Havok controller, so collision never disagrees with what is drawn.
  */
 const setHumanShapeLive=({weights,heightScale})=>{
  if(!writeShapeWeights)throw Error('The live shape writers are not installed; load with ?creator=1');
  writeShapeWeights(weights);
  reshapeEquipment=()=>writeShapeWeights(weights);
  const root=body.root;
  if(root?.scaling){root.scaling.x=Math.sign(root.scaling.x||-1)*heightScale;root.scaling.y=heightScale;root.scaling.z=heightScale;}
  if(basePivotHeight===null)basePivotHeight=rig.pivotHeight;
  rig.pivotHeight=basePivotHeight*heightScale;
  player.setHeightScale(heightScale);
  ashen.humanShape={weights,heightScale,applied:true,live:true};
 };

 const menu=createGameMenu({onArmory:()=>armory?.open(),onDev:on=>tools.setEnabled?.(on)});
 document.addEventListener('keydown',e=>{if(armory?.isOpen||menu.isOpen)return;if(e.code==='KeyV'){setView(view==='reference'?'play':'reference');}if(e.code==='KeyR'){if(combat?.releaseSpirit?.())return;reset();}if(e.code==='KeyH')document.body.classList.toggle('clean');if(['KeyW','KeyA','KeyS','KeyD','Space','Tab','Digit1','Digit2','Digit3','KeyF'].includes(e.code))setView('play');});
 if(params.has('clean'))document.body.classList.add('clean');
 setView(params.has('play')||touchControlsWanted()?'play':'reference');
 const metrics=createAshenMetrics({engine,scene,world,canvas,samples,lite:{isGpuTimingSupported,setGpuTimingEnabled,resizeSurface,setEngineSize}});
 if(params.has('gpuTiming'))metrics.setGpuTiming(true);
 onBeforeRender(scene,ms=>{const dt=Math.min(.05,ms/1000);if(menu.isOpen){armory?.update(dt);shadows.update();localLights.update(dt,player?.body.position);return;}elapsed+=dt;player?.kinematicStep(dt);if(readyForPlay)combat?.beforeAnimation(dt);tools.tick();body?.update(dt);world.update(elapsed,player?player.body.position:null);if(readyForPlay)combat?.afterAnimation(dt);equipment?.update(dt);armory?.update(dt);shadows.update();localLights.update(dt,player?.body.position);if(readyForPlay&&elapsed>4&&ms>0){samples.push(ms);if(samples.length>600)samples.shift();metrics.sampleGpu();}});
 const ashen={engine,scene,camera,reference,rig,world,input,setView,reset,metrics,capture:()=>captureScreenshot(engine),hostilesReady:noEnemies,presentMs:0,loadMs:0,ready:false,
  // ready/hostilesReady keep their existing "all of it" meaning for the suites
  // that already assert on them. The three below are the new, narrower claims.
  playableReady:false,combatReady:false,regionReady:false,
  whenPlayable:playableBoundary.promise,whenCombat:combatBoundary.promise,whenRegion:regionBoundary.promise,
  whenHostiles:hostilesBoundary.promise,
  whenFirstGpuFrame:firstGpuCompleted.promise,dispose:()=>disposeScene(scene),
  async whenNextGpuFrame(){const frame=ashen.gpu.frames;while(ashen.gpu.frames<=frame)await new Promise(requestAnimationFrame);await waitForGpuIdle(engine);},
  startup:{marks:startupMarks,timings:startupTimings,span:startupSpanMs},humanShape:null,dev,menu,get player(){return player;},get body(){return body;},get combat(){return combat;},get equipment(){return equipment;},get armory(){return armory;},get sockets(){return sockets;}};
 ashen.gpu=gpu;
 ashen.setHumanShapeLive=setHumanShapeLive;
 onBeforeRender(scene,()=>{gpu.frames++;});
 globalThis.ASHEN=ashen;
 const sourceBody=resolvePlayableBody('?character=human-source');
 const playable={...sourceBody,assetURL:bodyUrl,buffer:await bodyBufP,directionalSpeed:3.5,
  // Left-foot low-contact phases measured on this fitted GLB by audit-gaits.mjs.
  gaitContacts:{Walk_Loop:.233333,Sprint_Loop:.175,Jog_Bwd_Loop:.333333,Jog_Left_Loop:.208333,Jog_Right_Loop:.983333},
  landing:{duration:.42,standingWeight:.4,movingWeight:.23},
  castMotion:{lowerClip:'FireBlast_Lower',releaseTime:.55,followThrough:.85,fadeOut:0,hand:'mainHand'},
  castMotions:{lava:{upperClip:'LavaBall_Upper',lowerClip:'LavaBall_Lower',releaseTime:1.5,followThrough:0.8,fadeOut:0,hand:'mainHand'},pulse:{upperClip:'PyreBurst_Upper',lowerClip:'PyreBurst_Lower',releaseTime:1.1,followThrough:0.8,fadeOut:0,holdWeapon:true,hand:'mainHand'}},
  clips:{...sourceBody.clips,cast:'FireBlast_Upper',walkBack:'Jog_Bwd_Loop',strafeL:'Jog_Left_Loop',strafeR:'Jog_Right_Loop',turnL:'Turn90_L',turnR:'Turn90_R',hit:'Hit_Chest'}};
 capsule=resolveCapsule(playable.capsule);
 // Both near and outer terrain participate in Havok; exploration has no corridor clamp.
 markStartup('havok-start');
 player=await setupPlayer(engine,scene,rig,{spawn:plantSpawnOnTerrain(world.spawn,capsule,world.groundHeight),colliders:world.colliders,groundHeight:world.groundHeight,boundsRadius:Infinity,capsule,havok:havokP,onPhase:markStartup});
 markStartup('havok-end');
 // Height is applied to the Havok controller first, so `player.capsuleHeight` below is
 // already the scaled capsule that the body root and the sockets are mounted against.
 // Collision authority never leaves the capsule; the visual only follows it.
 if(humanShape&&humanShape.heightScale!==1)player.setHeightScale(humanShape.heightScale);
 world.releaseInitialCollisionSources?.();
 markStartup('body-start');
 body=await attachBody(engine,scene,player,player.capsuleHeight,playable);
 const starterBodyContainer=body.container;
 markStartup('body-end');
 if(humanShape)await applyHumanShape(humanShape);
 // Install the live writers at weight 0, so the creator's sliders have something to drive
 // from the neutral character rather than needing a shape to already be applied.
 else if(creatorWanted)await applyHumanShape({weights:shapeModule.HUMAN_SHAPE_TARGETS.map(()=>0),heightScale:1,installWriters:true});
 // Sockets need the player capsule and the body's skeleton and nothing else, so they do not
 // have to wait for combat. Hoisting them out of the spell VFX is what lets the starter
 // garments and the starter weapon be worn before any combat module has been fetched.
 const sockets=attachSockets(engine,scene,player,body);
 body.bindSocketHost(sockets);
 const EMPTY_LOADOUT={helmet:null,torso:null,legs:null,boots:null,gloves:null,mainHand:null,offHand:null};
 const factoryHand=(id)=>id&&EQUIPMENT_ITEMS[id]?.factory?id:null;
 // THE ONE LINE TO FLIP when the authored Undead body lands: set this to 'equipment-undead'
 // and delete public/ashen-reach/equipment-undead-provisional/ plus its prepare script. The
 // provisional pack is Human geometry retinted flat; it declares the real ashen-undead fit,
 // which is what the plumbing below is actually checking. If the finished body splits its
 // coverage differently, UNDEAD_BASE_VISIBLE_MESHES in equipment-catalog.js is the other
 // thing to reconcile -- createStreamedEquipment names any region it cannot bind.
 const UNDEAD_PACK_DIR='equipment-undead';
 const packs={
  // The creator reshapes the body live, so its garments must be the refitted pack; the
  // shipped pack has no targets and would stay at the neutral shape under every slider.
  human:{race:'human',manifestUrl:humanShape?.garmentManifestURL||(creatorWanted?shapeModule.HUMAN_GARMENT_FIT_MANIFEST:null)||(fastCharacter?'/ashen-reach/startup/character/manifest.json':'/ashen-reach/equipment/manifest.json'),
   baseMeshes:humanHair?['HumanV1Body','HumanPonytail01']
    :humanHead?['HumanV1Body','OldBaldHeadV2Diagnostic','OldBaldEyesDiagnostic']:['HumanV1Body'],
   ...(humanHair?{bodySegments:{...RACE_BODY_SEGMENTS.human,HumanPonytail01:['head.scalp']}}:{}),
   // The candidate's body ends at the neck, so it no longer carries either head segment;
   // the head and eyes do. Same split the Undead body already uses.
   ...(humanHead?{bodySegments:{
    HumanV1Body:RACE_BODY_SEGMENTS.human.HumanV1Body.filter(s=>!s.startsWith('head.')),
    OldBaldHeadV2Diagnostic:['head.face','head.scalp'],
    OldBaldEyesDiagnostic:['head.face'],
   }}:{}),
   fitId:HUMAN_EQUIPMENT_FIT,...(fastCharacter?{manifest:await starterCharacterP,loadBuffer:startupAssetBuffer}:{})},
  orc:{race:'orc',manifestUrl:'/ashen-reach/equipment-orc/manifest.json',baseMeshes:ORC_BASE_VISIBLE_MESHES,fitId:ORC_EQUIPMENT_FIT,bodyUrl:ORC_BODY_URL},
  undead:{race:'undead',manifestUrl:`/ashen-reach/${UNDEAD_PACK_DIR}/manifest.json`,baseMeshes:UNDEAD_BASE_VISIBLE_MESHES,fitId:UNDEAD_EQUIPMENT_FIT,bodyUrl:`/ashen-reach/${UNDEAD_PACK_DIR}/body.glb`},
 };
 setLoadingStage(3,'Gathering your belongings.');
 markStartup('equipment-start');
 const createEquipment=preloadedEquipment?(await import('./equipment.js')).createEquipment:null;
 let impl=preloadedEquipment?createEquipment(engine,scene,body,sockets):await createStreamedEquipment(engine,scene,body,sockets,packs.human);
 // A settled request is the only safe moment to shape a garment: a cancelled or failed one
 // never added a mesh, and re-applying after it would be shaping whatever is still on.
 const reshaped=request=>Promise.resolve(request).then(result=>{reshapeEquipment?.();return result;},error=>{reshapeEquipment?.();throw error;});
 reshapeEquipment?.();
 let currentRace='human';
 let parkedGarments=null;
 equipment={
  get items(){return impl.items;},
  get presets(){return impl.presets;},
  setLoadout:patch=>reshaped(impl.setLoadout(patch)),
  equip:(slot,id)=>reshaped(impl.equip(slot,id)),
  equipPreset:id=>reshaped(impl.equipPreset(id)),
  getState:()=>impl.getState(),
  getStatus:()=>impl.getStatus?.(),
  setVisible:value=>impl.setVisible(value),
  update:dt=>impl.update(dt),
  get attachment(){return impl.attachment;},
  get race(){return currentRace;},
  async switchRace(race){
   if(race===currentRace)return;
   const pack=packs[race];
   if(!pack)throw Error('Unknown race pack');
   // ?preloadedEquipment serves one baked Human-fit GLB instead of a streamed per-race pack, so
   // no race but Human can be honoured under it. It used to swap the body and report success:
   // switchRace('orc') answered race='orc' while the churchyard still showed a Human in Human
   // garments -- a silent Human fit wearing another race's label, which is the one thing this
   // milestone must make impossible. Refuse on the mode, before anything touches the character.
   if(preloadedEquipment&&race!=='human')throw Error(`${race} needs the streamed equipment pack; ?preloadedEquipment serves one baked Human fit.`);
   const previousRace=currentRace;
   const previousImpl=impl;
   const loadout={...impl.getState()};
   impl.setVisible(false);
   try{
    if(pack.bodyUrl)await body.swapSource(pack.bodyUrl);
    else body.restoreSource();
    const bootLoadout=pack.garments===false
     ?{...EMPTY_LOADOUT,mainHand:factoryHand(loadout.mainHand),offHand:factoryHand(loadout.offHand)}
     : race==='undead'
      ?{...EMPTY_LOADOUT,helmet:'graveweaverHood',torso:'graveweaverTop',legs:'graveweaverSkirt',mainHand:factoryHand(loadout.mainHand),offHand:factoryHand(loadout.offHand)}
      :(parkedGarments||loadout);
    if(pack.garments===false)parkedGarments=loadout;
    else parkedGarments=null;
    const next=await createStreamedEquipment(engine,scene,body,sockets,{...pack,bootLoadout});
    // Returning from Orc/Undead creates fresh Human garment meshes at morph weight 0.
    // The parked Human body retained its shape, so drive the newly streamed clothes
    // before making the outfit visible again.
    if(race==='human')reshapeEquipment?.();
    impl=next;
    currentRace=race;
    previousImpl.dispose();
    sockets.rebind?.(body);
   }catch(error){
    if(previousRace==='human'||!packs[previousRace]?.bodyUrl)body.restoreSource();
    else await body.swapSource(packs[previousRace].bodyUrl);
    previousImpl.setVisible(true);
    throw error;
   }
  },
  dispose(){impl.dispose();},
 };
 markStartup('equipment-end');
 dressed=true;
 setView(view);
 setLoadingStage(4,'Waking the churchyard.');
 // Skinning is fixed up at load. Starting the engine first leaves the mesh
 // in the bind pose while clips report as playing. See docs/startup-load.md.
 // Bloom is a render-target swap, so it has to exist before the first
 // registerScene. It does not fetch anything. ?noPost skips it.
 shadows.setWorld(world);localLights.setWorld(world);ashen.shadows=shadows;ashen.localLights=localLights;
 const post=params.has('noPost')?buildDirectPipeline(engine,scene):buildPostPipeline(engine,scene,sun,world,shadows,localLights);
 ashen.post=post.status;
 ashen.hdr=post;
 ashen.volumetric=post.volume;
 ashen.grounding=post.grounding;
 if(post.status.notes.length)console.warn('ashen post chain:',post.status.notes.join('; '));
 attachLinearMaterials();
 markStartup('register-start');
 await registerSceneWithShadowSupport(scene);
 markStartup('register-end');
 ashen.renderLoop=createRenderLoop(engine,scene,{
  onFrameSubmitted:()=>{
   if(supportedFramePending||!dressed||!player.getGrounded())return;
   supportedFramePending=true;
   markStartup('supported-frame-submitted');
   // Fence the first actually submitted dressed, grounded frame. An extra
   // requestAnimationFrame after this fence would add latency without adding
   // stronger evidence that the starting scene is ready for movement.
   void waitForGpuIdle(engine).then(()=>{markStartup('supported-frame-completed');supportedGpuCompleted.reach();},error=>supportedGpuCompleted.fail(error));
  },
  onError:e=>{console.error(e);const el=document.getElementById('error');el.style.display='block';el.textContent=e?.stack||String(e);void formatGameError(e).then(message=>{el.textContent=message;}).catch(()=>{});},
  onDeviceLost:(error,info)=>{
   deviceLost=true;
   console.error(error,info);
   lockInputUntilReload();
   disposeScene(scene);
   showDeviceLoss(error);
  },
 });
 await ashen.renderLoop.start();
 markStartup('first-render-return');
 // Lite's public GPU fence reports completion of already submitted work, not scanout.
 // https://github.com/BabylonJS/Babylon-Lite/blob/npm-lite-v1.31.1/packages/babylon-lite/src/index.ts
 // The render loop already fences every frame through waitForGpuIdle, so asking
 // once more here adds a queue callback and no GPU work. It used to be gated on
 // ?startupMarks, which meant an ordinary navigation had no completed-GPU
 // boundary at all -- the one boundary that distinguishes "submitted a frame"
 // from "a frame finished".
 void waitForGpuIdle(engine).then(()=>{markStartup('first-gpu-completed');firstGpuCompleted.reach(performance.now()-boot);})
 .catch(error=>{firstGpuCompleted.fail(error);console.error('Startup GPU fence failed',error);});
 ashen.presentMs=performance.now()-boot;
 // Observe supported physics and completion of a dressed frame, not just loading.
 // https://github.com/BabylonJS/Babylon-Lite/blob/npm-lite-v1.31.1/docs/lite/architecture/42-physics.md
 await firstGpuCompleted.promise;
 const groundingTimeout=setTimeout(()=>supportedGpuCompleted.fail(Error('Starting character did not reach grounded Havok support')),10000);
 try{await supportedGpuCompleted.promise;}finally{clearTimeout(groundingTimeout);}
 setLoadingStage(5,'Opening the gates.');
 // The playable boundary. The character is dressed, standing on Havok collision, and the
 // dressed frame has completed; finishLoading reveals it and releases the overlay.
 await finishLoading();
 if(deviceLost)return;
 readyForPlay=true;
 setInputEnabled(true);
 markStartup('playable');
 ashen.playableMs=performance.now()-boot;
 ashen.playableReady=true;
 playableBoundary.reach(ashen.playableMs);

 // --- Background. The player is walking while all of this lands. Anything here that
 // fails leaves the safe area usable and reports retry or reload explicitly.
 const backgroundStatus=showBackgroundLoading();
 let backgroundDisposed=false;onSceneDispose(scene,()=>{backgroundDisposed=true;backgroundStatus.dispose();});
 ashen.whenRest=(async()=>{
  markStartup('bg-start');
  const nearbyFoliage=world.startNearbyFoliage?.();nearbyFoliage?.catch(error=>{ashen.nearbyError=error.message;});
  // Nearby gameplay must not wait for distant geometry or texture enhancement.
  // Both jobs yield through the same native render loop; scene/GPU mutations
  // remain on the main thread and the worker only transfers authoring data.
  const regionP=(async()=>{
   if(world.startRegion){
    for(;;){
     try{await world.startRegion(player);break;}
     catch(error){if(backgroundDisposed||deviceLost||error.reloadRequired)throw error;ashen.backgroundError=error.message;await backgroundStatus.retry(error);}
    }
    delete ashen.backgroundError;world.retireProxies();shadows.setWorld(world);
   }
   if(world.startNearbyFoliage){
    for(;;){
     try{await world.startNearbyFoliage();delete ashen.nearbyError;break;}
     catch(error){if(backgroundDisposed||deviceLost)throw error;await backgroundStatus.retry(error);}
    }
   }
  })();
  regionP.catch(()=>{});
    const foliageP=regionP.then(()=>world.startFoliage());
    // Cancellation can reject while the parallel gameplay imports are pending.
    // Observe immediately; the later Promise.all still propagates real failures.
    foliageP.catch(()=>{});
  const texturesP=regionP.then(async()=>{
   if(world.upgradeTextures)await world.upgradeTextures();
   if(fastCharacter)await upgradeStarterCharacter(engine,scene,starterBodyContainer,await starterCharacterP);
  });
  texturesP.catch(()=>{});
  const [
   {loadTrainingDummy,createCombat},
   {bindEnemyColliders,loadEnemies,CHURCHYARD_ANCHORS,TOWN_ANCHORS},
   {prefetchNpcBuffer},
   {attachTownsfolk},
   {createArmory},
  ]=await Promise.all([
   import('./combat.js'),
   import('./enemies.js'),
   import('../character/npc.js'),
   import('./townsfolk.js'),
   import('./armory.js'),
  ]);
  lifetime.throwIfAborted();
  markStartup('bg-imports-end');
  const dummyP=loadTrainingDummy(engine,scene,world);
  const folkP=attachTownsfolk(engine,scene,world);folkP.catch(()=>{});
  const npcP=noEnemies?Promise.resolve(null):prefetchNpcBuffer();
  // Foliage is the longest background job and nothing else depends on it, so it runs
  // alongside the hostiles rather than in front of them. It is still awaited before
  // `ready`, which keeps that flag meaning "all of it" for the suites that assert on it.
  void foliageP.then(()=>markStartup('bg-foliage-end'),()=>{});
  const [dummy,npcBuf]=await Promise.all([dummyP,npcP]);
  lifetime.throwIfAborted();
  markStartup('bg-dummy-end');
  const churchyardEnemies=noEnemies?[]:await loadEnemies(engine,scene,world,CHURCHYARD_ANCHORS,npcBuf);
  markStartup('bg-enemies-end');
  if(churchyardEnemies.length)bindEnemyColliders(churchyardEnemies,player,world);
  // The socket host was created with the body, so combat binds to the one the garments
  // are already hanging on rather than baking a second one onto the same skeleton.
  // Spell lighting snapshots materials. Nearby pools must exist first; the
  // completed foliage upgrade retains those exact materials and allocations.
  if(nearbyFoliage)await nearbyFoliage.catch(()=>regionP);
  else await foliageP; // The diagnostic full-world path creates its pools later.
  lifetime.throwIfAborted();
  combat=await createCombat(engine,scene,canvas,player,body,world,input,dummy,rig,churchyardEnemies,createObjective(),{sockets});
  lifetime.throwIfAborted();
  markStartup('combat-ready');
  ashen.combatReady=true;
  combatBoundary.reach(performance.now()-boot);
  combat.bindEquipment(() => equipment.getState());
  combat.setVisible(view==='play');
  armory=createArmory({scene,canvas,player,body,combat,equipment,getView:()=>view,setView});
  // M006 body controls, as a section of the armory rather than a second panel: one
  // inspection surface, reached with C. Imported here, in the background pass after the game
  // is playable, so it stays its own chunk and off the startup critical path.
  //
  // The sliders can only move a body that carries the M004 morph targets, which is the
  // ?creator=1 route; on the default route the section still appears, disabled, saying why.
  {
   const {createCreator}=await import('./creator.js');
   const {creatorStateToShape}=await import('../character/creator/contract.js');
   creator=createCreator({
    race:'human',
    armory,
    drivable:Boolean(writeShapeWeights),
    applyShape:state=>{const {weights,heightScale}=creatorStateToShape(state);setHumanShapeLive({weights,heightScale});},
   });
   ashen.creator=creator;
  }
  tools=attachDevTools({params,canvas,camera,player,combat,setView});
  // Spell billboard systems arrive after the first visible scene registration. This
  // re-registers the scene while the player is moving; it measured 2-9 ms.
  markStartup('late-register-start');
  await registerLateFeatures(scene,attachLinearMaterials,unregisterScene,registerSceneWithShadowSupport);
  markStartup('late-register-end');
  await folkP;
  const townP=noEnemies?Promise.resolve([]):loadEnemies(engine,scene,world,TOWN_ANCHORS,npcBuf).then((town)=>{
   for(const enemy of town){
    combat.registerEnemy(enemy);
    bindEnemyColliders([enemy],player,world);
   }
   return town;
  });
  townP.then(()=>{ashen.hostilesReady=true;markStartup('hostiles-ready');hostilesBoundary.reach();},error=>hostilesBoundary.fail(error));
  await ashen.whenHostiles;
  await Promise.all([foliageP,texturesP]);
  ashen.loadMs=performance.now()-boot;
  ashen.ready=true;
  markStartup('ready');
  markStartup('region-ready');
  ashen.regionMs=performance.now()-boot;
  ashen.regionReady=true;
  regionBoundary.reach(ashen.regionMs);
  backgroundStatus.done();
 })();
 ashen.whenRest.catch(error=>{combatBoundary.fail(error);hostilesBoundary.fail(error);regionBoundary.fail(error);if(backgroundDisposed||deviceLost)return;ashen.backgroundError=error.message;backgroundStatus.fail();console.error('Background startup failed',error);});
}
main().catch(async e=>{failStartup?.(e);console.error(e);const message=await formatGameError(e).catch(()=>e?.stack||String(e));if(failLoading(e,message))return;const el=document.getElementById('error');el.style.display='block';el.textContent=message;});
