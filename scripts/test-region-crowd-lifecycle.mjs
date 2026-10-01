import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import {registerHooks} from 'node:module';import {createHash} from 'node:crypto';
import {appearanceFromEquipment} from '../src/character/appearance/from-equipment.js';import {encodeAppearance} from '../src/character/appearance/codec.js';import {EQUIPMENT_PRESETS} from '../src/ashen-reach/equipment-catalog.js';
import {createRegionActor,setActorTransform,replaceActorAppearance} from '../src/character/region-crowd/actor-state.js';
const names=['addToScene','attachVat','createVatBakeResults','disposeMeshGpu','invalidateRenderBundles','enableThinInstanceWorldBounds','getContainerMeshes','goToFrame','loadGltf','onBeforeRender','onSceneDispose','rebuildScenePbrPipelines','removeFromScene','removeThinInstance','setMeshVisible','setMorphTargetWeights','setThinInstanceCount','setThinInstanceMatrix','setThinInstances','setVatTime','getViewMatrix','getViewProjectionMatrix','projectWorldToScreen','prepareVatMany'];
const mock=`data:text/javascript,${encodeURIComponent(`export const VERSION='1.31.1';\n`+names.map(n=>`export const ${n}=(...a)=>globalThis.__regionLite.${n}(...a);`).join('\n'))}`;
registerHooks({resolve(specifier,context,next){if(specifier==='@babylonjs/lite')return {url:mock,shortCircuit:true};if(specifier.endsWith('linear-materials.js'))return {url:'data:text/javascript,export const prepareLinearMaterial=()=>{}',shortCircuit:true};return next(specifier,context);}});
const {createRegionCrowd}=await import('../src/character/region-crowd/renderer.js');
const recipe=appearanceFromEquipment({race:'human',loadout:EQUIPMENT_PRESETS.wayfarer.loadout});
const actor=(id='actor')=>createRegionActor({id,recipe,transform:{x:0,y:0,z:65,yaw:0},motion:{clip:'Walk_Loop',loop:true,startedAt:0,offsetSeconds:0}});
function deferred(){let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};}
async function until(fn){for(let i=0;i<100;i++){if(fn())return;await new Promise(r=>setImmediate(r));}throw Error('Expected native boundary');}
function fixture(){
 const scene={meshes:[],callbacks:[],_materialSwapQueue:[]},counts={loads:0,retired:0,rebuilds:0},gate=deferred();let defer=false,deferLoad=false,entered=false;
 const bytes=new Uint8Array(8),hash=createHash('sha256').update(bytes).digest('hex'),data=new Float32Array(2*65*16),payloadHash=createHash('sha256').update(new Uint8Array(data.buffer)).digest('hex');
 const meshes=['HumanV1Body','WayfarerTunic','WayfarerTrousers','WayfarerBoots','ProbeIronSword','ProbeIronSword'];
 const clips={Walk_Loop:{fromRow:0,frameCount:2,fps:60,duration:1/60}};
 const manifest={sourceSha256:hash,variants:{wayfarer:{file:'human-wayfarer.glb',sha256:hash,recipe:encodeAppearance(recipe),assetSha256:Object.fromEntries(Object.values(recipe.equipment).filter(Boolean).map(id=>[id,hash])),meshes}}};
 const prepared={schema:1,lite:'1.31.1',recipeVersion:2,manifest,variants:{wayfarer:{sha256:hash,clips,bounds:meshes.map(name=>({name,minimum:[-1,-1,-1],maximum:[1,2,1]})),payloads:meshes.map(()=>({file:'vat.bin',sha256:payloadHash,boneCount:65,frameCount:2,clips}))}}};
 globalThis.fetch=async(url,{signal}={})=>{signal?.throwIfAborted();return {ok:true,arrayBuffer:async()=>url.endsWith('prepared.json')?new TextEncoder().encode(JSON.stringify(prepared)).buffer:url.endsWith('vat.bin')?data.buffer:bytes.buffer};};
 globalThis.__regionLite={
  loadGltf:async()=>{counts.loads++;if(deferLoad){entered=true;await gate.promise;}const m=meshes.map(name=>({name,skeleton:{boneCount:65},material:{},visible:true}));const vector=()=>({set(x,y,z,w){Object.assign(this,{x,y,z,w});}});const root={position:vector(),scaling:vector(),rotationQuaternion:vector()};return {entities:[root],meshes:m,animationGroups:[{name:'Walk_Loop'}]};},
  getContainerMeshes:c=>c.meshes,
  createVatBakeResults:(_e,values)=>values.map(()=>({texture:{destroy(){}},clips})),
  attachVat:(_e,m,b)=>{m.skeleton=null;m.vat={texture:b.texture};return {setInstances(p){m.params=new Float32Array(p);}};},
  setThinInstances:(m,matrices,count)=>{m.thinInstances={matrices,count,_capacity:count};m._runtimeThinBuild=()=>{};},
  invalidateRenderBundles(){},enableThinInstanceWorldBounds(){},setVatTime(){},setMorphTargetWeights(){},
  setThinInstanceCount:(m,count)=>m.thinInstances.count=count,
  setThinInstanceMatrix:(m,i,matrix)=>m.thinInstances.matrices.set(matrix,i*16),
  removeThinInstance:(m,i)=>{const t=m.thinInstances,last=--t.count;if(i!==last)t.matrices.copyWithin(i*16,last*16,last*16+16);},
  goToFrame:(g,frame)=>g.currentTime=frame/60,
  setMeshVisible:(m,v)=>m.visible=v,
  addToScene:(s,c)=>{assert(c.meshes.every(m=>!m.visible));assert.equal(c.animationGroups.length,0);s.meshes.push(...c.meshes);s._materialSwapQueue.push(...c.meshes);},
  rebuildScenePbrPipelines:async(s,force)=>{assert(force);assert.equal(s._materialSwapQueue.length,0);counts.rebuilds++;if(defer){entered=true;await gate.promise;}},
  removeFromScene:(s,c)=>{for(const m of c.meshes)if(s.meshes.includes(m)){counts.retired++;m.disposed=true;}s.meshes=s.meshes.filter(m=>!c.meshes.includes(m));},
  disposeMeshGpu:m=>{if(!m.disposed){m.disposed=true;counts.retired++;}},
  onBeforeRender:(s,fn)=>s.callbacks.push(fn),onSceneDispose(){},
 };
 return {game:{scene,engine:{},world:{groundHeight:()=>0}},scene,counts,gate,pause(){defer=true;},pauseLoad(){deferLoad=true;},get entered(){return entered;}};
}
test('manager teardown hides synchronously and retains owners until a native build settles',async()=>{
 const f=fixture(),crowd=await createRegionCrowd(f.game,{clock:()=>.1});await crowd.set(actor());f.pause();const p=crowd.set(actor(),'exact');await until(()=>f.entered);
 const retirement=crowd.dispose();assert(f.scene.meshes.every(m=>!m.visible));assert.equal(f.counts.retired,0);f.gate.resolve();await retirement;assert.equal((await p).status,'superseded');assert.equal(f.scene.meshes.length,0);assert.equal(f.counts.retired,12);await crowd.dispose();assert.equal(f.counts.retired,12);
});
test('transform updates coalesce into a pending promotion and retain its tier',async()=>{
 const f=fixture(),crowd=await createRegionCrowd(f.game,{clock:()=>.1});await crowd.set(actor());f.pause();const p=crowd.set(actor(),'exact');await until(()=>f.entered);
 const moved=setActorTransform(actor(),{x:3,y:0,z:68,yaw:.8}),update=crowd.set(moved);assert.equal(crowd.get('actor').transform.x,3);f.gate.resolve();assert.equal((await p).tier,'exact');assert.equal((await update).tier,'exact');assert.equal(f.counts.loads,2);
 const entry=crowd.resources().actors.get('actor');assert.equal(entry.exact.root.position.x,3);assert.equal(entry.exact.root.scaling.x,-1);assert(entry.exact.meshes.every(m=>!m.thinInstances));assert.equal(crowd.get('actor').transform.z,68);await crowd.set(setActorTransform(moved,{x:4,y:0,z:68,yaw:1}));assert.equal(f.counts.loads,2);assert.equal(crowd.snapshot().actors[0].tier,'exact');await crowd.dispose();
});
test('pending removal reports cancellation and never commits a late actor',async()=>{
 const f=fixture(),crowd=await createRegionCrowd(f.game,{clock:()=>.1});const p=crowd.set(actor());assert.equal(crowd.remove('actor'),true);assert.equal((await p).status,'superseded');assert.equal(crowd.get('actor'),undefined);assert.equal(crowd.remove('absent'),false);await crowd.dispose();
});
test('capacity is rechecked for queued arrivals and middle removal preserves survivor IDs',async()=>{
 const f=fixture(),crowd=await createRegionCrowd(f.game,{clock:()=>.1,capacity:2});const rows=await Promise.allSettled([crowd.set(actor('a')),crowd.set(actor('b')),crowd.set(actor('c'))]);assert.equal(rows[2].status,'rejected');assert.equal(crowd.snapshot().count,2);crowd.remove('a');assert(crowd.snapshot().batches.every(b=>b.ids.length===1&&b.ids[0]==='b'&&b.slots[0][1]===0));await crowd.dispose();
});
test('appearance cannot change without revision and pending stale requests fail',async()=>{
 const f=fixture(),crowd=await createRegionCrowd(f.game,{clock:()=>.1});await crowd.set(actor());f.pause();const next=replaceActorAppearance(actor(),{...recipe,shape:{...recipe.shape,build:.5}},3),p=crowd.set(next);await until(()=>f.entered);
 await assert.rejects(crowd.set(actor()),/Stale/);await assert.rejects(crowd.set({...next,recipe}),/new revision/);f.gate.resolve();assert.equal((await p).tier,'exact');assert.equal(crowd.get('actor').appearanceRevision,3);await crowd.dispose();
});

test('teardown drains a native decode that has not yet produced an owned resource',async()=>{
 const f=fixture(),crowd=await createRegionCrowd(f.game,{clock:()=>.1});await crowd.set(actor());f.pauseLoad();const pending=crowd.set(actor(),'exact');await until(()=>f.entered);
 let complete=false;const retirement=crowd.dispose().then(()=>complete=true);await new Promise(r=>setImmediate(r));assert.equal(complete,false);f.gate.resolve();await retirement;assert.equal((await pending).status,'superseded');assert.equal(f.scene.meshes.length,0);assert.equal(f.counts.retired,12);assert.equal(crowd.resources().owned.size,0);
});
