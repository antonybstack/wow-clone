/** Native Eastwatch climb, guarded circuit and return. Initial placement uses the
 * public developer spawn link; every subsequent move uses ordinary WASD input.
 * Optional timestamped capture follows the existing Region map recorder.
 */
import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {CDP_URL} from '../lib/cdp.mjs';
import {browserOwnership} from '../lib/browser-ownership.mjs';
import {captureSurface,appendFrame,writeCaptureManifest} from '../lib/capture-manifest.mjs';
const url=new URL(process.env.ASHEN_TEST_URL||'http://127.0.0.1:7074/');
for(const [key,value] of [['dev',''],['play',''],['clean',''],['at','east-keep'],['pixelRatio','1']])url.searchParams.set(key,value);
const dir=process.env.ASHEN_CAPTURE_DIR||'.cache/wall-walk',record=process.env.ASHEN_RECORD==='1';
await fs.mkdir(dir+'/frames',{recursive:true});
const browser=await chromium.connectOverCDP(CDP_URL);
assert(browser.contexts().flatMap(c=>c.pages()).every(p=>p.url()==='about:blank'),'Blank the owned harness first');
const ownership=await browserOwnership(browser,{cdpPort:new URL(CDP_URL).port,url:url.href,purpose:'G05 native stair, wall walk, rail contacts and return; no FPS claim',renderingClients:1});
await fs.writeFile(dir+'/ownership.json',JSON.stringify(ownership,null,2));
const context=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1}),page=await context.newPage();
const errors=[],report={url:url.href,errors,samples:[],contacts:[],initialPlacement:'public developer spawn link only'};
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
const state=()=>page.evaluate(()=>{const p=ASHEN.player,d=p.getDebugState();return{x:p.body.position.x,y:p.body.position.y,z:p.body.position.z,feet:p.body.position.y-p.capsuleHeight/2,facing:p.getFacing(),physics:d.usingPhysics,recoveries:d.recoveries,flying:p.isFlying()};});
let initialRecoveries,site,cdp,manifest,captureError;const writes=[];
function valid(s,label){assert(s.physics&&!s.flying&&Number.isFinite(s.y),label);assert.equal(s.recoveries,initialRecoveries,label+': recovery teleport');}
async function face(yaw){
 const start=Date.now();
 for(;;){const s=await state(),error=Math.atan2(Math.sin(yaw-s.facing),Math.cos(yaw-s.facing));if(Math.abs(error)<.04)break;
  assert(Date.now()-start<10000,'Native turn did not converge');const key=error>0?'d':'a';await page.keyboard.down(key);await page.waitForTimeout(Math.max(12,Math.min(150,Math.abs(error)/2.55*1000)));await page.keyboard.up(key);
 }
}
async function go(point,label){
 let s=await state(),distance=Math.hypot(point[0]-s.x,point[2]-s.z),best=distance,last=Date.now(),start=last;
 while(distance>.4){
  const desired=Math.atan2(point[0]-s.x,point[2]-s.z),error=Math.atan2(Math.sin(desired-s.facing),Math.cos(desired-s.facing));
  if(Math.abs(error)>.045){await page.keyboard.up('w');await face(desired);}
  else{await page.keyboard.down('w');await page.waitForTimeout(Math.min(150,Math.max(20,(distance-.3)/7*1000)));}
  s=await state();valid(s,label);distance=Math.hypot(point[0]-s.x,point[2]-s.z);
  if(distance<best-.12){best=distance;last=Date.now();}
  assert(Date.now()-last<5000&&Date.now()-start<60000,`Blocked ${label}: ${JSON.stringify({s,point,distance})}`);
 }
 await page.keyboard.up('w');await page.waitForTimeout(120);s=await state();valid(s,label);
 assert(Math.abs(s.feet-point[1])<.3,`${label}: expected floor ${point[1]}, actual ${s.feet}`);
 report.samples.push({label,target:point,...s});await fs.writeFile(dir+'/report.json',JSON.stringify(report,null,2));return s;
}
const world=(u,y,d)=>[site.x+u*Math.cos(site.yaw)+d*Math.sin(site.yaw),site.floorY+y,site.z-u*Math.sin(site.yaw)+d*Math.cos(site.yaw)];
const local=s=>({u:(s.x-site.x)*Math.cos(site.yaw)-(s.z-site.z)*Math.sin(site.yaw),d:(s.x-site.x)*Math.sin(site.yaw)+(s.z-site.z)*Math.cos(site.yaw)});
async function contact(label,point,yaw,check){await go(point,label+':approach');await face(yaw);await page.keyboard.down('w');await page.waitForTimeout(1100);await page.keyboard.up('w');const s=await state();valid(s,label);assert(Math.abs(s.feet-site.wallWalk.floorY)<.3,label+': fell from walk');const coordinates=local(s);assert(check(coordinates),`${label}: failed guard ${JSON.stringify(coordinates)}`);report.contacts.push({label,...s,...coordinates});}
async function stopCapture(){if(!manifest)return;await cdp.send('Page.stopScreencast');cdp.removeAllListeners('Page.screencastFrame');await Promise.all(writes);if(captureError)throw captureError;await writeCaptureManifest(dir,manifest,await captureSurface(page));manifest=null;}
try{
 await page.goto(url.href,{waitUntil:'commit'});await page.waitForFunction(()=>window.ASHEN?.ready&&ASHEN.hostilesReady,null,{timeout:120000});
 report.start=await state();initialRecoveries=report.start.recoveries;valid(report.start,'start');assert.equal(initialRecoveries,0);
 site=await page.evaluate(()=>ASHEN.world.regionStructures.destinations.find(s=>s.id==='east-keep'));assert(site.wallWalk);report.site=site;
 await page.keyboard.press('Escape');await page.getByRole('button',{name:'Developer tools',exact:true}).click();const god=page.getByRole('button',{name:'God mode: off',exact:true});if(await god.count())await god.click();await page.keyboard.press('Escape');
 if(record){manifest={version:1,...await captureSurface(page),frames:[]};cdp=await context.newCDPSession(page);cdp.on('Page.screencastFrame',e=>{cdp.send('Page.screencastFrameAck',{sessionId:e.sessionId}).catch(()=>{});if(!manifest||captureError)return;try{const bytes=Buffer.from(e.data,'base64'),name=`frame-${String(manifest.frames.length).padStart(5,'0')}.jpg`;appendFrame(manifest,{name,timestamp:e.metadata.timestamp,bytes});writes.push(fs.writeFile(dir+'/frames/'+name,bytes).catch(e=>captureError=e));}catch(e){captureError=e;}});await cdp.send('Page.startScreencast',{format:'jpeg',quality:87,maxWidth:1280,maxHeight:720,everyNthFrame:4});await page.waitForTimeout(800);}
 await go(site.courtyard,'courtyard');await page.screenshot({path:dir+'/courtyard.png'});
 for(const [i,point] of site.wallWalk.route.entries()){await go(point,'outbound:'+i);if(i===4)await page.screenshot({path:dir+'/stair-landing.png'});if(i===6){await face(site.wallWalk.windowYaw);await page.waitForTimeout(1200);await page.screenshot({path:dir+'/window-view.png'});}}
 await page.screenshot({path:dir+'/left-end.png'});
 for(const [i,point] of [...site.wallWalk.route].reverse().entries())await go(point,'return:'+i);
 await go(site.courtyard,'courtyard-return');await go(site.entrance,'gate-return');
 report.returned=await state();await page.screenshot({path:dir+'/gate-return.png'});await page.waitForTimeout(800);await stopCapture();
 // Native collision contacts are separate from the uninterrupted captured tour.
 for(const [i,point] of site.wallWalk.route.slice(0,5).entries())await go(point,'contacts-ascent:'+i);
 await contact('inner-right',world(13.6,5.2,9),site.yaw-Math.PI/2,q=>q.u>=12.75&&q.u<=13.4);
 await contact('outer-right',world(13.6,5.2,9),site.yaw+Math.PI/2,q=>q.u<=14.5&&q.u>=13.9);
 await go(world(13.6,5.2,17.6),'rear-turn');
 await contact('rear-inner',world(0,5.2,17.6),site.yaw+Math.PI,q=>q.d>=16.8&&q.d<=17.3);
 for(const [i,point] of site.wallWalk.route.slice(0,6).reverse().entries())await go(point,'contacts-return:'+i);
 await go(site.entrance,'final-gate');report.end=await state();
 report.gpuErrors=await page.evaluate(()=>ASHEN.gpu.errors);assert.deepEqual(errors,[]);assert.deepEqual(report.gpuErrors,[]);report.passed=true;
}catch(error){report.failure=error.stack;await page.screenshot({path:dir+'/failure.png'}).catch(()=>{});throw error;
}finally{
 for(const key of ['w','a','d'])await page.keyboard.up(key).catch(()=>{});await cdp?.send('Page.stopScreencast').catch(()=>{});await Promise.all(writes);
 await fs.writeFile(dir+'/report.json',JSON.stringify(report,null,2));await context.close();await browser.close();await fs.writeFile(dir+'/ownership.json',JSON.stringify({...ownership,active:false,renderingClients:0},null,2));
}
console.log('PASS native Eastwatch stair, complete guarded wall walk, three guard contacts and gate return; no Fly, recoveries or runtime/GPU errors');
