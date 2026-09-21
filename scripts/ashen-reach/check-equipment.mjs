import {chromium} from 'playwright';import {FIRE_BLAST} from '../../src/spells/fire-blast.js';import {LAVA_BALL} from '../../src/spells/lava-ball.js';
import { CDP_URL } from '../lib/cdp.mjs';import assert from 'node:assert/strict';import fs from 'node:fs/promises';
const mixed=process.argv.includes('--mixed'),torso=mixed?'pilgrimTunic':'wayfarerTunic';
const dir=`ve-capture/ashen-reach/${mixed?'mixed-equipment':'equipment'}`;await fs.mkdir(dir,{recursive:true});
const browser=await chromium.connectOverCDP(CDP_URL),page=browser.contexts()[0].pages().find(p=>p.url().includes('ashen-reach.html'));
const checks=[],errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
const check=(name,ok)=>{checks.push({name,ok:!!ok});assert.ok(ok,name);console.log('PASS',name);};
// A mesh the streaming loader has evicted stays parented under body.root but leaves
// ASHEN.scene.meshes, and setView()'s blanket setMeshVisible(body.root,true) then writes
// visible=true straight back onto that detached mesh. Reading the flag alone therefore
// reported WayfarerTunic as worn after Escape while the capture showed a bare chest. What
// every check here means by "visible" is "renders", so require scene membership too.
const state=()=>page.evaluate(()=>{const nodes=[],stack=[ASHEN.body.root],inScene=new Set(ASHEN.scene.meshes);while(stack.length){const n=stack.pop();if(n.skeleton?.boneMatrices)nodes.push({name:n.name,visible:!!n.visible&&inScene.has(n)});stack.push(...(n.children||[]));}return{equipment:ASHEN.equipment.getState(),nodes,clips:ASHEN.body.getPlaying(),meshCount:ASHEN.scene.meshes.length,bones:ASHEN.body.boneCount,hp:ASHEN.combat.dummy.hp,preview:ASHEN.armory.getState().preview};});
const visible=(s,name)=>s.nodes.filter(n=>n.name===name).some(n=>n.visible);
// Equipping an item the page has not streamed yet is asynchronous: getStatus().pending stays
// true until the pack lands. Reading state() straight after selectOption() catches the old
// garment still visible. Swaps between already-cached packs resolve synchronously, which is
// why only the first pilgrimTunic equip ever failed. Always settle before asserting.
const settle=async()=>{await page.waitForFunction(()=>!ASHEN.equipment.getStatus?.().pending,null,{timeout:30000});return state();};
try{
 await page.bringToFront();await page.goto('http://127.0.0.1:5173/ashen-reach.html?play&clean',{waitUntil:'commit'});await page.waitForFunction(()=>globalThis.ASHEN?.ready,null,{timeout:60000});await page.waitForTimeout(600);await page.keyboard.press('KeyC');
 const initial=await state();check('Prepared garments use original 65-joint actor',initial.bones===65&&visible(initial,'WayfarerTunic')&&visible(initial,'WayfarerBoots'));
 await page.locator('[data-light]').check();await page.locator('[data-motion]').selectOption('walk');await page.locator('[data-time-slider]').fill('0.24');await page.waitForTimeout(80);const before=await state();
 await page.locator('[data-equipment="torso"]').selectOption('');let s=await settle();check('Unequip removes tunic and restores covered body',!visible(s,'WayfarerTunic')&&visible(s,'BodyUnderTunic')&&s.equipment.torso===null);
 check('Unequip preserves frozen animation time',Math.abs(s.preview.time-before.preview.time)<1e-6&&s.meshCount===initial.meshCount);
 await page.locator('[data-equipment="torso"]').selectOption('wayfarerTunic');s=await settle();check('Equip hides covered body and preserves existing boot selection',visible(s,'WayfarerTunic')&&!visible(s,'BodyUnderTunic')&&s.equipment.boots==='wayfarerBoots');
 await page.locator('[data-equipment="boots"]').selectOption('');s=await settle();check('Boots unequip independently and restore feet',!visible(s,'WayfarerBoots')&&visible(s,'BodyUnderBoots')&&visible(s,'WayfarerTunic'));
 await page.locator('[data-equipment="boots"]').selectOption('wayfarerBoots');await page.locator('[data-equipment="mainHand"]').selectOption('ironSword');
 if(mixed){
  await page.locator('[data-equipment="torso"]').selectOption('pilgrimTunic');s=await settle();
  // meshCount===initial.meshCount was wrong here in both directions: `initial` predates the
  // ironSword and pilgrimTunic streams, so the count legitimately grew 75 -> 78, and a stable
  // total would not have proved the actor survived anyway. The actor-identity invariant is the
  // skeleton: a reload would rebuild it. Per-swap resource stability is asserted precisely by
  // the 40-cycle check below, which snapshots the count after everything is loaded.
  check('New torso replaces mail geometry without reloading actor',visible(s,'PilgrimTunic')&&!visible(s,'WayfarerTunic')&&s.bones===initial.bones&&Math.abs(s.preview.time-before.preview.time)<1e-6);
  await page.locator('[data-equipment="torso"]').selectOption('');s=await settle();check('Removing torso preserves trouser waist coverage',!visible(s,'BodyWaist')&&visible(s,'BodyUnderTunic'));
  await page.locator('[data-equipment="legs"]').selectOption('');s=await settle();check('Removing both garments restores waist and legs',visible(s,'BodyWaist')&&visible(s,'BodyUnderLegs')&&!visible(s,'WayfarerTrousers'));
  await page.locator('[data-equipment="torso"]').selectOption('pilgrimTunic');s=await settle();check('Torso alone covers waist and leaves legs restored',!visible(s,'BodyWaist')&&visible(s,'BodyUnderLegs'));
  await page.locator('[data-equipment="legs"]').selectOption('wayfarerTrousers');s=await settle();check('Boots tuck trouser cuffs',visible(s,'WayfarerTrousers')&&!visible(s,'WayfarerTrousersCuffs'));
  await page.locator('[data-equipment="boots"]').selectOption('');s=await settle();check('Barefoot restores full trousers and feet',visible(s,'WayfarerTrousersCuffs')&&visible(s,'BodyUnderBoots'));await page.screenshot({path:dir+'/barefoot.png'});
  await page.locator('[data-equipment="boots"]').selectOption('wayfarerBoots');
  const cycle=await page.evaluate(()=>{const time=ASHEN.body.inspection.getState().time,count=ASHEN.scene.meshes.length;for(let i=0;i<40;i++){ASHEN.equipment.equip('torso',i%2?'pilgrimTunic':'wayfarerTunic');ASHEN.equipment.equip('legs',i%3?'wayfarerTrousers':null);ASHEN.equipment.equip('boots',i%4?'wayfarerBoots':null);}ASHEN.equipment.equip('torso','pilgrimTunic');ASHEN.equipment.equip('legs','wayfarerTrousers');ASHEN.equipment.equip('boots','wayfarerBoots');return ASHEN.body.inspection.getState().time===time&&ASHEN.scene.meshes.length===count;});
  check('Repeated mixed swaps preserve actor resources and paused phase',cycle);
 }
 await page.waitForTimeout(100);await page.screenshot({path:dir+'/walk.png'});
 for(const [id,time]of [['idle','0.1'],['run','0.24'],['jump','0.3'],['fire','0.28'],['lava','1.5']]){await page.locator('[data-motion]').selectOption(id);await page.locator('[data-time-slider]').fill(time);await page.waitForTimeout(80);await page.screenshot({path:dir+'/'+id+'.png'});}
 check('Spell previews stow sword clear of open casting hand',await page.evaluate(()=>ASHEN.equipment.attachment==='back'));
 await page.locator('[data-motion]').selectOption('idle');await page.locator('[data-time-slider]').fill('0.1');await page.waitForTimeout(80);
 // The previous spell preview stowed the sword on the back, and draw/stow is eased over
 // 0.35s (see CURRENT.md, two-handed increment 2026-09-18). Measuring 80ms after asking for
 // idle sampled the sword mid-flight between back and hand -- it read 0.48m and failed every
 // run. Wait for the draw to settle, then measure.
 //
 // The old tolerance was 2mm, i.e. the sword's origin had to coincide with the socket's.
 // It does not: the grip sits ~8cm from the socket origin and the sword reads correctly held
 // in the fist in ve-capture/m12/sword/side.png. What this check is actually for is catching
 // the sword inheriting a parent world transform, which shows up as a large offset, so assert
 // a settled grip-sized offset instead of exact coincidence.
 const attachment=await page.evaluate(async()=>{
   const read=()=>{const sword=ASHEN.scene.meshes.find(m=>m.name==='SwordSteel'),socket=ASHEN.combat.fx.sockets.sockets.mainHand.node;
     return {pos:[12,13,14].map(i=>sword.worldMatrix[i]),d:Math.hypot(...[12,13,14].map(i=>sword.worldMatrix[i]-socket.worldMatrix[i]))};};
   let prev=read(),deadline=Date.now()+3000;
   while(Date.now()<deadline){
     await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
     const now=read();
     if(ASHEN.equipment.attachment==='hand'&&Math.hypot(...now.pos.map((v,i)=>v-prev.pos[i]))<1e-5)return {...now,settled:true,attachment:ASHEN.equipment.attachment};
     prev=now;
   }
   return {...read(),settled:false,attachment:ASHEN.equipment.attachment};
 });
 check('Sword grip settles on the evaluated hand, no inherited world offset',attachment.settled&&attachment.attachment==='hand'&&attachment.d<.15);
 await page.locator('[data-view="side"]').click();await page.screenshot({path:dir+'/side.png'});
 await page.locator('[data-view="back"]').click();await page.screenshot({path:dir+'/back.png'});
 // equip() stopped throwing when the streaming loader landed: equipment-loader.js validates
 // up front and *resolves* with {status:'failed',error} rather than rejecting, so the UI can
 // show the reason (this is the same path check-equipment-stream asserts the message from).
 // The old synchronous try/catch could never observe that, so it read a correct rejection as
 // a silent success. Assert the reported failure and the untouched selection instead.
 const bad=await page.evaluate(async()=>{const before=ASHEN.equipment.getState().torso;
   const result=await ASHEN.equipment.equip('torso','wayfarerBoots');
   return {result,unchanged:ASHEN.equipment.getState().torso===before,before};});
 check('Wrong-slot item rejected without changing selection',bad.result?.status==='failed'&&/does not fit this slot/i.test(bad.result?.error||'')&&bad.unchanged);
 await page.locator('[data-equipment="torso"]').selectOption('');await page.keyboard.press('Escape');await page.keyboard.down('KeyW');await page.waitForTimeout(150);await page.keyboard.up('KeyW');s=await settle();check('Gameplay view changes preserve unequipped coverage',!visible(s,'WayfarerTunic')&&visible(s,'BodyUnderTunic'));
 await page.keyboard.press('KeyC');await page.locator('[data-equipment="torso"]').selectOption(torso);await page.keyboard.press('Escape');
 // hp===480 was a 500hp dummy taking 20 damage. The dummy has 2000hp and Fire Blast deals
 // FIRE_BLAST.damage now, so read the expectation from the rule rather than restating it --
 // a rebalance should not silently turn this check red again.
 await page.keyboard.press('Tab');
 const hpBeforeCast=(await state()).hp;
 // The stow is a window, not an instant: the sword goes to the back ~40ms after the key and
 // is already easing home by the frame the spell releases, so sampling once at casts===1
 // always read 'hand' and failed. Record attachment every frame across the cast instead and
 // assert the stow was observed -- that is the behaviour this check exists to protect.
 await page.evaluate(()=>{globalThis.__stowTrace=[];globalThis.__stowStop=false;
   const tick=()=>{globalThis.__stowTrace.push(ASHEN.equipment.attachment);if(!globalThis.__stowStop)requestAnimationFrame(tick);};tick();});
 await page.keyboard.press('Digit1');await page.waitForFunction(()=>ASHEN.combat.spell.casts===1);
 const stowTrace=await page.evaluate(()=>{globalThis.__stowStop=true;return globalThis.__stowTrace;});
 check('Equipped Fire Blast deals one timed hit',(await state()).hp===hpBeforeCast-FIRE_BLAST.damage);
 check('Live cast stows weapon during release',stowTrace.includes('back'));
 await page.waitForTimeout(1200);check('Cast recovery returns weapon to hand',await page.evaluate(()=>ASHEN.equipment.attachment==='hand'));
 // hp===240 was the same 500hp-dummy arithmetic as the Fire Blast expectation above (500-20-240).
 // Derive it from the rule instead: the dummy only heals after it dies, so hp falls monotonically
 // and an exact expectation is still safe.
 const hpBeforeLava=(await state()).hp;
 await page.keyboard.press('Digit2');await page.waitForFunction(()=>ASHEN.combat.lava.casts===1);
 await page.waitForFunction(hp=>ASHEN.combat.dummy.hp===hp,hpBeforeLava-LAVA_BALL.damage);
 check('Equipped Lava Ball launches and hits',(await state()).hp===hpBeforeLava-LAVA_BALL.damage);
 await page.keyboard.press('KeyC');await page.locator('[data-motion]').selectOption('idle');await page.locator('[data-view="front"]').click();await page.locator('[data-light]').check();await page.waitForTimeout(150);await page.screenshot({path:dir+'/equipped-front.png'});
 check('No runtime/WebGPU errors',errors.length===0);
}finally{await page.keyboard.up('KeyW');await fs.writeFile(dir+'/checks.json',JSON.stringify({checks,errors,state:await state().catch(()=>null)},null,2));await browser.close();}
