import {sceneLifetime} from './scene-lifetime.js';
import {createAudioEngineAsync,createSoundBufferAsync,createSoundAsync,playSound,stopSound,unlockAudioEngineAsync,createAudioEngineMediaStream,disposeAudioEngineMediaStream,disposeAudioEngine,onSceneDispose,setMasterVolume} from '@babylonjs/lite';

/** Reuse Lite's decoded-buffer playback, gesture unlock, and master-mix capture. */
export async function createFireBlastAudio(scene){
 const lifetime=sceneLifetime(scene);lifetime.throwIfAborted();
 let engine=null,sound=null,charge=null,played=0,lavaPlayed=0,error=null,muted=true;
 let preparation=null,initializing=false,bell=null,bellPreparation=null,bellError=null,bellPlayed=0;
 const release=()=>{if(engine)disposeAudioEngine(engine);engine=null;sound=null;charge=null;bell=null;};
 const unlock=()=>{if(!muted&&engine&&engine.state!=='running')void unlockAudioEngineAsync(engine).catch(()=>{});};
 onSceneDispose(scene,()=>{document.removeEventListener('keydown',unlock);document.removeEventListener('pointerdown',unlock);release();});
 // Native AudioContext construction took 177–193 ms on the initial muted walk.
 // Create Lite's engine only on an explicit sound request (or diagnostic capture
 // preparation), retaining its decoded buffers, gesture unlock and mixer.
 // https://github.com/BabylonJS/Babylon-Lite/blob/npm-lite-v1.31.1/packages/babylon-lite/src/audio/audio-engine.ts
 // https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/AudioContext
 const prepare=()=>{
  lifetime.throwIfAborted();
  if(preparation)return preparation;
  initializing=true;
  preparation=(async()=>{
   // Chrome 154 still queries device parameters for a silent sink + explicit
   // sampleRate. These options do not bypass that query; keep native defaults
   // until a materially different path proves a gain (see the audio options receipt).
   // https://chromium.googlesource.com/chromium/src/+/b859317bf11f6be47f9b7799ec690a0a42a1fb33/content/renderer/media/renderer_webaudiodevice_impl.cc#237
   const created=await createAudioEngineAsync({volume:0});
   if(lifetime.aborted){disposeAudioEngine(created);lifetime.throwIfAborted();}
   engine=created;
   // Independent native fetch/decode jobs overlap after explicit activation.
   // Load buffers before creating sound graphs: if a sibling fails or the scene
   // closes, a late decode cannot attach another sound to a disposed engine.
   // https://github.com/BabylonJS/Babylon-Lite/blob/npm-lite-v1.31.1/packages/babylon-lite/src/audio/sound-buffer.ts
   const [blastBuffer,chargeBuffer]=await Promise.all([
    createSoundBufferAsync(created,'/ashen-reach/fire-blast/fireball-julien-matthey.wav'),
    createSoundBufferAsync(created,'/ashen-reach/fire-blast/lava-charge.wav'),
   ]);
   lifetime.throwIfAborted();
   sound=await createSoundAsync(created,blastBuffer,{maxInstances:4,volume:.8,playbackRate:.90});
   lifetime.throwIfAborted();
   charge=await createSoundAsync(created,chargeBuffer,{maxInstances:1,volume:.48});
   lifetime.throwIfAborted();
   setMasterVolume(engine,muted?0:.65);
   unlock();
  })().catch(e=>{
   release();
   if(!lifetime.aborted){error=String(e);console.warn('Fire Blast audio unavailable',e);}
   throw e;
  }).finally(()=>{initializing=false;});
  return preparation;
 };
 // A later keyboard/pointer gesture can resume an initialized, unmuted engine.
 // Normal movement while muted never initializes audio.
 document.addEventListener('keydown',unlock);document.addEventListener('pointerdown',unlock);
 // The optional expedition cue shares the native mixer, master mute and device.
 // Its failure does not reject spell preparation or dispose working spell audio.
 // Decode before making a graph, and reject a late arrival into a closed scene.
 // https://github.com/BabylonJS/Babylon-Lite/blob/npm-lite-v1.31.1/packages/babylon-lite/src/audio/static-sound.ts
 const prepareBell=()=>{
  if(muted||lifetime.aborted)return Promise.resolve(false);
  if(bellPreparation)return bellPreparation;
  bellPreparation=(async()=>{
   await prepare();if(lifetime.aborted||!engine)return false;
   const created=engine,buffer=await createSoundBufferAsync(created,'/ashen-reach/exploration/vaelmark-bell.wav');
   if(lifetime.aborted||engine!==created)return false;
   bell=await createSoundAsync(created,buffer,{maxInstances:2,volume:.65});
   return !lifetime.aborted&&engine===created;
  })().catch(e=>{if(!lifetime.aborted){bellError=String(e);console.warn('Vaelmark bell cue unavailable',e);}return false;});
  return bellPreparation;
 };
 return {
  prepare,
  prepareBell,
  ringBell(stillEligible){
   if(muted||lifetime.aborted)return;
   void prepareBell().then(ready=>{if(ready&&!muted&&!lifetime.aborted&&engine?.state==='running'&&stillEligible()){
    playSound(bell);bellPlayed++;
   }}).catch(()=>{});
  },
  play(){if(sound&&engine?.state==='running'){playSound(sound);played++;}},
  lavaCharge(){if(charge&&engine?.state==='running')playSound(charge);},
  lavaCancel(){if(charge)stopSound(charge);},
  lavaRelease(){if(charge)stopSound(charge);if(sound&&engine?.state==='running'){playSound(sound,{playbackRate:.75,volume:.36});lavaPlayed++;}},
  lavaImpact(){if(sound&&engine?.state==='running'){playSound(sound,{playbackRate:.62,volume:.72});lavaPlayed++;}},
  pulse(){if(charge)stopSound(charge);if(sound&&engine?.state==='running'){playSound(sound,{playbackRate:.42,volume:1});playSound(sound,{playbackRate:.28,volume:.88});playSound(sound,{playbackRate:.62,volume:.5});}},
  setMuted(value){muted=!!value;if(engine)setMasterVolume(engine,muted?0:.65);if(!muted)unlock();return muted?Promise.resolve():prepare();},
  get muted(){return muted;},
  get status(){return {ready:!!sound&&!!charge,initializing,state:engine?.state,played,lavaPlayed,error,duration:sound?.buffer.duration,bellReady:!!bell,bellPlayed,bellError};},
  // Only diagnostics request a stream; normal play creates no recording graph.
  capture(){lifetime.throwIfAborted();if(!sound||!charge)throw new Error('Prepare audio before requesting a capture');const output=createAudioEngineMediaStream(engine);return {stream:output.stream,dispose:()=>disposeAudioEngineMediaStream(output),time:engine.currentTime};},
 };
}
