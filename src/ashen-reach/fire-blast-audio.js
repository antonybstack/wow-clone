import {sceneLifetime} from './scene-lifetime.js';
import {createAudioEngineAsync,createSoundAsync,playSound,stopSound,unlockAudioEngineAsync,createAudioEngineMediaStream,disposeAudioEngineMediaStream,disposeAudioEngine,onSceneDispose,setMasterVolume} from '@babylonjs/lite';

/** Reuse Lite's decoded-buffer playback, gesture unlock, and master-mix capture. */
export async function createFireBlastAudio(scene){
 const lifetime=sceneLifetime(scene);lifetime.throwIfAborted();
 let engine=null,sound=null,charge=null,played=0,lavaPlayed=0,error=null,muted=true;
 const unlock=()=>{if(engine&&engine.state!=='running')void unlockAudioEngineAsync(engine).catch(()=>{});};
 onSceneDispose(scene,()=>{document.removeEventListener('keydown',unlock);document.removeEventListener('pointerdown',unlock);if(engine)disposeAudioEngine(engine);});
 try{
  engine=await createAudioEngineAsync({volume:0});
  if(lifetime.aborted){disposeAudioEngine(engine);lifetime.throwIfAborted();}
  sound=await createSoundAsync(engine,'/ashen-reach/fire-blast/fireball-julien-matthey.wav',{maxInstances:4,volume:.8,playbackRate:.90});
  lifetime.throwIfAborted();
  charge=await createSoundAsync(engine,'/ashen-reach/fire-blast/lava-charge.wav',{maxInstances:1,volume:.48});
  lifetime.throwIfAborted();
  setMasterVolume(engine,0);
 }catch(e){error=String(e);console.warn('Fire Blast audio unavailable',e);}
 // Keyboard users should not need an unrelated canvas click to enable sound.
 lifetime.throwIfAborted();
 document.addEventListener('keydown',unlock);document.addEventListener('pointerdown',unlock);
 return {
  play(){if(sound&&engine?.state==='running'){playSound(sound);played++;}},
  lavaCharge(){if(charge&&engine?.state==='running')playSound(charge);},
  lavaCancel(){if(charge)stopSound(charge);},
  lavaRelease(){if(charge)stopSound(charge);if(sound&&engine?.state==='running'){playSound(sound,{playbackRate:.75,volume:.36});lavaPlayed++;}},
  lavaImpact(){if(sound&&engine?.state==='running'){playSound(sound,{playbackRate:.62,volume:.72});lavaPlayed++;}},
  pulse(){if(charge)stopSound(charge);if(sound&&engine?.state==='running'){playSound(sound,{playbackRate:.42,volume:1});playSound(sound,{playbackRate:.28,volume:.88});playSound(sound,{playbackRate:.62,volume:.5});}},
  setMuted(value){muted=!!value;if(engine)setMasterVolume(engine,muted?0:.65);},
  get muted(){return muted;},
  get status(){return {ready:!!sound,state:engine?.state,played,lavaPlayed,error,duration:sound?.buffer.duration};},
  // Only diagnostics request a stream; normal play creates no recording graph.
  capture(){if(!engine)throw new Error('Audio engine unavailable');const output=createAudioEngineMediaStream(engine);return {stream:output.stream,dispose:()=>disposeAudioEngineMediaStream(output),time:engine.currentTime};},
 };
}
