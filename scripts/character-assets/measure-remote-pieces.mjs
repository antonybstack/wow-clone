/** Isolated actual-region exact-owner cost. No recording, encoders or workers.
 * Same diagnostic open-meadow camera for all counts; no hub-capacity claim.
 */
import fs from 'node:fs/promises';import os from 'node:os';import assert from 'node:assert/strict';import {chromium} from 'playwright';
import {browserOwnership} from '../lib/browser-ownership.mjs';import {summarizeFrameIntervals} from './summarize-frame-intervals.mjs';import {detectVsyncCap} from '../../src/ashen-reach/metrics.js';
const port=process.env.ASHEN_CDP_PORT,url=process.env.ASHEN_TEST_URL,out=process.argv[2];assert(port&&url&&out);
const browser=await chromium.connectOverCDP(`http://127.0.0.1:${port}`);assert(browser.contexts().flatMap(c=>c.pages()).every(p=>p.url()==='about:blank'));
const context=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1}),page=await context.newPage();
const ownership=await browserOwnership(browser,{cdpPort:port,url,purpose:'Isolated native exact 0/1/8 cost, one renderer and seven enemies',renderingClients:1});
const report={conditions:{cpu:os.cpus()[0].model,url,viewport:[1280,720],runs:3,seconds:12,recording:false,renderingClients:1,physicalPhone:false,camera:'Diagnostic open meadow, existing spring arm 14 m; identical across counts',nativeExact:true},rows:[],errors:[]};
await fs.writeFile(out+'.ownership.json',JSON.stringify(ownership,null,2));page.on('pageerror',e=>report.errors.push(e.stack));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
try{
 await page.goto(url);await page.waitForFunction(()=>globalThis.ASHEN?.ready&&ASHEN.hostilesReady&&ASHEN.regionReady,null,{timeout:120000});
 await page.evaluate(async()=>{
  ASHEN.dev.god=true;ASHEN.player.setWorldPos(0,ASHEN.world.groundHeight(0,-65)+1.7,-65);ASHEN.rig.yaw=0;ASHEN.rig.pitch=-.1;ASHEN.rig.distance=ASHEN.rig.distanceTarget=14;ASHEN.setView('play');
  const {createRemotePieceActors}=await import('/src/character/remote-pieces/renderer.js');globalThis.REMOTE=await createRemotePieceActors(ASHEN);
 });
 report.surface=await page.evaluate(()=>({canvas:[ASHEN.canvas.width,ASHEN.canvas.height],enemies:ASHEN.combat.enemies.length,physics:ASHEN.player.usingPhysics}));assert.deepEqual(report.surface.canvas,[1280,720]);assert.equal(report.surface.enemies,7);assert(report.surface.physics);
 for(const count of [0,1,8]){
  await page.evaluate(async count=>{
   for(let i=REMOTE.snapshot().count;i<count;i++){
    const recipe=structuredClone(ASHEN.getAppearance()),race=['human','orc','undead'][i%3],preset=['duskguard','lector','graveweaver','pilgrim','wayfarer'][i%5];recipe.race=race;recipe.fitFamily={human:'ashen-human',orc:'ashen-orc',undead:'ashen-undead'}[race];recipe.shape=race==='human'?{...recipe.shape,build:i%2?-.95:.95,height:i%2?.9:1.15}:{};
    recipe.equipment={helmet:null,torso:null,legs:null,boots:null,gloves:null,mainHand:null,offHand:null,shoulders:null,...ASHEN.equipment.presets[preset].loadout};
    const x=-5+(i%4)*3,z=-61+Math.floor(i/4)*3;
    await REMOTE.upsert({id:`meadow-${i}`,recipe,appearanceRevision:1,transform:{x,y:ASHEN.world.groundHeight(x,z),z,yaw:Math.PI},motion:{clip:i%2?'Walk_Loop':'Sprint_Loop',loop:true,startedAt:0,offsetSeconds:i*.13}});
   }
  },count);await page.waitForTimeout(5000);
  for(let run=0;run<3;run++){
   await page.evaluate(()=>ASHEN.renderLoop.beginMeasurement());await page.waitForTimeout(12000);
   const data=await page.evaluate(()=>({frames:ASHEN.renderLoop.endMeasurement(),snapshot:REMOTE.snapshot(),streaming:REMOTE.streaming(),gpuErrors:ASHEN.gpu.errors.slice()}));
   const capped=detectVsyncCap(data.frames),tails=summarizeFrameIntervals(data.frames);report.rows.push({count,run,...data,tails,capped});await fs.writeFile(out,JSON.stringify(report,null,2));
  }
  // Captures follow sampling and cannot contaminate its retained intervals.
  await page.screenshot({path:out.replace(/\.json$/,`-${count}-visible.png`)});
 }
 await page.evaluate(()=>REMOTE.dispose());report.final=await page.evaluate(()=>({streaming:REMOTE.streaming(),gpuErrors:ASHEN.gpu.errors.slice()}));assert.equal(report.final.streaming.owned,0);assert.deepEqual(report.final.gpuErrors,[]);assert.deepEqual(report.errors,[]);report.passed=true;
}catch(error){report.failure=error.stack;process.exitCode=1;console.error(error);}
finally{await page.evaluate(()=>globalThis.REMOTE?.dispose()).catch(()=>{});await fs.writeFile(out,JSON.stringify(report,null,2));await context.close();await browser.close();await fs.writeFile(out+'.ownership.json',JSON.stringify({...ownership,active:false,renderingClients:0},null,2));console.log(JSON.stringify({passed:report.passed,failure:report.failure,rows:report.rows.map(r=>({count:r.count,run:r.run,tails:r.tails,capped:r.capped}))}));}
