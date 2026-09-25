import {BASE_VISIBLE_MESHES, ORC_BASE_VISIBLE_MESHES, UNDEAD_BASE_VISIBLE_MESHES, EQUIPMENT_ITEMS} from './equipment-catalog.js';
import {HUMAN_EQUIPMENT_FIT, ORC_EQUIPMENT_FIT, UNDEAD_EQUIPMENT_FIT} from './equipment-contract.js';
import {createEngine,createSceneContext,createArcRotateCamera,createFreeCamera,createHemisphericLight,createDirectionalLight,addToScene,registerScene,onBeforeRender,enableBoneControl,enableErrorDecoding,decodeError,setFog,captureScreenshot,setMeshVisible,isGpuTimingSupported,setGpuTimingEnabled,resizeSurface,setEngineSize,setMeshoptBaseUrl} from '@babylonjs/lite';
import {createAshenMetrics} from './metrics.js';
import {createRenderLoop} from './render-loop.js';
import {createObjective} from './objective.js';
import {buildChurchyard} from './scene.js';
import {height} from './geometry.js';
import {SKY_HORIZON,SUN_DIR,SUN_COLOR,SKY_AMBIENT,GROUND_BOUNCE} from './atmosphere.js';
import {CameraRig} from '../camera-rig.js';
import {initInput,input,setInputEnabled} from '../input.js';
import {installTouchControls,touchControlsWanted} from './touch-controls.js';
import {setupPlayer,plantSpawnOnTerrain,resolveCapsule} from '../player.js';
import {attachBody} from '../character/body.js';
import {resolvePlayableBody} from '../character/runtime/playable-body.js';
import {attachDevTools,dev} from './dev-tools.js';
import {createLocalLights} from './local-lights.js';
import {buildPostPipeline,buildDirectPipeline} from './post.js';
import {createSunShadows} from './sun-shadows.js';
import {registerSceneWithShadowSupport} from '@babylonjs/lite';
import {createGameMenu} from './menu.js';
import {configureGpuCompatibility,showGpuDiagnostics} from './gpu-compatibility.js';
import {beginLoading,setLoadingStage,finishLoading,failLoading} from './loading-screen.js';
import {configureLinearMaterials} from './linear-materials.js';

enableErrorDecoding();
setMeshoptBaseUrl('/');
async function flushDeferredBuilders(scene,prepareMaterials){
 const pending=scene._deferredBuilders;
 if(!pending?.length)return;
 while(pending.length){
  prepareMaterials();
  const builders=pending.splice(0);
  await Promise.all(builders.map((build)=>build()));
 }
 scene._renderables?.sort((a,b)=>(a.order??0)-(b.order??0));
 scene._renderableVersion=(scene._renderableVersion??0)+1;
 scene._frameGraph?.build?.();
}
function fetchBuffer(url,priority='high'){
 return fetch(url,{priority}).then((response)=>{
  if(!response.ok)throw Error(`fetch ${url} ${response.status}`);
  return response.arrayBuffer();
 });
}
async function main(){
 beginLoading();
 const boot=performance.now();
 const canvas=document.getElementById('renderCanvas');
 const params=new URLSearchParams(location.search);
 const pixelRatio=Number(params.get('pixelRatio'));
 const preloadedEquipment=params.has('preloadedEquipment');
 const bodyUrl=preloadedEquipment?'/ashen-reach/wanderer-equipment.glb':'/ashen-reach/equipment/body.glb';
 const bodyBufP=fetchBuffer(bodyUrl,'high');
 // Starter clothes wait until the body bytes have arrived, then warm the
 // cache at low priority. They used to race the body on the first connection.
 if(!preloadedEquipment){
  bodyBufP.then(()=>{
   for(const url of ['/ashen-reach/equipment/manifest.json','/ashen-reach/equipment/wayfarerTunic.glb','/ashen-reach/equipment/wayfarerTrousers.glb','/ashen-reach/equipment/wayfarerBoots.glb']){
    fetch(url,{priority:'low'}).catch(()=>{});
   }
  }).catch(()=>{});
 }
 setLoadingStage(0,'Lighting the lamps.');
 const engine=await createEngine(canvas,{msaaSamples:1,maxDevicePixelRatio:pixelRatio>0?pixelRatio:.75});
 const gpu=await configureGpuCompatibility(engine._device);
 if(params.has('gpuDiagnostics'))showGpuDiagnostics(gpu);
 if(gpu.depthBundle==='unsupported')throw new Error(gpu.errors.join('\n'));
 setLoadingStage(1,'Raising the churchyard.');
 // All scene materials write linear radiance; presentation owns display conversion.
 const scene=createSceneContext(engine,{defaultRenderTask:false});scene.clearColor={r:SKY_HORIZON[0],g:SKY_HORIZON[1],b:SKY_HORIZON[2],a:1};
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
 const world=await buildChurchyard(engine,scene);initInput(canvas);setInputEnabled(false);installTouchControls();
 setLoadingStage(2,'Calling the wanderer.');
 enableBoneControl();
 const noEnemies=params.has('noEnemies');
 let player=null;
 let body=null;
 let capsule=null;
 let combat=null;
 let equipment=null;
 let armory=null;
 let tools={tick(){}};
 let dressed=false;
 let readyForPlay=false;
 let view='reference',elapsed=0;const samples=[];
 const setView=v=>{
  view=v;scene.camera=v==='reference'?reference:camera;
  const show=v==='play'&&dressed&&body;
  if(body){setMeshVisible(body.root,show);body.hideParked?.();}
  equipment?.setVisible(show);
  combat?.setVisible(v==='play');
 };
 const reset=()=>{if(!player||!capsule)return;player.setWorldPos(0,height(0,0)+capsule.height/2,0);player.setFacing(0);rig.yaw=0;rig.pitch=.04;combat?.releaseSpirit?.(true);setView('reference');};
 const menu=createGameMenu({onArmory:()=>armory?.open(),onDev:on=>tools.setEnabled?.(on)});
 document.addEventListener('keydown',e=>{if(armory?.isOpen||menu.isOpen)return;if(e.code==='KeyV'){setView(view==='reference'?'play':'reference');}if(e.code==='KeyR'){if(combat?.releaseSpirit?.())return;reset();}if(e.code==='KeyH')document.body.classList.toggle('clean');if(['KeyW','KeyA','KeyS','KeyD','Space','Tab','Digit1','Digit2','Digit3','KeyF'].includes(e.code))setView('play');});
 if(params.has('clean'))document.body.classList.add('clean');
 setView(params.has('play')||touchControlsWanted()?'play':'reference');
 const metrics=createAshenMetrics({engine,scene,world,canvas,samples,lite:{isGpuTimingSupported,setGpuTimingEnabled,resizeSurface,setEngineSize}});
 if(params.has('gpuTiming'))metrics.setGpuTiming(true);
 onBeforeRender(scene,ms=>{const dt=Math.min(.05,ms/1000);if(menu.isOpen){armory?.update(dt);shadows.update();localLights.update(dt,player?.body.position);return;}elapsed+=dt;player?.kinematicStep(dt);if(readyForPlay)combat?.beforeAnimation(dt);tools.tick();body?.update(dt);world.update(elapsed,player?player.body.position:null);if(readyForPlay)combat?.afterAnimation(dt);equipment?.update(dt);armory?.update(dt);shadows.update();localLights.update(dt,player?.body.position);if(readyForPlay&&elapsed>4&&ms>0){samples.push(ms);if(samples.length>600)samples.shift();metrics.sampleGpu();}});
 const ashen={engine,scene,camera,reference,rig,world,input,setView,reset,metrics,capture:()=>captureScreenshot(engine),hostilesReady:noEnemies,presentMs:0,loadMs:0,ready:false,dev,menu,get player(){return player;},get body(){return body;},get combat(){return combat;},get equipment(){return equipment;},get armory(){return armory;}};
 ashen.gpu=gpu;
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
 // The world is a north-running corridor (terrain spans x∈[-90,90], z∈[-95,145]), not a disc, so a
 // circular clamp either clips the reachable town short (small radius) or lets the player walk off
 // the terrain's east/west edges (large radius). A rectangular clamp matches the actual extent.
 player=await setupPlayer(engine,scene,rig,{spawn:plantSpawnOnTerrain(world.spawn,capsule,height),colliders:world.colliders,groundHeight:height,boundsRect:{minX:-88,maxX:88,minZ:-93,maxZ:143},capsule});
 body=await attachBody(engine,scene,player,player.capsuleHeight,playable);
 setLoadingStage(3,'Waking the churchyard.');
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
 await registerSceneWithShadowSupport(scene);
 ashen.renderLoop=createRenderLoop(engine,scene,{onError:e=>{console.error(e);const el=document.getElementById('error');el.style.display='block';el.textContent=e.stack||String(e);}});
 await ashen.renderLoop.start();
 ashen.presentMs=performance.now()-boot;
 const foliageP=world.startFoliage();
 const [
  {loadTrainingDummy,createCombat},
  {bindEnemyColliders,loadEnemies,CHURCHYARD_ANCHORS,TOWN_ANCHORS},
  {prefetchNpcBuffer},
  {attachTownsfolk},
  {createStreamedEquipment},
  {createEquipment},
  {createArmory},
 ]=await Promise.all([
  import('./combat.js'),
  import('./enemies.js'),
  import('../character/npc.js'),
  import('./townsfolk.js'),
  import('./equipment-stream.js'),
  import('./equipment.js'),
  import('./armory.js'),
 ]);
 const dummyP=loadTrainingDummy(engine,scene,world);
 const folkP=attachTownsfolk(engine,scene,world);
 const npcP=noEnemies?Promise.resolve(null):prefetchNpcBuffer();
 await foliageP;
 const [dummy,npcBuf]=await Promise.all([dummyP,npcP]);
 const churchyardEnemies=noEnemies?[]:await loadEnemies(engine,scene,world,CHURCHYARD_ANCHORS,npcBuf);
 if(churchyardEnemies.length)bindEnemyColliders(churchyardEnemies,player,world);
 combat=await createCombat(engine,scene,canvas,player,body,world,input,dummy,rig,churchyardEnemies,createObjective());
 // Spell sprites register as deferred builders. The scene is already
 // running by this point, and those builders only flush inside the first
 // registerScene. Without this, Pyre Burst keeps the ground disc (a mesh)
 // and drops the geyser, sparks and pillars.
 await flushDeferredBuilders(scene,attachLinearMaterials);
 await folkP;
 body.bindSocketHost(combat.fx.sockets);
 setLoadingStage(4,'Gathering your belongings.');
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
  human:{race:'human',manifestUrl:'/ashen-reach/equipment/manifest.json',baseMeshes:['HumanV1Body'],fitId:HUMAN_EQUIPMENT_FIT},
  orc:{race:'orc',manifestUrl:'/ashen-reach/equipment-orc/manifest.json',baseMeshes:ORC_BASE_VISIBLE_MESHES,fitId:ORC_EQUIPMENT_FIT,bodyUrl:'/ashen-reach/equipment-orc/body.glb'},
  undead:{race:'undead',manifestUrl:`/ashen-reach/${UNDEAD_PACK_DIR}/manifest.json`,baseMeshes:UNDEAD_BASE_VISIBLE_MESHES,fitId:UNDEAD_EQUIPMENT_FIT,bodyUrl:`/ashen-reach/${UNDEAD_PACK_DIR}/body.glb`},
 };
 const townP=noEnemies?Promise.resolve([]):loadEnemies(engine,scene,world,TOWN_ANCHORS,npcBuf).then((town)=>{
  for(const enemy of town){
   combat.registerEnemy(enemy);
   bindEnemyColliders([enemy],player,world);
  }
  return town;
 }).catch((error)=>{console.error('Town hostiles failed to load',error);return [];});
 let impl=preloadedEquipment?createEquipment(engine,scene,body,combat.fx.sockets):await createStreamedEquipment(engine,scene,body,combat.fx.sockets,packs.human);
 let currentRace='human';
 let parkedGarments=null;
 equipment={
  get items(){return impl.items;},
  get presets(){return impl.presets;},
  setLoadout:patch=>impl.setLoadout(patch),
  equip:(slot,id)=>impl.equip(slot,id),
  equipPreset:id=>impl.equipPreset(id),
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
    const next=await createStreamedEquipment(engine,scene,body,combat.fx.sockets,{...pack,bootLoadout});
    impl=next;
    currentRace=race;
    previousImpl.dispose();
    combat.fx.sockets?.rebind?.(body);
   }catch(error){
    if(previousRace==='human'||!packs[previousRace]?.bodyUrl)body.restoreSource();
    else await body.swapSource(packs[previousRace].bodyUrl);
    previousImpl.setVisible(true);
    throw error;
   }
  },
  dispose(){impl.dispose();},
 };
 combat.bindEquipment(() => equipment.getState());
 armory=createArmory({scene,canvas,player,body,combat,equipment,getView:()=>view,setView});
 tools=attachDevTools({params,canvas,camera,player,combat,setView});
 dressed=true;
 setView(view);
 setLoadingStage(5,'Opening the gates.');
 ashen.whenHostiles=townP.then(()=>{ashen.hostilesReady=true;});
 await finishLoading();
 readyForPlay=true;
 setInputEnabled(true);
 ashen.loadMs=performance.now()-boot;
 ashen.ready=true;
}
main().catch(e=>{console.error(e);if(failLoading(e))return;const el=document.getElementById('error');el.style.display='block';let message=e.stack||String(e);try{message+='\n'+decodeError(e);}catch{}el.textContent=message;});
