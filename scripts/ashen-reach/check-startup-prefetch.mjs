/** Native built-page verification of early request sharing and stale-release guards.
 * Requires an audited owned CDP browser. Runs one context at a time; no FPS claim.
 */
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {defaultAppearance} from '../../src/character/appearance/store.js';
import {appearanceFromEquipment} from '../../src/character/appearance/from-equipment.js';
import {APPEARANCE_V1_REGISTRY} from '../../src/character/appearance/contract.js';
const port=process.env.ASHEN_CDP_PORT,url=process.env.ASHEN_TEST_URL,out=process.argv[2];
assert(port&&url&&out,'Require an audited browser, exact build URL and report');
const largest=JSON.parse(await fs.readFile('docs/baselines/character-mmo/production-customization-2026-09-30/seed-largest.json','utf8'));
const human=defaultAppearance(),v1=appearanceFromEquipment({race:'human',loadout:human.equipment},APPEARANCE_V1_REGISTRY);
const browser=await chromium.connectOverCDP(`http://127.0.0.1:${port}`),report={url,rows:[]};
async function run(name,key,record,{holdLite=false,badManifest=null}={}) {
  const context=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1}),page=await context.newPage(),requests=[],errors=[];
  let release;const gate=new Promise(resolve=>{release=resolve;});
  page.on('request',r=>requests.push(r.url()));page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  if(key)await context.addInitScript(({key,record})=>localStorage.setItem(key,JSON.stringify(record)),{key,record});
  if(holdLite)await page.route('**/assets/lite-runtime-*.js',async route=>{await gate;await route.continue();});
  if(badManifest) {
    const manifest=JSON.parse(await fs.readFile(`public/ashen-reach/${badManifest}/manifest.json`,'utf8'));
    manifest.provenance.sha256='intentional stale deployment';
    await page.route(`**/ashen-reach/${badManifest}/manifest.json`,route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(manifest)}));
  }
  try {
    await page.goto(url,{waitUntil:'commit'});
    if(holdLite) {
      await page.waitForFunction(()=>performance.getEntriesByType('resource').some(r=>/\/human-shape-v1\/body-/.test(r.name)),null,{timeout:10000});
      assert.equal(await page.evaluate(()=>typeof globalThis.ASHEN),'undefined','early assets must not wait for the renderer');
      assert.equal(requests.filter(u=>u.includes('/human-shape-v1/manifest.json')).length,1);
      release();
    }
    if(badManifest) {
      await page.waitForFunction(()=>document.getElementById('loading-error')?.textContent.includes('updated'),null,{timeout:30000});
      assert.equal(await page.evaluate(()=>Boolean(globalThis.ASHEN?.playableReady)),false);
      const error=await page.locator('#loading-error').textContent();assert.match(error,/updated/);
      report.rows.push({name,rejected:true,error});return;
    }
    await page.waitForFunction(()=>globalThis.ASHEN?.playableReady,null,{timeout:30000});
    const state=await page.evaluate(()=>({marks:ASHEN.startup.timings(),shape:ASHEN.humanShape,height:ASHEN.player.heightScale,equipment:ASHEN.equipment.getState(),race:ASHEN.equipment.race,grounded:ASHEN.player.getGrounded(),physics:ASHEN.player.getDebugState().usingPhysics,gpuErrors:ASHEN.gpu.errors.slice(),resources:performance.getEntriesByType('resource').map(r=>({name:r.name,start:r.startTime,end:r.responseEnd}))}));
    assert(state.grounded&&state.physics);assert.deepEqual(state.gpuErrors,[]);assert.deepEqual(errors,[]);
    assert.deepEqual(state.equipment,(holdLite?largest:human).equipment);
    if(holdLite){assert.equal(state.height,largest.shape.height);assert.deepEqual(state.shape.weights,[.95,0]);}
    if(!key)assert(!state.resources.some(r=>/human-shape-v1|appearance-storage/.test(r.name)));
    if(key==='ashen.creator.v1'){assert.equal(state.height,1.15);assert.deepEqual(state.shape.weights,[0,.95]);}
    if(holdLite)assert.equal(requests.filter(u=>u.includes('/human-shape-v1/manifest.json')).length,1,'prefetch/install share one manifest');
    if(record?.schemaVersion===999)assert.equal(await page.evaluate(key=>localStorage.getItem(key),key),JSON.stringify(record));
    report.rows.push({name,...state,requests});
  }finally{release();await page.unrouteAll({behavior:'wait'});await context.close();}
}
try {
  await run('unsaved-default',null,null);
  await run('early-largest-before-lite','ashen.appearance.v2',largest,{holdLite:true});
  await run('saved-neutral','ashen.appearance.v2',human);
  await run('v1-migration','ashen.appearance.v1',v1);
  await run('creator-migration','ashen.creator.v1',{schemaVersion:1,race:'human',controls:{height:1.15,build:{slender:0,stout:.95}}});
  await run('unknown-version-retained','ashen.appearance.v2',{schemaVersion:999});
  await run('stale-shape-provenance','ashen.appearance.v2',largest,{badManifest:'human-shape-v1'});
  await run('stale-starter-provenance',null,null,{badManifest:'startup/character'});
  report.passed=true;
}finally{await fs.mkdir((await import('node:path')).dirname(out),{recursive:true});await fs.writeFile(out,JSON.stringify(report,null,2));await browser.close();}
