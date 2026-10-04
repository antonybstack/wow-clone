/** Review connected source heads with the released clothing and coverage rules.
 * Interception is explicit and pinned: no saved identity capability is advertised.
 * This is live visual/fit evidence, never a settled FPS or startup benchmark.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {browserOwnership} from '../lib/browser-ownership.mjs';
import {createHash} from 'node:crypto';
import {EQUIPMENT_PRESETS} from '../../src/ashen-reach/equipment-catalog.js';
const port=process.env.ASHEN_CDP_PORT,url=process.env.ASHEN_TEST_URL;
assert(port&&url,'Require an audited owned browser and game URL');
const out=process.env.ASHEN_IDENTITY_REVIEW_OUT||'docs/baselines/character-mmo/m5/head-2026-10-04/current-fits';
const labels=process.argv.slice(2).length?process.argv.slice(2):['old','young','young-hair'];
const direct=process.env.ASHEN_IDENTITY_DIRECT==='1';
const seed=JSON.parse(await fs.readFile('docs/baselines/character-mmo/m7/persistence-2026-10-04/seed-largest-undyed.json','utf8'));
const report={url,direct,scope:'Connected source audition with current clothing; no identity recipe acceptance',rows:[],errors:[]};
await fs.mkdir(out,{recursive:true});
const browser=await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
assert(browser.contexts().flatMap(c=>c.pages()).every(p=>p.url()==='about:blank'),'Another owned game page is active');
const ownership=await browserOwnership(browser,{cdpPort:port,url,purpose:report.scope,renderingClients:1});
await fs.writeFile(`${out}/ownership.json`,JSON.stringify(ownership,null,2));
try{
 for(const label of labels){
  assert(['old','young','young-hair'].includes(label));
  const folder=`.cache/character-mmo/identity-review-v1/${label}`;
  const manifest=JSON.parse(await fs.readFile(`${folder}/manifest.json`,'utf8'));
  const context=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1});
  const page=await context.newPage(),errors=[];let manifestHits=0,bodyHits=0;
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  try{
   await context.addInitScript(recipe=>localStorage.setItem('ashen.appearance.v2',JSON.stringify(recipe)),seed);
   if(direct)page.on('request',r=>{const u=new URL(r.url());if(u.pathname===`/__identity_review__/${label}/manifest.json`)manifestHits++;if(u.pathname.startsWith(`/__identity_review__/${label}/body-`))bodyHits++;});
   else await page.route('**/human-shape-v1/manifest.json',r=>{manifestHits++;return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(manifest)});});
   if(!direct)await page.route('**/__identity_review__/**',async r=>{
    const pathname=new URL(r.request().url()).pathname;
    assert(pathname.startsWith(`/__identity_review__/${label}/`));
    const name=path.basename(pathname),bytes=await fs.readFile(path.join(folder,name));
    if(name.endsWith('.bin')){bodyHits++;assert.equal(createHash('sha256').update(bytes).digest('hex').slice(0,12),name.slice(5,17));}
    return r.fulfill({status:200,body:bytes,contentType:name.endsWith('.bin')?'application/octet-stream':name.endsWith('.glb')?'model/gltf-binary':name.endsWith('.webp')?'image/webp':'image/png'});
   });
   const target=new URL(url);if(direct)target.searchParams.set('humanIdentity',label);
   await page.goto(target.href);await page.waitForFunction(()=>globalThis.ASHEN?.ready,null,{timeout:90000});
   assert(manifestHits&&bodyHits,'The candidate must actually reach the running game');
   if(direct)assert.equal(await page.evaluate(()=>ASHEN.identityReview?.label),label);
   await page.evaluate(()=>{ASHEN.dev.god=true;ASHEN.armory.open();ASHEN.body.inspection.setPaused(true);ASHEN.body.inspection.seek(0);});
   const cases=[{name:'neutral',build:0,height:1},{name:'short-stout',build:.95,height:.9},{name:'tall-slender',build:-.95,height:1.15}];
   for(const shape of cases){
    await page.evaluate(async s=>{await ASHEN.creator.set('build',s.build);await ASHEN.creator.set('height',s.height);},shape);
    for(const outfit of (process.env.ASHEN_IDENTITY_OUTFITS?.split(',')||['bare','wayfarer','pilgrim','warden','lector','duskguard'])){
     if(outfit==='bare')await page.evaluate(()=>ASHEN.equipment.setLoadout(Object.fromEntries(Object.keys(ASHEN.equipment.getState()).map(s=>[s,null]))));
     else{
      const preset=EQUIPMENT_PRESETS[outfit];assert(preset,`Unknown actual preset ${outfit}`);
      const result=await page.evaluate(id=>ASHEN.equipment.equipPreset(id),outfit);assert.equal(result.status,'applied');
     }
     await page.evaluate(()=>{ASHEN.armory.open();ASHEN.body.inspection.setPaused(true);ASHEN.body.inspection.seek(0);ASHEN.armory.setFocus({height:1.48*ASHEN.player.heightScale,radius:2.2*ASHEN.player.heightScale,beta:Math.PI/2});});
     for(const [angle,alpha]of [['front',Math.PI/2],['side',0],['back',-Math.PI/2]]){
      await page.evaluate(a=>{ASHEN.armory.camera.alpha=a;},alpha);await page.waitForTimeout(90);
      const file=`${label}-${shape.name}-${outfit}-${angle}.png`;await page.screenshot({path:path.join(out,file)});
      const state=await page.evaluate(()=>({appearance:ASHEN.getAppearance(),equipment:ASHEN.equipment.getState(),bodySegments:ASHEN.equipment.getBodySegments(),visible:ASHEN.scene.meshes.filter(m=>m.visible!==false&&['HumanV1Body','HumanTorsoCore','HumanIdentityEyes','HumanPonytail01'].includes(m.name)).map(m=>m.name),gpuErrors:ASHEN.gpu.errors.slice(),physics:ASHEN.player.getDebugState().usingPhysics,recoveries:ASHEN.player.getDebugState().recoveries}));
      assert(state.physics);assert.deepEqual(state.gpuErrors,[]);assert.equal(state.appearance.shape.build,shape.build);assert.equal(state.appearance.shape.height,shape.height);
      assert(state.visible.includes('HumanIdentityEyes'),'Native eyes must remain visible');
      if(label==='young-hair')assert.equal(state.visible.includes('HumanPonytail01'),outfit!=='warden','Hood must hide the separate hair only');
      report.rows.push({label,shape,outfit,angle,file,manifestHits,bodyHits,...state});
     }
     await fs.writeFile(`${out}/report.json`,JSON.stringify(report,null,2));
    }
   }
   assert.deepEqual(errors,[]);
   if(direct)assert.deepEqual(JSON.parse(await page.evaluate(()=>localStorage.getItem('ashen.appearance.v2'))),seed,'An audition must never overwrite the saved character');
  }finally{report.errors.push(...errors);await context.close();}
 }
 report.passed=true;
}finally{
 await browser.close();await fs.writeFile(`${out}/report.json`,JSON.stringify(report,null,2));
 await fs.writeFile(`${out}/ownership.json`,JSON.stringify({...ownership,active:false,renderingClients:0},null,2));
}
