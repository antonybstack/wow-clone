/** Native bundle recording and actual shadow receiver evidence after population
 * changes. This instruments real WebGPU bundle encoders; it does not replace a
 * draw or supply fake GPU results. Isolated disposable context, never an FPS run.
 */
import {chromium} from 'playwright';import fs from 'node:fs/promises';import assert from 'node:assert/strict';
assert(process.env.ASHEN_CDP_PORT&&process.env.ASHEN_TEST_URL,'Select the audited owned harness');
const browser=await chromium.connectOverCDP(`http://127.0.0.1:${process.env.ASHEN_CDP_PORT}`);assert(browser.contexts().flatMap(c=>c.pages()).every(p=>p.url()==='about:blank'));
const context=await browser.newContext({viewport:{width:1280,height:720}}),page=await context.newPage(),report={errors:[]};page.on('pageerror',e=>report.errors.push(e.stack));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
try{
 await page.goto(process.env.ASHEN_TEST_URL);await page.waitForFunction(()=>globalThis.ASHEN?.ready&&ASHEN.hostilesReady,null,{timeout:90000});
 await page.evaluate(async()=>{const{createRegionCrowd}=await import('/src/character/region-crowd/renderer.js');globalThis.STATE=await import('/src/character/region-crowd/actor-state.js');const{decodePreparedCrowdAppearance}=await import('/src/character/crowd-probe/batches.js');globalThis.CROWD=await createRegionCrowd(ASHEN,{clock:()=>.7});globalThis.RECIPE=decodePreparedCrowdAppearance(CROWD.resources().prepared.manifest.variants.wayfarer.recipe);globalThis.MAKE=(id,x)=>STATE.createRegionActor({id,recipe:RECIPE,transform:{x,y:ASHEN.world.groundHeight(x,-55),z:-55,yaw:0},motion:{clip:'Idle_Loop',loop:true,startedAt:0,offsetSeconds:0}});ASHEN.dev.god=true;ASHEN.player.setWorldPos(-1,ASHEN.world.groundHeight(-1,-61)+1.7,-61);ASHEN.rig.yaw=0;ASHEN.rig.pitch=.2;ASHEN.rig.distance=ASHEN.rig.distanceTarget=5;});await page.waitForTimeout(700);
 const points=await page.evaluate(()=>{const a=[];for(let z=-65;z<=-52;z+=.2)for(let x=-5;x<=7;x+=.2)a.push([x,ASHEN.world.groundHeight(x,z)+.04,z]);return a;});const baseline=await page.evaluate(p=>ASHEN.shadows.probeSun(p),points);
 await page.evaluate(()=>CROWD.set(MAKE('a',-3)));await page.waitForTimeout(500);
 await page.evaluate(()=>{
  const owners=new Map();for(const p of CROWD.resources().pools.values())for(const m of p.meshes)if(m.thinInstances._gpuBuffer)owners.set(m.thinInstances._gpuBuffer,m.name);
  globalThis.DRAWS=[];const device=ASHEN.engine._device,original=device.createRenderBundleEncoder.bind(device);
  device.createRenderBundleEncoder=descriptor=>{const encoder=original(descriptor),set=encoder.setVertexBuffer.bind(encoder),draw=encoder.drawIndexed.bind(encoder);let owner=null;
   encoder.setVertexBuffer=(slot,buffer,...args)=>{if(owners.has(buffer))owner=owners.get(buffer);return set(slot,buffer,...args);};
   encoder.drawIndexed=(indices,count,...args)=>{if(owner)DRAWS.push({name:owner,count,kind:descriptor.colorFormats?.length?'color':'shadow'});return draw(indices,count,...args);};return encoder;};
 });
 await page.evaluate(async()=>{await CROWD.set(MAKE('b',0));await CROWD.set(MAKE('c',3));});await page.waitForTimeout(700);
 report.three=await page.evaluate(()=>DRAWS);const three=await page.evaluate(p=>ASHEN.shadows.probeSun(p),points);report.shadowSamples=three.filter((v,i)=>baseline[i].visibility-v.visibility>.5).length;
 await page.evaluate(()=>{DRAWS.length=0;CROWD.remove('b');});await page.waitForTimeout(700);report.two=await page.evaluate(()=>DRAWS);const two=await page.evaluate(p=>ASHEN.shadows.probeSun(p),points);report.removedShadowSamples=two.filter((v,i)=>v.visibility-three[i].visibility>.5).length;report.survivingShadowSamples=two.filter((v,i)=>baseline[i].visibility-v.visibility>.5).length;
 for(const [name,draws,count]of[['three',report.three,3],['two',report.two,2]])for(const kind of ['color','shadow']){const relevant=draws.filter(d=>d.kind===kind);assert(relevant.length>0,`${name} did not record ${kind}`);assert(relevant.every(d=>d.count===count),`${name} recorded stale ${kind} count`);}
 assert(report.shadowSamples>5);assert(report.removedShadowSamples>5);assert(report.survivingShadowSamples>5);
 await page.evaluate(()=>{ASHEN.rig.yaw=Math.PI;});await page.waitForTimeout(700);const off=await page.evaluate(p=>ASHEN.shadows.probeSun(p),points);report.offscreenShadowSamples=off.filter((v,i)=>baseline[i].visibility-v.visibility>.5).length;assert(report.offscreenShadowSamples>5);
 await page.evaluate(()=>{CROWD.remove('a');CROWD.remove('c');});await page.waitForTimeout(700);const empty=await page.evaluate(p=>ASHEN.shadows.probeSun(p),points);report.ghostSamples=empty.filter((v,i)=>baseline[i].visibility-v.visibility>.5).length;assert.equal(report.ghostSamples,0);
 await page.evaluate(()=>{DRAWS.length=0;return CROWD.set(MAKE('reused',0));});await page.waitForTimeout(700);report.reuse=await page.evaluate(()=>DRAWS);for(const kind of ['color','shadow']){const draws=report.reuse.filter(d=>d.kind===kind);assert(draws.length>0);assert(draws.every(d=>d.count===1));}
 report.indirect=await page.evaluate(()=>[...CROWD.resources().pools.values()].some(p=>p.meshes.some(m=>m.thinInstances._drawArgsBuffer)));assert.equal(report.indirect,false);report.gpuErrors=await page.evaluate(()=>ASHEN.gpu.errors);assert.deepEqual(report.gpuErrors,[]);assert.deepEqual(report.errors,[]);await page.evaluate(()=>CROWD.dispose());
}catch(e){report.failure=e.stack;process.exitCode=1;}finally{await context.close();await browser.close();await fs.writeFile(process.argv[2]||'.cache/crowd-region-2026-09-30/region-bundles.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
