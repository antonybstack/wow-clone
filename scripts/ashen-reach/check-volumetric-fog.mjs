/** Live GPU shadow-map checks against independent world-triangle raycasts. */
import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import {CDP_URL} from '../lib/cdp.mjs';
const tagIndex=process.argv.indexOf('--tag');
const tag=tagIndex>=0?process.argv[tagIndex+1]:'v10-check';
const dir=`ve-capture/ashen-reach/volumetric/${tag}`;
await fs.mkdir(dir,{recursive:true});
const browser=await chromium.connectOverCDP(CDP_URL);
const page=browser.contexts()[0].pages().find(p=>p.url().includes('ashen-reach.html'))||await browser.contexts()[0].newPage();
const errors=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('console',m=>{if(m.type()==='error'||/validation|shader.*error/i.test(m.text()))errors.push(m.text());});
await page.setViewportSize({width:1280,height:720});
await page.goto('http://127.0.0.1:5173/ashen-reach.html?play&clean&noEnemies',{waitUntil:'commit'});
await page.waitForFunction(()=>window.ASHEN?.ready,null,{timeout:90000});
await page.waitForTimeout(1500);
const probes=await page.evaluate(async()=>{
 const A=ASHEN,points=[];
 for(const x of [-120,-60,0,60,120])for(const z of [100,180,260])for(const above of [10,35,75]){
  points.push([x,A.world.groundHeight(x,z)+above,z]);
 }
 return A.volumetric.probeSun(points);
});
for(const [name,x,z,lift,yaw] of [['north',0,113,23,0],['west',-65,130,12,.37],['street',0,98,0,0]]){
 await page.evaluate(({x,z,lift,yaw})=>{
  window.__volumeHold?.();let active=true;window.__volumeHold=()=>active=false;
  const step=()=>{if(!active)return;const A=ASHEN;A.setView('play');A.player.setWorldPos(x,A.world.groundHeight(x,z)+1.7+lift,z);
   A.player.setFacing(yaw);A.rig.yaw=yaw;A.rig.pitch=.12;A.rig.distance=A.rig.distanceTarget=lift?7:4;requestAnimationFrame(step);};step();
 },{x,z,lift,yaw});
 for(const [mode,shadows,debug] of [['shadowed',true,0],['unshadowed',false,0],['visibility',true,1]]){
  await page.evaluate(({shadows,debug})=>Object.assign(ASHEN.volumetric.state,{shadows,debug}),{shadows,debug});
  await page.waitForTimeout(500);await page.screenshot({path:`${dir}/${name}-${mode}.png`});
 }
}
await page.evaluate(()=>{window.__volumeHold?.();Object.assign(ASHEN.volumetric.state,{debug:0,shadows:true});});
const ridgePoints=probes.filter(p=>p.blocker==='Distant mauve ridges').map(p=>p.point);
await page.evaluate(()=>ASHEN.volumetric.setCasters(ASHEN.volumetric.casters.filter(m=>m.name!=='Distant mauve ridges')));
await page.waitForTimeout(400);
const withoutRidges=await page.evaluate(points=>ASHEN.volumetric.probeSun(points),ridgePoints);
await page.evaluate(()=>ASHEN.volumetric.setCasters(ASHEN.volumetric.casters));
await page.waitForTimeout(400);
const restored=await page.evaluate(points=>ASHEN.volumetric.probeSun(points),ridgePoints);
const shadowVersion=await page.evaluate(()=>ASHEN.volumetric.state.shadowVersion);
const before=await page.evaluate(()=>{const p=ASHEN.player.body.position;return {x:p.x,z:p.z};});
await page.keyboard.down('KeyW');await page.waitForTimeout(700);await page.keyboard.up('KeyW');
const after=await page.evaluate(()=>{const p=ASHEN.player.body.position;return {x:p.x,z:p.z};});
const movement=Math.hypot(after.x-before.x,after.z-before.z);
const cacheStable=await page.evaluate(version=>ASHEN.volumetric.state.shadowVersion===version,shadowVersion);
await page.setViewportSize({width:390,height:844});await page.waitForTimeout(700);
await page.screenshot({path:`${dir}/portrait-resize.png`});
const portrait=await page.evaluate(()=>({...ASHEN.volumetric.state}));
await page.setViewportSize({width:1280,height:720});await page.waitForTimeout(500);
const state=await page.evaluate(()=>({...ASHEN.volumetric.state,lightMatrix:ASHEN.volumetric.lightMatrix}));
const matches=probes.filter(p=>Boolean(p.gpuLit)===p.cpuLit).length;
const ridgeRemovedLit=withoutRidges.filter(p=>p.gpuLit).length;
const ridgeRestoredBlocked=restored.filter(p=>!p.gpuLit).length;
const report={state,probes,matches,total:probes.length,lit:probes.filter(p=>p.gpuLit).length,ridgeRemovedLit,ridgeRestoredBlocked,ridgePoints:ridgePoints.length,movement,cacheStable,portrait,errors};
await fs.writeFile(`${dir}/report.json`,JSON.stringify(report,null,2));
console.log(JSON.stringify({matches,total:probes.length,lit:report.lit,ridgeRemovedLit,ridgeRestoredBlocked,movement,cacheStable,portrait:portrait.resolution,errors}));
await page.evaluate(()=>{window.__volumeHold?.();Object.assign(ASHEN.volumetric.state,{debug:0,shadows:true});});
await browser.close();
if(errors.length||matches/probes.length<.9||report.lit===0||report.lit===probes.length||ridgeRemovedLit<1||ridgeRestoredBlocked!==ridgePoints.length||!Number.isFinite(movement)||movement<1||!cacheStable||portrait.resolution[0]>=portrait.resolution[1])throw new Error('Volume shadow verification failed; inspect report and live captures');
