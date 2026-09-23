/**
 * Environment/lighting evidence shots. A fixed set of vistas at ordinary gameplay
 * framing (over-the-shoulder, fov 1.05), re-shot identically before and after any
 * environment change so before/after comparisons are matched by construction.
 *
 * Usage: node scripts/ashen-reach/capture-vistas.mjs --tag baseline
 */
import {chromium} from 'playwright';
import {CDP_URL} from '../lib/cdp.mjs';
import fs from 'node:fs/promises';

const arg=(k,d)=>{const i=process.argv.indexOf(`--${k}`);return i>=0?process.argv[i+1]:d;};
const tag=arg('tag','baseline');
const outDir=`ve-capture/ashen-reach/env-lighting/${tag}`;
await fs.mkdir(outDir,{recursive:true});

// Ordinary gameplay rig: third-person, dist 3.5, pitch .04 unless the shot is a vista
// that needs to look up at the skyline. Player is planted on the terrain at each spot.
export const SHOTS=[
 {name:'01-churchyard-spawn',   x:0,   z:0,    yaw:0,     pitch:.04, dist:3.5},
 {name:'02-churchyard-south',   x:0,   z:8,    yaw:Math.PI,pitch:.06,dist:3.5},
 {name:'03-lych-gate',          x:0,   z:34,   yaw:0,     pitch:.10, dist:3.5},
 {name:'04-town-gate-vista',    x:0,   z:68,   yaw:0,     pitch:.25, dist:6},
 {name:'05-main-street',        x:0,   z:98,   yaw:0,     pitch:.06, dist:3.5},
 {name:'06-well-plaza',         x:0,   z:130,  yaw:0,     pitch:.12, dist:4.5},
 {name:'07-north-overlook',     x:0,   z:142,  yaw:0,     pitch:.22, dist:6},
 {name:'08-east-meadow',        x:-46, z:24,   yaw:-1.1,  pitch:.10, dist:5},
 {name:'09-west-treeline',      x:44,  z:60,   yaw:1.3,   pitch:.12, dist:5},
 {name:'10-ridge-west',         x:-80, z:110,  yaw:-0.9,  pitch:.20, dist:6},
 {name:'11-silhouette-back',    x:0,   z:120,  yaw:Math.PI,pitch:.10,dist:4},
 {name:'12-wide-south-vista',   x:0,   z:-60,  yaw:Math.PI,pitch:.20,dist:8},
];

const browser=await chromium.connectOverCDP(CDP_URL);
const context=browser.contexts()[0];
const page=context.pages().find(p=>p.url().includes('ashen-reach.html'))||await context.newPage();
await page.setViewportSize({width:1280,height:720});
await page.bringToFront();
await page.goto((process.env.ASHEN_URL||'http://127.0.0.1:5173/ashen-reach.html?play&clean')+'&noEnemies',{waitUntil:'commit'});
await page.waitForFunction(()=>window.ASHEN?.ready,null,{timeout:120000});
await page.waitForTimeout(2500);

const stats=await page.evaluate(()=>window.ASHEN.world.stats);
for(const s of SHOTS){
 await page.evaluate(({x,z,yaw,pitch,dist})=>{
  const A=window.ASHEN;
  A.player.setWorldPos(x,A.world.groundHeight(x,z)+1.7,z);
  A.player.setFacing(yaw);
  A.rig.yaw=yaw;A.rig.pitch=pitch;A.rig.distance=A.rig.distanceTarget=dist;
  A.setView('play');
 },s);
 await page.waitForTimeout(900);
 await page.screenshot({path:`${outDir}/${s.name}.png`});
 console.log('shot',s.name);
}
await fs.writeFile(`${outDir}/shots.json`,JSON.stringify({tag,stats,shots:SHOTS},null,2));
console.log('stats',JSON.stringify(stats));
console.log('done ->',outDir);
process.exit(0);
