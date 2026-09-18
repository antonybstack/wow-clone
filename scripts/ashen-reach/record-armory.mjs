// CDP screencast includes DOM health/cooldown/damage, unlike canvas.captureStream.
import {chromium} from 'playwright';import fs from 'node:fs/promises';
const graveweaver=process.argv.includes('--graveweaver'),mixed=process.argv.includes('--mixed'),equipment=graveweaver||mixed||process.argv.includes('--equipment');
const dir=`ve-capture/ashen-reach/${graveweaver?'graveweaver':mixed?'mixed-equipment':equipment?'equipment':'armory'}/video`;await fs.mkdir(dir+'/frames',{recursive:true});
const browser=await chromium.connectOverCDP('http://127.0.0.1:9337');const page=browser.contexts()[0].pages().find(p=>p.url().includes('ashen-reach.html'));
let cdp,recording=false;const frames=[],writes=[],errors=[],timeline=[];page.on('pageerror',e=>errors.push(e.message));
const wait=ms=>page.waitForTimeout(ms),key=k=>page.keyboard.press(k);
try{
 await page.bringToFront();await page.goto('http://127.0.0.1:5173/ashen-reach.html?play&clean',{waitUntil:'commit'});await page.waitForFunction(()=>window.ASHEN?.ready,null,{timeout:60000});await wait(1500);await key('Tab');
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
 mark('Open the real character armory');await key('KeyC');await page.locator('[data-light]').check();await wait(1500);
 if(equipment&&!graveweaver){
  mark('Remove and equip separate torso geometry');await page.locator('[data-equipment="torso"]').selectOption('');await wait(900);await page.locator('[data-equipment="torso"]').selectOption('wayfarerTunic');await wait(900);
  mark('Independent boot and weapon selection');await page.locator('[data-equipment="boots"]').selectOption('');await wait(700);await page.locator('[data-equipment="boots"]').selectOption('wayfarerBoots');await page.locator('[data-equipment="mainHand"]').selectOption('ironSword');await wait(800);await page.locator('[data-view="side"]').click();await wait(900);await page.screenshot({path:dir+'/sword-side.png'});await page.locator('[data-view="front"]').click();
 }
 if(graveweaver){
  mark('Complete Graveweaver magic outfit');await page.locator('[data-outfit="graveweaver"]').click();await wait(1800);
  mark('Independent hood, gloves and grimoire');
  for(const [slot,id] of [['helmet','graveweaverHood'],['gloves','graveweaverGloves'],['offHand','graveweaverBook']]){await page.locator(`[data-equipment="${slot}"]`).selectOption('');await wait(550);await page.locator(`[data-equipment="${slot}"]`).selectOption(id);await wait(550);}
  mark('Mix robe skirt with Pilgrim top');await page.locator('[data-equipment="torso"]').selectOption('pilgrimTunic');await wait(1100);
  mark('Mix armored vestment with trousers');await page.locator('[data-equipment="torso"]').selectOption('graveweaverTop');await page.locator('[data-equipment="legs"]').selectOption('wayfarerTrousers');await wait(1100);
  await page.locator('[data-outfit="graveweaver"]').click();await page.locator('[data-view="side"]').click();await wait(1100);await page.screenshot({path:dir+'/staff-side.png'});await page.locator('[data-view="full"]').click();
 }
 if(mixed){
  mark('Mix the cloth torso with existing trousers and boots');await page.locator('[data-equipment="torso"]').selectOption('pilgrimTunic');await wait(1100);
  mark('Independent trouser geometry and waist coverage');await page.locator('[data-equipment="legs"]').selectOption('');await wait(800);await page.locator('[data-equipment="legs"]').selectOption('wayfarerTrousers');await wait(700);
  mark('Boot removal restores full trouser cuffs');await page.locator('[data-equipment="boots"]').selectOption('');await wait(1000);await page.locator('[data-equipment="boots"]').selectOption('wayfarerBoots');await wait(700);
 }
 mark('Original walk clip');await page.locator('[data-motion]').selectOption('walk');await wait(2000);
 mark('Run, then pause and inspect');await page.locator('[data-motion]').selectOption('run');await wait(1700);await page.locator('[data-pause]').click();await page.locator('[data-time-slider]').fill('0.18');await wait(700);
 mark('Orbit the paused skinned pose');await page.mouse.move(660,280);await page.mouse.down();await page.mouse.move(430,295,{steps:45});await page.mouse.up();await wait(900);
 await page.locator('[data-motion]').selectOption('idle');await page.locator('[data-pause]').click();await page.locator('[data-view="back"]').click();await wait(900);await page.screenshot({path:dir+'/back.png'});
 await page.locator('[data-view="front"]').click();mark('Fire Blast pose preview, no combat');await page.locator('[data-motion]').selectOption('fire');await wait(1500);
 mark('Lava Ball pose preview, no combat');await page.locator('[data-motion]').selectOption('lava');await wait(1100);await page.screenshot({path:dir+'/lava-preview.png'});await wait(1300);
 mark('Return to live movement and combat');await key('Escape');await page.keyboard.down('KeyW');await wait(250);await page.keyboard.up('KeyW');await page.keyboard.down('Space');await wait(100);await page.keyboard.up('Space');await wait(850);await key('Digit1');await wait(1800);
 if(equipment){mark('Equipped Lava Ball charge, stow and release');await key('Digit2');await wait(3000);}
 mark('Reopen armory');await key('KeyC');await wait(1200);await page.screenshot({path:dir+'/front.png'});
 recording=false;await cdp.send('Page.stopScreencast');await Promise.all(writes);
 const audioData=await page.evaluate(async()=>{const a=window.__spellAudio;a.recorder.stop();await a.done;const blob=new Blob(a.chunks,{type:'audio/webm'}),reader=new FileReader();const data=await new Promise(resolve=>{reader.onload=()=>resolve(reader.result.split(',')[1]);reader.readAsDataURL(blob);});a.capture.dispose();delete window.__spellAudio;return data;});
 await fs.writeFile(dir+'/audio.webm',Buffer.from(audioData,'base64'));
 let concat='ffconcat version 1.0\n';for(let i=0;i<frames.length;i++){concat+=`file 'frames/${frames[i].name}'\n`;if(i+1<frames.length)concat+=`duration ${Math.max(.001,frames[i+1].time-frames[i].time).toFixed(6)}\n`;}
 await fs.writeFile(dir+'/frames.ffconcat',concat);await fs.writeFile(dir+'/recording.json',JSON.stringify({frames:frames.length,seconds:frames.at(-1).time-frames[0].time,timeline,errors,audioOffset:frames[0].time-audioStart},null,2));console.log({frames:frames.length,errors});
}finally{recording=false;await page.keyboard.up('KeyW');await page.keyboard.up('Shift');await page.evaluate(()=>{const a=window.__spellAudio;if(a){if(a.recorder.state!=='inactive')a.recorder.stop();a.capture.dispose();delete window.__spellAudio;}}).catch(()=>{});if(cdp)await cdp.detach();await browser.close();}
