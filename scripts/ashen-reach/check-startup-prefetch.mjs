/** Native built-page verification of early request sharing and stale-release guards.
 * Requires an audited owned CDP browser. Runs one context at a time; no FPS claim.
 */
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {defaultAppearance} from '../../src/character/appearance/store.js';
import {appearanceFromEquipment} from '../../src/character/appearance/from-equipment.js';
import {APPEARANCE_V1_REGISTRY,migrateAppearance} from '../../src/character/appearance/contract.js';
import {ASHEN_PLAYABLE_CLIP_NAMES} from '../../src/character/runtime/ashen-playable-motion.js';
const port=process.env.ASHEN_CDP_PORT,url=process.env.ASHEN_TEST_URL,out=process.argv[2];
assert(port&&url&&out,'Require an audited browser, exact build URL and report');
const largest=JSON.parse(await fs.readFile('docs/baselines/character-mmo/production-customization-2026-09-30/seed-largest.json','utf8'));
const selected=JSON.parse(await fs.readFile('docs/baselines/character-mmo/m5/compact-startup-2026-10-04/seed-prime-ponytail.json','utf8'));
const identityIndex=JSON.parse(await fs.readFile('public/ashen-reach/human-identity-v1/manifest.json','utf8'));
const human=defaultAppearance(),v1=appearanceFromEquipment({race:'human',loadout:Object.fromEntries(APPEARANCE_V1_REGISTRY.slots.map(slot=>[slot,human.equipment[slot]]))},APPEARANCE_V1_REGISTRY);
const browser=await chromium.connectOverCDP(`http://127.0.0.1:${port}`),report={url,rows:[]};
async function run(name,key,record,{holdLite=false,badManifest=null,identity=false}={}) {
  const context=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1}),page=await context.newPage(),requests=[],errors=[];
  let release,manifestHits=0;const gate=new Promise(resolve=>{release=resolve;});
  page.on('request',r=>requests.push(r.url()));page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  if(key)await context.addInitScript(({key,record})=>localStorage.setItem(key,JSON.stringify(record)),{key,record});
  if(holdLite)await page.route('**/assets/lite-runtime-*.js',async route=>{await gate;await route.continue();});
  if(badManifest) {
    const manifest=JSON.parse(await fs.readFile(`public/ashen-reach/${badManifest}/manifest.json`,'utf8'));
    manifest.provenance.sha256='intentional stale deployment';
    await page.route(`**/ashen-reach/${badManifest}/manifest.json`,route=>{manifestHits++;return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(manifest)});});
  }
  try {
    await page.goto(url,{waitUntil:'commit'});
    if(holdLite) {
      const bodyPath=identity?identityIndex.presets['prime-ponytail'].manifest.compactItems.body.url:null;
      await page.waitForFunction(path=>performance.getEntriesByType('resource').some(r=>path?new URL(r.name).pathname===path:/\/human-shape-v1\/body-/.test(r.name)),bodyPath,{timeout:10000});
      assert.equal(await page.evaluate(()=>typeof globalThis.ASHEN),'undefined','early assets must not wait for the renderer');
      assert.equal(requests.filter(u=>u.includes(identity?'/human-identity-v1/manifest.json':'/human-shape-v1/manifest.json')).length,1);
      release();
    }
    if(badManifest) {
      await page.waitForFunction(()=>/updated|changed/.test(document.getElementById('loading-error')?.textContent||''),null,{timeout:30000});
      assert.equal(await page.evaluate(()=>Boolean(globalThis.ASHEN?.playableReady)),false);
      const error=await page.locator('#loading-error').textContent();assert.match(error,/updated|changed/);assert(manifestHits>0,'Stale-manifest injection must reach the selected request');
      report.rows.push({name,rejected:true,manifestHits,error});return;
    }
    await page.waitForFunction(()=>globalThis.ASHEN?.playableReady,null,{timeout:30000});
    const state=await page.evaluate(()=>({marks:ASHEN.startup.timings(),shape:ASHEN.humanShape,height:ASHEN.player.heightScale,equipment:ASHEN.equipment.getState(),race:ASHEN.equipment.race,grounded:ASHEN.player.getGrounded(),physics:ASHEN.player.getDebugState().usingPhysics,gpuErrors:ASHEN.gpu.errors.slice(),resources:performance.getEntriesByType('resource').map(r=>({name:r.name,start:r.startTime,end:r.responseEnd}))}));
    assert(state.grounded&&state.physics);assert.deepEqual(state.gpuErrors,[]);assert.deepEqual(errors,[]);
    // The unsaved compact starter exposes its seven published slots before the
    // optional eight-slot editor exists. An absent empty slot is still empty;
    // retain the raw map and refuse absent occupied or unknown slots.
    state.normalizedEquipment={...Object.fromEntries(Object.keys(human.equipment).map(slot=>[slot,null])),...state.equipment};
    assert.deepEqual(state.normalizedEquipment,(holdLite?migrateAppearance(record):human).equipment);
    if(holdLite){assert.equal(state.height,record.shape.height);assert.deepEqual(state.shape.weights,[Math.max(0,-record.shape.build),Math.max(0,record.shape.build)]);}
    if(!key)assert(!state.resources.some(r=>/human-shape-v1|human-identity-v1|human-identity-assets|appearance-storage/.test(r.name)));
    if(key==='ashen.creator.v1'){assert.equal(state.height,1.15);assert.deepEqual(state.shape.weights,[0,.95]);}
    if(holdLite)assert.equal(requests.filter(u=>u.includes(identity?'/human-identity-v1/manifest.json':'/human-shape-v1/manifest.json')).length,1,'prefetch/install share one manifest');
    if(identity){
      const bodyPath=identityIndex.presets['prime-ponytail'].manifest.compactItems.body.url;
      assert.equal(requests.filter(u=>new URL(u).pathname===bodyPath).length,1,'early/install share the selected native body');
      assert(!requests.some(u=>u.includes('/startup/character/body-')),'Selected first play cannot warm the wrong face');
      state.nativeIdentity=await page.evaluate(()=>({rootScale:[ASHEN.body.root.scaling.x,ASHEN.body.root.scaling.y,ASHEN.body.root.scaling.z],groups:ASHEN.body.animationGroups.map(g=>g.name).sort(),meshes:ASHEN.scene.meshes.filter(m=>['HumanV1Body','HumanIdentityEyes','HumanIdentityBrows','HumanPonytail01'].includes(m.name)).map(m=>({name:m.name,visible:m.visible!==false,weights:m.morphTargets?Array.from(m.morphTargets.weights):null}))}));
      assert.deepEqual(state.nativeIdentity.rootScale.map(Math.abs),[record.shape.height,record.shape.height,record.shape.height]);
      assert.deepEqual(state.nativeIdentity.groups,[...ASHEN_PLAYABLE_CLIP_NAMES].sort());
      const visible=state.nativeIdentity.meshes.filter(m=>m.visible).map(m=>m.name);
      assert(visible.includes('HumanIdentityEyes')&&visible.includes('HumanIdentityBrows'));
      assert(!visible.includes('HumanPonytail01'),'This held-Lite fixture has a scalp-covering hood');
      assert(state.nativeIdentity.meshes.find(m=>m.name==='HumanV1Body')?.weights);
      const weights=[Math.max(0,-record.shape.build),Math.max(0,record.shape.build)];
      for(const mesh of state.nativeIdentity.meshes.filter(m=>m.visible&&m.weights)){
        assert.equal(mesh.weights.length,2);mesh.weights.forEach((w,i)=>assert(Math.abs(w-weights[i])<1e-5,`${mesh.name} first-play native morph differs`));
      }
    }
    if(record?.schemaVersion===999)assert.equal(await page.evaluate(key=>localStorage.getItem(key),key),JSON.stringify(record));
    report.rows.push({name,...state,requests});
  }finally{release();await page.unrouteAll({behavior:'wait'});await context.close();}
}
try {
  await run('unsaved-default',null,null);
  await run('early-largest-before-lite','ashen.appearance.v2',largest,{holdLite:true});
  await run('early-selected-before-lite','ashen.appearance.v2',selected,{holdLite:true,identity:true});
  await run('saved-neutral','ashen.appearance.v2',human);
  await run('v1-migration','ashen.appearance.v1',v1);
  await run('creator-migration','ashen.creator.v1',{schemaVersion:1,race:'human',controls:{height:1.15,build:{slender:0,stout:.95}}});
  await run('unknown-version-retained','ashen.appearance.v2',{schemaVersion:999});
  await run('stale-shape-provenance','ashen.appearance.v2',largest,{badManifest:'human-shape-v1'});
  await run('stale-identity-provenance','ashen.appearance.v2',selected,{badManifest:'human-identity-v1'});
  await run('stale-starter-provenance',null,null,{badManifest:'startup/character'});
  report.passed=true;
}finally{await fs.mkdir((await import('node:path')).dirname(out),{recursive:true});await fs.writeFile(out,JSON.stringify(report,null,2));await browser.close();}
