import {chromium} from 'playwright';
import fs from 'node:fs/promises';
const dir=process.env.ANIMATION_CAPTURE_DIR||'ve-capture/ashen-reach/animation-review';await fs.mkdir(dir,{recursive:true});
const browser=await chromium.connectOverCDP('http://127.0.0.1:9337');
const page=browser.contexts()[0].pages().find(p=>p.url().includes('ashen-reach.html'));
if(!page)throw new Error('Open Ashen Reach before recording.');
const held=new Set(),errors=[];page.on('pageerror',e=>errors.push(e.message));
const down=async k=>{held.add(k);await page.keyboard.down(k);};
const up=async k=>{await page.keyboard.up(k);held.delete(k);};
const wait=ms=>page.waitForTimeout(ms);
try{
 await page.bringToFront();const diagnosticUrl=new URL(page.url());diagnosticUrl.searchParams.set('animationLab','');await page.goto(diagnosticUrl.href);await page.waitForFunction(()=>window.ASHEN?.ready,null,{timeout:120000});
 await page.evaluate(()=>{ASHEN.reset();ASHEN.setView('play');document.body.classList.add('clean');});await wait(1400);
 await page.evaluate(()=>{
  const canvas=document.querySelector('canvas'),stream=canvas.captureStream(30);
  const mime=['video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm'].find(t=>MediaRecorder.isTypeSupported(t));
  const recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:7000000});
  const chunks=[];recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
  window.__animationRecording={recorder,stream,chunks,start:performance.now(),phase:'Idle',timeline:[],samples:[],mime};
  const r=window.__animationRecording;r.done=new Promise(resolve=>recorder.onstop=()=>resolve());
  r.timer=setInterval(()=>r.samples.push({t:(performance.now()-r.start)/1000,phase:r.phase,channelHeld:!!(ASHEN.input.castHold||ASHEN.input.spellHeld2),motion:ASHEN.player.getDebugState(),animation:ASHEN.body.getState(),clip:ASHEN.body.getClipLabel(),playing:ASHEN.body.getPlaying()}),100);
  recorder.start(250);
 });
 const phase=async name=>{await page.evaluate(name=>{const r=window.__animationRecording;r.phase=name;r.timeline.push({t:(performance.now()-r.start)/1000,name});},name);console.log(name);};
 await phase('Idle, rear view');await wait(1500);
 await phase('Walk (Shift + W)');await down('Shift');await down('KeyW');await wait(2500);
 await phase('Walk to sprint transition');await up('Shift');await wait(1400);await up('KeyW');
 await phase('Sprint to idle');await wait(1000);
 await phase('Turn in place (D)');await down('KeyD');await wait(1180);await up('KeyD');await wait(350);
 await phase('Strafe left / right (Q / E)');await down('KeyQ');await wait(650);await up('KeyQ');await down('KeyE');await wait(650);await up('KeyE');
 await phase('Run back along path');await down('KeyW');await wait(1300);
 await phase('Running jump');await down('Space');await wait(150);await up('Space');await wait(850);await up('KeyW');await wait(800);
 await phase('Standing jump and landing');await down('Space');await wait(150);await up('Space');await wait(1350);
 await phase('Camera orbit to inspect front posture');
 const yaw=await page.evaluate(()=>ASHEN.rig.yaw);
 for(let i=1;i<=30;i++){await page.evaluate(({yaw,i})=>{ASHEN.rig.yaw=yaw+Math.PI*i/30;},{yaw,i});await wait(35);}
 await phase('Single cast gesture (1; no spell effects in this POC)');await down('Digit1');await wait(100);await up('Digit1');await wait(1300);
 await phase('Channel gesture (2; no spell effects in this POC)');await down('Digit2');await wait(1600);await up('Digit2');await wait(900);
 await phase('Backward locomotion (S)');await down('KeyS');await wait(1000);await up('KeyS');
 if(process.env.ANIMATION_EXTENDED){
  await phase('Diagonal walk (Shift + W + E)');await down('Shift');await down('KeyW');await down('KeyE');await wait(1200);await up('KeyE');await up('KeyW');await up('Shift');await wait(300);
  await phase('Walking channel (Shift + W + 2)');await down('Shift');await down('KeyW');await down('Digit2');await wait(1600);await up('KeyW');await up('Shift');
  await phase('Jump interrupts held channel');await down('Space');await wait(120);await up('Space');await wait(1450);
  await phase('Hold stays interrupted after landing');await wait(800);await up('Digit2');await wait(200);
  await phase('Fresh press resumes channel');await down('Digit2');await wait(1100);
  await phase('Single cast interrupts held channel');await down('Digit1');await wait(100);await up('Digit1');await wait(1300);await up('Digit2');await wait(250);
  await phase('Quick tap channel and exit');await down('Digit2');await wait(100);await up('Digit2');await wait(900);
 }
 await phase('Final idle');await wait(1500);
 const result=await page.evaluate(async()=>{const r=window.__animationRecording;clearInterval(r.timer);r.recorder.stop();await r.done;r.stream.getTracks().forEach(t=>t.stop());const data=new Uint8Array(await new Blob(r.chunks,{type:r.mime}).arrayBuffer());let str='';for(let i=0;i<data.length;i+=8192)str+=String.fromCharCode(...data.subarray(i,i+8192));return{base64:btoa(str),mime:r.mime,duration:(performance.now()-r.start)/1000,timeline:r.timeline,samples:r.samples,resolution:[document.querySelector('canvas').width,document.querySelector('canvas').height]};});
 await fs.writeFile(`${dir}/animations.webm`,Buffer.from(result.base64,'base64'));delete result.base64;result.errors=errors;
 await fs.writeFile(`${dir}/recording.json`,JSON.stringify(result,null,2));console.log(JSON.stringify({duration:result.duration,resolution:result.resolution,samples:result.samples.length,errors},null,2));
}finally{for(const k of held)await page.keyboard.up(k).catch(()=>{});await page.evaluate(()=>{const r=window.__animationRecording;if(r){clearInterval(r.timer);if(r.recorder.state!=='inactive')r.recorder.stop();r.stream.getTracks().forEach(t=>t.stop());}ASHEN.reset();ASHEN.setView('play');}).catch(()=>{});await browser.close();}
