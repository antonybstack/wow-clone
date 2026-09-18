// CDP screencast includes DOM health/cooldown/damage, unlike canvas.captureStream.
import {chromium} from 'playwright';import fs from 'node:fs/promises';
const dir=(process.env.FIRE_BLAST_CAPTURE_DIR||'ve-capture/ashen-reach/fire-blast')+'/video';await fs.mkdir(dir+'/frames',{recursive:true});
const orbit=Number(process.env.FIRE_BLAST_ORBIT||.6);
const lava=process.env.SPELL_CAPTURE==='lava';
const browser=await chromium.connectOverCDP('http://127.0.0.1:9337');const page=browser.contexts()[0].pages().find(p=>p.url().includes('ashen-reach.html'));
let cdp,recording=false;const frames=[],writes=[],errors=[],timeline=[];page.on('pageerror',e=>errors.push(e.message));
const wait=ms=>page.waitForTimeout(ms),key=k=>page.keyboard.press(k);
try{
 await page.bringToFront();await page.goto('http://127.0.0.1:5180/ashen-reach.html?play&clean',{waitUntil:'commit'});await page.waitForFunction(()=>window.ASHEN?.ready,null,{timeout:60000});await wait(1500);await key('Tab');
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
 if(lava){
  mark('Target selected');await wait(800);mark('Lava Ball: charge, release, impact');await key('Digit2');
  await wait(1050);await page.screenshot({path:dir+'/charge.png'});await wait(420);await page.screenshot({path:dir+'/flight.png'});await wait(400);await page.screenshot({path:dir+'/impact.png'});await wait(1500);
  mark('Orbit to side view');const yaw=await page.evaluate(()=>ASHEN.rig.yaw);
  for(let i=1;i<=40;i++){await page.evaluate(({yaw,i})=>{ASHEN.rig.yaw=yaw-1.05*i/40;ASHEN.rig.distanceTarget=5;},{yaw,i});await wait(25);}
  await page.waitForFunction(()=>ASHEN.combat.lava.cooldown===0);mark('Side-view Lava Ball');await key('Digit2');await wait(1100);await page.screenshot({path:dir+'/side-charge.png'});await wait(2900);
  mark('Fire Blast remains available');await key('Digit1');await wait(2100);
 }else{
 mark('Target selected');await wait(800);mark('Stationary Fire Blast');await key('Digit1');await wait(390);await page.screenshot({path:dir+'/impact.png'});await wait(3000);
 mark('Cast while walking');await page.keyboard.down('Shift');await page.keyboard.down('KeyW');await wait(250);await key('Digit1');await wait(650);await page.keyboard.up('KeyW');await page.keyboard.up('Shift');await wait(2700);
 mark('Camera orbit, cast and cooldown rejection');const yaw=await page.evaluate(()=>ASHEN.rig.yaw);for(let i=1;i<=40;i++){await page.evaluate(({yaw,i,orbit})=>{ASHEN.rig.yaw=yaw-orbit*i/40;},{yaw,i,orbit});await wait(25);}await key('Digit1');await wait(400);await key('Digit1');await wait(3000);
 mark('Final cast');await key('Digit1');await wait(2200);
 }
 recording=false;await cdp.send('Page.stopScreencast');await Promise.all(writes);
 const audioData=await page.evaluate(async()=>{const a=window.__spellAudio;a.recorder.stop();await a.done;const blob=new Blob(a.chunks,{type:'audio/webm'}),reader=new FileReader();const data=await new Promise(resolve=>{reader.onload=()=>resolve(reader.result.split(',')[1]);reader.readAsDataURL(blob);});a.capture.dispose();delete window.__spellAudio;return data;});
 await fs.writeFile(dir+'/audio.webm',Buffer.from(audioData,'base64'));
 let concat='ffconcat version 1.0\n';for(let i=0;i<frames.length;i++){concat+=`file 'frames/${frames[i].name}'\n`;if(i+1<frames.length)concat+=`duration ${Math.max(.001,frames[i+1].time-frames[i].time).toFixed(6)}\n`;}
 await fs.writeFile(dir+'/frames.ffconcat',concat);await fs.writeFile(dir+'/recording.json',JSON.stringify({frames:frames.length,seconds:frames.at(-1).time-frames[0].time,timeline,errors,audioOffset:frames[0].time-audioStart},null,2));console.log({frames:frames.length,errors});
}finally{recording=false;await page.keyboard.up('KeyW');await page.keyboard.up('Shift');await page.evaluate(()=>{const a=window.__spellAudio;if(a){if(a.recorder.state!=='inactive')a.recorder.stop();a.capture.dispose();delete window.__spellAudio;}}).catch(()=>{});if(cdp)await cdp.detach();await browser.close();}
