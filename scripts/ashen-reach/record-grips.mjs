// Diagnostic close-ups followed by normal gameplay; raw CDP frames, no retouching.
import {chromium} from 'playwright';
import { CDP_URL } from '../lib/cdp.mjs';import fs from 'node:fs/promises';
const dir=process.env.ASHEN_CAPTURE_DIR||'ve-capture/ashen-reach/grips/video';await fs.mkdir(dir+'/frames',{recursive:true});
const browser=await chromium.connectOverCDP(CDP_URL),page=browser.contexts()[0].pages().find(p=>p.url().includes('ashen-reach.html'));
const frames=[],writes=[],errors=[],timeline=[];let recording=false,cdp;page.on('pageerror',e=>errors.push(e.message));
const wait=ms=>page.waitForTimeout(ms),key=k=>page.keyboard.press(k);
try{
 await page.bringToFront();await page.goto(process.env.ASHEN_URL||'http://127.0.0.1:5173/ashen-reach.html?play&clean',{waitUntil:'commit'});await page.waitForFunction(()=>globalThis.ASHEN?.ready);
 await page.evaluate(()=>ASHEN.equipment.equipPreset('graveweaver'));await key('KeyC');await page.locator('[data-light]').check();
 await page.evaluate(()=>{window.__armoryUpdate=ASHEN.armory.update;ASHEN.armory.update=()=>{};document.querySelector('#armory').style.visibility='hidden';ASHEN.body.inspection.setPaused(true);ASHEN.body.inspection.seek(.1);});
 const focus=async(slot,alpha,beta=1.4,radius=.6)=>{await page.evaluate(({slot,alpha,beta,radius})=>{const c=ASHEN.armory.camera,m=ASHEN.combat.fx.sockets.sockets[slot].node.worldMatrix;c.target.set(m[12],m[13]-.055,m[14]);c.radius=radius;c.alpha=alpha;c.beta=beta;},{slot,alpha,beta,radius});await wait(250);};
 const start=Date.now(),mark=label=>timeline.push({seconds:(Date.now()-start)/1000,label});
 cdp=await page.context().newCDPSession(page);cdp.on('Page.screencastFrame',event=>{cdp.send('Page.screencastFrameAck',{sessionId:event.sessionId}).catch(()=>{});if(!recording)return;const name=`frame-${String(frames.length).padStart(5,'0')}.jpg`;frames.push({name,time:event.metadata.timestamp});writes.push(fs.writeFile(dir+'/frames/'+name,Buffer.from(event.data,'base64')));});
 await focus('mainHand',.8);recording=true;await cdp.send('Page.startScreencast',{format:'jpeg',quality:88,maxWidth:1280,maxHeight:832,everyNthFrame:4});
 mark('Gloved staff grip close-up');await page.screenshot({path:dir+'/staff-gloved.png'});await wait(1800);
 await focus('mainHand',2.1,2.0);await wait(1700);
 await page.evaluate(()=>ASHEN.equipment.equip('gloves',null));mark('Bare hand verifies actual finger fit');await wait(1400);await page.screenshot({path:dir+'/staff-bare.png'});
 await page.evaluate(()=>ASHEN.equipment.equip('gloves','graveweaverGloves'));
 await focus('offHand',3.7,1.5);mark('Grimoire carrying strap');await wait(1800);await page.screenshot({path:dir+'/book-gloved.png'});
 await focus('offHand',2.1,2.1);await wait(1600);
 await page.evaluate(()=>ASHEN.equipment.equip('gloves',null));await wait(1200);await page.screenshot({path:dir+'/book-bare.png'});await page.evaluate(()=>ASHEN.equipment.equip('gloves','graveweaverGloves'));
 await page.evaluate(()=>{ASHEN.armory.update=window.__armoryUpdate;delete window.__armoryUpdate;document.querySelector('#armory').style.visibility='';ASHEN.body.inspection.select('run');ASHEN.body.inspection.setPaused(false);ASHEN.armory.camera.radius=3.5;ASHEN.armory.camera.beta=1.36;});await page.locator('[data-view="front"]').click();mark('Running source motion with stable grips');await wait(2400);await page.screenshot({path:dir+'/running.png'});
 await key('Escape');await key('Tab');mark('Normal gameplay: move, jump and cast both spells');await page.keyboard.down('KeyW');await wait(900);await key('Space');await wait(900);await page.keyboard.up('KeyW');await wait(600);await key('Digit1');await wait(1500);await key('Digit2');await wait(2800);
 await key('KeyC');await page.locator('[data-motion]').selectOption('idle');await wait(700);await page.screenshot({path:dir+'/returned.png'});
 recording=false;await cdp.send('Page.stopScreencast');await Promise.all(writes);
 let concat='ffconcat version 1.0\n';for(let i=0;i<frames.length;i++){concat+=`file 'frames/${frames[i].name}'\n`;if(i+1<frames.length)concat+=`duration ${Math.max(.001,frames[i+1].time-frames[i].time).toFixed(6)}\n`;}
 await fs.writeFile(dir+'/frames.ffconcat',concat);await fs.writeFile(dir+'/recording.json',JSON.stringify({frames:frames.length,seconds:frames.at(-1).time-frames[0].time,timeline,errors},null,2));console.log({frames:frames.length,errors});
}finally{recording=false;await page.keyboard.up('KeyW');if(cdp)await cdp.detach();await browser.close();}
