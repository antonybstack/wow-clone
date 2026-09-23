/**
 * Park the gameplay camera on one vista and shoot the SAME framing several times
 * across a span of simulation time, in one page session so the clock keeps running.
 * capture-vistas.mjs reloads the page per run, which restarts the clock and makes it
 * blind to anything that animates -- this is the instrument for drift.
 *
 * node scripts/_tmp-hold.mjs <shotName> <outDir> <gapSeconds> <count>
 */
import {chromium} from 'playwright';
import {CDP_URL} from './lib/cdp.mjs';
import fs from 'node:fs/promises';

const [name,outDir,gap,count]=process.argv.slice(2);
// Inlined rather than imported: capture-vistas.mjs is a top-level script and
// importing it would run a whole capture as a side effect.
const SHOTS={'03-lych-gate':{x:0,z:34,yaw:0,pitch:.10,dist:3.5},
             '08-east-meadow':{x:-46,z:24,yaw:-1.1,pitch:.10,dist:5},
             '07-north-overlook':{x:0,z:142,yaw:0,pitch:.22,dist:6}};
const s=SHOTS[name];
if(!s)throw new Error('no shot '+name);
await fs.mkdir(outDir,{recursive:true});
const browser=await chromium.connectOverCDP(CDP_URL);
const page=browser.contexts()[0].pages().find(p=>p.url().includes('ashen-reach.html'));
await page.setViewportSize({width:1280,height:720});
await page.bringToFront();
await page.goto((process.env.ASHEN_URL)+'&noEnemies',{waitUntil:'commit'});
await page.waitForFunction(()=>window.ASHEN?.ready,null,{timeout:120000});
await page.waitForTimeout(2500);
const park=async()=>page.evaluate(({x,z,yaw,pitch,dist})=>{
 const A=window.ASHEN;
 A.player.setWorldPos(x,A.world.groundHeight(x,z)+1.7,z);
 A.player.setFacing(yaw);
 A.rig.yaw=yaw;A.rig.pitch=pitch;A.rig.distance=A.rig.distanceTarget=dist;
 A.setView('play');
},s);
for(let i=0;i<+count;i++){
 await park();                      // re-park each time: the idle sway drifts the rig
 await page.waitForTimeout(600);
 await page.screenshot({path:`${outDir}/t${i}.png`});
 console.log('t'+i);
 if(i<count-1)await page.waitForTimeout(+gap*1000);
}
await browser.close();
