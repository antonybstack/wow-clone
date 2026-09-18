import {chromium} from 'playwright';import assert from 'node:assert/strict';import fs from 'node:fs/promises';
const mixed=process.argv.includes('--mixed'),torso=mixed?'pilgrimTunic':'wayfarerTunic';
const dir=`ve-capture/ashen-reach/${mixed?'mixed-equipment':'equipment'}`;await fs.mkdir(dir,{recursive:true});
const browser=await chromium.connectOverCDP('http://127.0.0.1:9337'),page=browser.contexts()[0].pages().find(p=>p.url().includes('ashen-reach.html'));
const checks=[],errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
const check=(name,ok)=>{checks.push({name,ok:!!ok});assert.ok(ok,name);console.log('PASS',name);};
const state=()=>page.evaluate(()=>{const nodes=[],stack=[ASHEN.body.root];while(stack.length){const n=stack.pop();if(n.skeleton?.boneMatrices)nodes.push({name:n.name,visible:n.visible});stack.push(...(n.children||[]));}return{equipment:ASHEN.equipment.getState(),nodes,clips:ASHEN.body.getPlaying(),meshCount:ASHEN.scene.meshes.length,bones:ASHEN.body.boneCount,hp:ASHEN.combat.dummy.hp,preview:ASHEN.armory.getState().preview};});
const visible=(s,name)=>s.nodes.filter(n=>n.name===name).some(n=>n.visible);
try{
 await page.bringToFront();await page.goto('http://127.0.0.1:5180/ashen-reach.html?play&clean',{waitUntil:'commit'});await page.waitForFunction(()=>globalThis.ASHEN?.ready,null,{timeout:60000});await page.waitForTimeout(600);await page.keyboard.press('KeyC');
 const initial=await state();check('Prepared garments use original 65-joint actor',initial.bones===65&&visible(initial,'WayfarerTunic')&&visible(initial,'WayfarerBoots'));
 await page.locator('[data-light]').check();await page.locator('[data-motion]').selectOption('walk');await page.locator('[data-time-slider]').fill('0.24');await page.waitForTimeout(80);const before=await state();
 await page.locator('[data-equipment="torso"]').selectOption('');let s=await state();check('Unequip removes tunic and restores covered body',!visible(s,'WayfarerTunic')&&visible(s,'BodyUnderTunic')&&s.equipment.torso===null);
 check('Unequip preserves frozen animation time',Math.abs(s.preview.time-before.preview.time)<1e-6&&s.meshCount===initial.meshCount);
 await page.locator('[data-equipment="torso"]').selectOption('wayfarerTunic');s=await state();check('Equip hides covered body and preserves existing boot selection',visible(s,'WayfarerTunic')&&!visible(s,'BodyUnderTunic')&&s.equipment.boots==='wayfarerBoots');
 await page.locator('[data-equipment="boots"]').selectOption('');s=await state();check('Boots unequip independently and restore feet',!visible(s,'WayfarerBoots')&&visible(s,'BodyUnderBoots')&&visible(s,'WayfarerTunic'));
 await page.locator('[data-equipment="boots"]').selectOption('wayfarerBoots');await page.locator('[data-equipment="mainHand"]').selectOption('ironSword');
 if(mixed){
  await page.locator('[data-equipment="torso"]').selectOption('pilgrimTunic');s=await state();
  check('New torso replaces mail geometry without reloading actor',visible(s,'PilgrimTunic')&&!visible(s,'WayfarerTunic')&&s.meshCount===initial.meshCount&&Math.abs(s.preview.time-before.preview.time)<1e-6);
  await page.locator('[data-equipment="torso"]').selectOption('');s=await state();check('Removing torso preserves trouser waist coverage',!visible(s,'BodyWaist')&&visible(s,'BodyUnderTunic'));
  await page.locator('[data-equipment="legs"]').selectOption('');s=await state();check('Removing both garments restores waist and legs',visible(s,'BodyWaist')&&visible(s,'BodyUnderLegs')&&!visible(s,'WayfarerTrousers'));
  await page.locator('[data-equipment="torso"]').selectOption('pilgrimTunic');s=await state();check('Torso alone covers waist and leaves legs restored',!visible(s,'BodyWaist')&&visible(s,'BodyUnderLegs'));
  await page.locator('[data-equipment="legs"]').selectOption('wayfarerTrousers');s=await state();check('Boots tuck trouser cuffs',visible(s,'WayfarerTrousers')&&!visible(s,'WayfarerTrousersCuffs'));
  await page.locator('[data-equipment="boots"]').selectOption('');s=await state();check('Barefoot restores full trousers and feet',visible(s,'WayfarerTrousersCuffs')&&visible(s,'BodyUnderBoots'));await page.screenshot({path:dir+'/barefoot.png'});
  await page.locator('[data-equipment="boots"]').selectOption('wayfarerBoots');
  const cycle=await page.evaluate(()=>{const time=ASHEN.body.inspection.getState().time,count=ASHEN.scene.meshes.length;for(let i=0;i<40;i++){ASHEN.equipment.equip('torso',i%2?'pilgrimTunic':'wayfarerTunic');ASHEN.equipment.equip('legs',i%3?'wayfarerTrousers':null);ASHEN.equipment.equip('boots',i%4?'wayfarerBoots':null);}ASHEN.equipment.equip('torso','pilgrimTunic');ASHEN.equipment.equip('legs','wayfarerTrousers');ASHEN.equipment.equip('boots','wayfarerBoots');return ASHEN.body.inspection.getState().time===time&&ASHEN.scene.meshes.length===count;});
  check('Repeated mixed swaps preserve actor resources and paused phase',cycle);
 }
 await page.waitForTimeout(100);await page.screenshot({path:dir+'/walk.png'});
 for(const [id,time]of [['idle','0.1'],['run','0.24'],['jump','0.3'],['fire','0.28'],['lava','1.5']]){await page.locator('[data-motion]').selectOption(id);await page.locator('[data-time-slider]').fill(time);await page.waitForTimeout(80);await page.screenshot({path:dir+'/'+id+'.png'});}
 check('Spell previews stow sword clear of open casting hand',await page.evaluate(()=>ASHEN.equipment.attachment==='back'));
 await page.locator('[data-motion]').selectOption('idle');await page.locator('[data-time-slider]').fill('0.1');await page.waitForTimeout(80);
 const attachment=await page.evaluate(()=>{const sword=ASHEN.scene.meshes.find(m=>m.name==='SwordSteel'),socket=ASHEN.combat.fx.sockets.sockets.mainHand.node;return Math.hypot(...[12,13,14].map(i=>sword.worldMatrix[i]-socket.worldMatrix[i]));});check('Sword grip stays on evaluated hand, no inherited world offset',attachment<.002);
 await page.locator('[data-view="side"]').click();await page.screenshot({path:dir+'/side.png'});
 await page.locator('[data-view="back"]').click();await page.screenshot({path:dir+'/back.png'});
 const bad=await page.evaluate(()=>{try{ASHEN.equipment.equip('torso','wayfarerBoots');return false;}catch{return ['wayfarerTunic','pilgrimTunic'].includes(ASHEN.equipment.getState().torso);}});check('Wrong-slot item rejected without changing selection',bad);
 await page.locator('[data-equipment="torso"]').selectOption('');await page.keyboard.press('Escape');await page.keyboard.down('KeyW');await page.waitForTimeout(150);await page.keyboard.up('KeyW');s=await state();check('Gameplay view changes preserve unequipped coverage',!visible(s,'WayfarerTunic')&&visible(s,'BodyUnderTunic'));
 await page.keyboard.press('KeyC');await page.locator('[data-equipment="torso"]').selectOption(torso);await page.keyboard.press('Escape');
 await page.keyboard.press('Tab');await page.keyboard.press('Digit1');await page.waitForFunction(()=>ASHEN.combat.spell.casts===1);check('Equipped Fire Blast deals one timed hit',(await state()).hp===480);check('Live cast stows weapon during release',await page.evaluate(()=>ASHEN.equipment.attachment==='back'));
 await page.waitForTimeout(1200);check('Cast recovery returns weapon to hand',await page.evaluate(()=>ASHEN.equipment.attachment==='hand'));await page.keyboard.press('Digit2');await page.waitForFunction(()=>ASHEN.combat.lava.casts===1);await page.waitForFunction(()=>ASHEN.combat.dummy.hp===240);check('Equipped Lava Ball launches and hits',(await state()).hp===240);
 await page.keyboard.press('KeyC');await page.locator('[data-motion]').selectOption('idle');await page.locator('[data-view="front"]').click();await page.locator('[data-light]').check();await page.waitForTimeout(150);await page.screenshot({path:dir+'/equipped-front.png'});
 check('No runtime/WebGPU errors',errors.length===0);
}finally{await page.keyboard.up('KeyW');await fs.writeFile(dir+'/checks.json',JSON.stringify({checks,errors,state:await state().catch(()=>null)},null,2));await browser.close();}
