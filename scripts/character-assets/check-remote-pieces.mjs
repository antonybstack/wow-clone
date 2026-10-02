/** Actual-game native piece transactions and motion. One owned context; recording
 * is explicitly separate from performance. CDP timestamps own encoded duration.
 */
import fs from 'node:fs/promises';import path from 'node:path';import assert from 'node:assert/strict';import {chromium} from 'playwright';
import {browserOwnership} from '../lib/browser-ownership.mjs';
import {appendFrame,captureSurface,writeCaptureManifest} from '../lib/capture-manifest.mjs';
const port=process.env.ASHEN_CDP_PORT,url=process.env.ASHEN_TEST_URL,dir=process.env.ASHEN_CAPTURE_DIR||'ve-capture/character-mmo/remote-pieces-2026-10-01';assert(port&&url);
const record=process.env.ASHEN_RECORD==='1';await fs.mkdir(path.join(dir,'frames'),{recursive:true});
const browser=await chromium.connectOverCDP(`http://127.0.0.1:${port}`);assert(browser.contexts().flatMap(c=>c.pages()).every(p=>p.url()==='about:blank'));
const context=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1}),page=await context.newPage();
const ownership=await browserOwnership(browser,{cdpPort:port,url,purpose:record?'Three-race native piece motion; no FPS claim':'Native piece failure/queue/resource acceptance; no FPS claim',renderingClients:1});
const report={url,conditions:ownership.purpose,errors:[],rows:[],timeline:[]};await fs.writeFile(path.join(dir,'ownership.json'),JSON.stringify(ownership,null,2));
const writes=[];let manifest,cdp,recording=false;
page.on('pageerror',e=>report.errors.push(e.stack));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
const mark=label=>report.timeline.push({label,frame:manifest?.frames.length||0,time:Date.now()});
async function row(label,fn){mark(label);const value=await page.evaluate(fn);report.rows.push({case:label,...value});await fs.writeFile(path.join(dir,'progress.json'),JSON.stringify(report,null,2));return value;}
try{
 await page.goto(url);await page.waitForFunction(()=>globalThis.ASHEN?.ready&&ASHEN.hostilesReady&&ASHEN.getAppearance,null,{timeout:120000});
 await page.evaluate(async()=>{
  const {createRemotePieceActors}=await import('/src/character/remote-pieces/renderer.js');globalThis.makeRemote=()=>createRemotePieceActors(ASHEN,{clock:()=>globalThis.fixtureTime??performance.now()/1000});
  globalThis.REMOTE=await makeRemote();globalThis.baseRecipe=structuredClone(ASHEN.getAppearance());
  globalThis.actorInput=(id,race='human',preset='duskguard',revision=1,shape)=>{
   const recipe=structuredClone(baseRecipe);recipe.race=race;recipe.fitFamily={human:'ashen-human-v1',orc:'ashen-orc',undead:'ashen-undead'}[race];
   // Take the accepted recipe's actual Human family rather than invent a fit ID.
   if(race==='human')recipe.fitFamily=baseRecipe.fitFamily;
   recipe.shape=race==='human'?{...baseRecipe.shape,...(shape||{build:.95,height:1.15})}:{};
   recipe.equipment={helmet:null,torso:null,legs:null,boots:null,gloves:null,mainHand:null,offHand:null,shoulders:null,...ASHEN.equipment.presets[preset].loadout};
   return {id,recipe,appearanceRevision:revision,transform:{x:2,y:ASHEN.world.groundHeight(2,-60),z:-60,yaw:Math.PI},motion:{clip:'Walk_Loop',loop:true,startedAt:0,offsetSeconds:0}};
  };
  ASHEN.dev.god=true;ASHEN.player.setWorldPos(2,ASHEN.world.groundHeight(2,-64)+1.7,-64);ASHEN.rig.yaw=0;ASHEN.rig.pitch=-.08;ASHEN.rig.distance=ASHEN.rig.distanceTarget=2.5;ASHEN.setView('play');
 });
 report.baseline=await page.evaluate(()=>({meshes:ASHEN.scene.meshes.length,casters:ASHEN.shadows.state.dynamicCasters}));
 if(record){
  await page.evaluate(async()=>{
   // Existing gameplay camera, local foreground hidden only for remote fit review.
   const main=await (await fetch('/src/ashen-reach/main.js')).text(),url=main.match(/from ["']([^"']*babylonjs_lite[^"']*)["']/)?.[1];if(!url)throw Error('Missing native optimized Lite graph');const {setMeshVisible,getContainerMeshes}=await import(url);
   ASHEN.player.setWorldPos(2,ASHEN.world.groundHeight(2,-60)+1.7,-60);
   ASHEN.equipment.setVisible(false);for(const mesh of getContainerMeshes(ASHEN.body.container))setMeshVisible(mesh,false);
  });
  report.conditions+='; local foreground hidden for native remote fit review';
  manifest={...(await captureSurface(page)),frames:[],timeline:report.timeline};cdp=await context.newCDPSession(page);
  cdp.on('Page.screencastFrame',e=>{void cdp.send('Page.screencastFrameAck',{sessionId:e.sessionId}).catch(()=>{});if(!recording)return;try{const name=`frame-${String(manifest.frames.length).padStart(6,'0')}.jpg`,bytes=Buffer.from(e.data,'base64');appendFrame(manifest,{name,timestamp:e.metadata.timestamp,bytes});writes.push(fs.writeFile(path.join(dir,'frames',name),bytes));}catch(error){report.errors.push(error.stack);recording=false;}});
  recording=true;await cdp.send('Page.startScreencast',{format:'jpeg',quality:88,maxWidth:1280,maxHeight:720,everyNthFrame:5});
  // Inspect each native design on each race, source gait/jump/cast/carry and bare
  // underlayers. A second rear view exposes layer seams and evaluated sockets.
  for(const race of ['human','orc','undead'])for(const preset of ['wayfarer','graveweaver','pilgrim','lector','duskguard']){
   mark(`${race}/${preset}: native source motion`);
   const applied=await page.evaluate(async({race,preset})=>{
    globalThis.fixtureTime=undefined;globalThis.revision=(globalThis.revision||0)+1;
    const input=actorInput('showcase',race,preset,revision);input.motion.startedAt=performance.now()/1000;return REMOTE.upsert(input);
   },{race,preset});assert.equal(applied.status,'applied');
   for(const [clip,loop]of [['Idle_Loop',true],['Walk_Loop',true],['Sprint_Loop',true],['Jump_Start',false],['Jump_Loop',true],['Jump_Land',false],['FireBlast_Upper',false],['LavaBall_Upper',false],['PyreBurst_Upper',false]]){
    await page.evaluate(({clip,loop})=>REMOTE.setMotion('showcase',{clip,loop,startedAt:performance.now()/1000,offsetSeconds:0}),{clip,loop});await page.waitForTimeout(600);
   }
   await page.screenshot({path:path.join(dir,`${race}-${preset}-front.png`)});
   await page.evaluate(()=>{const actor=REMOTE.get('showcase');REMOTE.setTransform('showcase',{...actor.transform,yaw:0});REMOTE.setMotion('showcase',{clip:'Walk_Loop',loop:true,startedAt:performance.now()/1000,offsetSeconds:0});});await page.waitForTimeout(800);
   await page.screenshot({path:path.join(dir,`${race}-${preset}-rear.png`)});
   report.rows.push(await page.evaluate(()=>({case:'native-race-design-motion',actor:REMOTE.get('showcase'),snapshot:REMOTE.snapshot(),streaming:REMOTE.streaming(),gpuErrors:ASHEN.gpu.errors.slice()})));
  }
  await page.evaluate(()=>REMOTE.remove('showcase'));
 }else{
  await row('native-eight-owner-capacity',async()=>{
   for(let i=0;i<8;i++){const a=actorInput(`seat-${i}`,['human','orc','undead'][i%3]);a.transform.x=2+(i%4)*2;a.transform.z=-60+Math.floor(i/4)*3;a.transform.y=ASHEN.world.groundHeight(a.transform.x,a.transform.z);await REMOTE.upsert(a);}
   let ninth;try{await REMOTE.upsert(actorInput('ninth'));}catch(e){ninth=e.message;}
   if(!ninth?.includes('capacity'))throw Error('Ninth owner was admitted');return {snapshot:REMOTE.snapshot(),streaming:REMOTE.streaming(),ninth};
  });assert.equal(report.rows.at(-1).snapshot.count,8);
  await page.evaluate(async()=>{for(let i=0;i<8;i++)await REMOTE.remove(`seat-${i}`);});
  await row('ten-complete-lifecycles',async()=>{
   const samples=[];
   for(let cycle=0;cycle<10;cycle++){
    for(const race of ['human','orc','undead']){const a=actorInput(`cycle-${race}`,race,cycle%2?'lector':'duskguard');await REMOTE.upsert(a);}
    for(const race of ['human','orc','undead'])await REMOTE.remove(`cycle-${race}`);
    const s=REMOTE.streaming();if(s.owned||s.immutable.leases||s.immutable.reservedBytes||s.pendingBuilds)throw Error('Retired owner survives cycle');samples.push({cycle,meshes:ASHEN.scene.meshes.length,casters:ASHEN.shadows.state.dynamicCasters,streaming:s});
   }return {samples};
  });for(const sample of report.rows.at(-1).samples)assert.equal(sample.meshes,report.baseline.meshes);
  await row('deduplicated-pending-network-updates',async()=>{
   const input=actorInput('late');globalThis.pendingInput=input;globalThis.firstPending=REMOTE.upsert(input);return {input};
  });
  // Await this ordinary transaction before installing a held different-race body.
  await page.evaluate(()=>firstPending);
  const prepared=await page.evaluate(()=>REMOTE.resources().prepared),orcBody=prepared.manifest.races.orc.manifest.items.body.file;
  let heldResolve,releaseResolve;const held=new Promise(r=>heldResolve=r),release=new Promise(r=>releaseResolve=r);
  await page.route(`**/__remote_pieces__/${orcBody}`,async route=>{heldResolve();await release;await route.continue().catch(()=>{});});
  await page.evaluate(()=>{globalThis.pendingInput=actorInput('late','orc','duskguard',2);globalThis.firstPending=REMOTE.upsert(pendingInput);});await held;
  await row('held-body-keeps-old-native-transform-and-latest-clock',async()=>{
   globalThis.duplicates=[];for(let i=0;i<20;i++){const a={...pendingInput,transform:{...pendingInput.transform,x:4+i*.01},motion:{clip:'Sprint_Loop',loop:true,startedAt:0,offsetSeconds:.1}};duplicates.push(REMOTE.upsert(a));}
   REMOTE.setTransform('late',{x:5,y:ASHEN.world.groundHeight(5,-60),z:-60,yaw:Math.PI});return {oldActor:REMOTE.get('late'),snapshot:REMOTE.snapshot(),streaming:REMOTE.streaming()};
  });assert.equal(report.rows.at(-1).oldActor.recipe.race,'human');assert.equal(report.rows.at(-1).streaming.queue.submitted,report.rows.at(-1).streaming.queue.completed+1);
  releaseResolve();await page.unroute(`**/__remote_pieces__/${orcBody}`);
  await row('held-body-single-publication',async()=>{const values=await Promise.all([firstPending,...duplicates]);const actor=REMOTE.get('late');if(actor.recipe.race!=='orc'||actor.transform.x!==5)throw Error('Held body lost current identity/transform');return {values,actor,streaming:REMOTE.streaming()};});
  await row('stale-revision-and-conflict-rejected',async()=>{
   const a=REMOTE.get('late'),errors=[];for(const bad of [{...a,appearanceRevision:1},{...a,recipe:actorInput('late','orc','lector',2).recipe}])try{await REMOTE.upsert(bad);}catch(e){errors.push(e.message);}
   if(errors.length!==2)throw Error('Stale or conflicting revision accepted');return {errors};
  });await page.evaluate(()=>REMOTE.remove('late'));
  const humanCoat=prepared.manifest.races.human.manifest.items.lectorCoat.file;
  await page.evaluate(async()=>{await REMOTE.upsert(actorInput('failure','human','wayfarer'));});
  await page.route(`**/__remote_pieces__/${humanCoat}`,route=>route.fulfill({status:200,body:Buffer.from('invalid source bytes'),contentType:'model/gltf-binary'}));
  await row('corrupt-garment-keeps-committed-body-and-recipe',async()=>{const before=REMOTE.get('failure');let error;try{await REMOTE.upsert(actorInput('failure','human','lector',2));}catch(e){error=e.message;}if(!error||JSON.stringify(REMOTE.get('failure').recipe)!==JSON.stringify(before.recipe))throw Error('Failed garment changed committed appearance');return {error,streaming:REMOTE.streaming()};});
  await page.unroute(`**/__remote_pieces__/${humanCoat}`);await page.evaluate(()=>REMOTE.remove('failure'));
  // Hold one decoder's source, saturate unique IDs, then cancel every queued
  // actor before releasing it. This proves the actual queue without rendering
  // 32 decoded actors or inventing native owner capacity.
  heldResolve=null;releaseResolve=null;const heldQueue=new Promise(r=>heldResolve=r),releaseQueue=new Promise(r=>releaseResolve=r);
  await page.route(`**/__remote_pieces__/${orcBody}`,async route=>{heldResolve();await releaseQueue;await route.continue().catch(()=>{});});
  await page.evaluate(()=>{globalThis.burst=[REMOTE.upsert(actorInput('burst-0','orc')).catch(e=>({error:e.message}))];});await heldQueue;
  await row('bounded-thirty-two-ID-queue-and-rejection',async()=>{
   for(let i=1;i<32;i++)burst.push(REMOTE.upsert(actorInput(`burst-${i}`)).catch(e=>({error:e.message})));
   let rejected;try{await REMOTE.upsert(actorInput('burst-32'));}catch(e){rejected=e.message;}
   const before=REMOTE.streaming();if(before.queue.uniqueIds!==32||!rejected?.includes('full'))throw Error('Queue ceiling failure');
   for(let i=0;i<32;i++)await REMOTE.remove(`burst-${i}`);return {before,rejected};
  });releaseResolve();await page.unroute(`**/__remote_pieces__/${orcBody}`);
  await row('superseded-queue-fully-drained',async()=>{const results=await Promise.all(burst);return {results,streaming:REMOTE.streaming()};});assert.equal(report.rows.at(-1).streaming.owned,0);
  await page.evaluate(()=>REMOTE.dispose());
  await page.evaluate(async()=>{globalThis.REMOTE=await makeRemote();});
  let bootHeldResolve,bootReleaseResolve;const bootHeld=new Promise(r=>bootHeldResolve=r),bootRelease=new Promise(r=>bootReleaseResolve=r);
  await page.route(`**/__remote_pieces__/${humanCoat}`,async route=>{bootHeldResolve();await bootRelease;await route.continue().catch(()=>{});});
  await page.evaluate(()=>{globalThis.bootPending=REMOTE.upsert(actorInput('boot-abort','human','lector')).catch(e=>({error:e.message}));});await bootHeld;
  await row('dispose-during-unreturned-equipment-boot',async()=>{const during=REMOTE.streaming();if(during.owned!==1||!during.immutable.leases)throw Error('Did not hold an active boot owner');const disposal=REMOTE.dispose();const result=await bootPending;await disposal;return {during,result,after:REMOTE.streaming(),meshes:ASHEN.scene.meshes.length};});
  bootReleaseResolve();await page.unroute(`**/__remote_pieces__/${humanCoat}`);assert.equal(report.rows.at(-1).after.owned,0);assert.equal(report.rows.at(-1).meshes,report.baseline.meshes);
  await page.evaluate(async()=>{
   globalThis.REMOTE=await makeRemote();const hooks=ASHEN.scene._runtimeBuilds,original=hooks.wait;if(!original)throw Error('Reviewed native material fence absent');
   const held=new Promise(resolve=>{globalThis.releaseNativeBuild=()=>{hooks.wait=original;resolve();};});let once=true;
   // Harness-only delay around the installed native wait boundary. Native build
   // work and its disposal callbacks still run; product code gains no test hook.
   hooks.wait=async(...args)=>{await original.apply(hooks,args);if(once&&REMOTE.resources().builds.size){once=false;globalThis.materialHeld=true;await held;}};
   globalThis.buildPending=REMOTE.upsert(actorInput('build-abort','human','duskguard')).catch(e=>({error:e.message}));
  });
  await page.waitForFunction(()=>globalThis.materialHeld,null,{polling:'raf',timeout:15000});
  await row('dispose-while-native-build-fence-is-held',()=>{const during=REMOTE.streaming();globalThis.buildDisposal=REMOTE.dispose();return {during,retained:REMOTE.streaming()};});
  await page.evaluate(()=>releaseNativeBuild());
  await row('native-material-build-disposal-drained',async()=>{const result=await buildPending;await buildDisposal;return {result,after:REMOTE.streaming(),meshes:ASHEN.scene.meshes.length};});assert.equal(report.rows.at(-1).after.owned,0);assert.equal(report.rows.at(-1).meshes,report.baseline.meshes);
 }
 await page.evaluate(()=>REMOTE.dispose());report.after=await page.evaluate(()=>({meshes:ASHEN.scene.meshes.length,casters:ASHEN.shadows.state.dynamicCasters,streaming:REMOTE.streaming(),gpuErrors:ASHEN.gpu.errors.slice()}));
 assert.equal(report.after.meshes,report.baseline.meshes);assert.equal(report.after.streaming.owned,0);assert.equal(report.after.streaming.immutable.leases,0);assert.equal(report.after.streaming.immutable.reservedBytes,0);assert.deepEqual(report.after.gpuErrors,[]);assert.deepEqual(report.errors,[]);report.passed=true;
}catch(error){report.failure=error.stack;process.exitCode=1;await page.screenshot({path:path.join(dir,'failure.png')}).catch(()=>{});console.error(error);}
finally{
 if(recording){recording=false;await cdp.send('Page.stopScreencast');await Promise.all(writes);await writeCaptureManifest(dir,manifest,await captureSurface(page));}
 await page.evaluate(()=>globalThis.REMOTE?.dispose()).catch(()=>{});await fs.writeFile(path.join(dir,'report.json'),JSON.stringify(report,null,2)+'\n');await context.close();await browser.close();await fs.writeFile(path.join(dir,'ownership.json'),JSON.stringify({...ownership,active:false,renderingClients:0},null,2));console.log(JSON.stringify({passed:report.passed,failure:report.failure,errors:report.errors,after:report.after,frames:manifest?.frames.length||0}));
}
