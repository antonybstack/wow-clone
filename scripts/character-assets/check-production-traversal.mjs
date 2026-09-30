/** Normal keyboard traversal at the supported body endpoints. Fixture placement
 * occurs before each route; no successful route uses flying or recovery teleports.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium} from 'playwright';
const port=process.env.ASHEN_CDP_PORT,url=process.env.ASHEN_TEST_URL,out=process.argv[2];
assert(port&&url&&out,'Require an audited owned browser, release URL and report');
const browser=await chromium.connectOverCDP(`http://127.0.0.1:${port}`),context=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1}),page=await context.newPage();
const report={url,routes:[],errors:[]};page.on('pageerror',e=>report.errors.push(e.message));
page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
const state=()=>page.evaluate(()=>({x:ASHEN.player.body.position.x,y:ASHEN.player.body.position.y,z:ASHEN.player.body.position.z,physics:ASHEN.player.getDebugState().usingPhysics,recoveries:ASHEN.player.getDebugState().recoveries,gpuErrors:ASHEN.gpu.errors.slice()}));
async function travel(key,ms){await page.keyboard.down(key);try{await page.waitForTimeout(ms);}finally{await page.keyboard.up(key);}}
try {
 await page.goto(url);await page.waitForFunction(()=>globalThis.ASHEN?.ready,null,{timeout:90000});
 await page.evaluate(()=>{ASHEN.dev.god=true;ASHEN.setView('play');});
 const before=await state();await travel('KeyW',1200);const after=await state();assert(Math.hypot(after.x-before.x,after.z-before.z)>3);
 report.routes.push({case:'spawn-movement',before,after});
 for(const build of [-.95,.95])for(const height of [.9,1.15]) {
  await page.evaluate(async({build,height})=>{await ASHEN.creator.set('build',build);await ASHEN.creator.set('height',height);const a=ASHEN,k=a.world.cathedral;a.player.setFlying(false);a.player.setWorldPos(0,k.route.heightAt(280)+1.7,280);a.player.setFacing(0);a.rig.yaw=0;a.rig.pitch=-.14;},{build,height});
  await page.waitForTimeout(700);const start=await state();
  await travel('KeyW',5400);const inside=await state();assert(inside.z>310,'must pass the cathedral portal');assert(Math.abs(inside.x)<2);
  await travel('KeyS',5400);const returned=await state();assert(returned.z<300,'must escape the cathedral normally');
  for(const s of [start,inside,returned]){assert(s.physics);assert.equal(s.recoveries,start.recoveries);assert.deepEqual(s.gpuErrors,[]);}
  report.routes.push({case:'cathedral-entry-return',build,height,start,inside,returned});
 }
 assert.deepEqual(report.errors,[]);report.passed=true;
}finally{for(const key of ['KeyW','KeyS'])await page.keyboard.up(key).catch(()=>{});await fs.writeFile(out,JSON.stringify(report,null,2));await context.close();await browser.close();}
