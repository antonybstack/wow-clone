/** Full keyboard routes, entering and escaping each destination without recovery teleports. */
import {chromium} from 'playwright';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import {CDP_URL} from '../lib/cdp.mjs';
const dir=process.env.ASHEN_CAPTURE_DIR||'ve-capture/ashen-reach/v25/traversal';await fs.mkdir(dir,{recursive:true});
const b=await chromium.connectOverCDP(CDP_URL),c=await b.newContext({viewport:{width:1280,height:720}}),p=await c.newPage(),errors=[],report={errors,routes:[]};
p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
await p.addInitScript(()=>{window.__gpuErrors=[];const request=GPUAdapter.prototype.requestDevice;GPUAdapter.prototype.requestDevice=async function(...args){const d=await request.apply(this,args);d.addEventListener('uncapturederror',e=>__gpuErrors.push(e.error.message));return d;};});
const position=()=>p.evaluate(()=>({x:ASHEN.player.body.position.x,y:ASHEN.player.body.position.y,z:ASHEN.player.body.position.z,facing:ASHEN.player.getMotion().facing??ASHEN.player.body.rotation.y,physics:ASHEN.player.getDebugState().usingPhysics,recoveries:ASHEN.player.getDebugState().recoveries}));
async function go(point){
 let state=await position(),distance=Math.hypot(point[0]-state.x,point[2]-state.z),best=distance,lastProgress=Date.now(),start=Date.now();
 while(distance>.42){
  const desired=Math.atan2(point[0]-state.x,point[2]-state.z),error=Math.atan2(Math.sin(desired-state.facing),Math.cos(desired-state.facing));
  if(Math.abs(error)>.045){await p.keyboard.up('KeyW');const key=error>0?'KeyD':'KeyA';await p.keyboard.down(key);await p.waitForTimeout(Math.max(12,Math.min(150,Math.abs(error)/2.55*1000)));await p.keyboard.up(key);}
  else {await p.keyboard.down('KeyW');await p.waitForTimeout(Math.min(150,Math.max(20,(distance-.3)/7*1000)));}
  state=await position();distance=Math.hypot(point[0]-state.x,point[2]-state.z);assert(state.physics);assert(Number.isFinite(state.y));
  if(distance<best-.12){best=distance;lastProgress=Date.now();}
  if(Date.now()-lastProgress>5000||Date.now()-start>45000)throw Error(`Blocked at ${JSON.stringify(state)} toward ${JSON.stringify(point)} (distance ${distance})`);
 }
 await p.keyboard.up('KeyW');return state;
}
function corners(points){return points.filter((p,i)=>{if(!i||i===points.length-1)return true;const a=points[i-1],b=points[i+1],ax=p[0]-a[0],az=p[2]-a[2],bx=b[0]-p[0],bz=b[2]-p[2];return Math.abs(ax*bz-az*bx)>.001;});}
try{
 await p.goto(process.env.ASHEN_TEST_URL||'http://127.0.0.1:5173/ashen-reach.html?play&clean',{waitUntil:'commit'});await p.waitForFunction(()=>window.ASHEN?.ready&&ASHEN.hostilesReady,null,{timeout:120000});await p.evaluate(()=>{ASHEN.dev.god=true;ASHEN.metrics.setInternalResolution(1280,720);});
 const sites=await p.evaluate(()=>ASHEN.world.landmarks.filter(x=>x.route).map(l=>({...l,structure:ASHEN.world.regionStructures.destinations.find(s=>s.id===l.id)})));
 for(const site of sites.filter(s=>!process.env.ASHEN_DESTINATION||process.env.ASHEN_DESTINATION.split(',').includes(s.id))){
  const path=corners(site.route),first=path[0],yaw=Math.atan2(path[1][0]-first[0],path[1][2]-first[2]);await p.evaluate(({first,yaw})=>{const a=ASHEN;a.player.setFlying(false);a.player.setWorldPos(first[0],first[1]+1.7,first[2]);a.player.setFacing(yaw);a.rig.yaw=yaw;a.rig.pitch=-.14;a.rig.distance=a.rig.distanceTarget=4;},{first,yaw});await p.waitForTimeout(700);const start=await position(),samples=[];
  console.log(`START ${site.id} ${path.length} route corners`);
  for(const point of path.slice(1))samples.push(await go(point));
  await p.screenshot({path:`${dir}/${site.id}-entrance.png`});
  const inside=site.structure?.interior||[site.x,site.floorY,site.z];if(site.structure?.courtyard)samples.push(await go(site.structure.courtyard));samples.push(await go(inside));await p.screenshot({path:`${dir}/${site.id}-interior.png`});
  if(site.structure?.courtyard)samples.push(await go(site.structure.courtyard));samples.push(await go(site.entrance));for(const point of path.slice(0,-1).reverse())samples.push(await go(point));
  const end=await position();assert.equal(end.recoveries,start.recoveries,`${site.id}: no recovery teleports`);assert(samples.every(s=>s.recoveries===start.recoveries));const row={id:site.id,start,end,samples: samples.length,entered:true,returned:true};report.routes.push(row);await fs.writeFile(dir+'/report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(row));
 }
 report.gpuErrors=await p.evaluate(()=>__gpuErrors);assert.deepEqual(errors,[]);assert.deepEqual(report.gpuErrors,[]);report.passed=true;
}catch(e){report.failure=e.stack;await p.screenshot({path:dir+'/failure.png'}).catch(()=>{});throw e;}finally{for(const key of ['KeyW','KeyA','KeyD'])await p.keyboard.up(key).catch(()=>{});await fs.writeFile(dir+'/report.json',JSON.stringify(report,null,2));await c.close();await b.close();}
