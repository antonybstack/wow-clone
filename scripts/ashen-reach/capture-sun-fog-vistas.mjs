/** Matched live-game views for the user-supplied golden-hour fog reference. */
import {chromium} from 'playwright';
import {CDP_URL} from '../lib/cdp.mjs';
import fs from 'node:fs/promises';
import sharp from 'sharp';

const tagIndex=process.argv.indexOf('--tag');
const tag=tagIndex>=0?process.argv[tagIndex+1]:null;
if(!tag||tag.startsWith('--'))throw new Error('Usage: capture-sun-fog-vistas.mjs --tag <unique-tag>');
const dir=`ve-capture/ashen-reach/sun-fog/${tag}`;
await fs.mkdir(dir,{recursive:true});
const shots=[
 {name:'01-churchyard',x:0,z:0,yaw:0,pitch:.04,dist:3.5,lift:0},
 {name:'02-main-street',x:0,z:98,yaw:0,pitch:.06,dist:3.5,lift:0},
 {name:'03-town-rim',x:0,z:130,yaw:0,pitch:.12,dist:4.5,lift:0},
 {name:'04-elevated-west',x:-70,z:130,yaw:.37,pitch:.12,dist:7,lift:20},
 {name:'05-elevated-center',x:0,z:113,yaw:0,pitch:.18,dist:8,lift:23},
 {name:'06-south-return',x:0,z:120,yaw:Math.PI,pitch:.10,dist:4,lift:0},
];
const browser=await chromium.connectOverCDP(CDP_URL);
const page=browser.contexts()[0].pages().find(p=>p.url().includes('ashen-reach.html'))||await browser.contexts()[0].newPage();
const errors=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
await page.setViewportSize({width:1280,height:720});
await page.goto((process.env.ASHEN_URL||'http://127.0.0.1:5173/ashen-reach.html?play&clean')+'&noEnemies',{waitUntil:'commit'});
await page.waitForFunction(()=>window.ASHEN?.ready,null,{timeout:120000});
await page.waitForTimeout(1500);
for(const shot of shots){
 await page.evaluate(s=>{
  window.__sunFogHold?.();
  let active=true;
  const step=()=>{
   if(!active)return;
   const A=window.ASHEN;
   A.player.setWorldPos(s.x,A.world.groundHeight(s.x,s.z)+1.7+s.lift,s.z);
   A.player.setFacing(s.yaw);
   A.rig.yaw=s.yaw;A.rig.pitch=s.pitch;A.rig.distance=A.rig.distanceTarget=s.dist;
   A.setView('play');
   requestAnimationFrame(step);
  };
  window.__sunFogHold=()=>{active=false;};
  step();
 },shot);
 await page.waitForTimeout(850);
 const png=await page.screenshot({path:`${dir}/${shot.name}.png`});
 const center=await sharp(png).extract({left:400,top:190,width:100,height:100}).stats();
 if(center.channels.slice(0,3).every(ch=>ch.mean<8))errors.push(`${shot.name}: world shader rendered black`);
 console.log(shot.name);
}
await page.evaluate(()=>window.__sunFogHold?.());
await fs.writeFile(`${dir}/shots.json`,JSON.stringify({tag,shots,errors},null,2));
console.log('done ->',dir,'errors',errors.length);
await page.goto('http://127.0.0.1:5173/ashen-reach.html?play&clean',{waitUntil:'commit'});
await browser.close();
if(errors.length)throw new Error(errors.slice(0,5).join('\n'));
