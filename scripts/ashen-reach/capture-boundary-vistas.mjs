/** Matched live views for the 2026-09-23 outer-world seam repair.
 * Usage: node scripts/ashen-reach/capture-boundary-vistas.mjs --tag before
 */
import {chromium} from 'playwright';
import {CDP_URL} from '../lib/cdp.mjs';
import fs from 'node:fs/promises';

const tagIndex=process.argv.indexOf('--tag');
const tag=tagIndex>=0?process.argv[tagIndex+1]:'review';
if(!/^[a-z0-9-]+$/i.test(tag))throw new Error('Use a simple --tag name');
const dir=`ve-capture/ashen-reach/world-vista-repair/${tag}`;
await fs.mkdir(dir,{recursive:true});
const views=[
 {name:'01-hollowmere-aerial',x:0,z:113,lift:23,yaw:0,pitch:.18,dist:8},
 {name:'02-south-rim',x:0,z:-77,lift:16,yaw:Math.PI,pitch:.12,dist:7},
 {name:'03-east-rim',x:75,z:45,lift:16,yaw:Math.PI/2,pitch:.12,dist:7},
 {name:'04-town-ground',x:0,z:119,lift:0,yaw:0,pitch:.12,dist:5},
 {name:'05-citadel-west',x:-70,z:130,lift:20,yaw:.37,pitch:.12,dist:7},
 {name:'06-citadel-east',x:70,z:130,lift:20,yaw:-.37,pitch:.12,dist:7},
];
const browser=await chromium.connectOverCDP(CDP_URL);
const context=browser.contexts()[0];
const page=context.pages().find(p=>p.url().includes('ashen-reach.html'))||await context.newPage();
const errors=[];
page.on('pageerror',e=>errors.push(String(e.message)));
await page.setViewportSize({width:1280,height:720});
await page.bringToFront();
await page.goto((process.env.ASHEN_URL||'http://127.0.0.1:5173/ashen-reach.html?play&clean')+'&noEnemies',{waitUntil:'commit'});
await page.waitForFunction(()=>window.ASHEN?.ready,null,{timeout:120000});
await page.waitForTimeout(1800);
const stats=await page.evaluate(()=>window.ASHEN.world.stats);
for(const view of views){
 await page.evaluate(({x,z,lift,yaw,pitch,dist})=>{
  const a=window.ASHEN;
  a.setView('play');
  a.player.setFlying(true);
  a.player.setWorldPos(x,a.world.groundHeight(x,z)+1.7+lift,z);
  a.player.setFacing(yaw);
  a.rig.yaw=yaw;
  a.rig.pitch=pitch;
  a.rig.distance=a.rig.distanceTarget=dist;
 },view);
 await page.waitForTimeout(800);
 await page.screenshot({path:`${dir}/${view.name}.png`});
 console.log(view.name);
}
await fs.writeFile(`${dir}/capture.json`,JSON.stringify({tag,views,stats,errors},null,2));
console.log(JSON.stringify({stats,errors}));
await browser.close();
