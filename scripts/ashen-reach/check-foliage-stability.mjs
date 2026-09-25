/** Actual meadow traversal; record separately from performance measurements. */
import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {CDP_URL} from '../lib/cdp.mjs';
import {plantHash,removalRadius,taper} from '../../src/ashen-reach/foliage-lod.js';
const dir=process.env.ASHEN_CAPTURE_DIR||'ve-capture/ashen-reach/v18/check',record=process.argv.includes('--record');
await fs.mkdir(`${dir}/frames`,{recursive:true});
const b=await chromium.connectOverCDP(CDP_URL),c=await b.newContext({viewport:{width:1280,height:720}}),p=await c.newPage();
const errors=[],report={errors},frames=[],writes=[];let cdp;
p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
await p.addInitScript(()=>{window.__gpuErrors=[];const request=GPUAdapter.prototype.requestDevice;GPUAdapter.prototype.requestDevice=async function(...args){const d=await request.apply(this,args);d.addEventListener('uncapturederror',e=>__gpuErrors.push(e.error.message));return d;};});
const wait=()=>p.waitForTimeout(800);
const label=async text=>{await p.evaluate(text=>document.querySelector('#capture-label').textContent=text,text);};
const place=async(x,z,yaw=0)=>{await p.evaluate(({x,z,yaw})=>{const a=ASHEN;a.player.setWorldPos(x,a.world.groundHeight(x,z)+1.7,z);a.player.setFacing(yaw);a.rig.yaw=yaw;a.rig.pitch=.22;a.rig.distance=a.rig.distanceTarget=4.5;},{x,z,yaw});await wait();};
try{
 await p.goto(process.env.ASHEN_TEST_URL||'http://127.0.0.1:5173/ashen-reach.html?play&clean',{waitUntil:'commit'});
 await p.waitForFunction(()=>window.ASHEN?.ready&&ASHEN.world.foliage,null,{timeout:120000});
 report.geometry=await p.evaluate(()=>ASHEN.world.foliage.pools.filter(pool=>/^(Grass|Moor) near$/.test(pool.near.name)).map(pool=>({name:pool.near.name,shared:['positions','normals','uvs','colors'].every(key=>JSON.stringify(pool.near.foliageLayout[key])===JSON.stringify(pool.far.foliageLayout[key])),detailAlpha:pool.near.foliageLayout.detailAlpha})));
 assert.equal(report.geometry.length,2);assert(report.geometry.every(v=>v.shared),'Shared cards must match actual geometry/UV/color buffers');
 assert(report.geometry.every(v=>JSON.stringify(v.detailAlpha)===JSON.stringify([2,2,3,2,3,3])));
 const roots=await p.evaluate(()=>{const pool=ASHEN.world.foliage.pools[0];return Array.from({length:Math.min(32,pool.nearCount)},(_,i)=>[pool.nM[i*16+12],pool.nM[i*16+14]]);});
 assert.equal(roots.length,32,'Probe actual packed instance roots');
 roots.push(...Array.from({length:32},(_,i)=>[Math.fround(-80+i*2.371),Math.fround(-30+i*1.123)]));
 const samples=await p.evaluate(roots=>ASHEN.world.foliage.probe(roots),roots);
 assert.equal(samples.length,64);
 for(const sample of samples){
  const seed=plantHash(...sample.root),end=removalRadius(seed,28,.72,1);
  assert.equal(sample.seed,seed,'CPU/GPU root hashes must match exactly');
  assert(Math.abs(sample.end-end)<.0001);
  assert(Math.abs(sample.moorEnd-removalRadius(seed,185,.85,.9))<.0001);
  assert(Math.abs(sample.scale-taper(end-2,end))<.0001);
 }
 report.gpuPolicySamples=samples.length;
 assert.deepEqual(await p.evaluate(()=>__gpuErrors.slice(0,3)),[],'Shaders must validate before recording');
 await p.evaluate(()=>{ASHEN.dev.god=true;const e=document.createElement('div');e.id='capture-label';e.style.cssText='position:fixed;top:18px;left:50%;transform:translateX(-50%);background:#101715dd;color:#eee;padding:8px 12px;font:14px Georgia;z-index:100';document.body.append(e);});
 await place(-28,-12);await label('Meadow · Continuous movement through streamed grass');
 await p.screenshot({path:`${dir}/start.png`});
 if(record){cdp=await c.newCDPSession(p);cdp.on('Page.screencastFrame',e=>{cdp.send('Page.screencastFrameAck',{sessionId:e.sessionId}).catch(()=>{});const name=`frame-${String(frames.length).padStart(5,'0')}.jpg`;frames.push({name,ts:e.metadata.timestamp});writes.push(fs.writeFile(`${dir}/frames/${name}`,Buffer.from(e.data,'base64')));});await cdp.send('Page.startScreencast',{format:'jpeg',quality:90,maxWidth:1280,maxHeight:720,everyNthFrame:1});}
 await p.waitForTimeout(1000);
 const start=await p.evaluate(()=>({x:ASHEN.player.body.position.x,z:ASHEN.player.body.position.z}));
 await p.keyboard.down('KeyW');await p.waitForTimeout(4000);await p.keyboard.up('KeyW');
 report.movement=await p.evaluate(s=>Math.hypot(ASHEN.player.body.position.x-s.x,ASHEN.player.body.position.z-s.z),start);assert(report.movement>10,'Walk must advance through vegetation');
 await p.screenshot({path:`${dir}/walked.png`});await p.waitForTimeout(1200);
 await label('Camera cut · Moor foliage against the horizon');await place(-60,0,Math.PI/2);await p.waitForTimeout(1800);
 await p.keyboard.down('KeyW');await p.waitForTimeout(2200);await p.keyboard.up('KeyW');await p.screenshot({path:`${dir}/moor.png`});
 report.foliage=await p.evaluate(()=>({stats:ASHEN.world.foliage.stats,pools:ASHEN.world.foliage.pools.map(pool=>({name:pool.near.name,near:pool.nearCount,far:pool.farCount,maxNear:pool.maxNear,maxFar:pool.maxFar,nearDropped:pool.nearDropped,farDropped:pool.farDropped,totalDropped:pool.totalDropped})),gpuErrors:__gpuErrors}));
 assert(report.foliage.pools.every(v=>v.near<=v.maxNear&&v.far<=v.maxFar));
 assert(report.foliage.pools.every(v=>v.totalDropped===0),'No repack during the full route may saturate foliage pools');
 assert(report.foliage.stats.drawnNear>0&&report.foliage.stats.drawnFar>0);
 if(record){await cdp.send('Page.stopScreencast');await Promise.all(writes);const concat=['ffconcat version 1.0'];frames.forEach((f,i)=>concat.push(`file 'frames/${f.name}'`,`duration ${Math.max(.008,(frames[i+1]?.ts??f.ts+1/60)-f.ts)}`));concat.push(`file 'frames/${frames.at(-1).name}'`);await fs.writeFile(`${dir}/frames.ffconcat`,concat.join('\n')+'\n');report.recording={frames:frames.length,seconds:frames.at(-1).ts-frames[0].ts};}
 await p.setViewportSize({width:391,height:843});await wait();await p.screenshot({path:`${dir}/portrait.png`});
 report.foliage.gpuErrors=await p.evaluate(()=>__gpuErrors);
 assert.deepEqual(errors,[]);assert.deepEqual(report.foliage.gpuErrors,[]);report.passed=true;
}catch(e){report.failure=e.stack;throw e;}finally{await p.keyboard.up('KeyW').catch(()=>{});await fs.writeFile(`${dir}/report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report));await c.close();await b.close();}
