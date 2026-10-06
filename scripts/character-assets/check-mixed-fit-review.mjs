/** Current ordinary-route mixed fit evidence. No candidate interception or FPS claim.
 * Reuses the real Armory, native source poses, catalogue and semantic resolver.
 * Screenshots are review inputs: visibility assertions cannot prove no clipping.
 * https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#skins
 */
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {browserOwnership} from '../lib/browser-ownership.mjs';
import {defaultAppearance} from '../../src/character/appearance/store.js';
import {validateAppearance} from '../../src/character/appearance/contract.js';
import {HUMAN_IDENTITY_PRESETS} from '../../src/character/appearance/human-identity.js';
import {EQUIPMENT_ITEMS} from '../../src/ashen-reach/equipment-catalog.js';
import {resolveCoverage,loadoutSeams} from '../../src/ashen-reach/coverage-contract.js';
import {MIXED_FIT_CASES,MIXED_FIT_PROFILES} from './mixed-fit-cases.mjs';
const url=process.env.ASHEN_TEST_URL,port=process.env.ASHEN_CDP_PORT,out=process.env.ASHEN_CAPTURE_DIR;
assert(url&&port&&out,'Require audited URL/CDP port and output directory');
const select=(all,filter)=>filter?filter.split(',').map(id=>{const row=all.find(x=>x.id===id);assert(row,`Unknown case ${id}`);return row;}):all;
const profiles=select(MIXED_FIT_PROFILES,process.env.ASHEN_MIXED_PROFILES),cases=select(MIXED_FIT_CASES,process.env.ASHEN_MIXED_CASES);
await fs.mkdir(out,{recursive:true});
const browser=await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
assert(browser.contexts().flatMap(c=>c.pages()).every(p=>p.url()==='about:blank'),'Another owned page is active');
const ownership=await browserOwnership(browser,{cdpPort:port,url,purpose:'M6 mixed outfit native pose review, no FPS claim',renderingClients:1});
await fs.writeFile(`${out}/ownership.json`,JSON.stringify(ownership,null,2));
const report={url,scope:'Targeted mixed loadouts; supported race/identity/shape samples. See selected cases. Not exhaustive phases, triples or loadouts.',rows:[],errors:[],passed:false};
try{
 for(const profile of profiles){
  const context=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1}),page=await context.newPage();
  page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
  try{
   // Race switching uses the actual Armory transaction below; Human identity is
   // saved before first play, exactly as on the released creator path.
   const base=defaultAppearance(),preset=HUMAN_IDENTITY_PRESETS.find(p=>p.id===profile.identity);
   const seed=validateAppearance({...base,components:!preset||preset.id==='starter'?{}:preset.components,shape:{...base.shape,height:profile.height,build:profile.build}});
   await context.addInitScript(s=>localStorage.setItem('ashen.appearance.v2',JSON.stringify(s)),seed);
   await page.goto(url);await page.waitForFunction(()=>globalThis.ASHEN?.ready,null,{timeout:90000});await page.evaluate(()=>ASHEN.whenRest);
   await page.evaluate(()=>{ASHEN.dev.god=true;ASHEN.armory.open();});
   if(profile.race!=='human'){await page.selectOption('#armory [data-race]',profile.race);await page.waitForFunction(r=>ASHEN.equipment.race===r,profile.race);}
   await page.check('#armory [data-light]');
   for(const test of cases){
    const result=await page.evaluate(loadout=>ASHEN.equipment.setLoadout(loadout),test.loadout);assert.equal(result.status,'applied',result.error);
    await page.evaluate(()=>{ASHEN.armory.close();ASHEN.armory.open();ASHEN.armory.setFocus({height:.86*ASHEN.player.heightScale,radius:3.25*ASHEN.player.heightScale,beta:1.42});});
    assert.deepEqual(await page.locator('#armory [data-equipment]').evaluateAll(nodes=>Object.fromEntries(nodes.map(n=>[n.dataset.equipment,n.value||null]))),test.loadout);
    for(const motion of [{id:'idle',time:.2},{id:'run',time:.58}]){
     await page.selectOption('#armory [data-motion]',motion.id);
     await page.evaluate(m=>{ASHEN.body.inspection.setPaused(true);ASHEN.body.inspection.seek(m.time);},motion);
     for(const [view,alpha]of [['front',Math.PI/2],['side',0],['back',-Math.PI/2]]){
      await page.evaluate(alpha=>ASHEN.armory.setFocus({alpha}),alpha);await page.waitForTimeout(100);
      const state=await page.evaluate(()=>({race:ASHEN.equipment.race,appearance:ASHEN.getAppearance(),gear:ASHEN.equipment.getState(),segments:ASHEN.equipment.getBodySegments(),meshes:ASHEN.scene.meshes.map(m=>({name:m.name,visible:m.visible!==false,weights:m.morphTargets?Array.from(m.morphTargets.weights):null})),pose:ASHEN.body.inspection.getState(),physics:ASHEN.player.getDebugState().usingPhysics,recoveries:ASHEN.player.getDebugState().recoveries,gpuErrors:ASHEN.gpu.errors.slice()}));
      assert.equal(state.race,profile.race);assert.deepEqual(state.gear,test.loadout);assert(state.physics);assert.equal(state.recoveries,0);assert.deepEqual(state.gpuErrors,[]);assert.equal(state.pose.id,motion.id);assert(Math.abs(state.pose.time-motion.time)<.001);
      if(profile.race==='human'){assert.equal(state.appearance.shape.height,profile.height);assert.equal(state.appearance.shape.build,profile.build);assert.deepEqual(state.appearance.components,seed.components);}
      if(profile.race==='human'){
       const expected=[Math.max(0,-profile.build),Math.max(0,profile.build)];
       // Native morph weights are Float32; compare to the authored decimal with
       // a small numeric tolerance, not JavaScript Float64 bit equality.
       for(const mesh of state.meshes.filter(m=>m.visible&&m.weights)){assert.equal(mesh.weights.length,2);for(let i=0;i<2;i++)assert(Math.abs(mesh.weights[i]-expected[i])<1e-6,`${mesh.name} native shape ${i}`);}
       assert.equal(state.meshes.some(m=>m.name==='HumanPonytail01'&&m.visible),profile.identity==='prime-ponytail'&&!test.loadout.helmet,'Ponytail must follow actual headwear coverage');
      }
      const hidden=new Set(resolveCoverage(test.loadout,EQUIPMENT_ITEMS,profile.race,state.segments).hiddenMeshes);
      for(const name of Object.keys(state.segments)){const meshes=state.meshes.filter(m=>m.name===name);assert(meshes.length,`Missing geoset ${name}`);assert.equal(meshes.some(m=>m.visible),!hidden.has(name),`Coverage ${name}`);}
      for(const id of Object.values(test.loadout).filter(Boolean))for(const part of EQUIPMENT_ITEMS[id].parts||[])assert.equal(state.meshes.some(m=>m.name===part.mesh&&m.visible),!(part.hideWhenSlots||[]).some(slot=>test.loadout[slot]),`Part ${part.mesh}`);
      const file=`${profile.id}-${test.id}-${motion.id}-${view}.png`;await page.screenshot({path:`${out}/${file}`});
      report.rows.push({profile,test:test.id,loadout:test.loadout,seams:loadoutSeams(test.loadout),motion,view,file,...state});
     }
    }
    console.log(`${profile.id}/${test.id}: six views captured`);
   }
  }finally{await context.close();}
 }
 assert.deepEqual(report.errors,[]);report.passed=true;
}finally{await browser.close();await fs.writeFile(`${out}/report.json`,JSON.stringify(report,null,2));await fs.writeFile(`${out}/ownership.json`,JSON.stringify({...ownership,active:false,renderingClients:0},null,2));}
