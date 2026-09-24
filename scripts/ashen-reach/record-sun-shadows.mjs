/** Actual keyboard traversal, followed by a cut to the town street. */
import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import {CDP_URL} from '../lib/cdp.mjs';
const tagIndex=process.argv.indexOf('--tag');
const tag=tagIndex>=0?process.argv[tagIndex+1]:'v11-street';
const dir=`ve-capture/ashen-reach/sun-shadows/video-${tag}`;
await fs.mkdir(`${dir}/frames`,{recursive:true});
const browser=await chromium.connectOverCDP(CDP_URL);
const page=browser.contexts()[0].pages().find(p=>p.url().includes('ashen-reach'))||await browser.contexts()[0].newPage();
const errors=[],frames=[],writes=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('console',m=>{if(m.type()==='error'||/validation|invalid.*(bind|shader|command|pipeline)/i.test(m.text()))errors.push(m.text());});
await page.setViewportSize({width:1280,height:720});await page.bringToFront();
await page.goto('http://127.0.0.1:5173/ashen-reach.html?play&clean&noEnemies',{waitUntil:'commit'});
await page.waitForFunction(()=>window.ASHEN?.ready,null,{timeout:90000});
const place=async(z,pitch=.35)=>{
 await page.evaluate(({z,pitch})=>{const A=ASHEN;A.setView('play');A.player.setWorldPos(0,A.world.groundHeight(0,z)+1.7,z);A.player.setFacing(0);A.rig.yaw=0;A.rig.pitch=pitch;A.rig.distance=A.rig.distanceTarget=5;},{z,pitch});
 await page.waitForTimeout(1600);
};
await place(-55);
const resolution=await page.evaluate(()=>({...ASHEN.volumetric.state}));
const cdp=await page.context().newCDPSession(page);
cdp.on('Page.screencastFrame',e=>{
 void cdp.send('Page.screencastFrameAck',{sessionId:e.sessionId}).catch(()=>{});
 const name=`frame-${String(frames.length).padStart(5,'0')}.jpg`;
 frames.push({name,ts:e.metadata.timestamp});writes.push(fs.writeFile(`${dir}/frames/${name}`,Buffer.from(e.data,'base64')));
});
const positions=[];
try{
 await cdp.send('Page.startScreencast',{format:'jpeg',quality:90,maxWidth:1280,maxHeight:720,everyNthFrame:1});
 await page.waitForTimeout(1300);
 positions.push(await page.evaluate(()=>({...ASHEN.player.body.position})));
 await page.keyboard.down('KeyW');await page.waitForTimeout(6200);await page.keyboard.up('KeyW');
 positions.push(await page.evaluate(()=>({...ASHEN.player.body.position})));
 await page.waitForTimeout(1400);
 // Deliberate cut: town is in mountain shadow at this fixed sun angle.
 await place(95,.16);await page.waitForTimeout(800);
 await page.keyboard.down('KeyW');await page.waitForTimeout(2700);await page.keyboard.up('KeyW');
 await page.waitForTimeout(1800);
 await cdp.send('Page.stopScreencast');await Promise.all(writes);
 const lines=['ffconcat version 1.0'];
 for(let i=0;i<frames.length;i++)lines.push(`file 'frames/${frames[i].name}'`,`duration ${Math.max(.008,i+1<frames.length?frames[i+1].ts-frames[i].ts:1/60).toFixed(6)}`);
 await fs.writeFile(`${dir}/frames.ffconcat`,lines.join('\n')+'\n');
 const seconds=frames.at(-1).ts-frames[0].ts;
 const report={tag,frames:frames.length,seconds,fps:frames.length/seconds,viewport:[1280,720],resolution,positions,errors};
 await fs.writeFile(`${dir}/recording.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 if(errors.length)throw new Error('Recording contained runtime/GPU errors');
}finally{await page.keyboard.up('KeyW').catch(()=>{});await browser.close();}
