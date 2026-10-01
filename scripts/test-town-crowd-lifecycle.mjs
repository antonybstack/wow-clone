import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {registerHooks} from 'node:module';
import {actorPhaseSeconds} from '../src/character/crowd-probe/batches.js';

// Exercise the actual developer town module; substitute only native GPU and
// network boundaries. Deferred rebuilds deliberately let frames run mid-mount.
const names=['addToScene','attachVat','createVatBakeResults','disposeMeshGpu','getContainerMeshes',
  'getViewMatrix','getViewProjectionMatrix','projectWorldToScreen','loadGltf','onBeforeRender',
  'onSceneDispose','prepareVatMany','rebuildScenePbrPipelines','removeFromScene','setMeshVisible','setThinInstances'];
const mockUrl=`data:text/javascript,${encodeURIComponent(`export const VERSION='1.31.1';\n`+names.map(name=>`export const ${name}=(...args)=>globalThis.__townLite.${name}(...args);`).join('\n'))}`;
registerHooks({resolve(specifier,context,next){
  return specifier==='@babylonjs/lite'?{url:mockUrl,shortCircuit:true}:next(specifier,context);
}});
const {mountTownCrowd}=await import('../src/character/crowd-probe/town.js');
const manifest=JSON.parse(await fs.readFile(new URL('../docs/baselines/character-mmo/m003/prepared-assets.json',import.meta.url)));
async function until(check,pending){
  for(let i=0;i<100;i++){if(check())return;await Promise.race([pending,new Promise(resolve=>setImmediate(resolve))]);}
  throw Error('Native boundary was not reached');
}
function deferred(){let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};}
function fixture({deferLoad=false,deferRebuild=false,partialAdd=false,failAttach=-1,sharedBakes=false}={}){
  const scene={meshes:[],callbacks:[],disposals:[],_materialSwapQueue:[]},rebuild=deferred(),load=deferred();
  const counts={loads:0,removes:0,rebuilds:0,disposed:0,unclaimed:0,fetches:0};
  let loaded,attached=0;
  const containers=[];
  const makeContainer=()=>{
    // Multiple primitives share the sword name. The unselected mesh must stay
    // hidden and must never acquire a baked texture or playback handle.
    const pieces=[...manifest.variants.wayfarer.meshes,'ProbeIronSword','Unselected'];
    const meshes=pieces.map(name=>({name,skeleton:{},visible:true,material:{},disposed:false}));
    const container={meshes,entities:meshes,animationGroups:[{name:'Idle_Loop'},{name:'Walk_Loop'}]};
    containers.push(container);return container;
  };
  const clips={Idle_Loop:{fromRow:0,frameCount:30,fps:30},Walk_Loop:{fromRow:30,frameCount:30,fps:30}};
  const sharedTexture={destroy(){counts.unclaimed++;}};
  globalThis.__townLite={
    getContainerMeshes:container=>container.meshes,
    loadGltf:async()=>{counts.loads++;loaded=makeContainer();if(deferLoad)await load.promise;return loaded;},
    prepareVatMany:targets=>targets,
    createVatBakeResults:(_engine,prepared)=>prepared.map(()=>({clips,texture:sharedBakes?sharedTexture:{destroy(){counts.unclaimed++;}}})),
    attachVat:(_engine,mesh,bake)=>{
      if(attached++===failAttach)throw Error('Attachment failed');
      mesh.skeleton=null;mesh.vat={texture:bake.texture};mesh.clock=0;
      return {clips,update(dt){assert.equal(mesh.disposed,false);mesh.clock+=dt;},setInstances(params){mesh.params=params;}};
    },
    setThinInstances:(mesh,matrices,count)=>{mesh.thinInstances={matrices,count};mesh._runtimeThinBuild=()=>{throw Error('Unclaimed redundant native thin build');};},
    setMeshVisible:(mesh,value)=>{mesh.visible=value;},
    addToScene:(target,container)=>{
      assert.equal(container.animationGroups.length,0);
      assert(container.meshes.every(mesh=>!mesh.visible));
      target._materialSwapQueue.push(...container.meshes);
      if(partialAdd){target.meshes.push(container.meshes[0]);throw Error('Partial add');}
      target.meshes.push(...container.meshes);
    },
    rebuildScenePbrPipelines:async(target,force)=>{
      assert.equal(force,true);
      assert(!target._materialSwapQueue.some(mesh=>containers.some(c=>c.meshes.includes(mesh))));
      counts.rebuilds++;if(deferRebuild)await rebuild.promise;
    },
    removeFromScene:(target,container)=>{
      counts.removes++;
      for(const mesh of container.meshes)if(target.meshes.includes(mesh)){mesh.disposed=true;counts.disposed++;}
      target.meshes=target.meshes.filter(mesh=>!container.meshes.includes(mesh));
    },
    disposeMeshGpu:mesh=>{if(!mesh.disposed){mesh.disposed=true;counts.disposed++;}},
    onBeforeRender:(target,callback)=>target.callbacks.push(callback),
    onSceneDispose:(target,callback)=>target.disposals.push(callback),
  };
  globalThis.fetch=async(url,{signal}={})=>{
    counts.fetches++;signal?.throwIfAborted();
    return {ok:true,json:async()=>manifest,arrayBuffer:async()=>new ArrayBuffer(8)};
  };
  const game={scene,engine:{},world:{groundHeight:()=>0}};
  return {game,scene,counts,containers,rebuild,load,frame(ms){
    // A native drain reads hidden meshes too. This catches an owned queued
    // thin rebuild surviving into either the first yield or the reveal frame.
    for(const mesh of scene._materialSwapQueue)mesh._runtimeThinBuild?.();
    for(const callback of scene.callbacks)callback(ms);
  },get loaded(){return loaded;}};
}

test('one actor remains hidden until native rebuild settles, then all selected primitives animate',async()=>{
  const f=fixture({deferRebuild:true});
  const pending=mountTownCrowd(f.game);
  await until(()=>f.counts.rebuilds,pending);
  f.frame(100);assert(f.loaded.meshes.every(mesh=>!mesh.visible));
  assert.equal(f.scene.callbacks.length,0);
  f.rebuild.resolve();const cohort=await pending;
  assert.equal(cohort.count,1);assert.equal(cohort.submittedPieces,6);
  assert.equal(f.scene.callbacks.length,1);
  assert.equal(f.loaded.animationGroups.length,2);
  f.frame(100);
  for(const mesh of f.loaded.meshes.filter(mesh=>mesh.vat)){
    assert.equal(mesh.visible,true);assert.equal(mesh.receiveShadows,true);assert.equal(mesh.clock,.1);
    assert(Math.abs(mesh.params[2]-actorPhaseSeconds('town-0000')*30)<.00001);
  }
  const unselected=f.loaded.meshes.find(mesh=>mesh.name==='Unselected');
  assert.equal(unselected.visible,false);assert.equal(unselected.vat,undefined);
  cohort.dispose();cohort.dispose();f.frame(100);
  assert.equal(f.counts.removes,1);assert.equal(f.scene.meshes.length,0);
});
test('repeated mounts share one callback and retire only their own clocks',async()=>{
  const f=fixture(),a=await mountTownCrowd(f.game),b=await mountTownCrowd(f.game,{count:10});
  assert.equal(f.scene.callbacks.length,1);
  f.frame(200);a.dispose();f.frame(300);
  assert.equal(a.container.meshes[0].clock,.2);assert.equal(b.container.meshes[0].clock,.5);
  assert.equal(f.scene.meshes.length,b.container.meshes.length);
  b.dispose();f.frame(100);
});
test('cancel during native rebuild keeps resources alive until completion and never reveals',async()=>{
  const f=fixture({deferRebuild:true}),controller=new AbortController();
  const pending=mountTownCrowd(f.game,{signal:controller.signal});
  await until(()=>f.counts.rebuilds,pending);
  controller.abort();assert.equal(f.counts.disposed,0);
  assert(f.loaded.meshes.every(mesh=>!mesh.visible));
  f.rebuild.resolve();await assert.rejects(pending,{name:'AbortError'});
  assert.equal(f.counts.disposed,f.loaded.meshes.length);assert.equal(f.scene.meshes.length,0);
  assert.equal(f.scene.callbacks.length,0);
});
test('cancel during load retires late container before any VAT allocation or scene registration',async()=>{
  const f=fixture({deferLoad:true}),controller=new AbortController();
  const pending=mountTownCrowd(f.game,{signal:controller.signal});
  await until(()=>f.counts.loads,pending);
  controller.abort();f.load.resolve();await assert.rejects(pending,{name:'AbortError'});
  assert.equal(f.counts.disposed,f.loaded.meshes.length);assert.equal(f.counts.rebuilds,0);
  assert.equal(f.counts.removes,0);assert(f.loaded.meshes.every(mesh=>!mesh.vat));
});
test('rebuild failure and partial scene insertion clean up every owned mesh',async()=>{
  const f=fixture({deferRebuild:true});const pending=mountTownCrowd(f.game);
  await until(()=>f.counts.rebuilds,pending);
  f.rebuild.reject(Error('Native rebuild failed'));await assert.rejects(pending,/Native rebuild failed/);
  assert.equal(f.counts.disposed,f.loaded.meshes.length);assert.equal(f.scene.meshes.length,0);
  const partial=fixture({partialAdd:true});await assert.rejects(mountTownCrowd(partial.game),/Partial add/);
  assert.equal(partial.counts.disposed,partial.loaded.meshes.length);assert.equal(partial.scene.meshes.length,0);
});
test('attachment failure releases unclaimed baked textures and owned meshes',async()=>{
  const f=fixture({failAttach:2});await assert.rejects(mountTownCrowd(f.game),/Attachment failed/);
  assert.equal(f.counts.unclaimed,4);assert.equal(f.counts.disposed,f.loaded.meshes.length);
  assert.equal(f.counts.rebuilds,0);
});
test('partial attachment never destroys a sibling bake texture already claimed by a mesh',async()=>{
  const f=fixture({failAttach:2,sharedBakes:true});await assert.rejects(mountTownCrowd(f.game),/Attachment failed/);
  assert.equal(f.counts.unclaimed,0);assert.equal(f.counts.disposed,f.loaded.meshes.length);
  const none=fixture({failAttach:0,sharedBakes:true});await assert.rejects(mountTownCrowd(none.game),/Attachment failed/);
  assert.equal(none.counts.unclaimed,1);
});
test('batch claim preserves unrelated queued native material changes',async()=>{
  const f=fixture({deferRebuild:true});let drained=0;
  const other={_runtimeThinBuild:()=>{drained++;}};f.scene._materialSwapQueue.push(other);
  const pending=mountTownCrowd(f.game);await until(()=>f.counts.rebuilds,pending);
  assert.deepEqual(f.scene._materialSwapQueue,[other]);f.frame(16);assert.equal(drained,1);
  f.rebuild.resolve();const cohort=await pending;
  assert(cohort.container.meshes.filter(m=>m.vat).every(m=>!m._runtimeThinBuild));cohort.dispose();
});
test('scene lifetime cancels pending load and stops installed playback',async()=>{
  const f=fixture(),cohort=await mountTownCrowd(f.game);
  f.frame(100);for(const dispose of f.scene.disposals)dispose();f.frame(100);
  assert.equal(cohort.container.meshes[0].clock,.1);assert.equal(f.scene.meshes.length,0);
  await assert.rejects(mountTownCrowd(f.game));
});
test('invalid motion, placement or pre-aborted request performs no fetch or native allocation',async()=>{
  const f=fixture();
  await assert.rejects(mountTownCrowd(f.game,{motion:'run'}),/walk or idle/);
  await assert.rejects(mountTownCrowd(f.game,{centerZ:NaN}),/finite/);
  const controller=new AbortController();controller.abort();
  await assert.rejects(mountTownCrowd(f.game,{signal:controller.signal}),{name:'AbortError'});
  assert.equal(f.counts.fetches,0);assert.equal(f.counts.loads,0);
});
