/** Live CDP capture of the current three race packs; only run against an owned game tab.
 * Page.startScreencast: https://chromedevtools.github.io/devtools-protocol/tot/Page/#method-startScreencast
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import {chromium} from 'playwright';
const port=Number(process.env.ASHEN_CDP_PORT), url=process.env.ASHEN_URL;
if(!port || !url) throw Error('ASHEN_CDP_PORT and ASHEN_URL required');
const dir=process.env.ASHEN_CAPTURE_DIR || 've-capture/character-mmo/m001';
await fs.mkdir(path.join(dir,'frames'),{recursive:true});
const browser=await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
const page=browser.contexts().flatMap(c=>c.pages()).find(p=>p.url().startsWith(url.split('?')[0]) || p.url()==='about:blank');
if(!page) throw Error('Owned game page missing');
const errors=[],frames=[],writes=[],timeline=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
const cdp=await page.context().newCDPSession(page);
let recording=false;
cdp.on('Page.screencastFrame',e=>{
  cdp.send('Page.screencastFrameAck',{sessionId:e.sessionId}).catch(()=>{});
  if(!recording)return;
  const name=`frame-${String(frames.length).padStart(5,'0')}.jpg`;
  frames.push({name,time:e.metadata.timestamp,width:e.metadata.deviceWidth,height:e.metadata.deviceHeight});
  writes.push(fs.writeFile(path.join(dir,'frames',name),Buffer.from(e.data,'base64')));
});
const pause=ms=>page.waitForTimeout(ms);
try {
  await page.setViewportSize({width:1280,height:720});
  await page.goto(url);
  await page.waitForFunction(()=>globalThis.ASHEN?.ready,null,{timeout:90000});
  await page.evaluate(()=>{ASHEN.dev.god=true;});
  await page.keyboard.press('KeyC');
  await page.locator('[data-light]').check();
  const canvas=await page.evaluate(()=>[document.getElementById('renderCanvas').width,document.getElementById('renderCanvas').height]);
  recording=true;
  await cdp.send('Page.startScreencast',{format:'jpeg',quality:84,maxWidth:1280,maxHeight:720,everyNthFrame:3});
  const start=Date.now(),mark=label=>timeline.push({seconds:(Date.now()-start)/1000,label});
  for(const race of ['human','orc','undead']) {
    mark(`${race} race and Wayfarer outfit`);
    await page.locator('[data-race]').selectOption(race);
    await page.waitForFunction(r=>ASHEN.equipment.race===r,race,{timeout:30000});
    await page.locator('[data-outfit="wayfarer"]').click();
    await page.waitForFunction(()=>!ASHEN.equipment.getStatus?.().pending);
    for(const view of ['front','side','back']) {
      mark(`${race} ${view} idle`);
      await page.locator(`[data-view="${view}"]`).click();
      await page.locator('[data-motion]').selectOption('idle');
      await pause(450);
      await page.screenshot({path:path.join(dir,`${race}-${view}.png`)});
    }
    for(const motion of ['walk','run','jump','fire','lava','carry']) {
      const choices=await page.locator('[data-motion] option').evaluateAll(o=>o.map(x=>x.value));
      if(!choices.includes(motion)) {errors.push(`${race}: ${motion} preview unavailable`);continue;}
      mark(`${race} ${motion}`);
      await page.locator('[data-motion]').selectOption(motion);
      await pause(motion==='carry'?700:550);
    }
    mark(`${race} Warden two-handed greatstaff, front and side`);
    await page.locator('[data-outfit="warden"]').click();
    await page.waitForFunction(()=>!ASHEN.equipment.getStatus?.().pending);
    await page.locator('[data-view="front"]').click();
    await page.locator('[data-motion]').selectOption('carry');
    await pause(700);
    await page.screenshot({path:path.join(dir,`${race}-warden-front.png`)});
    await page.locator('[data-view="side"]').click();
    await pause(700);
    await page.screenshot({path:path.join(dir,`${race}-warden-side.png`)});
    mark(`${race} gameplay movement, jump and two casts`);
    await page.keyboard.press('Escape');
    await page.evaluate(()=>{ASHEN.reset();ASHEN.setView('play');});
    await page.keyboard.down('KeyW');await pause(650);await page.keyboard.up('KeyW');
    await page.keyboard.press('Space');await pause(600);
    await page.evaluate(()=>ASHEN.combat.targeting.select(ASHEN.combat.dummy.id));
    if(await page.evaluate(()=>ASHEN.combat.snapshot().target)!==await page.evaluate(()=>ASHEN.combat.dummy.id)) throw Error('Training dummy target selection failed');
    await page.keyboard.press('Digit1');await pause(1250);
    await page.keyboard.press('Digit2');await pause(1500);
    if(await page.evaluate(()=>ASHEN.combat.snapshot().life.dead)) throw Error(`${race} died during motion review`);
    await page.keyboard.press('KeyC');
  }
  recording=false;
  await cdp.send('Page.stopScreencast');
  await Promise.all(writes);
  let concat='ffconcat version 1.0\n';
  for(let i=0;i<frames.length;i++) {
    concat+=`file 'frames/${frames[i].name}'\n`;
    if(i+1<frames.length)concat+=`duration ${Math.max(.001,frames[i+1].time-frames[i].time).toFixed(6)}\n`;
  }
  await fs.writeFile(path.join(dir,'frames.ffconcat'),concat);
  await fs.writeFile(path.join(dir,'recording.json'),JSON.stringify({sourceUrl:url,viewport:[1280,720],canvas,frames:frames.length,firstTimestamp:frames[0]?.time,lastTimestamp:frames.at(-1)?.time,frameDimensions:[...new Set(frames.map(f=>`${f.width}x${f.height}`))],timeline,errors},null,2));
  console.log(JSON.stringify({frames:frames.length,canvas,errors}));
} finally {
  recording=false;
  await cdp.send('Page.stopScreencast').catch(()=>{});
  await cdp.detach().catch(()=>{});
  await page.goto('about:blank').catch(()=>{});
  await browser.close();
}
