/** A single connected keyboard circuit: enter/escape every selected destination.
 * Initial ?dev&at= spawn is also available in the developer menu. No subsequent
 * private placements, Fly mode or recovery teleports can qualify a circuit.
 */
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {CDP_URL} from '../lib/cdp.mjs';
import {browserOwnership} from '../lib/browser-ownership.mjs';
import {buildingPads} from '../../src/ashen-reach/geometry.js';
const dir=process.env.ASHEN_CAPTURE_DIR||'.cache/region-circuit';
await fs.mkdir(dir,{recursive:true});
const url=new URL(process.env.ASHEN_TEST_URL||'http://127.0.0.1:5173/');
url.searchParams.delete('gpuTiming');
for(const [key,value] of [['dev',''],['play',''],['clean',''],['at','cathedral-bridge'],['pixelRatio','1']])url.searchParams.set(key,value);
const b=await chromium.connectOverCDP(CDP_URL);
assert(b.contexts().flatMap(c=>c.pages()).every(p=>p.url()==='about:blank'),'Blank the owned harness before a region circuit');
const ownership=await browserOwnership(b,{cdpPort:new URL(CDP_URL).port,url:url.href,purpose:'G03 connected seven-destination keyboard circuit, no FPS claim',renderingClients:1});
await fs.writeFile(dir+'/ownership.json',JSON.stringify(ownership,null,2));
const c=await b.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1}),p=await c.newPage(),errors=[];
const report={url:url.href,errors,routes:[],connections:[],samples:[],combatClears:[],initialPlacement:'public developer spawn link only'};
p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
const position=()=>p.evaluate(()=>{const a=ASHEN.player,s=a.getDebugState();return{x:a.body.position.x,y:a.body.position.y,z:a.body.position.z,facing:a.getFacing(),physics:s.usingPhysics,recoveries:s.recoveries,flying:a.isFlying()};});
let initialRecoveries;
const closeHostiles=()=>p.evaluate(()=>{const pos=ASHEN.player.body.position;return ASHEN.combat.enemies.filter(e=>!e.hidden&&e.hp>0&&e.state!=='dead'&&Math.hypot(e.position.x-pos.x,e.position.z-pos.z)<2.6).map(e=>({id:e.id,hp:e.hp,x:e.position.x,z:e.position.z,clear:ASHEN.combat.lineOfSight(e).clear}));});
async function clearBlockingHostiles(label){
 const before=await closeHostiles();if(!before.length)return false;
 const actions=[],start=Date.now(),row={label,before,actions};report.combatClears.push(row);
 // God mode prevents damage, not native enemy-body contact. Clear a crowded
 // doorway through ordinary Tab/Fire Blast controls; never hide NPCs, mutate HP,
 // disable collision or teleport around a failed architectural path.
 while((await closeHostiles()).length){
  assert(Date.now()-start<30000,`${label}: hostile clearing did not finish`);
  const candidates=(await closeHostiles()).filter(e=>e.clear).sort((a,b)=>a.hp-b.hp);
  assert(candidates.length,`${label}: no visible blocking hostile`);
  const desired=candidates[0].id;
  for(let tries=0;tries<8;tries++){
   if(await p.evaluate(()=>ASHEN.combat.targeting.current?.id)===desired)break;
   await p.keyboard.press('Tab');await p.waitForTimeout(80);
  }
  const target=await p.evaluate(()=>ASHEN.combat.targeting.current?.id);assert.equal(target,desired);
  await p.keyboard.press('Digit1');await p.waitForTimeout(1600);
  actions.push({target,remaining:await closeHostiles(),snapshot:await p.evaluate(()=>ASHEN.combat.snapshot())});
  const state=await position();assert(state.physics&&!state.flying);assert.equal(state.recoveries,initialRecoveries);
 }
 row.after=await position();return true;
}
async function go(point,label){
 let state=await position(),distance=Math.hypot(point[0]-state.x,point[2]-state.z),best=distance,lastProgress=Date.now(),start=Date.now(),cleared=false;
 while(distance>.42){
  const desired=Math.atan2(point[0]-state.x,point[2]-state.z),error=Math.atan2(Math.sin(desired-state.facing),Math.cos(desired-state.facing));
  if(Math.abs(error)>.045){await p.keyboard.up('KeyW');const key=error>0?'KeyD':'KeyA';await p.keyboard.down(key);await p.waitForTimeout(Math.max(12,Math.min(150,Math.abs(error)/2.55*1000)));await p.keyboard.up(key);}
  else{await p.keyboard.down('KeyW');await p.waitForTimeout(Math.min(150,Math.max(20,(distance-.3)/7*1000)));}
  state=await position();distance=Math.hypot(point[0]-state.x,point[2]-state.z);
  assert(state.physics&&!state.flying);assert(Number.isFinite(state.y));assert.equal(state.recoveries,initialRecoveries,`${label}: recovery teleport`);
  if(distance<best-.12){best=distance;lastProgress=Date.now();}
  if(Date.now()-lastProgress>5000&&!cleared){
   await p.keyboard.up('KeyW');cleared=await clearBlockingHostiles(label);
   if(cleared){lastProgress=Date.now();best=distance;}
  }
  if(Date.now()-lastProgress>5000||Date.now()-start>75000)throw Error(`Blocked at ${JSON.stringify(state)} toward ${JSON.stringify(point)} (${label}, distance ${distance})`);
 }
 await p.keyboard.up('KeyW');report.samples.push({label,target:point,...state});return state;
}
function corners(points){return points.filter((p,i)=>{if(!i||i===points.length-1)return true;const a=points[i-1],b=points[i+1],ax=p[0]-a[0],az=p[2]-a[2],bx=b[0]-p[0],bz=b[2]-p[2];return Math.abs(ax*bz-az*bx)>.001;});}
async function connect(first,id){
 const start=await position();
 // All authored branches begin on the protected central path. Follow its actual
 // centreline through the existing gates rather than cutting through town pads.
 const points=await p.evaluate(({from,to,well})=>{
  const steps=Math.max(1,Math.ceil(Math.abs(to[2]-from)/8)),low=Math.min(from,to[2]),high=Math.max(from,to[2]);
  const zs=Array.from({length:steps+1},(_,i)=>from+(to[2]-from)*i/steps);
  // The centreline meets Hollowmere's well. Follow the west side of its existing
  // paved square, including both turn anchors so no long segment cuts the ring.
  for(const z of [well.z-8,well.z-4,well.z+4,well.z+6])if(z>low&&z<high)zs.push(z);
  zs.sort((a,b)=>from<to[2]?a-b:b-a);
  const points=zs.map(z=>{
   const path=Math.sin(z*.14)*1.25,west=well.x-2.8;
   let x=path;
   if(z>=well.z-4&&z<=well.z+4)x=west;
   else if(z>well.z-8&&z<well.z-4){const t=(z-(well.z-8))/4;x=Math.sin((well.z-8)*.14)*1.25*(1-t)+west*t;}
   else if(z>well.z+4&&z<well.z+6){const t=(z-(well.z+4))/2;x=west*(1-t)+Math.sin((well.z+6)*.14)*1.25*t;}
   return[x,ASHEN.world.groundHeight(x,z),z];
  });
  points.push(to);return points;
 },{from:start.z,to:first,well:buildingPads[8]});
 for(const point of points)await go(point,`connection:${id}`);
 report.connections.push({id,start,end:await position(),waypoints:points.length});
}
try{
 await p.goto(url.href,{waitUntil:'commit'});await p.waitForFunction(()=>window.ASHEN?.ready&&ASHEN.hostilesReady,null,{timeout:120000});
 const start=await position();report.start=start;initialRecoveries=start.recoveries;assert(start.physics&&!start.flying);
 // Ordinary God toggle keeps enemies from interrupting a geometry test; movement
 // remains native Havok. No hidden gameplay helper is introduced.
 await p.keyboard.press('Escape');await p.getByRole('button',{name:'Developer tools',exact:true}).click();
 const god=p.getByRole('button',{name:'God mode: off',exact:true});if(await god.count())await god.click();
 await p.keyboard.press('Escape');
 const sites=await p.evaluate(()=>ASHEN.world.landmarks.filter(x=>x.route).map(l=>({...l,structure:ASHEN.world.regionStructures.destinations.find(s=>s.id===l.id)})));
 const selected=sites.filter(s=>!process.env.ASHEN_DESTINATION||process.env.ASHEN_DESTINATION.split(',').includes(s.id));
 assert(selected.length>0,'No matching destinations');
 for(const site of selected){
  const path=corners(site.route);await connect(path[0],site.id);const start=await position(),firstSample=report.samples.length;
  console.log(`START ${site.id}, ${path.length} corners; continuous from previous site`);
  for(const point of path.slice(1))await go(point,`${site.id}:approach`);
  await p.screenshot({path:`${dir}/${site.id}-entrance.png`});
  if(site.structure?.courtyard)await go(site.structure.courtyard,`${site.id}:courtyard`);
  await go(site.structure?.interior||[site.x,site.floorY,site.z],`${site.id}:interior`);
  await p.screenshot({path:`${dir}/${site.id}-interior.png`});
  if(site.structure?.courtyard)await go(site.structure.courtyard,`${site.id}:courtyard-return`);
  await go(site.entrance,`${site.id}:threshold-return`);
  for(const point of path.slice(0,-1).reverse())await go(point,`${site.id}:return`);
  const row={id:site.id,start,end:await position(),samples:report.samples.length-firstSample,entered:true,returned:true};report.routes.push(row);
  await fs.writeFile(dir+'/report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(row));
 }
 await connect([start.x,0,start.z],'initial-bridge-return');report.end=await position();
 report.gpuErrors=await p.evaluate(()=>ASHEN.gpu.errors);assert.deepEqual(errors,[]);assert.deepEqual(report.gpuErrors,[]);report.passed=true;
}catch(e){report.failure=e.stack;await p.screenshot({path:dir+'/failure.png'}).catch(()=>{});throw e;}
finally{
 for(const key of ['KeyW','KeyA','KeyD'])await p.keyboard.up(key).catch(()=>{});
 await fs.writeFile(dir+'/report.json',JSON.stringify(report,null,2));await c.close();await b.close();
 await fs.writeFile(dir+'/ownership.json',JSON.stringify({...ownership,active:false,renderingClients:0},null,2));
}
