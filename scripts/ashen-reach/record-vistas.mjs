/**
 * Live environment/lighting flythrough: CDP screencast of the real page, no
 * offline render. Stills prove a frame; only motion proves the atmosphere --
 * aerial perspective, the fog gradient and the bloom on the composite all only
 * read as depth when the camera moves through them.
 *
 * The camera is driven by an in-page rAF loop rather than by per-frame CDP
 * round-trips, because a round-trip per frame lands the pose at ~20 Hz with
 * visible stepping and the whole point of the clip is smooth parallax.
 *
 * Usage: node scripts/ashen-reach/record-vistas.mjs [--tag env-lighting]
 * Then encode frames.ffconcat with the bundled ffmpeg (docs/debug-view.md:70).
 */
import {chromium} from 'playwright';
import {CDP_URL} from '../lib/cdp.mjs';
import fs from 'node:fs/promises';

const arg=(k,d)=>{const i=process.argv.indexOf(`--${k}`);return i>=0?process.argv[i+1]:d;};
const tag=arg('tag','env-lighting');
const route=arg('route','town');
const dir=`ve-capture/ashen-reach/env-lighting/video-${tag}`;
await fs.rm(dir,{recursive:true,force:true});
await fs.mkdir(dir+'/frames',{recursive:true});

/** Each leg holds at `to` for `hold` ms after travelling for `travel` ms.
 *  The route stays on the town spine. The first cut wandered out to the west
 *  meadow and the north overlook and spent a third of its runtime on an empty
 *  grey field -- those cameras look away from everything the pass changed, and
 *  one of them boomed the camera through a wall and gave a black frame. The
 *  spine is where the atmosphere is legible: bare trees against the buried
 *  sun, the citadel as a silhouette in the bright haze, warm lantern pools
 *  read through the fog, and a closing turn that puts the lit town behind the
 *  player. */
const TOWN_LEGS=[
 {to:{x:0,z:-40,yaw:Math.PI,pitch:.18,dist:7},   travel:0,    hold:1800}, // ridgeline to the south
 {to:{x:0,z:-6,yaw:0,pitch:.10,dist:4.5},        travel:3000, hold:1000}, // turn north into the churchyard
 {to:{x:0,z:34,yaw:0,pitch:.12,dist:4},          travel:2800, hold:1400}, // lych gate: citadel in the haze
 {to:{x:0,z:68,yaw:0,pitch:.25,dist:6},          travel:2600, hold:1400}, // town gate, looking up
 {to:{x:0,z:98,yaw:0,pitch:.08,dist:4},          travel:2600, hold:1400}, // main street, lanterns
 {to:{x:0,z:130,yaw:0,pitch:.12,dist:4.5},       travel:2600, hold:1200}, // well plaza
 {to:{x:0,z:120,yaw:Math.PI,pitch:.10,dist:4},   travel:2600, hold:2400}, // turn: lit town behind
];
const BOUNDARY_LEGS=[
 {to:{x:0,z:-77,lift:16,yaw:Math.PI,pitch:.12,dist:7},travel:0,hold:1600},
 {to:{x:45,z:-50,lift:17,yaw:2.35,pitch:.12,dist:7},travel:2200,hold:400},
 {to:{x:75,z:45,lift:16,yaw:Math.PI/2,pitch:.12,dist:7},travel:2800,hold:1400},
 {to:{x:0,z:113,lift:23,yaw:0,pitch:.18,dist:8},travel:0,hold:1800}, // cut past the east grove; a travelling camera intersects its trunks
 {to:{x:0,z:119,lift:0,yaw:0,pitch:.12,dist:5},travel:1800,hold:1200},
];
const CITADEL_LEGS=[
 {to:{x:0,z:98,lift:0,yaw:0,pitch:.12,dist:5},travel:0,hold:1200},
 {to:{x:0,z:119,lift:0,yaw:0,pitch:.12,dist:5},travel:2000,hold:800},
 {to:{x:-70,z:130,lift:20,yaw:.37,pitch:.12,dist:7},travel:2600,hold:1000},
 {to:{x:70,z:130,lift:20,yaw:-.37,pitch:.12,dist:7},travel:3500,hold:1000},
 {to:{x:0,z:113,lift:23,yaw:0,pitch:.18,dist:8},travel:2400,hold:1000},
 {to:{x:0,z:119,lift:0,yaw:0,pitch:.12,dist:5},travel:1800,hold:1200},
];
const LEGS=route==='boundary'?BOUNDARY_LEGS:route==='citadel'?CITADEL_LEGS:TOWN_LEGS;
if(!['town','boundary','citadel'].includes(route))throw new Error('Unknown --route');
const browser=await chromium.connectOverCDP(CDP_URL);
const context=browser.contexts()[0];
const page=context.pages().find(p=>p.url().includes('ashen-reach.html'))||await context.newPage();
const errors=[];
page.on('pageerror',e=>errors.push(String(e.message)));
page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
await page.setViewportSize({width:1280,height:720});
await page.bringToFront();
await page.goto((process.env.ASHEN_URL||'http://127.0.0.1:5173/ashen-reach.html?play&clean')+'&noEnemies',{waitUntil:'commit'});
await page.waitForFunction(()=>window.ASHEN?.ready,null,{timeout:120000});
await page.waitForTimeout(3000);

const stats=await page.evaluate(()=>window.ASHEN.world.stats);
const post=await page.evaluate(()=>window.ASHEN.post);

// The driver owns the camera for the whole take. Writing the pose every frame
// also makes gravity and the idle controller irrelevant: whatever they do to
// the transform is overwritten before the frame is drawn.
const total=await page.evaluate(legs=>{
 const A=window.ASHEN;
 A.setView('play');
 if(legs.some(s=>s.to.lift))A.player.setFlying(true);
 const ease=t=>t*t*(3-2*t);
 const timeline=[];let t0=0,prev=legs[0].to;
 for(const leg of legs){
  timeline.push({from:prev,to:leg.to,start:t0,travel:leg.travel,hold:leg.hold});
  t0+=leg.travel+leg.hold;prev=leg.to;
 }
 const lerp=(a,b,k)=>a+(b-a)*k;
 const apply=p=>{
  A.player.setWorldPos(p.x,A.world.groundHeight(p.x,p.z)+1.7+(p.lift||0),p.z);
  A.player.setFacing(p.yaw);
  A.rig.yaw=p.yaw;A.rig.pitch=p.pitch;A.rig.distance=A.rig.distanceTarget=p.dist;
 };
 const begin=performance.now();
 window.__vistaDone=false;
 const step=()=>{
  const t=performance.now()-begin;
  let seg=timeline[timeline.length-1],k=1;
  for(const s of timeline){
   if(t<s.start+s.travel+s.hold){seg=s;k=s.travel?Math.min(1,Math.max(0,(t-s.start)/s.travel)):1;break;}
  }
  const e=ease(k);
  apply({x:lerp(seg.from.x,seg.to.x,e),z:lerp(seg.from.z,seg.to.z,e),
         lift:lerp(seg.from.lift||0,seg.to.lift||0,e),
         yaw:lerp(seg.from.yaw,seg.to.yaw,e),pitch:lerp(seg.from.pitch,seg.to.pitch,e),
         dist:lerp(seg.from.dist,seg.to.dist,e)});
  if(t>=t0){window.__vistaDone=true;return;}
  requestAnimationFrame(step);
 };
 apply(legs[0].to);requestAnimationFrame(step);
 return t0;
},LEGS);
console.log('timeline ms',total);

const frames=[],writes=[];
const cdp=await page.context().newCDPSession(page);
cdp.on('Page.screencastFrame',event=>{
 cdp.send('Page.screencastFrameAck',{sessionId:event.sessionId}).catch(()=>{});
 const name=`frame-${String(frames.length).padStart(5,'0')}.jpg`;
 frames.push({name,ts:event.metadata.timestamp});
 writes.push(fs.writeFile(`${dir}/frames/${name}`,Buffer.from(event.data,'base64')));
});
await cdp.send('Page.startScreencast',{format:'jpeg',quality:92,maxWidth:1280,maxHeight:720,everyNthFrame:1});
await page.waitForFunction(()=>window.__vistaDone===true,null,{timeout:total+30000});
await page.waitForTimeout(400);
await cdp.send('Page.stopScreencast');
await Promise.all(writes);

// Timestamped concat list: the screencast delivers frames at whatever rate the
// compositor allows, so a fixed -r would stretch or compress the motion.
const lines=['ffconcat version 1.0'];
for(let i=0;i<frames.length;i++){
 const d=i+1<frames.length?Math.max(0.008,frames[i+1].ts-frames[i].ts):0.033;
 lines.push(`file 'frames/${frames[i].name}'`,`duration ${d.toFixed(4)}`);
}
if(frames.length)lines.push(`file 'frames/${frames[frames.length-1].name}'`);
await fs.writeFile(`${dir}/frames.ffconcat`,lines.join('\n')+'\n');
const span=frames.length>1?frames[frames.length-1].ts-frames[0].ts:0;
await fs.writeFile(`${dir}/recording.json`,JSON.stringify({tag,route,frames:frames.length,seconds:+span.toFixed(2),fps:+(frames.length/Math.max(span,.001)).toFixed(1),stats,post,errors,legs:LEGS},null,2));
console.log('frames',frames.length,'seconds',span.toFixed(2),'fps',(frames.length/Math.max(span,.001)).toFixed(1));
if(errors.length)console.log('errors',errors.slice(0,5));
console.log('stats',JSON.stringify(stats),'post',JSON.stringify(post));
console.log('done ->',dir);
process.exit(0);
