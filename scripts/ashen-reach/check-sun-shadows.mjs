/** Live near-sun receiver, actor silhouette, input and resize regression. */
import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {CDP_URL} from '../lib/cdp.mjs';

const tagIndex=process.argv.indexOf('--tag');
const tag=tagIndex>=0?process.argv[tagIndex+1]:'v11-check';
const dir=`ve-capture/ashen-reach/sun-shadows/${tag}`;
await fs.mkdir(dir,{recursive:true});
const browser=await chromium.connectOverCDP(CDP_URL);
const page=browser.contexts()[0].pages().find(p=>p.url().includes('ashen-reach'))||await browser.contexts()[0].newPage();
const errors=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('console',m=>{if(m.type()==='error'||/validation|invalid.*(bind|shader|command|pipeline)/i.test(m.text()))errors.push(m.text());});
try{
 await page.setViewportSize({width:1280,height:720});
 await page.goto(process.env.ASHEN_URL||'http://127.0.0.1:5173/ashen-reach.html?play&clean',{waitUntil:'commit'});
 await page.waitForFunction(()=>window.ASHEN?.ready&&ASHEN.hostilesReady,null,{timeout:90000});
 const place=async(x,z,yaw=0)=>{
  await page.evaluate(({x,z,yaw})=>{const A=ASHEN;A.setView('play');A.player.setWorldPos(x,A.world.groundHeight(x,z)+1.7,z);A.player.setFacing(yaw);A.rig.yaw=yaw;A.rig.pitch=.24;A.rig.distance=A.rig.distanceTarget=5;},{x,z,yaw});
  await page.waitForTimeout(1300);
 };
 await place(0,-60);
 const points=await page.evaluate(()=>{
  const p=ASHEN.player.body.position,pts=[];
  for(let z=p.z-9;z<=p.z;z+=.25)for(let x=p.x-.5;x<=p.x+4.5;x+=.25)pts.push([x,ASHEN.world.groundHeight(x,z)+.04,z]);
  return pts;
 });
 const cast=await page.evaluate(points=>ASHEN.shadows.probeSun(points),points);
 await page.screenshot({path:`${dir}/actor-shadow.png`});
 await page.evaluate(()=>{ASHEN.shadows.state.characters=false;});await page.waitForTimeout(200);
 const noCast=await page.evaluate(points=>ASHEN.shadows.probeSun(points),points);
 await page.screenshot({path:`${dir}/actor-no-shadow.png`});
 const actorShadowSamples=cast.filter((p,i)=>noCast[i].visibility-p.visibility>.5).length;
 assert(actorShadowSamples>5,`Actor silhouette affected only ${actorShadowSamples} ground samples`);
 await page.evaluate(()=>{ASHEN.shadows.state.characters=true;});await page.waitForTimeout(200);
 const before=await page.evaluate(()=>({x:ASHEN.player.body.position.x,z:ASHEN.player.body.position.z,v:ASHEN.shadows.state.version}));
 await page.keyboard.down('KeyW');await page.waitForTimeout(2200);await page.keyboard.up('KeyW');
 const after=await page.evaluate(()=>({x:ASHEN.player.body.position.x,z:ASHEN.player.body.position.z,v:ASHEN.shadows.state.version}));
 const movement=Math.hypot(after.x-before.x,after.z-before.z);
 assert(movement>3,'Keyboard traversal failed');assert(after.v>before.v+20,'Animated map did not refresh');
 await page.screenshot({path:`${dir}/walking-end.png`});
 await place(0,95);
 const receivers=await page.evaluate(()=>ASHEN.scene.meshes.filter(m=>m.visible!==false&&['pbr','standard'].includes(m.material?._buildGroup?._materialFamily)).map(m=>({name:m.name,receive:m.receiveShadows})));
 assert(receivers.length>3&&receivers.every(m=>m.receive),'Visible PBR actor missing sunlight reception');
 const streetPoint=await page.evaluate(()=>[0,ASHEN.world.groundHeight(0,95)+.06,95]);
 const street=await page.evaluate(p=>ASHEN.shadows.probeSun([p]),streetPoint);
 await page.screenshot({path:`${dir}/street-shadowed.png`});
 await page.evaluate(()=>ASHEN.shadows.setEnabled(false));await page.waitForTimeout(200);
 const unshadowed=await page.evaluate(p=>ASHEN.shadows.probeSun([p]),streetPoint);
 await page.screenshot({path:`${dir}/street-unshadowed.png`});
 assert(street[0].visibility<.5&&unshadowed[0].visibility>.99,'Street solar occlusion toggle failed');
 await page.evaluate(()=>ASHEN.shadows.setEnabled(true));
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(800);
 await page.screenshot({path:`${dir}/portrait.png`});
 const portrait=await page.evaluate(()=>({...ASHEN.volumetric.state}));
 assert(portrait.resolution[0]<portrait.resolution[1]);
 await page.setViewportSize({width:1280,height:720});await page.waitForTimeout(400);
 const state=await page.evaluate(()=>({...ASHEN.shadows.state}));
 const report={actorShadowSamples,movement,versions:[before.v,after.v],street,unshadowed,receivers,state,portrait,errors};
 await fs.writeFile(`${dir}/report.json`,JSON.stringify(report,null,2));
 console.log(JSON.stringify({actorShadowSamples,movement,receivers:receivers.length,state,errors:errors.map(e=>e.split('\n')[0])}));
 assert.equal(errors.length,0,'Runtime or GPU errors');
}finally{
 await page.keyboard.up('KeyW').catch(()=>{});
 await page.evaluate(()=>{if(window.ASHEN?.shadows){ASHEN.shadows.setEnabled(true);ASHEN.shadows.state.characters=true;}}).catch(()=>{});
 await browser.close();
}
