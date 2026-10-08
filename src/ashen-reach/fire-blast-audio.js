import {sceneLifetime} from './scene-lifetime.js';
import {createAudioEngineAsync,createSoundBufferAsync,createSoundAsync,playSound,stopSound,unlockAudioEngineAsync,createAudioEngineMediaStream,disposeAudioEngineMediaStream,disposeAudioEngine,onSceneDispose,setMasterVolume} from '@babylonjs/lite';

/** Reuse Lite's decoded-buffer playback, gesture unlock, and master-mix capture. */
export async function createFireBlastAudio(scene){
 const lifetime=sceneLifetime(scene);lifetime.throwIfAborted();
 let engine=null,sound=null,charge=null,played=0,lavaPlayed=0,error=null,muted=true;
 let preparation=null,initializing=false;
 const release=()=>{if(engine)disposeAudioEngine(engine);engine=null;sound=null;charge=null;};
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
 return {
  prepare,
  play(){if(sound&&engine?.state==='running'){playSound(sound);played++;}},
  lavaCharge(){if(charge&&engine?.state==='running')playSound(charge);},
  lavaCancel(){if(charge)stopSound(charge);},
  lavaRelease(){if(charge)stopSound(charge);if(sound&&engine?.state==='running'){playSound(sound,{playbackRate:.75,volume:.36});lavaPlayed++;}},
  lavaImpact(){if(sound&&engine?.state==='running'){playSound(sound,{playbackRate:.62,volume:.72});lavaPlayed++;}},
  pulse(){if(charge)stopSound(charge);if(sound&&engine?.state==='running'){playSound(sound,{playbackRate:.42,volume:1});playSound(sound,{playbackRate:.28,volume:.88});playSound(sound,{playbackRate:.62,volume:.5});}},
  setMuted(value){muted=!!value;if(engine)setMasterVolume(engine,muted?0:.65);if(!muted)unlock();return muted?Promise.resolve():prepare();},
  get muted(){return muted;},
  get status(){return {ready:!!sound&&!!charge,initializing,state:engine?.state,played,lavaPlayed,error,duration:sound?.buffer.duration};},
  // Only diagnostics request a stream; normal play creates no recording graph.
  capture(){lifetime.throwIfAborted();if(!sound||!charge)throw new Error('Prepare audio before requesting a capture');const output=createAudioEngineMediaStream(engine);return {stream:output.stream,dispose:()=>disposeAudioEngineMediaStream(output),time:engine.currentTime};},
 };
}
