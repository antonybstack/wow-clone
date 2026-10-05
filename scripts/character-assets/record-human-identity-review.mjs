/** Live connected-source motion, using the actual Armory and Havok controls.
 * Timestamped capture is separate from isolated frame-rate measurement.
 * https://chromedevtools.github.io/devtools-protocol/tot/Page/#method-startScreencast
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {browserOwnership} from '../lib/browser-ownership.mjs';
import {captureSurface,appendFrame,writeCaptureManifest} from '../lib/capture-manifest.mjs';
import {defaultAppearance} from '../../src/character/appearance/store.js';
import {HUMAN_IDENTITY_PRESETS} from '../../src/character/appearance/human-identity.js';
import {validateAppearance} from '../../src/character/appearance/contract.js';
import {EQUIPMENT_PRESETS} from '../../src/ashen-reach/equipment-catalog.js';
const saved=process.env.ASHEN_IDENTITY_SAVED==='1';
const fits=process.env.ASHEN_IDENTITY_FIT_MOTION==='1';
assert(!fits||saved,'Fit motion uses the ordinary saved route');
const port=process.env.ASHEN_CDP_PORT,url=process.env.ASHEN_TEST_URL;
assert(port&&url,'Require an audited owned browser');
const out=process.env.ASHEN_IDENTITY_MOTION_OUT||'ve-capture/character-mmo/m5-face-2026-10-04';
if(saved)assert.equal(new URL(url).search,'','Saved motion requires an ordinary route without DEV parameters');
const pins=saved?null:JSON.parse(await fs.readFile(process.env.ASHEN_IDENTITY_SOURCE_SUMMARY||'docs/baselines/character-mmo/m5/face-2026-10-04/source-summary.json','utf8'));
const selected=process.argv.slice(2);assert(selected.every(label=>['old','young','young-hair'].includes(label)));
const browser=await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
assert(browser.contexts().flatMap(c=>c.pages()).every(p=>p.url()==='about:blank'));
try{
 for(const [label,build,height]of [['old',.95,.9],['young',0,1],['young-hair',-.95,1.15]]){
  if(selected.length&&!selected.includes(label))continue;
  const dir=path.join(out,label);await fs.mkdir(path.join(dir,'frames'),{recursive:true});
  const context=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1}),page=await context.newPage();
  const errors=[],timeline=[],writes=[];let cdp,manifest,recording=false;
  const target=new URL(url),preset=HUMAN_IDENTITY_PRESETS.find(p=>p.sourceLabel===label);
  if(saved){const base=defaultAppearance();await context.addInitScript(recipe=>localStorage.setItem('ashen.appearance.v2',JSON.stringify(recipe)),validateAppearance({...base,components:preset.components,shape:{...base.shape,build,height}}));}
  else target.searchParams.set('humanIdentity',label);
  const ownership=await browserOwnership(browser,{cdpPort:port,url:target.href,purpose:`Connected identity ${label} live motion`,renderingClients:1});
  await fs.writeFile(`${dir}/ownership.json`,JSON.stringify(ownership,null,2));
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  const mark=async name=>{
   timeline.push({name,timestamp:Date.now()/1000,state:await page.evaluate(()=>({identity:ASHEN.identityReview,appearance:ASHEN.getAppearance(),gear:ASHEN.equipment.getState(),hair:ASHEN.scene.meshes.find(m=>m.name==='HumanPonytail01')?.visible,height:ASHEN.player.heightScale,shapeWeights:ASHEN.humanShape?.weights,inspection:ASHEN.body.inspection?.getState()??null,playing:ASHEN.body.getPlaying(),physics:ASHEN.player.getDebugState().usingPhysics,recoveries:ASHEN.player.getDebugState().recoveries,gpuErrors:ASHEN.gpu.errors.slice()}))});
   if(fits)await page.evaluate(text=>{
    let n=document.getElementById('capture-note');
    if(!n){n=document.createElement('p');n.id='capture-note';n.style='position:fixed;left:30px;bottom:8px;z-index:99999;background:#171b16e8;color:#eee2ac;padding:6px 10px;font:12px Georgia;pointer-events:none';document.body.append(n);}
    n.textContent=`Live fit inspection · ${text}`;
   },name);
  };
  try{
   await page.goto(target.href);await page.waitForFunction(()=>globalThis.ASHEN?.ready,null,{timeout:90000});
   if(saved)assert.deepEqual(await page.evaluate(()=>ASHEN.getAppearance().components),preset.components);
   else assert.equal(await page.evaluate(()=>ASHEN.identityReview.sourceSha256),pins.assets.find(a=>a.label===label).sha256);
   await page.evaluate(async s=>{ASHEN.dev.god=true;await ASHEN.creator.set('build',s.build);await ASHEN.creator.set('height',s.height);await ASHEN.equipment.equipPreset('wayfarer');ASHEN.armory.open();ASHEN.body.inspection.select('idle');ASHEN.body.inspection.setPaused(false);ASHEN.armory.setFocus({height:1.5*s.height,radius:2.1*s.height,beta:Math.PI/2});}, {build,height});
   await page.check('#armory [data-light]');
   manifest={...await captureSurface(page),frames:[],timeline};
   cdp=await context.newCDPSession(page);
   cdp.on('Page.screencastFrame',event=>{
    void cdp.send('Page.screencastFrameAck',{sessionId:event.sessionId}).catch(()=>{});
    if(!recording)return;
    try{const name=`frame-${String(manifest.frames.length).padStart(6,'0')}.jpg`,bytes=Buffer.from(event.data,'base64');appendFrame(manifest,{name,timestamp:event.metadata.timestamp,bytes});writes.push(fs.writeFile(path.join(dir,'frames',name),bytes));}catch(e){errors.push(e.message);recording=false;}
   });
   recording=true;await cdp.send('Page.startScreencast',{format:'jpeg',quality:88,maxWidth:1280,maxHeight:720,everyNthFrame:fits?4:2});
   for(const [angle,alpha]of [['front',Math.PI/2],['side',0],['back',-Math.PI/2]]){
    await page.evaluate(a=>{ASHEN.armory.camera.alpha=a;},alpha);await mark(`Wayfarer ${angle}`);await page.waitForTimeout(1100);await page.screenshot({path:`${dir}/${angle}.png`});
   }
   // Face proportion work needs actual close motion, including the profile.
   // Keep the same narrow FOV and use distance/focus; a FOV change would make
   // the before/after comparison ambiguous. Remain inside the usable stage.
   await page.evaluate(()=>ASHEN.armory.setFocus({height:1.64*ASHEN.player.heightScale,radius:1.45*ASHEN.player.heightScale,beta:Math.PI/2}));
   for(const [angle,alpha]of [['face-front',Math.PI/2],['face-three-quarter',Math.PI/4],['face-profile',0]]){
    await page.evaluate(a=>{ASHEN.armory.camera.alpha=a;},alpha);await mark(`Corrected ${angle}`);await page.waitForTimeout(1000);await page.screenshot({path:`${dir}/${angle}.png`});
   }
   await page.evaluate(()=>ASHEN.armory.setFocus({height:1.5*ASHEN.player.heightScale,radius:2.1*ASHEN.player.heightScale,beta:Math.PI/2}));
   await page.locator('#armory [data-outfit="warden"]').click();
   await page.waitForFunction(loadout=>Object.entries(loadout).every(([slot,id])=>ASHEN.equipment.getState()[slot]===id),EQUIPMENT_PRESETS.warden.loadout);
   await page.evaluate(()=>{ASHEN.armory.setFocus({height:1.5*ASHEN.player.heightScale,radius:2.1*ASHEN.player.heightScale,beta:Math.PI/2});ASHEN.armory.camera.alpha=Math.PI/2;ASHEN.body.inspection.select('idle');});
   await mark('Hood face opening; separate hair hidden');await page.waitForTimeout(1300);await page.screenshot({path:`${dir}/hood-front.png`});
   await page.evaluate(()=>{ASHEN.armory.camera.alpha=0;});await page.waitForTimeout(900);await page.screenshot({path:`${dir}/hood-side.png`});
   await page.evaluate(()=>{ASHEN.armory.camera.alpha=-Math.PI/2;});await page.waitForTimeout(900);await page.screenshot({path:`${dir}/hood-back.png`});
   await page.locator('#armory [data-equipment="helmet"]').selectOption('');await page.waitForFunction(()=>ASHEN.equipment.getState().helmet===null);
   await page.evaluate(()=>ASHEN.armory.camera.alpha=Math.PI/2);
   await mark('Hood removed; hair restored');await page.waitForTimeout(800);
   if(fits){
    const frame=()=>page.evaluate(()=>{ASHEN.armory.setFocus({height:.85*ASHEN.player.heightScale,radius:3.5*ASHEN.player.heightScale,beta:Math.PI/2});ASHEN.body.inspection.setPaused(false);});
    const wear=async id=>{
     const button=page.locator(`#armory [data-outfit="${id}"]`);await button.click();
     await page.waitForFunction(loadout=>Object.entries(loadout).every(([slot,piece])=>ASHEN.equipment.getState()[slot]===piece),EQUIPMENT_PRESETS[id].loadout);
     await page.evaluate(()=>ASHEN.creator.settled());await frame();
    };
    const cycle=async(motion,title)=>{
     await page.selectOption('#armory [data-motion]',motion);await page.waitForTimeout(120);await mark(title);
     const state=await page.evaluate(()=>ASHEN.body.inspection.getState());assert.equal(state.id,motion);assert(!state.paused);
     // Give each native clip one complete cycle, including spell follow-through.
     // Preview poses are labelled; only the later controls move/deal damage.
     await page.waitForTimeout((state.duration+.15)*1000);
    };
    await frame();
    for(const id of Object.keys(EQUIPMENT_PRESETS)){
     await wear(id);await page.evaluate(()=>ASHEN.armory.camera.alpha=-Math.PI/2);
     await cycle('walk',`${id} · rear hair/shoulder clearance`);
    }
    // Five body cases cover both endpoints independently. These short shape
    // probes use Walk/Pyre; the full nine-option pass below remains separate.
    for(const [name,b,h]of [['neutral',0,1],['short-stout',.95,.9],['tall-slender',-.95,1.15],['short-slender',-.95,.9],['tall-stout',.95,1.15]]){
     await page.evaluate(async({b,h})=>{await ASHEN.creator.set('build',b);await ASHEN.creator.set('height',h);},{b,h});
     await wear('duskguard');await page.evaluate(()=>ASHEN.armory.camera.alpha=-Math.PI/2);
     await cycle('walk',`${name} · unhooded pauldrons · walk`);
     await page.evaluate(()=>ASHEN.armory.camera.alpha=0);await cycle('pulse',`${name} · unhooded pauldrons · Pyre Burst`);
     const state=timeline.at(-1).state;assert.equal(state.height,h);assert.deepEqual(state.shapeWeights,[Math.max(0,-b),Math.max(0,b)]);
     if(label==='young-hair')assert(state.hair);
    }
    for(const id of ['wayfarer','warden']){
     await wear(id);
     for(const motion of ['idle','walk','run','jump','land','fire','lava','pulse','carry']){
      await page.evaluate(a=>ASHEN.armory.camera.alpha=a,['walk','run','pulse'].includes(motion)?-Math.PI/2:Math.PI/2);
      await cycle(motion,`${id} · ${motion} · ${motion==='carry'?'raw source pose':id==='warden'?'two-handed':'one-handed'}`);
     }
    }
    await page.locator('#armory [data-equipment="helmet"]').selectOption('');await page.waitForFunction(()=>ASHEN.equipment.getState().helmet===null);
    if(label==='young-hair')assert(await page.evaluate(()=>ASHEN.scene.meshes.find(m=>m.name==='HumanPonytail01')?.visible));
    await page.evaluate(()=>{ASHEN.armory.camera.alpha=-Math.PI/2;ASHEN.armory.setFocus({height:1.53*ASHEN.player.heightScale,radius:1.7*ASHEN.player.heightScale,beta:Math.PI/2});});
    await cycle('walk','Hood removed after two-handed motion · ponytail restored');
   }else for(const motion of ['walk','run','jump','land','fire','lava','pulse','carry']){
    await page.selectOption('#armory [data-motion]',motion);await mark(`Native inspection ${motion}`);await page.waitForTimeout(900);
   }
   if(saved){
    await page.getByLabel('Face and hair',{exact:true}).selectOption(label==='old'?'prime-bald':'weathered-bald');
    await page.evaluate(()=>ASHEN.creator.settled());await page.waitForFunction(id=>ASHEN.creator.identity.selected===id,label==='old'?'prime-bald':'weathered-bald');
    await mark('Authored identity changed through Armory');await page.waitForTimeout(1100);
    await page.getByRole('button',{name:'Undo identity',exact:true}).click();await page.waitForFunction(id=>ASHEN.creator.identity.selected===id,preset.id);
    await mark('Identity undo preserves outfit and body');await page.waitForTimeout(1100);
   }
   await page.evaluate(()=>{ASHEN.armory.close();ASHEN.setView('play');ASHEN.rig.distance=ASHEN.rig.distanceTarget=2.5;});
   if(fits){
    // Real left/right turn clips are driven by existing keyboard controls.
    // There is no invented turn option in the native preview's nine choices.
    for(const key of ['KeyA','KeyD']){
     await page.keyboard.down(key);
     try{await page.waitForFunction(()=>ASHEN.body.getPlaying().some(g=>/^Turn90_[LR]$/.test(g.name)&&g.w>.02));await mark(`Normal controls · ${key} turn`);await page.waitForTimeout(500);}
     finally{await page.keyboard.up(key);}
     await page.waitForTimeout(300);
    }
   }
   await mark('Normal grounded controls');await page.keyboard.down('KeyW');await page.waitForTimeout(1300);await page.keyboard.press('Space');await page.waitForTimeout(900);await page.keyboard.up('KeyW');
   await page.keyboard.press('Digit1');await page.waitForTimeout(1400);await page.keyboard.press('KeyT');await page.waitForTimeout(900);await mark('Walk jump cast and attack complete');
   if(fits){
    await page.evaluate(()=>ASHEN.combat?.interrupt?.('Native melee fit diagnostic'));
    assert(await page.evaluate(()=>ASHEN.body.playMelee()));
    await page.waitForFunction(()=>ASHEN.body.getState().melee&&ASHEN.body.getPlaying().some(g=>g.name==='PyreBurst_Upper'&&g.w>.02));
    await mark('Native actor melee diagnostic · no damage assertion');await page.waitForTimeout(900);
   }
   assert.deepEqual(errors,[]);assert.deepEqual(await page.evaluate(()=>ASHEN.gpu.errors),[]);
   assert(timeline.every(t=>t.state.physics&&t.state.recoveries===0));
   if(label==='young-hair'){assert.equal(timeline[0].state.hair,true);assert.equal(timeline.find(t=>t.name.startsWith('Hood face')).state.hair,false);assert.equal(timeline.find(t=>t.name.startsWith('Hood removed')).state.hair,true);}
   await cdp.send('Page.stopScreencast');recording=false;await Promise.all(writes);
   await writeCaptureManifest(dir,manifest,await captureSurface(page));
   await fs.writeFile(`${dir}/report.json`,JSON.stringify({label,build,height,fits,scope:fits?'Ordinary saved route: all preset rear Walk fits, five shape Walk/Pyre probes, two loadouts with nine native preview choices, real turn/walk/jump/cast/attack; no exhaustive all-motion matrix or FPS claim':saved?'Ordinary route saved identities and live Armory transactions; separate release/performance gates':'DEV source audition; no saved identity or release acceptance',timeline,errors,passed:true},null,2));
   console.log(JSON.stringify({label,frames:manifest.frames.length,elapsedSeconds:manifest.elapsedSeconds}));
  }finally{
   recording=false;if(cdp)await cdp.send('Page.stopScreencast').catch(()=>{});await Promise.all(writes);await context.close();
   await fs.writeFile(`${dir}/ownership.json`,JSON.stringify({...ownership,active:false,renderingClients:0},null,2));
  }
 }
}finally{await browser.close();}
