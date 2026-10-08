/** Canonical source-pack motion check, using actual equipment/creator controls.
 * Owns one frozen preview and Chrome, captures fixed-size timestamped frames,
 * and closes both in finally. Audit other renderers first; this is not FPS.
 * https://playwright.dev/docs/api/class-keyboard
 * https://chromedevtools.github.io/devtools-protocol/tot/Page/#method-startScreencast
 */
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import path from 'node:path';
import {spawn,execFileSync} from 'node:child_process';
import {productPaths,productInputsSha256} from './pages-seal.mjs';
import {chromium} from 'playwright';
import {browserOwnership} from '../lib/browser-ownership.mjs';
import {captureSurface,appendFrame,writeCaptureManifest} from '../lib/capture-manifest.mjs';
import {defaultAppearance} from '../../src/character/appearance/store.js';
import {EQUIPMENT_PRESETS} from '../../src/ashen-reach/equipment-catalog.js';

const dir=path.resolve(process.env.ASHEN_CAPTURE_OUT||'.cache/character-mmo/boot-sole-release-2026-10-07/motion');
const relative=path.relative(path.resolve('.cache'),dir);assert(relative&&!relative.startsWith('..')&&!path.isAbsolute(relative),'Capture under .cache only');
const cache=path.dirname(dir),root=path.resolve(process.env.ASHEN_CAPTURE_DIST||'dist');
const url='http://127.0.0.1:7074/?play&clean&pixelRatio=1&dev&verifyAssets';
await fs.mkdir(cache,{recursive:true});await fs.mkdir(dir);await fs.mkdir(path.join(dir,'frames'));
const report={url,sourceCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),productInputs:await productInputsSha256(process.cwd(),await productPaths(process.cwd())),purpose:'Canonical boot sole/forefoot and Undead source-foot coverage in native Lite; diagnostic Armory + ordinary Havok traversal; no FPS',errors:[],cases:[],passed:false};
const expected={};
for(const [key,folder,file]of [['human','equipment','manifest-coverage-v1.json'],['shaped','human-shape-v1','manifest.json'],['undead','equipment-undead','manifest-coverage-v1.json'],['starter','startup/character','manifest.json']]){
 const m=JSON.parse(await fs.readFile(`public/ashen-reach/${folder}/${file}`,'utf8'));
 for(const id of ['wayfarerBoots','duskguardGreaves'])expected[`${key}/${id}`]=[m.items[id],m.compactItems?.[id]].filter(Boolean).map(x=>({url:x.url,sha256:x.sha256}));
}
report.expectedCanonicalAssets=expected;
let server,browser,context,page,cdp,ownership,manifest,recording=false,captureError;
const writes=[],history=row=>fs.appendFile(path.join(cache,'ownership-history.jsonl'),JSON.stringify({at:new Date().toISOString(),...row})+'\n');
try{
 server=spawn(process.execPath,['scripts/ashen-reach/serve-startup-preview.mjs',root],{env:{...process.env,ASHEN_PREVIEW_PORT:'7074'},stdio:['ignore','pipe','pipe']});
 report.previewPid=server.pid;await history({event:'preview-opened',owner:'grok-boot-canonical',pid:server.pid,port:7074,url,root,purpose:report.purpose,active:true});
 await new Promise((resolve,reject)=>{let text='';const timer=setTimeout(()=>reject(Error('preview readiness timeout')),30000);server.stdout.on('data',v=>{text+=v;if(text.includes('Serving ')){clearTimeout(timer);resolve();}});server.once('error',reject);server.once('exit',code=>reject(Error('preview exited '+code)));});
 browser=await chromium.launch({channel:'chrome',headless:true,args:['--remote-debugging-port=10037']});
 ownership={...await browserOwnership(browser,{cdpPort:10037,url,purpose:report.purpose,renderingClients:1}),owner:'grok-boot-canonical'};await history({event:'opened',...ownership});
 context=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1});page=await context.newPage();cdp=await context.newCDPSession(page);
 const base=defaultAppearance(),seed={...base,equipment:EQUIPMENT_PRESETS.wayfarer.loadout};
 await context.addInitScript(recipe=>localStorage.setItem('ashen.appearance.v2',JSON.stringify(recipe)),seed);
 report.assetResponses=[];page.on('response',r=>{if(/(?:wayfarerBoots|duskguardGreaves)[-/]/.test(r.url()))report.assetResponses.push({url:r.url(),status:r.status()});});
 page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
 await page.goto(url);await page.waitForFunction(()=>globalThis.ASHEN?.ready&&ASHEN.hostilesReady,null,{timeout:90000});
 await page.evaluate(()=>{const a=ASHEN;a.dev.god=true;a.player.setFlying(false);a.player.setWorldPos(0,a.world.groundHeight(0,-100)+1.7,-100);a.player.setFacing(0);a.rig.yaw=0;a.rig.distance=a.rig.distanceTarget=2.5;});
 await page.waitForTimeout(1000);await page.focus('#renderCanvas');
 report.initial=await page.evaluate(()=>({appearance:ASHEN.getAppearance(),physics:ASHEN.player.getDebugState(),canvas:ASHEN.metrics.summary().resolution}));
 manifest={version:1,...await captureSurface(page),frames:[],timeline:[],purpose:report.purpose};
 cdp.on('Page.screencastFrame',event=>{void cdp.send('Page.screencastFrameAck',{sessionId:event.sessionId}).catch(()=>{});if(!recording||captureError)return;
  try{const name=`frame-${String(manifest.frames.length).padStart(6,'0')}.jpg`,bytes=Buffer.from(event.data,'base64');appendFrame(manifest,{name,timestamp:event.metadata.timestamp,bytes});writes.push(fs.writeFile(path.join(dir,'frames',name),bytes).catch(e=>{captureError=e;}));}catch(e){captureError=e;}});
 recording=true;await cdp.send('Page.startScreencast',{format:'jpeg',quality:90,maxWidth:1280,maxHeight:720,everyNthFrame:2});
 const label=async text=>{await page.evaluate(text=>{let el=document.getElementById('capture-note');if(!el){el=document.createElement('p');el.id='capture-note';el.style='position:fixed;left:12px;bottom:6px;z-index:99999;background:#171b16e8;color:#eee2ac;padding:6px 10px;font:12px Georgia;pointer-events:none';document.body.append(el);}el.textContent=text;},text);manifest.timeline.push({label:text,timestamp:manifest.frames.at(-1)?.timestamp});};
 await label('Canonical boot sole · normal Havok sprint / jump · initial meadow fixture · invulnerable');
 const before=await page.evaluate(()=>ASHEN.player.getDebugState());await page.keyboard.down('KeyW');await page.waitForTimeout(1400);await page.keyboard.down('Space');await page.waitForTimeout(150);await page.keyboard.up('Space');await page.waitForTimeout(1100);await page.keyboard.up('KeyW');await page.waitForTimeout(700);
 const after=await page.evaluate(()=>ASHEN.player.getDebugState());assert(after.jumps>before.jumps);assert(after.grounded);assert.equal(after.recoveries,0);report.travel={before,after};
 for(const profile of [{id:'original',race:'human',identity:'starter',height:1,build:0},{id:'prime-tall-slender',race:'human',identity:'prime-ponytail',height:1.15,build:-.95},{id:'prime-short-stout',race:'human',identity:'prime-ponytail',height:.9,build:.95},{id:'orc',race:'orc'},{id:'undead',race:'undead'}]){
  await page.evaluate(()=>ASHEN.armory.open());
  if(await page.evaluate(()=>ASHEN.equipment.race)!==profile.race){await page.selectOption('#armory [data-race]',profile.race);await page.waitForFunction(r=>ASHEN.equipment.race===r,profile.race);}
  if(profile.identity){await page.getByLabel('Face and hair',{exact:true}).selectOption(profile.identity);await page.waitForFunction(id=>ASHEN.creator.identity.selected===id,profile.identity);await page.evaluate(async({height,build})=>{await ASHEN.creator.set('height',height);await ASHEN.creator.set('build',build);await ASHEN.creator.settled();},profile);}
  for(const [slot,id]of Object.entries({helmet:'',torso:'wayfarerTunic',legs:'wayfarerTrousers',gloves:'',shoulders:''})){await page.selectOption(`#armory [data-equipment="${slot}"]`,id);await page.waitForFunction(({slot,id})=>(ASHEN.equipment.getState()[slot]||'')===id,{slot,id});}
  await page.evaluate(()=>ASHEN.creator.settled());await page.waitForTimeout(300);
  await page.check('#armory [data-light]');
  for(const boot of ['wayfarerBoots','duskguardGreaves']){
   await page.selectOption('#armory [data-equipment="boots"]',boot);await page.waitForFunction(id=>ASHEN.equipment.getState().boots===id,boot);
   await page.evaluate(()=>ASHEN.creator.settled());await page.waitForTimeout(200);
   await page.selectOption('#armory [data-motion]','idle');
   await page.evaluate(()=>{const s=ASHEN.equipment.race==='human'?ASHEN.player.heightScale:1;ASHEN.body.inspection.setPaused(true);ASHEN.body.inspection.seek(.2);ASHEN.armory.setFocus({height:.16*s,radius:1.05*s,beta:1.38,alpha:0});});
   await page.evaluate(()=>ASHEN.whenNextGpuFrame());await page.waitForTimeout(120);
   const pose=await page.evaluate(()=>ASHEN.body.inspection.getState());assert(pose.paused);assert(Math.abs(pose.time-.2)<.0001,JSON.stringify(pose));
   await label(`${profile.id} · ${boot} · side / idle · native inspection + fill light`);
   await page.screenshot({path:path.join(dir,`${profile.id}-${boot}-side.png`)});
   await page.evaluate(()=>ASHEN.armory.setFocus({alpha:Math.PI/2}));await page.evaluate(()=>ASHEN.whenNextGpuFrame());
   await label(`${profile.id} · ${boot} · front / idle · native inspection + fill light`);
   await page.screenshot({path:path.join(dir,`${profile.id}-${boot}-front.png`)});
   // Retain the old idle comparison camera, but give the moving feet headroom.
   // Native camera/framing only; neither the source curves nor movement changes.
   await page.selectOption('#armory [data-motion]','run');await page.evaluate(()=>{const s=ASHEN.equipment.race==='human'?ASHEN.player.heightScale:1;ASHEN.armory.setFocus({alpha:0,height:.28*s,radius:1.45*s});ASHEN.body.inspection.seek(0);ASHEN.body.inspection.setPaused(false);});
   await label(`${profile.id} · ${boot} · native run preview · diagnostic foot framing`);await page.waitForTimeout(1600);
   const state=await page.evaluate(()=>({appearance:ASHEN.getAppearance(),physics:ASHEN.player.getDebugState(),preview:ASHEN.body.inspection.getState(),bones:ASHEN.body.boneCount,heightScale:ASHEN.player.heightScale,morphs:ASHEN.scene.meshes.filter(m=>m.visible!==false&&m.morphTargets).map(m=>({name:m.name,weights:Array.from(m.morphTargets.weights)})),gpuErrors:ASHEN.gpu.errors,foot:ASHEN.scene.meshes.filter(m=>/^(Human|Undead)FootCore$/.test(m.name)).map(m=>({name:m.name,visible:m.visible!==false})),visible:ASHEN.scene.meshes.filter(m=>m.visible!==false&&/Boot|Greave/.test(m.name)).map(m=>m.name)}));
   assert(state.physics.usingPhysics);assert.equal(state.physics.recoveries,0);assert.equal(state.bones,65);if(profile.race==='undead'){const activeFoot=state.foot.filter(m=>m.name==='UndeadFootCore');assert.equal(activeFoot.length,1);assert.equal(activeFoot[0].visible,false);}assert.equal(state.preview.paused,false);assert.deepEqual(state.gpuErrors,[]);if(profile.race==='human'){assert(Math.abs(state.heightScale-profile.height)<1e-5);for(const mesh of state.morphs)for(let i=0;i<2;i++)assert(Math.abs(mesh.weights[i]-[Math.max(0,-profile.build),Math.max(0,profile.build)][i])<1e-5);if(profile.build!==0)assert(state.morphs.some(m=>/Boot/.test(m.name)));}report.cases.push({profile,boot,state});
  }
 }
 await page.selectOption('#armory [data-equipment="boots"]','');await page.waitForFunction(()=>ASHEN.equipment.getState().boots===null);await page.evaluate(()=>{ASHEN.body.inspection.select('idle');ASHEN.body.inspection.setPaused(true);ASHEN.body.inspection.seek(.2);});await page.waitForTimeout(150);const restored=await page.evaluate(()=>ASHEN.scene.meshes.filter(m=>m.name==='UndeadFootCore').map(m=>m.visible!==false));assert.deepEqual(restored,[true]);report.bareFootRestored=true;await label('Undead · boots removed · complete source foot restored');await page.screenshot({path:path.join(dir,'undead-bare-foot-restoration.png')});await page.waitForTimeout(700);await page.selectOption('#armory [data-equipment="boots"]','wayfarerBoots');await page.waitForFunction(()=>ASHEN.equipment.getState().boots==='wayfarerBoots');await page.evaluate(()=>ASHEN.armory.close());await label('Undead · corrected boot + native foot coverage · normal Havok sprint / jump');const ub=await page.evaluate(()=>ASHEN.player.getDebugState());await page.keyboard.down('KeyW');await page.waitForTimeout(1200);await page.keyboard.down('Space');await page.waitForTimeout(150);await page.keyboard.up('Space');await page.waitForTimeout(1100);await page.keyboard.up('KeyW');await page.waitForTimeout(700);const ua=await page.evaluate(()=>ASHEN.player.getDebugState());assert(ua.jumps>ub.jumps);assert(ua.grounded);assert.equal(ua.recoveries,0);report.undeadTravel={before:ub,after:ua};await label('Canonical boot sole complete · five profiles / two boots');await page.waitForTimeout(500);
 await cdp.send('Page.stopScreencast');recording=false;await Promise.all(writes);if(captureError)throw captureError;
 await writeCaptureManifest(dir,manifest,await captureSurface(page));assert.deepEqual(report.errors,[]);for(const key of ['shaped/wayfarerBoots','shaped/duskguardGreaves','undead/wayfarerBoots','undead/duskguardGreaves'])assert(report.assetResponses.some(r=>expected[key].some(e=>new URL(r.url).pathname===e.url)),`Missing canonical asset ${key}`);assert(report.assetResponses.some(r=>[...expected['human/wayfarerBoots'],...expected['starter/wayfarerBoots']].some(e=>new URL(r.url).pathname===e.url)),'Missing original Human canonical boot');assert(report.assetResponses.every(r=>r.status===200));report.passed=true;
}catch(error){report.failure=String(error.stack||error);report.failureState=await page?.evaluate(()=>({race:ASHEN?.equipment.race,gear:ASHEN?.equipment.getState(),status:ASHEN?.equipment.getStatus(),appearance:ASHEN?.getAppearance(),pose:ASHEN?.body.inspection?.getState()})).catch(()=>null);process.exitCode=1;}
finally{
 await page?.keyboard.up('KeyW').catch(()=>{});await page?.keyboard.up('Space').catch(()=>{});if(recording)await cdp?.send('Page.stopScreencast').catch(()=>{});await Promise.all(writes);
 if(manifest?.frames.length)await writeCaptureManifest(dir,manifest,await captureSurface(page)).catch(e=>{report.manifestFailure=e.message;});
 await fs.writeFile(path.join(dir,'report.json'),JSON.stringify(report,null,2)+'\n');await context?.close();await browser?.close();
 if(ownership)await history({event:'closed',...ownership,active:false,renderingClients:0});
 if(server){const closed=new Promise(resolve=>server.once('close',resolve));server.kill('SIGTERM');await closed;await history({event:'preview-closed',pid:server.pid,port:7074,active:false});}
 await fs.writeFile(path.join(cache,'canonical-motion-native-exit.json'),JSON.stringify({exitCode:process.exitCode||0,passed:report.passed,cases:report.cases.length,controllerPid:process.pid})+'\n');
}
console.log(JSON.stringify({passed:report.passed,cases:report.cases.length,failure:report.failure,errors:report.errors}));
