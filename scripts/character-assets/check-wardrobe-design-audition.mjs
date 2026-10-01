/** One owned real game, before any new design is advertised in the catalogue.
 * Explicitly label temporary legacy-slot aliases. Native clips and Havok input
 * remain the authority; captures are separate from performance measurements.
 * https://chromedevtools.github.io/devtools-protocol/tot/Page/#event-screencastFrame
 */
import fs from 'node:fs/promises';import path from 'node:path';import assert from 'node:assert/strict';
import {gunzipSync} from 'node:zlib';
import {chromium} from 'playwright';
import {browserOwnership} from '../lib/browser-ownership.mjs';
import {appendFrame,captureSurface,writeCaptureManifest} from '../lib/capture-manifest.mjs';
const port=process.env.ASHEN_CDP_PORT,url=process.env.ASHEN_TEST_URL;assert(port&&url);
const controlPreset=process.env.ASHEN_WARDROBE_CONTROL; if(controlPreset)assert(['wayfarer','pilgrim','graveweaver'].includes(controlPreset));
const kind=process.argv[2];assert(['lector','duskguard'].includes(kind));
const audition=JSON.parse(await fs.readFile(`.cache/character-mmo/wardrobe-v1/auditions/${kind}/audition.json`,'utf8'));
const layerPilot=new URL(url).searchParams.get('coveragePilot')==='layers-v1';
const coverageRows=layerPilot?JSON.parse(await fs.readFile('.cache/character-mmo/coverage-pilot/report.json','utf8')).rows.filter(r=>r.item):[];
const dir=process.env.ASHEN_CAPTURE_DIR||`ve-capture/character-mmo/${kind}-design-2026-10-01`;
const defectFocus=process.env.ASHEN_AUDITION_DEFECT_ONLY==='1';
const recordingEnabled=process.env.ASHEN_GARMENT_RECORD!=='0';
await fs.mkdir(path.join(dir,'frames'),{recursive:true});
const browser=await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
assert(browser.contexts().flatMap(c=>c.pages()).every(p=>p.url()==='about:blank'),'Another owned game is rendering');
const ownership=await browserOwnership(browser,{cdpPort:port,url,purpose:`${kind} structural source audition; temporary aliases`,renderingClients:1});
await fs.writeFile(`${dir}/ownership.json`,JSON.stringify(ownership));
const context=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1});
const page=await context.newPage(),errors=[],timeline=[],writes=[],requests=[];let cdp,manifest,recording=false;
async function equipThroughUI(next){
 for(const [slot,id]of Object.entries(next)){
  const control=page.locator(`#armory [data-equipment="${slot}"]`);
  if(await control.inputValue()!==(id||''))await control.selectOption(id||'');
  await page.waitForFunction(({slot,id})=>!ASHEN.equipment.getStatus().pending&&ASHEN.equipment.getState()[slot]===id,{slot,id});
 }
}
page.on('pageerror',e=>errors.push(e.stack));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
page.on('request',r=>requests.push(r.url()));
try{
 for(const [race,directory]of [['human','human-shape-v1'],['orc','equipment-orc'],['undead','equipment-undead']]){
  const rows=controlPreset?[]:audition.rows.filter(r=>r.race===race);
  const current=JSON.parse(await fs.readFile(`public/ashen-reach/${directory}/manifest.json`,'utf8'));
  // Local creator uses the raw fetch path; built saved startup uses the shared
  // gzip loader. Serve identical decoded bytes to both, retaining their SHA.
  if(race==='human')for(const asset of new Map([...Object.values(current.items),...Object.values(current.compactItems||{})].map(a=>[a.url,a])).values())if(asset.compression==='gzip'){
   const decoded=gunzipSync(await fs.readFile('public'+asset.url));assert.equal(decoded.length,asset.bytes);
   await context.route(`**${asset.url}`,r=>r.fulfill({contentType:'model/gltf-binary',body:decoded}));
  }
  const serveManifest=async route=>{
   const manifest=structuredClone(current);
   if(race==='human')for(const asset of [...Object.values(manifest.items),...Object.values(manifest.compactItems||{})]){delete asset.compression;delete asset.encodedBytes;}
   for(const row of rows){const entry={...manifest.items[row.alias],url:row.url,bytes:row.bytes,sha256:row.sha256};delete entry.compression;delete entry.encodedBytes;manifest.items[row.alias]=entry;if(manifest.compactItems)manifest.compactItems[row.alias]=entry;}
   for(const row of coverageRows.filter(r=>r.race===race)){const entry={...manifest.items[row.item],url:row.url,bytes:row.bytes,sha256:row.sha256};delete entry.compression;delete entry.encodedBytes;manifest.items[row.item]=entry;if(manifest.compactItems)manifest.compactItems[row.item]=entry;}
   await route.fulfill({contentType:'application/json',body:JSON.stringify(manifest)});
  };
  await context.route(`**/ashen-reach/${directory}/manifest.json`,serveManifest);
  if(layerPilot)await context.route(`**/__coverage_pilot__/${race}-manifest.json`,serveManifest);
  // Local creator defaults to the historical fit URL. Feed the same current
  // immutable family as the built creator; never accidentally audition old fits.
  if(race==='human')await context.route('**/__garment_fit__/manifest.json',serveManifest);
 }
 if(!controlPreset)for(const row of audition.rows)await context.route(`**${row.url}`,async route=>route.fulfill({contentType:'model/gltf-binary',body:await fs.readFile(row.file)}));
 for(const row of coverageRows)await context.route(`**${row.url}`,async route=>route.fulfill({contentType:'model/gltf-binary',body:await fs.readFile(row.output)}));
 await page.goto(url);await page.waitForFunction(()=>globalThis.ASHEN?.whenRest,null,{timeout:90000});await page.evaluate(()=>ASHEN.whenRest);
 await page.evaluate(label=>{ASHEN.dev.god=true;const el=document.createElement('div');el.textContent=label;Object.assign(el.style,{position:'fixed',left:'20px',top:'80px',color:'white',background:'#111d',padding:'8px',zIndex:10000});document.body.append(el);},controlPreset?`BASELINE: ${controlPreset}; isolated preview`:`CANDIDATE: ${kind}; temporary legacy slots; isolated preview`);
 if(recordingEnabled){
  manifest={...(await captureSurface(page)),frames:[],timeline};cdp=await context.newCDPSession(page);
  cdp.on('Page.screencastFrame',e=>{void cdp.send('Page.screencastFrameAck',{sessionId:e.sessionId}).catch(()=>{});if(!recording)return;try{const name=`frame-${String(manifest.frames.length).padStart(6,'0')}.jpg`,bytes=Buffer.from(e.data,'base64');appendFrame(manifest,{name,timestamp:e.metadata.timestamp,bytes});writes.push(fs.writeFile(path.join(dir,'frames',name),bytes));}catch(e){errors.push(e.stack);recording=false;}});
  recording=true;await cdp.send('Page.startScreencast',{format:'jpeg',quality:88,maxWidth:1280,maxHeight:720,everyNthFrame:2});
 }
 for(const race of defectFocus?['human','undead']:['human','orc','undead']){
  await page.evaluate(()=>ASHEN.armory.open());
  if(await page.evaluate(()=>ASHEN.equipment.race)!==race){await page.selectOption('#armory [data-race]',race);await page.waitForFunction(r=>ASHEN.equipment.race===r,race);}
  await page.locator(`#armory [data-outfit="${controlPreset||(kind==='lector'?'pilgrim':'graveweaver')}"]`).click();
  await page.waitForFunction(preset=>!ASHEN.equipment.getStatus().pending&&Object.entries(ASHEN.equipment.presets[preset].loadout).every(([slot,id])=>ASHEN.equipment.getState()[slot]===id),controlPreset||(kind==='lector'?'pilgrim':'graveweaver'));
  if(kind==='duskguard'&&!controlPreset){
   for(const [slot,id]of [['helmet',''],['mainHand','ironSword'],['offHand',''],['shoulders','wardenPauldrons']]){
    await page.selectOption(`#armory [data-equipment="${slot}"]`,id);await page.waitForFunction(({slot,id})=>!ASHEN.equipment.getStatus().pending&&ASHEN.equipment.getState()[slot]===(id||null),{slot,id});
   }
  }
  await page.check('#armory [data-light]');
  for(const [build,height]of race==='human'?(defectFocus?[[.95,1.15]]:[[0,1],[-.95,.9],[.95,1.15]]):[[0,1]]){
   if(race==='human')await page.evaluate(async({build,height})=>{await ASHEN.creator.set('build',build);await ASHEN.creator.set('height',height);},{build,height});
   await page.evaluate(()=>{ASHEN.reset();ASHEN.setView('play');ASHEN.armory.open();ASHEN.armory.setFocus({height:.9*ASHEN.player.heightScale,radius:3.5*ASHEN.player.heightScale,beta:1.4});ASHEN.scene.camera=ASHEN.armory.camera;});
   for(const view of defectFocus?['front','back']:['front','side','back']){
    await page.locator(`#armory [data-view="${view}"]`).evaluate(e=>e.click());
    for(const motion of defectFocus?['run','fire']:['idle','run','jump','land','fire','lava']){
     await page.selectOption('#armory [data-motion]',motion);await page.evaluate(()=>ASHEN.body.inspection.setPaused(false));
     const duration=await page.evaluate(()=>ASHEN.body.inspection.getState().duration);
     await page.waitForTimeout(recordingEnabled?Math.ceil((duration+.12)*1000):100);
     await page.evaluate(()=>{ASHEN.body.inspection.setPaused(true);ASHEN.body.inspection.seek(.48);});await page.waitForTimeout(70);
     await page.screenshot({path:`${dir}/${race}-${build}-${height}-${view}-${motion}.png`});
    }
   }
   const state=await page.evaluate(()=>({appearance:ASHEN.getAppearance(),equipment:ASHEN.equipment.getState(),physics:ASHEN.player.getDebugState().usingPhysics,recoveries:ASHEN.player.getDebugState().recoveries,gpuErrors:ASHEN.gpu.errors.slice()}));
   assert(state.physics&&state.recoveries===0&&!state.gpuErrors.length);timeline.push({kind,race,build,height,timestamp:Date.now()/1000,state});
   if(layerPilot){
    for(const [label,patch]of [['torso-off',{torso:null}],['legs-off',{legs:null}],['bare-body',{torso:null,legs:null,boots:null}],['torso-without-legs',{legs:null,boots:null}]]){
     // Actual selectors keep the visible labels synchronized with the worn
     // outfit; direct debug API mutations alone left misleading old UI labels.
     await equipThroughUI({...state.equipment,...patch});
     const observed=await page.evaluate(()=>({selected:ASHEN.equipment.getState(),parts:ASHEN.scene.meshes.filter(m=>['HumanTorsoCore','UndeadTorsoCore','WayfarerTrousersUnderTorso'].includes(m.name)).map(m=>({name:m.name,visible:m.visible!==false}))}));
     const torsoCore=observed.parts.filter(p=>p.name===`${race==='human'?'Human':'Undead'}TorsoCore`);
     if(race!=='orc'){assert(torsoCore.length);assert(torsoCore.every(p=>p.visible===!observed.selected.torso));}
     assert.equal(observed.parts.some(p=>p.name==='WayfarerTrousersUnderTorso'&&p.visible),!!observed.selected.legs&&!observed.selected.torso);
     for(const view of ['front','back']){await page.locator(`#armory [data-view="${view}"]`).evaluate(e=>e.click());await page.waitForTimeout(recordingEnabled?350:50);await page.screenshot({path:`${dir}/${race}-${build}-${height}-${label}-${view}.png`});}
     timeline.push({label,race,build,height,timestamp:Date.now()/1000,observed});
    }
    await equipThroughUI(state.equipment);
    // Corrupt a never-loaded optional hood at HTTP 200. The normal loader must
    // reject it while preserving the committed appearance and coverage mask.
    const directory=race==='human'?'human-shape-v1':`equipment-${race}`,current=JSON.parse(await fs.readFile(`public/ashen-reach/${directory}/manifest.json`,'utf8')),hoodUrl=current.items.graveweaverHood.url;
    const corrupt=route=>route.fulfill({contentType:'model/gltf-binary',body:Buffer.from([0])});await context.route(`**${hoodUrl}`,corrupt);
    const failed=await page.evaluate(()=>ASHEN.equipment.equip('helmet','graveweaverHood'));assert.equal(failed.status,'failed');assert.deepEqual(await page.evaluate(()=>ASHEN.equipment.getState()),state.equipment);await context.unroute(`**${hoodUrl}`,corrupt);
    timeline.push({label:'corrupt optional load rejected; appearance/coverage preserved',race,build,height,timestamp:Date.now()/1000});
    const raced=await page.evaluate(async()=>{const first=ASHEN.equipment.equip('torso','graveweaverTop'),last=ASHEN.equipment.equip('torso','pilgrimTunic');return Promise.all([first,last]);});assert.equal(raced[1].status,'applied');assert.deepEqual(await page.evaluate(()=>ASHEN.equipment.getState()),state.equipment);
    timeline.push({label:'latest torso request wins with prior coverage intact',race,build,height,results:raced.map(r=>r.status),timestamp:Date.now()/1000});
   }
   await page.selectOption('#armory [data-motion]','idle');
   await page.evaluate(()=>{ASHEN.armory.close();ASHEN.setView('play');ASHEN.rig.distance=ASHEN.rig.distanceTarget=3.3;});
   await page.keyboard.down('KeyW');await page.keyboard.down('ShiftLeft');await page.waitForTimeout(450);await page.keyboard.down('KeyA');await page.waitForTimeout(200);await page.keyboard.up('KeyA');await page.keyboard.press('Space');await page.waitForTimeout(950);await page.keyboard.up('ShiftLeft');await page.keyboard.up('KeyW');
   const after=await page.evaluate(()=>ASHEN.player.getDebugState());assert(after.usingPhysics&&after.recoveries===0);
   timeline.push({label:'normal Havok run, turn and jump',race,build,height,timestamp:Date.now()/1000});
   await page.evaluate(()=>ASHEN.armory.open());
  }
 }
 if(recordingEnabled){recording=false;await cdp.send('Page.stopScreencast');await Promise.all(writes);await writeCaptureManifest(dir,manifest,await captureSurface(page));}
 assert.deepEqual(errors,[]);
 if(!controlPreset)for(const row of audition.rows.filter(r=>!defectFocus||r.race!=='orc'))assert(requests.some(u=>u.endsWith(row.url)),`Candidate was never requested: ${row.url}`);
 await fs.writeFile(`${dir}/report.json`,JSON.stringify({kind,controlPreset:controlPreset||null,defectFocus,candidateOnly:!controlPreset,temporaryAliases:!controlPreset,timeline,errors,candidateRequests:requests.filter(u=>u.includes('/__wardrobe_audition__/')),runtimePassed:true,visualAcceptance:'requires parent review'},null,2));
 console.log(JSON.stringify({kind,frames:manifest?.frames.length||0,errors}));
}finally{recording=false;if(cdp)await cdp.send('Page.stopScreencast').catch(()=>{});await Promise.all(writes);await context.close();await browser.close();await fs.writeFile(`${dir}/ownership.json`,JSON.stringify({...ownership,active:false,renderingClients:0}));}
