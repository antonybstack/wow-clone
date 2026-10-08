/** Controlled native Lite failures on the actual built game. Not a cold-start
 * qualification, FPS benchmark or explanation of historical transport failures.
 * ASHEN_TEST_URL selects the candidate; optional ASHEN_MATERIAL_BASELINE_URL
 * reproduces the old secondary-texture attribution before the candidate cases.
 * Each case owns one fresh Chrome process and closes it, even on failure.
 * https://playwright.dev/docs/network#abort-requests
 */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {chromium} from 'playwright';
import {browserOwnership} from '../lib/browser-ownership.mjs';

const destination=process.argv[2];
assert(destination,'Specify report.json');
const target=process.env.ASHEN_TEST_URL||'http://127.0.0.1:7074/';
const baseline=process.env.ASHEN_MATERIAL_BASELINE_URL;
const dir=path.dirname(destination);
await fs.mkdir(dir,{recursive:true});
const report={schemaVersion:1,sourceCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),
  purpose:'Controlled native material texture attribution and normal game movement; no timing acceptance',
  conditions:{viewport:[1280,720],devicePixelRatio:1,browser:'Fresh native Chrome process/profile per case',recording:false},
  cases:[],ownership:[],passed:false};
const save=()=>fs.writeFile(destination,JSON.stringify(report,null,2)+'\n');
const manifestFor=async base=>{
  const response=await fetch(new URL('/ashen-reach/startup/starter/manifest.json',base));
  assert(response.ok,`Manifest HTTP ${response.status}`);
  return response.json();
};

async function run(name,base,{sourceUrl,slots=[],legacy=false,enhancement=false}={}){
  let browser,ownership,row={name,base,passed:false};
  report.cases.push(row);
  try{
    const manifest=await manifestFor(base);
    const resource=sourceUrl?(enhancement?sourceUrl:manifest.textureURLs[sourceUrl]):null;
    if(sourceUrl)assert(resource,`Missing texture mapping ${sourceUrl}`);
    const url=new URL(base);url.searchParams.set('play','');url.searchParams.set('clean','');url.searchParams.set('pixelRatio','1');
    browser=await chromium.launch({channel:'chrome',headless:true});
    ownership={...await browserOwnership(browser,{cdpPort:0,url:url.href,purpose:report.purpose,renderingClients:1}),owner:'grok-material-attribution',case:name,transport:'native pipe; no listening CDP port'};
    report.ownership.push({event:'opened',at:new Date().toISOString(),...ownership});await save();
    const context=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1,serviceWorkers:'block'});
    const page=await context.newPage(),errors=[],consoleErrors=[];
    page.on('pageerror',error=>errors.push({name:error.name,message:error.message,stack:error.stack}));
    page.on('console',message=>{if(message.type()==='error')consoleErrors.push(message.text());});
    await page.addInitScript(()=>{
      globalThis.__materialGpuErrors=[];
      const request=GPUAdapter.prototype.requestDevice;
      GPUAdapter.prototype.requestDevice=async function(...args){
        const device=await request.apply(this,args);
        device.addEventListener('uncapturederror',event=>__materialGpuErrors.push(event.error.message));
        return device;
      };
    });
    const hits=[];
    if(resource)await context.route(new URL(resource,base).href,async route=>{
      hits.push({url:route.request().url(),resourceType:route.request().resourceType()});
      await route.abort('failed');
    });
    await page.goto(url.href,{waitUntil:'domcontentloaded'});
    if(enhancement){
      await page.waitForFunction(()=>globalThis.ASHEN?.backgroundError,null,{timeout:90000});
      const state=await page.evaluate(()=>({error:ASHEN.backgroundError,playable:ASHEN.playableReady,physics:ASHEN.player.getDebugState()}));
      assert(hits.length>0,'The full-resolution request must actually be aborted');
      assert(state.error.includes(`Startup resource ${resource}: material `),state.error);
      assert(slots.some(slot=>state.error.includes(` sampler ${slot} enhancement failed`)),state.error);
      assert.match(state.error,/Failed to fetch/);
      assert(state.playable&&state.physics.usingPhysics,'Optional enhancement failure must preserve playable Havok');
      assert.equal(state.physics.recoveries,0);
      Object.assign(row,{sourceUrl,resource,enhancement:true,abortedRequests:hits,errorText:state.error,playable:state.playable,physics:state.physics,errors,consoleErrors});
    }else if(resource){
      await page.locator('#loading-retry').waitFor({state:'visible',timeout:30000});
      const text=await page.locator('#loading-error pre').textContent();
      const firstLine=text.split('\n')[0];
      assert(hits.length>0,'The controlled request must actually be aborted');
      assert.match(text,/Failed to fetch/,'Keep the native TypeError cause');
      assert.equal(await page.evaluate(()=>!!globalThis.ASHEN?.playableReady),false,'Failed required maps must retain the playable fence');
      if(legacy){
        assert.match(firstLine,/surface .+ preparation failed/);
        assert(!firstLine.includes(resource),'The old primary wrapper must demonstrate the secondary-map misattribution');
      }else{
        assert(firstLine.includes(`Startup resource ${resource}: material `),`Actual failed URL absent: ${firstLine}`);
        assert(slots.some(slot=>firstLine.includes(` sampler ${slot} preparation failed`)),`Unexpected consumer slot: ${firstLine}`);
      }
      Object.assign(row,{sourceUrl,resource,abortedRequests:hits,errorText:text,firstLine,playable:false,retryVisible:true,errors,consoleErrors});
      // Capture the actual rendered cause chain, not only the collapsed error UI.
      await page.locator('#loading-error summary').click();
    }else{
      await page.waitForFunction(()=>globalThis.ASHEN?.ready,null,{timeout:90000});
      const before=await page.evaluate(()=>ASHEN.player.getDebugState());
      await page.keyboard.down('KeyW');await page.waitForTimeout(700);await page.keyboard.up('KeyW');
      const after=await page.evaluate(()=>ASHEN.player.getDebugState());
      assert(before.usingPhysics&&after.usingPhysics,'Native Havok must remain active');
      assert(Math.hypot(after.position.x-before.position.x,after.position.z-before.position.z)>1,'Normal controls must actually move');
      assert.equal(after.recoveries,0);
      assert.equal(await page.locator('#loading').count(),0);
      assert.deepEqual(errors,[]);assert.deepEqual(consoleErrors,[]);
      Object.assign(row,{before,after,errors,consoleErrors});
    }
    row.gpuErrors=await page.evaluate(()=>__materialGpuErrors);
    assert.deepEqual(row.gpuErrors,[]);
    row.screenshot=path.join(dir,`${name}.png`);
    await page.screenshot({path:row.screenshot});row.passed=true;
  }catch(error){row.failure=error.stack;throw error;}
  finally{
    if(browser)await browser.close();
    if(ownership)report.ownership.push({event:'closed',at:new Date().toISOString(),...ownership,renderingClients:0,active:false});
    await save();
  }
}

try{
  if(baseline)await run('legacy-shared-detail',baseline,{sourceUrl:'/ashen-reach/stone-detail.png',legacy:true});
  await run('albedo',target,{sourceUrl:'/tex/forrest_ground_01/diff.jpg',slots:['albedo']});
  await run('shared-detail',target,{sourceUrl:'/ashen-reach/stone-detail.png',slots:['stoneDetail']});
  // The paving map is also another surface's albedo. Lite shares their native
  // promise; either consumer may win Promise.all rejection. Assert its exact
  // URL and actual slot instead of inventing a deterministic consumer order.
  await run('shared-paving',target,{sourceUrl:'/tex/rock_wall_08/diff.jpg',slots:['albedo','paving']});
  await run('sky',target,{sourceUrl:'/ashen-reach/sky-generated.jpg',slots:['cloud']});
  await run('enhancement',target,{sourceUrl:'/tex/forrest_ground_01/diff.jpg',slots:['albedo'],enhancement:true});
  await run('normal-movement',target);
  report.passed=true;
}catch(error){report.failure=error.stack;process.exitCode=1;}
finally{await save();}
