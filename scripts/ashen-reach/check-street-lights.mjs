/** Ten-fixture route, cache invalidation and real town light/fog regressions. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import sharp from 'sharp';
import {chromium} from 'playwright';
import {CDP_URL} from '../lib/cdp.mjs';
import {fogPixels} from '../lib/fog-pixels.mjs';
const dir=process.env.ASHEN_CAPTURE_DIR||'ve-capture/ashen-reach/street-lights/check';await fs.mkdir(dir,{recursive:true});
const b=await chromium.connectOverCDP(CDP_URL),c=await b.newContext({viewport:{width:1280,height:720}}),p=await c.newPage(),errors=[],report={errors};
p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
await p.addInitScript(()=>{window.__gpuErrors=[];const f=GPUAdapter.prototype.requestDevice;GPUAdapter.prototype.requestDevice=async function(...a){const d=await f.apply(this,a);d.addEventListener('uncapturederror',e=>__gpuErrors.push(e.error.message));return d;};});
const wait=()=>p.waitForTimeout(800);
const state=()=>p.evaluate(()=>structuredClone(ASHEN.localLights.state));
const place=async(x,z)=>{await p.evaluate(({x,z})=>{const a=ASHEN;a.player.setWorldPos(x,a.world.groundHeight(x,z)+1.7,z);a.player.setFacing(0);a.rig.yaw=0;a.rig.pitch=.16;a.rig.distance=a.rig.distanceTarget=4.5;},{x,z});await wait();};
const capture=async name=>{const png=await p.screenshot({path:`${dir}/${name}.png`});const s=await sharp(png).stats();assert(s.channels.slice(0,3).some(c=>c.mean>15),'World must visibly render');};
try{
 await p.goto(process.env.ASHEN_TEST_URL||'http://127.0.0.1:5173/ashen-reach.html?play&clean',{waitUntil:'commit'});await p.waitForFunction(()=>window.ASHEN?.ready&&ASHEN.hostilesReady,null,{timeout:120000});await p.evaluate(()=>ASHEN.dev.god=true);
 report.fixtures=await p.evaluate(()=>({ids:ASHEN.world.localLights.map(l=>l.id),legacyCones:ASHEN.world.stats.shafts,budget:ASHEN.localLights.slots.length,physics:ASHEN.player.getDebugState().usingPhysics}));
 assert.equal(report.fixtures.ids.length,10);assert.equal(report.fixtures.budget,2);assert.equal(report.fixtures.legacyCones,0);assert(report.fixtures.physics);
 await place(0,96);await capture('town');
 report.town=await state();assert.deepEqual(new Set(report.town.active.map(s=>s.id)),new Set(['street-94','street-104']));
 const shadowedFog=await fogPixels(p);assert(shadowedFog.every(Number.isFinite));
 await p.evaluate(()=>ASHEN.localLights.state.shadows=false);await wait();const openFog=await fogPixels(p);
 report.fogShadowSamples=openFog.filter((v,i)=>v-shadowedFog[i]>.002).length;assert(report.fogShadowSamples>10,'Town blockers must occlude integrated lamp fog');
 await p.evaluate(()=>ASHEN.localLights.state.shadows=true);await wait();
 // Static maps must stop drawing once actor casters are removed.
 await p.evaluate(()=>ASHEN.localLights.state.characters=false);await wait();const first=await state();await wait();const second=await state();
 report.staticReuse={renders:second.mapRenders-first.mapRenders,hits:second.cacheHits-first.cacheHits};assert.equal(report.staticReuse.renders,0);assert(report.staticReuse.hits>10);
 // Query beneath the real street-94 lantern with a player between it and ground.
 const lamp=await p.evaluate(()=>ASHEN.world.localLights.find(l=>l.id==='street-94'));
 await place(lamp.position[0],lamp.position[2]);
 const points=await p.evaluate(({position})=>{const pts=[];for(let z=position[2]-2;z<=position[2]+2;z+=.15)for(let x=position[0]-2;x<=position[0]+2;x+=.15)pts.push([x,ASHEN.world.groundHeight(x,z)+.12,z]);return pts;},lamp);
 const probe=()=>p.evaluate(points=>ASHEN.localLights.probe(points),points);
 const baseline=await probe();await p.evaluate(()=>ASHEN.localLights.state.characters=true);await wait();const actor=await probe();const active=await state();const slot=active.active.findIndex(s=>s.id==='street-94');assert(slot>=0);
 report.actorSamples=actor.filter((s,i)=>baseline[i].visibility[slot]-s.visibility[slot]>.4).length;assert(report.actorSamples>5,'Arriving actor must invalidate the cached map');
 const running=await state();await wait();const animated=await state();assert(animated.mapRenders>running.mapRenders,'Stationary animated actors must keep refreshing');
 await p.evaluate(()=>ASHEN.localLights.state.characters=false);await wait();const restored=await probe();report.restoredSamples=restored.filter((s,i)=>s.visibility[slot]-actor[i].visibility[slot]>.4).length;assert(report.restoredSamples>5,'Departed actors must not leave ghost shadows');
 // Fixture reassignment must invalidate a fully cached static map.
 const beforeTravel=await state();await place(0,126);const afterTravel=await state();assert(afterTravel.mapRenders>beforeTravel.mapRenders);assert.deepEqual(new Set(afterTravel.active.map(s=>s.id)),new Set(['street-124','street-134']));
 await place(0,96);report.returned=await state();assert.deepEqual(new Set(report.returned.active.map(s=>s.id)),new Set(['street-94','street-104']));
 await p.evaluate(()=>ASHEN.localLights.state.characters=true);await place(0,88);const start=await p.evaluate(()=>({x:ASHEN.player.body.position.x,z:ASHEN.player.body.position.z}));await p.keyboard.down('KeyW');await p.waitForTimeout(1600);await p.keyboard.up('KeyW');
 report.movement=await p.evaluate(s=>Math.hypot(ASHEN.player.body.position.x-s.x,ASHEN.player.body.position.z-s.z),start);assert(report.movement>5&&report.movement<20,'Traversal must reflect walking, not a camera teleport');await capture('walked');
 await p.setViewportSize({width:391,height:843});await wait();await capture('portrait');report.gpuErrors=await p.evaluate(()=>__gpuErrors);assert.deepEqual(errors,[]);assert.deepEqual(report.gpuErrors,[]);report.passed=true;
}catch(e){report.failure=e.stack;throw e;}finally{await fs.writeFile(`${dir}/report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report));await c.close();await b.close();}
