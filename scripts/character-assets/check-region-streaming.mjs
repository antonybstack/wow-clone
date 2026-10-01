/** Slow, fresh region-asset arrival and failure checks on the actual game.
 * Uses the same immutable lease and exact transaction as future remote actors.
 * https://chromedevtools.github.io/devtools-protocol/tot/Network/#method-emulateNetworkConditions
 */
import fs from 'node:fs/promises';import assert from 'node:assert/strict';import {chromium} from 'playwright';
const port=process.env.ASHEN_CDP_PORT,url=process.env.ASHEN_TEST_URL,out=process.argv[2];assert(port&&url&&out);
const browser=await chromium.connectOverCDP(`http://127.0.0.1:${port}`);assert(browser.contexts().flatMap(c=>c.pages()).every(p=>p.url()==='about:blank'));
const context=await browser.newContext({viewport:{width:1280,height:720}}),page=await context.newPage(),report={url,profile:{downloadMbit:10,latencyMs:80},errors:[]};page.on('pageerror',e=>report.errors.push(e.stack));page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('503'))report.errors.push(m.text());});
try{
 await page.goto(url);await page.waitForFunction(()=>ASHEN?.ready&&ASHEN.hostilesReady,null,{timeout:90000});
 await page.evaluate(async()=>{globalThis.REGION=await import('/src/character/region-crowd/renderer.js');globalThis.CACHE=await import('/src/character/region-crowd/asset-cache.js');globalThis.ORIGINAL_ROOT=ASHEN.body.root;ASHEN.dev.god=true;ASHEN.metrics.setInternalResolution(1280,720);});
 await page.route('**/__region_crowd__/human-wayfarer.glb',r=>r.fulfill({status:503,body:'Intentional test download failure'}));
 report.failure=await page.evaluate(async()=>{try{await REGION.createRegionCrowd(ASHEN);return {failed:false};}catch(e){return {failed:true,error:e.message,sameBody:ORIGINAL_ROOT===ASHEN.body.root,cache:CACHE.regionAssetCacheSnapshot()};}});
 assert(report.failure.failed&&report.failure.sameBody);assert.equal(report.failure.cache.reservedBytes,0);await page.unroute('**/__region_crowd__/human-wayfarer.glb');
 const cdp=await context.newCDPSession(page);await cdp.send('Network.enable');await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:80,downloadThroughput:10*1e6/8,uploadThroughput:10*1e6/8});
 report.before=await page.evaluate(()=>({x:ASHEN.player.body.position.x,z:ASHEN.player.body.position.z,recoveries:ASHEN.player.getDebugState().recoveries}));
 await page.evaluate(()=>{globalThis.CANCELLED=new AbortController();globalThis.ARRIVALS=Promise.allSettled([REGION.createRegionCrowd(ASHEN,{signal:CANCELLED.signal}),REGION.createRegionCrowd(ASHEN)]).then(rows=>{globalThis.CROWD=rows[1].value;return rows.map(r=>({status:r.status,error:r.reason?.message}));});});
 await page.waitForFunction(()=>CACHE.regionAssetCacheSnapshot().leases>=2);await page.evaluate(()=>CANCELLED.abort());await page.keyboard.down('KeyW');await page.waitForTimeout(1200);await page.keyboard.up('KeyW');
 report.arrivals=await page.evaluate(()=>ARRIVALS);assert.equal(report.arrivals[0].status,'rejected');assert.equal(report.arrivals[1].status,'fulfilled');
 report.after=await page.evaluate(()=>({x:ASHEN.player.body.position.x,z:ASHEN.player.body.position.z,recoveries:ASHEN.player.getDebugState().recoveries,physics:ASHEN.player.getDebugState().usingPhysics,sameBody:ORIGINAL_ROOT===ASHEN.body.root,streaming:CROWD.streaming(),gpuErrors:ASHEN.gpu.errors}));
 assert(Math.hypot(report.after.x-report.before.x,report.after.z-report.before.z)>3);assert(report.after.physics&&report.after.sameBody);assert.equal(report.after.recoveries,report.before.recoveries);assert.deepEqual(report.after.gpuErrors,[]);
 await page.evaluate(()=>CROWD.dispose());await page.waitForTimeout(500);report.final=await page.evaluate(()=>CACHE.regionAssetCacheSnapshot());assert.equal(report.final.reservedBytes,0);assert.deepEqual(report.errors,[]);report.passed=true;
}catch(e){report.failureDetail=e.stack;process.exitCode=1;console.error(e);}finally{await page.keyboard.up('KeyW').catch(()=>{});await page.evaluate(()=>globalThis.CROWD?.dispose()).catch(()=>{});await fs.writeFile(out,JSON.stringify(report,null,2));await context.close();await browser.close();}
