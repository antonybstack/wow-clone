// End-to-end two-handed walkthrough: CDP screencast (includes DOM HUD) + real
// engine audio. Encode with the documented workflow using the bundled ffmpeg.
import {chromium} from 'playwright';
import { CDP_URL } from '../lib/cdp.mjs';import fs from 'node:fs/promises';
const dir=process.env.ASHEN_CAPTURE_DIR||'ve-capture/ashen-reach/two-handed/video';await fs.mkdir(dir+'/frames',{recursive:true});
const browser=await chromium.connectOverCDP(CDP_URL);const page=browser.contexts()[0].pages().find(p=>p.url().includes('ashen-reach.html'));
let cdp,recording=false;const frames=[],writes=[],errors=[],timeline=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
const wait=ms=>page.waitForTimeout(ms),key=k=>page.keyboard.press(k);
try{
 await page.bringToFront();await page.goto((process.env.ASHEN_URL||'http://127.0.0.1:5173/ashen-reach.html?play&clean'),{waitUntil:'commit'});await page.waitForFunction(()=>window.ASHEN?.ready,null,{timeout:60000});await wait(1500);await key('Tab');
 const audioStart=await page.evaluate(()=>{
  const capture=ASHEN.combat.audio.capture(),recorder=new MediaRecorder(capture.stream,{mimeType:'audio/webm;codecs=opus'}),chunks=[];
  const done=new Promise(resolve=>recorder.onstop=resolve);recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
  window.__spellAudio={capture,recorder,chunks,done};recorder.start(250);return Date.now()/1000;
 });
 cdp=await page.context().newCDPSession(page);
 cdp.on('Page.screencastFrame',event=>{
  cdp.send('Page.screencastFrameAck',{sessionId:event.sessionId}).catch(()=>{});
  if(!recording)return;
  const name=`frame-${String(frames.length).padStart(5,'0')}.jpg`;frames.push({name,time:event.metadata.timestamp});writes.push(fs.writeFile(dir+'/frames/'+name,Buffer.from(event.data,'base64')));
 });
 const start=Date.now();recording=true;await cdp.send('Page.startScreencast',{format:'jpeg',quality:85,maxWidth:1280,maxHeight:720,everyNthFrame:4});
 const mark=label=>timeline.push({seconds:(Date.now()-start)/1000,label});
 mark('Open the armory and equip the two-handed greatstaff');await key('KeyC');await page.locator('[data-light]').check();
 await page.locator('[data-outfit="warden"]').click();await page.waitForFunction(()=>!ASHEN.equipment.getStatus?.().pending);await wait(1200);
 mark('Two-handed carry pose (front)');await page.locator('[data-view="front"]').click();await page.locator('[data-motion]').selectOption('carry');await wait(1600);
 mark('Carry pose (side), scrubbed');await page.locator('[data-view="side"]').click();await page.locator('[data-time-slider]').fill('0.6');await wait(900);
 mark('Return to gameplay carrying the greatstaff');await key('Escape');await page.keyboard.down('KeyW');await wait(1600);await page.keyboard.up('KeyW');await wait(500);
 mark('Fire Blast: stow, release, recovery');await key('Digit1');await wait(2200);
 mark('Lava Ball: stationary charge, release, recovery');await key('Digit2');await wait(3600);
 mark('Both hands re-grip; walk again');await page.keyboard.down('KeyW');await wait(1200);await page.keyboard.up('KeyW');await wait(500);
 mark('Reopen the armory');await key('KeyC');await wait(1000);await page.screenshot({path:dir+'/front.png'});
 recording=false;await cdp.send('Page.stopScreencast');await Promise.all(writes);
 const audioData=await page.evaluate(async()=>{const a=window.__spellAudio;a.recorder.stop();await a.done;const blob=new Blob(a.chunks,{type:'audio/webm'}),reader=new FileReader();const data=await new Promise(resolve=>{reader.onload=()=>resolve(reader.result.split(',')[1]);reader.readAsDataURL(blob);});a.capture.dispose();delete window.__spellAudio;return data;});
 await fs.writeFile(dir+'/audio.webm',Buffer.from(audioData,'base64'));
 let concat='ffconcat version 1.0\n';for(let i=0;i<frames.length;i++){concat+=`file 'frames/${frames[i].name}'\n`;if(i+1<frames.length)concat+=`duration ${Math.max(.001,frames[i+1].time-frames[i].time).toFixed(6)}\n`;}
 await fs.writeFile(dir+'/frames.ffconcat',concat);await fs.writeFile(dir+'/recording.json',JSON.stringify({frames:frames.length,seconds:frames.at(-1).time-frames[0].time,timeline,errors,audioOffset:frames[0].time-audioStart},null,2));console.log(JSON.stringify({frames:frames.length,seconds:Math.round(frames.at(-1).time-frames[0].time),errors}));
}finally{recording=false;await page.keyboard.up('KeyW').catch(()=>{});await page.keyboard.up('Shift').catch(()=>{});await page.evaluate(()=>{const a=window.__spellAudio;if(a){if(a.recorder.state!=='inactive')a.recorder.stop();a.capture.dispose();delete window.__spellAudio;}}).catch(()=>{});if(cdp)await cdp.detach();await browser.close();}
