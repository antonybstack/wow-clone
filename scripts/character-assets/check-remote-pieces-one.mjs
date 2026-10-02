/** First actual-region remote owner and same-body equipment transaction.
 * One explicitly audited browser/context; pose fixture, no FPS/traversal claim.
 */
import fs from 'node:fs/promises';import assert from 'node:assert/strict';import {chromium} from 'playwright';
import {browserOwnership} from '../lib/browser-ownership.mjs';
const port=process.env.ASHEN_CDP_PORT,url=process.env.ASHEN_TEST_URL,out=process.argv[2]||'.cache/character-mmo/remote-pieces-v1/one-actor-report.json';assert(port&&url);
const browser=await chromium.connectOverCDP(`http://127.0.0.1:${port}`);assert(browser.contexts().flatMap(c=>c.pages()).every(p=>p.url()==='about:blank'));
const context=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1}),page=await context.newPage(),report={url,errors:[],rows:[],conditions:'One remote exact native owner; pose fixtures, not performance or traversal'};
const ownership=await browserOwnership(browser,{cdpPort:port,url,purpose:report.conditions,renderingClients:1});await fs.writeFile(out+'.ownership.json',JSON.stringify(ownership,null,2));
page.on('pageerror',e=>report.errors.push(e.stack));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
try{
 await page.goto(url);await page.waitForFunction(()=>globalThis.ASHEN?.ready&&ASHEN.hostilesReady&&ASHEN.getAppearance,null,{timeout:120000});
 report.baseline=await page.evaluate(()=>({meshes:ASHEN.scene.meshes.length,casters:ASHEN.shadows.state.dynamicCasters}));
 report.rows.push(await page.evaluate(async()=>{
  const {createRemotePieceActors}=await import('/src/character/remote-pieces/renderer.js');
  globalThis.REMOTE=await createRemotePieceActors(ASHEN,{clock:()=>globalThis.REMOTE_TIME||.48});
  const recipe=structuredClone(ASHEN.getAppearance());recipe.equipment={...recipe.equipment,...ASHEN.equipment.presets.lector.loadout};recipe.shape={...recipe.shape,build:.95,height:1.15};
  globalThis.REMOTE_ACTOR={id:'remote-one',recipe,transform:{x:2,y:ASHEN.world.groundHeight(2,-60),z:-60,yaw:Math.PI},motion:{clip:'Walk_Loop',loop:true,startedAt:0,offsetSeconds:0},appearanceRevision:1};
  ASHEN.dev.god=true;ASHEN.player.setWorldPos(0,ASHEN.world.groundHeight(0,-65)+1.7,-65);ASHEN.rig.yaw=0;ASHEN.rig.pitch=-.08;ASHEN.rig.distance=ASHEN.rig.distanceTarget=2.5;ASHEN.setView('play');
  const result=await REMOTE.upsert(REMOTE_ACTOR);return {case:'first-source-backed-lector',result,snapshot:REMOTE.snapshot(),streaming:REMOTE.streaming()};
 }));
 assert.equal(report.rows[0].result.status,'applied');assert.equal(report.rows[0].streaming.immutable.leases,0);await page.waitForTimeout(700);await page.screenshot({path:out.replace(/\.json$/, '-lector.png')});assert.deepEqual(await page.evaluate(()=>ASHEN.gpu.errors),[]);
 report.rows[0].nativeMeshes=await page.evaluate(()=>REMOTE.resources().actors.get('remote-one').resource.equipment.getOwnedMeshes().map(m=>({name:m.name,visible:m.visible,world:Array.from(m.worldMatrix),inScene:ASHEN.scene.meshes.includes(m)})));
 report.rows.push(await page.evaluate(async()=>{
  const before=REMOTE.resources().actors.get('remote-one').resource;
  REMOTE_ACTOR={...REMOTE_ACTOR,appearanceRevision:2,recipe:{...REMOTE_ACTOR.recipe,equipment:{...REMOTE_ACTOR.recipe.equipment,...ASHEN.equipment.presets.duskguard.loadout}},motion:{clip:'FireBlast_Upper',loop:false,startedAt:0,offsetSeconds:0}};
  const result=await REMOTE.upsert(REMOTE_ACTOR),after=REMOTE.resources().actors.get('remote-one').resource;
  return {case:'same-body-native-armor',result,sameBody:before===after,snapshot:REMOTE.snapshot(),streaming:REMOTE.streaming()};
 }));
 assert.equal(report.rows[1].result.status,'applied');assert(report.rows[1].sameBody);assert.equal(report.rows[1].streaming.immutable.leases,0);await page.waitForTimeout(700);await page.screenshot({path:out.replace(/\.json$/, '-duskguard.png')});assert.deepEqual(await page.evaluate(()=>ASHEN.gpu.errors),[]);
 report.rows.push(await page.evaluate(async()=>{
  REMOTE_ACTOR={...REMOTE_ACTOR,appearanceRevision:3,recipe:{...REMOTE_ACTOR.recipe,race:'undead',fitFamily:'ashen-undead',shape:{},equipment:{...REMOTE_ACTOR.recipe.equipment}}};
  const result=await REMOTE.upsert(REMOTE_ACTOR);return {case:'native-undead-body-swap',result,snapshot:REMOTE.snapshot(),streaming:REMOTE.streaming()};
 }));
 assert.equal(report.rows[2].result.status,'applied');await page.waitForTimeout(700);await page.screenshot({path:out.replace(/\.json$/, '-undead.png')});
 await page.evaluate(()=>REMOTE.dispose());report.after=await page.evaluate(()=>({meshes:ASHEN.scene.meshes.length,casters:ASHEN.shadows.state.dynamicCasters,streaming:REMOTE.streaming(),gpuErrors:ASHEN.gpu.errors.slice()}));
 assert.equal(report.after.meshes,report.baseline.meshes);assert.equal(report.after.streaming.owned,0);assert.equal(report.after.streaming.immutable.leases,0);assert.deepEqual(report.after.gpuErrors,[]);assert.deepEqual(report.errors,[]);report.passed=true;
}catch(error){report.failure=error.stack;process.exitCode=1;await page.screenshot({path:out.replace(/\.json$/, '-failure.png')}).catch(()=>{});console.error(error);}
finally{await page.evaluate(()=>globalThis.REMOTE?.dispose()).catch(()=>{});await fs.writeFile(out,JSON.stringify(report,null,2)+'\n');await context.close();await browser.close();await fs.writeFile(out+'.ownership.json',JSON.stringify({...ownership,active:false,renderingClients:0},null,2));console.log(JSON.stringify({passed:report.passed,failure:report.failure,errors:report.errors,after:report.after}));}
