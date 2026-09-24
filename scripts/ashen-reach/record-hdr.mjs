/** Live V13 movement/cast footage. Camera cuts are explicitly labeled. */
import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {CDP_URL} from '../lib/cdp.mjs';
const dir='ve-capture/ashen-reach/hdr/video';await fs.mkdir(`${dir}/frames`,{recursive:true});
const browser=await chromium.connectOverCDP(CDP_URL),context=await browser.newContext({viewport:{width:1280,height:720}}),page=await context.newPage();
const frames=[],writes=[],errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
const cdp=await context.newCDPSession(page);
cdp.on('Page.screencastFrame',e=>{cdp.send('Page.screencastFrameAck',{sessionId:e.sessionId}).catch(()=>{});const name=`frame-${String(frames.length).padStart(5,'0')}.jpg`;frames.push({name,ts:e.metadata.timestamp});writes.push(fs.writeFile(`${dir}/frames/${name}`,Buffer.from(e.data,'base64')));});
const label=async text=>page.evaluate(t=>document.getElementById('capture-label').textContent=t,text);
const place=async(x,z,yaw=0)=>{await page.evaluate(({x,z,yaw})=>{const a=ASHEN;a.player.setWorldPos(x,a.world.groundHeight(x,z)+1.7,z);a.player.setFacing(yaw);a.rig.yaw=yaw;a.rig.pitch=.12;a.rig.distance=a.rig.distanceTarget=4.5;},{x,z,yaw});await page.waitForTimeout(900);};
try{
 await page.goto('http://127.0.0.1:5173/ashen-reach.html?play&clean&noEnemies',{waitUntil:'commit'});await page.waitForFunction(()=>globalThis.ASHEN?.ready,null,{timeout:90000});
 await page.evaluate(()=>{ASHEN.dev.god=true;const d=document.createElement('div');d.id='capture-label';d.style.cssText='position:fixed;top:20px;left:50%;transform:translateX(-50%);padding:8px 15px;background:#101715dd;color:#ddd4bf;font:16px Georgia;z-index:100;pointer-events:none';document.body.append(d);});
 await place(0,-55);await label('V13 · Shared lighting and exposure · Keyboard movement');
 await cdp.send('Page.startScreencast',{format:'jpeg',quality:90,maxWidth:1280,maxHeight:720,everyNthFrame:1});await page.waitForTimeout(900);
 const start=await page.evaluate(()=>({x:ASHEN.player.body.position.x,z:ASHEN.player.body.position.z}));await page.keyboard.down('KeyW');await page.waitForTimeout(1500);await page.keyboard.press('Space');await page.waitForTimeout(1200);await page.keyboard.up('KeyW');
 const movement=await page.evaluate(s=>Math.hypot(ASHEN.player.body.position.x-s.x,ASHEN.player.body.position.z-s.z),start);assert(movement>3);
 await label('Camera cut · Churchyard spell lighting');await place(0,-2);
 await page.keyboard.press('Tab');await page.keyboard.press('Digit2');await page.waitForTimeout(2800);await page.keyboard.press('Digit1');await page.waitForTimeout(1400);
 const casts=await page.evaluate(()=>({lava:ASHEN.combat.lava.casts,fire:ASHEN.combat.spell.casts,hp:ASHEN.combat.dummy.hp}));
 await label('Camera cut · Town lamps and distant fog');await place(0,98);await page.waitForTimeout(800);await page.keyboard.down('KeyW');await page.waitForTimeout(1800);await page.keyboard.up('KeyW');await page.waitForTimeout(1200);
 await cdp.send('Page.stopScreencast');await Promise.all(writes);
 const concat=['ffconcat version 1.0'];frames.forEach((f,i)=>concat.push(`file 'frames/${f.name}'`,`duration ${Math.max(.008,(frames[i+1]?.ts??f.ts+1/60)-f.ts)}`));if(frames.length)concat.push(`file 'frames/${frames.at(-1).name}'`);
 await fs.writeFile(`${dir}/frames.ffconcat`,concat.join('\n')+'\n');
 const report={movement,casts,frames:frames.length,seconds:frames.at(-1).ts-frames[0].ts,errors,conditions:await page.evaluate(()=>({canvas:[ASHEN.engine.canvas?.width||document.querySelector('canvas').width,document.querySelector('canvas').height],post:ASHEN.post}))};
 await fs.writeFile(`${dir}/report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report));assert.deepEqual(errors,[]);assert(casts.hp<2000,'Actual spell damage during recording');
}finally{await page.keyboard.up('KeyW').catch(()=>{});await context.close();await browser.close();}
