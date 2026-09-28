#!/usr/bin/env node
/** Live M003 footage from one audited game tab, with capture-time durations.
 * https://chromedevtools.github.io/devtools-protocol/tot/Page/#method-startScreencast
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import {chromium} from 'playwright';
const port=Number(process.env.ASHEN_CDP_PORT),vite=Number(process.env.ASHEN_VITE_PORT);
if(!port||!vite)throw Error('Use an audited owned CDP/Vite pair');
const dir='ve-capture/character-mmo/m003/motion',frameDir=path.join(dir,'frames');
await fs.mkdir(frameDir,{recursive:true});
const browser=await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
const candidates=browser.contexts()[0].pages().filter(p=>p.url()==='about:blank');
if(candidates.length!==1)throw Error(`Expected one owned blank tab; got ${candidates.length}`);
const page=candidates[0],cdp=await page.context().newCDPSession(page);
const frames=[],writes=[],timeline=[],errors=[];let recording=false;
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
cdp.on('Page.screencastFrame',event=>{
  cdp.send('Page.screencastFrameAck',{sessionId:event.sessionId}).catch(()=>{});
  if(!recording)return;
  const name=`frame-${String(frames.length).padStart(5,'0')}.jpg`;
  frames.push({name,timestamp:event.metadata.timestamp,width:event.metadata.deviceWidth,height:event.metadata.deviceHeight});
  writes.push(fs.writeFile(path.join(frameDir,name),Buffer.from(event.data,'base64')));
});
try {
  await page.setViewportSize({width:1280,height:720});
  await page.goto(`http://127.0.0.1:${vite}/character-crowd-probe.html?path=vat&count=10&appearance=mixed&motion=walk`);
  await page.waitForFunction(()=>globalThis.CROWD_PROBE?.ready,null,{timeout:90000});
  const canvas=await page.evaluate(()=>[document.querySelector('canvas').width,document.querySelector('canvas').height]);
  if(canvas.join('x')!=='1280x720')throw Error(`Unexpected canvas ${canvas}`);
  recording=true;
  await cdp.send('Page.startScreencast',{format:'jpeg',quality:85,maxWidth:1280,maxHeight:720,everyNthFrame:2});
  const mark=async label=>timeline.push({label,timestamp:Date.now(),status:await page.evaluate(()=>CROWD_PROBE.status())});
  await mark('ten mixed dressed VAT actors walking');await page.waitForTimeout(2800);
  await page.evaluate(()=>CROWD_PROBE.set({path:'vat',count:10,appearance:'quarter',motion:'idle'}));
  await mark('quarter outfit swap and idle');await page.waitForTimeout(2200);
  await page.evaluate(()=>CROWD_PROBE.set({path:'vat',count:100,appearance:'mixed',motion:'walk'}));
  await mark('one hundred mixed actors walking');await page.waitForTimeout(2800);
  await page.evaluate(()=>CROWD_PROBE.set({path:'vat',count:10,appearance:'mixed',motion:'walk'}));
  await mark('native teardown and rebuild');await page.waitForTimeout(2000);
  // The independent control needs a fresh Lite scene after VAT was attached;
  // the diagnostic explicitly rejects that same-scene transition.
  await page.goto(`http://127.0.0.1:${vite}/character-crowd-probe.html?path=independent&count=10&appearance=mixed&motion=walk`);
  await page.waitForFunction(()=>globalThis.CROWD_PROBE?.ready,null,{timeout:90000});
  await mark('fresh independent control actors walking');await page.waitForTimeout(2200);
  recording=false;await cdp.send('Page.stopScreencast');await Promise.all(writes);
  const dimensions=[...new Set(frames.map(f=>`${f.width}x${f.height}`))];
  if(dimensions.length!==1||dimensions[0]!=='1280x720')throw Error(`Variable capture dimensions: ${dimensions}`);
  let concat='ffconcat version 1.0\n';
  for(let i=0;i<frames.length;i++){
    concat+=`file 'frames/${frames[i].name}'\n`;
    if(i+1<frames.length)concat+=`duration ${Math.max(.001,frames[i+1].timestamp-frames[i].timestamp).toFixed(6)}\n`;
  }
  await fs.writeFile(path.join(dir,'frames.ffconcat'),concat);
  await fs.writeFile(path.join(dir,'capture.json'),JSON.stringify({sourceUrl:`http://127.0.0.1:${vite}/character-crowd-probe.html`,viewport:[1280,720],canvas,dimensions,frames:frames.length,firstTimestamp:frames[0]?.timestamp,lastTimestamp:frames.at(-1)?.timestamp,timeline,errors},null,2)+'\n');
  console.log(JSON.stringify({frames:frames.length,durationSeconds:frames.at(-1)?.timestamp-frames[0]?.timestamp,dimensions,errors}));
} finally {
  recording=false;await cdp.send('Page.stopScreencast').catch(()=>{});await Promise.allSettled(writes);
  await cdp.detach().catch(()=>{});await page.goto('about:blank').catch(()=>{});await browser.close();
}
