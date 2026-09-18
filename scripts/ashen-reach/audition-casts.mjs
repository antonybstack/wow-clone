import {chromium} from 'playwright';import fs from 'node:fs/promises';
const dir='ve-capture/ashen-reach/cast-motion/audition',b=await chromium.connectOverCDP('http://127.0.0.1:9337'),p=b.contexts()[0].pages().find(p=>p.url().includes('ashen-reach'));
try{
 await p.bringToFront();await p.goto('http://127.0.0.1:5173/ashen-reach.html?play&clean',{waitUntil:'commit'});await p.waitForFunction(()=>window.ASHEN?.ready,null,{timeout:60000});await p.waitForTimeout(500);
 await p.evaluate(async()=>{const src=await(await fetch('/src/ashen-reach/main.js')).text(),url=src.match(/from\s*["']([^"']*babylonjs_lite[^"']*)["']/)[1];window.__lite=await import(url);ASHEN.body.update=()=>{};ASHEN.rig.yaw=Math.PI*.65;ASHEN.rig.distance=ASHEN.rig.distanceTarget=3.3;ASHEN.rig.pitch=.08;document.querySelector('#combat').hidden=true;});
 const clips=['Spell_Simple_Enter','Spell_Simple_Shoot','Spell_Simple_Exit','Punch_Cross'];let index=0;
 for(const name of clips)for(const phase of [.05,.33,.66,.95]){
  await p.evaluate(({name,phase})=>{const l=__lite,body=ASHEN.body;for(const g of body.animationGroups){l.stopAnimation(g);l.setAnimationWeight(g,0);g.mask=undefined;}const clip=body.animationGroups.find(g=>g.name===name);clip.speedRatio=0;clip.loopAnimation=false;l.playAnimation(clip);l.setAnimationWeight(clip,1);clip.currentTime=clip.duration*phase;l.updateAnimationManager(body.manager,0);},{name,phase});await p.waitForTimeout(60);await p.screenshot({path:`${dir}/${String(index++).padStart(2,'0')}-${name}-${phase}.jpg`});
 }
}finally{await p.goto('http://127.0.0.1:5173/ashen-reach.html?play&clean',{waitUntil:'commit'});await b.close();}
