/** Review connected source heads with the released clothing and coverage rules.
 * ASHEN_IDENTITY_SAVED=1 exercises the published local v6 recipe on the ordinary
 * built route, without interception. The historical audition modes stay explicit.
 * This is live visual/fit evidence, never a settled FPS or startup benchmark.
 * Native glTF skins/morphs and the existing mixer own deformation:
 * https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#skins
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {browserOwnership} from '../lib/browser-ownership.mjs';
import {createHash} from 'node:crypto';
import {EQUIPMENT_PRESETS,EQUIPMENT_SLOTS,EQUIPMENT_ITEMS} from '../../src/ashen-reach/equipment-catalog.js';
import {defaultAppearance} from '../../src/character/appearance/store.js';
import {validateAppearance} from '../../src/character/appearance/contract.js';
import {HUMAN_IDENTITY_PRESETS} from '../../src/character/appearance/human-identity.js';
import {ASHEN_PLAYABLE_CLIP_NAMES} from '../../src/character/runtime/ashen-playable-motion.js';
import {resolveCoverage} from '../../src/ashen-reach/coverage-contract.js';
const port=process.env.ASHEN_CDP_PORT,url=process.env.ASHEN_TEST_URL;
assert(port&&url,'Require an audited owned browser and game URL');
const out=process.env.ASHEN_IDENTITY_REVIEW_OUT||(process.env.ASHEN_IDENTITY_SAVED==='1'?'.cache/character-mmo/m5-saved-fits-2026-10-04/matrix':'docs/baselines/character-mmo/m5/face-2026-10-04/current-fits');
const labels=process.argv.slice(2).length?process.argv.slice(2):['old','young','young-hair'];
const direct=process.env.ASHEN_IDENTITY_DIRECT==='1';
const saved=process.env.ASHEN_IDENTITY_SAVED==='1';
const control=process.env.ASHEN_IDENTITY_FIT_CONTROL==='1';
assert(!control||saved,'The deliberately inverted hair control belongs to saved fits');
assert(!(saved&&direct),'Saved and DEV audition modes are separate checks');
if(saved)assert.equal(new URL(url).search,'','Saved fits require the ordinary root without DEV parameters');
const index=saved?JSON.parse(await fs.readFile('public/ashen-reach/human-identity-v1/manifest.json','utf8')):null;
const auditionSeed=saved?null:JSON.parse(await fs.readFile('docs/baselines/character-mmo/m7/persistence-2026-10-04/seed-largest-undyed.json','utf8'));
const bare=Object.fromEntries(EQUIPMENT_SLOTS.map(slot=>[slot,null]));
const mixed={
 'mixed-hood':{...EQUIPMENT_PRESETS.graveweaver.loadout,torso:'pilgrimTunic',shoulders:'wardenPauldrons'},
 'mixed-open':{...EQUIPMENT_PRESETS.duskguard.loadout,torso:'lectorCoat',gloves:'graveweaverGloves',offHand:'graveweaverBook'},
};
const outfits=process.env.ASHEN_IDENTITY_OUTFITS?.split(',')||(saved?['bare',...Object.keys(EQUIPMENT_PRESETS),...Object.keys(mixed)]:['bare','wayfarer','pilgrim','warden','lector','duskguard']);
// Optional bounded native-pose matrix. This is visual evidence, not continuous
// gameplay or performance acceptance; the ordinary-input clip remains separate.
const motionCases=(process.env.ASHEN_IDENTITY_FIT_MOTIONS||'idle:0').split(',').map(value=>{
 const [id,raw]=value.split(':'),time=Number(raw);assert(id&&raw!==undefined&&Number.isFinite(time)&&time>=0,'Require motion:seconds');return {id,time};
});
const report={url,direct,saved,control,scope:saved?'Published saved v6 ordinary-route outfit/shape fits; no startup, FPS or exhaustive mixed-loadout acceptance':'Connected source audition with current clothing; no identity recipe acceptance',firstPlay:[],rows:[],errors:[]};
// The first-play boundary precedes optional creator controls/getAppearance.
// Read actual native meshes/gear and saved data there; assert the committed
// appearance after ready instead of delaying the first-play observation.
const partNames=[...new Set(Object.values(EQUIPMENT_ITEMS).flatMap(item=>(item.parts||[]).map(part=>part.mesh)))];
const snapshot=page=>page.evaluate(parts=>{
 const bodySegments=ASHEN.equipment.getBodySegments(),identityNames=['HumanV1Body','HumanTorsoCore','HumanFootCore','HumanIdentityEyes','HumanIdentityBrows','HumanPonytail01'];
 const names=new Set([...parts,...Object.keys(bodySegments),...identityNames]);
 const meshes=ASHEN.scene.meshes.filter(m=>names.has(m.name)).map(m=>({name:m.name,visible:m.visible!==false,weights:m.morphTargets?Array.from(m.morphTargets.weights):null}));
 const root=ASHEN.body.root;
 return {appearance:ASHEN.getAppearance?.()??null,stored:JSON.parse(localStorage.getItem('ashen.appearance.v2')),height:ASHEN.player.heightScale,capsuleHeight:ASHEN.player.capsuleHeight,rootScale:[root.scaling.x,root.scaling.y,root.scaling.z],shapeWeights:ASHEN.humanShape?.weights??null,equipment:ASHEN.equipment.getState(),bodySegments,meshes,visible:meshes.filter(m=>m.visible&&identityNames.includes(m.name)).map(m=>m.name),preview:ASHEN.body.inspection?.getState()??null,playing:ASHEN.body.getPlaying(),gpuErrors:ASHEN.gpu.errors.slice(),physics:ASHEN.player.getDebugState().usingPhysics,recoveries:ASHEN.player.getDebugState().recoveries};
},partNames);
await fs.mkdir(out,{recursive:true});
const browser=await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
assert(browser.contexts().flatMap(c=>c.pages()).every(p=>p.url()==='about:blank'),'Another owned game page is active');
const ownership=await browserOwnership(browser,{cdpPort:port,url,purpose:report.scope,renderingClients:1});
await fs.writeFile(`${out}/ownership.json`,JSON.stringify(ownership,null,2));
try{
 for(const label of labels){
  const preset=HUMAN_IDENTITY_PRESETS.find(p=>p.sourceLabel===label||p.id===label);
  assert(saved?preset:['old','young','young-hair'].includes(label),`Unknown identity ${label}`);
  const folder=`.cache/character-mmo/identity-review-v1/${label}`;
  const manifest=saved?index.presets[preset.id]?.manifest:JSON.parse(await fs.readFile(`${folder}/manifest.json`,'utf8'));
  const seed=saved?validateAppearance({...defaultAppearance(),components:preset.id==='starter'?{}:preset.components}):auditionSeed;
  const context=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1});
  const page=await context.newPage(),errors=[],requests=[];let manifestHits=0,bodyHits=0;
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  page.on('request',r=>requests.push(new URL(r.url()).pathname));
  try{
   await context.addInitScript(recipe=>localStorage.setItem('ashen.appearance.v2',JSON.stringify(recipe)),seed);
   if(direct)page.on('request',r=>{const u=new URL(r.url());if(u.pathname===`/__identity_review__/${label}/manifest.json`)manifestHits++;if(u.pathname.startsWith(`/__identity_review__/${label}/body-`))bodyHits++;});
   else if(!saved)await page.route('**/human-shape-v1/manifest.json',r=>{manifestHits++;return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(manifest)});});
   if(!direct&&!saved)await page.route('**/__identity_review__/**',async r=>{
    const pathname=new URL(r.request().url()).pathname;
    assert(pathname.startsWith(`/__identity_review__/${label}/`));
    const name=path.basename(pathname),bytes=await fs.readFile(path.join(folder,name));
    if(name.endsWith('.bin')){bodyHits++;assert.equal(createHash('sha256').update(bytes).digest('hex').slice(0,12),name.slice(5,17));}
    return r.fulfill({status:200,body:bytes,contentType:name.endsWith('.bin')?'application/octet-stream':name.endsWith('.glb')?'model/gltf-binary':name.endsWith('.webp')?'image/webp':'image/png'});
   });
   const target=new URL(url);if(direct)target.searchParams.set('humanIdentity',label);
   await page.goto(target.href);
   if(saved){
    await page.waitForFunction(()=>globalThis.ASHEN?.playableReady,null,{timeout:90000});
    const first=await snapshot(page);assert.deepEqual(first.stored,seed);assert.deepEqual(first.equipment,seed.equipment);assert(first.physics);assert.equal(first.recoveries,0);
    if(manifest){
     assert(requests.includes(manifest.compactItems.body.url),'Selected compact body must reach first play');
     assert(!requests.includes(manifest.items.body.url),'Unused source library must not be downloaded');
     assert.deepEqual(await page.evaluate(()=>ASHEN.body.animationGroups.map(g=>g.name).sort()),[...ASHEN_PLAYABLE_CLIP_NAMES].sort());
     assert(first.visible.includes('HumanIdentityEyes')&&first.visible.includes('HumanIdentityBrows'));
     assert.equal(first.visible.includes('HumanPonytail01'),preset.id==='prime-ponytail');
    }
    report.firstPlay.push({label,preset:preset.id,requests:[...requests],...first});
   }
   await page.waitForFunction(()=>globalThis.ASHEN?.ready,null,{timeout:90000});
   if(saved)assert.deepEqual((await snapshot(page)).appearance,seed);
   if(!saved)assert(manifestHits&&bodyHits,'The candidate must actually reach the running game');
   if(direct){
    assert.equal(await page.evaluate(()=>ASHEN.identityReview?.label),label);
    assert.equal(await page.evaluate(()=>ASHEN.identityReview?.sourceSha256),manifest.identityReview.sourceSha256);
   }
   await page.evaluate(()=>{ASHEN.dev.god=true;ASHEN.armory.open();ASHEN.body.inspection.setPaused(true);ASHEN.body.inspection.seek(0);});
   const cases=[{name:'neutral',build:0,height:1},{name:'short-stout',build:.95,height:.9},{name:'tall-slender',build:-.95,height:1.15},...(saved?[{name:'short-slender',build:-.95,height:.9},{name:'tall-stout',build:.95,height:1.15}]:[])];
   for(const shape of cases){
    await page.evaluate(async s=>{await ASHEN.creator.set('build',s.build);await ASHEN.creator.set('height',s.height);},shape);
    for(const outfit of outfits){
     const loadout=outfit==='bare'?bare:mixed[outfit]||EQUIPMENT_PRESETS[outfit]?.loadout;assert(loadout,`Unknown actual preset ${outfit}`);
     const result=await page.evaluate(loadout=>ASHEN.equipment.setLoadout(loadout),loadout);assert.equal(result.status,'applied',result.error);
     // API-driven diagnostic swaps do not execute the Armory's UI callback.
     // Reopen through its existing sync path so the photographed controls name
     // the actual outfit; do not alter product DOM to manufacture this evidence.
     await page.evaluate(full=>{ASHEN.armory.close();ASHEN.armory.open();ASHEN.body.inspection.select('idle');ASHEN.body.inspection.setPaused(true);ASHEN.body.inspection.seek(0);ASHEN.armory.setFocus({height:(full ? .85 : 1.48)*ASHEN.player.heightScale,radius:(full?3.5:2.2)*ASHEN.player.heightScale,beta:Math.PI/2});},saved);
     assert.deepEqual(await page.locator('#armory [data-equipment]').evaluateAll(nodes=>Object.fromEntries(nodes.map(n=>[n.dataset.equipment,n.value||null]))),loadout,'Photographed equipment controls must name the actual pieces');
     if(saved)await page.check('#armory [data-light]');
     for(const motion of motionCases){
     // Use the real selector so a diagnostic API pose cannot leave a stale
     // photographed "Idle" label, as the first back-patch control did.
     await page.selectOption('#armory [data-motion]',motion.id);
     await page.evaluate(m=>{ASHEN.body.inspection.setPaused(true);ASHEN.body.inspection.seek(m.time);},motion);
     assert.equal(await page.locator('#armory [data-motion]').inputValue(),motion.id);
     for(const [angle,alpha]of [['front',Math.PI/2],['side',0],['back',-Math.PI/2]]){
      await page.evaluate(a=>{ASHEN.armory.camera.alpha=a;},alpha);await page.waitForTimeout(90);
      const suffix=process.env.ASHEN_IDENTITY_FIT_MOTIONS?`-${motion.id}-${motion.time}`:'';
      const file=`${label}-${shape.name}-${outfit}${suffix}-${angle}.png`;await page.screenshot({path:path.join(out,file)});
      const state=await snapshot(page);
      assert.equal(state.preview.id,motion.id);assert(state.preview.paused);
      assert(Math.abs(state.preview.time-motion.time)<1e-4,'Requested phase must reach the native preview without clamping');
      assert(state.physics);assert.deepEqual(state.gpuErrors,[]);assert.equal(state.appearance.shape.build,shape.build);assert.equal(state.appearance.shape.height,shape.height);
      assert.equal(state.height,shape.height);
      if(!(preset?.id==='starter'&&shape.build===0&&state.shapeWeights===null))assert.deepEqual(state.shapeWeights,[Math.max(0,-shape.build),Math.max(0,shape.build)]);
      assert.deepEqual(state.rootScale.map(Math.abs),[shape.height,shape.height,shape.height],'Rendered native root must actually scale');
      const bodyMesh=state.meshes.find(m=>m.name==='HumanV1Body');assert(bodyMesh,'Actual body must be in the scene');
      if(bodyMesh.weights){
       assert.equal(bodyMesh.weights.length,2);
       for(const mesh of state.meshes.filter(m=>m.visible&&m.weights))for(let i=0;i<2;i++)assert(Math.abs(mesh.weights[i]-[Math.max(0,-shape.build),Math.max(0,shape.build)][i])<1e-5,`${mesh.name} native morph ${i} disagrees with shape`);
      }else assert.equal(shape.build,0,'A shaped body must actually declare native morphs');
      assert.equal(state.recoveries,0);assert.deepEqual(state.equipment,loadout);
      if(preset?.id!=='starter'){
       assert(state.visible.includes('HumanIdentityEyes'),'Native eyes must remain visible');
       assert(state.visible.includes('HumanIdentityBrows'),'Fitted brows must remain visible');
      }
      const hasPonytail=label==='young-hair'||preset?.id==='prime-ponytail';
      const coversHair=Object.values(loadout).some(id=>EQUIPMENT_ITEMS[id]?.covers?.includes('head.scalp'));
      // Same-build negative control must fail against a real hooded ponytail;
      // neither the rendered state nor product coverage is mutated for it.
      if(hasPonytail)assert.equal(state.visible.includes('HumanPonytail01'),control?coversHair:!coversHair,'Actual scalp coverage must hide and restore the separate ponytail');
      else if(saved)assert(!state.visible.includes('HumanPonytail01'),'A bald saved identity must remain bald after clothing changes');
      const hidden=new Set(resolveCoverage(loadout,EQUIPMENT_ITEMS,'human',state.bodySegments).hiddenMeshes);
      for(const name of Object.keys(state.bodySegments)){
       const meshes=state.meshes.filter(m=>m.name===name);assert(meshes.length,`Published body geoset ${name} must exist`);
       assert.equal(meshes.some(m=>m.visible),!hidden.has(name),`${name} actual body coverage disagrees`);
      }
      for(const id of Object.values(loadout).filter(Boolean))for(const part of EQUIPMENT_ITEMS[id].parts||[]){
       const shown=!(part.hideWhenSlots||[]).some(slot=>loadout[slot]);
       assert.equal(state.meshes.some(m=>m.name===part.mesh&&m.visible),shown,`${part.mesh} actual garment visibility disagrees`);
      }
      if(saved){assert.deepEqual(state.stored,state.appearance);assert.deepEqual(state.appearance.components,seed.components);}
      const body=saved?manifest?.compactItems.body:manifest?.items.body;
      report.rows.push({label,preset:saved?preset.id:null,sourceSha256:manifest?.identityReview?.sourceSha256||manifest?.identity?.sourceSha256,bodyUrl:body?.url,bodySha256:body?.sha256,shape,outfit,motion,angle,view:saved?'full-body':'head',file,manifestHits,bodyHits,...state});
     }
     }
     // Full silhouettes do not resolve a neck, scalp or tie. Save separate live
     // detail views at both neutral and maximum displacement, using the same
     // native camera rather than enlarging or retouching the full-body pixels.
     if(saved&&motionCases.length===1&&['neutral','tall-slender','tall-stout'].includes(shape.name)){
      await page.evaluate(()=>ASHEN.armory.setFocus({height:1.53*ASHEN.player.heightScale,radius:1.7*ASHEN.player.heightScale,beta:Math.PI/2}));
      for(const [angle,alpha]of [['front',Math.PI/2],['back',-Math.PI/2]]){
       await page.evaluate(a=>ASHEN.armory.camera.alpha=a,alpha);await page.waitForTimeout(90);
       const file=`${label}-${shape.name}-${outfit}-detail-${angle}.png`;await page.screenshot({path:path.join(out,file)});
       report.rows.push({label,preset:preset.id,shape,outfit,angle,view:'head-and-shoulders',file,...await snapshot(page)});
      }
     }
     await fs.writeFile(`${out}/report.json`,JSON.stringify(report,null,2));
     console.log(JSON.stringify({label,shape:shape.name,outfit,passed:true}));
    }
   }
   assert.deepEqual(errors,[]);
   if(direct)assert.deepEqual(JSON.parse(await page.evaluate(()=>localStorage.getItem('ashen.appearance.v2'))),seed,'An audition must never overwrite the saved character');
   if(saved&&manifest)assert(!requests.includes(manifest.items.body.url),'Clothing and shape changes must retain the compact playable body');
  }finally{report.errors.push(...errors);await context.close();}
 }
 report.passed=true;
}catch(error){
 report.passed=false;report.failure=error.stack;throw error;
}finally{
 await browser.close();await fs.writeFile(`${out}/report.json`,JSON.stringify(report,null,2));
 await fs.writeFile(`${out}/ownership.json`,JSON.stringify({...ownership,active:false,renderingClients:0},null,2));
}
