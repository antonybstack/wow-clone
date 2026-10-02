/** Focused native composition checks the lifecycle suite does not cover.
 *
 * check-remote-pieces.mjs proves transactions, the queue and retirement ordering. These are
 * the gaps its own result names: a held native decoder removed mid-flight, a race or shape
 * change staged while every exact seat is already committed, two owners sharing one scene
 * material build, and whether the composed actor is actually posed, bounded and socketed
 * rather than merely admitted.
 *
 * One owned context, no recording, no FPS claim. Lite nodes are read through the same
 * optimized module graph the game loads; a second raw import would build a second registry
 * and report false structure.
 * https://github.com/BabylonJS/Babylon-Lite/blob/npm-lite-v1.31.1/packages/babylon-lite/src/scene/scene.ts
 */
import fs from 'node:fs/promises';import path from 'node:path';import assert from 'node:assert/strict';import {chromium} from 'playwright';
import {browserOwnership} from '../lib/browser-ownership.mjs';
const port=process.env.ASHEN_CDP_PORT,url=process.env.ASHEN_TEST_URL,dir=process.env.ASHEN_CAPTURE_DIR||'ve-capture/character-mmo/remote-pieces-composition-2026-10-01';assert(port&&url);
await fs.mkdir(dir,{recursive:true});
const browser=await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
assert(browser.contexts().flatMap(c=>c.pages()).every(p=>p.url()==='about:blank'),'Another page is already open in this browser');
const context=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1}),page=await context.newPage();
const ownership=await browserOwnership(browser,{cdpPort:port,url,purpose:'Native composition: held decoder removal, full-seat restage, shared build, pose/bounds/sockets; no FPS claim',renderingClients:1});
const report={url,conditions:ownership.purpose,errors:[],rows:[]};
await fs.writeFile(path.join(dir,'ownership.json'),JSON.stringify(ownership,null,2));
page.on('pageerror',e=>report.errors.push(e.stack));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
const row=async(label,fn,arg)=>{const value=await page.evaluate(fn,arg);report.rows.push({case:label,...value});await fs.writeFile(path.join(dir,'progress.json'),JSON.stringify(report,null,2));return value;};
/** Hold one immutable source until released; the route is removed by the caller. */
const hold=async glob=>{let seen,release;const held=new Promise(r=>seen=r),gate=new Promise(r=>release=r);
 await page.route(glob,async route=>{seen();await gate;await route.continue().catch(()=>{});});
 return {held,release:async()=>{release();await page.unroute(glob);}};};
try{
 await page.goto(url);await page.waitForFunction(()=>globalThis.ASHEN?.ready&&ASHEN.hostilesReady&&ASHEN.getAppearance,null,{timeout:120000});
 await page.evaluate(async()=>{
  const {createRemotePieceActors}=await import('/src/character/remote-pieces/renderer.js');
  globalThis.makeRemote=()=>createRemotePieceActors(ASHEN,{clock:()=>globalThis.fixtureTime??performance.now()/1000});
  globalThis.REMOTE=await makeRemote();globalThis.baseRecipe=structuredClone(ASHEN.getAppearance());
  globalThis.actorInput=(id,race='human',preset='duskguard',revision=1,shape)=>{
   const recipe=structuredClone(baseRecipe);recipe.race=race;
   recipe.fitFamily=race==='human'?baseRecipe.fitFamily:{orc:'ashen-orc',undead:'ashen-undead'}[race];
   recipe.shape=race==='human'?{...baseRecipe.shape,...(shape||{build:.95,height:1.15})}:{};
   recipe.equipment={helmet:null,torso:null,legs:null,boots:null,gloves:null,mainHand:null,offHand:null,shoulders:null,...ASHEN.equipment.presets[preset].loadout};
   return {id,recipe,appearanceRevision:revision,transform:{x:2,y:ASHEN.world.groundHeight(2,-60),z:-60,yaw:Math.PI},motion:{clip:'Walk_Loop',loop:true,startedAt:0,offsetSeconds:0}};
  };
  // Lite hands back an array-*like* world matrix: length 16, indexable, but not an Array
  // and with no .m/.asArray. A first version of this check tested only those shapes, read
  // null, and then passed its own socket assertions vacuously. Translation is columns
  // 12..14 of the column-major matrix.
  // https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#transformations
  globalThis.translationOf=node=>{const w=node?.worldMatrix;
   if(w&&typeof w.length==='number'&&w.length>=15)return {x:w[12],y:w[13],z:w[14]};
   const a=w&&(w.m||w._m||(typeof w.asArray==='function'?Array.from(w.asArray()):null));
   return a&&a.length>=15?{x:a[12],y:a[13],z:a[14]}:null;};
  globalThis.localOf=node=>{const p=node?.position;return p?{x:p._x??p.x,y:p._y??p.y,z:p._z??p.z}:null;};
  globalThis.remoteNodes=()=>ASHEN.scene.transformNodes?.filter(n=>String(n.name||'').startsWith('RemoteActor:'))??[];
  ASHEN.dev.god=true;ASHEN.player.setWorldPos(2,ASHEN.world.groundHeight(2,-64)+1.7,-64);ASHEN.rig.yaw=0;ASHEN.rig.pitch=-.08;ASHEN.rig.distance=ASHEN.rig.distanceTarget=3.2;ASHEN.setView('play');
 });
 report.baseline=await page.evaluate(()=>({meshes:ASHEN.scene.meshes.length,casters:ASHEN.shadows.state.dynamicCasters,remoteNodes:remoteNodes().length}));
 assert.equal(report.baseline.remoteNodes,0);
 const prepared=await page.evaluate(()=>REMOTE.resources().prepared);
 const orcBody=prepared.manifest.races.orc.manifest.items.body.file,humanBody=prepared.manifest.races.human.manifest.items.body.file;

 // 1. Removing an actor whose native source is still in flight.
 //
 //    retire() aborts the owner's controller before awaiting its preparation, so an
 //    abortable fetch is *cancelled* rather than waited out -- the preparation fence
 //    exists for work that cannot be interrupted, such as a decoder already inside
 //    Lite, and for an equipment boot that has not returned. The property worth
 //    asserting here is therefore not "remove blocks" but "abandoning mid-fetch leaks
 //    nothing": the lease, the reservation and the scene must all come back while the
 //    source is still held, and releasing it afterwards must not resurrect anything.
 {
  const gate=await hold(`**/__remote_pieces__/${orcBody}`);
  await page.evaluate(()=>{globalThis.heldPending=REMOTE.upsert(actorInput('held','orc')).catch(e=>({error:e.message}));});
  await gate.held;
  await row('remove-during-held-native-source-leaks-nothing',async()=>{
   const during=REMOTE.streaming();if(during.owned!==1)throw Error('No staging owner while the source is held');
   if(!during.immutable.leases)throw Error('No immutable lease while the source is held');
   const removed=await REMOTE.remove('held');const pending=await heldPending;
   return {during,removed,pending,whileStillHeld:REMOTE.streaming(),meshes:ASHEN.scene.meshes.length,remoteNodes:remoteNodes().length};
  });
  {
   const r=report.rows.at(-1);
   assert.equal(r.whileStillHeld.owned,0,'Owner survived removal during a held source');
   assert.equal(r.whileStillHeld.immutable.leases,0,'Lease leaked when the fetch was abandoned');
   assert.equal(r.whileStillHeld.immutable.reservedBytes,0,'Byte reservation leaked when the fetch was abandoned');
   assert.equal(r.meshes,report.baseline.meshes);assert.equal(r.remoteNodes,0);
  }
  await gate.release();
  await row('released-source-does-not-resurrect-the-removed-actor',async()=>{
   await new Promise(r=>setTimeout(r,600));
   return {after:REMOTE.streaming(),meshes:ASHEN.scene.meshes.length,remoteNodes:remoteNodes().length,actor:REMOTE.get('held')??null};
  });
  {
   const r=report.rows.at(-1);
   assert.equal(r.after.owned,0);assert.equal(r.meshes,report.baseline.meshes);
   assert.equal(r.remoteNodes,0);assert.equal(r.actor,null,'A removed actor came back when its source arrived');
  }
 }

 // 2. Eight committed seats plus one hidden stage.
 //
 //    The stage is held at the installed native material-build boundary rather than by
 //    stalling the network: the immutable cache serves an already-fetched body without a
 //    request, so a route hold never fires for a race another seat already uses, and never
 //    for a shape change, which re-reads the same body URL. The build fence is
 //    deterministic for both. It is a harness-only wrapper around an existing wait; product
 //    code gains no test hook.
 for(const [label,build] of [['race',`a=>actorInput(a,'orc','lector',2)`],['shape',`a=>actorInput(a,'human','lector',2,{build:-0.95,height:0.9})`]]){
  await page.evaluate(async()=>{
   for(let i=0;i<8;i++){const a=actorInput(`seat-${i}`,['human','orc','undead'][i%3]);a.transform.x=2+(i%4)*2;a.transform.z=-60+Math.floor(i/4)*3;a.transform.y=ASHEN.world.groundHeight(a.transform.x,a.transform.z);await REMOTE.upsert(a);}
  });
  assert.equal((await page.evaluate(()=>REMOTE.snapshot().count)),8,'Eight seats were not committed');
  await page.evaluate(mutator=>{
   const hooks=ASHEN.scene._runtimeBuilds,original=hooks.wait;if(!original)throw Error('Reviewed native material fence absent');
   globalThis.materialHeld=false;
   const gate=new Promise(resolve=>{globalThis.releaseNativeBuild=()=>{hooks.wait=original;resolve();};});let once=true;
   hooks.wait=async(...args)=>{await original.apply(hooks,args);if(once&&REMOTE.resources().builds.size){once=false;globalThis.materialHeld=true;await gate;}};
   globalThis.restage=REMOTE.upsert(eval(mutator)('seat-0')).catch(e=>({error:e.message}));
  },build);
  await page.waitForFunction(()=>globalThis.materialHeld,null,{polling:'raf',timeout:60000});
  // Observe only. Submitting another actor here would itself be admitted and staged,
  // leaving a tenth owner behind -- the ninth-owner rejection is already covered by
  // check-remote-pieces.mjs, and re-probing it from inside a held fence only
  // contaminates this measurement.
  await row(`eight-live-plus-one-stage-${label}-change`,()=>({
   during:REMOTE.streaming(),committed:REMOTE.snapshot().count,
   staged:[...REMOTE.resources().owned].filter(r=>!r.disposed).length,
  }));
  {
   const seen=report.rows.at(-1);
   assert.equal(seen.during.owned,9,'Expected eight committed owners plus one stage');
   assert.equal(seen.during.limits.exact,8,'Exact capacity is not the documented eight');
   assert.equal(seen.committed,8,'A seat was dropped while the replacement was staging');
  }
  await page.evaluate(()=>releaseNativeBuild());
  await row(`eight-live-plus-one-stage-${label}-commits-atomically`,async()=>{
   const result=await restage;await new Promise(r=>setTimeout(r,400));
   return {result,actor:REMOTE.get('seat-0'),after:REMOTE.streaming(),snapshot:REMOTE.snapshot()};
  });
  {
   const done=report.rows.at(-1);
   assert.equal(done.result.status,'applied');
   assert.equal(done.after.owned,8,'The replaced body was not retired after the swap');
   assert.equal(done.snapshot.count,8);
   if(label==='race')assert.equal(done.actor.recipe.race,'orc');
   else assert.equal(done.actor.recipe.shape.height,0.9);
  }
  await page.evaluate(async()=>{for(let i=0;i<8;i++)await REMOTE.remove(`seat-${i}`);});
  const cleared=await page.evaluate(()=>({after:REMOTE.streaming(),meshes:ASHEN.scene.meshes.length,remoteNodes:remoteNodes().length}));
  assert.equal(cleared.after.owned,0,'Seats survived removal');
  assert.equal(cleared.meshes,report.baseline.meshes);assert.equal(cleared.remoteNodes,0);
 }

 // 3. Two owners share one scene material build. Removing one must not retire a
 //    palette the other is still borrowing, nor leave the survivor unbuilt.
 await row('shared-material-build-two-owners',async()=>{
  const a=actorInput('share-a','human','duskguard'),b=actorInput('share-b','human','lector');
  b.transform={...b.transform,x:5};const both=await Promise.allSettled([REMOTE.upsert(a),REMOTE.upsert(b)]);
  await REMOTE.remove('share-a');
  const survivor=REMOTE.get('share-b'),meshes=[...REMOTE.resources().owned].flatMap(r=>r.meshes||[]);
  return {both:both.map(r=>r.status),survivor:Boolean(survivor),owned:REMOTE.streaming().owned,survivorMeshes:meshes.length,gpuErrors:ASHEN.gpu.errors.slice()};
 });
 assert.equal(report.rows.at(-1).owned,1);assert.ok(report.rows.at(-1).survivor);assert.ok(report.rows.at(-1).survivorMeshes>0,'Survivor lost its meshes');
 assert.deepEqual(report.rows.at(-1).gpuErrors,[]);
 await page.evaluate(()=>REMOTE.remove('share-b'));

 // 4. Composed pose, written bounds and evaluated sockets on a real actor.
 for(const race of ['human','orc']){
  await row(`composed-pose-bounds-sockets-${race}`,async race=>{
   const input=actorInput('compose',race,'duskguard');input.motion={clip:'Idle_Loop',loop:true,startedAt:0,offsetSeconds:0};
   await REMOTE.upsert(input);
   const resource=[...REMOTE.resources().owned][0];
   const bounded=resource.meshes.map(m=>({name:m.name,min:m.boundMin,max:m.boundMax}));
   const bad=bounded.filter(b=>!b.min||!b.max||[...b.min,...b.max].some(v=>!Number.isFinite(v)));
   // Every socket node hangs off this actor's own origin, never the local player's.
   const sockets=Object.entries(resource.sockets?.sockets||{}).map(([slot,s])=>({slot,parentIsOrigin:s.node?.parent===resource.origin,translation:translationOf(s.node),local:localOf(s.node)}));
   const hand=sockets.find(s=>s.slot==='mainHand');
   const weapon=resource.meshes.find(m=>/sword|staff|book|greatstaff/i.test(m.name||''));
   const gap=hand?.translation&&weapon?Math.hypot(...['x','y','z'].map(k=>(translationOf(weapon)?.[k]??1e3)-hand.translation[k])):null;
   // Cast endpoints: the composed overlay returns to idle, which is the deliberate
   // player composition, so the check is that the pose settles and stays attached --
   // not that it equals a raw clip frame.
   REMOTE.setMotion('compose',{clip:'PyreBurst_Upper',loop:false,startedAt:performance.now()/1000,offsetSeconds:0});
   await new Promise(r=>setTimeout(r,1400));
   const endpoint={poseId:resource.poseId,sample:resource.sample,handStill:translationOf(hand?.node??null)};
   return {race,meshCount:bounded.length,unboundedMeshes:bad,sockets,handGapMetres:gap,endpoint,
    originParented:resource.origin?.parent??null,visualParentIsOrigin:resource.visual?.root?.parent===resource.origin};
  },race);
  const c=report.rows.at(-1);
  assert.ok(c.meshCount>0,'Composed actor has no meshes');
  assert.deepEqual(c.unboundedMeshes,[],'Meshes without finite written bounds');
  assert.ok(c.sockets.length>0,'No sockets attached');
  assert.ok(c.sockets.every(s=>s.parentIsOrigin),'A socket is not parented to this actor origin');
  assert.ok(c.visualParentIsOrigin,'Body visual is not parented to this actor origin');
  assert.ok(c.sockets.every(s=>s.translation&&s.local),'A socket has no readable evaluated transform');
  assert.ok(Number.isFinite(c.handGapMetres),'Weapon-to-hand distance was not measured');
  assert.ok(c.handGapMetres<0.75,`Weapon is ${c.handGapMetres} m from the hand socket`);
  assert.ok(c.endpoint.poseId,'Cast endpoint lost its pose');
  await page.evaluate(()=>REMOTE.remove('compose'));
 }
 const human=report.rows.find(r=>r.case==='composed-pose-bounds-sockets-human');
 const orc=report.rows.find(r=>r.case==='composed-pose-bounds-sockets-orc');
 const handOf=r=>r?.sockets.find(s=>s.slot==='mainHand');
 report.gripComparison={human:handOf(human)?.local,orc:handOf(orc)?.local,
  // The Orc mounts on its own palette with a 1.25 palm push, so the evaluated grip must
  // not be identical to the Human's. Equality here would mean the race policy never ran.
  differs:JSON.stringify(handOf(human)?.local)!==JSON.stringify(handOf(orc)?.local)};
 assert.ok(report.gripComparison.differs,'Orc and Human main-hand grips evaluated identically');

 report.after=await page.evaluate(()=>({meshes:ASHEN.scene.meshes.length,casters:ASHEN.shadows.state.dynamicCasters,streaming:REMOTE.streaming(),remoteNodes:remoteNodes().length,gpuErrors:ASHEN.gpu.errors.slice()}));
 assert.equal(report.after.meshes,report.baseline.meshes);assert.equal(report.after.casters,report.baseline.casters);
 assert.equal(report.after.streaming.owned,0);assert.equal(report.after.streaming.immutable.leases,0);assert.equal(report.after.streaming.immutable.reservedBytes,0);
 assert.equal(report.after.remoteNodes,0,'A RemoteActor origin survived removal');
 assert.deepEqual(report.after.gpuErrors,[]);assert.deepEqual(report.errors,[]);report.passed=true;
}catch(error){report.failure=error.stack;process.exitCode=1;await page.screenshot({path:path.join(dir,'failure.png')}).catch(()=>{});console.error(error);}
finally{
 await page.evaluate(()=>globalThis.REMOTE?.dispose()).catch(()=>{});
 await fs.writeFile(path.join(dir,'report.json'),JSON.stringify(report,null,2)+'\n');
 await context.close();await browser.close();
 await fs.writeFile(path.join(dir,'ownership.json'),JSON.stringify({...ownership,active:false,renderingClients:0},null,2));
 console.log(JSON.stringify({passed:report.passed,failure:report.failure?.split('\n')[0],errors:report.errors.slice(0,3),after:report.after,grip:report.gripComparison},null,1));
}
