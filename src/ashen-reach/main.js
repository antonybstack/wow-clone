import {createStreamedEquipment} from './equipment-stream.js';
import {BASE_VISIBLE_MESHES, ORC_BASE_VISIBLE_MESHES, UNDEAD_BASE_VISIBLE_MESHES, EQUIPMENT_ITEMS} from './equipment-catalog.js';
import {HUMAN_EQUIPMENT_FIT, ORC_EQUIPMENT_FIT, UNDEAD_EQUIPMENT_FIT} from './equipment-contract.js';
import {createEngine,createSceneContext,createArcRotateCamera,createFreeCamera,createHemisphericLight,createDirectionalLight,addToScene,registerScene,startEngine,onBeforeRender,enableBoneControl,enableErrorDecoding,decodeError,setFog,captureScreenshot,setMeshVisible,isGpuTimingSupported,setGpuTimingEnabled,resizeSurface,setEngineSize,setMeshoptBaseUrl} from '@babylonjs/lite';
import {createAshenMetrics} from './metrics.js';
import {createEquipment} from './equipment.js';
import {createArmory} from './armory.js';
import {loadTrainingDummy,createCombat} from './combat.js';
import {bindEnemyColliders,loadEnemies,CHURCHYARD_ANCHORS,TOWN_ANCHORS} from './enemies.js';
import {prefetchNpcBuffer} from '../character/npc.js';
import {createObjective} from './objective.js';
import {attachTownsfolk} from './townsfolk.js';
import {buildChurchyard} from './scene.js';
import {height} from './geometry.js';
import {FOG} from './materials.js';
import {CameraRig} from '../camera-rig.js';
import {initInput,input} from '../input.js';
import {setupPlayer,plantSpawnOnTerrain,resolveCapsule} from '../player.js';
import {attachBody} from '../character/body.js';
import {resolvePlayableBody} from '../character/runtime/playable-body.js';
import {attachDevTools,dev} from './dev-tools.js';
import {createGameMenu} from './menu.js';

enableErrorDecoding();
setMeshoptBaseUrl('/');
function fetchBuffer(url){
 return fetch(url).then((response)=>{
  if(!response.ok)throw Error(`fetch ${url} ${response.status}`);
  return response.arrayBuffer();
 });
}
async function main(){
 const boot=performance.now();
 const canvas=document.getElementById('renderCanvas');
 const params=new URLSearchParams(location.search);
 const pixelRatio=Number(params.get('pixelRatio'));
 const preloadedEquipment=params.has('preloadedEquipment');
 const bodyUrl=preloadedEquipment?'/ashen-reach/wanderer-equipment.glb':'/ashen-reach/equipment/body.glb';
 const bodyBufP=fetchBuffer(bodyUrl);
 const dummyBufP=fetchBuffer('/ashen-reach/training-dummy.glb');
 const npcBufP=prefetchNpcBuffer();
 // Populate HTTP cache while the engine and churchyard come up. createStreamedEquipment
 // still owns the real load so a nude flash cannot beat clothes onto the actor.
 if(!preloadedEquipment){
  for(const url of ['/ashen-reach/equipment/manifest.json','/ashen-reach/equipment/wayfarerTunic.glb','/ashen-reach/equipment/wayfarerTrousers.glb','/ashen-reach/equipment/wayfarerBoots.glb']){
   fetch(url).catch(()=>{});
  }
 }
 const engine=await createEngine(canvas,{msaaSamples:1,maxDevicePixelRatio:pixelRatio>0?pixelRatio:.75});
 const scene=createSceneContext(engine);scene.clearColor={r:FOG[0],g:FOG[1],b:FOG[2],a:1};
 scene.imageProcessing.toneMappingEnabled=false;scene.imageProcessing.exposure=.7;
 setFog(scene,{mode:1,density:.010,color:FOG});
 const light=createHemisphericLight([0,1,0],.50);light.diffuseColor=[.57,.65,.50];light.groundColor=[.13,.12,.08];addToScene(scene,light);
 const moon=createDirectionalLight([.4,-.8,.3],.45);moon.diffuse=[.65,.72,.52];addToScene(scene,moon);
 const camera=createArcRotateCamera(-Math.PI/2,1.46,3.5,{x:0,y:1.5,z:0});camera.fov=1.05;camera.nearPlane=.1;camera.farPlane=1200;
 const rig=new CameraRig(camera);rig.yaw=0;rig.pitch=.04;rig.distance=rig.distanceTarget=3.5;
 const reference=createFreeCamera({x:0,y:height(0,-5)+1.65,z:-5},{x:.0,y:4.0,z:25});reference.fov=1.06;reference.nearPlane=.1;reference.farPlane=1200;
 scene.camera=reference;
 const world=await buildChurchyard(engine,scene);initInput(canvas);
 const sourceBody=resolvePlayableBody('?character=human-source');
 const playable={...sourceBody,assetURL:bodyUrl,buffer:await bodyBufP,directionalSpeed:3.5,
  // Left-foot low-contact phases measured on this fitted GLB by audit-gaits.mjs.
  gaitContacts:{Walk_Loop:.233333,Sprint_Loop:.175,Jog_Bwd_Loop:.333333,Jog_Left_Loop:.208333,Jog_Right_Loop:.983333},
  landing:{duration:.42,standingWeight:.4,movingWeight:.23},
  castMotion:{lowerClip:'FireBlast_Lower',releaseTime:.28,hand:'mainHand'},
  castMotions:{lava:{upperClip:'LavaBall_Upper',lowerClip:'LavaBall_Lower',releaseTime:1.5,hand:'mainHand'}},
  clips:{...sourceBody.clips,cast:'FireBlast_Upper',walkBack:'Jog_Bwd_Loop',strafeL:'Jog_Left_Loop',strafeR:'Jog_Right_Loop',turnL:'Turn90_L',turnR:'Turn90_R',hit:'Hit_Chest'}};
 const dummy=await loadTrainingDummy(engine,scene,world,await dummyBufP);
 const capsule=resolveCapsule(playable.capsule);
 // The world is a north-running corridor (terrain spans x∈[-90,90], z∈[-95,145]), not a disc, so a
 // circular clamp either clips the reachable town short (small radius) or lets the player walk off
 // the terrain's east/west edges (large radius). A rectangular clamp matches the actual extent.
 const player=await setupPlayer(engine,scene,rig,{spawn:plantSpawnOnTerrain(world.spawn,capsule,height),colliders:world.colliders,groundHeight:height,boundsRect:{minX:-88,maxX:88,minZ:-93,maxZ:143},capsule});
 enableBoneControl();const body=await attachBody(engine,scene,player,player.capsuleHeight,playable);
 const noEnemies=params.has('noEnemies');
 const npcBuf=noEnemies?null:await npcBufP;
 const folkP=attachTownsfolk(engine,scene,world);
 const churchyardEnemies=noEnemies?[]:await loadEnemies(engine,scene,world,CHURCHYARD_ANCHORS,npcBuf);
 if(churchyardEnemies.length)bindEnemyColliders(churchyardEnemies,player,world);
 const combat=await createCombat(engine,scene,canvas,player,body,world,input,dummy,rig,churchyardEnemies,createObjective());
 await folkP;
 body.bindSocketHost(combat.fx.sockets);
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
  human:{race:'human',manifestUrl:'/ashen-reach/equipment/manifest.json',baseMeshes:BASE_VISIBLE_MESHES,fitId:HUMAN_EQUIPMENT_FIT},
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
 const equipment={
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
    const bootLoadout=pack.garments===false || race==='undead'
     ?{...EMPTY_LOADOUT,mainHand:factoryHand(loadout.mainHand),offHand:factoryHand(loadout.offHand)}
     :(parkedGarments||loadout);
    if(pack.garments===false)parkedGarments=loadout;
    else parkedGarments=null;
    const next=await createStreamedEquipment(engine,scene,body,combat.fx.sockets,{...pack,bootLoadout});
    impl=next;
    currentRace=race;
    previousImpl.dispose();
   }catch(error){
    if(previousRace==='human'||!packs[previousRace]?.bodyUrl)body.restoreSource();
    else await body.swapSource(packs[previousRace].bodyUrl);
    previousImpl.setVisible(true);
    throw error;
   }
  },
  dispose(){impl.dispose();},
 };
 let view='reference',elapsed=0;const samples=[];
 const setView=v=>{
  view=v;scene.camera=v==='reference'?reference:camera;
  setMeshVisible(body.root,v==='play');
  body.hideParked?.();
  equipment.setVisible(v==='play');
  combat.setVisible(v==='play');
 };
 const reset=()=>{player.setWorldPos(0,height(0,0)+capsule.height/2,0);player.setFacing(0);rig.yaw=0;rig.pitch=.04;combat.releaseSpirit?.(true);setView('reference');};
 const armory=createArmory({scene,canvas,player,body,combat,equipment,getView:()=>view,setView});
 const tools=attachDevTools({params,canvas,camera,player,combat,setView});
 const menu=createGameMenu({onArmory:()=>armory.open()});
 document.addEventListener('keydown',e=>{if(armory.isOpen||menu.isOpen)return;if(e.code==='KeyV'){setView(view==='reference'?'play':'reference');}if(e.code==='KeyR'){if(combat.releaseSpirit?.())return;reset();}if(e.code==='KeyH')document.body.classList.toggle('clean');if(['KeyW','KeyA','KeyS','KeyD','Space','Tab','Digit1','Digit2','KeyF'].includes(e.code))setView('play');});
 if(params.has('clean'))document.body.classList.add('clean');
 setView(params.has('play')?'play':'reference');
 const metrics=createAshenMetrics({engine,scene,world,canvas,samples,lite:{isGpuTimingSupported,setGpuTimingEnabled,resizeSurface,setEngineSize}});
 if(params.has('gpuTiming'))metrics.setGpuTiming(true);
 onBeforeRender(scene,ms=>{const dt=Math.min(.05,ms/1000);elapsed+=dt;player.kinematicStep(dt);combat.beforeAnimation(dt);tools.tick();body.update(dt);world.update(elapsed,player.body.position);combat.afterAnimation(dt);equipment.update(dt);armory.update(dt);if(elapsed>4&&ms>0){samples.push(ms);if(samples.length>600)samples.shift();metrics.sampleGpu();}});
 globalThis.ASHEN={engine,scene,camera,reference,rig,player,body,world,combat,armory,equipment,input,setView,reset,metrics,capture:()=>captureScreenshot(engine),hostilesReady:noEnemies,loadMs:0,dev,menu};
 ASHEN.whenHostiles=townP.then(()=>{ASHEN.hostilesReady=true;});
 await registerScene(scene);await startEngine(engine);
 ASHEN.loadMs=performance.now()-boot;
 ASHEN.ready=true;document.getElementById('loading').remove();
}
main().catch(e=>{console.error(e);const el=document.getElementById('error');el.style.display='block';let message=e.stack||String(e);try{message+='\n'+decodeError(e);}catch{}el.textContent=message;});
